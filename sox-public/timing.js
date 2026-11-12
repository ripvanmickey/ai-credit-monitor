import { deepLogThreshold, entryChecks, reference, runTiming, timingEntry, tradeStats } from './timing-model.js?v=3';

const panel = document.querySelector('#timing');
const asset = panel.querySelector('#timing-asset');
const mode = panel.querySelector('#timing-exit');
const canvas = panel.querySelector('canvas');
const status = panel.querySelector('#timing-status');
const summary = panel.querySelector('#timing-summary');
const range = panel.querySelector('#timing-range');
const tradeRows = panel.querySelector('#timing-trade-rows');
const indexNames = { GSPC: '标普 500', IXIC: '纳斯达克综合' };
const isIndex = key => Object.hasOwn(indexNames, key);
const cache = new Map();
const pct = value => value == null ? '—' : (value * 100).toFixed(2) + '%';
const price = value => value.toFixed(2);
const ratio = value => value == null ? '—' : value.toFixed(2) + '×';
const names = {
  dip: '牛市急跌', deep: '深 V 偏离', ma: '回到5日均线',
  target: '达到浮盈目标', stop: '固定止损', time: '持有到期',
};
let histories;
let bars;
let result;
let selectedTrade = null;

function drawChart() {
  if (!result || !canvas.clientWidth) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const start = selectedTrade ? Math.max(0, selectedTrade.buyIndex - 18) : Math.max(0, bars.length - 126);
  const end = selectedTrade ? Math.min(bars.length - 1, selectedTrade.sellIndex + 18) : bars.length - 1;
  const visible = result.features.slice(start, end + 1);
  const plotted = result.trades.concat(result.holding ? [result.holding] : []);
  const markerPrices = plotted.flatMap(trade => [
    [trade.buyIndex, trade.buyPrice], [trade.sellIndex, trade.sellPrice],
  ]).filter(([i]) => i >= start && i <= end).map(([, value]) => value);
  const values = visible.flatMap(f => [f.close, f.ma200]).filter(Number.isFinite).concat(markerPrices);
  const low = Math.min(...values) * 0.985;
  const high = Math.max(...values) * 1.015;
  const pad = { left: 50, right: 14, top: 12, bottom: 27 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const x = i => pad.left + (i - start) / (end - start) * plotWidth;
  const y = value => pad.top + (high - value) / (high - low) * plotHeight;

  ctx.font = '11px system-ui';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let n = 0; n < 5; n++) {
    const level = high - n / 4 * (high - low);
    ctx.strokeStyle = '#e5e7eb';
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.moveTo(pad.left, y(level));
    ctx.lineTo(width - pad.right, y(level));
    ctx.stroke();
    ctx.fillText(level.toFixed(0), pad.left - 7, y(level));
  }

  for (const [key, color] of [['ma200', '#737373'], ['close', '#171717']]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = key === 'close' ? 2 : 1;
    ctx.setLineDash(key === 'ma200' ? [5, 4] : []);
    ctx.beginPath();
    let started = false;
    visible.forEach((f, i) => {
      if (!Number.isFinite(f[key])) return;
      if (started) ctx.lineTo(x(start + i), y(f[key]));
      else ctx.moveTo(x(start + i), y(f[key]));
      started = true;
    });
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const trade of plotted) {
    for (const [i, p, color, direction] of [[trade.buyIndex, trade.buyPrice, '#05795a', -1], [trade.sellIndex, trade.sellPrice, '#be2424', 1]]) {
      if (!Number.isInteger(i) || i < start || i > end) continue;
      const px = x(i);
      const py = y(p);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(px, py + direction * 6);
      ctx.lineTo(px - 5, py - direction * 4);
      ctx.lineTo(px + 5, py - direction * 4);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#666';
  ctx.textAlign = 'left';
  ctx.fillText(bars[start][0], pad.left, height - 10);
  ctx.textAlign = 'right';
  ctx.fillText(bars[end][0], width - pad.right, height - 10);
}

function getResult(key) {
  const id = key + ':' + mode.value;
  if (!cache.has(id)) {
    const options = isIndex(key) ? { execution: 'close', startDate: histories[key][0][0] } : undefined;
    cache.set(id, runTiming(histories[key], mode.value, options));
  }
  return cache.get(id);
}

function flag(pass, noData = '样本不足') {
  if (pass == null) return '<span class="timing-flag">' + noData + '</span>';
  return '<span class="timing-flag" data-pass="' + pass + '">' + (pass ? '达标' : '未达标') + '</span>';
}

const meets = (value, target) => value == null ? null : value >= target;

function render() {
  bars = histories[asset.value];
  result = getResult(asset.value);
  selectedTrade = null;
  range.textContent = '行情覆盖 ' + bars[0][0] + ' — ' + result.to + ' · 绩效自 ' + result.from + ' 起';
  const latest = result.features.at(-1);
  const signal = timingEntry(latest);
  const checks = entryChecks(latest);
  const byMode = signal ? tradeStats(result.trades.filter(trade => trade.mode === signal)) : null;
  const modePassed = byMode && meets(byMode.winRate, reference.winRate) && meets(byMode.payoff, reference.payoff);
  const buyAction = result.pending?.side === 'exit' ? '持仓出现离场信号'
    : result.holding ? '已有模拟持仓，按规则不加仓'
    : !signal ? '短线建议：等待，未触发买入'
    : !modePassed ? '短线建议：触发信号，暂只观察'
    : '短线建议：规则允许列入抄底观察';
  const fillLabel = isIndex(asset.value) ? '次一交易日收盘' : '次一交易日开盘';
  const detail = result.pending?.side === 'exit' ? names[result.pending.reason] + '，拟于' + fillLabel + '模拟离场'
    : result.holding ? '入场于 ' + result.holding.buyDate
    : !signal ? '两种入场模式均未同时满足各自条件。'
    : names[signal] + ' · 同模式历史 ' + byMode.count + ' 笔，胜率 ' + pct(byMode.winRate) + '，赔率 ' + ratio(byMode.payoff) +
      '。' + (modePassed ? '两项达标，模型按' + fillLabel + '模拟成交。' : '历史门槛未全部达到或样本不足。');
  status.innerHTML = '<strong>' + buyAction + '</strong><span>' + result.to + ' 收盘 · ' + detail + '</span>';
  const rules = (name, entry, rows) => '<article><h3>' + name + '</h3><p class="timing-muted">' +
    (signal === entry ? '已触发' : '未触发') + ' · 下列条件须同时满足</p><ul>' +
    rows.map(([rule, current, pass]) => '<li><span>' + rule + '<small>' + current + '</small></span>' +
      flag(pass, '未就绪') + '</li>').join('') + '</ul></article>';
  const trend = ['200 日均线高于 20 个交易日前', price(latest.ma200) + ' 对比 ' + price(latest.priorMa200), checks.rising];
  const logDeviation = latest.logDeviation == null ? '—' : latest.logDeviation.toFixed(2);
  panel.querySelector('#timing-signals').innerHTML =
    rules(names.dip, 'dip', [trend, ['收盘高于 200 日均线', '当前对数偏离 ' + logDeviation, checks.above],
      ['近 5 日收益低于 −2 倍波动', pct(latest.change5) + '，门槛 ' + pct(checks.threshold), checks.sudden]]) +
    rules(names.deep, 'deep', [trend, ['200 日均线对数偏离 ≤ ' + deepLogThreshold, '当前对数偏离 ' + logDeviation, checks.deep]]);
  const versus = (a, b) => pct(a) + ' / ' + pct(b) + ' · ' +
    (a > b ? '策略占优' : a < b ? '基准占优' : '持平');
  panel.querySelector('#timing-index-comparison').innerHTML = Object.entries(indexNames).map(([key, name]) => {
    const r = getResult(key);
    const current = timingEntry(r.features.at(-1));
    return '<tr><th scope="row">' + name + '</th><td>' + (names[current] || '未触发') +
      '</td><td>' + r.count + '</td><td>' + pct(r.winRate) + ' ' + flag(meets(r.winRate, reference.winRate)) +
      '</td><td>' + ratio(r.payoff) + ' ' + flag(meets(r.payoff, reference.payoff)) +
      '</td><td>' + versus(r.strategy.annualized, r.benchmark.annualized) +
      '</td><td>' + versus(r.strategy.drawdown, r.benchmark.drawdown) + '</td></tr>';
  }).join('');
  const cards = [
    ['已完成交易', result.count],
    ['胜率', pct(result.winRate)],
    ['赔率', ratio(result.payoff)],
    ['平均盈利 / 平均亏损', pct(result.averageWin) + ' / ' + pct(result.averageLoss)],
  ];
  summary.innerHTML = cards.map(([label, value]) => '<article><span>' + label + '</span><strong>' + value + '</strong></article>').join('');
  panel.querySelector('#timing-performance').innerHTML = [
    ['择时策略', result.strategy, pct(result.exposure)],
    ['买入并持有', result.benchmark, '100.00%'],
  ].map(([label, data, exposure]) => '<tr><th scope="row">' + label + '</th><td>' + pct(data.total) + '</td><td>' + pct(data.annualized) + '</td><td>' + pct(data.drawdown) + '</td><td>' + exposure + '</td></tr>').join('');
  tradeRows.innerHTML = result.trades.slice().reverse().map(trade => '<tr><td>' + names[trade.mode] +
    '</td><td><small>' + trade.buySignal + '</small><br><button type="button" data-trade="' + trade.buyIndex + '">' +
    trade.buyDate + '</button> · ' + price(trade.buyPrice) + '</td><td><small>' + trade.sellSignal + '</small><br>' +
    trade.sellDate + ' · ' + price(trade.sellPrice) + '</td><td>' + trade.days + '</td><td>' +
    names[trade.reason] + '</td><td>' + pct(trade.return) + '</td></tr>').join('') ||
    '<tr><td colspan="6">样本期内没有已完成交易</td></tr>';
  drawChart();
}

try {
  const load = async (file, compressed = false) => {
    const response = await fetch(new URL(file, import.meta.url));
    if (!response.ok) throw new Error(file + ': HTTP ' + response.status);
    if (!compressed || response.headers.get('content-encoding')?.includes('gzip')) return response.json();
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  };
  const [etfs, gspc, ixic] = await Promise.all([
    load('timing-prices.json'), load('timing-gspc.json.gz', true), load('timing-ixic.json.gz', true),
  ]);
  const toBars = rows => rows.map(([date, cents]) => [date, null, cents / 100]);
  histories = { ...etfs, GSPC: toBars(gspc), IXIC: toBars(ixic) };
  asset.addEventListener('change', render);
  mode.addEventListener('change', render);
  tradeRows.addEventListener('click', event => {
    const button = event.target.closest('[data-trade]');
    if (!button) return;
    selectedTrade = result.trades.find(trade => trade.buyIndex === Number(button.dataset.trade));
    drawChart();
    canvas.scrollIntoView({ block: 'center' });
  });
  panel.querySelector('#timing-recent').addEventListener('click', () => {
    selectedTrade = null;
    drawChart();
  });
  new ResizeObserver(drawChart).observe(canvas);
  render();
} catch (error) {
  status.textContent = '回测数据加载失败，请刷新页面。';
  console.error(error);
}
