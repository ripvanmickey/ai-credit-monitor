const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const TRADE_UPDATE_PLAN={collector:'/api/dtcc-collector.py',instructions:'In addition to public tables and press reports, update tradeStudy using the stdlib Python collector served at collector path. Fetch the script with Site service access, save to a temporary task directory and run python3 collector.py --days 67 --output trade-study.json. Script requests only public DTCC SEC credit files, four parallel downloads, no API keys. Once per UTC day is sufficient if tradeStudy.to already equals yesterday UTC; still check public tables/news every scheduled run. Use a clean task cache or re-download the recent 15 report days to catch corrections. Assign parsed result to payload.tradeStudy, preserving observations and events. On collector error or under 80% source coverage preserve prior tradeStudy, set partial/failed and report source failure. NEVER turn fixed coupons, upfront fees, short tenor CDS or model estimates into five-year market spreads. Current protocol reconciles in-window CORR/EROR and filters senior USD non-package single names with 4.4-5.6 remaining years and an explicit spread; output medians are disclosed-trade statistics, not daily closes. Keep unknown restructuring null. Read back /api/analysis tradeSeries and coverage after PUT.'};
const read=async env=>{let p;if(!env.BUCKET)p={...SEED,persistence:'unavailable'};else {const o=await env.BUCKET.get('snapshot.json');p=o?JSON.parse(await o.text()):{...SEED,persistence:'not_initialized'};}return {...p,entities:SEED.entities,dailySources:SEED.dailySources,reportSources:SEED.reportSources,tradeStudy:p.tradeStudy||SEED.tradeStudy};};
function validateTradeStudy(s){
 if(!s)return;
 if(s.schemaVersion!==1||!Array.isArray(s.series)||s.series.length>16||!Array.isArray(s.files)||s.files.length>101||s.availableFiles!==s.files.filter(f=>f.status==='ok').length||s.availableFiles<s.files.length*.8||!Number.isFinite(Date.parse(s.checkedAt)))throw Error('invalid DTCC coverage');
 const entities=new Set(SEED.entities.map(e=>e.id));const seen=new Set();
 for(const series of s.series){
  if(!entities.has(series.entityId)||seen.has(series.entityId)||series.measurement!=='trade_median'||series.tenor!=='approx5Y'||series.currency!=='USD'||series.seniority!=='senior'||!Array.isArray(series.rows)||!series.rows.length||series.rows.length>101)throw Error('invalid DTCC series');seen.add(series.entityId);
  let previous='';const trades=new Set();for(const r of series.rows){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(r.asOf)||r.asOf<=previous||r.asOf<s.from||r.asOf>s.to||!Number.isFinite(r.value)||r.value<=0||r.value>=10000||!Number.isFinite(r.tradeLow)||!Number.isFinite(r.tradeHigh)||r.tradeLow>r.value||r.tradeHigh<r.value||!Array.isArray(r.tradeIds)||!r.tradeIds.length||r.tradeCount!==r.tradeIds.length||new Set(r.tradeIds).size!==r.tradeIds.length||r.tradeIds.some(id=>typeof id!=='string'||trades.has(id))||!Array.isArray(r.sourceUrls)||!r.sourceUrls.length||r.sourceUrls.some(url=>!/^https:\/\/pddata\.dtcc\.com\/ppd\/api\/report\/cumulative\/sec\/SEC_CUMULATIVE_CREDITS_\d{4}_\d{2}_\d{2}\.zip$/.test(url)))throw Error('invalid DTCC median/provenance');
   previous=r.asOf;for(const id of r.tradeIds)trades.add(id);
  }
 }
}
function validateCycleObservations(observations,previous=[]){
 if(!Array.isArray(observations)||observations.length>2000)throw Error('invalid cycle observations');
 const ids=new Set(),metrics={gpu_price:'USD/GPU-hour',rpo:'USD bn',dso:'days',ocf_net_income:'ratio'};
 const all=[...CYCLE_INPUTS.observations,...observations];
 for(const o of observations){
  if(!o.id||ids.has(o.id)||CYCLE_INPUTS.observations.some(b=>b.id===o.id)||!metrics[o.metric]||o.unit!==metrics[o.metric]||typeof o.entityId!=='string'||typeof o.seriesKey!=='string'||!o.seriesKey||!['issuer_reported','matched_quote'].includes(o.method)||!/^\d{4}-\d{2}-\d{2}$/.test(o.asOf)||!Number.isFinite(Date.parse(o.asOf))||!Number.isFinite(Date.parse(o.publishedAt))||Date.parse(o.asOf)>Date.now()+86400000||Date.parse(o.publishedAt)>Date.now()+86400000||!Number.isFinite(o.value)||(o.value<0&&o.metric!=='ocf_net_income')||!/^https:\/\//.test(o.sourceUrl)||!o.sourceTitle||!o.note)throw Error('invalid cycle provenance/units');
  if(o.metric==='gpu_price'&&(o.method!=='matched_quote'||!o.specification||!o.region||!o.billing))throw Error('GPU quote requires matched contract');
  if(o.metric!=='gpu_price'&&o.method!=='issuer_reported')throw Error('quarterly data requires issuer source');
  if(all.some(n=>n.seriesKey===o.seriesKey&&(n.entityId!==o.entityId||n.metric!==o.metric||n.method!==o.method||n.unit!==o.unit||n.specification!==o.specification||n.region!==o.region||n.billing!==o.billing)))throw Error('cycle series terms changed');
  ids.add(o.id);
 }
 for(const o of previous){const n=observations.find(n=>n.id===o.id);if(!n||JSON.stringify(n)!==JSON.stringify(o))throw Error('cycle history immutable');}
}
function validate(p,previous){
 validateCycleObservations(p.cycleObservations||[],previous.cycleObservations||[]);
  if(!p||p.schemaVersion!==1||typeof p.revision!=='string'||!p.revision||p.revision.length>100)throw Error('schemaVersion/revision invalid');
  if(!Number.isFinite(Date.parse(p.checkedAt))||Math.abs(Date.now()-Date.parse(p.checkedAt))>86400000)throw Error('checkedAt must be within 24h');
  if(p.mode!=='public_reports'||!['ok','partial','failed'].includes(p.checkStatus))throw Error('invalid mode/status');
  if(typeof p.checkNote!=='string'||p.checkNote.length>1000)throw Error('checkNote invalid');
  if(!Array.isArray(p.observations)||p.observations.length>5000||!Array.isArray(p.events)||p.events.length>200)throw Error('invalid arrays');
  validateTradeStudy(p.tradeStudy);
  const entities=new Set(SEED.entities.map(e=>e.id)), ids=new Set();
  for(const o of p.observations){
    if(!o.id||ids.has(o.id)||!entities.has(o.entityId)||!/^\d{4}-\d{2}-\d{2}$/.test(o.asOf)||!Number.isFinite(Date.parse(o.asOf))||Date.parse(o.asOf)>Date.now()+86400000||!Number.isFinite(o.value)||o.value<0||o.value>100000||!['=','>','~','<'].includes(o.operator)||o.kind!=='reported')throw Error('invalid observation');
    if(!['5Y','1Y','3Y','7Y','10Y',null].includes(o.tenor)||!/^https:\/\//.test(o.sourceUrl)||!o.sourceTitle||!o.note||!o.publishedAt)throw Error('source/contract fields required');ids.add(o.id);
    if(o.quoteType==='daily_close'){
      const configured=SEED.dailySources.find(s=>s.entityId===o.entityId&&s.ticker===o.instrument&&(s.url===o.sourceUrl||s.mirrorUrls?.includes(o.sourceUrl)));
      if(!configured||o.operator!=='='||o.tenor!=='5Y'||o.currency!=='USD'||o.seriesKey!=='investing:'+o.instrument)throw Error('daily source/contract does not match registry');
      if([o.open,o.high,o.low].some(v=>v!=null)&&(![o.open,o.high,o.low].every(v=>Number.isFinite(v)&&v>=0)||o.high<Math.max(o.open,o.value)||o.low>Math.min(o.open,o.value)))throw Error('invalid OHLC');
    }
  }
  for(const o of previous.observations){if(!ids.has(o.id))throw Error('historical observations cannot be deleted');const n=p.observations.find(v=>v.id===o.id);if(JSON.stringify(n)!==JSON.stringify(o))throw Error('historical observations immutable; append a correction with a new id');}
  const eventIds=new Set();for(const e of p.events){if(!e.id||eventIds.has(e.id)||!entities.has(e.entityId)||!/^https:\/\//.test(e.url)||!e.title||!e.summary||!/^\d{4}-\d{2}-\d{2}$/.test(e.date))throw Error('invalid event');eventIds.add(e.id);}
}
export default {async fetch(request,env,ctx={waitUntil:()=>{}}){
 try{
  const u=new URL(request.url);
  const isResearchPage=['/','/index.html','/sox/','/sox/index.html','/sox/why-down.html','/sox/timing.html','/cycle/','/cycle/index.html'].includes(u.pathname);
  if(isResearchPage && u.searchParams.get('research-panel')!=='1' && ['GET','HEAD'].includes(request.method)){
   return new Response(request.method==='HEAD'?null:SHELL_HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
  }
  if(u.pathname==='/sox')return Response.redirect(u.origin+'/sox/',302);
  if(u.pathname.startsWith('/sox/')){const target=new URL(request.url);target.pathname=target.pathname.slice(4);return SOX_WORKER.fetch(new Request(target,request),env,ctx);}
  if(u.pathname==='/cycle')return Response.redirect(u.origin+'/cycle/',302);
  if(u.pathname==='/api/cycle'&&request.method==='GET'){
   const [snapshot,gpu,bonds,orderRaw]=await Promise.all([read(env),readGPUPrices(env),readBonds(env),readOrders(env)]),orders=analyzeOrders(orderRaw),bondReport=analyzeBonds(bonds),cycle=analyzeCycle({...snapshot,cycleObservations:[...(snapshot.cycleObservations||[]),...(gpu.observations||[]),...orders.scoringObservations]},CYCLE_INPUTS,new Date().toISOString(),bondReport);
   return json({...cycle,orders,research:cycleResearch(cycle,gpuPriceSummary(gpu),bondReport,analyzeSnapshot(snapshot))});
  }
  if(u.pathname==='/api/orders'&&request.method==='GET')return json(analyzeOrders(await readOrders(env)));
  if(u.pathname==='/api/orders/raw'&&request.method==='GET')return json(await readOrders(env));
  if(u.pathname==='/api/orders'&&request.method==='PUT'){
   if(!env.BUCKET)return json({error:'Persistent storage unavailable'},503);
   if(request.headers.get('Origin')&&request.headers.get('Origin')!==u.origin)return json({error:'Cross-origin write rejected'},403);
   const previous=await readOrders(env);if(request.headers.get('If-Match')!==previous.revision)return json({error:'Revision conflict'},409);
   try{const p=await request.json();validateOrders(p,previous);const next={...previous,revision:p.revision,checkedAt:p.checkedAt,observations:p.observations};await env.BUCKET.put('orders.json',JSON.stringify(next),{httpMetadata:{contentType:'application/json'}});return json(analyzeOrders(next));}catch(e){return json({error:e.message},400);}
  }
  if(u.pathname==='/api/gpu-prices'&&request.method==='GET')return json(gpuPriceSummary(await readGPUPrices(env)));
  if(u.pathname==='/api/bond-spreads'&&request.method==='GET')return json(analyzeBonds(await readBonds(env)));
  if(['/api/gpu-prices/refresh','/api/bond-spreads/refresh-treasury','/api/bond-spreads/refresh-history'].includes(u.pathname)&&request.method==='POST'){
   if(!env.BUCKET)return json({error:'Persistent storage unavailable'},503);
   if(request.headers.get('Origin')&&request.headers.get('Origin')!==u.origin)return json({error:'Cross-origin write rejected'},403);
   if(u.pathname==='/api/bond-spreads/refresh-history')return json(await refreshPublicBondHistory(env));
   if(u.pathname==='/api/gpu-prices/refresh')return json(gpuPriceSummary(await refreshGPUPrices(env)));
   const previous=await readBonds(env),at=new Date().toISOString();
   try{const r=await fetch(BOND_TREASURY_SOURCE,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('H15 HTTP '+r.status);const rows=parseTreasury5Y(await r.text(),at);if(!rows.length)throw Error('No Treasury rows');
    const next={...previous,revision:'ust-'+Date.now(),checkedAt:at,treasury:[...previous.treasury,...rows.filter(o=>!previous.treasury.some(p=>p.id===o.id))],note:'Treasury checked; bond quote dates preserved.'};
    await env.BUCKET.put('bond-spreads.json',JSON.stringify(next),{httpMetadata:{contentType:'application/json'}});return json(analyzeBonds(next));
   }catch(e){return json({error:'Treasury refresh failed; previous history retained',detail:e.message},502);}
  }
  if(u.pathname==='/api/bond-spreads'&&request.method==='PUT'){
   if(!env.BUCKET)return json({error:'Persistent storage unavailable'},503);
   if(request.headers.get('Origin')&&request.headers.get('Origin')!==u.origin)return json({error:'Cross-origin write rejected'},403);
   if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required'},415);
   const previous=await readBonds(env);if(request.headers.get('If-Match')!==previous.revision)return json({error:'Revision changed'},409);
   const body=await request.text();if(body.length>1500000)return json({error:'Payload too large'},413);
   let p;try{p=JSON.parse(body);validateBondUpdate(p,previous);}catch(e){return json({error:e.message},400);}
   const next={...p,bonds:BOND_SEED.bonds};await env.BUCKET.put('bond-spreads.json',JSON.stringify(next),{httpMetadata:{contentType:'application/json'}});return json({saved:true,revision:next.revision});
  }
  if(u.pathname==='/api/bond-spreads/raw'&&request.method==='GET')return json(await readBonds(env));
  if(u.pathname.startsWith('/cycle/')){
   const path=u.pathname==='/cycle/'?'/cycle/index.html':u.pathname;
   if(!CYCLE_ASSETS[path])return json({error:'Not found'},404);
   const contentTypes = {
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    html: 'text/html; charset=utf-8',
    json: 'application/json; charset=utf-8',
    woff2: 'font/woff2',
    png: 'image/png',
    svg: 'image/svg+xml',
   };
   const contentType = contentTypes[path.split('.').at(-1)] ?? 'application/octet-stream';
   const body = Uint8Array.from(atob(CYCLE_ASSETS[path]), c => c.charCodeAt(0));
   return new Response(body, {
    headers: {
     'Content-Type': contentType,
     'Cache-Control': 'no-cache',
     'X-Content-Type-Options': 'nosniff',
    },
   });
  }
  if(u.pathname==='/api/snapshot'&&request.method==='GET'){return json(await read(env));}
  if(u.pathname==='/api/analysis'&&request.method==='GET')return json(analyzeSnapshot(await read(env)));
  if(u.pathname==='/api/dtcc-collector.py'&&request.method==='GET')return new Response(DTCC_COLLECTOR,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-cache'}});
  if(u.pathname==='/api/update-instructions'&&request.method==='GET')return json({mode:'public_reports',schemaVersion:1,method:'PUT /api/snapshot',dailySources:SEED.dailySources,reportSources:SEED.reportSources,tradeStudyPlan:TRADE_UPDATE_PLAN,gpuPricePlan:{read:'/api/gpu-prices',refresh:'POST /api/gpu-prices/refresh',instructions:'Each existing three-hour run: call this server collector once using Site service access. It fetches fixed official public sources, persists actual observation dates, and preserves history on failure. Read back after refresh. No upstream keys needed.'},bondSpreadPlan:{read:'/api/bond-spreads',raw:'/api/bond-spreads/raw',write:'PUT /api/bond-spreads with If-Match revision',treasury:'POST /api/bond-spreads/refresh-treasury',history:'POST /api/bond-spreads/refresh-history',sources:BOND_SEED.bonds.map(b=>({bondId:b.id,entityId:b.entityId,url:b.sourceUrl,historyUrl:b.historySourceUrl})),instructions:'FIRST call POST /api/bond-spreads/refresh-history once to collect only free public YTM histories and same-date FRED DGS5. No paid spread endpoint. Then read raw; only add verified data; preserve sources separately. Read raw first; preserve every observation/treasury object exactly. Check registered public pages with available web tools for dated YTM, never coupon/current yield/YTW. New row: id,bondId,asOf,value percent,currency USD,unit percent,yieldType YTM,sourceUrl exact registry URL,observedAt current UTC,note explicitly provider-calculated/indicative not executable. Never bypass 403/login or backfill search snippets. Append only new actual dates or explicit corrections, via full PUT with current checkedAt, unique revision and If-Match. Read back. Treasury must be same actual day; never carry forward, never substitute source G-spread/OAS, never splice different bonds.'},ordersPlan:{read:'/api/orders',raw:'/api/orders/raw',write:'PUT /api/orders with If-Match revision',companies:ORDER_SEED.companies.map(c=>({id:c.id,name:c.name,nextPublication:c.nextPublication||null,scheduleUrl:c.scheduleUrl||null})),series:ORDER_SEED.series,instructions:'Each existing three-hour run check official quarterly disclosures for the six registered companies. GET raw first; preserve all observations exactly. Append only verified dates and sources. Never change the meaning of registered series: stock/RPO, flow/new commitments, bookings YoY, TCV QoQ multiple, dedicated purchase and conditional backstop remain separate. Required observation fields id,seriesId,asOf YYYY-MM-DD,value in registered unit,operator (=,~,>,<=),publishedAt actual publication time,sourceUrl official issuer or SEC,sourceTitle,note. Use comparisonFrom for new-TCV quarterly multiples. Do not convert commitments into revenue, do not add early-Q3 commitments to a Q2 balance, never count Meta buyer and Nebius seller twice. New contracts need their own registration; do not append a different contract under META-NBIS-202603. Store full PUT payload schemaVersion,revision unique,checkedAt now,observations and If-Match. Read back /api/orders and /api/cycle. Missing disclosures retain old observation dates; scheduled earnings are not actual released data. No code changes or deployment.'},capitalCyclePlan:{endpoint:'/api/cycle',field:'cycleObservations',instructions:'During the existing three-hour run, check for new official quarterly disclosures of MSFT/AMZN/GOOGL/ORCL commercial or cloud RPO and NVDA issuer-reported DSO and same-quarter OCF/net income. Include only already published comparable facts. GPU prices need matched specification, region and billing across at least two providers; do not infer a historical price trend from current price pages or mix spot and reserved prices. Append cycleObservations through the existing full snapshot PUT with If-Match, preserve every existing observation exactly, do not repeat the initial facts returned by GET /api/cycle observations. Required: id, metric= rpo/dso/ocf_net_income/gpu_price, entityId, seriesKey, method=issuer_reported (financials) or matched_quote (GPU), value, unit=USD bn/days/ratio/USD/GPU-hour, asOf actual period end or quote day, publishedAt, sourceUrl=https, sourceTitle, note. GPU additionally needs specification, region, billing unchanged within series. On corrections append a new id with later publishedAt, never mutate. Failed or unchanged sources do not create observations or refresh their dates. Read back /api/cycle after PUT. Quarterly source timestamps are on each observation, independent of the built-in baseline verification date.'},instructions:'Follow ordersPlan, gpuPricePlan and bondSpreadPlan each run: refresh official GPU prices and public bond histories/FRED through their POST endpoints, then check registered bond pages for dated data. Preserve all history, report partial access. Expanded collection scope: FIRST read the public historical tables at every dailySources URL using available web tools. Verify company, instrument, 5Y, USD, dates and bp units; NEVER bypass access controls. Append new dated table rows as kind:reported and quoteType:daily_close; seriesKey=investing:INSTRUMENT, instrument=ticker, sourceId=investing, value=close, open/high/low when available, operator:=, tenor:5Y,currency:USD, seniority/restructuring:null unless verified, sourceTitle/sourceUrl/publishedAt/asOf/note required. publishedAt may equal daily date only with a note that independent publication time is unavailable. Stable id=investing-ENTITY-YYYY-MM-DD. No duplicate rows; on provider correction append a new id and explain correction, never rewrite old objects. Media points remain kind:reported, quoteType:press_report and MUST NOT join daily series. Preserve every existing observation exactly. Then search additional sourced CDS news for all entities as before. Inaccessible or stale tables retain prior values; record source-access results and partial/failed status accurately. Set checkedAt current UTC, revision unique, checkNote in Chinese, and PUT full observations/events with If-Match old revision. entities/dailySources/checks are server-managed. GET snapshot and /api/analysis to verify revision, counts and latest dates. No code changes or deployment; routine refresh is data only. Never substitute bond yields, coupon-only prices or implied CDS. Unchanged old quote dates must stay unchanged.'});
  if(u.pathname==='/api/snapshot'&&request.method==='PUT'){
    // Owner-private Sites dispatch is the access boundary, including unattended service calls.
    if(!env.BUCKET)return json({error:'Persistent storage unavailable; no data saved'},503);
    if(request.headers.get('Origin')&&request.headers.get('Origin')!==u.origin)return json({error:'Cross-origin write rejected'},403);
    if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required'},415);
    const body=await request.text();if(body.length>1500000)return json({error:'Payload too large'},413);
    let p;try{p=JSON.parse(body);}catch{return json({error:'Invalid JSON'},400);}
    const previous=await read(env);
    if(request.headers.get('If-Match')!==previous.revision)return json({error:'Revision changed; GET and retry'},409);
    if(p.revision===previous.revision)return json({revision:p.revision,idempotent:true});
    try{validate(p,previous);}catch(e){return json({error:e.message},400);}
    const saved={...p,entities:SEED.entities,dailySources:SEED.dailySources,persistence:'ready',checks:[...(previous.checks||[]),{at:p.checkedAt,status:p.checkStatus,note:p.checkNote}].slice(-80)};
    await env.BUCKET.put('snapshot.json',JSON.stringify(saved),{httpMetadata:{contentType:'application/json'}});
    return json({saved:true,revision:saved.revision,checkedAt:saved.checkedAt,observations:saved.observations.length});
  }
  if(u.pathname==='/'||u.pathname==='/index.html')return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
  return json({error:'Not found'},404);
 }catch(e){return json({error:'Storage or server error; please retry'},500);}
}};
