/* =====================================================================
 * ARK プッシュ通知の受け取り（11/9）
 *  ・この端末を「プッシュ通知を受け取る端末」として登録する（Firebase Cloud Messaging）
 *  ・登録した印は共有の daily/pushtok-… に置く（Apps Script がここを見て、全部の端末へ送る）
 *  ・iPhone は iOS 16.4 以上で、ホーム画面に追加したアプリから開いたときだけ使える
 *  使い方：ARKPUSH.state() → 'unsupported' | 'need-home' | 'off' | 'denied' | 'on'
 *          ARKPUSH.enable()（ボタンを押したときに呼ぶ）／ ARKPUSH.refresh()（開いたときに呼ぶ）／ ARKPUSH.test()
 * ===================================================================== */
(function(){
  var FB_VER = '10.12.2';
  var CFG = {apiKey:"AIzaSyBCUH7KW9IanTh2s6OoFumSQe4Pzm_2aiA",authDomain:"ark-share-31734.firebaseapp.com",projectId:"ark-share-31734",storageBucket:"ark-share-31734.firebasestorage.app",messagingSenderId:"608593197071",appId:"1:608593197071:web:d52472d82852aad0980b7a"};
  var VAPID = 'BO_MtRE_Ur8ixPignKqlDcVTYpT5b1tcZ0YJAlqU6KQkgybE9c6E1AaQQb40gCUC1Hnv_ew9cBsRbOdCfKBuCAc';
  var LS_TOK = 'ark-push-tok', LS_AT = 'ark-push-at';
  function ls(k, v){ try{ if(v === undefined) return localStorage.getItem(k); if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){ return null; } }
  function dev(){ var d = ls('ark-dev'); if(!d){ d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); ls('ark-dev', d); } return d; }
  function ios(){ return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function standalone(){ return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function supported(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function hash(s){ var h = 5381; for(var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36) + s.length.toString(36); }
  function name(){ var u = navigator.userAgent; return (/iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'PC') + (standalone() ? '（アプリ）' : '（ブラウザ）'); }
  function state(){
    if(!supported()) return ios() && !standalone() ? 'need-home' : 'unsupported';
    if(ios() && !standalone()) return 'need-home';
    if(Notification.permission === 'denied') return 'denied';
    return Notification.permission === 'granted' && ls(LS_TOK) ? 'on' : 'off';
  }
  var FB = null;
  function fb(){
    if(FB) return FB;
    var b = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
    FB = Promise.all([import(b + 'firebase-app.js'), import(b + 'firebase-auth.js'), import(b + 'firebase-firestore.js'), import(b + 'firebase-messaging.js')]).then(function(m){
      var A = m[0], U = m[1], F = m[2], M = m[3];
      var app = A.getApps().length ? A.getApp() : A.initializeApp(CFG);
      var auth = U.getAuth(app), db = F.getFirestore(app);
      var user = new Promise(function(res){ var off = U.onAuthStateChanged(auth, function(u){ off(); res(u || null); }); });
      return {A: A, U: U, F: F, M: M, app: app, auth: auth, db: db, user: user};
    });
    FB.catch(function(){ FB = null; });
    return FB;
  }
  async function token(f){
    var reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    if(!(await f.M.isSupported())) throw new Error('この端末・ブラウザはプッシュ通知に対応していません');
    return f.M.getToken(f.M.getMessaging(f.app), {vapidKey: VAPID, serviceWorkerRegistration: reg});
  }
  async function save(f, t, u){
    var old = ls(LS_TOK);
    await f.F.setDoc(f.F.doc(f.db, 'daily', 'pushtok-' + hash(t)), {kind: 'pushtok', token: t, dev: dev(), name: name(), by: (u && u.email) || '', date: '9999-12-31', last: new Date().toISOString(), at: f.F.serverTimestamp()});
    if(old && old !== t){ try{ await f.F.deleteDoc(f.F.doc(f.db, 'daily', 'pushtok-' + hash(old))); }catch(e){} }
    ls(LS_TOK, t); ls(LS_AT, String(Date.now()));
  }
  // ボタンを押したとき（iPhone は、押した直後でないと許可の画面を出せない）
  async function enable(){
    var st = state();
    if(st === 'need-home') throw new Error('iPhone は、Safari の共有ボタン →「ホーム画面に追加」で追加したアプリから開いて押してください');
    if(st === 'unsupported') throw new Error('この端末・ブラウザはプッシュ通知に対応していません（iPhone は iOS 16.4 以上が必要です）');
    var p = await Notification.requestPermission();
    if(p !== 'granted') throw new Error('通知が許可されませんでした。iPhone は「設定」→「通知」→ このアプリ で「通知を許可」をオンにしてください');
    var f = await fb(), u = await f.user;
    if(!u) throw new Error('先に作業ボードの ⚙ 設定 でチーム共有にログインしてください');
    var t = await token(f); if(!t) throw new Error('通知の登録ができませんでした。もう一度押してください');
    await save(f, t, u); return true;
  }
  // 開いたとき：登録が切れていないか確かめる（iPhone は登録が変わることがある）。3日に1回は「使っている」の印を更新
  async function refresh(){
    if(state() !== 'on') return state();
    try{
      var f = await fb(), u = await f.user; if(!u) return 'on';
      var t = await token(f), old = ls(LS_TOK), at = +ls(LS_AT) || 0;
      if(t && (t !== old || Date.now() - at > 3 * 864e5)) await save(f, t, u);
      return 'on';
    }catch(e){ console.warn('プッシュ通知の確認', e); return 'error'; }
  }
  // この端末だけに試しの通知を送ってもらう（Apps Script が1分以内に送る）
  async function test(){
    var f = await fb(), u = await f.user; if(!u) throw new Error('ログインしてください');
    var now = new Date();
    await f.F.setDoc(f.F.doc(f.db, 'comments', 'ev-test-' + now.getTime().toString(36)), {kind: 'ev', src: 'msg', t: '🔔 テスト通知', d: 'この端末にプッシュ通知が届きました', ic: '🔔', c: '#0b57d0', quiet: false, to: dev(), by: (u && u.email) || '', dev: dev(),
      date: now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'), ts: now.toISOString(), push: 'wait', at: f.F.serverTimestamp()});
  }
  async function disable(){
    var t = ls(LS_TOK); ls(LS_TOK, null);
    if(t){ try{ var f = await fb(); await f.F.deleteDoc(f.F.doc(f.db, 'daily', 'pushtok-' + hash(t))); }catch(e){} }
  }
  window.ARKPUSH = {state: state, enable: enable, refresh: refresh, test: test, disable: disable};
})();
