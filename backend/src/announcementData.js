const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const BYBIT_ANNOUNCEMENTS = "https://announcements.bybit.com/en";
const BINANCE_CMS =
  "https://www.binance.com/bapi/composite/v1/public/cms/article";

let cache = { expiresAt: 0, value: new Map() };
let refreshPromise = null;

async function fetchText(url) {
  const res = await fetch(url, { headers: { Accept: "text/html,application/json" } });
  if (!res.ok) throw new Error(`Announcements HTTP ${res.status}`);
  return res.text();
}

function nextDataFromHtml(html) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("Bybit announcement payload missing");
  const bodyStart = start + marker.length;
  const end = html.indexOf("</script>", bodyStart);
  if (end < 0) throw new Error("Bybit announcement payload truncated");
  return JSON.parse(html.slice(bodyStart, end));
}

function textFromAst(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textFromAst).join(" ");
  if (typeof node !== "object") return "";
  const own = node.node === "text" && typeof node.text === "string" ? node.text : "";
  return `${own} ${textFromAst(node.child)}`.trim();
}

function dateMsFromEnglishText(text) {
  const match = String(text).match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s+(20\d{2})(?:,?\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*UTC)?/i,
  );
  if (!match) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months.indexOf(match[1].slice(0, 3).toLowerCase());
  let hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const meridiem = String(match[6] || "").toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return Date.UTC(Number(match[3]), month, Number(match[2]), hour, minute);
}

function dateMsFromIsoTitle(text) {
  const match = String(text).match(/20\d{2}-\d{2}-\d{2}/);
  if (!match) return null;
  const ms = Date.parse(`${match[0]}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

function dateMsFromIsoBody(text, title) {
  const date = String(title).match(/20\d{2}-\d{2}-\d{2}/)?.[0];
  if (!date) return null;
  const escaped = date.replace(/-/g, "\\-");
  const match = String(text).match(
    new RegExp(`${escaped}.{0,100}?(\\d{1,2}):(\\d{2})`, "i"),
  );
  if (!match) return dateMsFromIsoTitle(title);
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day, Number(match[1]), Number(match[2]));
}

function usdtSymbols(text) {
  const normalized = String(text)
    .toUpperCase()
    .replace(/([A-Z0-9]{2,30})\s*[\/_-]\s*USDT\b/g, "$1USDT");
  return [...new Set(normalized.match(/\b[A-Z0-9]{2,30}USDT\b/g) || [])];
}

function binanceSpotTokensFromTitle(title) {
  const match = String(title).toUpperCase().match(/WILL DELIST\s+(.+?)\s+ON\s+20\d{2}-\d{2}-\d{2}/);
  if (!match) return [];
  return match[1]
    .split(/\s*,\s*|\s+AND\s+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean)
    .map((token) => `${token}USDT`);
}

function bybitSpotListingSymbols(item) {
  const direct = usdtSymbols(`${item.title} ${item.description}`);
  if (direct.length > 0) return direct;
  if (!(item.topics || []).includes("Spot Listings")) return [];
  const match = String(item.title).toUpperCase().match(/^([A-Z0-9]{2,20})\s+ALPHA TOKEN/);
  if (!match) return [];
  const token = match[1].replace(/0$/, "");
  return [`${token}USDT`];
}

function visibleItem(symbol, eventMs, sourceUrl) {
  return {
    symbol,
    delistedAt: new Date(eventMs).toISOString(),
    visibleUntil: new Date(eventMs + WINDOW_MS).toISOString(),
    sourceUrl,
  };
}

async function bybitList(category) {
  const html = await fetchText(`${BYBIT_ANNOUNCEMENTS}/?category=${category}`);
  return nextDataFromHtml(html)?.props?.pageProps?.articleInitEntity?.list || [];
}

async function bybitArticle(item) {
  const html = await fetchText(`${BYBIT_ANNOUNCEMENTS}${item.url}`);
  return nextDataFromHtml(html)?.props?.pageProps?.articleDetail || null;
}

async function bybitAnnouncements() {
  const [listingItems, delistingItems] = await Promise.all([
    bybitList("new_crypto"),
    bybitList("delistings"),
  ]);
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const out = new Map([
    ["bybit-linear", { listings: [], delisted: [] }],
    ["bybit-spot", { listings: [], delisted: [] }],
  ]);

  for (const item of listingItems) {
    const publishedMs = Number(item.publish_time) * 1000;
    if (!Number.isFinite(publishedMs) || publishedMs < cutoff) continue;
    const topics = new Set(item.topics || []);
    const marketKey = topics.has("Derivatives") ? "bybit-linear" : topics.has("Spot") ? "bybit-spot" : null;
    if (!marketKey) continue;
    const symbols = marketKey === "bybit-spot"
      ? bybitSpotListingSymbols(item)
      : usdtSymbols(`${item.title} ${item.description}`);
    for (const symbol of symbols) {
      out.get(marketKey).listings.push({
        symbol,
        listedAt: new Date(publishedMs).toISOString(),
        visibleUntil: new Date(publishedMs + WINDOW_MS).toISOString(),
        sourceUrl: `${BYBIT_ANNOUNCEMENTS}${item.url}`,
      });
    }
  }

  const detailCandidates = [];
  for (const item of delistingItems) {
    const publishedMs = Number(item.publish_time) * 1000;
    if (!Number.isFinite(publishedMs) || publishedMs < cutoff) continue;
    const topics = new Set(item.topics || []);
    if (topics.has("WEB3")) continue;
    if (topics.has("Derivatives")) {
      const eventMs = dateMsFromEnglishText(item.description) || publishedMs;
      for (const symbol of usdtSymbols(item.title)) {
        out.get("bybit-linear").delisted.push(
          visibleItem(symbol, eventMs, `${BYBIT_ANNOUNCEMENTS}${item.url}`),
        );
      }
    } else {
      detailCandidates.push(item);
    }
  }

  const details = await Promise.allSettled(detailCandidates.map(bybitArticle));
  details.forEach((result, index) => {
    if (result.status !== "fulfilled" || !result.value) return;
    const item = detailCandidates[index];
    const detail = result.value;
    const content = String(detail.content_html || "");
    const plain = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    const spotLine = plain.match(/Spot.{0,500}?Trading.{0,500}?will end after ([^.]+)/i);
    const eventMs = dateMsFromEnglishText(spotLine?.[1] || plain);
    if (!eventMs) return;
    const pairLine = plain.match(/Delisted trading pairs:.{0,300}?([A-Z0-9,\s]+USDT)/i);
    for (const symbol of usdtSymbols(pairLine?.[0] || plain)) {
      out.get("bybit-spot").delisted.push(
        visibleItem(symbol, eventMs, `${BYBIT_ANNOUNCEMENTS}${item.url}`),
      );
    }
  });
  return out;
}

async function binanceCatalog(catalogId) {
  const raw = await fetchText(
    `${BINANCE_CMS}/catalog/list/query?catalogId=${catalogId}&pageNo=1&pageSize=30`,
  );
  return JSON.parse(raw)?.data?.articles || [];
}

async function binanceArticle(article) {
  const raw = await fetchText(`${BINANCE_CMS}/detail/query?articleCode=${article.code}`);
  return JSON.parse(raw)?.data || null;
}

function binanceMarketForTitle(title, kind) {
  const value = String(title);
  if (/Futures|Perpetual|USDⓈ/i.test(value)) return "binance-futures";
  if (/Margin|Loan|Alpha|Collateral/i.test(value)) return null;
  if (kind === "listing" && /Spot|Will List|Exchange Adds/i.test(value)) return "binance-spot";
  if (kind === "delisting" && /Spot|Will Delist|Removal of Spot/i.test(value)) return "binance-spot";
  return null;
}

async function binanceAnnouncements() {
  const [listingItems, delistingItems] = await Promise.all([
    binanceCatalog(48),
    binanceCatalog(161),
  ]);
  const out = new Map([
    ["binance-futures", { listings: [], delisted: [] }],
    ["binance-spot", { listings: [], delisted: [] }],
  ]);
  const cutoff = Date.now() - WINDOW_MS;
  const sourceUrl = (item) =>
    `https://www.binance.com/en/support/announcement/${item.code}`;

  const addItems = (marketKey, kind, symbols, eventMs, item) => {
    if (!eventMs || eventMs < cutoff) return;
    for (const symbol of symbols) {
      if (kind === "listing") {
        out.get(marketKey).listings.push({
          symbol,
          listedAt: new Date(eventMs).toISOString(),
          visibleUntil: new Date(eventMs + WINDOW_MS).toISOString(),
          sourceUrl: sourceUrl(item),
        });
      } else {
        out.get(marketKey).delisted.push(
          visibleItem(symbol, eventMs, sourceUrl(item)),
        );
      }
    }
  };

  const all = [
    ...listingItems.map((item) => ({ item, kind: "listing" })),
    ...delistingItems.map((item) => ({ item, kind: "delisting" })),
  ].filter(({ item, kind }) => binanceMarketForTitle(item.title, kind));

  for (const { item, kind } of all) {
    const marketKey = binanceMarketForTitle(item.title, kind);
    const symbols = [
      ...new Set([
        ...usdtSymbols(item.title),
        ...(marketKey === "binance-spot" && kind === "delisting"
          ? binanceSpotTokensFromTitle(item.title)
          : []),
      ]),
    ];
    addItems(marketKey, kind, symbols, dateMsFromIsoTitle(item.title), item);
  }

  const detailCandidates = all
    .filter(({ item, kind }) => {
      const marketKey = binanceMarketForTitle(item.title, kind);
      if (marketKey === "binance-futures") {
        return kind === "listing" && /Multiple .*Contracts/i.test(item.title);
      }
      return kind === "listing"
        ? /Exchange Adds|New Trading Pairs/i.test(item.title)
        : /Removal of Spot Trading Pairs/i.test(item.title);
    })
    .slice(0, 7);
  const details = await Promise.allSettled(
    detailCandidates.map(({ item }) => binanceArticle(item)),
  );

  details.forEach((result, index) => {
    if (result.status !== "fulfilled" || !result.value) return;
    const { item, kind } = detailCandidates[index];
    const detail = result.value;
    const publishedMs = Number(detail.publishDate);
    if (!Number.isFinite(publishedMs) || publishedMs < cutoff) return;
    const marketKey = binanceMarketForTitle(item.title, kind);
    let body;
    try {
      body = typeof detail.body === "string" ? JSON.parse(detail.body) : detail.body;
    } catch {
      body = detail.body;
    }
    const bodyText = textFromAst(body);
    const symbols = usdtSymbols(`${item.title} ${bodyText}`);
    const eventMs = dateMsFromIsoBody(bodyText, item.title) || publishedMs;
    addItems(marketKey, kind, symbols, eventMs, item);
  });
  return out;
}

function dedupe(items, dateField) {
  const bySymbol = new Map();
  for (const item of items) {
    const existing = bySymbol.get(item.symbol);
    if (!existing || new Date(item[dateField]) > new Date(existing[dateField])) {
      bySymbol.set(item.symbol, item);
    }
  }
  return [...bySymbol.values()];
}

export async function getAnnouncementData(marketKey) {
  if (Date.now() >= cache.expiresAt) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const merged = new Map();
        const results = await Promise.allSettled([bybitAnnouncements(), binanceAnnouncements()]);
        for (const result of results) {
          if (result.status !== "fulfilled") {
            console.warn("[announcements]", result.reason?.message || result.reason);
            continue;
          }
          for (const [key, data] of result.value) merged.set(key, data);
        }
        if (merged.size > 0) {
          cache = { expiresAt: Date.now() + 10 * 60 * 1000, value: merged };
        }
      })().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;
  }
  const data = cache.value.get(marketKey) || { listings: [], delisted: [] };
  return {
    listings: dedupe(data.listings, "listedAt"),
    delisted: dedupe(data.delisted, "delistedAt"),
  };
}
