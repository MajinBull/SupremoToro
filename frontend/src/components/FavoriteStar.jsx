import { useFavorites } from "../FavoritesContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";

/**
 * Stellina preferiti; usa stopRowClick sulla riga tabella per non selezionare la riga.
 */
export default function FavoriteStar({
  symbol,
  stopRowClick = false,
  className = "",
}) {
  const { t } = useI18n();
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(symbol);

  return (
    <button
      type="button"
      className={`favorite-star ${active ? "favorite-star--on" : ""} ${className}`.trim()}
      onClick={(e) => {
        if (stopRowClick) e.stopPropagation();
        toggleFavorite(symbol);
      }}
      title={active ? t("favoriteStar.removeTitle") : t("favoriteStar.addTitle")}
      aria-label={
        active
          ? t("favoriteStar.removeAria", { symbol })
          : t("favoriteStar.addAria", { symbol })
      }
      aria-pressed={active}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
