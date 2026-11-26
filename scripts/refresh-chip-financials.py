"""Refresh chip receivables from SEC facts; retain issuer-release fallbacks and dates."""
import datetime as dt
import json
import pathlib
import re
import urllib.request

ISSUERS = {'NVDA':1045810, 'AMD':2488, 'AVGO':1730168, 'MRVL':1835632, 'INTC':50863}
TODAY = dt.datetime.now(dt.timezone.utc).date().isoformat()

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent':'Public Research Monitor research@users.noreply.github.com', 'Accept':'application/json,text/html'})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode('utf-8')

def quarter_rows(data, cik, through):
    facts = data['facts']['us-gaap']
    def values(tags):
        return [r for tag in tags for r in facts.get(tag,{}).get('units',{}).get('USD',[])
                if r.get('form') in ('10-K','10-Q') and r.get('filed','9999') <= through]
    def days(a,b):
        return (dt.date.fromisoformat(b)-dt.date.fromisoformat(a)).days+1
    def url(r):
        accession=r['accn']
        return f'https://www.sec.gov/Archives/edgar/data/{cik}/{accession.replace("-","")}/{accession}-index.html'
    ars={}
    for r in sorted(values(['AccountsReceivableNetCurrent']),key=lambda r:r['filed']):
        ars[r['end']]=r
    revenue={}
    all_revenue=sorted(values(['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax']),key=lambda r:r['filed'])
    for r in all_revenue:
        if r.get('start') and 70<=days(r['start'],r['end'])<=105:
            revenue[r['end']]=r
    for r in all_revenue:
        if not r.get('start') or not 350<=days(r['start'],r['end'])<=380 or r['end'] in revenue:
            continue
        bases=[b for b in all_revenue if b.get('start')==r['start'] and 250<=days(b['start'],b['end'])<=290 and b['end']<r['end']]
        if bases:
            b=bases[-1]
            revenue[r['end']]={**r,'start':(dt.date.fromisoformat(b['end'])+dt.timedelta(days=1)).isoformat(),
                'val':r['val']-b['val'],'derived':True,'base':b}
    result=[]
    for end,r in sorted(revenue.items()):
        opening=(dt.date.fromisoformat(r['start'])-dt.timedelta(days=1)).isoformat()
        if end not in ars or opening not in ars or end>through or r['val']<=0:
            continue
        a,b=ars[opening],ars[end]
        count=days(r['start'],end)
        result.append({'asOf':end,'start':r['start'],'days':count,'revenue':r['val']/1e6,
            'openingAR':a['val']/1e6,'closingAR':b['val']/1e6,
            'dso':(a['val']+b['val'])/2/r['val']*count,'endDso':b['val']/r['val']*count,
            'publishedAt':max(x['filed'] for x in (r,a,b)+((r['base'],) if r.get('derived') else ())), 'derivedRevenue':r.get('derived',False),
            'sourceUrls':list(dict.fromkeys(map(url,(r,a,b)+((r['base'],) if r.get('derived') else ())))), 'sourceType':'sec_companyfacts'})
    return result

def refresh():
    path=pathlib.Path('cycle-public/chip-dso.json')
    saved=json.loads(path.read_text())
    reviews=json.loads(pathlib.Path('.github/earnings-review.json').read_text())['reviews']
    checks=[]
    for company in saved['companies']:
        entity=company['id']
        if entity not in ISSUERS:
            continue
        check={'entityId':entity,'checkedAt':TODAY,'status':'ok','sourceUrl':company['factsUrl']}
        prior={r['asOf']:r for r in company['rows']}
        try:
            for row in quarter_rows(json.loads(fetch(company['factsUrl'])),ISSUERS[entity],TODAY):
                if row['asOf']>max(prior):
                    prior[row['asOf']]=row
        except Exception as error:
            check.update(status='partial',error=str(error))
        # Reviewed issuer releases can precede 10-Q/companyfacts availability.
        for review in reviews:
            row=review['row']
            if review['entityId']==entity and row['publishedAt']<=TODAY and row['asOf']>max(prior):
                prior[row['asOf']]=row
        company['rows']=[prior[date] for date in sorted(prior)]
        company['checkedAt']=TODAY
        check['latestPeriod']=max(prior)
        if entity=='NVDA':
            url='https://investor.nvidia.com/financial-info/financial-reports/'
            check['issuerUrl']=url
            try:
                html=re.sub('<[^>]+>',' ',fetch(url))
                match=re.search(r'quarter ended\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})',html,re.I)
                if not match:
                    raise ValueError('Issuer latest-period label not readable; manual issuer review required')
                period=dt.datetime.strptime(match[1],'%B %d, %Y').date().isoformat()
                check['issuerLatestPeriod']=period
                if period>check['latestPeriod']:
                    check.update(status='needs_issuer_review',error='Issuer release is newer than saved fundamentals; verify press release and CFO commentary before importing.')
            except Exception as error:
                check.update(status='partial',issuerError=str(error))
        checks.append(check)
    saved.update(checkedAt=TODAY,financialChecks=checks)
    path.write_text(json.dumps(saved,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(checks))

if __name__=='__main__':
    refresh()
