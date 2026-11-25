const host = document.querySelector('#divergence');
const copy = {
  zh: { title: '科技股底背离监测', sub: '日线收盘口径 · 每次收盘数据更新后自动重算', first: '前低', second: '后低', metric: '指标', result: '判断', close: '收盘价', latest: '最新收盘', rsi: 'RSI（14）', dif: 'MACD DIF', histogram: 'MACD 柱状图',
    triggered: '已触发', notTriggered: '未触发', pending: '低点待确认', insufficient: '低点样本不足', stale: '数据待更新', expired: '信号已过期', priceLower: '创新低', priceNotLower: '未创新低', loading: '正在读取收盘指标…', error: '指标加载失败，请刷新重试。', method: '计算口径',
    note: '底背离表示下跌动量减弱，不等于已经见底，也不直接构成抄底策略的买入信号。',
    rules: '在最近 63 个交易日中，低点收盘须低于此前 5 日，并经随后 2 日收盘均高于该低点确认。比较最近两个相隔至少 5 个交易日的低点；后低超过 20 个交易日则过期。未完成右侧确认显示待确认，数据落后于目标收盘日显示待更新。',
    formula: '后低价格低于前低，且同日指标值高于前低，才标记已触发。RSI 使用 Wilder 14 日平滑；MACD 使用 EMA12−EMA26（DIF）、DIF 的 EMA9（DEA），柱状图 = DIF−DEA。DIF 与柱状图分别判断，未使用柱面积或盘中最低价。ETF 使用复权收盘价，指数使用价格指数收盘价。', names: { QQQ: 'QQQ · 纳斯达克 100', IXIC: '纳斯达克综合指数', SOX: '费城半导体指数' } },
  en: { title: 'Technology bullish divergence', sub: 'Daily closing prices · Recalculated with every closing-data update', first: 'Earlier low', second: 'Later low', metric: 'Metric', result: 'Signal', close: 'Close', latest: 'Latest close', rsi: 'RSI (14)', dif: 'MACD DIF', histogram: 'MACD histogram',
    triggered: 'Triggered', notTriggered: 'Not triggered', pending: 'Low unconfirmed', insufficient: 'Insufficient lows', stale: 'Data pending', expired: 'Signal expired', priceLower: 'Lower low', priceNotLower: 'No lower low', loading: 'Loading closing indicators…', error: 'Unable to load indicators. Please refresh.', method: 'Methodology',
    note: 'Bullish divergence indicates weaker downside momentum. It does not confirm a market bottom or directly trigger the dip-buying strategy.',
    rules: 'Within the last 63 sessions, a closing low must be below the preceding 5 closes and confirmed by 2 subsequent closes above it. Compare the latest two lows at least 5 sessions apart. Signals expire after 20 sessions from the later low. Unconfirmed lows and data older than the target session are labelled separately.',
    formula: 'Triggered only when the later closing low is lower and its indicator is higher. RSI uses Wilder smoothing over 14 sessions. MACD: DIF = EMA12−EMA26, DEA = EMA9 of DIF, histogram = DIF−DEA. DIF and histogram signals are separate; histogram area and intraday lows are not used. ETFs use adjusted closes; indices use price-index closes.', names: { QQQ: 'QQQ · Nasdaq-100', IXIC: 'Nasdaq Composite', SOX: 'PHLX Semiconductor' } },
  ja: { title: 'テクノロジー株の強気ダイバージェンス', sub: '日足終値基準 · 終値データの更新ごとに自動再計算', first: '前の安値', second: '直近の安値', metric: '指標', result: '判定', close: '終値', latest: '直近終値', rsi: 'RSI（14）', dif: 'MACD DIF', histogram: 'MACDヒストグラム',
    triggered: '発生', notTriggered: '未発生', pending: '安値の確認待ち', insufficient: '安値データ不足', stale: 'データ更新待ち', expired: 'シグナル期限切れ', priceLower: '安値更新', priceNotLower: '安値更新なし', loading: '終値指標を読み込み中…', error: '指標を読み込めません。再読み込みしてください。', method: '算出方法',
    note: '強気ダイバージェンスは下落の勢いの減速を示します。底打ちの確定や押し目買い戦略の買いシグナルを直接意味しません。',
    rules: '直近63営業日の終値から、直前5日の終値より低く、その後2日の終値が上回る安値を確認します。5営業日以上離れた直近2つの安値を比較し、後の安値から20営業日を超えると期限切れです。未確定の安値と対象取引日より古いデータは別表示します。',
    formula: '終値が安値を更新し、同日の指標値が前の安値時より高い場合に発生と判定します。RSIはWilder方式の14日平滑化。MACDはDIF = EMA12−EMA26、DEA = DIFのEMA9、ヒストグラム = DIF−DEA。DIFとヒストグラムは別々に判定し、面積や日中安値は使いません。ETFは調整後終値、指数は価格指数の終値を使用します。', names: { QQQ: 'QQQ · ナスダック100', IXIC: 'ナスダック総合指数', SOX: 'フィラデルフィア半導体指数' } },
};
let data, failed = false, renderedLanguage;
function language() {
  const value = document.documentElement.lang.split('-')[0];
  return copy[value] ? value : 'en';
}
const number = n => Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
function render() {
  const lang = language(), t = copy[lang];
  renderedLanguage = lang;
  const badge = state => `<span class="divergence-badge" data-state="${state}">${t[state]}</span>`;
  const cards = data ? Object.entries(data.assets).map(([key, a]) => {
    const row = (metric, label) => `<tr><th scope="row">${label}</th><td>${number(a.first?.[metric])}</td><td>${number(a.second?.[metric])}</td><td>${badge(a.states[metric])}</td></tr>`;
    return `<article class="divergence-card"><h3>${t.names[key]}</h3><p class="divergence-latest">${t.latest} · ${a.date ?? '—'} · <strong>${number(a.latest?.close)}</strong></p>
      <div class="divergence-scroll"><table><thead><tr><th>${t.metric}</th><th>${t.first}<small>${a.first?.date ?? '—'}</small></th><th>${t.second}<small>${a.second?.date ?? '—'}</small></th><th>${t.result}</th></tr></thead><tbody>
      <tr><th scope="row">${t.close}</th><td>${number(a.first?.close)}</td><td>${number(a.second?.close)}</td><td>${a.first && a.second ? (a.lowerLow ? t.priceLower : t.priceNotLower) : '—'}</td></tr>
      ${row('rsi', t.rsi)}${row('dif', t.dif)}${row('histogram', t.histogram)}</tbody></table></div></article>`;
  }).join('') : `<p role="status">${failed ? t.error : t.loading}</p>`;
  const open = host.querySelector('details')?.open ?? false;
  host.innerHTML = `<h2>${t.title}</h2><p class="divergence-sub">${t.sub}${data ? ' · ' + data.expectedSession : ''}</p><div class="divergence-grid">${cards}</div>
    <p class="divergence-note"><span aria-hidden="true">ⓘ</span> ${t.note}</p>
    <details class="divergence-method" ${open ? 'open' : ''}><summary><span aria-hidden="true">ⓘ</span> ${t.method}</summary><div><p>${t.rules}</p><p>${t.formula}</p></div></details>`;
}
render();
try {
  const response = await fetch(new URL('divergence-latest.json', import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw Error('HTTP ' + response.status);
  data = await response.json();
  if (data.schemaVersion !== 1 || !data.assets) throw Error('Invalid divergence snapshot');
} catch (error) { data = null; failed = true; console.error(error); }
render();
document.addEventListener('research-language-change', render);
new MutationObserver(() => {
  if (language() !== renderedLanguage) render();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
