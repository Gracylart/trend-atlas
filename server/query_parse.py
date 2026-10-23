"""Structured query parsing against TREND ATLAS taxonomy.

Maps free text → facet buckets + expanded_query for Tavily/Exa/RSS.
Does not invent brands; synonym matching is case-insensitive.
"""

from __future__ import annotations

import re
from typing import Any

from taxonomy import build_match_index

# Layer → output field mapping for the parse payload
_LAYER_TO_FIELD = {
    "category": "category",
    "style": "style",
    "silhouette": "silhouette",
    "fabric": "material_focus",
    "colour": "colour",
}

# Phrases that signal design_features (surface / texture language)
_DESIGN_FEATURE_HINTS = (
    "experimental surface textures",
    "experimental surface texture",
    "surface textures",
    "surface texture",
    "surface manipulation",
    "design detail",
    "design details",
    "design feature",
    "design features",
)

_MATCH_INDEX: list[dict[str, Any]] | None = None


def _index() -> list[dict[str, Any]]:
    global _MATCH_INDEX
    if _MATCH_INDEX is None:
        _MATCH_INDEX = build_match_index()
    return _MATCH_INDEX


def _token_boundary_ok(text: str, start: int, end: int) -> bool:
    """Avoid matching mid-word for ASCII alphanumerics."""
    if start > 0:
        prev = text[start - 1]
        if prev.isalnum() or prev == "_":
            # Allow if phrase or prev is CJK
            if prev.isascii() and (text[start].isascii() if start < len(text) else True):
                return False
    if end < len(text):
        nxt = text[end]
        if nxt.isalnum() or nxt == "_":
            if nxt.isascii() and (text[end - 1].isascii() if end else True):
                return False
    return True


def parse_query(q: str) -> dict[str, Any]:
    raw = (q or "").strip()
    lower = raw.lower()
    occupied = [False] * len(lower)

    category: list[str] = []
    style: list[str] = []
    silhouette: list[str] = []
    material_focus: list[str] = []
    colour: list[str] = []
    design_features: list[str] = []
    matched_labels: list[str] = []  # English labels for expanded_query

    def _claim(start: int, end: int) -> bool:
        if any(occupied[start:end]):
            return False
        for i in range(start, end):
            occupied[i] = True
        return True

    # 1) Explicit design-feature multiword phrases first
    for hint in sorted(_DESIGN_FEATURE_HINTS, key=len, reverse=True):
        pos = 0
        while True:
            idx = lower.find(hint, pos)
            if idx < 0:
                break
            end = idx + len(hint)
            if _token_boundary_ok(lower, idx, end) and _claim(idx, end):
                if hint not in design_features:
                    design_features.append(hint)
                matched_labels.append(hint)
            pos = idx + 1

    # 2) Taxonomy synonym match (longest phrase first)
    for entry in _index():
        phrase = entry["phrase"]
        if len(phrase) < 2 and phrase.isascii():
            # skip ultra-short ASCII (e.g. stray letters); keep CJK singles
            if phrase.isascii():
                continue
        pos = 0
        while True:
            idx = lower.find(phrase, pos)
            if idx < 0:
                break
            end = idx + len(phrase)
            if _token_boundary_ok(lower, idx, end) and _claim(idx, end):
                field = _LAYER_TO_FIELD.get(entry["layer"])
                slug = entry["id"]
                # Prefer stable semantic slug without group prefixes for silhouette children
                label = entry["en"].lower()
                if field == "category":
                    # Use readable id/slug: womenswear, jackets, etc.
                    val = slug
                    if val.startswith("jackets-"):
                        val = slug  # keep jackets-leather etc.
                    if val not in category:
                        category.append(val)
                elif field == "style":
                    val = slug
                    if val not in style:
                        style.append(val)
                elif field == "silhouette":
                    # Skip pure group parents (sil-*)
                    if not slug.startswith("sil-"):
                        if label not in silhouette:
                            silhouette.append(label)
                elif field == "material_focus":
                    # Map experimental → experimental textiles for API contract
                    if slug == "experimental":
                        val = "experimental textiles"
                    elif slug == "surface-manipulation":
                        val = "surface manipulation"
                    else:
                        val = label
                    if val not in material_focus:
                        material_focus.append(val)
                elif field == "colour":
                    if label not in colour:
                        colour.append(label)
                if entry["en"] not in matched_labels and label not in matched_labels:
                    matched_labels.append(entry["en"])
            pos = idx + 1

    # Leftover tokens for expanded search
    leftover_chars = []
    for i, ch in enumerate(raw):
        if i < len(occupied) and occupied[i]:
            leftover_chars.append(" ")
        else:
            leftover_chars.append(ch)
    leftover = re.sub(r"\s+", " ", "".join(leftover_chars)).strip()
    # Drop stopwords from leftover
    stop = {
        "with", "and", "or", "the", "a", "an", "of", "for", "in", "on", "to",
        "by", "from", "into", "over", "under", "vs", "versus",
    }
    leftover_tokens = [t for t in re.split(r"\s+", leftover) if t and t.lower() not in stop]

    # Build expanded_query: matched facets + leftover meaningful tokens
    expand_parts: list[str] = []
    for lab in matched_labels:
        if lab not in expand_parts:
            expand_parts.append(lab)
    for t in leftover_tokens:
        if t.lower() not in {p.lower() for p in expand_parts}:
            expand_parts.append(t)
    # Ensure material phrasing for experimental surfaces
    if any("experimental" in d for d in design_features) or any(
        "experimental" in m for m in material_focus
    ):
        if "experimental textiles" not in material_focus and any(
            "surface" in d for d in design_features
        ):
            material_focus.append("experimental textiles")
        if "Experimental" not in expand_parts and "experimental textiles" not in {
            p.lower() for p in expand_parts
        }:
            expand_parts.append("experimental textiles")

    expanded_query = " ".join(expand_parts).strip() or raw

    # Normalize style ids to kebab for API (avant-garde already)
    # Sample contract uses "avant-garde" and category "womenswear"
    category_out = []
    for c in category:
        # expose parent-friendly names
        if c == "womenswear":
            category_out.append("womenswear")
        elif c == "menswear":
            category_out.append("menswear")
        else:
            category_out.append(c.replace("_", "-"))

    style_out = [s.replace("_", "-") for s in style]

    return {
        "category": category_out,
        "style": style_out,
        "design_features": design_features,
        "material_focus": material_focus,
        "silhouette": silhouette,
        "colour": colour,
        "search_mode": "visual_and_textual",
        "raw_query": raw,
        "expanded_query": expanded_query,
        "matched": matched_labels,
        "leftover_tokens": leftover_tokens,
    }
