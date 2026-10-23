"""Trend Atlas server configuration.

RSS feeds below were validated live (HTTP 200 + XML). Soft-fail any feed that
later dies — see rss.fetch_all_feeds().

Loads optional server/.env (and parent .env) via python-dotenv when installed.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    _here = Path(__file__).resolve().parent
    load_dotenv(_here / ".env")
    load_dotenv(_here.parent / ".env")
except ImportError:
    pass

# Working English fashion / style press RSS (validated 2026-10-20).
# Skipped: Who What Wear (timeout), Fashion United / The Cut (404).
RSS_FEEDS: list[dict[str, str]] = [
    {"id": "vogue", "name": "Vogue", "url": "https://www.vogue.com/feed/rss"},
    {
        "id": "bof",
        "name": "Business of Fashion",
        "url": "https://www.businessoffashion.com/feed/",
    },
    {
        "id": "fashionista",
        "name": "Fashionista",
        "url": "https://www.fashionista.com/.rss/full/",
    },
    {
        "id": "harpersbazaar",
        "name": "Harper's Bazaar",
        "url": "https://www.harpersbazaar.com/rss/all.xml/",
    },
    {"id": "wwd", "name": "WWD", "url": "https://wwd.com/feed/"},
    {"id": "elle", "name": "Elle", "url": "https://www.elle.com/rss/all.xml/"},
    {
        "id": "i-d",
        "name": "i-D",
        "url": "https://i-d.co/category/fashion/feed",
    },
    {
        "id": "dazed",
        "name": "Dazed",
        "url": "https://www.dazeddigital.com/rss",
    },
    {
        "id": "another",
        "name": "AnOther",
        "url": "https://www.anothermag.com/feed",
    },
    {
        "id": "interview",
        "name": "Interview",
        "url": "https://www.interviewmagazine.com/feed",
    },
    {
        "id": "purple",
        "name": "Purple",
        "url": "https://purple.fr/feed/",
    },
    {
        "id": "wonderland",
        "name": "Wonderland",
        "url": "https://www.wonderlandmagazine.com/feed/",
    },
    {
        "id": "crfashionbook",
        "name": "CR Fashion Book",
        "url": "https://www.crfashionbook.com/feed/",
    },
    {
        "id": "numero",
        "name": "Numéro",
        "url": "https://www.numero.com/feed",
    },
    {
        "id": "teenvogue",
        "name": "Teen Vogue",
        "url": "https://www.teenvogue.com/feed/rss",
    },
    {
        "id": "gq",
        "name": "GQ",
        "url": "https://www.gq.com/feed/rss",
    },
    {
        "id": "esquire",
        "name": "Esquire",
        "url": "https://www.esquire.com/rss/all.xml/",
    },
    {
        "id": "footwearnews",
        "name": "Footwear News",
        "url": "https://footwearnews.com/feed/",
    },
    {
        "id": "guardian-fashion",
        "name": "Guardian Fashion",
        "url": "https://www.theguardian.com/fashion/rss",
    },
    {
        "id": "nyt-fashion",
        "name": "NYT Fashion",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/FashionandStyle.xml",
    },
]

# Optional extras (also validated); kept out of the default set to keep latency down.
RSS_FEEDS_OPTIONAL: list[dict[str, str]] = [
    {
        "id": "highsnobiety",
        "name": "Highsnobiety",
        "url": "https://www.highsnobiety.com/feed/",
    },
    {"id": "hypebeast", "name": "Hypebeast", "url": "https://hypebeast.com/feed"},
    {
        "id": "refinery29",
        "name": "Refinery29 Fashion",
        "url": "https://www.refinery29.com/en-us/fashion/rss.xml",
    },
    {
        "id": "i-d-magazine",
        "name": "i-D Magazine",
        "url": "https://i-d.co/category/magazine/feed",
    },
]

# Seconds per feed fetch.
RSS_TIMEOUT = float(os.environ.get("RSS_TIMEOUT", "5"))
RSS_CACHE_TTL = float(os.environ.get("RSS_CACHE_TTL", "180"))
RSS_MAX_WORKERS = int(os.environ.get("RSS_MAX_WORKERS", "16"))

# Max items returned from /api/rss and per-source cap for search.
RSS_LIMIT_DEFAULT = int(os.environ.get("RSS_LIMIT", "40"))
RSS_PER_FEED_CAP = int(os.environ.get("RSS_PER_FEED_CAP", "12"))

# Web search — Tavily and/or Exa when keys are set; merge+dedupe by URL.
EXA_API_KEY = os.environ.get("EXA_API_KEY", "").strip()
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "").strip()

# Commerce placeholders
SHOPIFY_STORE_DOMAIN = os.environ.get("SHOPIFY_STORE_DOMAIN", "").strip()
SHOPIFY_STOREFRONT_TOKEN = os.environ.get("SHOPIFY_STOREFRONT_TOKEN", "").strip()
AMAZON_PAAPI_ACCESS_KEY = os.environ.get("AMAZON_PAAPI_ACCESS_KEY", "").strip()
AMAZON_PAAPI_SECRET_KEY = os.environ.get("AMAZON_PAAPI_SECRET_KEY", "").strip()
AMAZON_PAAPI_PARTNER_TAG = os.environ.get("AMAZON_PAAPI_PARTNER_TAG", "").strip()

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8787"))

# Serve the static UI from the parent directory when True.
SERVE_STATIC = os.environ.get("SERVE_STATIC", "1").strip() not in ("0", "false", "False")
