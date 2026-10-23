"""Ecommerce search stub.

Honest empty/demo response until merchant credentials exist.
Viable public/affiliate options are documented in the project README.
"""

from __future__ import annotations

from typing import Any

from config import (
    AMAZON_PAAPI_ACCESS_KEY,
    AMAZON_PAAPI_PARTNER_TAG,
    AMAZON_PAAPI_SECRET_KEY,
    SHOPIFY_STORE_DOMAIN,
    SHOPIFY_STOREFRONT_TOKEN,
)


def search_commerce(q: str, limit: int = 12) -> dict[str, Any]:
    shopify_ready = bool(SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN)
    amazon_ready = bool(
        AMAZON_PAAPI_ACCESS_KEY
        and AMAZON_PAAPI_SECRET_KEY
        and AMAZON_PAAPI_PARTNER_TAG
    )

    providers: list[dict[str, Any]] = [
        {
            "provider": "shopify_storefront",
            "status": "ready" if shopify_ready else "needs_credentials",
            "message": (
                "Shopify Storefront API credentials present; implement GraphQL product search."
                if shopify_ready
                else "Set SHOPIFY_STORE_DOMAIN + SHOPIFY_STOREFRONT_TOKEN for a merchant catalog."
            ),
        },
        {
            "provider": "amazon_paapi",
            "status": "ready" if amazon_ready else "needs_credentials",
            "message": (
                "Amazon PA-API credentials present; implement ItemSearch."
                if amazon_ready
                else "Amazon Product Advertising API requires ACCESS_KEY, SECRET_KEY, PARTNER_TAG."
            ),
        },
        {
            "provider": "demo",
            "status": "disabled",
            "message": "No fake products — prefer honesty over invented SKUs.",
        },
    ]

    overall = "ready" if (shopify_ready or amazon_ready) else "needs_credentials"

    return {
        "status": overall,
        "query": q,
        "limit": limit,
        "products": [],
        "providers": providers,
        "note": (
            "No product results until a commerce provider is configured. "
            "See README § Ecommerce for API options."
        ),
    }
