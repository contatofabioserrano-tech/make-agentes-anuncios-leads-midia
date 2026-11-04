"use client";

import { useMemo, useState } from "react";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Calculadora de margem por unidade. Todos os números são editáveis: a comissão
 * do TikTok Shop varia por categoria/campanha, então NÃO vem preenchida por suposição.
 */
export function PriceCalculator({ fobBrl }: { fobBrl: number }) {
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState(fobBrl.toFixed(2));
  const [fee, setFee] = useState("");
  const [extra, setExtra] = useState("");

  const r = useMemo(() => {
    const p = parseFloat(price.replace(",", "."));
    const c = parseFloat(cost.replace(",", "."));
    const f = parseFloat(fee.replace(",", ".")) || 0;
    const e = parseFloat(extra.replace(",", ".")) || 0;
    if (!p || !c) return null;
    const feeValue = (p * f) / 100;
    const margin = p - c - feeValue - e;
    return { feeValue, margin, pct: (margin / p) * 100, breakEven: (c + e) / (1 - f / 100) };
  }, [price, cost, fee, extra]);

  const field = (label: string, v: string, set: (s: string) => void, hint: string) => (
    <label className="block">
      <span className="text-xs font-semibold text-muted-fg">{label}</span>
      <input
        inputMode="decimal"
        value={v}
        onChange={(e) => set(e.target.value)}
        placeholder={hint}
        className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-violet"
      />
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {field("Preço de venda (R$)", price, setPrice, "ex.: 99,90")}
        {field("Custo unitário (R$)", cost, setCost, "custo")}
        {field("Comissão + taxas do TikTok Shop (%)", fee, setFee, "ver Seller Center")}
        {field("Frete/embalagem/outros (R$)", extra, setExtra, "0,00")}
      </div>
      <p className="text-[11px] text-muted-fg">
        Custo pré-preenchido com o valor FOB do Odoo (R$ {fobBrl.toFixed(2).replace(".", ",")}).
        Ele ainda não inclui frete internacional, impostos de importação e nacionalização. Troque pelo custo
        nacionalizado para ter a margem real.
      </p>
      {r ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-muted p-3">
            <div className="text-[11px] text-muted-fg">Taxas</div>
            <div className="text-sm font-bold">{brl(r.feeValue)}</div>
          </div>
          <div className={`rounded-xl p-3 ${r.margin >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
            <div className="text-[11px] text-muted-fg">Margem por unidade</div>
            <div className={`text-sm font-bold ${r.margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {brl(r.margin)} ({r.pct.toFixed(1)}%)
            </div>
          </div>
          <div className="rounded-xl bg-surface-muted p-3">
            <div className="text-[11px] text-muted-fg">Preço mínimo (margem 0)</div>
            <div className="text-sm font-bold">{brl(r.breakEven)}</div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-fg">Preencha preço e custo para ver a margem.</p>
      )}
    </div>
  );
}
