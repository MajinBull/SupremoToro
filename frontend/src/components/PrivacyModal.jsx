import { useEffect, useId } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function PrivacyModal({ open, onClose }) {
  const { t } = useI18n();
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="privacy-modal-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="privacy-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="privacy-modal-header">
          <h2 id={titleId} className="privacy-modal-title">
            {t("privacy.title")}
          </h2>
          <button
            type="button"
            className="privacy-modal-close"
            onClick={onClose}
            aria-label={t("privacy.close")}
          >
            ×
          </button>
        </div>
        <div className="privacy-modal-body">
          <p className="privacy-modal-p">{t("privacy.p1")}</p>
          <p className="privacy-modal-p">{t("privacy.p2")}</p>
          <p className="privacy-modal-p">
            {t("privacy.p3Before")}{" "}
            <a
              href="https://policies.google.com/technologies/cookies"
              target="_blank"
              rel="noopener noreferrer"
            >
              policies.google.com/technologies/cookies
            </a>
          </p>
          <p className="privacy-modal-p privacy-modal-muted">
            {t("privacy.footer")}
          </p>
        </div>
      </div>
    </div>
  );
}
