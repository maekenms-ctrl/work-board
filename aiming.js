/* エイミング工数表（参考データ）2026-11-14
 * WSG 株式会社の価格表から（国産車 2021.03 版・輸入車 2023.8 版）。
 * 工数 ＝ 標準価格（税別）÷ レート（国産車 6,500円・輸入車 13,000円）。
 * 作業ボード（作業箇所でエイミングを選んだとき）と見積りツールの両方から開く。
 * 使い方：ARK_AIMING.open()  ／ ARK_AIMING.open({tab:'imp'})
 */
(function(){
  var RATE = { dom: 6500, imp: 13000 };
  // [メーカー, 名称, システム名, 方式, 標準価格(税別) または null（準備中）, 代表車種例]
  var DOM = [
    ['トヨタ・レクサス','セーフティセンスC','レーンディパーチャーアラート','レコグニションカメラ／光軸調整',16250,'シエンタ（170系）など'],
    ['トヨタ・レクサス','セーフティセンスP','前方認識カメラ（フォワードレコグニションカメラ）','レコグニションカメラ位置記憶（光軸調整）',19500,'プリウス（50系）など'],
    ['トヨタ・レクサス','セーフティセンスP','プリクラッシュ2','前方レーダー光軸調整',14300,'プリウス（50系）など'],
    ['トヨタ・レクサス','セーフティセンス（第2世代）','前方認識カメラ','光軸調整',19500,'アルファード（30系 2018.01以降）・クラウン（S22#）など'],
    ['トヨタ・レクサス','セーフティセンス（第2世代）','前方レーダーセンサー','前方レーダー光軸調整',14300,'アルファード（30系 2018.01以降）・クラウン（S22#）など'],
    ['トヨタ・レクサス','','ブラインドスポットモニター','BSMマスタービーム軸調整',14300,'プリウス（50系）など'],
    ['トヨタ・レクサス','','ブラインドスポットモニター','BSMスレーブビーム軸調整',14300,'プリウス（50系）など'],
    ['トヨタ・レクサス','','インテリジェントクリアランスソナー','システム登録設定（フロント）',16250,'プリウス（50系）など'],
    ['トヨタ・レクサス','','インテリジェントクリアランスソナー','システム登録設定（リア）',16250,'プリウス（50系）など'],
    ['日産','セーフティシールド','レーザー／レーダー','ミリ波レーダー光軸調整',null,'フーガ（Y51）・NV350キャラバン（E26）など'],
    ['日産','セーフティシールド','レーンカメラ','カメラエーミング',19500,'ノート（E12）・セレナ（C27）など'],
    ['日産','セーフティシールド','AVM（アラウンドビューモニター）','カメラキャリブレーション（フロント・運転席サイド・助手席サイド・リアカメラ）',45500,'セレナ（C27）・ノートe-POWER（HE12）など'],
    ['ホンダ','アクティブセーフティ','シティブレーキアクティブシステム','レーダー校正（フロントガラス）',13000,'フィットHV（GP5）・ヴェゼルHV（RU3）など'],
    ['ホンダ','ホンダセンシング','カメラ／レーダー統合制御システム','カメラエーミング',19500,'N-BOX（JF3）・ヴェゼルHV（RU3）など'],
    ['ホンダ','ホンダセンシング','カメラ／レーダー統合制御システム','レーダーエーミング',16250,'N-BOX（JF3）・ヴェゼルHV（RU3）など'],
    ['マツダ','i-ACTIVSENSE','FSC（フォワードセンシングカメラ）','カメラエーミング・静止エーミング',16250,'CX-5（KE/KF系）・アクセラ（BM5AP）など'],
    ['マツダ','i-ACTIVSENSE','SBS（スマートブレーキサポート）・MRCC（マツダレーダークルーズコントロール）','レーダーエーミング',14300,'CX-5（KE 2015-/KF系）・アクセラ（BM5AP）など'],
    ['マツダ','i-ACTIVSENSE','FR（フロントレーダセンサ）','フロントレーダエーミング（ドライブ調整）',16250,'CX-30（DM系）・MAZDA3（BP系）'],
    ['マツダ','i-ACTIVSENSE','VMC（360ビューモニターコントロール）','ビューモニターカメラエーミング',null,'デミオ（DJ系）など'],
    ['マツダ','i-ACTIVSENSE','BSM（ブラインドスポットモニタリング）','BSMエーミング（左）',14300,'デミオ（DJ系）など'],
    ['マツダ','i-ACTIVSENSE','BSM（ブラインドスポットモニタリング）','BSMエーミング（右）',14300,'デミオ（DJ系）など'],
    ['スバル','アイサイト Ver.2・Ver.3','アイサイト','カメラ全調整モード＋ドライブ調整',35750,'インプレッサ/XV（GJ/GP）・WRX・レヴォーグ（VA/VM）など'],
    ['スバル','アドバンスドセイフティパッケージ','後方側警戒支援システム（LH）','BSMエーミング',16250,'XV（GT系）など'],
    ['スバル','アドバンスドセイフティパッケージ','後方側警戒支援システム（RH）','BSMエーミング',16250,'XV（GT系）など'],
    ['三菱','e-アシスト','FCM（衝突被害軽減ブレーキシステム）フロントカメラ','カメラエーミング',19500,'ekスペース（B11A）・ekワゴン（B11W）※2019y model（2018/5-2019/3）'],
    ['三菱','e-アシスト','レーン逸脱警報','カメラ初期化、画像調整＋ドライブ調整',19500,'アウトランダー（GF）など'],
    ['三菱','e-アシスト','BSW（後側方車両検知警報システム）・LCA（レーンチェンジアシスト機能付）','レーダー認識角度点検',28600,'アウトランダー（GF）・RVR（GA4W）・エクリプスクロス（GK）・デリカD:5（CV1W）'],
    ['スズキ','スズキセーフティサポート','レーダーブレーキサポート','レーザーレーダー点検（フロントガラス）',13000,'ワゴンR（MH44S）など'],
    ['スズキ','スズキセーフティサポート','レーダーブレーキサポート','エーミング調整',null,'ソリオ（MA15S）など'],
    ['スズキ','スズキセーフティサポート','デュアルセンサーブレーキサポート','エーミング調整＋ドライブ調整',26000,'ワゴンR（MH55S）・スイフト（ZC83S）など'],
    ['スズキ','スズキセーフティサポート','デュアルカメラブレーキサポート','エーミング調整＋ドライブ調整',35750,'ハスラー（MR41S）など'],
    ['スズキ','スズキセーフティサポート','カメラコントローラー（全方位モニタ用）','キャリブレーション',19500,'スイフトHV（ZC43S）など'],
    ['ダイハツ','スマートアシスト','PCB（プリクラッシュブレーキ）','レーザーレーダー光軸調整',14300,'ムーヴ（LA100S）など'],
    ['ダイハツ','スマートアシスト2','IMG（前方監視カメラ）','フロントカメラ光軸調整',19500,'ムーヴ（LA150S）など'],
    ['ダイハツ','スマートアシスト2','PCB（プリクラッシュブレーキ）','レーザーレーダー光軸調整',14300,'ムーヴ（LA150S）など'],
    ['ダイハツ','スマートアシスト3','ステレオカメラ','ステレオカメラ光軸調整',19500,'タント（LA600S）・ミライース（LA350S）など'],
    ['ダイハツ','スマートアシスト3','ウルトラソニックセンサNo.1','ソナー機能検査（リア）',14300,''],
    ['日野','','FCM（前方画像認識センサー）','レコグニションカメラ／光軸調整',19500,'デュトロ・レンジャー・プロフィア（2016〜）'],
    ['日野','','LDWS（車線逸脱警報装置）','前方カメラ光軸調整',19500,'デュトロ・レンジャー・プロフィア（〜2015）'],
    ['日野','','ドライビングサポート','前方レーダー光軸調整',14300,'デュトロ（XZU6**系）など'],
    ['三菱ふそう','','マルチファクションカメラ','キャリブレーション（静的エーミング）',16250,'キャンター（2017年以降）'],
    ['三菱ふそう','','DTR・レーダセンサ','キャリブレーション（静的エーミング）',14300,'スーパーグレード（2017年以降）']
  ];
  // [メーカー, センサー箇所, システム名, 作業名称, 標準価格(税別)]
  var IMP = [
    ['Alfa Romeo・FIAT','フロントバンパー','アダプティブクルーズコントロール（ACC）','静的エーミング',26000],
    ['Audi・Volkswagen','フロントガラス','フロントセンサードライバーアシスタンスシステム','静的エーミング',22750],
    ['Audi・Volkswagen','フロントバンパー','アダプティブクルーズコントロール（ACC）','静的エーミング',26000],
    ['Audi・Volkswagen','フロントバンパー','アダプティブクルーズコントロール（ACC）（左右）','静的エーミング',35750],
    ['Audi・Volkswagen','リアバンパー','レーンチェンジアシスタント（右）','静的エーミング',18200],
    ['Audi・Volkswagen','リアバンパー','レーンチェンジアシスタント（左）','静的エーミング',18200],
    ['Audi・Volkswagen','リアバンパー','レーンチェンジアシスタント（左右）','静的エーミング',26000],
    ['BMW・MINI','フロントガラス','カメラベースドドライバーアシスタントシステム','動的エーミング（ドライブ調整）',26000],
    ['BMW・MINI','フロントバンパー','アダプティブクルーズコントロール（ACC）','静的エーミング',26000],
    ['JAGUAR・LAND ROVER','フロントガラス','画像処理モジュール（IPMA）','動的エーミング（ドライブ調整）',26000],
    ['JAGUAR・LAND ROVER','フロントバンパー','クルーズコントロールモジュール（CCM）','動的エーミング（ドライブ調整）',26000],
    ['JEEP','フロントバンパー','アダプティブクルーズコントロール（ACC）','静的エーミング',26000],
    ['Mercedes-Benz','フロントガラス','マルチファンクションカメラ（モノラル／ステレオ）','静的エーミング',22750],
    ['Mercedes-Benz','フロントガラス','マルチファンクションカメラ（ステレオ）','静的エーミング＋ドライブ調整',35750],
    ['Mercedes-Benz','フロントバンパー','ディストロニック（DTR）','動的エーミング（ドライブ調整）',26000],
    ['Mercedes-Benz','リアバンパー','レフト＆ライト リアショートレンジレーダー','動的エーミング（ドライブ調整）',26000],
    ['PEUGEOT・CITROËN／DS','フロントガラス','マルチファンクションビデオカメラ（CMF）','静的エーミング＋ドライブ調整',35750],
    ['PEUGEOT・CITROËN／DS','フロントバンパー','車間距離アシスト（VDA）','動的エーミング（ドライブ調整）',26000],
    ['PORSCHE','フロントガラス','アシスタンスシステム（LDW）','静的エーミング',22750],
    ['PORSCHE','フロントバンパー','アダプティブクルーズコントロール（ACC）','静的エーミング',26000],
    ['PORSCHE','リアバンパー','右レーンチェンジアシスト（マスター）','静的エーミング',18200],
    ['PORSCHE','リアバンパー','左レーンチェンジアシスト（スレーブ）','静的エーミング',18200],
    ['RENAULT','フロントガラス','フロントカメラ','静的エーミング',22750],
    ['RENAULT','フロントバンパー','フロントレーダー','動的エーミング（ドライブ調整）',26000],
    ['VOLVO','フロントガラス','広角ビジョンモジュール（WAM）','動的エーミング（ドライブ調整）',26000],
    ['VOLVO','フロントバンパー','アクティブセーフティドメインマスター（ASDM）','動的エーミング（ドライブ調整）',26000]
  ];
  function hrs(p, tab){ if(p == null) return null; return Math.round(p / RATE[tab] * 100) / 100; }
  function fmtH(h){ return h == null ? '準備中' : (String(h).replace(/\.?0+$/, '') || '0') + ' h'; }
  function yen(p){ return p == null ? '準備中' : p.toLocaleString('ja-JP') + '円'; }
  function e(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  var CSS = '.aim-ov{position:fixed;inset:0;z-index:40000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:12px;}'
    + '.aim-box{background:#16181d;color:#f1f3f4;border:2px solid #e4ff1a;border-radius:14px;width:min(980px,100%);max-height:calc(100vh - 24px);display:flex;flex-direction:column;font-family:inherit;}'
    + '.aim-hd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #33373f;flex-wrap:wrap;}'
    + '.aim-hd h3{margin:0;font-size:17px;flex:1 1 auto;}'
    + '.aim-x{background:#2a2e36;color:#fff;border:1px solid #444;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;font-family:inherit;}'
    + '.aim-tabs{display:flex;gap:6px;padding:10px 14px 0;}'
    + '.aim-tab{flex:1;min-height:40px;border-radius:10px;border:2px solid #33373f;background:#23262d;color:#9aa0aa;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;}'
    + '.aim-tab.on{background:#e4ff1a;border-color:#e4ff1a;color:#111;}'
    + '.aim-tools{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px;}'
    + '.aim-tools input{flex:1 1 200px;min-height:38px;border-radius:8px;border:1px solid #444;background:#0f1115;color:#fff;padding:0 10px;font-size:15px;font-family:inherit;}'
    + '.aim-mk{display:flex;gap:5px;flex-wrap:wrap;padding:0 14px 8px;}'
    + '.aim-mk button{padding:5px 10px;border-radius:8px;border:1px solid #444;background:#23262d;color:#ddd;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}'
    + '.aim-mk button.on{border-color:#e4ff1a;color:#e4ff1a;background:#2b3008;}'
    + '.aim-note{padding:0 14px 8px;font-size:12px;color:#9aa0aa;line-height:1.5;}'
    + '.aim-list{overflow:auto;padding:0 14px 14px;}'
    + '.aim-g{margin-top:10px;font-weight:800;color:#e4ff1a;font-size:14px;border-bottom:1px solid #33373f;padding-bottom:3px;}'
    + '.aim-r{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:8px 2px;border-bottom:1px solid #2a2e36;}'
    + '.aim-r .s{font-weight:700;font-size:14px;line-height:1.35;}'
    + '.aim-r .m{font-size:12.5px;color:#c9ccd3;line-height:1.4;}'
    + '.aim-r .c{font-size:11.5px;color:#8a8f98;line-height:1.4;}'
    + '.aim-r .h{grid-row:1/span 3;grid-column:2;text-align:right;align-self:center;}'
    + '.aim-r .h b{display:block;font-size:20px;color:#34d399;white-space:nowrap;}'
    + '.aim-r .h span{font-size:12px;color:#9aa0aa;white-space:nowrap;}'
    + '.aim-r.na .h b{color:#9aa0aa;font-size:15px;}'
    + '.aim-empty{padding:20px;text-align:center;color:#9aa0aa;}';
  var st = { tab: 'dom', mk: '', q: '' };
  function list(){ return st.tab === 'dom' ? DOM : IMP; }
  function makers(){ var a = []; list().forEach(function(r){ if(a.indexOf(r[0]) < 0) a.push(r[0]); }); return a; }
  function rowHtml(r){
    var h = hrs(r[4], st.tab), sub;
    if(st.tab === 'dom') sub = '<div class="m">' + e(r[3]) + (r[1] ? '　／　' + e(r[1]) : '') + '</div>' + (r[5] ? '<div class="c">代表車種：' + e(r[5]) + '</div>' : '<div class="c"></div>');
    else sub = '<div class="m">' + e(r[3]) + '</div><div class="c">センサー箇所：' + e(r[1]) + '</div>';
    return '<div class="aim-r' + (h == null ? ' na' : '') + '"><div class="s">' + e(r[2]) + '</div>' + sub + '<div class="h"><b>' + fmtH(h) + '</b><span>' + yen(r[4]) + '</span></div></div>';
  }
  function paint(box){
    var q = st.q.trim().toLowerCase(), rows = list().filter(function(r){
      if(st.mk && r[0] !== st.mk) return false;
      if(!q) return true;
      return r.join(' ').toLowerCase().indexOf(q) >= 0;
    });
    box.querySelectorAll('.aim-tab').forEach(function(b){ b.classList.toggle('on', b.dataset.t === st.tab); });
    box.querySelector('.aim-mk').innerHTML = '<button type="button" data-m=""' + (st.mk ? '' : ' class="on"') + '>すべて</button>' + makers().map(function(m){ return '<button type="button" data-m="' + e(m) + '"' + (st.mk === m ? ' class="on"' : '') + '>' + e(m) + '</button>'; }).join('');
    box.querySelector('.aim-note').textContent = '工数 ＝ 標準価格（税別）÷ ' + RATE[st.tab].toLocaleString('ja-JP') + '円（' + (st.tab === 'dom' ? '国産車' : '輸入車') + '）。WSG株式会社の価格表（' + (st.tab === 'dom' ? '2021年3月版' : '2023年8月版') + '）から。参考の値です。';
    var html = '', last = null;
    rows.forEach(function(r){ if(r[0] !== last){ html += '<div class="aim-g">' + e(r[0]) + '</div>'; last = r[0]; } html += rowHtml(r); });
    box.querySelector('.aim-list').innerHTML = html || '<div class="aim-empty">見つかりませんでした</div>';
  }
  function open(opt){
    opt = opt || {};
    if(opt.tab === 'dom' || opt.tab === 'imp') st.tab = opt.tab;
    st.mk = ''; st.q = opt.q || '';
    if(!document.getElementById('aim-css')){ var s = document.createElement('style'); s.id = 'aim-css'; s.textContent = CSS; document.head.appendChild(s); }
    var old = document.querySelector('.aim-ov'); if(old) old.remove();
    var ov = document.createElement('div'); ov.className = 'aim-ov';
    ov.innerHTML = '<div class="aim-box" role="dialog" aria-label="エイミング工数表"><div class="aim-hd"><h3>🎯 エイミング工数表（参考）</h3><button type="button" class="aim-x">✕ 閉じる</button></div>'
      + '<div class="aim-tabs"><button type="button" class="aim-tab" data-t="dom">国産車（÷6,500）</button><button type="button" class="aim-tab" data-t="imp">輸入車（÷13,000）</button></div>'
      + '<div class="aim-tools"><input type="search" placeholder="車種・システム名で探す（例：プリウス、ACC）"></div>'
      + '<div class="aim-mk"></div><div class="aim-note"></div><div class="aim-list"></div></div>';
    document.body.appendChild(ov);
    var box = ov.querySelector('.aim-box'), inp = ov.querySelector('input');
    inp.value = st.q;
    ov.addEventListener('click', function(ev){
      var t = ev.target;
      if(t === ov || t.closest('.aim-x')){ ov.remove(); return; }
      var tb = t.closest('.aim-tab'); if(tb){ st.tab = tb.dataset.t; st.mk = ''; paint(box); return; }
      var mb = t.closest('.aim-mk button'); if(mb){ st.mk = mb.dataset.m; paint(box); }
    });
    inp.addEventListener('input', function(){ st.q = inp.value; paint(box); });
    document.addEventListener('keydown', function k(ev){ if(ev.key === 'Escape'){ ov.remove(); document.removeEventListener('keydown', k); } });
    paint(box);
  }
  window.ARK_AIMING = { open: open, DOM: DOM, IMP: IMP, RATE: RATE, hours: hrs };
})();
