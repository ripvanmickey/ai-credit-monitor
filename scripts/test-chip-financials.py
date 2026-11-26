import importlib.util
import json
import os
import pathlib
import tempfile

spec=importlib.util.spec_from_file_location('financials','scripts/refresh-chip-financials.py')
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
def fact(**kw):
    return {'filed':'2026-11-17','form':'10-Q','accn':'0001045810-26-000088',**kw}
data={'facts':{'us-gaap':{
    'AccountsReceivableNetCurrent':{'units':{'USD':[fact(end='2026-07-26',val=63059000000),fact(end='2026-10-25',val=81033000000)]}},
    'Revenues':{'units':{'USD':[fact(start='2026-07-27',end='2026-10-25',val=115844000000),fact(start='2026-01-26',end='2026-10-25',val=293681000000)]}}
}}}
assert m.quarter_rows(data,1045810,'2026-11-16')==[]
rows=m.quarter_rows(data,1045810,'2026-11-26')
assert len(rows)==1 and rows[0]['days']==91
assert abs(rows[0]['dso']-56.594955284693214)<1e-9
saved=json.load(open('cycle-public/chip-dso.json'))
company=next(c for c in saved['companies'] if c['id']=='NVDA')
latest=next(r for r in company['rows'] if r['asOf']=='2026-10-25')
assert latest['asOf']=='2026-10-25' and latest['publishedAt']=='2026-11-17'
assert abs(latest['endDso']-rows[0]['endDso'])<1e-9
assert latest['issuerDso']==64 and latest['issuerDso']!=latest['dso']
original=os.getcwd()
with tempfile.TemporaryDirectory() as temp:
    try:
        os.chdir(temp)
        pathlib.Path('cycle-public').mkdir()
        pathlib.Path('.github').mkdir()
        older={**company,'rows':[r for r in company['rows'] if r['asOf']<'2026-10-25']}
        pathlib.Path('cycle-public/chip-dso.json').write_text(json.dumps({'companies':[older]}))
        pathlib.Path('.github/earnings-review.json').write_text(json.dumps({'reviews':[{'entityId':'NVDA','row':latest}]}))
        def unavailable(url):
            raise RuntimeError('HTTP 403')
        m.fetch=unavailable
        m.refresh()
        after=json.loads(pathlib.Path('cycle-public/chip-dso.json').read_text())
        assert after['companies'][0]['rows'][-1]['asOf']=='2026-10-25'
        assert after['financialChecks'][0]['status']=='partial'
        assert after['companies'][0]['rows'][0]==older['rows'][0]
    finally:
        os.chdir(original)
print('PASS: publication-date filtering, quarterly versus cumulative revenue, actual quarter days and separate issuer/reconstructed DSO.')
