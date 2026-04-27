import { useI18n } from "../i18n/I18nContext.jsx";

const LOCALES = [
  { code: "it", short: "IT", labelKey: "lang.it" },
  { code: "en", short: "EN", labelKey: "lang.en" },
];

export default function LanguageSwitcher({ className = "" }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`app-lang-switch ${className}`.trim()}
      role="group"
      aria-label={t("lang.label")}
    >
      {LOCALES.map(({ code, short, labelKey }) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            className={`app-lang-btn${active ? " app-lang-btn--active" : ""}`}
            onClick={() => setLocale(code)}
            aria-pressed={active}
            title={t(labelKey)}
          >
            <span className="app-lang-btn-short" aria-hidden>
              {short}
            </span>
            <span className="sr-only">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
