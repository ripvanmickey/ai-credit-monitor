import { readFile, rename, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { entryChecks, indicators, timingEntry } from '../sox-public/timing-model.js';

const statePath = '.github/close-snapshot.json';
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23',
});
const day = value => dateFormat.format(new Date(value));
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const encode = value => JSON.stringify(value) + '\n';
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
const positive = value => Number.isFinite(value) && value > 0;

async function optional(path, fallback) {
  try { return await read(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return fallback; }
}

function merge(rows, additions, key) {
  return [...new Map([...rows, ...additions].map(row => [key(row), row])).values()];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(new URL(url).hostname + ' HTTP ' + response.status);
  return response.json();
}

async function yahoo(symbol, from, now, through) {
  const params = new URLSearchParams({
    interval: '1d', period1: String(Math.floor(Date.parse(from) / 1000) - 86400),
    period2: String(Math.floor(now.getTime() / 1000) + 1), includeAdjustedClose: 'true',
  });
  let error;
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const data = await fetchJson('https://' + host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?' + params);
      const result = data.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      if (result?.meta?.symbol !== symbol || !result.timestamp?.length || !quote) throw Error('Invalid chart');
      const adjusted = result.indicators.adjclose?.[0]?.adjclose;
      const rows = result.timestamp.map((ts, i) => ({
        date: day(ts * 1000), open: quote.open?.[i], high: quote.high?.[i],
        low: quote.low?.[i], close: quote.close?.[i], adjusted: adjusted?.[i],
      })).filter(row => row.date <= through && positive(row.close));
      if (!rows.length) throw Error('No completed bars');
      return rows;
    } catch (cause) { error = cause; }
  }
  throw error;
}

async function marketBaseline() {
  const etfs = await read('sox-public/timing-prices.json');
  for (const key of ['GSPC', 'IXIC']) {
    const path = 'sox-public/timing-' + key.toLowerCase() + '.json.gz';
    etfs[key] = JSON.parse(gunzipSync(await readFile(path))).map(([date, cents]) => [date, null, cents / 100]);
  }
  return etfs;
}

const chronological = (a, b) => a[0].localeCompare(b[0]);
const byBarDate = (a, b) => a.date.localeCompare(b.date);

function mergeCds(seed, updated, supplement) {
  seed.events = merge(merge(seed.events, supplement, row => row.id), updated?.events ?? [], row => row.id);
  if (!updated) return seed;
  seed.observations = merge(seed.observations, updated.observations, row => row.id);
  seed.checks = merge(seed.checks, updated.checks, row => row.at).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (Date.parse(updated.checkedAt) > Date.parse(seed.checkedAt)) {
    for (const key of ['checkedAt', 'checkStatus', 'checkNote']) seed[key] = updated[key];
  }
  if (Date.parse(updated.tradeStudy?.checkedAt) > Date.parse(seed.tradeStudy?.checkedAt ?? 0)) {
    seed.tradeStudy = updated.tradeStudy;
  }
  return seed;
}

async function refresh(previous, now, force) {
  const date = day(Number(clock.format(now)) < 17 ? now.getTime() - 86400000 : now);
  if (previous?.completedOn === date && !force) {
    console.log('Snapshot already checked for ' + date);
    return;
  }
  const baseline = await marketBaseline();
  const sox = await read('sox-market-seed.json');
  const state = structuredClone(previous ?? { schemaVersion: 1, prices: {}, sox: [] });
  const requests = Object.entries({ GSPC: '^GSPC', IXIC: '^IXIC', QQQ: 'QQQ', SPY: 'SPY', SOX: '^SOX' });
  const work = requests.map(async ([key, symbol]) => {
    const isSox = key === 'SOX';
    const existing = isSox ? [...sox.bars, ...state.sox].sort(byBarDate) : merge(baseline[key], state.prices[key] ?? [], row => row[0]).sort(chronological);
    const last = existing.at(-1);
    const lastDate = isSox ? last.date : last[0];
    if (lastDate === date && !force) return;
    const rows = await yahoo(symbol, lastDate, now, date);
    if (!rows.some(row => row.date === lastDate)) throw Error('Price history has no overlap with the saved snapshot');
    const newer = rows.filter(row => row.date > lastDate);
    if (isSox) {
      if (newer.some(row => ![row.open, row.high, row.low].every(positive) ||
        row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close))) throw Error('Invalid SOX OHLC');
      state.sox.push(...newer.map(({ adjusted, ...row }) => ({ ...row, source: 'Nasdaq GIDS / Yahoo Finance' })));
    } else {
      const etf = key === 'QQQ' || key === 'SPY';
      const overlap = rows.find(row => row.date === lastDate);
      if (etf && !positive(overlap.adjusted)) throw Error('Missing adjusted overlap');
      const scale = etf ? last[2] / overlap.adjusted : 1;
      if (etf && newer.some(row => !positive(row.adjusted) || !positive(row.open))) throw Error('Missing adjusted ETF prices');
      state.prices[key] = [...(state.prices[key] ?? []), ...newer.map(row => [
        row.date, etf ? row.open * row.adjusted / row.close * scale : null,
        etf ? row.adjusted * scale : Math.round(row.close * 100) / 100,
      ])];
    }
    console.log(key + ' added ' + newer.length + ' completed daily bars');
  });
  work.push((async () => {
    const upstream = await fetchJson('https://ai-credit-monitor.mickeyripvan.chatgpt.site/api/snapshot');
    const seed = await read('seed.json');
    const entities = new Set(seed.entities.map(row => row.id));
    if (upstream.schemaVersion !== 1 || !Number.isFinite(Date.parse(upstream.checkedAt)) ||
        !['ok', 'partial', 'failed'].includes(upstream.checkStatus) || typeof upstream.checkNote !== 'string' ||
        !Array.isArray(upstream.observations) || !Array.isArray(upstream.events) || !Array.isArray(upstream.checks)) {
      throw Error('Invalid published CDS snapshot');
    }
    const observations = upstream.observations.filter(row => row.id && entities.has(row.entityId) &&
      validDate(row.asOf) && row.asOf <= date && Number.isFinite(row.value) && row.value >= 0 && row.sourceUrl?.startsWith('https://'));
    const events = upstream.events.filter(row => row.id && validDate(row.date) && row.date <= date && row.url?.startsWith('https://'));
    const checks = upstream.checks.filter(row => Number.isFinite(Date.parse(row.at)) && typeof row.note === 'string');
    const prior = state.cds;
    const latest = !prior || Date.parse(upstream.checkedAt) >= Date.parse(prior.checkedAt) ? upstream : prior;
    state.cds = {
      checkedAt: latest.checkedAt, checkStatus: latest.checkStatus, checkNote: latest.checkNote,
      observations: merge(prior?.observations ?? [], observations, row => row.id),
      events: merge(prior?.events ?? [], events, row => row.id),
      checks: merge(prior?.checks ?? [], checks, row => row.at),
      tradeStudy: latest.tradeStudy,
    };
    console.log('Public CDS source last checked ' + latest.checkedAt);
  })());
  const outcomes = await Promise.allSettled(work);
  const errors = outcomes.flatMap((result, i) => result.status === 'rejected'
    ? [(requests[i]?.[0] ?? 'CDS') + ': ' + result.reason.message] : []);
  if (!errors.length) state.completedOn = date;
  if (JSON.stringify(state) !== JSON.stringify(previous)) {
    await writeFile(statePath + '.tmp', encode(state));
    await rename(statePath + '.tmp', statePath);
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    if (!process.env.GITHUB_OUTPUT) process.exitCode = 1;
    else await writeFile(process.env.GITHUB_OUTPUT, 'incomplete=true\n', { flag: 'a' });
  }
}

async function apply(state) {
  const seed = await read('seed.json');
  const supplement = await optional('.github/pages-news.json', []);
  await writeFile('seed.json', encode(mergeCds(seed, state?.cds, supplement)));
  const histories = await marketBaseline();
  for (const [key, rows] of Object.entries(histories)) {
    histories[key] = merge(rows, state?.prices[key] ?? [], row => row[0]).sort(chronological);
  }
  const { QQQ, SPY, GSPC, IXIC } = histories;
  await writeFile('sox-public/timing-prices.json', encode({ QQQ, SPY }));
  for (const [key, rows] of Object.entries({ gspc: GSPC, ixic: IXIC })) {
    await writeFile('sox-public/timing-' + key + '.json.gz', gzipSync(JSON.stringify(rows.map(([date, , close]) => [date, Math.round(close * 100)]))));
  }
  const market = await read('sox-market-seed.json');
  const candles = await read('sox-public/candles.json');
  const latestCandle = candles.at(-1).date;
  market.bars = merge(market.bars, state?.sox ?? [], row => row.date).sort(byBarDate).slice(-30);
  for (const row of market.bars.filter(row => row.date > latestCandle)) {
    const previous = candles.slice(-199).reduce((sum, candle) => sum + candle.close, 0);
    candles.push({ ...row, ma: (previous + row.close) / 200 });
  }
  market.retrievedAt = market.bars.at(-1).date;
  await writeFile('sox-market-seed.json', encode(market));
  await writeFile('sox-public/candles.json', encode(candles));
  const signals = Object.fromEntries(Object.entries(histories).map(([key, rows]) => {
    const features = indicators(rows).at(-1);
    return [key, { date: rows.at(-1)[0], close: features.close, signal: timingEntry(features), checks: entryChecks(features) }];
  }));
  await writeFile('sox-public/timing-latest.json', encode(signals));
  console.log('Calculated close signals:', Object.entries(signals).map(([key, row]) => key + ' ' + row.date).join(', '));
}

const action = process.argv[2];
const state = await optional(statePath, null);
if (state && state.schemaVersion !== 1) throw Error('Unsupported close snapshot schema');
if (action === 'refresh') await refresh(state, new Date(), process.argv.includes('--force'));
else if (action === 'apply') await apply(state);
else throw Error('Expected refresh or apply');
