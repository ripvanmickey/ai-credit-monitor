// Public indicative CDS closes only; never infer a spread from a coupon, upfront price or equity quote.
export function cdsSources(seed) {
  return seed.dailySources.map(source => ({ ...source, mirrorUrls: [...new Set([
    ...(source.mirrorUrls ?? []),
    ...(['AMD', 'AMZN', 'ORCL', 'SPCX'].includes(source.entityId) ? ['https://uk.investing.com' + new URL(source.url).pathname] : []),
    ...(source.entityId === 'MSFT' ? ['https://ph.investing.com/rates-bonds/microsoft-corp-cds-5-year-usd-historical-data'] : []),
  ])] }));
}

export function cdsCoverage(seed, cds, targetSession) {
  return seed.entities.map(entity => {
    const daily = cds.dailyCheck?.sources?.find(row => row.entityId === entity.id);
    const report = cds.companyChecks?.find(row => row.entityId === entity.id);
    const study = cds.tradeStudy;
    const observations = [...(seed.observations ?? []), ...(cds.observations ?? [])].filter(row => row.entityId === entity.id);
    const latestObservationDate = observations.map(row => row.asOf).sort().at(-1) ?? null;
    return { entityId: entity.id, name: entity.name, targetSession, latestObservationDate,
      dailyStatus: daily?.status ?? 'no_registered_daily_source', dailyCheckedAt: daily?.checkedAt ?? null,
      reportStatus: report?.targetSession === targetSession ? report.status : 'needs_web_verification',
      reportCheckedAt: report?.checkedAt ?? null,
      dtccThrough: study?.to ?? null, dtccStatus: cds.dtccCheck?.status ?? (study?.to >= targetSession ? 'checked' : 'stale'),
      eligibleTradeDays: study?.summary?.[entity.id]?.observedDays ?? null };
  });
}

const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ').replace(/&minus;|&#8722;/g, '-').replace(/\s+/g, ' ').trim();
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function tableDate(text) {
  const english = text.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  const british = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!english && !british) return null;
  const month = english ? months.indexOf(english[1].toLowerCase()) : Number(british[2]) - 1;
  if (month < 0) return null;
  const date = `${(english ?? british)[3]}-${String(month + 1).padStart(2, '0')}-${(english ? english[2] : british[1]).padStart(2, '0')}`;
  const parsed = new Date(date + 'T12:00:00Z');
  return Number.isFinite(+parsed) && parsed.toISOString().startsWith(date) && ![0, 6].includes(parsed.getUTCDay()) ? date : null;
}
export function parseCdsHistory(html, ticker, through) {
  const heading = plain(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0] ?? '');
  if (!heading.includes('(' + ticker + ')')) throw Error('CDS instrument identity missing or mismatched');
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => plain(m[1]));
    const date = tableDate(cells[0] ?? '');
    if (!date || date > through || cells.length !== 6) continue;
    const [close, open, high, low] = cells.slice(1, 5).map(v => Number(v.replaceAll(',', '')));
    const changePct = Number(cells[5].replace(/[%+,]/g, ''));
    if (![close, open, high, low, changePct].every(Number.isFinite) || Math.min(close, open, high, low) <= 0 ||
        high < Math.max(open, close) || low > Math.min(open, close)) throw Error('Invalid CDS OHLC row');
    rows.push({ date, close, open, high, low, changePct });
  }
  if (!rows.length || new Set(rows.map(r => r.date)).size !== rows.length) throw Error('No unique completed CDS history rows');
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function cdsObservation(source, row, checkedAt, sourceUrl = source.url) {
  return { id: 'investing-' + source.entityId + '-' + row.date, entityId: source.entityId,
    asOf: row.date, value: row.close, operator: '=', tenor: source.tenor, currency: source.currency,
    seniority: source.seniority ?? null, restructuring: source.restructuring ?? null,
    kind: 'reported', quoteType: 'daily_close', seriesKey: 'investing:' + source.ticker,
    sourceId: source.sourceId, instrument: source.ticker, open: row.open, high: row.high, low: row.low,
    sourceChangePct: row.changePct, sourceTitle: 'Investing.com · ' + source.ticker + ' historical data',
    sourceUrl, publishedAt: row.date, collectedAt: checkedAt,
    note: 'Public indicative daily close in bp, not an executable quote. publishedAt is the source observation date; a separate publication timestamp, seniority and restructuring terms are not supplied.' };
}

export async function refreshCdsDaily(seed, prior, through, now, fetcher = fetch) {
  const checkedAt = now.toISOString();
  const observations = [...(prior.observations ?? [])];
  const ids = new Set(observations.map(o => o.id));
  const sources = await Promise.all(cdsSources(seed).map(async source => {
    const previous = observations.filter(o => o.seriesKey === 'investing:' + source.ticker);
    const errors = [];
    for (const url of [source.url, ...source.mirrorUrls]) {
      try {
        const response = await fetcher(url, { headers: { Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw Error('HTTP ' + response.status);
        const rows = parseCdsHistory(await response.text(), source.ticker, through);
        const overlap = rows.filter(row => previous.some(o => o.asOf === row.date));
        if (!overlap.some(row => previous.some(o => o.asOf === row.date && Math.abs(o.value - row.close) < 0.001))) throw Error('No matching overlap with the registered CDS series');
        let added = 0;
        for (const row of rows) {
          const observation = cdsObservation(source, row, checkedAt, url);
          if (ids.has(observation.id)) continue;
          ids.add(observation.id); observations.push(observation); added++;
        }
        const latestDate = rows.at(-1).date;
        return { entityId: source.entityId, url, checkedAt, latestDate, added, status: latestDate >= through ? 'current' : 'lagging' };
      } catch (error) { errors.push(new URL(url).hostname + ': ' + error.message); }
    }
    return { entityId: source.entityId, checkedAt, latestDate: previous.map(o => o.asOf).sort().at(-1) ?? null,
      added: 0, status: 'unavailable', error: errors.join('; ') };
  }));
  const added = sources.reduce((sum, source) => sum + source.added, 0);
  const current = sources.every(source => source.status === 'current');
  const unavailable = sources.filter(source => source.status === 'unavailable').map(source => source.entityId);
  const note = 'Public CDS daily sources checked for ' + through + '; added ' + added + ' observations. ' +
    sources.map(source => source.entityId + ': ' + (source.latestDate ?? 'no quote') + ' (' + source.status + ')').join('; ') +
    '. Quote dates are retained when the provider lags or cannot be accessed. Equity-close coverage is tracked separately.';
  const checkStatus = current ? 'ok' : 'partial';
  const result = { ...prior, observations, checkedAt, checkStatus, checkNote: note,
    dailyCheck: { checkedAt, targetSession: through, status: checkStatus, added, unavailable, sources },
    checks: [...(prior.checks ?? []), { at: checkedAt, status: checkStatus, note }].slice(-80) };
  if (prior.dailyCheck?.webCheckedTargetSession === through) {
    result.dailyCheck.webCheckedTargetSession = through;
    result.dailyCheck.webCheckedAt = prior.dailyCheck.webCheckedAt;
    for (const source of result.dailyCheck.sources) {
      const previous = prior.dailyCheck.sources?.find(row => row.entityId === source.entityId);
      for (const key of ['webCheckedAt', 'webLatestDate', 'webSourceUrl']) if (previous?.[key]) source[key] = previous[key];
    }
  }
  result.coverage = cdsCoverage(seed, result, through);
  const pending = result.coverage.filter(row => row.reportStatus === 'needs_web_verification');
  if (pending.length) {
    result.checkStatus = 'partial';
    result.checkNote += ' Company-wide news verification pending: ' + pending.map(row => row.entityId).join(', ') + '.';
    result.checks.at(-1).status = result.checkStatus;
    result.checks.at(-1).note = result.checkNote;
  }
  return result;
}
