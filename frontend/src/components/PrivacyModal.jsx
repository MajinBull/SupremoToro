import { useEffect, useId } from "react";

export default function PrivacyModal({ open, onClose }) {
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
            Privacy e cookie
          </h2>
          <button
            type="button"
            className="privacy-modal-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>
        <div className="privacy-modal-body">
          <p className="privacy-modal-p">
            Questo sito mostra dati di mercato pubblici (API Bybit). Non
            raccogliamo dati personali tramite moduli o account su questa app.
          </p>
          <p className="privacy-modal-p">
            Utilizziamo <strong>Google AdSense</strong> per la pubblicità.
            Google può usare cookie o identificatori per annunci personalizzati
            o non personalizzati. Puoi gestire le preferenze tramite le
            impostazioni pubblicitarie di Google e la documentazione ufficiale
            AdSense / Privacy &amp; Terms.
          </p>
          <p className="privacy-modal-p">
            Informativa cookie di Google:{" "}
            <a
              href="https://policies.google.com/technologies/cookies"
              target="_blank"
              rel="noopener noreferrer"
            >
              policies.google.com/technologies/cookies
            </a>
          </p>
          <p className="privacy-modal-p privacy-modal-muted">
            Ultimo aggiornamento: aprile 2026. Per richieste privacy contatta il
            titolare del sito tramite i canali indicati su quota.finance (o
            dominio attuale).
          </p>
        </div>
      </div>
    </div>
  );
}
