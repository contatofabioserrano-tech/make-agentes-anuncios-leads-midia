import { requireSession, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import type { LibraryAsset, Project } from "@/lib/types";
import { LibraryGallery, type GalleryItem, type PendingItem } from "./LibraryGallery";

export const metadata = { title: "Biblioteca — MakeOne" };
export const dynamic = "force-dynamic";

// Each asset kind lives in a specific bucket.
const BUCKET_BY_KIND: Record<LibraryAsset["kind"], string> = {
  image: "assets",
  video: "renders",
  audio: "assets",
};

export default async function BibliotecaPage() {
  const { userId, profile } = await requireSession();
  const supabase = createClient();

  let query = supabase
    .from("library_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isAdmin(profile)) {
    query = query.eq("owner", userId);
  }

  // Pending projects (status != concluido) so the library doubles as a to-do board.
  let pendingQuery = supabase
    .from("projects")
    .select("id,name,status,stage,campaign,folder,updated_at")
    .neq("status", "concluido")
    .order("updated_at", { ascending: false });
  if (!isAdmin(profile)) {
    pendingQuery = pendingQuery.eq("owner", userId);
  }

  const [{ data: assets }, { data: pendingRows }] = await Promise.all([
    query.returns<LibraryAsset[]>(),
    pendingQuery.returns<
      Pick<
        Project,
        "id" | "name" | "status" | "stage" | "campaign" | "folder" | "updated_at"
      >[]
    >(),
  ]);
  const list = assets ?? [];

  const pending: PendingItem[] = (pendingRows ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    stage: p.stage,
    campaign: p.campaign,
    folder: p.folder,
  }));

  // Resolve a project-name map for nicer links.
  const projectIds = Array.from(
    new Set(list.map((a) => a.project_id).filter(Boolean) as string[])
  );
  const projectNames = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id,name")
      .in("id", projectIds)
      .returns<{ id: string; name: string }[]>();
    projects?.forEach((p) => projectNames.set(p.id, p.name));
  }

  const items: GalleryItem[] = list.map((a) => {
    const bucket = BUCKET_BY_KIND[a.kind] ?? "assets";
    const { data } = supabase.storage.from(bucket).getPublicUrl(a.path);
    return {
      id: a.id,
      kind: a.kind,
      name: a.name,
      url: data.publicUrl,
      projectId: a.project_id,
      projectName: a.project_id
        ? projectNames.get(a.project_id) ?? null
        : null,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Biblioteca"
        subtitle="Imagens, vídeos e áudios gerados pela squad em cada projeto."
      />
      <div className="mt-8">
        <LibraryGallery items={items} pending={pending} />
      </div>
    </div>
  );
}
