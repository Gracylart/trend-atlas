"""TREND ATLAS local data layer — Flask API + optional static UI."""

from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
PARENT = ROOT.parent
sys.path.insert(0, str(ROOT))

from commerce import search_commerce  # noqa: E402
from config import (  # noqa: E402
    HOST,
    PORT,
    RSS_FEEDS,
    RSS_LIMIT_DEFAULT,
    SERVE_STATIC,
)
from query_parse import parse_query  # noqa: E402
from rss import fetch_all_feeds  # noqa: E402
from taxonomy import get_taxonomy_tree  # noqa: E402
from cleaning import clean_search_payload  # noqa: E402
from web_search import search_web  # noqa: E402

app = Flask(__name__, static_folder=None)


@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers.setdefault("Pragma", "no-cache")
    resp.headers.setdefault("Expires", "0")
    return resp


@app.route("/api/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return ("", 204)
    return jsonify(
        {
            "ok": True,
            "service": "trend-atlas",
            "feeds_configured": len(RSS_FEEDS),
            "feeds": [{"id": f["id"], "name": f["name"]} for f in RSS_FEEDS],
            "taxonomy": True,
            "parse": True,
            "cleaning": True,
        }
    )


@app.route("/api/taxonomy", methods=["GET", "OPTIONS"])
def api_taxonomy():
    if request.method == "OPTIONS":
        return ("", 204)
    return jsonify(get_taxonomy_tree())


@app.route("/api/parse", methods=["GET", "POST", "OPTIONS"])
def api_parse():
    if request.method == "OPTIONS":
        return ("", 204)
    q = ""
    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        q = (body.get("q") or body.get("query") or "").strip()
        if not q:
            q = (request.args.get("q") or "").strip()
    else:
        q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"error": "missing q", "raw_query": ""}), 400
    return jsonify(parse_query(q))


@app.route("/api/rss", methods=["GET", "OPTIONS"])
def api_rss():
    if request.method == "OPTIONS":
        return ("", 204)
    q = (request.args.get("q") or "").strip() or None
    try:
        limit = int(request.args.get("limit") or RSS_LIMIT_DEFAULT)
    except ValueError:
        limit = RSS_LIMIT_DEFAULT
    limit = max(1, min(limit, 100))
    payload = fetch_all_feeds(q=q, limit=limit)
    payload["query"] = q
    return jsonify(payload)


@app.route("/api/commerce/search", methods=["GET", "OPTIONS"])
def api_commerce():
    if request.method == "OPTIONS":
        return ("", 204)
    q = (request.args.get("q") or "").strip()
    try:
        limit = int(request.args.get("limit") or 12)
    except ValueError:
        limit = 12
    return jsonify(search_commerce(q, limit=limit))


@app.route("/api/search", methods=["GET", "OPTIONS"])
def api_search():
    if request.method == "OPTIONS":
        return ("", 204)
    q = (request.args.get("q") or "").strip() or "fashion"
    try:
        limit = int(request.args.get("limit") or 24)
    except ValueError:
        limit = 24
    limit = max(1, min(limit, 60))

    # Structured parse first; use expanded_query for web/rss retrieval
    parsed = parse_query(q)
    search_q = (parsed.get("expanded_query") or q).strip() or q

    # RSS / web / commerce in parallel — largest latency win on cold starts.
    with ThreadPoolExecutor(max_workers=3) as pool:
        fut_rss = pool.submit(fetch_all_feeds, None, search_q, limit)
        fut_web = pool.submit(search_web, search_q, 8)
        fut_commerce = pool.submit(search_commerce, q, 8)
        rss = fut_rss.result()
        web = fut_web.result()
        commerce = fut_commerce.result()

    demo = {
        "status": "ok",
        "note": "Frontend keeps local demo animations; hydrate Sources / Archive from rss.items.",
        "query": q,
        "expanded_query": search_q,
    }

    cleaned = clean_search_payload(
        web_results=(web or {}).get("results") or [],
        web_images=(web or {}).get("images") or [],
        rss_items=rss.get("items") or [],
    )

    return jsonify(
        {
            "query": q,
            "expanded_query": search_q,
            "parse": parsed,
            "demo": demo,
            "rss": {
                "status": "ok" if rss["feeds_ok"] else "degraded",
                "feeds_ok": rss["feeds_ok"],
                "feeds_total": rss["feeds_total"],
                "feeds": rss["feeds"],
                "items": rss["items"],
                "count": rss["count"],
                "cached": bool(rss.get("cached")),
                "cache_age_s": rss.get("cache_age_s"),
            },
            "web": web,
            "commerce": commerce,
            "cleaned": cleaned,
        }
    )


def _static_file(name: str):
    resp = send_from_directory(PARENT, name)
    # Belt-and-suspenders: never let browsers cache shell/entry assets
    if name in ("index.html", "app.js", "styles.css") or name.endswith(".js"):
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
    return resp


AUTHOR_PORTFOLIO = Path("/Users/stud/jason-deng-portfolio")


if SERVE_STATIC:

    @app.route("/author/")
    @app.route("/author")
    def author_portfolio_index():
        """Serve Tianci Deng local portfolio (same as file:///Users/stud/jason-deng-portfolio/)."""
        if not (AUTHOR_PORTFOLIO / "index.html").is_file():
            return jsonify({"error": "author portfolio not found"}), 404
        return send_from_directory(AUTHOR_PORTFOLIO, "index.html")

    @app.route("/author/<path:path>")
    def author_portfolio_static(path: str):
        resolved = (AUTHOR_PORTFOLIO / path).resolve()
        try:
            resolved.relative_to(AUTHOR_PORTFOLIO.resolve())
        except ValueError:
            return jsonify({"error": "not found"}), 404
        if not resolved.is_file():
            return jsonify({"error": "not found"}), 404
        return send_from_directory(AUTHOR_PORTFOLIO, path)

    @app.route("/")
    def index():
        return _static_file("index.html")

    @app.route("/<path:path>")
    def static_proxy(path: str):
        if path.startswith("api/"):
            return jsonify({"error": "not found"}), 404
        resolved = (PARENT / path).resolve()
        parent_resolved = PARENT.resolve()
        try:
            resolved.relative_to(parent_resolved)
        except ValueError:
            return jsonify({"error": "not found"}), 404
        if not resolved.is_file():
            return jsonify({"error": "not found"}), 404
        return _static_file(path)


def main():
    # Prefetch RSS so the first browser search is not cold.
    try:
        import threading

        def _warm():
            try:
                fetch_all_feeds(limit=40)
                print("  rss:      cache warmed")
            except Exception as e:
                print(f"  rss:      warm failed ({e})")

        threading.Thread(target=_warm, daemon=True).start()
    except Exception:
        pass
    print(f"TREND ATLAS server on http://{HOST}:{PORT}")
    print(f"  health:   GET /api/health")
    print(f"  taxonomy: GET /api/taxonomy")
    print(f"  parse:    GET|POST /api/parse?q=")
    print(f"  search:   GET /api/search?q=")
    print(f"  rss:      GET /api/rss")
    print(f"  commerce: GET /api/commerce/search?q=")
    if SERVE_STATIC:
        print(f"  UI:       http://127.0.0.1:{PORT}/")
    app.run(host=HOST, port=PORT, debug=False, threaded=True)


if __name__ == "__main__":
    main()
