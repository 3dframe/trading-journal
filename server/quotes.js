// ── Cotações ao vivo (Yahoo Finance) ─────────────────────────────────────────
// Endpoint público v8/chart (não precisa de chave nem de "crumb"). Devolve o último
// preço de mercado e a moeda. Cache em memória para não martelar a Yahoo a cada
// carregamento da página. Só o TICKER do ativo sai para a Yahoo — nenhuma operação
// ou valor da carteira é enviado.
const _cache = new Map();                 // ticker -> { price, currency, ts }
const TTL = 15 * 60 * 1000;               // 15 min

async function getQuote(ticker) {
  const now = Date.now();
  const cached = _cache.get(ticker);
  if (cached && now - cached.ts < TTL) return cached;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const m = j?.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice;
    if (price == null) throw new Error("sem preço");
    const out = { price, currency: m.currency || null, ts: now };
    _cache.set(ticker, out);
    return out;
  } catch {
    return cached || null;                 // devolve cache antigo se houver; senão null
  }
}

// Recebe uma lista de tickers e devolve um mapa { ticker: { price, currency } }.
async function getQuotes(tickers) {
  const uniq = [...new Set(tickers.filter(Boolean))];
  const settled = await Promise.allSettled(uniq.map(t => getQuote(t).then(q => [t, q])));
  const map = {};
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value[1]) map[s.value[0]] = s.value[1];
  }
  return map;
}

module.exports = { getQuotes };
