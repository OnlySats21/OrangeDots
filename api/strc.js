// Vercel serverless function - api/strc.js
// Returns STRC price AND volume - runs server-side, no CORS issues

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const KEY = 'd7as1i9r01qtpbh9kg8g';

  const sources = [
    // Yahoo Finance v7 - price + volume
    async () => {
      const r = await fetch(
        'https://query2.finance.yahoo.com/v7/finance/quote?symbols=STRC&fields=regularMarketPrice,preMarketPrice,postMarketPrice,marketState,regularMarketVolume',
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const d = await r.json();
      const q = d.quoteResponse?.result?.[0];
      if (!q) throw new Error('no result');
      const st = q.marketState || 'REGULAR';
      const p = st==='PRE'  && q.preMarketPrice  > 0 ? q.preMarketPrice
              : st==='POST' && q.postMarketPrice > 0 ? q.postMarketPrice
              : q.regularMarketPrice;
      if (!p || p <= 0) throw new Error('no price');
      return { price: p, volume: q.regularMarketVolume || 0, source: 'Yahoo/'+st };
    },

    // Finnhub - price + volume (v field = daily volume)
    async () => {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=STRC&token=${KEY}`);
      const d = await r.json();
      if (!d.c || d.c <= 0) throw new Error('no price');
      return { price: d.c, volume: d.v || 0, source: 'Finnhub' };
    },

    // Stooq - price + volume
    async () => {
      const r = await fetch('https://stooq.com/q/l/?s=strc.us&f=sd2t2ohlcv&h&e=json');
      const d = await r.json();
      const sym = d.symbols?.[0];
      const p = parseFloat(sym?.close);
      const v = parseFloat(sym?.volume) || 0;
      if (!p || p <= 0) throw new Error('no price');
      return { price: p, volume: v, source: 'Stooq' };
    }
  ];

  for (const fn of sources) {
    try {
      const r = await fn();
      return res.json({ price: r.price, volume: r.volume, source: r.source, ts: Date.now() });
    } catch(e) {}
  }

  res.status(503).json({ error: 'all sources failed' });
}
