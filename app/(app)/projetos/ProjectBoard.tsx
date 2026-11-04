"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge, CampaignBadge } from "@/components/StatusBadge";
import { stageLabel } from "@/lib/flow";
import type { Project, StageKey } from "@/lib/types";

const norm = (f: string | null) => (f || "Geral").trim() || "Geral";

export function ProjectBoard({
  projects,
  folders,
}: {
  projects: Project[];
  folders: string[];
}) {
  const [active, setActive] = useState<string>("__all");

  const filtered = useMemo(
    () =>
      active === "__all"
        ? projects
        : projects.filter((p) => norm(p.folder) === active),
    [projects, active]
  );

  // Group the visible projects by folder, preserving folder order.
  const grouped = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of filtered) {
      const f = norm(p.folder);
      const arr = map.get(f) ?? [];
      arr.push(p);
      map.set(f, arr);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "pt-BR")
    );
  }, [filtered]);

  if (projects.length === 0) return <EmptyState />;

  return (
    <div>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filtrar por pasta"
      >
        <FolderChip
          label="Todas"
          count={projects.length}
          active={active === "__all"}
          onClick={() => setActive("__all")}
        />
        {folders.map((f) => (
          <FolderChip
            key={f}
            label={f}
            count={projects.filter((p) => norm(p.folder) === f).length}
            active={active === f}
            onClick={() => setActive(f)}
          />
        ))}
      </div>

      <div className="mt-6 space-y-8">
        {grouped.map(([folder, items]) => (
          <FolderSection key={folder} folder={folder} items={items} />
        ))}
      </div>
    </div>
  );
}

function FolderChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`chip transition-colors ${
        active
          ? "border-transparent bg-brand-gradient text-white"
          : "border-black/10 bg-white text-muted-fg hover:text-ink"
      }`}
    >
      {label}
      <span className={active ? "text-white/70" : "text-muted-fg/60"}>
        {count}
      </span>
    </button>
  );
}

function FolderSection({
  folder,
  items,
}: {
  folder: string;
  items: Project[];
}) {
  const [open, setOpen] = useState(true);
  return (
    <section aria-labelledby={`folder-${folder}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <span
          className={`text-muted-fg transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▸
        </span>
        <h2
          id={`folder-${folder}`}
          className="text-sm font-bold uppercase tracking-wide text-ink"
        >
          {folder}
        </h2>
        <span className="chip border-black/10 bg-surface-muted text-muted-fg">
          {items.length}
        </span>
      </button>

      {open && (
        <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <li key={p.id}>
              <ProjectCard project={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projetos/${project.id}`}
      className="group block overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
    >
      <div className="relative aspect-video overflow-hidden bg-surface-dark">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_80%_0%,rgba(124,58,237,0.40),transparent_55%),radial-gradient(120%_120%_at_0%_100%,rgba(61,90,254,0.35),transparent_55%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl opacity-80">🎞️</span>
        </div>
        <span className="absolute left-3 top-3 chip border-white/15 bg-white/10 text-white backdrop-blur">
          {project.aspect || project.format}
        </span>
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold text-ink group-hover:text-brand-blue">
          {project.name}
        </h3>
        {project.brief && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-fg">
            {project.brief}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <StatusBadge status={project.status} />
          <span className="text-xs font-medium text-muted-fg">
            {stageLabel(project.stage as StageKey)}
          </span>
        </div>
        {project.campaign && (
          <div className="mt-2">
            <CampaignBadge campaign={project.campaign} />
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-soft">
        ✦
      </div>
      <h2 className="mt-5 text-lg font-bold text-ink">
        Comece seu primeiro projeto
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-fg">
        Suba um vídeo e a squad — Roteirista, Diretor de Imagem, Legendador e
        Montador — entra em ação. Você aprova cada etapa pelo chat.
      </p>
    </div>
  );
}
