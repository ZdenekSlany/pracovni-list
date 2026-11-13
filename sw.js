/*
 * Service worker: po prvním načtení funguje formulář i bez signálu.
 * Stránka, skripty a konfigurace se berou ze sítě (nová verze se projeví hned),
 * bez signálu nebo při pomalé síti z mezipaměti. Knihovny, písma a ikony se berou z mezipaměti.
 */
var CACHE = 'pracovni-list-v4';
var CORE = ['./', 'index.html', 'styles.css', 'config.js', 'app.js', 'pdf.js', 'manifest.webmanifest'];
// Knihovny, písma a ikony mohou ležet ve složkách, nebo vedle index.html. Uloží se ty, které existují.
var ASSETS = [
  ['vendor/', 'pdf-lib.min.js'], ['vendor/', 'fontkit.umd.min.js'],
  ['fonts/', 'Rubik_400Regular.ttf'], ['fonts/', 'Rubik_700Bold.ttf'],
  ['', 'icon.svg'], ['', 'icon-180.png'], ['', 'icon-192.png'], ['', 'icon-512.png']
];
var NETWORK_TIMEOUT = 3000;

function addIfExists(cache, url) {
  return fetch(url, { cache: 'no-cache' }).then(function (res) {
    if (!res.ok) throw new Error(url);
    return cache.put(url, res);
  });
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    return Promise.all(CORE.map(function (u) { return addIfExists(cache, u); })).then(function () {
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

function isStatic(url) {
  return /\.(ttf|png|svg)$/.test(url.pathname) || /(pdf-lib|fontkit)[^/]*\.js$/.test(url.pathname);
}

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var fresh = fetch(req, { cache: 'no-cache' }).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      });
      if (!hit) return fresh;
      fresh.catch(function () {});
      if (isStatic(url)) return hit; // velké neměnné soubory rovnou z mezipaměti
      // ostatní: nejdřív síť, při výpadku nebo pomalé síti uložená verze
      return Promise.race([
        fresh.then(function (res) { return res && res.ok ? res : hit; }, function () { return hit; }),
        new Promise(function (resolve) { setTimeout(function () { resolve(hit); }, NETWORK_TIMEOUT); })
      ]);
    });
  }));
});
