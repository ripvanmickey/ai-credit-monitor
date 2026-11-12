import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
process.env.RESEARCH_STATIC_EXPORT = '1';
await import('./build.mjs');
const { default: worker } = await import('../dist/server/index.js');

const base = process.env.PAGES_BASE_PATH ?? '/ai-credit-monitor';
if (!/^\/[A-Za-z0-9_.-]+$/.test(base) || base === '/.' || base === '/..') {
  throw new Error('PAGES_BASE_PATH must be a single GitHub repository path');
}

const out = 'dist/pages';
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await Promise.all([
  cp('cycle-public', join(out, 'cycle'), { recursive: true }),
  cp('sox-public', join(out, 'sox'), { recursive: true }),
]);

const snapshot = JSON.parse(await readFile('seed.json', 'utf8'));
snapshot.persistence = 'ready';
const env = {
  BUCKET: { get: async key => key === 'snapshot.json' ? { text: async () => JSON.stringify(snapshot) } : null },
};

async function get(route) {
  const response = await worker.fetch(new Request('https://snapshot.invalid' + route), env);
  if (!response.ok) throw new Error(route + ': HTTP ' + response.status);
  return response.text();
}

async function save(path, data) {
  const file = join(out, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
}

const notice = '<p class="info-note" style="margin:12px 0;color:var(--muted-foreground)">GitHub Pages · 已保存的公开数据快照</p>';
const isApiPath = /(['"])(\/(?:sox\/)?api\/[a-z-]+)(?=\1)/g;
const apiPaths = code => code.replace(isApiPath, (_, quote, path) => quote + base + path + '.json');

function adaptHtml(html) {
  return apiPaths(html)
    .replace('<head>', '<head><meta name="research-pages-base" content="' + base + '">')
    .replace(/((?:href|src)=")(\/(?:cycle|sox)\/)/g, '$1' + base + '$2')
    .replaceAll("'/cycle/logo-", "'" + base + "/cycle/logo-")
    .replace('<main>', '<main>' + notice)
    .replace(/(<main\s[^>]*>)/, '$1' + notice);
}

const pages = [
  ['/', 'index.html', 'panel.html'],
  ['/cycle/', 'cycle/index.html', 'cycle/panel.html'],
  ['/sox/', 'sox/index.html', 'sox/panel.html'],
  ['/sox/timing.html', 'sox/timing.html', 'sox/timing-panel.html'],
  ['/sox/why-down.html', 'sox/why-down.html', 'sox/why-down-panel.html'],
];
for (const [route, shell, panel] of pages) {
  const [shellHtml, panelHtml] = await Promise.all([get(route), get(route + '?research-panel=1')]);
  const panelPath = base + '/' + panel;
  await Promise.all([
    save(shell, adaptHtml(shellHtml).replace('href="?research-panel=1"', 'href="' + panelPath + '"')),
    save(panel, adaptHtml(panelHtml)
      .replace('每3小时检查 · 以最近更新记录为准', 'GitHub Pages · 已保存的数据快照')
      .replace('后台每3小时检查公开历史表并核验报道，页面每60秒读取已保存快照。', '此页面读取发布时保存的数据快照。')
      .replace('已有后台任务每3小时检查公开来源。', 'GitHub Pages 提供发布时保存的快照。')),
  ]);
}
for (const path of ['cycle/app.js', 'cycle/chip-dso.js', 'cycle/company-logos.js', 'sox/market-data.js']) {
  const code = await readFile(join(out, path), 'utf8');
  await save(path, apiPaths(code)
    .replace("fetch('api/market'", "fetch('api/market.json'")
    .replaceAll("'/cycle/chip-dso.json'", "'" + base + "/cycle/chip-dso.json'")
    .replaceAll("'/cycle/logo-", "'" + base + "/cycle/logo-"));
}

const routes = ['/api/snapshot', '/api/cycle', '/api/gpu-prices', '/api/bond-spreads', '/sox/api/market'];
await Promise.all(routes.map(async route => {
  const data = JSON.parse(await get(route));
  if (route === '/sox/api/market') data.note = 'GitHub Pages · 已保存的日线快照';
  await save(route.slice(1) + '.json', JSON.stringify(data));
}));
await save('.nojekyll', '');
console.log('GitHub Pages snapshot built at ' + out + ' for ' + base + '/');
