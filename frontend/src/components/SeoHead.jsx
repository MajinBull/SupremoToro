import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "../i18n/I18nContext.jsx";

/** URL pubblico senza slash finale (es. https://www.quota.finance). Override con VITE_SITE_URL. */
function siteBase() {
  const fromEnv = String(import.meta.env.VITE_SITE_URL ?? "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function routeSeoKey(pathname) {
  if (pathname === "/listings") return "listings";
  if (pathname === "/charts") return "charts";
  if (pathname === "/signals") return "signals";
  return "home";
}

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
  const { locale, t } = useI18n();
  const base = siteBase();
  const pathSuffix = pathname === "/" ? "" : pathname;
  const canonical = base ? `${base}${pathSuffix}` : "";

  const seoKey = routeSeoKey(pathname);
  const title =
    seoKey === "home"
      ? t("seo.homeTitle")
      : seoKey === "listings"
        ? t("seo.listingsTitle")
        : seoKey === "charts"
          ? t("seo.chartsTitle")
          : t("seo.signalsTitle");
  const description =
    seoKey === "home"
      ? t("seo.defaultDescription")
      : seoKey === "listings"
        ? t("seo.listingsDesc")
        : seoKey === "charts"
          ? t("seo.chartsDesc")
          : t("seo.signalsDesc");

  useEffect(() => {
    document.title = title;
    setMetaName("description", description);

    if (base) {
      setMetaProperty("og:title", title);
      setMetaProperty("og:description", description);
      setMetaProperty("og:url", canonical || `${base}/`);
      setMetaProperty("og:type", "website");
      setMetaProperty("og:locale", locale === "en" ? "en_US" : "it_IT");
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
      description: t("seo.defaultDescription"),
      inLanguage: locale === "en" ? "en-US" : "it-IT",
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
  }, [title, description, pathname, canonical, base, locale, t]);

  return null;
}
