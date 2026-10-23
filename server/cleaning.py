"""Step 3 — cleaning layer for TREND ATLAS search payloads.

Dedupes web results / images / RSS, enriches with host tier, light brand/product
guesses, date heuristics, taxonomy tags, quality flags, and trust scores.
Never invents demand/growth signals.
"""

from __future__ import annotations

import re
import urllib.parse
from collections import Counter
from typing import Any

from taxonomy import build_match_index
from web_search import FASHION_PRESS_DOMAINS, _IMAGE_NOISE_RE, _normalize_url

# --- Host tier heuristics -------------------------------------------------

_PRESS_HOSTS = {
    d.lower().lstrip("www.") for d in FASHION_PRESS_DOMAINS
} | {
    "vogue.com",
    "businessoffashion.com",
    "wwd.com",
    "fashionista.com",
    "elle.com",
    "harpersbazaar.com",
    "highsnobiety.com",
    "hypebeast.com",
    "refinery29.com",
    "whowhatwear.com",
    "thecut.com",
    "nymag.com",
    "gq.com",
    "esquire.com",
    "fashionunited.com",
    "dazeddigital.com",
    "i-d.co",
    "i-d.vice.com",
    "cfda.com",
    "footwearnews.com",
}

_BRAND_HOSTS = {
    "acnestudios.com",
    "prada.com",
    "miumiu.com",
    "gucci.com",
    "chanel.com",
    "dior.com",
    "louisvuitton.com",
    "ysl.com",
    "saintlaurent.com",
    "balenciaga.com",
    "bottegaveneta.com",
    "celine.com",
    "loewe.com",
    "hermes.com",
    "therow.com",
    "toteme.com",
    "khaite.com",
    "cos.com",
    "arket.com",
    "zara.com",
    "hm.com",
    "allsaints.com",
    "schottnyc.com",
    "belstaff.com",
    "rickowens.eu",
    "maisonmargiela.com",
    "jilsander.com",
    "lemaire.fr",
    "courreges.com",
    "jacquemus.com",
    "ganni.com",
}

_ECOMMERCE_HOSTS = {
    "ssense.com",
    "farfetch.com",
    "net-a-porter.com",
    "matchesfashion.com",
    "mytheresa.com",
    "nordstrom.com",
    "shopbop.com",
    "asos.com",
    "zalando.com",
    "amazon.com",
    "ebay.com",
    "etsy.com",
    "shopify.com",
    "mrporter.com",
    "endclothing.com",
    "selfridges.com",
    "bergdorfgoodman.com",
    "saksfifthavenue.com",
}

_SOCIAL_HOSTS = {
    "instagram.com",
    "www.instagram.com",
    "tiktok.com",
    "www.tiktok.com",
    "pinterest.com",
    "www.pinterest.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "www.facebook.com",
    "youtube.com",
    "www.youtube.com",
    "reddit.com",
    "www.reddit.com",
    "threads.net",
}

_TRUST = {
    "press": 0.9,
    "brand": 0.72,
    "ecommerce": 0.55,
    "social": 0.4,
    "other": 0.35,
}

# Light brand / product guesses from titles — closed lists + regex, never invent.
_BRAND_TITLE_RE = re.compile(
    r"\b("
    r"Acne Studios|Prada|Miu Miu|The Row|Bottega Veneta|Balenciaga|"
    r"Gucci|Chanel|Dior|Louis Vuitton|Saint Laurent|YSL|"
    r"Alexander McQueen|Givenchy|Herm[eè]s|Celine|Céline|"
    r"Loewe|Tod'?s|Max Mara|Toteme|Khaite|The Frankie Shop|"
    r"COS|Zara|H&M|Aritzia|AllSaints|Schott|Belstaff|"
    r"Proenza Schouler|Issey Miyake|Comme des Gar[cç]ons|Rick Owens|"
    r"Maison Margiela|Jil Sander|Lemaire|Courr[eè]ges|Coperni|"
    r"Jacquemus|Ganni|Nanushka|Stand Studio|Agolde"
    r")\b",
    re.I,
)

_PRODUCT_TITLE_RE = re.compile(
    r"\b("
    r"leather jacket|biker jacket|moto jacket|bomber jacket|"
    r"puffer jacket|denim jacket|trench coat|overcoat|"
    r"blazer|cardigan|sweater|hoodie|"
    r"wide[- ]leg (?:trousers|pants)|barrel (?:trousers|pants)|"
    r"A[- ]?line skirt|midi dress|maxi dress|"
    r"sneakers|ankle boots|loafer|"
    r"tote bag|shoulder bag|belt"
    r")\b|"
    r"(皮夹克|机车夹克|飞行夹克|大衣|风衣|西装外套|针织衫|"
    r"阔腿裤|桶型裤|半身裙|连衣裙)",
    re.I,
)

_SEASON_CODE_RE = re.compile(r"\b(SS|AW|FW|PF)\s*'?(\d{2})\b", re.I)
_SEASON_WORD_RE = re.compile(
    r"\b(Spring|Summer|Fall|Autumn|Winter|Resort|Pre[- ]?Fall)\s+(20\d{2})\b",
    re.I,
)
_ISO_DATE_RE = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b")
_YEAR_ONLY_RE = re.compile(r"\b(20(?:2[4-9]|3\d))\b")

_LOW_RES_RE = re.compile(
    r"/w_90[,/%]|/w_1\d{2}[,/%]|_\d{2,3}x\d{2,3}\.|/thumb|/thumbnail|"
    r"150x150|100x100|64x64|48x48|32x32|width=\d{1,3}\b",
    re.I,
)
_ICON_LIKE_RE = re.compile(
    r"icon|sprite|logo|favicon|avatar|profile-pic|profile_pic|1x1|pixel\.gif",
    re.I,
)
_SOCIAL_CROP_RE = re.compile(
    r"-social-|/social/|w_1280,c_limit/-social|voguerunway-share|"
    r"share\.jpg|facebook\.com|fbcdn|instagram\.com.*(?:s\d{3}x\d{3})",
    re.I,
)

_MATCH_INDEX: list[dict[str, Any]] | None = None
_TAG_LAYERS = {"style", "category", "silhouette", "fabric"}


def _match_index() -> list[dict[str, Any]]:
    global _MATCH_INDEX
    if _MATCH_INDEX is None:
        _MATCH_INDEX = build_match_index()
    return _MATCH_INDEX


def _host_from_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    try:
        netloc = urllib.parse.urlparse(url).netloc.lower()
    except Exception:
        return ""
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc


def _root_host(host: str) -> str:
    host = (host or "").lower()
    if host.startswith("www."):
        host = host[4:]
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in ("co", "com", "org", "net", "gov"):
        return ".".join(parts[-3:])
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return host


def classify_source_tier(host: str) -> str:
    h = (host or "").lower()
    if h.startswith("www."):
        h = h[4:]
    root = _root_host(h)
    if h in _SOCIAL_HOSTS or root in _SOCIAL_HOSTS:
        return "social"
    if h in _PRESS_HOSTS or root in _PRESS_HOSTS:
        return "press"
    if h in _BRAND_HOSTS or root in _BRAND_HOSTS:
        return "brand"
    if h in _ECOMMERCE_HOSTS or root in _ECOMMERCE_HOSTS:
        return "ecommerce"
    # Soft press: *.vogue.com etc.
    for press in _PRESS_HOSTS:
        if h == press or h.endswith("." + press):
            return "press"
    for brand in _BRAND_HOSTS:
        if h == brand or h.endswith("." + brand):
            return "brand"
    for ecom in _ECOMMERCE_HOSTS:
        if h == ecom or h.endswith("." + ecom):
            return "ecommerce"
    return "other"


def trust_score_for_tier(tier: str) -> float:
    return float(_TRUST.get(tier or "other", _TRUST["other"]))


def guess_brand(title: str) -> str | None:
    if not title:
        return None
    m = _BRAND_TITLE_RE.search(title)
    return m.group(1).strip() if m else None


def guess_product(title: str) -> str | None:
    if not title:
        return None
    m = _PRODUCT_TITLE_RE.search(title)
    if not m:
        return None
    # Prefer the full matched span
    g = m.group(0) or m.group(1)
    return g.strip() if g else None


def _season_to_iso(code: str, yy: str) -> str:
    """SS27 → 2027-spring; AW26/FW26 → 2026-fall; PF26 → 2026-pre-fall."""
    year = 2000 + int(yy)
    c = code.upper()
    if c == "SS":
        return f"{year}-spring"
    if c in ("AW", "FW"):
        return f"{year}-fall"
    if c == "PF":
        return f"{year}-pre-fall"
    return f"{year}"


def _word_season_to_iso(word: str, year: str) -> str:
    w = word.lower().replace(" ", "")
    if w.startswith("spring") or w.startswith("summer"):
        return f"{year}-spring"
    if w.startswith("fall") or w.startswith("autumn") or w.startswith("winter"):
        return f"{year}-fall"
    if "resort" in w:
        return f"{year}-resort"
    if "pre" in w:
        return f"{year}-pre-fall"
    return year


def extract_date_iso(*texts: str, published: str | None = None) -> str | None:
    """Prefer RSS published ISO, then season tokens, else null (no hallucination)."""
    if published:
        pub = str(published).strip()
        m = _ISO_DATE_RE.search(pub)
        if m:
            return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
        # RFC-ish dates often start with weekday — try year-month if present
        m2 = re.search(r"(20\d{2})[-/](\d{2})[-/](\d{2})", pub)
        if m2:
            return f"{m2.group(1)}-{m2.group(2)}-{m2.group(3)}"
        # published may already be ISO from rss.py
        if re.match(r"^20\d{2}-\d{2}-\d{2}", pub):
            return pub[:10]

    blob = " ".join(t for t in texts if t)
    if not blob:
        return None

    m = _SEASON_CODE_RE.search(blob)
    if m:
        return _season_to_iso(m.group(1), m.group(2))

    m = _SEASON_WORD_RE.search(blob)
    if m:
        return _word_season_to_iso(m.group(1), m.group(2))

    return None  # do not invent from bare year alone


def quality_flags_for_url(url: str) -> list[str]:
    """Reuse noise URL patterns: low_res_guess, icon_like, social_crop."""
    flags: list[str] = []
    if not url:
        return ["icon_like"]
    lower = url.lower()
    if _LOW_RES_RE.search(lower) or re.search(r"/w_90[,/%]", lower):
        flags.append("low_res_guess")
    if _ICON_LIKE_RE.search(lower) or (_IMAGE_NOISE_RE.search(lower) and _ICON_LIKE_RE.search(lower)):
        flags.append("icon_like")
    elif _IMAGE_NOISE_RE.search(lower) and re.search(r"icon|logo|favicon|sprite|avatar", lower):
        flags.append("icon_like")
    if _SOCIAL_CROP_RE.search(lower):
        flags.append("social_crop")
    # Also flag classic noise as icon_like when clearly non-photo
    if re.search(r"favicon|1x1|pixel\.gif|sprite|lazyload-fallback", lower):
        if "icon_like" not in flags:
            flags.append("icon_like")
    return flags


def _token_boundary_ok(text: str, start: int, end: int) -> bool:
    if start > 0:
        prev = text[start - 1]
        if prev.isascii() and prev.isalnum() and text[start:start + 1].isascii():
            return False
    if end < len(text):
        nxt = text[end]
        if nxt.isascii() and nxt.isalnum() and text[end - 1 : end].isascii():
            return False
    return True


def match_taxonomy_tags(title: str, snippet: str = "") -> list[dict[str, str]]:
    """Multi-label match of taxonomy synonyms against title+snippet.

    Returns tags for style / category / silhouette / fabric only.
    """
    blob = f"{title or ''} {snippet or ''}".strip()
    if not blob:
        return []
    lower = blob.lower()
    seen_ids: set[str] = set()
    tags: list[dict[str, str]] = []
    for entry in _match_index():
        if entry["layer"] not in _TAG_LAYERS:
            continue
        phrase = entry["phrase"]
        if len(phrase) < 2 and phrase.isascii():
            continue
        pos = 0
        while True:
            idx = lower.find(phrase, pos)
            if idx < 0:
                break
            end = idx + len(phrase)
            if _token_boundary_ok(lower, idx, end) and entry["id"] not in seen_ids:
                seen_ids.add(entry["id"])
                tags.append(
                    {
                        "id": entry["id"],
                        "en": entry["en"],
                        "zh": entry["zh"],
                        "layer": entry["layer"],
                    }
                )
                break
            pos = idx + 1
    return tags


def _enrich_text_item(
    item: dict[str, Any],
    *,
    url_key: str,
    title_key: str = "title",
    snippet_keys: tuple[str, ...] = ("content", "snippet", "summary"),
    published: str | None = None,
) -> dict[str, Any]:
    out = dict(item)
    url = (out.get(url_key) or out.get("url") or out.get("link") or "").strip()
    title = str(out.get(title_key) or "")
    snippet = ""
    for k in snippet_keys:
        if out.get(k):
            snippet = str(out.get(k))
            break
    host = _host_from_url(url)
    tier = classify_source_tier(host)
    out["normalized_url"] = _normalize_url(url) if url else ""
    out["source_host"] = host
    out["source_tier"] = tier
    out["brand_guess"] = guess_brand(title)
    out["product_guess"] = guess_product(title)
    out["date_iso"] = extract_date_iso(title, snippet, published=published or out.get("published"))
    out["taxonomy_tags"] = match_taxonomy_tags(title, snippet)
    out["trust_score"] = trust_score_for_tier(tier)
    out["quality_flags"] = quality_flags_for_url(url) if not url else []
    return out


def _enrich_image(img: dict[str, Any] | str) -> dict[str, Any]:
    if isinstance(img, str):
        obj: dict[str, Any] = {"url": img}
    else:
        obj = dict(img or {})
    url = (obj.get("url") or obj.get("src") or "").strip()
    page = (obj.get("page_url") or obj.get("href") or "").strip()
    title = str(obj.get("title") or "")
    host = _host_from_url(page or url)
    tier = classify_source_tier(host)
    obj["url"] = url
    obj["normalized_url"] = _normalize_url(url) if url else ""
    obj["source_host"] = host
    obj["source_tier"] = tier
    obj["brand_guess"] = guess_brand(title) if title else None
    obj["product_guess"] = guess_product(title) if title else None
    obj["date_iso"] = extract_date_iso(title) if title else None
    obj["taxonomy_tags"] = match_taxonomy_tags(title) if title else []
    obj["trust_score"] = trust_score_for_tier(tier)
    obj["quality_flags"] = quality_flags_for_url(url)
    return obj


def _dedupe_by_norm_url(
    items: list[dict[str, Any]], url_field: str = "normalized_url"
) -> tuple[list[dict[str, Any]], int, int]:
    """Keep first occurrence per normalized URL. Returns (unique, raw_count, unique_count)."""
    raw = len(items)
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for it in items:
        key = (it.get(url_field) or "").strip()
        if not key:
            # keep items without URL (rare) under synthetic key by id/title
            key = f"__no_url__:{it.get('title') or id(it)}"
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out, raw, len(out)


def clean_search_payload(
    web_results: list[dict[str, Any]] | None = None,
    web_images: list[Any] | None = None,
    rss_items: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Clean + enrich search payload slices.

    Returns ``{ results, images, rss_items, stats }``.
    """
    raw_results = [dict(r) for r in (web_results or []) if isinstance(r, dict)]
    raw_images = list(web_images or [])
    raw_rss = [dict(r) for r in (rss_items or []) if isinstance(r, dict)]

    enriched_results = [
        _enrich_text_item(r, url_key="url", snippet_keys=("content", "snippet", "summary"))
        for r in raw_results
    ]
    enriched_images = [_enrich_image(im) for im in raw_images]
    enriched_rss = [
        _enrich_text_item(
            r,
            url_key="link",
            snippet_keys=("summary", "content", "snippet"),
            published=r.get("published"),
        )
        for r in raw_rss
    ]

    results, results_raw, results_unique = _dedupe_by_norm_url(enriched_results)
    images, images_raw, images_unique = _dedupe_by_norm_url(enriched_images)
    rss_clean, rss_raw, rss_unique = _dedupe_by_norm_url(enriched_rss)

    tier_counter: Counter[str] = Counter()
    for it in results + rss_clean:
        tier_counter[it.get("source_tier") or "other"] += 1
    for im in images:
        tier_counter[im.get("source_tier") or "other"] += 1

    tag_counter: Counter[str] = Counter()
    tag_tier: dict[str, Counter[str]] = {}
    for it in results + rss_clean:
        tier = it.get("source_tier") or "other"
        for tag in it.get("taxonomy_tags") or []:
            tid = tag.get("id") or tag.get("en") or ""
            if not tid:
                continue
            tag_counter[tid] += 1
            tag_tier.setdefault(tid, Counter())[tier] += 1

    coverage_note = {
        "press": tier_counter.get("press", 0),
        "brand": tier_counter.get("brand", 0),
        "ecommerce": tier_counter.get("ecommerce", 0),
        "social": tier_counter.get("social", 0),
        "other": tier_counter.get("other", 0),
    }

    stats = {
        "dedupe": {
            "results_raw": results_raw,
            "results_unique": results_unique,
            "results_dropped": max(0, results_raw - results_unique),
            "images_raw": images_raw,
            "images_unique": images_unique,
            "images_dropped": max(0, images_raw - images_unique),
            "rss_raw": rss_raw,
            "rss_unique": rss_unique,
            "rss_dropped": max(0, rss_raw - rss_unique),
        },
        "tiers": dict(coverage_note),
        "coverage_note": coverage_note,
        "taxonomy_freq": [
            {
                "id": tid,
                "count": cnt,
                "tiers": dict(tag_tier.get(tid) or {}),
            }
            for tid, cnt in tag_counter.most_common(40)
        ],
        # Explicit: no sales / demand / growth signals in this prototype
        "demand_signals": None,
        "has_growth_evidence": False,
        "has_sales_evidence": False,
    }

    return {
        "results": results,
        "images": images,
        "rss_items": rss_clean,
        "stats": stats,
    }
