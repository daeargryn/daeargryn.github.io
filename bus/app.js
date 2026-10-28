const badge=(l,cls="sm")=>`<span class="lb ${cls}" data-l="${l}">${l}</span>`;

const $=id=>document.getElementById(id);
const fromSel=$("from"), toSel=$("to");
let saved={};
try{saved=JSON.parse(localStorage.getItem("l157")||"{}")}catch(e){}
let lineSel="all", fromVal=saved.f, toVal=saved.t;   // validati in start(), dopo il caricamento dei dati
$("hidePast").checked=!!saved.h;
$("useLoc").checked=saved.u!==false;      // posizione attiva per default, disattivabile
$("sortDist").checked=!!saved.sd;
const activeLines=()=>lineSel==="all"?LINES:[lineSel];
const C=k=>COORD[k]||null;

/* ---------- posizione ---------- */
let pos=null, watchId=null, locErr="", autoPicked=false, userPickedFrom=false;
const posFresh=()=>pos&&Date.now()-pos.ts<90000;
const dFromMe=k=>{const c=C(k);return pos&&c?dist([pos.lat,pos.lon],c):null};
function startLoc(){
  locErr="";
  if(!("geolocation" in navigator)){locErr="Questo browser non fornisce la posizione.";$("useLoc").checked=false;afterLoc();return}
  if(watchId!=null) return;
  watchId=navigator.geolocation.watchPosition(p=>{
    pos={lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,ts:Date.now()};locErr="";afterLoc();
  },e=>{
    locErr=e.code===1?"Permesso negato: la posizione non è consentita per questa pagina.":"Posizione non disponibile al momento.";
    if(e.code===1){stopLoc();$("useLoc").checked=false;saveState()}
    afterLoc();
  },{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
}
function stopLoc(){if(watchId!=null) navigator.geolocation.clearWatch(watchId);watchId=null;pos=null}
function nearestValid(){
  let best=null;
  for(const o of fromSel.options){if(!o.value) continue;const d=dFromMe(o.value);if(d!=null&&(!best||d<best.d)) best={k:o.value,d}}
  return best;
}
let selOpen=false;
for(const s of [fromSel,toSel]){
  s.addEventListener("focus",()=>{selOpen=true});
  s.addEventListener("pointerdown",()=>{selOpen=true});
  s.addEventListener("blur",()=>{selOpen=false;if($("useLoc").checked&&pos) refreshSelects()});
  s.addEventListener("change",()=>{selOpen=false});
}
function mapsUrl(k){
  const c=C(k);
  return "https://www.google.com/maps/search/?api=1&query="+(c?c[0]+","+c[1]:encodeURIComponent(S[k][0]+", "+S[k][1].split(" · ")[0]+", Italia"));
}
function updateMaps(){
  for(const [id,k] of [["fromMap",fromVal],["toMap",toVal]]){
    const a=$(id); a.setAttribute("aria-disabled",String(!k)); if(k) a.href=mapsUrl(k); else a.removeAttribute("href");
  }
}
function afterLoc(){
  const on=$("useLoc").checked;
  $("sortDist").disabled=!on; $("sortLbl").classList.toggle("dis",!on);
  // prima opzione: alla prima posizione valida imposta la partenza sulla fermata utile più vicina
  if(on&&pos&&!autoPicked&&!userPickedFrom&&!selOpen){
    const n=nearestValid(); autoPicked=true;
    if(n&&n.k!==fromVal){fromVal=n.k;refreshSelects();render()}
  }
  if(on&&pos&&!selOpen) refreshSelects();
  renderLoc(); renderRide();
}
function renderLoc(){
  const box=$("loc"), on=$("useLoc").checked;
  box.classList.toggle("err",!!locErr);
  if(locErr){box.hidden=false;box.textContent=locErr;return}
  if(!on){box.hidden=true;return}
  box.hidden=false;
  if(!pos){box.textContent="Ricerca della posizione…";return}
  const n=nearestValid();
  if(!n){box.textContent="Nessuna fermata utile con coordinate note vicino a te.";return}
  box.innerHTML=`<span>Fermata utile più vicina: <b>${S[n.k][0]}</b> · ${fmtD(n.d)}${pos.acc>100?` (precisione ±${fmtD(pos.acc)})`:""}</span>`+
    (n.k!==fromVal?`<button type="button" id="useNear">Parti da qui</button>`:"");
  const b=$("useNear"); if(b) b.onclick=()=>{fromVal=n.k;userPickedFrom=true;refreshSelects();render();renderLoc()};
}


const showDist=()=>$("useLoc").checked&&!!pos;
const dLbl=k=>{const d=showDist()?dFromMe(k):null;return S[k][0]+(d!=null?" ("+fmtD(d)+")":"")};
function fillSelect(sel,allowed,value,placeholder,byDist){
  const keep=sel.cloneNode(false);
  const old=sel; sel=keep;
  if(placeholder){const o=new Option(placeholder,"");o.disabled=true;sel.appendChild(o)}
  if(byDist){
    const g=document.createElement("optgroup");g.label="Per distanza da te";
    allowed.map(k=>[k,dFromMe(k)]).sort((a,b)=>(a[1]??1e9)-(b[1]??1e9)||S[a[0]][0].localeCompare(S[b[0]][0],"it"))
      .forEach(([k,d])=>g.appendChild(new Option(dLbl(k),k)));
    sel.appendChild(g);
  }else{
    const groups={};
    for(const k of allowed){const [n,a]=S[k];(groups[a]=groups[a]||[]).push([k,n])}
    for(const a of AREAS){
      if(!groups[a]) continue;
      const g=document.createElement("optgroup");g.label=a;
      groups[a].sort((x,y)=>x[1].localeCompare(y[1],"it")).forEach(([k])=>g.appendChild(new Option(dLbl(k),k)));
      sel.appendChild(g);
    }
  }
  sel.value=allowed.includes(value)?value:"";
  // non ricostruire se nulla è cambiato: evita di chiudere la tendina aperta
  if(old.innerHTML!==sel.innerHTML) old.innerHTML=sel.innerHTML;
  old.value=sel.value;
}

function renderChips(){
  const box=$("chips");box.innerHTML="";
  const opts=[["all","Tutte"],...LINES.map(l=>[l,l])];
  for(const [v,label] of opts){
    const b=document.createElement("button");b.type="button";b.className="chip";b.setAttribute("role","radio");
    b.setAttribute("aria-checked",String(v===lineSel));
    b.innerHTML=v==="all"?`${label}`:`${badge(v)}<span class="n" data-n="${v}"></span>`;
    if(v!=="all") b.setAttribute("aria-label","Linea "+v);
    b.dataset.v=v;
    b.addEventListener("click",()=>{lineSel=v;renderChips();refresh()});
    box.appendChild(b);
  }
}

function refreshSelects(){
  const lines=activeLines();
  const served=[...servedBy(lines)];
  if(!served.includes(toVal)) toVal=served.includes("volta")?"volta":served[0];
  fillSelect(toSel,served,toVal);
  // partenze valide: solo le fermate da cui almeno una corsa porta all'arrivo scelto
  const valid=served.filter(k=>k!==toVal&&legs(k,toVal,lines).length);
  const byDist=$("useLoc").checked&&$("sortDist").checked&&!!pos;
  fillSelect(fromSel,valid,fromVal,valid.length?"Scegli la partenza":"Nessuna partenza utile",byDist);
  $("fromHint").textContent=`· ${valid.length} con corse per l'arrivo scelto`;
  if(!valid.includes(fromVal)) fromVal="";
  updateMaps();
}

function nowInfo(){const d=new Date();return{min:d.getHours()*60+d.getMinutes(),dow:d.getDay(),sec:d.getHours()*3600+d.getMinutes()*60+d.getSeconds()}}

function stopRow(tr,k,i,j,cls){
  const id=tr.stops[k], t=tr.t[k], st=S[id];
  const inR=k>=i&&k<=j, end=k===i||k===j;
  const c=["stop",inR?"in":"",end?"end":"",t==null?"skip":"",cls||""].join(" ");
  return `<div class="${c}"><span class="t">${t==null?"—":fmt(t)}</span><span class="dot"></span><span><span class="nm">${st[0]}</span>${st[2]?'<span class="req">a richiesta</span>':""}${t==null?'<span class="req">senza sosta</span>':""}</span></div>`;
}
function routeHTML(r){
  let h="";
  r.parts.forEach((p,pi)=>{
    const tr=p.tr, a=firstStop(tr), b=lastStop(tr);
    if(pi>0){
      h+=`<div class="sep">Capolinea ${S[tr.stops[p.i]][0]} · ${tr.line==="157"?"il bus prosegue":"riparti"} con la corsa ${tr.id}${r.wait?` · attesa ${r.wait} min`:""}</div>`;
    }
    h+=`<div class="seg" data-l="${tr.line}"><div class="rhead">${badge(tr.line)}<span><b>Linea ${tr.line}</b> · corsa ${pi===0?r.ids.join(" / "):tr.id} · ${S[tr.stops[a]][0]} → ${S[tr.stops[b]][0]}</span></div>`;
    const n=tr.stops.length;
    for(let k=0;k<n;k++) h+=stopRow(tr,k,p.i,p.j,(k===0?"first ":"")+(k===n-1?"last":""));
    h+=`</div>`;
  });
  return h;
}

/* ---------- corsa in corso: prossima fermata ---------- */
let ride=null; // {r, seq:[{k,t,line,id}], cur, at}
const rideKey=r=>[r.line,r.parts.map(p=>p.tr.id+"@"+p.i+"-"+p.j).join("+")].join("|");
function startRide(r){
  const seq=[];
  r.parts.forEach((p,pi)=>{for(let k=p.i;k<=p.j;k++){if(pi>0&&k===p.i) continue;if(p.tr.t[k]==null) continue;seq.push({k:p.tr.stops[k],t:p.tr.t[k],line:p.tr.line,id:p.tr.id})}});
  ride={r,seq,cur:0,at:-1,src:"orario"};
  try{localStorage.setItem("l157ride",JSON.stringify({key:rideKey(r),day:new Date().toDateString(),o:fromVal,d:toVal,line:r.line}))}catch(e){}
  renderRide(); window.scrollTo({top:0,behavior:"smooth"});
}
function endRide(){ride=null;try{localStorage.removeItem("l157ride")}catch(e){}renderRide()}
function updateRide(){
  if(!ride) return;
  const seq=ride.seq, n=seq.length, {sec}=nowInfo(), nowM=sec/60;
  const gps=$("useLoc").checked&&posFresh()&&pos.acc<=150&&seq.every(s=>C(s.k));
  if(gps){
    // fermate candidate: da quella appena passata in avanti, senza saltare troppo (evita i giri che ripassano negli stessi punti)
    const me=[pos.lat,pos.lon], lo=Math.max(0,ride.cur-1), hi=Math.min(n-1,ride.cur+6);
    let bi=lo,bd=Infinity;
    for(let x=lo;x<=hi;x++){const d=dist(me,C(seq[x].k));if(d<bd){bd=d;bi=x}}
    let next,at=-1;
    if(bd<=60){at=bi;next=bi+1}
    else if(bi<n-1&&dist(me,C(seq[bi+1].k))<dist(C(seq[bi].k),C(seq[bi+1].k))) next=bi+1; // già oltre bi, verso bi+1
    else next=bi;
    ride.cur=Math.max(ride.cur,Math.min(next,n)); ride.at=at; ride.src="gps"; ride.dist=bd;
  }else{
    let next=seq.findIndex(s=>s.t>nowM); if(next<0) next=n;
    const atI=seq.findIndex(s=>Math.abs(s.t-nowM)<0.75);
    ride.cur=next; ride.at=atI; ride.src="orario";
  }
}
function renderRide(){
  const box=$("ride");
  if(!ride){box.hidden=true;box.innerHTML="";return}
  updateRide();
  const {seq,cur,r}=ride, n=seq.length, {sec}=nowInfo(), nowM=sec/60;
  const dest=seq[n-1], next=seq[cur];
  let head;
  if(cur>=n) head=`<div class="ride-next"><span class="lbl">Arrivato</span><span class="nm">${S[dest.k][0]}</span><span class="sub2">Corsa conclusa.</span></div>`;
  else{
    const left=n-1-cur, eta=Math.round(next.t-nowM);
    const before=nowM<seq[0].t;
    head=`<div class="ride-next"><span class="lbl">${ride.at>=0&&ride.at<n?`Fermo a ${S[seq[ride.at].k][0]} · `:""}${before&&cur===0?"Partenza da":"Prossima fermata"}</span>
      <span class="nm">${S[next.k][0]}</span>
      <span class="sub2">Prevista alle <b>${fmt(next.t)}</b>${eta>0?` · tra ${eta} min`:eta<0?` · in ritardo di ${-eta} min sull'orario`:""}${S[next.k][2]?" · a richiesta: prenota la fermata":""}</span>
      <span class="sub2">${cur===n-1?"<b>Scendi alla prossima</b>":`Scendi a <b>${S[dest.k][0]}</b> tra ${left} fermate`} · arrivo ${fmt(dest.t)}</span></div>`;
  }
  const src=ride.src==="gps"?`In base alla tua posizione (±${fmtD(pos.acc)}).`:
    ($("useLoc").checked?"In base all'orario: posizione non ancora disponibile o coordinate mancanti.":"In base all'orario (posizione disattivata).");
  let tl="";
  seq.forEach((s,x)=>{
    const st=S[s.k], cls=["stop","in",x===0||x===n-1?"end":"",x<cur?"past":"",x===cur?"nx":"",x===0?"first":"",x===n-1?"last":""].join(" ");
    if(x>0&&s.id!==seq[x-1].id) tl+=`<div class="sep">Capolinea · corsa ${s.id}</div>`;
    tl+=`<div class="${cls}"><span class="t">${fmt(s.t)}</span><span class="dot"></span><span><span class="nm">${st[0]}</span>${st[2]?'<span class="req">a richiesta</span>':""}${x===cur?'<span class="here">prossima</span>':""}</span></div>`;
  });
  const wasOpen=!!box.querySelector("details[open]");
  box.innerHTML=`<div class="ride-top"><span class="ttl">In viaggio · ${badge(r.line)} corsa ${r.ids.join(" / ")}</span><button type="button" id="endRide">Termina</button></div>
    ${head}<div class="ride-src">${src}</div>
    <details${wasOpen?" open":""}><summary>Percorso con fermate passate</summary><div class="seg" data-l="${r.line}" style="padding-top:8px">${tl}</div></details>`;
  box.hidden=false;
  $("endRide").onclick=endRide;
}
setInterval(()=>{if(ride) renderRide()},20000);

function saveState(){try{localStorage.setItem("l157",JSON.stringify({f:fromVal,t:toVal,h:$("hidePast").checked,l:lineSel,u:$("useLoc").checked,sd:$("sortDist").checked}))}catch(e){}}

function render(){
  const lines=activeLines(), o=fromVal, d=toVal, hide=$("hidePast").checked;
  saveState();
  const list=$("list"),notice=$("notice");list.innerHTML="";
  const {min,dow}=nowInfo(), sunday=dow===0, saturday=dow===6;
  notice.hidden=!sunday; if(sunday) notice.textContent="Oggi è domenica: queste linee non effettuano servizio. Gli orari valgono da lunedì a sabato.";
  document.querySelectorAll("[data-n]").forEach(el=>{const l=el.dataset.n;el.textContent=o&&d?String(dedupe(legs(o,d,[l])).length):""});
  if(!o){$("count").textContent="";list.innerHTML=`<p class="empty">Scegli una fermata di partenza: l'elenco mostra solo quelle con corse per ${S[d][0]}.</p>`;return}
  let res=dedupe(legs(o,d,lines)).sort((a,b)=>a.dep-b.dep||a.line.localeCompare(b.line));
  const runs=r=>!(saturday&&r.weekOnly);
  const nextIdx=sunday?-1:res.findIndex(r=>r.dep>=min&&runs(r));
  const shown=res.map((r,idx)=>({r,idx})).filter(x=>!(hide&&!sunday&&(x.r.dep<min||!runs(x.r))));
  $("count").textContent=res.length?`${res.length} corse · ${shown.length} mostrate`:"";
  if(!shown.length){list.innerHTML=`<p class="empty">${res.length?"Nessuna altra corsa oggi tra queste fermate.":"Nessuna corsa collega queste due fermate con le linee scelte."}</p>`;return}
  for(const {r,idx} of shown){
    const div=document.createElement("div");
    const past=!sunday&&r.dep<min, off=!runs(r), isNext=idx===nextIdx;
    div.className="trip"+(past?" past":"")+(off?" off":"")+(isNext?" next":"");
    div.dataset.l=r.line;
    const dur=r.arr-r.dep, lastTr=r.parts[r.parts.length-1].tr;
    const tags=[];
    if(isNext) tags.push('<span class="tag sig">Prossima</span>');
    if(ride&&rideKey(ride.r)===rideKey(r)) tags.push('<span class="tag sig">In viaggio</span>');
    if(r.loop) tags.push(`<span class="tag">${r.line==="157"?"Passa dal capolinea":"Cambio al capolinea"}</span>`);
    if(r.weekOnly) tags.push('<span class="tag warn">Solo lun–ven</span>');
    if(r.scol) tags.push('<span class="tag warn">Solo periodo scolastico</span>');
    if(r.univ) tags.push('<span class="tag warn">Periodo universitario</span>');
    div.innerHTML=`<button class="row" type="button" aria-expanded="false">
      <span class="times"><span>${fmt(r.dep)}</span><span aria-hidden="true">→</span><span class="arr">${fmt(r.arr)}</span></span>
      ${badge(r.line)}
      <span class="meta"><b>${dur} min</b> · verso ${S[lastTr.stops[lastStop(lastTr)]][0]} · corsa ${r.ids.join(" / ")}</span>
      <span class="chev" aria-hidden="true">›</span>
      ${tags.length?`<span class="tags">${tags.join("")}</span>`:""}
    </button><div class="route" hidden><button type="button" class="ride-btn">Sono su questa corsa · segna la prossima fermata</button>${routeHTML(r)}</div>`;
    const btn=div.querySelector(".row"),rt=div.querySelector(".route");
    btn.setAttribute("aria-label",`Linea ${r.line}, ${fmt(r.dep)} arrivo ${fmt(r.arr)}, ${dur} minuti`);
    btn.addEventListener("click",()=>{const open=rt.hidden;rt.hidden=!open;div.classList.toggle("open",open);btn.setAttribute("aria-expanded",open)});
    div.querySelector(".ride-btn").addEventListener("click",()=>{startRide(r);render()});
    list.appendChild(div);
  }
}
function refresh(){refreshSelects();render()}
fromSel.addEventListener("change",()=>{fromVal=fromSel.value;userPickedFrom=true;updateMaps();render();renderLoc()});
toSel.addEventListener("change",()=>{toVal=toSel.value;refresh();renderLoc()});
$("hidePast").addEventListener("change",render);
$("useLoc").addEventListener("change",()=>{
  if($("useLoc").checked){autoPicked=false;userPickedFrom=false;startLoc()} else {stopLoc();locErr=""}
  refreshSelects();render();afterLoc();
});
$("sortDist").addEventListener("change",()=>{refreshSelects();render()});
$("swap").addEventListener("click",()=>{
  if(!fromVal) return;
  const a=fromVal;fromVal=toVal;toVal=a;userPickedFrom=true;refresh();renderLoc();
});

function start(){
  lineSel=LINES.includes(saved.l)?saved.l:"all";
  if(!S[fromVal]) fromVal="aut"; if(!S[toVal]) toVal="volta";
  renderChips();refresh();
  // ripristina la corsa in corso (stesso giorno)
  try{const rs=JSON.parse(localStorage.getItem("l157ride")||"null");
    if(rs&&rs.day===new Date().toDateString()){const r=dedupe(legs(rs.o,rs.d,[rs.line])).find(x=>rideKey(x)===rs.key);if(r){ride=null;startRide(r);render()}}}catch(e){}
  if($("useLoc").checked) startLoc();
  afterLoc();
}
fetch("data.json").then(r=>{if(!r.ok) throw new Error(r.status);return r.json()})
  .then(d=>{loadData(d);start()})
  .catch(e=>{$("list").innerHTML=`<p class="empty">Impossibile caricare gli orari (${e.message}). Riprova più tardi.</p>`});
