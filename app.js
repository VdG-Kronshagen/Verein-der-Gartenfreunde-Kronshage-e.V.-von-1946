// ══════════════════════════════════════════════════════════════════
//  Gartenverein – Mitglieder & E-Mail-Verteiler
//  Standalone, max. Sicherheit: echtes E-Mail/Passwort-Login (Firebase Auth),
//  KEIN anonymer Zugang. Daten nur fuer angemeldete Konten lesbar/schreibbar.
// ══════════════════════════════════════════════════════════════════
(function(){
"use strict";

// ── Helfer ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const val = id => { const el=$(id); return el ? el.value.trim() : ''; };
function toast(msg,type){ const e=document.createElement('div'); e.className='toast'+(type?(' '+type):''); e.textContent=msg; $('toasts').appendChild(e); setTimeout(()=>e.remove(),3200); }
function openModal(html, wide){ const m=$('modal-body'); m.innerHTML=html; m.classList.toggle('modal-wide', !!wide); $('modal-bg').classList.add('show'); }
function closeModal(){ $('modal-bg').classList.remove('show'); }
const telHref  = t => 'tel:'+String(t||'').replace(/[^\d+]/g,'');
const mailHref = m => 'mailto:'+esc(String(m||'').trim());
function normEmails(parts){
  const seen=new Set(), out=[];
  (Array.isArray(parts)?parts:[parts]).forEach(s=>String(s||'').split(/[,;\s]+/).forEach(tok=>{
    const e=tok.trim(); if(e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){ const k=e.toLowerCase(); if(!seen.has(k)){ seen.add(k); out.push(e); } }
  }));
  return out;
}
function openMail(emails, feld){
  const list=normEmails(emails);
  if(!list.length){ toast('Keine gültigen E-Mail-Adressen.','err'); return; }
  const url='mailto:?'+(feld||'bcc')+'='+encodeURIComponent(list.join(','));
  if(url.length>1900) toast('Sehr viele Adressen – ggf. „Kopieren" nutzen.','');
  try{ window.location.href=url; }catch(e){ const a=document.createElement('a'); a.href=url; a.click(); }
}
function copyText(txt){
  if(!txt){ toast('Nichts zu kopieren.','err'); return; }
  const done=()=>toast('Adressen kopiert ✓','ok');
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(done,()=>fallbackCopy(txt,done)); }
  else fallbackCopy(txt,done);
}
function fallbackCopy(txt,done){ try{ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }catch(e){ toast('Kopieren nicht möglich.','err'); } }
const newId = () => 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

// ── State ──────────────────────────────────────────────────────────
let _user=null, _ref=null;
let _cache={ mitglieder:{}, verteiler:{}, meta:{} };
let _view='mitglieder', _q='';

function members(){ return Object.values(_cache.mitglieder||{}).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de',{sensitivity:'base'})); }
function lists(){ return Object.values(_cache.verteiler||{}).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de',{sensitivity:'base'})); }
function whoLabel(){ return (_user&&(_user.displayName||_user.email))||''; }

// ── Firebase Init + Auth ───────────────────────────────────────────
function init(){
  try{
    if(window.APP_TITEL){ $('login-titel').textContent=window.APP_TITEL; $('brand').textContent=window.APP_TITEL; document.title=window.APP_TITEL+' – Mitglieder & Verteiler'; }
    firebase.initializeApp(window.FIREBASE_CONFIG);
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
    firebase.auth().onAuthStateChanged(handleAuth);
  }catch(e){
    document.body.innerHTML='<div style="padding:40px;font-family:Arial">⚠️ Firebase-Konfiguration fehlt oder ist ungültig.<br><br>Bitte <b>firebase-config.js</b> mit deinen Projektdaten ausfüllen.<br><small>'+esc(e&&e.message)+'</small></div>';
  }
  $('login-form').addEventListener('submit', doLogin);
}
function handleAuth(user){
  // Nur echte Passwort-Konten zulassen (kein anonym)
  if(user && (user.providerData||[]).some(p=>p.providerId==='password')){
    _user=user;
    $('login').classList.remove('show');
    $('app').classList.add('show');
    $('who').textContent=whoLabel();
    startData();
  } else {
    if(user){ try{ firebase.auth().signOut(); }catch(e){} }
    _user=null;
    $('app').classList.remove('show');
    $('login').classList.add('show');
    setTimeout(()=>$('li-email').focus(),60);
  }
}
function doLogin(ev){
  ev.preventDefault();
  const email=val('li-email'), pw=$('li-pw').value;
  $('login-err').style.display='none';
  if(!email||!pw){ showLoginErr('Bitte E-Mail und Passwort eingeben.'); return; }
  firebase.auth().signInWithEmailAndPassword(email, pw).catch(err=>{
    const c=err&&err.code;
    showLoginErr(
      c==='auth/invalid-credential'||c==='auth/wrong-password'||c==='auth/user-not-found' ? 'E-Mail oder Passwort falsch.' :
      c==='auth/too-many-requests' ? 'Zu viele Versuche – bitte später erneut.' :
      c==='auth/invalid-email' ? 'Ungültige E-Mail-Adresse.' :
      ('Anmeldung fehlgeschlagen: '+(err&&err.message||''))
    );
  });
}
function showLoginErr(m){ const el=$('login-err'); el.textContent=m; el.style.display='block'; }
function logout(){ try{ firebase.auth().signOut(); }catch(e){} }

// Passwort vergessen (Login): Reset-Mail an die eingegebene Adresse
function forgotPw(){
  const email=val('li-email');
  if(!email || !/@/.test(email)){ showLoginErr('Bitte zuerst oben deine E-Mail eingeben – dann „Passwort vergessen".'); return; }
  firebase.auth().sendPasswordResetEmail(email)
    .then(()=>{ showLoginErr(''); toast('E-Mail zum Zurücksetzen verschickt ✓','ok'); })
    .catch(err=>{ showLoginErr('Konnte keine Mail senden: '+(err&&err.message||'')); });
}

// Eigenes Passwort ändern – sicher: altes Passwort wird geprüft (Reauth)
function changePwModal(){
  openModal(`<h3>🔑 Mein Passwort ändern</h3>
   <div class="field"><label>Aktuelles Passwort *</label><input id="p-cur" type="password" autocomplete="current-password"></div>
   <div class="field"><label>Neues Passwort * <span style="font-weight:400;text-transform:none">(mind. 6 Zeichen)</span></label><input id="p-new" type="password" autocomplete="new-password"></div>
   <div class="field"><label>Neues Passwort wiederholen *</label><input id="p-new2" type="password" autocomplete="new-password"></div>
   <div class="actions-row"><button class="btn" onclick="GV.close()">Abbrechen</button><button class="btn primary" onclick="GV.savePw()">Ändern</button></div>`);
}
function savePw(){
  const cur=val('p-cur'), n1=val('p-new'), n2=val('p-new2');
  if(n1.length<6){ toast('Neues Passwort: mindestens 6 Zeichen.','err'); return; }
  if(n1!==n2){ toast('Die neuen Passwörter stimmen nicht überein.','err'); return; }
  const user=firebase.auth().currentUser; if(!user){ toast('Nicht angemeldet.','err'); return; }
  const cred=firebase.auth.EmailAuthProvider.credential(user.email, cur);
  user.reauthenticateWithCredential(cred).then(()=>user.updatePassword(n1))
    .then(()=>{ closeModal(); toast('Passwort geändert ✓','ok'); })
    .catch(err=>{ const c=err&&err.code; toast((c==='auth/wrong-password'||c==='auth/invalid-credential')?'Aktuelles Passwort ist falsch.':'Fehler: '+(err&&err.message||''),'err'); });
}

// Neuen Login anlegen (über zweite App-Instanz, damit die eigene Sitzung bleibt)
function provisionUser(email, pw){
  return new Promise((resolve,reject)=>{
    try{
      const cfg=firebase.app().options;
      const sec=(firebase.apps||[]).find(a=>a.name==='admin-prov') || firebase.initializeApp(cfg,'admin-prov');
      sec.auth().createUserWithEmailAndPassword(email, pw)
        .then(()=>{ try{ sec.auth().signOut(); }catch(_){}; resolve(); })
        .catch(err=>{ try{ sec.auth().signOut(); }catch(_){}; reject(err); });
    }catch(e){ reject(e); }
  });
}
function addUserModal(){
  openModal(`<h3>👤 Nutzer anlegen</h3>
   <div class="muted" style="margin-bottom:12px">Legt einen neuen Login an. Tipp: Häkchen unten setzen → die Person bekommt eine Mail und vergibt ihr Passwort selbst (du musst es dann nicht kennen).</div>
   <div class="field"><label>E-Mail *</label><input id="u-email" type="email" autocomplete="off"></div>
   <div class="field"><label>Start-Passwort * <span style="font-weight:400;text-transform:none">(mind. 6 Zeichen)</span></label><input id="u-pw" type="text" autocomplete="off" placeholder="z. B. Start1234"></div>
   <label class="ck"><input type="checkbox" id="u-reset" checked> Mail zum eigenen Passwort-Setzen an die Person senden</label>
   <div class="actions-row"><button class="btn" onclick="GV.close()">Abbrechen</button><button class="btn primary" onclick="GV.saveUser()">Anlegen</button></div>`);
}
function saveUser(){
  const email=val('u-email'), pw=val('u-pw');
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ toast('Bitte eine gültige E-Mail eingeben.','err'); return; }
  if(pw.length<6){ toast('Start-Passwort: mindestens 6 Zeichen.','err'); return; }
  const reset=!!($('u-reset')&&$('u-reset').checked);
  toast('Lege Nutzer an …','');
  provisionUser(email, pw).then(()=>{
    if(reset) firebase.auth().sendPasswordResetEmail(email).catch(()=>{});
    closeModal(); toast('Nutzer angelegt ✓'+(reset?' – Mail zum Passwort-Setzen verschickt.':''),'ok');
  }).catch(err=>{ const c=err&&err.code;
    toast(c==='auth/email-already-in-use'?'Diese E-Mail hat schon einen Zugang.':(c==='auth/weak-password'?'Passwort zu schwach.':(c==='auth/invalid-email'?'Ungültige E-Mail.':'Fehler: '+(err&&err.message||''))),'err');
  });
}

// ── Datenschicht (realtime, granulare Writes) ──────────────────────
function startData(){
  if(_ref) return;  // nur einmal
  _ref = firebase.database().ref('gv');
  ['mitglieder','verteiler','meta'].forEach(coll=>{
    _ref.child(coll).on('value', snap=>{
      _cache[coll] = snap.val() || {};
      if($('modal-bg').classList.contains('show')) return; // Formular offen → nicht neu zeichnen
      render();
    });
  });
}
function saveMeta(obj){ const meta=Object.assign({}, _cache.meta||{}, obj); _cache.meta=meta; if(_ref) _ref.child('meta').set(meta).catch(e=>toast('Speichern fehlgeschlagen: '+(e&&e.message),'err')); }
// Schreiben = sofort lokal übernehmen (optimistisch) + im Hintergrund speichern.
// So erscheint die Änderung SOFORT, ohne aufs Echtzeit-Signal zu warten.
function saveMember(m){ m.updatedAt=Date.now(); m.updatedBy=whoLabel(); if(!_cache.mitglieder) _cache.mitglieder={}; _cache.mitglieder[m.id]=m; if(_ref) _ref.child('mitglieder').child(m.id).set(m).catch(e=>toast('Speichern fehlgeschlagen: '+(e&&e.message),'err')); }
function delMember(id){ if(_cache.mitglieder) delete _cache.mitglieder[id]; if(_ref) _ref.child('mitglieder').child(id).remove().catch(e=>toast('Löschen fehlgeschlagen: '+(e&&e.message),'err')); }
function saveListe(v){ v.updatedAt=Date.now(); v.updatedBy=whoLabel(); if(!_cache.verteiler) _cache.verteiler={}; _cache.verteiler[v.id]=v; if(_ref) _ref.child('verteiler').child(v.id).set(v).catch(e=>toast('Speichern fehlgeschlagen: '+(e&&e.message),'err')); }
function delListe(id){ if(_cache.verteiler) delete _cache.verteiler[id]; if(_ref) _ref.child('verteiler').child(id).remove().catch(e=>toast('Löschen fehlgeschlagen: '+(e&&e.message),'err')); }

// ══════════════════════════════════════════════════════════════════
//  Ansichten
// ══════════════════════════════════════════════════════════════════
function show(v){ _view=v; _q=''; const s=$('search'); if(s) s.value=''; render(); }
function onSearch(v){ _q=String(v||'').toLowerCase().trim(); render(); }
function render(){
  $('tab-mitglieder').classList.toggle('active', _view==='mitglieder');
  $('tab-verteiler').classList.toggle('active', _view==='verteiler');
  $('view').innerHTML = _view==='verteiler' ? viewVerteiler() : viewMitglieder();
}

// ── Mitglieder ─────────────────────────────────────────────────────
function matchM(m){ return [m.name,m.email,m.tel,m.adresse,m.note,(m.parzellen||[]).map(p=>p.nr).join(' '),(m.aemter||[]).map(a=>a.amt).join(' ')].map(x=>String(x||'').toLowerCase()).join(' ').includes(_q); }
function memberCard(m){ const amt=currentAmt(m), pz=currentParz(m);
  return `<div class="card" style="cursor:pointer" onclick="GV.openMember('${m.id}')">
      <h3>${esc(m.name||'(ohne Name)')}</h3>
      ${(m.email||m.tel)?`<div class="links" style="margin-top:6px" onclick="event.stopPropagation()">
        ${m.email?`<a href="${mailHref(m.email)}">✉️ ${esc(m.email)}</a>`:''}
        ${m.tel?`<a href="${telHref(m.tel)}">📞 ${esc(m.tel)}</a>`:''}
      </div>`:''}
      ${(amt||pz||m.sepaAktiv)?`<div class="links" style="margin-top:6px">
        ${amt?`<span class="chip cur">🏅 ${esc(amt)}</span>`:''}
        ${pz?`<span class="chip">🌳 Parzelle ${esc(pz)}</span>`:''}
        ${m.sepaAktiv?`<span class="chip">🏦 SEPA</span>`:''}
      </div>`:''}
    </div>`; }
function leftCard(m){ return `<div class="card" style="cursor:pointer" onclick="GV.openMember('${m.id}')">
      <h3>${esc(m.name||'(ohne Name)')}</h3>
      <div class="sub">${statusLabel(m)}</div>
      ${(m.parzellen&&m.parzellen.length)?`<div class="links" style="margin-top:8px">${m.parzellen.map(p=>`<span class="chip">🌳 ${esc(p.nr)} ${parzRange(p)}</span>`).join('')}</div>`:''}
    </div>`; }
function viewMitglieder(){
  let arr=members(); if(_q) arr=arr.filter(matchM);
  const active=arr.filter(isAktiv), left=arr.filter(m=>!isAktiv(m));
  // Übersicht: Amtsinhaber oben, der Rest nach niedrigster Parzellennummer
  active.sort((a,b)=>{
    const aA=currentAmt(a)?1:0, bA=currentAmt(b)?1:0;
    if(aA!==bA) return bA-aA;
    if(aA&&bA) return String(a.name||'').localeCompare(String(b.name||''),'de',{sensitivity:'base'});
    const pa=minParz(a), pb=minParz(b);
    if(pa!==pb) return pa-pb;
    return String(a.name||'').localeCompare(String(b.name||''),'de',{sensitivity:'base'});
  });
  const anyMail=members().filter(isAktiv).some(m=>m.email);
  const cards=active.map(memberCard).join('') || `<div class="muted">${_q?'Keine aktiven Treffer.':'Noch keine Mitglieder. Lege das erste an.'}</div>`;
  return `<div class="sec">
    <h2><span>👥 Mitglieder (${members().filter(isAktiv).length})</span>
      <span style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" title="Ämter-Bezeichnungen bearbeiten" onclick="GV.manageAemter()">⚙ Ämter</button>
        ${anyMail?`<button class="btn" title="Mail an alle aktiven (BCC)" onclick="GV.mailAlle()">✉️ Mail an alle</button>`:''}
        <button class="btn primary" onclick="GV.newMember()">＋ Mitglied</button>
      </span></h2>
    <div class="list">${cards}</div>
    ${left.length?`<details style="margin-top:14px"><summary style="cursor:pointer;color:var(--muted);font-size:13px;font-weight:600">🗂️ Ehemalige Mitglieder – ausgetreten/verstorben (${left.length})</summary><div class="list" style="margin-top:10px">${left.map(leftCard).join('')}</div></details>`:''}
  </div>
  ${freieGaertenHtml()}`;
}
function mailAlle(){
  const emails=members().filter(isAktiv).map(m=>m.email).filter(Boolean);
  if(!emails.length){ toast('Keine E-Mail-Adressen hinterlegt.','err'); return; }
  openMail(emails,'bcc');
}
// ── Freie Gärten: Parzellen, die (durch Austritt/Tod) frei geworden sind ──
function occupiedParz(){ const s={}; members().forEach(m=>{ if(isFormer(m)) return; (m.parzellen||[]).forEach(p=>{ if(p.nr && !p.bis) s[String(p.nr)]=m.name; }); }); return s; }
function lastHolder(nr){ let best=null; members().forEach(m=>(m.parzellen||[]).forEach(p=>{ if(String(p.nr)!==String(nr)) return; const key=String(p.bis||p.von||''); if(!best || key>best.key) best={name:m.name, bis:p.bis||'', key}; })); return best; }
function freieGaertenHtml(){
  const occ=occupiedParz();
  const universe=new Set(); members().forEach(m=>(m.parzellen||[]).forEach(p=>{ if(p.nr) universe.add(String(p.nr)); }));
  let free=[...universe].filter(nr=>!occ[nr]);
  free.sort((a,b)=>{ const na=parseInt(a,10), nb=parseInt(b,10); if(!isNaN(na)&&!isNaN(nb)&&na!==nb) return na-nb; return String(a).localeCompare(String(b),'de',{numeric:true}); });
  if(!free.length) return '';
  const items=free.map(nr=>{ const h=lastHolder(nr);
    return `<span class="chip" style="background:#fff4e5;border-color:#ffd9a0;color:#b56a00">🌳 ${esc(nr)}${h&&h.name?` – zuletzt ${esc(h.name)}`:''}${h&&h.bis?' (bis '+fmtDateShort(h.bis)+')':''}</span>`;
  }).join('');
  return `<div class="sec" style="margin-top:16px">
    <h2><span>🌳 Freie Gärten (${free.length})</span></h2>
    <div class="muted" style="margin-bottom:8px">Parzellen, die durch Austritt oder Tod frei geworden sind und aktuell niemandem zugeordnet sind.</div>
    <div class="links">${items}</div>
  </div>`;
}
function parzRowHtml(p){ p=p||{};
  return `<div class="parz-row">
    <input class="pz-nr" placeholder="Parzelle Nr." value="${esc(p.nr||'')}" data-von="${esc(p.von||'')}" data-bis="${esc(p.bis||'')}" style="flex:1;min-width:70px">
    <button type="button" class="x" title="Zeile entfernen" onclick="GV.delParz(this)">✕</button>
  </div>`;
}
// Datum automatisch: neue Parzelle bekommt das Eintrittsdatum als „von";
// bestehende behalten ihr Datum; „bis" wird bei Austritt/Tod automatisch gesetzt.
function readParz(eintritt){
  const def = eintritt || new Date().toISOString().slice(0,10);
  return Array.from(document.querySelectorAll('.pz-nr')).map(inp=>{
    const nr=(inp.value||'').trim(); if(!nr) return null;
    return { nr, von:(inp.getAttribute('data-von')||'')||def, bis:inp.getAttribute('data-bis')||'' };
  }).filter(Boolean).sort((a,b)=>String(a.von||'').localeCompare(String(b.von||'')));
}
const AEMTER=['1. Vorsitzende/r','2. Vorsitzende/r','Kassenwart/in','Schriftführer/in','Beisitzer/in','Gerätewart/in','Wertermittler/in','Vorstand'];
// Verwaltbare Ämter-Liste (in meta gespeichert, sonst Standard)
function aemterListe(){ const s=(_cache.meta&&_cache.meta.aemterListe)||''; const arr=String(s).split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean); return arr.length?arr:AEMTER; }
function manageAemter(){
  const cur=aemterListe().join('\n');
  const v=prompt('Ämter verwalten (ein Amt pro Zeile):', cur);
  if(v===null) return;
  saveMeta({aemterListe:String(v).trim()});
  const dl=$('amt-list'); if(dl) dl.innerHTML=aemterListe().map(a=>`<option value="${esc(a)}">`).join('');
  toast('Ämter-Liste gespeichert ✓','ok');
}
// Niedrigste AKTUELLE Parzellennummer (für Sortierung); ohne Parzelle = ganz unten
function minParz(m){ let min=Infinity; (m.parzellen||[]).forEach(p=>{ if(p.bis) return; const n=parseInt(p.nr,10); if(!isNaN(n)&&n<min) min=n; }); return min; }
function amtRowHtml(a){ a=a||{};
  return `<div class="amt-item">
    <div class="amt-row">
      <input class="am-amt" list="amt-list" placeholder="Amt" value="${esc(a.amt||'')}" oninput="GV.amtPrev(this)" style="flex:1.4;min-width:110px">
      <input class="am-von" type="date" value="${esc(a.von||'')}" title="von" style="flex:1">
      <input class="am-bis" type="date" value="${esc(a.bis||'')}" title="bis (leer = aktuell)" style="flex:1">
      <button type="button" class="x" title="Zeile entfernen" onclick="GV.delAmt(this)">✕</button>
    </div>
    <div class="am-prev">${amtHoldersText(a.amt)}</div>
  </div>`;
}
// Bisherige Inhaber eines Amtes (über alle Mitglieder, inkl. ehemaliger)
function amtHoldersList(amtName){
  if(!amtName) return [];
  const out=[];
  members().forEach(m=>(m.aemter||[]).forEach(a=>{ if(a.amt && String(a.amt).toLowerCase()===String(amtName).toLowerCase()) out.push({name:m.name||'?', von:a.von||'', bis:a.bis||''}); }));
  out.sort((a,b)=>String(a.von||'').localeCompare(String(b.von||'')));
  return out;
}
function amtHoldersText(amtName){
  const l=amtHoldersList(amtName);
  if(!String(amtName||'').trim()) return '';
  if(!l.length) return 'Dieses Amt hatte bisher niemand.';
  return '👥 Bisher: '+l.map(h=>esc(h.name)+' '+parzRange(h)).join(' · ');
}
function amtPrev(input){ const item=input.closest('.amt-item'); if(!item) return; const box=item.querySelector('.am-prev'); if(box) box.innerHTML=amtHoldersText(input.value.trim()); }
function readAemter(){
  return Array.from(document.querySelectorAll('.amt-row')).map(r=>({
    amt:(r.querySelector('.am-amt').value||'').trim(),
    von:r.querySelector('.am-von').value||'',
    bis:r.querySelector('.am-bis').value||''
  })).filter(a=>a.amt).sort((a,b)=>String(a.von||'').localeCompare(String(b.von||'')));
}
function currentAmt(m){ if(isFormer(m)) return ''; const as=Array.isArray(m.aemter)?m.aemter:[]; const open=as.filter(a=>!a.bis); return open.map(a=>a.amt).join(', '); }
// SEPA/Bankdaten als kopierbarer Block (für Überweisung/Lastschrift)
function sepaText(m){
  const L=[];
  L.push('Kontoinhaber: '+(m.kontoinhaber||m.name||''));
  if(m.iban) L.push('IBAN: '+m.iban);
  if(m.bic) L.push('BIC: '+m.bic);
  if(m.mandatsref) L.push('Mandatsreferenz: '+m.mandatsref+(m.mandatsdatum?(' vom '+fmtDateShort(m.mandatsdatum)):''));
  return L.join('\n');
}
function copySepa(id){ const m=_cache.mitglieder[id]; if(!m) return; if(!String(m.iban||'').trim()){ toast('Keine IBAN hinterlegt.','err'); return; } copyText(sepaText(m)); }
function copySepaForm(){
  const m={ name:val('m-name'), kontoinhaber:val('m-inhaber'), iban:val('m-iban'), bic:val('m-bic'), mandatsref:val('m-mref'), mandatsdatum:val('m-mdat') };
  if(!String(m.iban).trim()){ toast('Keine IBAN eingegeben.','err'); return; }
  copyText(sepaText(m));
}
function isFormer(m){ return m.status==='ausgetreten' || m.status==='verstorben'; }
function statusLabel(m){ return m.status==='verstorben' ? ('🕯️ verstorben'+(m.austrittsdatum?' am '+fmtDateShort(m.austrittsdatum):'')) : ('🚪 ausgetreten'+(m.austrittsdatum?' am '+fmtDateShort(m.austrittsdatum):'')); }
function currentParz(m){ if(isFormer(m)) return ''; const ps=Array.isArray(m.parzellen)?m.parzellen:[]; const open=ps.filter(p=>!p.bis); if(open.length) return open[open.length-1].nr; return ''; }
function fmtDateShort(s){ if(!s) return ''; const p=String(s).split('-'); return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:String(s); }
function parzRange(p){ return `(${fmtDateShort(p.von)||'?'} – ${p.bis?fmtDateShort(p.bis):'heute'})`; }
function isAktiv(m){ return !isFormer(m); }
// Austritt: persönliche Daten löschen, NUR Name + Parzellen-Verlauf behalten,
// offene Parzellen mit dem Austrittsdatum schließen, Adresse aus Verteilern entfernen.
function doArchive(id, status){
  const m=_cache.mitglieder[id]; if(!m) return;
  const istTod = status==='verstorben';
  const label = istTod ? 'Sterbedatum' : 'Austrittsdatum';
  const def=new Date().toISOString().slice(0,10);
  const datum=prompt(`${label} (JJJJ-MM-TT).\nAchtung: Alle persönlichen Daten (E-Mail, Telefon, Adresse, Bankdaten) werden gelöscht – nur Name, Parzellen- und Ämter-Verlauf bleiben erhalten.`, def);
  if(datum===null) return;
  const d=(String(datum).trim())||def;
  const oldMail=String(m.email||'').toLowerCase().trim();
  const parz=(Array.isArray(m.parzellen)?m.parzellen:[]).map(p=>({nr:p.nr, von:p.von||'', bis:p.bis||d}));
  const aem=(Array.isArray(m.aemter)?m.aemter:[]).map(a=>({amt:a.amt, von:a.von||'', bis:a.bis||d}));
  // Vollständig ersetzen → alle anderen Felder (Mail/Tel/Adresse/SEPA …) fallen weg
  saveMember({ id:m.id, name:m.name, status:(istTod?'verstorben':'ausgetreten'), austrittsdatum:d,
    eintrittsdatum:m.eintrittsdatum||'', parzellen:parz, aemter:aem, createdAt:m.createdAt||Date.now() });
  // Aus allen Verteilern entfernen
  if(oldMail){ lists().forEach(v=>{ const cur=normEmails(v.emails); if(cur.some(e=>e.toLowerCase()===oldMail)) saveListe(Object.assign({},v,{emails:cur.filter(e=>e.toLowerCase()!==oldMail)})); }); }
  closeModal(); render(); toast((istTod?'Als verstorben markiert':'Austritt eingetragen')+' – persönliche Daten gelöscht.','ok');
}
function memberForm(m){
  const ls=lists();
  const myMail=String(m.email||'').toLowerCase().trim();
  const vBlock = ls.length ? `<div class="field"><label>✉️ Zu Verteiler hinzufügen</label>
     <div class="pick">${ls.map(v=>{ const inIt=myMail && normEmails(v.emails).some(e=>e.toLowerCase()===myMail);
        return `<label><input type="checkbox" class="m-vt" value="${esc(v.id)}" ${inIt?'checked':''}> ${esc(v.name||'(ohne Name)')}</label>`; }).join('')}</div>
     <div class="muted" style="margin-top:4px">Wirkt nur mit hinterlegter E-Mail.</div></div>` : '';
  return `<h3>${m.id?'✎ Mitglied':'＋ Mitglied'}</h3>
   ${isFormer(m)?`<div style="background:#fdecea;border:1px solid #f0bcb6;border-radius:8px;padding:8px 10px;margin-bottom:12px;color:#c0392b;font-size:13px">${statusLabel(m)} – persönliche Daten wurden gelöscht. Name, Parzellen- &amp; Ämter-Verlauf bleiben erhalten.</div>`:''}
   <div class="field"><label>Name *</label><input id="m-name" value="${esc(m.name||'')}"></div>
   <div class="field"><label>Eintrittsdatum</label><input id="m-eintritt" type="date" value="${esc(m.eintrittsdatum||'')}"></div>
   <div class="field"><label>E-Mail</label><input id="m-email" type="email" value="${esc(m.email||'')}"></div>
   <div class="field"><label>Telefon</label><input id="m-tel" value="${esc(m.tel||'')}"></div>
   <div class="field"><label>Adresse</label><input id="m-adresse" value="${esc(m.adresse||'')}"></div>

   <div class="sec-head">🌳 Gartenparzellen (Verlauf)</div>
   <div id="m-parz">${(Array.isArray(m.parzellen)?m.parzellen:[]).map(parzRowHtml).join('')}</div>
   <button type="button" class="btn" onclick="GV.addParz()">＋ Parzelle</button>
   <div class="muted" style="margin-top:4px">Datum wird automatisch gesetzt: „von" = Eintrittsdatum, „bis" beim Austritt/Tod.</div>

   <div class="sec-head" style="display:flex;justify-content:space-between;align-items:center">🏅 Ämter (Verlauf) <button type="button" class="btn" style="padding:4px 10px;font-size:12px" onclick="GV.manageAemter()">⚙ Ämter verwalten</button></div>
   <datalist id="amt-list">${aemterListe().map(a=>`<option value="${esc(a)}">`).join('')}</datalist>
   <div id="m-amt">${(Array.isArray(m.aemter)?m.aemter:[]).map(amtRowHtml).join('')}</div>
   <button type="button" class="btn" onclick="GV.addAmt()">＋ Amt</button>
   <div class="muted" style="margin-top:4px">„bis" leer lassen = aktuelles Amt.</div>

   <div class="sec-head" style="display:flex;justify-content:space-between;align-items:center">🏦 SEPA-Lastschrift <button type="button" class="btn" style="padding:4px 10px;font-size:12px" onclick="GV.copySepaForm()">⧉ Bankdaten kopieren</button></div>
   <label class="ck"><input type="checkbox" id="m-sepa" ${m.sepaAktiv?'checked':''}> SEPA-Lastschriftmandat erteilt</label>
   <div class="field"><label>Kontoinhaber <span style="font-weight:400;text-transform:none">(falls abweichend)</span></label><input id="m-inhaber" value="${esc(m.kontoinhaber||'')}"></div>
   <div style="display:flex;gap:10px;flex-wrap:wrap">
     <div class="field" style="flex:2;min-width:180px"><label>IBAN</label><input id="m-iban" value="${esc(m.iban||'')}" placeholder="DE.." autocomplete="off"></div>
     <div class="field" style="flex:1;min-width:90px"><label>BIC</label><input id="m-bic" value="${esc(m.bic||'')}" autocomplete="off"></div>
   </div>
   <div style="display:flex;gap:10px;flex-wrap:wrap">
     <div class="field" style="flex:1;min-width:150px"><label>Mandatsreferenz</label><input id="m-mref" value="${esc(m.mandatsref||'')}"></div>
     <div class="field" style="flex:1;min-width:130px"><label>Mandat vom</label><input id="m-mdat" type="date" value="${esc(m.mandatsdatum||'')}"></div>
   </div>

   <div class="field"><label>Notiz</label><textarea id="m-note" rows="2">${esc(m.note||'')}</textarea></div>
   ${vBlock}
   <div class="actions-row">
   ${m.id?`<button class="btn danger" style="margin-right:auto" onclick="GV.askDelMember('${m.id}')">🗑 Löschen</button>`:''}
   ${(m.id && !isFormer(m))?`<button class="btn danger" onclick="GV.doArchive('${m.id}','ausgetreten')">🚪 Austritt</button><button class="btn danger" onclick="GV.doArchive('${m.id}','verstorben')">🕯️ Verstorben</button>`:''}
   <button class="btn" onclick="GV.close()">Abbrechen</button>
   <button class="btn primary" onclick="GV.saveMemberForm('${m.id||''}')">${m.id?'Speichern':'Anlegen'}</button></div>`;
}
function newMember(){ openModal(memberForm({}), true); }
function editMember(id){ const m=_cache.mitglieder[id]; if(m) openModal(memberForm(m), true); }
// Klick auf ein Mitglied → alle Infos (read-only), unten „Bearbeiten"
function openMember(id){ const m=_cache.mitglieder[id]; if(m) openModal(memberDetailHtml(m), true); }
function memberDetailHtml(m){
  const det=(label,inner)=>inner?`<div class="dt"><div class="dt-l">${label}</div><div class="dt-v">${inner}</div></div>`:'';
  const parz=(m.parzellen||[]).length?(m.parzellen||[]).map(p=>`<span class="chip${!p.bis?' cur':''}">🌳 ${esc(p.nr)} ${parzRange(p)}</span>`).join(' '):'';
  const aem=(m.aemter||[]).length?(m.aemter||[]).map(a=>`<span class="chip${!a.bis?' cur':''}">🏅 ${esc(a.amt)} ${parzRange(a)}</span>`).join(' '):'';
  const sepa = (m.sepaAktiv||m.iban) ? `${esc(m.kontoinhaber||m.name||'')}${m.iban?'<br>IBAN: '+esc(m.iban):''}${m.bic?'<br>BIC: '+esc(m.bic):''}${m.mandatsref?'<br>Mandat: '+esc(m.mandatsref)+(m.mandatsdatum?' vom '+fmtDateShort(m.mandatsdatum):''):''}${m.iban?`<br><button class="btn" style="margin-top:8px" onclick="GV.copySepa('${m.id}')">⧉ Bankdaten kopieren</button>`:''}` : '';
  return `<h3 style="margin-bottom:4px">${esc(m.name||'(ohne Name)')}</h3>
   ${isFormer(m)?`<div style="background:#fdecea;border:1px solid #f0bcb6;border-radius:8px;padding:6px 10px;margin-bottom:12px;color:#c0392b;font-size:13px">${statusLabel(m)}</div>`:'<div style="margin-bottom:14px"></div>'}
   ${det('Eintrittsdatum', m.eintrittsdatum?fmtDateShort(m.eintrittsdatum):'')}
   ${det('E-Mail', m.email?`<a href="${mailHref(m.email)}">${esc(m.email)}</a>`:'')}
   ${det('Telefon', m.tel?`<a href="${telHref(m.tel)}">${esc(m.tel)}</a>`:'')}
   ${det('Adresse', m.adresse?esc(m.adresse):'')}
   ${det('Notiz', m.note?esc(m.note):'')}
   ${det('🌳 Gartenparzellen (Verlauf)', parz)}
   ${det('🏅 Ämter (Verlauf)', aem)}
   ${det('🏦 SEPA-Lastschrift', sepa)}
   <div class="actions-row" style="margin-top:18px">
     <button class="btn" onclick="GV.close()">Schließen</button>
     <button class="btn primary" onclick="GV.editMember('${m.id}')">✎ Bearbeiten</button>
   </div>`;
}
function saveMemberForm(id){
  const name=val('m-name'); if(!name){ toast('Bitte einen Namen eingeben.','err'); return; }
  const email=val('m-email');
  const ex=id?_cache.mitglieder[id]:null;
  const eintritt=val('m-eintritt');
  const rec={ id:id||newId(), name, eintrittsdatum:eintritt,
    email, tel:val('m-tel'), adresse:val('m-adresse'), note:val('m-note'),
    parzellen:readParz(eintritt), aemter:readAemter(),
    sepaAktiv:!!($('m-sepa')&&$('m-sepa').checked),
    kontoinhaber:val('m-inhaber'), iban:val('m-iban'), bic:val('m-bic'),
    mandatsref:val('m-mref'), mandatsdatum:val('m-mdat'),
    createdAt:(ex&&ex.createdAt)||Date.now() };
  if(ex&&isFormer(ex)){ rec.status=ex.status; rec.austrittsdatum=ex.austrittsdatum||''; }
  // Verteiler-Mitgliedschaft (vor close lesen)
  const want=new Set(Array.from(document.querySelectorAll('.m-vt:checked')).map(x=>x.value));
  const allBoxes=Array.from(document.querySelectorAll('.m-vt')).map(x=>x.value);
  saveMember(rec);
  if(email && /@/.test(email)){
    allBoxes.forEach(vid=>{
      const v=_cache.verteiler[vid]; if(!v) return;
      const cur=normEmails(v.emails); const has=cur.some(e=>e.toLowerCase()===email.toLowerCase());
      if(want.has(vid) && !has){ saveListe(Object.assign({}, v, {emails:normEmails([...cur, email])})); }
      else if(!want.has(vid) && has){ saveListe(Object.assign({}, v, {emails:cur.filter(e=>e.toLowerCase()!==email.toLowerCase())})); }
    });
  }
  closeModal(); render(); toast('Mitglied gespeichert ✓','ok');
}
function askDelMember(id){ const m=_cache.mitglieder[id]; if(!m) return; if(!confirm(`Mitglied „${m.name||''}" endgültig löschen?`)) return; delMember(id); closeModal(); render(); toast('Gelöscht.',''); }

// ── Verteiler ──────────────────────────────────────────────────────
function viewVerteiler(){
  let arr=lists();
  if(_q) arr=arr.filter(v=>String(v.name||'').toLowerCase().includes(_q) || normEmails(v.emails).some(e=>e.toLowerCase().includes(_q)));
  const cards=arr.map(v=>{ const n=normEmails(v.emails).length;
    return `<div class="card">
      <h3>✉️ ${esc(v.name||'(ohne Name)')}</h3>
      <div class="sub">${n} Adresse${n===1?'':'n'}</div>
      <div class="actions">
        <button class="btn primary" onclick="GV.verteilerMail('${v.id}')">✉️ Mail (BCC)</button>
        <button class="btn" onclick="GV.verteilerCopy('${v.id}')">⧉ Kopieren</button>
        <button class="btn" onclick="GV.editListe('${v.id}')">Bearbeiten</button>
        <button class="x" title="Löschen" onclick="GV.askDelListe('${v.id}')">✕</button>
      </div>
    </div>`; }).join('') || `<div class="muted">${_q?'Keine Treffer.':'Noch keine Verteiler. Lege einen an und füge Adressen hinzu.'}</div>`;
  return `<div class="sec">
    <h2><span>✉️ E-Mail-Verteiler (${lists().length})</span><button class="btn primary" onclick="GV.newListe()">＋ Verteiler</button></h2>
    <div class="muted" style="margin-bottom:10px">„Mail (BCC)" öffnet dein Mailprogramm mit allen Adressen im BCC – die Empfänger sehen einander nicht.</div>
    <div class="list">${cards}</div>
  </div>`;
}
function listeForm(v){
  const withMail=members().filter(m=>m.email).sort((a,b)=>String(a.name).localeCompare(String(b.name),'de',{sensitivity:'base'}));
  const opts=['<option value="">– Mitglied hinzufügen –</option>'].concat(withMail.map(m=>`<option value="${esc(m.email)}">${esc(m.name)} (${esc(m.email)})</option>`)).join('');
  return `<h3>${v.id?'✎ Verteiler':'＋ Verteiler'}</h3>
   <div class="field"><label>Name *</label><input id="v-name" value="${esc(v.name||'')}" placeholder="z. B. Alle Mitglieder"></div>
   <div class="field"><label>E-Mail-Adressen <span style="font-weight:400;text-transform:none">(eine pro Zeile)</span></label><textarea id="v-emails" rows="8">${esc(normEmails(v.emails).join('\n'))}</textarea></div>
   <div class="field"><label>Mitglied übernehmen</label><select id="v-pick" onchange="GV.listeAddMember()">${opts}</select></div>
   <div class="actions-row"><button class="btn" onclick="GV.close()">Abbrechen</button>
   <button class="btn primary" onclick="GV.saveListeForm('${v.id||''}')">${v.id?'Speichern':'Anlegen'}</button></div>`;
}
function newListe(){ openModal(listeForm({})); }
function editListe(id){ const v=_cache.verteiler[id]; if(v) openModal(listeForm(v)); }
function listeAddMember(){
  const sel=$('v-pick'); const mail=sel?sel.value:''; if(sel) sel.value='';
  if(!mail) return;
  const ta=$('v-emails'); const before=normEmails([ta?ta.value:'']).length;
  const merged=normEmails([(ta?ta.value:''), mail]);
  if(ta) ta.value=merged.join('\n');
  toast(merged.length>before?'Mitglied übernommen ✓':'Adresse ist bereits in der Liste','ok');
}
function saveListeForm(id){
  const name=val('v-name'); if(!name){ toast('Bitte einen Namen eingeben.','err'); return; }
  const emails=normEmails([val('v-emails')]);
  const ex=id?_cache.verteiler[id]:null;
  saveListe({ id:id||newId(), name, emails, createdAt:(ex&&ex.createdAt)||Date.now() });
  closeModal(); render(); toast('Verteiler gespeichert ✓','ok');
}
function askDelListe(id){ const v=_cache.verteiler[id]; if(!v) return; if(!confirm(`Verteiler „${v.name||''}" löschen?`)) return; delListe(id); render(); toast('Gelöscht.',''); }
function verteilerMail(id){ const v=_cache.verteiler[id]; if(v) openMail(v.emails,'bcc'); }
function verteilerCopy(id){ const v=_cache.verteiler[id]; if(v) copyText(normEmails(v.emails).join('; ')); }

// ── Export für inline onclick ──────────────────────────────────────
window.GV = {
  logout, show, onSearch, close:closeModal,
  forgotPw, changePw:changePwModal, savePw, addUser:addUserModal, saveUser,
  newMember, editMember, openMember, saveMemberForm, askDelMember, mailAlle, doArchive,
  copySepa, copySepaForm, amtPrev, manageAemter,
  addParz:()=>$('m-parz').insertAdjacentHTML('beforeend', parzRowHtml({})),
  delParz:(btn)=>{ const r=btn.closest('.parz-row'); if(r) r.remove(); },
  addAmt:()=>$('m-amt').insertAdjacentHTML('beforeend', amtRowHtml({})),
  delAmt:(btn)=>{ const r=btn.closest('.amt-item'); if(r) r.remove(); },
  newListe, editListe, saveListeForm, askDelListe, listeAddMember, verteilerMail, verteilerCopy
};

// Modal-Hintergrund schließt bei Klick daneben
document.addEventListener('click', e=>{ if(e.target===$('modal-bg')) closeModal(); });
init();
})();
