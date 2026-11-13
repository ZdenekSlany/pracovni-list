/*
 * Service worker: po prvním načtení funguje formulář i bez signálu.
 * Soubory se berou z mezipaměti a na pozadí se obnovují, takže nová verze
 * (např. změna config.js) se projeví při druhém otevření stránky.
 */
var CACHE = 'pracovni-list-v2';
var CORE = ['./', 'index.html', 'styles.css', 'config.js', 'app.js', 'pdf.js', 'manifest.webmanifest'];
// Knihovny, písma a ikony mohou ležet ve složkách, nebo vedle index.html. Uloží se ty, které existují.
var ASSETS = [
  ['vendor/', 'pdf-lib.min.js'], ['vendor/', 'fontkit.umd.min.js'],
  ['fonts/', 'Rubik_400Regular.ttf'], ['fonts/', 'Rubik_700Bold.ttf'],
  ['icons/', 'icon.svg'], ['icons/', 'icon-180.png'], ['icons/', 'icon-192.png'], ['icons/', 'icon-512.png']
];

function addIfExists(cache, url) {
  return fetch(url, { cache: 'no-cache' }).then(function (res) {
    if (!res.ok) throw new Error(url);
    return cache.put(url, res);
  });
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(CORE).then(function () {
      return Promise.all(ASSETS.map(function (a) {
        return addIfExists(cache, a[0] + a[1])
          .catch(function () { return addIfExists(cache, a[1]); })
          .catch(function () { /* soubor chybí, formulář ho při potřebě zkusí načíst ze sítě */ });
      }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var fresh = fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      });
      if (hit) { fresh.catch(function () {}); return hit; }
      return fresh;
    });
  }));
});
