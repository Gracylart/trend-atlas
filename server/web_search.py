"""Web search via Tavily and Exa REST.

Requires TAVILY_API_KEY and/or EXA_API_KEY for live results.
Soft-fails on errors — never fabricates hits.
When both keys are set, runs both and merges/dedupes by URL.
Optionally attaches image URLs when providers return them.

Surfaces publicly indexed runway looks via search only — no Vogue GraphQL,
voguescraper, or undocumented APIs. Full Vogue Runway archive requires their
subscription/product deal and is not implemented here.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import json
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from config import EXA_API_KEY, TAVILY_API_KEY

TAVILY_URL = "https://api.tavily.com/search"
TAVILY_TIMEOUT = 20

EXA_URL = "https://api.exa.ai/search"
EXA_TIMEOUT = 25

# Prefer fashion / style press when include_domains / includeDomains is used.
FASHION_PRESS_DOMAINS = [
    "vogue.com",
    "businessoffashion.com",
    "wwd.com",
    "fashionista.com",
    "elle.com",
    "harpersbazaar.com",
    "i-d.co",
    "dazeddigital.com",
    "anothermag.com",
    "interviewmagazine.com",
    "purple.fr",
    "wonderlandmagazine.com",
    "crfashionbook.com",
    "numero.com",
    "teenvogue.com",
    "gq.com",
    "esquire.com",
    "footwearnews.com",
    "theguardian.com",
    "nytimes.com",
]

# Second lightweight Tavily pass: runway-section hosts only.
RUNWAY_FOCUS_DOMAINS = [
    "vogue.com",
    "wwd.com",
    "elle.com",
]


IMAGE_CAP = 24

# Short-lived in-memory cache for search_web (visual_q + limit).
_SEARCH_CACHE: dict[tuple[str, int], tuple[float, dict[str, Any]]] = {}
_SEARCH_CACHE_LOCK = threading.Lock()
_SEARCH_CACHE_TTL = 120.0

_FASHION_WORD_RE = re.compile(
    r"\b(fashion|runway|lookbook|womenswear|menswear|couture|"
    r"ready[- ]?to[- ]?wear|\brtw\b|streetwear|silhouette|tailoring|"
    r"apparel|garment|outfit|style|fashion-shows)\b",
    re.I,
)
_RUNWAY_WORD_RE = re.compile(
    r"\b(runway|fashion[- ]?shows?|ready[- ]?to[- ]?wear|\brtw\b|"
    r"lookbook|couture|catwalk)\b",
    re.I,
)
_SEASON_RE = re.compile(r"\b((?:ss|aw|fw)\d{2})\b", re.I)

# URL noise: icons, tracking, themes, share stubs, profile thumbs, etc.
_IMAGE_NOISE_RE = re.compile(
    r"icon|sprite|logo|lazyload|scorecardresearch|facebook|"
    r"tracking|voguerunway-share|wp-content/themes|favicon|avatar|"
    r"pixel\.gif|1x1|placeholder|newsletter|profile-pic|profile_pic|"
    r"author-bio|/w_90[,/%]|product-images|vidthumb|share\.jpg|"
    r"16:9|-social-|/social/|w_1280,c_limit/-social",
    re.I,
)
# Must look like an image asset (extension or known photo CDN), not a HTML page.
_IMAGE_ASSET_RE = re.compile(
    r"\.(?:jpe?g|png|webp|gif)(?:\?|$)|assets\.vogue\.com/photos/|"
    r"wp-content/uploads/|cdn\.|cloudinary|imgix|akamai",
    re.I,
)
# Prefer these CDN / runway path patterns when ranking.
_VOGUE_PHOTOS_RE = re.compile(r"assets\.vogue\.com/photos/", re.I)
_LOOK_NUM_RE = re.compile(r"/0000\d+-", re.I)
_RUNWAY_PATH_RE = re.compile(
    r"fashion-shows|ready-to-wear|\brtw\b|runway",
    re.I,
)
_WWD_UPLOADS_RE = re.compile(
    r"wwd\.com/wp-content/uploads/.*(?:runway|rtw|ss\d{2}|aw\d{2}|fw\d{2}|look)",
    re.I,
)


def _visual_query(q: str) -> str:
    """Enrich queries for runway-look visual retrieval.

    Keep original ``q`` in API response metadata. When the query already has
    runway language, return it unchanged; otherwise bias toward Vogue fashion
    shows / RTW look coverage.
    """
    q = (q or "").strip()
    if not q:
        return "runway ready-to-wear look site:vogue.com/fashion-shows"
    if _RUNWAY_WORD_RE.search(q):
        return q
    # Fashion season / category without explicit runway words → add bias.
    if _FASHION_WORD_RE.search(q) or _SEASON_RE.search(q):
        return f"{q} site:vogue.com/fashion-shows OR runway ready-to-wear look"
    return f"{q} site:vogue.com/fashion-shows OR runway ready-to-wear look"


def _normalize_url(url: str) -> str:
    """Canonical key for dedupe: scheme+host+path, lowercased, no trailing slash."""
    url = (url or "").strip()
    if not url:
        return ""
    try:
        p = urllib.parse.urlparse(url)
        path = (p.path or "").rstrip("/") or ""
        netloc = (p.netloc or "").lower()
        return f"{p.scheme.lower()}://{netloc}{path}"
    except Exception:
        return url.rstrip("/").lower()


def _as_image_url(value: Any) -> str | None:
    """Accept a bare URL string or a dict with url/src; require absolute http(s)."""
    if isinstance(value, str):
        u = value.strip()
    elif isinstance(value, dict):
        u = (value.get("url") or value.get("src") or "").strip()
    else:
        return None
    if not u:
        return None
    lower = u.lower()
    if lower.startswith("http://") or lower.startswith("https://"):
        return u
    return None


def _is_image_noise(url: str) -> bool:
    """True if URL looks like icon/tracking/theme junk rather than a look photo."""
    if not url:
        return True
    lower = url.lower()
    path_only = lower.split("?", 1)[0].split("#", 1)[0]
    if _IMAGE_NOISE_RE.search(lower):
        return True
    # Bare .gif without runway signals → noise (lazyload-fallback.gif etc.)
    if path_only.endswith(".gif") and not _RUNWAY_PATH_RE.search(lower):
        return True
    # Drop HTML/slideshow page URLs that providers sometimes put in imageLinks
    if "/slideshow/" in path_only and not path_only.endswith(
        (".jpg", ".jpeg", ".png", ".webp", ".gif")
    ):
        return True
    if not _IMAGE_ASSET_RE.search(lower):
        return True
    return False


def _image_quality_score(url: str) -> int:
    """Higher = prefer this look URL when ordering the images list."""
    if not url:
        return -100
    score = 0
    lower = url.lower()
    if _VOGUE_PHOTOS_RE.search(lower):
        score += 10
    if _LOOK_NUM_RE.search(lower) or _RUNWAY_PATH_RE.search(lower):
        score += 6
    if _WWD_UPLOADS_RE.search(lower) or (
        "wwd.com/wp-content/uploads/" in lower
        and _RUNWAY_PATH_RE.search(lower)
    ):
        score += 5
    elif "wwd.com/wp-content/uploads/" in lower:
        score += 2
    if _is_image_noise(url):
        score -= 20
    if re.search(r"vidthumb", lower, re.I):
        score -= 8
    if re.search(r"16:9|-social-|/social|newsletter|w_1280,c_limit.*social", lower, re.I):
        score -= 6
    return score


def _collect_image_list(raw: Any) -> list[str]:
    """Normalize a list of image URLs / objects into absolute http(s) strings."""
    out: list[str] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        u = _as_image_url(item)
        if u and not _is_image_noise(u):
            out.append(u)
    return out


def _all_images_from_item(item: dict[str, Any]) -> list[str]:
    """Collect all absolute image URLs from a provider result (image + images + extras).

    Filters noise URLs; ranks preferred runway CDN paths first.
    """
    found: list[str] = []
    seen: set[str] = set()

    def add(val: Any) -> None:
        u = _as_image_url(val)
        if not u or _is_image_noise(u):
            return
        key = _normalize_url(u) or u
        if key in seen:
            return
        seen.add(key)
        found.append(u)

    add(item.get("image"))
    imgs = item.get("images")
    if isinstance(imgs, list):
        for im in imgs:
            add(im)
    extras = item.get("extras")
    if isinstance(extras, dict):
        links = extras.get("imageLinks") or extras.get("image_links") or []
        if isinstance(links, list):
            for link in links:
                add(link)
    found.sort(key=_image_quality_score, reverse=True)
    return found


def _first_image_from_item(item: dict[str, Any]) -> str | None:
    """Best-effort primary image on a provider result dict."""
    imgs = _all_images_from_item(item)
    return imgs[0] if imgs else None


def _image_obj(
    url: str,
    *,
    title: str = "",
    page_url: str = "",
    origin: str = "",
) -> dict[str, str]:
    return {
        "url": url,
        "title": title or "",
        "page_url": page_url or "",
        "origin": origin or "",
    }


def _dedupe_image_objs(
    *batches: list[dict[str, str]], cap: int = IMAGE_CAP
) -> list[dict[str, str]]:
    """Dedupe image objects by URL; prefer higher quality scores, then first-seen."""
    by_key: dict[str, dict[str, str]] = {}
    order: list[str] = []
    for batch in batches:
        for obj in batch:
            url = (obj.get("url") or "").strip()
            if not url or _is_image_noise(url):
                continue
            key = _normalize_url(url) or url
            if key in by_key:
                # Keep richer title/page_url if missing on keeper.
                keeper = by_key[key]
                if not keeper.get("title") and obj.get("title"):
                    keeper["title"] = obj["title"]
                if not keeper.get("page_url") and obj.get("page_url"):
                    keeper["page_url"] = obj["page_url"]
                continue
            by_key[key] = dict(obj)
            order.append(key)

    ranked = sorted(
        order,
        key=lambda k: (
            -_image_quality_score(by_key[k].get("url") or ""),
            order.index(k),
        ),
    )
    out: list[dict[str, str]] = []
    for k in ranked:
        out.append(by_key[k])
        if len(out) >= cap:
            break
    return out


def _tavily_search(
    q: str,
    limit: int,
    *,
    include_domains: list[str] | None = None,
    search_depth: str = "basic",
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, str]]]:
    """Call Tavily Search API. Returns (mapped_results, provider_meta, top_level_images)."""
    max_results = max(1, min(int(limit), 20))
    domains = include_domains if include_domains is not None else FASHION_PRESS_DOMAINS
    body: dict[str, Any] = {
        "api_key": TAVILY_API_KEY,
        "query": q,
        "max_results": max_results,
        "search_depth": search_depth,
        "include_images": True,
    }
    if domains:
        body["include_domains"] = domains
    raw = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        TAVILY_URL,
        data=raw,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TAVILY_API_KEY}",
            "User-Agent": "TrendAtlasBot/1.0 (+local-dev; fashion-trend-research)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TAVILY_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", errors="replace")[:400]
        except Exception:
            pass
        return [], {
            "provider": "tavily",
            "status": "error",
            "message": f"Tavily HTTP {e.code}: {detail or e.reason}",
        }, []
    except urllib.error.URLError as e:
        return [], {
            "provider": "tavily",
            "status": "error",
            "message": f"Tavily network error: {e.reason}",
        }, []
    except (TimeoutError, json.JSONDecodeError, OSError) as e:
        return [], {
            "provider": "tavily",
            "status": "error",
            "message": f"Tavily request failed: {e}",
        }, []

    raw_top = payload.get("images") or []
    top_images: list[dict[str, str]] = []
    if isinstance(raw_top, list):
        for item in raw_top:
            if isinstance(item, str):
                u = _as_image_url(item)
                if u and not _is_image_noise(u):
                    top_images.append(_image_obj(u, origin="tavily"))
            elif isinstance(item, dict):
                u = _as_image_url(item)
                if u and not _is_image_noise(u):
                    top_images.append(
                        _image_obj(
                            u,
                            title=str(item.get("title") or item.get("description") or ""),
                            page_url=str(item.get("url") or item.get("page_url") or ""),
                            origin="tavily",
                        )
                    )

    mapped: list[dict[str, Any]] = []
    for item in payload.get("results") or []:
        if not isinstance(item, dict):
            continue
        title = (item.get("title") or "").strip()
        url = (item.get("url") or "").strip()
        content = (item.get("content") or "").strip()
        if not url and not title:
            continue
        score = item.get("score")
        try:
            score_f = float(score) if score is not None else None
        except (TypeError, ValueError):
            score_f = None
        row: dict[str, Any] = {
            "title": title or url,
            "url": url,
            "content": content,
            "snippet": content,
            "score": score_f,
            "source": "tavily",
        }
        imgs = _all_images_from_item(item)
        if imgs:
            row["image"] = imgs[0]
            row["images"] = imgs
        mapped.append(row)

    return mapped, {
        "provider": "tavily",
        "status": "ok",
        "message": f"Tavily returned {len(mapped)} result(s).",
        "count": len(mapped),
    }, top_images


def _exa_search(
    q: str, limit: int
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, str]]]:
    """Call Exa Search API (POST https://api.exa.ai/search). Soft-fails on errors."""
    num_results = max(1, min(int(limit), 20))
    # Docs: x-api-key (or Authorization Bearer). Request uses query, type, numResults,
    # includeDomains, contents.text / highlights / extras.imageLinks.
    body = {
        "query": q,
        "type": "auto",
        "numResults": num_results,
        "includeDomains": FASHION_PRESS_DOMAINS,
        "contents": {
            "text": {"maxCharacters": 400},
            "highlights": True,
            "extras": {"imageLinks": 5},
        },
    }
    raw = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        EXA_URL,
        data=raw,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-key": EXA_API_KEY,
            "User-Agent": "TrendAtlasBot/1.0 (+local-dev; fashion-trend-research)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=EXA_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", errors="replace")[:400]
        except Exception:
            pass
        return [], {
            "provider": "exa",
            "status": "error",
            "message": f"Exa HTTP {e.code}: {detail or e.reason}",
        }, []
    except urllib.error.URLError as e:
        return [], {
            "provider": "exa",
            "status": "error",
            "message": f"Exa network error: {e.reason}",
        }, []
    except (TimeoutError, json.JSONDecodeError, OSError) as e:
        return [], {
            "provider": "exa",
            "status": "error",
            "message": f"Exa request failed: {e}",
        }, []

    mapped: list[dict[str, Any]] = []
    exa_images: list[dict[str, str]] = []
    for item in payload.get("results") or []:
        if not isinstance(item, dict):
            continue
        title = (item.get("title") or "").strip()
        url = (item.get("url") or "").strip()
        if not url and not title:
            continue

        highlights = item.get("highlights") or []
        if isinstance(highlights, list):
            highlight_text = " … ".join(
                h.strip() for h in highlights if isinstance(h, str) and h.strip()
            )
        else:
            highlight_text = ""
        text = (item.get("text") or "").strip()
        content = highlight_text or text
        if len(content) > 2000:
            content = content[:2000].rstrip() + "…"

        score_f: float | None = None
        scores = item.get("highlightScores") or []
        if isinstance(scores, list) and scores:
            try:
                score_f = float(scores[0])
            except (TypeError, ValueError):
                score_f = None

        row: dict[str, Any] = {
            "title": title or url,
            "url": url,
            "content": content,
            "snippet": content,
            "score": score_f,
            "source": "exa",
        }
        imgs = _all_images_from_item(item)
        if imgs:
            row["image"] = imgs[0]
            row["images"] = imgs
            for im in imgs:
                exa_images.append(
                    _image_obj(im, title=title or url, page_url=url, origin="exa")
                )
        mapped.append(row)

    return mapped, {
        "provider": "exa",
        "status": "ok",
        "message": f"Exa returned {len(mapped)} result(s).",
        "count": len(mapped),
    }, exa_images


def _merge_by_url(
    batches: list[list[dict[str, Any]]], limit: int
) -> list[dict[str, Any]]:
    """Dedupe by normalized URL; first-seen wins (Tavily before Exa when both run).
    When a later hit has images and the first does not, merge images onto the keeper.
    """
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    by_key: dict[str, dict[str, Any]] = {}
    for batch in batches:
        for item in batch:
            url = (item.get("url") or "").strip()
            key = (
                _normalize_url(url)
                if url
                else f"title:{(item.get('title') or '').strip().lower()}"
            )
            if not key:
                continue
            if key in seen:
                keeper = by_key.get(key)
                if keeper is not None:
                    if not keeper.get("image") and item.get("image"):
                        keeper["image"] = item["image"]
                    if item.get("images"):
                        existing = list(keeper.get("images") or [])
                        if keeper.get("image") and keeper["image"] not in existing:
                            existing.insert(0, keeper["image"])
                        for im in item["images"]:
                            if im not in existing and not _is_image_noise(im):
                                existing.append(im)
                        if existing:
                            existing.sort(key=_image_quality_score, reverse=True)
                            keeper["images"] = existing
                            if not keeper.get("image"):
                                keeper["image"] = existing[0]
                continue
            seen.add(key)
            by_key[key] = item
            out.append(item)
            if len(out) >= limit:
                return out
    return out


def search_web(q: str, limit: int = 8) -> dict[str, Any]:
    """Search the web via Tavily and/or Exa when keys are set; otherwise credentials stub.

    Uses a runway-biased visual query for provider calls when helpful, but always
    returns the original ``q`` in response metadata. Optionally runs a second
    lightweight Tavily pass on runway-focus domains only when main+exa yield
    fewer than 8 images (soft-fail). Results are cached briefly in-process.
    """
    visual_q = _visual_query(q)
    cache_key = ((visual_q or "").strip().lower(), max(1, int(limit)))

    with _SEARCH_CACHE_LOCK:
        hit = _SEARCH_CACHE.get(cache_key)
        if hit is not None:
            ts, cached_payload = hit
            if time.monotonic() - ts < _SEARCH_CACHE_TTL:
                out = dict(cached_payload)
                out["cached"] = True
                return out

    providers: list[dict[str, Any]] = []
    batches: list[list[dict[str, Any]]] = []
    image_batches: list[list[dict[str, str]]] = []
    any_ok = False
    any_error = False
    any_key = False

    def _run_tavily_main():
        return _tavily_search(visual_q, limit)

    def _run_tavily_runway():
        runway_q = visual_q
        if "runway" not in runway_q.lower() and "fashion-shows" not in runway_q.lower():
            runway_q = f"{q} runway look"
        return _tavily_search(
            runway_q,
            min(6, max(3, int(limit))),
            include_domains=RUNWAY_FOCUS_DOMAINS,
            search_depth="basic",
        )

    def _run_exa():
        return _exa_search(visual_q, limit)

    def _ingest(meta: dict[str, Any], results: list[dict[str, Any]], images: list[dict[str, str]]) -> None:
        nonlocal any_ok, any_error
        providers.append(meta)
        if meta.get("status") == "ok":
            any_ok = True
            batches.append(results)
            if images:
                image_batches.append(images)
        elif meta.get("status") == "error":
            any_error = True

    def _count_images_so_far() -> int:
        """Unique image URLs from main+exa batches so far (pre-runway)."""
        seen: set[str] = set()
        for batch in image_batches:
            for obj in batch:
                url = (obj.get("url") or "").strip()
                if not url or _is_image_noise(url):
                    continue
                seen.add(_normalize_url(url) or url)
        for batch in batches:
            for item in batch:
                for im in _all_images_from_item(item):
                    seen.add(_normalize_url(im) or im)
                primary = item.get("image")
                if isinstance(primary, str) and primary and not _is_image_noise(primary):
                    seen.add(_normalize_url(primary) or primary)
        return len(seen)

    # Phase 1: Tavily MAIN + Exa in parallel (no runway yet).
    jobs: dict[str, Any] = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        if TAVILY_API_KEY:
            any_key = True
            jobs["tavily"] = pool.submit(_run_tavily_main)
        if EXA_API_KEY:
            any_key = True
            jobs["exa"] = pool.submit(_run_exa)

        if "tavily" in jobs:
            try:
                tavily_results, tavily_meta, tavily_images = jobs["tavily"].result()
            except Exception as e:
                tavily_results, tavily_images = [], []
                tavily_meta = {
                    "provider": "tavily",
                    "status": "error",
                    "message": f"Tavily unexpected error: {e}",
                }
            _ingest(tavily_meta, tavily_results, tavily_images)
        else:
            providers.append(
                {
                    "provider": "tavily",
                    "status": "needs_credentials",
                    "message": "Set TAVILY_API_KEY to enable Tavily search.",
                }
            )

        if "exa" in jobs:
            try:
                exa_results, exa_meta, exa_images = jobs["exa"].result()
            except Exception as e:
                exa_results, exa_images = [], []
                exa_meta = {
                    "provider": "exa",
                    "status": "error",
                    "message": f"Exa unexpected error: {e}",
                }
            _ingest(exa_meta, exa_results, exa_images)
        else:
            providers.append(
                {
                    "provider": "exa",
                    "status": "needs_credentials",
                    "message": "Set EXA_API_KEY to enable Exa neural search.",
                }
            )

    # Phase 2: runway only if we still need more images.
    image_count = _count_images_so_far()
    if TAVILY_API_KEY and image_count < 8:
        try:
            r_results, r_meta, r_images = _run_tavily_runway()
            r_meta = dict(r_meta)
            r_meta["provider"] = "tavily_runway"
            r_meta["message"] = (
                f"Tavily runway-focus returned {r_meta.get('count', len(r_results))} result(s)."
                if r_meta.get("status") == "ok"
                else r_meta.get("message", "Tavily runway-focus failed.")
            )
            _ingest(r_meta, r_results, r_images)
        except Exception as e:
            providers.append(
                {
                    "provider": "tavily_runway",
                    "status": "error",
                    "message": f"Tavily runway-focus unexpected error: {e}",
                }
            )
    elif TAVILY_API_KEY:
        providers.append(
            {
                "provider": "tavily_runway",
                "status": "skipped",
                "message": "skipped; enough images from main+exa",
            }
        )

    # Soft cap merge limit a bit higher so runway pass can contribute.
    results = _merge_by_url(batches, max(1, int(limit) + 4))

    # Article-linked images first (with title/url), then provider top-level images.
    # Cap per article so one gallery page cannot fill the whole list.
    PER_RESULT_IMAGE_CAP = 4
    article_images: list[dict[str, str]] = []
    for r in results:
        title = str(r.get("title") or "")
        page = str(r.get("url") or "")
        origin = str(r.get("source") or "article")
        imgs = list(r.get("images") or [])
        primary = r.get("image")
        if isinstance(primary, str) and primary and primary not in imgs:
            if not _is_image_noise(primary):
                imgs.insert(0, primary)
        # Re-rank and filter
        clean = [im for im in imgs if isinstance(im, str) and im and not _is_image_noise(im)]
        clean.sort(key=_image_quality_score, reverse=True)
        for im in clean[:PER_RESULT_IMAGE_CAP]:
            article_images.append(
                _image_obj(im, title=title, page_url=page, origin=origin)
            )

    images = _dedupe_image_objs(article_images, *image_batches, cap=IMAGE_CAP)

    if results or any_ok:
        overall = "ok"
    elif not any_key:
        overall = "needs_credentials"
    elif any_error:
        overall = "error"
    else:
        overall = "needs_credentials"

    payload = {
        "status": overall,
        "query": q,
        "visual_query": visual_q,
        "limit": limit,
        "results": results[: max(1, int(limit))],
        "images": images,
        "providers": providers,
        "cached": False,
    }

    with _SEARCH_CACHE_LOCK:
        # Store a shallow copy without mutating caller's view later.
        _SEARCH_CACHE[cache_key] = (time.monotonic(), dict(payload))

    return payload
