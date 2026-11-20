let sortKey='signal',sortDirection='desc';
let all=[],cycles=[],unit='sessions',selected='2026-10-30',page=1,pageCount=1;const $=id=>document.getElementById(id);const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1});const pct=n=>Number(n).toFixed(2)+'%';const dash=v=>v||'尚未收复';
function bars(){
 const groups=[
  ['1—5日',1,5],
  ['6—20日',6,20],
  ['21—60日',21,60],
  ['61—120日',61,120],
  ['121—252日',121,252],
 ];
 const completed=all.filter(row=>row.reclaim_sessions!=='');
 const distribution=groups.map(([label,min,max])=>{
  const count=completed.filter(row=>row.reclaim_sessions>=min&&row.reclaim_sessions<=max).length;
  return {label,count,share:completed.length?count/completed.length*100:0};
 });
 const target=$('bars');
 target.researchChartPayload={distribution};
 if(target.renderResearchChart){
  target.renderResearchChart();
  return;
 }
 const max=Math.max(1,...distribution.map(row=>row.count));
 target.innerHTML=distribution.map(({label,count,share})=>
  `<div class="bar-row"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${count/max*100}%"></div></div><span class="bar-number">${count}次 · ${share.toFixed(1)}%</span></div>`
 ).join('');
}
let latestCyclePrices=[];
let archivedCycles=[];

function elapsedCalendarDays(start,end){
 return Math.round((Date.parse(end)-Date.parse(start))/86400000);
}

function trackOpenCycle(cycle,prices){
 const start=prices.findIndex(price=>price.date===cycle.signal);
 if(start<0)return cycle;
 const result={...cycle,observedThrough:cycle.signal,elapsed_sessions:0,elapsed_calendar_days:0};
 let consecutive=0;
 let lowest=prices[start];
 const record=(key,price,sessions)=>{
  result[key+'_date']=price.date;
  result[key+'_sessions']=sessions;
  result[key+'_calendar_days']=elapsedCalendarDays(cycle.signal,price.date);
 };
 for(let i=start+1;i<prices.length;i++){
  const price=prices[i],sessions=i-start;
  result.observedThrough=price.date;
  result.elapsed_sessions=sessions;
  result.elapsed_calendar_days=elapsedCalendarDays(cycle.signal,price.date);
  if(price.close<lowest.close&&!result.peak_recovery_date)lowest=price;
  consecutive=Number.isFinite(price.ma)&&price.close>=price.ma?consecutive+1:0;
  if(consecutive===1&&!result.reclaim_date)record('reclaim',price,sessions);
  if(consecutive===5&&!result.effective_reclaim_date)record('effective_reclaim',price,sessions);
  if(price.close>=cycle.prior_peak&&!result.peak_recovery_date)record('peak_recovery',price,sessions);
  if(result.effective_reclaim_date&&result.peak_recovery_date)break;
 }
 result.lowest_date=lowest.date;
 result.additional_loss_pct=(lowest.close/cycle.close-1)*100;
 result.peak_to_low_pct=(lowest.close/cycle.prior_peak-1)*100;
 return result;
}

function refreshCycleTimeline(){
 cycles=archivedCycles.map(cycle=>cycle.peak_recovery_date?cycle:trackOpenCycle(cycle,latestCyclePrices));
 chart();
 table();
}
window.addEventListener('sox-cycle-prices',event=>{
 latestCyclePrices=event.detail;
 if(archivedCycles.length)refreshCycleTimeline();
});

function chart(){
 const max=Math.max(1,...cycles.flatMap(row=>['peak_recovery','effective_reclaim','reclaim','elapsed'].map(key=>Number(row[key+'_'+unit])||0)));
 const suffix=unit==='sessions'?'交易日':'自然日';
 const timeline=$('cycle-chart');

 function milestone(value,kind,label,pendingText,elapsed){
  const pending=value==='';
  const days=pending?elapsed:value;
  const width=Math.log1p(days)/Math.log1p(max)*100;
  const text=pending?pendingText+(days?' · '+fmt(days)+' '+suffix:''):fmt(days);
  return `<span class="cycle-track ${pending?'is-pending':''}" style="--milestone-width:${width}%">
   <span class="cycle-bar milestone-${kind}"></span>
   <span class="cycle-screen-reader">${label}</span>
   <small>${text}${pending?'':'<span class="cycle-screen-reader">'+suffix+'</span>'}</small>
  </span>`;
 }

 timeline.innerHTML=cycles.map(row=>{
  const first=row['reclaim_'+unit];
  const confirmed=row['effective_reclaim_'+unit];
  const peak=row['peak_recovery_'+unit];
  const active=selected===row.signal;
  const elapsed=row['elapsed_'+unit]??0;
  const cause=cycleCauses[row.signal]?.title||'';
  return `<li class="cycle-timeline-item">
   <button type="button" class="cycle-row ${active?'selected':''}" data-signal="${row.signal}" aria-pressed="${active}">
    <span class="cycle-date"><time datetime="${row.signal}">${row.signal}</time><small class="cycle-cause-tag">${cause}</small></span>
    <span class="cycle-tracks">
     ${milestone(first,'first','首次站回200日线','尚未站回',elapsed)}
     ${milestone(confirmed,'confirmed','有效站回年线','尚未确认',elapsed)}
     ${milestone(peak,'peak','收复历史前高','尚未收复',elapsed)}
    </span>
    <span class="cycle-end">${row.peak_recovery_date||'进行中'}</span>
   </button>
  </li>`;
 }).join('');

 timeline.querySelectorAll('button[data-signal]').forEach(button=>{
  button.onclick=()=>{
   selected=button.dataset.signal;
   timeline.querySelectorAll('button[data-signal]').forEach(item=>{
    const active=item===button;
    item.classList.toggle('selected',active);
    item.setAttribute('aria-pressed',String(active));
   });
   detail();
  };
 });
 detail();
}
function detail(){
 showCycleCause('cycle-cause',selected);
 const row=cycles.find(cycle=>cycle.signal===selected);
 const suffix=unit==='sessions'?'个交易日':'个自然日';
 const elapsed=row.observedThrough?'截至 '+row.observedThrough+' 已过 '+row['elapsed_'+unit]+suffix:'';
 const duration=key=>row[key+'_date']?row[key+'_'+unit]+suffix:elapsed;
 $('cycle-detail').innerHTML=`<div><label>周期起点 / 首次跌破</label><strong>${row.signal}</strong><small>原前高：${row.prior_peak_date} · ${fmt(row.prior_peak)}点</small></div><div><label>首次站回200日线</label><strong>${row.reclaim_date||'尚未站回'}</strong><small>${duration('reclaim')}</small></div><div><label>有效站回 · 连续5日确认</label><strong>${row.effective_reclaim_date||'尚未确认'}</strong><small>${duration('effective_reclaim')}</small></div><div><label>跌破后至最低点</label><strong>${pct(row.additional_loss_pct)}</strong><small>最低收盘日期：${row.lowest_date}</small></div><div><label>前高至最低点</label><strong>${pct(row.peak_to_low_pct)}</strong><small>${row.peak_recovery_date?'收复前高：'+row.peak_recovery_date:'收复前高：进行中'}</small></div>`;
}
function table(errorMessage){
 const host=$('signals-table');
 const year=$('year').value,status=$('status').value;
 const rows=($('sample').value==='cycles'?archivedCycles:all).map(row=>({...(!row.peak_recovery_date?trackOpenCycle(row,latestCyclePrices):row),id:row.signal}));
 const days=(value,row)=>value===''||value==null?(Number.isFinite(row.elapsed_sessions)?'已过 '+fmt(row.elapsed_sessions)+' 个交易日':'—'):fmt(value);
 const column=(id,title,cell,qualifier='')=>({id,title,cell,sortLabel:title+qualifier+'排序'});
 host.researchTableConfig={
  bodyId:'records',
  rows,
  columns:[
   column('signal','跌破日期',r=>({text:r.signal})),
   column('reclaim_date','首次站回',r=>({text:r.reclaim_date||'尚未站回',className:r.reclaim_date?'':'pending'})),
   column('reclaim_sessions','交易日',r=>({text:days(r.reclaim_sessions,r)}),'（站回年线）'),
   column('effective_reclaim_date','有效站回年线',r=>({text:r.effective_reclaim_date||'尚未确认',className:r.effective_reclaim_date?'':'pending'})),
   column('effective_reclaim_sessions','交易日',r=>({text:days(r.effective_reclaim_sessions,r)}),'（有效站回）'),
   column('peak_recovery_date','收复前高',r=>({text:dash(r.peak_recovery_date)})),
   column('peak_recovery_sessions','交易日',r=>({text:days(r.peak_recovery_sessions,r)}),'（收复前高）'),
   column('additional_loss_pct','跌破后至最低点¹',r=>({text:pct(r.additional_loss_pct),className:'loss'})),
   column('peak_to_low_pct','前高至最低点',r=>({text:pct(r.peak_to_low_pct),className:'loss'})),
  ],
  matches:r=>(year==='all'||r.signal.startsWith(year))&&(
   status==='all'||(status==='open'?r.reclaim_sessions==='':status==='done'?r.reclaim_sessions!=='':r.reclaim_sessions!==''&&r.reclaim_sessions>20)),
  sort:{id:sortKey,desc:sortDirection==='desc'},
  compare:compareRows,
  sortBy:id=>{
   sortDirection=sortKey===id?(sortDirection==='asc'?'desc':'asc'):(id==='signal'?'desc':'asc');
   sortKey=id;$('sort').value='custom';page=1;table();
  },
  empty:errorMessage||'没有符合条件的样本，请调整筛选。',
  pagination:{pageIndex:page-1,pageSize:12},
  onView:(count,pages)=>{
   pageCount=pages;
   $('count').textContent='共 '+count+' 条记录';
   $('page').textContent=page+' / '+pages;
   $('prev').disabled=page===1;
   $('next').disabled=page===pages;
  },
 };
 host.dispatchEvent(new Event('research-table-update'));
}

async function init(){
 try{
  [all,archivedCycles]=await Promise.all([fetch('all_signals.json').then(r=>r.json()),fetch('cycles.json').then(r=>r.json())]);
  [...new Set(all.map(r=>r.signal.slice(0,4)))].sort().reverse().forEach(y=>$('year').add(new Option(y,y)));
  bars();refreshCycleTimeline();table();
  ['sample','year','status','sort'].forEach(id=>$(id).onchange=()=>{page=1;if(id==='sort')applyPreset();table();});
  $('prev').onclick=()=>{if(page>1){page--;table();}};
  $('next').onclick=()=>{if(page<pageCount){page++;table();}};
  $('reset').onclick=()=>{['sample','year','status','sort'].forEach(id=>$(id).selectedIndex=0);$('sort').value='new';sortKey='signal';sortDirection='desc';page=1;table();};
  document.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{unit=b.dataset.unit;document.querySelectorAll('[data-unit]').forEach(x=>x.classList.toggle('active',x===b));chart();});
 }catch(error){
  table('数据加载失败，请刷新重试。');
  console.error(error);
 }
}
init();

function compareRows(a,b,id,desc){
 const av=a[id],bv=b[id],am=av===''||av==null,bm=bv===''||bv==null;
 const tie=b.signal.localeCompare(a.signal);
 const priority=am===bm?tie:Number(am)-Number(bm);
 if(am||bm)return desc?-priority:priority;
 const result=typeof av==='number'?av-bv:String(av).localeCompare(String(bv));
 return result||(desc?-tie:tie);
}

function applyPreset(){
 const presets={new:['signal','desc'],old:['signal','asc'],slow:['reclaim_sessions','desc'],loss:['additional_loss_pct','asc']};
 [sortKey,sortDirection]=presets[$('sort').value]||[sortKey,sortDirection];
}
