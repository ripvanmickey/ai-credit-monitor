"""Convert saved Yahoo Finance chart responses into versioned price-index snapshots."""
import gzip
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

for symbol, start, source in zip(
    ('GSPC', 'IXIC'), ('1957-03-04', '1971-02-05'), sys.argv[1:]
):
    result, = json.loads(Path(source).read_bytes())['chart']['result']
    if result['meta']['symbol'] != '^' + symbol:
        raise ValueError('Unexpected ticker for ' + source)
    close = result['indicators']['quote'][0]['close']
    timestamps = result['timestamp']
    if len(close) != len(timestamps):
        raise ValueError('Dates and closes do not align')
    dates = [datetime.fromtimestamp(ts, timezone.utc).date().isoformat() for ts in timestamps]
    rows = [[date, round(value * 100)] for date, value in zip(dates, close)
            if date >= start and value is not None and math.isfinite(value) and value > 0]
    if not rows or rows[0][0] != start or rows[-1][0] != dates[-1]:
        raise ValueError('Missing boundary observations for ' + symbol)
    if any(a[0] >= b[0] for a, b in zip(rows, rows[1:])):
        raise ValueError('Unsorted or duplicate dates for ' + symbol)
    snapshot = json.dumps(rows, separators=(',', ':')).encode()
    out = Path('sox-public/timing-' + symbol.lower() + '.json.gz')
    out.write_bytes(gzip.compress(snapshot, mtime=0))
    print(symbol, rows[0], rows[-1], len(rows), out.stat().st_size)
