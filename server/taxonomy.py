"""TREND ATLAS multi-dimensional fashion taxonomy (5 layers).

Each node: id, en, zh, layer, parent_id?, synonyms[]
Layers: category | style | silhouette | fabric | colour
"""

from __future__ import annotations

from typing import Any


def _n(
    id_: str,
    en: str,
    zh: str,
    layer: str,
    parent_id: str | None = None,
    synonyms: list[str] | None = None,
) -> dict[str, Any]:
    node: dict[str, Any] = {
        "id": id_,
        "en": en,
        "zh": zh,
        "layer": layer,
        "synonyms": list(synonyms or []),
    }
    if parent_id:
        node["parent_id"] = parent_id
    return node


# --- 1. Category -------------------------------------------------
CATEGORY_NODES: list[dict[str, Any]] = [
    _n("tops", "Tops", "上衣", "category", synonyms=["top", "上衣"]),
    _n("shirts-blouses", "Shirts & Blouses", "衬衫与罩衫", "category", synonyms=["shirt", "blouse", "shirts", "blouses", "衬衫", "罩衫"]),
    _n("knitwear", "Knitwear", "针织", "category", synonyms=["knit", "sweater", "cardigan", "针织", "毛衫"]),
    _n("jackets", "Jackets", "夹克", "category", synonyms=["jacket", "夹克", "外套"]),
    _n("jackets-leather", "Leather", "皮革夹克", "category", parent_id="jackets", synonyms=["leather jacket", "皮夹克"]),
    _n("jackets-bomber", "Bomber", "飞行夹克", "category", parent_id="jackets", synonyms=["bomber jacket", "飞行夹克"]),
    _n("jackets-biker", "Biker", "机车夹克", "category", parent_id="jackets", synonyms=["biker jacket", "moto jacket", "机车夹克"]),
    _n("coats", "Coats", "大衣", "category", synonyms=["coat", "overcoat", "大衣", "风衣"]),
    _n("trousers", "Trousers", "裤装", "category", synonyms=["pants", "trouser", "裤", "裤子"]),
    _n("skirts", "Skirts", "裙装", "category", synonyms=["skirt", "裙", "半身裙"]),
    _n("dresses", "Dresses", "连衣裙", "category", synonyms=["dress", "gown", "连衣裙", "礼服"]),
    _n("denim", "Denim", "牛仔", "category", synonyms=["jeans", "牛仔", "丹宁"]),
    _n("tailoring", "Tailoring", "正装裁剪", "category", synonyms=["tailored", "suit", "blazer", "西装", "定制"]),
    _n("sportswear", "Sportswear", "运动装", "category", synonyms=["athleisure", "activewear", "运动装", "运动服"]),
    _n("swimwear", "Swimwear", "泳装", "category", synonyms=["swimsuit", "bikini", "泳装", "泳裤"]),
    _n("resortwear", "Resortwear", "度假装", "category", synonyms=["resort", "vacation wear", "度假装"]),
    _n("accessories", "Accessories", "配饰", "category", synonyms=["accessory", "bag", "belt", "配饰", "配件"]),
    # Market / gender facet used in parse (not a garment leaf, still category layer)
    _n("womenswear", "Womenswear", "女装", "category", synonyms=["women", "womens", "women's", "female", "女装"]),
    _n("menswear", "Menswear", "男装", "category", synonyms=["men", "mens", "men's", "male", "男装"]),
]

# --- 2. Style (multi-label) --------------------------------------
STYLE_NODES: list[dict[str, Any]] = [
    _n("minimalism", "Minimalism", "极简主义", "style", synonyms=["minimal", "minimalist", "极简"]),
    _n("avant-garde", "Avant-garde", "前卫", "style", synonyms=["avant garde", "avantgarde", "experimental fashion", "前卫"]),
    _n("futurism", "Futurism", "未来主义", "style", synonyms=["futuristic", "future", "未来主义", "未来感"]),
    _n("romanticism", "Romanticism", "浪漫主义", "style", synonyms=["romantic", "romance", "浪漫"]),
    _n("deconstruction", "Deconstruction", "解构", "style", synonyms=["deconstructed", "解构"]),
    _n("techwear", "Techwear", "机能科技", "style", synonyms=["tech wear", "technical wear", "机能"]),
    _n("gorpcore", "Gorpcore", "户外机能", "style", synonyms=["gorp", "outdoor core", "户外风"]),
    _n("streetwear", "Streetwear", "街头", "style", synonyms=["street", "street style", "街头"]),
    _n("quiet-luxury", "Quiet Luxury", "静奢", "style", synonyms=["quietluxury", "stealth wealth", "静奢", "老钱风"]),
    _n("y2k", "Y2K", "Y2K", "style", synonyms=["y2k fashion", "2000s", "千禧"]),
    _n("sculptural-fashion", "Sculptural Fashion", "雕塑感时装", "style", synonyms=["sculptural", "sculpture", "雕塑感"]),
]

# --- 3. Silhouette & Structure (grouped) -------------------------
# Group parents (zh group labels) + English tags as children
SILHOUETTE_GROUPS: list[tuple[str, str, str, list[tuple[str, str, str, list[str]]]]] = [
    (
        "volume",
        "Volume",
        "体积",
        [
            ("oversized", "Oversized", "宽松加大", ["oversize", "oversized silhouette", "加大"]),
            ("voluminous", "Voluminous", "体积感", ["volume", "volumetric", "体积感"]),
            ("balloon", "Balloon", "气球廓形", ["balloon shape", "气球"]),
            ("cocoon", "Cocoon", "茧型", ["cocoon shape", "茧型"]),
            ("inflated", "Inflated", "充气感", ["puffy", "inflated volume", "充气"]),
        ],
    ),
    (
        "contour",
        "Contour",
        "轮廓",
        [
            ("a-line", "A-line", "A字", ["aline", "a line", "A字"]),
            ("column", "Column", "直筒", ["columnar", "sheath", "直筒"]),
            ("hourglass", "Hourglass", "沙漏", ["hour glass", "沙漏"]),
            ("boxy", "Boxy", "箱型", ["boxy fit", "箱型"]),
            ("slim-fit", "Slim Fit", "修身", ["slim", "fitted", "修身"]),
            ("trapeze", "Trapeze", "梯形", ["trapeze shape", "梯形"]),
            ("barrel", "Barrel", "桶型", ["barrel leg", "桶型"]),
            ("flare", "Flare", "喇叭", ["flared", "喇叭"]),
        ],
    ),
    (
        "structure",
        "Structure",
        "结构",
        [
            ("structured", "Structured", "结构化", ["structure", "structured silhouette", "结构化"]),
            ("soft-structure", "Soft Structure", "软结构", ["soft structured", "软结构"]),
            ("tailored-cut", "Tailored", "精裁", ["tailored silhouette", "精裁"]),
            ("unstructured", "Unstructured", "非结构化", ["unstructured silhouette", "非结构化"]),
            ("architectural", "Architectural", "建筑感", ["architecture", "建筑感"]),
        ],
    ),
    (
        "asymmetry",
        "Asymmetry",
        "不对称",
        [
            ("asymmetric-hem", "Asymmetric Hem", "不对称下摆", ["asym hem", "asymmetric hemline", "不对称下摆"]),
            ("asymmetric-neckline", "Asymmetric Neckline", "不对称领口", ["asym neckline", "不对称领"]),
            ("diagonal-seam", "Diagonal Seam", "斜向分割", ["diagonal cut", "斜裁分割"]),
            ("one-shoulder", "One-shoulder", "单肩", ["one shoulder", "单肩"]),
            ("off-centre", "Off-centre Closure", "偏襟", ["off-center", "off centre", "偏襟"]),
        ],
    ),
    (
        "dimensional",
        "Dimensional Structure",
        "立体结构",
        [
            ("sculptural-form", "Sculptural Form", "雕塑形", ["sculptural silhouette", "雕塑形"]),
            ("3d-form", "3D Form", "三维造型", ["3d structure", "三维"]),
            ("molded", "Molded", "模压成型", ["moulded", "molded shape", "模压"]),
            ("relief", "Relief", "浮雕结构", ["relief structure", "浮雕"]),
            ("dimensional-knit", "Dimensional Knit", "立体针织", ["3d knit", "立体针织"]),
        ],
    ),
    (
        "layering",
        "Layering",
        "层次",
        [
            ("layering", "Layering", "层叠", ["layered", "layers", "层叠", "层次"]),
            ("sheer-overlay", "Sheer Overlay", "薄纱叠层", ["sheer layer", "薄纱层"]),
            ("multi-layer", "Multi-layer", "多层", ["multilayer", "多层"]),
            ("nested-layers", "Nested Layers", "嵌套层次", ["nested", "嵌套"]),
            ("transparent-layering", "Transparent Layering", "透明层叠", ["see-through layering", "透明层叠"]),
        ],
    ),
    (
        "structural-details",
        "Structural Details",
        "结构细节",
        [
            ("exposed-seams", "Exposed Seams", "明线接缝", ["exposed seam", "明线"]),
            ("darts", "Darts", "省道", ["dart", "省道"]),
            ("pleats", "Pleats", "褶裥", ["pleat", "褶"]),
            ("panels", "Panels", "拼片", ["panel", "panelled", "拼片"]),
            ("cutouts", "Cutouts", "挖空", ["cutout", "cut-out", "挖空"]),
            ("godets", "Godets", "插片", ["godet", "插片"]),
            ("princess-seams", "Princess Seams", "公主线", ["princess seam", "公主线"]),
        ],
    ),
]

SILHOUETTE_NODES: list[dict[str, Any]] = []
for gid, gen, gzh, children in SILHOUETTE_GROUPS:
    SILHOUETTE_NODES.append(_n(f"sil-{gid}", gen, gzh, "silhouette", synonyms=[gzh, gen.lower()]))
    for cid, cen, czh, syns in children:
        SILHOUETTE_NODES.append(
            _n(cid, cen, czh, "silhouette", parent_id=f"sil-{gid}", synonyms=syns)
        )

# --- 4. Fabric & Surface -----------------------------------------
FABRIC_NODES: list[dict[str, Any]] = [
    _n("knit", "Knit", "针织面料", "fabric", synonyms=["knitted", "jersey", "针织面料"]),
    _n("woven", "Woven", "梭织", "fabric", synonyms=["weaving", "梭织"]),
    _n("leather", "Leather", "皮革", "fabric", synonyms=["hide", "皮革", "真皮"]),
    _n("denim-fabric", "Denim", "牛仔面料", "fabric", synonyms=["jean fabric", "牛仔面料"]),
    _n("sheer", "Sheer", "透视薄纱", "fabric", synonyms=["sheer fabric", "透明", "薄纱"]),
    _n("technical", "Technical", "技术面料", "fabric", synonyms=["tech fabric", "performance fabric", "技术面料", "机能面料"]),
    _n("recycled", "Recycled", "再生材料", "fabric", synonyms=["upcycled", "reclaimed", "再生", "回收材料"]),
    _n("experimental", "Experimental", "实验性材料", "fabric", synonyms=["experimental textiles", "experimental textile", "experimental surface", "experimental surfaces", "experimental surface textures", "surface textures", "实验性", "实验面料"]),
    _n("embroidery", "Embroidery", "刺绣", "fabric", synonyms=["embroidered", "刺绣"]),
    _n("heat-transfer", "Heat Transfer", "热转印", "fabric", synonyms=["heat transfer print", "热转印"]),
    _n("pleating", "Pleating", "褶裥工艺", "fabric", synonyms=["pleated surface", "褶裥工艺"]),
    _n("distressing", "Distressing", "做旧", "fabric", synonyms=["distressed", "washed out", "做旧"]),
    _n("surface-manipulation", "Surface Manipulation", "表面处理", "fabric", synonyms=["surface texture", "surface textures", "textured surface", "表面肌理", "表面处理"]),
]

# --- 5. Colour & Pattern (filterable facet tags) -----------------
COLOUR_NODES: list[dict[str, Any]] = [
    # Primary colours
    _n("primary-black", "Black", "黑", "colour", synonyms=["primary black", "noir", "黑"]),
    _n("primary-white", "White", "白", "colour", synonyms=["primary white", "ivory white", "白"]),
    _n("primary-navy", "Navy", "海军蓝", "colour", synonyms=["navy blue", "海军蓝"]),
    _n("primary-beige", "Beige", "米色", "colour", synonyms=["cream", "sand", "米色", "卡其米色"]),
    _n("primary-brown", "Brown", "棕", "colour", synonyms=["chocolate", "咖啡棕", "棕"]),
    _n("primary-red", "Red", "红", "colour", synonyms=["crimson", "scarlet", "红"]),
    # Secondary
    _n("secondary-olive", "Olive", "橄榄", "colour", synonyms=["olive green", "橄榄绿"]),
    _n("secondary-burgundy", "Burgundy", "酒红", "colour", synonyms=["oxblood", "酒红"]),
    _n("secondary-butter", "Butter", "黄油色", "colour", synonyms=["butter yellow", "黄油色"]),
    _n("secondary-rust", "Rust", "锈色", "colour", synonyms=["rust orange", "锈色"]),
    _n("secondary-silver", "Silver", "银", "colour", synonyms=["metallic silver", "银色"]),
    # Colour combos
    _n("combo-monochrome", "Monochrome", "单色组合", "colour", synonyms=["mono", "tonal", "单色"]),
    _n("combo-contrast", "High Contrast", "高对比", "colour", synonyms=["contrast colour", "高对比"]),
    _n("combo-earth", "Earth Tones", "大地色系", "colour", synonyms=["earthtone", "earth tone", "大地色"]),
    _n("combo-pastel", "Pastel Mix", "粉彩色系", "colour", synonyms=["pastels", "粉彩"]),
    # Print types
    _n("print-floral", "Floral Print", "花卉印花", "colour", synonyms=["floral", "flower print", "碎花"]),
    _n("print-animal", "Animal Print", "动物纹", "colour", synonyms=["leopard", "zebra", "animal", "豹纹"]),
    _n("print-abstract", "Abstract Print", "抽象印花", "colour", synonyms=["abstract", "抽象印花"]),
    _n("print-logo", "Logo Print", "Logo印花", "colour", synonyms=["logo", "branding print"]),
    # Geometric / organic / gradient
    _n("geometric", "Geometric", "几何", "colour", synonyms=["geo print", "几何纹", "几何"]),
    _n("organic-pattern", "Organic Pattern", "有机纹样", "colour", synonyms=["organic", "organic print", "有机纹"]),
    _n("gradient", "Gradient", "渐变", "colour", synonyms=["ombre", "colour gradient", "渐变"]),
    # Sheer / reflective
    _n("sheer-effect", "Sheer / Translucent", "透视效果", "colour", synonyms=["translucent", "see-through", "透视"]),
    _n("reflective", "Reflective", "反光", "colour", synonyms=["iridescent", "shiny reflective", "反光", "镭射"]),
    # Texture (as colour-pattern facet)
    _n("texture-matte", "Matte Texture", "哑光质感", "colour", synonyms=["matte", "哑光"]),
    _n("texture-gloss", "Gloss Texture", "光泽质感", "colour", synonyms=["glossy", "shine", "光泽"]),
    _n("texture-grain", "Grain Texture", "颗粒肌理", "colour", synonyms=["grained", "grainy", "颗粒"]),
]

LAYERS_ORDER = ["category", "style", "silhouette", "fabric", "colour"]

LAYER_META = {
    "category": {"en": "Category", "zh": "品类"},
    "style": {"en": "Style", "zh": "风格"},
    "silhouette": {"en": "Silhouette & Structure", "zh": "廓形与结构"},
    "fabric": {"en": "Fabric & Surface", "zh": "面料与表面"},
    "colour": {"en": "Colour & Pattern", "zh": "色彩与图案"},
}


def all_nodes() -> list[dict[str, Any]]:
    return (
        list(CATEGORY_NODES)
        + list(STYLE_NODES)
        + list(SILHOUETTE_NODES)
        + list(FABRIC_NODES)
        + list(COLOUR_NODES)
    )


def get_taxonomy_tree() -> dict[str, Any]:
    nodes = all_nodes()
    by_layer: dict[str, list[dict[str, Any]]] = {k: [] for k in LAYERS_ORDER}
    for n in nodes:
        layer = n["layer"]
        if layer in by_layer:
            by_layer[layer].append(n)
    layers = []
    for key in LAYERS_ORDER:
        meta = LAYER_META[key]
        layers.append(
            {
                "id": key,
                "en": meta["en"],
                "zh": meta["zh"],
                "nodes": by_layer[key],
            }
        )
    return {
        "version": "taxonomy1",
        "layers": layers,
        "nodes": nodes,
        "layer_count": len(layers),
    }


def build_match_index() -> list[dict[str, Any]]:
    """Flatten nodes into matchable phrases (longest-first friendly)."""
    entries: list[dict[str, Any]] = []
    for n in all_nodes():
        phrases = {n["en"].lower(), n["id"].replace("-", " ").lower(), n["zh"].lower()}
        for s in n.get("synonyms") or []:
            phrases.add(str(s).lower())
        for p in phrases:
            p = p.strip()
            if not p:
                continue
            entries.append(
                {
                    "phrase": p,
                    "id": n["id"],
                    "en": n["en"],
                    "zh": n["zh"],
                    "layer": n["layer"],
                    "parent_id": n.get("parent_id"),
                }
            )
    # Longer phrases first for greedy matching
    entries.sort(key=lambda e: len(e["phrase"]), reverse=True)
    return entries
