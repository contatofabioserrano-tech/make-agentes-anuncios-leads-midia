"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { switchCompany } from "@/lib/company-actions";
import { usesOdoo } from "@/lib/features";

type IconName =
  | "painel" | "catalogo" | "agente" | "anuncios" | "gerador" | "projetos"
  | "marcas" | "biblioteca" | "pendentes" | "auditoria" | "admin" | "cadastro" | "loja" | "campanhas" | "fontes" | "empresas";

const P: Record<IconName, string> = {
  painel: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  catalogo: "M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7M12 11v10",
  agente: "M12 3l1.9 4.8 4.8 1.9-4.8 1.9L12 16.4l-1.9-4.8-4.8-1.9 4.8-1.9L12 3zM18.7 15.4l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1z",
  anuncios: "M5 8h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8zM9 8V6.5a3 3 0 0 1 6 0V8",
  gerador: "M4 6h16v12H4zM10 9.5v5l4.5-2.5L10 9.5z",
  projetos: "M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z",
  marcas: "M4 5.5A1.5 1.5 0 0 1 5.5 4h5.8a2 2 0 0 1 1.4.6l6.7 6.7a2 2 0 0 1 0 2.8l-5.3 5.3a2 2 0 0 1-2.8 0l-6.7-6.7A2 2 0 0 1 4 11.3V5.5z",
  biblioteca: "M4 5h4v14H4zM10 5h4v14h-4zM16 6l4 1-3 13-4-1",
  pendentes: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2",
  auditoria: "M9 4h6l1 2h3v14H5V6h3l1-2zM8.5 12.5l2.2 2.2 4.8-4.8",
  admin: "M12 3l8 4v5c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V7l8-4z",
  cadastro: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  loja: "M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6",
  fontes: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  empresas: "M4 20V6l8-3 8 3v14M9 20v-5h6v5M8 9h2M14 9h2M8 12h2M14 12h2",
  campanhas: "M4 10v4h3l6 4V6L7 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px] shrink-0" aria-hidden>
      <path d={P[name]} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface NavItem { href: string; label: string; icon: IconName; badge?: string }
interface NavGroup { title: string; items: NavItem[] }

interface CompanyLite { id: string; name: string; kind: "odoo" | "padrao"; logo?: string | null }
interface SidebarProps { name: string; email: string; isAdmin: boolean; initialCollapsed?: boolean; companies?: CompanyLite[]; activeCompany?: CompanyLite | null }

/** Cookie lido no servidor: o menu já nasce no estado certo (sem piscar ao carregar). */
export const SIDEBAR_COOKIE = "makeone_sidebar_collapsed";

export function Sidebar({ name, email, isAdmin, initialCollapsed = false, companies = [], activeCompany = null }: SidebarProps) {
  const isOdoo = usesOdoo(activeCompany);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [open, setOpen] = useState(false); // gaveta no celular
  const menuBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (open) closeBtn.current?.focus();
    else if (wasOpen.current) menuBtn.current?.focus();
    wasOpen.current = open;
    if (!open) return () => { document.body.style.overflow = ""; };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  const toggle = () => {
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${c ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  const groups: NavGroup[] = [
    { title: "Operação", items: [
      { href: "/painel", label: "Visão geral", icon: "painel" },
      { href: "/fontes", label: "Enviar materiais", icon: "fontes", badge: isOdoo ? undefined : "início" },
      ...(isOdoo ? [{ href: "/catalogo", label: "Catálogo Odoo", icon: "catalogo" as IconName }] : []),
      { href: "/cadastro", label: isOdoo ? "Cadastro de produto" : "Produtos", icon: "cadastro" },
      { href: "/agente", label: "Agente de anúncios", icon: "agente", badge: "IA" },
      { href: "/anuncios", label: "Anúncios", icon: "anuncios" },
      { href: "/campanhas", label: "Campanhas", icon: "campanhas" },
      ...(isOdoo ? [{ href: "/loja/hyper-petg-preto", label: "Loja (landing)", icon: "loja" as IconName }] : []),
    ] },
    { title: "Criação", items: [
      { href: "/gerador", label: "Gerador de vídeo", icon: "gerador" },
      { href: "/projetos", label: "Projetos", icon: "projetos" },
      { href: "/marcas", label: "Marcas", icon: "marcas" },
      { href: "/biblioteca", label: "Biblioteca", icon: "biblioteca" },
      { href: "/pendentes", label: "Pendentes", icon: "pendentes" },
    ] },
    { title: "Controle", items: [
      { href: "/auditoria", label: "Auditoria", icon: "auditoria" },
      { href: "/empresas", label: isAdmin ? "Empresas" : "Minha empresa", icon: "empresas" },
      ...(isAdmin ? [{ href: "/leads", label: "Leads", icon: "pendentes" as IconName }] : []),
      ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "admin" as IconName }] : []),
    ] },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const mini = collapsed && !open;

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 pb-4 scroll-thin" aria-label="Navegação principal">
      {groups.map((g) => (
        <div key={g.title} className="mt-5 first:mt-2">
          {!mini && <p className="eyebrow mb-2 px-3 !text-[10px]">{g.title}</p>}
          {mini && <div className="mx-3 mb-2 border-t border-line" />}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={mini ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-lg py-2.5 text-[14px] transition-colors ${
                      mini ? "justify-center px-0" : "px-3"
                    } ${active ? "bg-accent-soft text-accent" : "text-[#3A3A38] hover:bg-black/[0.04] hover:text-ink"}`}
                  >
                    <Icon name={item.icon} />
                    {!mini && <span className="truncate">{item.label}</span>}
                    {!mini && item.badge && (
                      <span className="ml-auto rounded-full bg-ink px-1.5 py-0.5 font-mono text-[9px] text-white">{item.badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className={`border-t border-line ${mini ? "p-2" : "p-4"}`}>
      {!mini && (
        <div className="mb-3 min-w-0">
          <p className="truncate text-sm font-medium text-ink">{name}</p>
          <p className="truncate text-xs text-muted-fg">{email}</p>
        </div>
      )}
      <form action="/auth/signout" method="post">
        <button type="submit" title="Sair" className={mini ? "btn-ghost w-full !px-0" : "btn-secondary w-full !py-2"}>
          {mini ? "⎋" : "Sair ↗"}
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Barra superior (celular/tablet) */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
        <Link href="/painel" aria-label="Início"><Logo subtitle={false} /></Link>
        <button ref={menuBtn} type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open} aria-controls="menu-principal"
          className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em]">
          <span aria-hidden>☰</span> Menu
        </button>
      </header>

      {/* Fundo escuro da gaveta */}
      <div onClick={() => setOpen(false)} aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />

      <aside
        id="menu-principal"
        aria-label="Menu"
        {...(open ? { role: "dialog", "aria-modal": true } : {})}
        className={`fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-line bg-white transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${mini ? "w-[76px]" : "w-[272px]"}`}
      >
        <div className={`flex items-center ${mini ? "flex-col gap-3 px-2 py-5" : "justify-between px-5 py-6"}`}>
          <Link href="/painel" aria-label="MakeOne — início">
            <Logo compact={mini} />
          </Link>
          <button ref={closeBtn} type="button" onClick={open ? () => setOpen(false) : toggle}
            aria-label={open ? "Fechar menu" : mini ? "Expandir menu" : "Recolher menu"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted-fg transition-colors hover:border-ink hover:text-ink">
            <span aria-hidden className="text-sm">{open ? "✕" : mini ? "»" : "«"}</span>
          </button>
        </div>
        {!mini && activeCompany && (
          <form action={switchCompany} className="mx-5 mb-1 flex items-center gap-3 rounded-xl border border-line px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {activeCompany.logo ? <img src={activeCompany.logo} alt="" className="h-full w-full object-contain" /> : <span className="text-sm font-bold text-accent">{activeCompany.name[0]}</span>}
            </div>
            <div className="min-w-0 flex-1">
            <label htmlFor="empresa-ativa" className="eyebrow block !text-[10px]">Empresa</label>
            {companies.length > 1 ? (
              <select id="empresa-ativa" name="company_id" defaultValue={activeCompany.id}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="mt-0.5 w-full bg-transparent text-sm font-semibold text-ink outline-none">
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : <p className="mt-0.5 truncate text-sm font-semibold text-ink">{activeCompany.name}</p>}
            </div>
          </form>
        )}
        {nav}
        {footer}
      </aside>
    </>
  );
}
