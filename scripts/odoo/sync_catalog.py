"""Sincroniza o catálogo do Odoo Kairós -> Supabase (public.mk_catalog_products).

Credenciais SÓ por variável de ambiente (nunca no código):
  ODOO_URL=https://kairos.importefacil.com  ODOO_DB=kairos
  ODOO_USER=<login>  ODOO_PASSWORD=<senha de um usuário de integração>
  (a API externa /jsonrpc e /xmlrpc está bloqueada no servidor — usa login de sessão web)
  SUPABASE_URL=...   SUPABASE_SERVICE_ROLE_KEY=...            (worker)
     ou SUPABASE_ANON_KEY + SUPABASE_EMAIL + SUPABASE_PASSWORD (login de um admin do portal)

Uso:
  python3 scripts/odoo/sync_catalog.py            # grava no Supabase via REST (service role)
  python3 scripts/odoo/sync_catalog.py --sql out  # gera arquivos SQL de upsert (sem service role)
"""
import json
import os
import ssl
import sys
import urllib.request

FIELDS = [
    "id", "default_code", "name", "kairos_name_pt", "kairos_name_en", "kairos_name_zh", "kairos_brand",
    "kairos_state", "categ_id", "list_price", "standard_price", "kairos_price", "kairos_price_usd", "kairos_price_brl",
    "kairos_price_cny", "kairos_price_currency_code", "kairos_reference_price", "barcode",
    "kairos_technical_name", "kairos_technical_description", "kairos_technical_description_en",
    "kairos_origin_description", "description_sale", "kairos_origin_country_id", "kairos_ncm_id",
    "kairos_ncm_suggested_id", "kairos_ncm_rationale", "kairos_hs_id", "kairos_hs_origin", "kairos_fiscal_description",
    "kairos_voltage", "kairos_fixed_weight", "kairos_gross_weight", "weight", "volume",
    "kairos_package_qty", "kairos_package_length", "kairos_package_width", "kairos_package_height",
    "kairos_package_gross_weight", "kairos_package_net_weight", "kairos_qty_per_inner",
    "kairos_pallet_qty", "kairos_pallet_length", "kairos_pallet_width", "kairos_pallet_height",
    "kairos_pallet_gross_weight", "kairos_missing_cert_names", "qty_available", "product_tag_ids",
    "image_128", "write_date",
]

# O que um marketplace exige/espera para o anúncio ficar completo.
CHECKS = [
    ("nome_pt", "Nome comercial em português", lambda p: bool(p.get("kairos_name_pt"))),
    ("marca", "Marca", lambda p: bool(p.get("kairos_brand"))),
    ("descricao", "Descrição técnica (PT)", lambda p: len(p.get("kairos_technical_description") or "") >= 120),
    ("foto", "Foto do produto", lambda p: bool(p.get("image_128"))),
    ("preco_venda", "Preço de venda", lambda p: (p.get("list_price") or 0) > 1),
    ("custo", "Custo (USD/BRL)", lambda p: (p.get("kairos_price_brl") or 0) > 0),
    ("ean", "Código de barras (EAN/GTIN)", lambda p: bool(p.get("barcode"))),
    ("peso_unit", "Peso da unidade (kg)", lambda p: (p.get("kairos_fixed_weight") or p.get("weight") or 0) > 0),
    ("caixa_master", "Caixa master (medidas e peso)", lambda p: all((p.get(k) or 0) > 0 for k in (
        "kairos_package_length", "kairos_package_width", "kairos_package_height", "kairos_package_gross_weight"))),
    ("ncm", "NCM aprovado", lambda p: bool(p.get("kairos_ncm_id"))),
    ("origem", "País de origem", lambda p: bool(p.get("kairos_origin_country_id"))),
    ("estoque", "Estoque", lambda p: (p.get("qty_available") or 0) > 0),
]


def m2o(v):
    return v[1] if isinstance(v, list) and len(v) > 1 else None


def _opener():
    import http.cookiejar
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
                                       urllib.request.HTTPSHandler(context=ctx))


def _post(op, url, params):
    body = json.dumps({"jsonrpc": "2.0", "method": "call", "params": params}).encode()
    req = urllib.request.Request(url, body, {"Content-Type": "application/json", "User-Agent": "kairos-catalog-sync/1.0"})
    out = json.load(op.open(req, timeout=180))
    if out.get("error"):
        raise SystemExit(f"Odoo: {out['error'].get('data', {}).get('message') or out['error']}")
    return out["result"]


def fetch():
    """Login por sessão web (/web/session/authenticate). Neste servidor a API externa
    (/jsonrpc e /xmlrpc) responde 403, então a chave de API não funciona aqui."""
    url, db, user = os.environ["ODOO_URL"].rstrip("/"), os.environ["ODOO_DB"], os.environ["ODOO_USER"]
    secret = os.environ.get("ODOO_PASSWORD") or os.environ["ODOO_API_KEY"]
    op = _opener()
    info = _post(op, f"{url}/web/session/authenticate", {"db": db, "login": user, "password": secret})
    if not info.get("uid"):
        raise SystemExit("Odoo: login recusado")
    return _post(op, f"{url}/web/dataset/call_kw", {
        "model": "product.template", "method": "search_read", "args": [[]],
        "kwargs": {"fields": FIELDS, "order": "id"}})


def fetch_images(ids):
    """Baixa image_1024 dos produtos com foto (sessão web) -> {odoo_id: bytes JPEG}."""
    import base64
    url, db, user = os.environ["ODOO_URL"].rstrip("/"), os.environ["ODOO_DB"], os.environ["ODOO_USER"]
    secret = os.environ.get("ODOO_PASSWORD") or os.environ["ODOO_API_KEY"]
    op = _opener()
    _post(op, f"{url}/web/session/authenticate", {"db": db, "login": user, "password": secret})
    out = {}
    for i in range(0, len(ids), 10):
        rows = _post(op, f"{url}/web/dataset/call_kw", {"model": "product.template", "method": "read",
                                                       "args": [ids[i:i + 10]], "kwargs": {"fields": ["image_1024"]}})
        for r in rows:
            v = r.get("image_1024")
            if isinstance(v, dict):  # Odoo 20 devolve {"content": base64, ...}
                v = v.get("content")
            if v:
                out[r["id"]] = base64.b64decode(v)
    return out


def upload_images(images):
    """Converte para JPEG em fundo branco e sobe em assets/catalogo/<odoo_id>.jpg (bucket público)."""
    import io
    from PIL import Image
    base, apikey, bearer = _supabase_auth()
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    for oid, raw in images.items():
        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        bg = Image.new("RGBA", im.size, "white")
        bg.alpha_composite(im)
        buf = io.BytesIO()
        bg.convert("RGB").save(buf, "JPEG", quality=90)
        req = urllib.request.Request(f"{base}/storage/v1/object/assets/catalogo/{oid}.jpg", buf.getvalue(), {
            "apikey": apikey, "Authorization": f"Bearer {bearer}", "Content-Type": "image/jpeg", "x-upsert": "true"},
            method="POST")
        urllib.request.urlopen(req, context=ctx, timeout=120)
    return len(images)


def to_record(p):
    missing = [label for _, label, ok in CHECKS if not ok(p)]
    data = {k: v for k, v in p.items() if k != "image_128"}
    return {
        "odoo_id": p["id"], "sku": p.get("default_code") or None,
        "name_pt": p.get("kairos_name_pt") or p.get("name"), "name_en": p.get("kairos_name_en") or None,
        "name_zh": p.get("kairos_name_zh") or None, "brand": p.get("kairos_brand") or None,
        "category": m2o(p.get("categ_id")), "status": p.get("kairos_state") or None,
        "price_usd": p.get("kairos_price_usd") or None, "price_brl": p.get("kairos_price_brl") or None,
        "price_cny": p.get("kairos_price_cny") or None, "list_price": p.get("list_price"),
        "origin_country": m2o(p.get("kairos_origin_country_id")), "ncm": m2o(p.get("kairos_ncm_id")),
        "hs_code": m2o(p.get("kairos_hs_id")), "has_image": bool(p.get("image_128")),
        "completeness": round(100 * (len(CHECKS) - len(missing)) / len(CHECKS)),
        "missing": missing, "data": data,
    }


def sql_literal(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, list):
        return "array[" + ",".join(sql_literal(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    if isinstance(v, dict):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


COLS = ["odoo_id", "sku", "name_pt", "name_en", "name_zh", "brand", "category", "status", "price_usd", "price_brl",
        "price_cny", "list_price", "origin_country", "ncm", "hs_code", "has_image", "completeness", "missing", "data"]


def write_sql(records, outdir, batch=40):
    os.makedirs(outdir, exist_ok=True)
    files = []
    for i in range(0, len(records), batch):
        vals = ",\n".join("(" + ",".join(sql_literal(r[c]) for c in COLS) + ")" for r in records[i:i + batch])
        upd = ",".join(f"{c}=excluded.{c}" for c in COLS[1:]) + ",synced_at=now()"
        path = os.path.join(outdir, f"upsert_{i // batch:03d}.sql")
        open(path, "w").write(f"insert into public.mk_catalog_products ({','.join(COLS)}) values\n{vals}\n"
                              f"on conflict (odoo_id) do update set {upd};\n")
        files.append(path)
    return files


def _supabase_auth():
    """service_role (worker) OU login de um usuário admin do portal (RLS permite admin gravar o catálogo)."""
    base = os.environ["SUPABASE_URL"].rstrip("/")
    if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        k = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        return base, k, k
    anon = os.environ["SUPABASE_ANON_KEY"]
    req = urllib.request.Request(f"{base}/auth/v1/token?grant_type=password", json.dumps({
        "email": os.environ["SUPABASE_EMAIL"], "password": os.environ["SUPABASE_PASSWORD"]}).encode(),
        {"apikey": anon, "Content-Type": "application/json"}, method="POST")
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    tok = json.load(urllib.request.urlopen(req, context=ctx, timeout=60))["access_token"]
    return base, anon, tok


def write_rest(records, batch=50):
    base, apikey, bearer = _supabase_auth()
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    for i in range(0, len(records), batch):
        req = urllib.request.Request(f"{base}/rest/v1/mk_catalog_products?on_conflict=odoo_id",
                                     json.dumps(records[i:i + batch], ensure_ascii=False).encode(), {
            "apikey": apikey, "Authorization": f"Bearer {bearer}", "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"}, method="POST")
        urllib.request.urlopen(req, context=ctx, timeout=120)


def main():
    rows = fetch()
    records = [to_record(p) for p in rows]
    print(f"{len(records)} produtos; completude média {sum(r['completeness'] for r in records) / max(1, len(records)):.0f}%")
    if "--sql" in sys.argv:
        files = write_sql(records, sys.argv[sys.argv.index("--sql") + 1])
        print("SQL:", len(files), "arquivos")
    else:
        write_rest(records)
        print("Supabase: upsert ok")
        if "--sem-fotos" not in sys.argv:
            ids = [r["odoo_id"] for r in records if r["has_image"]]
            print("fotos enviadas:", upload_images(fetch_images(ids)))


if __name__ == "__main__":
    main()
