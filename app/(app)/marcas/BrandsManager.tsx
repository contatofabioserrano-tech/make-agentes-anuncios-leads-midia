"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Brand } from "@/lib/types";

const DEFAULT_PRIMARY = "#0F3D2E";
const DEFAULT_ACCENT = "#FF7A00";

interface FormState {
  name: string;
  color_primary: string;
  color_accent: string;
  phone: string;
  whatsapp: string;
  address: string;
  tagline: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  color_primary: DEFAULT_PRIMARY,
  color_accent: DEFAULT_ACCENT,
  phone: "",
  whatsapp: "",
  address: "",
  tagline: "",
};

export function BrandsManager({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  // Fotos reais da marca: paths já salvos no bucket + arquivos novos pendentes.
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Previews locais dos arquivos ainda não enviados.
  const newPhotoPreviews = useMemo(
    () => newPhotos.map((f) => URL.createObjectURL(f)),
    [newPhotos]
  );
  useEffect(() => {
    return () => {
      newPhotoPreviews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [newPhotoPreviews]);

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setPhotos([]);
    setNewPhotos([]);
    setError(null);
    setOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setForm({
      name: brand.name,
      color_primary: brand.color_primary ?? DEFAULT_PRIMARY,
      color_accent: brand.color_accent ?? DEFAULT_ACCENT,
      phone: brand.phone ?? "",
      whatsapp: brand.whatsapp ?? "",
      address: brand.address ?? "",
      tagline: brand.tagline ?? "",
    });
    setLogoFile(null);
    setPhotos(brand.photos ?? []);
    setNewPhotos([]);
    setError(null);
    setOpen(true);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setLogoFile(null);
    setPhotos([]);
    setNewPhotos([]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Dê um nome à marca.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sessão expirada. Faça login novamente.");
      return;
    }

    setBusy(true);
    try {
      // Optional logo upload to the public 'assets' bucket.
      let logoUrl: string | null = editing?.logo_path ?? null;
      if (logoFile) {
        const safeName = logoFile.name.replace(/[^\w.\-]+/g, "_");
        const path = `brands/${user.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("assets")
          .upload(path, logoFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: logoFile.type || "image/png",
          });
        if (uploadError) {
          setError("Falha no upload do logo. Tente novamente.");
          setBusy(false);
          return;
        }
        const { data: pub } = supabase.storage.from("assets").getPublicUrl(path);
        logoUrl = pub.publicUrl;
      }

      // Upload das fotos reais novas (paths salvos em brands.photos).
      const uploadedPaths: string[] = [];
      for (const file of newPhotos) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `brands/${user.id}/fotos/${Date.now()}-${safeName}`;
        const { error: photoError } = await supabase.storage
          .from("assets")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "image/jpeg",
          });
        if (photoError) {
          setError("Falha no upload das fotos da marca. Tente novamente.");
          setBusy(false);
          return;
        }
        uploadedPaths.push(path);
      }

      const payload = {
        name: form.name.trim(),
        color_primary: form.color_primary,
        color_accent: form.color_accent,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        address: form.address.trim() || null,
        tagline: form.tagline.trim() || null,
        logo_path: logoUrl,
        photos: [...photos, ...uploadedPaths],
      };

      if (editing) {
        const { error: updateError } = await supabase
          .from("brands")
          .update(payload)
          .eq("id", editing.id);
        if (updateError) {
          setError("Não foi possível salvar a marca.");
          setBusy(false);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from("brands")
          .insert({ owner: user.id, ...payload });
        if (insertError) {
          setError("Não foi possível criar a marca.");
          setBusy(false);
          return;
        }
      }

      setBusy(false);
      close();
      router.refresh();
    } catch {
      setError("Erro inesperado. Tente novamente.");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!editing || busy) return;
    const ok = window.confirm(
      `Excluir a marca "${editing.name}"? Os projetos já gerados não são afetados.`
    );
    if (!ok) return;

    setBusy(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("brands")
      .delete()
      .eq("id", editing.id);
    setBusy(false);

    if (deleteError) {
      setError("Não foi possível excluir a marca.");
      return;
    }
    close();
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={openCreate}>
          <span className="text-base leading-none">+</span> Nova marca
        </button>
      </div>

      {brands.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <span className="text-3xl" aria-hidden>
            🎨
          </span>
          <p className="text-sm font-semibold text-ink">Nenhuma marca ainda</p>
          <p className="max-w-sm text-sm text-muted-fg">
            Crie o kit da sua primeira marca — o Gerador usa logo, cores e
            contato para produzir vídeos on-brand automaticamente.
          </p>
          <button type="button" className="btn-primary mt-2" onClick={openCreate}>
            Criar primeira marca
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} onEdit={() => openEdit(brand)} />
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="brand-dialog-title"
        >
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg animate-fade-in overflow-y-auto scroll-thin rounded-2xl border border-black/[0.06] bg-white p-6 shadow-soft-lg">
            <div className="flex items-start justify-between">
              <div>
                <h2 id="brand-dialog-title" className="text-lg font-bold text-ink">
                  {editing ? "Editar marca" : "Nova marca"}
                </h2>
                <p className="mt-1 text-sm text-muted-fg">
                  Logo, cores e contato — tudo que o Gerador precisa para
                  manter os vídeos on-brand.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="btn-ghost -mr-2 -mt-1"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="brand-name">
                  Nome da marca
                </label>
                <input
                  id="brand-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ex.: Grupo Kairós"
                  disabled={busy}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ColorField
                  id="brand-primary"
                  label="Cor primária"
                  value={form.color_primary}
                  onChange={(v) => set("color_primary", v)}
                  disabled={busy}
                />
                <ColorField
                  id="brand-accent"
                  label="Cor de destaque"
                  value={form.color_accent}
                  onChange={(v) => set("color_accent", v)}
                  disabled={busy}
                />
              </div>

              <div>
                <label className="label" htmlFor="brand-tagline">
                  Tagline
                </label>
                <input
                  id="brand-tagline"
                  className="input"
                  value={form.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                  placeholder="Ex.: Cuidado veterinário 24h"
                  disabled={busy}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="brand-phone">
                    Telefone
                  </label>
                  <input
                    id="brand-phone"
                    className="input"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="(11) 0000-0000"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="brand-whatsapp">
                    WhatsApp
                  </label>
                  <input
                    id="brand-whatsapp"
                    className="input"
                    value={form.whatsapp}
                    onChange={(e) => set("whatsapp", e.target.value)}
                    placeholder="(11) 90000-0000"
                    disabled={busy}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="brand-address">
                  Endereço
                </label>
                <input
                  id="brand-address"
                  className="input"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Rua, número, cidade"
                  disabled={busy}
                />
              </div>

              <div>
                <label className="label" htmlFor="brand-logo">
                  Logo
                </label>
                <input
                  id="brand-logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  disabled={busy}
                  className="block w-full cursor-pointer rounded-xl border border-dashed border-black/15 bg-surface-muted px-3.5 py-3 text-sm text-muted-fg file:mr-3 file:rounded-lg file:border-0 file:bg-brand-gradient file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:border-brand-blue/40"
                />
                {logoFile ? (
                  <p className="mt-1.5 truncate text-xs text-muted-fg">
                    {logoFile.name} · {(logoFile.size / 1024).toFixed(0)} KB
                  </p>
                ) : editing?.logo_path ? (
                  <p className="mt-1.5 text-xs text-muted-fg">
                    Logo atual será mantido — envie um arquivo para substituir.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="label" htmlFor="brand-photos">
                  Fotos reais da marca
                </label>
                <input
                  id="brand-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const input = e.currentTarget;
                    const files = Array.from(input.files ?? []);
                    if (files.length) {
                      setNewPhotos((prev) => [...prev, ...files]);
                    }
                    input.value = "";
                  }}
                  disabled={busy}
                  className="block w-full cursor-pointer rounded-xl border border-dashed border-black/15 bg-surface-muted px-3.5 py-3 text-sm text-muted-fg file:mr-3 file:rounded-lg file:border-0 file:bg-brand-gradient file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:border-brand-blue/40"
                />
                <p className="mt-1.5 text-xs text-muted-fg">
                  A primeira foto entra como cena real no comercial (ex: foto do
                  professor/dono).
                </p>

                {(photos.length > 0 || newPhotos.length > 0) && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photos.map((path, i) => (
                      <PhotoThumb
                        key={path}
                        src={assetPublicUrl(path)}
                        alt={`Foto ${i + 1} da marca`}
                        disabled={busy}
                        onRemove={() =>
                          setPhotos((prev) => prev.filter((p) => p !== path))
                        }
                      />
                    ))}
                    {newPhotos.map((file, i) => (
                      <PhotoThumb
                        key={`${file.name}-${file.lastModified}-${i}`}
                        src={newPhotoPreviews[i]}
                        alt={`Nova foto ${i + 1} da marca`}
                        pending
                        disabled={busy}
                        onRemove={() =>
                          setNewPhotos((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                {editing ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy}
                    className="btn-ghost !text-red-600 hover:!bg-red-50"
                  >
                    Excluir
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={busy} className="btn-primary">
                    {busy
                      ? "Salvando…"
                      : editing
                      ? "Salvar marca"
                      : "Criar marca"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/** Resolve um path do bucket público 'assets' para URL de navegador. */
function assetPublicUrl(path: string): string {
  return createClient().storage.from("assets").getPublicUrl(path).data.publicUrl;
}

function PhotoThumb({
  src,
  alt,
  onRemove,
  pending,
  disabled,
}: {
  src: string;
  alt: string;
  onRemove: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-black/[0.08] bg-surface-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="aspect-square w-full object-cover" />
      {pending && (
        <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          novo
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remover ${alt}`}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white transition-colors hover:bg-red-600 disabled:opacity-50"
      >
        ✕
      </button>
    </div>
  );
}

function BrandCard({ brand, onEdit }: { brand: Brand; onEdit: () => void }) {
  const primary = brand.color_primary ?? DEFAULT_PRIMARY;
  const accent = brand.color_accent ?? DEFAULT_ACCENT;

  return (
    <div className="card overflow-hidden">
      <div
        className="flex h-24 items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${accent} 140%)`,
        }}
      >
        {brand.logo_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logo_path}
            alt={`Logo ${brand.name}`}
            className="max-h-16 max-w-[70%] rounded-lg bg-white/85 object-contain p-1.5"
          />
        ) : (
          <span className="text-2xl font-extrabold tracking-tight text-white/90">
            {brand.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{brand.name}</p>
            {brand.tagline && (
              <p className="mt-0.5 truncate text-xs text-muted-fg">
                {brand.tagline}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
            <span
              className="h-5 w-5 rounded-full border border-black/10"
              style={{ backgroundColor: primary }}
              title={primary}
            />
            <span
              className="h-5 w-5 rounded-full border border-black/10"
              style={{ backgroundColor: accent }}
              title={accent}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {brand.whatsapp && (
            <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
              WhatsApp
            </span>
          )}
          {brand.phone && (
            <span className="chip border-black/10 bg-surface-muted text-muted-fg">
              {brand.phone}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="btn-secondary mt-4 w-full !py-2 text-sm"
        >
          Editar marca
        </button>
      </div>
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2.5 rounded-xl border border-black/10 bg-white px-3 py-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-8 w-10 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <span className="text-sm font-medium uppercase text-muted-fg">
          {value}
        </span>
      </div>
    </div>
  );
}
