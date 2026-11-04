import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Edit, Message, Project } from "@/lib/types";

/**
 * Exports a project as a single JSON bundle ("salvas coletivamente"):
 * project + briefing + all versioned edits + full message history.
 * RLS scopes access to the owner (or an admin).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<Project>();

  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [{ data: edits }, { data: messages }] = await Promise.all([
    supabase
      .from("edits")
      .select("*")
      .eq("project_id", params.id)
      .order("stage", { ascending: true })
      .order("version", { ascending: true })
      .returns<Edit[]>(),
    supabase
      .from("messages")
      .select("*")
      .eq("project_id", params.id)
      .order("created_at", { ascending: true })
      .returns<Message[]>(),
  ]);

  const bundle = {
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      brief: project.brief,
      status: project.status,
      stage: project.stage,
      folder: project.folder,
      campaign: project.campaign,
      aspect: project.aspect,
      briefing: project.briefing,
      created_at: project.created_at,
      updated_at: project.updated_at,
    },
    edits: edits ?? [],
    messages: messages ?? [],
  };

  const slug =
    (project.name || "projeto")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "projeto";

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${params.id.slice(0, 8)}.json"`,
    },
  });
}
