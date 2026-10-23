# TREND ATLAS（时尚趋势图谱）— 交互原型 + 本地数据层

AI 时尚智能平台演示原型。当本地 API 可用时，扫描墙 / 3D Discovery / 报告 / Archive 优先使用 Tavily/Exa/RSS **实况配图**（无图时回退 picsum）；报告 **Sources** 与 Archive 注入真实时尚媒体 **RSS** 标题与链接；若配置了 `TAVILY_API_KEY` 和/或 `EXA_API_KEY`，还会显示 **Sources · Web**（Tavily / Exa 时尚媒体域搜索，按 URL 去重合并）。

**不做** Vogue Runway 图片库抓取或违反站点 ToS 的采集。RSS 使用各媒体公开 feed，单源失败会软跳过。

## 如何运行

### 方式 A — API + 静态 UI（推荐）

```bash
cd /workspace/trend-atlas-prototype/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 可选环境变量（RSS 不需要任何 key；Web 需要 Tavily 和/或 Exa）
# 也可用 server/.env（已 gitignore）：
#   echo 'TAVILY_API_KEY=tvly-YOUR_KEY' >> .env
# export TAVILY_API_KEY=tvly-YOUR_KEY
#   echo 'EXA_API_KEY=YOUR_EXA_KEY' >> .env
# export EXA_API_KEY=YOUR_EXA_KEY
# export SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
# export SHOPIFY_STOREFRONT_TOKEN=...
# export AMAZON_PAAPI_ACCESS_KEY=...
# export AMAZON_PAAPI_SECRET_KEY=...
# export AMAZON_PAAPI_PARTNER_TAG=...
# export PORT=8787

python app.py
```

改 key 后需 **重启** `python app.py`。

浏览器打开：`http://127.0.0.1:8787/`

落地图标若显示 **LIVE RSS**，说明 `/api/health` 可达；搜索后会拉取 RSS。配置 Tavily 或 Exa 且返回结果后，徽章变为 **LIVE RSS+WEB**，报告出现 **Sources · Web**。

### 启用 Web 搜索（Tavily / Exa）

任选其一或两者；两者都配置时会并行调用并按 URL 去重合并，任一有结果则 `web.status` 为 `ok`。

1. 在 [Tavily](https://tavily.com/) 和/或 [Exa](https://dashboard.exa.ai/api-keys) 创建 API key。
2. 写入环境或 `.env`：

```bash
cd /workspace/trend-atlas-prototype/server
echo 'TAVILY_API_KEY=tvly-YOUR_KEY' >> .env
echo 'EXA_API_KEY=YOUR_EXA_KEY' >> .env
```

3. 安装依赖并重启服务：

```bash
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

4. 验证（无 key 时 `web.status` 为 `needs_credentials`）：

```bash
curl -s "http://127.0.0.1:8787/api/search?q=quiet%20luxury&limit=8" | python3 -m json.tool | head -80
```

Exa 使用 `POST https://api.exa.ai/search`，请求头 `x-api-key`，时尚媒体 `includeDomains`，`contents.text` + `highlights`。

### 方式 B — 仅静态（无 API）

```bash
cd /workspace/trend-atlas-prototype
npx --yes serve .
```

或直接打开 `index.html`。此时全部为演示数据；前端会探测 API，探测失败则安静降级。

### 方式 C — 静态与 API 分端口

先按方式 A 启动 API（可设 `SERVE_STATIC=0` 只开接口），再用 `npx serve` 开静态页。前端会尝试 `http://127.0.0.1:8787`（已开 CORS）。

## API

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 + 已配置 feed 列表 |
| `GET /api/taxonomy` | 五维分类树（category / style / silhouette / fabric / colour；含 id、en、zh、synonyms） |
| `GET|POST /api/parse?q=` | 自由文本 → 结构化 facets + `expanded_query`（同义词匹配，不编造品牌） |
| `GET /api/search?q=` | 编排：parse → RSS + **Tavily/Exa web** → **cleaning**；响应含 `parse` + `cleaned: { results, images, rss_items, stats }`；+ ecommerce 桩 |
| `GET /api/rss` | 最新时尚媒体 RSS（可选 `?q=` 关键词过滤、`?limit=`） |
| `GET /api/commerce/search?q=` | 电商搜索桩；无凭证时 `status: "needs_credentials"` |

### 当前启用的 RSS（已实测可返回 XML）

- [Vogue](https://www.vogue.com/feed/rss)
- [Business of Fashion](https://www.businessoffashion.com/feed/)
- [Fashionista](https://www.fashionista.com/.rss/full/)
- [Harper's Bazaar](https://www.harpersbazaar.com/rss/all.xml/)
- [WWD](https://wwd.com/feed/)
- [Elle](https://www.elle.com/rss/all.xml/)

曾尝试但未纳入默认集：Who What Wear（超时）、Fashion United / The Cut（404）。可选 feed 见 `server/config.py` 中 `RSS_FEEDS_OPTIONAL`。

## 环境变量

| 变量 | 用途 |
|------|------|
| `TAVILY_API_KEY` | **已实现**：Tavily REST `POST /search`；时尚媒体 `include_domains` |
| `EXA_API_KEY` | **已实现**：Exa REST `POST https://api.exa.ai/search`（`x-api-key`）；`includeDomains` + `contents.text`/`highlights`；与 Tavily 按 URL 去重合并 |
| `SHOPIFY_STORE_DOMAIN` | 商家店域名，如 `brand.myshopify.com` |
| `SHOPIFY_STOREFRONT_TOKEN` | Shopify Storefront API token |
| `AMAZON_PAAPI_ACCESS_KEY` / `SECRET_KEY` / `PARTNER_TAG` | Amazon Product Advertising API |
| `PORT` | 默认 `8787` |
| `SERVE_STATIC` | 默认开启；设 `0` 只提供 API |
| `RSS_TIMEOUT` | 单 feed 超时秒数（默认 10） |

## Ecommerce 下一步（需你提供凭证）

诚实空结果优于伪造 SKU。`/api/commerce/search` 在未配置时返回：

```json
{ "status": "needs_credentials", "products": [], "providers": [...] }
```

| 方案 | 说明 | 需要 |
|------|------|------|
| **Shopify Storefront** | 面向**自有/合作店铺**的公开 GraphQL 商品搜索，适合品牌目录 | 店域名 + Storefront Access Token |
| **Amazon PA-API 5.0** | 联盟商品搜索；无密钥无法调用 | Access Key、Secret、Partner Tag，且需符合亚马逊联盟政策 |
| **其他联盟** | 如 Rakuten / Awin 等 feed 或 API | 对应联盟账号与合规条款 |
| **无密钥公开源** | 几乎没有稳定、可商用的全球时装 SKU 开放 API；不建议抓取零售站 HTML | — |

配置 Shopify 或 Amazon 环境变量后，在 `server/commerce.py` 中实现真实请求即可；当前有凭证时状态会标为 `ready`，但仍返回空 `products` 直到实现调用。

## 建议体验的交互

1. **落地页** — 输入查询、点 preset，或在 **Facet panel** 多选维度后搜索；查询下显示 parse chips
2. **Phase A** — `COLLECTING → ANALYSING → MAPPING → GENERATING` + 扫描线
3. **Phase B** — 3D 网格聚类（SILHOUETTE / MATERIAL / STRUCTURE / COLOUR）
4. **Phase C** — 杂志式报告；若 API 在线，出现 **Sources · 时尚媒体**（RSS）；有 Tavily/Exa 结果时另有 **Sources · Web**
5. **Archive** — 瀑布流；有 RSS 时标题/图/来源来自媒体，点击跳转原文
6. **无障碍** — `prefers-reduced-motion` 时缩短动画

## 文件结构

```
trend-atlas-prototype/
├── index.html
├── styles.css
├── app.js
├── README.md
└── server/
    ├── app.py              # Flask 入口
    ├── taxonomy.py         # 五维 taxonomy（品类/风格/廓形/面料/色彩）
    ├── query_parse.py      # 自由文本 → 结构化 parse + expanded_query
    ├── cleaning.py         # Step 3：去重 / 来源分层 / taxonomy 标签 / trust / 质量标记
    ├── config.py           # Feed 列表与 env
    ├── rss.py              # 实时 RSS 抓取/解析（软失败）
    ├── web_search.py       # Tavily + Exa REST（按 URL 去重合并）
    ├── commerce.py         # 电商搜索桩
    ├── requirements.txt    # flask, python-dotenv
    ├── .env                # 可选本地密钥（gitignore）
    └── .venv/              # 本地虚拟环境（勿提交亦可）
```

## 管线 Steps 1–5（架构）

| Step | 内容 | 状态 |
|------|------|------|
| **1. 检索** | `/api/search` 编排 RSS（公开 feed）+ Tavily/Exa web（需 key）+ ecommerce 桩 | **已实现** |
| **2. Taxonomy + Parse** | `/api/taxonomy` 五维树；`/api/parse` + 落地页 Facet panel；`expanded_query` 驱动检索 | **已实现** |
| **3. Cleaning** | `server/cleaning.py` → 响应 `cleaned`：URL 去重、`source_tier`（press/brand/ecommerce/social/other）、`brand_guess`/`product_guess`、`date_iso`、`quality_flags`、`taxonomy_tags`、`trust_score`、`stats`（dedupe + coverage） | **已实现** |
| **4. 报告组装** | 前端 Phase C：Overview / Findings / Visuals / Sources / Archive | **已实现（原型）** |
| **5. Evidence 规则** | 出现频率 + 来源覆盖展示；禁止「快速增长 / 市场主流」无销量证据时的表述；Overview 免责声明；单源前缀「待验证」 | **已实现** |

### Evidence 硬规则（报告文案）

- **从不**声称「快速增长」「市场主流」——本原型**没有销量/需求 API**，`cleaned.stats.has_growth_evidence` 恒为 `false`。
- Overview / Findings 展示 **出现频率**（如 `leather ×12`）与 **来源覆盖**（如 `来源: press 8 / other 4`）。
- Overview 下固定免责声明：`以下为检索证据摘要，出现频率不等于市场主流或增长趋势。`
- 仅单源命中时，不确定行前缀 **`待验证`**。

落地页 **Facet panel** 暴露五层交叉筛选。自由查询经 `/api/parse`（或 `/api/search` 内嵌 `parse`）拆成 facets；`expanded_query` 用于 Tavily/Exa/RSS；**AI / 报告仅解释证据，不编造增长幅度**。

### 路线图（未做）

- 电商目录 API（Shopify Storefront / Amazon PA-API 等真实调用）
- 向量数据库 / 图检索与 image embeddings
- 社交平台官方 API（Instagram / TikTok 等）
- 需求/销量信号接入后，才可讨论「增长」类表述

本原型**只使用合法 API / 公开 RSS**，不承诺无 API 的社交/电商抓取。

## 局限说明

- 扫描墙与 3D 阶段优先用搜索返回的文章配图；无实况图时回退 picsum
- RSS 摘要/配图取决于各站 feed 字段，部分条目无图时 Archive 回退 picsum
- Web 需 `TAVILY_API_KEY` 和/或 `EXA_API_KEY`；均未配置时 `web.status: needs_credentials`，不伪造结果。电商仍为桩
- 不承诺无官方 API 的社交/电商站点抓取；不编造趋势增长率
- CDN（GSAP、字体、picsum）与 RSS 源需能访问外网
