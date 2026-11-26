const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—',signed=(v,unit='%')=>Number.isFinite(v)?(Number(v.toFixed(1))>0?'↑ +':Number(v.toFixed(1))<0?'↓ ':'→ ')+num(Number(v.toFixed(1)))+unit:'—';
const link=(url,title)=>{try{if(new URL(url).protocol==='https:')return '<a class="source" href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(title||'查看来源')+' ↗</a>';}catch{}return '—';};
function showChartMessage(target, markup){
 target.researchChartPayload=null;
 target.renderResearchChart?.();
 target.innerHTML=markup;
}

function renderChartWithLegend(target, legend, selector){
 if(!target.renderResearchChart)return false;
 target.querySelector(':scope > .blank')?.remove();
 const previous=target.querySelector(selector);
 if(previous)previous.outerHTML=legend;
 else target.insertAdjacentHTML('afterbegin',legend);
 target.renderResearchChart();
 return true;
}

let gpuData=null,bondData=null;
const money=v=>Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
function changeBadge(change,unit='%',stale=false){
 if(!change)return '<small class="move muted">近1月：样本不足</small>';
 const raw=unit==='%'?change.pct:change.delta;if(!Number.isFinite(raw))return '<small>基准为零，无法计算</small>';
 const v=Math.abs(raw)<1e-8?0:raw,cls=v>0?'rise':v<0?'fall':'flat',arrow=v>0?'↑':v<0?'↓':'→';
 return '<span class="move '+cls+'">'+arrow+' '+(v>0?'+':'')+money(v)+esc(unit)+(stale?' · 旧窗口':'')+'</span><small>'+esc(change.from)+' → '+esc(change.to)+'</small>';
}
function monthPoints(rows,dateKey='asOf'){if(!rows.length)return rows;const cutoff=Date.parse(rows.at(-1)[dateKey])-31*86400000;return rows.filter(r=>Date.parse(r[dateKey])>=cutoff);}

const providerNames={AWS:'AWS',AZURE:'Azure',GCP:'Google Cloud',RUNPOD:'Runpod',LAMBDA:'Lambda'};
const priceLabels={on_demand:'固定地区按需价',spot:'Spot参考价',secure_on_demand:'Secure Cloud地区未固定',community_from:'Community起步价',announced_on_demand:'公告按需价'};
function renderGpu(g){
 gpuData=g;$('#gpu-attribution').innerHTML='历史归档：'+link('https://gpurentalprices.com/data','GPU Rental Prices')+' · CC BY 4.0；按原采集日期读取，已检查更正清单。Google固定规格按需价尚无合格历史，未用其Spot记录替代。';$('#gpu-checked').textContent='最近检查：'+(g.checkedAt||'—').replace('T',' ').slice(0,19)+' UTC · '+({ok:'来源可读',partial:'部分来源失败',failed:'检查失败，保留旧值'})[g.status];
 const filter=$('#gpu-filter').value,list=g.series.filter(s=>filter==='all'||(filter==='on_demand'?s.trendEligible:!s.trendEligible));
 $('#gpu-rows').innerHTML=list.map(s=>{const o=s.latest;return '<tr><td>'+orderCompanyIdentity(o.entityId,providerNames[o.entityId]||o.entityId,o.model)+'</td><td>'+esc(o.sku)+'<small>'+esc(o.region)+' · '+o.gpus+'卡实例</small></td><td class="number"><b>$'+money(o.value)+'</b>'+changeBadge(s.monthChange,'%',s.stale)+(o.instanceHourly?'<small>整机 $'+money(o.instanceHourly)+'/小时 ÷ '+o.gpus+'</small>':'')+'</td><td><span class="pill">'+esc(s.pending?'尚未生效':priceLabels[o.billing]||o.billing)+'</span><small>'+esc(o.note)+'</small>'+(o.effectiveAt?'<small>生效日 '+esc(o.effectiveAt.slice(0,10))+'</small>':'')+'</td><td class="number">'+esc(o.asOf)+(s.stale?'<small>旧观测</small>':'')+'</td><td>'+s.n+'个观测日<small>'+link(o.sourceUrl,'官方来源')+(o.archiveUrl?' / '+link(o.archiveUrl,'历史归档'):'')+'</small></td></tr>';}).join('');
 const selected=$('#gpu-series').value;$('#gpu-series').innerHTML=g.series.map(s=>'<option value="'+esc(s.key)+'">'+esc(providerNames[s.latest.entityId]+' · '+s.latest.sku+' · '+s.latest.region+' · '+(priceLabels[s.latest.billing]||s.latest.billing))+'</option>').join('');if(g.series.some(s=>s.key===selected))$('#gpu-series').value=selected;else if(g.series.some(s=>s.trendEligible))$('#gpu-series').value=g.series.find(s=>s.trendEligible).key;renderGpuHistory();
}
function tinyHistory(target,points,unit){
 const chart=$(target);
 const format=v=>unit.includes('美元')?money(v):num(v,2);
 if(!points.length){showChartMessage(chart,'<p class="blank">尚无同日可比数据。</p>');return;}
 if(points.length===1){showChartMessage(chart,'<p class="blank"><b>'+esc(points[0].date)+'　'+format(points[0].value)+' '+esc(unit)+'</b><br>目前只有1个观测日，已建立基准；暂不判断涨跌方向。</p>');return;}
 chart.researchChartPayload={series:[{name:unit,color:'#dc2626',points}],unit,gapDays:7};
 if(chart.renderResearchChart){chart.querySelector(':scope > .blank')?.remove();chart.renderResearchChart();return;}
 const W=900,H=230,L=65,R=25,T=20,B=40,minDate=Date.parse(points[0].date),maxDate=Date.parse(points.at(-1).date),vs=points.map(p=>p.value);let low=Math.min(...vs),high=Math.max(...vs),pad=(high-low||Math.abs(high)*.05||1)*.2;low-=pad;high+=pad;
 const x=d=>L+(Date.parse(d)-minDate)/(maxDate-minDate||1)*(W-L-R),y=v=>T+(high-v)/(high-low)*(H-T-B);let path='',prev=null;
 for(const p of points){path+=(!prev||Date.parse(p.date)-Date.parse(prev)>7*86400000?'M':'L')+x(p.date)+','+y(p.value)+' ';prev=p.date;}
 chart.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(unit)+'历史走势" style="width:100%;display:block;margin-top:15px"><line x1="'+L+'" x2="'+(W-R)+'" y1="'+(H-B)+'" y2="'+(H-B)+'" stroke="#d5d5d5"/><path d="'+path+'" fill="none" stroke="#dc2626" stroke-width="2.5"/>'+points.map(p=>'<circle cx="'+x(p.date)+'" cy="'+y(p.value)+'" r="3" fill="#f87171"><title>'+esc(p.date)+' '+format(p.value)+' '+esc(unit)+'</title></circle>').join('')+'<text x="'+L+'" y="'+(H-12)+'" fill="#787878" font-size="12">'+esc(points[0].date)+'</text><text x="'+(W-R)+'" y="'+(H-12)+'" text-anchor="end" fill="#787878" font-size="12">'+esc(points.at(-1).date)+'</text><text x="8" y="28" fill="#787878" font-size="12">'+num(high,2)+'</text><text x="8" y="'+(H-B)+'" fill="#787878" font-size="12">'+num(low,2)+'</text></svg>';
}
function renderGpuHistory(){const s=gpuData?.series.find(s=>s.key===$('#gpu-series').value);tinyHistory('#gpu-history',monthPoints(s?.rows||[]).map(r=>({date:r.asOf,value:r.value})),'美元／GPU小时');const m=s?.monthChange;$('#gpu-series-reading').textContent=!s?'':s.pending?'公告价尚未生效，不能用于判断当前供需。':!m?'该规格近月可比历史不足，暂不判断供需变化。':s.stale?'该规格属于旧窗口，不能推断当前供需。':Math.abs(m.pct)<1?'近月租价大致持平；没有涨价证据确认算力趋紧，仍需用量、利用率与可租容量交叉验证。':m.pct>0?'近月同规格租价上涨，支持供需趋紧的线索；尚不能区分需求增长与供给受限。':'近月同规格租价下跌，紧缺程度可能缓解；也需排除促销、代际替换与竞争影响。';}
function renderBonds(b){
 bondData=b;$('#bond-checked').textContent='最近资料检查：'+b.checkedAt.slice(0,10)+' · 不代表所有债券均为当日报价';
 $('#bond-rows').innerHTML=b.bonds.map(s=>{const o=s.latest;return '<tr><td>'+orderCompanyIdentity(s.entityId,s.name,s.isin)+'</td><td>'+num(s.coupon,3)+'%<small>'+esc(s.maturity)+(s.callable?' · 可赎回':' · 赎回条款见来源')+'</small></td><td class="number">'+(o?num(o.value,3)+'%':'—')+'<small>提供方计算YTM</small></td><td class="number">'+(o?.treasury5Y!=null?num(o.treasury5Y,2)+'%':'—')+'<small>'+link('https://www.federalreserve.gov/releases/h15/','H15名义5年')+'</small></td><td class="number">'+(o?.spreadBp!=null?num(o.spreadBp,1):'—')+changeBadge(s.monthChange,'bp',s.stale)+'<small>'+(o?.treasury5Y==null?'缺同日基准，不跨日填补':'与5年美债相减')+'</small></td><td>'+esc(s.direction)+(s.monthChange?'':'<small>不足一个月，以下为短区间变化</small>')+'<small>5日 '+signed(s.change5?.bp,'bp')+' / 20日 '+signed(s.change20?.bp,'bp')+'</small>'+(s.directionWindow?'<small>'+esc(s.directionWindow.from)+' → '+esc(s.directionWindow.to)+'</small>':'<small>配对样本 '+s.matched+'日</small>')+'</td><td>'+esc(o?.asOf||'—')+(s.stale?'<small>旧样本</small>':'')+(s.latestQuote&&s.latestQuote.asOf!==o?.asOf?'<small>较新YTM '+esc(s.latestQuote.asOf)+'未配对国债</small>':'')+(s.alternative&&s.alternative.asOf>o?.asOf?'<small>另源 '+esc(s.alternative.asOf)+' '+num(s.alternative.value,2)+'%（未拼接）</small>':'')+'<small>'+link(s.activeSourceUrl||s.sourceUrl,s.historySource||'参考收益率来源')+'</small></td></tr>';}).join('');
 const selected=$('#bond-series').value;$('#bond-series').innerHTML=b.bonds.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name+' · '+s.isin)+'</option>').join('');if(b.bonds.some(s=>s.id===selected))$('#bond-series').value=selected;else if(b.bonds.some(s=>s.entityId==='ORCL'))$('#bond-series').value=b.bonds.find(s=>s.entityId==='ORCL').id;renderBondHistory();
}
function renderBondHistory(){renderCreditHistory();}
$('#gpu-filter').onchange=()=>{if(gpuData)renderGpu(gpuData)};$('#gpu-series').onchange=renderGpuHistory;$('#bond-series').onchange=renderBondHistory;

function researchPanel(title,text,metrics,limits){return '<div class="eyebrow">本期结论 / 随证据更新</div><h3>'+esc(title)+'</h3><p>'+esc(text)+'</p><div class="research-metrics">'+metrics.map(m=>'<span>'+esc(m)+'</span>').join('')+'</div><small class="info-note">'+esc(limits)+'</small>';}
function renderResearch(){const r=current?.research;if(!r)return;
 const p=r.pricing;$('#pricing-conclusion').innerHTML=researchPanel(p.title,p.text,['可比供应商 '+p.providers+' 家','可比固定规格 '+p.qualified+' / '+p.total,'上涨 '+p.up+' · 持平 '+p.flat+' · 下跌 '+p.down],p.threshold+' '+p.limits);
 const c=r.credit,score=c.score,labels=['未达阈值','预警','压力'],level=x=>x==null?'证据不足':labels[x];
 $('#credit-conclusion').innerHTML=researchPanel(c.title,'分别观察CDS利差，以及公司债YTM减同日5年美债的利差，是否持续走阔或收窄。以下每家公司保留自己的实际比较区间。',['核心公司覆盖 '+c.covered+' / '+c.coreTotal,'CDS压力等级：'+level(score?.cds.level),'公司债压力等级：'+level(score?.bonds.level)],c.limits+' 评分：'+(score?.rule||'暂缺'));
 $('#credit-overview').innerHTML=c.companies.map(s=>{const d=s.cds,b=s.bond;return '<tr><td>'+orderCompanyIdentity(s.entityId,s.name,s.entityId+(s.core?' · 核心云厂商':' · Neocloud旁证'))+'</td><td class="number">'+(d?.latest?num(d.latest.value,1)+' bp':'—')+changeBadge(d?.monthChange?{...d.monthChange,delta:d.monthChange.delta}:null,'bp',!s.cdsValid)+'<small>'+esc(d?d.measurement==='daily_close'?'公开日线':'DTCC合格成交中位数':'缺少合格连续序列')+'</small><small>'+link(d?.sourceUrl,'CDS来源')+'</small></td><td class="number">'+(b?.latest?.spreadBp!=null?num(b.latest.spreadBp,1)+' bp':'—')+changeBadge(b?.monthChange,'bp',b?.stale)+'<small>'+esc(b?.historySource||'')+' · '+esc(b?.latest?.asOf||'—')+'</small><small>'+link(b?.activeSourceUrl,'债券来源')+'</small></td><td>'+esc(s.conclusion)+'</td></tr>';}).join('');renderCreditHistory();
}
function creditComparisonChart(series){
 const host=$('#credit-history');
 const data=series.flatMap(s=>s.points);if(!data.length){showChartMessage(host,'<p class="blank">尚无可比信用历史。</p>');return;}
 const legend=series.map(s=>'<span style="display:inline-block;margin:8px 24px 0 0"><i style="display:inline-block;width:18px;border-top:3px solid '+s.color+';margin-right:7px"></i>'+esc(s.name)+(s.points.length?' · '+esc(s.points[0].date)+' → '+esc(s.points.at(-1).date):' · 暂无合格数据')+'</span>').join('');
 const legendMarkup='<div class="credit-legend">'+legend+'</div>';
 host.researchChartPayload={series,unit:'bp',gapDays:7};
 if(renderChartWithLegend(host,legendMarkup,'.credit-legend'))return;
 const W=1000,H=330,L=65,R=25,T=28,B=45,dates=data.map(p=>Date.parse(p.date)),loDate=Math.min(...dates),hiDate=Math.max(...dates),values=data.map(p=>p.value);let lo=Math.min(...values),hi=Math.max(...values),pad=(hi-lo||Math.abs(hi)*.05||1)*.15;lo-=pad;hi+=pad;
 const x=d=>L+(Date.parse(d)-loDate)/(hiDate-loDate||1)*(W-L-R),y=v=>T+(hi-v)/(hi-lo)*(H-T-B);

 const grid=Array.from({length:5},(_,i)=>{const v=lo+(hi-lo)*i/4;return '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#d5d5d5"/><text x="'+(L-10)+'" y="'+(y(v)+4)+'" text-anchor="end" fill="#787878" font-size="12">'+num(v,1)+'</text>';}).join('');
 const lines=series.map(s=>{let path='',prev;for(const p of s.points){path+=(!prev||Date.parse(p.date)-Date.parse(prev)>7*86400000?'M':'L')+x(p.date)+','+y(p.value)+' ';prev=p.date;}return '<path d="'+path+'" fill="none" stroke="'+s.color+'" stroke-width="2.5"'+(s.dashed?' stroke-dasharray="7 4"':'')+'/>'+s.points.map(p=>'<circle cx="'+x(p.date)+'" cy="'+y(p.value)+'" r="3.5" fill="'+s.color+'"><title>'+esc(s.name)+' · '+esc(p.date)+' · '+num(p.value,2)+' bp</title></circle>').join('');}).join('');
 const ticks=Array.from({length:4},(_,i)=>{const t=loDate+(hiDate-loDate)*i/3,d=new Date(t).toISOString().slice(0,10);return '<text x="'+x(d)+'" y="'+(H-12)+'" text-anchor="'+(i===0?'start':i===3?'end':'middle')+'" fill="#787878" font-size="12">'+d+'</text>';}).join('');
 host.innerHTML=legendMarkup+'<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="公司债信用利差与美元CDS共用bp轴对比" style="width:100%;display:block">'+grid+lines+ticks+'</svg>';
}
function renderCreditHistory(){
 const s=bondData?.bonds.find(s=>s.id===$('#bond-series').value),c=current?.research?.credit.companies.find(c=>c.bond?.id===s?.id);
 $('#credit-company-reading').textContent=c?c.name+'：'+c.conclusion+'。':'正在读取信用交叉证据…';
 creditComparisonChart([
 {name:'公司债信用利差（减同日5年美债）',color:'#dc2626',points:monthPoints((s?.rows||[]).filter(r=>r.spreadBp!=null)).map(r=>({date:r.asOf,value:r.spreadBp}))},
 {name:'5年期美元CDS · '+(c?.cds?.measurement==='trade_median'?'DTCC成交中位数':'公开日线'),color:'#2563eb',points:monthPoints(c?.cds?.rows||[]).map(r=>({date:r.asOf,value:r.value}))}
 ]);
}

let orderData=null;
const orderKindNames={stock:'未兑现订单余额',flow:'新增签约',flow_growth:'新签同比增速',flow_multiple:'新签TCV倍数',commitment:'专用容量采购',conditional:'条件性采购上限'};
function orderValue(o,s){if(!o)return '—';const prefix={'=':'','~':'约 ','>':'> ','<=':'≤ '}[o.operator]||'';return prefix+(s.unit==='USD bn'?num(o.value*10,2)+' 亿美元':s.unit==='multiple'?num(o.value,2)+' 倍':signed(o.value,'%'));}
const orderChange=v=>{if(!Number.isFinite(v))return '—';const r=Number(v.toFixed(2));return (r>0?'↑ +':r<0?'↓ ':'→ ')+num(r,2)+'%';};
function orderGrowth(g){return g?(g.approximate?'约 ':'')+orderChange(g.pct)+'<small>'+esc(g.from)+' → '+esc(g.to)+'</small>':'—';}
function renderOrders(data){if(!data)return;orderData=data;
 $('#orders-checked').textContent='最近核验：'+data.checkedAt.slice(0,10)+' · 各项实际观察期单列';
 $('#orders-conclusion').innerHTML=researchPanel(data.summary.title,data.summary.note,['已接入 '+data.companies.length+' 家公司','可比存量 '+data.summary.stockSeries+' 家','存量增长 '+data.summary.growing+' · 持平 '+data.summary.flat+' · 下降 '+data.summary.falling],'图表连接已披露观察点，未披露季度不补值。订单增长不等于已收现金；算力纯度与合同可撤销性需逐项核对。');
 const period=$('#order-period').value;$('#order-period').innerHTML='<option value="latest">各公司最新披露（日期可能不同）</option>'+data.alignment.periods.slice().reverse().map(d=>'<option value="'+d+'">'+orderQuarter(d)+(d===data.alignment.latestCommon?' · 最近共同季度':'')+'</option>').join('');$('#order-period').value=period||'latest';renderOrderOverview();renderOrderMatrix();renderOrdersComparison();
 const selected=$('#order-company').value;$('#order-company').innerHTML=data.companies.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name+' · '+c.role)+'</option>').join('');if(data.companies.some(c=>c.id===selected))$('#order-company').value=selected;renderOrderCompany();
}
function orderQuarter(date){return date.slice(0,4)+' Q'+Math.ceil(Number(date.slice(5,7))/3);}
const orderMissing={not_applicable:'不适用：采购合同',pending:'待发布该季财报',unverified:'已到披露期，待核验',history_missing:'该期历史待补'};
function orderCompanyIdentity(companyId,name,detail,action=false){
 const label=action?'<button class="company-pick" data-order-company="'+esc(companyId)+'">'+esc(name)+' ↘</button>':'<b>'+esc(name)+'</b>';
 return '<div class="order-company-identity">'+companyLogo(companyId)+'<div>'+label+'<small>'+esc(detail)+'</small></div></div>';
}
function renderOrderMatrix(){const a=orderData.alignment,visiblePeriods=a.periods.slice(-4);$('#orders-matrix-head').innerHTML='<tr><th>公司 / 存量口径</th>'+visiblePeriods.map(d=>'<th>'+orderQuarter(d)+'</th>').join('')+'</tr>';$('#orders-matrix-rows').innerHTML=a.companies.map(c=>{const s=orderData.series.find(s=>s.id===c.seriesId);return '<tr><td>'+orderCompanyIdentity(c.entityId,c.name,s.kind==='stock'?s.title:'按采购事件观察')+'</td>'+c.cells.filter(cell=>visiblePeriods.includes(cell.asOf)).map(cell=>'<td class="number">'+(cell.observation?link(cell.observation.sourceUrl,orderValue(cell.observation,s))+'<small>'+(cell.scopeTitle?'<small>'+esc(cell.scopeTitle)+'</small>':'')+(cell.qoq?'环比 '+orderChange(cell.qoq.pct):'序列起点')+'</small>':'<span class="missing-status">'+esc(orderMissing[cell.status])+'</span>')+'</td>').join('')+'</tr>';}).join('');}
function renderOrderOverview(){const period=$('#order-period').value,latest=period==='latest',comparable=[];
 $('#orders-period-note').textContent=latest?'当前表格按各公司最新期展示，不能当作同一季度比较。':'当前表格对齐 '+orderQuarter(period)+'（'+period+'）；下方单家公司图表保留完整历史。';
 $('#orders-overview').innerHTML=orderData.companies.map(c=>{const s=c.primarySeries,cell=latest?null:orderData.alignment.companies.find(x=>x.entityId===c.id).cells.find(x=>x.asOf===period),o=latest?s.latest:cell?.observation,g=latest?s.qoq:cell?.qoq;let conclusion=s.conclusion;
 if(!latest){conclusion=s.kind!=='stock'?'采购合同事件不适用季度订单存量；在详情中查看专用容量及兜底条款':!o?orderMissing[cell?.status]||'该期历史待补':g?(g.pct>1?'本季度可比订单存量增长':g.pct< -1?'本季度可比订单存量下降':'本季度可比订单存量大致持平'):'缺少相邻季度，暂不能判断环比';}
 if(o&&s.kind==='stock'&&g)comparable.push(g);
 return '<tr><td>'+orderCompanyIdentity(c.id,c.name,c.role,true)+'</td><td>'+esc(s.title)+'<small>'+esc(orderKindNames[s.kind])+'</small></td><td class="number">'+(o?orderValue(o,s):esc(orderMissing[cell?.status]||'该期历史待补'))+'<small>'+(o?'观察 '+esc(o.asOf):'未跨季填值')+'</small></td><td class="number">'+(g?orderGrowth(g):s.kind==='stock'?(o?'无相邻季可比基期':(orderMissing[cell?.status]||'本期未核验')+'，暂不计算'):'不适用：非存量指标')+'</td><td>'+esc(conclusion)+'<small>'+esc(c.note)+'</small></td><td>'+(o?link(o.sourceUrl,'原始披露')+'<small>发布 '+esc(o.publishedAt)+'</small>':'本期无可比披露')+'</td></tr>';}).join('');
 const up=comparable.filter(g=>g.pct>1).length,down=comparable.filter(g=>g.pct< -1).length;
 if(!latest)$('#orders-conclusion').innerHTML=researchPanel(orderQuarter(period)+'：'+comparable.length+'家公司有可比存量，'+up+'家增长', '本结论仅使用当前选择季度的同公司环比，不把不同季度凑在一起；也不把不同公司的金额相加。',['同季可比 '+comparable.length+' 家','增长 '+up+' · 持平 '+(comparable.length-up-down)+' · 下降 '+down], '各行仍有业务范围差异：微软含商业软件，AWS含非AI云，SpaceX为集团订单。');
 else $('#orders-conclusion').innerHTML=researchPanel(orderData.summary.title,orderData.summary.note,['最新期，日期不同','可比存量 '+orderData.summary.stockSeries+' 家'], '切换最近共同季度可对齐观察期。');
}
function renderOrderCompany(){const c=orderData?.companies.find(c=>c.id===$('#order-company').value);if(!c)return;
 const selected=$('#order-series').value;$('#order-series').innerHTML=c.series.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.title+' · '+orderKindNames[s.kind])+'</option>').join('');if(c.series.some(s=>s.id===selected))$('#order-series').value=selected;else $('#order-series').value=c.primary;
 $('#order-company-note').innerHTML='<b>'+esc(c.name)+' / '+esc(c.role)+'</b><p>'+esc(c.note)+'</p>'+(c.nextPublication?'<small>下一次已公告业绩会议：'+esc(new Date(c.nextPublication).toLocaleString('zh-CN',{timeZone:'Asia/Tokyo',hour12:false}))+' 东京时间 · '+esc(c.scheduleStatus)+' · '+link(c.scheduleUrl,'公司日程')+'</small>':'');
 renderOrderSeries();
}
function renderOrderSeries(){const s=orderData?.series.find(s=>s.id===$('#order-series').value);if(!s)return;
 $('#order-series-reading').innerHTML='<span class="eyebrow">'+esc(orderKindNames[s.kind])+'</span><h3>'+esc(s.conclusion)+'</h3><p>'+esc(s.note)+'</p><div class="research-metrics"><span>最新：'+orderValue(s.latest,s)+'</span>'+(s.qoq?'<span>环比 '+(s.qoq.approximate?'约 ':'')+orderChange(s.qoq.pct)+'</span>':'<span>'+(s.kind==='stock'?'存量环比：缺少相邻季度':'存量环比：不适用（非存量指标）')+'</span>')+(s.yoy?'<span>同比 '+orderChange(s.yoy.pct)+'</span>':'')+'</div>';
 orderHistory(s);
 $('#order-history-rows').innerHTML=s.rows.map(r=>'<tr><td>'+esc(r.asOf)+'</td><td class="number">'+orderValue(r,s)+'</td><td>'+esc(r.publishedAt)+'</td><td>'+link(r.sourceUrl,r.sourceTitle)+'<small>'+esc(r.note)+'</small></td></tr>').join('');
}
function orderHistory(s){const target=$('#order-history'),points=s.chart;if(!points.length){showChartMessage(target,'<p class="blank">暂无已核验历史，未补零。</p>');return;}
 const normalized=s.kind==='flow_multiple',bars=['flow','commitment','conditional'].includes(s.kind),unit=normalized?'上季度=100':s.unit==='USD bn'?'亿美元':'同比 %';
 const ps=points.map(p=>({...p,v:s.unit==='USD bn'?p.value*10:p.value}));
 if(points.length===1&&!bars){showChartMessage(target,'<p class="blank">只有1个披露点：'+esc(points[0].date)+' · '+orderValue(s.latest,s)+'；不足以绘制趋势。</p>');return;}
 target.researchChartPayload={series:[{name:s.title,color:'#dc2626',bar:bars,points:ps.map(p=>({date:p.date,value:p.v,operator:p.operator}))}],unit,gapDays:120};
 if(target.renderResearchChart){target.querySelector(':scope > .blank')?.remove();target.renderResearchChart();return;}
 const W=1000,H=280,L=85,R=35,T=35,B=50,minDate=Date.parse(ps[0].date),maxDate=Date.parse(ps.at(-1).date),values=ps.map(p=>p.v);let low=Math.min(...values),high=Math.max(...values);if(bars){low=0;high=Math.max(1,high*1.3);}else{const pad=(high-low||Math.abs(high)*.1||1)*.15;low-=pad;high+=pad;}
 const x=d=>ps.length===1?(W+L-R)/2:L+(Date.parse(d)-minDate)/(maxDate-minDate||1)*(W-L-R),y=v=>T+(high-v)/(high-low)*(H-T-B),fmt=p=>(p.operator==='~'?'约 ':p.operator==='>'?'> ':p.operator==='<='?'≤ ':'')+num(p.v,2);
 let marks='';if(bars){marks=ps.map(p=>'<rect x="'+(x(p.date)-24)+'" y="'+y(p.v)+'" width="48" height="'+(y(0)-y(p.v))+'" fill="'+(s.kind==='conditional'?'#c2bca7':'#dc2626')+'"><title>'+esc(p.date+' '+fmt(p)+' '+unit)+'</title></rect>').join('');}else{marks='<path d="'+ps.map((p,i)=>(i?'L':'M')+x(p.date)+','+y(p.v)).join(' ')+'" fill="none" stroke="#dc2626" stroke-width="2.5"'+(normalized||ps.some(p=>p.operator==='~')?' stroke-dasharray="7 4"':'')+'/>';}
 marks+=ps.map(p=>'<circle cx="'+x(p.date)+'" cy="'+y(p.v)+'" r="4" fill="#f87171"><title>'+esc(p.date+' '+fmt(p)+' '+unit+(p.normalized?'（归一化，不是美元金额）':''))+'</title></circle><text x="'+x(p.date)+'" y="'+Math.max(18,y(p.v)-12)+'" text-anchor="'+(p===ps[0]?'start':p===ps.at(-1)?'end':'middle')+'" fill="#171717" font-size="13">'+esc(fmt(p))+'</text>').join('');
 target.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(s.title+'历史趋势，'+unit)+'" style="width:100%;display:block"><line x1="'+L+'" x2="'+(W-R)+'" y1="'+(H-B)+'" y2="'+(H-B)+'" stroke="#d5d5d5"/>'+marks+'<text x="10" y="25" fill="#787878" font-size="12">'+esc(unit)+'</text><text x="'+L+'" y="'+(H-15)+'" fill="#787878" font-size="12">'+esc(ps[0].date)+'</text>'+(ps.length>1?'<text x="'+(W-R)+'" y="'+(H-15)+'" text-anchor="end" fill="#787878" font-size="12">'+esc(ps.at(-1).date)+'</text>':'')+'</svg><small>'+esc(normalized?'由披露的倍数归一化：比较期设为100，本期'+fmt(ps.at(-1))+'；虚线为示意，并非披露了两季绝对合同金额。':bars?'单笔／期间披露以柱形标注；不是连续订单余额，没有可比基期时不计算增速。':'仅连接同公司、同口径披露期末值；不表示期间每日变动。近似值以虚线连接，增速同样为近似。')+'</small>';

}
$('#order-company').onchange=renderOrderCompany;$('#order-series').onchange=renderOrderSeries;$('#orders-overview').onclick=e=>{const b=e.target.closest('[data-order-company]');if(b){$('#order-company').value=b.dataset.orderCompany;renderOrderCompany();$('#order-detail').scrollIntoView({behavior:'smooth',block:'start'});}};

$('#order-period').onchange=renderOrderOverview;

function renderOrdersComparison(){
 const indexed=$('#orders-chart-mode').value==='indexed',baseDate=orderData.alignment.commonFrom;
 const series=orderData.companies.flatMap(c=>[c.primarySeries,...(!indexed?c.series.filter(s=>s.comparisonHistory):[])].map(stock=>{const base=stock.rows.find(r=>r.asOf===baseDate);return {name:stock.historicalOnly?stock.title:c.name,color:companyChartColor(c.id),title:stock.title,dashed:!!stock.historicalOnly,points:stock.rows.filter(r=>!indexed||base&&r.asOf>=baseDate).map(r=>({date:r.asOf,value:indexed?r.value/base.value*100:r.value*10,raw:r.value*10,publishedAt:r.publishedAt,sourceUrl:r.sourceUrl}))};}));
 const points=series.flatMap(s=>s.points),target=$('#orders-comparison-chart');if(!points.length){showChartMessage(target,'<p class="blank">暂无可比历史。</p>');return;}
 const unit=indexed?'指数':'亿美元';
 const legend='<div class="research-metrics">'+series.map(s=>{const last=s.points.at(-1);return '<span><i style="display:inline-block;width:16px;border-top:3px solid '+s.color+';margin-right:6px"></i>'+esc(s.name)+(last?' · '+num(last.value,2)+' '+unit+'<small>截至 '+esc(last.date)+'</small>':' · 暂无数据')+'</span>';}).join('')+'</div>';
 $('#orders-comparison-note').textContent=(indexed?'共同基期 '+baseDate+'＝100；只比较该日以后的同公司余额变化。':'金额为亿美元，共用日期轴和金额轴，可切换共同起点＝100比较相对增速。')+' 各线采用公司的主要存量口径：微软商业RPO、AWS长期服务承诺、Google Cloud分部RPO、Nebius与CoreWeave会计RPO、SpaceX集团backlog。仅连接相邻季度披露点；缺季断线，不补零、不外推。悬停数据点查看数据截至日和披露日。2025年谷歌数据为Alphabet整体RPO，旧口径单列，不与2026年Google Cloud分部RPO连线或计算跨口径增幅。';
 target.researchChartPayload={series,unit,gapDays:120};
 if(renderChartWithLegend(target,legend,'.research-metrics'))return;
 const W=1100,H=360,L=85,R=30,T=25,B=45,minDate=Math.min(...points.map(p=>Date.parse(p.date))),maxDate=Math.max(...points.map(p=>Date.parse(p.date))),high=Math.max(...points.map(p=>p.value))*1.12||1;
 const x=d=>L+(Date.parse(d)-minDate)/(maxDate-minDate||1)*(W-L-R),y=v=>T+(high-v)/high*(H-T-B);
 const grid=Array.from({length:5},(_,i)=>{const v=high*i/4;return '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#d5d5d5"/><text x="'+(L-10)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="12" fill="#787878">'+num(v,0)+'</text>';}).join('');
 const paths=series.map(s=>{let prev;const path=s.points.map(p=>{const cmd=!prev||Date.parse(p.date)-Date.parse(prev)>120*86400000?'M':'L';prev=p.date;return cmd+x(p.date)+','+y(p.value);}).join(' ');return '<path d="'+path+'" fill="none" stroke="'+s.color+'" stroke-width="2.5"'+(s.dashed?' stroke-dasharray="7 4"':'')+'/>'+s.points.map(p=>'<circle cx="'+x(p.date)+'" cy="'+y(p.value)+'" r="4" fill="'+s.color+'"><title>'+esc(s.name+' · '+s.title+'\n数据截至 '+p.date+' · '+num(p.value,2)+' '+unit+'\n订单余额 '+num(p.raw,2)+' 亿美元\n披露日期 '+p.publishedAt)+'</title></circle>').join('');}).join('');
 const dates=[...new Set(points.map(p=>p.date))].sort(),ticks=dates.map((d,i)=>'<text x="'+x(d)+'" y="'+(H-12)+'" text-anchor="'+(i===0?'start':i===dates.length-1?'end':'middle')+'" fill="#787878" font-size="12">'+esc(d)+'</text>').join('');
 target.innerHTML=legend+'<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="未履约订单历史对比，'+unit+'" style="width:100%;display:block">'+grid+paths+ticks+'</svg>';


}
$('#orders-chart-mode').onchange=()=>{if(orderData)renderOrdersComparison();};

let current=null;
function render(a){
 current=a;renderOrders(a.orders);$('#dates').textContent='信用检查：'+(a.creditCheckedAt||'—')+' · 财报核验：'+a.fundamentalsCheckedAt.slice(0,10)+' · 计算：'+a.computedAt.slice(0,16).replace('T',' ')+' UTC';
 $('#summary').innerHTML='<div class="summary"><div><span class="eyebrow">当前判断</span><strong>'+esc(a.stage)+'</strong><small>只判断已取得的证据，不用股价下跌代替产业反转。</small></div><div><span class="eyebrow">触发 / 固定四项</span><strong class="number">'+a.triggered+' / 4</strong><small>可判断 '+a.coverage+' / 4项 · 未知 '+(4-a.coverage)+'项</small></div><div><span class="eyebrow">压力分值可能范围</span><strong class="number">'+a.points.lower+'—'+a.points.upper+' / 8</strong><div class="meter"><span class="range" style="left:'+a.points.lower/8*100+'%;width:'+(a.points.upper-a.points.lower)/8*100+'%"></span><span class="known" style="width:'+a.points.lower/8*100+'%"></span></div><small>未知项保留区间；不是反转概率。</small></div></div>';
 $('#cards').innerHTML=a.dimensions.map((d,i)=>'<article class="card"><div class="eyebrow">0'+(i+1)+' / '+esc(d.id)+'</div><h3>'+esc(d.title)+'</h3><details class="explanation status-explanation"><summary><span class="pill level'+d.level+'">'+esc(d.label)+'</span></summary><div class="explanation-content"><p>'+esc(d.reason)+'</p></div></details><a class="source" href="'+(d.id==='pricing'?'#gpu-rents':d.id==='credit'?'#cloud-credit':d.id==='orders'?'#order-demand':'#evidence-'+d.id)+'">查看证据 ↓</a></article>').join('');
 const names={MSFT:'Microsoft',AMZN:'Amazon',GOOGL:'Alphabet',ORCL:'Oracle',NVDA:'NVIDIA'};

 $('#context').innerHTML=[...a.leading,...a.context].map(c=>'<div><div class="eyebrow">'+esc(c.status||'反证 / 不计分')+'</div><h3>'+esc(c.title)+'</h3><p>'+esc(c.note)+'</p>'+link(c.sourceUrl,c.sourceTitle)+(c.asOf?'<small>披露日期 '+esc(c.asOf)+'</small>':'')+'</div>').join('');
}
async function load(){const b=$('#refresh');b.disabled=true;const paths=['/api/cycle','/api/gpu-prices','/api/bond-spreads'];try{const results=await Promise.allSettled(paths.map(async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(path+' ('+r.status+')');return r.json();}));const errors=[];for(const [i,r] of results.entries()){if(r.status==='rejected'){errors.push(r.reason.message);continue;}if(i===0)render(r.value);if(i===1)renderGpu(r.value);if(i===2)renderBonds(r.value);}renderResearch();$('#error').textContent=errors.length?'Partial data unavailable: '+errors.join(', '):'';}catch(e){$('#error').textContent=e.message;}finally{b.disabled=false;}}
$('#refresh').onclick=load;$('#export').onclick=()=>{if(!current)return;const url=URL.createObjectURL(new Blob([JSON.stringify({cycle:current,gpuPrices:gpuData,bondSpreads:bondData},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ai-capital-cycle-'+current.computedAt.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};load();setInterval(()=>{if(!document.hidden)load()},60000);
