// Hash-роутинг: #/section/sub, #/extra/slug, #/search?q=..., якорь — второй '#': #/mechanics/projectile#h-3
export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathAndQuery, anchor = ''] = raw.split('#');
  const [path, query = ''] = pathAndQuery.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { parts, params: new URLSearchParams(query), anchor };
}

export function href(parts, { anchor, params } = {}) {
  let h = '#/' + parts.map(encodeURIComponent).join('/');
  if (params) h += '?' + new URLSearchParams(params).toString();
  if (anchor) h += '#' + anchor;
  return h;
}

export function onRoute(cb) {
  let lastPath = null;
  const run = () => {
    const r = parseHash();
    const pathKey = r.parts.join('/') + '?' + r.params.toString();
    const samePage = pathKey === lastPath;
    lastPath = pathKey;
    cb(r, samePage);
  };
  window.addEventListener('hashchange', run);
  run();
}
