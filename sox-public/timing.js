import { runTiming, timingEntry } from './timing-model.js';

const panel = document.querySelector('#timing');
const asset = panel.querySelector('#timing-asset');
const mode = panel.querySelector('#timing-exit');
const canvas = panel.querySelector('canvas');
const status = panel.querySelector('#timing-status');
const summary = panel.querySelector('#timing-summary');
const range = panel.querySelector('#timing-range');
const tradeRows = panel.querySelector('tbody');
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
    visible.forEach((f, i) => i ? ctx.lineTo(x(start + i), y(f[key])) : ctx.moveTo(x(start + i), y(f[key])));
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

function render() {
  bars = histories[asset.value];
  result = runTiming(bars, mode.value);
  selectedTrade = null;
  range.textContent = result.from + ' — ' + result.to;
  const latest = result.features.at(-1);
  const action = result.pending?.side === 'entry' ? '入场触发'
    : result.pending?.side === 'exit' ? '离场触发'
    : result.holding ? '持仓中，未触发离场' : '未触发入场';
  const detail = result.pending?.side === 'entry' ? names[result.pending.mode]
    : result.pending?.side === 'exit' ? names[result.pending.reason]
    : result.holding ? result.holding.buyDate : '';
  status.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = action;
  title.dataset.active = String(Boolean(result.pending));
  const context = document.createElement('span');
  context.textContent = [result.to, detail, '距200日均线 ' + pct(latest.deviation)].filter(Boolean).join(' · ');
  status.append(title, context);
  const signal = timingEntry(latest);
  panel.querySelector('#timing-signals').innerHTML = [
    ['200日均线', latest.rising ? '上行' : '未上行'],
    ['牛市急跌', signal === 'dip' ? '触发' : '未触发'],
    ['深 V 偏离', signal === 'deep' ? '触发' : '未触发'],
    ['5日涨跌 / 急跌门槛', pct(latest.change5) + ' / ' + pct(-2 * latest.volatility5)],
  ].map(([label, value]) => '<span>' + label + ' <strong>' + value + '</strong></span>').join('');
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
  const response = await fetch('./timing-prices.json');
  if (!response.ok) throw new Error('price data unavailable');
  histories = await response.json();
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
