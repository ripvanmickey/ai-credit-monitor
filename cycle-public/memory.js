const labels = {
  title: ['存储价格监测', 'Memory Price Monitor', 'メモリ価格モニター'],
  intro: ['跟踪 NAND、DRAM 和 HBM 的二级市场现货报价、合约价基准与长期供货协议。', 'Track NAND, DRAM, and HBM spot quotes, contract benchmarks, and long-term supply agreements.', 'NAND、DRAM、HBMの現物相場、契約価格の指標、長期供給契約を追跡します。'],
  checked: ['来源核验日', 'Sources checked', '出所確認日'],
  sourceDates: ['公开数据快照 · 逐项标注来源日期', 'Public data snapshot · Source dates shown per row', '公開データのスナップショット · 行ごとに出所の日付を表示'],
  all: ['全部', 'All', 'すべて'],
  products: ['品类', 'Products', '製品分類'],
  spot: ['二级市场现货', 'Secondary-market spot quotes', '二次市場の現物相場'],
  spotNote: ['DRAMeXchange 为当期时段均价。HBM 为媒体报道的单次指示价，日期为报道日。', 'DRAMeXchange values are session averages. HBM values are one-off media indications dated by publication.', 'DRAMeXchangeはセッション平均値。HBMは報道ベースの参考値で、日付は報道日です。'],
  history: ['查看同规格历史快照', 'View earlier observations by specification', '同一仕様の過去の観測値を表示'],
  lta: ['长期供货协议（LTA）', 'Long-term supply agreements (LTAs)', '長期供給契約（LTA）'],
  ltaNote: ['记录已披露的定价机制与签订进度。具体单价以合同方披露为准。', 'Track disclosed pricing terms and agreement milestones. Unit prices require disclosure by a contracting party.', '公表された価格決定方式と契約の進捗を記録します。単価は契約当事者の公表情報に基づきます。'],
  benchmark: ['合约价基准与展望', 'Contract pricing benchmarks and outlook', '契約価格の指標と見通し'],
  benchmarkNote: ['季度涨跌幅和混合 ASP 均为机构预测。部分品类的当前单价需登录来源平台查看。', 'Quarterly changes and blended ASP are research forecasts. Current unit quotes for some products require source membership.', '四半期の騰落率と加重平均販売単価は調査会社の予測です。一部の単価は出所の会員向けです。'],
  product: ['品类', 'Product', '製品分類'],
  spec: ['规格', 'Specification', '仕様'],
  price: ['报价', 'Quote', '気配値'],
  change: ['来源变动', 'Source change', '出所の騰落率'],
  kind: ['性质', 'Type', '種別'],
  date: ['报价／发布日期', 'Quote / publication date', '気配値・公表日'],
  source: ['来源', 'Source', '出所'],
  scope: ['覆盖品类', 'Coverage', '対象製品'],
  company: ['公司／协议', 'Company / agreement', '企業・契約'],
  term: ['合同期间', 'Term', '契約期間'],
  terms: ['定价与进度', 'Pricing and progress', '価格条件・進捗'],
  unitPrice: ['实际单价', 'Agreed unit price', '合意単価'],
  period: ['适用期间', 'Period', '対象期間'],
  estimate: ['价格或预期变动', 'Price or expected change', '価格・予想騰落率'],
  quote: ['时段均价', 'Session average', 'セッション平均'],
  relativeLta: ['报道所称的长约价倍数', 'Reported multiple of LTA price', '報道による長期契約価格に対する倍率'],
  reported: ['报道指示价', 'Reported indication', '報道ベースの参考値'],
  weekly: ['周度', 'Weekly', '週間'],
  session: ['时段', 'Session', 'セッション'],
  chip: ['美元／颗', 'USD / chip', '米ドル／チップ'],
  stack: ['美元／堆栈', 'USD / stack', '米ドル／スタック'],
  waferQuote: ['美元（Wafer Spot 报价）', 'USD (Wafer Spot quote)', '米ドル（Wafer Spot）'],
  qoq: ['环比预测', 'QoQ forecast', '前期比予測'],
  yoy: ['同比预测', 'YoY forecast', '前年比予測'],
  forecast: ['研究预测', 'Forecast', '調査予測'],
  member: ['会员数据', 'Member quotes', '会員向け気配値'],
  undisc: ['未公开', 'Undisclosed', '非公表'],
  multiYear: ['多年', 'Multi-year', '複数年'],
  micronSca: ['Micron 战略客户协议', 'Micron strategic customer agreements', 'Micronの戦略的顧客契約'],
  micronTerms: ['含采购量承诺。多数协议采用固定价或价格上下限，少数随市场定价。', 'Includes volume commitments. Most agreements use fixed prices or price bands. A minority use market pricing.', '購入数量の確約を含みます。大半は固定価格または上下限付きで、一部は市場連動です。'],
  skHbm4: ['SK hynix HBM4', 'SK hynix HBM4', 'SK hynix HBM4'],
  skTerms: ['TrendForce 报告称，2027 年的供货量和价格已谈妥。', 'TrendForce reports that 2027 volume and pricing have been agreed.', 'TrendForceによると、2027年の供給数量と価格は合意済みです。'],
  nandOverall: ['整体 NAND Flash', 'Overall NAND flash', 'NANDフラッシュ全体'],
  enterpriseSsd: ['企业级 SSD', 'Enterprise SSD', 'エンタープライズSSD'],
  conventional: ['常规 DRAM', 'Conventional DRAM', '汎用DRAM'],
  blendedHbm: ['HBM 混合平均售价', 'HBM blended ASP', 'HBM加重平均販売単価'],
  dramContract: ['DRAM 合约报价表', 'DRAM contract quote table', 'DRAM契約価格表'],
  nandContract: ['NAND 晶圆合约报价表', 'NAND wafer contract quote table', 'NANDウェハー契約価格表'],
  marketScope: ['各规格独立报价', 'By specification', '仕様別'],
  noHistory: ['该品类暂无同规格历史点。', 'No earlier comparable observations for this product.', 'この製品分類には比較できる過去の観測値がありません。'],
  error: ['暂时无法读取存储报价快照。', 'The memory price snapshot could not be loaded.', 'メモリ価格のスナップショットを読み込めませんでした。']
};

const products = ['NAND', 'DRAM', 'HBM'];
const elements = Object.fromEntries(
  ['date', 'error', 'content', 'overview', 'products', 'spot', 'history', 'agreements', 'benchmarks']
    .map(id => [id, document.getElementById('memory-' + id)])
);
const languageKey = 'research-language';
let locale;
let selected = 'all';
let data;

function readLanguage() {
  let saved;
  try { saved = localStorage.getItem(languageKey); } catch {}
  if (['zh', 'en', 'ja'].includes(saved)) return saved;
  return [...(navigator.languages ?? []), navigator.language]
    .map(language => language?.toLowerCase().split('-')[0]).find(language => ['zh', 'en', 'ja'].includes(language)) ?? 'zh';
}

function label(key) {
  return labels[key]?.[['zh', 'en', 'ja'].indexOf(locale)] ?? key;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function price(row) {
  const amount = new Intl.NumberFormat(document.documentElement.lang, {
    minimumFractionDigits: row.kind === 'reported' ? 0 : 3,
    maximumFractionDigits: 3
  }).format(row.value);
  return (row.kind === 'reported' ? '≈ ' : '') + amount;
}

function sourceLinks(keys) {
  const cell = element('div');
  for (const key of keys) {
    if (cell.childNodes.length) cell.append(' · ');
    const [name, url] = data.sources[key];
    const link = element('a', name + ' ↗');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    cell.append(link);
  }
  return cell;
}

function withNote(value, note, className) {
  const fragment = document.createDocumentFragment();
  fragment.append(element('strong', value, className), element('span', note));
  return fragment;
}

function date(row) {
  return row.time ? row.date + ' ' + row.time + ' UTC+8' : row.date;
}

function showTable(container, headers, rows, empty = 'noHistory') {
  if (!rows.length) {
    container.replaceChildren(element('p', label(empty), 'memory-empty'));
    return;
  }
  const table = element('table');
  const headings = table.createTHead().insertRow();
  for (const key of headers) {
    const heading = element('th', label(key));
    heading.scope = 'col';
    headings.append(heading);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) row.insertCell().append(value);
  }
  container.replaceChildren(table);
}

function visible(row) {
  return selected === 'all' || row.product === selected;
}

function render() {
  locale = readLanguage();
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
  document.title = label('title');
  for (const node of document.querySelectorAll('[data-label]')) node.textContent = label(node.dataset.label);
  if (!data) return;

  elements.date.textContent = label('checked') + ' · ' + data.checkedOn;
  elements.overview.replaceChildren(...data.spot.filter(row => row.featured).map(row => {
    const card = element('article');
    card.append(element('small', row.product + ' · ' + label(row.kind)),
      element('strong', price(row)), element('p', row.spec + ' · ' + label(row.unit)),
      element('small', date(row)));
    return card;
  }));
  elements.products.setAttribute('aria-label', label('products'));
  elements.products.replaceChildren(...['all', ...products].map(product => {
    const button = element('button', label(product));
    button.type = 'button';
    button.dataset.product = product;
    button.setAttribute('aria-pressed', String(product === selected));
    return button;
  }));
  showTable(elements.spot, ['product', 'spec', 'price', 'change', 'kind', 'date', 'source'],
    data.spot.filter(visible).map(row => [row.product, row.spec, withNote(price(row), label(row.unit), 'numeric'),
      row.change == null ? '—' : withNote((row.change > 0 ? '+' : '') + row.change.toFixed(2) + '%',
        label(row.changePeriod), row.change > 0 ? 'numeric up' : 'numeric down'),
      row.relativeLta ? withNote(label(row.kind), row.relativeLta + ' · ' + label('relativeLta')) : label(row.kind),
      date(row), sourceLinks([row.source])]));
  const tracked = new Set(data.history.map(row => row.spec));
  const history = [...data.history, ...data.spot.filter(row => tracked.has(row.spec))];
  showTable(elements.history, ['product', 'spec', 'price', 'date', 'source'],
    history.filter(visible).sort((a, b) => a.spec.localeCompare(b.spec) || b.date.localeCompare(a.date))
      .map(row => [row.product, row.spec, withNote(price(row), label(row.unit), 'numeric'), date(row), sourceLinks([row.source])]));
  showTable(elements.agreements, ['scope', 'company', 'term', 'terms', 'unitPrice', 'date', 'source'],
    data.agreements.filter(row => selected === 'all' || row.products.includes(selected))
      .map(row => [row.products.join(' / '), label(row.name), label(row.term), label(row.detail), label('undisc'), row.date, sourceLinks(row.sources)]));
  const benchmarks = data.benchmarks.filter(visible).map(row => [row.product, label(row.name), row.period,
    withNote(row.estimate, label(row.comparison), 'numeric'), label('forecast'), row.date, sourceLinks([row.source])]);
  for (const [product, source] of [['NAND', 'nandContract'], ['DRAM', 'dramContract']]) {
    if (visible({product})) benchmarks.push([product, label(source), label('marketScope'), '—', label('member'), '—', sourceLinks([source])]);
  }
  showTable(elements.benchmarks, ['product', 'spec', 'period', 'estimate', 'kind', 'date', 'source'], benchmarks);
  elements.content.hidden = false;
}

elements.products.addEventListener('click', event => {
  const product = event.target.closest('button')?.dataset.product;
  if (!product || product === selected) return;
  selected = product;
  render();
  elements.products.querySelector('[aria-pressed="true"]').focus();
});
window.addEventListener('storage', event => {
  if (event.key === languageKey || event.key === null) render();
});
window.addEventListener('languagechange', render);
render();
try {
  const response = await fetch(new URL('./memory-data.json', import.meta.url));
  if (!response.ok) throw Error('HTTP ' + response.status);
  data = await response.json();
  render();
} catch {
  elements.error.textContent = label('error');
  elements.error.hidden = false;
}
