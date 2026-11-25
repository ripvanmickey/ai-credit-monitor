"""Public DTCC SEC credit disclosures. No dealer quotes or upfront conversion."""
import argparse, collections, csv, datetime as dt, io, json, pathlib, statistics, sys, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor
ALIASES={'CRWV':['COREWEAVE'],'ORCL':['ORACLE CORP'],'MSFT':['MICROSOFT'],'AMZN':['AMAZON.COM'],'GOOGL':['ALPHABET'],'META':['META PLATFORMS'],'NVDA':['NVIDIA'],'SFTBY':['SOFTBANK GROUP'],'AMD':['ADVANCED MICRO DEVICES'],'INTC':['INTEL CORP'],'AVGO':['BROADCOM'],'SPCX':['SPACE EXPLORATION'],'IREN':['IREN LTD','IREN LIMITED','IRIS ENERGY'],'NBIS':['NEBIUS'],'EQIX':['EQUINIX'],'DLR':['DIGITAL REALTY']}
def derive(files,start,end,checked_at):
 matches=[m for f in files for m in f.get('matches',[])]
 lookup={m['raw']['Dissemination Identifier']:m for m in matches}
 def origin(identifier):
  seen=set()
  while identifier in lookup and identifier not in seen:
   seen.add(identifier);parent=lookup[identifier]['raw'].get('Original Dissemination Identifier','')
   if not parent:return identifier
   identifier=parent
  return identifier
 errors={origin(m['raw'].get('Original Dissemination Identifier','')) for m in matches if m['raw'].get('Action type')=='EROR'}
 corrections=collections.defaultdict(list)
 for m in matches:
  if m['raw'].get('Action type')=='CORR':corrections[origin(m['raw']['Dissemination Identifier'])].append(m)
 summary={};series=[]
 for entity in ALIASES:
  selected=[];excluded=collections.Counter();seen=set()
  for item in matches:
   r=item['raw'];m=item
   if m['entityId']!=entity or r.get('Action type')!='NEWT' or r.get('Event type')!='TRAD':continue
   key=origin(r['Dissemination Identifier'])
   if key in seen:continue
   seen.add(key)
   if key in errors:excluded['withdrawn']+=1;continue
   if corrections.get(key):
    m=max(corrections[key],key=lambda x:(x['raw'].get('Event timestamp',''),int(x['raw']['Dissemination Identifier'])));r=m['raw']
   try:years=(dt.datetime.fromisoformat(r['Expiration Date'])-dt.datetime.fromisoformat(r['Execution Timestamp'].replace('Z','+00:00')).replace(tzinfo=None)).days/365.25
   except Exception:excluded['missing_dates']+=1;continue
   if not start<=r['Execution Timestamp'][:10]<=end:excluded['execution_outside_window']+=1;continue
   if not 4.4<=years<=5.6:excluded['not_5y_bucket']+=1;continue
   if r.get('UPI FISN')!='NA/CDS Corp SN Sr' or r.get('Notional currency-Leg 1')!='USD' or r.get('Package indicator','').upper()!='FALSE' or r.get('Non-standardized term indicator','').upper()!='FALSE':excluded['contract_not_confirmed']+=1;continue
   if r.get('Fixed rate-Leg 1') or not r.get('Spread-Leg 1') or r.get('Spread notation-Leg 1') not in ('3','4'):excluded['no_unambiguous_spread']+=1;continue
   try:value=float(r['Spread-Leg 1'])*(10000 if r['Spread notation-Leg 1']=='3' else 1)
   except Exception:excluded['invalid_spread']+=1;continue
   if not 0<value<10000:excluded['spread_out_of_range']+=1;continue
   selected.append({'date':r['Execution Timestamp'][:10],'value':value,'tradeId':key,'disseminationId':r['Dissemination Identifier'],'fileDate':m['fileDate'],'sourceUrl':m['sourceUrl']})
  by_date=collections.defaultdict(list)
  for trade in selected:by_date[trade['date']].append(trade)
  rows=[]
  for date,trades in sorted(by_date.items()):
   values=[t['value'] for t in trades]
   rows.append({'asOf':date,'value':statistics.median(values),'tradeLow':min(values),'tradeHigh':max(values),'tradeCount':len(trades),'tradeIds':[t['tradeId'] for t in trades],'disseminationIds':[t['disseminationId'] for t in trades],'sourceUrls':sorted(set(t['sourceUrl'] for t in trades)),'lastDisclosureDate':max(t['fileDate'] for t in trades)})
  summary[entity]={'disclosures':sum(m['entityId']==entity for m in matches),'eligibleTrades':len(selected),'observedDays':len(rows),'excluded':dict(excluded)}
  if rows:series.append({'entityId':entity,'seriesKey':'dtcc:'+entity+':USD:senior:4.4-5.6Y','measurement':'trade_median','tenor':'approx5Y','currency':'USD','seniority':'senior','restructuring':None,'sourceId':'DTCC','rows':rows})
 return {'schemaVersion':1,'from':start,'to':end,'checkedAt':checked_at,'availableFiles':sum(f['status']=='ok' for f in files),'requestedFiles':len(files),'files':[{'date':f['day'],'status':f['status'],'url':f['url']} for f in files],'summary':summary,'series':series,'method':'公开披露窗口内的新交易，经窗口内更正和撤销核验；USD、优先级单名CDS、剩余4.4—5.6年、非组合及非非标准条款。仅采用无固定票息且明示Spread的记录，notation 3乘10000、4按bp；按成交日取未加权中位数。不是每日收盘或交易商连续报价，后续披露可能订正。票息或预付款不换算成市场利差。'}
def collect(start,end,cache):
 def fetch(day):
  stamp=day.strftime('%Y_%m_%d');url=f'https://pddata.dtcc.com/ppd/api/report/cumulative/sec/SEC_CUMULATIVE_CREDITS_{stamp}.zip';p=cache/(stamp+'.json')
  if p.exists():
   saved=json.loads(p.read_text())
   # Retry inaccessible files, and recheck recent files for late disclosures/corrections.
   if saved.get('status')=='ok' and day < end-dt.timedelta(days=3):return saved
  try:
   with urllib.request.urlopen(url,timeout=25) as r:body=r.read(20000001)
   if len(body)>20000000:raise ValueError('download exceeds 20MB')
   z=zipfile.ZipFile(io.BytesIO(body));reader=csv.DictReader(io.TextIOWrapper(z.open(z.namelist()[0]),encoding='utf-8-sig'))
   fields=set(reader.fieldnames or [])
   if not {'Dissemination Identifier','Action type','Execution Timestamp'}.issubset(fields) or not fields.intersection({'UPI Underlier Name','Underlying Asset Name'}):raise ValueError('Unexpected DTCC credit CSV schema')
   raw=list(reader);matches=[]
   for row in raw:
    name=' '.join(row.get(k,'') for k in ['UPI Underlier Name','Underlying Asset Name']).upper()
    for entity,aliases in ALIASES.items():
     if any(a in name for a in aliases):matches.append({'entityId':entity,'fileDate':day.isoformat(),'sourceUrl':url,'raw':row});break
   result={'day':day.isoformat(),'url':url,'status':'ok','matches':matches}
  except Exception as e:result={'day':day.isoformat(),'url':url,'status':'unavailable','error':str(e)}
  p.write_text(json.dumps(result));return result
 days=[start+dt.timedelta(days=i) for i in range((end-start).days+1)]
 with ThreadPoolExecutor(max_workers=4) as pool:files=list(pool.map(fetch,days))
 return derive(files,start.isoformat(),end.isoformat(),dt.datetime.now(dt.timezone.utc).isoformat())
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--from-date');parser.add_argument('--to-date');parser.add_argument('--days',type=int,default=67);parser.add_argument('--cache-dir',default='.dtcc-cache');parser.add_argument('--output',required=True);args=parser.parse_args()
 end=dt.date.fromisoformat(args.to_date) if args.to_date else dt.datetime.now(dt.timezone.utc).date()-dt.timedelta(days=1)
 start=dt.date.fromisoformat(args.from_date) if args.from_date else end-dt.timedelta(days=args.days-1)
 if not 0<=(end-start).days<=100:raise SystemExit('Window must be at most 101 calendar days')
 cache=pathlib.Path(args.cache_dir);cache.mkdir(parents=True,exist_ok=True);study=collect(start,end,cache)
 if study['availableFiles']<study['requestedFiles']*.8:raise SystemExit('Less than 80% of files accessible; preserve saved study')
 pathlib.Path(args.output).write_text(json.dumps(study,ensure_ascii=False));print(json.dumps({'files':study['availableFiles'],'series':len(study['series']),'days':sum(len(s['rows']) for s in study['series'])}))
