// 作業ボード・ARK通知をアプリとしてインストールするためのサービスワーカー
// ・画面（HTML）はいつもネットから最新を読み、つながらないときだけ前回の画面を出す
// ・Firebase など外部への通信には関わらない（データはこれまでどおりリアルタイム）
const CACHE = 'ark-pages-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // 外部（Firebase・フォントなど）はそのまま
  e.respondWith(
    fetch(req, { cache: 'no-store' }).then(res => {
      if (res && res.ok && (req.mode === 'navigate' || /\.(png|webmanifest)$/.test(url.pathname))) {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./') : undefined)))
  );
});
