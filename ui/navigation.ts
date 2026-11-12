export const panelParameter = 'research-panel';
const pagesBase = typeof document === 'undefined'
  ? ''
  : document.querySelector<HTMLMetaElement>('meta[name="research-pages-base"]')?.content ?? '';

export function researchPath(path: string) {
  return pagesBase + path;
}

export function panelURL(path: string, search: string) {
  const panel = pagesBase
    ? path.endsWith('/') ? path + 'panel.html' : path.replace(/\.html$/, '-panel.html')
    : path;
  const url = new URL(researchPath(panel) + search, location.origin);
  if (!pagesBase) url.searchParams.set(panelParameter, '1');
  return url;
}

export function modulePath(path: string) {
  if (pagesBase && (path === pagesBase || path.startsWith(pagesBase + '/'))) {
    path = path.slice(pagesBase.length) || '/';
    if (path.endsWith('/panel.html')) path = path.slice(0, -'panel.html'.length);
    if (path === '/sox/why-down-panel.html') path = '/sox/why-down.html';
    if (path === '/sox/timing-panel.html') path = '/sox/timing.html';
  }
  if (path === '/index.html') return '/';
  if (path === '/cycle/index.html') return '/cycle/';
  if (path === '/sox/index.html') return '/sox/';
  return path;
}

export function isResearchPage(path: string) {
  return ['/', '/cycle/', '/sox/', '/sox/why-down.html', '/sox/timing.html'].includes(modulePath(path));
}

export function linkDestination(event: MouseEvent, base: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
  const url = new URL(link.getAttribute('href')!, base);
  if (url.origin !== location.origin || !isResearchPage(url.pathname)) return;
  url.pathname = researchPath(modulePath(url.pathname));
  url.searchParams.delete(panelParameter);
  return url;
}

export function startPanelNavigation() {
  if (window.parent === window) return;
  document.addEventListener('click', event => {
    const url = linkDestination(event, location.href);
    if (!url) return;
    event.preventDefault();
    window.parent.postMessage({type: 'research-navigation', url: url.href}, location.origin);
  });
}
