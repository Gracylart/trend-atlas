"""Live fashion-media RSS fetch + parse. Soft-fails per feed."""

from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from config import RSS_CACHE_TTL, RSS_FEEDS, RSS_MAX_WORKERS, RSS_PER_FEED_CAP, RSS_TIMEOUT

USER_AGENT = "TrendAtlasBot/1.0 (+local-dev; fashion-trend-research)"

# In-memory feed cache keyed by feed-set id list (q/limit applied after).
_RSS_CACHE: dict[str, Any] = {}
_RSS_CACHE_LOCK = threading.Lock()

IMG_RE = re.compile(
    r'<img[^>]+src=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str | None) -> str:
    if not text:
        return ""
    text = html.unescape(text)
    text = TAG_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _child_text(el: ET.Element, names: tuple[str, ...]) -> str | None:
    want = {n.lower() for n in names}
    for child in list(el):
        if _local(child.tag).lower() in want:
            if child.text and child.text.strip():
                return child.text.strip()
            # Some feeds put text in nested nodes
            joined = "".join(child.itertext()).strip()
            if joined:
                return joined
    return None


def _find_image(item: ET.Element, summary_html: str) -> str | None:
    # media:content / media:thumbnail / enclosure
    for child in item.iter():
        local = _local(child.tag).lower()
        if local in ("content", "thumbnail"):
            url = child.attrib.get("url") or child.attrib.get("href")
            if url and url.startswith("http"):
                return url
        if local == "enclosure":
            enc_type = (child.attrib.get("type") or "").lower()
            url = child.attrib.get("url")
            if url and (enc_type.startswith("image/") or url.lower().endswith(
                (".jpg", ".jpeg", ".png", ".webp", ".gif")
            )):
                return url
        if local == "image":
            # RSS 2.0 channel image uses <url>; item-level rare
            url_el = None
            for c in child:
                if _local(c.tag).lower() == "url" and c.text:
                    url_el = c.text.strip()
                    break
            if url_el and url_el.startswith("http"):
                return url_el
            href = child.attrib.get("href") or child.attrib.get("url")
            if href and href.startswith("http"):
                return href

    m = IMG_RE.search(summary_html or "")
    if m:
        return m.group(1)
    return None


def _parse_date(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip()
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, IndexError, OverflowError):
        pass
    # ISO-ish
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError:
        return raw


def _parse_feed_xml(data: bytes, source: dict[str, str]) -> list[dict[str, Any]]:
    root = ET.fromstring(data)
    items: list[ET.Element] = []

    # RSS 2.0
    for el in root.iter():
        if _local(el.tag).lower() == "item":
            items.append(el)
    # Atom
    if not items:
        for el in root.iter():
            if _local(el.tag).lower() == "entry":
                items.append(el)

    results: list[dict[str, Any]] = []
    for item in items[:RSS_PER_FEED_CAP]:
        title = _child_text(item, ("title",)) or "(untitled)"
        link = None
        # Atom: <link href="...">
        for child in list(item):
            if _local(child.tag).lower() == "link":
                href = child.attrib.get("href")
                if href:
                    # prefer alternate
                    rel = child.attrib.get("rel", "alternate")
                    if rel in ("alternate", "") or link is None:
                        link = href
                elif child.text and child.text.strip():
                    link = child.text.strip()
        if not link:
            link = _child_text(item, ("link", "guid", "id"))

        summary_raw = (
            _child_text(item, ("description", "summary", "content", "encoded"))
            or ""
        )
        summary = _strip_html(summary_raw)[:400]
        published = _parse_date(
            _child_text(item, ("pubDate", "published", "updated", "date"))
        )
        image = _find_image(item, summary_raw)

        results.append(
            {
                "title": _strip_html(title),
                "link": link,
                "published": published,
                "summary": summary,
                "image": image,
                "source": source["name"],
                "source_id": source["id"],
            }
        )
    return results


def fetch_one_feed(source: dict[str, str]) -> dict[str, Any]:
    """Fetch a single feed. Never raises — returns status + items."""
    url = source["url"]
    try:
        req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml, */*"})
        with urlopen(req, timeout=RSS_TIMEOUT) as resp:
            data = resp.read()
        items = _parse_feed_xml(data, source)
        return {
            "id": source["id"],
            "name": source["name"],
            "url": url,
            "status": "ok",
            "count": len(items),
            "items": items,
        }
    except HTTPError as e:
        return {
            "id": source["id"],
            "name": source["name"],
            "url": url,
            "status": "error",
            "error": f"HTTP {e.code}",
            "count": 0,
            "items": [],
        }
    except (URLError, TimeoutError, ET.ParseError, OSError) as e:
        return {
            "id": source["id"],
            "name": source["name"],
            "url": url,
            "status": "error",
            "error": f"{type(e).__name__}: {e}",
            "count": 0,
            "items": [],
        }


def fetch_all_feeds(
    feeds: list[dict[str, str]] | None = None,
    q: str | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    feeds = feeds or RSS_FEEDS
    feed_key = ",".join(sorted(f.get("id", "") for f in feeds))
    now = time.time()

    cached = False
    cache_age = 0.0
    with _RSS_CACHE_LOCK:
        hit = _RSS_CACHE.get(feed_key)
        if hit and (now - hit["ts"]) < RSS_CACHE_TTL:
            feed_results = hit["feed_results"]
            all_items = [dict(it) for it in hit["items"]]
            cached = True
            cache_age = now - hit["ts"]
        else:
            hit = None

    if not cached:
        feed_results = []
        all_items = []
        with ThreadPoolExecutor(max_workers=min(RSS_MAX_WORKERS, max(1, len(feeds)))) as pool:
            futures = {pool.submit(fetch_one_feed, f): f for f in feeds}
            for fut in as_completed(futures):
                result = fut.result()
                feed_results.append(
                    {
                        "id": result["id"],
                        "name": result["name"],
                        "url": result["url"],
                        "status": result["status"],
                        "count": result["count"],
                        "error": result.get("error"),
                    }
                )
                all_items.extend(result["items"])

        def sort_key(it: dict[str, Any]) -> str:
            return it.get("published") or ""

        all_items.sort(key=sort_key, reverse=True)
        with _RSS_CACHE_LOCK:
            _RSS_CACHE[feed_key] = {
                "ts": time.time(),
                "feed_results": feed_results,
                "items": list(all_items),
            }

    # Query filter (soft): keep unfiltered fallback when nothing matches.
    items = list(all_items)
    if q:
        tokens = [t.lower() for t in re.split(r"\s+", q.strip()) if t]
        if tokens:

            def matches(it: dict[str, Any]) -> bool:
                blob = f"{it.get('title', '')} {it.get('summary', '')}".lower()
                return any(t in blob for t in tokens)

            filtered = [it for it in items if matches(it)]
            if filtered:
                items = filtered

    if limit is not None:
        items = items[: max(0, int(limit))]

    ok = sum(1 for f in feed_results if f["status"] == "ok")
    out: dict[str, Any] = {
        "feeds": sorted(feed_results, key=lambda f: f["id"]),
        "feeds_ok": ok,
        "feeds_total": len(feeds),
        "items": items,
        "count": len(items),
        "cached": cached,
    }
    if cached:
        out["cache_age_s"] = round(cache_age, 1)
    return out
