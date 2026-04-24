export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <h1 className="legal-page-title">Privacy e cookie</h1>
      <p className="legal-page-p">
        Questo sito mostra dati di mercato pubblici (API Bybit). Non raccogliamo
        dati personali tramite moduli o account su questa app.
      </p>
      <p className="legal-page-p">
        Utilizziamo <strong>Google AdSense</strong> per la pubblicità. Google può
        usare cookie o identificatori per annunci personalizzati o non
        personalizzati. Puoi gestire le preferenze tramite le impostazioni
        pubblicitarie di Google e la documentazione ufficiale AdSense / Privacy
        &amp; Terms.
      </p>
      <p className="legal-page-p">
        Informativa cookie di Google:{" "}
        <a
          href="https://policies.google.com/technologies/cookies"
          target="_blank"
          rel="noopener noreferrer"
        >
          policies.google.com/technologies/cookies
        </a>
      </p>
      <p className="legal-page-p legal-page-muted">
        Ultimo aggiornamento: aprile 2026. Per richieste privacy contatta il
        titolare del sito tramite i canali indicati su quota.finance (o dominio
        attuale).
      </p>
    </div>
  );
}
