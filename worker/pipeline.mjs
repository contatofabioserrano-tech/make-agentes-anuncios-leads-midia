// Fortuna Creative — ponte Node → Python.
//
// O motor real de render vive em pipeline_py/run_pipeline.py (adaptado dos
// scripts PROVADOS spot2/spot3). Este módulo:
//   1. cria um workdir temporário;
//   2. baixa o vídeo-fonte do bucket privado 'videos' quando videoType='integra';
//   3. escreve spec.json e chama `python run_pipeline.py --spec ... --workdir ...`;
//   4. repassa PROGRESS/STAGE do stdout pro worker;
//   5. devolve os outputs de <workdir>/out:
//      - vídeo: master principal primeiro (final_9x16.mp4, ou final_16x9.mp4
//        NATIVO no google_ads) + final_4k.mp4 e extras;
//      - carrossel: slide_01..10.png (contentType image/png).

import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUN_PIPELINE = path.join(__dirname, "pipeline_py", "run_pipeline.py");
const PYTHON_BIN = process.env.PYTHON_BIN || "python";
const PIPELINE_TIMEOUT_MS = Number(process.env.PIPELINE_TIMEOUT_MS || 120 * 60_000);

/**
 * @param {object} args
 * @param {import('@supabase/supabase-js').SupabaseClient} args.supabase
 * @param {object} args.job - linha de render_jobs (job.spec = decisões aprovadas)
 * @param {(progress:number)=>Promise<void>} args.onProgress
 * @returns {Promise<{ workdir: string, outputs: {name:string,path:string}[], meta: object }>}
 */
export async function runPipeline({ supabase, job, onProgress }) {
  const spec = job.spec || {};
  const videoType = spec.videoType || "propaganda";
  const work = await mkdtemp(path.join(tmpdir(), "fortuna-"));

  // Modo 'integra': baixa a fonte do bucket privado 'videos' com o service client.
  if (videoType === "integra") {
    const srcPath = spec.source_video_path || spec.video_path;
    if (!srcPath) {
      throw new Error('estágio "setup": job integra sem source_video_path no spec');
    }
    const { data, error } = await supabase.storage.from("videos").download(srcPath);
    if (error) {
      throw new Error(`estágio "setup": download da fonte falhou: ${error.message}`);
    }
    await writeFile(path.join(work, "source.mp4"), Buffer.from(await data.arrayBuffer()));
  }

  const specFile = path.join(work, "spec.json");
  await writeFile(specFile, JSON.stringify(spec, null, 2), "utf8");

  await runPython(specFile, work, onProgress);

  const outDir = path.join(work, "out");

  // 'carrossel': múltiplos outputs de IMAGEM (slide_01..10.png).
  if (videoType === "carrossel") {
    const slides = (await readdir(outDir).catch(() => []))
      .filter((f) => /^slide_\d{2}\.png$/.test(f))
      .sort();
    if (slides.length === 0) {
      throw new Error('estágio "artes": nenhum slide_XX.png foi gerado');
    }
    return {
      workdir: work,
      outputs: slides.map((name) => ({
        name,
        path: path.join(outDir, name),
        contentType: "image/png",
      })),
      meta: {
        videoType,
        kind: "image",
        aspect: spec.aspect || "4:5",
        width: 1080,
        height: 1350,
        count: slides.length,
        container: "png",
      },
    };
  }

  // Vídeo: master principal primeiro (16:9 NATIVO no google_ads), depois extras.
  const landscape = videoType === "google_ads";
  const main = landscape ? "final_16x9.mp4" : "final_9x16.mp4";
  const files = (await readdir(outDir).catch(() => [])).filter((f) => f.endsWith(".mp4"));
  if (!files.includes(main)) {
    throw new Error(`estágio "export": ${main} não foi gerado`);
  }
  files.sort((a, b) => (a === main ? -1 : b === main ? 1 : a.localeCompare(b)));

  return {
    workdir: work,
    outputs: files.map((name) => ({
      name,
      path: path.join(outDir, name),
      contentType: "video/mp4",
    })),
    meta: {
      videoType,
      kind: "video",
      aspect: spec.aspect || (landscape ? "16:9" : "9:16"),
      width: landscape ? 1920 : 1080,
      height: landscape ? 1080 : 1920,
      fps: 30,
      container: "mp4",
    },
  };
}

function runPython(specFile, work, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      PYTHON_BIN,
      [RUN_PIPELINE, "--spec", specFile, "--workdir", work],
      {
        cwd: work,
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" },
        windowsHide: true,
      }
    );

    let lastStage = "setup";
    let stderrTail = "";
    let stdoutBuf = "";

    const killer = setTimeout(() => {
      child.kill();
      reject(new Error(`estágio "${lastStage}": timeout do pipeline (${PIPELINE_TIMEOUT_MS}ms)`));
    }, PIPELINE_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString("utf8");
      let idx;
      while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
        const line = stdoutBuf.slice(0, idx).trim();
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (!line) continue;
        console.log(`[pipeline] ${line}`);
        const mp = line.match(/^PROGRESS (\d+)/);
        if (mp) {
          onProgress(Number(mp[1])).catch(() => {});
          continue;
        }
        const ms = line.match(/^STAGE (\S+)/);
        if (ms) lastStage = ms[1];
      }
    });

    child.stderr.on("data", (c) => {
      stderrTail = (stderrTail + c.toString("utf8")).slice(-4000);
    });

    child.on("error", (err) => {
      clearTimeout(killer);
      reject(new Error(`estágio "${lastStage}": não consegui iniciar ${PYTHON_BIN}: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(killer);
      if (code === 0) return resolve(undefined);
      const em = stderrTail.match(/PIPELINE_ERROR stage=(\S+): ([\s\S]*)$/);
      if (em) {
        reject(new Error(`estágio "${em[1]}": ${em[2].trim().slice(0, 600)}`));
      } else {
        reject(
          new Error(
            `estágio "${lastStage}": python saiu com código ${code}: ${stderrTail.trim().slice(-400)}`
          )
        );
      }
    });
  });
}

/** Remove o workdir temporário (chamado pelo worker após o upload). */
export async function cleanupWorkdir(workdir) {
  if (!workdir) return;
  await rm(workdir, { recursive: true, force: true }).catch(() => {});
}
