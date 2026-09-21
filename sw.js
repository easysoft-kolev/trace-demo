/*  TRACE — Fleet Management System
 *  Service worker
 *
 *  Стратегия:
 *   - HTML (самото приложение)  -> първо мрежа, кешът е резерва.
 *     Така новото качване в GitHub се вижда веднага, без Ctrl+Shift+R.
 *   - икони, манифест, шрифтове -> първо кеш (не се менят).
 *   - заявките към Google       -> изобщо не се пипат.
 *
 *  ВАЖНО: ако някога промениш този файл, вдигни номера на CACHE
 *  (v1 -> v2), за да се изхвърли старият кеш.
 */

var CACHE = 'trace-demo-v1';

var SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* addAll пада целият, ако един файл липсва — затова поединично */
      return Promise.all(SHELL.map(function (url) {
        return c.add(url).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return (k === CACHE) ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  if (req.method !== 'GET') { return; }

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* Заявките към базата данни минават директно, без намеса и без кеш. */
  if (url.hostname.indexOf('script.google.com') !== -1 ||
      url.hostname.indexOf('googleusercontent.com') !== -1) {
    return;
  }

  /* Самото приложение: мрежата има думата, кешът е резерва. */
  if (req.mode === 'navigate' ||
      (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  /* Икони, манифест, шрифтове: кешът има думата. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) { return hit; }
      return fetch(req).then(function (res) {
        if (res && res.status === 200 &&
            (res.type === 'basic' || res.type === 'cors')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
