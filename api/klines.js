import { fetchKlines } from "../backend/src/kline.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  const { symbol, interval = "15", limit = "500" } = req.query;
  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Query symbol obbligatorio" });
  }
  try {
    const candles = await fetchKlines(symbol.toUpperCase(), interval, limit);
    res.status(200).json({
      symbol: symbol.toUpperCase(),
      interval,
      candles,
    });
  } catch (e) {
    console.error("[api/klines]", e);
    res.status(502).json({
      error: e.message || "Kline non disponibili",
      candles: [],
    });
  }
}
