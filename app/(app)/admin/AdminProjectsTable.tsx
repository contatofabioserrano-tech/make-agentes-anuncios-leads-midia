"use client";

import { useMemo, useState } from "react";
import { StatusBadge, CampaignBadge } from "@/components/StatusBadge";
import { CAMPAIGNS, stageLabel } from "@/lib/flow";
import type { Campaign, ProjectStatus, StageKey } from "@/lib/types";

export interface AdminProjectRow {
  id: string;
  name: string;
  owner: string;
  status: ProjectStatus;
  stage: string;
  folder: string;
  campaign: Campaign | null;
  created_at: string;
}

type CampaignFilter = Campaign | "none" | "todos";

export function AdminProjectsTable({ rows }: { rows: AdminProjectRow[] }) {
  const [folder, setFolder] = useState<string>("todos");
  const [campaign, setCampaign] = useState<CampaignFilter>("todos");

  const folders = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.folder || "Geral"))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (folder !== "todos" && (r.folder || "Geral") !== folder) return false;
        if (campaign === "none" && r.campaign !== null) return false;
        if (campaign !== "todos" && campaign !== "none" && r.campaign !== campaign)
          return false;
        return true;
      }),
    [rows, folder, campaign]
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-fg">
          Pasta
          <select
            className="input !w-auto !py-1.5 text-sm normal-case"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          >
            <option value="todos">Todas</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-fg">
          Campanha
          <select
            className="input !w-auto !py-1.5 text-sm normal-case"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value as CampaignFilter)}
          >
            <option value="todos">Todas</option>
            <option value="meta">{CAMPAIGNS.meta.short}</option>
            <option value="google">{CAMPAIGNS.google.short}</option>
            <option value="none">Sem campanha</option>
          </select>
        </label>
        <span className="ml-auto text-xs text-muted-fg">
          {filtered.length} de {rows.length}
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-xs uppercase tracking-wide text-muted-fg">
                <th className="px-4 py-3 font-semibold">Projeto</th>
                <th className="px-4 py-3 font-semibold">Dono</th>
                <th className="px-4 py-3 font-semibold">Pasta</th>
                <th className="px-4 py-3 font-semibold">Campanha</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Etapa</th>
                <th className="px-4 py-3 font-semibold">Criado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-fg">
                    Nenhum projeto com esse filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-black/[0.04] transition-colors last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                    <td className="px-4 py-3 text-muted-fg">{p.owner}</td>
                    <td className="px-4 py-3 text-muted-fg">{p.folder}</td>
                    <td className="px-4 py-3">
                      <CampaignBadge campaign={p.campaign} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-fg">
                      {stageLabel(p.stage as StageKey)}
                    </td>
                    <td className="px-4 py-3 text-muted-fg">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
