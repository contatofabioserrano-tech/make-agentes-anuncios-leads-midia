"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MachineStatus as MachineStatusRow } from "@/lib/types";

const POLL_MS = 15_000;
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/**
 * Status da máquina de produção: heartbeat do worker (machine_status id=1),
 * créditos Higgsfield e tamanho da fila de render. Poll a cada 15s.
 */
export function MachineStatus() {
  const [row, setRow] = useState<MachineStatusRow | null>(null);
  const [queued, setQueued] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [statusRes, queueRes] = await Promise.all([
      supabase
        .from("machine_status")
        .select("*")
        .eq("id", 1)
        .maybeSingle<MachineStatusRow>(),
      supabase
        .from("render_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued"),
    ]);
    setRow(statusRes.data ?? null);
    setQueued(queueRes.count ?? 0);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const online =
    !!row?.last_seen &&
    Date.now() - new Date(row.last_seen).getTime() < ONLINE_WINDOW_MS;

  const credits =
    row?.credits === null || row?.credits === undefined
      ? null
      : Number(row.credits);

  return (
    <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
      <p className="label !mb-0">Máquina de produção</p>

      {online ? (
        <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          ONLINE
          {row?.worker_id ? (
            <span className="font-normal text-emerald-700/70">
              · {row.worker_id}
            </span>
          ) : null}
        </span>
      ) : (
        <span
          className="chip border-black/10 bg-surface-muted text-muted-fg"
          title="rode npm run worker no PC de produção"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          {loaded ? "OFFLINE" : "Verificando…"}
        </span>
      )}

      <span className="text-sm text-muted-fg">
        Créditos Higgsfield:{" "}
        <span className="font-semibold text-ink">
          {credits !== null && Number.isFinite(credits)
            ? credits.toLocaleString("pt-BR")
            : "—"}
        </span>
      </span>

      <span className="text-sm text-muted-fg">
        Jobs na fila:{" "}
        <span className="font-semibold text-ink">{queued}</span>
      </span>

      {row?.note && (
        <span className="truncate text-xs text-muted-fg/80" title={row.note}>
          {row.note}
        </span>
      )}
    </div>
  );
}
