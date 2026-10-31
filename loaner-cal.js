/* =====================================================================
 * ARK 代車カレンダー（作業ボード・見積りツールの共通ファイル）
 *  置き場所：GitHub の work-board リポジトリ（https://maekenms-ctrl.github.io/work-board/loaner-cal.js）
 *  ・作業ボード（work-board/index.html）と見積りツール（estimate-tool/index.html）の両方がこのファイルを読む
 *  ・カレンダーを直すときは、このファイルだけを直してアップロードする
 *  ・データの読み書き（共有への保存など）は、それぞれのアプリが window.LCAL で渡す（下の「LCAL」）
 *  ・予約は Firestore の loaner、店休日は loaner の '_shop'。お客様名は扱わない（車種・番号だけ）
 *
 * LCAL（アプリが用意するもの）
 *   shopKey      店休日を端末に覚える名前（localStorage）
 *   other        もう一方のアプリの名前（説明の文に使う）
 *   all()        全部の予約（表のK列の予約を含む）[{id,car,from,to,src,name,model,plate,kinds,kind,memo,returned}]
 *   sheetGet(id) 表のK列の予約（見るだけ）なら返す
 *   ownGet(id)   このアプリで直せる予約なら返す
 *   label(car)   車両の表示名      name(b)  予約の帯に出す名前
 *   put(n,b)     予約を保存（保存できたら true）   del(b)  予約を削除
 *   saveShop(sc) 店休日を共有へ保存   newId()  新しい予約のID
 *   curName()    開いている車（車種 番号）   defCar()  初めに選ぶ代車
 *   reloadBtn()  表を読み直すボタン（なければ ''）   warn()  上に出す注意（なければ ''）   errs()  下に出す注意（HTML）
 *   onOpen()  onClose()   formNote(b)  予約の画面に出す説明（HTML）
 * ===================================================================== */
var LCAL_VER = '2026-10-31';
var OPEN_END = '9999-12-31';
// レンタカーの枠（10/31）：中の名前（n）は前のまま（前の予約を引き継ぐため）。レンタカー1・2＝トヨレン①②（前の「他社レンタカー①②」）、3・4＝キンレン①②
var RENTAL_ROWS = [{n:'レンタカー1',lab:'トヨレン①',ext:1},{n:'レンタカー2',lab:'トヨレン②',ext:1},{n:'レンタカー3',lab:'キンレン①',ext:1},{n:'レンタカー4',lab:'キンレン②',ext:1}];
var LOANER_CARS = [{n:'N-BOX'},{n:'ラパン',low:1},{n:'フィット',low:1},{n:'フリード'},{n:'プリウス',low:1},{n:'ミライース',low:1},{n:'ムーブ'}];   // low：全高1550mm以下
var LOANER_KINDS = [{k:'鈑金塗装',c:'#E6FF1A'},{k:'整備',c:'#FF2BD6'},{k:'車検点検',c:'#00E5FF'}];   // ネオンイエロー／ネオンピンク／ネオンブルー
var SHOP_CLOSED = (typeof SHOP_CLOSED !== 'undefined' && SHOP_CLOSED) || {w:[],d:[]};
var _lcMonth = null, _LC_JUMP = null, _LC_VIS = null;
var _HOL_CACHE = {};

function _lcA(){ return window.LCAL || {}; }
function _lcYmd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function _lcEsc(s){ return (typeof esc==='function')?esc(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
function _lcLabel(n){ const A=_lcA(); return A.label?A.label(n):(n||''); }
function _lcName(b){ const A=_lcA(); return A.name?A.name(b):(b.src==='sheet'?[b.model,b.plate].filter(Boolean).join(' '):(b.name||'')); }
function _lcAll(){ const A=_lcA(); try{ return A.all?A.all():[]; }catch(e){ return []; } }

function _kindColor(k){ const x=LOANER_KINDS.find(v=>v.k===k); return x?x.c:'#9AA4B2'; }
// 作業区分（複数可）：kinds 配列。古いデータの kind（文字列）も読む
function _kinds(b){ if(Array.isArray(b.kinds)&&b.kinds.length) return b.kinds.filter(k=>LOANER_KINDS.some(x=>x.k===k)); return String(b.kind||'').split('・').filter(k=>LOANER_KINDS.some(x=>x.k===k)); }
function _kindBg(b){ const ks=_kinds(b); if(!ks.length) return '#9AA4B2'; if(ks.length===1) return _kindColor(ks[0]);
  const n=ks.length; return 'linear-gradient(110deg,'+ks.map((k,i)=>`${_kindColor(k)} ${Math.round(i*100/n)}% ${Math.round((i+1)*100/n)}%`).join(',')+')'; }
function _toLabel(d){ return d===OPEN_END?'返却未定':d.slice(5).replace('-','/'); }
// 帯に出す名前（お客様名は出さない：表のK列の予約は車種・番号）
function _barNames(b){ const clean=t=>String(t||'').replace(/\s*様\s*/g,' ').replace(/[\s　]+/g,' ').trim();
  if(b.src==='sheet') return [clean(b.model),clean(b.plate)]; const n=clean(_lcName(b)); const i=n.indexOf(' '); return i>0?[n.slice(0,i),n.slice(i+1)]:[n,'']; }
// その日にその代車を使う予約（重なっていれば全部）
function _lcOn(all,car,day){ return all.filter(b=>b.car===car&&b.from<=day&&day<=b.to); }

// ─── 祝日（祝日法に沿って計算：振替休日・国民の休日を含む） ───
function jpHolidays(y){
  if(_HOL_CACHE[y]) return _HOL_CACHE[y];
  const H={}, k=(m,d)=>_lcYmd(new Date(y,m-1,d)); const nthMon=(m,n)=>{const f=new Date(y,m-1,1).getDay();return 1+((8-f)%7)+(n-1)*7;}; const add=(m,d,n)=>{H[k(m,d)]=n;};
  add(1,1,'元日'); add(1,nthMon(1,2),'成人の日'); add(2,11,'建国記念の日'); if(y>=2020) add(2,23,'天皇誕生日');
  add(3,Math.floor(20.8431+0.242194*(y-1980)-Math.floor((y-1980)/4)),'春分の日');
  add(4,29,'昭和の日'); add(5,3,'憲法記念日'); add(5,4,'みどりの日'); add(5,5,'こどもの日');
  add(7,nthMon(7,3),'海の日'); add(8,11,'山の日'); add(9,nthMon(9,3),'敬老の日');
  add(9,Math.floor(23.2488+0.242194*(y-1980)-Math.floor((y-1980)/4)),'秋分の日');
  add(10,nthMon(10,2),'スポーツの日'); add(11,3,'文化の日'); add(11,23,'勤労感謝の日');
  for(let d=new Date(y,0,2);d.getFullYear()===y;d.setDate(d.getDate()+1)){ const a=new Date(d);a.setDate(a.getDate()-1);const b=new Date(d);b.setDate(b.getDate()+1);
    if(!H[_lcYmd(d)]&&d.getDay()!==0&&H[_lcYmd(a)]&&H[_lcYmd(b)]) H[_lcYmd(d)]='国民の休日'; }
  for(const ds of Object.keys(H).sort()){ const d=new Date(ds+'T00:00:00'); if(d.getDay()!==0) continue; const n=new Date(d); do{ n.setDate(n.getDate()+1); }while(H[_lcYmd(n)]); if(n.getFullYear()===y) H[_lcYmd(n)]='振替休日'; }
  return _HOL_CACHE[y]=H;
}

// ─── 店休日（曜日・日付）：チーム共有（loaner の '_shop'） ───
function _isClosed(ds,w){ return SHOP_CLOSED.w.includes(w)||SHOP_CLOSED.d.includes(ds); }
function _saveShopClosed(){ const A=_lcA(); try{ localStorage.setItem(A.shopKey||'lc-shop-closed',JSON.stringify(SHOP_CLOSED)); }catch(e){} try{ A.saveShop&&A.saveShop(SHOP_CLOSED); }catch(e){ console.warn(e); } }
async function _toggleClosedDay(ds){
  const d=new Date(ds+'T00:00:00'), lab=`${d.getMonth()+1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）`;
  if(SHOP_CLOSED.w.includes(d.getDay())){ toast(`${lab}は毎週の定休日です。変えるときは「🏪 店休日の設定」から`,5000); return; }
  const i=SHOP_CLOSED.d.indexOf(ds);
  if(!await askConfirm(i>=0?`${lab}の店休日をやめますか？`:`${lab}を店休日にしますか？`,i>=0?'店休日をやめる':'店休日にする')) return;
  const k=SHOP_CLOSED.d.indexOf(ds); if(k>=0) SHOP_CLOSED.d.splice(k,1); else SHOP_CLOSED.d.push(ds); _saveShopClosed(); _renderLoanerCal(); }
// これから先の店休日（一覧の下に出す。毎週の定休日は「毎週○曜」とまとめる）
function _closedSoon(today,lim){ const W='日月火水木金土', out=[];
  if(SHOP_CLOSED.w.length) out.push('毎週'+[...SHOP_CLOSED.w].sort().map(w=>W[w]).join('・')+'曜');
  for(const r of _closedRanges()){ if(r[1]<today||r[0]>lim) continue; out.push(_mdL(r[0])+(r[1]!==r[0]?'〜'+_mdL(r[1]):'')); }
  return out; }
// 店休日（日付）を、続いている日ごとにまとめる（例：12/29〜1/4）
function _closedRanges(){ const d=[...new Set(SHOP_CLOSED.d)].sort(), out=[]; for(const x of d){ const L=out[out.length-1]; if(L){ const n=new Date(L[1]+'T00:00:00'); n.setDate(n.getDate()+1); if(_lcYmd(n)===x){ L[1]=x; L.n++; continue; } } const r=[x,x]; r.n=1; out.push(r); } return out; }
function _mdL(ds){ const [y,m,d]=ds.split('-'); return (y!==String(new Date().getFullYear())?y+'/':'')+(+m)+'/'+(+d); }
function _shopClosedForm(){
  const W='日月火水木金土'; const ov=document.createElement('div'); ov.className='cf-ov'; ov.style.zIndex=9500;
  const draw=()=>{ ov.innerHTML=`<div class="cf-box lc-form" style="max-width:380px"><div style="font-weight:700;margin-bottom:10px">店休日の設定</div>
    <label>毎週の定休日</label><div class="check-group" style="margin-bottom:12px">${[...W].map((c,i)=>`<button type="button" class="selbtn${SHOP_CLOSED.w.includes(i)?' on':''}" data-w="${i}">${c}</button>`).join('')}</div>
    <label>臨時休業・お盆・年末年始など（続けて休む日は「から」「まで」を入れる）</label>
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap"><input type="date" id="sc-date" style="flex:1;min-width:130px"><span style="font-size:12px">から</span><input type="date" id="sc-to" style="flex:1;min-width:130px"><span style="font-size:12px">まで</span><button type="button" class="btn" id="sc-add" style="white-space:nowrap;flex:none">追加</button></div>
    <div style="font-size:13px;margin-bottom:12px">${_closedRanges().map(r=>`<span class="selbtn on" style="display:inline-flex;gap:6px;margin:2px">${_mdL(r[0])}${r[1]!==r[0]?'〜'+_mdL(r[1])+'（'+r.n+'日）':''}<b data-del="${r[0]}|${r[1]}" style="cursor:pointer">✕</b></span>`).join('')||'<span style="color:var(--muted)">まだありません（カレンダーの日付を押しても切り替えられます）</span>'}</div>
    <div class="cf-btns" style="grid-template-columns:1fr"><button type="button" class="btn btn-primary sc-close">閉じる</button></div></div>`;
    ov.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{const w=+b.dataset.w;const i=SHOP_CLOSED.w.indexOf(w);if(i>=0)SHOP_CLOSED.w.splice(i,1);else SHOP_CLOSED.w.push(w);_saveShopClosed();draw();});
    ov.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const [a,z]=b.dataset.del.split('|');SHOP_CLOSED.d=SHOP_CLOSED.d.filter(x=>x<a||x>z);_saveShopClosed();draw();});
    ov.querySelector('#sc-date').onchange=e=>{ const t=ov.querySelector('#sc-to'); if(!t.value||t.value<e.target.value) t.value=e.target.value; };
    ov.querySelector('#sc-add').onclick=()=>{ let a=ov.querySelector('#sc-date').value, z=ov.querySelector('#sc-to').value||a; if(!a){ toast('休む日を入れてください'); return; } if(z<a){ const t=a; a=z; z=t; }
      const n0=SHOP_CLOSED.d.length; let k=0; for(const d=new Date(a+'T00:00:00');_lcYmd(d)<=z&&k<120;d.setDate(d.getDate()+1),k++){ const ds=_lcYmd(d); if(!SHOP_CLOSED.d.includes(ds)) SHOP_CLOSED.d.push(ds); }
      if(SHOP_CLOSED.d.length!==n0) _saveShopClosed(); draw(); };
    ov.querySelector('.sc-close').onclick=()=>{ov.remove();_renderLoanerCal();}; };
  draw(); ov.addEventListener('click',e=>{if(e.target===ov){ov.remove();_renderLoanerCal();}}); document.body.appendChild(ov);
}

// ─── 開く・閉じる・月を動かす ───
function openLoanerCal(){ const d=new Date(); _lcMonth=new Date(d.getFullYear(),d.getMonth(),1); _renderLoanerCal(); try{ const A=_lcA(); A.onOpen&&A.onOpen(); }catch(e){} }
function _lcShift(n){ const b=_LC_VIS||_lcMonth; const t=new Date(b.getFullYear(),b.getMonth()+n,1);
  const lo=new Date(_lcMonth.getFullYear(),_lcMonth.getMonth()-1,1), hi=new Date(_lcMonth.getFullYear(),_lcMonth.getMonth()+3,1);
  if(t<lo||t>hi) _lcMonth=new Date(t.getFullYear(),t.getMonth(),1);
  _LC_JUMP=_lcYmd(t); _renderLoanerCal(); }
function _lcToday(){ const d=new Date(); _lcMonth=new Date(d.getFullYear(),d.getMonth(),1); d.setDate(d.getDate()-2); _LC_JUMP=_lcYmd(d); _renderLoanerCal(); }
function _closeLoanerCal(){ const o=document.getElementById('lc-ov'); if(o) o.remove(); try{ const A=_lcA(); A.onClose&&A.onClose(); }catch(e){} }

// 重なっている予約を選ぶ（同じ代車・同じ日に2つ以上）
function _lcPick(ids){
  const all=_lcAll(), L=String(ids).split('|').map(id=>all.find(b=>b.id===id)).filter(Boolean);
  if(L.length===1){ _loanerForm(L[0].id); return; }
  const ov=document.createElement('div'); ov.className='cf-ov'; ov.style.zIndex=9500;
  ov.innerHTML=`<div class="cf-box" style="max-width:420px"><div style="font-weight:700;margin-bottom:6px;color:#ff4d4d">⚠ 予約が重なっています（${L.length}件）</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">同じ代車に、同じ日の予約が2つ以上あります。直す予約を押してください。</div>
    ${L.map(b=>`<button type="button" class="btn lc-pk" data-id="${_lcEsc(b.id)}" style="width:100%;justify-content:flex-start;gap:8px;margin-bottom:6px;text-align:left"><i class="kd" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${_kindBg(b)}"></i><span><b>${_lcEsc(_lcLabel(b.car))}</b>　${b.from.slice(5).replace('-','/')}〜${_toLabel(b.to)}<br><small>${b.src==='sheet'?'📄 入出庫管理表　':b.src==='hist'?'🗂 記録　':''}${_lcEsc(_lcName(b)||'予約')}</small></span></button>`).join('')}
    <div class="cf-btns" style="grid-template-columns:1fr"><button type="button" class="btn lc-pk-x">閉じる</button></div></div>`;
  ov.querySelectorAll('.lc-pk').forEach(bt=>bt.onclick=()=>{ ov.remove(); _loanerForm(bt.dataset.id); });
  ov.querySelector('.lc-pk-x').onclick=()=>ov.remove(); ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
  document.body.appendChild(ov);
}

// ─── カレンダーを描く（前の月〜3か月先までを1本につないで横にスクロール） ───
function _renderLoanerCal(){
  const A=_lcA();
  if(!_lcMonth){ const d=new Date(); _lcMonth=new Date(d.getFullYear(),d.getMonth(),1); }
  _lcCss();
  let ov=document.getElementById('lc-ov');
  if(!ov){ ov=document.createElement('div'); ov.id='lc-ov'; ov.className='lc-ov'; ov.addEventListener('click',e=>{if(e.target===ov)_closeLoanerCal();}); document.body.appendChild(ov); }
  const keep=ov.querySelector('.lc-scroll'), keepX=keep&&!_LC_JUMP?keep.scrollLeft:null;
  const start=new Date(_lcMonth.getFullYear(),_lcMonth.getMonth()-1,1), end=new Date(_lcMonth.getFullYear(),_lcMonth.getMonth()+4,0), today=_lcYmd(new Date());
  const days=[]; for(const d=new Date(start);d<=end;d.setDate(d.getDate()+1)){ const ds=_lcYmd(d), HOL=jpHolidays(d.getFullYear()); days.push({d:ds,n:d.getDate(),m:d.getMonth()+1,y:d.getFullYear(),w:d.getDay(),hol:HOL[ds]||'',closed:_isClosed(ds,d.getDay())}); }
  const N=days.length, W='日月火水木金土', all=_lcAll();
  const cls=x=>[x.w===0||x.hol?'sun':x.w===6?'sat':'',x.closed?'closed':'',x.d===today?'today':'',x.n===1?'m1':''].filter(Boolean).join(' ');
  const tint=x=>x.closed?'rgba(230,40,40,.30)':x.w===0||x.hol?'rgba(255,107,107,.16)':x.w===6?'rgba(78,161,255,.16)':'';
  const months=[]; for(const x of days){ const L=months[months.length-1]; if(L&&L.m===x.m&&L.y===x.y) L.n++; else months.push({y:x.y,m:x.m,n:1}); }
  const ovIds=new Set();   // 重なっている予約
  let h=`<div class="lc-box"><div class="lc-head">
    <button class="btn" type="button" onclick="_lcShift(-1)">◀</button><div class="lc-title" id="lc-title">${_lcMonth.getFullYear()}年${_lcMonth.getMonth()+1}月</div><button class="btn" type="button" onclick="_lcShift(1)">▶</button>
    <button class="btn" type="button" onclick="_lcToday()">今日</button>
    <button class="btn btn-primary lc-add-top" type="button" onclick="_loanerForm()">＋ 予約を追加</button>
    <button class="btn" type="button" onclick="_shopClosedForm()">🏪 店休日の設定</button>
    ${A.reloadBtn?A.reloadBtn():''}
    <button class="btn" type="button" style="margin-left:auto" onclick="_closeLoanerCal()">✕ 閉じる</button></div>
    ${A.warn&&A.warn()?`<div style="color:#ffb020;font-size:12px;margin-bottom:6px">${_lcEsc(A.warn())}</div>`:''}
    <div class="lc-legend">${LOANER_KINDS.map(x=>`<span><i style="background:${x.c}"></i>${x.k}</span>`).join('')}<span><i style="background:#9AA4B2"></i>その他</span><span><i class="lg-sun"></i>日曜・祝日</span><span><i class="lg-sat"></i>土曜</span><span><i class="lg-closed"></i>店休日</span><span><i class="lg-ov"></i>予約の重なり</span></div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px">横にスクロールすると月をまたいで続きます。空いているマスで予約、色の帯で変更・削除。赤い斜線の日が店休日です。日付（いちばん上の行）を押すと、店休日にするか確認します。赤い枠の「⚠ 重なり」は、同じ代車に同じ日の予約が2つ以上あるところです。${_lcEsc(A.other||'')}${A.other?'のカレンダーと同じ予約です。':''}</div>
    <div class="lc-scroll"><table class="lc-grid"><colgroup><col class="c-car"><col class="c-d" span="${N}"></colgroup><tr class="lc-mrow"><th class="lc-car"></th>${months.map(o=>`<th class="lc-mon" colspan="${o.n}"><span>${o.y}年${o.m}月</span></th>`).join('')}</tr>
    <tr><th class="lc-car">車両</th>${days.map(x=>`<th class="${cls(x)}" data-d="${x.d}" onclick="_toggleClosedDay('${x.d}')" title="${x.hol?_lcEsc(x.hol):''}${x.closed?' 店休日':''}">${x.n===1?`<span class="mlab">${x.m}月</span>`:''}${x.n}<br>${W[x.w]}${x.hol?'<span class="hol">祝</span>':''}</th>`).join('')}</tr>`;
  for(const c of [...LOANER_CARS,...RENTAL_ROWS]){
    h+=`<tr><td class="lc-car${c.low?' low':''}${c.ext?' ext':''}">${c.lab||c.n}${c.low?'<small>1550mm以下</small>':''}</td>`;
    const on=days.map(x=>_lcOn(all,c.n,x.d)), key=i=>on[i].map(b=>b.id).sort().join('|');
    for(let i=0;i<N;){
      const x=days[i], L=on[i];
      if(!L.length){ h+=`<td class="free ${cls(x)}" onclick="_loanerForm(null,'${c.n}','${x.d}')"></td>`; i++; continue; }
      let span=1; const k0=key(i); while(i+span<N&&key(i+span)===k0) span++;
      const seg=days.slice(i,i+span), tn=seg.map(tint); let bg='';
      if(tn.some(Boolean)) bg=`background:linear-gradient(90deg,${tn.map((t,q)=>`${t||'transparent'} ${(q*100/span).toFixed(3)}% ${((q+1)*100/span).toFixed(3)}%`).join(',')});`;
      if(L.length>1){   // 重なり：同じ代車に同じ日の予約が2つ以上
        L.forEach(b=>ovIds.add(b.id));
        const nm=L.map(b=>_lcName(b)||'予約').join(' ／ ');
        h+=`<td class="bk ov${span<=2?' short':''}${x.n===1?' m1':''}" colspan="${span}" style="${bg}" onclick="_lcPick('${_lcEsc(k0)}')" title="${_lcEsc('予約が重なっています：'+nm)}"><div class="bk-bar lc-ovbar"><span class="bk-t"><span class="bk-n">⚠ 重なり ${L.length}件</span>${span>=2?`<span class="bk-m">${_lcEsc(nm)}</span>`:''}</span></div></td>`;
      } else {
        const b=L[0], kt=_kinds(b).join('・'), lab=[_lcName(b)||'予約',kt].filter(Boolean).join(' '), [cu,mo]=_barNames(b);
        h+=`<td class="bk${b.src==='sheet'?' sh':''}${b.src==='hist'?' hist':''}${span<=2?' short':''}${b.to===OPEN_END?' open':''}${x.n===1?' m1':''}" colspan="${span}" style="${bg}" onclick="_loanerForm('${_lcEsc(b.id)}')" title="${_lcEsc(lab+(b.memo?' ／ '+b.memo:''))}"><div class="bk-bar" style="background:${_kindBg(b)}"><span class="bk-t"><span class="bk-n">${b.src==='sheet'?'<i class="shm">📄</i>':b.src==='hist'?'<i class="shm">🗂</i>':''}${_lcEsc(cu||'予約')}</span>${mo?`<span class="bk-m">${_lcEsc(mo)}</span>`:''}${kt&&span>=3?`<small>${_lcEsc(kt)}</small>`:''}</span></div></td>`;
      }
      i+=span;
    }
    h+='</tr>';
  }
  h+='</table></div>';
  const to=days[N-1].d;
  const list=all.filter(b=>b.to>=today&&b.from<=to).sort((a,b)=>a.from<b.from?-1:1);
  const lim=_lcYmd(new Date(Date.now()+62*864e5)), hols=days.filter(x=>x.hol&&x.d>=today&&x.d<=lim).map(x=>`${x.m}/${x.n} ${x.hol}`);
  h+=`<div class="lc-list"><div style="font-size:12px;color:var(--muted);margin-bottom:4px">今日から先の予約</div>${list.length?list.map(b=>`<div class="lc-item${ovIds.has(b.id)?' ov':''}" onclick="_loanerForm('${_lcEsc(b.id)}')"><i class="kd" style="background:${_kindBg(b)}"></i><b>${_lcEsc(_lcLabel(b.car))}</b><span>${b.from.slice(5).replace('-','/')}〜${_toLabel(b.to)}</span><span>${_lcEsc(_lcName(b))}</span><span>${_lcEsc(_kinds(b).join('・'))}</span><span style="color:var(--muted)">${_lcEsc(b.memo||'')}</span>${ovIds.has(b.id)?'<span class="lc-ovtag">⚠ 重なり</span>':''}</div>`).join(''):'<div style="color:var(--muted)">予約はありません</div>'}
    ${hols.length?`<div style="margin-top:8px;color:#ff6b6b;font-size:12px">祝日（2か月先まで）：${hols.join('、')}</div>`:''}
    ${(()=>{ const c=_closedSoon(today,lim); return `<div class="lc-closed-soon"><b>🏪 店休日（2か月先まで）</b>${c.length?c.map(x=>`<span>${x}</span>`).join(''):'<span style="opacity:.7">登録されていません</span>'}<button type="button" class="btn" onclick="_shopClosedForm()">設定</button></div>`; })()}
    ${A.errs?A.errs():''}</div>
    <button class="btn btn-primary lc-add-fab" type="button" onclick="_loanerForm()">＋ 予約を追加</button></div>`;
  ov.innerHTML=h;
  const sc=ov.querySelector('.lc-scroll'); if(!sc) return;
  const carW=(ov.querySelector('th.lc-car')||{}).offsetWidth||92;
  const go=ds=>{ const th=ov.querySelector(`th[data-d="${ds}"]`); if(th) sc.scrollLeft=Math.max(0,th.offsetLeft-carW); };
  if(_LC_JUMP){ go(_LC_JUMP); _LC_JUMP=null; } else if(keepX!=null) sc.scrollLeft=keepX; else { const t=new Date(); t.setDate(t.getDate()-2); go(_lcYmd(t)); }
  // 見出しの「○年○月」は、いま左端に見えている月にする
  const ths=[...ov.querySelectorAll('th[data-d]')], title=ov.querySelector('#lc-title');
  const upd=()=>{ const x=sc.scrollLeft+carW+4; let cur=ths[0]; for(const th of ths){ if(th.offsetLeft<=x) cur=th; else break; } if(cur&&title){ const [yy,mm]=cur.dataset.d.split('-'); title.textContent=`${+yy}年${+mm}月`; _LC_VIS=new Date(+yy,+mm-1,1); } };
  let raf=0; sc.addEventListener('scroll',()=>{ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; upd(); }); },{passive:true}); upd();
}

// ─── 予約を追加・変更・削除する画面 ───
function _loanerForm(id,car,day){
  const A=_lcA();
  const sb=id&&A.sheetGet&&A.sheetGet(id);
  if(sb){ const ov=document.createElement('div'); ov.className='cf-ov'; ov.style.zIndex=9500;
    ov.innerHTML=`<div class="cf-box"><div style="font-weight:700;margin-bottom:8px">📄 入出庫管理表の予約</div><div style="line-height:1.9;font-size:14px">代車：${_lcEsc(_lcLabel(sb.car))}<br>入庫日（貸出）：${sb.from}<br>納期・出庫日（返却）：${sb.to===OPEN_END?'未定（決まるまで貸出中として表示）':sb.to}<br>車両：${_lcEsc(_lcName(sb))}<br>区分：${_lcEsc(sb.kind||'-')}<br><span style="color:var(--muted)">${_lcEsc(sb.memo||'')}</span></div><div style="font-size:12px;color:var(--muted);margin:8px 0">この予約はスプレッドシートから読み込んでいます。変更はシートで行ってください。</div><div class="cf-btns" style="grid-template-columns:1fr"><button type="button" class="btn btn-primary">閉じる</button></div></div>`;
    ov.querySelector('button').onclick=()=>ov.remove(); ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();}); document.body.appendChild(ov); return; }
  const b=id&&A.ownGet?A.ownGet(id):null;
  const d0=day||_lcYmd(new Date());
  const v=b?{...b}:{car:car||(A.defCar&&A.defCar())||LOANER_CARS[0].n,from:d0,to:d0,name:(A.curName&&A.curName())||'',kind:'',memo:''};
  const ov=document.createElement('div'); ov.className='cf-ov'; ov.style.zIndex=9500;
  ov.innerHTML=`<div class="cf-box lc-form" style="max-width:380px"><div style="font-weight:700;margin-bottom:10px">${b?'代車の予約を変更':'代車の予約を追加'}</div>
    ${b&&b.src==='hist'?'<div style="font-size:12px;color:var(--muted);margin-bottom:8px">🗂 入出庫管理表の行を消したときに残した記録です（2か月で自動で消えます）。</div>':''}
    ${A.formNote?A.formNote(b):''}
    <div class="field"><label>車両</label><select id="lf-car">${[...LOANER_CARS,...RENTAL_ROWS].map(c=>`<option value="${c.n}"${c.n===v.car?' selected':''}>${c.lab||c.n}</option>`).join('')}</select></div>
    <div class="field"><label>貸出日</label><input type="date" id="lf-from" value="${v.from}"></div>
    <div class="field"><label>返却予定日</label><input type="date" id="lf-to" value="${v.to===OPEN_END?'':v.to}">${v.to===OPEN_END?'<div style="font-size:11px;color:var(--muted)">空のまま保存すると「返却未定」のままです</div>':''}</div>
    <div class="field"><label>車両（お客様名は入れないでください）</label><input id="lf-name" value="${_lcEsc(v.name||'')}" placeholder="例：プリウス 品川300あ1234"></div>
    <div class="field"><label>メモ（作業の区分）</label><div class="check-group" id="lf-kind">${LOANER_KINDS.map(x=>`<button type="button" class="selbtn kd-btn${_kinds(v).includes(x.k)?' on':''}" data-k="${x.k}" style="--kc:${x.c}">${x.k}</button>`).join('')}</div><div style="font-size:11px;color:var(--muted);margin-top:3px">複数選べます</div>
      <input id="lf-memo" value="${_lcEsc(v.memo||'')}" placeholder="例：保険会社手配／ガソリン満タン" style="margin-top:6px"></div>
    <div class="cf-btns" style="grid-template-columns:${b?'1fr 1fr 1fr':'1fr 1fr'}">${b?'<button type="button" class="btn cf-yes lf-del">削除</button>':''}<button type="button" class="btn lf-cancel">キャンセル</button><button type="button" class="btn btn-primary lf-ok">保存</button></div></div>`;
  let kinds=_kinds(v);
  ov.querySelectorAll('.kd-btn').forEach(bt=>bt.onclick=()=>{ const k=bt.dataset.k; kinds=kinds.includes(k)?kinds.filter(x=>x!==k):LOANER_KINDS.map(x=>x.k).filter(x=>x===k||kinds.includes(x)); bt.classList.toggle('on',kinds.includes(k)); });
  const close=()=>ov.remove();
  ov.querySelector('.lf-cancel').onclick=close; ov.addEventListener('click',e=>{if(e.target===ov)close();});
  if(b) ov.querySelector('.lf-del').onclick=async()=>{ if(!await askConfirm(`${_lcLabel(b.car)}（${b.from.slice(5)}〜${_toLabel(b.to)}）の予約を削除しますか？`)) return; try{ A.del&&A.del(b); }catch(e){ console.warn(e); } close(); _renderLoanerCal(); };
  ov.querySelector('.lf-ok').onclick=async()=>{
    let to=ov.querySelector('#lf-to').value; if(!to&&v.to===OPEN_END) to=OPEN_END;
    const n={id:b?b.id:(A.newId?A.newId():'cal-'+Date.now().toString(36)),car:ov.querySelector('#lf-car').value,from:ov.querySelector('#lf-from').value,to,name:ov.querySelector('#lf-name').value.trim(),kinds,kind:kinds.join('・'),memo:ov.querySelector('#lf-memo').value.trim()};
    if(!n.from||!n.to){ toast('貸出日と返却予定日を入れてください'); return; }
    if(n.to<n.from){ const t=n.from; n.from=n.to; n.to=t; }
    const clash=_lcAll().find(x=>x.id!==n.id&&x.car===n.car&&x.from<=n.to&&n.from<=x.to);
    if(clash&&!await askConfirm(`${_lcLabel(n.car)}は ${clash.from.slice(5)}〜${_toLabel(clash.to)}（${_lcName(clash)||'予約'}）と重なっています。このまま保存しますか？`,'保存する')) return;
    let ok=false; try{ ok=A.put?A.put(n,b):false; }catch(e){ console.warn(e); toast('保存できませんでした',5000); }
    if(ok===false) return;
    close(); _renderLoanerCal();
  };
  document.body.appendChild(ov);
}

// ─── 共通ファイルで足した見た目（重なり・記録） ───
function _lcCss(){
  if(document.getElementById('lc-css')) return;
  const st=document.createElement('style'); st.id='lc-css';
  st.textContent=`.lc-grid td.bk.ov{cursor:pointer;padding:3px 1px;}
.lc-grid td.bk.ov .lc-ovbar{background:repeating-linear-gradient(135deg,rgba(255,77,77,.25) 0 6px,rgba(255,77,77,.08) 6px 12px)!important;border:2px solid #ff4d4d;color:#fff;}
.lc-grid td.bk.ov .bk-n{color:#ff4d4d;font-weight:900;}
.lc-grid td.bk.ov .bk-m{color:var(--text);}
.lc-grid td.bk.hist .bk-bar{opacity:.75;}
.lc-legend .lg-ov{display:inline-block;background:transparent!important;border:2px solid #ff4d4d;}
.lc-item.ov{box-shadow:inset 3px 0 0 #ff4d4d;}
.lc-item .lc-ovtag{color:#ff4d4d;font-weight:800;font-size:12px;}`;
  document.head.appendChild(st);
}
