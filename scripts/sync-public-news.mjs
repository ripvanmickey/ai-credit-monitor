import { readFile, rename, writeFile } from 'node:fs/promises';

const origin = 'https://ai-credit-monitor.mickeyripvan.chatgpt.site/api/snapshot';
const seedFile = new URL('../seed.json', import.meta.url);
const supplementFile = new URL('../.github/pages-news.json', import.meta.url);
const temporarySeed = new URL('../seed.json.news.tmp', import.meta.url);

function publicEvent(event) {
  const { id, date, entityId, title, summary, url, source } = event;
  if (![id, title, summary, url].every(value => typeof value === 'string' && value.trim()) ||
      typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new URL(url).protocol !== 'https:') {
    throw new Error('Invalid public news entry');
  }
  return {
    id, date, title, summary, url,
    ...(typeof entityId === 'string' ? { entityId } : {}),
    ...(typeof source === 'string' ? { source } : {}),
  };
}

function publicCheck(check) {
  const { at, status, note } = check;
  if (typeof at !== 'string' || !Number.isFinite(Date.parse(at)) ||
      !['ok', 'partial', 'failed'].includes(status) || typeof note !== 'string' || !note.trim()) {
    throw new Error('Invalid public update record');
  }
  return { at, status, note };
}

const response = await fetch(origin, {
  redirect: 'error',
  headers: { Accept: 'application/json' },
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error('Public news snapshot returned HTTP ' + response.status);
const [upstream, seed, supplement] = await Promise.all([
  response.json(),
  readFile(seedFile, 'utf8').then(JSON.parse),
  readFile(supplementFile, 'utf8').then(JSON.parse),
]);
if (!Array.isArray(upstream.events) || !upstream.events.length ||
    !Array.isArray(upstream.checks) || !upstream.checks.length) {
  throw new Error('Public snapshot is missing news or update records');
}

const events = new Map();
for (const event of [...seed.events, ...supplement, ...upstream.events]) {
  events.set(event.id, publicEvent(event));
}

const checks = new Map();
for (const check of [...seed.checks, ...upstream.checks]) {
  checks.set(Date.parse(check.at), publicCheck(check));
}

seed.events = Array.from(events.values());
seed.checks = Array.from(checks.values()).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
await writeFile(temporarySeed, JSON.stringify(seed, null, 2) + '\n');
await rename(temporarySeed, seedFile);
console.log('Synchronized ' + seed.events.length + ' public news entries and ' +
  seed.checks.length + ' update records.');
