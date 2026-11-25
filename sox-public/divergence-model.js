// Fixed rules; no parameter fitting to historical win rates.
export const divergenceRules = Object.freeze({ lookback: 63, left: 5, right: 2, gap: 5, expiry: 20 });

export function momentum(rows) {
  let fast, slow, signal, gain = 0, loss = 0;
  return rows.map(([date, , close], i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(close) || close <= 0 || (i && date <= rows[i - 1][0])) {
      throw Error('Invalid or unordered daily close history');
    }
    fast = i ? fast + 2 / 13 * (close - fast) : close;
    slow = i ? slow + 2 / 27 * (close - slow) : close;
    const dif = fast - slow;
    signal = i ? signal + 2 / 10 * (dif - signal) : dif;
    if (i) {
      const change = close - rows[i - 1][2];
      if (i <= 14) { gain += Math.max(change, 0) / 14; loss += Math.max(-change, 0) / 14; }
      else { gain = (gain * 13 + Math.max(change, 0)) / 14; loss = (loss * 13 + Math.max(-change, 0)) / 14; }
    }
    const rsi = i < 14 ? null : gain + loss === 0 ? 50 : 100 * gain / (gain + loss);
    return { date, close, rsi, dif, dea: signal, histogram: dif - signal };
  });
}

export function lowPair(features) {
  const { lookback, left, right, gap } = divergenceRules;
  const lows = [];
  // Require 60 observations to warm up MACD before a low can be compared.
  for (let i = Math.max(60, features.length - lookback); i < features.length; i++) {
    const value = features[i].close;
    if (!features.slice(i - left, i).every(f => f.close > value)) continue;
    const after = features.slice(i + 1, i + right + 1);
    if (!after.every(f => f.close > value)) continue;
    lows.push({ ...features[i], index: i, confirmed: after.length === right, remaining: right - after.length });
  }
  const second = lows.at(-1) ?? null;
  const first = second ? lows.findLast(f => f.confirmed && f.index <= second.index - gap) ?? null : null;
  return { first, second };
}

export function divergenceFor(rows, expectedSession = rows.at(-1)?.[0]) {
  const features = momentum(rows);
  const latest = features.at(-1) ?? null;
  const { first, second } = lowPair(features);
  const stale = !latest || latest.date < expectedSession;
  const age = second ? features.length - 1 - second.index : null;
  const expired = age !== null && age > divergenceRules.expiry;
  const lowerLow = Boolean(first && second && second.close < first.close);
  const state = metric => {
    if (stale) return 'stale';
    if (!first || !second) return 'insufficient';
    if (expired) return 'expired';
    if (!second.confirmed) return 'pending';
    return lowerLow && second[metric] > first[metric] ? 'triggered' : 'notTriggered';
  };
  return { date: latest?.date ?? null, latest, first, second, age, lowerLow,
    states: { rsi: state('rsi'), dif: state('dif'), histogram: state('histogram') } };
}

export function divergenceSnapshot(histories, expectedSession) {
  return { schemaVersion: 1, expectedSession, rules: divergenceRules,
    assets: Object.fromEntries(['QQQ', 'IXIC', 'SOX'].map(key => [key, divergenceFor(histories[key], expectedSession)])) };
}
