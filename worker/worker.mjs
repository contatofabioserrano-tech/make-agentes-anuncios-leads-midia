// Fortuna Creative — Render Worker
//
// Polls public.render_jobs for queued jobs, claims one, runs the pipeline,
// uploads the result to the 'renders' bucket and marks the project concluido.
//
// Uses the Supabase SERVICE ROLE key, which BYPASSES RLS. Keep it secret and
// only ever set it as a server-side environment variable on the host.

import { createClient } from "@supabase/supabase-js";
import os from "node:os";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { cleanupWorkdir, runPipeline } from "./pipeline.mjs";

const execAsync = promisify(exec);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_ID = process.env.WORKER_ID || `worker-${os.hostname()}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[worker] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "[worker] Fill worker/.env (SUPABASE_URL is pre-filled; paste the\n" +
      "[worker] service_role key from Supabase → Settings → API), then run\n" +
      "[worker] `npm run worker`."
  );
  process.exit(1);
}

/**
 * Verifies a CLI tool is reachable on PATH (cross-platform). On Windows the
 * PATH-resolution works the same via the shell; `--version` is universally safe.
 */
async function checkTool(name) {
  try {
    await execAsync(`${name} --version`, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

/** Warn (do not abort) if ffmpeg/higgsfield/python are not on PATH. */
async function checkTools() {
  const ffmpeg = await checkTool("ffmpeg");
  const python = await checkTool(process.env.PYTHON_BIN || "python");
  const higgsfield =
    (await checkTool("higgsfield")) || (await checkTool("hf"));
  if (!ffmpeg) {
    console.warn(
      "[worker] ⚠ ffmpeg not found on PATH — a montagem final vai falhar. " +
        "Instale e garanta que `ffmpeg` roda no terminal."
    );
  }
  if (!python) {
    console.warn(
      "[worker] ⚠ python not found on PATH — o motor (pipeline_py) não roda. " +
        "Instale Python 3.10+ ou aponte PYTHON_BIN no .env."
    );
  }
  if (!higgsfield) {
    console.warn(
      "[worker] ⚠ higgsfield CLI not found on PATH — propaganda/google_ads/reel/" +
        "carrossel vão falhar no estágio de imagens. Instale e faça login no CLI."
    );
  }
  console.log(
    `[worker] tools — ffmpeg: ${ffmpeg ? "ok" : "missing"}, ` +
      `python: ${python ? "ok" : "missing"}, ` +
      `higgsfield: ${higgsfield ? "ok" : "missing"}`
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- guardas
// Pós-incidente: um job órfão de semanas atrás, com marca placeholder, foi
// processado e queimou ~134 créditos Higgsfield. Todo job CLAIMED passa por
// estas guardas ANTES de qualquer geração; se reprovar, vira status='error'.
const JOB_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const PLACEHOLDER_BRAND_RE = /^(sua marca|marca|test)$/i;
const CREDIT_COST = { propaganda: 200, google_ads: 200, reel: 80, carrossel: 30, integra: 60 };
const CREDITS_CACHE_MS = 60_000;

let creditsCache = { value: null, at: 0 };
let lastNote = "idle";

/** Saldo Higgsfield via `higgsfield account status` (cmd /c), cacheado 60s. */
async function getCredits() {
  if (Date.now() - creditsCache.at < CREDITS_CACHE_MS) return creditsCache.value;
  let value = null;
  try {
    const cmd =
      process.platform === "win32"
        ? "cmd /c higgsfield account status"
        : "higgsfield account status";
    const { stdout } = await execAsync(cmd, {
      timeout: 60_000,
      encoding: "utf8",
      windowsHide: true,
    });
    const m = String(stdout).match(/([0-9.]+)\s*credits/i);
    if (m) value = Number(m[1]);
    else {
      console.warn(
        "[worker] preflight: não achei '<n> credits' na saída do higgsfield account status"
      );
    }
  } catch (err) {
    console.warn("[worker] preflight de créditos falhou:", err?.message || err);
  }
  creditsCache = { value, at: Date.now() };
  return value;
}

/**
 * Guardas anti-desperdício. Devolve a mensagem de erro (string) se o job NÃO
 * deve ser processado, ou null se estiver liberado.
 */
async function guardJob(job) {
  // a) IDADE — job órfão de fila antiga nunca deve renderizar.
  const created = Date.parse(job.created_at || "");
  if (!Number.isFinite(created) || Date.now() - created > JOB_MAX_AGE_MS) {
    return "expirado: job mais antigo que 48h";
  }

  // b) MARCA — spec sem marca real (ausente ou placeholder) não gera render.
  const spec = job.spec || {};
  const brandName = String(spec?.brand?.name ?? "").trim();
  if (brandName.length < 2 || PLACEHOLDER_BRAND_RE.test(brandName)) {
    return "spec inválido: marca ausente/placeholder";
  }

  // c) CRÉDITOS — preflight no CLI antes de gastar qualquer geração.
  let videoType = spec.videoType || "propaganda";
  if (videoType === "comercial30") videoType = "propaganda"; // alias legado
  const cost = CREDIT_COST[videoType] ?? CREDIT_COST.propaganda;
  const credits = await getCredits();
  if (credits != null && credits < cost) {
    return `créditos Higgsfield insuficientes (${credits} < ${cost})`;
  }
  return null;
}

/** Heartbeat: upsert em machine_status (id=1) a cada ciclo, mesmo sem job. */
async function heartbeat() {
  try {
    const { error } = await supabase.from("machine_status").upsert({
      id: 1,
      worker_id: WORKER_ID,
      last_seen: new Date().toISOString(),
      credits: creditsCache.value,
      note: lastNote,
    });
    if (error) console.warn("[worker] heartbeat error:", error.message);
  } catch (err) {
    console.warn("[worker] heartbeat error:", err?.message || err);
  }
}

/** Atomically claim a queued job for this worker. */
async function claimNextJob() {
  // Fetch the oldest queued job.
  const { data: candidate, error } = await supabase
    .from("render_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[worker] poll error:", error.message);
    return null;
  }
  if (!candidate) return null;

  // Conditional claim: only succeeds if still queued (guards against races).
  const { data: claimed, error: claimError } = await supabase
    .from("render_jobs")
    .update({
      status: "claimed",
      worker_id: WORKER_ID,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError) {
    console.error("[worker] claim error:", claimError.message);
    return null;
  }
  return claimed; // null if another worker claimed it first
}

async function setProgress(jobId, progress) {
  await supabase
    .from("render_jobs")
    .update({ status: "running", progress })
    .eq("id", jobId);
}

/** Rótulo humano de cada output pro registro na biblioteca. */
function labelFor(name) {
  const slide = name.match(/^slide_(\d+)\.png$/);
  if (slide) return `arte ${slide[1]}`;
  if (name.includes("4k")) return "master 4K";
  if (name.includes("16x9")) return "final 16:9";
  return "final 9:16";
}

async function processJob(job) {
  console.log(`[worker] processing job ${job.id} (project ${job.project_id})`);
  await supabase
    .from("render_jobs")
    .update({ status: "running", progress: 1 })
    .eq("id", job.id);

  // Run the real pipeline (Python). It reports progress via the callback.
  const { workdir, outputs, meta } = await runPipeline({
    supabase,
    job,
    onProgress: (p) => setProgress(job.id, p),
  });

  try {
    // CANCELAMENTO: re-lê o job antes do upload final. Se o usuário marcou
    // status='error' durante o render, aborta o bookkeeping e NÃO sobrescreve.
    const { data: fresh } = await supabase
      .from("render_jobs")
      .select("status")
      .eq("id", job.id)
      .maybeSingle();
    if (fresh?.status === "error") {
      console.log(
        `[worker] job ${job.id} cancelado durante o render — descartando outputs`
      );
      lastNote = "job cancelado pelo usuário";
      return;
    }

    // Upload every finished output (master principal primeiro) to 'renders'.
    const stamp = Date.now();
    const uploaded = [];
    for (const out of outputs) {
      const buffer = await readFile(out.path);
      const dest = `${job.project_id}/${stamp}-${out.name}`;
      const { error: uploadError } = await supabase.storage
        .from("renders")
        .upload(dest, buffer, {
          contentType: out.contentType || "video/mp4",
          upsert: true,
        });
      if (uploadError) {
        throw new Error(`estágio "upload": ${out.name}: ${uploadError.message}`);
      }
      const { data: pub } = supabase.storage.from("renders").getPublicUrl(dest);
      uploaded.push({ name: out.name, path: dest, url: pub?.publicUrl || dest });
    }

    // Carrossel: output_path = lista separada por vírgula das URLs públicas de
    // TODAS as artes. Vídeo: path do master principal (comportamento original).
    const isImageSet = meta.kind === "image";
    const outputPath = isImageSet
      ? uploaded.map((u) => u.url).join(",")
      : uploaded[0].path;

    // Mark job done.
    await supabase
      .from("render_jobs")
      .update({ status: "done", progress: 100, output_path: outputPath })
      .eq("id", job.id);

    // Mark project concluido.
    await supabase
      .from("projects")
      .update({ status: "concluido", stage: "done" })
      .eq("id", job.project_id);

    // Look up the project owner so the assets are attributed correctly.
    const { data: project } = await supabase
      .from("projects")
      .select("owner,name")
      .eq("id", job.project_id)
      .maybeSingle();

    // Register each output in the library.
    if (project?.owner) {
      for (const up of uploaded) {
        await supabase.from("library_assets").insert({
          owner: project.owner,
          project_id: job.project_id,
          kind: isImageSet ? "image" : "video",
          name: `${project.name || "Render"} — ${labelFor(up.name)}`,
          path: up.path,
          meta: { source: "render", output: up.name, ...meta },
        });
      }
    }

    // System message in the project chat.
    await supabase.from("messages").insert({
      project_id: job.project_id,
      role: "system",
      kind: "delivery",
      stage: "done",
      text: isImageSet
        ? `Carrossel pronto ✅ — ${uploaded.length} artes disponíveis para download e na biblioteca.`
        : "Vídeo final pronto ✅ — disponível para download e na biblioteca.",
    });

    console.log(
      `[worker] job ${job.id} done -> ${uploaded.map((u) => u.path).join(", ")}`
    );
  } finally {
    await cleanupWorkdir(workdir);
  }
}

async function failJob(job, err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[worker] job ${job.id} failed:`, message);
  lastNote = message.slice(0, 120);
  await supabase
    .from("render_jobs")
    .update({ status: "error", error: message.slice(0, 1000) })
    .eq("id", job.id);
  await supabase
    .from("projects")
    .update({ status: "erro" })
    .eq("id", job.project_id);
  await supabase.from("messages").insert({
    project_id: job.project_id,
    role: "system",
    kind: "delivery",
    stage: "render",
    text: "Falha no render ❌ — a equipe técnica foi notificada.",
  });
}

async function loop() {
  console.log(`[worker] started as ${WORKER_ID}, polling every ${POLL_INTERVAL_MS}ms`);
  await checkTools();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const job = await claimNextJob();
      if (job) {
        // Guardas anti-desperdício: claim → reprova → error → segue o loop.
        const blocked = await guardJob(job);
        if (blocked) {
          await failJob(job, new Error(blocked));
        } else {
          lastNote = `processando ${job.spec?.videoType || "propaganda"}`;
          await heartbeat();
          try {
            await processJob(job);
            lastNote = "idle";
          } catch (err) {
            await failJob(job, err);
          }
        }
        await heartbeat();
        continue; // immediately look for the next job
      }
    } catch (err) {
      console.error("[worker] loop error:", err);
      lastNote = String(err?.message || err).slice(0, 120);
    }
    await heartbeat();
    await sleep(POLL_INTERVAL_MS);
  }
}

loop();
