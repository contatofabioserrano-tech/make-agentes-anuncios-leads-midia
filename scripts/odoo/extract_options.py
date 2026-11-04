"""Extrai as tabelas de opções do Odoo Kairós (SOMENTE LEITURA: só fields_get e search_read)
e grava a cópia em public.mk_odoo_options (Supabase), usada nos campos do /cadastro.

  ODOO_URL=https://kairos.importefacil.com ODOO_DB=kairos ODOO_USER=... ODOO_PASSWORD=...
  SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_EMAIL=<admin do portal> SUPABASE_PASSWORD=...
  python3 scripts/odoo/extract_options.py            # grava no Supabase
  python3 scripts/odoo/extract_options.py --json out # só salva JSON local
Erros 5xx (ex.: 525 do Cloudflare) são temporários: o script tenta de novo com espera crescente.
"""
import json
import os
import sys
import time
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sync_catalog as sc  # noqa: E402  reaproveita login por sessão web e o cliente Supabase

MODELS = ["kairos.option", "kairos.incoterm", "kairos.ncm", "kairos.hs", "kairos.product.document",
          "product.category", "res.country"]
READ_ONLY = {"fields_get", "search_read"}


def call(odoo, model, method, args, kwargs):
    assert method in READ_ONLY, "este script só lê o Odoo"
    for k in range(5):
        try:
            return odoo(model, method, args, kwargs)
        except urllib.error.HTTPError as e:
            if e.code < 500 or k == 4:
                raise
            time.sleep(3 * 2 ** k)


def odoo_session():
    """Login por sessão web (a API /jsonrpc dá 403 neste servidor). Devolve uma função de chamada só leitura."""
    url, db, user = os.environ["ODOO_URL"].rstrip("/"), os.environ["ODOO_DB"], os.environ["ODOO_USER"]
    op = sc._opener()
    info = sc._post(op, f"{url}/web/session/authenticate", {"db": db, "login": user, "password": os.environ["ODOO_PASSWORD"]})
    if not info.get("uid"):
        raise SystemExit("Odoo: login recusado")

    def odoo(model, method, args, kwargs):
        return sc._post(op, f"{url}/web/dataset/call_kw", {"model": model, "method": method, "args": args, "kwargs": kwargs})
    return odoo


def supabase_upsert(rows):
    base, apikey, bearer = sc._supabase_auth()
    ctx = sc.ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    for i in range(0, len(rows), 500):
        req = sc.urllib.request.Request(f"{base}/rest/v1/mk_odoo_options?on_conflict=model,odoo_id",
                                        json.dumps(rows[i:i + 500], ensure_ascii=False, default=str).encode(), {
            "apikey": apikey, "Authorization": f"Bearer {bearer}", "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"}, method="POST")
        sc.urllib.request.urlopen(req, context=ctx, timeout=120)


def main():
    odoo = odoo_session()
    out = []
    for m in MODELS:
        try:
            fields = call(odoo, m, "fields_get", [], {"attributes": ["type", "string"]})
        except Exception as e:
            print(f"[opções] {m}: sem acesso ({e})")
            continue
        want = [f for f in ("name", "display_name", "code", "ncm", "hs_code", "type", "category") if f in fields]
        rows = call(odoo, m, "search_read", [[]], {"fields": want, "limit": 20000})
        for r in rows:
            name = r.get("name") or r.get("display_name") or str(r["id"])
            code = r.get("code") or r.get("ncm") or r.get("hs_code") or None
            extra = {k: v for k, v in r.items() if k not in ("id", "name", "code")}
            out.append({"model": m, "odoo_id": r["id"], "name": str(name)[:300], "code": str(code)[:60] if code else None, "extra": extra})
        print(f"[opções] {m}: {len(rows)} registros")
    if "--json" in sys.argv:
        d = sys.argv[sys.argv.index("--json") + 1]
        os.makedirs(d, exist_ok=True)
        json.dump(out, open(os.path.join(d, "odoo_options.json"), "w"), ensure_ascii=False, indent=1)
        return
    supabase_upsert(out)
    print(f"[opções] {len(out)} opções gravadas em mk_odoo_options")


if __name__ == "__main__":
    main()
