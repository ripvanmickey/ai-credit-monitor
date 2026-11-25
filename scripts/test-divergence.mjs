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
console.log('Divergence tests passed: RSI reference, flat MACD, pivots, pending lows, stale data, expiry, snapshot consistency.');
