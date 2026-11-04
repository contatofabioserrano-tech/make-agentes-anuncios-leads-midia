import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { resolveListing, evaluate } from "@/lib/marketplace/listings";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** Exporta o anúncio pronto (JSON completo ou CSV de campos para o upload no Seller Center). */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  await requireSession();
  const supabase = createClient();
  const b = await resolveListing(params.slug, supabase);
  if (!b) return NextResponse.json({ error: "anúncio não encontrado" }, { status: 404 });
  const { checks, summary } = evaluate(b);
  const origin = new URL(req.url).origin;
  const url = (f: string) => (b.baseUrl.startsWith("http") ? `${b.baseUrl}/${f}` : `${origin}${b.baseUrl}/${f}`);
  const l = b.listing;
  const format = new URL(req.url).searchParams.get("format") ?? "json";

  await logAudit(supabase, {
    action: "anuncio.exportado", entity: "anuncio", entityId: params.slug,
    summary: `Anúncio ${params.slug} exportado em ${format.toUpperCase()} (${summary.passed}/${summary.total} verificações ok)`,
    details: { formato: format, erros: summary.erros, pendencias: summary.pendencias },
  });

  if (format === "csv") {
    const gallery = l.images.filter((i) => i.role !== "descricao");
    const rows: [string, string][] = [
      ["Categoria", l.category],
      ["Marca", l.brand],
      ["Nome do produto", l.title],
      ["Descrição do produto", l.description],
      ["SKU", l.sku],
      ["Variação: nome", l.variationStyle],
      ["Variação: valor", l.variations.map((v) => v.value).join(" | ")],
      ["Preço", l.price ? l.price.toFixed(2) : ""],
      ["Estoque", l.variations.map((v) => v.stock ?? "").join(" | ")],
      ["Peso do pacote (kg)", l.packageWeightKg ? String(l.packageWeightKg) : ""],
      ["Dimensões do pacote (cm)", l.packageDimensionsCm ? `${l.packageDimensionsCm.length}x${l.packageDimensionsCm.width}x${l.packageDimensionsCm.height}` : ""],
      ...gallery.map((g, k) => [`Imagem ${k + 1}${k === 0 ? " (principal)" : ""}`, url(g.file)] as [string, string]),
      ...l.videos.map((v) => ["Vídeo do produto", url(v.file)] as [string, string]),
      ...Object.entries(l.attributes).map(([k, v]) => [`Atributo: ${k}`, v] as [string, string]),
    ];
    const csv = "﻿campo;valor\n" + rows.map(([k, v]) => `${csvCell(k)};${csvCell(v)}`).join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="tiktokshop-${l.slug}.csv"`,
      },
    });
  }

  return NextResponse.json(
    {
      marketplace: "TikTok Shop Brasil",
      politica: "Política de Listagem de Produtos do TikTok Shop (seller-br, 28/10/2026)",
      status: summary,
      verificacoes: checks,
      anuncio: {
        ...l,
        images: l.images.map((i) => ({ ...i, url: url(i.file), medidas: b.meta[i.file] })),
        videos: l.videos.map((v) => ({ ...v, url: url(v.file), medidas: b.meta[v.file] })),
      },
      feed: { ...b.feed, videoUrl: b.feed.videoFile ? url(b.feed.videoFile) : null },
    },
    { headers: { "content-disposition": `attachment; filename="tiktokshop-${l.slug}.json"` } },
  );
}
