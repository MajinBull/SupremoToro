import { useEffect, useRef } from "react";
import { fmtPrice } from "../formatters.js";
import { usePriceAlerts } from "../PriceAlertsContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function PriceAlertsPanel({ open, onClose }) {
  const { t } = useI18n();
  const { alerts, removePriceAlert, clearTriggeredAlerts } = usePriceAlerts();
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  if (!open) return null;

  const active = alerts.filter((a) => !a.triggeredAt);
  const triggered = alerts.filter((a) => a.triggeredAt);

  return (
    <div className="price-alerts-overlay" role="presentation">
      <div
        id="price-alerts-dialog"
        ref={panelRef}
        className="price-alerts-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-alerts-title"
      >
        <div className="price-alerts-panel-head">
          <h2 id="price-alerts-title" className="price-alerts-title">
            {t("priceAlerts.title")}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="price-alerts-close"
            onClick={onClose}
            aria-label={t("priceAlerts.close")}
          >
            ×
          </button>
        </div>
        <p className="price-alerts-hint">{t("priceAlerts.hint")}</p>
        {triggered.length > 0 && (
          <div className="price-alerts-actions">
            <button
              type="button"
              className="price-alerts-clear-btn"
              onClick={() => clearTriggeredAlerts()}
            >
              {t("priceAlerts.clearTriggered", { n: triggered.length })}
            </button>
          </div>
        )}
        <ul className="price-alerts-list">
          {alerts.length === 0 && (
            <li className="price-alerts-empty">{t("priceAlerts.empty")}</li>
          )}
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`price-alerts-item${a.triggeredAt ? " price-alerts-item--triggered" : ""}`}
            >
              <div className="price-alerts-item-main">
                <span className="price-alerts-sym">{a.symbol}</span>
                <span className="price-alerts-level">{fmtPrice(a.price)}</span>
                {a.triggeredAt && (
                  <span className="price-alerts-badge" title={a.triggeredAt}>
                    {t("priceAlerts.triggered")}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="price-alerts-remove"
                onClick={() => removePriceAlert(a.id)}
                aria-label={t("priceAlerts.removeAria", {
                  symbol: a.symbol,
                  price: fmtPrice(a.price),
                })}
              >
                {t("priceAlerts.remove")}
              </button>
            </li>
          ))}
        </ul>
        <p className="price-alerts-footer">
          {t("priceAlerts.footerActive")}{" "}
          <strong>{active.length}</strong>
          {triggered.length > 0 && (
            <>
              {" "}
              · {t("priceAlerts.footerTriggered")}{" "}
              <strong>{triggered.length}</strong>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
