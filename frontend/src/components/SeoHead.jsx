import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** URL pubblico senza slash finale (es. https://www.quota.finance). Override con VITE_SITE_URL. */
function siteBase() {
  const fromEnv = String(import.meta.env.VITE_SITE_URL ?? "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

const DEFAULT_DESC =
  "Quota — dashboard perpetual linear USDT su Bybit: prezzi, volume 24h, funding, open interest e grafici candlestick. Dati pubblici, aggiornamento periodico.";

const BY_ROUTE = {
  "/": {
    title: "Quota — Dashboard perpetual Bybit (USDT)",
    description: DEFAULT_DESC,
  },
  "/listings": {
    title: "Nuove listate e delisting — Quota",
    description:
      "Perpetual USDT Bybit in pre-lancio recente (entro 14 giorni da launchTime) e coppie delistate negli ultimi 14 giorni.",
  },
  "/charts": {
    title: "Grafici multipli Bybit — Quota",
    description:
      "Griglia di grafici candlestick per perpetual USDT su Bybit, timeframe selezionabili.",
  },
};

function setMetaName(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

const JSON_LD_ID = "quota-jsonld";

export default function SeoHead() {
  const { pathname } = useLocation();
  const routeKey = BY_ROUTE[pathname] ? pathname : "/";
  const { title, description } = BY_ROUTE[routeKey];
  const base = siteBase();
  const pathSuffix = pathname === "/" ? "" : pathname;
  const canonical = base ? `${base}${pathSuffix}` : "";

  useEffect(() => {
    document.title = title;
    setMetaName("description", description);

    if (base) {
      setMetaProperty("og:title", title);
      setMetaProperty("og:description", description);
      setMetaProperty("og:url", canonical || `${base}/`);
      setMetaProperty("og:type", "website");
      setMetaProperty("og:locale", "it_IT");
      setMetaName("twitter:card", "summary_large_image");
      setMetaName("twitter:title", title);
      setMetaName("twitter:description", description);
    }

    let linkCanon = document.querySelector('link[rel="canonical"]');
    if (!linkCanon) {
      linkCanon = document.createElement("link");
      linkCanon.setAttribute("rel", "canonical");
      document.head.appendChild(linkCanon);
    }
    if (canonical) linkCanon.setAttribute("href", canonical);

    const websiteLd = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Quota",
      description: DEFAULT_DESC,
      inLanguage: "it-IT",
    };
    if (base) websiteLd.url = `${base}/`;

    let ldEl = document.getElementById(JSON_LD_ID);
    if (!ldEl) {
      ldEl = document.createElement("script");
      ldEl.id = JSON_LD_ID;
      ldEl.type = "application/ld+json";
      document.head.appendChild(ldEl);
    }
    ldEl.textContent = JSON.stringify(websiteLd);
  }, [title, description, pathname, canonical, base]);

  return null;
}
