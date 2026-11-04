import { stageLabel } from "@/lib/flow";
import type { Edit, StageKey } from "@/lib/types";

/**
 * Lists every approved stage as a versioned edit, grouped by stage
 * ("edições salvas individualmente"), plus a button to download the whole
 * project bundle as JSON ("salvas coletivamente").
 */
export function EditsSection({
  projectId,
  edits,
}: {
  projectId: string;
  edits: Edit[];
}) {
  const byStage = new Map<string, Edit[]>();
  for (const e of edits) {
    const arr = byStage.get(e.stage) ?? [];
    arr.push(e);
    byStage.set(e.stage, arr);
  }
  const groups = Array.from(byStage.entries());

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="label mb-0">Edições</p>
        <a
          href={`/projetos/${projectId}/export`}
          className="btn-ghost -mr-1.5 !py-1 text-xs"
          download
        >
          ⬇ Exportar projeto
        </a>
      </div>

      {groups.length === 0 ? (
        <p className="mt-2 text-sm text-muted-fg">
          Cada etapa aprovada é salva aqui como uma versão. Aprove uma entrega no
          chat para começar.
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {groups.map(([stage, versions]) => (
            <li key={stage}>
              <div className="flex items-center gap-2">
                <span className="chip border-brand-blue/30 bg-brand-blue/10 text-brand-blue">
                  {stageLabel(stage as StageKey)}
                </span>
                <span className="text-xs text-muted-fg">
                  {versions.length} versão(ões)
                </span>
              </div>
              <ol className="mt-2 space-y-1.5">
                {versions.map((v) => {
                  const text =
                    typeof v.payload?.deliveryText === "string"
                      ? (v.payload.deliveryText as string)
                      : null;
                  return (
                    <li
                      key={v.id}
                      className="rounded-xl border border-black/[0.06] bg-surface-muted px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink">
                          v{v.version}
                        </span>
                        <span className="text-[11px] text-muted-fg">
                          {new Date(v.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {text && (
                        <p className="mt-1 line-clamp-3 text-xs text-muted-fg">
                          {text}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
