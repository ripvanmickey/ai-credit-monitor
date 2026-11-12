const etfStartDate = '2015-01-01';

export function indicators(bars) {
  const close = bars.map(bar => bar[2]);
  const mean = (end, length) => end >= length - 1
    ? close.slice(end - length + 1, end + 1).reduce((sum, value) => sum + value, 0) / length
    : null;
  const ma200 = close.map((_, i) => mean(i, 200));
  const change5 = close.map((value, i) => i < 5 ? null : value / close[i - 5] - 1);

  return close.map((value, i) => ({
    close: value,
    ma5: mean(i, 5),
    ma200: ma200[i],
    priorMa200: ma200[i - 20] ?? null,
    rising: i >= 219 && ma200[i] > ma200[i - 20],
    logDeviation: ma200[i] === null ? null : 100 * Math.log(value / ma200[i]),
    change5: change5[i],
    volatility5: i < 25 ? null : sampleDeviation(change5.slice(i - 20, i)),
  }));
}

function sampleDeviation(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

export const deepLogThreshold = -10;

export const reference = { winRate: 0.70, payoff: 1 };

export function entryChecks(features) {
  const threshold = features.volatility5 === null ? null : -2 * features.volatility5;
  return {
    rising: features.priorMa200 === null ? null : features.rising,
    above: features.logDeviation === null ? null : features.logDeviation > 0,
    sudden: threshold === null ? null : features.change5 < threshold,
    deep: features.logDeviation === null ? null : features.logDeviation <= deepLogThreshold,
    threshold,
  };
}

export function timingEntry(features) {
  const { rising, deep, above, sudden } = entryChecks(features);
  return !rising ? null : deep ? 'deep' : above && sudden ? 'dip' : null;
}

export function timingExit(features, gain, days, policy) {
  if (gain <= -0.15) return 'stop';
  if (policy === 'ma' && features.close > features.ma5) return 'ma';
  if (policy === 'target2' && gain >= 0.02) return 'target';
  if (policy === 'target5' && gain >= 0.05) return 'target';
  if (days >= 20) return 'time';
  return null;
}

export function tradeStats(trades) {
  const wins = trades.filter(t => t.return > 0);
  const losses = trades.filter(t => t.return < 0);
  const gains = wins.reduce((sum, t) => sum + t.return, 0);
  const lossesAbs = -losses.reduce((sum, t) => sum + t.return, 0);
  return {
    count: trades.length,
    winRate: trades.length ? wins.length / trades.length : null,
    averageWin: wins.length ? gains / wins.length : null,
    averageLoss: losses.length ? lossesAbs / losses.length : null,
    payoff: wins.length && losses.length ? (gains / wins.length) / (lossesAbs / losses.length) : null,
    profitFactor: losses.length ? gains / lossesAbs : null,
  };
}

export function backtest(bars, entrySignal, exitSignal, { startDate = etfStartDate } = {}) {
  const features = indicators(bars);
  const trades = [];
  const equity = [];
  let capital = 1;
  let holding = null;
  let benchmarkClose;
  let exposed = 0;

  // The 200-day average needs another 20 observations for the trend comparison.
  for (let i = 219; i < bars.length; i++) {
    const [date, , close] = bars[i];
    if (date < startDate) continue;
    benchmarkClose ??= close;

    if (holding) {
      exposed++;
      const days = i - holding.buyIndex;
      const gain = close / holding.buyPrice - 1;
      const reason = exitSignal(features[i], gain, days);
      if (reason) {
        capital *= 1 + gain;
        trades.push({
          ...holding, sellSignal: date, sellDate: date, sellPrice: close,
          sellIndex: i, reason, days, return: gain,
        });
        holding = null;
      }
    } else {
      const mode = entrySignal(features[i]);
      if (mode) holding = { mode, buySignal: date, buyDate: date, buyPrice: close, buyIndex: i };
    }

    equity.push({
      date,
      strategy: holding ? capital * (close / holding.buyPrice) : capital,
      benchmark: close / benchmarkClose,
    });
  }

  function performance(key) {
    let peak = 1;
    let drawdown = 0;
    for (const point of equity) {
      peak = Math.max(peak, point[key]);
      drawdown = Math.min(drawdown, point[key] / peak - 1);
    }
    const years = (Date.parse(equity.at(-1).date) - Date.parse(equity[0].date)) / (365.25 * 86400000);
    const final = equity.at(-1)[key];
    return { total: final - 1, annualized: final ** (1 / years) - 1, drawdown };
  }

  return {
    features, trades, holding,
    ...tradeStats(trades), strategy: performance('strategy'), benchmark: performance('benchmark'),
    exposure: equity.length > 1 ? exposed / (equity.length - 1) : 0, from: equity[0].date, to: equity.at(-1).date,
  };
}

export function runTiming(bars, policy = 'ma', options) {
  return backtest(bars, timingEntry, (features, gain, days) => timingExit(features, gain, days, policy), options);
}
