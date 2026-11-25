import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { momentum, lowPair, divergenceFor } from '../sox-public/divergence-model.js';

const rows = prices => prices.map((close, i) => [new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10), null, close]);
// Published Wilder RSI example: the first 14 changes produce RSI 70.464135.
const example = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
assert.ok(Math.abs(momentum(rows(example)).at(-1).rsi - 70.464135) < 0.00001);
const flat = momentum(rows(Array(100).fill(100))).at(-1);
assert.equal(flat.rsi, 50); assert.equal(flat.dif, 0); assert.equal(flat.histogram, 0);
assert.throws(() => momentum([['2020-01-01', null, 10], ['2020-01-01', null, 9]]));

const prices = [...Array(70).fill(120), 100, 110, 115, 120, 122, 121, 120, 90, 95, 98];
const all = rows(prices);
const pair = lowPair(momentum(all));
assert.equal(pair.first.index, 70); assert.equal(pair.second.index, 77); assert.equal(pair.second.confirmed, true);
assert.equal(divergenceFor(all.slice(0, 78)).states.rsi, 'pending');
assert.equal(divergenceFor(all.slice(0, 79)).states.rsi, 'pending');
assert.equal(divergenceFor(all, '2099-01-01').states.rsi, 'stale');
const newerLow = rows([...prices, 80]);
assert.equal(divergenceFor(newerLow).states.rsi, 'pending');
assert.equal(divergenceFor(rows([...prices, ...Array(21).fill(110)])).states.rsi, 'expired');
// The model must not mutate inputs or use future bars in a historical prefix.
assert.deepEqual(rows(prices), all);
assert.deepEqual(divergenceFor(all.slice(0, 78)), divergenceFor(rows(prices.slice(0, 78))));

// Integration: every asset is recomputed from the applied daily data, not hard-coded flags.
const snapshot = JSON.parse(await readFile('sox-public/divergence-latest.json', 'utf8'));
assert.deepEqual(Object.keys(snapshot.assets), ['QQQ', 'IXIC', 'SOX']);
for (const asset of Object.values(snapshot.assets)) {
  assert.ok(asset.latest && asset.date === asset.latest.date);
  for (const metric of ['rsi', 'dif', 'histogram']) {
    if (asset.states[metric] === 'triggered') {
      assert.ok(asset.first && asset.second.confirmed && asset.lowerLow);
      assert.ok(asset.second[metric] > asset.first[metric]);
      assert.ok(asset.date >= snapshot.expectedSession && asset.age <= snapshot.rules.expiry);
    }
  }
}
// Render the actual widget with the snapshot and exercise language changes.
let html = '', writes = 0, languageObserver;
const host = { querySelector: () => null, set innerHTML(value) { html = value; writes++; } };
globalThis.document = { querySelector: () => host, documentElement: { lang: 'en' }, addEventListener() {} };
globalThis.MutationObserver = class { constructor(callback) { languageObserver = callback; } observe() {} };
globalThis.fetch = async () => ({ ok: true, json: async () => snapshot });
await import('../sox-public/divergence.js');
assert.ok(html.includes('Technology bullish divergence'));
assert.equal((html.match(/class="divergence-card"/g) ?? []).length, 3);
assert.ok(!/[\u3400-\u9fff]/.test(html));
const before = writes;
languageObserver(); languageObserver();
assert.equal(writes, before, 'Repeated lang assignments must not cause a render/localization loop');
document.documentElement.lang = 'zh-CN'; languageObserver();
assert.ok(html.includes('科技股底背离监测'));
document.documentElement.lang = 'ja'; languageObserver();
assert.ok(html.includes('テクノロジー株の強気ダイバージェンス'));
console.log('Divergence tests passed: indicators, pivots, pending/stale/expired signals, snapshot consistency, three-language rendering and observer stability.');
