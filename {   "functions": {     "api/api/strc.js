// Vercel serverless function - api/strc.js
// Deploy alongside strategy-btc-estimator.html in same Vercel project
// This runs server-side so no CORS issues

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const sources = [
    // Yahoo Finance v7
    async () => {
      const r = await fetch('https://query2.finance.yahoo.com/v7/finance/quote?symbols=STRC&fields=regularMarketPrice,preMarketPrice,postMarketPrice,marketState', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const d = await r.json();
      const q = d.quoteResponse?.result?.[0];
      if (!q) throw new Error('no result');
      const st = q.marketState || 'REGULAR';
      const p = st === 'PRE' && q.preMarketPrice > 0 ? q.preMarketPrice
              : st === 'POST' && q.postMarketPrice > 0 ? q.postMarketPrice
              : q.regularMarketPrice;
      if (!p || p <= 0) throw new Error('no price');
      return { price: p, source: 'Yahoo/' + st };
    },
    // Finnhub
    async () => {
      const r = await fetch('https://finnhub.io/api/v1/quote?symbol=STRC&token=d7as1i9r01qtpbh9kg8g');
      const d = await r.json();
      if (!d.c || d.c <= 0) throw new Error('no price');
      return { price: d.c, source: 'Finnhub' };
    },
    // Stooq
    async () => {
      const r = await fetch('https://stooq.com/q/l/?s=strc.us&f=sd2t2ohlcv&h&e=json');
      const d = await r.json();
      const p = parseFloat(d.symbols?.[0]?.close);
      if (!p || p <= 0) throw new Error('no price');
      return { price: p, source: 'Stooq' };
    }
  ];

  for (const fn of sources) {
    try {
      const result = await fn();
      return res.json({ price: result.price, source: result.source, ts: Date.now() });
    } catch(e) {}
  }

  res.status(503).json({ error: 'all sources failed' });
}
