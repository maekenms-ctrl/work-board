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
// 通知を押したとき：開いている画面を前に出す（作業指示の通知なら作業ボードを開く）
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './notify.html';
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(cs => {
    const want = new URL(url, self.location.href).href.split('#')[0];
    for (const c of cs) { if (c.url.split('#')[0] === want && 'focus' in c) { if (url.includes('#')) c.navigate(url).catch(()=>{}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
