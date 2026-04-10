import { useFavorites } from "../FavoritesContext.jsx";

/**
 * Stellina preferiti; usa stopRowClick sulla riga tabella per non selezionare la riga.
 */
export default function FavoriteStar({
  symbol,
  stopRowClick = false,
  className = "",
}) {
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
      title={active ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
      aria-label={
        active
          ? `Rimuovi ${symbol} dai preferiti`
          : `Aggiungi ${symbol} ai preferiti`
      }
      aria-pressed={active}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
