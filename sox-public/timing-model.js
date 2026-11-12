const startDate = '2015-01-01';
const fee = 0.0005;

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
    rising: i >= 219 && ma200[i] > ma200[i - 20],
    deviation: ma200[i] === null ? null : value / ma200[i] - 1,
    change5: change5[i],
    volatility5: i < 25 ? null : sampleDeviation(change5.slice(i - 20, i)),
  }));
}

function sampleDeviation(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

export function timingEntry(features) {
  if (!features.rising) return null;
  if (features.deviation <= -0.10) return 'deep';
  if (features.deviation > 0 && features.volatility5 !== null &&
      features.change5 < -2 * features.volatility5) return 'dip';
  return null;
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

export function backtest(bars, entrySignal, exitSignal) {
  const features = indicators(bars);
  const trades = [];
  const equity = [];
  let cash = 1;
  let holding = null;
  let pending = null;
  let benchmarkShares;
  let exposed = 0;
  for (let i = 0; i < bars.length; i++) {
    const [date, open, close] = bars[i];
    if (date < startDate) continue;
    benchmarkShares ??= 1 / (open * (1 + fee));

    if (pending?.side === 'exit') {
      cash = holding.shares * open * (1 - fee);
      trades.push({
        ...holding.trade, sellSignal: pending.date, sellDate: date, sellPrice: open,
        sellIndex: i, reason: pending.reason, days: i - holding.index,
        return: cash / holding.capital - 1,
      });
      holding = null;
    } else if (pending?.side === 'entry') {
      holding = {
        index: i, capital: cash, shares: cash / (open * (1 + fee)),
        trade: { mode: pending.mode, buySignal: pending.date, buyDate: date, buyPrice: open, buyIndex: i },
      };
      cash = 0;
    }

    const mode = entrySignal(features[i]);
    if (holding) {
      exposed++;
      const heldDays = i - holding.index + 1;
      const reason = exitSignal(features[i], close / holding.trade.buyPrice - 1, heldDays);
      pending = reason ? { side: 'exit', reason, date } : null;
    } else {
      pending = mode ? { side: 'entry', mode, date } : null;
    }
    equity.push({ date, strategy: cash + (holding ? holding.shares * close * (1 - fee) : 0), benchmark: benchmarkShares * close * (1 - fee) });
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
    features, trades, pending, holding: holding?.trade ?? null,
    ...tradeStats(trades), strategy: performance('strategy'), benchmark: performance('benchmark'),
    exposure: exposed / equity.length, from: equity[0].date, to: equity.at(-1).date,
  };
}

export function runTiming(bars, policy = 'ma') {
  return backtest(bars, timingEntry, (features, gain, days) => timingExit(features, gain, days, policy));
}
