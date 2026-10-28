// logica pura: dati, calcolo delle corse, formattazione (nessun accesso al DOM)
let S={}, COORD={}, LINES=[], AREAS=[], TRIPS=[];
function loadData(d){
  S=d.stops; COORD=d.coords||{}; LINES=d.lines; AREAS=d.areas;
  TRIPS=d.trips.map(([line,id,dir,flags,start,seq])=>{
    const stops=[],t=[];
    for(const p of seq.split(" ")){const [k,o]=p.split(":");stops.push(k);t.push(o===undefined?null:start+ +o)}
    return {line,id,dir,stops,t,weekOnly:flags.includes("F"),scol:flags.includes("S"),univ:flags.includes("U"),
      fest:flags.includes("D"),est:flags.includes("E")};
  });
  ESTLINES=new Set(TRIPS.filter(tr=>tr.est).map(tr=>tr.line));
}

// calendario scelto: giorno feriale/festivo, periodo universitario/estivo.
// Le corse festive valgono tutto l'anno; le linee senza orario estivo mantengono quello normale.
let CAL={fest:false,est:false}, ESTLINES=new Set();
const inCal=tr=>CAL.fest?tr.fest:!tr.fest&&(CAL.est&&ESTLINES.has(tr.line)?tr.est:!tr.est);
// festivi nazionali (fissi + Pasquetta)
function isHoliday(d){
  const md=(d.getMonth()+1)*100+d.getDate();
  if([101,106,425,501,602,815,1101,1208,1225,1226].includes(md)) return true;
  // Pasqua (algoritmo gregoriano anonimo), Pasquetta = giorno dopo
  const y=d.getFullYear(),a=y%19,b=Math.floor(y/100),c=y%100,dd=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
    h=(19*a+b-dd-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
    mon=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;
  const pq=new Date(y,mon-1,day+1);
  return d.getMonth()===pq.getMonth()&&d.getDate()===pq.getDate();
}
// distanza in metri (haversine)
function dist(a,b){const R=6371000,r=Math.PI/180,dLa=(b[0]-a[0])*r,dLo=(b[1]-a[1])*r;
  const h=Math.sin(dLa/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
const fmtD=m=>m<1000?Math.round(m/10)*10+" m":(m/1000).toFixed(1).replace(".",",")+" km";

const fmt=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const lastStop=tr=>{for(let k=tr.stops.length-1;k>=0;k--) if(tr.t[k]!=null) return k;return tr.stops.length-1};
const firstStop=tr=>tr.t.findIndex(x=>x!=null);

function legs(o,d,lines){
  const pool=TRIPS.filter(tr=>lines.includes(tr.line)&&inCal(tr));
  const res=[];
  for(const tr of pool){
    const i=tr.stops.indexOf(o), j=tr.stops.indexOf(d,i+1);
    if(i>=0&&j>i&&tr.t[i]!=null&&tr.t[j]!=null) res.push({dep:tr.t[i],arr:tr.t[j],line:tr.line,parts:[{tr,i,j}]});
  }
  if(res.length) return res;
  // nessuna corsa diretta: si resta a bordo / si riparte dal capolinea con la corsa successiva della stessa linea
  for(const tr of pool){
    const i=tr.stops.indexOf(o); if(i<0||tr.t[i]==null) continue;
    const endI=lastStop(tr); if(i>=endI) continue;
    const term=tr.stops[endI], tArr=tr.t[endI];
    let best=null;
    for(const x of pool){
      if(x.line!==tr.line||x.dir===tr.dir) continue;
      const p=x.stops.indexOf(term); if(p<0||x.t[p]==null||x.t[p]<tArr||x.t[p]-tArr>30) continue;
      const j=x.stops.indexOf(d,p+1); if(j<0||x.t[j]==null) continue;
      if(!best||x.t[p]<best.x.t[p]) best={x,p,j};
    }
    if(best) res.push({dep:tr.t[i],arr:best.x.t[best.j],line:tr.line,loop:true,wait:best.x.t[best.p]-tArr,
      parts:[{tr,i,j:endI},{tr:best.x,i:best.p,j:best.j}]});
  }
  return res;
}
// unisce corse identiche (stessa linea, stessi orari) che nei quadri compaiono con numeri diversi
function dedupe(res){
  const m=new Map();
  for(const r of res){
    const key=r.line+"|"+r.dep+"|"+r.arr+"|"+r.parts.map(p=>p.tr.stops.slice(p.i,p.j+1).join(",")).join("/");
    const ex=m.get(key);
    if(ex){ex.ids.push(r.parts[0].tr.id);ex.scol=ex.scol&&r.parts[0].tr.scol;ex.weekOnly=ex.weekOnly&&r.parts[0].tr.weekOnly}
    else m.set(key,Object.assign(r,{ids:[r.parts[0].tr.id],scol:r.parts.some(p=>p.tr.scol),weekOnly:r.parts.some(p=>p.tr.weekOnly),univ:r.parts.some(p=>p.tr.univ)}));
  }
  return [...m.values()];
}

function servedBy(lines){const s=new Set();for(const tr of TRIPS) if(lines.includes(tr.line)&&inCal(tr)) tr.stops.forEach((k,i)=>{if(tr.t[i]!=null)s.add(k)});return s}
