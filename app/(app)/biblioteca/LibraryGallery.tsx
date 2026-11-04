"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge, CampaignBadge } from "@/components/StatusBadge";
import { stageLabel } from "@/lib/flow";
import type { AssetKind, Campaign, ProjectStatus, StageKey } from "@/lib/types";

export interface GalleryItem {
  id: string;
  kind: AssetKind;
  name: string;
  url: string;
  projectId: string | null;
  projectName: string | null;
}

export interface PendingItem {
  id: string;
  name: string;
  status: ProjectStatus;
  stage: string;
  campaign: Campaign | null;
  folder: string;
}

type Filter = "todos" | AssetKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "image", label: "Imagens" },
  { key: "video", label: "Vídeos" },
  { key: "audio", label: "Áudio" },
];

const KIND_EMOJI: Record<AssetKind, string> = {
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
};

const PENDING_STATUSES: ProjectStatus[] = [
  "novo",
  "em_andamento",
  "aguardando_aprovacao",
  "renderizando",
  "erro",
];

export function LibraryGallery({
  items,
  pending,
}: {
  items: GalleryItem[];
  pending: PendingItem[];
}) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">(
    "todos"
  );

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter !== "todos" && i.kind !== filter) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, q]);

  const filteredPending = useMemo(() => {
    return pending.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pending, statusFilter, q]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por tipo">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count =
              f.key === "todos"
                ? items.length
                : items.filter((i) => i.kind === f.key).length;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                className={`chip transition-colors ${
                  active
                    ? "border-transparent bg-brand-gradient text-white"
                    : "border-black/10 bg-white text-muted-fg hover:text-ink"
                }`}
              >
                {f.label}
                <span className={active ? "text-white/70" : "text-muted-fg/60"}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">Buscar por nome</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome…"
            className="input pl-9"
          />
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg/70"
            aria-hidden
          >
            ⌕
          </span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <li key={item.id}>
              <AssetCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {/* Pendentes — projects not yet concluded, with stage badges */}
      <section className="mt-12" aria-labelledby="pendentes-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="pendentes-heading"
            className="text-sm font-bold uppercase tracking-wide text-ink"
          >
            Pendentes
            <span className="ml-2 text-muted-fg">{filteredPending.length}</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <StatusChip
              label="Todos"
              active={statusFilter === "todos"}
              onClick={() => setStatusFilter("todos")}
            />
            {PENDING_STATUSES.map((s) => (
              <StatusChip
                key={s}
                label={PROJECT_STATUS_LABEL[s]}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>
        </div>

        {filteredPending.length === 0 ? (
          <div className="mt-4 card px-6 py-10 text-center text-sm text-muted-fg">
            Nenhum projeto pendente com esse filtro.
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredPending.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projetos/${p.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-surface-muted text-sm font-bold text-muted-fg">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{p.name}</p>
                    <p className="truncate text-xs text-muted-fg">
                      📁 {p.folder || "Geral"} · {stageLabel(p.stage as StageKey)}
                    </p>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1.5">
                    <StatusBadge status={p.status} />
                    <CampaignBadge campaign={p.campaign} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`chip transition-colors ${
        active
          ? "border-transparent bg-ink text-white"
          : "border-black/10 bg-white text-muted-fg hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  novo: "Novo",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando",
  renderizando: "Renderizando",
  concluido: "Concluído",
  erro: "Erro",
};

function AssetCard({ item }: { item: GalleryItem }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-soft transition-all hover:shadow-soft-lg">
      <div className="relative aspect-square overflow-hidden bg-surface-dark">
        {item.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : item.kind === "video" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={item.url} className="h-full w-full object-cover" muted />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">
            🎵
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-lg bg-black/40 px-1.5 py-0.5 text-xs text-white backdrop-blur">
          {KIND_EMOJI[item.kind]}
        </span>
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
        {item.projectId && item.projectName ? (
          <Link
            href={`/projetos/${item.projectId}`}
            className="mt-0.5 block truncate text-xs text-brand-blue hover:underline"
          >
            {item.projectName}
          </Link>
        ) : (
          <p className="mt-0.5 text-xs text-muted-fg">Sem projeto</p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-xl text-white">
        ✦
      </div>
      <h2 className="mt-4 text-base font-bold text-ink">Nada por aqui</h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-fg">
        Ajuste os filtros ou aguarde a squad gerar imagens, vídeos e renders.
      </p>
    </div>
  );
}
