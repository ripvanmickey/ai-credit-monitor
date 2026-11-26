const ORDER_ENTITIES=['MSFT','AMZN','GOOGL','META','SPCX','NBIS','CRWV'];
async function readOrders(env){const obj=env.BUCKET?await env.BUCKET.get('orders.json'):null,p=obj?JSON.parse(await obj.text()):{...ORDER_SEED,persistence:env.BUCKET?'seed':'unavailable'};return {...p,companies:ORDER_SEED.companies,series:ORDER_SEED.series,observations:mergeMarketHistory(ORDER_SEED.observations,p.observations)};}
function orderSourceAllowed(series,url){try{const u=new URL(url);if(u.protocol!=='https:')return false;const domains={MSFT:['microsoft.com'],AMZN:['amazon.com','aboutamazon.com'],GOOGL:['abc.xyz','google.com'],META:['atmeta.com','nebius.com'],SPCX:['spacex.com'],NBIS:['nebius.com'],CRWV:['coreweave.com']},ciks={MSFT:'789019',AMZN:'1018724',GOOGL:'1652044',META:'1326801',SPCX:'1181412',NBIS:'1513845',CRWV:'1769628'};return u.hostname==='www.sec.gov'?u.pathname.startsWith('/Archives/edgar/data/'+ciks[series.entityId]+'/'):(domains[series.entityId]||[]).some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}}
function validateOrders(p,previous,now=new Date().toISOString()){
 const today=Date.parse(now);if(!p||p.schemaVersion!==1||typeof p.revision!=='string'||!p.revision||!Number.isFinite(Date.parse(p.checkedAt))||Math.abs(today-Date.parse(p.checkedAt))>86400000||!Array.isArray(p.observations)||p.observations.length>5000)throw Error('invalid order update');
 const ids=new Set();for(const o of p.observations){const s=ORDER_SEED.series.find(s=>s.id===o.seriesId);if(!s||!o.id||ids.has(o.id)||!/^\d{4}-\d{2}-\d{2}$/.test(o.asOf)||!Number.isFinite(Date.parse(o.asOf))||Date.parse(o.asOf)>today||!Number.isFinite(Date.parse(o.publishedAt))||Date.parse(o.publishedAt)>today||!Number.isFinite(o.value)||(s.unit!=='percent'&&o.value<0)||!['=','~','>','<='].includes(o.operator)||!o.note||!o.sourceTitle||!orderSourceAllowed(s,o.sourceUrl))throw Error('invalid order provenance, metric or future observation');ids.add(o.id);}
 for(const old of previous.observations){const next=p.observations.find(o=>o.id===old.id);if(!next||JSON.stringify(next)!==JSON.stringify(old))throw Error('order history immutable; append a correction');}
}
function analyzeOrders(raw,now=new Date().toISOString()){
 const day=86400000,today=Date.parse(now),series=ORDER_SEED.series.map(s=>{
  const rows=(raw.observations||[]).filter(o=>o.seriesId===s.id&&Date.parse(o.publishedAt)<=today&&Date.parse(o.asOf)<=today).sort((a,b)=>a.asOf.localeCompare(b.asOf)||a.publishedAt.localeCompare(b.publishedAt)).filter((o,i,a)=>i===a.length-1||o.asOf!==a[i+1].asOf),last=rows.at(-1),prev=rows.at(-2);
  const quarterGap=prev?(Date.parse(last.asOf)-Date.parse(prev.asOf))/day:null;
  const compare=(base,label,end=last)=>!base||!end||!['=','~'].includes(end.operator)||!['=','~'].includes(base.operator)||base.value<=0?null:{from:base.asOf,to:end.asOf,delta:end.value-base.value,pct:100*(end.value/base.value-1),approximate:end.operator==='~'||base.operator==='~',label};
  const qoq=s.kind==='stock'&&quarterGap>=60&&quarterGap<=120?compare(prev,'环比'):null;
  const yearBase=last?rows.slice(0,-1).filter(r=>{const d=(Date.parse(last.asOf)-Date.parse(r.asOf))/day;return d>=350&&d<=380}).at(-1):null;
  const yoy=s.kind==='stock'?compare(yearBase,'同比'):null;
  const quarterly=s.kind==='stock'?rows.map((r,i)=>{const p=rows[i-1],gap=p?(Date.parse(r.asOf)-Date.parse(p.asOf))/day:0,year=rows.slice(0,i).filter(b=>{const n=(Date.parse(r.asOf)-Date.parse(b.asOf))/day;return n>=350&&n<=380;}).at(-1);return {asOf:r.asOf,observation:r,qoq:gap>=60&&gap<=120?compare(p,'环比',r):null,yoy:compare(year,'同比',r)};}):[];
  const stale=!!(last&&!['commitment','conditional'].includes(s.kind)&&(today-Date.parse(last.asOf)>150*day||today-Date.parse(last.publishedAt)>120*day));
  let conclusion='尚无已核验披露。';if(last){
   if(s.kind==='stock'){conclusion=qoq?(qoq.pct>1?'可比订单存量增长':qoq.pct< -1?'可比订单存量下降':'可比订单存量大致持平'):'只有单期存量，暂不能计算环比';if(s.entityId==='SPCX')conclusion+='；纯算力订单增速未单独披露';else if(s.entityId==='MSFT')conclusion+='；包含商业软件与非AI云业务';else if(s.entityId==='CRWV')conclusion+='；backlog含估计未来收入，仍需交付兑现';}
   if(s.kind==='flow_multiple')conclusion=(last.value>1.01?'当季新签TCV扩张':last.value<.99?'当季新签TCV下降':'当季新签TCV大致持平')+'；不代表未兑现订单余额同比例变化';
   if(s.kind==='flow_growth')conclusion=last.value>0?'当季商业bookings同比增长':last.value<0?'当季商业bookings同比下降；与RPO存量增长可同时发生':'当季商业bookings同比持平';
   if(s.kind==='flow')conclusion='有净新增签约证据；不直接推算期末订单余额';
   if(s.kind==='commitment')conclusion='已签专用容量采购承诺；缺少连续剩余采购余额，环比未知';
   if(s.kind==='conditional')conclusion='条件性兜底采购上限；不等于确定消耗或新增独立终端需求';
   if(stale)conclusion='旧披露：'+conclusion+'；不能代表当前季度。';
  }
  const chart=s.kind==='flow_multiple'&&last&&last.comparisonFrom?[{date:last.comparisonFrom,value:100,operator:'=',normalized:true,note:'归一化基期，不是披露的美元金额'},{date:last.asOf,value:last.value*100,operator:last.operator,normalized:true,note:'由公司披露倍数换算，上季度=100，非订单余额'}]:rows.map(r=>({date:r.asOf,value:r.value,operator:r.operator,note:r.note}));
  return {...s,rows,latest:last||null,qoq,yoy,quarterly,stale,conclusion,chart,chartUnit:s.kind==='flow_multiple'?'上季度=100':s.unit};
 });
 const companies=ORDER_SEED.companies.filter(c=>c.id!=='META').map(c=>({...c,series:series.filter(s=>s.entityId===c.id),primarySeries:series.find(s=>s.id===c.primary),contracts:series.filter(s=>s.counterparty===c.id),scheduleStatus:c.nextPublication?(Date.parse(c.nextPublication)>today?'待发布':'已到计划披露时间，等待核验'):null}));
 const primaryIds=new Set(ORDER_SEED.companies.map(c=>c.primary)),primaryStocks=series.filter(s=>primaryIds.has(s.id)&&s.kind==='stock');
 const stocks=primaryStocks.filter(s=>s.qoq&&!s.stale),growing=stocks.filter(s=>s.qoq.pct>1),falling=stocks.filter(s=>s.qoq.pct< -1);
 const scoringObservations=series.filter(s=>s.scoreKey&&s.kind==='stock').flatMap(s=>s.rows.filter(r=>r.operator==='=').map(r=>({id:'order-input:'+r.id,metric:'rpo',entityId:s.entityId,seriesKey:s.scoreKey,method:'issuer_reported',asOf:r.asOf,publishedAt:r.publishedAt,value:r.value,unit:'USD bn',sourceUrl:r.sourceUrl,sourceTitle:r.sourceTitle,note:r.note})));
 const periods=[...new Set(primaryStocks.flatMap(s=>s.rows.map(r=>r.asOf)))].sort(),commonPeriods=periods.filter(d=>primaryStocks.every(s=>s.rows.some(r=>r.asOf===d))),latestCommon=commonPeriods.at(-1)||null;
 const alignment={periods,commonFrom:commonPeriods[0]||null,latestCommon,companies:companies.map(c=>({entityId:c.id,name:c.name,seriesId:c.primary,kind:c.primarySeries.kind,cells:periods.map(asOf=>{const q=c.primarySeries.quarterly.find(q=>q.asOf===asOf);return {asOf,status:q?'available':c.primarySeries.kind!=='stock'?'not_applicable':c.nextPublication&&(!c.primarySeries.latest||asOf>c.primarySeries.latest.asOf)?(Date.parse(c.nextPublication)>today?'pending':'unverified'):'history_missing',observation:q?.observation||null,qoq:q?.qoq||null,yoy:q?.yoy||null};})}))};
 return {schemaVersion:1,alignment,revision:raw.revision,checkedAt:raw.checkedAt,computedAt:now,method:ORDER_SEED.method,companies,series,scoringObservations,summary:{title:stocks.length<2?'可比存量覆盖不足，尚不能判断整体方向':growing.length>=2&&falling.length===0?'多家可比订单存量增长'+(series.some(s=>s.kind==='flow_multiple'&&!s.stale&&s.latest?.value>1.01)?'，新增签约也有扩张证据':''):falling.length>=2?'多家可比订单存量下降，需核对兑现与取消':'订单证据分化，需要逐家公司判断',stockSeries:stocks.length,growing:growing.length,falling:falling.length,flat:stocks.length-growing.length-falling.length,note:'公司与观察季度不同，不加总金额、不计算跨公司平均增速；采购方与供应方合同只作同一条产业链的两面证据。未兑现订单不是已收现金，存量下降也可能来自收入兑现。'}};
}
