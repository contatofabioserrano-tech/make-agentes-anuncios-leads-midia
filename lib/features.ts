/**
 * Integrações opcionais. A MakeOne não usa Odoo: o fluxo principal é "Enviar materiais"
 * (links, fotos, PDFs). Para religar o catálogo Odoo (ex.: cliente com Odoo), defina
 * NEXT_PUBLIC_ODOO_ENABLED=1 no ambiente.
 */
export const ODOO_ENABLED = process.env.NEXT_PUBLIC_ODOO_ENABLED === "1";

/** Empresa usa o catálogo Odoo? Só se a integração estiver ligada e a empresa for do tipo "odoo". */
export const usesOdoo = (company: { kind: string } | null | undefined) => ODOO_ENABLED && company?.kind === "odoo";
