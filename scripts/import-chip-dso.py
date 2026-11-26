import json,datetime,pathlib,sys
cut=sys.argv[2] if len(sys.argv)>2 else datetime.date.today().isoformat();input_dir=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path('/tmp/chip-dso');res=[]
for n,cik in [('NVDA',1045810),('AMD',2488),('AVGO',1730168),('MRVL',1835632),('INTC',50863)]:
 d=json.load(open(input_dir/(n+'.json')))['facts']['us-gaap']
 def facts(tag):return [r for r in d.get(tag,{}).get('units',{}).get('USD',[]) if r.get('filed','')<=cut and r.get('form') in ['10-K','10-Q']]
 def days(a,b):return (datetime.date.fromisoformat(b)-datetime.date.fromisoformat(a)).days+1
 def url(r):return f'https://www.sec.gov/Archives/edgar/data/{cik}/'+r['accn'].replace('-','')+'/'+r['accn']+'-index.html'
 ar={};rev={};allrev=facts('Revenues' if n=='NVDA' else 'RevenueFromContractWithCustomerExcludingAssessedTax')
 for r in sorted(facts('AccountsReceivableNetCurrent'),key=lambda x:x['filed']):ar[r['end']]=r
 for r in sorted(allrev,key=lambda x:x['filed']):
  if 70<=days(r['start'],r['end'])<=105:rev[r['end']]={**r,'derived':False,'sources':[url(r)]}
 for r in allrev:
  if 350<=days(r['start'],r['end'])<=380 and r['end'] not in rev:
   bases=[b for b in allrev if b['start']==r['start'] and 250<=days(b['start'],b['end'])<=290 and b['end']<r['end']]
   if bases:
    b=sorted(bases,key=lambda x:x['filed'])[-1];start=(datetime.date.fromisoformat(b['end'])+datetime.timedelta(days=1)).isoformat();rev[r['end']]={**r,'start':start,'val':r['val']-b['val'],'derived':True,'sources':[url(r),url(b)]}
 rows=[]
 for end,r in sorted(rev.items()):
  start=r['start'];prev=(datetime.date.fromisoformat(start)-datetime.timedelta(days=1)).isoformat()
  if end<'2025-01-01' or end not in ar or prev not in ar:continue
  a,b=ar[prev],ar[end];nd=days(start,end)
  rows.append({'asOf':end,'start':start,'days':nd,'revenue':r['val']/1e6,'openingAR':a['val']/1e6,'closingAR':b['val']/1e6,'dso':(a['val']+b['val'])/2/r['val']*nd,'endDso':b['val']/r['val']*nd,'publishedAt':max(r['filed'],a['filed'],b['filed']),'derivedRevenue':r['derived'],'sourceUrls':list(dict.fromkeys(r['sources']+[url(a),url(b)]))})
 rows=rows[-4:];res.append({'id':n,'name':{'NVDA':'英伟达','AMD':'AMD','AVGO':'博通','MRVL':'Marvell 迈威尔','INTC':'Intel 英特尔'}[n],'factsUrl':f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json','rows':rows})
 print(n,[(r['asOf'],round(r['dso'],1),round(r['endDso'],1)) for r in rows])
pathlib.Path('cycle-public/chip-dso.json').write_text(json.dumps({'checkedAt':cut,'unit':'USD million','method':'average_ar_actual_quarter_days','companies':res},ensure_ascii=False,indent=2))
