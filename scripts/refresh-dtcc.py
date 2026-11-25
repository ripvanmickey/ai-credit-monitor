"""Refresh all registered issuers from public DTCC files; preserve prior study on failure."""
import datetime as dt
import json
import pathlib
import importlib.util

spec = importlib.util.spec_from_file_location('dtcc_collector', pathlib.Path(__file__).with_name('collect-dtcc.py'))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)

def refresh():
    path = pathlib.Path('.github/close-snapshot.json')
    state = json.loads(path.read_text())
    seed = json.loads(pathlib.Path('seed.json').read_text())
    if set(collector.ALIASES) != {entity['id'] for entity in seed['entities']}:
        raise ValueError('DTCC issuer registry does not match the complete website company list')
    end = dt.date.fromisoformat(state['refresh']['expectedSession'])
    prior = state['cds'].get('tradeStudy') or seed.get('tradeStudy')
    start = max(dt.date.fromisoformat(prior['from']) if prior else end-dt.timedelta(days=89), end-dt.timedelta(days=100))
    cache = pathlib.Path('.dtcc-cache')
    cache.mkdir(exist_ok=True)
    checked = dt.datetime.now(dt.timezone.utc).isoformat()
    result = {'checkedAt': checked, 'requestedFrom': start.isoformat(), 'requestedThrough': end.isoformat(),
              'entityIds': list(collector.ALIASES), 'status': 'partial'}
    try:
        study = collector.collect(start, end, cache)
        result.update(availableFiles=study['availableFiles'], requestedFiles=study['requestedFiles'])
        if study['availableFiles'] < study['requestedFiles'] * .8:
            raise ValueError('Less than 80% of public DTCC files accessible; saved study retained')
        # Preserve archived history outside the correction window, and recalculate all rows inside it.
        if prior and start.isoformat() > prior['from']:
            merged = {series['entityId']: series for series in study['series']}
            for series in prior.get('series', []):
                older = [row for row in series['rows'] if row['asOf'] < start.isoformat()]
                if older:
                    current = merged.setdefault(series['entityId'], {**series, 'rows': []})
                    current['rows'] = older + current['rows']
            study['series'] = list(merged.values())
            study['historyFrom'] = prior.get('historyFrom', prior['from'])
        state['cds']['tradeStudy'] = study
        result['status'] = 'ok' if study['availableFiles'] == study['requestedFiles'] else 'partial'
        result['summary'] = study['summary']
    except Exception as error:
        result['error'] = str(error)
    state['cds']['dtccCheck'] = result
    if result['status'] != 'ok':
        state['cds']['checkStatus'] = 'partial'
        state['refresh']['cdsStatus'] = state['refresh']['status'] = 'partial'
    note = 'DTCC checked for all ' + str(len(collector.ALIASES)) + ' issuers through ' + end.isoformat() + ': ' + result['status'] + '. '
    note += result['error'] if 'error' in result else str(result['availableFiles']) + '/' + str(result['requestedFiles']) + ' public files available.'
    state['cds']['checks'] = (state['cds'].get('checks', []) + [{'at': checked, 'status': result['status'], 'note': note}])[-80:]
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(state, ensure_ascii=False) + '\n')
    temporary.replace(path)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    refresh()
