/* ============================================================
   TREND ATLAS — Demo interactive prototype
   Demo animations + live RSS/web via /api/search + taxonomy facets / parse
   Imagery: ranked live Tavily/Exa/RSS images; picsum only if zero live
   ============================================================ */

(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Demo data ------------------------------------------------
  const SCAN_TAGS = [
    "Silhouette", "Drape", "Volume", "Sheer", "Tailoring",
    "Texture", "Raw Hem", "Layering", "Belted", "Asymmetric",
    "Knit", "Satin", "Denim", "Wool", "Cotton",
    "Rust", "Chalk", "Ink", "Olive", "Bone",
  ];

  const ARCHIVE_TITLES = [
    "Volumetric Coat", "Soft Shoulder", "Sheer Panel", "Belted Wrap",
    "Raw-Edge Jacket", "Liquid Satin", "Archival Denim", "Fluid Trouser",
    "Column Dress", "Cropped Tailoring", "Oversized Knit", "Bias Slip",
    "Structured Tote", "Oxidized Rust", "Chalk Linen", "Ink Organza",
    "Deconstructed Blazer", "Floating Sleeve", "Gathered Waist", "Matte Jersey",
  ];

  const DETAIL_TAGS = ["#Oversize", "#SoftTailoring", "#SheerLayering", "#RawEdge", "#EarthTone", "#Volume"];

  const REPORT_COPY = {
    "SS27 Womenswear": {
      dek: "春夏女装的流行方向",
      summary:
        "SS27 女装以轻量层叠、软化肩线与流体裙装为核心。廓形在宽松与贴体之间摆动，面料强调透气与微光泽，色彩以冷调中性色托底、荧光点缀为情绪锚点。",
      season: "SS27",
      focus: "WOMENSWEAR",
    },
    "Women's Leather Jacket": {
      dek: "女式皮夹克的款式与细节",
      summary:
        "女式皮夹克聚焦修身与 boxy 两种体量，拉链、肩章与不对称门襟成为辨识细节。皮革处理从哑光磨砂到半漆面，配色以黑、深咖与黄油色主导。",
      season: "AW26",
      focus: "CATEGORY",
    },
    "Innovative Knitwear": {
      dek: "创新针织面料与结构",
      summary:
        "创新针织以变针距、镂空与立体成型突破传统毛衫语言。透气网眼与密实罗纹并置，结构向建筑感模块推进，适合跨季层搭。",
      season: "SS27",
      focus: "KNITWEAR",
    },
    "Asymmetric Hemline": {
      dek: "不对称下摆的设计案例",
      summary:
        "不对称下摆通过斜裁、叠片与长短拼缝打破水平线。裙装与连衣裙中尤为常见，运动感垂坠与时装剪影并存，成为本季高频设计细节。",
      season: "SS27",
      focus: "DETAIL",
    },
    "Futuristic Minimalism": {
      dek: "未来主义极简风格",
      summary:
        "未来主义极简以干净立面、精密线迹与科技感面料说话。去装饰、强比例，银白与石墨色主导，轮廓接近雕塑而非装饰性层叠。",
      season: "SS27",
      focus: "STYLE",
    },
    "SS27 Colour Trends": {
      dek: "相关色彩及其应用",
      summary:
        "SS27 色彩趋势围绕冰感蓝、黄油米、酸性点缀与深墨底展开。大面积中性色承载廓形，高饱和点缀出现在配饰与内层，形成可商用的配色系统。",
      season: "SS27",
      focus: "COLOUR",
    },
    "Acne Studios SS27": {
      dek: "品牌系列与设计语言",
      summary:
        "Acne Studios SS27 延续斯堪的纳维亚克制与意外比例的张力。宽松剪裁、锐利色块与标志性靴型共同构成可识别的品牌设计语言。",
      season: "SS27",
      focus: "BRAND",
    },
    "Trending Women's Trousers": {
      dek: "女裤市场中的相关款式",
      summary:
        "女裤市场热点集中在阔腿、桶型与修身烟管三类。高腰、压褶与微喇回潮并行，面料以轻薄斜纹与弹力绉为主，适合日常与通勤双场景。",
      season: "SS27",
      focus: "MARKET",
    },
    "Experimental Textiles": {
      dek: "实验性纺织材料",
      summary:
        "实验性纺织材料探索涂层、生物基纤维与非常规混纺。表面从液态光泽到干燥褶皱，材料本身成为设计主角，推动成衣与秀场的材质叙事。",
      season: "SS27",
      focus: "MATERIAL",
    },
    "Gen Z Fashion Trends": {
      dek: "年轻消费群体的时尚倾向",
      summary:
        "Gen Z 时尚倾向混合复古档案、Y2K 回潮与可持续二手。个人化混搭高于单品完整体，社交媒体驱动的微趋势周期缩短，强调表达胜过品牌忠诚。",
      season: "SS27",
      focus: "CONSUMER",
    },
  };

  const CLUSTER_LAYOUT = {
    silhouette: { cx: -28, cy: -18 },
    material: { cx: 28, cy: -16 },
    structure: { cx: -24, cy: 22 },
    colour: { cx: 30, cy: 20 },
  };

  const CLUSTER_KEYS = ["silhouette", "material", "structure", "colour"];

  // --- Optional live API (same-origin or localhost:8787) -------
  const API_CANDIDATES = [
    "", // same origin when served by Flask
    "http://127.0.0.1:8787",
    "http://localhost:8787",
  ];
  let apiBase = null; // null = unreachable; string = base URL ("" = same origin)
  let lastSearchPayload = null;
  /** Queries already retried once in ensureLiveImages (avoid double /api/search). */
  const liveImageRetryDone = new Set();
  /** In-flight / last pipeline search; used for late hot-swap if phases already showing. */
  let activeSearchPromise = null;
  /** Resolves when detectApi() finishes (ok or unreachable). Await before fetch. */
  let apiReady = null;

  // --- Taxonomy / structured parse --------------------------------
  let taxonomyData = null;
  let lastParse = null;
  const selectedFacets = new Map(); // id -> node

  const LAYER_FIELD = {
    category: "category",
    style: "style",
    silhouette: "silhouette",
    fabric: "material_focus",
    colour: "colour",
  };


  async function detectApi() {
    for (const base of API_CANDIDATES) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1800);
        const res = await fetch(`${base}/api/health`, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok) {
            apiBase = base;
            const badge = document.getElementById("apiBadge");
            if (badge) {
              badge.textContent = "LIVE RSS";
              badge.classList.add("is-live");
            }
            const foot = document.getElementById("landingFootNote");
            if (foot) {
              foot.textContent =
                "演示动画 + 实时时尚媒体 RSS · 扫描/3D/报告优先实况图 · picsum 仅作回退";
            }
            return true;
          }
        }
      } catch (_) {
        /* try next */
      }
    }
    apiBase = null;
    return false;
  }

  async function fetchSearch(query) {
    if (apiReady) {
      try {
        await apiReady;
      } catch (_) {
        /* detect failed — apiBase stays null */
      }
    }
    if (apiBase === null) return null;
    try {
      const url = `${apiBase}/api/search?q=${encodeURIComponent(query)}&limit=24`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  async function fetchTaxonomy() {
    if (apiBase === null) return null;
    try {
      const res = await fetch(`${apiBase}/api/taxonomy`);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  async function fetchParse(query) {
    if (apiBase === null) return null;
    try {
      const res = await fetch(`${apiBase}/api/parse?q=${encodeURIComponent(query)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  function composedFacetQuery() {
    const parts = [];
    selectedFacets.forEach((node) => {
      if (node && node.en) parts.push(node.en);
    });
    return parts.join(" ");
  }

  function updateFacetPreview() {
    const preview = document.getElementById("facetQueryPreview");
    const clearBtn = document.getElementById("facetClear");
    const searchBtn = document.getElementById("facetSearchBtn");
    const q = composedFacetQuery();
    if (preview) {
      if (q) {
        preview.hidden = false;
        preview.textContent = "组合查询 · " + q;
      } else {
        preview.hidden = true;
        preview.textContent = "";
      }
    }
    if (clearBtn) clearBtn.hidden = !selectedFacets.size;
    if (searchBtn) searchBtn.hidden = !selectedFacets.size;
  }

  function toggleFacet(node, chipEl) {
    if (!node || !node.id) return;
    if (selectedFacets.has(node.id)) {
      selectedFacets.delete(node.id);
      if (chipEl) chipEl.classList.remove("is-selected");
    } else {
      selectedFacets.set(node.id, node);
      if (chipEl) chipEl.classList.add("is-selected");
    }
    updateFacetPreview();
    const input = document.getElementById("searchInput");
    const composed = composedFacetQuery();
    if (input && composed) input.value = composed;
  }

  function clearFacets() {
    selectedFacets.clear();
    document.querySelectorAll(".facet-chip.is-selected").forEach((el) => {
      el.classList.remove("is-selected");
    });
    updateFacetPreview();
  }

  function renderFacetPanel(tree) {
    const root = document.getElementById("facetLayers");
    if (!root || !tree || !Array.isArray(tree.layers)) return;
    root.innerHTML = "";
    tree.layers.forEach((layer, idx) => {
      const section = document.createElement("div");
      section.className = "facet-layer" + (idx > 0 ? " is-collapsed" : "");
      section.dataset.layer = layer.id;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "facet-layer-toggle";
      const count = (layer.nodes || []).filter((n) => !String(n.id || "").startsWith("sil-")).length;
      toggle.innerHTML =
        `<span><span class="fl-zh">${layer.zh || ""}</span><span class="fl-en">${layer.en || ""}</span></span>` +
        `<span class="fl-meta">${section.classList.contains("is-collapsed") ? "▸" : "▾"} ${count}</span>`;
      toggle.addEventListener("click", () => {
        section.classList.toggle("is-collapsed");
        const meta = toggle.querySelector(".fl-meta");
        if (meta) {
          meta.textContent =
            (section.classList.contains("is-collapsed") ? "▸ " : "▾ ") + count;
        }
      });
      section.appendChild(toggle);

      const body = document.createElement("div");
      body.className = "facet-layer-body";
      const chips = document.createElement("div");
      chips.className = "facet-chips";

      const nodes = Array.isArray(layer.nodes) ? layer.nodes : [];
      // Group silhouette by parent
      if (layer.id === "silhouette") {
        const groups = nodes.filter((n) => String(n.id || "").startsWith("sil-"));
        const children = nodes.filter((n) => !String(n.id || "").startsWith("sil-"));
        groups.forEach((g) => {
          const gl = document.createElement("div");
          gl.className = "facet-group-label";
          gl.textContent = `${g.zh || ""}｜${g.en || ""}`;
          body.appendChild(gl);
          const row = document.createElement("div");
          row.className = "facet-chips";
          children
            .filter((c) => c.parent_id === g.id)
            .forEach((node) => {
              row.appendChild(makeFacetChip(node, false));
            });
          body.appendChild(row);
        });
      } else {
        nodes.forEach((node) => {
          // Skip market-only? Keep womenswear/menswear as useful filters
          const isChild = !!node.parent_id;
          chips.appendChild(makeFacetChip(node, isChild));
        });
        body.appendChild(chips);
      }

      section.appendChild(body);
      root.appendChild(section);
    });
    updateFacetPreview();
  }

  function makeFacetChip(node, isChild) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "facet-chip" + (isChild ? " is-child" : "");
    btn.dataset.id = node.id;
    btn.innerHTML = `<span class="fc-zh">${node.zh || ""}</span><span class="fc-en">｜${node.en || ""}</span>`;
    if (selectedFacets.has(node.id)) btn.classList.add("is-selected");
    btn.addEventListener("click", () => toggleFacet(node, btn));
    return btn;
  }

  function renderParseChips(parsed, targets) {
    const list = Array.isArray(targets) ? targets : [targets];
    list.forEach((el) => {
      if (!el) return;
      el.innerHTML = "";
      if (!parsed) {
        el.hidden = true;
        return;
      }
      const specs = [
        ["category", parsed.category],
        ["style", parsed.style],
        ["silhouette", parsed.silhouette],
        ["material", parsed.material_focus],
        ["colour", parsed.colour],
        ["feature", parsed.design_features],
      ];
      let any = false;
      specs.forEach(([layer, vals]) => {
        (Array.isArray(vals) ? vals : []).forEach((v) => {
          if (!v) return;
          any = true;
          const chip = document.createElement("span");
          chip.className = "parse-chip";
          chip.innerHTML = `<span class="pc-layer">${layer}</span><span class="pc-val">${v}</span>`;
          el.appendChild(chip);
        });
      });
      el.hidden = !any;
    });
  }

  function applyParseFromPayload(data, query) {
    const parsed = (data && data.parse) || null;
    lastParse = parsed;
    renderParseChips(parsed, [
      document.getElementById("parseChips"),
      document.getElementById("parseChipsScan"),
    ]);
    return parsed;
  }

  function matchedTaxTerms() {
    const out = new Set();
    if (!lastParse) return out;
    ["category", "style", "silhouette", "material_focus", "colour", "design_features", "matched"].forEach((k) => {
      (lastParse[k] || []).forEach((v) => {
        String(v)
          .toLowerCase()
          .split(/[\s/-]+/)
          .forEach((t) => {
            if (t.length > 2) out.add(t);
          });
        out.add(String(v).toLowerCase());
      });
    });
    return out;
  }

  function appendSourceItem(list, opts) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = opts.href || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = opts.title || "(untitled)";
    const src = document.createElement("span");
    src.className = "source-name";
    src.textContent = opts.source || "";
    li.appendChild(a);
    li.appendChild(src);
    if (opts.summary) {
      const sum = document.createElement("p");
      sum.className = "source-summary";
      const text = String(opts.summary);
      sum.textContent = text.slice(0, 160) + (text.length > 160 ? "…" : "");
      li.appendChild(sum);
    }
    list.appendChild(li);
  }

  function updateLiveBadge(webOk) {
    const badge = document.getElementById("apiBadge");
    if (!badge || apiBase === null) return;
    if (webOk) {
      badge.textContent = "LIVE RSS+WEB";
      badge.classList.add("is-live");
      const foot = document.getElementById("landingFootNote");
      if (foot) {
        foot.textContent =
          "演示动画 + 实时 RSS + Tavily/Exa Web · 扫描/3D/报告优先实况图 · picsum 仅作回退";
      }
    }
  }

  function hydrateSources(payload) {
    const section = document.getElementById("reportSources");
    const rssBlock = document.getElementById("sourcesRssBlock");
    const list = document.getElementById("sourcesList");
    const meta = document.getElementById("sourcesMeta");
    const webBlock = document.getElementById("sourcesWebBlock");
    const webList = document.getElementById("sourcesWebList");
    const webMeta = document.getElementById("sourcesWebMeta");
    if (!section || !list || !meta) return;

    const items = (payload && payload.rss && payload.rss.items) || [];
    const web = (payload && payload.web) || {};
    const webResults = Array.isArray(web.results) ? web.results : [];
    const webOk = web.status === "ok" && webResults.length > 0;

    list.innerHTML = "";
    if (webList) webList.innerHTML = "";

    let hasRss = items.length > 0;
    let hasWeb = webResults.length > 0;

    if (rssBlock) rssBlock.hidden = !hasRss;
    if (webBlock) webBlock.hidden = !hasWeb;

    if (!hasRss && !hasWeb) {
      section.hidden = true;
      return;
    }

    section.hidden = false;

    if (hasRss) {
      const feedsOk = payload.rss.feeds_ok;
      const feedsTotal = payload.rss.feeds_total;
      meta.textContent = `实时 RSS · ${items.length} 条 · ${feedsOk}/${feedsTotal} feeds 可用`;
      items.slice(0, 12).forEach((it) => {
        appendSourceItem(list, {
          href: it.link || "#",
          title: it.title || "(untitled)",
          source: it.source || "",
          summary: it.summary || "",
        });
      });
    }

    if (hasWeb && webList && webMeta) {
      const provider =
        (web.providers || []).find((p) => p.provider === "tavily" && p.status === "ok") ||
        (web.providers || []).find((p) => p.status === "ok");
      const label = provider ? provider.provider : "web";
      webMeta.textContent = `Tavily · ${webResults.length} 条 · status ${web.status || "ok"}`;
      webResults.slice(0, 10).forEach((it) => {
        const snippet = it.content || it.snippet || "";
        appendSourceItem(webList, {
          href: it.url || "#",
          title: it.title || it.url || "(untitled)",
          source: it.source || label || "web",
          summary: snippet,
        });
      });
    }

    updateLiveBadge(webOk);

    const liveImgs = collectLiveImages(payload, (payload && payload.query) || "");
    if (liveImgs.length) {
      const badge = document.getElementById("apiBadge");
      if (badge && apiBase !== null) {
        badge.textContent = "LIVE + IMAGES";
        badge.classList.add("is-live");
      }
      const foot = document.getElementById("landingFootNote");
      if (foot) {
        foot.textContent =
          `演示动画 + 实时 RSS/Web · ${liveImgs.length} 张实况图用于扫描/3D/报告 · picsum 仅作回退`;
      }
    }
  }


  // Deterministic-ish picsum URLs (demo) — only when zero live garments
  function imgUrl(seed, w, h) {
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
  }

  function isPicsumSrc(src) {
    return /picsum\.photos|\/photos\/seed\//i.test(String(src || ""));
  }

  function updateLiveImgBadge(liveImages, garmentsOpt) {
    const garments =
      garmentsOpt ||
      pickGarmentImages(Array.isArray(liveImages) ? liveImages : []);
    const n = garments.length;
    const text = `LOOKS · ${n}`;
    const badge = document.getElementById("liveImgBadge");
    if (badge) {
      badge.hidden = false;
      badge.textContent = text;
      badge.classList.toggle("is-ready", n > 0);
    }
    document.querySelectorAll("[data-live-badge-mirror]").forEach((el) => {
      el.hidden = false;
      el.textContent = text;
      el.classList.toggle("is-ready", n > 0);
    });
  }

  /**
   * Hot-swap: replace picsum placeholders on scan/discovery (and report/archive)
   * with pickGarmentImages results once live looks arrive.
   */
  function applyLiveImagesToDom(liveImages) {
    const garments = pickGarmentImages(liveImages);
    updateLiveImgBadge(liveImages, garments);
    if (!garments.length) return 0;
    const selectors = [
      "#scanWall img",
      "#discoverySpace img",
      "#phaseReport img",
      "#archiveGrid img",
    ];
    let swapped = 0;
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((img, i) => {
        const g = garments[i % garments.length];
        if (!g || !g.src) return;
        if (isPicsumSrc(img.getAttribute("src") || img.src)) {
          img.src = g.src;
          if (g.title) {
            img.alt = `${g.title.slice(0, 80)}${g.source ? ` (${g.source})` : ""}`;
          }
          swapped += 1;
        }
      });
    });
    return swapped;
  }

  /** If garments empty but API is up, show hint and retry search once. */
  async function ensureLiveImages(query, liveImages) {
    let imgs = Array.isArray(liveImages) ? liveImages : [];
    let garments = pickGarmentImages(imgs);
    updateLiveImgBadge(imgs, garments);
    if (garments.length || apiBase === null) return imgs;

    const qKey = String(query || "").trim().toLowerCase();
    // Already retried this query once — do not hit /api/search again.
    if (qKey && liveImageRetryDone.has(qKey)) return imgs;
    // Payload already exists for same query with empty garments — skip refetch.
    if (
      lastSearchPayload &&
      String(lastSearchPayload.query || "").trim().toLowerCase() === qKey
    ) {
      if (qKey) liveImageRetryDone.add(qKey);
      return imgs;
    }

    if (discoveryHint) {
      discoveryHint.textContent = "正在拉取秀场图…";
    }
    if (qKey) liveImageRetryDone.add(qKey);
    try {
      const data = await fetchSearch(query);
      if (data) {
        lastSearchPayload = data;
        imgs = collectLiveImages(data, query);
        garments = pickGarmentImages(imgs);
        updateLiveImgBadge(imgs, garments);
        applyLiveImagesToDom(imgs);
      }
    } catch (_) {
      /* keep prior imgs */
    }
    return imgs;
  }

  // --- DOM refs -------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const landing = $("#landing");
  const phaseScan = $("#phaseScan");
  const phaseDiscovery = $("#phaseDiscovery");
  const phaseReport = $("#phaseReport");
  const phaseArchive = $("#phaseArchive");
  const phaseOrbit = $("#phaseOrbit");
  const searchForm = $("#searchForm");
  const searchInput = $("#searchInput");
  const queryDisplay = $("#queryDisplay");
  const searchElevated = $("#searchElevated");
  const scanWall = $("#scanWall");
  const scanLine = $("#scanLine");
  const discoverySpace = $("#discoverySpace");
  const discoveryHint = $("#discoveryHint");
  const clusterLabels = $("#clusterLabels");
  const archiveGrid = $("#archiveGrid");
  const detailOverlay = $("#detailOverlay");
  const detailImg = $("#detailImg");
  const detailTags = $("#detailTags");
  const detailScan = $("#detailScan");
  const reportTitle = $("#reportTitle");
  const reportDek = $("#reportDek");
  // reportSummary removed — evidence sections only

  let activeTimeline = null;
  let scrollTriggers = [];

  // --- Helpers --------------------------------------------------
  function show(el) {
    el.hidden = false;
  }
  function hide(el) {
    el.hidden = true;
  }

  function setStatus(step) {
    $$(".status-step").forEach((el) => {
      const s = el.dataset.step;
      el.classList.remove("is-active", "is-done");
      const order = ["collecting", "analysing", "mapping", "generating"];
      const cur = order.indexOf(step);
      const mine = order.indexOf(s);
      if (mine < cur) el.classList.add("is-done");
      if (mine === cur) el.classList.add("is-active");
    });
  }

  function killTimeline() {
    if (activeTimeline) {
      activeTimeline.kill();
      activeTimeline = null;
    }
    scrollTriggers.forEach((st) => st.kill && st.kill());
    scrollTriggers = [];
    if (window.ScrollTrigger) ScrollTrigger.getAll().forEach((st) => st.kill());
  }

  function applyReportCopy(query, payload) {
    const data = REPORT_COPY[query] || {};
    reportTitle.textContent = query;
    reportDek.textContent =
      data.dek || "基于实时检索的证据映射（无虚构趋势文案）";
    const season = deriveSeasonLabel(query, payload) || data.season || "—";
    const focus = deriveFocusLabel(query) || data.focus || "GENERAL";
    const metas = $$(".mast-right .meta-line");
    if (metas[0]) metas[0].textContent = `SEASON / ${season}`;
    if (metas[1]) metas[1].textContent = `FOCUS / ${focus}`;
    const srcMeta = document.getElementById("reportSourcesMeta");
    const n = countLiveSources(payload);
    if (srcMeta) srcMeta.textContent = `SOURCES / ${n}`;
  }

  function isAbsHttpUrl(u) {
    return typeof u === "string" && /^https?:\/\//i.test(u.trim());
  }

  const QUERY_STOPWORDS = new Set([
    "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "with", "by", "at", "from", "as",
  ]);

  const FASHION_PRESS_HOSTS = [
    "vogue.com",
    "wwd.com",
    "harpersbazaar.com",
    "elle.com",
    "businessoffashion.com",
    "fashionista.com",
    "hypebeast.com",
    "coveteur.com",
    "tfashion",
    "highsnobiety.com",
    "whowhatwear.com",
    "nylon.com",
    "grailed.com",
    "ssense.com",
    "matchesfashion.com",
  ];

  const IMAGE_NOISE_RE =
    /hiring|job|career|newsletter|logo|sprite|icon|avatar|advert|sponsored|favicon|placeholder|1x1|pixel\.gif|lazyload|scorecard|themes\/|tracking|voguerunway-share|facebook|profile-pic|\/w_90[,/%]|vidthumb|product-images|share\.jpg|\.gif/i;
  const RUNWAY_LOOK_RE = /assets\.vogue\.com\/photos|fashion-shows|\brunway\b|\brtw\b|ready-to-wear|\/0000\d-/i;
  const WWD_UPLOADS_RE = /wwd\.com\/.*\/wp-content\/uploads\//i;

  /** Explicit non-garment junk: thumbs, logos, share stubs, product tiles, etc. */
  function isNonGarmentNoise(url, title) {
    const blob = `${url || ""} ${title || ""}`.toLowerCase();
    if (!blob.trim()) return true;
    return (
      /vidthumb|product-images|\bicon\b|\blogo\b|lazyload|share\.jpg|voguerunway-share|themes\/|scorecard|facebook|\.gif\b|avatar|favicon|1x1|pixel\.gif|placeholder|\/w_90[,/%]/i.test(
        blob
      )
    );
  }

  /**
   * Strict garment / runway look detector for the scan wall + 3D discovery.
   * True when URL clearly points at a look photo (Vogue assets, WWD RTW, Elle/Harper runway).
   */
  function isGarmentLookUrl(url, title) {
    const u = String(url || "");
    const t = String(title || "");
    const lower = `${u} ${t}`.toLowerCase();
    if (!u || isNonGarmentNoise(u, t)) return false;

    // Vogue CDN look photos — reject social / newsletter / 16:9 crops
    if (/assets\.vogue\.com\/photos\//i.test(u)) {
      if (
        /16:9|\/social|[?&]social|-social-|newsletter|w_1280,c_limit\/-social|w_1280,c_limit.*social/i.test(
          lower
        )
      ) {
        return false;
      }
      const lookNum = /\/0000\d+-/i.test(u);
      const designerSeason =
        /\/(?:spring|fall|resort|pre-fall|couture|ready-to-wear|menswear|womenswear)[-_]?\d{0,4}/i.test(
          u
        ) ||
        /\/(?:ss|aw|fw|pf)\d{2}/i.test(u) ||
        /fashion-shows|ready-to-wear|\brtw\b/i.test(lower);
      const passPortrait = /\/pass\//i.test(u);
      if (lookNum || designerSeason || passPortrait) return true;
      return false;
    }

    // WWD uploads with season / runway markers
    if (/wwd\.com\/wp-content\/uploads\//i.test(u)) {
      // Underscores are common in WWD filenames (Prada_RTW_SS27_...); avoid \b
      if (
        !/(?:rtw[_-]?ss|rtwss\d{0,4}|\brtw\b|_rtw_|-rtw-|runway|ss\d{2}|aw\d{2}|fw\d{2}|spring-|fall-|resort|lookbook|couture|ready-to-wear|fashion-week)/i.test(
          lower
        )
      ) {
        return false;
      }
      // Soft reject celebrity-only street style without RTW / runway path
      if (
        /(?:^|[_\W])(celebrity|red-carpet|street-style|party)(?=[_\W]|$)/i.test(lower) &&
        !/(?:^|[_\W])(rtw|runway|ready-to-wear|fashion-shows)(?=[_\W]|$)/i.test(lower)
      ) {
        return false;
      }
      return true;
    }

    // Elle / Harper's Bazaar runway article images
    if (
      /(elle\.com|harpersbazaar\.com|harper'?s)/i.test(lower) &&
      /\brunway\b|fashion-week|catwalk|lookbook|\brtw\b/i.test(lower)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Prefer garment looks for scan wall / 3D. Falls back to full ranked live
   * (still fashion URLs) when the strict subset is empty; never invents picsum here.
   */
  function pickGarmentImages(liveImages, opts) {
    const minScore =
      opts && typeof opts.minScore === "number" ? opts.minScore : -Infinity;
    const live = Array.isArray(liveImages)
      ? liveImages.filter((x) => x && x.src && isAbsHttpUrl(x.src))
      : [];
    if (!live.length) return [];

    const garments = live
      .filter((item) => {
        if (isNonGarmentNoise(item.src, item.title)) return false;
        if (!isGarmentLookUrl(item.src, item.title)) return false;
        if (typeof item.score === "number" && item.score < minScore) return false;
        return true;
      })
      .slice();

    // Prefer higher score; deprioritize explicit 16:9 social crops if any slipped through
    garments.sort((a, b) => {
      const aWide = /16:9|-social-|\/social/i.test(a.src) ? 1 : 0;
      const bWide = /16:9|-social-|\/social/i.test(b.src) ? 1 : 0;
      if (aWide !== bWide) return aWide - bWide;
      return (b.score || 0) - (a.score || 0);
    });

    if (garments.length) return garments;

    // Fallback: full ranked live that is not hard noise (no picsum)
    return live
      .filter((item) => !isNonGarmentNoise(item.src, item.title))
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /** Tokenize query: latin words + each CJK char; keep season codes like ss27. */
  function tokenizeQuery(query) {
    const q = String(query || "").toLowerCase();
    const tokens = [];
    const seen = new Set();
    const pushTok = (t) => {
      if (!t || QUERY_STOPWORDS.has(t) || seen.has(t)) return;
      seen.add(t);
      tokens.push(t);
    };
    const latin = q.match(/[a-z0-9][a-z0-9'+-]*/g) || [];
    latin.forEach(pushTok);
    for (const ch of q) {
      if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch)) pushTok(ch);
    }
    return tokens;
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function isFashionPressHost(host) {
    if (!host) return false;
    return FASHION_PRESS_HOSTS.some((h) => host === h || host.endsWith("." + h) || host.includes(h));
  }

  function textHasToken(hay, tokens) {
    if (!hay || !tokens.length) return false;
    const lower = String(hay).toLowerCase();
    return tokens.some((t) => lower.includes(t));
  }

  /**
   * Build ranked unique live images from web.results images, rss, and web.images.
   * Scores against query tokens; drops weak matches when stronger ones exist.
   */
  function collectLiveImages(payload, query) {
    const out = [];
    const seen = new Set();
    const q =
      (query && String(query).trim()) ||
      (payload && (payload.query || (payload.web && payload.web.query))) ||
      "";
    const tokens = tokenizeQuery(q);

    const push = (src, meta) => {
      if (!isAbsHttpUrl(src)) return;
      const key = src.trim();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        src: key,
        title: (meta && meta.title) || "",
        href: (meta && meta.href) || "",
        source: (meta && meta.source) || "",
        kind: (meta && meta.kind) || "web",
      });
    };

    if (!payload) return out;

    const web = payload.web || {};
    const webResults = Array.isArray(web.results) ? web.results : [];
    webResults.forEach((r) => {
      if (!r) return;
      const meta = {
        title: r.title || "",
        href: r.url || "",
        source: r.source || "web",
        kind: "article",
      };
      if (r.image) push(r.image, meta);
      const extras = Array.isArray(r.images) ? r.images : [];
      extras.forEach((im) => {
        const src = typeof im === "string" ? im : im && (im.url || im.src);
        push(src, meta);
      });
    });

    const rssItems =
      (payload.rss && Array.isArray(payload.rss.items) && payload.rss.items) || [];
    rssItems.forEach((it) => {
      if (!it || !it.image) return;
      push(it.image, {
        title: it.title || "",
        href: it.link || "",
        source: it.source || "rss",
        kind: "rss",
      });
    });

    const webImages = Array.isArray(web.images) ? web.images : [];
    webImages.forEach((u) => {
      if (typeof u === "string") {
        push(u, { title: "", href: "", source: "web", kind: "web-image" });
        return;
      }
      if (!u) return;
      const src = u.url || u.src;
      push(src, {
        title: u.title || "",
        href: u.page_url || u.href || u.pageUrl || "",
        source: u.source || "web",
        kind: "web-image",
      });
    });

    const scored = out.map((item) => {
      let score = 0;
      const blob = `${item.title} ${item.href} ${item.src} ${item.source}`;
      const srcLower = String(item.src || "").toLowerCase();
      const tokenHit = textHasToken(blob, tokens);
      if (tokenHit) score += 3;
      if (item.kind === "article") score += 2;
      if (item.kind === "rss" && textHasToken(item.title, tokens)) score += 2;
      const host = hostOf(item.href || item.src);
      if (isFashionPressHost(host) || isFashionPressHost(hostOf(item.src))) score += 1;
      // Runway / Vogue / WWD look bonuses
      if (/assets\.vogue\.com\/photos/i.test(srcLower)) score += 5;
      if (
        /fashion-shows|\brunway\b|\brtw\b|ready-to-wear|\/0000\d-/i.test(srcLower) ||
        /fashion-shows|\brunway\b|\brtw\b|ready-to-wear/i.test(String(item.href || ""))
      ) {
        score += 4;
      }
      if (WWD_UPLOADS_RE.test(srcLower)) score += 3;
      // Strong penalty for icon/lazyload/tracking noise
      if (IMAGE_NOISE_RE.test(blob) || IMAGE_NOISE_RE.test(srcLower)) score -= 8;
      if (/vidthumb/i.test(srcLower)) score -= 8;
      if (/16:9|-social-|\/social|newsletter|w_1280,c_limit.*social/i.test(srcLower)) score -= 6;
      if (isNonGarmentNoise(item.src, item.title)) score -= 4;
      if (isGarmentLookUrl(item.src, item.title)) score += 3;
      if (item.kind === "web-image" && !item.title) score -= 3;
      return Object.assign({}, item, { score });
    });

    scored.sort((a, b) => b.score - a.score || (a.kind === "article" ? -1 : 1));

    const strong = scored.filter((x) => x.score >= 1);
    if (strong.length) return strong;

    // Fallback: keep best by source preference when nothing scores >= 1
    const pref = { article: 0, rss: 1, "web-image": 2, web: 3 };
    return scored
      .slice()
      .sort(
        (a, b) =>
          (pref[a.kind] ?? 9) - (pref[b.kind] ?? 9) || b.score - a.score
      );
  }

  function fillReportImages(query, liveImages) {
    const seedBase = query.replace(/\s+/g, "-").toLowerCase().slice(0, 24);
    const live = Array.isArray(liveImages) ? liveImages : [];
    const defaults = [
      "Key silhouette — volumetric volume",
      "Material — linen / liquid satin contrast",
      "Colour story — warm chalk / oxidized rust / ink",
    ];

    $$(".report img").forEach((img, i) => {
      const liveItem = live[i];
      const figure = img.closest("figure");
      const cap = figure && figure.querySelector("figcaption");

      // Clear previous click handler via clone if we re-fill
      const next = img.cloneNode(false);
      img.parentNode.replaceChild(next, img);
      const target = next;

      if (liveItem && liveItem.src) {
        target.src = liveItem.src;
        target.alt = liveItem.title
          ? `${liveItem.title} (${liveItem.source || "live"})`
          : `Live trend visual ${i + 1}`;
        if (cap) {
          cap.textContent = liveItem.title
            ? liveItem.title.slice(0, 80) + (liveItem.title.length > 80 ? "…" : "")
            : defaults[i] || `Live image ${i + 1}`;
        }
        if (liveItem.href) {
          target.style.cursor = "pointer";
          target.title = "Open source";
          target.addEventListener("click", (e) => {
            e.preventDefault();
            window.open(liveItem.href, "_blank", "noopener,noreferrer");
          });
        }
      } else {
        target.src = imgUrl(`${seedBase}-report-${i}`, 900, i === 2 ? 400 : 1200);
        target.alt = `Trend visual (demo) ${i + 1}`;
        if (cap) cap.textContent = defaults[i] || `Demo visual ${i + 1}`;
        target.style.cursor = "";
        target.removeAttribute("title");
      }
      target.loading = "lazy";
    });
  }

  function updateRefImageKpi(liveCount) {
    const kpis = $$(".report-kpi .kpi");
    const refKpi = kpis.find((el) => {
      const span = el.querySelector("span");
      return span && span.textContent.includes("参考图");
    });
    if (!refKpi) return;
    const strong = refKpi.querySelector("strong");
    if (strong) {
      strong.textContent = String(liveCount > 0 ? liveCount : 42);
    }
  }


  const DEMO_CORE_STYLES = [
    {
      title: "Proenza Schouler · Spring 2027 RTW",
      intro: "来自演示数据的秀场要点：放大廓形与软化肩线，作为实验女装参考轮廓。",
      source: "Demo",
      href: "",
    },
    {
      title: "The Row · Fall 2026 RTW",
      intro: "来自演示数据的秀场要点：克制剪裁与触感优先的外衣语言。",
      source: "Demo",
      href: "",
    },
    {
      title: "Issey Miyake · SS27",
      intro: "来自演示数据的秀场要点：褶皱与轻量结构构成可穿实验性。",
      source: "Demo",
      href: "",
    },
  ];

  const SEASON_LABEL = {
    spring: "Spring",
    summer: "Summer",
    fall: "Fall",
    autumn: "Fall",
    winter: "Winter",
    ss: "SS",
    fw: "FW",
    aw: "AW",
    rtw: "RTW",
    "ready-to-wear": "RTW",
    "ready to wear": "RTW",
  };

  function cleanArticleTitle(raw) {
    let t = String(raw || "").replace(/\s+/g, " ").trim();
    t = t.replace(/\s*[\|\u2013\u2014\-]\s*(Vogue|WWD|Elle|Harper'?s Bazaar|Business of Fashion|BOF|Fashionista|Who What Wear).*$/i, "");
    t = t.replace(/\s+Fashion Show\s*$/i, "");
    return t.trim();
  }

  function parseDesignerSeason(title) {
    const cleaned = cleanArticleTitle(title);
    // e.g. "Proenza Schouler Spring 2027 Ready-to-Wear"
    let m = cleaned.match(
      /^(.+?)\s+(Spring|Summer|Fall|Autumn|Winter)\s+(\d{4})(?:\s+(Ready[-\s]?to[-\s]?Wear|RTW|Couture|Menswear|Resort|Pre[-\s]?Fall))?/i
    );
    if (m) {
      const designer = m[1].replace(/\s*[:,\-–—]\s*$/, "").trim();
      const seasonWord = SEASON_LABEL[m[2].toLowerCase()] || m[2];
      const year = m[3];
      const coll = m[4] ? (SEASON_LABEL[m[4].toLowerCase().replace(/\s+/g, "-")] || m[4]) : "RTW";
      const seasonPart = coll === "RTW" || /ready/i.test(String(m[4] || ""))
        ? `${seasonWord} ${year} RTW`
        : `${seasonWord} ${year}${m[4] ? " " + coll : ""}`;
      return { designer, season: seasonPart, display: `${designer} · ${seasonPart}` };
    }
    // e.g. "X SS27" / "X S/S 2027" / "X FW26" / "X AW 2026"
    m = cleaned.match(
      /^(.+?)\s+(S\/?S|F\/?W|A\/?W|SS|FW|AW)\s*'?\s*(\d{2}|\d{4})\b/i
    );
    if (m) {
      const designer = m[1].replace(/\s*[:,\-–—]\s*$/, "").trim();
      let code = m[2].toUpperCase().replace(/\//g, "");
      if (code === "SS" || code.startsWith("S")) code = "SS";
      else if (code === "FW" || code.startsWith("F")) code = "FW";
      else if (code === "AW" || code.startsWith("A")) code = "AW";
      let yr = m[3];
      if (yr.length === 4) yr = yr.slice(2);
      return { designer, season: `${code}${yr}`, display: `${designer} · ${code}${yr}` };
    }
    return null;
  }

  function sourceLabelFromUrl(url, fallback) {
    const host = hostOf(url || "");
    if (/vogue/.test(host)) return "Vogue";
    if (/wwd/.test(host)) return "WWD";
    if (/elle/.test(host)) return "Elle";
    if (/harpersbazaar|harper/.test(host)) return "Harper's Bazaar";
    if (/businessoffashion|bof\.com/.test(host)) return "BoF";
    if (/fashionista/.test(host)) return "Fashionista";
    if (fallback && fallback !== "web" && fallback !== "tavily" && fallback !== "exa") {
      return String(fallback).slice(0, 24);
    }
    if (host) {
      const parts = host.replace(/^www\./, "").split(".");
      return (parts[0] || "Web").replace(/^\w/, (c) => c.toUpperCase());
    }
    return "Web";
  }

  function trimIntro(text, maxLen) {
    const lim = maxLen || 150;
    let s = String(text || "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    if (s.length <= lim) return s;
    // Prefer cut at sentence or clause boundary for CJK/Latin mix
    const slice = s.slice(0, lim);
    const breakAt = Math.max(
      slice.lastIndexOf("。"),
      slice.lastIndexOf("；"),
      slice.lastIndexOf(". "),
      slice.lastIndexOf("; "),
      slice.lastIndexOf("，"),
      slice.lastIndexOf(", ")
    );
    if (breakAt > lim * 0.45) {
      return slice.slice(0, breakAt + 1).trim() + (breakAt + 1 < s.length ? "…" : "");
    }
    return slice.replace(/\s+\S*$/, "").trim() + "…";
  }

  function isFashionShowTitle(title, url) {
    const blob = `${title || ""} ${url || ""}`;
    return /fashion\s*show|ready[-\s]?to[-\s]?wear|\brtw\b|\brunway\b|spring\s+20\d{2}|fall\s+20\d{2}|summer\s+20\d{2}|winter\s+20\d{2}|\bSS\s*'?\d{2}\b|\bFW\s*'?\d{2}\b|\bAW\s*'?\d{2}\b|couture|collection/i.test(
      blob
    );
  }

  function normalizeStyleKey(parsed, title) {
    if (parsed && parsed.designer && parsed.season) {
      return `${parsed.designer}::${parsed.season}`.toLowerCase().replace(/\s+/g, " ");
    }
    return cleanArticleTitle(title).toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  }

  function synthesizeIntro(title, source, query) {
    const first = cleanArticleTitle(title).split(/[.。:：\-|–—]/)[0].trim().slice(0, 80);
    const src = source || "媒体";
    const qBit = query ? `（查询：${String(query).slice(0, 40)}）` : "";
    return `来自 ${src} 的秀场报道要点：${first || "相关时装周报道"}${qBit}`;
  }

  /**
   * Derive core style intros from live web.results (runway / designer titles).
   * Falls back to a short demo list so the layout never collapses.
   */
  function extractCoreStyles(payload, query, liveImages) {
    const out = [];
    const seen = new Set();
    const q = (query && String(query).trim()) || "";

    const push = (item) => {
      if (!item || !item.title) return;
      const key = normalizeStyleKey(item._parsed, item.title);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        title: item.title,
        intro: item.intro,
        source: item.source || "",
        href: item.href || "",
      });
    };

    const web = (payload && payload.web) || {};
    const webResults = Array.isArray(web.results) ? web.results.slice() : [];

    // Prefer fashion-show / runway titles
    webResults.sort((a, b) => {
      const sa = isFashionShowTitle(a && a.title, a && a.url) ? 1 : 0;
      const sb = isFashionShowTitle(b && b.title, b && b.url) ? 1 : 0;
      return sb - sa;
    });

    webResults.forEach((r) => {
      if (!r || out.length >= 12) return;
      const rawTitle = r.title || "";
      if (!rawTitle) return;
      const prefer = isFashionShowTitle(rawTitle, r.url);
      // Keep non-show articles only if we still have room after prefer pass — scored below
      const parsed = parseDesignerSeason(rawTitle);
      if (!prefer && !parsed) return;

      const display = parsed ? parsed.display : cleanArticleTitle(rawTitle);
      const source = sourceLabelFromUrl(r.url, r.source);
      let intro = trimIntro(r.content || r.snippet || "", 150);
      if (!intro) intro = synthesizeIntro(rawTitle, source, q);

      push({
        title: display,
        intro,
        source,
        href: r.url || "",
        _parsed: parsed,
      });
    });

    // If still short, pull from RSS with show-like titles
    if (out.length < 6 && payload && payload.rss && Array.isArray(payload.rss.items)) {
      payload.rss.items.forEach((it) => {
        if (!it || out.length >= 12) return;
        const rawTitle = it.title || "";
        if (!rawTitle || !isFashionShowTitle(rawTitle, it.link)) return;
        const parsed = parseDesignerSeason(rawTitle);
        const display = parsed ? parsed.display : cleanArticleTitle(rawTitle);
        const source = sourceLabelFromUrl(it.link, it.source);
        let intro = trimIntro(it.summary || "", 150);
        if (!intro) intro = synthesizeIntro(rawTitle, source, q);
        push({
          title: display,
          intro,
          source,
          href: it.link || "",
          _parsed: parsed,
        });
      });
    }

    // Supplement from live image titles if still thin
    if (out.length < 6 && Array.isArray(liveImages)) {
      liveImages.forEach((im) => {
        if (!im || out.length >= 10) return;
        const rawTitle = im.title || "";
        if (!rawTitle || !isFashionShowTitle(rawTitle, im.href)) return;
        const parsed = parseDesignerSeason(rawTitle);
        if (!parsed) return;
        const source = sourceLabelFromUrl(im.href, im.source);
        push({
          title: parsed.display,
          intro: synthesizeIntro(rawTitle, source, q),
          source,
          href: im.href || "",
          _parsed: parsed,
        });
      });
    }

    let styles = out.slice(0, 12);
    if (styles.length > 12) styles = styles.slice(0, 12);
    // Prefer 6–12; if we have 1–5 live, still show them; if zero, demo
    if (!styles.length) {
      return []; // never invent demo core styles
    }
    // Cap lower bound display: if >12 already sliced; keep as-is if 1–12
    if (styles.length > 12) styles = styles.slice(0, 12);
    return styles;
  }

  function renderCoreStyles(styles) {
    const list = document.getElementById("coreStylesList");
    const meta = document.getElementById("coreStylesMeta");
    const section = document.getElementById("reportCoreStyles");
    if (!list) return;

    const items = Array.isArray(styles) ? styles : [];
    list.innerHTML = "";

    const isDemo = items.length && items.every((s) => s.source === "Demo");
    if (meta) {
      meta.textContent = isDemo
        ? "演示款式简介 · 接入实时搜索后显示秀场报道"
        : `Core looks · ${items.length} 条秀场 / 报道要点`;
    }
    if (section) section.hidden = !items.length;
    if (!items.length) return;

    items.forEach((s) => {
      const li = document.createElement("li");
      const titleEl = document.createElement(s.href ? "a" : "span");
      if (s.href) {
        titleEl.href = s.href;
        titleEl.target = "_blank";
        titleEl.rel = "noopener noreferrer";
      }
      titleEl.className = "core-style-title";
      titleEl.textContent = s.title || "Untitled look";
      li.appendChild(titleEl);

      if (s.source) {
        const src = document.createElement("span");
        src.className = "core-style-source";
        src.textContent = s.source;
        li.appendChild(src);
      }

      const intro = document.createElement("p");
      intro.className = "core-style-intro";
      intro.textContent = s.intro || "";
      li.appendChild(intro);
      list.appendChild(li);
    });
  }

  function updateCoreStylesKpi(count) {
    const kpis = $$(".report-kpi .kpi");
    const coreKpi = kpis.find((el) => {
      const span = el.querySelector("span");
      return span && span.textContent.includes("核心款式");
    });
    if (!coreKpi) return;
    const strong = coreKpi.querySelector("strong");
    if (strong) strong.textContent = String(count > 0 ? count : 3);
  }

    function renderSourcesImageStrip(liveImages) {
    const section = document.getElementById("reportSources");
    if (!section) return;
    let strip = document.getElementById("sourcesImageStrip");
    const live = Array.isArray(liveImages) ? liveImages.filter((x) => x && x.src) : [];
    if (!live.length) {
      if (strip) strip.remove();
      return;
    }
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "sourcesImageStrip";
      strip.className = "sources-image-strip";
      section.appendChild(strip);
    }
    strip.innerHTML = "";
    const heading = document.createElement("h3");
    heading.textContent = "Sources · 相关图片";
    const meta = document.createElement("p");
    meta.className = "sources-meta";
    meta.textContent = `${live.length} 张来自 Web / RSS`;
    const row = document.createElement("div");
    row.className = "sources-thumbs";
    live.slice(0, 16).forEach((it) => {
      const a = document.createElement(it.href ? "a" : "div");
      if (it.href) {
        a.href = it.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      a.className = "sources-thumb";
      a.title = it.title || it.source || "image";
      const img = document.createElement("img");
      img.src = it.src;
      img.alt = it.title || "Related image";
      img.loading = "lazy";
      a.appendChild(img);
      row.appendChild(a);
    });
    strip.appendChild(heading);
    strip.appendChild(meta);
    strip.appendChild(row);
  }

  // --- Phase 1: Scan --------------------------------------------
  function buildScanWall(query, liveImages) {
    scanWall.innerHTML = "";
    const count = 16;
    const seedBase = query.replace(/\s+/g, "-").toLowerCase() || "trend";
    // Strict garment subset for COLLECTING/ANALYSING grid; repeat looks if short
    const garments = pickGarmentImages(liveImages);
    updateLiveImgBadge(liveImages, garments);
    // Hard ban: if pickGarmentImages returned ≥1, never call imgUrl/picsum
    const live = garments.length
      ? garments
      : Array.isArray(liveImages)
        ? liveImages.filter((x) => x && x.src && !isNonGarmentNoise(x.src, x.title))
        : [];
    for (let i = 0; i < count; i++) {
      const card = document.createElement("div");
      card.className = "scan-card";
      const img = document.createElement("img");
      const liveItem = live.length ? live[i % live.length] : null;
      const demoTag = SCAN_TAGS[i % SCAN_TAGS.length];
      if (liveItem) {
        img.src = liveItem.src;
        img.alt = liveItem.title
          ? `${liveItem.title.slice(0, 80)}${liveItem.source ? ` (${liveItem.source})` : ""}`
          : `Scan reference ${i + 1}`;
        if (liveItem.href) {
          img.title = "Open source";
          card.style.cursor = "pointer";
        }
      } else if (!garments.length) {
        img.src = imgUrl(`${seedBase}-scan-${i}`, 320, 420);
        img.alt = `Scan reference ${i + 1} (demo)`;
      } else {
        const g = garments[i % garments.length];
        img.src = g.src;
        img.alt = g.title
          ? `${g.title.slice(0, 80)}${g.source ? ` (${g.source})` : ""}`
          : `Scan reference ${i + 1}`;
      }
      img.loading = "eager";
      const tag = document.createElement("span");
      tag.className = "card-tag";
      if (liveItem && liveItem.title) {
        const t = liveItem.title.trim();
        tag.textContent = t.slice(0, 18) + (t.length > 18 ? "…" : "");
      } else {
        tag.textContent = demoTag;
      }
      card.appendChild(img);
      card.appendChild(tag);
      card.addEventListener("click", () => {
        if (liveItem && liveItem.href) {
          window.open(liveItem.href, "_blank", "noopener,noreferrer");
          return;
        }
        openDetail(img.src, [
          `#${demoTag}`,
          DETAIL_TAGS[(i + 1) % DETAIL_TAGS.length],
          DETAIL_TAGS[(i + 3) % DETAIL_TAGS.length],
        ]);
      });
      scanWall.appendChild(card);
    }
  }

  function runScanPhase(query, liveImages) {
    return new Promise((resolve) => {
      hide(landing);
      hide(phaseDiscovery);
      hide(phaseReport);
      hide(phaseArchive);
      if (phaseOrbit) hide(phaseOrbit);
      show(phaseScan);
      window.scrollTo(0, 0);

      queryDisplay.textContent = query;
      buildScanWall(query, liveImages);
      setStatus("collecting");

      searchElevated.classList.remove("is-up");
      scanLine.classList.remove("is-running");
      scanLine.style.left = "-2%";

      const cards = $$(".scan-card", scanWall);
      const dur = reducedMotion ? 0.15 : 1;

      if (typeof gsap === "undefined") {
        searchElevated.classList.add("is-up");
        cards.forEach((c) => c.classList.add("is-in", "is-tagged"));
        setStatus("generating");
        setTimeout(resolve, reducedMotion ? 400 : 1800);
        return;
      }

      const tl = gsap.timeline({
        onComplete: resolve,
      });
      activeTimeline = tl;

      tl.call(() => searchElevated.classList.add("is-up"), null, 0.05);
      tl.call(() => setStatus("collecting"), null, 0.1);

      // Stagger cards in
      cards.forEach((card, i) => {
        tl.call(
          () => card.classList.add("is-in"),
          null,
          reducedMotion ? 0.2 : 0.2 + i * 0.04
        );
      });

      // Scan line
      if (!reducedMotion) {
        tl.call(
          () => {
            scanLine.classList.add("is-running");
            setStatus("analysing");
          },
          null,
          0.7
        );
        tl.to(
          scanLine,
          { left: "102%", duration: 1.0, ease: "power1.inOut" },
          0.75
        );
        tl.call(() => scanLine.classList.remove("is-running"), null, 1.75);
      } else {
        tl.call(() => setStatus("analysing"), null, 0.4);
      }

      // Tags
      cards.forEach((card, i) => {
        tl.call(
          () => card.classList.add("is-tagged"),
          null,
          reducedMotion ? 0.5 : 1.5 + (i % 5) * 0.08
        );
      });

      tl.call(() => setStatus("mapping"), null, reducedMotion ? 0.7 : 2.0);
      tl.call(() => setStatus("generating"), null, reducedMotion ? 0.9 : 2.4);
      tl.to({}, { duration: reducedMotion ? 0.25 : 0.3 });
    });
  }

  // --- Phase 2: 3D Discovery ------------------------------------
  function runDiscoveryPhase(query, liveImages) {
    return new Promise((resolve) => {
      hide(phaseScan);
      show(phaseDiscovery);
      window.scrollTo(0, 0);

      discoveryHint.textContent = "正在映射视觉关联…";
      clusterLabels.hidden = true;
      $$("#clusterLabels span").forEach((s) => s.classList.remove("is-on"));

      discoverySpace.innerHTML = "";
      const count = 28;
      const seedBase = query.replace(/\s+/g, "-").toLowerCase() || "disc";
      const garments = pickGarmentImages(liveImages);
      updateLiveImgBadge(liveImages, garments);
      if (!garments.length && apiBase !== null) {
        discoveryHint.textContent = "正在拉取秀场图…";
      }
      // Hard ban: if pickGarmentImages returned ≥1, never call imgUrl/picsum
      const live = garments.length
        ? garments
        : Array.isArray(liveImages)
          ? liveImages.filter((x) => x && x.src && !isNonGarmentNoise(x.src, x.title))
          : [];
      const cards = [];

      for (let i = 0; i < count; i++) {
        const cluster = CLUSTER_KEYS[i % 4];
        const el = document.createElement("div");
        el.className = "disc-card";
        el.dataset.cluster = cluster;

        const img = document.createElement("img");
        const liveItem = live.length ? live[i % live.length] : null;
        if (liveItem) {
          img.src = liveItem.src;
          img.alt = liveItem.title
            ? `${liveItem.title.slice(0, 80)}${liveItem.source ? ` (${liveItem.source})` : ""}`
            : `Discovery ${i + 1}`;
          if (liveItem.href) img.title = "Open source";
        } else if (!garments.length) {
          img.src = imgUrl(`${seedBase}-3d-${i}`, 220, 300);
          img.alt = `Discovery ${i + 1} (demo)`;
        } else {
          const g = garments[i % garments.length];
          img.src = g.src;
          img.alt = g.title
            ? `${g.title.slice(0, 80)}${g.source ? ` (${g.source})` : ""}`
            : `Discovery ${i + 1}`;
        }
        img.draggable = false;
        el.appendChild(img);

        el.addEventListener("click", () => {
          if (liveItem && liveItem.href) {
            window.open(liveItem.href, "_blank", "noopener,noreferrer");
            return;
          }
          openDetail(img.src, [
            `#${cluster.toUpperCase()}`,
            DETAIL_TAGS[i % DETAIL_TAGS.length],
            DETAIL_TAGS[(i + 2) % DETAIL_TAGS.length],
          ]);
        });

        discoverySpace.appendChild(el);

        const chaosX = (Math.random() - 0.5) * 380;
        const chaosY = (Math.random() - 0.5) * 280;
        const chaosZ = -180 - Math.random() * 420;
        const rotY = (Math.random() - 0.5) * 48;
        const rotX = (Math.random() - 0.5) * 28;

        cards.push({
          el,
          cluster,
          chaosX,
          chaosY,
          chaosZ,
          rotY,
          rotX,
          isCore: i % 7 === 0 || i % 5 === 0,
          isUnrelated: i % 11 === 3,
          i,
        });
      }

      if (typeof gsap === "undefined") {
        cards.forEach((c) => {
          const layout = CLUSTER_LAYOUT[c.cluster];
          const ox = (layout.cx / 100) * 400 + (Math.random() - 0.5) * 60;
          const oy = (layout.cy / 100) * 280 + (Math.random() - 0.5) * 50;
          c.el.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
          if (c.isUnrelated) c.el.classList.add("is-fade");
          if (c.isCore) c.el.classList.add("is-core");
        });
        clusterLabels.hidden = false;
        $$("#clusterLabels span").forEach((s) => s.classList.add("is-on"));
        setTimeout(resolve, 500);
        return;
      }

      gsap.set(discoverySpace, { rotateX: reducedMotion ? 0 : 14, rotateY: reducedMotion ? 0 : -10 });

      cards.forEach((c) => {
        gsap.set(c.el, {
          x: c.chaosX,
          y: c.chaosY,
          z: c.chaosZ,
          rotationY: c.rotY,
          rotationX: c.rotX,
          opacity: 0.88,
        });
      });

      if (reducedMotion) {
        cards.forEach((c) => {
          const layout = CLUSTER_LAYOUT[c.cluster];
          const ox = (layout.cx / 100) * 400 + ((c.i % 5) - 2) * 22;
          const oy = (layout.cy / 100) * 280 + (Math.floor(c.i / 5) % 3 - 1) * 36;
          gsap.set(c.el, {
            x: ox,
            y: oy,
            z: c.isCore ? 30 : 0,
            rotationY: 0,
            rotationX: 0,
            scale: c.isCore ? 1.35 : 1,
          });
          if (c.isUnrelated) c.el.classList.add("is-fade");
          if (c.isCore) c.el.classList.add("is-core");
        });
        gsap.set(discoverySpace, { rotateX: 0, rotateY: 0 });
        clusterLabels.hidden = false;
        $$("#clusterLabels span").forEach((s) => s.classList.add("is-on"));
        discoveryHint.textContent = "聚类完成 · SILHOUETTE / MATERIAL / STRUCTURE / COLOUR";
        setTimeout(resolve, 450);
        return;
      }

      const tl = gsap.timeline({ onComplete: resolve });
      activeTimeline = tl;

      tl.to(discoverySpace, { rotateX: 5, rotateY: -2, duration: 1.6, ease: "power2.inOut" }, 0);

      cards.forEach((c) => {
        const layout = CLUSTER_LAYOUT[c.cluster];
        const ox = (layout.cx / 100) * 400 + ((c.i % 5) - 2) * 24 + (Math.random() - 0.5) * 12;
        const oy = (layout.cy / 100) * 280 + (Math.floor(c.i / 5) % 3 - 1) * 38 + (Math.random() - 0.5) * 10;
        const z = c.isCore ? 50 : c.isUnrelated ? -100 : 8;
        const scale = c.isCore ? 1.42 : 1;

        tl.to(
          c.el,
          {
            x: ox,
            y: oy,
            z,
            rotationY: 0,
            rotationX: 0,
            scale,
            duration: 1.0 + Math.random() * 0.25,
            ease: "power3.inOut",
          },
          0.3 + (c.i % 9) * 0.045
        );
      });

      tl.call(
        () => {
          discoveryHint.textContent = "相似款式聚集 · 无关项淡出…";
          cards.forEach((c) => {
            if (c.isUnrelated) {
              c.el.classList.add("is-fade");
              gsap.to(c.el, { opacity: 0.12, duration: 0.6 });
            }
            if (c.isCore) c.el.classList.add("is-core");
          });
        },
        null,
        1.0
      );

      tl.call(
        () => {
          clusterLabels.hidden = false;
          discoveryHint.textContent = "聚类完成 · SILHOUETTE / MATERIAL / STRUCTURE / COLOUR";
        },
        null,
        1.5
      );

      $$("#clusterLabels span").forEach((span, i) => {
        tl.call(() => span.classList.add("is-on"), null, 1.6 + i * 0.12);
      });

      tl.to({}, { duration: 0.45 });
    });
  }

  // --- Evidence lexicons & report builders (A–D) ----------------
  const INSUFFICIENT = "资料不足";

  const LEX_TREND = [
    ["oversized", "宽松加大"], ["boxy", "箱型"], ["slim", "修身"], ["fitted", "合身"],
    ["cropped", "短款"], ["longline", "长款"], ["layered", "层叠"], ["deconstructed", "解构"],
    ["minimal", "极简"], ["sculptural", "雕塑感"], ["volumetric", "体积感"], ["fluid", "流体"],
    ["tailored", "裁剪"], ["relaxed", "放松"], ["edgy", "锐利"], ["vintage", "复古"],
    ["y2k", "Y2K"], ["utilitarian", "机能"], ["romantic", "浪漫"], ["sporty", "运动"],
  ];
  const LEX_SILHOUETTE = [
    ["oversized", "加大廓形"], ["boxy", "箱型"], ["A-line", "A字"], ["column", "直筒"],
    ["hourglass", "沙漏"], ["cropped", "短廓形"], ["longline", "长廓形"], ["flare", "喇叭"],
    ["wide-leg", "阔腿"], ["barrel", "桶型"], ["slim", "修身"], ["cocoon", "茧型"],
    ["peplum", "鱼尾下摆"], ["trapeze", "梯形"], ["bomber", "飞行夹克廓形"],
    ["biker", "机车廓形"], ["moto", "机车"], ["blazer", "西装廓形"],
  ];
  const LEX_FABRIC = [
    ["leather", "皮革"], ["suede", "麂皮"], ["knit", "针织"], ["knitwear", "针织成衣"],
    ["cashmere", "羊绒"], ["wool", "羊毛"], ["linen", "亚麻"], ["satin", "缎面"],
    ["silk", "丝绸"], ["organza", "欧根纱"], ["chiffon", "雪纺"], ["denim", "牛仔"],
    ["cotton", "棉"], ["tweed", "粗花呢"], ["jersey", "针织汗布"], ["lace", "蕾丝"],
    ["shearling", "羊羔毛"], ["vinyl", "漆皮/乙烯"], ["mesh", "网眼"], ["tulle", "薄纱"],
  ];
  const LEX_COLOUR = [
    ["black", "黑"], ["white", "白"], ["ivory", "象牙白"], ["cream", "奶油"],
    ["burgundy", "酒红"], ["oxblood", "牛血红"], ["navy", "海军蓝"], ["brown", "棕"],
    ["tan", "驼色"], ["beige", "米色"], ["khaki", "卡其"], ["olive", "橄榄"],
    ["rust", "锈色"], ["butter", "黄油色"], ["silver", "银"], ["metallic", "金属色"],
    ["neon", "霓虹"], ["pastel", "粉彩"], ["monochrome", "单色"], ["neutral", "中性色"],
  ];
  const LEX_DETAIL = [
    ["asymmetric", "不对称"], ["hem", "下摆"], ["panel", "拼片"], ["zipper", "拉链"],
    ["zip", "拉链"], ["hardware", "五金"], ["belted", "腰带"], ["raw edge", "毛边"],
    ["raw-edge", "毛边"], ["pleat", "褶"], ["ruffle", "荷叶边"], ["cutout", "挖空"],
    ["slit", "开衩"], ["collar", "领型"], ["lapel", "驳领"], ["epaulette", "肩章"],
    ["pocket", "口袋"], ["quilted", "绗缝"], ["distressed", "做旧"], ["embellished", "装饰"],
    ["sheer", "透视"], ["lace-up", "系带"], ["buckle", "搭扣"], ["stud", "铆钉"],
  ];
  const LEX_CONSTRUCTION = [
    ["seamless", "无缝"], ["bonded", "贴合"], ["dart", "省道"], ["seam", "接缝"],
    ["bias", "斜裁"], ["drape", "垂坠"], ["structured", "结构化"], ["unstructured", "非结构化"],
    ["padded", "填充"], ["lined", "有里"], ["double-breasted", "双排扣"],
    ["single-breasted", "单排扣"], ["raglan", "插肩"], ["set-in", "装袖"],
    ["3D knit", "三维针织"], ["intarsia", "嵌花"], ["ribbed", "罗纹"],
  ];
  const LEX_SURFACE = [
    ["matte", "哑光"], ["glossy", "光泽"], ["patent", "漆面"], ["cracked", "裂纹"],
    ["textured", "肌理"], ["embossed", "压花"], ["perforated", "打孔"], ["washed", "水洗"],
    ["coated", "涂层"], ["metallic", "金属感"], ["sheer", "薄透"], ["opaque", "不透"],
  ];
  const LEX_MARKET = [
    ["runway", "秀场"], ["street style", "街拍"], ["ready-to-wear", "成衣"],
    ["rtw", "成衣"], ["couture", "高定"], ["retail", "零售"], ["resort", "度假系列"],
    ["pre-fall", "早秋"], ["SS27", "SS27"], ["SS26", "SS26"], ["FW26", "FW26"],
    ["AW26", "AW26"], ["Spring 2027", "2027春"], ["Fall 2026", "2026秋"],
  ];
  const BRAND_PATTERNS = [
    "Acne Studios", "Prada", "Miu Miu", "The Row", "Bottega Veneta", "Balenciaga",
    "Gucci", "Chanel", "Dior", "Louis Vuitton", "Saint Laurent", "YSL",
    "Alexander McQueen", "Givenchy", "Hermès", "Hermes", "Celine", "Céline",
    "Loewe", "Tod's", "Tod’s", "Max Mara", "Toteme", "Khaite", "The Frankie Shop",
    "COS", "Zara", "H&M", "Aritzia", "AllSaints", "Schott", "Belstaff",
    "Proenza Schouler", "Issey Miyake", "Comme des Garçons", "Rick Owens",
    "Maison Margiela", "Jil Sander", "Lemaire", "Courrèges", "Courreges",
    "Coperni", "Jacquemus", "Ganni", "Nanushka", "Stand Studio", "Agolde",
  ];

  const PRESET_FAMILY = [
    "SS27 Womenswear", "Women's Leather Jacket", "Innovative Knitwear",
    "Asymmetric Hemline", "Futuristic Minimalism", "SS27 Colour Trends",
    "Acne Studios SS27", "Trending Women's Trousers", "Experimental Textiles",
    "Gen Z Fashion Trends",
  ];

  function countLiveSources(payload) {
    if (!payload) return 0;
    const web = (payload.web && Array.isArray(payload.web.results) && payload.web.results.length) || 0;
    const rss = (payload.rss && Array.isArray(payload.rss.items) && payload.rss.items.length) || 0;
    return web + rss;
  }

  function deriveSeasonLabel(query, payload) {
    const blob = collectEvidenceCorpus(payload, query, []).join(" \n ");
    const q = String(query || "") + " " + blob;
    const m =
      q.match(/\b(SS|FW|AW|PF)\s*'?(\d{2})\b/i) ||
      q.match(/\b(Spring|Summer|Fall|Autumn|Winter)\s+(20\d{2})\b/i);
    if (m) {
      if (m[1] && /^(SS|FW|AW|PF)$/i.test(m[1])) return (m[1] + m[2]).toUpperCase();
      return `${m[1]} ${m[2]}`;
    }
    const y = q.match(/\b(20(?:2[4-9]|3\d))\b/);
    return y ? y[1] : "";
  }

  function deriveFocusLabel(query) {
    const q = String(query || "").toLowerCase();
    if (/leather|jacket|trouser|knit|hem|colour|color|textile/.test(q)) return "CATEGORY";
    if (/acne|prada|gucci|chanel|dior|brand/.test(q)) return "BRAND";
    if (/gen\s*z|consumer|market/.test(q)) return "MARKET";
    if (/womenswear|menswear|ss\d|fw\d/.test(q)) return "SEASON";
    return "GENERAL";
  }

  /** Titles + snippets + image titles from live payload only. */
  function collectEvidenceCorpus(payload, query, liveImages) {
    const texts = [];
    const web = (payload && payload.web) || {};
    (Array.isArray(web.results) ? web.results : []).forEach((r) => {
      if (!r) return;
      if (r.title) texts.push(String(r.title));
      const sn = r.content || r.snippet || "";
      if (sn) texts.push(String(sn));
    });
    const rss = (payload && payload.rss && payload.rss.items) || [];
    (Array.isArray(rss) ? rss : []).forEach((it) => {
      if (!it) return;
      if (it.title) texts.push(String(it.title));
      if (it.summary) texts.push(String(it.summary));
    });
    (Array.isArray(liveImages) ? liveImages : []).forEach((im) => {
      if (im && im.title) texts.push(String(im.title));
    });
    return texts;
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** Count case-insensitive phrase hits across corpus; return sorted {term, gloss, count, example}. */
  function scoreLexicon(lexicon, corpus, exampleTitles) {
    const blob = corpus.join(" \n ");
    const out = [];
    const seenTerm = new Set();
    lexicon.forEach(([term, gloss]) => {
      const t = term.toLowerCase();
      if (seenTerm.has(t)) return;
      seenTerm.add(t);
      let count = 0;
      if (t.includes(" ")) {
        const re = new RegExp(escapeRegExp(t), "gi");
        const m = blob.match(re);
        count = m ? m.length : 0;
      } else {
        const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(t)}(?:[^a-z0-9]|$)`, "gi");
        const m = blob.match(re);
        count = m ? m.length : 0;
      }
      if (count < 1) return;
      let example = "";
      for (let i = 0; i < (exampleTitles || []).length; i++) {
        if (String(exampleTitles[i]).toLowerCase().includes(t)) {
          example = String(exampleTitles[i]).slice(0, 90);
          break;
        }
      }
      out.push({ term, gloss: gloss || "", count, example });
    });
    out.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
    return out;
  }

  /** Hard evidence rules: never claim growth / mainstream from retrieval alone. */
  const FORBIDDEN_CLAIM_RE = /快速增长|市场主流|爆发式增长|销量激增|已成为主流|inevitable growth|rapidly growing|market mainstream/i;

  function sanitizeEvidenceText(text) {
    let t = String(text || "");
    if (FORBIDDEN_CLAIM_RE.test(t)) {
      t = t.replace(FORBIDDEN_CLAIM_RE, "[已移除无证据增长表述]");
    }
    return t;
  }

  /** Tier counts from cleaned payload items that contain a term. */
  function tierCoverageForTerm(term, payload) {
    const cleaned = (payload && payload.cleaned) || {};
    const tiers = { press: 0, brand: 0, ecommerce: 0, social: 0, other: 0 };
    const t = String(term || "").toLowerCase();
    if (!t) return tiers;
    const re = t.includes(" ")
      ? new RegExp(escapeRegExp(t), "i")
      : new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(t)}(?:[^a-z0-9]|$)`, "i");
    const scan = (items, titleKeys, snipKeys) => {
      (Array.isArray(items) ? items : []).forEach((it) => {
        if (!it) return;
        const blob = [
          ...(titleKeys || []).map((k) => it[k] || ""),
          ...(snipKeys || []).map((k) => it[k] || ""),
        ].join(" ");
        if (!re.test(blob)) return;
        const tier = it.source_tier || "other";
        if (tiers[tier] != null) tiers[tier] += 1;
        else tiers.other += 1;
      });
    };
    scan(cleaned.results, ["title"], ["content", "snippet"]);
    scan(cleaned.rss_items, ["title"], ["summary"]);
    // Fallback: raw web/rss without cleaned tiers → count as other
    if (!cleaned.results && !cleaned.rss_items) {
      const web = (payload && payload.web && payload.web.results) || [];
      const rss = (payload && payload.rss && payload.rss.items) || [];
      scan(web, ["title"], ["content", "snippet"]);
      scan(rss, ["title"], ["summary"]);
    }
    return tiers;
  }

  function formatTierCoverage(tiers) {
    if (!tiers) return "";
    const parts = [];
    ["press", "brand", "ecommerce", "social", "other"].forEach((k) => {
      const n = tiers[k] || 0;
      if (n > 0) parts.push(`${k} ${n}`);
    });
    return parts.length ? `来源: ${parts.join(" / ")}` : "";
  }

  function uniqueTierCount(tiers) {
    if (!tiers) return 0;
    return ["press", "brand", "ecommerce", "social", "other"].filter((k) => (tiers[k] || 0) > 0).length;
  }

  /** Format scored terms with 出现频率 ×N only; source tiers live in 来源覆盖 row. */
  function formatTermList(scored, limit, payload) {
    const lim = limit || 6;
    if (!scored.length) return INSUFFICIENT;
    return scored
      .slice(0, lim)
      .map((s) => {
        const base = s.gloss ? `${s.term}（${s.gloss}）` : s.term;
        const freq = typeof s.count === "number" ? ` ×${s.count}` : "";
        return sanitizeEvidenceText(`${base}${freq}`);
      })
      .join(" · ");
  }

  function extractBrands(corpus) {
    const blob = corpus.join(" \n ");
    const found = [];
    const seen = new Set();
    BRAND_PATTERNS.forEach((b) => {
      const re = new RegExp(escapeRegExp(b), "i");
      if (re.test(blob) && !seen.has(b.toLowerCase())) {
        seen.add(b.toLowerCase());
        found.push(b);
      }
    });
    return found;
  }

  function extractDateRange(payload, corpus) {
    const years = new Set();
    const seasons = new Set();
    const blob = corpus.join(" \n ");
    const yrRe = /\b(20(?:2[0-9]|3[0-5]))\b/g;
    let m;
    while ((m = yrRe.exec(blob))) years.add(m[1]);
    const seaRe = /\b((?:SS|FW|AW|PF)\s*'?\d{2}|(?:Spring|Summer|Fall|Autumn|Winter)\s+20\d{2})\b/gi;
    while ((m = seaRe.exec(blob))) seasons.add(m[1].replace(/\s+/g, " ").trim());

    const rss = (payload && payload.rss && payload.rss.items) || [];
    (Array.isArray(rss) ? rss : []).forEach((it) => {
      const d = it.published || it.date || it.pubDate || "";
      const ym = String(d).match(/(20\d{2})/);
      if (ym) years.add(ym[1]);
    });

    const parts = [];
    if (seasons.size) parts.push([...seasons].slice(0, 4).join(" · "));
    if (years.size) {
      const ys = [...years].sort();
      parts.push(ys.length === 1 ? ys[0] : `${ys[0]}–${ys[ys.length - 1]}`);
    }
    return parts.length ? parts.join(" / ") : INSUFFICIENT;
  }

  function topTitlePhrases(titles, limit) {
    // Use frequent content words from titles as "core trend" hints (evidence only)
    const stop = new Set([
      ...QUERY_STOPWORDS,
      "fashion", "style", "styles", "outfit", "outfits", "look", "looks",
      "how", "why", "what", "best", "new", "day", "week", "ideas", "ways",
      "shop", "buy", "guide", "here", "are", "was", "all", "about", "that",
      "your", "from", "with", "this", "season", "wear", "wearing", "worn",
    ]);
    const freq = new Map();
    titles.forEach((t) => {
      String(t)
        .split(/[^A-Za-z0-9'’-]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 2 && !stop.has(w.toLowerCase()))
        .forEach((w) => {
          const k = w.toLowerCase();
          freq.set(k, (freq.get(k) || 0) + 1);
        });
    });
    return [...freq.entries()]
      .filter(([, c]) => c >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit || 6)
      .map(([w, c]) => ({ term: w, count: c }));
  }

  /**
   * A. Trend Overview — bullets ONLY from live evidence.
   * Missing evidence → 资料不足 (never invent).
   */

  /** Overview hero strip: top related garment looks above evidence list. */
  function renderOverviewHeroStrip(liveImages, payload, query) {
    const strip = document.getElementById("overviewHeroStrip");
    if (!strip) return;

    let looks = pickGarmentImages(Array.isArray(liveImages) ? liveImages : []).slice(0, 6);
    if (!looks.length) {
      // Fallback: ranked collectLiveImages (still no picsum)
      const ranked = collectLiveImages(payload, query)
        .filter(
          (x) =>
            x &&
            x.src &&
            isAbsHttpUrl(x.src) &&
            !isNonGarmentNoise(x.src, x.title)
        )
        .slice()
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 6);
      looks = ranked;
    }

    strip.innerHTML = "";
    if (!looks.length) {
      strip.hidden = true;
      return;
    }

    strip.hidden = false;
    looks.forEach((im) => {
      const fig = document.createElement("figure");
      fig.className = "overview-hero-card";

      const img = document.createElement("img");
      img.src = im.src;
      img.alt = (im.title || "look").slice(0, 80);
      img.loading = "lazy";

      const cap = document.createElement("figcaption");
      const host = hostFromUrl(im.href || im.src) || im.source || "";
      const shortTitle = String(im.title || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 42);
      const titleBit = shortTitle
        ? shortTitle + (String(im.title || "").length > 42 ? "…" : "")
        : "";
      const bits = [titleBit, host].filter(Boolean);
      cap.textContent = bits.join(" · ") || "live look";

      if (im.href) {
        const a = document.createElement("a");
        a.href = im.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.appendChild(img);
        fig.appendChild(a);
      } else {
        fig.appendChild(img);
      }
      fig.appendChild(cap);
      strip.appendChild(fig);
    });
  }

  function buildTrendOverview(payload, query, liveImages) {
    const corpus = collectEvidenceCorpus(payload, query, liveImages);
    const titles = [];
    const web = (payload && payload.web) || {};
    (Array.isArray(web.results) ? web.results : []).forEach((r) => {
      if (r && r.title) titles.push(r.title);
    });
    ((payload && payload.rss && payload.rss.items) || []).forEach((it) => {
      if (it && it.title) titles.push(it.title);
    });
    (Array.isArray(liveImages) ? liveImages : []).forEach((im) => {
      if (im && im.title) titles.push(im.title);
    });

    const qLower = String(query || "").toLowerCase();
    const jacketBias = /leather|jacket|biker|bomber|moto/.test(qLower);

    const trendHits = scoreLexicon(LEX_TREND, corpus, titles);
    const featHits = scoreLexicon(
      jacketBias
        ? [...LEX_DETAIL, ...LEX_SILHOUETTE, ["biker", "机车"], ["bomber", "飞行夹克"], ["moto", "机车"]]
        : [...LEX_TREND, ...LEX_DETAIL],
      corpus,
      titles
    );
    const colourHits = scoreLexicon(LEX_COLOUR, corpus, titles);
    const fabricHits = scoreLexicon(LEX_FABRIC, corpus, titles);
    const silHits = scoreLexicon(LEX_SILHOUETTE, corpus, titles);
    const detailHits = scoreLexicon(LEX_DETAIL, corpus, titles);
    const marketHits = scoreLexicon(LEX_MARKET, corpus, titles);
    const brands = extractBrands(corpus);
    const dateRange = extractDateRange(payload, corpus);

    // Attach source-tier coverage from cleaned payload (出现频率 + 来源覆盖)
    const attachTiers = (hits) =>
      (hits || []).map((h) => ({
        ...h,
        tiers: tierCoverageForTerm(h.term, payload),
      }));
    const trendHitsT = attachTiers(trendHits);
    const featHitsT = attachTiers(featHits);
    const colourHitsT = attachTiers(colourHits);
    const fabricHitsT = attachTiers(fabricHits);
    const silHitsT = attachTiers(silHits);
    const detailHitsT = attachTiers(detailHits);
    const marketHitsT = attachTiers(marketHits);

    // Core trend: mix query-relevant lexicon + frequent title tokens that appear in corpus
    // Hard rule: never claim 快速增长 / 市场主流 — frequency ≠ growth.
    let coreTrend = formatTermList(trendHitsT, 5, payload);
    if (coreTrend === INSUFFICIENT) {
      const titleTerms = topTitlePhrases(titles, 5).filter((t) => t.count >= 2);
      if (titleTerms.length) {
        coreTrend = titleTerms
          .map((t) => {
            return `${t.term} ×${t.count}`;
          })
          .join(" · ");
      } else if (titles.length) {
        // At least surface top article themes without inventing — short titles only
        coreTrend = titles
          .slice(0, 3)
          .map((t) => {
            const short = cleanArticleTitle(t).slice(0, 48);
            return short;
          })
          .join(" · ");
      }
    }
    coreTrend = sanitizeEvidenceText(coreTrend);

    const brandMarket = [];
    if (brands.length) brandMarket.push(brands.slice(0, 8).join(" · "));
    if (marketHitsT.length) brandMarket.push(formatTermList(marketHitsT, 4, payload));
    const brandMarketVal = brandMarket.length
      ? sanitizeEvidenceText(brandMarket.join(" ｜ "))
      : INSUFFICIENT;

    // Coverage summary line from cleaned.stats
    const covStats = (payload && payload.cleaned && payload.cleaned.stats && payload.cleaned.stats.coverage_note) || null;
    let coverageSummary = INSUFFICIENT;
    if (covStats) {
      const parts = [];
      ["press", "brand", "ecommerce", "social", "other"].forEach((k) => {
        if (covStats[k]) parts.push(`${k} ${covStats[k]}`);
      });
      if (parts.length) coverageSummary = `来源覆盖 ${parts.join(" / ")}`;
    }

    return [
      { key: "core", label: "核心趋势（出现频率）", value: coreTrend },
      { key: "features", label: "主要设计特征", value: formatTermList(featHitsT, 6, payload) },
      { key: "colour", label: "代表性颜色", value: formatTermList(colourHitsT, 5, payload) },
      { key: "fabric", label: "相关面料", value: formatTermList(fabricHitsT, 5, payload) },
      { key: "silhouette", label: "典型廓形", value: formatTermList(silHitsT, 5, payload) },
      { key: "details", label: "主要设计细节", value: formatTermList(detailHitsT, 6, payload) },
      { key: "brands", label: "趋势涉及的品牌与市场", value: brandMarketVal },
      { key: "coverage", label: "来源覆盖", value: coverageSummary },
      { key: "dates", label: "资料的时间范围", value: dateRange },
    ];
  }

  function renderTrendOverview(bullets) {
    const list = document.getElementById("overviewList");
    if (!list) return;
    list.innerHTML = "";
    // Ensure disclaimer under Overview (Step 5 evidence rule)
    let disc = document.getElementById("overviewDisclaimer");
    if (!disc) {
      const section = document.getElementById("sectionOverview");
      disc = document.createElement("p");
      disc.id = "overviewDisclaimer";
      disc.className = "overview-disclaimer evidence-disclaimer";
      disc.textContent = "以下为检索证据摘要，出现频率不等于市场主流或增长趋势。";
      if (section) {
        const head = section.querySelector(".section-head");
        if (head && head.nextSibling) section.insertBefore(disc, head.nextSibling);
        else if (head) head.after(disc);
        else section.insertBefore(disc, list);
      }
    } else {
      disc.textContent = "以下为检索证据摘要，出现频率不等于市场主流或增长趋势。";
    }
    (bullets || []).forEach((b) => {
      const li = document.createElement("li");
      const rawVal = sanitizeEvidenceText(b.value || INSUFFICIENT);
      li.className = "overview-item" + (rawVal === INSUFFICIENT ? " is-insufficient" : "");
      const lab = document.createElement("span");
      lab.className = "overview-label";
      lab.textContent = b.label;
      const val = document.createElement("span");
      val.className = "overview-value";
      val.textContent = rawVal;
      li.appendChild(lab);
      li.appendChild(val);
      list.appendChild(li);
    });
  }

  /** B. Classify live images into runway / street / retail / editorial / social. */
  function classifyImageBucket(img) {
    const blob = `${(img && img.src) || ""} ${(img && img.href) || ""} ${(img && img.title) || ""} ${(img && img.source) || ""}`.toLowerCase();
    if (
      /assets\.vogue\.com|fashion-shows|\/look[-\s]?\d|\brunway\b|\brtw\b|ready-to-wear|wwd\.com.*(?:runway|rtw)/i.test(
        blob
      )
    ) {
      return "runway";
    }
    if (/street\s*style|off[-\s]?duty|streetstyle/i.test(blob)) return "street";
    if (/\bshop\b|\bproduct\b|\bbuy\b|\bstore\b|ssense|farfetch|net-a-porter|matchesfashion/i.test(blob)) {
      return "retail";
    }
    if (/editorial|campaign|lookbook|magazine|vogue\.com\/article|harpersbazaar|elle\.com/i.test(blob)) {
      return "editorial";
    }
    if (/instagram|tiktok|pinterest|social|facebook/i.test(blob)) return "social";
    // soft heuristics from host
    if (/vogue\.com|wwd\.com/.test(blob)) return "runway";
    return "editorial";
  }

  function hostFromUrl(u) {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch (_) {
      return "";
    }
  }

  function parseBrandFromTitle(title) {
    const t = String(title || "");
    for (let i = 0; i < BRAND_PATTERNS.length; i++) {
      const b = BRAND_PATTERNS[i];
      if (new RegExp(escapeRegExp(b), "i").test(t)) return b;
    }
    const parsed = typeof parseDesignerSeason === "function" ? parseDesignerSeason(t) : null;
    return (parsed && parsed.designer) || "";
  }

  function renderVisualReferences(liveImages) {
    const tabs = document.getElementById("visualTabs");
    const panels = document.getElementById("visualPanels");
    if (!tabs || !panels) return;
    tabs.innerHTML = "";
    panels.innerHTML = "";

    const buckets = {
      runway: { key: "runway", label: "Runway", labelZh: "秀场", items: [] },
      street: { key: "street", label: "Street Style", labelZh: "街拍", items: [] },
      retail: { key: "retail", label: "Retail", labelZh: "零售", items: [] },
      editorial: { key: "editorial", label: "Editorial", labelZh: "编辑", items: [] },
      social: { key: "social", label: "Social Media", labelZh: "社交", items: [] },
    };

    const garments = pickGarmentImages(Array.isArray(liveImages) ? liveImages : []);
    const pool = garments.length
      ? garments
      : (Array.isArray(liveImages) ? liveImages : []).filter((x) => x && x.src);

    pool.forEach((im) => {
      const b = classifyImageBucket(im);
      if (buckets[b]) buckets[b].items.push(im);
    });

    // Prefer runway fill for empty others — do not invent URLs
    const runwayItems = buckets.runway.items;
    ["street", "retail", "editorial", "social"].forEach((k) => {
      if (!buckets[k].items.length && runwayItems.length) {
        // demote: leave empty (hide) rather than duplicate unless ALL empty except runway
      }
    });

    const order = ["runway", "street", "retail", "editorial", "social"];
    const visible = order.filter((k) => buckets[k].items.length > 0);
    // If only some empty, hide them. If everything empty, show empty state.
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "section-empty";
      empty.textContent = "暂无可用实况图片 · 资料不足";
      panels.appendChild(empty);
      return;
    }

    let active = visible[0];
    visible.forEach((k) => {
      const b = buckets[k];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "visual-tab" + (k === active ? " is-active" : "");
      btn.setAttribute("role", "tab");
      btn.dataset.bucket = k;
      btn.innerHTML = `<span class="vt-en">${b.label}</span><span class="vt-zh">${b.labelZh}</span><span class="vt-n">${b.items.length}</span>`;
      btn.addEventListener("click", () => {
        active = k;
        tabs.querySelectorAll(".visual-tab").forEach((el) => {
          el.classList.toggle("is-active", el.dataset.bucket === k);
        });
        panels.querySelectorAll(".visual-panel").forEach((el) => {
          el.hidden = el.dataset.bucket !== k;
        });
      });
      tabs.appendChild(btn);

      const panel = document.createElement("div");
      panel.className = "visual-panel";
      panel.dataset.bucket = k;
      panel.hidden = k !== active;
      const grid = document.createElement("div");
      grid.className = "visual-grid";
      b.items.slice(0, 12).forEach((im) => {
        const fig = document.createElement("figure");
        fig.className = "visual-card";
        const img = document.createElement("img");
        img.src = im.src;
        img.alt = (im.title || "visual").slice(0, 80);
        img.loading = "lazy";
        const cap = document.createElement("figcaption");
        const host = hostFromUrl(im.href || im.src) || im.source || "";
        const brand = parseBrandFromTitle(im.title);
        const bits = [host, brand, (im.title || "").slice(0, 60)].filter(Boolean);
        cap.textContent = bits.join(" · ");
        if (im.href) {
          const a = document.createElement("a");
          a.href = im.href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.appendChild(img);
          fig.appendChild(a);
        } else {
          fig.appendChild(img);
        }
        fig.appendChild(cap);
        grid.appendChild(fig);
      });
      panel.appendChild(grid);
      panels.appendChild(panel);
    });
  }

  /**
   * C. Key Findings — silhouette / construction / details / surface / colour
   * Only terms with count≥1 from real text. Jacket query biases lexicons.
   */
  function buildKeyFindings(payload, query, liveImages) {
    const corpus = collectEvidenceCorpus(payload, query, liveImages);
    const titles = [];
    const web = (payload && payload.web) || {};
    (Array.isArray(web.results) ? web.results : []).forEach((r) => {
      if (r && r.title) titles.push(r.title);
    });
    const qLower = String(query || "").toLowerCase();
    const jacketBias = /leather|jacket|biker|bomber|moto/.test(qLower);

    const silLex = jacketBias
      ? [...LEX_SILHOUETTE, ["biker", "机车"], ["bomber", "飞行"], ["moto", "机车夹克"], ["oversized", "加大"]]
      : LEX_SILHOUETTE;
    const detailLex = jacketBias
      ? [...LEX_DETAIL, ["zipper", "拉链"], ["hardware", "五金"], ["collar", "领"], ["lapel", "驳领"]]
      : LEX_DETAIL;

    const withTiers = (items) =>
      (items || []).map((it) => ({
        ...it,
        tiers: tierCoverageForTerm(it.term, payload),
      }));

    return [
      { key: "silhouette", label: "廓形", labelEn: "Silhouette", items: withTiers(scoreLexicon(silLex, corpus, titles)) },
      { key: "construction", label: "结构", labelEn: "Construction", items: withTiers(scoreLexicon(LEX_CONSTRUCTION, corpus, titles)) },
      { key: "details", label: "细节", labelEn: "Details", items: withTiers(scoreLexicon(detailLex, corpus, titles)) },
      { key: "surface", label: "表面", labelEn: "Surface", items: withTiers(scoreLexicon(LEX_SURFACE, corpus, titles)) },
      { key: "colour", label: "颜色", labelEn: "Colour", items: withTiers(scoreLexicon(LEX_COLOUR, corpus, titles)) },
    ];
  }

  function renderKeyFindings(groups) {
    const root = document.getElementById("findingsGroups");
    if (!root) return;
    root.innerHTML = "";
    let any = false;
    (groups || []).forEach((g) => {
      const items = (g.items || []).filter((x) => x.count >= 1);
      const block = document.createElement("div");
      block.className = "findings-group";
      const h = document.createElement("h4");
      h.innerHTML = `<span class="fg-zh">${g.label}</span> <span class="fg-en">${g.labelEn}</span>`;
      block.appendChild(h);
      const row = document.createElement("div");
      row.className = "findings-chips";
      if (!items.length) {
        const empty = document.createElement("span");
        empty.className = "findings-empty";
        empty.textContent = INSUFFICIENT;
        row.appendChild(empty);
      } else {
        any = true;
        const taxTerms = matchedTaxTerms();
        items.slice(0, 10).forEach((it) => {
          const chip = document.createElement("span");
          const termLow = String((it && it.term) || "").toLowerCase();
          const hit = taxTerms.has(termLow) || [...taxTerms].some((t) => termLow.includes(t) || t.includes(termLow));
          const cov = formatTierCoverage(it.tiers);
          const single = uniqueTierCount(it.tiers) <= 1;
          chip.className = "finding-chip" + (hit ? " is-tax-match" : "");
          chip.title = [it.example || "", cov, single ? "单源出现，仅供参考" : ""]
            .filter(Boolean)
            .join(" · ");
          chip.innerHTML = `<em>${it.term}</em><b>×${it.count}</b>${
            it.gloss ? `<i>${it.gloss}</i>` : ""
          }`;
          row.appendChild(chip);
        });
      }
      block.appendChild(row);
      root.appendChild(block);
    });
    if (!any) {
      const note = document.createElement("p");
      note.className = "section-empty";
      note.textContent = "当前检索文本中未匹配到设计属性词 · 资料不足";
      root.appendChild(note);
    }
  }

  /**
   * D. Related searches — evidence terms + transparent query expansions.
   * Mark 来自资料 vs 延伸.
   */
  function buildRelatedSearches(query, findings, payload) {
    const q = String(query || "").trim() || "Fashion";
    const out = [];
    const seen = new Set();
    const push = (text, kind) => {
      const t = String(text || "").replace(/\s+/g, " ").trim();
      if (!t || t.length < 3) return;
      const key = t.toLowerCase();
      if (seen.has(key) || key === q.toLowerCase()) return;
      seen.add(key);
      out.push({ text: t, kind: kind || "延伸" });
    };

    // Evidence-based from findings
    (findings || []).forEach((g) => {
      (g.items || []).slice(0, 3).forEach((it) => {
        if (it.count >= 1) push(`${q} ${it.term}`, "来自资料");
      });
    });

    // Evidence brands / market tokens from corpus
    const corpus = collectEvidenceCorpus(payload, query, []);
    extractBrands(corpus)
      .slice(0, 3)
      .forEach((b) => push(`${b} ${q.split(/\s+/).slice(-1)[0] || q}`, "来自资料"));

    scoreLexicon(LEX_FABRIC, corpus, [])
      .slice(0, 2)
      .forEach((f) => push(`${f.term} ${q}`, "来自资料"));

    // Morphological / family expansions — labeled 延伸
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length) {
      const last = tokens[tokens.length - 1];
      push(`${q} runway`, "延伸");
      push(`${q} street style`, "延伸");
      push(`SS27 ${last}`, "延伸");
      if (/knit/i.test(q)) {
        push("3D Knit", "延伸");
        push("Sculptural Knitwear", "延伸");
      }
      if (/leather|jacket/i.test(q)) {
        push("Oversized Leather Jacket", "延伸");
        push("Leather Bomber Jacket", "延伸");
        push("Biker Jacket Details", "延伸");
      }
      if (/asymmetric|hem/i.test(q)) {
        push("Asymmetric Skirt Hem", "延伸");
        push("Diagonal Hem Dress", "延伸");
      }
    }

    // Preset family neighbors (延伸)
    PRESET_FAMILY.forEach((p) => {
      if (p.toLowerCase() !== q.toLowerCase() && out.length < 10) push(p, "延伸");
    });

    return out.slice(0, 10);
  }

  function renderRelatedSearches(items) {
    const root = document.getElementById("relatedChips");
    if (!root) return;
    root.innerHTML = "";
    (items || []).forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "related-chip" + (it.kind === "来自资料" ? " is-evidence" : " is-extend");
      btn.innerHTML = `<span class="rc-kind">${it.kind === "来自资料" ? "来自资料" : "延伸建议"}</span><span class="rc-q">${it.text}</span>`;
      btn.addEventListener("click", () => {
        if (searchInput) searchInput.value = it.text;
        runPipeline(it.text);
      });
      root.appendChild(btn);
    });
  }

    // --- Phase 3: Report ------------------------------------------
  function runReportPhase(query) {
    return new Promise((resolve) => {
      hide(phaseDiscovery);
      show(phaseReport);
      // Archive lives inside #reportArticle; clear its own [hidden] so it appears with the report.
      if (phaseArchive) phaseArchive.hidden = false;
      window.scrollTo(0, 0);

      const liveImages = collectLiveImages(lastSearchPayload, query);
      applyReportCopy(query, lastSearchPayload);
      const overview = buildTrendOverview(lastSearchPayload, query, liveImages);
      renderTrendOverview(overview);
      renderOverviewHeroStrip(liveImages, lastSearchPayload, query);
      renderVisualReferences(liveImages);
      const findings = buildKeyFindings(lastSearchPayload, query, liveImages);
      renderKeyFindings(findings);
      renderRelatedSearches(buildRelatedSearches(query, findings, lastSearchPayload));
      hydrateSources(lastSearchPayload);
      renderSourcesImageStrip(liveImages);
      const coreStyles = extractCoreStyles(lastSearchPayload, query, liveImages);
      renderCoreStyles(coreStyles);
      buildArchive(query, liveImages);

      const enters = $$(".report-enter");

      if (typeof gsap === "undefined" || reducedMotion) {
        enters.forEach((el) => {
          el.style.opacity = "1";
          el.style.transform = "none";
        });
        setupArchiveScroll();
        resolve();
        return;
      }

      gsap.set(enters, { opacity: 0, y: 32 });

      const tl = gsap.timeline({
        onComplete: () => {
          setupArchiveScroll();
          resolve();
        },
      });
      activeTimeline = tl;

      tl.to(enters, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        stagger: 0.12,
        ease: "power3.out",
      });
    });
  }

  // --- Archive waterfall ----------------------------------------
  function buildArchive(query, liveImages) {
    archiveGrid.innerHTML = "";
    const cols = 4;
    const columns = [];
    for (let c = 0; c < cols; c++) {
      const col = document.createElement("div");
      col.className = "archive-col";
      col.dataset.col = String(c);
      archiveGrid.appendChild(col);
      columns.push(col);
    }

    const seedBase = query.replace(/\s+/g, "-").toLowerCase() || "arch";
    const heights = ["tall", "mid", "short", "mid", "tall", "short"];
    const live = Array.isArray(liveImages) ? liveImages.slice(0, 24) : [];
    const liveCount = live.length;
    // Only pad with picsum when there are zero live related images
    const usePicsumFallback = liveCount === 0;
    const total = usePicsumFallback ? 20 : liveCount;
    const archSub = document.getElementById("archiveSub");
    if (archSub) {
      archSub.textContent = liveCount
        ? `${liveCount} 张强相关实况图`
        : "相关视觉瀑布流 · Demo imagery";
    }

    for (let i = 0; i < total; i++) {
      const col = columns[i % cols];
      const item = document.createElement("article");
      const hClass = heights[i % heights.length];
      item.className = `archive-item archive-item--${hClass}`;

      const liveItem = usePicsumFallback ? null : live[i];
      const h = hClass === "tall" ? 420 : hClass === "mid" ? 300 : 220;
      const img = document.createElement("img");
      const demoTitle = ARCHIVE_TITLES[i % ARCHIVE_TITLES.length];
      const titleText = liveItem && liveItem.title ? liveItem.title : demoTitle;
      const imgSrc =
        (liveItem && liveItem.src) ||
        imgUrl(`${seedBase}-arch-${i}`, 400, h);
      img.src = imgSrc;
      img.alt = liveItem
        ? `${titleText} (${liveItem.source || "live"})`
        : `${demoTitle} (demo)`;
      img.loading = "lazy";

      const title = document.createElement("div");
      title.className = "item-title";
      title.textContent = titleText;

      item.appendChild(img);
      item.appendChild(title);
      if (liveItem && liveItem.source) {
        const srcLabel = document.createElement("div");
        srcLabel.className = "item-source";
        srcLabel.textContent = liveItem.source;
        item.appendChild(srcLabel);
      }

      item.addEventListener("click", () => {
        if (liveItem && liveItem.href) {
          window.open(liveItem.href, "_blank", "noopener,noreferrer");
          return;
        }
        openDetail(img.src, [
          DETAIL_TAGS[i % DETAIL_TAGS.length],
          DETAIL_TAGS[(i + 2) % DETAIL_TAGS.length],
          `#${demoTitle.split(" ")[0]}`,
        ]);
      });
      col.appendChild(item);
    }
  }

  function setupArchiveScroll() {
    const cols = $$(".archive-col", archiveGrid);
    const items = $$(".archive-item", archiveGrid);

    if (reducedMotion || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
      items.forEach((item) => item.classList.add("is-revealed"));
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Column parallax — different speeds (Codrops grid scroll spirit)
    cols.forEach((col, i) => {
      const speed = [0.12, -0.08, 0.18, -0.14][i] || 0.1;
      const st = gsap.to(col, {
        y: () => speed * 180,
        ease: "none",
        scrollTrigger: {
          trigger: archiveGrid,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
      scrollTriggers.push(st);
    });

    // Per-item reveal: blur→clear, scale settle, title slide up — staggered by column
    items.forEach((item, i) => {
      const colIndex = i % 4;
      const st = ScrollTrigger.create({
        trigger: item,
        start: "top 92%",
        end: "top 55%",
        onEnter: () => {
          // Stagger delay by column for rhythm
          gsap.delayedCall(colIndex * 0.08, () => {
            item.classList.add("is-revealed");
          });
        },
        onEnterBack: () => item.classList.add("is-revealed"),
      });
      scrollTriggers.push(st);
    });
  }

  // --- Detail overlay -------------------------------------------
  function openDetail(src, tags) {
    detailImg.src = src;
    detailTags.innerHTML = "";
    tags.forEach((t) => {
      const span = document.createElement("span");
      span.textContent = t;
      detailTags.appendChild(span);
    });
    show(detailOverlay);

    if (typeof gsap === "undefined" || reducedMotion) {
      detailScan.style.opacity = "0";
      $$("span", detailTags).forEach((s) => {
        s.style.opacity = "1";
        s.style.transform = "none";
      });
      return;
    }

    gsap.set(detailScan, { top: "0%", opacity: 1 });
    gsap.fromTo(
      detailScan,
      { top: "0%", opacity: 1 },
      { top: "100%", opacity: 0.4, duration: 1.1, ease: "power1.inOut" }
    );
    gsap.fromTo(
      $$("span", detailTags),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, delay: 0.55, ease: "power2.out" }
    );
  }

  function closeDetail() {
    hide(detailOverlay);
  }

  // --- Pipeline -------------------------------------------------
  function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ __timeout: true }), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function runPipeline(query) {
    const q = (query || "").trim() || "SS27 Experimental Womenswear";
    killTimeline();
    closeDetail();
    lastSearchPayload = null;
    liveImageRetryDone.clear();

    // Wait for API probe so we never skip live search due to a race on apiBase
    if (apiReady) {
      try {
        await apiReady;
      } catch (_) {
        /* ignore */
      }
    }

    // Kick off live search immediately after apiReady; keep ref for late hot-swap
    const searchPromise =
      apiBase !== null
        ? fetchSearch(q).then((data) => {
            lastSearchPayload = data;
            return data;
          })
        : Promise.resolve(null);
    activeSearchPromise = searchPromise;

    // Hot-swap if search settles while scan/3D already visible (safety net)
    searchPromise.then((data) => {
      if (!data || activeSearchPromise !== searchPromise) return;
      applyParseFromPayload(data, q);
      const imgs = collectLiveImages(data, q);
      updateLiveImgBadge(imgs);
      const phasesShowing =
        (phaseScan && !phaseScan.hidden) ||
        (phaseDiscovery && !phaseDiscovery.hidden) ||
        (phaseReport && !phaseReport.hidden);
      if (phasesShowing) applyLiveImagesToDom(imgs);
    });

    // Await FULL search before scan/discovery. Do NOT proceed with null payload
    // when apiBase is set — dual Tavily often needs 10–20s+; short races left liveImages empty.
    if (apiBase !== null) {
      const raced = await withTimeout(searchPromise, 45000);
      if (raced && raced.__timeout) {
        // Soft cap hit: still wait for fetchSearch to settle; never start with null
        await searchPromise;
      }
    } else {
      await searchPromise;
    }

    applyParseFromPayload(lastSearchPayload, q);
    let liveImages = collectLiveImages(lastSearchPayload, q);
    updateLiveImgBadge(liveImages);

    // If garments empty but API up: Chinese note + one retry before phases
    liveImages = await ensureLiveImages(q, liveImages);

    await runScanPhase(q, liveImages);

    // Discovery: if still empty looks with API, retry once more then rebuild
    let discoveryImages = liveImages;
    if (apiBase !== null && !pickGarmentImages(discoveryImages).length) {
      if (discoveryHint) discoveryHint.textContent = "正在拉取秀场图…";
      discoveryImages = await ensureLiveImages(q, discoveryImages);
    }
    await runDiscoveryPhase(q, discoveryImages);
    applyLiveImagesToDom(collectLiveImages(lastSearchPayload, q));

    await searchPromise; // already settled when apiBase set; no-op settle
    await runReportPhase(q);
  }

  function resetToLanding() {
    killTimeline();
    closeDetail();
    if (typeof closeOrbitMode === "function") closeOrbitMode({ silent: true });
    hide(phaseScan);
    hide(phaseDiscovery);
    hide(phaseReport);
    hide(phaseArchive);
    hide(phaseOrbit);
    show(landing);
    window.scrollTo(0, 0);
    searchInput.focus();
  }

  // --- Landing intro (brief, one-time) --------------------------
  function landingIntro() {
    if (reducedMotion || typeof gsap === "undefined") return;
    const lines = $$(".hero-line");
    const sub = $(".hero-sub");
    const form = $(".search-form");
    const chips = $(".preset-chips");
    gsap.from([lines, sub, form, chips], {
      opacity: 0,
      y: 22,
      duration: 0.9,
      stagger: 0.1,
      ease: "power3.out",
      delay: 0.1,
    });
  }


  // --- Orbit mode (Atelier-style category ring) -----------------
  const ORBIT_CATEGORIES = [
    { id: "tops", en: "Tops", zh: "上衣", query: "Women's Tops Trends" },
    { id: "shirts-blouses", en: "Shirts & Blouses", zh: "衬衫与罩衫", query: "Women's Shirts & Blouses Trends" },
    { id: "knitwear", en: "Knitwear", zh: "针织", query: "Women's Knitwear Trends" },
    { id: "jackets", en: "Jackets", zh: "夹克", query: "Women's Jacket Trends" },
    { id: "coats", en: "Coats", zh: "大衣", query: "Women's Coat Trends" },
    { id: "trousers", en: "Trousers", zh: "裤装", query: "Women's Trousers Trends" },
    { id: "skirts", en: "Skirts", zh: "裙装", query: "Women's Skirt Trends" },
    { id: "dresses", en: "Dresses", zh: "连衣裙", query: "Women's Dress Trends" },
    { id: "denim", en: "Denim", zh: "牛仔", query: "Women's Denim Trends" },
    { id: "tailoring", en: "Tailoring", zh: "正装裁剪", query: "Women's Tailoring Trends" },
    { id: "sportswear", en: "Sportswear", zh: "运动装", query: "Women's Sportswear Trends" },
    { id: "swimwear", en: "Swimwear", zh: "泳装", query: "Women's Swimwear Trends" },
    { id: "resortwear", en: "Resortwear", zh: "度假装", query: "Women's Resortwear Trends" },
    { id: "accessories", en: "Accessories", zh: "配饰", query: "Women's Accessories Trends" },
  ];

  // Extra garment silhouettes filling the ring (map → category or own query)
  const ORBIT_GARMENTS = [
    { id: "tee", en: "Tee", zh: "T恤", map: "tops" },
    { id: "tank", en: "Tank", zh: "背心", map: "tops" },
    { id: "blouse", en: "Blouse", zh: "罩衫", map: "shirts-blouses" },
    { id: "turtleneck", en: "Turtleneck", zh: "高领", map: "knitwear" },
    { id: "hoodie", en: "Hoodie", zh: "连帽衫", map: "sportswear" },
    { id: "cardigan", en: "Cardigan", zh: "开衫", map: "knitwear" },
    { id: "blazer", en: "Blazer", zh: "西装外套", map: "tailoring" },
    { id: "trench", en: "Trench", zh: "风衣", map: "coats" },
    { id: "puffer", en: "Puffer", zh: "羽绒服", map: "coats" },
    { id: "leather-jacket", en: "Leather Jacket", zh: "皮夹克", map: "jackets" },
    { id: "jeans", en: "Jeans", zh: "牛仔裤", map: "denim" },
    { id: "wide-leg", en: "Wide-leg", zh: "阔腿裤", map: "trousers" },
    { id: "cargo", en: "Cargo", zh: "工装裤", map: "trousers" },
    { id: "shorts", en: "Shorts", zh: "短裤", map: "sportswear" },
    { id: "mini-skirt", en: "Mini Skirt", zh: "短裙", map: "skirts" },
    { id: "midi-skirt", en: "Midi Skirt", zh: "中长裙", map: "skirts" },
    { id: "pencil-skirt", en: "Pencil Skirt", zh: "铅笔裙", map: "skirts" },
    { id: "slip-dress", en: "Slip Dress", zh: "吊带裙", map: "dresses" },
    { id: "shirt-dress", en: "Shirt Dress", zh: "衬衫裙", map: "dresses" },
    { id: "jumpsuit", en: "Jumpsuit", zh: "连体裤", map: "resortwear" },
    { id: "scarf", en: "Scarf", zh: "围巾", map: "accessories" },
    { id: "belt", en: "Belt", zh: "腰带", map: "accessories" },
    { id: "heel", en: "Heel", zh: "高跟鞋", map: "accessories" },
    { id: "sneaker", en: "Sneaker", zh: "运动鞋", map: "accessories" },
    { id: "tote", en: "Tote", zh: "托特包", map: "accessories" },
    { id: "hat", en: "Hat", zh: "帽饰", map: "accessories" },
    { id: "gloves", en: "Gloves", zh: "手套", map: "accessories" },
    { id: "boots", en: "Boots", zh: "靴履", map: "accessories" },
  ];

  function garmentToSearch(g) {
    if (!g) return null;
    if (g.query) return g;
    if (g.map) {
      const cat = ORBIT_CATEGORIES.find((c) => c.id === g.map);
      if (cat) {
        return {
          id: g.id,
          en: g.en,
          zh: g.zh,
          query: cat.query,
          mapLabel: cat.zh,
        };
      }
    }
    return {
      id: g.id,
      en: g.en,
      zh: g.zh,
      query: `Women's ${g.en} Trends`,
    };
  }

  let orbitState = null;
  const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.min.js";

  async function ensureThree() {
    if (typeof window.THREE !== "undefined" && window.THREE.WebGLRenderer) return true;
    try {
      const mod = await import(THREE_CDN);
      window.THREE = mod;
      return !!(mod && mod.WebGLRenderer);
    } catch (err) {
      console.warn("THREE load failed", err);
      return false;
    }
  }

  function silhouetteUrl(id) {
    return `assets/orbit-silhouettes/${id}.svg`;
  }

  function makeFrameTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 256, 512);
    ctx.fillStyle = "rgba(232, 223, 208, 0.045)";
    ctx.fillRect(26, 36, 204, 440);
    ctx.strokeStyle = "rgba(232, 223, 208, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(26.5, 36.5, 203, 439);
    ctx.strokeStyle = "rgba(232, 223, 208, 0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(38.5, 48.5, 179, 415);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  function loadSilhouetteTexture(id) {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        silhouetteUrl(id),
        (tex) => {
          if ("SRGBColorSpace" in THREE) tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          resolve(tex);
        },
        undefined,
        () => {
          const c = document.createElement("canvas");
          c.width = 256;
          c.height = 512;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "rgba(232, 224, 212, 0.85)";
          ctx.beginPath();
          ctx.ellipse(128, 220, 40, 80, 0, 0, Math.PI * 2);
          ctx.fill();
          const t = new THREE.CanvasTexture(c);
          t.needsUpdate = true;
          resolve(t);
        }
      );
    });
  }

  function disposeOrbit() {
    if (!orbitState) return;
    const s = orbitState;
    cancelAnimationFrame(s.raf);
    window.removeEventListener("resize", s.onResize);
    if (s.canvas) {
      s.canvas.removeEventListener("pointerdown", s.onPointerDown);
      s.canvas.removeEventListener("pointermove", s.onPointerMove);
      s.canvas.removeEventListener("pointerup", s.onPointerUp);
      s.canvas.removeEventListener("pointercancel", s.onPointerUp);
      s.canvas.removeEventListener("pointerleave", s.onPointerLeave);
      s.canvas.removeEventListener("click", s.onClick);
    }
    if (s.renderer) {
      s.renderer.dispose();
      s.renderer.forceContextLoss?.();
    }
    if (s.scene) {
      s.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    }
    const hud = document.getElementById("orbitHud");
    if (hud) hud.hidden = true;
    orbitState = null;
  }

  function setOrbitHud(item) {
    const hud = document.getElementById("orbitHud");
    const zh = document.getElementById("orbitHudZh");
    const en = document.getElementById("orbitHudEn");
    if (!hud) return;
    if (!item) {
      hud.hidden = true;
      return;
    }
    if (zh) zh.textContent = item.zh || "";
    if (en) en.textContent = item.en || "";
    hud.hidden = false;
  }

  function buildOrbitFallback() {
    const list = document.getElementById("orbitFallbackList");
    const fallback = document.getElementById("orbitFallback");
    const canvas = document.getElementById("orbitCanvas");
    if (!list || !fallback) return;
    list.innerHTML = "";
    const items = [
      ...ORBIT_CATEGORIES.map((c) => ({ ...c, kind: "category" })),
      ...ORBIT_GARMENTS.slice(0, 12).map((g) => ({ ...garmentToSearch(g), kind: "garment" })),
    ];
    items.forEach((cat) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      const sid = cat.id;
      btn.innerHTML =
        `<img class="orbit-fallback-icon" src="${silhouetteUrl(sid)}" alt="" width="36" height="56" />` +
        `<span class="orbit-fallback-text">` +
        `<span class="orbit-fallback-zh">${cat.zh}</span>` +
        `<span class="orbit-fallback-en">${cat.en}</span>` +
        `</span>`;
      btn.addEventListener("click", () => confirmOrbitCategory(cat));
      li.appendChild(btn);
      list.appendChild(li);
    });
    fallback.hidden = false;
    if (canvas) canvas.style.display = "none";
    const stage = document.getElementById("orbitStage");
    if (stage) stage.style.cursor = "default";
    const hint = document.getElementById("orbitHint");
    if (hint) hint.textContent = "点击品类开始搜索";
  }

  function addWireCage(root, radius, height) {
    const cream = 0xe8dfd0;
    const ringYs = [-height * 0.5, -height * 0.28, -0.05, height * 0.22, height * 0.42, height * 0.55];
    const ringRadii = [radius * 1.04, radius * 0.94, radius * 1.08, radius * 0.98, radius * 1.02, radius * 0.9];
    ringYs.forEach((y, i) => {
      const r = ringRadii[i];
      const pts = [];
      const seg = 72;
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      root.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({
            color: cream,
            transparent: true,
            opacity: i === 2 || i === 3 ? 0.34 : 0.14,
          })
        )
      );
    });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      root.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, -height * 0.52, z),
            new THREE.Vector3(x, height * 0.55, z),
          ]),
          new THREE.LineBasicMaterial({ color: cream, transparent: true, opacity: 0.09 })
        )
      );
    }
    const cyl = new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, height * 1.12, 56, 1, true);
    root.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(cyl, 10),
        new THREE.LineBasicMaterial({ color: cream, transparent: true, opacity: 0.12 })
      )
    );
  }

  function makeWireSlab(w, h, opacity) {
    return new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, 0.028)),
      new THREE.LineBasicMaterial({ color: 0xe8dfd0, transparent: true, opacity })
    );
  }

  async function initOrbitScene() {
    const canvas = document.getElementById("orbitCanvas");
    const stage = document.getElementById("orbitStage");
    const azimuthEl = document.getElementById("orbitAzimuth");
    const fallback = document.getElementById("orbitFallback");
    if (!canvas || !stage || typeof THREE === "undefined") {
      buildOrbitFallback();
      return;
    }
    if (fallback) fallback.hidden = true;
    canvas.style.display = "block";
    stage.style.cursor = "grab";

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.052);

    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 140);
    const camHome = new THREE.Vector3(0, 0.62, 7.35);
    camera.position.copy(camHome);
    camera.lookAt(0, 0.12, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const root = new THREE.Group();
    scene.add(root);

    // Starfield + twinkle metadata
    let starPoints = null;
    let starBaseOpacity = 0.48;
    {
      const count = 1400;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = 15 + Math.random() * 45;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.48;
        pos[i * 3 + 2] = r * Math.cos(phi);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xe8dfd0,
        size: 0.03,
        transparent: true,
        opacity: starBaseOpacity,
        depthWrite: false,
        sizeAttenuation: true,
      });
      starPoints = new THREE.Points(geo, mat);
      scene.add(starPoints);
    }

    // Nucleus denser
    let nucleusMat = null;
    {
      const count = 3200;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1.42 * Math.cbrt(Math.random());
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      nucleusMat = new THREE.PointsMaterial({
        color: 0xe8dfd0,
        size: 0.024,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        sizeAttenuation: true,
      });
      root.add(new THREE.Points(geo, nucleusMat));
    }

    addWireCage(root, 3.4, 4.8);

    const frameTex = makeFrameTexture();
    const slabMeshes = [];
    const slabGroups = [];
    const decoAnchors = [];

    // Build item queue: categories first, then garments for density
    const allItems = [
      ...ORBIT_CATEGORIES.map((c) => ({ ...c, kind: "category", silId: c.id })),
      ...ORBIT_GARMENTS.map((g) => {
        const mapped = garmentToSearch(g);
        return { ...mapped, kind: "garment", silId: g.id, map: g.map };
      }),
    ];

    const uniqueIds = [...new Set(allItems.map((i) => i.silId))];
    const texMap = {};
    await Promise.all(
      uniqueIds.map(async (id) => {
        texMap[id] = await loadSilhouetteTexture(id);
      })
    );

    function placeSlab(item, angle, y, radius, scale, opts = {}) {
      const group = new THREE.Group();
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      group.position.set(x, y, z);
      group.lookAt(0, y, 0);
      group.rotateY(Math.PI);

      const hJitter = opts.hJitter || 1;
      const w = 0.62 * scale;
      const h = 1.28 * scale * hJitter;

      const frameMat = new THREE.MeshBasicMaterial({
        map: frameTex,
        transparent: true,
        opacity: opts.frameOpacity ?? 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), frameMat));

      const silMat = new THREE.MeshBasicMaterial({
        map: texMap[item.silId] || texMap.tops,
        transparent: true,
        opacity: opts.silOpacity ?? 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const sil = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.76), silMat);
      sil.position.z = 0.02;
      group.add(sil);

      const wire = makeWireSlab(w * 1.02, h * 1.02, opts.wireOpacity ?? 0.38);
      group.add(wire);

      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 1.12, h * 1.12),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      hit.position.z = 0.04;
      hit.userData.item = item;
      hit.userData.category = item; // confirmOrbitCategory compatible
      hit.userData.slabGroup = group;
      hit.userData.silMat = silMat;
      hit.userData.frameMat = frameMat;
      hit.userData.wire = wire;
      hit.userData.baseSil = opts.silOpacity ?? 0.92;
      hit.userData.baseFrame = opts.frameOpacity ?? 0.8;
      hit.userData.baseWire = opts.wireOpacity ?? 0.38;
      group.add(hit);

      root.add(group);
      slabMeshes.push(hit);
      slabGroups.push(group);
      decoAnchors.push(group);
      return group;
    }

    // 3 dense tiers — mix categories + garments
    const tiers = [
      { y: 1.35, radius: 3.2, scale: 0.78, n: 12, phase: 0.08 },
      { y: 0.05, radius: 3.5, scale: 1.0, n: 14, phase: 0.0 },
      { y: -1.3, radius: 3.25, scale: 0.85, n: 12, phase: 0.18 },
    ];
    let cursor = 0;
    tiers.forEach((tier) => {
      for (let i = 0; i < tier.n; i++) {
        const item = allItems[cursor % allItems.length];
        cursor += 1;
        const angle = (i / tier.n) * Math.PI * 2 - Math.PI / 2 + tier.phase;
        const hJitter = 0.88 + ((i * 37) % 10) * 0.025;
        placeSlab(item, angle, tier.y + ((i % 3) - 1) * 0.06, tier.radius, tier.scale, {
          hJitter,
          silOpacity: 0.92,
          frameOpacity: 0.82,
          wireOpacity: 0.4,
        });
      }
    });

    // Extra outer/inner decorative silhouette rings (still clickable via map)
    const extraRings = [
      { y: 2.05, radius: 2.85, scale: 0.52, n: 10, phase: 0.3, sil: 0.7, frame: 0.45, wire: 0.22 },
      { y: -2.0, radius: 2.9, scale: 0.52, n: 10, phase: 0.15, sil: 0.68, frame: 0.42, wire: 0.2 },
      { y: 0.7, radius: 3.95, scale: 0.48, n: 14, phase: 0.05, sil: 0.55, frame: 0.35, wire: 0.16 },
      { y: -0.7, radius: 4.0, scale: 0.48, n: 14, phase: 0.22, sil: 0.52, frame: 0.32, wire: 0.14 },
      { y: 0.0, radius: 2.45, scale: 0.4, n: 8, phase: 0.4, sil: 0.45, frame: 0.28, wire: 0.12 },
    ];
    extraRings.forEach((ring) => {
      for (let i = 0; i < ring.n; i++) {
        const item = allItems[cursor % allItems.length];
        cursor += 1;
        const angle = (i / ring.n) * Math.PI * 2 + ring.phase;
        placeSlab(item, angle, ring.y, ring.radius, ring.scale, {
          hJitter: 0.9 + (i % 5) * 0.04,
          silOpacity: ring.sil,
          frameOpacity: ring.frame,
          wireOpacity: ring.wire,
        });
      }
    });

    // Pure empty wire accents (not clickable) for Atelier density
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + 0.2;
      const y = ((i % 5) - 2) * 0.55;
      const r = 3.7 + (i % 3) * 0.15;
      const g = new THREE.Group();
      g.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      g.lookAt(0, y, 0);
      g.rotateY(Math.PI);
      const ww = 0.35 + (i % 3) * 0.08;
      const wh = 0.7 + (i % 4) * 0.12;
      g.add(makeWireSlab(ww, wh, 0.1));
      root.add(g);
      decoAnchors.push(g);
    }

    // --- Selection FX ---
    const fxRoot = new THREE.Group();
    root.add(fxRoot);

    function makeGlowTexture() {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(256, 256, 4, 256, 256, 250);
      g.addColorStop(0, "rgba(255,252,245,1)");
      g.addColorStop(0.12, "rgba(255,248,230,0.75)");
      g.addColorStop(0.35, "rgba(232,223,208,0.28)");
      g.addColorStop(0.65, "rgba(232,223,208,0.06)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
      ctx.globalCompositeOperation = "lighter";
      ctx.save();
      ctx.translate(256, 256);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 4);
        const streak = ctx.createLinearGradient(-240, 0, 240, 0);
        streak.addColorStop(0, "rgba(255,250,240,0)");
        streak.addColorStop(0.5, `rgba(255,250,240,${0.55 - i * 0.08})`);
        streak.addColorStop(1, "rgba(255,250,240,0)");
        ctx.fillStyle = streak;
        ctx.fillRect(-240, -2 - i, 480, 4 + i * 1.5);
      }
      ctx.restore();
      const t = new THREE.CanvasTexture(c);
      t.needsUpdate = true;
      return t;
    }

    const glowMat = new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(3.2, 3.2, 1);
    glowSprite.visible = false;
    fxRoot.add(glowSprite);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe8dfd0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const focusRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.014, 10, 80), ringMat);
    focusRing.visible = false;
    fxRoot.add(focusRing);

    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xe8dfd0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.007, 8, 80), ring2Mat);
    ring2.visible = false;
    fxRoot.add(ring2);

    const ring3Mat = new THREE.MeshBasicMaterial({
      color: 0xe8dfd0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.01, 8, 64), ring3Mat);
    ring3.visible = false;
    fxRoot.add(ring3);

    let leaderLines = [];
    let sphereArcs = [];

    function clearFxLines() {
      [...leaderLines, ...sphereArcs].forEach((ln) => {
        fxRoot.remove(ln);
        ln.geometry?.dispose();
        ln.material?.dispose();
      });
      leaderLines = [];
      sphereArcs = [];
    }

    function playSelectFx(hitMesh) {
      return new Promise((resolve) => {
        const group = hitMesh.userData.slabGroup;
        if (!group) {
          resolve();
          return;
        }
        const worldPos = new THREE.Vector3();
        group.getWorldPosition(worldPos);
        const local = worldPos.clone();
        root.worldToLocal(local);

        clearFxLines();
        glowSprite.position.copy(local);
        glowSprite.visible = true;
        glowMat.opacity = 0;
        [focusRing, ring2, ring3].forEach((r) => {
          r.position.copy(local);
          r.lookAt(0, local.y, 0);
          r.visible = true;
          r.scale.setScalar(0.6);
        });
        ringMat.opacity = ring2Mat.opacity = ring3Mat.opacity = 0;

        // Brighten selected; dim neighbors
        slabMeshes.forEach((h) => {
          const isSel = h === hitMesh;
          if (h.userData.silMat) h.userData.silMat.opacity = isSel ? 1 : h.userData.baseSil * 0.22;
          if (h.userData.frameMat) h.userData.frameMat.opacity = isSel ? 1 : h.userData.baseFrame * 0.18;
          if (h.userData.wire?.material)
            h.userData.wire.material.opacity = isSel ? 1 : h.userData.baseWire * 0.2;
        });

        // Dense diagonal leader web to many neighbors
        const others = decoAnchors
          .filter((a) => a !== group)
          .map((a) => {
            const p = new THREE.Vector3();
            a.getWorldPosition(p);
            root.worldToLocal(p);
            return { p, d: p.distanceTo(local) };
          })
          .sort((a, b) => a.d - b.d)
          .slice(0, 14);

        others.forEach((o, i) => {
          const mid = local.clone().lerp(o.p, 0.42 + (i % 3) * 0.08);
          mid.y += (i % 2 === 0 ? 1 : -1) * (0.15 + (i % 5) * 0.08);
          mid.x += Math.sin(i * 1.7) * 0.22;
          mid.z += Math.cos(i * 1.3) * 0.18;
          const mid2 = local.clone().lerp(o.p, 0.72);
          mid2.y += (i % 2 === 0 ? -0.12 : 0.18);
          const geo = new THREE.BufferGeometry().setFromPoints([
            local.clone(),
            mid,
            mid2,
            o.p.clone(),
          ]);
          const mat = new THREE.LineBasicMaterial({
            color: 0xe8dfd0,
            transparent: true,
            opacity: 0,
          });
          const line = new THREE.Line(geo, mat);
          fxRoot.add(line);
          leaderLines.push(line);
        });

        // Arcs into particle sphere (nucleus)
        for (let i = 0; i < 5; i++) {
          const end = new THREE.Vector3(
            (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.6
          );
          const mid = local.clone().multiplyScalar(0.45);
          mid.y += (i - 2) * 0.12;
          const geo = new THREE.BufferGeometry().setFromPoints([local.clone(), mid, end]);
          const mat = new THREE.LineBasicMaterial({
            color: 0xe8dfd0,
            transparent: true,
            opacity: 0,
          });
          const line = new THREE.Line(geo, mat);
          fxRoot.add(line);
          sphereArcs.push(line);
        }

        // Camera ease toward selection
        const camTarget = camHome.clone();
        const toSel = worldPos.clone().normalize().multiplyScalar(0.55);
        camTarget.add(toSel);
        camTarget.z = Math.max(6.2, camTarget.z - 0.45);
        const camFrom = camera.position.clone();

        const dur = 1200;
        const t0 = performance.now();
        function step(now) {
          if (!orbitState) {
            resolve();
            return;
          }
          const t = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - t, 3);
          const pulse = Math.sin(e * Math.PI);

          glowMat.opacity = pulse * 1.0;
          const gs = 2.6 + pulse * 1.8;
          glowSprite.scale.set(gs, gs, 1);

          ringMat.opacity = pulse * 0.95;
          ring2Mat.opacity = pulse * 0.55;
          ring3Mat.opacity = pulse * 0.7;
          focusRing.scale.setScalar(0.65 + e * 0.85);
          ring2.scale.setScalar(0.75 + e * 0.95);
          ring3.scale.setScalar(0.55 + e * 0.7);
          focusRing.rotation.z = e * 1.2;
          ring2.rotation.z = -e * 0.9;
          ring3.rotation.z = e * 1.6;

          leaderLines.forEach((ln, i) => {
            ln.material.opacity = pulse * (0.62 - i * 0.028);
          });
          sphereArcs.forEach((ln, i) => {
            ln.material.opacity = pulse * (0.5 - i * 0.05);
          });

          const s = 1 + pulse * 0.18;
          group.scale.set(s, s, s);

          camera.position.lerpVectors(camFrom, camTarget, e * 0.85);
          camera.lookAt(0, 0.12, 0);

          if (nucleusMat) nucleusMat.opacity = 0.9 + pulse * 0.1;

          if (t < 1) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      });
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const tmpWorld = new THREE.Vector3();

    const state = {
      scene,
      camera,
      renderer,
      root,
      canvas,
      slabMeshes,
      raycaster,
      pointer,
      azimuth: 0,
      targetAzimuth: 0,
      dragging: false,
      dragMoved: false,
      selecting: false,
      lastX: 0,
      hoverCat: null,
      raf: 0,
      t0: performance.now(),
      onResize: null,
      onPointerDown: null,
      onPointerMove: null,
      onPointerUp: null,
      onPointerLeave: null,
      onClick: null,
    };

    function resize() {
      const w = stage.clientWidth || window.innerWidth;
      const h = stage.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    state.onResize = resize;
    resize();
    window.addEventListener("resize", resize);

    function pickHit(e) {
      const rect = canvas.getBoundingClientRect();
      state.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      state.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      state.raycaster.setFromCamera(state.pointer, camera);
      const hits = state.raycaster.intersectObjects(state.slabMeshes, false);
      return hits.length ? hits[0].object : null;
    }

    state.onPointerDown = (e) => {
      if (state.selecting) return;
      state.dragging = true;
      state.dragMoved = false;
      state.lastX = e.clientX;
      stage.classList.add("is-dragging");
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    };
    state.onPointerMove = (e) => {
      if (state.selecting) return;
      if (state.dragging) {
        const dx = e.clientX - state.lastX;
        if (Math.abs(dx) > 2) state.dragMoved = true;
        state.lastX = e.clientX;
        state.targetAzimuth += dx * 0.0058;
        return;
      }
      const hit = pickHit(e);
      const item = hit?.userData?.item || null;
      if (item !== state.hoverCat) {
        state.hoverCat = item;
        setOrbitHud(item);
        stage.style.cursor = item ? "pointer" : "grab";
      }
    };
    state.onPointerUp = (e) => {
      state.dragging = false;
      stage.classList.remove("is-dragging");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };
    state.onPointerLeave = () => {
      if (!state.selecting) {
        state.hoverCat = null;
        setOrbitHud(null);
        stage.style.cursor = "grab";
      }
    };
    state.onClick = async (e) => {
      if (state.dragMoved || state.selecting) return;
      const hit = pickHit(e);
      const item = hit?.userData?.item;
      if (!item) return;
      state.selecting = true;
      setOrbitHud(item);
      await playSelectFx(hit);
      if (!orbitState) return;
      confirmOrbitCategory(item);
    };

    canvas.addEventListener("pointerdown", state.onPointerDown);
    canvas.addEventListener("pointermove", state.onPointerMove);
    canvas.addEventListener("pointerup", state.onPointerUp);
    canvas.addEventListener("pointercancel", state.onPointerUp);
    canvas.addEventListener("pointerleave", state.onPointerLeave);
    canvas.addEventListener("click", state.onClick);

    function tick() {
      state.raf = requestAnimationFrame(tick);
      const elapsed = (performance.now() - state.t0) / 1000;

      if (!state.dragging && !state.selecting) state.targetAzimuth += 0.0009;
      state.azimuth += (state.targetAzimuth - state.azimuth) * 0.1;
      root.rotation.y = state.azimuth;

      // Twinkle
      if (starPoints?.material) {
        starPoints.material.opacity = starBaseOpacity + Math.sin(elapsed * 1.6) * 0.08;
      }
      if (nucleusMat && !state.selecting) {
        nucleusMat.opacity = 0.82 + Math.sin(elapsed * 2.1) * 0.08;
        nucleusMat.size = 0.022 + Math.sin(elapsed * 1.4) * 0.004;
      }

      if (!state.selecting) {
        slabMeshes.forEach((hit) => {
          const g = hit.userData.slabGroup;
          if (!g) return;
          g.getWorldPosition(tmpWorld);
          const dist = tmpWorld.distanceTo(camera.position);
          const near = 4.0;
          const far = 11.0;
          const t = Math.max(0, Math.min(1, (dist - near) / (far - near)));
          const front = 1 - t;
          const bs = hit.userData.baseSil ?? 0.9;
          const bf = hit.userData.baseFrame ?? 0.8;
          const bw = hit.userData.baseWire ?? 0.35;
          if (hit.userData.silMat) hit.userData.silMat.opacity = bs * (0.35 + front * 0.65);
          if (hit.userData.frameMat) hit.userData.frameMat.opacity = bf * (0.3 + front * 0.7);
          if (hit.userData.wire?.material)
            hit.userData.wire.material.opacity = bw * (0.25 + front * 0.75);
          const sc = 0.84 + front * 0.2;
          g.scale.set(sc, sc, sc);
        });
      }

      const deg = ((state.azimuth * 180) / Math.PI) % 360;
      if (azimuthEl) {
        azimuthEl.textContent = `${(((deg % 360) + 360) % 360).toFixed(0)}°`;
      }
      renderer.render(scene, camera);
    }
    orbitState = state;
    tick();
  }

  async function openOrbitMode() {
    if (!phaseOrbit) return;
    hide(landing);
    hide(phaseScan);
    hide(phaseDiscovery);
    hide(phaseReport);
    hide(phaseArchive);
    show(phaseOrbit);
    window.scrollTo(0, 0);
    disposeOrbit();
    setOrbitHud(null);
    if (reducedMotion) {
      buildOrbitFallback();
      return;
    }
    const ok = await ensureThree();
    if (!ok) {
      buildOrbitFallback();
      return;
    }
    requestAnimationFrame(() => {
      initOrbitScene().catch((err) => {
        console.warn("orbit init failed", err);
        buildOrbitFallback();
      });
    });
  }

  function closeOrbitMode(opts = {}) {
    disposeOrbit();
    if (phaseOrbit) hide(phaseOrbit);
    if (!opts.silent) {
      show(landing);
      window.scrollTo(0, 0);
    }
  }

  function confirmOrbitCategory(cat) {
    if (!cat) return;
    const q = cat.query || `Women's ${cat.en} Trends`;
    if (searchInput) searchInput.value = q;
    closeOrbitMode({ silent: true });
    hide(landing);
    runPipeline(q);
  }

  // --- Events ---------------------------------------------------
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    runPipeline(searchInput.value);
  });

  $$("#presetChips button").forEach((btn) => {
    btn.addEventListener("click", () => {
      searchInput.value = btn.dataset.q;
      runPipeline(btn.dataset.q);
    });
  });

  document.getElementById("facetClear")?.addEventListener("click", () => {
    clearFacets();
  });
  document.getElementById("facetSearchBtn")?.addEventListener("click", () => {
    const q = composedFacetQuery() || (searchInput && searchInput.value) || "";
    if (searchInput && q) searchInput.value = q;
    if (q) runPipeline(q);
  });

  $("#btnAbortScan")?.addEventListener("click", resetToLanding);
  $("#btnNewSearch")?.addEventListener("click", resetToLanding);
  $("#btnBackTop")?.addEventListener("click", () => {
    const mast = document.querySelector(".report-masthead") || phaseReport;
    mast?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  });
  $("#detailClose")?.addEventListener("click", closeDetail);
  detailOverlay.addEventListener("click", (e) => {
    if (e.target === detailOverlay) closeDetail();
  });
  document.getElementById("btnOrbitMode")?.addEventListener("click", () => {
    openOrbitMode();
  });
  document.getElementById("btnOrbitClose")?.addEventListener("click", () => {
    closeOrbitMode();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (phaseOrbit && !phaseOrbit.hidden) {
      closeOrbitMode();
      return;
    }
    closeDetail();
  });

  // Init — probe API immediately; runPipeline/fetchSearch await apiReady
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
  }
  landingIntro();
  const submitBtn = searchForm && searchForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  $$("#presetChips button").forEach((b) => {
    b.disabled = true;
  });
  apiReady = detectApi()
    .then(async (ok) => {
      if (ok && apiBase !== null) {
        taxonomyData = await fetchTaxonomy();
        if (taxonomyData) renderFacetPanel(taxonomyData);
      }
      return ok;
    })
    .finally(() => {
      if (submitBtn) submitBtn.disabled = false;
      $$("#presetChips button").forEach((b) => {
        b.disabled = false;
      });
    });
})();
