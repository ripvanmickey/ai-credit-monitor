import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'research-i18n-'));
try{
 await build({entryPoints:['ui/i18n.ts'],outfile:join(dir,'i18n.mjs'),bundle:true,platform:'node',format:'esm'});
 const moduleURL=pathToFileURL(join(dir,'i18n.mjs')).href;
 let saved=null;
 globalThis.localStorage={getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
 const browser=(...languages)=>Object.defineProperty(globalThis,'navigator',{
  configurable:true,value:{languages,language:languages[0]},
 });
 browser('fr-FR','en-GB','ja-JP');
 const {translate,sourceText,sourceAttribute,startLocalization,setLanguage,getLanguage,refreshLanguage,syncLanguagePreference}=await import(moduleURL);
 assert.equal(getLanguage(),'en');
 browser('ja-JP');assert.equal((await import(moduleURL+'?ja')).getLanguage(),'ja');
 browser('zh-Hant-TW');assert.equal((await import(moduleURL+'?zh')).getLanguage(),'zh');
 browser('de-DE');assert.equal((await import(moduleURL+'?unsupported')).getLanguage(),'zh');
 browser('en-US');saved='zh';assert.equal((await import(moduleURL+'?saved')).getLanguage(),'zh');
 saved=null;
 const dictionary={...JSON.parse(await readFile('ui/translations.json','utf8')),
  ...JSON.parse(await readFile('ui/translations-timing.json','utf8'))};
 for(const [source,{en,ja}] of Object.entries(dictionary)){
  assert(en&&ja,source);assert(!/[\u3400-\u9fff]/.test(en),'Chinese in English dictionary: '+source);
  assert.equal(translate(source,'zh'),source);
 }
 const cases=[
  '最近四个已披露季度 · 财报核验截至2026-11-10',
  '公司债信用利差（减同日5年美债） · 2026-10-06 · 169 bp',
  '5年期美元CDS · 公开日线 · 2026-10-07 → 2026-11-05',
  '2026 Q3：3家公司有可比存量，2家增长',
  'Microsoft · 商业 RPO（重列口径）\n数据截至 2026-09-30 · 6,770 亿美元\n订单余额 6,770 亿美元\n披露日期 2026-10-28',
  '8,183个有效日收盘价 · SOX价格指数',
  '3个交易日合并K线',
  '美联储：2022年12月政策声明 ↗',
  '4家回款天数拉长，0家缩短，1家大致持平',
  '证据不完整，暂不能确认反转',
  '当前未达共振阈值',
  '出现局部压力',
  '多项预警，仍有证据缺口',
  '多项预警，等待交叉验证',
  '出现跨维度风险共振',
  '四项风险共振',
  '买入条件',
  '5 日收益率 < −2 × 日波动 × √5',
  '−4.75%，门槛 −3.00%（日波动，60 日 0.67%）',
  '2026-11-11 收盘 · 深 V 偏离 · 成交价 7353.73 · 同模式历史 9 笔，胜率 77.78%，赔率 5.40×',
  '行情覆盖 1957-03-04 — 2026-11-11 · 绩效自 1958-01-15 起',
  '标普 500 · 牛市急跌',
  'CDS与公司债信号分化，尚不能确认同步变化',
  'GitHub Pages · 已保存的公开数据快照',
  '约 387 亿美元 ↗',
  '约 +3.23%',
 ];
 for(const source of cases){
  const en=translate(source,'en'),ja=translate(source,'ja');
  assert(!/[\u3400-\u9fff]/.test(en),'Untranslated English: '+source);
  assert(!/[\uE000\uE001]/.test(en+ja),'Leaked replacement token');
  assert.notEqual(ja,source,'Untranslated Japanese: '+source);
 }
 // Tenors must not be consumed by calendar-year patterns.
 assert.equal(translate('5年期美元CDS · 公开日线','en'),'5-year USD CDS · Public daily quotes');
 for(const lang of ['zh','en','ja'])assert.equal(translate('Microsoft FY27 Q1 Investor Metrics · NVIDIA H100 80GB · $12.29',lang),'Microsoft FY27 Q1 Investor Metrics · NVIDIA H100 80GB · $12.29');
 // Reproduce the original bug: a translated native option must still expose its Chinese source.
 const node={nodeType:3,data:'固定区域按需价',get textContent(){return this.data;},parentElement:{closest:()=>false}};
 const element={childNodes:[node],closest:()=>false,attrs:{'aria-label':'GPU租价历史序列'},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;}};
 globalThis.NodeFilter={SHOW_TEXT:4};globalThis.MutationObserver=class{disconnect(){}observe(){}};
 globalThis.location={pathname:'/cycle/'};
 globalThis.document={body:{},documentElement:{},title:'',dispatchEvent(){},createTreeWalker(){let visited=false;return {nextNode(){if(visited)return null;visited=true;return node;}};},querySelectorAll(){return [element];}};
 startLocalization();
 assert.equal(globalThis.document.documentElement.lang,'en');
 browser('ja-JP');refreshLanguage();
 assert.equal(getLanguage(),'ja');
 assert.equal(globalThis.document.documentElement.lang,'ja');
 setLanguage('ja');
 browser('en-US');refreshLanguage();
 assert.equal(getLanguage(),'ja');
 syncLanguagePreference(null);
 assert.equal(getLanguage(),'en');
 setLanguage('ja');
 assert.equal(node.data,'固定リージョンのオンデマンド価格');
 assert.equal(sourceText(element),'固定区域按需价');
 assert.equal(sourceAttribute(element,'aria-label'),'GPU租价历史序列');
 setLanguage('en');assert.equal(node.data,'Fixed-region on-demand');
 assert.equal(element.attrs['aria-label'],'GPU rental history series');
 setLanguage('zh');assert.equal(node.data,'固定区域按需价');
 assert.equal(element.attrs['aria-label'],'GPU租价历史序列');
 const sox=await readFile('sox-public/app.js','utf8');
 const table=await readFile('ui/data-table.tsx','utf8');
 assert(sox.includes("column('signal','跌破日期'")&&table.includes('data-source-label={column.title}'),'Sortable headers need immutable source labels');
 console.log('PASS: complete bilingual dictionary, original English identity, dynamic dates/counts/tenors, source labels and no replacement-token leakage.');
}finally{await rm(dir,{recursive:true,force:true});}
