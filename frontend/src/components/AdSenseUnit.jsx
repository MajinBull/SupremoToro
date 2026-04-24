import { useEffect, useRef } from "react";

/** Allineato a index.html; override con VITE_ADSENSE_CLIENT se serve. */
const CLIENT = String(
  import.meta.env.VITE_ADSENSE_CLIENT ?? "ca-pub-8990391589287773",
).trim();
/** Obbligatorio per questo blocco: crealo in AdSense → Annunci → Unità. */
const DISPLAY_SLOT = String(
  import.meta.env.VITE_ADSENSE_DISPLAY_SLOT ?? "",
).trim();

/**
 * Annuncio display orizzontale responsive. Senza VITE_ADSENSE_DISPLAY_SLOT non
 * renderizza nulla (niente errori in console). Gli Annunci automatici in
 * AdSense possono comunque attivarsi solo dal pannello Google.
 */
export default function AdSenseUnit() {
  const insRef = useRef(null);
  const active = DISPLAY_SLOT.length > 0 && CLIENT.length > 0;

  useEffect(() => {
    if (!active || !insRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("[AdSense]", e);
    }
  }, [active]);

  if (!active) return null;

  return (
    <div className="adsense-wrap">
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={DISPLAY_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
