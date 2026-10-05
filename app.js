/* =========================================================
   Dashboard de servicios industriales
   Servicios generales: rondas simuladas 07:00, 11:00 y 16:00
   PTAR: datos reales del archivo local, histórico completo por variable, turnos 07:00 y 19:00
   VAPOR: datos reales del archivo local de calderas, histórico completo por variable, turnos 07:00 y 19:00
   SUAVIZADORES/TANQUES: datos reales del archivo local, ambos turnos impresos a las 06:00
   ========================================================= */
'use strict';

const C = {agua:'#1B8A5A', suav:'#2A7A68', vapor:'#C0451B', aire:'#1E63C8', nh3:'#B8860B', ptar:'#456B6B',
           ink:'#131A20', ok:'#1B8A5A', warn:'#C08307', crit:'#C0392B', line:'#E4E8EC', ink3:'#8B959E'};

/* ---------------------------------------------------------
   1. Rondas de lectura
   --------------------------------------------------------- */
const RONDAS = [
  {hora:'07:00', turno:'Turno A', desde:'03:00', n:17, etiq:'Arranque de líneas'},
  {hora:'11:00', turno:'Turno A', desde:'07:00', n:17, etiq:'Producción plena'},
  {hora:'16:00', turno:'Turno B', desde:'11:00', n:21, etiq:'Producción y CIP'},
];
let ronda = 1;                 // ronda mostrada (0, 1, 2)

/* ---------------------------------------------------------
   2. Variables de proceso
   dir: 'high' malo si sube · 'low' malo si baja · 'band' debe estar en rango
   sfac: factor de carga por ronda (arranque, plena, tarde)
   --------------------------------------------------------- */
const V = {
  /* --- PTAB · agua suave --- */
  'ptab.dureza':   {lbl:'Dureza del agua tratada', u:'ppm', dec:1, base:8.4, amp:2.2, nz:.5, dir:'high', warn:14, crit:17, floor:0, ceil:30, sfac:[.72,1,1.14]},
  'ptab.caudal':   {lbl:'Caudal a red', u:'m³/h', dec:1, base:41, amp:8, nz:2, dir:'band', lo:25, hi:60, m:8, floor:0, ceil:80, sfac:[.68,1,1.12]},
  'ptab.presion':  {lbl:'Presión de red', u:'bar', dec:2, base:3.6, amp:.22, nz:.06, dir:'low', warn:3.2, crit:2.8, floor:0, ceil:6},
  'ptab.nivel':    {lbl:'Nivel de cisterna', u:'%', dec:0, base:74, amp:11, nz:1.3, dir:'low', warn:45, crit:30, floor:0, ceil:100, sfac:[1.18,1,.82]},
  'ptab.cloro':    {lbl:'Cloro residual', u:'mg/L', dec:2, base:.62, amp:.14, nz:.04, dir:'band', lo:.4, hi:1.0, m:.25, floor:0, ceil:2},
  'ptab.conduct':  {lbl:'Conductividad', u:'µS/cm', dec:0, base:392, amp:44, nz:11, dir:'high', warn:520, crit:600, floor:150, ceil:800, sfac:[.9,1,1.08]},

  /* --- Vapor --- */
  'vapor.presion': {lbl:'Presión de caldera', u:'bar', dec:2, base:8.5, amp:.5, nz:.11, dir:'band', lo:7.5, hi:9.5, m:.6, floor:0, ceil:12, sfac:[.94,1,1.02]},
  'vapor.temp':    {lbl:'Temperatura de vapor', u:'°C', dec:1, base:178, amp:4.5, nz:1.1, dir:'band', lo:168, hi:188, m:8, floor:100, ceil:220},
  'vapor.gen':     {lbl:'Generación de vapor', u:'kg/h', dec:0, base:4150, amp:750, nz:160, dir:'band', lo:1500, hi:6000, m:600, floor:0, ceil:7500, sfac:[.62,1,1.16]},
  'vapor.efi':     {lbl:'Eficiencia de caldera', u:'%', dec:1, base:84.5, amp:2.6, nz:.6, dir:'low', warn:80, crit:76, floor:60, ceil:95, sfac:[.96,1,1.01]},
  'vapor.gas':     {lbl:'Consumo de gas natural', u:'m³/h', dec:0, base:312, amp:60, nz:14, dir:'high', warn:420, crit:470, floor:0, ceil:600, sfac:[.66,1,1.15]},
  'vapor.cond':    {lbl:'Retorno de condensado', u:'%', dec:1, base:68, amp:6, nz:1.4, dir:'low', warn:60, crit:52, floor:0, ceil:100},
  'vapor.tds':     {lbl:'TDS en caldera', u:'ppm', dec:0, base:2450, amp:380, nz:85, dir:'high', warn:3000, crit:3500, floor:800, ceil:4500, sfac:[.86,1,1.1]},

  /* --- Aire comprimido --- */
  'aire.presion':  {lbl:'Presión de red', u:'bar', dec:2, base:6.8, amp:.26, nz:.07, dir:'low', warn:6.2, crit:5.8, floor:0, ceil:10, sfac:[1.04,1,.97]},
  'aire.caudal':   {lbl:'Caudal entregado', u:'Nm³/min', dec:1, base:32, amp:6, nz:1.5, dir:'band', lo:15, hi:44, m:5, floor:0, ceil:55, sfac:[.6,1,1.13]},
  'aire.rocio':    {lbl:'Punto de rocío', u:'°C', dec:1, base:2.6, amp:1.4, nz:.45, dir:'high', warn:6, crit:9, floor:-20, ceil:15},
  'aire.kw':       {lbl:'Potencia consumida', u:'kW', dec:0, base:218, amp:36, nz:8, dir:'high', warn:300, crit:340, floor:0, ceil:400, sfac:[.62,1,1.14]},
  'aire.esp':      {lbl:'Consumo específico', u:'kWh/Nm³', dec:3, base:.113, amp:.012, nz:.003, dir:'high', warn:.135, crit:.15, floor:.05, ceil:.25, sfac:[1.06,1,1.02]},
  'aire.tdesc':    {lbl:'Temperatura de descarga', u:'°C', dec:1, base:78, amp:6, nz:1.5, dir:'high', warn:95, crit:105, floor:30, ceil:130, sfac:[.86,1,1.09]},
  'aire.carga':    {lbl:'Carga de compresores', u:'%', dec:0, base:73, amp:12, nz:2.8, dir:'high', warn:92, crit:97, floor:0, ceil:100, sfac:[.6,1,1.15]},
  'aire.fugas':    {lbl:'Fugas estimadas', u:'%', dec:1, base:14, amp:3, nz:.8, dir:'high', warn:18, crit:24, floor:0, ceil:40, sfac:[1.25,1,.98]},

  /* --- Refrigeración y amoníaco --- */
  'frio.tsum':     {lbl:'Agua helada · suministro', u:'°C', dec:2, base:1.8, amp:.6, nz:.16, dir:'high', warn:3.5, crit:4.5, floor:-2, ceil:10, sfac:[.85,1,1.22]},
  'frio.tret':     {lbl:'Agua helada · retorno', u:'°C', dec:2, base:7.4, amp:.9, nz:.22, dir:'high', warn:10, crit:12, floor:0, ceil:16, sfac:[.88,1,1.12]},
  'frio.psuc':     {lbl:'Presión de succión', u:'bar', dec:2, base:2.55, amp:.26, nz:.07, dir:'band', lo:2.0, hi:3.2, m:.5, floor:0, ceil:6},
  'frio.pdes':     {lbl:'Presión de descarga', u:'bar', dec:2, base:11.5, amp:.8, nz:.18, dir:'high', warn:13.5, crit:14.5, floor:6, ceil:18, sfac:[.92,1,1.07]},
  'frio.carga':    {lbl:'Carga térmica', u:'TR', dec:0, base:298, amp:52, nz:12, dir:'high', warn:400, crit:440, floor:0, ceil:480, sfac:[.7,1,1.18]},
  'frio.cop':      {lbl:'COP del sistema', u:'', dec:2, base:3.42, amp:.3, nz:.07, dir:'low', warn:2.9, crit:2.6, floor:1.5, ceil:5, sfac:[1.06,1,.94]},
  'frio.nivel':    {lbl:'Nivel en recibidor NH₃', u:'%', dec:0, base:68, amp:8, nz:1.4, dir:'low', warn:45, crit:32, floor:0, ceil:100},
  'frio.nh3':      {lbl:'NH₃ máximo detectado', u:'ppm', dec:1, base:2.2, amp:1.2, nz:.5, dir:'high', warn:25, crit:35, floor:0, ceil:200},

};

const SERVICIOS = {
  resumen:{nom:'Resumen de planta', sub:'Lectura consolidada de los servicios de planta', keys:[]},
  inventario:{nom:'Inventario Quimico', sub:'Productos químicos de Servicios a Planta · disponibilidad y stock de seguridad', color:'#B42318', corto:'Inventario Quimico', kpi:null, keys:[]},
  ptab:{nom:'PTAB · Aguas Blancas', sub:'Planta de tratamiento de aguas blancas · agua cruda y agua filtrada',
        color:C.agua, corto:'PTAB · Aguas Blancas', kpi:null, keys:[]},
  suav:{nom:'Suavizadores y tanques de agua', sub:'Agua suave de servicios y procesos · control operacional por equipo',
        color:C.suav, corto:'Suavizadores y tanques', kpi:null, keys:[]},
  vapor:{nom:'Vapor', sub:'Sistema de generación de vapor · alimentación y control operacional de calderas',
        color:C.vapor, corto:'Vapor', kpi:null, keys:[]},
  aire:{nom:'Compresores de aire', sub:'Compresores y trampas de aire · histórico de reportes operacionales',
        color:C.aire, corto:'Compresores de aire', kpi:null, keys:[]},
  frio:{nom:'Refrigeración y amoníaco', sub:'Compresores NH₃, banco de hielo, cavas, condensadores y servicios de refrigeración',
        color:C.nh3, corto:'Refrigeración · NH₃', kpi:null, keys:[]},
  ptar:{nom:'PTAR', sub:'Planta de tratamiento de aguas residuales · control operacional por procesos',
        color:C.ptar, corto:'PTAR', kpi:null, keys:[]},
};

const KPI_TABS = {
  ptab:['ptab.dureza','ptab.caudal','ptab.presion','ptab.nivel','ptab.cloro','ptab.conduct'],
  suav:[],
  vapor:[],
  aire:[],
  frio:[],
  ptar:[],
};

/* ---------------------------------------------------------
   3. Generación de los registros de cada ronda
   Semilla fija: las lecturas no cambian al recargar.
   --------------------------------------------------------- */
function rng(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
const clamp = (x,v) => Math.max(v.floor, Math.min(v.ceil, x));

const HORAS = [];   // marcas de tiempo por ronda
const DATA = [];    // DATA[ronda][clave] = arreglo de lecturas

RONDAS.forEach((R, s) => {
  const [h0, m0] = R.desde.split(':').map(Number);
  HORAS[s] = Array.from({length:R.n}, (_,i)=>{
    const t = h0*60 + m0 + i*15;
    return String(Math.floor(t/60)).padStart(2,'0') + ':' + String(t%60).padStart(2,'0');
  });
  DATA[s] = {};
  for(const k in V){
    const v = V[k], r = rng(hash(k) + s*7919);
    const f = v.sfac ? v.sfac[s] : 1;
    const base = v.base * f, ph = r()*Math.PI*2, per = 9 + r()*7;
    let drift = 0, arr = [];
    for(let i=0;i<R.n;i++){
      drift += (r()-.5) * v.nz * .8;
      drift = Math.max(-v.amp*.7, Math.min(v.amp*.7, drift));
      arr.push(clamp(base + v.amp*.45*Math.sin(ph + i/per*Math.PI*2) + drift + (r()-.5)*v.nz, v));
    }
    DATA[s][k] = arr;
  }
});

/* Eventos sembrados: así cada ronda cuenta algo distinto */
function llevar(s, k, destino, pasos){
  const a = DATA[s] && DATA[s][k];
  if(!a || !a.length) return;
  const n = Math.min(pasos || 6, a.length);
  for(let i=a.length-n;i<a.length;i++){
    const w = (i - (a.length-n) + 1) / n;
    a[i] = a[i]*(1-w) + destino*w;
  }
}
llevar(1, 'vapor.cond', 57.4);        // 11:00 · condensado bajo por trampas con fuga
llevar(2, 'aire.rocio', 7.2);         // 16:00 · secador exigido por la tarde
llevar(2, 'frio.tsum', 3.6);          // 16:00 · agua helada por encima de consigna

/* Detectores de amoníaco por ronda */
const DETECTORES = [
  {id:'AD-01', loc:'Sala de máquinas · nivel piso',        ppm:[0.4, 1.1, 2.3]},
  {id:'AD-02', loc:'Sala de máquinas · sobre compresores', ppm:[1.2, 2.4, 27.4]},
  {id:'AD-03', loc:'Cámara de producto terminado',         ppm:[0.0, 0.3, 0.6]},
  {id:'AD-04', loc:'Túnel de enfriamiento de mayonesa',    ppm:[0.7, 1.8, 3.1]},
  {id:'AD-05', loc:'Azotea · condensador evaporativo',     ppm:[1.9, 3.2, 5.8]},
  {id:'AD-06', loc:'Cuarto de tableros',                   ppm:[0.0, 0.0, 0.2]},
];
/* El máximo detectado alimenta la variable de NH₃ */
RONDAS.forEach((R,s)=>{
  const max = Math.max(...DETECTORES.map(d=>d.ppm[s]));
  llevar(s, 'frio.nh3', max, 4);
  DATA[s]['frio.nh3'][DATA[s]['frio.nh3'].length-1] = max;
});

/* ---------------------------------------------------------
   4. Consultas sobre la ronda activa
   --------------------------------------------------------- */
const win   = k => DATA[ronda][k];
const winT  = () => HORAS[ronda];
const cur   = k => { const a = DATA[ronda][k]; return a[a.length-1]; };
const previa = k => { if(ronda === 0) return null; const a = DATA[ronda-1][k]; return a[a.length-1]; };

function fmt(k, x){
  const v = V[k], n = (x == null) ? cur(k) : x;
  return n.toLocaleString('es-VE',{minimumFractionDigits:v.dec, maximumFractionDigits:v.dec});
}
function estado(k, x){
  const v = V[k], n = (x == null) ? cur(k) : x;
  if(v.dir === 'high') return n >= v.crit ? 'crit' : n >= v.warn ? 'warn' : 'ok';
  if(v.dir === 'low')  return n <= v.crit ? 'crit' : n <= v.warn ? 'warn' : 'ok';
  if(n >= v.lo && n <= v.hi) return 'ok';
  if(n >= v.lo - v.m && n <= v.hi + v.m) return 'warn';
  return 'crit';
}
const ETIQ = {ok:'Normal', warn:'Atención', crit:'Crítico'};
function rangoTexto(k){
  const v = V[k];
  if(v.dir === 'high') return 'Alarma sobre ' + fmt(k, v.crit) + (v.u ? ' '+v.u : '');
  if(v.dir === 'low')  return 'Alarma bajo ' + fmt(k, v.crit) + (v.u ? ' '+v.u : '');
  return 'Rango ' + fmt(k, v.lo) + ' – ' + fmt(k, v.hi) + (v.u ? ' '+v.u : '');
}

/* ---------------------------------------------------------
   5. Gráficas en SVG
   --------------------------------------------------------- */
const REG = [];
const reg = (tab, sel, cfg) => REG.push({tab, sel, cfg});

function scale(min,max,px0,px1){ const d = (max-min) || 1; return x => px1 - (x-min)/d*(px1-px0); }
function nice(min,max){
  const span = (max-min) || 1, step = Math.pow(10, Math.floor(Math.log10(span/4)));
  const mult = [1,2,2.5,5,10].find(m => span/4 <= step*m) || 10, s = step*mult;
  return {lo: Math.floor(min/s)*s, hi: Math.ceil(max/s)*s, s};
}
const path = pts => pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function renderLine(host, cfg){
  const W = Math.max(240, host.clientWidth), H = cfg.h || 210;
  const pad = {t:12, r:12, b:24, l:46};
  const data = cfg.series.map(s => s.get());
  const labels = winT();
  const n = data[0].length;
  let lo = cfg.min != null ? cfg.min : Math.min(...data.flat());
  let hi = cfg.max != null ? cfg.max : Math.max(...data.flat());
  if(cfg.min == null && cfg.max == null){
    const p = (hi-lo)*.18 || Math.abs(hi)*.08 || 1; lo -= p; hi += p;
  }
  const nb = nice(lo,hi); lo = nb.lo; hi = nb.hi;
  const y = scale(lo, hi, pad.t, H-pad.b);
  const x = i => pad.l + (n < 2 ? 0 : i*(W-pad.l-pad.r)/(n-1));

  let g = '';
  for(let t=lo; t<=hi+1e-9; t+=nb.s){
    const py = y(t).toFixed(1);
    g += `<line x1="${pad.l}" y1="${py}" x2="${W-pad.r}" y2="${py}" stroke="${C.line}" stroke-width="1"/>`;
    g += `<text x="${pad.l-8}" y="${+py+3.5}" text-anchor="end" font-size="10.5" fill="${C.ink3}">${(+t.toFixed(6)).toLocaleString('es-VE',{maximumFractionDigits:cfg.dec != null ? cfg.dec : 1})}</text>`;
  }
  (cfg.bands||[]).forEach(b=>{
    const y1 = y(Math.min(b.hi,hi)), y2 = y(Math.max(b.lo,lo));
    g += `<rect x="${pad.l}" y="${y1}" width="${W-pad.l-pad.r}" height="${Math.max(0,y2-y1)}" fill="${b.color}" opacity=".07"/>`;
  });
  (cfg.limits||[]).forEach(l=>{
    if(l.v < lo || l.v > hi) return;
    g += `<line x1="${pad.l}" y1="${y(l.v)}" x2="${W-pad.r}" y2="${y(l.v)}" stroke="${l.color}" stroke-width="1" stroke-dasharray="4 4" opacity=".8"/>`;
    g += `<text x="${W-pad.r}" y="${y(l.v)-5}" text-anchor="end" font-size="10.5" fill="${l.color}">${esc(l.txt)}</text>`;
  });

  const step = Math.max(1, Math.round(n/5));
  for(let i=0;i<n;i+=step){
    g += `<text x="${x(i)}" y="${H-7}" text-anchor="middle" font-size="10.5" fill="${C.ink3}">${labels[i]||''}</text>`;
  }

  data.forEach((d,si)=>{
    const s = cfg.series[si], pts = d.map((v,i)=>[x(i), y(v)]);
    if(s.area){
      const uid = 'gr' + Math.random().toString(36).slice(2,8);
      g = `<defs><linearGradient id="${uid}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${s.color}" stop-opacity=".22"/>
        <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>` + g;
      g += `<path d="${path(pts)} L ${x(n-1)} ${H-pad.b} L ${x(0)} ${H-pad.b} Z" fill="url(#${uid})"/>`;
    }
    g += `<path d="${path(pts)}" fill="none" stroke="${s.color}" stroke-width="${s.w||1.9}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
    const last = pts[pts.length-1];
    g += `<circle cx="${last[0]}" cy="${last[1]}" r="3.4" fill="${s.color}"/>`;
  });

  host.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(cfg.aria||'gráfica')}">
       ${g}
       <line class="cross" x1="0" y1="${pad.t}" x2="0" y2="${H-pad.b}" stroke="${C.ink3}" stroke-width="1" opacity="0"/>
     </svg><div class="tip"></div>`;

  const svg = host.querySelector('svg'), tip = host.querySelector('.tip'), cross = host.querySelector('.cross');
  function move(ev){
    const r = svg.getBoundingClientRect();
    const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const rel = (px/r.width*W - pad.l) / ((W-pad.l-pad.r) || 1);
    const i = Math.max(0, Math.min(n-1, Math.round(rel*(n-1))));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity','.35');
    tip.innerHTML = `<div class="t">${labels[i]||''}</div>` + cfg.series.map((s,si)=>
      `<div class="r"><span><i style="background:${s.color}"></i>${esc(s.name)}</span><b>${data[si][i].toLocaleString('es-VE',{maximumFractionDigits:cfg.dec != null ? cfg.dec : 2})}${cfg.unit ? ' '+cfg.unit : ''}</b></div>`).join('');
    tip.style.opacity = 1;
    const left = Math.max(4, Math.min(host.clientWidth - tip.offsetWidth - 4, x(i)/W*r.width - tip.offsetWidth/2));
    tip.style.left = left + 'px'; tip.style.top = '4px';
  }
  svg.addEventListener('mousemove', move);
  svg.addEventListener('touchmove', move, {passive:true});
  svg.addEventListener('mouseleave', ()=>{ tip.style.opacity = 0; cross.setAttribute('opacity','0'); });
}

function renderBar(host, cfg){
  const W = Math.max(240, host.clientWidth), H = cfg.h || 220;
  const pad = {t:10, r:10, b:34, l:44};
  const series = cfg.series.map(s => ({name:s.name, color:s.color, vals: Array.isArray(s.vals[0]) ? s.vals[ronda] : s.vals}));
  const groups = cfg.groups;
  const hi = nice(0, Math.max(...series.flatMap(s=>s.vals))).hi;
  const y = scale(0, hi, pad.t, H-pad.b);
  const gw = (W-pad.l-pad.r)/groups.length, bw = Math.min(26, (gw-14)/series.length);
  let g = '';
  const st = nice(0,hi).s;
  for(let t=0; t<=hi+1e-9; t+=st){
    g += `<line x1="${pad.l}" y1="${y(t)}" x2="${W-pad.r}" y2="${y(t)}" stroke="${C.line}"/>`;
    g += `<text x="${pad.l-8}" y="${y(t)+3.5}" text-anchor="end" font-size="10.5" fill="${C.ink3}">${(+t.toFixed(4)).toLocaleString('es-VE')}</text>`;
  }
  groups.forEach((gr,gi)=>{
    const cx = pad.l + gw*gi + gw/2, tot = bw*series.length + 3*(series.length-1);
    series.forEach((s,si)=>{
      const bx = cx - tot/2 + si*(bw+3), v = s.vals[gi], by = y(v);
      g += `<rect x="${bx}" y="${by}" width="${bw}" height="${Math.max(1, H-pad.b-by)}" rx="2.5" fill="${s.color}" opacity=".92"><title>${esc(s.name)}: ${v}</title></rect>`;
    });
    const nm = gr.length > 13 ? gr.slice(0,12)+'…' : gr;
    g += `<text x="${cx}" y="${H-12}" text-anchor="middle" font-size="11" fill="${C.ink3}">${esc(nm)}</text>`;
  });
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(cfg.aria||'barras')}">${g}</svg>`;
}

function renderGauge(host, cfg){
  const W = Math.max(200, host.clientWidth), H = cfg.h || 168;
  const cx = W/2, cy = H-30, r = Math.min(W/2-18, H-52);
  const v = cfg.get(), t = Math.max(0, Math.min(1, (v-cfg.min)/(cfg.max-cfg.min)));
  const st = cfg.st ? cfg.st() : 'ok';
  const col = st === 'crit' ? C.crit : st === 'warn' ? C.warn : (cfg.color || C.ok);
  const pol = (rr,tt)=>{ const a = (180+180*tt)*Math.PI/180; return [cx+rr*Math.cos(a), cy+rr*Math.sin(a)]; };
  const arc = (rr,t0,t1,w,c)=>{
    const p0 = pol(rr,t0), p1 = pol(rr,t1);
    /* El medidor abarca 180°, así que el arco nunca es el largo: large-arc-flag = 0 */
    return `<path d="M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A ${rr} ${rr} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}"
      fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  host.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(cfg.label)}">
      ${arc(r,0,1,12,C.line)}
      ${t > 0.004 ? arc(r,0,t,12,col) : ''}
      <text x="${cx}" y="${cy-8}" text-anchor="middle" font-size="27" font-weight="600" fill="${C.ink}" style="font-variant-numeric:tabular-nums">${v.toLocaleString('es-VE',{maximumFractionDigits:cfg.dec != null ? cfg.dec : 0})}<tspan font-size="13" fill="#5C6873" font-weight="500"> ${esc(cfg.unit||'')}</tspan></text>
      <text x="${cx}" y="${cy+15}" text-anchor="middle" font-size="12" fill="${C.ink3}">${esc(cfg.label)}</text>
      <text x="${cx-r}" y="${cy+15}" text-anchor="middle" font-size="10.5" fill="${C.ink3}">${cfg.min}</text>
      <text x="${cx+r}" y="${cy+15}" text-anchor="middle" font-size="10.5" fill="${C.ink3}">${cfg.max}</text>
    </svg>`;
}

function sparkline(k, color){
  const d = win(k), W = 190, H = 34;
  const lo = Math.min(...d), hi = Math.max(...d);
  const y = scale(lo, hi + (hi-lo)*.15 || lo+1, 4, H-3);
  const pts = d.map((v,i)=>[i*W/(d.length-1), y(v)]);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="${H}" aria-hidden="true">
    <path d="${path(pts)} L ${W} ${H} L 0 ${H} Z" fill="${color}" opacity=".08"/>
    <path d="${path(pts)}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

function draw(sel, cfg){
  const host = document.querySelector(sel);
  if(!host || !host.clientWidth) return;
  if(cfg.type === 'bar') renderBar(host, cfg);
  else if(cfg.type === 'gauge') renderGauge(host, cfg);
  else renderLine(host, cfg);
}

/* ---------------------------------------------------------
   6. Gráficas de cada pestaña
   --------------------------------------------------------- */
const L = (k, name, color, extra) => Object.assign({name, color, get:()=>win(k)}, extra||{});

/* Resumen */
reg('resumen','#c-demanda',{h:236, unit:'%', dec:0, min:0, max:100, aria:'Demanda de servicios',
  series:[
    {name:'Agua suave', color:C.agua,  get:()=>win('ptab.caudal').map(v=>v/60*100)},
    {name:'Vapor',      color:C.vapor, get:()=>win('vapor.gen').map(v=>v/6000*100)},
    {name:'Aire',       color:C.aire,  get:()=>win('aire.caudal').map(v=>v/44*100)},
    {name:'Frío',       color:C.nh3,   get:()=>win('frio.carga').map(v=>v/440*100)},
  ]});
const CONSUMO_LINEA = {
  grupos:['Mayonesa','Rikesa','Salsa de tomate','CIP y servicios'],
  series:[
    {name:'Agua suave (m³/h)', color:C.agua,  vals:[[5.1,3.6,7.0,3.2],[9.8,7.2,12.4,11.1],[11.2,8.4,13.9,14.6]]},
    {name:'Vapor (100 kg/h)',  color:C.vapor, vals:[[6.4,4.1,8.2,2.0],[11.2,8.6,14.9,6.8],[12.6,9.8,16.4,9.4]]},
    {name:'Aire (Nm³/min)',    color:C.aire,  vals:[[4.6,3.2,5.8,2.1],[8.1,6.4,10.2,7.6],[9.0,7.1,11.0,8.4]]},
    {name:'Frío (10 TR)',      color:C.nh3,   vals:[[6.2,8.4,3.1,1.0],[9.4,12.1,5.2,2.4],[10.8,13.6,6.1,2.9]]},
  ]};
reg('resumen','#c-lineas',{type:'bar', h:236, groups:CONSUMO_LINEA.grupos, series:CONSUMO_LINEA.series, aria:'Consumo por línea'});

/* PTAB */
reg('ptab','#c-ptab-dureza',{h:210, unit:'ppm', dec:1, min:0, max:20, aria:'Dureza',
  series:[L('ptab.dureza','Dureza', C.agua, {area:true})],
  limits:[{v:17, color:C.crit, txt:'límite 17 ppm'},{v:14, color:C.warn, txt:'aviso 14 ppm'}]});
reg('ptab','#c-ptab-caudal',{h:210, unit:'m³/h', dec:1, aria:'Caudal',
  series:[L('ptab.caudal','Caudal', C.agua, {area:true})]});
reg('ptab','#g-ptab-nivel',{type:'gauge', min:0, max:100, unit:'%', label:'Nivel de cisterna', color:C.agua,
  get:()=>cur('ptab.nivel'), st:()=>estado('ptab.nivel')});
reg('ptab','#g-ptab-sal',{type:'gauge', min:0, max:100, unit:'%', label:'Sal en tanque de salmuera', color:C.agua,
  get:()=>[86, 58, 41][ronda], st:()=>'ok'});
reg('ptab','#c-ptab-dia',{type:'bar', h:168, groups:['Lu','Ma','Mi','Ju','Vi','Sá','Do'],
  series:[{name:'Agua tratada', color:C.agua, vals:[812, 903, 878, 941, 966, 640, 288]}], aria:'Consumo diario'});

/* Vapor */
reg('vapor','#c-vapor-presion',{h:210, unit:'bar', dec:2, min:6, max:11, aria:'Presión de caldera',
  series:[L('vapor.presion','Presión', C.vapor)], bands:[{lo:7.5, hi:9.5, color:C.ok}]});
reg('vapor','#c-vapor-gen',{h:210, unit:'kg/h', dec:0, aria:'Generación de vapor',
  series:[L('vapor.gen','Vapor generado', C.vapor, {area:true})]});
reg('vapor','#c-vapor-efi',{h:210, unit:'%', dec:1, min:40, max:100, aria:'Eficiencia y condensado',
  series:[L('vapor.efi','Eficiencia de caldera', C.vapor), L('vapor.cond','Retorno de condensado', C.ink, {dash:true})]});
reg('vapor','#c-vapor-area',{type:'bar', h:210, groups:['Mayonesa','Rikesa','Salsa','CIP','Esterilización'],
  series:[{name:'Vapor', color:C.vapor, vals:[[640,410,820,200,180],[1120,860,1490,680,410],[1260,980,1640,940,470]]}],
  aria:'Vapor por área'});

/* Aire */
reg('aire','#c-aire-presion',{h:210, unit:'bar', dec:2, min:5, max:8, aria:'Presión de red',
  series:[L('aire.presion','Presión', C.aire)], limits:[{v:6.2, color:C.warn, txt:'mínimo 6.2 bar'}]});
reg('aire','#c-aire-caudal',{h:210, unit:'Nm³/min', dec:1, aria:'Caudal de aire',
  series:[L('aire.caudal','Caudal', C.aire, {area:true})]});
reg('aire','#g-aire-carga',{type:'gauge', min:0, max:100, unit:'%', label:'Carga total', color:C.aire,
  get:()=>cur('aire.carga'), st:()=>estado('aire.carga')});
reg('aire','#g-aire-fugas',{type:'gauge', min:0, max:40, unit:'%', dec:1, label:'Del caudal generado', color:C.aire,
  get:()=>cur('aire.fugas'), st:()=>estado('aire.fugas')});
reg('aire','#c-aire-kw',{type:'bar', h:168, groups:['CA-1','CA-2','CA-3','Secador'],
  series:[{name:'Potencia', color:C.aire, vals:[[104,0,0,16],[112,88,0,18],[118,96,0,19]]}], aria:'Potencia por compresor'});

/* Refrigeración */
reg('frio','#c-frio-temp',{h:210, unit:'°C', dec:2, aria:'Temperatura de agua helada',
  series:[L('frio.tsum','Suministro', C.nh3), L('frio.tret','Retorno', C.ink, {dash:true})]});
reg('frio','#c-frio-pres',{h:210, unit:'bar', dec:2, min:0, max:16, aria:'Presiones',
  series:[L('frio.pdes','Descarga (alta)', C.crit), L('frio.psuc','Succión (baja)', C.aire)],
  limits:[{v:14.5, color:C.crit, txt:'corte 14.5 bar'}]});
reg('frio','#g-frio-carga',{type:'gauge', min:0, max:480, unit:'TR', label:'Carga térmica', color:C.nh3,
  get:()=>cur('frio.carga'), st:()=>estado('frio.carga')});
reg('frio','#g-frio-nivel',{type:'gauge', min:0, max:100, unit:'%', label:'Recibidor de alta presión', color:C.nh3,
  get:()=>cur('frio.nivel'), st:()=>estado('frio.nivel')});
reg('frio','#c-frio-area',{type:'bar', h:168, groups:['Cámaras','Túnel mayonesa','Agua helada','Proceso Rikesa'],
  series:[{name:'Demanda', color:C.nh3, vals:[[78,52,61,34],[96,74,88,52],[104,86,97,61]]}], aria:'Demanda de frío'});


/* ---------------------------------------------------------
   7. PTAR · control real desde Reporte_Control_PTAR_01-09_al_09-09-2026.xlsx
   Procesos: Pre-Tratamiento, T. Primario, Tratamiento Biológico y Lodos
   Turnos: 07:00 y 19:00
   --------------------------------------------------------- */
const PTAR_TURNOS = ['07:00','19:00'];
const PTAR_PROCESOS_DEFAULT = [{"nombre":"Pre-Tratamiento","puestos":[{"nombre":"FOSA DE ENTRADA","variables":[{"id":"pre_fosa_ph","proceso":"Pre-Tratamiento","puesto":"FOSA DE ENTRADA","variable":"pH entrada","rango":"4,0 - 12,0","unidad":"","tipo":"band","min":4.0,"max":12.0},{"id":"pre_fosa_sst","proceso":"Pre-Tratamiento","puesto":"FOSA DE ENTRADA","variable":"SST (mg/L)","rango":"< 4500","unidad":"mg/L","tipo":"max","min":null,"max":4500.0}]},{"nombre":"TQs HOMOGENEIZACIÓN","variables":[{"id":"pre_hom_nivel","proceso":"Pre-Tratamiento","puesto":"TQs HOMOGENEIZACIÓN","variable":"Nivel del tanque (%)","rango":"20% - 80%","unidad":"%","tipo":"band","min":20.0,"max":80.0},{"id":"pre_hom_ph","proceso":"Pre-Tratamiento","puesto":"TQs HOMOGENEIZACIÓN","variable":"pH","rango":"6,0 - 8,0","unidad":"","tipo":"band","min":6.0,"max":8.0},{"id":"pre_hom_caudal","proceso":"Pre-Tratamiento","puesto":"TQs HOMOGENEIZACIÓN","variable":"Caudal de salida (L/s)","rango":"5 - 17","unidad":"L/s","tipo":"band","min":5.0,"max":17.0},{"id":"pre_hom_dqo","proceso":"Pre-Tratamiento","puesto":"TQs HOMOGENEIZACIÓN","variable":"DQO (mg/L)","rango":"< 16000","unidad":"mg/L","tipo":"max","min":null,"max":16000.0},{"id":"pre_hom_sst","proceso":"Pre-Tratamiento","puesto":"TQs HOMOGENEIZACIÓN","variable":"SST (mg/L)","rango":"< 1700","unidad":"mg/L","tipo":"max","min":null,"max":1700.0},{"id":"pre_hom_nt","proceso":"Pre-Tratamiento","puesto":"TQs HOMOGENEIZACIÓN","variable":"Nitrógeno Total (mg/L)","rango":"< 85","unidad":"mg/L","tipo":"max","min":null,"max":85.0},{"id":"pre_hom_pt","proceso":"Pre-Tratamiento","puesto":"TQs HOMOGENEIZACIÓN","variable":"Fósforo Total (mg/L)","rango":"< 25","unidad":"mg/L","tipo":"max","min":null,"max":25.0}]}]},{"nombre":"T. Primario","puestos":[{"nombre":"SALIDA DAF PRIMARIO","variables":[{"id":"prim_ph","proceso":"T. Primario","puesto":"SALIDA DAF PRIMARIO","variable":"pH","rango":"6,0 - 8,0","unidad":"","tipo":"band","min":6.0,"max":8.0},{"id":"prim_dqo","proceso":"T. Primario","puesto":"SALIDA DAF PRIMARIO","variable":"DQO (mg/L)","rango":"< 1200","unidad":"mg/L","tipo":"max","min":null,"max":1200.0},{"id":"prim_sst","proceso":"T. Primario","puesto":"SALIDA DAF PRIMARIO","variable":"SST (mg/L)","rango":"< 1000","unidad":"mg/L","tipo":"max","min":null,"max":1000.0},{"id":"prim_nt","proceso":"T. Primario","puesto":"SALIDA DAF PRIMARIO","variable":"Nitrógeno Total (mg/L)","rango":"< 60","unidad":"mg/L","tipo":"max","min":null,"max":60.0},{"id":"prim_pt","proceso":"T. Primario","puesto":"SALIDA DAF PRIMARIO","variable":"Fósforo Total (mg/L)","rango":"< 25","unidad":"mg/L","tipo":"max","min":null,"max":25.0}]}]},{"nombre":"Tratamiento Biológico","puestos":[{"nombre":"REACTOR BIOLÓGICO","variables":[{"id":"bio_reactor_ph","proceso":"Tratamiento Biológico","puesto":"REACTOR BIOLÓGICO","variable":"pH","rango":"6,5 - 7,5","unidad":"","tipo":"band","min":6.5,"max":7.5},{"id":"bio_reactor_od","proceso":"Tratamiento Biológico","puesto":"REACTOR BIOLÓGICO","variable":"Oxígeno disuelto (mg/L)","rango":"0,5 - 2","unidad":"mg/L","tipo":"band","min":0.5,"max":2.0},{"id":"bio_reactor_sv30","proceso":"Tratamiento Biológico","puesto":"REACTOR BIOLÓGICO","variable":"SV'30 (mL/L)","rango":"400 - 850","unidad":"mL/L","tipo":"band","min":400.0,"max":850.0},{"id":"bio_reactor_ssvlm","proceso":"Tratamiento Biológico","puesto":"REACTOR BIOLÓGICO","variable":"SSVLM (mg/L)","rango":"1.000 - 2.500","unidad":"mg/L","tipo":"band","min":1000.0,"max":2500.0}]},{"nombre":"DAF SECUNDARIO","variables":[{"id":"bio_daf_ph","proceso":"Tratamiento Biológico","puesto":"DAF SECUNDARIO","variable":"pH","rango":"6,0 - 9,0","unidad":"","tipo":"band","min":6.0,"max":9.0},{"id":"bio_daf_caudal","proceso":"Tratamiento Biológico","puesto":"DAF SECUNDARIO","variable":"Caudal de salida (L/s)","rango":"5 - 17","unidad":"L/s","tipo":"band","min":5.0,"max":17.0},{"id":"bio_daf_recir","proceso":"Tratamiento Biológico","puesto":"DAF SECUNDARIO","variable":"Caudal recirculación (L/s)","rango":"10 - 30","unidad":"L/s","tipo":"band","min":10.0,"max":30.0},{"id":"bio_daf_dqo","proceso":"Tratamiento Biológico","puesto":"DAF SECUNDARIO","variable":"DQO (mg/L)","rango":"< 350","unidad":"mg/L","tipo":"max","min":null,"max":350.0},{"id":"bio_daf_sst","proceso":"Tratamiento Biológico","puesto":"DAF SECUNDARIO","variable":"SST (mg/L)","rango":"< 80","unidad":"mg/L","tipo":"max","min":null,"max":80.0},{"id":"bio_daf_sed","proceso":"Tratamiento Biológico","puesto":"DAF SECUNDARIO","variable":"S. Sedimentables (mg/L)","rango":"< 1","unidad":"mg/L","tipo":"max","min":null,"max":1.0},{"id":"bio_daf_nt","proceso":"Tratamiento Biológico","puesto":"DAF SECUNDARIO","variable":"Nitrógeno total (mg/L)","rango":"< 10","unidad":"mg/L","tipo":"max","min":null,"max":10.0},{"id":"bio_daf_pt","proceso":"Tratamiento Biológico","puesto":"DAF SECUNDARIO","variable":"Fósforo Total (mg/L)","rango":"< 1","unidad":"mg/L","tipo":"max","min":null,"max":1.0}]}]},{"nombre":"Lodos","puestos":[{"nombre":"TQ LODO","variables":[{"id":"lodo_conc","proceso":"Lodos","puesto":"TQ LODO","variable":"Conc. Lodo graso (mg/L)","rango":"—","unidad":"mg/L","tipo":"none","min":null,"max":null},{"id":"lodo_parshall","proceso":"Lodos","puesto":"TQ LODO","variable":"FT-Canal Parshall (L/m)","rango":"—","unidad":"L/m","tipo":"none","min":null,"max":null}]},{"nombre":"LECTURAS","variables":[{"id":"lodo_hom","proceso":"Lodos","puesto":"LECTURAS","variable":"Homogenizador","rango":"—","unidad":"","tipo":"none","min":null,"max":null},{"id":"lodo_daf2","proceso":"Lodos","puesto":"LECTURAS","variable":"DAF#2","rango":"—","unidad":"","tipo":"none","min":null,"max":null}]}]}];
let PTAR_PROCESOS = Array.isArray(window.PTAR_FALLBACK_PROCESOS) ? window.PTAR_FALLBACK_PROCESOS : PTAR_PROCESOS_DEFAULT;
let PTAR_DATA = [];
let PTAR_FECHAS = Array.isArray(window.PTAR_FALLBACK_FECHAS) ? [...window.PTAR_FALLBACK_FECHAS] : [];
let PTAR_FECHA = null;
let PTAR_FUENTE = 'Reporte_Control_PTAR_01-09_al_09-09-2026.xlsx';
const PTAR_GRAFICA_VAR = {};
const PTAR_HISTORICO_SEL = {}; // '__all__' o id de una variable por proceso

const ptarVariables = p => p ? (p.puestos || []).flatMap(x => x.variables || []) : [];
const tieneLecturaPTAR = v => {
  if(v === null || v === undefined) return false;
  const s=String(v).trim();
  return !!s && !/^[-–—]+$/.test(s);
};
function ptarNumeroLocal(s){
  if(typeof s === 'number') return Number.isFinite(s) ? s : null;
  let t=String(s ?? '').trim().replace(/\s/g,'');
  if(!t || /^[-–—]+$/.test(t)) return null;
  if(t.includes(',') && t.includes('.')) t=t.replace(/\./g,'').replace(',','.');
  else if(t.includes(',')) t=t.replace(',','.');
  else if(t.includes('.')){
    const a=t.split('.');
    if(a.length===2 && a[1].length===3 && a[0] !== '0' && a[0] !== '-0') t=a.join('');
  }
  const n=Number(t);
  return Number.isFinite(n) ? n : null;
}
function ptarParseRange(rango){
  let s=String(rango ?? '').trim()
    .replace(/˂/g,'<').replace(/≤/g,'<=').replace(/≥/g,'>=')
    .replace(/[−–—]/g,'-');
  if(!s || s==='-' || s==='--') return {tipo:'none',min:null,max:null};
  const raw=s.match(/[-+]?\d[\d.,]*/g) || [];
  const nums=raw.map(ptarNumeroLocal).filter(v=>v!==null);
  if(s.includes('<=') || /(^|[^>])</.test(s)) return {tipo:'max',min:null,max:nums[0] ?? null};
  if(s.includes('>=') || s.includes('>')) return {tipo:'min',min:nums[0] ?? null,max:null};
  if(nums.length>=2 && s.includes('-')) return {tipo:'band',min:nums[0],max:nums[1]};
  return {tipo:'none',min:null,max:null};
}
function fechaISODesdeExcel(serial){
  const d=new Date(Date.UTC(1899,11,30) + Number(serial)*86400000);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0,10) : null;
}
function normalizarFechaPTAR(v){
  if(v == null || v === '') return null;
  if(typeof v === 'number' && Number.isFinite(v)) return fechaISODesdeExcel(v);
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(m){
    let y=Number(m[3]); if(y<100) y+=2000;
    return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
  }
  return null;
}
function etiquetaFechaPTAR(iso, larga=false){
  if(!iso) return 'Sin fecha';
  const [y,m,d]=iso.split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d));
  return dt.toLocaleDateString('es-VE',larga
    ? {day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}
    : {day:'2-digit',month:'2-digit',timeZone:'UTC'});
}
function ptarClave(s){
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
}
function ptarTodasVariables(){
  return PTAR_PROCESOS.flatMap(p=>ptarVariables(p));
}
function ptarDefPorId(id){
  return ptarTodasVariables().find(v=>v.id===id) || null;
}
function ptarDefPorCampos(proceso,puesto,variable){
  const kp=ptarClave(proceso), kpu=ptarClave(puesto), kv=ptarClave(variable);
  return ptarTodasVariables().find(v=>ptarClave(v.proceso)===kp && ptarClave(v.puesto)===kpu && ptarClave(v.variable)===kv) || null;
}
function estadoValorPTAR(v,valor){
  if(!tieneLecturaPTAR(valor)) return 'SIN DATO';
  if(!v || v.tipo==='none') return 'INFORMATIVO';
  const n=ptarNumeroLocal(valor);
  if(n===null) return 'SIN DATO';
  if(v.min!=null && n < Number(v.min)) return 'FUERA DE RANGO';
  if(v.max!=null && n > Number(v.max)) return 'FUERA DE RANGO';
  return 'NORMAL';
}
function estadoRegistroPTAR(r){
  if(!r) return 'SIN DATO';
  return estadoValorPTAR(ptarDefPorId(r.id),r.valor);
}
function claseEstadoPTAR(st){
  if(st==='FUERA DE RANGO') return 'bad';
  if(st==='NORMAL') return 'ok';
  if(st==='INFORMATIVO') return 'info';
  return 'empty';
}
function ptarNumeroTexto(n){
  if(n == null || n === '' || !Number.isFinite(Number(n))) return '—';
  const x=Number(n);
  const dec=Math.abs(x)<10 && Math.abs(x-Math.round(x))>1e-9 ? 2 : (Math.abs(x-Math.round(x))>1e-9 ? 1 : 0);
  return x.toLocaleString('es-VE',{minimumFractionDigits:0,maximumFractionDigits:dec});
}
function valorTextoPTAR(r){
  if(!r || !tieneLecturaPTAR(r.valor)) return '—';
  const n=ptarNumeroLocal(r.valor);
  return n===null ? esc(String(r.valor)) : ptarNumeroTexto(n);
}
function registrosFechaPTAR(fecha=PTAR_FECHA, proceso=null){
  return PTAR_DATA.filter(r=>r.fecha===fecha && (!proceso || r.proceso===proceso));
}
function registroPTAR(variableId,turno,fecha=PTAR_FECHA){
  return PTAR_DATA.find(r=>r.fecha===fecha && r.turno===turno && r.id===variableId) || null;
}
function operadoresFechaPTAR(fecha=PTAR_FECHA){
  const out={};
  PTAR_TURNOS.forEach(t=>{
    const r=PTAR_DATA.find(x=>x.fecha===fecha && x.turno===t && x.operador && tieneLecturaPTAR(x.valor));
    out[t]=r ? r.operador : '';
  });
  return out;
}
function ptarStats(proceso=null, fecha=PTAR_FECHA){
  const p=proceso ? (typeof proceso==='string' ? PTAR_PROCESOS.find(x=>x.nombre===proceso) : proceso) : null;
  const vars=p ? ptarVariables(p) : PTAR_PROCESOS.flatMap(ptarVariables);
  const rows=registrosFechaPTAR(fecha,p ? p.nombre : null);
  const registradas=rows.filter(r=>tieneLecturaPTAR(r.valor));
  const controladas=registradas.filter(r=>{
    const v=ptarDefPorId(r.id);
    return v && v.tipo!=='none' && ptarNumeroLocal(r.valor)!==null;
  });
  const desviaciones=controladas.filter(r=>estadoRegistroPTAR(r)==='FUERA DE RANGO').length;
  const normales=controladas.filter(r=>estadoRegistroPTAR(r)==='NORMAL').length;
  return {
    variables:vars.length,
    registradas:registradas.length,
    controladas:controladas.length,
    desviaciones,
    normales,
    pctNormal:controladas.length ? normales/controladas.length*100 : 0
  };
}
function ptarEstado(st){
  if(!st || !st.registradas) return {st:'idle',txt:'Sin registros'};
  if(st.desviaciones) return {st:'crit',txt:`${st.desviaciones} fuera de rango`};
  if(st.controladas) return {st:'ok',txt:'Normal'};
  return {st:'idle',txt:'Informativo'};
}
function ptarVariablesGraficables(proceso){
  return ptarVariables(proceso);
}
function ptarVariableGrafica(proceso){
  const vars=ptarVariablesGraficables(proceso);
  if(!vars.length) return null;
  const id=PTAR_GRAFICA_VAR[proceso.nombre];
  if(id){ const f=vars.find(v=>v.id===id); if(f) return f; }
  const conDatoControl=vars.find(v=>v.tipo!=='none' && PTAR_TURNOS.some(t=>{
    const r=registroPTAR(v.id,t,PTAR_FECHA); return r && ptarNumeroLocal(r.valor)!==null;
  }));
  const conDato=vars.find(v=>PTAR_TURNOS.some(t=>{
    const r=registroPTAR(v.id,t,PTAR_FECHA); return r && ptarNumeroLocal(r.valor)!==null;
  }));
  const candidata=conDatoControl || conDato || vars.find(v=>v.tipo!=='none') || vars[0];
  PTAR_GRAFICA_VAR[proceso.nombre]=candidata.id;
  return candidata;
}
function ptarLimitesGrafica(v,valores){
  let nums=(valores||[]).map(ptarNumeroLocal).filter(x=>x!==null);
  if(v && v.min!=null) nums.push(Number(v.min));
  if(v && v.max!=null) nums.push(Number(v.max));
  if(!nums.length) return {lo:0,hi:1};
  let lo=Math.min(...nums), hi=Math.max(...nums);
  if(v && v.tipo==='max' && lo>=0) lo=0;
  if(lo===hi){ const p=Math.abs(lo)*.15 || 1; lo-=p; hi+=p; }
  else { const p=(hi-lo)*.12; lo-=p; hi+=p; }
  if(lo>=0) lo=Math.max(0,lo);
  return {lo,hi};
}
function ptarEjes(v,valores,W=640,H=235){
  const pad={t:18,r:18,b:38,l:62};
  const lim=ptarLimitesGrafica(v,valores), span=lim.hi-lim.lo || 1;
  const y=n=>pad.t+(lim.hi-Number(n))/span*(H-pad.t-pad.b);
  let svg='';
  for(let i=0;i<=4;i++){
    const val=lim.lo+span*i/4, yy=y(val);
    svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.line}" stroke-width="1"/>`;
    svg+=`<text x="${pad.l-8}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" font-size="10.2" fill="${C.ink3}">${esc(ptarNumeroTexto(val))}</text>`;
  }
  if(v && v.tipo==='band' && v.min!=null && v.max!=null){
    const ya=y(v.max), yb=y(v.min);
    svg+=`<rect x="${pad.l}" y="${Math.min(ya,yb).toFixed(1)}" width="${W-pad.l-pad.r}" height="${Math.abs(yb-ya).toFixed(1)}" fill="${C.ptar}" opacity=".08"/>`;
    svg+=`<line x1="${pad.l}" y1="${ya.toFixed(1)}" x2="${W-pad.r}" y2="${ya.toFixed(1)}" stroke="${C.ptar}" stroke-width="1" stroke-dasharray="4 4" opacity=".7"/>`;
    svg+=`<line x1="${pad.l}" y1="${yb.toFixed(1)}" x2="${W-pad.r}" y2="${yb.toFixed(1)}" stroke="${C.ptar}" stroke-width="1" stroke-dasharray="4 4" opacity=".7"/>`;
  } else if(v && v.tipo==='max' && v.max!=null){
    const yy=y(v.max);
    svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.crit}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    svg+=`<text x="${W-pad.r-3}" y="${(yy-5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.crit}">máx. ${esc(ptarNumeroTexto(v.max))}</text>`;
  } else if(v && v.tipo==='min' && v.min!=null){
    const yy=y(v.min);
    svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.crit}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    svg+=`<text x="${W-pad.r-3}" y="${(yy-5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.crit}">mín. ${esc(ptarNumeroTexto(v.min))}</text>`;
  }
  return {svg,y,pad,lo:lim.lo,hi:lim.hi,W,H};
}
function renderPTARDia(host,proceso,v){
  if(!host || !v) return;
  const regs=PTAR_TURNOS.map(t=>registroPTAR(v.id,t,PTAR_FECHA));
  const vals=regs.map(r=>r ? ptarNumeroLocal(r.valor) : null).filter(x=>x!==null);
  if(!vals.length){
    host.innerHTML=`<div class="ptar-chart-empty">Sin lecturas de ${esc(v.variable)} para ${etiquetaFechaPTAR(PTAR_FECHA,true)}.</div>`;
    return;
  }
  const ax=ptarEjes(v,vals), {W,H,pad,y}=ax;
  const xs=[pad.l+90,W-pad.r-90];
  let g=ax.svg, pts=[];
  regs.forEach((r,i)=>{
    const x=xs[i];
    g+=`<text x="${x}" y="${H-10}" text-anchor="middle" font-size="10.5" fill="${C.ink3}">${PTAR_TURNOS[i]}</text>`;
    const val=r ? ptarNumeroLocal(r.valor) : null;
    if(val===null) return;
    const yy=y(val), st=estadoRegistroPTAR(r), color=st==='FUERA DE RANGO'?C.crit:C.ptar;
    pts.push([x,yy]);
    g+=`<circle cx="${x}" cy="${yy.toFixed(1)}" r="${st==='FUERA DE RANGO'?5:4}" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${esc(PTAR_TURNOS[i]+' · '+ptarNumeroTexto(val)+(v.unidad?' '+v.unidad:'')+' · '+st)}</title></circle>`;
    g+=`<text x="${x}" y="${Math.max(pad.t+12,yy-8).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${color}">${esc(ptarNumeroTexto(val))}</text>`;
  });
  if(pts.length>1) g+=`<path d="M${pts[0][0]} ${pts[0][1].toFixed(1)} L${pts[1][0]} ${pts[1][1].toFixed(1)}" fill="none" stroke="${C.ptar}" stroke-width="2" opacity=".75"/>`;
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(v.variable+' del día')}">${g}</svg>`;
}
function registrosHistoricosVariablePTAR(v){
  if(!v) return [];
  const orderTurno=t=>t==='07:00'?0:(t==='19:00'?1:2);
  return PTAR_DATA
    .filter(r=>r.id===v.id && ptarNumeroLocal(r.valor)!==null)
    .slice()
    .sort((a,b)=>a.fecha.localeCompare(b.fecha) || orderTurno(a.turno)-orderTurno(b.turno));
}
function resumenDesviacionesHistoricasPTAR(v){
  const rows=registrosHistoricosVariablePTAR(v);
  const devs=rows.filter(r=>estadoRegistroPTAR(r)==='FUERA DE RANGO');
  return {rows,devs,fechas:[...new Set(rows.map(r=>r.fecha))].sort()};
}
function renderPTARHistoricoCompleto(host,v){
  if(!host || !v) return;
  const info=resumenDesviacionesHistoricasPTAR(v), rows=info.rows, fechas=info.fechas;
  const vals=rows.map(r=>ptarNumeroLocal(r.valor)).filter(x=>x!==null);
  if(!vals.length){
    host.innerHTML=`<div class="ptar-chart-empty">Sin registros históricos de ${esc(v.variable)} en el archivo.</div>`;
    return;
  }
  const W=760,H=255, ax=ptarEjes(v,vals,W,H), {pad,y}=ax;
  const x=i=>fechas.length<2 ? (pad.l+(W-pad.r))/2 : pad.l+i*(W-pad.l-pad.r)/(fechas.length-1);
  let g=ax.svg;
  const maxLabels=11, step=Math.max(1,Math.ceil(fechas.length/maxLabels));
  const ultLbl=fechas.length-1, idxLbl=[];
  for(let q=0;q<fechas.length;q+=step) idxLbl.push(q);
  if(idxLbl[idxLbl.length-1]!==ultLbl){
    if(ultLbl-idxLbl[idxLbl.length-1]<step*0.6) idxLbl.pop();
    idxLbl.push(ultLbl);
  }
  fechas.forEach((f,i)=>{
    if(!idxLbl.includes(i)) return;
    g+=`<text x="${x(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="9.4" fill="${C.ink3}">${esc(etiquetaFechaPTAR(f))}</text>`;
  });
  PTAR_TURNOS.forEach((turn,si)=>{
    const color=si===0?C.ptar:C.ink, pts=[];
    fechas.forEach((f,i)=>{
      const r=registroPTAR(v.id,turn,f), val=r?ptarNumeroLocal(r.valor):null;
      if(val===null) return;
      pts.push([x(i),y(val),r,val]);
    });
    if(pts.length>1){
      const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
      g+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>`;
    }
    pts.forEach(p=>{
      const st=estadoRegistroPTAR(p[2]), fuera=st==='FUERA DE RANGO', pointColor=fuera?C.crit:color;
      g+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${fuera?5.2:3.6}" fill="${pointColor}" stroke="#fff" stroke-width="${fuera?1.7:1.2}"><title>${esc(etiquetaFechaPTAR(p[2].fecha,true)+' · '+turn+' · '+ptarNumeroTexto(p[3])+(v.unidad?' '+v.unidad:'')+' · '+st)}</title></circle>`;
    });
  });
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc('Histórico completo · '+v.variable)}">${g}</svg>
    <div class="ptar-chart-legend">
      <span><i style="--k:${C.ptar}"></i>07:00</span>
      <span><i style="--k:${C.ink}"></i>19:00</span>
      <span><i style="--k:${C.crit}"></i>Fuera de rango</span>
      <span class="ptar-chart-range">${esc(v.rango || 'Sin rango definido')}</span>
    </div>`;
}
function textoDesviacionesHistoricasPTAR(v,limit=4){
  const devs=resumenDesviacionesHistoricasPTAR(v).devs;
  if(!devs.length) return '';
  const partes=devs.slice(0,limit).map(r=>`${etiquetaFechaPTAR(r.fecha)} ${r.turno} · ${valorTextoPTAR(r)}${v.unidad?' '+v.unidad:''}`);
  const resto=devs.length-limit;
  return partes.join(' · ')+(resto>0?` · +${resto} más`:'');
}
function ptarSeleccionHistorico(proceso){
  const vars=ptarVariables(proceso);
  const actual=PTAR_HISTORICO_SEL[proceso.nombre] || '__all__';
  if(actual==='__all__' || vars.some(v=>v.id===actual)) return actual;
  PTAR_HISTORICO_SEL[proceso.nombre]='__all__';
  return '__all__';
}
function pintarGraficasPTAR(){
  const host=document.getElementById('ptar-graficas-procesos');
  if(!host || !PTAR_PROCESOS.length) return;
  host.innerHTML=PTAR_PROCESOS.map((p,pi)=>{
    const todas=ptarVariables(p);
    const v=ptarVariableGrafica(p);
    const opciones=todas.map(x=>`<option value="${esc(x.id)}"${x.id===v.id?' selected':''}>${esc(x.variable)} · ${esc(x.puesto)}</option>`).join('');
    const histSel=ptarSeleccionHistorico(p);
    const opcionesHistorico=`<option value="__all__"${histSel==='__all__'?' selected':''}>Todas las gráficas</option>`+
      todas.map(x=>`<option value="${esc(x.id)}"${x.id===histSel?' selected':''}>${esc(x.variable)} · ${esc(x.puesto)}</option>`).join('');
    const varsHistoricas=histSel==='__all__' ? todas : todas.filter(x=>x.id===histSel);
    const historicos=varsHistoricas.map(hv=>{
      const vi=todas.findIndex(x=>x.id===hv.id);
      const info=resumenDesviacionesHistoricasPTAR(hv), nReg=info.rows.length, nDias=info.fechas.length, nDev=info.devs.length;
      const badge=nReg
        ? (nDev
          ? `<span class="pill crit"><i></i>${nDev} fuera de rango</span>`
          : `<span class="pill ${hv.tipo==='none'?'idle':'ok'}"><i></i>${hv.tipo==='none'?'Informativo':'Sin desviaciones'}</span>`)
        : `<span class="pill idle"><i></i>Sin registros</span>`;
      const devTxt=nDev?textoDesviacionesHistoricasPTAR(hv):'';
      return `<article class="ptar-history-var-card ${nDev?'has-history-dev':''}" aria-labelledby="ptar-hist-${pi}-${vi}">
        <div class="ptar-history-var-head">
          <div class="ptar-history-var-title">
            <h5 id="ptar-hist-${pi}-${vi}">${esc(hv.variable)}</h5>
            <div class="ptar-history-var-meta">
              <span>${esc(hv.puesto || '—')}</span>
              <span>Rango: ${esc(hv.rango || '—')}</span>
              ${hv.unidad?`<span>Unidad: ${esc(hv.unidad)}</span>`:''}
              <span>${nReg} lectura${nReg===1?'':'s'} · ${nDias} día${nDias===1?'':'s'} con registro</span>
            </div>
          </div>
          ${badge}
        </div>
        <div class="ptar-process-chart ptar-history-chart" data-ptar-chart-history="${pi}-${vi}"></div>
        ${devTxt?`<div class="ptar-history-dev-note"><b>Desviaciones:</b> ${esc(devTxt)}</div>`:''}
      </article>`;
    }).join('');
    return `<section class="card ptar-chart-process-card ptar-theme ptar-process-charts" aria-labelledby="ptar-chart-${pi}">
      <div class="card-h">
        <div>
          <h3 id="ptar-chart-${pi}">${esc(p.nombre)}</h3>
          <span class="ptar-process-chart-sub">${todas.length} variables · histórico completo según días con registro</span>
        </div>
        <label class="ptar-chart-selector">Variable para lectura del día
          <select data-ptar-chart-process="${pi}" aria-label="Variable del día a graficar de ${esc(p.nombre)}">${opciones}</select>
        </label>
      </div>
      <div class="card-b">
        <div class="ptar-day-block">
          <div class="ptar-chart-meta">
            <strong>${esc(v.variable)}</strong>
            <span>${esc(v.puesto || '—')}</span>
            <span>Rango: ${esc(v.rango || '—')}</span>
            ${v.unidad?`<span>Unidad: ${esc(v.unidad)}</span>`:''}
          </div>
          <div class="ptar-chart-panel ptar-day-panel">
            <div class="ptar-chart-panel-h"><h4>Lecturas del día seleccionado</h4><span class="sub">${etiquetaFechaPTAR(PTAR_FECHA,true)} · 07:00 / 19:00</span></div>
            <div class="ptar-process-chart" data-ptar-chart-day="${pi}"></div>
          </div>
        </div>
        <div class="ptar-all-history">
          <div class="ptar-all-history-h">
            <div>
              <h4>Comportamiento histórico de todas las variables</h4>
              <p>Selecciona una gráfica específica o muestra todas las variables del proceso.</p>
            </div>
            <div class="history-toolbar">
              <label class="history-chart-selector">Gráfica a visualizar
                <select data-ptar-history-selector="${pi}" aria-label="Gráfica histórica a visualizar de ${esc(p.nombre)}">${opcionesHistorico}</select>
              </label>
              <span class="ptar-history-key"><i></i>Los puntos rojos indican lecturas fuera del rango de operación.</span>
            </div>
          </div>
          <div class="ptar-history-grid ${histSel==='__all__'?'':'is-single'}">${historicos}</div>
        </div>
      </div>
    </section>`;
  }).join('');
  PTAR_PROCESOS.forEach((p,pi)=>{
    const todas=ptarVariables(p), v=ptarVariableGrafica(p), histSel=ptarSeleccionHistorico(p);
    renderPTARDia(host.querySelector(`[data-ptar-chart-day="${pi}"]`),p,v);
    const varsHistoricas=histSel==='__all__' ? todas : todas.filter(x=>x.id===histSel);
    varsHistoricas.forEach(hv=>{
      const vi=todas.findIndex(x=>x.id===hv.id);
      renderPTARHistoricoCompleto(host.querySelector(`[data-ptar-chart-history="${pi}-${vi}"]`),hv);
    });
  });
  host.querySelectorAll('[data-ptar-chart-process]').forEach(sel=>{
    sel.addEventListener('change',()=>{
      const pi=Number(sel.dataset.ptarChartProcess), p=PTAR_PROCESOS[pi];
      if(!p) return;
      PTAR_GRAFICA_VAR[p.nombre]=sel.value;
      pintarGraficasPTAR();
    });
  });
  host.querySelectorAll('[data-ptar-history-selector]').forEach(sel=>{
    sel.addEventListener('change',()=>{
      const pi=Number(sel.dataset.ptarHistorySelector), p=PTAR_PROCESOS[pi];
      if(!p) return;
      PTAR_HISTORICO_SEL[p.nombre]=sel.value;
      pintarGraficasPTAR();
    });
  });
}
function poblarFechasPTAR(){
  const sels=[document.getElementById('ptar-date-select'),document.getElementById('ptar-summary-date-select')].filter(Boolean);
  sels.forEach(sel=>{
    sel.innerHTML=PTAR_FECHAS.map(f=>`<option value="${f}">${etiquetaFechaPTAR(f,true)}</option>`).join('');
    sel.value=PTAR_FECHA || '';
    if(!sel.dataset.bound){
      sel.dataset.bound='1';
      sel.addEventListener('change',()=>{
        PTAR_FECHA=sel.value;
        sels.forEach(s=>s.value=PTAR_FECHA);
        pintarPTAR(); pintarValores(); pintarEncabezado(); pintarPrioridades();
      });
    }
  });
}
function pintarDesviacionesPTAR(){
  const host=document.getElementById('ptar-desviaciones');
  const count=document.getElementById('ptar-desv-count');
  if(!host) return;
  const list=registrosFechaPTAR().filter(r=>estadoRegistroPTAR(r)==='FUERA DE RANGO');
  if(count) count.textContent=list.length?`${list.length} detectada${list.length===1?'':'s'}`:'ninguna';
  host.innerHTML=list.length ? list.map(r=>{
    const v=ptarDefPorId(r.id);
    return `<div class="ptar-dev">
      <span class="bar" style="background:${C.crit}"></span>
      <div class="body">
        <div class="title">${esc(r.variable)} · ${valorTextoPTAR(r)}${v&&v.unidad?' '+esc(v.unidad):''}</div>
        <div class="meta">${esc(r.proceso)} · ${esc(r.puesto)} · rango ${esc(r.rango || '—')}</div>
        ${r.operador?`<div class="obs">Operador: ${esc(r.operador)}</div>`:''}
        ${r.observacion?`<div class="obs">${esc(r.observacion)}</div>`:''}
      </div>
      <time>${esc(r.turno)}</time>
    </div>`;
  }).join('') : `<p class="empty">No hay variables registradas fuera de rango el ${etiquetaFechaPTAR(PTAR_FECHA,true)}.</p>`;
}
function pintarPTAR(){
  if(!PTAR_PROCESOS.length) return;
  poblarFechasPTAR();
  const total=ptarStats(), eTotal=ptarEstado(total);
  document.querySelectorAll('[data-ptar-summary-count]').forEach(el=>el.textContent=String(total.registradas));
  const sumPill=document.querySelector('[data-ptar-summary-pill]');
  if(sumPill){ sumPill.className='pill '+eTotal.st; sumPill.innerHTML='<i></i>'+esc(eTotal.txt); }
  const stripVal=document.querySelector('[data-ptar-strip-value]');
  if(stripVal) stripVal.textContent=String(total.desviaciones);
  const stripPill=document.querySelector('[data-ptar-strip-pill]');
  if(stripPill){ stripPill.className='pill '+eTotal.st; stripPill.innerHTML='<i></i>'+esc(eTotal.txt); }

  const resumen=document.getElementById('ptar-resumen-procesos');
  if(resumen){
    resumen.innerHTML=PTAR_PROCESOS.map(p=>{
      const st=ptarStats(p), e=ptarEstado(st);
      return `<div class="ptar-summary-process">
        <div class="ptar-summary-process-h"><strong>${esc(p.nombre)}</strong><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span></div>
        <div class="ptar-summary-process-v"><b>${st.variables}</b> variables · ${st.registradas} lecturas · ${st.desviaciones} fuera</div>
        <div class="ptar-progress"><i style="width:${st.controladas?st.pctNormal.toFixed(1):0}%"></i></div>
      </div>`;
    }).join('');
  }
  const kpis=document.getElementById('ptar-kpis-proceso');
  if(kpis){
    kpis.innerHTML=PTAR_PROCESOS.map(p=>{
      const st=ptarStats(p), e=ptarEstado(st);
      return `<div class="kpi ptar-process-kpi">
        <div class="lbl"><span>${esc(p.nombre)}</span><span class="pill ${e.st}" style="margin-left:auto"><i></i>${esc(e.txt)}</span></div>
        <div class="v tnum">${st.registradas}<small>lecturas</small></div>
        <div class="rng">${st.variables} variables · ${st.controladas} con rango evaluadas</div>
        <div class="ptar-progress"><i style="width:${st.controladas?st.pctNormal.toFixed(1):0}%"></i></div>
      </div>`;
    }).join('');
  }
  const host=document.getElementById('ptar-procesos');
  if(host){
    const ops=operadoresFechaPTAR();
    host.innerHTML=PTAR_PROCESOS.map((p,pi)=>{
      const st=ptarStats(p), e=ptarEstado(st);
      const rows=(p.puestos||[]).map(puesto=>(puesto.variables||[]).map((v,i)=>{
        const puestoCell=i===0?`<td class="ptar-puesto" rowspan="${puesto.variables.length}">${esc(puesto.nombre)}</td>`:'';
        const regs=PTAR_TURNOS.map(t=>registroPTAR(v.id,t));
        const dev=regs.some(r=>estadoRegistroPTAR(r)==='FUERA DE RANGO');
        const celdas=regs.map(r=>{
          const est=estadoRegistroPTAR(r), cls=claseEstadoPTAR(est);
          return `<td class="num ptar-lectura ${cls}" title="${esc(est)}">${valorTextoPTAR(r)}</td>`;
        }).join('');
        return `<tr class="${dev?'has-dev':''}">${puestoCell}<td>${esc(v.variable)}</td><td class="ptar-rango tnum">${esc(v.rango || '—')}</td>${celdas}</tr>`;
      }).join('')).join('');
      return `<section class="card ptar-process-card ptar-theme" aria-labelledby="ptar-proceso-${pi}">
        <div class="card-h">
          <h3 id="ptar-proceso-${pi}">${esc(p.nombre)}</h3>
          <span class="pill ${e.st}"><i></i>${esc(e.txt)}</span>
          <span class="note">${etiquetaFechaPTAR(PTAR_FECHA,true)} · ${st.registradas} lecturas</span>
        </div>
        <div class="card-b ptar-table-wrap">
          <table class="tbl ptar-table ptar-real-table">
            <thead><tr>
              <th>Puesto de trabajo</th><th>Variable de control</th><th class="num">Rango de operación</th>
              <th class="num">07:00${ops['07:00']?`<small>${esc(ops['07:00'])}</small>`:''}</th>
              <th class="num">19:00${ops['19:00']?`<small>${esc(ops['19:00'])}</small>`:''}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
    }).join('');
  }
  pintarGraficasPTAR();
  pintarDesviacionesPTAR();
}
function normalizarFilasPTAR(rows){
  return (rows||[]).map(r=>{
    const proceso=String(r.Proceso ?? r.proceso ?? '').trim();
    const puesto=String(r['Puesto de trabajo'] ?? r.Puesto ?? r.puesto ?? '').trim();
    const variable=String(r['Variable de control'] ?? r.Variable ?? r.variable ?? '').trim();
    let id=String(r.VariableId ?? r.id ?? '').trim();
    let def=id?ptarDefPorId(id):ptarDefPorCampos(proceso,puesto,variable);
    if(!def) return null;
    id=def.id;
    const valorRaw=r.Valor ?? r.valor;
    const valorNum=ptarNumeroLocal(valorRaw);
    return {
      fecha:normalizarFechaPTAR(r.Fecha ?? r.fecha),
      turno:String(r.Turno ?? r.turno ?? '').trim(),
      operador:String(r.Operador ?? r.operador ?? '').trim(),
      proceso:def.proceso,
      puesto:def.puesto,
      variable:def.variable,
      rango:def.rango,
      valor:valorNum!==null?valorNum:(valorRaw ?? ''),
      unidad:def.unidad || String(r.Unidad ?? r.unidad ?? '').trim(),
      tipo:def.tipo,
      min:def.min,
      max:def.max,
      observacion:String(r['Nota de transcripción'] ?? r['Observación'] ?? r.Observacion ?? r.observacion ?? '').trim(),
      id
    };
  }).filter(r=>r && r.fecha && r.turno && r.id);
}
function cargarDatosPTAR(rows,fechas,procesos,fuente,tipo='fallback'){
  if(procesos && procesos.length) PTAR_PROCESOS=procesos;
  const norm=normalizarFilasPTAR(rows);
  if(!norm.length) throw new Error('El archivo no contiene registros PTAR válidos.');
  PTAR_DATA=norm;
  const dataFechas=[...new Set(norm.map(r=>r.fecha))].sort();
  PTAR_FECHAS=(fechas && fechas.length ? [...new Set(fechas)] : dataFechas).sort();
  const ultimaConDatos=dataFechas.filter(f=>registrosFechaPTAR(f).some(r=>tieneLecturaPTAR(r.valor))).slice(-1)[0] || PTAR_FECHAS[PTAR_FECHAS.length-1] || null;
  if(!PTAR_FECHA || !PTAR_FECHAS.includes(PTAR_FECHA) || !registrosFechaPTAR(PTAR_FECHA).some(r=>tieneLecturaPTAR(r.valor))) PTAR_FECHA=ultimaConDatos;
  PTAR_FUENTE=fuente || PTAR_FUENTE;
  poblarFechasPTAR();
  if(document.body && document.body.dataset.dashboardReady==='1'){
    pintarPTAR(); pintarValores(); pintarEncabezado(); pintarPrioridades();
  }
}

/* Lector XLSX ligero compartido con Vapor: ZIP + XML sin dependencias externas. */
function colIndexPTAR(ref){
  const m=String(ref||'').match(/^([A-Z]+)/); if(!m) return 0;
  let n=0; for(const ch of m[1]) n=n*26+ch.charCodeAt(0)-64; return n-1;
}
async function abrirZipPTAR(buffer){
  const u8=new Uint8Array(buffer), dv=new DataView(buffer); let eocd=-1;
  const min=Math.max(0,u8.length-65557);
  for(let i=u8.length-22;i>=min;i--){ if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;} }
  if(eocd<0) throw new Error('No se pudo leer la estructura ZIP del XLSX.');
  const total=dv.getUint16(eocd+10,true); let p=dv.getUint32(eocd+16,true);
  const entries=new Map(), td=new TextDecoder('utf-8');
  for(let i=0;i<total;i++){
    if(dv.getUint32(p,true)!==0x02014b50) throw new Error('Directorio ZIP inválido.');
    const method=dv.getUint16(p+10,true), compSize=dv.getUint32(p+20,true), uncompSize=dv.getUint32(p+24,true);
    const nameLen=dv.getUint16(p+28,true), extraLen=dv.getUint16(p+30,true), commentLen=dv.getUint16(p+32,true), localOffset=dv.getUint32(p+42,true);
    const name=td.decode(u8.slice(p+46,p+46+nameLen)); entries.set(name,{method,compSize,uncompSize,localOffset});
    p+=46+nameLen+extraLen+commentLen;
  }
  async function bytes(name){
    name=String(name).replace(/^\//,''); const e=entries.get(name); if(!e) throw new Error('Falta '+name+' en el XLSX.');
    const lp=e.localOffset; if(dv.getUint32(lp,true)!==0x04034b50) throw new Error('Entrada ZIP inválida: '+name);
    const nlen=dv.getUint16(lp+26,true), xlen=dv.getUint16(lp+28,true), start=lp+30+nlen+xlen;
    const comp=u8.slice(start,start+e.compSize);
    if(e.method===0) return comp;
    if(e.method===8){
      if(typeof DecompressionStream==='undefined') throw new Error('Este navegador no soporta descompresión XLSX local.');
      const ds=new DecompressionStream('deflate-raw');
      return new Uint8Array(await new Response(new Blob([comp]).stream().pipeThrough(ds)).arrayBuffer());
    }
    throw new Error('Método de compresión XLSX no soportado: '+e.method);
  }
  return {entries,text:async name=>td.decode(await bytes(name))};
}
async function leerHojaXLSXPTAR(zip,target,shared){
  const parser=new DOMParser(), shXml=parser.parseFromString(await zip.text(target),'application/xml');
  const out=[];
  [...shXml.getElementsByTagNameNS('*','row')].forEach(row=>{
    const arr=[];
    [...row.getElementsByTagNameNS('*','c')].forEach(c=>{
      const idx=colIndexPTAR(c.getAttribute('r')), t=c.getAttribute('t'); let value='';
      if(t==='inlineStr') value=[...c.getElementsByTagNameNS('*','t')].map(x=>x.textContent||'').join('');
      else {
        const ve=c.getElementsByTagNameNS('*','v')[0], raw=ve?ve.textContent:'';
        if(t==='s') value=shared[Number(raw)] ?? '';
        else if(t==='str') value=raw;
        else if(raw!==''){ const n=Number(raw); value=Number.isFinite(n)?n:raw; }
      }
      arr[idx]=value;
    });
    // IMPORTANTE: respetar el número real de fila del XML. Un XLSX puede omitir
    // completamente filas vacías; usar out.push() desplaza todas las coordenadas
    // posteriores y rompe las lecturas por celda (p. ej. bancos de hielo y CAV Gigante).
    const rn=Number(row.getAttribute('r'))||out.length+1;
    out[rn-1]=arr;
  });
  for(let i=0;i<out.length;i++)if(!out[i])out[i]=[];
  return out;
}
async function leerExcelPTAR(buffer){
  const zip=await abrirZipPTAR(buffer), parser=new DOMParser();
  const wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml');
  const relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml');
  const rels=[...relXml.getElementsByTagNameNS('*','Relationship')];
  let shared=[];
  if(zip.entries.has('xl/sharedStrings.xml')){
    const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');
    shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));
  }
  const sheets=[...wbXml.getElementsByTagNameNS('*','sheet')];
  const sheet=sheets.find(s=>s.getAttribute('name')==='Control') || sheets.find(s=>s.getAttribute('name')==='Datos Dashboard');
  if(!sheet) throw new Error('No existe la hoja "Control" en el archivo PTAR.');
  const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id') || sheet.getAttribute('r:id');
  const rel=rels.find(r=>r.getAttribute('Id')===rid); if(!rel) throw new Error('No se pudo resolver la hoja Control.');
  let target=rel.getAttribute('Target').replace(/^\//,''); if(!target.startsWith('xl/')) target='xl/'+target.replace(/^\.\//,'');
  const rows=await leerHojaXLSXPTAR(zip,target,shared); if(!rows.length) throw new Error('La hoja Control está vacía.');
  const headers=rows[0].map(x=>String(x??'').trim());
  const objetos=rows.slice(1).filter(r=>r.some(v=>v!=='' && v!==null && v!==undefined)).map(r=>{
    const o={}; headers.forEach((h,i)=>{if(h)o[h]=r[i]??'';}); return o;
  });
  return objetos;
}
async function cargarExcelPTARArchivo(file,origen='archivo seleccionado'){
  const rows=await leerExcelPTAR(await file.arrayBuffer());
  cargarDatosPTAR(rows,[],PTAR_PROCESOS,`${file.name} · ${rows.length} filas de control · ${origen}`,'excel');
}
async function cargarPTARAutomatico(){
  if(location.protocol==='file:') return;
  try{
    const resp=await fetch('Reporte_Control_PTAR_01-09_al_09-09-2026.xlsx',{cache:'no-store'});
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const rows=await leerExcelPTAR(await resp.arrayBuffer());
    cargarDatosPTAR(rows,[],PTAR_PROCESOS,`Reporte_Control_PTAR_01-09_al_09-09-2026.xlsx · ${rows.length} filas de control · carga automática`,'excel');
  }catch(err){ /* fallback precargado permanece visible */ }
}
function inicializarPTARExcel(){
  const input=document.getElementById('ptar-excel-input');
  if(input && !input.dataset.bound){
    input.dataset.bound='1';
    input.addEventListener('change',async()=>{
      const file=input.files && input.files[0]; if(!file) return;
      try{ await cargarExcelPTARArchivo(file); }
      catch(err){ alert('No se pudo leer el Excel de PTAR: '+err.message); }
      finally{ input.value=''; }
    });
  }
  cargarPTARAutomatico();
}
if(window.PTAR_FALLBACK_DATA && window.PTAR_FALLBACK_DATA.length){
  cargarDatosPTAR(
    window.PTAR_FALLBACK_DATA,
    window.PTAR_FALLBACK_FECHAS || [],
    window.PTAR_FALLBACK_PROCESOS || PTAR_PROCESOS_DEFAULT,
    'Reporte_Control_PTAR_01-09_al_09-09-2026.xlsx · datos precargados para apertura local',
    'fallback'
  );
}

/* ---------------------------------------------------------
   8. VAPOR · control real desde Reporte_Control_Generacion_Vapor_08-09_y_09-09-2026.xlsx
   Procesos: Alimentación Calderas + Calderas N°1 a N°5
   Turnos: 07:00 y 19:00
   --------------------------------------------------------- */
const VAPOR_TURNOS = ['07:00','19:00'];
let VAPOR_PROCESOS = Array.isArray(window.VAPOR_FALLBACK_PROCESOS) ? window.VAPOR_FALLBACK_PROCESOS : [];
let VAPOR_DATA = [];
let VAPOR_FECHAS = Array.isArray(window.VAPOR_FALLBACK_FECHAS) ? [...window.VAPOR_FALLBACK_FECHAS] : [];
let VAPOR_FECHA = null;
let VAPOR_FUENTE = 'Reporte_Control_Generacion_Vapor_08-09_y_09-09-2026.xlsx';
const VAPOR_GRAFICA_VAR = {};
const VAPOR_HISTORICO_SEL = {}; // '__all__' o id de una variable por proceso

const vaporVariables = p => p ? (p.variables || []) : [];
const tieneLecturaVapor = v => v !== null && v !== undefined && String(v).trim() !== '';

function vaporNumeroLocal(s){
  if(typeof s === 'number') return Number.isFinite(s) ? s : null;
  let t=String(s ?? '').trim().replace(/\s/g,'');
  if(!t) return null;
  if(t.includes(',') && t.includes('.')) t=t.replace(/\./g,'').replace(',','.');
  else if(t.includes(',')) t=t.replace(',','.');
  else if(t.includes('.')){
    const a=t.split('.');
    if(a.length === 2 && a[1].length === 3 && a[0] !== '0' && a[0] !== '-0') t=a.join('');
  }
  const n=Number(t);
  return Number.isFinite(n) ? n : null;
}
function vaporParseRange(rango){
  let s=String(rango ?? '').trim()
    .replace(/˂/g,'<').replace(/≤/g,'<=').replace(/≥/g,'>=')
    .replace(/[−–—]/g,'-');
  if(!s || s === '-' || s === '--') return {tipo:'none',min:null,max:null};
  const raw=s.match(/[-+]?\d[\d.,]*/g) || [];
  const nums=raw.map(vaporNumeroLocal).filter(v=>v !== null);
  if(s.includes('<=') || /(^|[^>])</.test(s)) return {tipo:'max',min:null,max:nums[0] ?? null};
  if(s.includes('>=') || s.includes('>')) return {tipo:'min',min:nums[0] ?? null,max:null};
  if(nums.length >= 2 && s.includes('-')) return {tipo:'band',min:nums[0],max:nums[1]};
  return {tipo:'none',min:null,max:null};
}
function vaporUnidad(rango, variable){
  const s=(String(rango ?? '')+' '+String(variable ?? '')).toLowerCase();
  if(s.includes('mg/l')) return 'mg/L';
  if(s.includes('°c')) return '°C';
  if(s.includes('us/cm') || s.includes('µs/cm') || s.includes('μs/cm')) return 'µS/cm';
  return '';
}
function normalizarFechaVapor(v){
  if(v == null || v === '') return '';
  if(typeof v === 'number' && Number.isFinite(v)){
    const d=new Date(Date.UTC(1899,11,30) + v*86400000);
    return d.toISOString().slice(0,10);
  }
  const s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if(m){
    let y=Number(m[3]); if(y < 100) y += 2000;
    return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
  }
  return '';
}
function vaporFechaDesdeNombre(nombre){
  const m=String(nombre || '').match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if(!m) return '';
  return `20${m[3]}-${m[2]}-${m[1]}`;
}
function etiquetaFechaVapor(iso, larga=false){
  if(!iso) return 'Sin fecha';
  const [y,m,d]=iso.split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d));
  return dt.toLocaleDateString('es-VE', larga
    ? {day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}
    : {day:'2-digit',month:'2-digit',timeZone:'UTC'});
}
function vaporDefPorId(id){
  for(const p of VAPOR_PROCESOS){
    const v=(p.variables||[]).find(x=>x.id===id);
    if(v) return v;
  }
  return null;
}
function estadoValorVapor(v, valor){
  if(!tieneLecturaVapor(valor)) return 'SIN DATO';
  if(!v || v.tipo === 'none') return 'INFORMATIVO';
  const n=Number(valor);
  if(!Number.isFinite(n)) return 'SIN DATO';
  if(v.min != null && n < Number(v.min)) return 'FUERA DE RANGO';
  if(v.max != null && n > Number(v.max)) return 'FUERA DE RANGO';
  return 'NORMAL';
}
function estadoRegistroVapor(r){
  if(!r) return 'SIN DATO';
  const v=vaporDefPorId(r.id);
  return estadoValorVapor(v,r.valor);
}
function claseEstadoVapor(st){
  if(st === 'FUERA DE RANGO') return 'bad';
  if(st === 'NORMAL') return 'ok';
  if(st === 'INFORMATIVO') return 'info';
  return 'empty';
}
function vaporNumeroTexto(n){
  if(n == null || n === '' || !Number.isFinite(Number(n))) return '—';
  const x=Number(n);
  const dec=Math.abs(x) < 10 && Math.abs(x-Math.round(x)) > 1e-9 ? 2 : (Math.abs(x-Math.round(x)) > 1e-9 ? 1 : 0);
  return x.toLocaleString('es-VE',{minimumFractionDigits:0,maximumFractionDigits:dec});
}
function valorTextoVapor(r){
  if(!r || !tieneLecturaVapor(r.valor)) return '—';
  return vaporNumeroTexto(Number(r.valor));
}
function registrosFechaVapor(fecha=VAPOR_FECHA, proceso=null){
  return VAPOR_DATA.filter(r=>r.fecha===fecha && (!proceso || r.proceso===proceso));
}
function registroVapor(variableId, turno, fecha=VAPOR_FECHA){
  return VAPOR_DATA.find(r=>r.fecha===fecha && r.turno===turno && r.id===variableId) || null;
}
function operadoresFechaVapor(fecha=VAPOR_FECHA){
  const out={};
  VAPOR_TURNOS.forEach(t=>{
    const r=VAPOR_DATA.find(x=>x.fecha===fecha && x.turno===t && x.operador);
    out[t]=r ? r.operador : '';
  });
  return out;
}
function vaporStats(proceso=null, fecha=VAPOR_FECHA){
  const p=proceso ? (typeof proceso==='string' ? VAPOR_PROCESOS.find(x=>x.nombre===proceso) : proceso) : null;
  const vars=p ? vaporVariables(p) : VAPOR_PROCESOS.flatMap(vaporVariables);
  const rows=registrosFechaVapor(fecha,p ? p.nombre : null);
  const controladas=rows.filter(r=>{
    const v=vaporDefPorId(r.id);
    return v && v.tipo !== 'none' && tieneLecturaVapor(r.valor);
  });
  const desviaciones=controladas.filter(r=>estadoRegistroVapor(r)==='FUERA DE RANGO').length;
  const normales=controladas.filter(r=>estadoRegistroVapor(r)==='NORMAL').length;
  return {
    variables:vars.length,
    registradas:rows.filter(r=>tieneLecturaVapor(r.valor)).length,
    controladas:controladas.length,
    desviaciones,
    normales,
    pctNormal:controladas.length ? normales/controladas.length*100 : 0
  };
}
function vaporEstado(st){
  if(!st || !st.registradas) return {st:'idle',txt:'Sin registros'};
  if(st.desviaciones) return {st:'crit',txt:`${st.desviaciones} fuera de rango`};
  if(st.controladas) return {st:'ok',txt:'Normal'};
  return {st:'idle',txt:'Informativo'};
}
function vaporVentana7Dias(){
  if(!VAPOR_FECHAS.length) return [];
  const idx=Math.max(0,VAPOR_FECHAS.indexOf(VAPOR_FECHA));
  return VAPOR_FECHAS.slice(Math.max(0,idx-6),idx+1);
}
function vaporVariableGrafica(proceso){
  const vars=vaporVariables(proceso);
  if(!vars.length) return null;
  const id=VAPOR_GRAFICA_VAR[proceso.nombre];
  if(id){
    const f=vars.find(v=>v.id===id);
    if(f) return f;
  }
  const conDato=vars.find(v=>v.frecuencia==='Diaria' && v.tipo!=='none' &&
    VAPOR_TURNOS.some(t=>registroVapor(v.id,t,VAPOR_FECHA)));
  const candidata=conDato || vars.find(v=>v.frecuencia==='Diaria' && v.tipo!=='none') || vars.find(v=>v.tipo!=='none') || vars[0];
  VAPOR_GRAFICA_VAR[proceso.nombre]=candidata.id;
  return candidata;
}
function vaporLimitesGrafica(v,valores){
  let nums=valores.filter(x=>Number.isFinite(Number(x))).map(Number);
  if(v.min != null) nums.push(Number(v.min));
  if(v.max != null) nums.push(Number(v.max));
  if(!nums.length) return {lo:0,hi:1};
  let lo=Math.min(...nums), hi=Math.max(...nums);
  if(lo===hi){ const p=Math.abs(lo)*.12 || 1; lo-=p; hi+=p; }
  const p=(hi-lo)*.15 || 1;
  lo-=p; hi+=p;
  if(lo>=0 && lo-p<0) lo=0;
  return {lo,hi};
}
function vaporEjes(v,valores,W=640,H=235){
  const pad={l:55,r:18,t:14,b:34};
  const lim=vaporLimitesGrafica(v,valores);
  const y=n=>pad.t + (lim.hi-Number(n))/(lim.hi-lim.lo)*(H-pad.t-pad.b);
  let svg='';
  for(let i=0;i<=4;i++){
    const val=lim.lo+(lim.hi-lim.lo)*i/4;
    const yy=y(val);
    svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.line}" stroke-width="1"/>`;
    svg+=`<text x="${pad.l-8}" y="${(yy+4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="${C.ink3}">${esc(vaporNumeroTexto(val))}</text>`;
  }
  const left=pad.l,right=W-pad.r,top=pad.t,bottom=H-pad.b;
  if(v.tipo==='band' && v.min!=null && v.max!=null){
    const y1=y(v.min), y2=y(v.max);
    svg+=`<rect x="${left}" y="${Math.min(y1,y2).toFixed(1)}" width="${right-left}" height="${Math.abs(y2-y1).toFixed(1)}" fill="${C.vapor}" opacity=".08"/>`;
    [v.min,v.max].forEach(n=>{
      const yy=y(n);
      svg+=`<line x1="${left}" y1="${yy.toFixed(1)}" x2="${right}" y2="${yy.toFixed(1)}" stroke="${C.crit}" stroke-width="1" stroke-dasharray="5 4" opacity=".72"/>`;
    });
  } else if(v.tipo==='max' && v.max!=null){
    const yy=y(v.max);
    svg+=`<line x1="${left}" y1="${yy.toFixed(1)}" x2="${right}" y2="${yy.toFixed(1)}" stroke="${C.crit}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    svg+=`<text x="${right-3}" y="${(yy-5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.crit}">máx. ${esc(vaporNumeroTexto(v.max))}</text>`;
  } else if(v.tipo==='min' && v.min!=null){
    const yy=y(v.min);
    svg+=`<line x1="${left}" y1="${yy.toFixed(1)}" x2="${right}" y2="${yy.toFixed(1)}" stroke="${C.crit}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    svg+=`<text x="${right-3}" y="${(yy-5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.crit}">mín. ${esc(vaporNumeroTexto(v.min))}</text>`;
  }
  return {svg,y,pad,lo:lim.lo,hi:lim.hi,W,H};
}
function renderVaporDia(host,proceso,v){
  if(!host || !v) return;
  const regs=VAPOR_TURNOS.map(t=>registroVapor(v.id,t,VAPOR_FECHA));
  const vals=regs.filter(Boolean).map(r=>Number(r.valor)).filter(Number.isFinite);
  if(!vals.length){
    host.innerHTML=`<div class="ptar-chart-empty">Sin lecturas de ${esc(v.variable)} para ${etiquetaFechaVapor(VAPOR_FECHA,true)}.</div>`;
    return;
  }
  const ax=vaporEjes(v,vals), {W,H,pad,y}=ax;
  const xs=[pad.l+90,W-pad.r-90];
  let g=ax.svg;
  const pts=[];
  regs.forEach((r,i)=>{
    const x=xs[i];
    g+=`<text x="${x}" y="${H-10}" text-anchor="middle" font-size="10.5" fill="${C.ink3}">${VAPOR_TURNOS[i]}</text>`;
    if(!r || !Number.isFinite(Number(r.valor))) return;
    const yy=y(Number(r.valor)), st=estadoRegistroVapor(r);
    const color=st==='FUERA DE RANGO' ? C.crit : C.vapor;
    pts.push([x,yy]);
    g+=`<circle cx="${x}" cy="${yy.toFixed(1)}" r="${st==='FUERA DE RANGO'?5:4}" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${esc(VAPOR_TURNOS[i]+' · '+valorTextoVapor(r)+(v.unidad?' '+v.unidad:'')+' · '+st)}</title></circle>`;
    g+=`<text x="${x}" y="${(yy-10).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="${color}">${esc(valorTextoVapor(r))}</text>`;
  });
  if(pts.length===2){
    g+=`<line x1="${pts[0][0]}" y1="${pts[0][1].toFixed(1)}" x2="${pts[1][0]}" y2="${pts[1][1].toFixed(1)}" stroke="${C.vapor}" stroke-width="2" opacity=".55"/>`;
  }
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(v.variable+' del día')}">${g}</svg>`;
}
function registrosHistoricosVariableVapor(v){
  if(!v) return [];
  const orderTurno=t=>t==='07:00'?0:(t==='19:00'?1:2);
  return VAPOR_DATA
    .filter(r=>r.id===v.id && Number.isFinite(Number(r.valor)))
    .slice()
    .sort((a,b)=> a.fecha.localeCompare(b.fecha) || orderTurno(a.turno)-orderTurno(b.turno));
}
function fechasHistoricasVariableVapor(v){
  return [...new Set(registrosHistoricosVariableVapor(v).map(r=>r.fecha))].sort();
}
function resumenDesviacionesHistoricasVapor(v){
  const rows=registrosHistoricosVariableVapor(v);
  const devs=rows.filter(r=>estadoRegistroVapor(r)==='FUERA DE RANGO');
  return {rows,devs,fechas:[...new Set(rows.map(r=>r.fecha))].sort()};
}
function renderVaporHistoricoCompleto(host,v){
  if(!host || !v) return;
  const info=resumenDesviacionesHistoricasVapor(v);
  const rows=info.rows;
  const fechas=info.fechas;
  const vals=rows.map(r=>Number(r.valor)).filter(Number.isFinite);
  if(!vals.length){
    host.innerHTML=`<div class="ptar-chart-empty">Sin registros históricos de ${esc(v.variable)} en el archivo.</div>`;
    return;
  }

  const W=760,H=255;
  const ax=vaporEjes(v,vals,W,H), {pad,y}=ax;
  const x=i=> fechas.length<2
    ? (pad.l + (W-pad.r))/2
    : pad.l + i*(W-pad.l-pad.r)/(fechas.length-1);

  let g=ax.svg;
  const maxLabels=11, step=Math.max(1,Math.ceil(fechas.length/maxLabels));const ultLbl=fechas.length-1, idxLbl=[];for(let q=0;q<fechas.length;q+=step) idxLbl.push(q);if(idxLbl[idxLbl.length-1]!==ultLbl){if(ultLbl-idxLbl[idxLbl.length-1]<step*0.6) idxLbl.pop();idxLbl.push(ultLbl);}fechas.forEach((f,i)=>{if(!idxLbl.includes(i)) return;g+=`<text x="${x(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="9.4" fill="${C.ink3}">${esc(etiquetaFechaVapor(f))}</text>`;});

  VAPOR_TURNOS.forEach((turn,si)=>{
    const color=si===0 ? C.vapor : C.ink;
    const pts=[];
    fechas.forEach((f,i)=>{
      const r=registroVapor(v.id,turn,f);
      if(!r || !Number.isFinite(Number(r.valor))) return;
      pts.push([x(i),y(Number(r.valor)),r]);
    });

    if(pts.length>1){
      const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
      g+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>`;
    }

    pts.forEach(p=>{
      const st=estadoRegistroVapor(p[2]);
      const fuera=st==='FUERA DE RANGO';
      const pointColor=fuera ? C.crit : color;
      g+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${fuera?5.2:3.6}" fill="${pointColor}" stroke="#fff" stroke-width="${fuera?1.7:1.2}">
        <title>${esc(etiquetaFechaVapor(p[2].fecha,true)+' · '+turn+' · '+valorTextoVapor(p[2])+(v.unidad?' '+v.unidad:'')+' · '+st)}</title>
      </circle>`;
    });
  });

  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc('Histórico completo · '+v.variable)}">${g}</svg>
    <div class="ptar-chart-legend">
      <span><i style="--k:${C.vapor}"></i>07:00</span>
      <span><i style="--k:${C.ink}"></i>19:00</span>
      <span><i style="--k:${C.crit}"></i>Fuera de rango</span>
      <span class="ptar-chart-range">${esc(v.rango || 'Sin rango definido')}</span>
    </div>`;
}
function textoDesviacionesHistoricasVapor(v,limit=4){
  const devs=resumenDesviacionesHistoricasVapor(v).devs;
  if(!devs.length) return '';
  const partes=devs.slice(0,limit).map(r=>`${etiquetaFechaVapor(r.fecha)} ${r.turno} · ${valorTextoVapor(r)}${v.unidad?' '+v.unidad:''}`);
  const resto=devs.length-limit;
  return partes.join(' · ')+(resto>0?` · +${resto} más`:'');
}
function vaporSeleccionHistorico(proceso){
  const vars=vaporVariables(proceso);
  const actual=VAPOR_HISTORICO_SEL[proceso.nombre] || '__all__';
  if(actual==='__all__' || vars.some(v=>v.id===actual)) return actual;
  VAPOR_HISTORICO_SEL[proceso.nombre]='__all__';
  return '__all__';
}
function pintarGraficasVapor(){
  const host=document.getElementById('vapor-graficas-procesos');
  if(!host || !VAPOR_PROCESOS.length) return;

  host.innerHTML=VAPOR_PROCESOS.map((p,pi)=>{
    const todas=vaporVariables(p);
    const v=vaporVariableGrafica(p);
    const opciones=todas.map(x=>
      `<option value="${esc(x.id)}"${x.id===v.id?' selected':''}>${esc(x.variable)} · ${esc(x.frecuencia)}</option>`
    ).join('');
    const histSel=vaporSeleccionHistorico(p);
    const opcionesHistorico=`<option value="__all__"${histSel==='__all__'?' selected':''}>Todas las gráficas</option>`+
      todas.map(x=>`<option value="${esc(x.id)}"${x.id===histSel?' selected':''}>${esc(x.variable)} · ${esc(x.frecuencia)}</option>`).join('');
    const varsHistoricas=histSel==='__all__' ? todas : todas.filter(x=>x.id===histSel);

    const historicos=varsHistoricas.map(hv=>{
      const vi=todas.findIndex(x=>x.id===hv.id);
      const info=resumenDesviacionesHistoricasVapor(hv);
      const nReg=info.rows.length;
      const nDias=info.fechas.length;
      const nDev=info.devs.length;
      const badge=nReg
        ? (nDev
            ? `<span class="pill crit"><i></i>${nDev} fuera de rango</span>`
            : `<span class="pill ${hv.tipo==='none'?'idle':'ok'}"><i></i>${hv.tipo==='none'?'Informativo':'Sin desviaciones'}</span>`)
        : `<span class="pill idle"><i></i>Sin registros</span>`;
      const devTxt=nDev ? textoDesviacionesHistoricasVapor(hv) : '';

      return `<article class="vapor-history-var-card ${nDev?'has-history-dev':''}" aria-labelledby="vapor-hist-${pi}-${vi}">
        <div class="vapor-history-var-head">
          <div class="vapor-history-var-title">
            <h5 id="vapor-hist-${pi}-${vi}">${esc(hv.variable)}</h5>
            <div class="vapor-history-var-meta">
              <span>${esc(hv.frecuencia || '—')}</span>
              <span>Rango: ${esc(hv.rango || '—')}</span>
              ${hv.unidad?`<span>Unidad: ${esc(hv.unidad)}</span>`:''}
              <span>${nReg} lectura${nReg===1?'':'s'} · ${nDias} día${nDias===1?'':'s'} con registro</span>
            </div>
          </div>
          ${badge}
        </div>
        <div class="ptar-process-chart vapor-history-chart" data-vapor-chart-history="${pi}-${vi}"></div>
        ${devTxt?`<div class="vapor-history-dev-note"><b>Desviaciones:</b> ${esc(devTxt)}</div>`:''}
      </article>`;
    }).join('');

    return `<section class="card ptar-chart-process-card vapor-theme vapor-process-charts" aria-labelledby="vapor-chart-${pi}">
      <div class="card-h">
        <div>
          <h3 id="vapor-chart-${pi}">${esc(p.nombre)}</h3>
          <span class="vapor-process-chart-sub">${todas.length} variables · histórico completo según días con registro</span>
        </div>
        <label class="ptar-chart-selector">Variable para lectura del día
          <select data-vapor-chart-process="${pi}" aria-label="Variable del día a graficar de ${esc(p.nombre)}">${opciones}</select>
        </label>
      </div>

      <div class="card-b">
        <div class="vapor-day-block">
          <div class="ptar-chart-meta">
            <strong>${esc(v.variable)}</strong>
            <span>${esc(v.frecuencia)}</span>
            <span>Rango: ${esc(v.rango || '—')}</span>
            ${v.unidad ? `<span>Unidad: ${esc(v.unidad)}</span>` : ''}
          </div>
          <div class="ptar-chart-panel vapor-day-panel">
            <div class="ptar-chart-panel-h">
              <h4>Lecturas del día seleccionado</h4>
              <span class="sub">${etiquetaFechaVapor(VAPOR_FECHA,true)} · 07:00 / 19:00</span>
            </div>
            <div class="ptar-process-chart" data-vapor-chart-day="${pi}"></div>
          </div>
        </div>

        <div class="vapor-all-history">
          <div class="vapor-all-history-h">
            <div>
              <h4>Comportamiento histórico de todas las variables</h4>
              <p>Selecciona una gráfica específica o muestra todas las variables del proceso.</p>
            </div>
            <div class="history-toolbar">
              <label class="history-chart-selector">Gráfica a visualizar
                <select data-vapor-history-selector="${pi}" aria-label="Gráfica histórica a visualizar de ${esc(p.nombre)}">${opcionesHistorico}</select>
              </label>
              <span class="vapor-history-key"><i></i>Los puntos rojos indican lecturas fuera del rango de operación.</span>
            </div>
          </div>
          <div class="vapor-history-grid ${histSel==='__all__'?'':'is-single'}">${historicos}</div>
        </div>
      </div>
    </section>`;
  }).join('');

  VAPOR_PROCESOS.forEach((p,pi)=>{
    const todas=vaporVariables(p), v=vaporVariableGrafica(p), histSel=vaporSeleccionHistorico(p);
    renderVaporDia(host.querySelector(`[data-vapor-chart-day="${pi}"]`),p,v);
    const varsHistoricas=histSel==='__all__' ? todas : todas.filter(x=>x.id===histSel);
    varsHistoricas.forEach(hv=>{
      const vi=todas.findIndex(x=>x.id===hv.id);
      renderVaporHistoricoCompleto(
        host.querySelector(`[data-vapor-chart-history="${pi}-${vi}"]`),
        hv
      );
    });
  });

  host.querySelectorAll('[data-vapor-chart-process]').forEach(sel=>{
    sel.addEventListener('change',()=>{
      const pi=Number(sel.dataset.vaporChartProcess), p=VAPOR_PROCESOS[pi];
      if(!p) return;
      VAPOR_GRAFICA_VAR[p.nombre]=sel.value;
      pintarGraficasVapor();
    });
  });
  host.querySelectorAll('[data-vapor-history-selector]').forEach(sel=>{
    sel.addEventListener('change',()=>{
      const pi=Number(sel.dataset.vaporHistorySelector), p=VAPOR_PROCESOS[pi];
      if(!p) return;
      VAPOR_HISTORICO_SEL[p.nombre]=sel.value;
      pintarGraficasVapor();
    });
  });
}
function poblarFechasVapor(){
  const sels=[document.getElementById('vapor-date-select'),document.getElementById('vapor-summary-date-select')].filter(Boolean);
  sels.forEach(sel=>{
    sel.innerHTML=VAPOR_FECHAS.map(f=>`<option value="${f}">${etiquetaFechaVapor(f,true)}</option>`).join('');
    sel.value=VAPOR_FECHA || '';
    if(!sel.dataset.bound){
      sel.dataset.bound='1';
      sel.addEventListener('change',()=>{
        VAPOR_FECHA=sel.value;
        sels.forEach(s=>s.value=VAPOR_FECHA);
        pintarVapor();
        pintarValores();
        pintarEncabezado();
        pintarPrioridades();
      });
    }
  });
}
function vaporVentanaHistorial(){
  return vaporVentana7Dias();
}
function pintarHistorialVapor(){
  const host=document.getElementById('vapor-historial');
  if(!host) return;
  const fechas=vaporVentanaHistorial();
  host.innerHTML=`<div class="ptar-history">${fechas.map(f=>{
    const st=vaporStats(null,f), pct=st.controladas?st.pctNormal:0;
    const meta=st.registradas ? `${st.controladas ? pct.toFixed(1)+'%' : '—'} · ${st.desviaciones} fuera` : 'Sin registros';
    return `<div class="ptar-history-row ${f===VAPOR_FECHA?'is-selected':''}">
      <span class="ptar-history-date">${etiquetaFechaVapor(f)}</span>
      <span class="ptar-history-meter"><i style="width:${pct.toFixed(1)}%"></i></span>
      <span class="ptar-history-meta"><b>${st.controladas?pct.toFixed(1)+'%':'—'}</b> · ${esc(meta.split(' · ').slice(1).join(' · ') || meta)}</span>
    </div>`;
  }).join('')}</div>`;
}
function pintarDesviacionesVapor(){
  const host=document.getElementById('vapor-desviaciones');
  const count=document.getElementById('vapor-desv-count');
  if(!host) return;
  const list=registrosFechaVapor().filter(r=>estadoRegistroVapor(r)==='FUERA DE RANGO');
  if(count) count.textContent=list.length ? `${list.length} detectada${list.length===1?'':'s'}` : 'ninguna';
  host.innerHTML=list.length ? list.map(r=>{
    const v=vaporDefPorId(r.id);
    return `<div class="ptar-dev">
      <span class="bar" style="background:${C.crit}"></span>
      <div class="body">
        <div class="title">${esc(r.variable)} · ${valorTextoVapor(r)}${v && v.unidad?' '+esc(v.unidad):''}</div>
        <div class="meta">${esc(r.proceso)} · ${esc(r.frecuencia)} · rango ${esc(r.rango || '—')}</div>
        ${r.operador?`<div class="obs">Operador: ${esc(r.operador)}</div>`:''}
        ${r.observacion?`<div class="obs">${esc(r.observacion)}</div>`:''}
      </div>
      <time>${esc(r.turno)}</time>
    </div>`;
  }).join('') : `<p class="empty">No hay variables registradas fuera de rango el ${etiquetaFechaVapor(VAPOR_FECHA,true)}.</p>`;
}
function pintarVapor(){
  if(!VAPOR_PROCESOS.length) return;
  poblarFechasVapor();
  const total=vaporStats();
  const eTotal=vaporEstado(total);

  document.querySelectorAll('[data-vapor-summary-count]').forEach(el=>el.textContent=String(total.registradas));
  const sumPill=document.querySelector('[data-vapor-summary-pill]');
  if(sumPill){
    sumPill.className='pill '+eTotal.st;
    sumPill.innerHTML='<i></i>'+esc(eTotal.txt);
  }
  const stripVal=document.querySelector('[data-vapor-strip-value]');
  if(stripVal) stripVal.textContent=String(total.desviaciones);
  const stripPill=document.querySelector('[data-vapor-strip-pill]');
  if(stripPill){
    stripPill.className='pill '+eTotal.st;
    stripPill.innerHTML='<i></i>'+esc(eTotal.txt);
  }

  const resumen=document.getElementById('vapor-resumen-procesos');
  if(resumen){
    resumen.innerHTML=VAPOR_PROCESOS.map(p=>{
      const st=vaporStats(p), e=vaporEstado(st);
      return `<div class="ptar-summary-process">
        <div class="ptar-summary-process-h"><strong>${esc(p.nombre)}</strong><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span></div>
        <div class="ptar-summary-process-v"><b>${st.variables}</b> variables · ${st.registradas} lecturas · ${st.desviaciones} fuera</div>
        <div class="ptar-progress"><i style="width:${st.controladas?st.pctNormal.toFixed(1):0}%"></i></div>
      </div>`;
    }).join('');
  }

  const kpis=document.getElementById('vapor-kpis-proceso');
  if(kpis){
    kpis.innerHTML=VAPOR_PROCESOS.map(p=>{
      const st=vaporStats(p), e=vaporEstado(st);
      return `<div class="kpi vapor-process-kpi">
        <div class="lbl"><span>${esc(p.nombre)}</span><span class="pill ${e.st}" style="margin-left:auto"><i></i>${esc(e.txt)}</span></div>
        <div class="v tnum">${st.registradas}<small>lecturas</small></div>
        <div class="rng">${st.variables} variables · ${st.controladas} con rango evaluadas</div>
        <div class="ptar-progress"><i style="width:${st.controladas?st.pctNormal.toFixed(1):0}%"></i></div>
      </div>`;
    }).join('');
  }

  const host=document.getElementById('vapor-procesos');
  if(host){
    const ops=operadoresFechaVapor();
    host.innerHTML=VAPOR_PROCESOS.map((p,pi)=>{
      const st=vaporStats(p), e=vaporEstado(st);
      const rows=vaporVariables(p).map(v=>{
        const regs=VAPOR_TURNOS.map(t=>registroVapor(v.id,t));
        const dev=regs.some(r=>estadoRegistroVapor(r)==='FUERA DE RANGO');
        const celdas=regs.map(r=>{
          const est=estadoRegistroVapor(r), cls=claseEstadoVapor(est);
          return `<td class="num ptar-lectura ${cls}" title="${esc(est)}">${valorTextoVapor(r)}</td>`;
        }).join('');
        return `<tr class="${dev?'has-dev':''}">
          <td>${esc(v.variable)}</td>
          <td>${esc(v.frecuencia)}</td>
          <td class="ptar-rango tnum">${esc(v.rango || '—')}</td>
          ${celdas}
        </tr>`;
      }).join('');
      return `<section class="card ptar-process-card vapor-theme" aria-labelledby="vapor-proceso-${pi}">
        <div class="card-h">
          <h3 id="vapor-proceso-${pi}">${esc(p.nombre)}</h3>
          <span class="pill ${e.st}"><i></i>${esc(e.txt)}</span>
          <span class="note">${etiquetaFechaVapor(VAPOR_FECHA,true)} · ${st.registradas} lecturas</span>
        </div>
        <div class="card-b ptar-table-wrap">
          <table class="tbl ptar-table vapor-table">
            <thead><tr>
              <th>Variable de control</th>
              <th>Frecuencia</th>
              <th>Rango de operación</th>
              <th class="num">07:00${ops['07:00']?`<small>${esc(ops['07:00'])}</small>`:''}</th>
              <th class="num">19:00${ops['19:00']?`<small>${esc(ops['19:00'])}</small>`:''}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
    }).join('');
  }

  pintarGraficasVapor();
  pintarHistorialVapor();
  pintarDesviacionesVapor();
}
function normalizarFilasVapor(rows){
  return (rows||[]).map(r=>{
    const fecha=normalizarFechaVapor(r.Fecha ?? r.fecha);
    const valorRaw=r.Valor ?? r.valor;
    const valor=vaporNumeroLocal(valorRaw);
    return {
      fecha,
      turno:String(r.Turno ?? r.turno ?? '').trim(),
      operador:String(r.Operador ?? r.operador ?? '').trim(),
      proceso:String(r.Proceso ?? r.proceso ?? '').trim(),
      variable:String(r['Variable de control'] ?? r.variable ?? '').trim(),
      frecuencia:String(r.Frecuencia ?? r.frecuencia ?? '').trim(),
      rango:String(r['Rango Operación'] ?? r.Rango ?? r.rango ?? '').trim(),
      valor,
      unidad:String(r.Unidad ?? r.unidad ?? '').trim(),
      tipo:String(r['Tipo Rango'] ?? r.tipo ?? '').trim(),
      min:vaporNumeroLocal(r['Mínimo'] ?? r.min),
      max:vaporNumeroLocal(r['Máximo'] ?? r.max),
      observacion:String(r['Observación'] ?? r.Observacion ?? r.observacion ?? '').trim(),
      fuente:String(r.Fuente ?? r.Hoja ?? r.fuente ?? '').trim(),
      id:String(r.VariableId ?? r.id ?? '').trim()
    };
  }).filter(r=>r.fecha && r.turno && r.id && r.valor !== null);
}
function cargarDatosVapor(rows,fechas,procesos,fuente,tipo='fallback'){
  const norm=normalizarFilasVapor(rows);
  if(!norm.length) throw new Error('El archivo no contiene registros válidos de Vapor.');
  if(procesos && procesos.length) VAPOR_PROCESOS=procesos;
  VAPOR_DATA=norm;
  const dataFechas=[...new Set(norm.map(r=>r.fecha))].sort();
  VAPOR_FECHAS=(fechas && fechas.length ? [...new Set(fechas)] : dataFechas).sort();
  const ultimaConDatos=dataFechas[dataFechas.length-1] || VAPOR_FECHAS[VAPOR_FECHAS.length-1] || null;
  if(!VAPOR_FECHA || !VAPOR_FECHAS.includes(VAPOR_FECHA) || !registrosFechaVapor(VAPOR_FECHA).length) VAPOR_FECHA=ultimaConDatos;
  VAPOR_FUENTE=fuente || VAPOR_FUENTE;
  poblarFechasVapor();
  if(document.body && document.body.dataset.dashboardReady==='1'){
    pintarVapor();
    pintarValores();
    pintarEncabezado();
  }
}
async function leerHojaXLSXVapor(zip,target,shared){
  const parser=new DOMParser();
  const shXml=parser.parseFromString(await zip.text(target),'application/xml');
  const out=new Map();
  [...shXml.getElementsByTagNameNS('*','row')].forEach(row=>{
    const rn=Number(row.getAttribute('r'));
    const arr=[];
    [...row.getElementsByTagNameNS('*','c')].forEach(c=>{
      const idx=colIndexPTAR(c.getAttribute('r'));
      const t=c.getAttribute('t');
      let value='';
      if(t==='inlineStr'){
        value=[...c.getElementsByTagNameNS('*','t')].map(x=>x.textContent||'').join('');
      }else{
        const ve=c.getElementsByTagNameNS('*','v')[0];
        const raw=ve?ve.textContent:'';
        if(t==='s') value=shared[Number(raw)] ?? '';
        else if(t==='str') value=raw;
        else if(raw!==''){
          const n=Number(raw); value=Number.isFinite(n)?n:raw;
        }
      }
      arr[idx]=value;
    });
    out.set(rn,arr);
  });
  return out;
}
async function leerExcelVapor(buffer){
  const zip=await abrirZipPTAR(buffer);
  const parser=new DOMParser();
  const wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml');
  const relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml');
  const rels=[...relXml.getElementsByTagNameNS('*','Relationship')];
  let shared=[];
  if(zip.entries.has('xl/sharedStrings.xml')){
    const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');
    shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));
  }
  const sheets=[...wbXml.getElementsByTagNameNS('*','sheet')].filter(s=>/^\d{2}-\d{2}-\d{2}$/.test(s.getAttribute('name')||''));
  if(!sheets.length) throw new Error('No se encontraron las planillas diarias de calderas.');
  const hojas=[];
  for(const s of sheets){
    const name=s.getAttribute('name');
    const rid=s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id') || s.getAttribute('r:id');
    const rel=rels.find(r=>r.getAttribute('Id')===rid);
    if(!rel) continue;
    let target=rel.getAttribute('Target').replace(/^\//,'');
    if(!target.startsWith('xl/')) target='xl/'+target.replace(/^\.\//,'');
    const rows=await leerHojaXLSXVapor(zip,target,shared);
    hojas.push({name,rows});
  }
  if(!hojas.length) throw new Error('No se pudieron leer las hojas diarias de calderas.');

  const primera=hojas[0].rows;
  const procesos=[], procMap=new Map();
  let procesoActual='';
  let ordinal=0;
  for(let rn=14;rn<=76;rn++){
    const row=primera.get(rn)||[];
    if(tieneLecturaVapor(row[0])) procesoActual=String(row[0]).trim();
    if(!tieneLecturaVapor(row[1])) continue;
    ordinal++;
    const variable=String(row[1]).trim();
    const frecuencia=String(row[2]??'').trim();
    const rango=String(row[3]??'').trim();
    const pr=vaporParseRange(rango);
    const v={id:`vapor_${String(ordinal).padStart(2,'0')}`,fila:rn,proceso:procesoActual,variable,frecuencia,rango,unidad:vaporUnidad(rango,variable),tipo:pr.tipo,min:pr.min,max:pr.max};
    if(!procMap.has(procesoActual)){
      const p={nombre:procesoActual,variables:[]}; procMap.set(procesoActual,p); procesos.push(p);
    }
    procMap.get(procesoActual).variables.push(v);
  }
  const defByRow=new Map(procesos.flatMap(p=>p.variables).map(v=>[v.fila,v]));
  const registros=[], fechas=[];
  for(const h of hojas){
    const r11=h.rows.get(11)||[];
    let fecha=normalizarFechaVapor(r11[1]);
    if(!fecha) fecha=vaporFechaDesdeNombre(h.name);
    if(!fecha) continue;
    fechas.push(fecha);
    const op07=tieneLecturaVapor(r11[4])?String(r11[4]).trim():'';
    const op19=tieneLecturaVapor(r11[5])?String(r11[5]).trim():'';
    const obsProceso={};
    for(let rn=14;rn<=76;rn++){
      const rr=h.rows.get(rn)||[];
      if(tieneLecturaVapor(rr[0]) && tieneLecturaVapor(rr[6])) obsProceso[String(rr[0]).trim()]=String(rr[6]).trim();
    }
    for(const [rn,v] of defByRow.entries()){
      const row=h.rows.get(rn)||[];
      [[ '07:00',row[4],op07 ],[ '19:00',row[5],op19 ]].forEach(([turno,raw,operador])=>{
        if(!tieneLecturaVapor(raw)) return;
        const valor=vaporNumeroLocal(raw);
        if(valor===null) return;
        registros.push({
          Fecha:fecha,Turno:turno,Operador:operador,Proceso:v.proceso,'Variable de control':v.variable,
          Frecuencia:v.frecuencia,'Rango Operación':v.rango,Valor:valor,Unidad:v.unidad,'Tipo Rango':v.tipo,
          'Mínimo':v.min,'Máximo':v.max,'Observación':obsProceso[v.proceso]||'',VariableId:v.id,Hoja:h.name
        });
      });
    }
  }
  return {rows:registros,fechas:[...new Set(fechas)].sort(),procesos};
}
async function cargarExcelVaporArchivo(file,origen='archivo seleccionado'){
  const r=await leerExcelVapor(await file.arrayBuffer());
  cargarDatosVapor(r.rows,r.fechas,r.procesos,`${file.name} · ${r.rows.length} lecturas · ${origen}`,'excel');
}
async function cargarVaporAutomatico(){
  if(location.protocol === 'file:') return;
  try{
    const resp=await fetch('Reporte_Control_Generacion_Vapor_08-09_y_09-09-2026.xlsx',{cache:'no-store'});
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const r=await leerExcelVapor(await resp.arrayBuffer());
    cargarDatosVapor(r.rows,r.fechas,r.procesos,`Reporte_Control_Generacion_Vapor_08-09_y_09-09-2026.xlsx · ${r.rows.length} lecturas · carga automática`,'excel');
  }catch(err){
    // Al abrir con doble clic, el navegador bloquea fetch local. Los datos precargados siguen visibles.
  }
}
function inicializarVaporExcel(){
  const input=document.getElementById('vapor-excel-input');
  if(input && !input.dataset.bound){
    input.dataset.bound='1';
    input.addEventListener('change',async()=>{
      const file=input.files && input.files[0];
      if(!file) return;
      try{ await cargarExcelVaporArchivo(file); }
      catch(err){ alert('No se pudo leer el Excel de Vapor: '+err.message); }
      finally{ input.value=''; }
    });
  }
  cargarVaporAutomatico();
}

if(window.VAPOR_FALLBACK_DATA && window.VAPOR_FALLBACK_DATA.length){
  cargarDatosVapor(
    window.VAPOR_FALLBACK_DATA,
    window.VAPOR_FALLBACK_FECHAS || [],
    window.VAPOR_FALLBACK_PROCESOS || [],
    'Reporte_Control_Generacion_Vapor_08-09_y_09-09-2026.xlsx · datos precargados para apertura local',
    'fallback'
  );
}


/* ---------------------------------------------------------
   8. Tablas de equipos (valores por ronda)
   Una celda puede ser texto fijo, un arreglo de tres lecturas
   o una píldora de estado.
   --------------------------------------------------------- */
const P = (st, txt) => ({pill:true, st, txt});
const pick = (x) => Array.isArray(x) ? x[ronda] : x;

const TABLAS = {
  'tb-ptab':{
    cols:['Equipo','Estado','Volumen tratado','Dureza salida','Próxima regeneración'],
    rows:[
      ['Suavizador S-1', P('ok','En servicio'), ['128 m³','311 m³','486 m³'], ['5.9 ppm','6.8 ppm','8.1 ppm'], ['en 372 m³','en 189 m³','en 14 m³']],
      ['Suavizador S-2', P('ok','En servicio'), ['96 m³','338 m³','502 m³'], ['6.1 ppm','7.4 ppm','8.6 ppm'], ['en 404 m³','en 162 m³','pendiente']],
      ['Suavizador S-3', P(['ok','warn','ok'],['En servicio','Regenerando','En servicio']), ['440 m³','500 m³','122 m³'], ['7.8 ppm','—','5.4 ppm'], ['en 60 m³','en curso · 22 min','en 378 m³']],
      ['Filtro multimedia F-1', P(['warn','ok','ok'],['Retrolavando','En servicio','En servicio']), ['—','420 m³','1 240 m³'], '—', ['en curso','retrolavado 22:00','retrolavado 22:00']],
      ['Bomba de red B-101', P(['ok','ok','idle'],['Marcha','Marcha','Reserva']), ['2 106 h','2 110 h','2 118 h'], '—', '—'],
      ['Bomba de red B-102', P(['idle','idle','ok'],['Reserva','Reserva','Marcha']), ['1 903 h','1 903 h','1 909 h'], '—', '—'],
    ]},
  'tb-vapor':{
    cols:['Equipo','Estado','Carga','Horas','Observación'],
    rows:[
      ['Caldera C-1 · 400 BHP', P('ok','Marcha'), ['52 %','78 %','84 %'], ['14 604 h','14 612 h','14 620 h'], ['arranque en frío 05:40','purga automática activa','purga automática activa']],
      ['Caldera C-2 · 250 BHP', P(['idle','idle','ok'],['Reserva','Reserva','Marcha']), ['0 %','0 %','38 %'], ['9 415 h','9 415 h','9 421 h'], ['lista para arranque','lista para arranque','apoyo por pico de CIP']],
      ['Tanque de condensados', P('ok','Normal'), ['58 %','71 %','66 %'], '—', ['retorno a 79 °C','retorno a 84 °C','retorno a 86 °C']],
      ['Desaireador', P('ok','Normal'), '—', '—', ['O₂ 0.008 mg/L','O₂ 0.006 mg/L','O₂ 0.005 mg/L']],
      ['Trampas de vapor', P(['ok','warn','warn'],['Sin novedad','3 con fuga','3 con fuga']), '—', '—', ['revisión programada 09:00','TV-14, TV-27, TV-31','TV-14, TV-27, TV-31']],
    ]},
  'tb-aire':{
    cols:['Equipo','Estado','Carga','Horas','Mantenimiento'],
    rows:[
      ['Compresor CA-1 · tornillo', P('ok','Carga'), ['61 %','82 %','88 %'], ['21 472 h','21 480 h','21 489 h'], ['en 528 h','en 520 h','en 511 h']],
      ['Compresor CA-2 · tornillo', P(['idle','ok','ok'],['Detenido','Carga','Carga']), ['0 %','64 %','71 %'], ['18 894 h','18 902 h','18 911 h'], ['en 1 106 h','en 1 098 h','en 1 089 h']],
      ['Compresor CA-3 · respaldo', P('idle','Detenido'), '0 %', '7 331 h', 'en 2 669 h'],
      ['Secador refrigerativo SD-1', P(['ok','ok','warn'],['Normal','Normal','Exigido']), '—', '—', ['filtro en 15 d','filtro en 14 d','revisar condensador']],
      ['Tanque pulmón · 3 000 L', P('ok','Normal'), '—', '—', 'purga cada 30 min'],
    ]},
  'tb-frio':{
    cols:['Equipo','Estado','Succión','Descarga','Horas'],
    rows:[
      ['Compresor CR-1 · tornillo', P('ok','Marcha'), ['2.4 bar','2.6 bar','2.7 bar'], ['10.8 bar','11.4 bar','12.1 bar'], ['32 102 h','32 110 h','32 119 h']],
      ['Compresor CR-2 · tornillo', P(['idle','ok','ok'],['Detenido','Marcha','Marcha']), ['—','2.5 bar','2.6 bar'], ['—','11.6 bar','12.3 bar'], ['29 736 h','29 744 h','29 753 h']],
      ['Compresor CR-3 · pistón', P('idle','Detenido'), '—', '—', '12 088 h'],
      ['Condensador evaporativo CE-1', P('ok','Marcha'), '—', '—', ['purga 1.8 m³/h','purga 2.1 m³/h','purga 2.4 m³/h']],
      ['Bomba de amoníaco BA-1', P('ok','Marcha'), '—', '—', ['18 252 h','18 260 h','18 269 h']],
    ]},
  'tb-ptar':{
    cols:['Etapa','Estado','Variable','Lectura','Límite'],
    rows:[
      ['Cribado y desarenador', P('ok','Normal'), 'sólidos retirados', ['12 kg','26 kg','38 kg'], '—'],
      ['Trampa de grasas · DAF', P(['ok','ok','warn'],['Normal','Normal','Atención']), 'grasas y aceites', ['38 mg/L','49 mg/L','62 mg/L'], '75 mg/L'],
      ['Tanque de homogeneización', P('ok','Normal'), 'nivel', ['48 %','64 %','77 %'], '—'],
      ['Reactor biológico', P('ok','Normal'), 'SSLM', ['3 180 mg/L','3 240 mg/L','3 310 mg/L'], '2 500 – 4 000'],
      ['Sedimentador secundario', P(['ok','ok','warn'],['Normal','Normal','Atención']), 'SST salida', ['29 mg/L','41 mg/L','68 mg/L'], '75 mg/L'],
      ['Soplador SB-1', P('ok','Marcha'), 'caudal de aire', ['360 Nm³/h','410 Nm³/h','455 Nm³/h'], '—'],
      ['Filtro prensa de lodos', P(['idle','ok','ok'],['Fuera de turno','Marcha','Marcha']), 'sequedad de torta', ['—','21 %','22 %'], '—'],
    ]},
};

function pintarTablas(){
  for(const id in TABLAS){
    const host = document.getElementById(id);
    if(!host) continue;
    const t = TABLAS[id];
    const head = t.cols.map((c,i)=>`<th${i > 1 ? ' class="num"' : ''}>${esc(c)}</th>`).join('');
    const body = t.rows.map(r=>'<tr>' + r.map((cell,i)=>{
      if(cell && cell.pill){
        const st = pick(cell.st), txt = pick(cell.txt);
        return `<td><span class="pill ${st}"><i></i>${esc(txt)}</span></td>`;
      }
      const val = esc(pick(cell));
      return i === 0 ? `<td>${val}</td>` : `<td class="num">${val}</td>`;
    }).join('') + '</tr>').join('');
    host.innerHTML = `<table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
}

/* ---------------------------------------------------------
   9. SUAVIZADORES Y TANQUES DE AGUA · control real desde Excel local
   Procesos: Agua suave de servicios + Agua suave de procesos
   Turnos: 1er turno 06:00 y 2do turno 06:00
   --------------------------------------------------------- */
const SUAV_TURNOS = ['1er Turno','2do Turno'];
const SUAV_TURNO_ETIQUETA = {'1er Turno':'1er turno · 06:00','2do Turno':'2do turno · 06:00'};
let SUAV_PROCESOS = Array.isArray(window.SUAV_FALLBACK_PROCESOS) ? window.SUAV_FALLBACK_PROCESOS : [];
let SUAV_DATA = [];
let SUAV_FECHAS = Array.isArray(window.SUAV_FALLBACK_FECHAS) ? [...window.SUAV_FALLBACK_FECHAS] : [];
let SUAV_FECHA = null;
let SUAV_FUENTE = 'Reporte_Control_Suavizadores_04-09_al_09-09-2026.xlsx';
const SUAV_GRAFICA_VAR = {};
const SUAV_HISTORICO_SEL = {};

const suavVariables = p => p ? (p.puestos || []).flatMap(x=>x.variables || []) : [];
const suavEsVacio = v => v === null || v === undefined || String(v).trim()==='' || ['—','-','--'].includes(String(v).trim());
const tieneLecturaSuav = r => !!r && (!suavEsVacio(r.valor) || !suavEsVacio(r.original));
function suavNumeroLocal(s){ return ptarNumeroLocal(s); }
function normalizarFechaSuav(v){ return normalizarFechaPTAR(v); }
function etiquetaFechaSuav(v,larga=false){ return etiquetaFechaPTAR(v,larga); }
function suavClave(s){ return ptarClave(s); }
function suavProcesoNombre(s){
  const k=suavClave(s);
  if(k==='aguasuaveservicios' || k==='aguasuavedeservicios') return 'Agua suave de servicios';
  if(k==='aguasuavedeprocesos' || k==='aguasuaveprocesos') return 'Agua suave de procesos';
  return String(s||'').trim();
}
function suavTodasVariables(){ return SUAV_PROCESOS.flatMap(suavVariables); }
function suavDefPorId(id){ return suavTodasVariables().find(v=>v.id===id) || null; }
function suavDefPorCampos(proceso,puesto,variable){
  const kp=suavClave(suavProcesoNombre(proceso)), ke=suavClave(puesto), kv=suavClave(variable);
  return suavTodasVariables().find(v=>suavClave(v.proceso)===kp && suavClave(v.puesto)===ke && suavClave(v.variable)===kv)
    || suavTodasVariables().find(v=>suavClave(v.puesto)===ke && suavClave(v.variable)===kv)
    || null;
}
function suavParseRange(rango){
  let s=String(rango ?? '').trim().replace(/˂/g,'<').replace(/≤/g,'<=').replace(/≥/g,'>=').replace(/[−–—]/g,'-');
  if(!s || s==='-' || s==='--' || /^kg$/i.test(s)) return {tipo:'none',min:null,max:null};
  const raw=s.match(/[-+]?\d[\d.,]*/g) || [];
  const nums=raw.map(suavNumeroLocal).filter(v=>v!==null);
  if(s.includes('<=') || /(^|[^>])</.test(s)) return {tipo:'max',min:null,max:nums[0] ?? null};
  if(s.includes('>=') || s.includes('>')) return {tipo:'min',min:nums[0] ?? null,max:null};
  if(nums.length>=2 && s.includes('-')) return {tipo:'band',min:nums[0],max:nums[1]};
  return {tipo:'none',min:null,max:null};
}
function construirProcesosSuavDesdeFilas(rows){
  const defs=[], seen=new Map();
  (rows||[]).forEach(r=>{
    const proceso=suavProcesoNombre(r.Proceso ?? r.proceso ?? '');
    const puesto=String(r.Equipo ?? r['Puesto de trabajo'] ?? r.puesto ?? '').trim();
    const variable=String(r['Variable de Control'] ?? r['Variable de control'] ?? r.Variable ?? r.variable ?? '').trim();
    if(!proceso || !puesto || !variable) return;
    const key=[suavClave(proceso),suavClave(puesto),suavClave(variable)].join('|');
    if(seen.has(key)) return;
    const rango=String(r['Rango de Operación'] ?? r['Rango Operación'] ?? r.rango ?? '—').trim() || '—';
    const pr=suavParseRange(rango), unidad=String(r.Unidad ?? r.unidad ?? '').trim();
    const d={id:`suav_${String(defs.length+1).padStart(2,'0')}`,proceso,puesto,variable,rango,unidad,tipo:pr.tipo,min:pr.min,max:pr.max};
    defs.push(d); seen.set(key,d);
  });
  const ps=[];
  defs.forEach(v=>{
    let p=ps.find(x=>x.nombre===v.proceso); if(!p){p={nombre:v.proceso,puestos:[]};ps.push(p);}
    let e=p.puestos.find(x=>x.nombre===v.puesto); if(!e){e={nombre:v.puesto,variables:[]};p.puestos.push(e);}
    e.variables.push(v);
  });
  return ps;
}
function estadoRegistroSuav(r){
  if(!r || !tieneLecturaSuav(r)) return 'SIN DATO';
  const src=String(r.estadoFuente||'').toUpperCase();
  if(src.includes('FUERA DE RANGO')) return 'FUERA DE RANGO';
  const v=suavDefPorId(r.id);
  if(!v || v.tipo==='none') return 'INFORMATIVO';
  const n=suavNumeroLocal(r.valor);
  if(n===null) return 'SIN DATO';
  if(v.min!=null && n<Number(v.min)) return 'FUERA DE RANGO';
  if(v.max!=null && n>Number(v.max)) return 'FUERA DE RANGO';
  return 'NORMAL';
}
function claseEstadoSuav(st){
  if(st==='FUERA DE RANGO') return 'bad';
  if(st==='NORMAL') return 'ok';
  if(st==='INFORMATIVO') return 'info';
  return 'empty';
}
function suavNumeroTexto(n){ return ptarNumeroTexto(n); }
function valorTextoSuav(r){
  if(!r || !tieneLecturaSuav(r)) return '—';
  if(!suavEsVacio(r.original)){
    if(typeof r.original==='number') return suavNumeroTexto(r.original);
    return esc(String(r.original));
  }
  const n=suavNumeroLocal(r.valor);
  return n===null ? esc(String(r.valor ?? '—')) : suavNumeroTexto(n);
}
function registrosFechaSuav(fecha=SUAV_FECHA,proceso=null){
  return SUAV_DATA.filter(r=>r.fecha===fecha && (!proceso || r.proceso===proceso));
}
function registroSuav(variableId,turno,fecha=SUAV_FECHA){
  return SUAV_DATA.find(r=>r.fecha===fecha && r.turno===turno && r.id===variableId) || null;
}
function operadoresFechaSuav(fecha=SUAV_FECHA){
  const out={};
  SUAV_TURNOS.forEach(t=>{
    const r=SUAV_DATA.find(x=>x.fecha===fecha && x.turno===t && x.operador && tieneLecturaSuav(x));
    out[t]=r?r.operador:'';
  });
  return out;
}
function suavStats(proceso=null,fecha=SUAV_FECHA){
  const p=proceso ? (typeof proceso==='string'?SUAV_PROCESOS.find(x=>x.nombre===proceso):proceso) : null;
  const vars=p?suavVariables(p):SUAV_PROCESOS.flatMap(suavVariables);
  const rows=registrosFechaSuav(fecha,p?p.nombre:null);
  const registradas=rows.filter(tieneLecturaSuav);
  const controladas=registradas.filter(r=>{const v=suavDefPorId(r.id);return v&&v.tipo!=='none'&&suavNumeroLocal(r.valor)!==null;});
  const desviaciones=controladas.filter(r=>estadoRegistroSuav(r)==='FUERA DE RANGO').length;
  const normales=controladas.filter(r=>estadoRegistroSuav(r)==='NORMAL').length;
  return {variables:vars.length,registradas:registradas.length,controladas:controladas.length,desviaciones,normales,pctNormal:controladas.length?normales/controladas.length*100:0};
}
function suavEstado(st){
  if(!st || !st.registradas) return {st:'idle',txt:'Sin registros'};
  if(st.desviaciones) return {st:'crit',txt:`${st.desviaciones} fuera de rango`};
  if(st.controladas) return {st:'ok',txt:'Normal'};
  return {st:'idle',txt:'Informativo'};
}
function suavVariableGrafica(proceso){
  const vars=suavVariables(proceso); if(!vars.length) return null;
  const id=SUAV_GRAFICA_VAR[proceso.nombre]; if(id){const f=vars.find(v=>v.id===id);if(f)return f;}
  const conDatoControl=vars.find(v=>v.tipo!=='none'&&SUAV_TURNOS.some(t=>{const r=registroSuav(v.id,t);return r&&suavNumeroLocal(r.valor)!==null;}));
  const conDato=vars.find(v=>SUAV_TURNOS.some(t=>{const r=registroSuav(v.id,t);return r&&suavNumeroLocal(r.valor)!==null;}));
  const candidata=conDatoControl||conDato||vars.find(v=>v.tipo!=='none')||vars[0];
  SUAV_GRAFICA_VAR[proceso.nombre]=candidata.id; return candidata;
}
function suavLimitesGrafica(v,valores){
  let nums=(valores||[]).map(suavNumeroLocal).filter(x=>x!==null);
  if(v&&v.min!=null) nums.push(Number(v.min)); if(v&&v.max!=null) nums.push(Number(v.max));
  if(!nums.length) return {lo:0,hi:1};
  let lo=Math.min(...nums),hi=Math.max(...nums);
  if(v&&v.tipo==='max'&&lo>=0) lo=0;
  if(lo===hi){const p=Math.abs(lo)*.15||1;lo-=p;hi+=p;} else {const p=(hi-lo)*.12;lo-=p;hi+=p;}
  if(lo>=0)lo=Math.max(0,lo); return {lo,hi};
}
function suavEjes(v,valores,W=640,H=235){
  const pad={t:18,r:18,b:38,l:62},lim=suavLimitesGrafica(v,valores),span=lim.hi-lim.lo||1;
  const y=n=>pad.t+(lim.hi-Number(n))/span*(H-pad.t-pad.b); let svg='';
  for(let i=0;i<=4;i++){const val=lim.lo+span*i/4,yy=y(val);svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.line}" stroke-width="1"/><text x="${pad.l-8}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" font-size="10.2" fill="${C.ink3}">${esc(suavNumeroTexto(val))}</text>`;}
  if(v&&v.tipo==='band'&&v.min!=null&&v.max!=null){const ya=y(v.max),yb=y(v.min);svg+=`<rect x="${pad.l}" y="${Math.min(ya,yb).toFixed(1)}" width="${W-pad.l-pad.r}" height="${Math.abs(yb-ya).toFixed(1)}" fill="${C.suav}" opacity=".08"/><line x1="${pad.l}" y1="${ya.toFixed(1)}" x2="${W-pad.r}" y2="${ya.toFixed(1)}" stroke="${C.suav}" stroke-width="1" stroke-dasharray="4 4" opacity=".75"/><line x1="${pad.l}" y1="${yb.toFixed(1)}" x2="${W-pad.r}" y2="${yb.toFixed(1)}" stroke="${C.suav}" stroke-width="1" stroke-dasharray="4 4" opacity=".75"/>`;}
  else if(v&&v.tipo==='max'&&v.max!=null){const yy=y(v.max);svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.crit}" stroke-width="1.2" stroke-dasharray="5 4"/><text x="${W-pad.r-3}" y="${(yy-5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.crit}">máx. ${esc(suavNumeroTexto(v.max))}</text>`;}
  else if(v&&v.tipo==='min'&&v.min!=null){const yy=y(v.min);svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.crit}" stroke-width="1.2" stroke-dasharray="5 4"/><text x="${W-pad.r-3}" y="${(yy-5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.crit}">mín. ${esc(suavNumeroTexto(v.min))}</text>`;}
  return {svg,y,pad,W,H};
}
function renderSuavDia(host,proceso,v){
  if(!host||!v)return;
  const regs=SUAV_TURNOS.map(t=>registroSuav(v.id,t)),vals=regs.map(r=>r?suavNumeroLocal(r.valor):null).filter(x=>x!==null);
  if(!vals.length){host.innerHTML=`<div class="ptar-chart-empty">Sin lecturas numéricas de ${esc(v.variable)} para ${etiquetaFechaSuav(SUAV_FECHA,true)}.</div>`;return;}
  const ax=suavEjes(v,vals),{W,H,pad,y}=ax,xs=[pad.l+90,W-pad.r-90];let g=ax.svg,pts=[];
  regs.forEach((r,i)=>{const x=xs[i],label=i===0?'1er turno':'2do turno';g+=`<text x="${x}" y="${H-10}" text-anchor="middle" font-size="10.5" fill="${C.ink3}">${label}</text>`;const val=r?suavNumeroLocal(r.valor):null;if(val===null)return;const yy=y(val),st=estadoRegistroSuav(r),color=st==='FUERA DE RANGO'?C.crit:C.suav;pts.push([x,yy]);const orig=!suavEsVacio(r.original)?` · original ${String(r.original)}`:'';g+=`<circle cx="${x}" cy="${yy.toFixed(1)}" r="${st==='FUERA DE RANGO'?5:4}" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${esc(SUAV_TURNO_ETIQUETA[SUAV_TURNOS[i]]+' · '+suavNumeroTexto(val)+(v.unidad?' '+v.unidad:'')+orig+' · '+st)}</title></circle><text x="${x}" y="${Math.max(pad.t+12,yy-8).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${color}">${esc(suavNumeroTexto(val))}</text>`;});
  if(pts.length>1)g+=`<path d="M${pts[0][0]} ${pts[0][1].toFixed(1)} L${pts[1][0]} ${pts[1][1].toFixed(1)}" fill="none" stroke="${C.suav}" stroke-width="2" opacity=".75"/>`;
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(v.variable+' del día')}">${g}</svg>`;
}
function registrosHistoricosVariableSuav(v){
  const ord=t=>t==='1er Turno'?0:(t==='2do Turno'?1:2);
  return SUAV_DATA.filter(r=>r.id===v.id&&suavNumeroLocal(r.valor)!==null).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)||ord(a.turno)-ord(b.turno));
}
function resumenDesviacionesHistoricasSuav(v){const rows=registrosHistoricosVariableSuav(v),devs=rows.filter(r=>estadoRegistroSuav(r)==='FUERA DE RANGO');return {rows,devs,fechas:[...new Set(rows.map(r=>r.fecha))].sort()};}
function renderSuavHistoricoCompleto(host,v){
  if(!host||!v)return;const info=resumenDesviacionesHistoricasSuav(v),rows=info.rows,fechas=info.fechas,vals=rows.map(r=>suavNumeroLocal(r.valor)).filter(x=>x!==null);
  if(!vals.length){host.innerHTML=`<div class="ptar-chart-empty">Sin registros históricos numéricos de ${esc(v.variable)} en el archivo.</div>`;return;}
  const W=760,H=255,ax=suavEjes(v,vals,W,H),{pad,y}=ax,x=i=>fechas.length<2?(pad.l+(W-pad.r))/2:pad.l+i*(W-pad.l-pad.r)/(fechas.length-1);let g=ax.svg;
  const maxLabels=11, stepLbl=Math.max(1,Math.ceil(fechas.length/maxLabels));const ultLbl=fechas.length-1, idxLbl=[];for(let q=0;q<fechas.length;q+=stepLbl) idxLbl.push(q);if(idxLbl[idxLbl.length-1]!==ultLbl){if(ultLbl-idxLbl[idxLbl.length-1]<stepLbl*0.6) idxLbl.pop();idxLbl.push(ultLbl);}fechas.forEach((f,i)=>{if(!idxLbl.includes(i)) return;g+=`<text x="${x(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="9.4" fill="${C.ink3}">${esc(etiquetaFechaSuav(f))}</text>`;});
  SUAV_TURNOS.forEach((turn,si)=>{const color=si===0?C.suav:C.ink,pts=[];fechas.forEach((f,i)=>{const r=registroSuav(v.id,turn,f),val=r?suavNumeroLocal(r.valor):null;if(val!==null)pts.push([x(i),y(val),r,val]);});if(pts.length>1){const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');g+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>`;}pts.forEach(p=>{const st=estadoRegistroSuav(p[2]),fuera=st==='FUERA DE RANGO',pc=fuera?C.crit:color;g+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${fuera?5.2:3.6}" fill="${pc}" stroke="#fff" stroke-width="${fuera?1.7:1.2}"><title>${esc(etiquetaFechaSuav(p[2].fecha,true)+' · '+SUAV_TURNO_ETIQUETA[turn]+' · '+suavNumeroTexto(p[3])+(v.unidad?' '+v.unidad:'')+' · '+st)}</title></circle>`;});});
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc('Histórico completo · '+v.variable)}">${g}</svg><div class="ptar-chart-legend"><span><i style="--k:${C.suav}"></i>1er turno · 06:00</span><span><i style="--k:${C.ink}"></i>2do turno · 06:00</span><span><i style="--k:${C.crit}"></i>Fuera de rango</span><span class="ptar-chart-range">${esc(v.rango||'Sin rango definido')}</span></div>`;
}
function textoDesviacionesHistoricasSuav(v,limit=4){const devs=resumenDesviacionesHistoricasSuav(v).devs;if(!devs.length)return '';const partes=devs.slice(0,limit).map(r=>`${etiquetaFechaSuav(r.fecha)} ${r.turno} · ${valorTextoSuav(r)}${v.unidad?' '+v.unidad:''}`);return partes.join(' · ')+(devs.length>limit?` · +${devs.length-limit} más`:'');}
function suavSeleccionHistorico(p){const vars=suavVariables(p),actual=SUAV_HISTORICO_SEL[p.nombre]||'__all__';if(actual==='__all__'||vars.some(v=>v.id===actual))return actual;SUAV_HISTORICO_SEL[p.nombre]='__all__';return '__all__';}
function pintarGraficasSuav(){
  const host=document.getElementById('suav-graficas-procesos');if(!host||!SUAV_PROCESOS.length)return;
  host.innerHTML=SUAV_PROCESOS.map((p,pi)=>{const todas=suavVariables(p),v=suavVariableGrafica(p),opciones=todas.map(x=>`<option value="${esc(x.id)}"${x.id===v.id?' selected':''}>${esc(x.variable)} · ${esc(x.puesto)}</option>`).join(''),histSel=suavSeleccionHistorico(p),opHist=`<option value="__all__"${histSel==='__all__'?' selected':''}>Todas las gráficas</option>`+todas.map(x=>`<option value="${esc(x.id)}"${x.id===histSel?' selected':''}>${esc(x.variable)} · ${esc(x.puesto)}</option>`).join(''),varsHist=histSel==='__all__'?todas:todas.filter(x=>x.id===histSel),historicos=varsHist.map(hv=>{const vi=todas.findIndex(x=>x.id===hv.id),info=resumenDesviacionesHistoricasSuav(hv),nReg=info.rows.length,nDias=info.fechas.length,nDev=info.devs.length,multiple=info.rows.some(r=>typeof r.original==='string'&&r.original.includes('/'));const badge=nReg?(nDev?`<span class="pill crit"><i></i>${nDev} fuera de rango</span>`:`<span class="pill ${hv.tipo==='none'?'idle':'ok'}"><i></i>${hv.tipo==='none'?'Informativo':'Sin desviaciones'}</span>`):`<span class="pill idle"><i></i>Sin registros</span>`;return `<article class="ptar-history-var-card ${nDev?'has-history-dev':''}" aria-labelledby="suav-hist-${pi}-${vi}"><div class="ptar-history-var-head"><div class="ptar-history-var-title"><h5 id="suav-hist-${pi}-${vi}">${esc(hv.variable)}</h5><div class="ptar-history-var-meta"><span>${esc(hv.puesto)}</span><span>Rango: ${esc(hv.rango||'—')}</span>${hv.unidad?`<span>Unidad: ${esc(hv.unidad)}</span>`:''}<span>${nReg} lectura${nReg===1?'':'s'} · ${nDias} día${nDias===1?'':'s'} con registro</span>${multiple?'<span>Gráfica: promedio de lecturas múltiples</span>':''}</div></div>${badge}</div><div class="ptar-process-chart ptar-history-chart" data-suav-chart-history="${pi}-${vi}"></div>${nDev?`<div class="ptar-history-dev-note"><b>Desviaciones:</b> ${esc(textoDesviacionesHistoricasSuav(hv))}</div>`:''}</article>`;}).join('');
    return `<section class="card ptar-chart-process-card suav-theme ptar-process-charts" aria-labelledby="suav-chart-${pi}"><div class="card-h"><div><h3 id="suav-chart-${pi}">${esc(p.nombre)}</h3><span class="ptar-process-chart-sub">${todas.length} variables · histórico completo según días con registro</span></div><label class="ptar-chart-selector">Variable para lectura del día<select data-suav-chart-process="${pi}" aria-label="Variable del día a graficar de ${esc(p.nombre)}">${opciones}</select></label></div><div class="card-b"><div class="ptar-day-block"><div class="ptar-chart-meta"><strong>${esc(v.variable)}</strong><span>${esc(v.puesto)}</span><span>Rango: ${esc(v.rango||'—')}</span>${v.unidad?`<span>Unidad: ${esc(v.unidad)}</span>`:''}</div><div class="ptar-chart-panel ptar-day-panel"><div class="ptar-chart-panel-h"><h4>Lecturas del día seleccionado</h4><span class="sub">${etiquetaFechaSuav(SUAV_FECHA,true)} · 1er y 2do turno a las 06:00</span></div><div class="ptar-process-chart" data-suav-chart-day="${pi}"></div></div></div><div class="ptar-all-history"><div class="ptar-all-history-h"><div><h4>Comportamiento histórico de todas las variables</h4><p>Selecciona una gráfica específica o muestra todas las variables del proceso.</p></div><div class="history-toolbar"><label class="history-chart-selector">Gráfica a visualizar<select data-suav-history-selector="${pi}" aria-label="Gráfica histórica a visualizar de ${esc(p.nombre)}">${opHist}</select></label><span class="ptar-history-key"><i></i>Los puntos rojos indican lecturas fuera del rango de operación.</span></div></div><div class="ptar-history-grid ${histSel==='__all__'?'':'is-single'}">${historicos}</div></div></div></section>`;
  }).join('');
  SUAV_PROCESOS.forEach((p,pi)=>{const todas=suavVariables(p),v=suavVariableGrafica(p),histSel=suavSeleccionHistorico(p);renderSuavDia(host.querySelector(`[data-suav-chart-day="${pi}"]`),p,v);(histSel==='__all__'?todas:todas.filter(x=>x.id===histSel)).forEach(hv=>{const vi=todas.findIndex(x=>x.id===hv.id);renderSuavHistoricoCompleto(host.querySelector(`[data-suav-chart-history="${pi}-${vi}"]`),hv);});});
  host.querySelectorAll('[data-suav-chart-process]').forEach(sel=>sel.addEventListener('change',()=>{const p=SUAV_PROCESOS[Number(sel.dataset.suavChartProcess)];if(p){SUAV_GRAFICA_VAR[p.nombre]=sel.value;pintarGraficasSuav();}}));
  host.querySelectorAll('[data-suav-history-selector]').forEach(sel=>sel.addEventListener('change',()=>{const p=SUAV_PROCESOS[Number(sel.dataset.suavHistorySelector)];if(p){SUAV_HISTORICO_SEL[p.nombre]=sel.value;pintarGraficasSuav();}}));
}
function poblarFechasSuav(){
  const sels=[document.getElementById('suav-date-select'),document.getElementById('suav-summary-date-select')].filter(Boolean);
  sels.forEach(sel=>{sel.innerHTML=SUAV_FECHAS.map(f=>`<option value="${f}">${etiquetaFechaSuav(f,true)}</option>`).join('');sel.value=SUAV_FECHA||'';if(!sel.dataset.bound){sel.dataset.bound='1';sel.addEventListener('change',()=>{SUAV_FECHA=sel.value;sels.forEach(s=>s.value=SUAV_FECHA);pintarSuav();pintarValores();pintarEncabezado();pintarPrioridades();});}});
}
function pintarDesviacionesSuav(){
  const host=document.getElementById('suav-desviaciones'),count=document.getElementById('suav-desv-count');if(!host)return;
  const list=registrosFechaSuav().filter(r=>estadoRegistroSuav(r)==='FUERA DE RANGO');if(count)count.textContent=list.length?`${list.length} detectada${list.length===1?'':'s'}`:'ninguna';
  host.innerHTML=list.length?list.map(r=>{const v=suavDefPorId(r.id);return `<div class="ptar-dev"><span class="bar" style="background:${C.crit}"></span><div class="body"><div class="title">${esc(r.variable)} · ${valorTextoSuav(r)}${v&&v.unidad?' '+esc(v.unidad):''}</div><div class="meta">${esc(r.proceso)} · ${esc(r.puesto)} · rango ${esc(r.rango||'—')}</div>${r.operador?`<div class="obs">Operador: ${esc(r.operador)}</div>`:''}${r.observacion?`<div class="obs">${esc(r.observacion)}</div>`:''}</div><time>${esc(SUAV_TURNO_ETIQUETA[r.turno]||r.turno)}</time></div>`;}).join(''):`<p class="empty">No hay variables registradas fuera de rango el ${etiquetaFechaSuav(SUAV_FECHA,true)}.</p>`;
}
function pintarSuav(){
  if(!SUAV_PROCESOS.length)return;poblarFechasSuav();const total=suavStats(),eTotal=suavEstado(total);
  document.querySelectorAll('[data-suav-summary-count]').forEach(el=>el.textContent=String(total.registradas));
  const sumPill=document.querySelector('[data-suav-summary-pill]');if(sumPill){sumPill.className='pill '+eTotal.st;sumPill.innerHTML='<i></i>'+esc(eTotal.txt);}
  const stripVal=document.querySelector('[data-suav-strip-value]');if(stripVal)stripVal.textContent=String(total.desviaciones);
  const stripPill=document.querySelector('[data-suav-strip-pill]');if(stripPill){stripPill.className='pill '+eTotal.st;stripPill.innerHTML='<i></i>'+esc(eTotal.txt);}
  const resumen=document.getElementById('suav-resumen-procesos');if(resumen)resumen.innerHTML=SUAV_PROCESOS.map(p=>{const st=suavStats(p),e=suavEstado(st);return `<div class="ptar-summary-process"><div class="ptar-summary-process-h"><strong>${esc(p.nombre)}</strong><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span></div><div class="ptar-summary-process-v"><b>${st.variables}</b> variables · ${st.registradas} lecturas · ${st.desviaciones} fuera</div><div class="ptar-progress"><i style="width:${st.controladas?st.pctNormal.toFixed(1):0}%"></i></div></div>`;}).join('');
  const kpis=document.getElementById('suav-kpis-proceso');if(kpis)kpis.innerHTML=SUAV_PROCESOS.map(p=>{const st=suavStats(p),e=suavEstado(st);return `<div class="kpi suav-process-kpi"><div class="lbl"><span>${esc(p.nombre)}</span><span class="pill ${e.st}" style="margin-left:auto"><i></i>${esc(e.txt)}</span></div><div class="v tnum">${st.registradas}<small>lecturas</small></div><div class="rng">${st.variables} variables · ${st.controladas} con rango evaluadas</div><div class="ptar-progress"><i style="width:${st.controladas?st.pctNormal.toFixed(1):0}%"></i></div></div>`;}).join('');
  const host=document.getElementById('suav-procesos');if(host){const ops=operadoresFechaSuav();host.innerHTML=SUAV_PROCESOS.map((p,pi)=>{const st=suavStats(p),e=suavEstado(st);const rows=(p.puestos||[]).map(puesto=>(puesto.variables||[]).map((v,i)=>{const puestoCell=i===0?`<td class="ptar-puesto" rowspan="${puesto.variables.length}">${esc(puesto.nombre)}</td>`:'';const regs=SUAV_TURNOS.map(t=>registroSuav(v.id,t)),dev=regs.some(r=>estadoRegistroSuav(r)==='FUERA DE RANGO'),cells=regs.map(r=>{const est=estadoRegistroSuav(r);return `<td class="num ptar-lectura ${claseEstadoSuav(est)}" title="${esc(est)}">${valorTextoSuav(r)}</td>`;}).join('');return `<tr class="${dev?'has-dev':''}">${puestoCell}<td>${esc(v.variable)}</td><td class="ptar-rango tnum">${esc(v.rango||'—')}</td>${cells}</tr>`;}).join('')).join('');return `<section class="card ptar-process-card suav-theme" aria-labelledby="suav-proceso-${pi}"><div class="card-h"><h3 id="suav-proceso-${pi}">${esc(p.nombre)}</h3><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span><span class="note">${etiquetaFechaSuav(SUAV_FECHA,true)} · ${st.registradas} lecturas</span></div><div class="card-b ptar-table-wrap"><table class="tbl ptar-table suav-real-table"><thead><tr><th>Equipo</th><th>Variable de control</th><th class="num">Rango de operación</th><th class="num">1er turno · 06:00${ops['1er Turno']?`<small>${esc(ops['1er Turno'])}</small>`:''}</th><th class="num">2do turno · 06:00${ops['2do Turno']?`<small>${esc(ops['2do Turno'])}</small>`:''}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;}).join('');}
  pintarGraficasSuav();pintarDesviacionesSuav();
}
function normalizarFilasSuav(rows){
  if(!SUAV_PROCESOS.length)SUAV_PROCESOS=construirProcesosSuavDesdeFilas(rows);
  return (rows||[]).map(r=>{const proceso=suavProcesoNombre(r.Proceso??r.proceso??''),puesto=String(r.Equipo??r['Puesto de trabajo']??r.puesto??'').trim(),variable=String(r['Variable de Control']??r['Variable de control']??r.Variable??r.variable??'').trim();let id=String(r.VariableId??r.id??'').trim(),def=id?suavDefPorId(id):suavDefPorCampos(proceso,puesto,variable);if(!def)return null;id=def.id;const rawNum=r['Valor numérico / promedio']??r.Valor??r.valor,orig=r['Valor original']??r.valorOriginal??rawNum,num=suavNumeroLocal(rawNum);return {fecha:normalizarFechaSuav(r.Fecha??r.fecha),turno:String(r.Turno??r.turno??'').trim(),hora:String(r['Hora impresa']??r.Hora??r.hora??'').trim(),operador:String(r.Operador??r.operador??'').trim(),proceso:def.proceso,puesto:def.puesto,variable:def.variable,rango:def.rango,valor:num!==null?num:null,original:orig,unidad:def.unidad||String(r.Unidad??r.unidad??'').trim(),tipo:def.tipo,min:def.min,max:def.max,estadoFuente:String(r.Estado??r['Estado Fuente']??r.estado??'').trim(),observacion:String(r.Observación??r.Observacion??r.observacion??'').trim(),fuente:String(r.Fuente??r.fuente??'').trim(),id};}).filter(r=>r&&r.fecha&&r.turno&&r.id);
}
function cargarDatosSuav(rows,fechas,procesos,fuente){
  if(procesos&&procesos.length)SUAV_PROCESOS=procesos;const norm=normalizarFilasSuav(rows);if(!norm.length)throw new Error('El archivo no contiene registros válidos de Suavizadores y Tanques.');SUAV_DATA=norm;const dataFechas=[...new Set(norm.map(r=>r.fecha))].sort();SUAV_FECHAS=(fechas&&fechas.length?[...new Set(fechas)]:dataFechas).sort();const ult=dataFechas.filter(f=>registrosFechaSuav(f).some(tieneLecturaSuav)).slice(-1)[0]||SUAV_FECHAS[SUAV_FECHAS.length-1]||null;if(!SUAV_FECHA||!SUAV_FECHAS.includes(SUAV_FECHA)||!registrosFechaSuav(SUAV_FECHA).some(tieneLecturaSuav))SUAV_FECHA=ult;SUAV_FUENTE=fuente||SUAV_FUENTE;poblarFechasSuav();if(document.body&&document.body.dataset.dashboardReady==='1'){pintarSuav();pintarValores();pintarEncabezado();pintarPrioridades();}
}
async function leerExcelSuav(buffer){
  const zip=await abrirZipPTAR(buffer),parser=new DOMParser(),wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml'),relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml'),rels=[...relXml.getElementsByTagNameNS('*','Relationship')];let shared=[];if(zip.entries.has('xl/sharedStrings.xml')){const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));}const sheets=[...wbXml.getElementsByTagNameNS('*','sheet')],sheet=sheets.find(s=>s.getAttribute('name')==='Control');if(!sheet)throw new Error('No existe la hoja "Control" en el archivo de Suavizadores.');const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id'),rel=rels.find(r=>r.getAttribute('Id')===rid);if(!rel)throw new Error('No se pudo resolver la hoja Control.');let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');const rows=await leerHojaXLSXPTAR(zip,target,shared);if(!rows.length)throw new Error('La hoja Control está vacía.');const headers=rows[0].map(x=>String(x??'').trim());return rows.slice(1).filter(r=>r.some(v=>v!==''&&v!==null&&v!==undefined)).map(r=>{const o={};headers.forEach((h,i)=>{if(h)o[h]=r[i]??'';});return o;});
}
async function cargarExcelSuavArchivo(file,origen='archivo seleccionado'){const rows=await leerExcelSuav(await file.arrayBuffer());cargarDatosSuav(rows,[],[],`${file.name} · ${rows.length} filas de control · ${origen}`);}
async function cargarSuavAutomatico(){if(location.protocol==='file:')return;try{const resp=await fetch('Reporte_Control_Suavizadores_04-09_al_09-09-2026.xlsx',{cache:'no-store'});if(!resp.ok)throw new Error('HTTP '+resp.status);const rows=await leerExcelSuav(await resp.arrayBuffer());cargarDatosSuav(rows,[],[],`Reporte_Control_Suavizadores_04-09_al_09-09-2026.xlsx · ${rows.length} filas de control · carga automática`);}catch(err){}}
function inicializarSuavExcel(){const input=document.getElementById('suav-excel-input');if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('change',async()=>{const file=input.files&&input.files[0];if(!file)return;try{await cargarExcelSuavArchivo(file);}catch(err){alert('No se pudo leer el Excel de Suavizadores y Tanques: '+err.message);}finally{input.value='';}});}cargarSuavAutomatico();}
if(window.SUAV_FALLBACK_DATA&&window.SUAV_FALLBACK_DATA.length){cargarDatosSuav(window.SUAV_FALLBACK_DATA,window.SUAV_FALLBACK_FECHAS||[],window.SUAV_FALLBACK_PROCESOS||[],'Reporte_Control_Suavizadores_04-09_al_09-09-2026.xlsx · datos precargados para apertura local');}



/* ---------------------------------------------------------
   9A. PTAB · AGUAS BLANCAS · control real desde Excel local
   Procesos: Agua cruda + Agua filtrada
   Turnos: 1er turno 06:00 am y 2do turno 06:00 pm
   --------------------------------------------------------- */
const PTABR_TURNOS = ['1er Turno','2do Turno'];
const PTABR_TURNO_ETIQUETA = {'1er Turno':'1er turno · 06:00 am','2do Turno':'2do turno · 06:00 pm'};
let PTABR_PROCESOS = Array.isArray(window.PTABR_FALLBACK_PROCESOS) ? window.PTABR_FALLBACK_PROCESOS : [];
let PTABR_DATA = [];
let PTABR_FECHAS = Array.isArray(window.PTABR_FALLBACK_FECHAS) ? [...window.PTABR_FALLBACK_FECHAS] : [];
let PTABR_FECHA = null;
let PTABR_FUENTE = 'Reporte_Control_PTAB_04-09_al_09-09-2026.xlsx';
const PTABR_GRAFICA_VAR = {};
const PTABR_HISTORICO_SEL = {};

const ptabrVariables = p => p ? (p.puestos || []).flatMap(x=>x.variables || []) : [];
const ptabrEsVacio = v => v === null || v === undefined || String(v).trim()==='' || ['—','-','--'].includes(String(v).trim());
const tieneLecturaPtabr = r => !!r && (!ptabrEsVacio(r.valor) || !ptabrEsVacio(r.original));
function ptabrNumeroLocal(s){ return ptarNumeroLocal(s); }
function normalizarFechaPtabr(v){ return normalizarFechaPTAR(v); }
function etiquetaFechaPtabr(v,larga=false){ return etiquetaFechaPTAR(v,larga); }
function ptabrClave(s){ return ptarClave(s); }
function ptabrProcesoNombre(s){
  const k=ptabrClave(s);
  if(k==='aguacruda') return 'Agua cruda';
  if(k==='aguafiltrada') return 'Agua filtrada';
  return String(s||'').trim();
}
function ptabrTodasVariables(){ return PTABR_PROCESOS.flatMap(ptabrVariables); }
function ptabrDefPorId(id){ return ptabrTodasVariables().find(v=>v.id===id) || null; }
function ptabrDefPorCampos(proceso,puesto,variable){
  const kp=ptabrClave(ptabrProcesoNombre(proceso)), ke=ptabrClave(puesto), kv=ptabrClave(variable);
  return ptabrTodasVariables().find(v=>ptabrClave(v.proceso)===kp && ptabrClave(v.puesto)===ke && ptabrClave(v.variable)===kv)
    || ptabrTodasVariables().find(v=>ptabrClave(v.puesto)===ke && ptabrClave(v.variable)===kv)
    || null;
}
function ptabrParseRange(rango){
  let s=String(rango ?? '').trim().replace(/˂/g,'<').replace(/≤/g,'<=').replace(/≥/g,'>=').replace(/[−–—]/g,'-');
  if(!s || s==='-' || s==='--' || /^kg$/i.test(s)) return {tipo:'none',min:null,max:null};
  const raw=s.match(/[-+]?\d[\d.,]*/g) || [];
  const nums=raw.map(ptabrNumeroLocal).filter(v=>v!==null);
  if(s.includes('<=') || /(^|[^>])</.test(s)) return {tipo:'max',min:null,max:nums[0] ?? null};
  if(s.includes('>=') || s.includes('>')) return {tipo:'min',min:nums[0] ?? null,max:null};
  if(nums.length>=2 && s.includes('-')) return {tipo:'band',min:nums[0],max:nums[1]};
  return {tipo:'none',min:null,max:null};
}
function construirProcesosPtabrDesdeFilas(rows){
  const defs=[], seen=new Map();
  (rows||[]).forEach(r=>{
    const proceso=ptabrProcesoNombre(r.Proceso ?? r.proceso ?? '');
    const puesto=String(r.Equipo ?? r['Puesto de trabajo'] ?? r.puesto ?? '').trim();
    const variable=String(r['Variable de Control'] ?? r['Variable de control'] ?? r.Variable ?? r.variable ?? '').trim();
    if(!proceso || !puesto || !variable) return;
    const key=[ptabrClave(proceso),ptabrClave(puesto),ptabrClave(variable)].join('|');
    if(seen.has(key)) return;
    const rango=String(r['Rango de Operación'] ?? r['Rango Operación'] ?? r.rango ?? '—').trim() || '—';
    const pr=ptabrParseRange(rango), unidad=String(r.Unidad ?? r.unidad ?? '').trim();
    const d={id:`ptab_${String(defs.length+1).padStart(2,'0')}`,proceso,puesto,variable,rango,unidad,tipo:pr.tipo,min:pr.min,max:pr.max};
    defs.push(d); seen.set(key,d);
  });
  const ps=[];
  defs.forEach(v=>{
    let p=ps.find(x=>x.nombre===v.proceso); if(!p){p={nombre:v.proceso,puestos:[]};ps.push(p);}
    let e=p.puestos.find(x=>x.nombre===v.puesto); if(!e){e={nombre:v.puesto,variables:[]};p.puestos.push(e);}
    e.variables.push(v);
  });
  return ps;
}
function estadoRegistroPtabr(r){
  if(!r || !tieneLecturaPtabr(r)) return 'SIN DATO';
  const src=String(r.estadoFuente||'').toUpperCase();
  if(src.includes('FUERA DE RANGO')) return 'FUERA DE RANGO';
  const v=ptabrDefPorId(r.id);
  if(!v || v.tipo==='none') return 'INFORMATIVO';
  const n=ptabrNumeroLocal(r.valor);
  if(n===null) return 'SIN DATO';
  if(v.min!=null && n<Number(v.min)) return 'FUERA DE RANGO';
  if(v.max!=null && n>Number(v.max)) return 'FUERA DE RANGO';
  return 'NORMAL';
}
function claseEstadoPtabr(st){
  if(st==='FUERA DE RANGO') return 'bad';
  if(st==='NORMAL') return 'ok';
  if(st==='INFORMATIVO') return 'info';
  return 'empty';
}
function ptabrNumeroTexto(n){ return ptarNumeroTexto(n); }
function valorTextoPtabr(r){
  if(!r || !tieneLecturaPtabr(r)) return '—';
  if(!ptabrEsVacio(r.original)){
    if(typeof r.original==='number') return ptabrNumeroTexto(r.original);
    return esc(String(r.original));
  }
  const n=ptabrNumeroLocal(r.valor);
  return n===null ? esc(String(r.valor ?? '—')) : ptabrNumeroTexto(n);
}
function registrosFechaPtabr(fecha=PTABR_FECHA,proceso=null){
  return PTABR_DATA.filter(r=>r.fecha===fecha && (!proceso || r.proceso===proceso));
}
function registroPtabr(variableId,turno,fecha=PTABR_FECHA){
  return PTABR_DATA.find(r=>r.fecha===fecha && r.turno===turno && r.id===variableId) || null;
}
function operadoresFechaPtabr(fecha=PTABR_FECHA){
  const out={};
  PTABR_TURNOS.forEach(t=>{
    const r=PTABR_DATA.find(x=>x.fecha===fecha && x.turno===t && x.operador && tieneLecturaPtabr(x));
    out[t]=r?r.operador:'';
  });
  return out;
}
function ptabrStats(proceso=null,fecha=PTABR_FECHA){
  const p=proceso ? (typeof proceso==='string'?PTABR_PROCESOS.find(x=>x.nombre===proceso):proceso) : null;
  const vars=p?ptabrVariables(p):PTABR_PROCESOS.flatMap(ptabrVariables);
  const rows=registrosFechaPtabr(fecha,p?p.nombre:null);
  const registradas=rows.filter(tieneLecturaPtabr);
  const controladas=registradas.filter(r=>{const v=ptabrDefPorId(r.id);return v&&v.tipo!=='none'&&ptabrNumeroLocal(r.valor)!==null;});
  const desviaciones=controladas.filter(r=>estadoRegistroPtabr(r)==='FUERA DE RANGO').length;
  const normales=controladas.filter(r=>estadoRegistroPtabr(r)==='NORMAL').length;
  return {variables:vars.length,registradas:registradas.length,controladas:controladas.length,desviaciones,normales,pctNormal:controladas.length?normales/controladas.length*100:0};
}
function ptabrEstado(st){
  if(!st || !st.registradas) return {st:'idle',txt:'Sin registros'};
  if(st.desviaciones) return {st:'crit',txt:`${st.desviaciones} fuera de rango`};
  if(st.controladas) return {st:'ok',txt:'Normal'};
  return {st:'idle',txt:'Informativo'};
}
function ptabrVariableGrafica(proceso){
  const vars=ptabrVariables(proceso); if(!vars.length) return null;
  const id=PTABR_GRAFICA_VAR[proceso.nombre]; if(id){const f=vars.find(v=>v.id===id);if(f)return f;}
  const conDatoControl=vars.find(v=>v.tipo!=='none'&&PTABR_TURNOS.some(t=>{const r=registroPtabr(v.id,t);return r&&ptabrNumeroLocal(r.valor)!==null;}));
  const conDato=vars.find(v=>PTABR_TURNOS.some(t=>{const r=registroPtabr(v.id,t);return r&&ptabrNumeroLocal(r.valor)!==null;}));
  const candidata=conDatoControl||conDato||vars.find(v=>v.tipo!=='none')||vars[0];
  PTABR_GRAFICA_VAR[proceso.nombre]=candidata.id; return candidata;
}
function ptabrLimitesGrafica(v,valores){
  let nums=(valores||[]).map(ptabrNumeroLocal).filter(x=>x!==null);
  if(v&&v.min!=null) nums.push(Number(v.min)); if(v&&v.max!=null) nums.push(Number(v.max));
  if(!nums.length) return {lo:0,hi:1};
  let lo=Math.min(...nums),hi=Math.max(...nums);
  if(v&&v.tipo==='max'&&lo>=0) lo=0;
  if(lo===hi){const p=Math.abs(lo)*.15||1;lo-=p;hi+=p;} else {const p=(hi-lo)*.12;lo-=p;hi+=p;}
  if(lo>=0)lo=Math.max(0,lo); return {lo,hi};
}
function ptabrEjes(v,valores,W=640,H=235){
  const pad={t:18,r:18,b:38,l:62},lim=ptabrLimitesGrafica(v,valores),span=lim.hi-lim.lo||1;
  const y=n=>pad.t+(lim.hi-Number(n))/span*(H-pad.t-pad.b); let svg='';
  for(let i=0;i<=4;i++){const val=lim.lo+span*i/4,yy=y(val);svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.line}" stroke-width="1"/><text x="${pad.l-8}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" font-size="10.2" fill="${C.ink3}">${esc(ptabrNumeroTexto(val))}</text>`;}
  if(v&&v.tipo==='band'&&v.min!=null&&v.max!=null){const ya=y(v.max),yb=y(v.min);svg+=`<rect x="${pad.l}" y="${Math.min(ya,yb).toFixed(1)}" width="${W-pad.l-pad.r}" height="${Math.abs(yb-ya).toFixed(1)}" fill="${C.agua}" opacity=".08"/><line x1="${pad.l}" y1="${ya.toFixed(1)}" x2="${W-pad.r}" y2="${ya.toFixed(1)}" stroke="${C.agua}" stroke-width="1" stroke-dasharray="4 4" opacity=".75"/><line x1="${pad.l}" y1="${yb.toFixed(1)}" x2="${W-pad.r}" y2="${yb.toFixed(1)}" stroke="${C.agua}" stroke-width="1" stroke-dasharray="4 4" opacity=".75"/>`;}
  else if(v&&v.tipo==='max'&&v.max!=null){const yy=y(v.max);svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.crit}" stroke-width="1.2" stroke-dasharray="5 4"/><text x="${W-pad.r-3}" y="${(yy-5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.crit}">máx. ${esc(ptabrNumeroTexto(v.max))}</text>`;}
  else if(v&&v.tipo==='min'&&v.min!=null){const yy=y(v.min);svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.crit}" stroke-width="1.2" stroke-dasharray="5 4"/><text x="${W-pad.r-3}" y="${(yy-5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.crit}">mín. ${esc(ptabrNumeroTexto(v.min))}</text>`;}
  return {svg,y,pad,W,H};
}
function renderPtabrDia(host,proceso,v){
  if(!host||!v)return;
  const regs=PTABR_TURNOS.map(t=>registroPtabr(v.id,t)),vals=regs.map(r=>r?ptabrNumeroLocal(r.valor):null).filter(x=>x!==null);
  if(!vals.length){host.innerHTML=`<div class="ptar-chart-empty">Sin lecturas numéricas de ${esc(v.variable)} para ${etiquetaFechaPtabr(PTABR_FECHA,true)}.</div>`;return;}
  const ax=ptabrEjes(v,vals),{W,H,pad,y}=ax,xs=[pad.l+90,W-pad.r-90];let g=ax.svg,pts=[];
  regs.forEach((r,i)=>{const x=xs[i],label=i===0?'06:00 am':'06:00 pm';g+=`<text x="${x}" y="${H-10}" text-anchor="middle" font-size="10.5" fill="${C.ink3}">${label}</text>`;const val=r?ptabrNumeroLocal(r.valor):null;if(val===null)return;const yy=y(val),st=estadoRegistroPtabr(r),color=st==='FUERA DE RANGO'?C.crit:C.agua;pts.push([x,yy]);const orig=!ptabrEsVacio(r.original)?` · original ${String(r.original)}`:'';g+=`<circle cx="${x}" cy="${yy.toFixed(1)}" r="${st==='FUERA DE RANGO'?5:4}" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${esc(PTABR_TURNO_ETIQUETA[PTABR_TURNOS[i]]+' · '+ptabrNumeroTexto(val)+(v.unidad?' '+v.unidad:'')+orig+' · '+st)}</title></circle><text x="${x}" y="${Math.max(pad.t+12,yy-8).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${color}">${esc(ptabrNumeroTexto(val))}</text>`;});
  if(pts.length>1)g+=`<path d="M${pts[0][0]} ${pts[0][1].toFixed(1)} L${pts[1][0]} ${pts[1][1].toFixed(1)}" fill="none" stroke="${C.agua}" stroke-width="2" opacity=".75"/>`;
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(v.variable+' del día')}">${g}</svg>`;
}
function registrosHistoricosVariablePtabr(v){
  const ord=t=>t==='1er Turno'?0:(t==='2do Turno'?1:2);
  return PTABR_DATA.filter(r=>r.id===v.id&&ptabrNumeroLocal(r.valor)!==null).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)||ord(a.turno)-ord(b.turno));
}
function resumenDesviacionesHistoricasPtabr(v){const rows=registrosHistoricosVariablePtabr(v),devs=rows.filter(r=>estadoRegistroPtabr(r)==='FUERA DE RANGO');return {rows,devs,fechas:[...new Set(rows.map(r=>r.fecha))].sort()};}
function renderPtabrHistoricoCompleto(host,v){
  if(!host||!v)return;const info=resumenDesviacionesHistoricasPtabr(v),rows=info.rows,fechas=info.fechas,vals=rows.map(r=>ptabrNumeroLocal(r.valor)).filter(x=>x!==null);
  if(!vals.length){host.innerHTML=`<div class="ptar-chart-empty">Sin registros históricos numéricos de ${esc(v.variable)} en el archivo.</div>`;return;}
  const W=760,H=255,ax=ptabrEjes(v,vals,W,H),{pad,y}=ax,x=i=>fechas.length<2?(pad.l+(W-pad.r))/2:pad.l+i*(W-pad.l-pad.r)/(fechas.length-1);let g=ax.svg;
  const maxLabels=11, stepLbl=Math.max(1,Math.ceil(fechas.length/maxLabels));const ultLbl=fechas.length-1, idxLbl=[];for(let q=0;q<fechas.length;q+=stepLbl) idxLbl.push(q);if(idxLbl[idxLbl.length-1]!==ultLbl){if(ultLbl-idxLbl[idxLbl.length-1]<stepLbl*0.6) idxLbl.pop();idxLbl.push(ultLbl);}fechas.forEach((f,i)=>{if(!idxLbl.includes(i)) return;g+=`<text x="${x(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="9.4" fill="${C.ink3}">${esc(etiquetaFechaPtabr(f))}</text>`;});
  PTABR_TURNOS.forEach((turn,si)=>{const color=si===0?C.agua:C.ink,pts=[];fechas.forEach((f,i)=>{const r=registroPtabr(v.id,turn,f),val=r?ptabrNumeroLocal(r.valor):null;if(val!==null)pts.push([x(i),y(val),r,val]);});if(pts.length>1){const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');g+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>`;}pts.forEach(p=>{const st=estadoRegistroPtabr(p[2]),fuera=st==='FUERA DE RANGO',pc=fuera?C.crit:color;g+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${fuera?5.2:3.6}" fill="${pc}" stroke="#fff" stroke-width="${fuera?1.7:1.2}"><title>${esc(etiquetaFechaPtabr(p[2].fecha,true)+' · '+PTABR_TURNO_ETIQUETA[turn]+' · '+ptabrNumeroTexto(p[3])+(v.unidad?' '+v.unidad:'')+' · '+st)}</title></circle>`;});});
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc('Histórico completo · '+v.variable)}">${g}</svg><div class="ptar-chart-legend"><span><i style="--k:${C.agua}"></i>1er turno · 06:00 am</span><span><i style="--k:${C.ink}"></i>2do turno · 06:00 pm</span><span><i style="--k:${C.crit}"></i>Fuera de rango</span><span class="ptar-chart-range">${esc(v.rango||'Sin rango definido')}</span></div>`;
}
function textoDesviacionesHistoricasPtabr(v,limit=4){const devs=resumenDesviacionesHistoricasPtabr(v).devs;if(!devs.length)return '';const partes=devs.slice(0,limit).map(r=>`${etiquetaFechaPtabr(r.fecha)} ${r.turno} · ${valorTextoPtabr(r)}${v.unidad?' '+v.unidad:''}`);return partes.join(' · ')+(devs.length>limit?` · +${devs.length-limit} más`:'');}
function ptabrSeleccionHistorico(p){const vars=ptabrVariables(p),actual=PTABR_HISTORICO_SEL[p.nombre]||'__all__';if(actual==='__all__'||vars.some(v=>v.id===actual))return actual;PTABR_HISTORICO_SEL[p.nombre]='__all__';return '__all__';}
function pintarGraficasPtabr(){
  const host=document.getElementById('ptab-graficas-procesos');if(!host||!PTABR_PROCESOS.length)return;
  host.innerHTML=PTABR_PROCESOS.map((p,pi)=>{const todas=ptabrVariables(p),v=ptabrVariableGrafica(p),opciones=todas.map(x=>`<option value="${esc(x.id)}"${x.id===v.id?' selected':''}>${esc(x.variable)} · ${esc(x.puesto)}</option>`).join(''),histSel=ptabrSeleccionHistorico(p),opHist=`<option value="__all__"${histSel==='__all__'?' selected':''}>Todas las gráficas</option>`+todas.map(x=>`<option value="${esc(x.id)}"${x.id===histSel?' selected':''}>${esc(x.variable)} · ${esc(x.puesto)}</option>`).join(''),varsHist=histSel==='__all__'?todas:todas.filter(x=>x.id===histSel),historicos=varsHist.map(hv=>{const vi=todas.findIndex(x=>x.id===hv.id),info=resumenDesviacionesHistoricasPtabr(hv),nReg=info.rows.length,nDias=info.fechas.length,nDev=info.devs.length,multiple=info.rows.some(r=>typeof r.original==='string'&&r.original.includes('/'));const badge=nReg?(nDev?`<span class="pill crit"><i></i>${nDev} fuera de rango</span>`:`<span class="pill ${hv.tipo==='none'?'idle':'ok'}"><i></i>${hv.tipo==='none'?'Informativo':'Sin desviaciones'}</span>`):`<span class="pill idle"><i></i>Sin registros</span>`;return `<article class="ptar-history-var-card ${nDev?'has-history-dev':''}" aria-labelledby="ptab-hist-${pi}-${vi}"><div class="ptar-history-var-head"><div class="ptar-history-var-title"><h5 id="ptab-hist-${pi}-${vi}">${esc(hv.variable)}</h5><div class="ptar-history-var-meta"><span>${esc(hv.puesto)}</span><span>Rango: ${esc(hv.rango||'—')}</span>${hv.unidad?`<span>Unidad: ${esc(hv.unidad)}</span>`:''}<span>${nReg} lectura${nReg===1?'':'s'} · ${nDias} día${nDias===1?'':'s'} con registro</span>${multiple?'<span>Gráfica: promedio de lecturas múltiples</span>':''}</div></div>${badge}</div><div class="ptar-process-chart ptar-history-chart" data-ptab-chart-history="${pi}-${vi}"></div>${nDev?`<div class="ptar-history-dev-note"><b>Desviaciones:</b> ${esc(textoDesviacionesHistoricasPtabr(hv))}</div>`:''}</article>`;}).join('');
    return `<section class="card ptar-chart-process-card ptab-real-theme ptar-process-charts" aria-labelledby="ptab-chart-${pi}"><div class="card-h"><div><h3 id="ptab-chart-${pi}">${esc(p.nombre)}</h3><span class="ptar-process-chart-sub">${todas.length} variables · histórico completo según días con registro</span></div><label class="ptar-chart-selector">Variable para lectura del día<select data-ptab-chart-process="${pi}" aria-label="Variable del día a graficar de ${esc(p.nombre)}">${opciones}</select></label></div><div class="card-b"><div class="ptar-day-block"><div class="ptar-chart-meta"><strong>${esc(v.variable)}</strong><span>${esc(v.puesto)}</span><span>Rango: ${esc(v.rango||'—')}</span>${v.unidad?`<span>Unidad: ${esc(v.unidad)}</span>`:''}</div><div class="ptar-chart-panel ptar-day-panel"><div class="ptar-chart-panel-h"><h4>Lecturas del día seleccionado</h4><span class="sub">${etiquetaFechaPtabr(PTABR_FECHA,true)} · 1er turno 06:00 am · 2do turno 06:00 pm</span></div><div class="ptar-process-chart" data-ptab-chart-day="${pi}"></div></div></div><div class="ptar-all-history"><div class="ptar-all-history-h"><div><h4>Comportamiento histórico de todas las variables</h4><p>Selecciona una gráfica específica o muestra todas las variables del proceso.</p></div><div class="history-toolbar"><label class="history-chart-selector">Gráfica a visualizar<select data-ptab-history-selector="${pi}" aria-label="Gráfica histórica a visualizar de ${esc(p.nombre)}">${opHist}</select></label><span class="ptar-history-key"><i></i>Los puntos rojos indican lecturas fuera del rango de operación.</span></div></div><div class="ptar-history-grid ${histSel==='__all__'?'':'is-single'}">${historicos}</div></div></div></section>`;
  }).join('');
  PTABR_PROCESOS.forEach((p,pi)=>{const todas=ptabrVariables(p),v=ptabrVariableGrafica(p),histSel=ptabrSeleccionHistorico(p);renderPtabrDia(host.querySelector(`[data-ptab-chart-day="${pi}"]`),p,v);(histSel==='__all__'?todas:todas.filter(x=>x.id===histSel)).forEach(hv=>{const vi=todas.findIndex(x=>x.id===hv.id);renderPtabrHistoricoCompleto(host.querySelector(`[data-ptab-chart-history="${pi}-${vi}"]`),hv);});});
  host.querySelectorAll('[data-ptab-chart-process]').forEach(sel=>sel.addEventListener('change',()=>{const p=PTABR_PROCESOS[Number(sel.dataset.ptabChartProcess)];if(p){PTABR_GRAFICA_VAR[p.nombre]=sel.value;pintarGraficasPtabr();}}));
  host.querySelectorAll('[data-ptab-history-selector]').forEach(sel=>sel.addEventListener('change',()=>{const p=PTABR_PROCESOS[Number(sel.dataset.ptabHistorySelector)];if(p){PTABR_HISTORICO_SEL[p.nombre]=sel.value;pintarGraficasPtabr();}}));
}
function poblarFechasPtabr(){
  const sels=[document.getElementById('ptab-date-select'),document.getElementById('ptab-summary-date-select')].filter(Boolean);
  sels.forEach(sel=>{sel.innerHTML=PTABR_FECHAS.map(f=>`<option value="${f}">${etiquetaFechaPtabr(f,true)}</option>`).join('');sel.value=PTABR_FECHA||'';if(!sel.dataset.bound){sel.dataset.bound='1';sel.addEventListener('change',()=>{PTABR_FECHA=sel.value;sels.forEach(s=>s.value=PTABR_FECHA);pintarPtabr();pintarValores();pintarEncabezado();pintarPrioridades();});}});
}
function pintarDesviacionesPtabr(){
  const host=document.getElementById('ptab-desviaciones'),count=document.getElementById('ptab-desv-count');if(!host)return;
  const list=registrosFechaPtabr().filter(r=>estadoRegistroPtabr(r)==='FUERA DE RANGO');if(count)count.textContent=list.length?`${list.length} detectada${list.length===1?'':'s'}`:'ninguna';
  host.innerHTML=list.length?list.map(r=>{const v=ptabrDefPorId(r.id);return `<div class="ptar-dev"><span class="bar" style="background:${C.crit}"></span><div class="body"><div class="title">${esc(r.variable)} · ${valorTextoPtabr(r)}${v&&v.unidad?' '+esc(v.unidad):''}</div><div class="meta">${esc(r.proceso)} · ${esc(r.puesto)} · rango ${esc(r.rango||'—')}</div>${r.operador?`<div class="obs">Operador: ${esc(r.operador)}</div>`:''}${r.observacion?`<div class="obs">${esc(r.observacion)}</div>`:''}</div><time>${esc(PTABR_TURNO_ETIQUETA[r.turno]||r.turno)}</time></div>`;}).join(''):`<p class="empty">No hay variables registradas fuera de rango el ${etiquetaFechaPtabr(PTABR_FECHA,true)}.</p>`;
}
function pintarPtabr(){
  if(!PTABR_PROCESOS.length)return;poblarFechasPtabr();const total=ptabrStats(),eTotal=ptabrEstado(total);
  document.querySelectorAll('[data-ptab-summary-count]').forEach(el=>el.textContent=String(total.registradas));
  const sumPill=document.querySelector('[data-ptab-summary-pill]');if(sumPill){sumPill.className='pill '+eTotal.st;sumPill.innerHTML='<i></i>'+esc(eTotal.txt);}
  const stripVal=document.querySelector('[data-ptab-strip-value]');if(stripVal)stripVal.textContent=String(total.desviaciones);
  const stripPill=document.querySelector('[data-ptab-strip-pill]');if(stripPill){stripPill.className='pill '+eTotal.st;stripPill.innerHTML='<i></i>'+esc(eTotal.txt);}
  const resumen=document.getElementById('ptab-resumen-procesos');if(resumen)resumen.innerHTML=PTABR_PROCESOS.map(p=>{const st=ptabrStats(p),e=ptabrEstado(st);return `<div class="ptar-summary-process"><div class="ptar-summary-process-h"><strong>${esc(p.nombre)}</strong><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span></div><div class="ptar-summary-process-v"><b>${st.variables}</b> variables · ${st.registradas} lecturas · ${st.desviaciones} fuera</div><div class="ptar-progress"><i style="width:${st.controladas?st.pctNormal.toFixed(1):0}%"></i></div></div>`;}).join('');
  const kpis=document.getElementById('ptab-kpis-proceso');if(kpis)kpis.innerHTML=PTABR_PROCESOS.map(p=>{const st=ptabrStats(p),e=ptabrEstado(st);return `<div class="kpi ptab-process-kpi"><div class="lbl"><span>${esc(p.nombre)}</span><span class="pill ${e.st}" style="margin-left:auto"><i></i>${esc(e.txt)}</span></div><div class="v tnum">${st.registradas}<small>lecturas</small></div><div class="rng">${st.variables} variables · ${st.controladas} con rango evaluadas</div><div class="ptar-progress"><i style="width:${st.controladas?st.pctNormal.toFixed(1):0}%"></i></div></div>`;}).join('');
  const host=document.getElementById('ptab-procesos');if(host){const ops=operadoresFechaPtabr();host.innerHTML=PTABR_PROCESOS.map((p,pi)=>{const st=ptabrStats(p),e=ptabrEstado(st);const rows=(p.puestos||[]).map(puesto=>(puesto.variables||[]).map((v,i)=>{const puestoCell=i===0?`<td class="ptar-puesto" rowspan="${puesto.variables.length}">${esc(puesto.nombre)}</td>`:'';const regs=PTABR_TURNOS.map(t=>registroPtabr(v.id,t)),dev=regs.some(r=>estadoRegistroPtabr(r)==='FUERA DE RANGO'),cells=regs.map(r=>{const est=estadoRegistroPtabr(r);return `<td class="num ptar-lectura ${claseEstadoPtabr(est)}" title="${esc(est)}">${valorTextoPtabr(r)}</td>`;}).join('');return `<tr class="${dev?'has-dev':''}">${puestoCell}<td>${esc(v.variable)}</td><td class="ptar-rango tnum">${esc(v.rango||'—')}</td>${cells}</tr>`;}).join('')).join('');return `<section class="card ptar-process-card ptab-real-theme" aria-labelledby="ptab-proceso-${pi}"><div class="card-h"><h3 id="ptab-proceso-${pi}">${esc(p.nombre)}</h3><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span><span class="note">${etiquetaFechaPtabr(PTABR_FECHA,true)} · ${st.registradas} lecturas</span></div><div class="card-b ptar-table-wrap"><table class="tbl ptar-table ptab-real-table"><thead><tr><th>Equipo</th><th>Variable de control</th><th class="num">Rango de operación</th><th class="num">1er turno · 06:00 am${ops['1er Turno']?`<small>${esc(ops['1er Turno'])}</small>`:''}</th><th class="num">2do turno · 06:00 pm${ops['2do Turno']?`<small>${esc(ops['2do Turno'])}</small>`:''}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;}).join('');}
  pintarGraficasPtabr();pintarDesviacionesPtabr();
}
function normalizarFilasPtabr(rows){
  if(!PTABR_PROCESOS.length) PTABR_PROCESOS=construirProcesosPtabrDesdeFilas(rows);
  const prelim=(rows||[]).map(r=>{
    const proceso=ptabrProcesoNombre(r.Proceso??r.proceso??'');
    const puesto=String(r.Equipo??r['Puesto de trabajo']??r.puesto??'').trim();
    const variable=String(r['Variable de Control']??r['Variable de control']??r.Variable??r.variable??'').trim();
    let id=String(r.VariableId??r.id??'').trim();
    const def=id?ptabrDefPorId(id):ptabrDefPorCampos(proceso,puesto,variable);
    if(!def) return null;
    id=def.id;
    const rawNum=r['Valor numérico / promedio']??r.Valor??r.valor;
    const orig=r['Valor original turno']??r['Valor original']??r.valorOriginal??rawNum;
    const num=ptabrNumeroLocal(rawNum);
    return {
      fecha:normalizarFechaPtabr(r.Fecha??r.fecha),
      turno:String(r.Turno??r.turno??'').trim(),
      hora:String(r['Hora impresa']??r.Hora??r.hora??'').trim(),
      operador:String(r.Operador??r.operador??'').trim(),
      proceso:def.proceso,puesto:def.puesto,variable:def.variable,rango:def.rango,
      valor:num!==null?num:null,original:orig,
      unidad:def.unidad||String(r.Unidad??r.unidad??'').trim(),
      tipo:def.tipo,min:def.min,max:def.max,
      estadoFuente:String(r.Estado??r['Estado Fuente']??r.estado??'').trim(),
      observacion:String(r.Observación??r.Observacion??r.observacion??'').trim(),
      fuente:String(r.Fuente??r.fuente??'').trim(),id
    };
  }).filter(r=>r&&r.fecha&&r.turno&&r.id);

  const groups=new Map();
  prelim.forEach(r=>{
    const key=[r.fecha,r.turno,r.id].join('|');
    if(!groups.has(key)) groups.set(key,{base:r,nums:[],originales:[],estados:[],observaciones:[]});
    const g=groups.get(key);
    if(ptabrNumeroLocal(r.valor)!==null) g.nums.push(Number(r.valor));
    if(!ptabrEsVacio(r.original)) g.originales.push(String(r.original));
    if(r.estadoFuente) g.estados.push(r.estadoFuente);
    if(r.observacion) g.observaciones.push(r.observacion);
  });
  return [...groups.values()].map(g=>{
    const r={...g.base};
    r.valor=g.nums.length?g.nums.reduce((a,b)=>a+b,0)/g.nums.length:null;
    r.original=g.originales.find(Boolean)??r.original;
    const estados=g.estados.map(x=>String(x).toUpperCase());
    r.estadoFuente=estados.some(x=>x.includes('FUERA DE RANGO'))?'Fuera de rango'
      :estados.some(x=>x.includes('NORMAL'))?'Normal'
      :estados.some(x=>x.includes('INFORMATIVO'))?'Informativo'
      :'Sin dato';
    r.observacion=[...new Set(g.observaciones)].join(' · ');
    return r;
  });
}
function cargarDatosPtabr(rows,fechas,procesos,fuente){
  if(procesos&&procesos.length)PTABR_PROCESOS=procesos;const norm=normalizarFilasPtabr(rows);if(!norm.length)throw new Error('El archivo no contiene registros válidos de PTAB.');PTABR_DATA=norm;const dataFechas=[...new Set(norm.map(r=>r.fecha))].sort();PTABR_FECHAS=(fechas&&fechas.length?[...new Set(fechas)]:dataFechas).sort();const ult=dataFechas.filter(f=>registrosFechaPtabr(f).some(tieneLecturaPtabr)).slice(-1)[0]||PTABR_FECHAS[PTABR_FECHAS.length-1]||null;if(!PTABR_FECHA||!PTABR_FECHAS.includes(PTABR_FECHA)||!registrosFechaPtabr(PTABR_FECHA).some(tieneLecturaPtabr))PTABR_FECHA=ult;PTABR_FUENTE=fuente||PTABR_FUENTE;poblarFechasPtabr();if(document.body&&document.body.dataset.dashboardReady==='1'){pintarPtabr();pintarValores();pintarEncabezado();pintarPrioridades();}
}
async function leerExcelPtabr(buffer){
  const zip=await abrirZipPTAR(buffer),parser=new DOMParser(),wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml'),relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml'),rels=[...relXml.getElementsByTagNameNS('*','Relationship')];let shared=[];if(zip.entries.has('xl/sharedStrings.xml')){const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));}const sheets=[...wbXml.getElementsByTagNameNS('*','sheet')],sheet=sheets.find(s=>s.getAttribute('name')==='Control');if(!sheet)throw new Error('No existe la hoja "Control" en el archivo de PTAB.');const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id'),rel=rels.find(r=>r.getAttribute('Id')===rid);if(!rel)throw new Error('No se pudo resolver la hoja Control.');let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');const rows=await leerHojaXLSXPTAR(zip,target,shared);if(!rows.length)throw new Error('La hoja Control está vacía.');const headers=rows[0].map(x=>String(x??'').trim());return rows.slice(1).filter(r=>r.some(v=>v!==''&&v!==null&&v!==undefined)).map(r=>{const o={};headers.forEach((h,i)=>{if(h)o[h]=r[i]??'';});return o;});
}
async function cargarExcelPtabrArchivo(file,origen='archivo seleccionado'){const rows=await leerExcelPtabr(await file.arrayBuffer());cargarDatosPtabr(rows,[],[],`${file.name} · ${rows.length} filas de control · ${origen}`);}
async function cargarPtabrAutomatico(){if(location.protocol==='file:')return;try{const resp=await fetch('Reporte_Control_PTAB_04-09_al_09-09-2026.xlsx',{cache:'no-store'});if(!resp.ok)throw new Error('HTTP '+resp.status);const rows=await leerExcelPtabr(await resp.arrayBuffer());cargarDatosPtabr(rows,[],[],`Reporte_Control_PTAB_04-09_al_09-09-2026.xlsx · ${rows.length} filas de control · carga automática`);}catch(err){}}
function inicializarPtabrExcel(){const input=document.getElementById('ptab-excel-input');if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('change',async()=>{const file=input.files&&input.files[0];if(!file)return;try{await cargarExcelPtabrArchivo(file);}catch(err){alert('No se pudo leer el Excel de PTAB: '+err.message);}finally{input.value='';}});}cargarPtabrAutomatico();}
if(window.PTABR_FALLBACK_DATA&&window.PTABR_FALLBACK_DATA.length){cargarDatosPtabr(window.PTABR_FALLBACK_DATA,window.PTABR_FALLBACK_FECHAS||[],window.PTABR_FALLBACK_PROCESOS||[],'Reporte_Control_PTAB_04-09_al_09-09-2026.xlsx · datos precargados para apertura local');}






/* =========================================================
   COMPRESORES DE AIRE + REFRIGERACIÓN / NH3
   Datos reales del histórico de reportes de WhatsApp
   ========================================================= */
const WA_TURN_ORDER={'06:00-18:00':0,'18:00-06:00':1};
const WA_CFG={
  aire:{
    tab:'aire',nombre:'Compresores de aire',corto:'Compresores de aire',color:C.aire,
    source:'Historial_Reportes_Compresores_Refrigeracion_WhatsApp.xlsx',
    areasPermitidas:['Compresores Aire','Trampas de Aire'],
    data:(window.AIRE_WA_FALLBACK_DATA||[]).slice(),catalogo:(window.AIRE_WA_FALLBACK_CATALOGO||[]).slice(),
    fechas:(window.AIRE_WA_FALLBACK_FECHAS||[]).slice(),fecha:null,graficaVar:Object.create(null),historicoSel:Object.create(null)
  },
  frio:{
    tab:'frio',nombre:'Refrigeración y amoníaco',corto:'Refrigeración · NH₃',color:C.nh3,
    source:'Historial_Reportes_Compresores_Refrigeracion_WhatsApp.xlsx',
    areasPermitidas:['Compresores NH3','Banco de Hielo','Cavas','Cava Gigante','Fraccionamiento','UMAS Margarina','Condensador/Evaporativo','NH3 en Cilindros'],
    data:(window.NH3_WA_FALLBACK_DATA||[]).slice(),catalogo:(window.NH3_WA_FALLBACK_CATALOGO||[]).slice(),
    fechas:(window.NH3_WA_FALLBACK_FECHAS||[]).slice(),fecha:null,graficaVar:Object.create(null),historicoSel:Object.create(null)
  }
};
Object.values(WA_CFG).forEach(c=>{c.fechas=[...new Set(c.fechas.length?c.fechas:c.data.map(r=>r.fecha).filter(Boolean))].sort();c.fecha=c.fechas[c.fechas.length-1]||null;});

function waCfg(tab){return WA_CFG[tab]||null;}
function waFechaTxt(fecha,larga=false){
  if(!fecha||fecha==='__sin_fecha__')return 'Sin fecha exacta';
  const [y,m,d]=String(fecha).split('-').map(Number);if(!y||!m||!d)return String(fecha);
  const dt=new Date(y,m-1,d);
  return larga?dt.toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'numeric'}):`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
}
function waNumero(n){
  if(n===null||n===undefined||n==='')return null;const x=Number(n);if(!Number.isFinite(x))return null;
  return x.toLocaleString('es-VE',{maximumFractionDigits:3,minimumFractionDigits:0});
}
function waEstadoClase(r){
  if(!r)return 'idle';const s=String(r.estado||'').toUpperCase();
  if(s.includes('FUERA DE SERVICIO')||s.includes('FUERA DE NORMA'))return 'crit';
  if(s.includes('ALERTA')||s.includes('INCONSISTENTE'))return 'warn';
  if(s.includes('OPERATIVO')||s.includes('NORMAL REPORTADO'))return 'ok';
  if(s.includes('SIN INDICADOR'))return 'info';
  return 'idle';
}
function waEstadoTxt(r){const st=waEstadoClase(r);return st==='crit'?'Fuera de servicio / norma':st==='warn'?'Alerta':st==='ok'?'Normal':st==='info'?'Informativo':'Sin estado';}
function waEstadoCorto(r){const st=waEstadoClase(r);return st==='crit'?'Fuera':st==='warn'?'Alerta':st==='ok'?'Normal':st==='info'?'Info':'—';}
function waEsPrioridad(r){const s=waEstadoClase(r);return s==='crit'||s==='warn';}
function waColorEstado(r){const s=waEstadoClase(r);return s==='crit'?C.crit:s==='warn'?C.warn:s==='ok'?C.ok:C.ink3;}
function waValorTexto(r,conUnidad=false){
  if(!r)return '—';let v='—';
  if(r.valor!==null&&r.valor!==undefined&&r.valor!==''){v=waNumero(r.valor)??String(r.valor);}
  else if(r.texto!==null&&r.texto!==undefined&&String(r.texto).trim()!==''){v=String(r.texto).trim();}
  if(conUnidad&&r.unidad&&v!=='—')v+=' '+r.unidad;return v;
}
function waDef(tab,id){const c=waCfg(tab);return c?c.catalogo.find(v=>v.id===id)||null:null;}
function waAreas(tab){const c=waCfg(tab);if(!c)return[];const out=[];c.catalogo.forEach(v=>{if(v.area&&!out.includes(v.area))out.push(v.area);});return out;}
function waVarsArea(tab,area){const c=waCfg(tab);return c?c.catalogo.filter(v=>v.area===area):[];}
function waRowsFecha(tab,fecha=null,area=null){const c=waCfg(tab);if(!c)return[];const f=fecha===null?c.fecha:fecha;return c.data.filter(r=>(f==='__sin_fecha__'?!r.fecha:r.fecha===f)&&(!area||r.area===area));}
function waRowsVar(tab,id,soloFechados=true){const c=waCfg(tab);if(!c)return[];return c.data.filter(r=>r.id===id&&(!soloFechados||r.fecha));}
function waSlotKey(r){return r.reporteId||`${r.turno}|${r.operador}`;}
function waSlots(tab,fecha=null){
  const c=waCfg(tab);if(!c)return[];const f=fecha===null?c.fecha:fecha,m=new Map();
  c.data.filter(r=>(f==='__sin_fecha__'?!r.fecha:r.fecha===f)).forEach(r=>{const k=waSlotKey(r);if(!m.has(k))m.set(k,{reporteId:r.reporteId||'',turno:r.turno||'',turnoOriginal:r.turnoOriginal||'',operador:r.operador||'',confianzaFecha:r.confianzaFecha||''});});
  return [...m.values()].sort((a,b)=>(WA_TURN_ORDER[a.turno]??9)-(WA_TURN_ORDER[b.turno]??9)||String(a.reporteId).localeCompare(String(b.reporteId),'es',{numeric:true}));
}
function waRegistro(tab,id,slot,fecha=null){const c=waCfg(tab);if(!c||!slot)return null;const f=fecha===null?c.fecha:fecha;return c.data.find(r=>(f==='__sin_fecha__'?!r.fecha:r.fecha===f)&&r.id===id&&waSlotKey(r)===waSlotKey(slot))||null;}
function waStats(tab,area=null,fecha=null){
  const c=waCfg(tab);if(!c)return{variables:0,registradas:0,crit:0,warn:0,ok:0,info:0,prioridad:0,pctNormal:0};
  const vars=area?waVarsArea(tab,area):c.catalogo,rows=waRowsFecha(tab,fecha,area);let crit=0,warn=0,ok=0,info=0;
  rows.forEach(r=>{const s=waEstadoClase(r);if(s==='crit')crit++;else if(s==='warn')warn++;else if(s==='ok')ok++;else info++;});
  const evaluadas=crit+warn+ok;return{variables:vars.length,registradas:rows.length,crit,warn,ok,info,prioridad:crit+warn,pctNormal:evaluadas?ok/evaluadas*100:0};
}
function waEstadoServicio(st){
  if(!st||!st.registradas)return{st:'idle',txt:'Sin registros'};
  if(st.crit)return{st:'crit',txt:`${st.crit} crítica${st.crit===1?'':'s'}`};
  if(st.warn)return{st:'warn',txt:`${st.warn} alerta${st.warn===1?'':'s'}`};
  if(st.ok)return{st:'ok',txt:'Normal'};return{st:'idle',txt:'Informativo'};
}
function waCriterio(def){if(!def)return'—';return def.rango||def.criterio||'Sin rango numérico informado';}
function waOperadoresFecha(tab,fecha=null){return waSlots(tab,fecha).map(s=>s.operador).filter(Boolean);}
function waVariableGrafica(tab,area){
  const c=waCfg(tab),vars=waVarsArea(tab,area);if(!c||!vars.length)return null;
  const saved=c.graficaVar[area];if(saved){const d=vars.find(v=>v.id===saved);if(d)return d;}
  const slots=waSlots(tab,c.fecha);
  const num=vars.find(v=>slots.some(s=>{const r=waRegistro(tab,v.id,s,c.fecha);return r&&r.valor!==null&&r.valor!==undefined;}));
  const any=vars.find(v=>slots.some(s=>waRegistro(tab,v.id,s,c.fecha)))||vars[0];const chosen=num||any;c.graficaVar[area]=chosen.id;return chosen;
}
function waHistSel(tab,area){const c=waCfg(tab);if(!c)return'__all__';const v=c.historicoSel[area];if(v==='__all__'||waVarsArea(tab,area).some(x=>x.id===v))return v;c.historicoSel[area]='__all__';return'__all__';}
function waSortRows(a,b){return String(a.fecha||'9999').localeCompare(String(b.fecha||'9999'))||(WA_TURN_ORDER[a.turno]??9)-(WA_TURN_ORDER[b.turno]??9)||String(a.reporteId).localeCompare(String(b.reporteId),'es',{numeric:true});}
function waEsNumerica(tab,def){if(def&&String(def.tipoDato).toLowerCase().includes('num'))return true;return waRowsVar(tab,def.id,false).some(r=>r.valor!==null&&r.valor!==undefined&&Number.isFinite(Number(r.valor)));}
function waStatusCode(r){const s=waEstadoClase(r);return s==='crit'?2:s==='warn'?1:s==='ok'?0:0.35;}
function waShortTurn(t){return t==='06:00-18:00'?'06–18':t==='18:00-06:00'?'18–06':t||'—';}
function waAxisNumeric(vals,W=700,H=240){
  const pad={t:18,r:18,b:42,l:62};let lo=Math.min(...vals),hi=Math.max(...vals);if(lo===hi){const p=Math.abs(lo)*.15||1;lo-=p;hi+=p;}else{const p=(hi-lo)*.14;lo-=p;hi+=p;}if(lo>=0)lo=Math.max(0,lo);const span=hi-lo||1,y=n=>pad.t+(hi-Number(n))/span*(H-pad.t-pad.b);let svg='';
  for(let i=0;i<=4;i++){const val=lo+span*i/4,yy=y(val);svg+=`<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W-pad.r}" y2="${yy.toFixed(1)}" stroke="${C.line}"/><text x="${pad.l-8}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.ink3}">${esc(waNumero(val))}</text>`;}
  return{pad,W,H,y,svg,lo,hi};
}
function waAxisStatus(W=700,H=240){
  const pad={t:18,r:18,b:42,l:92},y=v=>pad.t+(2-v)/2*(H-pad.t-pad.b);let svg='';
  [[2,'Fuera de servicio'],[1,'Alerta'],[0,'Normal']].forEach(([v,txt])=>{const yy=y(v);svg+=`<line x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}" stroke="${C.line}"/><text x="${pad.l-8}" y="${yy+3.5}" text-anchor="end" font-size="10" fill="${C.ink3}">${txt}</text>`;});return{pad,W,H,y,svg};
}
function waXPositions(n,pad,W){if(n<=1)return[pad.l+(W-pad.l-pad.r)/2];const span=W-pad.l-pad.r;return Array.from({length:n},(_,i)=>pad.l+span*i/(n-1));}
function renderWADia(host,tab,def){
  if(!host||!def)return;const c=waCfg(tab),slots=waSlots(tab,c.fecha),rows=slots.map(s=>waRegistro(tab,def.id,s,c.fecha));
  if(!rows.some(Boolean)){host.innerHTML=`<div class="ptar-chart-empty">Sin registros de ${esc(def.variable)} para ${waFechaTxt(c.fecha,true)}.</div>`;return;}
  const numeric=waEsNumerica(tab,def);const W=700,H=240;
  if(numeric){
    const vals=rows.filter(r=>r&&r.valor!==null&&r.valor!==undefined).map(r=>Number(r.valor)).filter(Number.isFinite);if(!vals.length){host.innerHTML=`<div class="ptar-chart-empty">Sin lecturas numéricas para esta variable.</div>`;return;}
    const ax=waAxisNumeric(vals,W,H),xs=waXPositions(slots.length,ax.pad,W);let g=ax.svg,pts=[];
    rows.forEach((r,i)=>{const x=xs[i],slot=slots[i];g+=`<text x="${x}" y="${H-10}" text-anchor="middle" font-size="10.2" fill="${C.ink3}">${esc(waShortTurn(slot.turno)+' · '+slot.reporteId)}</text>`;if(!r||r.valor===null||r.valor===undefined)return;const val=Number(r.valor),yy=ax.y(val),color=waColorEstado(r);pts.push([x,yy]);g+=`<circle cx="${x}" cy="${yy.toFixed(1)}" r="4.6" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${esc(`${slot.operador||'Sin operador'} · ${waValorTexto(r,true)} · ${waEstadoTxt(r)}`)}</title></circle><text x="${x}" y="${Math.max(ax.pad.t+12,yy-8).toFixed(1)}" text-anchor="middle" font-size="10.4" font-weight="600" fill="${color}">${esc(waNumero(val))}</text>`;});
    if(pts.length>1)g+=`<path d="${pts.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${c.color}" stroke-width="2" opacity=".72"/>`;
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(def.variable+' del día')}">${g}</svg>`;
  }else{
    const ax=waAxisStatus(W,H),xs=waXPositions(slots.length,ax.pad,W);let g=ax.svg,pts=[];
    rows.forEach((r,i)=>{const x=xs[i],slot=slots[i];g+=`<text x="${x}" y="${H-10}" text-anchor="middle" font-size="10.2" fill="${C.ink3}">${esc(waShortTurn(slot.turno)+' · '+slot.reporteId)}</text>`;if(!r)return;const code=waStatusCode(r),yy=ax.y(code),color=waColorEstado(r);pts.push([x,yy]);g+=`<circle cx="${x}" cy="${yy.toFixed(1)}" r="5" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${esc(`${slot.operador||'Sin operador'} · ${waValorTexto(r)} · ${waEstadoTxt(r)}`)}</title></circle><text x="${x}" y="${Math.max(ax.pad.t+12,yy-9).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="${color}">${esc(waEstadoCorto(r))}</text>`;});
    if(pts.length>1)g+=`<path d="${pts.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${c.color}" stroke-width="2" opacity=".6"/>`;
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(def.variable+' del día')}">${g}</svg>`;
  }
}
function renderWAHistoricoCompleto(host,tab,def){
  if(!host||!def)return;const c=waCfg(tab),rows=waRowsVar(tab,def.id,true).slice().sort(waSortRows);if(!rows.length){host.innerHTML=`<div class="ptar-chart-empty">Sin histórico fechado para ${esc(def.variable)}.</div>`;return;}
  const numeric=waEsNumerica(tab,def),W=780,H=255,dates=[...new Set(rows.map(r=>r.fecha))],priority=rows.filter(waEsPrioridad).length;
  const makeDateLabels=(xs,pad)=>{let s='';dates.forEach(d=>{const idxs=rows.map((r,i)=>r.fecha===d?i:-1).filter(i=>i>=0);if(!idxs.length)return;const x=idxs.reduce((a,i)=>a+xs[i],0)/idxs.length;s+=`<text x="${x.toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="9.8" fill="${C.ink3}">${esc(waFechaTxt(d,false))}</text>`;});return s;};
  if(numeric){
    const nums=rows.map(r=>r.valor).filter(v=>v!==null&&v!==undefined).map(Number).filter(Number.isFinite);if(!nums.length){host.innerHTML=`<div class="ptar-chart-empty">Sin histórico numérico de ${esc(def.variable)}.</div>`;return;}
    const ax=waAxisNumeric(nums,W,H),xs=waXPositions(rows.length,ax.pad,W);let g=ax.svg+makeDateLabels(xs,ax.pad),pts=[];
    rows.forEach((r,i)=>{if(r.valor===null||r.valor===undefined)return;const val=Number(r.valor),x=xs[i],yy=ax.y(val),color=waColorEstado(r);pts.push([x,yy]);g+=`<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${waEsPrioridad(r)?4.5:3.4}" fill="${color}" stroke="#fff" stroke-width="1.1"><title>${esc(`${waFechaTxt(r.fecha,true)} · ${waShortTurn(r.turno)} · ${r.operador||''} · ${waValorTexto(r,true)} · ${waEstadoTxt(r)}`)}</title></circle>`;});
    if(pts.length>1)g+=`<path d="${pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${c.color}" stroke-width="2" opacity=".7"/>`;
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Histórico de ${esc(def.variable)}">${g}</svg><div class="ptar-history-foot"><span>${dates.length} días · ${rows.length} lecturas</span><span>${priority?priority+' prioritarias':'sin alertas reportadas'}</span></div>`;
  }else{
    const ax=waAxisStatus(W,H),xs=waXPositions(rows.length,ax.pad,W);let g=ax.svg+makeDateLabels(xs,ax.pad),pts=[];
    rows.forEach((r,i)=>{const x=xs[i],yy=ax.y(waStatusCode(r)),color=waColorEstado(r);pts.push([x,yy]);g+=`<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${waEsPrioridad(r)?4.6:3.5}" fill="${color}" stroke="#fff" stroke-width="1.1"><title>${esc(`${waFechaTxt(r.fecha,true)} · ${waShortTurn(r.turno)} · ${r.operador||''} · ${waValorTexto(r)} · ${waEstadoTxt(r)}`)}</title></circle>`;});
    if(pts.length>1)g+=`<path d="${pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${c.color}" stroke-width="2" opacity=".62"/>`;
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Histórico de estado de ${esc(def.variable)}">${g}</svg><div class="ptar-history-foot"><span>${dates.length} días · ${rows.length} reportes</span><span>${priority?priority+' condiciones prioritarias':'sin alertas reportadas'}</span></div>`;
  }
}
function pintarWAGraficas(tab){
  const c=waCfg(tab),host=document.getElementById(`${tab}-graficas-procesos`);if(!c||!host)return;const areas=waAreas(tab);
  host.innerHTML=areas.map((area,ai)=>{const vars=waVarsArea(tab,area),v=waVariableGrafica(tab,area),histSel=waHistSel(tab,area);const opciones=vars.map(x=>`<option value="${x.id}" ${x.id===v.id?'selected':''}>${esc(x.equipo+' · '+x.variable)}</option>`).join('');const opHist=`<option value="__all__" ${histSel==='__all__'?'selected':''}>Todas las gráficas</option>`+vars.map(x=>`<option value="${x.id}" ${histSel===x.id?'selected':''}>${esc(x.equipo+' · '+x.variable)}</option>`).join('');const histVars=histSel==='__all__'?vars:vars.filter(x=>x.id===histSel);const historical=histVars.map((hv,vi)=>`<article class="ptar-history-var-card wa-history-card"><div class="ptar-history-var-h"><div><strong>${esc(hv.variable)}</strong><span>${esc(hv.equipo)}</span></div><span class="ptar-history-range">${esc(waCriterio(hv))}</span></div><div class="ptar-history-chart" data-wa-history="${tab}|${ai}|${hv.id}"></div></article>`).join('');return `<section class="card ptar-chart-process-card wa-theme wa-${tab}-theme" aria-labelledby="wa-${tab}-chart-${ai}"><div class="card-h"><div><h3 id="wa-${tab}-chart-${ai}">${esc(area)}</h3><span class="ptar-process-chart-sub">${vars.length} variables · histórico de reportes operacionales</span></div><label class="ptar-chart-selector">Variable para lectura del día<select data-wa-day-selector="${tab}|${ai}" aria-label="Variable del día a graficar de ${esc(area)}">${opciones}</select></label></div><div class="card-b"><div class="ptar-day-block"><div class="ptar-chart-meta"><strong>${esc(v.variable)}</strong><span>${esc(v.equipo)}</span><span>Criterio: ${esc(waCriterio(v))}</span>${v.unidad?`<span>Unidad: ${esc(v.unidad)}</span>`:''}</div><div class="ptar-chart-panel ptar-day-panel"><div class="ptar-chart-panel-h"><h4>Reportes del día seleccionado</h4><span class="sub">${waFechaTxt(c.fecha,true)} · turnos reportados 06:00–18:00 / 18:00–06:00</span></div><div class="ptar-process-chart" data-wa-day="${tab}|${ai}"></div></div></div><div class="ptar-all-history"><div class="ptar-all-history-h"><div><h4>Comportamiento histórico de todas las variables</h4><p>Selecciona una gráfica específica o muestra todas las variables del área.</p></div><div class="history-toolbar"><label class="history-chart-selector">Gráfica a visualizar<select data-wa-history-selector="${tab}|${ai}" aria-label="Gráfica histórica a visualizar de ${esc(area)}">${opHist}</select></label><span class="wa-history-key"><i class="ok"></i>Normal <i class="warn"></i>Alerta <i class="crit"></i>Fuera de servicio</span></div></div><div class="ptar-history-grid ${histSel==='__all__'?'':'is-single'}">${historical}</div></div></div></section>`;}).join('');
  areas.forEach((area,ai)=>{const v=waVariableGrafica(tab,area);renderWADia(host.querySelector(`[data-wa-day="${tab}|${ai}"]`),tab,v);host.querySelectorAll(`[data-wa-history^="${tab}|${ai}|"]`).forEach(el=>{const id=el.getAttribute('data-wa-history').split('|')[2],def=waDef(tab,id);renderWAHistoricoCompleto(el,tab,def);});});
  host.querySelectorAll('[data-wa-day-selector]').forEach(sel=>sel.addEventListener('change',()=>{const [t,idx]=sel.dataset.waDaySelector.split('|');const area=waAreas(t)[Number(idx)],cfg=waCfg(t);if(area&&cfg){cfg.graficaVar[area]=sel.value;pintarWAGraficas(t);}}));
  host.querySelectorAll('[data-wa-history-selector]').forEach(sel=>sel.addEventListener('change',()=>{const [t,idx]=sel.dataset.waHistorySelector.split('|');const area=waAreas(t)[Number(idx)],cfg=waCfg(t);if(area&&cfg){cfg.historicoSel[area]=sel.value;pintarWAGraficas(t);}}));
}
function waPoblarFechas(tab){
  const c=waCfg(tab);if(!c)return;const sels=[document.getElementById(`${tab}-date-select`),document.getElementById(`${tab}-summary-date-select`)].filter(Boolean);
  const tieneSinFecha=c.data.some(r=>!r.fecha);const opciones=c.fechas.map(f=>`<option value="${f}">${waFechaTxt(f,true)}</option>`).join('')+(tieneSinFecha?`<option value="__sin_fecha__">Sin fecha exacta</option>`:'');
  sels.forEach(sel=>{sel.innerHTML=opciones;sel.value=c.fecha||'';if(!sel.dataset.bound){sel.dataset.bound='1';sel.addEventListener('change',()=>{c.fecha=sel.value;sels.forEach(s=>s.value=c.fecha);pintarWA(tab);pintarValores();pintarEncabezado();pintarPrioridades();});}});
}
function waProcessSummary(tab,area){const st=waStats(tab,area),e=waEstadoServicio(st);return `<div class="ptar-summary-process"><div class="ptar-summary-process-h"><strong>${esc(area)}</strong><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span></div><div class="ptar-summary-process-v"><b>${st.variables}</b> variables · ${st.registradas} registros · ${st.prioridad} prioritarios</div><div class="ptar-progress"><i style="width:${st.ok+st.warn+st.crit?st.pctNormal.toFixed(1):0}%"></i></div></div>`;}
function pintarWADeviaciones(tab){
  const c=waCfg(tab),host=document.getElementById(`${tab}-desviaciones`),count=document.getElementById(`${tab}-desv-count`);if(!c||!host)return;const list=waRowsFecha(tab).filter(waEsPrioridad).slice().sort((a,b)=>(waEstadoClase(a)==='crit'?0:1)-(waEstadoClase(b)==='crit'?0:1)||String(a.area).localeCompare(String(b.area),'es'));
  if(count)count.textContent=list.length?`${list.length} detectada${list.length===1?'':'s'}`:'ninguna';
  host.innerHTML=list.length?list.map(r=>`<div class="ptar-dev wa-dev ${waEstadoClase(r)}"><span class="bar" style="background:${waColorEstado(r)}"></span><div class="body"><div class="title">${esc(r.equipo)} · ${esc(r.variable)} · ${esc(waValorTexto(r,true))}</div><div class="meta">${esc(r.area)} · ${esc(waEstadoTxt(r))} · ${esc(r.reporteId||'')}</div>${r.operador?`<div class="obs">Operador: ${esc(r.operador)}</div>`:''}${r.observacion?`<div class="obs">${esc(r.observacion)}</div>`:''}</div><time>${esc(waShortTurn(r.turno))}</time></div>`).join(''):`<p class="empty">No hay alertas ni condiciones fuera de servicio reportadas el ${waFechaTxt(c.fecha,true)}.</p>`;
}
function pintarWA(tab){
  const c=waCfg(tab);if(!c||!c.catalogo.length)return;waPoblarFechas(tab);const total=waStats(tab),eTotal=waEstadoServicio(total),areas=waAreas(tab);
  document.querySelectorAll(`[data-${tab}-summary-count]`).forEach(el=>el.textContent=String(total.registradas));
  const sumPill=document.querySelector(`[data-${tab}-summary-pill]`);if(sumPill){sumPill.className='pill '+eTotal.st;sumPill.innerHTML='<i></i>'+esc(eTotal.txt);}
  const stripVal=document.querySelector(`[data-${tab}-strip-value]`);if(stripVal)stripVal.textContent=String(total.prioridad);
  const stripPill=document.querySelector(`[data-${tab}-strip-pill]`);if(stripPill){stripPill.className='pill '+eTotal.st;stripPill.innerHTML='<i></i>'+esc(eTotal.txt);}
  const resumen=document.getElementById(`${tab}-resumen-procesos`);if(resumen)resumen.innerHTML=areas.map(a=>waProcessSummary(tab,a)).join('');
  if(typeof activa!=='undefined' && activa!==tab) return;
  const kpis=document.getElementById(`${tab}-kpis-proceso`);if(kpis)kpis.innerHTML=areas.map(a=>{const st=waStats(tab,a),e=waEstadoServicio(st);return `<div class="kpi wa-process-kpi wa-${tab}-kpi"><div class="lbl"><span>${esc(a)}</span><span class="pill ${e.st}" style="margin-left:auto"><i></i>${esc(e.txt)}</span></div><div class="v tnum">${st.registradas}<small>registros</small></div><div class="rng">${st.variables} variables · ${st.crit} críticas · ${st.warn} alertas</div><div class="ptar-progress"><i style="width:${st.ok+st.warn+st.crit?st.pctNormal.toFixed(1):0}%"></i></div></div>`;}).join('');
  const processHost=document.getElementById(`${tab}-procesos`);if(processHost){const slots=waSlots(tab),slotHeaders=slots.map(s=>`<th class="num">${esc(waShortTurn(s.turno))}<small>${esc(s.operador||'Sin operador')} · ${esc(s.reporteId||'')}</small></th>`).join('');processHost.innerHTML=areas.map((area,ai)=>{const vars=waVarsArea(tab,area),st=waStats(tab,area),e=waEstadoServicio(st);const byEquip=new Map();vars.forEach(v=>{if(!byEquip.has(v.equipo))byEquip.set(v.equipo,[]);byEquip.get(v.equipo).push(v);});const rows=[...byEquip.entries()].map(([eq,vlist])=>vlist.map((v,i)=>{const eqCell=i===0?`<td class="ptar-puesto" rowspan="${vlist.length}">${esc(eq)}</td>`:'';const recs=slots.map(s=>waRegistro(tab,v.id,s,c.fecha));const hasPriority=recs.some(waEsPrioridad);const cells=recs.map(r=>{const stc=waEstadoClase(r);return `<td class="num ptar-lectura wa-cell ${stc}" title="${esc(r?waEstadoTxt(r):'Sin dato')}">${r?`${r.indicador?`<span class="wa-indicator">${esc(r.indicador)}</span> `:''}${esc(waValorTexto(r,true))}`:'—'}</td>`;}).join('');return `<tr class="${hasPriority?'has-dev':''}">${eqCell}<td>${esc(v.variable)}</td><td class="ptar-rango">${esc(waCriterio(v))}</td>${cells}</tr>`;}).join('')).join('');return `<section class="card ptar-process-card wa-theme wa-${tab}-theme" aria-labelledby="wa-${tab}-proc-${ai}"><div class="card-h"><h3 id="wa-${tab}-proc-${ai}">${esc(area)}</h3><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span><span class="note">${waFechaTxt(c.fecha,true)} · ${st.registradas} registros</span></div><div class="card-b ptar-table-wrap"><table class="tbl ptar-table wa-real-table"><thead><tr><th>Equipo</th><th>Variable</th><th>Criterio / rango disponible</th>${slotHeaders}</tr></thead><tbody>${rows}</tbody></table></div></section>`;}).join('');}
  pintarWAGraficas(tab);pintarWADeviaciones(tab);
}
function prioridadWA(tab){
  const c=waCfg(tab);if(!c)return[];const rows=waRowsFecha(tab).filter(waEsPrioridad),m=new Map();rows.forEach(r=>{if(!m.has(r.id))m.set(r.id,{tipo:'wa',waTab:tab,servicio:c.nombre,tab,color:c.color,id:r.id,def:waDef(tab,r.id),rows:[]});m.get(r.id).rows.push(r);});
  return [...m.values()].map(g=>{g.rows.sort(waSortRows);const r=g.rows[0],last=g.rows[g.rows.length-1],def=g.def||{},crit=g.rows.some(x=>waEstadoClase(x)==='crit');return Object.assign(g,{severity:crit?'crit':'warn',variable:r.variable,proceso:r.area,puesto:r.equipo,rango:waCriterio(def),unidad:def.unidad||r.unidad||'',fecha:c.fecha,fechaTxt:waFechaTxt(c.fecha,true),lecturas:g.rows.map(x=>`${waShortTurn(x.turno)} · ${waValorTexto(x,true)} · ${waEstadoTxt(x)}`).join(' · '),operadores:[...new Set(g.rows.map(x=>x.operador).filter(Boolean))].join(' / '),observacion:[...new Set(g.rows.map(x=>x.observacion).filter(Boolean))].join(' · '),lecturaPrincipal:waValorTexto(last),turnoPrincipal:waShortTurn(last.turno)});});
}
function cargarWA(tab,data,catalogo,fechas,source){const c=waCfg(tab);if(!c)return;c.data=(data||[]).slice();c.catalogo=(catalogo||[]).slice();c.fechas=[...new Set((fechas&&fechas.length?fechas:c.data.map(r=>r.fecha).filter(Boolean)))].sort();if(!c.fecha||!c.fechas.includes(c.fecha))c.fecha=c.fechas[c.fechas.length-1]||null;c.source=source||c.source;waPoblarFechas(tab);if(document.body&&document.body.dataset.dashboardReady==='1'){pintarWA(tab);pintarValores();pintarEncabezado();pintarPrioridades();}}
function waExcelDate(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='number'){const d=new Date(Date.UTC(1899,11,30));d.setUTCDate(d.getUTCDate()+Math.floor(v));return d.toISOString().slice(0,10);}const s=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;}return null;}
function waObjs(rows){if(!rows||!rows.length)return[];const h=rows[0].map(x=>String(x??'').trim());return rows.slice(1).filter(r=>r.some(v=>v!==''&&v!==null&&v!==undefined)).map(r=>{const o={};h.forEach((k,i)=>{if(k)o[k]=r[i]??'';});return o;});}
function waBuildCatalog(rows,areas,prefix){let n=0;return rows.filter(r=>areas.includes(String(r['Proceso / Área']||'').trim())).map(r=>({id:`${prefix}_${String(++n).padStart(2,'0')}`,area:String(r['Proceso / Área']||'').trim(),equipo:String(r['Equipo / Puesto']||'').trim(),variable:String(r.Variable||'').trim(),unidad:String(r.Unidad||'').trim(),tipoDato:String(r['Tipo de dato']||'').trim(),rango:String(r['Rango operativo']||'').trim(),criterio:String(r['Criterio disponible en fuente']||'').trim()}));}
function waNormalizeExcelData(rows,catalogo,areas){const map=new Map(catalogo.map(v=>[[v.area,v.equipo,v.variable].join('|'),v.id]));return rows.filter(r=>String(r['Incluir dashboard']||'').trim().toLowerCase()==='sí'&&areas.includes(String(r['Proceso / Área']||'').trim())).map(r=>{const area=String(r['Proceso / Área']||'').trim(),equipo=String(r['Equipo / Puesto']||'').trim(),variable=String(r.Variable||'').trim(),id=map.get([area,equipo,variable].join('|'));if(!id)return null;const raw=r['Valor numérico'],num=raw===''||raw===null||raw===undefined?null:Number(raw);return{fecha:waExcelDate(r['Fecha operativa']),confianzaFecha:String(r['Confianza fecha']||''),turno:String(r.Turno||''),turnoOriginal:String(r['Turno original']||''),operador:String(r.Operador||''),reporteId:String(r['Reporte ID']||''),area,equipo,variable,valor:Number.isFinite(num)?num:null,texto:String(r['Valor texto']||''),unidad:String(r.Unidad||''),indicador:String(r.Indicador||''),estado:String(r['Estado normalizado']||''),observacion:String(r.Observación||''),linea:String(r['Línea original']||''),id};}).filter(Boolean);}
async function leerExcelWA(buffer){
  const zip=await abrirZipPTAR(buffer),parser=new DOMParser(),wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml'),relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml'),rels=[...relXml.getElementsByTagNameNS('*','Relationship')];let shared=[];
  if(zip.entries.has('xl/sharedStrings.xml')){const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));}
  const sheets=[...wbXml.getElementsByTagNameNS('*','sheet')];async function getSheet(name){const sh=sheets.find(s=>s.getAttribute('name')===name);if(!sh)throw new Error(`No existe la hoja "${name}".`);const rid=sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sh.getAttribute('r:id'),rel=rels.find(r=>r.getAttribute('Id')===rid);if(!rel)throw new Error('No se pudo resolver '+name);let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');return leerHojaXLSXPTAR(zip,target,shared);}
  return{datos:waObjs(await getSheet('Datos Dashboard')),catalogo:waObjs(await getSheet('Catálogo'))};
}
function cargarExcelWAParseado(parsed,source){const ac=waBuildCatalog(parsed.catalogo,WA_CFG.aire.areasPermitidas,'aire'),nc=waBuildCatalog(parsed.catalogo,WA_CFG.frio.areasPermitidas,'nh3'),ad=waNormalizeExcelData(parsed.datos,ac,WA_CFG.aire.areasPermitidas),nd=waNormalizeExcelData(parsed.datos,nc,WA_CFG.frio.areasPermitidas);if(!ad.length&&!nd.length)throw new Error('No se encontraron registros válidos para Compresores de Aire o Refrigeración/NH3.');cargarWA('aire',ad,ac,[...new Set(ad.map(r=>r.fecha).filter(Boolean))],source);cargarWA('frio',nd,nc,[...new Set(nd.map(r=>r.fecha).filter(Boolean))],source);}
async function cargarExcelWAArchivo(file){const parsed=await leerExcelWA(await file.arrayBuffer());cargarExcelWAParseado(parsed,`${file.name} · ${parsed.datos.length} filas · archivo seleccionado`);}
async function cargarWAAutomatico(){if(location.protocol==='file:')return;try{const resp=await fetch('Historial_Reportes_Compresores_Refrigeracion_WhatsApp.xlsx',{cache:'no-store'});if(!resp.ok)throw new Error('HTTP '+resp.status);const parsed=await leerExcelWA(await resp.arrayBuffer());cargarExcelWAParseado(parsed,`Historial_Reportes_Compresores_Refrigeracion_WhatsApp.xlsx · carga automática`);}catch(err){}}
function inicializarWAExcel(){['aire-excel-input','frio-excel-input'].forEach(id=>{const input=document.getElementById(id);if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('change',async()=>{const f=input.files&&input.files[0];if(!f)return;try{await cargarExcelWAArchivo(f);}catch(err){alert('No se pudo leer el Excel de Compresores/Refrigeración: '+err.message);}finally{input.value='';}});}});cargarWAAutomatico();}



/* ---------------------------------------------------------
   9B. Prioridad operacional · variables fuera de rango
   Se muestra antes que el resto del contenido en Resumen y en cada pestaña.
   --------------------------------------------------------- */
function prioridadReal(tipo){
  let rows=[], defFn=null, valorFn=null, fecha='', fechaFn=null, turnoFn=t=>t, color=C.crit, servicio='', tab='';
  if(tipo==='ptar'){
    rows=registrosFechaPTAR().filter(r=>estadoRegistroPTAR(r)==='FUERA DE RANGO');
    defFn=ptarDefPorId; valorFn=valorTextoPTAR; fecha=PTAR_FECHA; fechaFn=etiquetaFechaPTAR; color=C.ptar; servicio='PTAR'; tab='ptar';
  }else if(tipo==='vapor'){
    rows=registrosFechaVapor().filter(r=>estadoRegistroVapor(r)==='FUERA DE RANGO');
    defFn=vaporDefPorId; valorFn=valorTextoVapor; fecha=VAPOR_FECHA; fechaFn=etiquetaFechaVapor; color=C.vapor; servicio='Vapor'; tab='vapor';
  }else if(tipo==='suav'){
    rows=registrosFechaSuav().filter(r=>estadoRegistroSuav(r)==='FUERA DE RANGO');
    defFn=suavDefPorId; valorFn=valorTextoSuav; fecha=SUAV_FECHA; fechaFn=etiquetaFechaSuav; color=C.suav; servicio='Suavizadores · Tanques'; tab='suav';
    turnoFn=t=>SUAV_TURNO_ETIQUETA[t]||t;
  }else if(tipo==='ptab'){
    rows=registrosFechaPtabr().filter(r=>estadoRegistroPtabr(r)==='FUERA DE RANGO');
    defFn=ptabrDefPorId; valorFn=valorTextoPtabr; fecha=PTABR_FECHA; fechaFn=etiquetaFechaPtabr; color=C.agua; servicio='PTAB · Aguas Blancas'; tab='ptab';
    turnoFn=t=>PTABR_TURNO_ETIQUETA[t]||t;
  }
  const map=new Map();
  rows.forEach(r=>{
    if(!map.has(r.id)) map.set(r.id,{tipo,servicio,tab,color,id:r.id,def:defFn(r.id),rows:[]});
    map.get(r.id).rows.push(r);
  });
  return [...map.values()].map(g=>{
    const r=g.rows[0], v=g.def||{};
    const lecturas=g.rows.map(x=>`${turnoFn(x.turno)} · ${valorFn(x)}${v.unidad?' '+v.unidad:''}`).join(' · ');
    const operadores=[...new Set(g.rows.map(x=>x.operador).filter(Boolean))].join(' / ');
    const obs=[...new Set(g.rows.map(x=>x.observacion).filter(Boolean))].join(' · ');
    return Object.assign(g,{
      severity:'crit', variable:r.variable, proceso:r.proceso,
      puesto:r.puesto||r.frecuencia||'', rango:r.rango||v.rango||'—', unidad:v.unidad||'',
      fecha, fechaTxt:fechaFn(fecha,true), lecturas, operadores, observacion:obs,
      lecturaPrincipal:valorFn(g.rows[g.rows.length-1]), turnoPrincipal:turnoFn(g.rows[g.rows.length-1].turno)
    });
  });
}
function prioridadSimulada(tab){
  const svc=SERVICIOS[tab];
  if(!svc || !svc.keys) return [];
  return svc.keys.filter(k=>estado(k)!=='ok').map(k=>{
    const st=estado(k), v=V[k];
    return {tipo:'sim',servicio:svc.nom,tab,color:svc.color||C.ink,id:k,def:v,rows:[],severity:st,
      variable:v.lbl,proceso:svc.nom,puesto:'Lectura de '+RONDAS[ronda].hora,rango:rangoTexto(k),unidad:v.u||'',
      fecha:'',fechaTxt:FECHA,lecturas:`${RONDAS[ronda].hora} · ${fmt(k)}${v.u?' '+v.u:''}`,
      operadores:'',observacion:'',lecturaPrincipal:fmt(k),turnoPrincipal:RONDAS[ronda].hora};
  });
}
function prioridadesTab(tab){
  if(tab==='ptar') return prioridadReal('ptar');
  if(tab==='vapor') return prioridadReal('vapor');
  if(tab==='suav') return prioridadReal('suav');
  if(tab==='ptab') return prioridadReal('ptab');
  if(tab==='aire'||tab==='frio') return prioridadWA(tab);
  return [];
}
function prioridadesResumen(){
  const all=[
    ...prioridadReal('ptab'),...prioridadReal('suav'),...prioridadReal('vapor'),...prioridadWA('aire'),...prioridadWA('frio'),...prioridadReal('ptar')
  ];
  return all.sort((a,b)=>{
    const rank=s=>s==='crit'?0:1;
    return rank(a.severity)-rank(b.severity) || a.servicio.localeCompare(b.servicio,'es');
  });
}
function prioridadDetalle(item){
  const parts=[];
  if(item.proceso && item.proceso!==item.servicio) parts.push(`<b>${esc(item.proceso)}</b>`);
  if(item.puesto) parts.push(esc(item.puesto));
  if(item.fechaTxt) parts.push(esc(item.fechaTxt));
  return parts.join(' · ');
}
function prioridadRenderGrafica(host,item){
  if(!host) return;
  if(item.tipo==='ptar' && item.def){ renderPTARHistoricoCompleto(host,item.def); return; }
  if(item.tipo==='vapor' && item.def){ renderVaporHistoricoCompleto(host,item.def); return; }
  if(item.tipo==='suav' && item.def){ renderSuavHistoricoCompleto(host,item.def); return; }
  if(item.tipo==='ptab' && item.def){ renderPtabrHistoricoCompleto(host,item.def); return; }
  if(item.tipo==='wa' && item.def){ renderWAHistoricoCompleto(host,item.waTab,item.def); return; }
  if(item.tipo==='sim'){
    const k=item.id,v=V[k], limits=[], bands=[];
    if(v.dir==='band'){
      bands.push({lo:v.lo,hi:v.hi,color:item.color});
      limits.push({v:v.lo,color:C.warn,txt:'mín. '+fmt(k,v.lo)},{v:v.hi,color:C.warn,txt:'máx. '+fmt(k,v.hi)});
    }else if(v.dir==='high'){
      limits.push({v:v.warn,color:C.warn,txt:'aviso '+fmt(k,v.warn)},{v:v.crit,color:C.crit,txt:'crítico '+fmt(k,v.crit)});
    }else if(v.dir==='low'){
      limits.push({v:v.warn,color:C.warn,txt:'aviso '+fmt(k,v.warn)},{v:v.crit,color:C.crit,txt:'crítico '+fmt(k,v.crit)});
    }
    renderLine(host,{h:165,unit:v.u||'',dec:v.dec,aria:'Tendencia prioritaria de '+v.lbl,
      series:[{name:v.lbl,color:item.color,get:()=>win(k),area:true}],limits,bands});
  }
}
const PRIORITY_PAGE = Object.create(null);
const PRIORITY_DIR = Object.create(null);
const PRIORITY_PAGE_SIZE = 3;
function renderPriorityZone(host,items,tab){
  if(!host) return;
  const isResumen=tab==='resumen', crit=items.filter(x=>x.severity==='crit').length, warn=items.length-crit;
  host.className='priority-zone mb '+(items.length?(crit?'has-alerts':'has-warnings'):'is-ok');
  const title=isResumen?'Prioridad operacional · desviaciones y condiciones fuera de norma':'Desviaciones y condiciones prioritarias';
  const sub=isResumen
    ? 'Las desviaciones, alertas y equipos fuera de servicio se muestran antes que cualquier otro indicador para facilitar la actuación del operador.'
    : 'Se muestran primero las variables que requieren atención en la fecha seleccionada, junto con su comportamiento.';
  const head=`<div class="priority-head"><div class="priority-title-wrap"><span class="priority-icon">${items.length?'!':'✓'}</span><div><h3>${title}</h3><p>${sub}</p></div></div><div class="priority-count">${items.length?`<span class="pill crit"><i></i>${items.length} variable${items.length===1?'':'s'} prioritaria${items.length===1?'':'s'}</span>${warn?`<span class="pill warn"><i></i>${warn} en atención</span>`:''}`:`<span class="pill ok"><i></i>Sin desviaciones</span>`}</div></div>`;
  if(!items.length){
    PRIORITY_PAGE[tab]=0;
    PRIORITY_DIR[tab]=1;
    host.innerHTML=head+`<div class="priority-body"><div class="priority-ok"><span class="pill ok"><i></i>Normal</span><div><strong>No hay variables fuera de rango.</strong><br><span>Continúa con la revisión del resto de indicadores y registros.</span></div></div></div>`;
    return;
  }

  const pages=Math.max(1,Math.ceil(items.length/PRIORITY_PAGE_SIZE));
  let page=Math.min(Math.max(PRIORITY_PAGE[tab]||0,0),pages-1);
  PRIORITY_PAGE[tab]=page;
  const from=page*PRIORITY_PAGE_SIZE;
  const shown=items.slice(from,from+PRIORITY_PAGE_SIZE);
  const slideClass=(PRIORITY_DIR[tab]||1)<0?'priority-slide-prev':'priority-slide-next';

  const cards=shown.map((it,localIndex)=>{
    const originalIndex=from+localIndex;
    const sev=it.severity==='warn'?'warn':'';
    const rango=it.rango||'—';
    const oper=it.operadores?`<span><b>Operador:</b> ${esc(it.operadores)}</span>`:'';
    const obs=it.observacion?`<div class="priority-detail"><strong>Observación:</strong> ${esc(it.observacion)}</div>`:'';
    const lecturaDetalle=it.rows&&it.rows.length>1?`<div class="priority-detail"><strong>Lecturas fuera de rango:</strong> ${esc(it.lecturas)}</div>`:'';
    return `<article class="priority-card ${sev}">
      <div class="priority-card-head"><div class="priority-card-title"><div class="priority-card-service">${esc(it.servicio)}</div><h4>${esc(it.variable)}</h4></div><div class="priority-reading">${esc(it.lecturaPrincipal)}${it.unidad?`<small>${esc(it.unidad)}</small>`:''}</div></div>
      <div class="priority-meta"><span>${prioridadDetalle(it)}</span><span><b>${it.tipo==='wa'?'Criterio':'Rango'}:</b> ${esc(rango)}</span><span><b>Turno:</b> ${esc(it.turnoPrincipal||'—')}</span>${oper}</div>
      ${lecturaDetalle}${obs}
      <div class="priority-chart-wrap"><div class="priority-chart-label"><span>Comportamiento de la variable</span><span>${it.tipo==='sim'?'ronda actual':'histórico disponible'}</span></div><div class="priority-chart" data-priority-chart="${originalIndex}"></div></div>
      ${isResumen?`<div class="priority-actions"><button class="priority-go" type="button" data-goto="${esc(it.tab)}">Abrir ${esc(it.servicio)} →</button></div>`:''}
    </article>`;
  }).join('');

  const pager=pages>1?`<div class="priority-pager-wrap">
    <div class="priority-pager" role="group" aria-label="Navegación de variables fuera de rango">
      <button class="priority-page-btn" type="button" data-priority-prev aria-label="Ver tres variables anteriores" ${page===0?'disabled':''}><span aria-hidden="true">←</span></button>
      <div class="priority-page-status" aria-live="polite">
        <span class="priority-page-range"><strong>${from+1}–${Math.min(from+PRIORITY_PAGE_SIZE,items.length)}</strong> de ${items.length}</span>
        <span class="priority-page-dots" aria-hidden="true">${Array.from({length:pages},(_,i)=>`<i class="${i===page?'active':''}"></i>`).join('')}</span>
        <span class="priority-page-number">${page+1} / ${pages}</span>
      </div>
      <button class="priority-page-btn" type="button" data-priority-next aria-label="Ver tres variables siguientes" ${page===pages-1?'disabled':''}><span aria-hidden="true">→</span></button>
    </div>
  </div>`:'';

  host.innerHTML=head+`<div class="priority-body"><div class="priority-carousel"><div class="priority-grid ${slideClass}">${cards}</div></div>${pager}</div>`;

  shown.forEach((it,localIndex)=>{
    const originalIndex=from+localIndex;
    prioridadRenderGrafica(host.querySelector(`[data-priority-chart="${originalIndex}"]`),it);
  });

  const prev=host.querySelector('[data-priority-prev]');
  const next=host.querySelector('[data-priority-next]');
  if(prev) prev.addEventListener('click',()=>{
    if(PRIORITY_PAGE[tab]>0){
      PRIORITY_DIR[tab]=-1;
      PRIORITY_PAGE[tab]-=1;
      renderPriorityZone(host,items,tab);
    }
  });
  if(next) next.addEventListener('click',()=>{
    if(PRIORITY_PAGE[tab]<pages-1){
      PRIORITY_DIR[tab]=1;
      PRIORITY_PAGE[tab]+=1;
      renderPriorityZone(host,items,tab);
    }
  });
}
function pintarPrioridades(){
  renderPriorityZone(document.getElementById('priority-resumen'),prioridadesResumen(),'resumen');
  const tabActual=(typeof activa!=='undefined'&&activa)?activa:'resumen';
  if(tabActual!=='resumen') renderPriorityZone(document.getElementById('priority-'+tabActual),prioridadesTab(tabActual),tabActual);
}

/* ---------------------------------------------------------
   10. Construcción de la interfaz
   --------------------------------------------------------- */
const LINEAS = [
  {n:'Mayonesa',        prog:[12, 45, 78], tasa:['1 900 kg/h','4 200 kg/h','4 600 kg/h']},
  {n:'Rikesa',          prog:[4, 31, 54],  tasa:['1 200 kg/h','2 800 kg/h','3 100 kg/h']},
  {n:'Salsa de tomate', prog:[28, 58, 91], tasa:['2 400 kg/h','5 100 kg/h','5 400 kg/h']},
];

function buildKPIs(){
  document.querySelectorAll('[data-kpis]').forEach(box=>{
    box.innerHTML = KPI_TABS[box.dataset.kpis].map(k=>
      `<div class="kpi">
         <div class="lbl"><span>${esc(V[k].lbl)}</span><span class="pill ok" data-st="${k}" style="margin-left:auto"><i></i>Normal</span></div>
         <div class="v tnum"><span data-v="${k}">—</span>${V[k].u ? `<small>${esc(V[k].u)}</small>` : ''}</div>
         <div class="rng">${esc(rangoTexto(k))}</div>
         <div class="delta" data-d="${k}"></div>
       </div>`).join('');
  });
}
function buildStrip(){
  document.getElementById('strip').innerHTML = ['ptab','suav','vapor','aire','frio','ptar'].map(id=>{
    const s = SERVICIOS[id];
    if(id === 'ptab'){
      return `<button class="svc" data-goto="ptab" style="--k:${s.color}">
        <div class="n"><span>${esc(s.corto)}</span><span class="pill idle" data-ptab-strip-pill style="margin-left:auto"><i></i>Sin registros</span></div>
        <p class="lbl">Aguas Blancas · 2 procesos · 39 variables</p>
        <div class="v tnum"><span data-ptab-strip-value>—</span><small>fuera de rango</small></div>
        <div class="svc-meta">1er turno 06:00 am · 2do turno 06:00 pm</div>
      </button>`;
    }
    if(id === 'suav'){
      return `<button class="svc" data-goto="suav" style="--k:${s.color}">
        <div class="n"><span>${esc(s.corto)}</span><span class="pill idle" data-suav-strip-pill style="margin-left:auto"><i></i>Sin registros</span></div>
        <p class="lbl">Suavizadores + tanques · 2 procesos · 29 variables</p>
        <div class="v tnum"><span data-suav-strip-value>—</span><small>fuera de rango</small></div>
        <div class="svc-meta">1er turno 06:00 · 2do turno 06:00</div>
      </button>`;
    }
    if(id === 'vapor'){
      return `<button class="svc" data-goto="vapor" style="--k:${s.color}">
        <div class="n"><span>${esc(s.corto)}</span><span class="pill idle" data-vapor-strip-pill style="margin-left:auto"><i></i>Sin registros</span></div>
        <p class="lbl">Control de calderas · 6 procesos · 58 variables</p>
        <div class="v tnum"><span data-vapor-strip-value>—</span><small>fuera de rango</small></div>
        <div class="svc-meta">Turnos 07:00 · 19:00</div>
      </button>`;
    }
    if(id === 'aire'){
      return `<button class="svc" data-goto="aire" style="--k:${s.color}">
        <div class="n"><span>${esc(s.corto)}</span><span class="pill idle" data-aire-strip-pill style="margin-left:auto"><i></i>Sin registros</span></div>
        <p class="lbl">Compresores + trampas de aire · 2 áreas · 9 variables</p>
        <div class="v tnum"><span data-aire-strip-value>—</span><small>prioritarias</small></div>
        <div class="svc-meta">Turnos 06:00–18:00 · 18:00–06:00</div>
      </button>`;
    }
    if(id === 'frio'){
      return `<button class="svc" data-goto="frio" style="--k:${s.color}">
        <div class="n"><span>${esc(s.corto)}</span><span class="pill idle" data-frio-strip-pill style="margin-left:auto"><i></i>Sin registros</span></div>
        <p class="lbl">Refrigeración / NH₃ · 8 áreas · 37 variables</p>
        <div class="v tnum"><span data-frio-strip-value>—</span><small>prioritarias</small></div>
        <div class="svc-meta">Turnos 06:00–18:00 · 18:00–06:00</div>
      </button>`;
    }
    if(id === 'ptar'){
      return `<button class="svc" data-goto="ptar" style="--k:${s.color}">
        <div class="n"><span>${esc(s.corto)}</span><span class="pill idle" data-ptar-strip-pill style="margin-left:auto"><i></i>Sin registros</span></div>
        <p class="lbl">Control operacional · 4 procesos · 30 variables</p>
        <div class="v tnum"><span data-ptar-strip-value>—</span><small>fuera de rango</small></div>
        <div class="svc-meta">Turnos 07:00 · 19:00</div>
      </button>`;
    }
    const k = s.kpi;
    return `<button class="svc" data-goto="${id}" style="--k:${s.color}">
      <div class="n"><span>${esc(s.corto)}</span><span class="pill ok" data-st="${k}" style="margin-left:auto"><i></i>Normal</span></div>
      <p class="lbl">${esc(V[k].lbl)}</p>
      <div class="v tnum"><span data-v="${k}">—</span>${V[k].u ? `<small>${esc(V[k].u)}</small>` : ''}</div>
      <div class="spark" data-spark="${k}" data-color="${s.color}"></div>
    </button>`;
  }).join('');
}
function buildLegends(){
  const find = sel => REG.find(r => r.sel === sel).cfg.series;
  const put = (sel, series) => {
    const el = document.querySelector(sel);
    if(el) el.innerHTML = series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
  };
  put('#l-demanda', find('#c-demanda'));
  put('#l-lineas', CONSUMO_LINEA.series);
  put('#l-vapor', find('#c-vapor-efi'));
  put('#l-frio-temp', find('#c-frio-temp'));
  put('#l-frio-pres', find('#c-frio-pres'));
}
function pintarLineas(){
  const host=document.getElementById('lineas-prod');
  if(!host) return;
  host.innerHTML = LINEAS.map(l=>
    `<div class="line-row">
       <span class="nm">${esc(l.n)}</span>
       <span class="meter"><i style="width:${l.prog[ronda]}%"></i></span>
       <span class="pc tnum">${l.prog[ronda]} %</span>
     </div>`).join('') +
    `<p class="thr">Ritmo a las ${RONDAS[ronda].hora}: ${LINEAS.map(l=>esc(l.n)+' ' + l.tasa[ronda]).join(' · ')}</p>`;
}

function alarmas(){
  const out = [];
  for(const svc in SERVICIOS){
    const s = SERVICIOS[svc];
    if(!s.keys || !s.keys.length) continue;
    s.keys.forEach(k=>{
      if(k === 'frio.nh3') return;          // lo reporta el detector, con su ubicación
      const st = estado(k);
      if(st === 'ok') return;
      out.push({st, msg:`${V[k].lbl} en ${fmt(k)} ${V[k].u}`.trim(), meta:`${s.corto} · ${rangoTexto(k)}`});
    });
  }
  DETECTORES.forEach(d=>{
    const p = d.ppm[ronda];
    if(p >= 25) out.push({st: p >= 35 ? 'crit' : 'warn',
      msg:`Amoníaco en ${d.loc}: ${p.toFixed(1)} ppm`, meta:`Detector ${d.id} · aviso desde 25 ppm`});
  });
  return out.sort((a,b)=> (a.st === 'crit' ? 0 : 1) - (b.st === 'crit' ? 0 : 1));
}
function pintarAlarmas(){
  const box = document.getElementById('alarmas'), count = document.getElementById('alarm-count'), list = alarmas();
  if(!box || !count) return;
  count.textContent = list.length ? `${list.length} sin atender` : 'ninguna';
  box.innerHTML = list.length ? list.slice(0,7).map(a=>
    `<div class="alarm" style="--k:${a.st === 'crit' ? C.crit : C.warn}">
       <span class="bar"></span>
       <div><div class="msg">${esc(a.msg)}</div><div class="meta">${esc(a.meta)}</div></div>
       <time>${RONDAS[ronda].hora}</time>
     </div>`).join('')
    : `<p class="empty">Sin desviaciones en la ronda de las ${RONDAS[ronda].hora}.</p>`;
}
function pintarDetectores(){
  const host=document.getElementById('detectores'); if(!host) return;
  host.innerHTML = DETECTORES.map(d=>{
    const p = d.ppm[ronda], st = p >= 35 ? 'crit' : p >= 25 ? 'warn' : 'ok';
    return `<div class="sensor ${st}">
      <div class="n"><strong>${d.id}</strong><span class="pill ${st}" style="margin-left:auto"><i></i>${ETIQ[st]}</span></div>
      <div class="loc">${esc(d.loc)}</div>
      <div class="ppm tnum">${p.toFixed(1)}<small>ppm</small></div>
      <div class="bar"><i style="width:${Math.min(100, p/50*100)}%"></i></div>
    </div>`;
  }).join('');
}

/* ---------------------------------------------------------
   10. Repintado
   --------------------------------------------------------- */
let activa = 'resumen';

function pintarValores(){
  document.querySelectorAll('[data-v]').forEach(el=>{ el.textContent = fmt(el.dataset.v); });
  document.querySelectorAll('[data-st]').forEach(el=>{
    const st = estado(el.dataset.st);
    el.className = 'pill ' + st;
    el.innerHTML = '<i></i>' + ETIQ[st];
  });
  document.querySelectorAll('[data-spark]').forEach(el=>{
    el.innerHTML = sparkline(el.dataset.spark, el.dataset.color);
  });
  document.querySelectorAll('[data-d]').forEach(el=>{
    const k = el.dataset.d, ant = previa(k);
    if(ant == null){ el.className = 'delta'; el.textContent = 'Primera lectura del día'; return; }
    const d = cur(k) - ant, dir = Math.abs(d) < Math.pow(10, -V[k].dec)/2 ? '' : (d > 0 ? 'up' : 'down');
    el.className = 'delta ' + dir;
    el.innerHTML = dir === ''
      ? `Sin cambio respecto a las ${RONDAS[ronda-1].hora}`
      : `<b>${d > 0 ? '▲' : '▼'} ${fmt(k, Math.abs(d))}</b> respecto a las ${RONDAS[ronda-1].hora}`;
  });
  for(const svc in SERVICIOS){
    const s = SERVICIOS[svc], dot = document.querySelector(`[data-tabst="${svc}"]`);
    if(!dot) continue;
    let st = 'ok';
    if(svc === 'resumen'){
      const states=[
        ptabrEstado(ptabrStats()).st,
        suavEstado(suavStats()).st,
        vaporEstado(vaporStats()).st,
        waEstadoServicio(waStats('aire')).st,
        waEstadoServicio(waStats('frio')).st,
        ptarEstado(ptarStats()).st
      ];
      st=states.includes('crit')?'crit':states.includes('warn')?'warn':states.every(x=>x==='idle')?'idle':'ok';
    } else if(svc === 'ptab'){
      st = ptabrEstado(ptabrStats()).st;
    } else if(svc === 'suav'){
      st = suavEstado(suavStats()).st;
    } else if(svc === 'vapor'){
      st = vaporEstado(vaporStats()).st;
    } else if(svc === 'aire' || svc === 'frio'){
      st = waEstadoServicio(waStats(svc)).st;
    } else if(svc === 'ptar'){
      st = ptarEstado(ptarStats()).st;
    } else {
      s.keys.forEach(k=>{
        const e = estado(k);
        if(e === 'crit') st = 'crit';
        else if(e === 'warn' && st !== 'crit') st = 'warn';
      });
    }
    dot.className = 'st ' + (st === 'ok' ? '' : st);
  }
}
function pintarGraficas(){
  REG.filter(r => r.tab === activa).forEach(r => draw(r.sel, r.cfg));
}
function refrescar(){
  pintarValores();
  pintarAlarmas();
  pintarDetectores();
  pintarLineas();
  pintarTablas();
  pintarVapor();
  pintarPTAR();
  pintarSuav();
  pintarPtabr();
  pintarWA('aire');
  pintarWA('frio');
  pintarPrioridades();
  pintarGraficas();
}

/* Encabezado */
const FECHA = new Date().toLocaleDateString('es-VE',{day:'numeric', month:'long', year:'numeric'});
function pintarEncabezado(){
  const R = RONDAS[ronda];
  const title=document.getElementById('view-title');
  const sub=document.getElementById('view-sub');
  if(title) title.textContent = SERVICIOS[activa].nom;

  if(activa === 'ptab'){
    if(sub) sub.textContent = `${SERVICIOS.ptab.sub} · ${etiquetaFechaPtabr(PTABR_FECHA,true)} · 1er turno 06:00 am · 2do turno 06:00 pm`;
    return;
  }
  if(activa === 'suav'){
    if(sub) sub.textContent = `${SERVICIOS.suav.sub} · ${etiquetaFechaSuav(SUAV_FECHA,true)} · 1er y 2do turno a las 06:00`;
    return;
  }
  if(activa === 'vapor'){
    if(sub) sub.textContent = `${SERVICIOS.vapor.sub} · ${etiquetaFechaVapor(VAPOR_FECHA,true)} · lecturas 07:00 y 19:00`;
    return;
  }
  if(activa === 'ptar'){
    if(sub) sub.textContent = `${SERVICIOS.ptar.sub} · ${etiquetaFechaPTAR(PTAR_FECHA,true)} · lecturas 07:00 y 19:00`;
    return;
  }
  if(activa === 'aire' || activa === 'frio'){
    const c=waCfg(activa);
    if(sub) sub.textContent = `${SERVICIOS[activa].sub} · ${waFechaTxt(c&&c.fecha,true)} · turnos reportados 06:00–18:00 y 18:00–06:00`;
    return;
  }
  if(sub) sub.textContent = `${SERVICIOS[activa].sub} · lectura de las ${R.hora}`;
}
/* Navegación entre servicios */
function ir(id){
  activa = id;
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  document.querySelectorAll('.view').forEach(v => { v.hidden = (v.id !== 'v-' + id); });
  pintarEncabezado();
  window.scrollTo(0, 0);
  if(id === 'inventario') pintarInventarioQuimico();
  else if(id === 'ptab') pintarPtabr();
  else if(id === 'suav') pintarSuav();
  else if(id === 'vapor') pintarVapor();
  else if(id === 'aire' || id === 'frio') pintarWA(id);
  else if(id === 'ptar') pintarPTAR();
  else pintarGraficas();
  pintarPrioridades();
}
document.querySelectorAll('.tab').forEach(b=>{
  b.addEventListener('click', ()=>ir(b.dataset.tab));
  b.addEventListener('keydown', e=>{
    const tabs = Array.from(document.querySelectorAll('.tab')), i = tabs.indexOf(b);
    if(e.key === 'ArrowDown' || e.key === 'ArrowRight'){ e.preventDefault(); tabs[(i+1)%tabs.length].focus(); }
    if(e.key === 'ArrowUp' || e.key === 'ArrowLeft'){ e.preventDefault(); tabs[(i-1+tabs.length)%tabs.length].focus(); }
  });
});
document.addEventListener('click', e=>{
  const b = e.target.closest('[data-goto]');
  if(b) ir(b.dataset.goto);
});

/* Cambio de ronda */
document.querySelectorAll('[data-ronda]').forEach(b=>{
  b.addEventListener('click', ()=>{
    ronda = +b.dataset.ronda;
    pintarEncabezado();
    refrescar();
  });
});

/* Redibujo al cambiar el tamaño de la ventana */
let rt;
window.addEventListener('resize', ()=>{
  clearTimeout(rt);
  rt = setTimeout(()=>{
    if(activa === 'ptab') pintarGraficasPtabr();
    else if(activa === 'suav') pintarGraficasSuav();
    else if(activa === 'vapor') pintarGraficasVapor();
    else if(activa === 'aire' || activa === 'frio') pintarWAGraficas(activa);
    else if(activa === 'ptar') pintarGraficasPTAR();
    else pintarGraficas();
  },140);
});

/* =========================================================
   10. Importación acumulativa + persistencia local + Excel consolidado
   Añadido 16-09-2026. No reemplaza registros históricos con datos ya existentes.
   ========================================================= */
const DASH_STORE_PREFIX='polar_servicios_dashboard_v2_';
function dashKey(area){return DASH_STORE_PREFIX+area;}
function dashSave(area,data){try{localStorage.setItem(dashKey(area),JSON.stringify(data));return true;}catch(e){console.warn('No se pudo guardar localmente',area,e);return false;}}
function dashLoad(area){try{const x=JSON.parse(localStorage.getItem(dashKey(area))||'null');return Array.isArray(x)?x:null;}catch(e){return null;}}
function dashMeaningful(v){return !(v===null||v===undefined||String(v).trim()===''||['—','-','--','/'].includes(String(v).trim()));}
function dashMerge(existing,incoming,keyFn,valueFn){
  const out=(existing||[]).map(x=>({...x})), pos=new Map(out.map((r,i)=>[keyFn(r),i])); let added=0,filled=0,kept=0;
  (incoming||[]).forEach(n=>{const k=keyFn(n);if(!k)return;if(!pos.has(k)){pos.set(k,out.length);out.push({...n});added++;return;}const e=out[pos.get(k)],ev=valueFn(e),nv=valueFn(n);if(!dashMeaningful(ev)&&dashMeaningful(nv)){Object.assign(e,n);filled++;}else kept++;});
  return {rows:out,added,filled,kept};
}
function dashPersistMsg(area,res){const saved=dashSave(area,res.rows);return `${res.added} registros nuevos${res.filled?` · ${res.filled} completados`:''}${saved?' · guardado localmente':' · no se pudo guardar en el navegador'}`;}

async function leerObjetosHojaXlsx(buffer,nombre){
  const zip=await abrirZipPTAR(buffer),parser=new DOMParser(),wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml'),relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml'),rels=[...relXml.getElementsByTagNameNS('*','Relationship')];let shared=[];
  if(zip.entries.has('xl/sharedStrings.xml')){const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));}
  const sh=[...wbXml.getElementsByTagNameNS('*','sheet')].find(s=>s.getAttribute('name')===nombre);if(!sh)return null;
  const rid=sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sh.getAttribute('r:id'),rel=rels.find(r=>r.getAttribute('Id')===rid);if(!rel)throw new Error('No se pudo resolver la hoja '+nombre);
  let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');
  const rows=await leerHojaXLSXPTAR(zip,target,shared);if(!rows.length)return [];
  const h=rows[0].map(x=>String(x??'').trim());return rows.slice(1).filter(r=>r.some(v=>v!==''&&v!==null&&v!==undefined)).map(r=>{const o={};h.forEach((k,i)=>{if(k)o[k]=r[i]??'';});return o;});
}

const _leerExcelVaporOriginal=leerExcelVapor;
leerExcelVapor=async function(buffer){
  const control=await leerObjetosHojaXlsx(buffer,'Control');
  if(control&&control.length){return {rows:control,fechas:[...new Set(control.map(r=>normalizarFechaVapor(r.Fecha)).filter(Boolean))].sort(),procesos:[]};}
  return _leerExcelVaporOriginal(buffer);
};

/* ==================== GOOGLE DRIVE · BASE MAESTRA ==================== */
function dashDriveApiUrl(){return String(window.DASH_DRIVE_API_URL||'').trim();}
function dashDriveWriteKey(){
  let k='';
  try{k=sessionStorage.getItem('polar_drive_write_key')||'';}catch(e){}
  if(!k){k=prompt('Clave para añadir datos a la base maestra de Drive:')||'';if(k){try{sessionStorage.setItem('polar_drive_write_key',k);}catch(e){}}}
  return k;
}
async function dashDriveRequest(payload){
  const url=dashDriveApiUrl();
  if(!url||/PEGA_AQUI|CONFIGURAR|TU_URL/i.test(url)) throw new Error('Falta configurar la URL /exec de Apps Script en config.js.');
  let resp;
  try{resp=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow',cache:'no-store'});}catch(err){throw new Error('No se pudo contactar Google Drive: '+err.message);}
  const txt=await resp.text(); let ans={};
  try{ans=JSON.parse(txt);}catch(e){throw new Error('Apps Script devolvió una respuesta no válida.');}
  if(!ans.ok){if(ans.code==='AUTH'){try{sessionStorage.removeItem('polar_drive_write_key');}catch(e){}}throw new Error(ans.error||'No se pudo actualizar la base maestra de Drive.');}
  return ans;
}

/* Lectura cross-origin robusta para GitHub Pages -> Apps Script.
   Se usa JSONP porque una escritura POST puede ejecutarse correctamente en Apps Script
   aunque el navegador bloquee la lectura de la respuesta por CORS. */
function dashDriveJsonp(payload,timeoutMs=20000){
  const url=dashDriveApiUrl();
  if(!url||/PEGA_AQUI|CONFIGURAR|TU_URL/i.test(url)) return Promise.reject(new Error('Falta configurar la URL /exec de Apps Script en config.js.'));
  return new Promise((resolve,reject)=>{
    const cb='__polarDriveJsonp_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const params=new URLSearchParams();
    Object.entries(payload||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null)params.set(k,String(v));});
    params.set('callback',cb);params.set('_ts',String(Date.now()));
    const script=document.createElement('script');let done=false;
    const cleanup=()=>{if(done)return;done=true;clearTimeout(timer);try{delete window[cb];}catch(e){window[cb]=undefined;}script.remove();};
    const timer=setTimeout(()=>{cleanup();reject(new Error('Tiempo de espera agotado al leer Google Drive.'));},timeoutMs);
    window[cb]=(ans)=>{cleanup();if(!ans||!ans.ok){reject(new Error(ans&&ans.error?ans.error:'Drive devolvió una respuesta inválida.'));return;}resolve(ans);};
    script.onerror=()=>{cleanup();reject(new Error('No se pudo leer Apps Script desde el navegador.'));};
    script.async=true;script.src=url+(url.includes('?')?'&':'?')+params.toString();document.head.appendChild(script);
  });
}

/* Segunda vía de lectura para navegadores/dispositivos que bloquean JSONP.
   Apps Script devuelve una página HTML mínima dentro de un iframe oculto y
   envía la respuesta al dashboard mediante window.postMessage(). */
function dashDriveIframe(payload,timeoutMs=30000){
  const url=dashDriveApiUrl();
  if(!url||/PEGA_AQUI|CONFIGURAR|TU_URL/i.test(url)) return Promise.reject(new Error('Falta configurar la URL /exec de Apps Script en config.js.'));
  return new Promise((resolve,reject)=>{
    const nonce='polar_iframe_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const params=new URLSearchParams();
    Object.entries(payload||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null)params.set(k,String(v));});
    params.set('transport','iframe');
    params.set('nonce',nonce);
    params.set('parentOrigin',location.origin&&location.origin!=='null'?location.origin:'*');
    params.set('_ts',String(Date.now()));
    const frame=document.createElement('iframe');
    frame.setAttribute('aria-hidden','true');
    frame.tabIndex=-1;
    frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0;pointer-events:none';
    let done=false,timer=null;
    const cleanup=()=>{
      if(done)return;done=true;
      if(timer)clearTimeout(timer);
      window.removeEventListener('message',onMessage);
      try{frame.remove();}catch(e){}
    };
    const onMessage=(ev)=>{
      const msg=ev&&ev.data;
      if(!msg||msg.type!=='POLAR_DRIVE_RESPONSE'||msg.nonce!==nonce)return;
      cleanup();
      const ans=msg.payload;
      if(!ans||!ans.ok){reject(new Error(ans&&ans.error?ans.error:'Drive devolvió una respuesta inválida por iframe.'));return;}
      resolve(ans);
    };
    window.addEventListener('message',onMessage);
    frame.onerror=()=>{cleanup();reject(new Error('No se pudo abrir Apps Script mediante iframe.'));};
    timer=setTimeout(()=>{cleanup();reject(new Error('Tiempo de espera agotado en la lectura alternativa de Drive.'));},timeoutMs);
    frame.src=url+(url.includes('?')?'&':'?')+params.toString();
    document.body.appendChild(frame);
  });
}

/* Lectura con fallback automático: JSONP primero, iframe/postMessage después. */
async function dashDriveRead(payload,timeoutMs=30000){
  let jsonpError=null;
  try{
    return await dashDriveJsonp(payload,Math.min(timeoutMs,15000));
  }catch(err){
    jsonpError=err;
    console.warn('Lectura JSONP no disponible; intentando iframe/postMessage.',err);
  }
  try{
    return await dashDriveIframe(payload,timeoutMs);
  }catch(iframeError){
    const a=jsonpError&&jsonpError.message?jsonpError.message:String(jsonpError||'sin detalle');
    const b=iframeError&&iframeError.message?iframeError.message:String(iframeError||'sin detalle');
    throw new Error('No se pudo leer Apps Script en este dispositivo. JSONP: '+a+' | Iframe: '+b);
  }
}

function dashDriveRows(area,rows){
  if(area==='ptab') return rows.map(r=>({'Fecha':r.fecha,'Turno':r.turno,'Hora':r.hora,'Operador':r.operador,'Proceso':r.proceso,'Equipo':r.puesto,'Variable de Control':r.variable,'Rango de Operación':r.rango,'Unidad':r.unidad,'Valor':r.valor,'Valor original turno':r.original,'Estado':'','Observación':r.observacion||'','Fuente':r.fuente||'Carga operador','VariableId':r.id}));
  if(area==='suav') return rows.map(r=>({'Fecha':r.fecha,'Turno':r.turno,'Hora impresa':r.hora,'Operador':r.operador,'Proceso':r.proceso,'Equipo':r.puesto,'Variable de Control':r.variable,'Rango de Operación':r.rango,'Valor original':r.original,'Valor numérico / promedio':r.valor,'Unidad':r.unidad,'Estado':'','Observación':r.observacion||'','Fuente':r.fuente||'Carga operador','VariableId':r.id}));
  if(area==='ptar') return rows.map(r=>({'Fecha':r.fecha,'Turno':r.turno,'Operador':r.operador,'Proceso':r.proceso,'Puesto de trabajo':r.puesto,'Variable de control':r.variable,'Rango Operación':r.rango,'Unidad':r.unidad,'Valor':r.valor,'Estado':'','Fuente':r.fuente||'Carga operador','Nota de transcripción':r.observacion||'','VariableId':r.id}));
  if(area==='vapor') return rows.map(r=>({'Fecha':r.fecha,'Turno':r.turno,'Operador':r.operador,'Proceso':r.proceso,'Variable de control':r.variable,'Frecuencia':r.frecuencia,'Rango Operación':r.rango,'Valor':r.valor,'Unidad':r.unidad,'Tipo Rango':r.tipo,'Mínimo':r.min,'Máximo':r.max,'Estado':'','Observación':r.observacion||'','Fuente':r.fuente||'Carga operador','VariableId':r.id}));
  return [];
}
function dashDriveLatestDate(rows){
  return [...new Set((rows||[]).map(r=>String(r&&r.fecha||'').trim()).filter(f=>/^\d{4}-\d{2}-\d{2}$/.test(f)))].sort().slice(-1)[0]||null;
}
function dashDriveCurrentRows(area){
  if(area==='ptab')return PTABR_DATA;
  if(area==='suav')return SUAV_DATA;
  if(area==='vapor')return VAPOR_DATA;
  if(area==='ptar')return PTAR_DATA;
  return [];
}
function dashDriveValueForMerge(area,r){
  if(area==='ptab'||area==='suav')return r&&r.valor!==null&&r.valor!==undefined?r.valor:r&&r.original;
  return r&&r.valor;
}
function dashDriveLoadRows(area,rows,source){
  if(area==='ptab')cargarDatosPtabr(rows,[],PTABR_PROCESOS,source);
  else if(area==='suav')cargarDatosSuav(rows,[],SUAV_PROCESOS,source);
  else if(area==='vapor')cargarDatosVapor(rows,[],VAPOR_PROCESOS,source,'drive');
  else if(area==='ptar')cargarDatosPTAR(rows,[],PTAR_PROCESOS,source,'drive');
}
function dashDriveFocusDate(area,fecha){
  if(!fecha)return;
  const mes=fecha.slice(0,7);
  if(typeof DASH_UI_FILTERS!=='undefined'){
    DASH_UI_FILTERS.month[area]=mes;
    DASH_UI_FILTERS.globalMonth='__all__';
  }
  dashUiSetDate(area,fecha);
  const globalSel=document.querySelector('[data-dashboard-month]');
  if(globalSel)globalSel.value='__all__';
  dashUiRenderArea(area);
  dashUiPopulateServiceControls(area);
  dashUiAfterRender(area);
  dashUiDateSelectIds(area).forEach(id=>{const sel=document.getElementById(id);if(sel&&[...sel.options].some(o=>o.value===fecha)){sel.disabled=false;sel.value=fecha;}});
}
function dashDriveApplyImportedLocally(area,norm,fecha){
  const merged=dashMerge(dashDriveCurrentRows(area),norm,r=>[r.fecha,r.turno,r.id].join('|'),r=>dashDriveValueForMerge(area,r));
  dashDriveLoadRows(area,merged.rows,'Google Drive · carga del operador pendiente de confirmación de lectura');
  dashSave(area,merged.rows);
  dashDriveFocusDate(area,fecha);
}
function dashDriveSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function dashDriveAppend(area,norm,label){
  const key=dashDriveWriteKey(); if(!key) throw new Error('No se ingresó la clave de actualización.');
  const fechaNueva=dashDriveLatestDate(norm);
  const payload={action:'append_rows',key,area,rows:dashDriveRows(area,norm)};
  let ans=null,postError=null;

  /* En algunos navegadores Apps Script procesa el POST (los datos sí llegan a Sheets),
     pero el navegador no permite leer la respuesta por CORS. Por eso nunca usamos el
     éxito de la lectura del POST como única confirmación. */
  try{ans=await dashDriveRequest(payload);}catch(err){postError=err;console.warn('POST enviado; la respuesta no pudo leerse. Se confirmará por JSONP.',err);}

  if(ans&&ans.data) dashDriveApplyMasterData(ans,area,fechaNueva);
  else dashDriveApplyImportedLocally(area,norm,fechaNueva);

  let sincronizado=false,lastReadError=null;
  for(let intento=0;intento<6&&!sincronizado;intento++){
    if(intento)await dashDriveSleep(700*intento);
    try{
      const readAns=await dashDriveRead({action:'read_master'});
      sincronizado=dashDriveApplyMasterData(readAns,area,fechaNueva);
      if(sincronizado){ans=ans||readAns;break;}
    }catch(err){lastReadError=err;console.warn('Reintento Drive '+(intento+1),err);}
  }
  dashDriveFocusDate(area,fechaNueva);

  if(sincronizado){
    dashDriveRefreshStatus('Drive sincronizado','ok');
    const added=ans&&Number.isFinite(Number(ans.added))?Number(ans.added):norm.length;
    alert(`${label}: información guardada en Drive y dashboard sincronizado.${fechaNueva?` Fecha visible: ${fechaNueva}.`:''}`);
    return;
  }

  dashDriveRefreshStatus('Pendiente de confirmar Drive','error');
  const detalle=(lastReadError||postError); 
  alert(`${label}: la planilla fue enviada y se mantiene visible localmente, pero el navegador no logró volver a leer Drive.${detalle?` Detalle: ${detalle.message||detalle}`:''}`);
}

cargarExcelPtabrArchivo=async function(file){try{const rows=await leerExcelPtabr(await file.arrayBuffer()),norm=normalizarFilasPtabr(rows);await dashDriveAppend('ptab',norm,'PTAB');}catch(e){alert('PTAB: '+e.message);throw e;}};
cargarExcelSuavArchivo=async function(file){try{const rows=await leerExcelSuav(await file.arrayBuffer()),norm=normalizarFilasSuav(rows);await dashDriveAppend('suav',norm,'Suavizadores');}catch(e){alert('Suavizadores: '+e.message);throw e;}};
cargarExcelPTARArchivo=async function(file){try{const rows=await leerExcelPTAR(await file.arrayBuffer()),norm=normalizarFilasPTAR(rows);await dashDriveAppend('ptar',norm,'PTAR');}catch(e){alert('PTAR: '+e.message);throw e;}};
cargarExcelVaporArchivo=async function(file){try{const r=await leerExcelVapor(await file.arrayBuffer()),norm=normalizarFilasVapor(r.rows);await dashDriveAppend('vapor',norm,'Vapor');}catch(e){alert('Vapor: '+e.message);throw e;}};

cargarExcelWAParseado=function(parsed,source){
  const ac=waBuildCatalog(parsed.catalogo,WA_CFG.aire.areasPermitidas,'aire'),nc=waBuildCatalog(parsed.catalogo,WA_CFG.frio.areasPermitidas,'nh3'),ad=waNormalizeExcelData(parsed.datos,ac,WA_CFG.aire.areasPermitidas),nd=waNormalizeExcelData(parsed.datos,nc,WA_CFG.frio.areasPermitidas);
  if(!ad.length&&!nd.length)throw new Error('No se encontraron registros válidos para Compresores de Aire o Refrigeración/NH3.');
  if(ad.length){const r=dashMerge(WA_CFG.aire.data,ad,x=>[x.fecha,x.turno,x.reporteId,x.id].join('|'),x=>x.valor??x.texto);const cat=[...WA_CFG.aire.catalogo];ac.forEach(v=>{if(!cat.some(x=>x.area===v.area&&x.equipo===v.equipo&&x.variable===v.variable))cat.push(v);});cargarWA('aire',r.rows,cat,[],source);dashSave('aire',r.rows);guardarExcelConsolidado('aire');}
  if(nd.length){const r=dashMerge(WA_CFG.frio.data,nd,x=>[x.fecha,x.turno,x.reporteId,x.id].join('|'),x=>x.valor??x.texto);const cat=[...WA_CFG.frio.catalogo];nc.forEach(v=>{if(!cat.some(x=>x.area===v.area&&x.equipo===v.equipo&&x.variable===v.variable))cat.push(v);});cargarWA('frio',r.rows,cat,[],source);dashSave('frio',r.rows);guardarExcelConsolidado('frio');}
};

function restaurarPersistenciaDashboard(){
  const p=dashLoad('ptab');if(p&&p.length)cargarDatosPtabr(p,[],PTABR_PROCESOS,'Histórico consolidado · navegador');
  const s=dashLoad('suav');if(s&&s.length)cargarDatosSuav(s,[],SUAV_PROCESOS,'Histórico consolidado · navegador');
  const v=dashLoad('vapor');if(v&&v.length)cargarDatosVapor(v,[],VAPOR_PROCESOS,'Histórico consolidado · navegador','local');
  const t=dashLoad('ptar');if(t&&t.length)cargarDatosPTAR(t,[],PTAR_PROCESOS,'Histórico consolidado · navegador','local');
  const a=dashLoad('aire');if(a&&a.length)cargarWA('aire',a,WA_CFG.aire.catalogo,[],'Histórico consolidado · navegador');
  const f=dashLoad('frio');if(f&&f.length)cargarWA('frio',f,WA_CFG.frio.catalogo,[],'Histórico consolidado · navegador');
}

/* Escritor XLSX mínimo, sin dependencias externas. */
const XLSX_TE=new TextEncoder();
let XLSX_CRC_TABLE=null;
function xlsxCrc32(u8){if(!XLSX_CRC_TABLE){XLSX_CRC_TABLE=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;XLSX_CRC_TABLE[n]=c>>>0;}}let c=0xFFFFFFFF;for(const b of u8)c=XLSX_CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function xlsxU16(n){return new Uint8Array([n&255,(n>>>8)&255]);}
function xlsxU32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function xlsxCat(parts){let n=parts.reduce((a,b)=>a+b.length,0),o=new Uint8Array(n),p=0;parts.forEach(b=>{o.set(b,p);p+=b.length;});return o;}
function xlsxZip(entries){const locals=[],centrals=[];let offset=0;for(const e of entries){const name=XLSX_TE.encode(e.name),data=typeof e.data==='string'?XLSX_TE.encode(e.data):e.data,crc=xlsxCrc32(data);const lh=xlsxCat([xlsxU32(0x04034b50),xlsxU16(20),xlsxU16(0),xlsxU16(0),xlsxU16(0),xlsxU16(0),xlsxU32(crc),xlsxU32(data.length),xlsxU32(data.length),xlsxU16(name.length),xlsxU16(0),name,data]);locals.push(lh);const ch=xlsxCat([xlsxU32(0x02014b50),xlsxU16(20),xlsxU16(20),xlsxU16(0),xlsxU16(0),xlsxU16(0),xlsxU16(0),xlsxU32(crc),xlsxU32(data.length),xlsxU32(data.length),xlsxU16(name.length),xlsxU16(0),xlsxU16(0),xlsxU16(0),xlsxU16(0),xlsxU32(0),xlsxU32(offset),name]);centrals.push(ch);offset+=lh.length;}const central=xlsxCat(centrals),end=xlsxCat([xlsxU32(0x06054b50),xlsxU16(0),xlsxU16(0),xlsxU16(entries.length),xlsxU16(entries.length),xlsxU32(central.length),xlsxU32(offset),xlsxU16(0)]);return xlsxCat([...locals,central,end]);}
function xlsxEsc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function xlsxCol(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function xlsxSheetXml(rows){let body='';(rows||[]).forEach((r,ri)=>{let cells='';r.forEach((v,ci)=>{if(v===null||v===undefined||v==='')return;const ref=xlsxCol(ci)+(ri+1);if(typeof v==='number'&&Number.isFinite(v))cells+=`<c r="${ref}"><v>${v}</v></c>`;else cells+=`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xlsxEsc(v)}</t></is></c>`;});body+=`<row r="${ri+1}">${cells}</row>`;});return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;}
function descargarLibroXlsx(nombre,sheets){const safe=s=>String(s).slice(0,31).replace(/[\\/?*\[\]:]/g,'_'),names=sheets.map(s=>safe(s.name||'Hoja'));const entries=[];entries.push({name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`});entries.push({name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n,i)=>`<sheet name="${xlsxEsc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`});entries.push({name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((n,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`});sheets.forEach((s,i)=>entries.push({name:`xl/worksheets/sheet${i+1}.xml`,data:xlsxSheetXml(s.rows)}));entries.push({name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((n,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`});const blob=new Blob([xlsxZip(entries)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nombre;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
function objRows(headers,objs){return [headers,...(objs||[]).map(o=>headers.map(h=>o[h]??''))];}

function exportRowsArea(area){
  if(area==='ptab'){const h=['Fecha','Turno','Hora','Operador','Proceso','Equipo','Variable de Control','Rango de Operación','Unidad','Valor','Valor original turno','Estado','Observación','Fuente','VariableId'];const o=PTABR_DATA.map(r=>({'Fecha':r.fecha,'Turno':r.turno,'Hora':r.hora,'Operador':r.operador,'Proceso':r.proceso,'Equipo':r.puesto,'Variable de Control':r.variable,'Rango de Operación':r.rango,'Unidad':r.unidad,'Valor':r.valor,'Valor original turno':r.original,'Estado':estadoRegistroPtabr(r),'Observación':r.observacion,'Fuente':r.fuente,'VariableId':r.id}));return [{name:'Control',rows:objRows(h,o)}];}
  if(area==='suav'){const h=['Fecha','Turno','Hora impresa','Operador','Proceso','Equipo','Variable de Control','Rango de Operación','Valor original','Valor numérico / promedio','Unidad','Estado','Observación','Fuente','VariableId'];const o=SUAV_DATA.map(r=>({'Fecha':r.fecha,'Turno':r.turno,'Hora impresa':r.hora,'Operador':r.operador,'Proceso':r.proceso,'Equipo':r.puesto,'Variable de Control':r.variable,'Rango de Operación':r.rango,'Valor original':r.original,'Valor numérico / promedio':r.valor,'Unidad':r.unidad,'Estado':estadoRegistroSuav(r),'Observación':r.observacion,'Fuente':r.fuente,'VariableId':r.id}));return [{name:'Control',rows:objRows(h,o)}];}
  if(area==='ptar'){const h=['Fecha','Turno','Operador','Proceso','Puesto de trabajo','Variable de control','Rango Operación','Unidad','Valor','Estado','Fuente','Nota de transcripción','VariableId'];const o=PTAR_DATA.map(r=>({'Fecha':r.fecha,'Turno':r.turno,'Operador':r.operador,'Proceso':r.proceso,'Puesto de trabajo':r.puesto,'Variable de control':r.variable,'Rango Operación':r.rango,'Unidad':r.unidad,'Valor':r.valor,'Estado':estadoRegistroPTAR(r),'Fuente':r.fuente||'','Nota de transcripción':r.observacion,'VariableId':r.id}));return [{name:'Control',rows:objRows(h,o)}];}
  if(area==='vapor'){const h=['Fecha','Turno','Operador','Proceso','Variable de control','Frecuencia','Rango Operación','Valor','Unidad','Tipo Rango','Mínimo','Máximo','Estado','Observación','Fuente','VariableId'];const o=VAPOR_DATA.map(r=>({'Fecha':r.fecha,'Turno':r.turno,'Operador':r.operador,'Proceso':r.proceso,'Variable de control':r.variable,'Frecuencia':r.frecuencia,'Rango Operación':r.rango,'Valor':r.valor,'Unidad':r.unidad,'Tipo Rango':r.tipo,'Mínimo':r.min,'Máximo':r.max,'Estado':estadoRegistroVapor(r),'Observación':r.observacion,'Fuente':r.fuente,'VariableId':r.id}));return [{name:'Control',rows:objRows(h,o)}];}
  if(area==='aire'||area==='frio'){const c=WA_CFG[area],hd=['Fecha operativa','Confianza fecha','Turno','Turno original','Operador','Reporte ID','Proceso / Área','Equipo / Puesto','Variable','Valor numérico','Valor texto','Unidad','Indicador','Estado normalizado','Observación','Línea original','Incluir dashboard'],hc=['Proceso / Área','Equipo / Puesto','Variable','Unidad','Tipo de dato','Rango operativo','Criterio disponible en fuente'];const od=c.data.map(r=>({'Fecha operativa':r.fecha,'Confianza fecha':r.confianzaFecha,'Turno':r.turno,'Turno original':r.turnoOriginal,'Operador':r.operador,'Reporte ID':r.reporteId,'Proceso / Área':r.area,'Equipo / Puesto':r.equipo,'Variable':r.variable,'Valor numérico':r.valor,'Valor texto':r.texto,'Unidad':r.unidad,'Indicador':r.indicador,'Estado normalizado':r.estado,'Observación':r.observacion,'Línea original':r.linea,'Incluir dashboard':'Sí'})),oc=c.catalogo.map(v=>({'Proceso / Área':v.area,'Equipo / Puesto':v.equipo,'Variable':v.variable,'Unidad':v.unidad,'Tipo de dato':v.tipoDato,'Rango operativo':v.rango,'Criterio disponible en fuente':v.criterio}));return [{name:'Datos Dashboard',rows:objRows(hd,od)},{name:'Catálogo',rows:objRows(hc,oc)}];}
  return [];
}
function guardarExcelConsolidado(area){const nom={ptab:'PTAB',suav:'SUAVIZADORES',vapor:'VAPOR',aire:'COMPRESORES_AIRE',frio:'REFRIGERACION_NH3',ptar:'PTAR'}[area]||area;descargarLibroXlsx(`Base_${nom}_Dashboard_Actualizada.xlsx`,exportRowsArea(area));}
function exportBaseMaestraDashboard(){
  const waHead=['Fecha operativa','Confianza fecha','Turno','Turno original','Operador','Reporte ID','Proceso / Área','Equipo / Puesto','Variable','Valor numérico','Valor texto','Unidad','Indicador','Estado normalizado','Observación','Línea original','Incluir dashboard','VariableId','Tipo de dato','Rango operativo','Criterio disponible en fuente'];
  const waRows=[...WA_CFG.aire.data,...WA_CFG.frio.data].map(r=>{const d=waDef(r.area&&WA_CFG.aire.areasPermitidas.includes(r.area)?'aire':'frio',r.id)||{};return {'Fecha operativa':r.fecha,'Confianza fecha':r.confianzaFecha,'Turno':r.turno,'Turno original':r.turnoOriginal,'Operador':r.operador,'Reporte ID':r.reporteId,'Proceso / Área':r.area,'Equipo / Puesto':r.equipo,'Variable':r.variable,'Valor numérico':r.valor,'Valor texto':r.texto,'Unidad':r.unidad,'Indicador':r.indicador,'Estado normalizado':r.estado,'Observación':r.observacion,'Línea original':r.linea,'Incluir dashboard':'Sí','VariableId':r.id,'Tipo de dato':d.tipoDato||r.tipoDato||'','Rango operativo':d.rango||r.rango||'','Criterio disponible en fuente':d.criterio||r.criterio||''};});
  return [
    {name:'PTAB',rows:exportRowsArea('ptab')[0].rows},
    {name:'PTAR',rows:exportRowsArea('ptar')[0].rows},
    {name:'VAPOR',rows:exportRowsArea('vapor')[0].rows},
    {name:'SUAVIZADORES',rows:exportRowsArea('suav')[0].rows},
    {name:'COMPRESORES_REFRIGERACION',rows:objRows(waHead,waRows)}
  ];
}
function guardarBaseMaestraDashboard(){descargarLibroXlsx('Base_Maestra_Dashboard_Actualizada.xlsx',exportBaseMaestraDashboard());}

function dashDriveApplyMasterData(ans,focusArea=null,focusDate=null){
  const d=(ans&&ans.data)||{};
  let focusEncontrado=!focusArea||!focusDate;
  const errores=[];
  const aplicar=function(area,raw,normalizar,cargar,source){
    if(!Array.isArray(raw)){errores.push(area+': respuesta ausente');return;}
    try{
      const rows=normalizar(raw);
      if(!rows.length){errores.push(area+': sin filas válidas');return;}
      const tieneFocus=!(focusArea===area&&focusDate)||rows.some(r=>r.fecha===focusDate);
      if(focusArea===area&&focusDate&&!tieneFocus){return;}
      cargar(rows,source);
      dashSave(area,rows);
      if(focusArea===area&&focusDate&&rows.some(r=>r.fecha===focusDate))focusEncontrado=true;
    }catch(err){
      console.error('Drive: no se pudo aplicar '+area,err);
      errores.push(area+': '+(err&&err.message?err.message:String(err)));
    }
  };
  aplicar('ptab',d.PTAB,normalizarFilasPtabr,(rows,source)=>cargarDatosPtabr(rows,[],PTABR_PROCESOS,source),'Google Drive · Base Maestra · PTAB');
  aplicar('ptar',d.PTAR,normalizarFilasPTAR,(rows,source)=>cargarDatosPTAR(rows,[],PTAR_PROCESOS,source,'drive'),'Google Drive · Base Maestra · PTAR');
  aplicar('vapor',d.VAPOR,normalizarFilasVapor,(rows,source)=>cargarDatosVapor(rows,[],VAPOR_PROCESOS,source,'drive'),'Google Drive · Base Maestra · VAPOR');
  aplicar('suav',d.SUAVIZADORES,normalizarFilasSuav,(rows,source)=>cargarDatosSuav(rows,[],SUAV_PROCESOS,source),'Google Drive · Base Maestra · SUAVIZADORES');
  window.__DASH_DRIVE_LAST_APPLY_ERRORS=errores;
  if(typeof dashUiPopulateServiceControls==='function'){
    ['ptab','ptar','vapor','suav'].forEach(a=>{try{dashUiPopulateServiceControls(a);dashUiAfterRender(a);}catch(e){console.warn('UI '+a,e);}});
  }
  if(focusEncontrado&&focusArea&&focusDate)dashDriveFocusDate(focusArea,focusDate);
  return focusEncontrado;
}

async function cargarBaseMaestraAutomatica(focusArea=null,focusDate=null){
  const url=dashDriveApiUrl();
  if(!url||/PEGA_AQUI|CONFIGURAR|TU_URL/i.test(url)){console.warn('Drive no configurado; se usa el respaldo precargado.');return false;}
  try{
    const ans=await dashDriveRead({action:'read_master'});
    const focusEncontrado=dashDriveApplyMasterData(ans,focusArea,focusDate);
    console.info('Base maestra cargada desde Google Drive por JSONP.',ans.updatedAt||'',focusEncontrado?'':'(fecha enfocada aún no encontrada)');
    return focusEncontrado;
  }catch(err){console.warn('No se pudo leer Google Drive por JSONP; se mantiene el respaldo local/fallback.',err);return false;}
}
function plantillaArea(area){
  if(['ptab','suav','ptar','vapor'].includes(area)){const s=exportRowsArea(area)[0],head=s.rows[0],ej=s.rows[1]||head.map(()=>''),blank=ej.map((v,i)=>i===0?'':v);return [{name:'Control',rows:[head,blank]}];}
  const sheets=exportRowsArea(area);return sheets.map(s=>({name:s.name,rows:s.name==='Catálogo'?s.rows:[s.rows[0],(s.rows[1]||[]).map((v,i)=>i===0?'':v)]}));
}
function descargarPlantillaArea(area){const nom={ptab:'PTAB',suav:'Suavizadores',vapor:'Vapor',aire:'Compresores_Aire',frio:'Refrigeracion_NH3',ptar:'PTAR'}[area]||area;descargarLibroXlsx(`Plantilla_Carga_${nom}.xlsx`,plantillaArea(area));}
function instalarControlesExcelDashboard(){
  const ids={ptab:'ptab-excel-input',suav:'suav-excel-input',vapor:'vapor-excel-input',aire:'aire-excel-input',frio:'frio-excel-input',ptar:'ptar-excel-input'};
  Object.entries(ids).forEach(([area,id])=>{const input=document.getElementById(id);if(!input)return;const label=document.querySelector(`label[for="${id}"]`);if(label)label.textContent=(area==='aire'||area==='frio')?'Añadir planilla Sala de Compresores':'Añadir desde Excel';});
}


/* Arranque */
restaurarPersistenciaDashboard();
instalarControlesExcelDashboard();
buildKPIs();
buildStrip();
buildLegends();
pintarEncabezado();
refrescar();
document.body.dataset.dashboardReady = '1';
inicializarPTARExcel();
inicializarVaporExcel();
inicializarSuavExcel();
inicializarPtabrExcel();
inicializarWAExcel();

/* =========================================================
   11. Filtros avanzados de visualización
   - Mes por servicio + mes global del dashboard
   - Todos / una / ninguna gráfica para lectura del día
   - Ninguna gráfica en históricos
   - Todos / un / ningún proceso por pestaña
   ========================================================= */
const DASH_UI_FILTERS={
  globalMonth:'__all__',
  month:{ptab:'__all__',suav:'__all__',vapor:'__all__',aire:'__all__',frio:'__all__',ptar:'__all__'},
  process:{ptab:'__all__',suav:'__all__',vapor:'__all__',aire:'__all__',frio:'__all__',ptar:'__all__'},
  dayMode:{ptab:Object.create(null),suav:Object.create(null),vapor:Object.create(null),aire:Object.create(null),frio:Object.create(null),ptar:Object.create(null)},
  histMode:{ptab:Object.create(null),suav:Object.create(null),vapor:Object.create(null),aire:Object.create(null),frio:Object.create(null),ptar:Object.create(null)}
};
const DASH_AREAS=['ptab','suav','vapor','aire','frio','ptar'];

function dashUiMonthFromDate(fecha){return /^\d{4}-\d{2}-\d{2}$/.test(String(fecha||''))?String(fecha).slice(0,7):null;}
function dashUiMonthLabel(m){
  if(m==='__all__')return 'Todos los meses';
  const x=String(m||'').match(/^(\d{4})-(\d{2})$/);if(!x)return String(m||'');
  const dt=new Date(Number(x[1]),Number(x[2])-1,1);
  const s=dt.toLocaleDateString('es-VE',{month:'long',year:'numeric'});
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function dashUiDates(area){
  if(area==='ptab')return PTABR_FECHAS.slice();
  if(area==='suav')return SUAV_FECHAS.slice();
  if(area==='vapor')return VAPOR_FECHAS.slice();
  if(area==='ptar')return PTAR_FECHAS.slice();
  const c=waCfg(area);return c?c.fechas.slice():[];
}
function dashUiMonths(area){return [...new Set(dashUiDates(area).map(dashUiMonthFromDate).filter(Boolean))].sort();}
function dashUiMonthMatch(area,fecha){const m=DASH_UI_FILTERS.month[area];return m==='__all__'||dashUiMonthFromDate(fecha)===m;}
function dashUiProcesses(area){
  if(area==='ptab')return PTABR_PROCESOS.map(p=>p.nombre);
  if(area==='suav')return SUAV_PROCESOS.map(p=>p.nombre);
  if(area==='vapor')return VAPOR_PROCESOS.map(p=>p.nombre);
  if(area==='ptar')return PTAR_PROCESOS.map(p=>p.nombre);
  return waAreas(area);
}
function dashUiProcessObjects(area){
  if(area==='ptab')return PTABR_PROCESOS;
  if(area==='suav')return SUAV_PROCESOS;
  if(area==='vapor')return VAPOR_PROCESOS;
  if(area==='ptar')return PTAR_PROCESOS;
  return waAreas(area);
}
function dashUiVars(area,proc){
  if(area==='ptab')return ptabrVariables(proc);
  if(area==='suav')return suavVariables(proc);
  if(area==='vapor')return vaporVariables(proc);
  if(area==='ptar')return ptarVariables(proc);
  return waVarsArea(area,proc);
}
function dashUiProcessName(area,proc){return typeof proc==='string'?proc:proc&&proc.nombre?proc.nombre:'';}
function dashUiSetDate(area,fecha){
  if(area==='ptab')PTABR_FECHA=fecha;
  else if(area==='suav')SUAV_FECHA=fecha;
  else if(area==='vapor')VAPOR_FECHA=fecha;
  else if(area==='ptar')PTAR_FECHA=fecha;
  else {const c=waCfg(area);if(c)c.fecha=fecha||'__sin_mes__';}
}
function dashUiGetDate(area){
  if(area==='ptab')return PTABR_FECHA;
  if(area==='suav')return SUAV_FECHA;
  if(area==='vapor')return VAPOR_FECHA;
  if(area==='ptar')return PTAR_FECHA;
  const c=waCfg(area);return c?c.fecha:null;
}
function dashUiSelectLatestInMonth(area,month){
  const dates=dashUiDates(area).filter(f=>month==='__all__'||dashUiMonthFromDate(f)===month);
  if(dates.length){const current=dashUiGetDate(area);dashUiSetDate(area,dates.includes(current)?current:dates[dates.length-1]);return true;}
  dashUiSetDate(area,null);return false;
}
function dashUiRenderArea(area){
  if(area==='ptab')pintarPtabr();
  else if(area==='suav')pintarSuav();
  else if(area==='vapor')pintarVapor();
  else if(area==='ptar')pintarPTAR();
  else pintarWA(area);
}
function dashUiFormatDate(area){
  const f=dashUiGetDate(area);
  if(area==='ptab')return etiquetaFechaPtabr(f,true);
  if(area==='suav')return etiquetaFechaSuav(f,true);
  if(area==='vapor')return etiquetaFechaVapor(f,true);
  if(area==='ptar')return etiquetaFechaPTAR(f,true);
  return f==='__sin_mes__'?'Sin registros en el mes':waFechaTxt(f,true);
}
function dashUiDateSelectIds(area){return [`${area}-date-select`,`${area}-summary-date-select`];}
function dashUiFilterDateSelects(area){
  const month=DASH_UI_FILTERS.month[area];
  dashUiDateSelectIds(area).forEach(id=>{
    const sel=document.getElementById(id);if(!sel)return;
    [...sel.options].forEach(o=>{const dated=/^\d{4}-\d{2}-\d{2}$/.test(o.value);o.hidden=month!=='__all__'&&(!dated||dashUiMonthFromDate(o.value)!==month);});
    const valid=[...sel.options].filter(o=>!o.hidden&&!o.disabled&&(month==='__all__'||/^\d{4}-\d{2}-\d{2}$/.test(o.value))).map(o=>o.value);
    const current=dashUiGetDate(area);
    if(valid.includes(current))sel.value=current;
    else if(!valid.length){sel.innerHTML='<option value="">Sin registros en este mes</option>';sel.disabled=true;}
    else {sel.disabled=false;sel.value=valid[valid.length-1];}
  });
}
function dashUiControlsHost(area){return document.getElementById('v-'+area);}
function dashUiInstallServiceControls(area){
  const view=dashUiControlsHost(area);if(!view||view.querySelector(`[data-service-controls="${area}"]`))return;
  const dateStrip=view.querySelector('.ptar-date-strip,.suav-date-strip,.vapor-date-strip');
  if(!dateStrip)return;
  const box=document.createElement('div');box.className='service-view-controls';box.dataset.serviceControls=area;
  box.innerHTML=`<label>Mes a visualizar<select data-service-month="${area}"></select></label><label>Procesos a visualizar<select data-service-process="${area}"></select></label><span class="control-note">El mes filtra las fechas del día y las gráficas históricas.</span>`;
  dateStrip.insertAdjacentElement('afterend',box);
}
function dashUiPopulateServiceControls(area){
  dashUiInstallServiceControls(area);
  const msel=document.querySelector(`[data-service-month="${area}"]`),psel=document.querySelector(`[data-service-process="${area}"]`);
  if(msel){
    const months=dashUiMonths(area);msel.innerHTML=`<option value="__all__">Todos los meses</option>`+months.map(m=>`<option value="${m}">${esc(dashUiMonthLabel(m))}</option>`).join('');
    msel.value=DASH_UI_FILTERS.month[area];
  }
  if(psel){
    const ps=dashUiProcesses(area);psel.innerHTML=`<option value="__all__">Todos los procesos</option>`+ps.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')+`<option value="__none__">Ningún proceso</option>`;
    psel.value=DASH_UI_FILTERS.process[area];
  }
}
function dashUiApplyProcessFilter(area){
  const selected=DASH_UI_FILTERS.process[area],names=dashUiProcesses(area);
  const visible=(i)=>selected==='__all__'||(selected!=='__none__'&&names[i]===selected);
  const kpi=document.getElementById(`${area}-kpis-proceso`);if(kpi)[...kpi.children].forEach((el,i)=>el.hidden=!visible(i));
  const charts=document.getElementById(`${area}-graficas-procesos`);if(charts)[...charts.children].forEach((el,i)=>el.hidden=!visible(i));
  const processes=document.getElementById(`${area}-procesos`);if(processes)[...processes.children].forEach((el,i)=>el.hidden=!visible(i));
  let empty=document.querySelector(`[data-process-empty="${area}"]`);
  if(selected==='__none__'){
    if(!empty){empty=document.createElement('div');empty.className='dash-empty-choice dash-process-empty';empty.dataset.processEmpty=area;empty.textContent='No se está mostrando ningún proceso. Usa el selector “Procesos a visualizar” para volver a mostrarlos.';const controls=document.querySelector(`[data-service-controls="${area}"]`);if(controls)controls.insertAdjacentElement('afterend',empty);}
    empty.hidden=false;
  }else if(empty)empty.hidden=true;
}

function dashUiDayRenderer(area,host,proc,v){
  if(area==='ptab')return renderPtabrDia(host,proc,v);
  if(area==='suav')return renderSuavDia(host,proc,v);
  if(area==='vapor')return renderVaporDia(host,proc,v);
  if(area==='ptar')return renderPTARDia(host,proc,v);
  return renderWADia(host,area,v);
}
function dashUiDaySelectorInfo(area){
  if(area==='ptab')return {selector:'[data-ptab-chart-process]',index:s=>Number(s.dataset.ptabChartProcess)};
  if(area==='suav')return {selector:'[data-suav-chart-process]',index:s=>Number(s.dataset.suavChartProcess)};
  if(area==='vapor')return {selector:'[data-vapor-chart-process]',index:s=>Number(s.dataset.vaporChartProcess)};
  if(area==='ptar')return {selector:'[data-ptar-chart-process]',index:s=>Number(s.dataset.ptarChartProcess)};
  return {selector:'[data-wa-day-selector]',index:s=>Number(String(s.dataset.waDaySelector||'').split('|')[1])};
}
function dashUiHistorySelector(area,card){
  if(area==='ptab')return card.querySelector('[data-ptab-history-selector]');
  if(area==='suav')return card.querySelector('[data-suav-history-selector]');
  if(area==='vapor')return card.querySelector('[data-vapor-history-selector]');
  if(area==='ptar')return card.querySelector('[data-ptar-history-selector]');
  return card.querySelector('[data-wa-history-selector]');
}
function dashUiAllDayMeta(area,v){
  if(area==='vapor')return [v.frecuencia||'—',v.rango?`Rango: ${v.rango}`:''].filter(Boolean).join(' · ');
  if(area==='aire'||area==='frio')return [v.equipo||'—',waCriterio(v)].filter(Boolean).join(' · ');
  return [v.puesto||'—',v.rango?`Rango: ${v.rango}`:''].filter(Boolean).join(' · ');
}
function dashUiEnhanceCharts(area){
  const host=document.getElementById(`${area}-graficas-procesos`);if(!host)return;
  const procObjects=dashUiProcessObjects(area),info=dashUiDaySelectorInfo(area);
  host.querySelectorAll(info.selector).forEach(sel=>{
    if((area==='aire'||area==='frio')&&!String(sel.dataset.waDaySelector||'').startsWith(area+'|'))return;
    const pi=info.index(sel),proc=procObjects[pi];if(proc===undefined)return;
    const pname=dashUiProcessName(area,proc),vars=dashUiVars(area,proc);
    if(!sel.querySelector('option[value="__all__"]'))sel.insertAdjacentHTML('afterbegin','<option value="__all__">Todas las gráficas</option><option value="__none__">Ninguna gráfica</option>');
    const mode=DASH_UI_FILTERS.dayMode[area][pname];
    const card=sel.closest('.ptar-chart-process-card');if(!card)return;
    const day=card.querySelector('.ptar-day-block,.vapor-day-block');
    /* El redibujado de una pestaña puede recrear una tarjeta sin .ptar-day-block.
       No se debe convertir esa ausencia visual en un error de sincronización con Drive. */
    if(day){
      if(mode==='__all__'){
        sel.value='__all__';day.hidden=false;
        day.innerHTML=`<div class="dash-day-all-title"><h4>Lecturas del día seleccionado · todas las variables</h4><span>${esc(dashUiFormatDate(area))}</span></div><div class="dash-day-all-grid">${vars.map((v,vi)=>`<article class="dash-day-var-card"><div class="dash-day-var-head"><strong>${esc(v.variable)}</strong><span>${esc(dashUiAllDayMeta(area,v))}</span></div><div class="dash-day-var-chart" data-dash-day-all="${area}|${pi}|${vi}"></div></article>`).join('')}</div>`;
        vars.forEach((v,vi)=>{
          const target=day.querySelector(`[data-dash-day-all="${area}|${pi}|${vi}"]`);
          if(target)dashUiDayRenderer(area,target,proc,v);
        });
      }else if(mode==='__none__'){
        sel.value='__none__';day.hidden=true;
      }else{
        day.hidden=false;
        if(mode&&[...sel.options].some(o=>o.value===mode))sel.value=mode;
      }
    }
    const hsel=dashUiHistorySelector(area,card);
    if(hsel){
      if(!hsel.querySelector('option[value="__none__"]'))hsel.insertAdjacentHTML('beforeend','<option value="__none__">Ninguna gráfica</option>');
      const hmode=DASH_UI_FILTERS.histMode[area][pname];
      const grid=card.querySelector('.ptar-history-grid');
      if(hmode==='__none__'){
        hsel.value='__none__';if(grid){grid.hidden=false;grid.innerHTML='<div class="dash-empty-choice">No se está mostrando ninguna gráfica histórica.</div>';}
      }else if(hmode&&[...hsel.options].some(o=>o.value===hmode))hsel.value=hmode;
    }
    const sub=card.querySelector('.ptar-process-chart-sub');
    if(sub&&DASH_UI_FILTERS.month[area]!=='__all__')sub.textContent=sub.textContent.replace(/ · mes .+$/,'')+` · mes ${dashUiMonthLabel(DASH_UI_FILTERS.month[area])}`;
  });
}

/* El histórico se filtra por el mes elegido sin alterar la base de datos. */
const _dashHistPTAR=registrosHistoricosVariablePTAR;
registrosHistoricosVariablePTAR=function(v){return _dashHistPTAR(v).filter(r=>dashUiMonthMatch('ptar',r.fecha));};
const _dashHistVapor=registrosHistoricosVariableVapor;
registrosHistoricosVariableVapor=function(v){return _dashHistVapor(v).filter(r=>dashUiMonthMatch('vapor',r.fecha));};
const _dashHistSuav=registrosHistoricosVariableSuav;
registrosHistoricosVariableSuav=function(v){return _dashHistSuav(v).filter(r=>dashUiMonthMatch('suav',r.fecha));};
const _dashHistPtab=registrosHistoricosVariablePtabr;
registrosHistoricosVariablePtabr=function(v){return _dashHistPtab(v).filter(r=>dashUiMonthMatch('ptab',r.fecha));};
const _dashWaRowsVar=waRowsVar;
waRowsVar=function(tab,id,soloFechados=true){const rows=_dashWaRowsVar(tab,id,soloFechados);return soloFechados?rows.filter(r=>dashUiMonthMatch(tab,r.fecha)):rows;};
const _dashWaFechaTxt=waFechaTxt;
waFechaTxt=function(fecha,larga=false){if(fecha==='__sin_mes__')return 'Sin registros en el mes';return _dashWaFechaTxt(fecha,larga);};

function dashUiAfterRender(area){dashUiPopulateServiceControls(area);dashUiFilterDateSelects(area);dashUiEnhanceCharts(area);dashUiApplyProcessFilter(area);}
function dashUiWrapRender(area,name){
  const fn=window[name];if(typeof fn!=='function')return;
  window[name]=function(...args){const r=fn.apply(this,args);dashUiAfterRender(area);return r;};
}
/* Las declaraciones globales con let/const no siempre son propiedades de window; se reasignan explícitamente. */
const _dashPintarPtabr=pintarPtabr;pintarPtabr=function(){const r=_dashPintarPtabr.apply(this,arguments);dashUiAfterRender('ptab');return r;};
const _dashPintarSuav=pintarSuav;pintarSuav=function(){const r=_dashPintarSuav.apply(this,arguments);dashUiAfterRender('suav');return r;};
const _dashPintarVapor=pintarVapor;pintarVapor=function(){const r=_dashPintarVapor.apply(this,arguments);dashUiAfterRender('vapor');return r;};
const _dashPintarPTAR=pintarPTAR;pintarPTAR=function(){const r=_dashPintarPTAR.apply(this,arguments);dashUiAfterRender('ptar');return r;};
const _dashPintarWA=pintarWA;pintarWA=function(tab){const r=_dashPintarWA.apply(this,arguments);if(tab==='aire'||tab==='frio')dashUiAfterRender(tab);return r;};

const _dashGraficasPtab=pintarGraficasPtabr;pintarGraficasPtabr=function(){const r=_dashGraficasPtab.apply(this,arguments);dashUiEnhanceCharts('ptab');dashUiApplyProcessFilter('ptab');return r;};
const _dashGraficasSuav=pintarGraficasSuav;pintarGraficasSuav=function(){const r=_dashGraficasSuav.apply(this,arguments);dashUiEnhanceCharts('suav');dashUiApplyProcessFilter('suav');return r;};
const _dashGraficasVapor=pintarGraficasVapor;pintarGraficasVapor=function(){const r=_dashGraficasVapor.apply(this,arguments);dashUiEnhanceCharts('vapor');dashUiApplyProcessFilter('vapor');return r;};
const _dashGraficasPTAR=pintarGraficasPTAR;pintarGraficasPTAR=function(){const r=_dashGraficasPTAR.apply(this,arguments);dashUiEnhanceCharts('ptar');dashUiApplyProcessFilter('ptar');return r;};
const _dashGraficasWA=pintarWAGraficas;pintarWAGraficas=function(tab){const r=_dashGraficasWA.apply(this,arguments);if(tab==='aire'||tab==='frio'){dashUiEnhanceCharts(tab);dashUiApplyProcessFilter(tab);}return r;};

function dashUiInstallGlobalMonth(){
  const view=document.getElementById('v-resumen');if(!view||view.querySelector('[data-dashboard-month]'))return;
  const box=document.createElement('div');box.className='dashboard-month-controls';
  const months=[...new Set(DASH_AREAS.flatMap(dashUiMonths))].sort();
  box.innerHTML=`<label>Mes del dashboard<select data-dashboard-month><option value="__all__">Última información disponible / todos los meses</option>${months.map(m=>`<option value="${m}">${esc(dashUiMonthLabel(m))}</option>`).join('')}</select></label><span class="control-note">Al elegir un mes, cada servicio mostrará la última fecha disponible de ese mes y limitará sus históricos al mismo período.</span>`;
  const priority=view.querySelector('#priority-resumen');if(priority)priority.insertAdjacentElement('afterend',box);else view.insertAdjacentElement('afterbegin',box);
}
function dashUiRefreshAll(){DASH_AREAS.forEach(a=>dashUiRenderArea(a));pintarValores();pintarEncabezado();pintarPrioridades();}

/* Intercepta únicamente las opciones especiales; las opciones de variable individual conservan la lógica existente. */
document.addEventListener('change',e=>{
  const el=e.target;if(!(el instanceof HTMLSelectElement))return;
  const monthArea=el.dataset.serviceMonth;
  if(monthArea){
    DASH_UI_FILTERS.month[monthArea]=el.value;dashUiSelectLatestInMonth(monthArea,el.value);dashUiRenderArea(monthArea);pintarValores();pintarEncabezado();pintarPrioridades();return;
  }
  const procArea=el.dataset.serviceProcess;
  if(procArea){DASH_UI_FILTERS.process[procArea]=el.value;dashUiApplyProcessFilter(procArea);return;}
  if(el.dataset.dashboardMonth!==undefined){
    DASH_UI_FILTERS.globalMonth=el.value;
    DASH_AREAS.forEach(a=>{DASH_UI_FILTERS.month[a]=el.value;dashUiSelectLatestInMonth(a,el.value);});
    dashUiRefreshAll();return;
  }

  let area=null,pi=null,isDay=false,isHist=false;
  if(el.dataset.ptabChartProcess!==undefined){area='ptab';pi=Number(el.dataset.ptabChartProcess);isDay=true;}
  else if(el.dataset.suavChartProcess!==undefined){area='suav';pi=Number(el.dataset.suavChartProcess);isDay=true;}
  else if(el.dataset.vaporChartProcess!==undefined){area='vapor';pi=Number(el.dataset.vaporChartProcess);isDay=true;}
  else if(el.dataset.ptarChartProcess!==undefined){area='ptar';pi=Number(el.dataset.ptarChartProcess);isDay=true;}
  else if(el.dataset.waDaySelector!==undefined){const x=el.dataset.waDaySelector.split('|');area=x[0];pi=Number(x[1]);isDay=true;}
  else if(el.dataset.ptabHistorySelector!==undefined){area='ptab';pi=Number(el.dataset.ptabHistorySelector);isHist=true;}
  else if(el.dataset.suavHistorySelector!==undefined){area='suav';pi=Number(el.dataset.suavHistorySelector);isHist=true;}
  else if(el.dataset.vaporHistorySelector!==undefined){area='vapor';pi=Number(el.dataset.vaporHistorySelector);isHist=true;}
  else if(el.dataset.ptarHistorySelector!==undefined){area='ptar';pi=Number(el.dataset.ptarHistorySelector);isHist=true;}
  else if(el.dataset.waHistorySelector!==undefined){const x=el.dataset.waHistorySelector.split('|');area=x[0];pi=Number(x[1]);isHist=true;}
  if(!area||!Number.isFinite(pi))return;
  const proc=dashUiProcessObjects(area)[pi],pname=dashUiProcessName(area,proc);if(!pname)return;
  if(isDay){
    DASH_UI_FILTERS.dayMode[area][pname]=el.value;
    if(el.value==='__all__'||el.value==='__none__'){e.stopPropagation();e.preventDefault();if(area==='ptab')pintarGraficasPtabr();else if(area==='suav')pintarGraficasSuav();else if(area==='vapor')pintarGraficasVapor();else if(area==='ptar')pintarGraficasPTAR();else pintarWAGraficas(area);}
  }
  if(isHist){
    DASH_UI_FILTERS.histMode[area][pname]=el.value;
    if(el.value==='__none__'){e.stopPropagation();e.preventDefault();dashUiEnhanceCharts(area);}
  }
},true);



/* ==================== BOTÓN MANUAL · ACTUALIZAR DESDE DRIVE ==================== */
function dashDriveActiveArea(){
  const tab=document.querySelector('.tab[aria-selected="true"]');
  return tab&&tab.dataset?String(tab.dataset.tab||'resumen'):'resumen';
}
function dashDriveRefreshStatus(text,state){
  const el=document.getElementById('drive-refresh-status');
  if(!el)return;
  el.textContent=text||'';
  el.dataset.state=state||'';
}
function dashDriveLatestForArea(area){
  return dashDriveLatestDate(dashDriveCurrentRows(area));
}
async function dashDriveManualRefresh(){
  const btn=document.getElementById('drive-refresh-btn');
  if(btn&&btn.disabled)return;
  if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');const lab=btn.querySelector('.drive-refresh-label');if(lab)lab.textContent='Actualizando…';}
  dashDriveRefreshStatus('Leyendo Google Drive…','loading');
  try{
    const ans=await dashDriveRead({action:'read_master'},30000);
    dashDriveApplyMasterData(ans);
    const latest={};
    ['ptab','ptar','vapor','suav','aire','frio'].forEach(area=>{
      latest[area]=dashDriveLatestForArea(area);
      if(latest[area])dashDriveFocusDate(area,latest[area]);
    });
    let uiRefreshError=null;
    if(typeof dashUiRefreshAll==='function'){
      try{dashUiRefreshAll();}
      catch(uiErr){uiRefreshError=uiErr;console.warn('Drive actualizado; advertencia al redibujar la interfaz:',uiErr);}
    }
    const errs=window.__DASH_DRIVE_LAST_APPLY_ERRORS||[];
    const now=new Date(),hh=String(now.getHours()).padStart(2,'0'),mm=String(now.getMinutes()).padStart(2,'0');
    const txt=`Actualizado ${hh}:${mm}`;
    dashDriveRefreshStatus(txt,errs.length?'error':'ok');
    console.info('Drive actualizado', {latest,updatedAt:ans.updatedAt,errores:errs,uiRefreshError});
    if(errs.length) alert('Drive respondió, pero algunas áreas no pudieron aplicarse:\n'+errs.join('\n'));
  }catch(err){
    console.error('Actualización manual desde Drive:',err);
    dashDriveRefreshStatus('Error: '+(err&&err.message?err.message:'lectura'),'error');
    alert('Actualizar desde Drive: '+(err&&err.message?err.message:String(err)));
  }finally{
    if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');const lab=btn.querySelector('.drive-refresh-label');if(lab)lab.textContent='Actualizar desde Drive';}
  }
}
function instalarBotonActualizarDrive(){
  let btn=document.getElementById('drive-refresh-btn');
  if(!btn){
    const wrap=document.createElement('div');
    wrap.id='drive-refresh-floating';wrap.className='drive-refresh-wrap';
    wrap.innerHTML='<button type="button" id="drive-refresh-btn" class="drive-refresh-btn"><span class="drive-refresh-icon" aria-hidden="true">↻</span><span class="drive-refresh-label">Actualizar desde Drive</span></button><span id="drive-refresh-status" class="drive-refresh-status" aria-live="polite">Drive · listo</span>';
    document.body.appendChild(wrap);
    btn=document.getElementById('drive-refresh-btn');
  }
  if(btn&&!btn.dataset.driveBound){btn.dataset.driveBound='1';btn.addEventListener('click',dashDriveManualRefresh);}
}

function dashUiInit(){
  instalarBotonActualizarDrive();
  /* Se conservan solamente los controles de importación solicitados. */
  document.querySelectorAll('[data-excel-tools]').forEach(el=>el.remove());
  DASH_AREAS.forEach(a=>{dashUiPopulateServiceControls(a);dashUiAfterRender(a);});
  dashUiInstallGlobalMonth();
}
dashUiInit();
cargarBaseMaestraAutomatica();


/* =========================================================
   CORRECCIONES 22-09-2026
   - Lectura directa de las hojas "Carga diaria" para PTAR, Vapor y Suavizadores.
     Se evita depender del valor cacheado de fórmulas en la hoja Control.
   - Fecha dd/mm/yyyy preservada sin invertir día/mes.
   - Compresores + Refrigeración/NH3 se sincronizan en una única hoja Drive.
   - La planilla Sala de Compresores (Hoja1) se puede cargar desde cualquiera de
     las dos pestañas y alimenta ambos servicios.
   ========================================================= */

function dashCellHas(v){return !(v===null||v===undefined||String(v).trim()==='');}
function dashCellText(v){return v===null||v===undefined?'':String(v).trim();}
function dashIsoDateStrict(v){
  if(v instanceof Date&&!isNaN(v))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  if(typeof v==='number'&&Number.isFinite(v))return fechaISODesdeExcel(v);
  const s=dashCellText(v);
  let m=s.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)$/);
  if(m)return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
  m=s.match(/^([0-3]?\d)[\/\-]([01]?\d)[\/\-](\d{2}|\d{4})$/);
  if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;}
  return null;
}

async function dashLeerMatrizHoja(buffer,nombre){
  const zip=await abrirZipPTAR(buffer),parser=new DOMParser();
  const wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml');
  const relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml');
  const rels=[...relXml.getElementsByTagNameNS('*','Relationship')];
  let shared=[];
  if(zip.entries.has('xl/sharedStrings.xml')){
    const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');
    shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));
  }
  const sheet=[...wbXml.getElementsByTagNameNS('*','sheet')].find(s=>s.getAttribute('name')===nombre);
  if(!sheet)throw new Error(`No existe la hoja "${nombre}".`);
  const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id');
  const rel=rels.find(r=>r.getAttribute('Id')===rid);if(!rel)throw new Error('No se pudo resolver la hoja '+nombre+'.');
  let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');
  return leerHojaXLSXPTAR(zip,target,shared);
}

async function dashLeerFormatoPTAR(buffer){
  const m=await dashLeerMatrizHoja(buffer,'Carga diaria'),fecha=dashIsoDateStrict(m[2]&&m[2][1]);
  if(!fecha)throw new Error('No se pudo leer la fecha de Carga diaria (celda B3). Use dd/mm/aaaa.');
  const op07=dashCellText(m[2]&&m[2][4]),op19=dashCellText(m[2]&&m[2][7]),out=[];
  for(let i=6;i<m.length;i++){
    const r=m[i]||[],id=dashCellText(r[9]);if(!id)continue;const def=ptarDefPorId(id);if(!def)continue;
    [[5,6,'07:00',op07],[7,8,'19:00',op19]].forEach(([vc,oc,turno,operador])=>{
      const raw=r[vc];if(!dashCellHas(raw))return;const num=ptarNumeroLocal(raw);if(num===null)return;
      out.push({fecha,turno,operador,proceso:def.proceso,puesto:def.puesto,variable:def.variable,rango:def.rango,valor:num,unidad:def.unidad,tipo:def.tipo,min:def.min,max:def.max,observacion:dashCellText(r[oc]),fuente:'Carga diaria operador',id:def.id});
    });
  }
  if(!out.length)throw new Error('La hoja Carga diaria no contiene lecturas PTAR.');
  return out;
}

async function dashLeerFormatoVapor(buffer){
  const m=await dashLeerMatrizHoja(buffer,'Carga diaria'),fecha=dashIsoDateStrict(m[2]&&m[2][1]);
  if(!fecha)throw new Error('No se pudo leer la fecha de Carga diaria (celda B3). Use dd/mm/aaaa.');
  const op07=dashCellText(m[2]&&m[2][4]),op19=dashCellText(m[2]&&m[2][7]),out=[];
  for(let i=6;i<m.length;i++){
    const r=m[i]||[],id=dashCellText(r[9]);if(!id)continue;const def=vaporDefPorId(id);if(!def)continue;
    [[5,6,'07:00',op07],[7,8,'19:00',op19]].forEach(([vc,oc,turno,operador])=>{
      const raw=r[vc];if(!dashCellHas(raw))return;const num=vaporNumeroLocal(raw);if(num===null)return;
      out.push({fecha,turno,operador,proceso:def.proceso,variable:def.variable,frecuencia:def.frecuencia,rango:def.rango,valor:num,unidad:def.unidad,tipo:def.tipo,min:def.min,max:def.max,observacion:dashCellText(r[oc]),fuente:'Carga diaria operador',id:def.id});
    });
  }
  if(!out.length)throw new Error('La hoja Carga diaria no contiene lecturas de Vapor.');
  return out;
}

async function dashLeerFormatoSuav(buffer){
  const m=await dashLeerMatrizHoja(buffer,'Carga diaria'),fecha=dashIsoDateStrict(m[2]&&m[2][1]);
  if(!fecha)throw new Error('No se pudo leer la fecha de Carga diaria (celda B3). Use dd/mm/aaaa.');
  const op1=dashCellText(m[2]&&m[2][4]),op2=dashCellText(m[2]&&m[2][7]),out=[];
  for(let i=6;i<m.length;i++){
    const r=m[i]||[],id=dashCellText(r[9]);if(!id)continue;const def=suavDefPorId(id);if(!def)continue;
    [[5,6,'1er Turno','06:00 am',op1],[7,8,'2do Turno','06:00 pm',op2]].forEach(([vc,oc,turno,hora,operador])=>{
      const raw=r[vc];if(!dashCellHas(raw))return;const num=suavNumeroLocal(raw);
      out.push({fecha,turno,hora,operador,proceso:def.proceso,puesto:def.puesto,variable:def.variable,rango:def.rango,valor:num,original:raw,unidad:def.unidad,tipo:def.tipo,min:def.min,max:def.max,estadoFuente:'',observacion:dashCellText(r[oc]),fuente:'Carga diaria operador',id:def.id});
    });
  }
  if(!out.length)throw new Error('La hoja Carga diaria no contiene lecturas de Suavizadores.');
  return out;
}

/* Los formatos diarios se leen directamente; no se usan los caches de fórmula de Control. */
cargarExcelPTARArchivo=async function(file){try{const norm=await dashLeerFormatoPTAR(await file.arrayBuffer());await dashDriveAppend('ptar',norm,'PTAR');}catch(e){alert('PTAR: '+e.message);throw e;}};
cargarExcelVaporArchivo=async function(file){try{const norm=await dashLeerFormatoVapor(await file.arrayBuffer());await dashDriveAppend('vapor',norm,'Vapor');}catch(e){alert('Vapor: '+e.message);throw e;}};
cargarExcelSuavArchivo=async function(file){try{const norm=await dashLeerFormatoSuav(await file.arrayBuffer());await dashDriveAppend('suav',norm,'Suavizadores');}catch(e){alert('Suavizadores: '+e.message);throw e;}};

/* ---------- Drive: hoja única COMPRESORES_REFRIGERACION ---------- */
const _dashDriveRows4=dashDriveRows;
dashDriveRows=function(area,rows){
  if(area!=='wa')return _dashDriveRows4(area,rows);
  return (rows||[]).map(r=>({
    'Fecha operativa':r.fecha,'Confianza fecha':r.confianzaFecha||'Fecha ingresada por operador','Turno':r.turno,'Turno original':r.turnoOriginal||r.turno,'Operador':r.operador||'','Reporte ID':r.reporteId||'',
    'Proceso / Área':r.area,'Equipo / Puesto':r.equipo,'Variable':r.variable,'Valor numérico':r.valor===null||r.valor===undefined?'':r.valor,'Valor texto':r.texto||'','Unidad':r.unidad||'',
    'Indicador':r.indicador||'','Estado normalizado':r.estado||'','Observación':r.observacion||'','Línea original':r.linea||'Carga diaria operador','Incluir dashboard':'Sí','VariableId':r.id,
    'Tipo de dato':r.tipoDato||((r.valor!==null&&r.valor!==undefined)?'Numérico':'Texto'),'Rango operativo':r.rango||'','Criterio disponible en fuente':r.criterio||''
  }));
};
const _dashDriveCurrentRows4=dashDriveCurrentRows;
dashDriveCurrentRows=function(area){if(area==='aire'||area==='frio'){const c=waCfg(area);return c?c.data:[];}return _dashDriveCurrentRows4(area);};

function dashWADriveNormalize(raw){
  const rows=[],defs=new Map();
  (raw||[]).forEach(o=>{
    const fecha=dashIsoDateStrict(o['Fecha operativa']??o.fecha),area=dashCellText(o['Proceso / Área']??o.area),equipo=dashCellText(o['Equipo / Puesto']??o.equipo),variable=dashCellText(o.Variable??o.variable),id=dashCellText(o.VariableId??o.id),turno=dashCellText(o.Turno??o.turno);
    if(!fecha||!area||!equipo||!variable||!id||!turno)return;
    const nr=o['Valor numérico']??o.valor,tx=dashCellText(o['Valor texto']??o.texto),num=dashCellHas(nr)?ptarNumeroLocal(nr):null;
    const tipoDato=dashCellText(o['Tipo de dato']??o.tipoDato)||((num!==null)?'Numérico':'Texto'),rango=dashCellText(o['Rango operativo']??o.rango),criterio=dashCellText(o['Criterio disponible en fuente']??o.criterio);
    rows.push({fecha,confianzaFecha:dashCellText(o['Confianza fecha']??o.confianzaFecha),turno,turnoOriginal:dashCellText(o['Turno original']??o.turnoOriginal),operador:dashCellText(o.Operador??o.operador),reporteId:dashCellText(o['Reporte ID']??o.reporteId),area,equipo,variable,valor:num,texto:tx,unidad:dashCellText(o.Unidad??o.unidad),indicador:dashCellText(o.Indicador??o.indicador),estado:dashCellText(o['Estado normalizado']??o.estado),observacion:dashCellText(o.Observación??o.observacion),linea:dashCellText(o['Línea original']??o.linea),id,tipoDato,rango,criterio});
    if(!defs.has(id))defs.set(id,{id,area,equipo,variable,unidad:dashCellText(o.Unidad??o.unidad),tipoDato,rango,criterio});
  });
  return {rows,catalogo:[...defs.values()]};
}
function dashWAApplyAll(raw,source='Google Drive · COMPRESORES_REFRIGERACION'){
  const n=dashWADriveNormalize(raw),air=n.rows.filter(r=>WA_CFG.aire.areasPermitidas.includes(r.area)),frio=n.rows.filter(r=>WA_CFG.frio.areasPermitidas.includes(r.area)),ac=n.catalogo.filter(v=>WA_CFG.aire.areasPermitidas.includes(v.area)),fc=n.catalogo.filter(v=>WA_CFG.frio.areasPermitidas.includes(v.area));
  if(air.length){cargarWA('aire',air,ac,[...new Set(air.map(r=>r.fecha))].sort(),source);dashSave('aire',air);}
  if(frio.length){cargarWA('frio',frio,fc,[...new Set(frio.map(r=>r.fecha))].sort(),source);dashSave('frio',frio);}
  return {air,frio};
}
const _dashDriveApplyMasterData4=dashDriveApplyMasterData;
dashDriveApplyMasterData=function(ans,focusArea=null,focusDate=null){
  const isWA=focusArea==='aire'||focusArea==='frio',base=_dashDriveApplyMasterData4(ans,isWA?null:focusArea,isWA?null:focusDate),raw=ans&&ans.data&&ans.data.COMPRESORES_REFRIGERACION;
  let waFocus=!isWA||!focusDate;
  if(Array.isArray(raw)){
    try{const x=dashWAApplyAll(raw);if(isWA&&focusDate){const rr=focusArea==='aire'?x.air:x.frio;waFocus=rr.some(r=>r.fecha===focusDate);if(waFocus)dashDriveFocusDate(focusArea,focusDate);}['aire','frio'].forEach(a=>{try{dashUiPopulateServiceControls(a);dashUiAfterRender(a);}catch(e){console.warn('UI '+a,e);}});}catch(e){console.error('Drive: no se pudo aplicar COMPRESORES_REFRIGERACION',e);window.__DASH_DRIVE_LAST_APPLY_ERRORS=[...(window.__DASH_DRIVE_LAST_APPLY_ERRORS||[]),'COMPRESORES_REFRIGERACION: '+e.message];}
  }
  return isWA?waFocus:base;
};

function dashWAValue(r){return r&&(r.valor!==null&&r.valor!==undefined&&r.valor!=='')?r.valor:dashCellText(r&&r.texto);}
function dashWAMergeLocal(tab,incoming,catalogo,source){
  const c=waCfg(tab),part=(incoming||[]).filter(r=>c.areasPermitidas.includes(r.area));if(!part.length)return;
  const m=dashMerge(c.data,part,r=>[r.fecha,r.turno,r.reporteId,r.id].join('|'),dashWAValue),cat=[...c.catalogo];
  (catalogo||[]).filter(v=>c.areasPermitidas.includes(v.area)).forEach(v=>{const i=cat.findIndex(x=>x.id===v.id);if(i<0)cat.push(v);else cat[i]=Object.assign({},cat[i],v);});
  cargarWA(tab,m.rows,cat,[],source);dashSave(tab,m.rows);
}
async function dashDriveAppendWA(rows,catalogo,label='Sala de Compresores'){
  if(!rows||!rows.length)throw new Error('La planilla no contiene datos válidos para Compresores/Refrigeración.');
  const key=dashDriveWriteKey();if(!key)throw new Error('No se ingresó la clave de actualización.');
  const enriched=rows.map(r=>{const d=(catalogo||[]).find(x=>x.id===r.id)||{};return Object.assign({},r,{tipoDato:r.tipoDato||d.tipoDato||((r.valor!==null&&r.valor!==undefined)?'Numérico':'Texto'),rango:r.rango||d.rango||'',criterio:r.criterio||d.criterio||'',unidad:r.unidad||d.unidad||''});});
  const fechas=[...new Set(enriched.map(r=>r.fecha).filter(Boolean))].sort(),focusDate=fechas[fechas.length-1]||null;
  let ans=null,postError=null;
  try{ans=await dashDriveRequest({action:'append_rows',key,area:'wa',rows:dashDriveRows('wa',enriched)});}catch(e){postError=e;console.warn('POST WA enviado; se confirmará por lectura.',e);}
  dashWAMergeLocal('aire',enriched,catalogo,'Carga operador · pendiente de confirmar Drive');
  dashWAMergeLocal('frio',enriched,catalogo,'Carga operador · pendiente de confirmar Drive');
  if(ans&&ans.data)dashDriveApplyMasterData(ans);
  let ok=!!(ans&&ans.data&&Array.isArray(ans.data.COMPRESORES_REFRIGERACION)),last=null;
  for(let i=0;i<5&&!ok;i++){
    if(i)await dashDriveSleep(650*i);
    try{const ra=await dashDriveRead({action:'read_master'});dashDriveApplyMasterData(ra);ok=Array.isArray(ra&&ra.data&&ra.data.COMPRESORES_REFRIGERACION);if(ok)ans=ans||ra;}catch(e){last=e;}
  }
  ['aire','frio'].forEach(a=>{const c=waCfg(a);if(focusDate&&c&&c.data.some(r=>r.fecha===focusDate))dashDriveFocusDate(a,focusDate);});
  if(ok){dashDriveRefreshStatus('Drive sincronizado','ok');alert(`${label}: información guardada en Drive y dashboard sincronizado.${focusDate?` Fecha visible: ${focusDate}.`:''}`);return;}
  dashDriveRefreshStatus('Pendiente de confirmar Drive','error');const e=last||postError;alert(`${label}: los datos quedan visibles localmente, pero no se pudo confirmar la lectura de Drive.${e?` Detalle: ${e.message||e}`:''}`);
}

/* ---------- Parser de la planilla Sala de Compresores (Hoja1) ---------- */
function salaSlug(s){return dashCellText(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
function salaNum(v){if(typeof v==='number'&&Number.isFinite(v))return v;const s=dashCellText(v);if(!s)return null;const n=ptarNumeroLocal(s);return n;}
function salaStatus(text){const s=dashCellText(text),k=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(!s)return {indicador:'',estado:''};if(/fuera|mtto|mantenimiento|inoper|parad|off|no$/.test(k))return {indicador:'⛔',estado:'Fuera de servicio / fuera de norma'};if(/alert|falla|anormal|bajo|alto/.test(k))return {indicador:'⚠️',estado:'Alerta'};return {indicador:'✅',estado:'Operativo / normal reportado'};}
function salaFirst(m,row,cols){for(const c of cols){const v=m[row-1]&&m[row-1][c-1];if(dashCellHas(v))return dashCellText(v);}return '';}
async function leerSalaCompresores(buffer){
  const m=await dashLeerMatrizHoja(buffer,'Hoja1'),fecha=dashIsoDateStrict(m[1]&&m[1][10]);
  if(!fecha)throw new Error('No se pudo leer la fecha de la planilla Sala de Compresores (K2). Use dd/mm/aaaa.');
  const opDia=salaFirst(m,5,[4,5,6]),opNoche=salaFirst(m,5,[9,10,11]);
  const slots=[{col:5,turno:'07:00',orig:'7AM',op:opDia,tag:'0700'},{col:7,turno:'13:00',orig:'1PM',op:opDia,tag:'1300'},{col:9,turno:'19:00',orig:'7PM',op:opNoche,tag:'1900'},{col:11,turno:'01:00',orig:'1AM',op:opNoche,tag:'0100'}];
  const rows=[],defs=new Map();
  function add(area,equipo,variable,value,opts={}){
    if(!dashCellHas(value))return;const id=opts.id||`sala_${opts.group||'frio'}_${opts.row||0}_${salaSlug(variable)}_${opts.extra||''}`.replace(/_+$/,'');const num=salaNum(value),text=num===null?dashCellText(value):'',st=num===null?salaStatus(text):{indicador:'',estado:'Sin indicador'},tipoDato=num===null?'Texto':'Numérico';
    const r={fecha,confianzaFecha:'Fecha ingresada por operador',turno:opts.turno||'General',turnoOriginal:opts.turnoOriginal||opts.turno||'General',operador:opts.operador||'',reporteId:opts.reporteId||`SALA-${fecha.replace(/-/g,'')}-${opts.tag||'GEN'}`,area,equipo,variable,valor:num,texto:text,unidad:opts.unidad||'',indicador:st.indicador,estado:st.estado,observacion:opts.observacion||'',linea:`Sala de Compresores · fila ${opts.row||''}`,id,tipoDato,rango:'',criterio:'Registro de sala de compresores'};rows.push(r);if(!defs.has(id))defs.set(id,{id,area,equipo,variable,unidad:r.unidad,tipoDato,rango:'',criterio:r.criterio});
  }
  function timed(area,equipo,variable,row,group='frio',unidad=''){
    slots.forEach(sl=>{const v=m[row-1]&&m[row-1][sl.col-1];add(area,equipo,variable,v,{group,row,extra:'timed',turno:sl.turno,turnoOriginal:sl.orig,operador:sl.op,reporteId:`SALA-${fecha.replace(/-/g,'')}-${sl.tag}`,tag:sl.tag,unidad});});
  }
  function staticPairs(area,equipo,row,group='frio'){
    [[4,5],[6,7],[8,9],[10,11]].forEach(([lc,vc],i)=>{const lab=m[row-1]&&m[row-1][lc-1],val=m[row-1]&&m[row-1][vc-1];if(!dashCellHas(lab)||!dashCellHas(val))return;add(area,equipo,dashCellText(lab),val,{group,row,extra:`p${i+1}`,turno:'General',turnoOriginal:'General',operador:i<2?opDia:opNoche,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN'});});
  }
  // Aire comprimido
  [11,13,15,17,19,21,23].forEach(r=>{const eq=salaFirst(m,r,[2]);if(!eq)return;[[4,'07:00','7AM',opDia,'0700'],[6,'13:00','1PM',opDia,'1300'],[8,'19:00','7PM',opNoche,'1900'],[10,'01:00','1AM',opNoche,'0100']].forEach(([c,t,o,op,tag])=>add('Compresores Aire',eq,'Operación',m[r-1]&&m[r-1][c-1],{group:'air',row:r,extra:'operacion',turno:t,turnoOriginal:o,operador:op,reporteId:`SALA-${fecha.replace(/-/g,'')}-${tag}`,tag}));timed('Compresores Aire',eq,'Presión',r,'air','psi');});
  [12,14,16,18,20,22,24].forEach(r=>{const eq=salaFirst(m,r-1,[2]);[[5,6,'L1'],[7,8,'L2'],[9,10,'L3']].forEach(([lc,vc,ph],i)=>add('Compresores Aire',eq,`Corriente ${ph}`,m[r-1]&&m[r-1][vc-1],{group:'air',row:r,extra:`corr${i+1}`,turno:'General',turnoOriginal:'General',operador:opDia,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN',unidad:'A'}));});
  staticPairs('Trampas de Aire','Trampas de Condensado',25,'air');staticPairs('Compresores Aire','Filtros',26,'air');timed('Compresores Aire','Red de aire','Presión del sistema',27,'air','psi');
  // Compresores NH3 SABROE #1..#6
  [33,37,41,45,49,53].forEach(r=>{const eq=salaFirst(m,r,[2]);timed('Compresores NH3',eq,'Presión de aspiración',r,'frio','psi');timed('Compresores NH3',eq,'Capacidad',r+1,'frio','%');timed('Compresores NH3',eq,'Temperatura de aceite',r+2,'frio','°C');staticPairs('Compresores NH3',eq,r+3,'frio');});
  // Condensadores 1..6
  [60,63,66,69,72,75].forEach(r=>{const eq=salaFirst(m,r,[2]);timed('Condensador/Evaporativo',eq,'Nivel de agua',r,'frio','');timed('Condensador/Evaporativo',eq,'Disponibilidad',r+1,'frio','');staticPairs('Condensador/Evaporativo',eq,r+2,'frio');});
  // Bancos de hielo
  [81,82,83,84].forEach(r=>staticPairs('Banco de Hielo',salaFirst(m,r,[2]),r,'frio'));
  // Agua helada / procesos
  timed('UMAS Margarina','Chiller UMAs','Temperatura',87,'frio','°C');staticPairs('UMAS Margarina','Sist Bomb 1 · Chiller UMAs',88,'frio');staticPairs('UMAS Margarina','Sist Bomb 2 · Chiller UMAs',89,'frio');
  timed('Fraccionamiento','C. FRACCIONAMIENTO','Temperatura',90,'frio','°C');staticPairs('Fraccionamiento','Sist Bomb 1 · Fraccionamiento',91,'frio');staticPairs('Fraccionamiento','Sist Bomb 2 · Fraccionamiento',92,'frio');
  timed('Banco de Hielo','Formu. Mayonesa','Temperatura',93,'frio','°C');staticPairs('Banco de Hielo','Sist Bomb 1 · Formu. Mayonesa',94,'frio');staticPairs('Banco de Hielo','Sist Bomb 2 · Formu. Mayonesa',95,'frio');
  timed('Banco de Hielo','RET. Formu. Mayonesa','Temperatura',96,'frio','°C');timed('Banco de Hielo','Descarga Gandola Aceite','Temperatura',97,'frio','°C');staticPairs('Banco de Hielo','Sist Bomb 1 · Descarga Gandola Aceite',98,'frio');staticPairs('Banco de Hielo','Sist Bomb 2 · Descarga Gandola Aceite',99,'frio');
  timed('Banco de Hielo','Formu. Margarina','Temperatura',100,'frio','°C');staticPairs('Banco de Hielo','Sist Bomb 1 · Formu. Margarina',101,'frio');staticPairs('Banco de Hielo','Sist Bomb 2 · Formu. Margarina',102,'frio');
  // Cava gigante
  const cg1='Compresor NH3 SABROE #1 Cava Gigante',cg2='Compresor NH3 SABROE #2 Cava Gigante';timed('Cava Gigante',cg1,'Capacidad',107,'frio','%');timed('Cava Gigante',cg1,'Presión de aspiración',108,'frio','psi');timed('Cava Gigante',cg1,'Nivel de aceite',109,'frio','');staticPairs('Cava Gigante',cg1+' · Ref. Cabezal',110,'frio');
  timed('Cava Gigante',cg2,'Capacidad',111,'frio','%');timed('Cava Gigante',cg2,'Presión de aspiración',112,'frio','psi');timed('Cava Gigante',cg2,'Nivel de aceite',113,'frio','');staticPairs('Cava Gigante',cg2+' · Ref. Cabezal',114,'frio');
  timed('Cava Gigante','CONDENSADOR EVAPORATIVO CG','Nivel de agua',115,'frio','');timed('Cava Gigante','CONDENSADOR EVAPORATIVO CG','Disponibilidad',116,'frio','');staticPairs('Cava Gigante','CONDENSADOR EVAPORATIVO CG',117,'frio');
  timed('Cava Gigante','Difusor #1 CAVA GIGANTE','Presión tanque',118,'frio','psi');timed('Cava Gigante','Difusor #1 CAVA GIGANTE','Motores operación',119,'frio','');timed('Cava Gigante','Difusor #2 CAVA GIGANTE','Presión tanque',120,'frio','psi');timed('Cava Gigante','Difusor #2 CAVA GIGANTE','Motores operación',121,'frio','');timed('Cava Gigante','Temperatura Cava G','Temperatura',122,'frio','°C');
  // Temperaturas finales: campos dobles por fila
  [124,125,126,127].forEach(r=>{const l1=salaFirst(m,r,[4]),v1=m[r-1]&&m[r-1][5],l2=salaFirst(m,r,[8]),v2=m[r-1]&&m[r-1][9];if(l1)add('Cavas',l1,'Temperatura',v1,{group:'frio',row:r,extra:'temp1',turno:'General',turnoOriginal:'General',operador:opDia,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN',unidad:'°C'});if(l2)add('Cavas',l2,'Temperatura',v2,{group:'frio',row:r,extra:'temp2',turno:'General',turnoOriginal:'General',operador:opNoche,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN',unidad:'°C'});});
  const obs=salaFirst(m,129,[4,5,6,7,8,9,10,11]);if(obs)add('Cavas','Sala de Compresores','Observaciones generales',obs,{group:'frio',row:129,extra:'obs',turno:'General',turnoOriginal:'General',operador:opNoche||opDia,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN'});
  if(!rows.length)throw new Error('La planilla no contiene lecturas diligenciadas.');
  return {rows,catalogo:[...defs.values()],fecha};
}

cargarExcelWAArchivo=async function(file){
  const buffer=await file.arrayBuffer();
  try{
    const sala=await leerSalaCompresores(buffer);await dashDriveAppendWA(sala.rows,sala.catalogo,'Sala de Compresores');return;
  }catch(salaErr){
    try{
      const parsed=await leerExcelWA(buffer),ac=waBuildCatalog(parsed.catalogo,WA_CFG.aire.areasPermitidas,'aire'),fc=waBuildCatalog(parsed.catalogo,WA_CFG.frio.areasPermitidas,'nh3'),ad=waNormalizeExcelData(parsed.datos,ac,WA_CFG.aire.areasPermitidas),fd=waNormalizeExcelData(parsed.datos,fc,WA_CFG.frio.areasPermitidas);await dashDriveAppendWA([...ad,...fd],[...ac,...fc],'Compresores/Refrigeración');return;
    }catch(legacyErr){throw new Error('No se pudo reconocer la planilla. '+salaErr.message+' / '+legacyErr.message);}
  }
};

// Mantener fecha dd/mm/yyyy sin inversión también en la lógica general.
normalizarFechaPTAR=function(v){return dashIsoDateStrict(v);};
normalizarFechaVapor=function(v){return dashIsoDateStrict(v);};
normalizarFechaSuav=function(v){return dashIsoDateStrict(v);};
normalizarFechaPtabr=function(v){return dashIsoDateStrict(v);};



/* =========================================================
   CORRECCIONES V2 · 22-09-2026
   - PTAR/Vapor: turnos canónicos y deduplicación por fecha+turno+VariableId.
   - La búsqueda de la tabla prioriza una lectura real sobre placeholders vacíos.
   - El lector de Carga diaria conserva los números físicos de fila del XLSX.
   - Compresores + Refrigeración/NH3 se muestran como una sola pestaña visual.
   - Sala de Compresores: parser corregido (texto:text).
   ========================================================= */
function dashCanonicalShift(v){
  const raw=dashCellText(v); if(!raw)return '';
  const s=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'');
  if(/^(0?7)(:00(:00)?)?(am)?$/.test(s)||s==='7am')return '07:00';
  if(/^(19)(:00(:00)?)?$/.test(s)||/^(0?7)(:00(:00)?)?pm$/.test(s)||s==='7pm')return '19:00';
  if(/^(0?6)(:00(:00)?)?(am)?$/.test(s)||s==='6am')return '06:00';
  if(/^(18)(:00(:00)?)?$/.test(s)||/^(0?6)(:00(:00)?)?pm$/.test(s)||s==='6pm')return '18:00';
  if(/^(13)(:00(:00)?)?$/.test(s)||/^(0?1)(:00(:00)?)?pm$/.test(s)||s==='1pm')return '13:00';
  if(/^(0?1)(:00(:00)?)?(am)?$/.test(s)||s==='1am')return '01:00';
  const m=s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);if(m)return `${String(Number(m[1])).padStart(2,'0')}:${m[2]}`;
  return raw;
}
function dashPreferMeaningfulRows(rows,area){
  const out=[],pos=new Map();
  const valueOf=r=>area==='ptar'||area==='vapor'?r.valor:(r.valor??r.original);
  (rows||[]).forEach(r0=>{
    if(!r0)return; const r=Object.assign({},r0,{turno:dashCanonicalShift(r0.turno)});
    const k=[r.fecha,r.turno,r.id].join('|');if(!r.fecha||!r.turno||!r.id)return;
    if(!pos.has(k)){pos.set(k,out.length);out.push(r);return;}
    const i=pos.get(k),old=out[i],ov=valueOf(old),nv=valueOf(r);
    // lectura real gana sobre placeholder; si ambas son reales, gana la más reciente
    if((!dashMeaningful(ov)&&dashMeaningful(nv))||(dashMeaningful(nv)&&dashMeaningful(ov)))out[i]=r;
    else if(!dashMeaningful(ov)&&!dashMeaningful(nv))out[i]=r;
  });
  return out;
}
const _normalizarFilasPTAR_V2=normalizarFilasPTAR;
normalizarFilasPTAR=function(rows){return dashPreferMeaningfulRows(_normalizarFilasPTAR_V2(rows).map(r=>Object.assign({},r,{turno:dashCanonicalShift(r.turno)})),'ptar');};
const _normalizarFilasVapor_V2=normalizarFilasVapor;
normalizarFilasVapor=function(rows){return dashPreferMeaningfulRows(_normalizarFilasVapor_V2(rows).map(r=>Object.assign({},r,{turno:dashCanonicalShift(r.turno)})),'vapor');};

registroPTAR=function(variableId,turno,fecha=PTAR_FECHA){
  const t=dashCanonicalShift(turno),m=PTAR_DATA.filter(r=>r.fecha===fecha&&dashCanonicalShift(r.turno)===t&&r.id===variableId);
  if(!m.length)return null; for(let i=m.length-1;i>=0;i--)if(tieneLecturaPTAR(m[i].valor))return m[i]; return m[m.length-1];
};
registroVapor=function(variableId,turno,fecha=VAPOR_FECHA){
  const t=dashCanonicalShift(turno),m=VAPOR_DATA.filter(r=>r.fecha===fecha&&dashCanonicalShift(r.turno)===t&&r.id===variableId);
  if(!m.length)return null; for(let i=m.length-1;i>=0;i--)if(tieneLecturaVapor(m[i].valor))return m[i]; return m[m.length-1];
};
operadoresFechaPTAR=function(fecha=PTAR_FECHA){const out={};PTAR_TURNOS.forEach(t=>{const m=PTAR_DATA.filter(x=>x.fecha===fecha&&dashCanonicalShift(x.turno)===t&&x.operador&&tieneLecturaPTAR(x.valor));out[t]=m.length?m[m.length-1].operador:'';});return out;};
operadoresFechaVapor=function(fecha=VAPOR_FECHA){const out={};VAPOR_TURNOS.forEach(t=>{const m=VAPOR_DATA.filter(x=>x.fecha===fecha&&dashCanonicalShift(x.turno)===t&&x.operador);out[t]=m.length?m[m.length-1].operador:'';});return out;};

// Releer una hoja conservando la fila física (atributo r="...").
dashLeerMatrizHoja=async function(buffer,nombre){
  const zip=await abrirZipPTAR(buffer),parser=new DOMParser();
  const wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml');
  const relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml');
  const rels=[...relXml.getElementsByTagNameNS('*','Relationship')];let shared=[];
  if(zip.entries.has('xl/sharedStrings.xml')){const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));}
  const sheet=[...wbXml.getElementsByTagNameNS('*','sheet')].find(s=>s.getAttribute('name')===nombre);if(!sheet)throw new Error(`No existe la hoja "${nombre}".`);
  const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id'),rel=rels.find(r=>r.getAttribute('Id')===rid);if(!rel)throw new Error('No se pudo resolver la hoja '+nombre+'.');
  let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');
  const shXml=parser.parseFromString(await zip.text(target),'application/xml'),out=[];
  [...shXml.getElementsByTagNameNS('*','row')].forEach((row,seq)=>{
    const rn=Math.max(1,Number(row.getAttribute('r'))||seq+1),arr=[];
    [...row.getElementsByTagNameNS('*','c')].forEach(c=>{const ci=colIndexPTAR(c.getAttribute('r')),t=c.getAttribute('t');let value='';if(t==='inlineStr')value=[...c.getElementsByTagNameNS('*','t')].map(x=>x.textContent||'').join('');else{const ve=c.getElementsByTagNameNS('*','v')[0],raw=ve?ve.textContent:'';if(t==='s')value=shared[Number(raw)]??'';else if(t==='str')value=raw;else if(raw!==''){const n=Number(raw);value=Number.isFinite(n)?n:raw;}}arr[ci]=value;});
    out[rn-1]=arr;
  });
  return out;
};

// Al terminar una carga, siempre superponer la planilla recién subida en la vista local.
dashDriveApplyImportedLocally=function(area,norm,fecha){
  const out=(dashDriveCurrentRows(area)||[]).map(r=>Object.assign({},r)),pos=new Map(out.map((r,i)=>[[r.fecha,dashCanonicalShift(r.turno),r.id].join('|'),i]));
  (norm||[]).forEach(n0=>{const n=Object.assign({},n0,{turno:dashCanonicalShift(n0.turno)}),k=[n.fecha,n.turno,n.id].join('|');if(!pos.has(k)){pos.set(k,out.length);out.push(n);return;}const i=pos.get(k);if(dashMeaningful(dashDriveValueForMerge(area,n)))out[i]=Object.assign({},out[i],n);});
  const clean=(area==='ptar'||area==='vapor')?dashPreferMeaningfulRows(out,area):out;
  dashDriveLoadRows(area,clean,'Google Drive · carga del operador');dashSave(area,clean);dashDriveFocusDate(area,fecha);
};

const _dashDriveAppend_V2=dashDriveAppend;
dashDriveAppend=async function(area,norm,label){
  norm=(area==='ptar'||area==='vapor')?dashPreferMeaningfulRows(norm,area):norm;
  await _dashDriveAppend_V2(area,norm,label);
  const fecha=dashDriveLatestDate(norm);dashDriveApplyImportedLocally(area,norm,fecha);
};

// Una sola pestaña visual: Aire + Refrigeración/NH3.
SERVICIOS.aire.nom='Compresores · Refrigeración · NH₃';
SERVICIOS.aire.sub='Sala de Compresores · aire comprimido, refrigeración y amoníaco';
SERVICIOS.aire.corto='Sala de Compresores';
const _irV2=ir;
ir=function(id){
  if(id==='frio')id='aire';
  activa=id;
  document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===id)));
  document.querySelectorAll('.view').forEach(v=>{v.hidden=id==='aire'?!(v.id==='v-aire'||v.id==='v-frio'):(v.id!=='v-'+id);});
  pintarEncabezado();window.scrollTo(0,0);
  if(id==='ptab')pintarPtabr();else if(id==='suav')pintarSuav();else if(id==='vapor')pintarVapor();else if(id==='aire'){pintarWA('aire');pintarWA('frio');}else if(id==='ptar')pintarPTAR();else pintarGraficas();
  pintarPrioridades();
};

/* =========================================================
   CORRECCIONES V3.1 · 22-09-2026
   - Sala de Compresores: 4 sistemas visibles en una sola pestaña.
   - Se persiste la columna Sistema en COMPRESORES_REFRIGERACION.
   - El dashboard conserva Proceso / Área como subárea y usa Sistema para agrupar.
   - El panel Refrigeración separado queda desactivado; todo se muestra en v-aire.
   ========================================================= */
const DASH_SALA_SYSTEMS = [
  'Sistema de Aire Comprimido',
  'Sistema de Refrigeracion NH3 Sala de Compresores',
  'Sistema de Refrigeracion NH3 AGUA HELADA',
  'Sistema de Refrigeracion NH3 CAV Gigante'
];
function dashSalaSistemaPorArea(area){
  const a=dashCellText(area);
  if(['Compresores Aire','Trampas de Aire'].includes(a))return DASH_SALA_SYSTEMS[0];
  if(['Compresores NH3','Condensador/Evaporativo','NH3 en Cilindros'].includes(a))return DASH_SALA_SYSTEMS[1];
  if(['Banco de Hielo','Fraccionamiento','UMAS Margarina'].includes(a))return DASH_SALA_SYSTEMS[2];
  if(['Cava Gigante','Cavas'].includes(a))return DASH_SALA_SYSTEMS[3];
  return a||'Otros';
}
function dashSalaSistema(r){return dashCellText(r&&r.sistema)||dashSalaSistemaPorArea(r&&r.area);}

// Añadir Sistema a todo registro generado desde la planilla Hoja1.
const _leerSalaCompresoresV3=leerSalaCompresores;
leerSalaCompresores=async function(buffer){
  const x=await _leerSalaCompresoresV3(buffer);
  x.rows=(x.rows||[]).map(r=>Object.assign({},r,{sistema:dashSalaSistemaPorArea(r.area)}));
  x.catalogo=(x.catalogo||[]).map(v=>Object.assign({},v,{sistema:dashSalaSistemaPorArea(v.area)}));
  return x;
};

// Persistir la columna Sistema sin alterar el resto del esquema existente.
const _dashDriveRowsV3=dashDriveRows;
dashDriveRows=function(area,rows){
  const out=_dashDriveRowsV3(area,rows);
  if(area==='wa')out.forEach((o,i)=>{o.Sistema=dashSalaSistema((rows||[])[i]);});
  return out;
};

// Cualquier histórico sin la nueva columna se clasifica por su Proceso / Área.
const _dashWADriveNormalizeV3=dashWADriveNormalize;
dashWADriveNormalize=function(raw){
  const x=_dashWADriveNormalizeV3(raw);
  const sysByKey=new Map();
  (raw||[]).forEach(o=>{
    const k=[dashCellText(o.VariableId??o.id),dashCellText(o['Reporte ID']??o.reporteId),dashCellText(o.Turno??o.turno),dashCellText(o['Equipo / Puesto']??o.equipo)].join('|');
    sysByKey.set(k,dashCellText(o.Sistema)||dashSalaSistemaPorArea(o['Proceso / Área']??o.area));
  });
  x.rows=(x.rows||[]).map(r=>{const k=[r.id,r.reporteId,r.turno,r.equipo].join('|');return Object.assign({},r,{sistema:sysByKey.get(k)||dashSalaSistemaPorArea(r.area)});});
  x.catalogo=(x.catalogo||[]).map(v=>Object.assign({},v,{sistema:dashSalaSistemaPorArea(v.area)}));
  return x;
};

function dashSalaRowsAll(){
  const a=waCfg('aire'),f=waCfg('frio');
  return [...(a&&a.data||[]),...(f&&f.data||[])].map(r=>Object.assign({},r,{sistema:dashSalaSistema(r)}));
}
function dashSalaCatalogoAll(){
  const a=waCfg('aire'),f=waCfg('frio'),m=new Map();
  [...(a&&a.catalogo||[]),...(f&&f.catalogo||[])].forEach(v=>{if(v&&v.id)m.set(v.id,Object.assign({},v,{sistema:dashCellText(v.sistema)||dashSalaSistemaPorArea(v.area)}));});
  return [...m.values()];
}
function dashSalaFechas(){return [...new Set(dashSalaRowsAll().map(r=>r.fecha).filter(Boolean))].sort();}
function dashSalaFechaActual(){
  const fs=dashSalaFechas(),a=waCfg('aire'),f=waCfg('frio'),candidate=(a&&a.fecha)||(f&&f.fecha);
  return candidate&&fs.includes(candidate)?candidate:(fs[fs.length-1]||null);
}
function dashSalaSetFecha(fecha){const a=waCfg('aire'),f=waCfg('frio');if(a)a.fecha=fecha;if(f)f.fecha=fecha;}
function dashSalaTurnRank(t){
  const x=dashCanonicalShift(t);
  return ({'07:00':0,'13:00':1,'19:00':2,'01:00':3,'06:00-18:00':4,'18:00-06:00':5,'General':6})[x]??9;
}
function dashSalaTurnLabel(t){
  const x=dashCanonicalShift(t);if(['07:00','13:00','19:00','01:00'].includes(x))return x;
  if(x==='06:00-18:00')return '06–18';if(x==='18:00-06:00')return '18–06';return x||'General';
}
function dashSalaSlotKey(r){return [dashCellText(r&&r.reporteId)||'SIN-REPORTE',dashCellText(r&&r.turno)||'General'].join('|');}
function dashSalaSlots(rows){
  const m=new Map();(rows||[]).forEach(r=>{const k=dashSalaSlotKey(r);if(!m.has(k))m.set(k,{key:k,reporteId:r.reporteId||'',turno:r.turno||'General',operador:r.operador||''});});
  return [...m.values()].sort((a,b)=>dashSalaTurnRank(a.turno)-dashSalaTurnRank(b.turno)||String(a.reporteId).localeCompare(String(b.reporteId),'es',{numeric:true}));
}
function dashSalaStats(rows){
  let crit=0,warn=0,ok=0,info=0;(rows||[]).forEach(r=>{const s=waEstadoClase(r);if(s==='crit')crit++;else if(s==='warn')warn++;else if(s==='ok')ok++;else info++;});
  const evals=crit+warn+ok;return{registros:(rows||[]).length,crit,warn,ok,info,pct:evals?ok/evals*100:0};
}
function dashSalaEstado(st){return waEstadoServicio({registradas:st.registros,crit:st.crit,warn:st.warn,ok:st.ok,info:st.info});}
function dashSalaDefMap(){const m=new Map();dashSalaCatalogoAll().forEach(v=>m.set(v.id,v));return m;}

function dashSalaPopulateFechas(){
  const fecha=dashSalaFechaActual();dashSalaSetFecha(fecha);const fechas=dashSalaFechas();
  ['aire-date-select','aire-summary-date-select'].forEach(id=>{
    let sel=document.getElementById(id);if(!sel)return;
    if(!sel.dataset.salaV3){const clone=sel.cloneNode(false);clone.id=sel.id;clone.className=sel.className;clone.setAttribute('aria-label',sel.getAttribute('aria-label')||'Fecha Sala de Compresores');sel.replaceWith(clone);sel=clone;sel.dataset.salaV3='1';sel.addEventListener('change',()=>{dashSalaSetFecha(sel.value);document.querySelectorAll('#aire-date-select,#aire-summary-date-select').forEach(s=>s.value=sel.value);pintarWA('aire');pintarValores();pintarEncabezado();pintarPrioridades();});}
    sel.innerHTML=fechas.map(f=>`<option value="${f}">${waFechaTxt(f,true)}</option>`).join('');sel.value=fecha||'';
  });
}

function dashSalaRenderUnificado(){
  dashSalaPopulateFechas();const fecha=dashSalaFechaActual(),all=dashSalaRowsAll(),rows=all.filter(r=>r.fecha===fecha),defs=dashSalaDefMap();
  const total=dashSalaStats(rows),et=dashSalaEstado(total);
  document.querySelectorAll('[data-aire-summary-count]').forEach(el=>el.textContent=String(total.registros));
  const pill=document.querySelector('[data-aire-summary-pill]');if(pill){pill.className='pill '+et.st;pill.innerHTML='<i></i>'+esc(et.txt);}
  const dot=document.querySelector('[data-tabst="aire"]');if(dot)dot.className='st '+(et.st==='ok'?'':et.st);

  const kpis=document.getElementById('aire-kpis-proceso');
  if(kpis)kpis.innerHTML=DASH_SALA_SYSTEMS.map(s=>{const sr=rows.filter(r=>dashSalaSistema(r)===s),st=dashSalaStats(sr),e=dashSalaEstado(st);return `<div class="kpi wa-process-kpi wa-aire-kpi"><div class="lbl"><span>${esc(s)}</span><span class="pill ${e.st}" style="margin-left:auto"><i></i>${esc(e.txt)}</span></div><div class="v tnum">${st.registros}<small>registros</small></div><div class="rng">${st.crit} críticas · ${st.warn} alertas · ${st.ok} normales</div><div class="ptar-progress"><i style="width:${st.pct.toFixed(1)}%"></i></div></div>`;}).join('');

  const sum=document.getElementById('aire-resumen-procesos');if(sum)sum.innerHTML=DASH_SALA_SYSTEMS.map(s=>{const st=dashSalaStats(rows.filter(r=>dashSalaSistema(r)===s)),e=dashSalaEstado(st);return `<div class="ptar-summary-process"><div class="ptar-summary-process-h"><strong>${esc(s)}</strong><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span></div><div class="ptar-summary-process-v"><b>${st.registros}</b> registros · ${st.crit+st.warn} prioritarios</div><div class="ptar-progress"><i style="width:${st.pct.toFixed(1)}%"></i></div></div>`;}).join('');

  const host=document.getElementById('aire-procesos');
  if(host)host.innerHTML=DASH_SALA_SYSTEMS.map((s,si)=>{
    const sr=rows.filter(r=>dashSalaSistema(r)===s),slots=dashSalaSlots(sr),st=dashSalaStats(sr),e=dashSalaEstado(st);
    if(!sr.length)return `<section class="card ptar-process-card wa-theme wa-aire-theme"><div class="card-h"><h3>${esc(s)}</h3><span class="pill idle"><i></i>Sin registros</span><span class="note">${fecha?waFechaTxt(fecha,true):'Sin fecha'}</span></div><div class="card-b"><p class="empty">No hay lecturas cargadas para este sistema en la fecha seleccionada.</p></div></section>`;
    const byEq=new Map();sr.forEach(r=>{const ek=r.equipo||'Sin equipo';if(!byEq.has(ek))byEq.set(ek,new Map());const vm=byEq.get(ek);if(!vm.has(r.id))vm.set(r.id,[]);vm.get(r.id).push(r);});
    const hs=slots.map(sl=>`<th class="num">${esc(dashSalaTurnLabel(sl.turno))}<small>${esc(sl.operador||'Sin operador')} · ${esc(sl.reporteId||'')}</small></th>`).join('');
    const trs=[...byEq.entries()].map(([eq,vm])=>{const vars=[...vm.entries()];return vars.map(([id,rr],vi)=>{const d=defs.get(id)||rr[0]||{},eqc=vi===0?`<td class="ptar-puesto" rowspan="${vars.length}">${esc(eq)}</td>`:'';const cells=slots.map(sl=>{const cand=rr.filter(r=>dashSalaSlotKey(r)===sl.key),r=cand.length?cand[cand.length-1]:null,cl=waEstadoClase(r);return `<td class="num ptar-lectura wa-cell ${cl}" title="${esc(r?waEstadoTxt(r):'Sin dato')}">${r?`${r.indicador?`<span class="wa-indicator">${esc(r.indicador)}</span> `:''}${esc(waValorTexto(r,true))}`:'—'}</td>`;}).join('');return `<tr>${eqc}<td>${esc(d.variable||rr[0].variable||'')}</td><td class="ptar-rango">${esc(waCriterio(d))}</td>${cells}</tr>`;}).join('');}).join('');
    return `<section class="card ptar-process-card wa-theme wa-aire-theme" aria-labelledby="sala-sys-${si}"><div class="card-h"><h3 id="sala-sys-${si}">${esc(s)}</h3><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span><span class="note">${waFechaTxt(fecha,true)} · ${st.registros} registros</span></div><div class="card-b ptar-table-wrap"><table class="tbl ptar-table wa-real-table"><thead><tr><th>Equipo</th><th>Variable</th><th>Criterio / rango disponible</th>${hs}</tr></thead><tbody>${trs}</tbody></table></div></section>`;
  }).join('');

  const dev=rows.filter(waEsPrioridad).sort((a,b)=>(waEstadoClase(a)==='crit'?0:1)-(waEstadoClase(b)==='crit'?0:1)||dashSalaSistema(a).localeCompare(dashSalaSistema(b),'es'));
  const dh=document.getElementById('aire-desviaciones'),dc=document.getElementById('aire-desv-count');if(dc)dc.textContent=dev.length?`${dev.length} detectada${dev.length===1?'':'s'}`:'ninguna';
  if(dh)dh.innerHTML=dev.length?dev.map(r=>`<div class="ptar-dev wa-dev ${waEstadoClase(r)}"><span class="bar" style="background:${waColorEstado(r)}"></span><div class="body"><div class="title">${esc(r.equipo)} · ${esc(r.variable)} · ${esc(waValorTexto(r,true))}</div><div class="meta">${esc(dashSalaSistema(r))} · ${esc(r.area||'')} · ${esc(waEstadoTxt(r))}</div>${r.observacion?`<div class="obs">${esc(r.observacion)}</div>`:''}</div><time>${esc(dashSalaTurnLabel(r.turno))}</time></div>`).join(''):`<p class="empty">No hay alertas ni condiciones fuera de servicio para ${fecha?waFechaTxt(fecha,true):'la fecha seleccionada'}.</p>`;
  const graphs=document.getElementById('aire-graficas-procesos');if(graphs){graphs.hidden=true;graphs.innerHTML='';}
}

// Sustituir la presentación de Aire por la vista única de los cuatro sistemas.
const _pintarWAV3=pintarWA;
pintarWA=function(tab){if(tab==='frio')return;if(tab==='aire')return dashSalaRenderUnificado();return _pintarWAV3(tab);};
const _waPoblarFechasV3=waPoblarFechas;
waPoblarFechas=function(tab){if(tab==='frio')return;if(tab==='aire')return dashSalaPopulateFechas();return _waPoblarFechasV3(tab);};

// Después de cargar Drive o fusionar datos locales, redibujar la vista combinada.
const _dashWAApplyAllV3=dashWAApplyAll;
dashWAApplyAll=function(raw,source){const x=_dashWAApplyAllV3(raw,source);try{dashSalaSetFecha(dashSalaFechaActual());dashSalaRenderUnificado();}catch(e){console.warn('Vista unificada Sala de Compresores',e);}return x;};
const _dashWAMergeLocalV3=dashWAMergeLocal;
dashWAMergeLocal=function(tab,incoming,catalogo,source){const x=_dashWAMergeLocalV3(tab,incoming,catalogo,source);try{dashSalaSetFecha(dashSalaFechaActual());dashSalaRenderUnificado();}catch(e){}return x;};

// Prioridades de la pestaña combinada = Aire + Refrigeración/NH3.
const _prioridadesTabV3=prioridadesTab;
prioridadesTab=function(tab){if(tab==='aire')return [...prioridadWA('aire'),...prioridadWA('frio')];if(tab==='frio')return [];return _prioridadesTabV3(tab);};

// Una sola vista real: v-frio siempre permanece oculta.
ir=function(id){
  if(id==='frio')id='aire';activa=id;
  document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===id)));
  document.querySelectorAll('.view').forEach(v=>{v.hidden=v.id!==('v-'+id);});
  const vf=document.getElementById('v-frio');if(vf)vf.hidden=true;
  pintarEncabezado();window.scrollTo(0,0);
  if(id==='ptab')pintarPtabr();else if(id==='suav')pintarSuav();else if(id==='vapor')pintarVapor();else if(id==='aire')dashSalaRenderUnificado();else if(id==='ptar')pintarPTAR();else pintarGraficas();
  pintarPrioridades();
};

// Diagnóstico claro si el /exec sigue apuntando a una versión anterior del backend.
const _dashDriveAppendWAV3=dashDriveAppendWA;
dashDriveAppendWA=async function(rows,catalogo,label='Sala de Compresores'){
  try{return await _dashDriveAppendWAV3(rows,catalogo,label);}catch(e){
    const msg=String(e&&e.message||e);if(/Área no válida|Area no valida/i.test(msg))throw new Error('El Apps Script publicado todavía no reconoce COMPRESORES_REFRIGERACION. Despliegue Code.gs V3.1 como NUEVA VERSIÓN y verifique que ?action=health muestre version V3.1-2026-09-22. Detalle: '+msg);throw e;
  }
};

// Sincronizar fecha y vista una vez que terminó de cargar el script.
setTimeout(()=>{try{dashSalaSetFecha(dashSalaFechaActual());dashSalaRenderUnificado();const vf=document.getElementById('v-frio');if(vf)vf.hidden=true;}catch(e){console.warn('Inicialización V3 Sala de Compresores',e);}},250);

const _pintarValoresSalaV3=pintarValores;
pintarValores=function(){
  _pintarValoresSalaV3();
  try{
    const fecha=dashSalaFechaActual(),st=dashSalaStats(dashSalaRowsAll().filter(r=>r.fecha===fecha)),e=dashSalaEstado(st),dot=document.querySelector('[data-tabst="aire"]');
    if(dot)dot.className='st '+(e.st==='ok'?'':e.st);
  }catch(err){}
};

/* =========================================================
   CORRECCIONES V4 · 23-09-2026
   - Parser exacto de la planilla Sala de Compresores (Hoja1).
   - Conserva los 4 sistemas, equipos y horarios 7AM/1PM/7PM/1AM.
   - La vista unificada muestra la estructura completa aunque una lectura esté vacía.
   - Escritura WA usa action=append_sala para no depender del alias de área.
   - Corrige temperaturas finales de CAV Gigante: valores E/I (no F/J).
   ========================================================= */
const DASH_SALA_V4_VERSION='V4-2026-09-23';
const DASH_SALA_V4_SYSTEMS=[
  'Sistema de Aire Comprimido',
  'Sistema de Refrigeracion NH3 Sala de Compresores',
  'Sistema de Refrigeracion NH3 AGUA HELADA',
  'Sistema de Refrigeracion NH3 CAV Gigante'
];
let DASH_SALA_TEMPLATE_CACHE_V4=null;

function dashSalaV4Id(group,row,variable,extra){
  return `sala_${group}_${row}_${salaSlug(variable)}_${extra||''}`.replace(/_+$/,'');
}
function dashSalaTemplateCatalogV4(){
  if(DASH_SALA_TEMPLATE_CACHE_V4)return DASH_SALA_TEMPLATE_CACHE_V4.map(x=>Object.assign({},x));
  const out=[];
  const def=(sistema,area,equipo,variable,row,group,extra,unidad='',slotMode='timed')=>{
    const id=dashSalaV4Id(group,row,variable,extra);
    out.push({id,area,equipo,variable,unidad,tipoDato:'',rango:'',criterio:'Registro de sala de compresores',sistema,slotMode,row});
    return id;
  };
  const AIR=DASH_SALA_V4_SYSTEMS[0], SALA=DASH_SALA_V4_SYSTEMS[1], AGUA=DASH_SALA_V4_SYSTEMS[2], CAVA=DASH_SALA_V4_SYSTEMS[3];

  // Sistema de Aire Comprimido
  [[11,'KAESER #1'],[13,'KAESER #2'],[15,'Ingersoll Rand #1'],[17,'Ingersoll Rand #2'],[19,'Atlas Copco #1'],[21,'Secador Kaeser #1'],[23,'Secador Kaeser #2']].forEach(([r,eq])=>{
    def(AIR,'Compresores Aire',eq,'Operación',r,'air','operacion','', 'timed');
    def(AIR,'Compresores Aire',eq,'Presión',r,'air','timed','psi','timed');
    def(AIR,'Compresores Aire',eq,'Corriente L1',r+1,'air','corr1','A','general');
    def(AIR,'Compresores Aire',eq,'Corriente L2',r+1,'air','corr2','A','general');
    def(AIR,'Compresores Aire',eq,'Corriente L3',r+1,'air','corr3','A','general');
  });
  ['Secador 1','Secador 2','Pulmon','Manifold'].forEach((v,i)=>def(AIR,'Trampas de Aire','Trampas de Condensado',v,25,'air',`p${i+1}`,'','general'));
  ['IR#1','IR#2','AC#1'].forEach((v,i)=>def(AIR,'Compresores Aire','Filtros',v,26,'air',`p${i+1}`,'','general'));
  def(AIR,'Compresores Aire','Red de aire','Presión del sistema',27,'air','timed','psi','timed');

  // Sistema NH3 Sala de Compresores
  [1,2,3,4,5,6].forEach((n,i)=>{
    const r=33+i*4,eq=`Compresor de Amoniaco SABROE #${n}`;
    def(SALA,'Compresores NH3',eq,'Presión de aspiración',r,'frio','timed','psi','timed');
    def(SALA,'Compresores NH3',eq,'Capacidad',r+1,'frio','timed','%','timed');
    def(SALA,'Compresores NH3',eq,'Temperatura de aceite',r+2,'frio','timed','°C','timed');
    def(SALA,'Compresores NH3',eq,'Corriente',r+3,'frio','timed','A','timed');
  });
  [1,2,3,4,5,6].forEach((n,i)=>{
    const r=60+i*3,eq=`CONDENSADOR EVAPORATIVO #${n}`;
    def(SALA,'Condensador/Evaporativo',eq,'Nivel de agua',r,'frio','timed','','timed');
    def(SALA,'Condensador/Evaporativo',eq,'Disponibilidad',r+1,'frio','timed','','timed');
    ['Condicion','Lubricacion','Correa','Alineacion'].forEach((v,j)=>def(SALA,'Condensador/Evaporativo',eq,v,r+2,'frio',`p${j+1}`,'','general'));
  });

  // Sistema NH3 Agua Helada
  [1,2,3,4].forEach((n,i)=>{
    const r=81+i,eq=`Banco de Hielo #${n}`;
    ['Sol Ent NH3','Sol Sal NH3','Nivel Agua','Observacion'].forEach((v,j)=>def(AGUA,'Banco de Hielo',eq,v,r,'frio',`p${j+1}`,'','general'));
  });
  def(AGUA,'UMAS Margarina','Chiller UMAs','Temperatura',87,'frio','timed','°C','timed');
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'UMAS Margarina','Sist Bomb 1 · Chiller UMAs',v,88,'frio',`p${j+1}`,'','general'));
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'UMAS Margarina','Sist Bomb 2 · Chiller UMAs',v,89,'frio',`p${j+1}`,'','general'));
  def(AGUA,'Fraccionamiento','C. FRACCIONAMIENTO','Temperatura',90,'frio','timed','°C','timed');
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'Fraccionamiento','Sist Bomb 1 · Fraccionamiento',v,91,'frio',`p${j+1}`,'','general'));
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'Fraccionamiento','Sist Bomb 2 · Fraccionamiento',v,92,'frio',`p${j+1}`,'','general'));
  def(AGUA,'Banco de Hielo','Formu. Mayonesa','Temperatura',93,'frio','timed','°C','timed');
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'Banco de Hielo','Sist Bomb 1 · Formu. Mayonesa',v,94,'frio',`p${j+1}`,'','general'));
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'Banco de Hielo','Sist Bomb 2 · Formu. Mayonesa',v,95,'frio',`p${j+1}`,'','general'));
  def(AGUA,'Banco de Hielo','RET. Formu. Mayonesa','Temperatura',96,'frio','timed','°C','timed');
  def(AGUA,'Banco de Hielo','Descarga Gandola Aceite','Temperatura',97,'frio','timed','°C','timed');
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'Banco de Hielo','Sist Bomb 1 · Descarga Gandola Aceite',v,98,'frio',`p${j+1}`,'','general'));
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'Banco de Hielo','Sist Bomb 2 · Descarga Gandola Aceite',v,99,'frio',`p${j+1}`,'','general'));
  def(AGUA,'Banco de Hielo','Formu. Margarina','Temperatura',100,'frio','timed','°C','timed');
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'Banco de Hielo','Sist Bomb 1 · Formu. Margarina',v,101,'frio',`p${j+1}`,'','general'));
  ['L1','L2','L3','Observacion'].forEach((v,j)=>def(AGUA,'Banco de Hielo','Sist Bomb 2 · Formu. Margarina',v,102,'frio',`p${j+1}`,'','general'));

  // Sistema NH3 CAV Gigante
  [[107,'Compresor NH3 SABROE #1 Cava Gigante'],[111,'Compresor NH3 SABROE #2 Cava Gigante']].forEach(([r,eq])=>{
    def(CAVA,'Cava Gigante',eq,'Capacidad',r,'frio','timed','%','timed');
    def(CAVA,'Cava Gigante',eq,'Presión de aspiración',r+1,'frio','timed','psi','timed');
    def(CAVA,'Cava Gigante',eq,'Nivel de aceite',r+2,'frio','timed','','timed');
    def(CAVA,'Cava Gigante',eq+' · Ref. Cabezal','Corriente',r+3,'frio','timed','A','timed');
  });
  def(CAVA,'Cava Gigante','CONDENSADOR EVAPORATIVO CG','Nivel de agua',115,'frio','timed','','timed');
  def(CAVA,'Cava Gigante','CONDENSADOR EVAPORATIVO CG','Disponibilidad',116,'frio','timed','','timed');
  ['Condicion','Lubricacion','Correa','Alineacion'].forEach((v,j)=>def(CAVA,'Cava Gigante','CONDENSADOR EVAPORATIVO CG',v,117,'frio',`p${j+1}`,'','general'));
  def(CAVA,'Cava Gigante','Difusor #1 CAVA GIGANTE','Presión tanque',118,'frio','timed','psi','timed');
  def(CAVA,'Cava Gigante','Difusor #1 CAVA GIGANTE','Motores operación',119,'frio','timed','','timed');
  def(CAVA,'Cava Gigante','Difusor #2 CAVA GIGANTE','Presión tanque',120,'frio','timed','psi','timed');
  def(CAVA,'Cava Gigante','Difusor #2 CAVA GIGANTE','Motores operación',121,'frio','timed','','timed');
  def(CAVA,'Cava Gigante','Temperatura Cava G','Temperatura',122,'frio','timed','°C','timed');
  [['Cava 2',124,'temp1'],['Cava de Tomate',124,'temp2'],['Cava de Queso',125,'temp1'],['Cava de Yema',125,'temp2'],['Cava 5',126,'temp1'],['Cava de Encimas',126,'temp2'],['Cava de Materia Prima',127,'temp1']].forEach(([eq,r,x])=>def(CAVA,'Cavas',eq,'Temperatura',r,'frio',x,'°C','general'));
  def(CAVA,'Cavas','Sala de Compresores','Observaciones generales',129,'frio','obs','','general');

  DASH_SALA_TEMPLATE_CACHE_V4=out;
  return out.map(x=>Object.assign({},x));
}

async function leerSalaCompresoresV4(buffer){
  const m=await dashLeerMatrizHoja(buffer,'Hoja1');
  const fecha=dashIsoDateStrict(m[1]&&m[1][10]);
  if(!fecha)throw new Error('No se pudo leer la fecha de la planilla Sala de Compresores (K2). Use dd/mm/aaaa.');
  const opDia=salaFirst(m,5,[4,5,6]),opNoche=salaFirst(m,5,[9,10,11]);
  const slots=[
    {col:5,turno:'07:00',orig:'7AM',op:opDia,tag:'0700'},
    {col:7,turno:'13:00',orig:'1PM',op:opDia,tag:'1300'},
    {col:9,turno:'19:00',orig:'7PM',op:opNoche,tag:'1900'},
    {col:11,turno:'01:00',orig:'1AM',op:opNoche,tag:'0100'}
  ];
  const rows=[],defs=dashSalaTemplateCatalogV4();
  const defMap=new Map(defs.map(d=>[d.id,d]));
  const add=(sistema,area,equipo,variable,value,opts={})=>{
    const id=opts.id||dashSalaV4Id(opts.group||'frio',opts.row||0,variable,opts.extra||'');
    if(!defMap.has(id)){
      const d={id,area,equipo,variable,unidad:opts.unidad||'',tipoDato:'',rango:'',criterio:'Registro de sala de compresores',sistema,slotMode:opts.slotMode||'timed',row:opts.row||0};
      defs.push(d);defMap.set(id,d);
    }
    if(!dashCellHas(value))return;
    const n=salaNum(value),txt=n===null?dashCellText(value):'',st=n===null?salaStatus(txt):{indicador:'',estado:'Sin indicador'};
    rows.push({
      fecha,confianzaFecha:'Fecha ingresada por operador',turno:opts.turno||'General',turnoOriginal:opts.turnoOriginal||opts.turno||'General',operador:opts.operador||'',
      reporteId:opts.reporteId||`SALA-${fecha.replace(/-/g,'')}-${opts.tag||'GEN'}`,area,equipo,variable,valor:n,texto:txt,unidad:opts.unidad||'',indicador:st.indicador,estado:st.estado,
      observacion:opts.observacion||'',linea:`Sala de Compresores · fila ${opts.row||''}`,id,tipoDato:n===null?'Texto':'Numérico',rango:'',criterio:'Registro de sala de compresores',sistema
    });
  };
  const timed=(sistema,area,equipo,variable,row,group='frio',unidad='',extra='timed')=>{
    slots.forEach(sl=>add(sistema,area,equipo,variable,m[row-1]&&m[row-1][sl.col-1],{group,row,extra,turno:sl.turno,turnoOriginal:sl.orig,operador:sl.op,reporteId:`SALA-${fecha.replace(/-/g,'')}-${sl.tag}`,tag:sl.tag,unidad,slotMode:'timed'}));
  };
  const generalPairs=(sistema,area,equipo,row,group='frio')=>{
    [[4,5],[6,7],[8,9],[10,11]].forEach(([lc,vc],i)=>{
      const lab=dashCellText(m[row-1]&&m[row-1][lc-1]);if(!lab)return;
      add(sistema,area,equipo,lab,m[row-1]&&m[row-1][vc-1],{group,row,extra:`p${i+1}`,turno:'General',turnoOriginal:'General',operador:i<2?opDia:opNoche,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN',slotMode:'general'});
    });
  };

  const AIR=DASH_SALA_V4_SYSTEMS[0], SALA=DASH_SALA_V4_SYSTEMS[1], AGUA=DASH_SALA_V4_SYSTEMS[2], CAVA=DASH_SALA_V4_SYSTEMS[3];

  // Aire comprimido: operación y presión en 7AM / 1PM / 7PM / 1AM.
  [[11,'KAESER #1'],[13,'KAESER #2'],[15,'Ingersoll Rand #1'],[17,'Ingersoll Rand #2'],[19,'Atlas Copco #1'],[21,'Secador Kaeser #1'],[23,'Secador Kaeser #2']].forEach(([r,eq])=>{
    [[4,'07:00','7AM',opDia,'0700'],[6,'13:00','1PM',opDia,'1300'],[8,'19:00','7PM',opNoche,'1900'],[10,'01:00','1AM',opNoche,'0100']].forEach(([c,t,o,op,tag])=>add(AIR,'Compresores Aire',eq,'Operación',m[r-1]&&m[r-1][c-1],{group:'air',row:r,extra:'operacion',turno:t,turnoOriginal:o,operador:op,reporteId:`SALA-${fecha.replace(/-/g,'')}-${tag}`,tag,slotMode:'timed'}));
    timed(AIR,'Compresores Aire',eq,'Presión',r,'air','psi','timed');
    const cr=r+1;[[5,6,'L1','corr1'],[7,8,'L2','corr2'],[9,10,'L3','corr3']].forEach(([lc,vc,ph,x])=>add(AIR,'Compresores Aire',eq,`Corriente ${ph}`,m[cr-1]&&m[cr-1][vc-1],{group:'air',row:cr,extra:x,turno:'General',turnoOriginal:'General',operador:opDia||opNoche,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN',unidad:'A',slotMode:'general'}));
  });
  generalPairs(AIR,'Trampas de Aire','Trampas de Condensado',25,'air');
  generalPairs(AIR,'Compresores Aire','Filtros',26,'air');
  timed(AIR,'Compresores Aire','Red de aire','Presión del sistema',27,'air','psi','timed');

  // Refrigeración NH3 · Sala de Compresores
  [1,2,3,4,5,6].forEach((n,i)=>{
    const r=33+i*4,eq=`Compresor de Amoniaco SABROE #${n}`;
    timed(SALA,'Compresores NH3',eq,'Presión de aspiración',r,'frio','psi','timed');
    timed(SALA,'Compresores NH3',eq,'Capacidad',r+1,'frio','%','timed');
    timed(SALA,'Compresores NH3',eq,'Temperatura de aceite',r+2,'frio','°C','timed');
    timed(SALA,'Compresores NH3',eq,'Corriente',r+3,'frio','A','timed');
  });
  [1,2,3,4,5,6].forEach((n,i)=>{
    const r=60+i*3,eq=`CONDENSADOR EVAPORATIVO #${n}`;
    timed(SALA,'Condensador/Evaporativo',eq,'Nivel de agua',r,'frio','','timed');
    timed(SALA,'Condensador/Evaporativo',eq,'Disponibilidad',r+1,'frio','','timed');
    generalPairs(SALA,'Condensador/Evaporativo',eq,r+2,'frio');
  });

  // Refrigeración NH3 · Agua Helada
  // Bancos de hielo: la plantilla tiene etiquetas D/F/H/J y valores E/G/I/K.
  // Se leen por coordenada fija para no depender de celdas combinadas, estilos o textos de etiqueta.
  [1,2,3,4].forEach((n,i)=>{
    const r=81+i,eq=`Banco de Hielo #${n}`;
    [
      ['Sol Ent NH3',5,'p1'],
      ['Sol Sal NH3',7,'p2'],
      ['Nivel Agua',9,'p3'],
      ['Observacion',11,'p4']
    ].forEach(([variable,col,extra])=>{
      add(AGUA,'Banco de Hielo',eq,variable,m[r-1]&&m[r-1][col-1],{group:'frio',row:r,extra,turno:'General',turnoOriginal:'General',operador:opDia||opNoche,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN',slotMode:'general'});
    });
  });
  timed(AGUA,'UMAS Margarina','Chiller UMAs','Temperatura',87,'frio','°C','timed');
  generalPairs(AGUA,'UMAS Margarina','Sist Bomb 1 · Chiller UMAs',88,'frio');
  generalPairs(AGUA,'UMAS Margarina','Sist Bomb 2 · Chiller UMAs',89,'frio');
  timed(AGUA,'Fraccionamiento','C. FRACCIONAMIENTO','Temperatura',90,'frio','°C','timed');
  generalPairs(AGUA,'Fraccionamiento','Sist Bomb 1 · Fraccionamiento',91,'frio');
  generalPairs(AGUA,'Fraccionamiento','Sist Bomb 2 · Fraccionamiento',92,'frio');
  timed(AGUA,'Banco de Hielo','Formu. Mayonesa','Temperatura',93,'frio','°C','timed');
  generalPairs(AGUA,'Banco de Hielo','Sist Bomb 1 · Formu. Mayonesa',94,'frio');
  generalPairs(AGUA,'Banco de Hielo','Sist Bomb 2 · Formu. Mayonesa',95,'frio');
  timed(AGUA,'Banco de Hielo','RET. Formu. Mayonesa','Temperatura',96,'frio','°C','timed');
  timed(AGUA,'Banco de Hielo','Descarga Gandola Aceite','Temperatura',97,'frio','°C','timed');
  generalPairs(AGUA,'Banco de Hielo','Sist Bomb 1 · Descarga Gandola Aceite',98,'frio');
  generalPairs(AGUA,'Banco de Hielo','Sist Bomb 2 · Descarga Gandola Aceite',99,'frio');
  timed(AGUA,'Banco de Hielo','Formu. Margarina','Temperatura',100,'frio','°C','timed');
  generalPairs(AGUA,'Banco de Hielo','Sist Bomb 1 · Formu. Margarina',101,'frio');
  generalPairs(AGUA,'Banco de Hielo','Sist Bomb 2 · Formu. Margarina',102,'frio');

  // Refrigeración NH3 · CAV Gigante
  [[107,'Compresor NH3 SABROE #1 Cava Gigante'],[111,'Compresor NH3 SABROE #2 Cava Gigante']].forEach(([r,eq])=>{
    timed(CAVA,'Cava Gigante',eq,'Capacidad',r,'frio','%','timed');
    timed(CAVA,'Cava Gigante',eq,'Presión de aspiración',r+1,'frio','psi','timed');
    timed(CAVA,'Cava Gigante',eq,'Nivel de aceite',r+2,'frio','','timed');
    timed(CAVA,'Cava Gigante',eq+' · Ref. Cabezal','Corriente',r+3,'frio','A','timed');
  });
  timed(CAVA,'Cava Gigante','CONDENSADOR EVAPORATIVO CG','Nivel de agua',115,'frio','','timed');
  timed(CAVA,'Cava Gigante','CONDENSADOR EVAPORATIVO CG','Disponibilidad',116,'frio','','timed');
  generalPairs(CAVA,'Cava Gigante','CONDENSADOR EVAPORATIVO CG',117,'frio');
  timed(CAVA,'Cava Gigante','Difusor #1 CAVA GIGANTE','Presión tanque',118,'frio','psi','timed');
  timed(CAVA,'Cava Gigante','Difusor #1 CAVA GIGANTE','Motores operación',119,'frio','','timed');
  timed(CAVA,'Cava Gigante','Difusor #2 CAVA GIGANTE','Presión tanque',120,'frio','psi','timed');
  timed(CAVA,'Cava Gigante','Difusor #2 CAVA GIGANTE','Motores operación',121,'frio','','timed');
  timed(CAVA,'Cava Gigante','Temperatura Cava G','Temperatura',122,'frio','°C','timed');

  // Temperaturas finales de CAV Gigante. La planilla usa bloques combinados:
  // D:E = nombre de cava, F:G = valor izquierdo; H:I = nombre, J:K = valor derecho.
  // Por eso los valores reales están en F/J (columnas 6/10), no en E/I.
  [
    [124,6,'Cava 2','temp1'],
    [124,10,'Cava de Tomate','temp2'],
    [125,6,'Cava de Queso','temp1'],
    [125,10,'Cava de Yema','temp2'],
    [126,6,'Cava 5','temp1'],
    [126,10,'Cava de Encimas','temp2'],
    [127,6,'Cava de Materia Prima','temp1']
  ].forEach(([r,vc,eq,x])=>{
    add(CAVA,'Cavas',eq,'Temperatura',m[r-1]&&m[r-1][vc-1],{group:'frio',row:r,extra:x,turno:'General',turnoOriginal:'General',operador:opDia||opNoche,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN',unidad:'°C',slotMode:'general'});
  });
  const obs=salaFirst(m,129,[4,5,6,7,8,9,10,11]);
  add(CAVA,'Cavas','Sala de Compresores','Observaciones generales',obs,{group:'frio',row:129,extra:'obs',turno:'General',turnoOriginal:'General',operador:opNoche||opDia,reporteId:`SALA-${fecha.replace(/-/g,'')}-GEN`,tag:'GEN',slotMode:'general'});

  if(!rows.length)throw new Error('La planilla no contiene ninguna lectura diligenciada.');
  return {rows,catalogo:defs,fecha};
}
leerSalaCompresores=leerSalaCompresoresV4;

function dashSalaTurnLabelV4(t){
  const c=dashCanonicalShift(t);return c==='07:00'?'7AM':c==='13:00'?'1PM':c==='19:00'?'7PM':c==='01:00'?'1AM':'General';
}
function dashSalaFixedSlotsV4(rows){
  const times=['07:00','13:00','19:00','01:00'];
  const opBy=new Map();
  (rows||[]).forEach(r=>{const t=dashCanonicalShift(r.turno);if(times.includes(t)&&r.operador&&!opBy.has(t))opBy.set(t,r.operador);});
  const out=times.map(t=>({key:t,turno:t,operador:opBy.get(t)||'',reporteId:''}));
  out.push({key:'General',turno:'General',operador:'',reporteId:''});
  return out;
}
function dashSalaDefsV4(system,systemRows){
  const m=new Map();
  dashSalaTemplateCatalogV4().filter(d=>d.sistema===system).forEach(d=>m.set(d.id,Object.assign({},d)));
  (systemRows||[]).forEach(r=>{
    if(!m.has(r.id))m.set(r.id,{id:r.id,area:r.area,equipo:r.equipo,variable:r.variable,unidad:r.unidad||'',tipoDato:r.tipoDato||'',rango:r.rango||'',criterio:r.criterio||'',sistema:dashSalaSistema(r),slotMode:r.turno==='General'?'general':'timed'});
  });
  return [...m.values()];
}
function dashSalaRowForSlotV4(rows,id,slot){
  const cand=(rows||[]).filter(r=>r.id===id&&(slot==='General'?String(r.turno||'').toLowerCase()==='general':dashCanonicalShift(r.turno)===slot));
  return cand.length?cand[cand.length-1]:null;
}

// Vista unificada exacta: siempre presenta los cuatro sistemas, sus equipos y las cuatro horas.
dashSalaRenderUnificado=function(){
  dashSalaPopulateFechas();
  const fecha=dashSalaFechaActual(),all=dashSalaRowsAll(),rows=all.filter(r=>r.fecha===fecha),total=dashSalaStats(rows),et=dashSalaEstado(total);
  document.querySelectorAll('[data-aire-summary-count]').forEach(el=>el.textContent=String(total.registros));
  const pill=document.querySelector('[data-aire-summary-pill]');if(pill){pill.className='pill '+et.st;pill.innerHTML='<i></i>'+esc(et.txt);}
  const dot=document.querySelector('[data-tabst="aire"]');if(dot)dot.className='st '+(et.st==='ok'?'':et.st);

  const summaryHtml=DASH_SALA_V4_SYSTEMS.map(s=>{const sr=rows.filter(r=>dashSalaSistema(r)===s),st=dashSalaStats(sr),e=dashSalaEstado(st);return `<div class="ptar-summary-process"><div class="ptar-summary-process-h"><strong>${esc(s)}</strong><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span></div><div class="ptar-summary-process-v"><b>${st.registros}</b> registros · ${st.crit+st.warn} prioritarios</div><div class="ptar-progress"><i style="width:${st.pct.toFixed(1)}%"></i></div></div>`;}).join('');
  const sum=document.getElementById('aire-resumen-procesos');if(sum)sum.innerHTML=summaryHtml;
  const kpis=document.getElementById('aire-kpis-proceso');if(kpis)kpis.innerHTML=DASH_SALA_V4_SYSTEMS.map(s=>{const st=dashSalaStats(rows.filter(r=>dashSalaSistema(r)===s)),e=dashSalaEstado(st);return `<div class="kpi wa-process-kpi wa-aire-kpi"><div class="lbl"><span>${esc(s)}</span><span class="pill ${e.st}" style="margin-left:auto"><i></i>${esc(e.txt)}</span></div><div class="v tnum">${st.registros}<small>registros</small></div><div class="rng">${st.crit} críticas · ${st.warn} alertas · ${st.ok} normales</div><div class="ptar-progress"><i style="width:${st.pct.toFixed(1)}%"></i></div></div>`;}).join('');

  const host=document.getElementById('aire-procesos');
  if(host)host.innerHTML=DASH_SALA_V4_SYSTEMS.map((s,si)=>{
    const sr=rows.filter(r=>dashSalaSistema(r)===s),defs=dashSalaDefsV4(s,sr),slots=dashSalaFixedSlotsV4(sr),st=dashSalaStats(sr),e=dashSalaEstado(st);
    const hs=slots.map(sl=>`<th class="num">${esc(dashSalaTurnLabelV4(sl.turno))}<small>${sl.operador?esc(sl.operador):'—'}</small></th>`).join('');
    const byEq=new Map();defs.forEach(d=>{const eq=d.equipo||'Sin equipo';if(!byEq.has(eq))byEq.set(eq,[]);byEq.get(eq).push(d);});
    const trs=[...byEq.entries()].map(([eq,ds])=>ds.map((d,vi)=>{
      const eqc=vi===0?`<td class="ptar-puesto" rowspan="${ds.length}">${esc(eq)}</td>`:'';
      const cells=slots.map(sl=>{const r=dashSalaRowForSlotV4(sr,d.id,sl.turno),cl=r?waEstadoClase(r):'idle';return `<td class="num ptar-lectura wa-cell ${cl}" title="${esc(r?waEstadoTxt(r):'Sin dato')}">${r?`${r.indicador?`<span class="wa-indicator">${esc(r.indicador)}</span> `:''}${esc(waValorTexto(r,true))}`:'—'}</td>`;}).join('');
      return `<tr>${eqc}<td>${esc(d.variable||'')}</td><td class="ptar-rango">${esc(waCriterio(d)||d.unidad||'—')}</td>${cells}</tr>`;
    }).join('')).join('');
    return `<section class="card ptar-process-card wa-theme wa-aire-theme" aria-labelledby="sala-v4-${si}"><div class="card-h"><h3 id="sala-v4-${si}">${esc(s)}</h3><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span><span class="note">${fecha?waFechaTxt(fecha,true):'Sin fecha'} · ${st.registros} registros</span></div><div class="card-b ptar-table-wrap"><table class="tbl ptar-table wa-real-table"><thead><tr><th>Equipo</th><th>Variable / operación</th><th>Unidad / criterio</th>${hs}</tr></thead><tbody>${trs}</tbody></table></div></section>`;
  }).join('');

  const dev=rows.filter(waEsPrioridad).sort((a,b)=>(waEstadoClase(a)==='crit'?0:1)-(waEstadoClase(b)==='crit'?0:1)||dashSalaSistema(a).localeCompare(dashSalaSistema(b),'es'));
  const dh=document.getElementById('aire-desviaciones'),dc=document.getElementById('aire-desv-count');if(dc)dc.textContent=dev.length?`${dev.length} detectada${dev.length===1?'':'s'}`:'ninguna';
  if(dh)dh.innerHTML=dev.length?dev.map(r=>`<div class="ptar-dev wa-dev ${waEstadoClase(r)}"><span class="bar" style="background:${waColorEstado(r)}"></span><div class="body"><div class="title">${esc(r.equipo)} · ${esc(r.variable)} · ${esc(waValorTexto(r,true))}</div><div class="meta">${esc(dashSalaSistema(r))} · ${esc(r.area||'')} · ${esc(waEstadoTxt(r))}</div>${r.observacion?`<div class="obs">${esc(r.observacion)}</div>`:''}</div><time>${esc(dashSalaTurnLabelV4(r.turno))}</time></div>`).join(''):`<p class="empty">No hay alertas ni condiciones fuera de servicio para ${fecha?waFechaTxt(fecha,true):'la fecha seleccionada'}.</p>`;
  const graphs=document.getElementById('aire-graficas-procesos');if(graphs)dashSalaRenderHistoricosV5(graphs);
};

// Escritura V4: acción explícita append_sala. El backend V4 fuerza el esquema WA aunque llegue un alias antiguo.
dashDriveAppendWA=async function(rows,catalogo,label='Sala de Compresores'){
  if(!rows||!rows.length)throw new Error('La planilla no contiene datos válidos para Sala de Compresores.');
  const key=dashDriveWriteKey();if(!key)throw new Error('No se ingresó la clave de actualización.');
  const enriched=rows.map(r=>{const d=(catalogo||[]).find(x=>x.id===r.id)||{};return Object.assign({},r,{sistema:r.sistema||d.sistema||dashSalaSistemaPorArea(r.area),tipoDato:r.tipoDato||d.tipoDato||((r.valor!==null&&r.valor!==undefined)?'Numérico':'Texto'),rango:r.rango||d.rango||'',criterio:r.criterio||d.criterio||'',unidad:r.unidad||d.unidad||''});});
  const fechas=[...new Set(enriched.map(r=>r.fecha).filter(Boolean))].sort(),focusDate=fechas[fechas.length-1]||null;
  let ans=null,postError=null;
  try{ans=await dashDriveRequest({action:'append_sala',key,area:'compresores_refrigeracion',rows:dashDriveRows('wa',enriched)});}catch(e){postError=e;console.warn('POST Sala V4 no confirmado; se intentará lectura de Drive.',e);}
  dashWAMergeLocal('aire',enriched,catalogo,'Carga operador · pendiente de confirmar Drive');
  dashWAMergeLocal('frio',enriched,catalogo,'Carga operador · pendiente de confirmar Drive');
  if(ans&&ans.data)dashDriveApplyMasterData(ans);
  let ok=!!(ans&&ans.data&&Array.isArray(ans.data.COMPRESORES_REFRIGERACION)),last=null;
  for(let i=0;i<6&&!ok;i++){
    if(i)await dashDriveSleep(650*i);
    try{const ra=await dashDriveRead({action:'read_master'});dashDriveApplyMasterData(ra);ok=Array.isArray(ra&&ra.data&&ra.data.COMPRESORES_REFRIGERACION);if(ok)ans=ans||ra;}catch(e){last=e;}
  }
  ['aire','frio'].forEach(a=>{const c=waCfg(a);if(focusDate&&c&&c.data.some(r=>r.fecha===focusDate))dashDriveFocusDate(a,focusDate);});
  try{dashSalaSetFecha(focusDate||dashSalaFechaActual());dashSalaRenderUnificado();}catch(e){}
  if(ok){dashDriveRefreshStatus('Drive sincronizado','ok');alert(`${label}: información guardada en Drive y dashboard sincronizado.${focusDate?` Fecha visible: ${focusDate}.`:''}`);return;}

  let health=null;
  try{health=await dashDriveRead({action:'health'},18000);}catch(e){}
  const hv=health&&health.version?health.version:'backend anterior o no identificable';
  const url=dashDriveApiUrl();
  dashDriveRefreshStatus('Backend Sala no actualizado','error');
  const detail=(last||postError);throw new Error(`No se pudo guardar la planilla Sala de Compresores en Drive. Backend detectado: ${hv}. El dashboard requiere ${DASH_SALA_V4_VERSION}. URL usada: ${url}.${detail?` Detalle: ${detail.message||detail}`:''}`);
};


/* =========================================================
   CORRECCIONES V5 · 23-09-2026
   - Lectura XLSX conserva las coordenadas de fila reales.
   - Bancos de Hielo: E/G/I/K se guardan siempre con variables fijas.
   - Temperaturas CAV Gigante: F/J se guardan con equipos fijos.
   - Históricos unificados por Sistema > Equipo > Variable.
   ========================================================= */
const DASH_SALA_V5_VERSION='V5-2026-09-23';
const DASH_SALA_HIST_SEL_V5=Object.create(null);

function dashSalaTabForDefV5(def){
  return WA_CFG.aire.areasPermitidas.includes(def&&def.area)?'aire':'frio';
}
function dashSalaHistoryKeyV5(system,equipment){return `${system}||${equipment}`;}
function dashSalaHistoryDefMapV5(){
  const m=new Map();
  dashSalaTemplateCatalogV4().forEach(d=>m.set(d.id,Object.assign({},d)));
  dashSalaCatalogoAll().forEach(d=>{if(d&&d.id)m.set(d.id,Object.assign({},m.get(d.id)||{},d,{sistema:dashCellText(d.sistema)||dashSalaSistemaPorArea(d.area)}));});
  return m;
}
function dashSalaRenderHistoricosV5(host){
  if(!host)return;
  host.hidden=false;
  const all=dashSalaRowsAll().filter(r=>r&&r.fecha),defMap=dashSalaHistoryDefMapV5();
  const systems=DASH_SALA_V4_SYSTEMS;
  if(!all.length){host.innerHTML='<div class="card"><div class="card-b"><p class="empty">Todavía no hay histórico fechado de Sala de Compresores.</p></div></div>';return;}

  host.innerHTML=systems.map((system,si)=>{
    const sr=all.filter(r=>dashSalaSistema(r)===system);
    const defs=[...defMap.values()].filter(d=>(d.sistema||dashSalaSistemaPorArea(d.area))===system);
    const byEq=new Map();
    defs.forEach(d=>{const eq=d.equipo||'Sin equipo';if(!byEq.has(eq))byEq.set(eq,[]);byEq.get(eq).push(d);});
    const fechas=[...new Set(sr.map(r=>r.fecha).filter(Boolean))].sort();
    const equipments=[...byEq.entries()].map(([eq,vars],ei)=>{
      vars=vars.slice().sort((a,b)=>String(a.variable).localeCompare(String(b.variable),'es',{numeric:true}));
      const key=dashSalaHistoryKeyV5(system,eq);
      let sel=DASH_SALA_HIST_SEL_V5[key]||'__all__';
      if(sel!=='__all__'&&!vars.some(v=>v.id===sel))sel='__all__';
      DASH_SALA_HIST_SEL_V5[key]=sel;
      const options=`<option value="__all__"${sel==='__all__'?' selected':''}>Todas las gráficas</option>`+vars.map(v=>`<option value="${esc(v.id)}"${sel===v.id?' selected':''}>${esc(v.variable)}</option>`).join('');
      const chosen=sel==='__all__'?vars:vars.filter(v=>v.id===sel);
      const cards=chosen.map(v=>{
        const tab=dashSalaTabForDefV5(v),rows=waRowsVar(tab,v.id,true),days=[...new Set(rows.map(r=>r.fecha).filter(Boolean))];
        return `<article class="ptar-history-var-card wa-history-card sala-v5-history-card"><div class="ptar-history-var-h"><div><strong>${esc(v.variable)}</strong><span>${esc(eq)}</span></div><span class="ptar-history-range">${v.unidad?esc(v.unidad):'Histórico'}</span></div><div class="ptar-history-var-meta"><span>${rows.length} lectura${rows.length===1?'':'s'} · ${days.length} día${days.length===1?'':'s'}</span></div><div class="ptar-history-chart" data-sala-v5-history="${esc(v.id)}"></div></article>`;
      }).join('');
      return `<div class="sala-v5-equipment-history"><div class="sala-v5-equipment-history-h"><div><h4>${esc(eq)}</h4><p>${vars.length} variable${vars.length===1?'':'s'} disponibles</p></div><label class="history-chart-selector">Gráfica a visualizar<select data-sala-v5-history-select="${esc(key)}">${options}</select></label></div><div class="ptar-history-grid ${sel==='__all__'?'':'is-single'}">${cards}</div></div>`;
    }).join('');
    return `<section class="card ptar-chart-process-card wa-theme wa-aire-theme sala-v5-system-history"><div class="card-h"><div><h3>${esc(system)}</h3><span class="ptar-process-chart-sub">Comportamiento histórico por equipo y variable · ${fechas.length} día${fechas.length===1?'':'s'} con registros</span></div></div><div class="card-b">${equipments||'<p class="empty">Sin variables configuradas.</p>'}</div></section>`;
  }).join('');

  host.querySelectorAll('[data-sala-v5-history]').forEach(el=>{
    const id=el.getAttribute('data-sala-v5-history'),def=defMap.get(id);if(!def)return;
    renderWAHistoricoCompleto(el,dashSalaTabForDefV5(def),def);
  });
  host.querySelectorAll('[data-sala-v5-history-select]').forEach(sel=>sel.addEventListener('change',()=>{
    DASH_SALA_HIST_SEL_V5[sel.dataset.salaV5HistorySelect]=sel.value;
    dashSalaRenderHistoricosV5(host);
  }));
}

// Verificación de persistencia: confirma que todas las filas recién cargadas existan realmente en Drive.
const _dashDriveAppendWAV5Base=dashDriveAppendWA;
dashDriveAppendWA=async function(rows,catalogo,label='Sala de Compresores'){
  if(!rows||!rows.length)throw new Error('La planilla no contiene datos válidos para Sala de Compresores.');
  const expected=rows.map(r=>[r.fecha,dashCanonicalShift(r.turno),r.reporteId,r.id].join('|'));
  await _dashDriveAppendWAV5Base(rows,catalogo,label);
  try{
    const ra=await dashDriveRead({action:'read_master'}),raw=ra&&ra.data&&ra.data.COMPRESORES_REFRIGERACION||[],norm=dashWADriveNormalize(raw).rows;
    const got=new Set(norm.map(r=>[r.fecha,dashCanonicalShift(r.turno),r.reporteId,r.id].join('|'))),missing=expected.filter(k=>!got.has(k));
    if(missing.length){
      const e=new Error(`Drive respondió, pero faltan ${missing.length} lectura(s) de la planilla por confirmar. Actualice Apps Script a ${DASH_SALA_V5_VERSION} y vuelva a cargar el archivo.`);e.code='PARTIAL_SAVE';throw e;
    }
  }catch(e){if(e&&e.code==='PARTIAL_SAVE')throw e;console.warn('No se pudo ejecutar verificación fina de Sala V5',e);}
  try{dashSalaRenderUnificado();}catch(e){}
};

// Redibujar usando la estructura completa de la planilla.
setTimeout(()=>{try{dashSalaRenderUnificado();const vf=document.getElementById('v-frio');if(vf)vf.hidden=true;}catch(e){console.warn('Sala V5',e);}},350);


/* =========================================================
   CORRECCIONES V6 · 23-09-2026
   - CAV Gigante: las temperaturas individuales se leen de F/J,
     respetando las celdas combinadas del formato del operador.
   - Filtros de visualización Sala de Compresores:
       Sistema: Todos / uno / ninguno.
       Equipo: Todos / uno / ninguno.
       Variables/gráficas: Todas / una / ninguna.
   ========================================================= */
const DASH_SALA_V6_VERSION='V6-2026-09-23';
const DASH_SALA_FILTER_V6={
  dailySystem:'__all__',
  dailyEquipment:Object.create(null),
  historySystem:'__all__',
  historyEquipment:Object.create(null),
  historyVariable:Object.create(null)
};

function dashSalaSelectOptionsV6(items,current,allLabel,noneLabel){
  let h=`<option value="__all__"${current==='__all__'?' selected':''}>${esc(allLabel)}</option>`+
        `<option value="__none__"${current==='__none__'?' selected':''}>${esc(noneLabel)}</option>`;
  h+=items.map(x=>`<option value="${esc(x)}"${current===x?' selected':''}>${esc(x)}</option>`).join('');
  return h;
}
function dashSalaValidChoiceV6(current,items){
  return current==='__all__'||current==='__none__'||items.includes(current)?current:'__all__';
}
function dashSalaSystemListV6(current){
  current=dashSalaValidChoiceV6(current,DASH_SALA_V4_SYSTEMS);
  if(current==='__none__')return [];
  return current==='__all__'?DASH_SALA_V4_SYSTEMS.slice():[current];
}

// Vista diaria unificada con filtro por sistema y equipo.
dashSalaRenderUnificado=function(){
  dashSalaPopulateFechas();
  const fecha=dashSalaFechaActual(),all=dashSalaRowsAll(),rows=all.filter(r=>r.fecha===fecha),total=dashSalaStats(rows),et=dashSalaEstado(total);
  document.querySelectorAll('[data-aire-summary-count]').forEach(el=>el.textContent=String(total.registros));
  const pill=document.querySelector('[data-aire-summary-pill]');if(pill){pill.className='pill '+et.st;pill.innerHTML='<i></i>'+esc(et.txt);}
  const dot=document.querySelector('[data-tabst="aire"]');if(dot)dot.className='st '+(et.st==='ok'?'':et.st);

  const summaryHtml=DASH_SALA_V4_SYSTEMS.map(s=>{const sr=rows.filter(r=>dashSalaSistema(r)===s),st=dashSalaStats(sr),e=dashSalaEstado(st);return `<div class="ptar-summary-process"><div class="ptar-summary-process-h"><strong>${esc(s)}</strong><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span></div><div class="ptar-summary-process-v"><b>${st.registros}</b> registros · ${st.crit+st.warn} prioritarios</div><div class="ptar-progress"><i style="width:${st.pct.toFixed(1)}%"></i></div></div>`;}).join('');
  const sum=document.getElementById('aire-resumen-procesos');if(sum)sum.innerHTML=summaryHtml;
  const kpis=document.getElementById('aire-kpis-proceso');if(kpis)kpis.innerHTML=DASH_SALA_V4_SYSTEMS.map(s=>{const st=dashSalaStats(rows.filter(r=>dashSalaSistema(r)===s)),e=dashSalaEstado(st);return `<div class="kpi wa-process-kpi wa-aire-kpi"><div class="lbl"><span>${esc(s)}</span><span class="pill ${e.st}" style="margin-left:auto"><i></i>${esc(e.txt)}</span></div><div class="v tnum">${st.registros}<small>registros</small></div><div class="rng">${st.crit} críticas · ${st.warn} alertas · ${st.ok} normales</div><div class="ptar-progress"><i style="width:${st.pct.toFixed(1)}%"></i></div></div>`;}).join('');

  const host=document.getElementById('aire-procesos');
  if(host){
    DASH_SALA_FILTER_V6.dailySystem=dashSalaValidChoiceV6(DASH_SALA_FILTER_V6.dailySystem,DASH_SALA_V4_SYSTEMS);
    const visibleSystems=dashSalaSystemListV6(DASH_SALA_FILTER_V6.dailySystem);
    const sysOptions=dashSalaSelectOptionsV6(DASH_SALA_V4_SYSTEMS,DASH_SALA_FILTER_V6.dailySystem,'Todos los sistemas','Ningún sistema');
    const toolbar=`<section class="card sala-v6-filter-card"><div class="card-h"><div><h3>Lecturas de Sala de Compresores</h3><span class="ptar-process-chart-sub">Filtra la vista por sistema y equipo sin modificar los datos guardados.</span></div><label class="history-chart-selector">Sistema a visualizar<select id="sala-v6-daily-system">${sysOptions}</select></label></div></section>`;
    const sections=visibleSystems.map((s,si)=>{
      const sr=rows.filter(r=>dashSalaSistema(r)===s),allDefs=dashSalaDefsV4(s,sr),slots=dashSalaFixedSlotsV4(sr),st=dashSalaStats(sr),e=dashSalaEstado(st);
      const eqNames=[...new Set(allDefs.map(d=>d.equipo||'Sin equipo'))];
      let eqSel=dashSalaValidChoiceV6(DASH_SALA_FILTER_V6.dailyEquipment[s]||'__all__',eqNames);DASH_SALA_FILTER_V6.dailyEquipment[s]=eqSel;
      const eqOptions=dashSalaSelectOptionsV6(eqNames,eqSel,'Todos los equipos','Ningún equipo');
      const defs=eqSel==='__none__'?[]:eqSel==='__all__'?allDefs:allDefs.filter(d=>(d.equipo||'Sin equipo')===eqSel);
      const hs=slots.map(sl=>`<th class="num">${esc(dashSalaTurnLabelV4(sl.turno))}<small>${sl.operador?esc(sl.operador):'—'}</small></th>`).join('');
      const byEq=new Map();defs.forEach(d=>{const eq=d.equipo||'Sin equipo';if(!byEq.has(eq))byEq.set(eq,[]);byEq.get(eq).push(d);});
      const trs=[...byEq.entries()].map(([eq,ds])=>ds.map((d,vi)=>{
        const eqc=vi===0?`<td class="ptar-puesto" rowspan="${ds.length}">${esc(eq)}</td>`:'';
        const cells=slots.map(sl=>{const r=dashSalaRowForSlotV4(sr,d.id,sl.turno),cl=r?waEstadoClase(r):'idle';return `<td class="num ptar-lectura wa-cell ${cl}" title="${esc(r?waEstadoTxt(r):'Sin dato')}">${r?`${r.indicador?`<span class="wa-indicator">${esc(r.indicador)}</span> `:''}${esc(waValorTexto(r,true))}`:'—'}</td>`;}).join('');
        return `<tr>${eqc}<td>${esc(d.variable||'')}</td><td class="ptar-rango">${esc(waCriterio(d)||d.unidad||'—')}</td>${cells}</tr>`;
      }).join('')).join('');
      return `<section class="card ptar-process-card wa-theme wa-aire-theme" aria-labelledby="sala-v6-day-${si}"><div class="card-h"><div><h3 id="sala-v6-day-${si}">${esc(s)}</h3><span class="note">${fecha?waFechaTxt(fecha,true):'Sin fecha'} · ${st.registros} registros</span></div><span class="pill ${e.st}"><i></i>${esc(e.txt)}</span><label class="history-chart-selector">Equipo a visualizar<select data-sala-v6-daily-equipment="${esc(s)}">${eqOptions}</select></label></div><div class="card-b ptar-table-wrap">${defs.length?`<table class="tbl ptar-table wa-real-table"><thead><tr><th>Equipo</th><th>Variable / operación</th><th>Unidad / criterio</th>${hs}</tr></thead><tbody>${trs}</tbody></table>`:'<p class="empty">No se seleccionó ningún equipo para este sistema.</p>'}</div></section>`;
    }).join('');
    host.innerHTML=toolbar+(sections||'<div class="card"><div class="card-b"><p class="empty">No se seleccionó ningún sistema para las lecturas del día.</p></div></div>');
    const sysSel=host.querySelector('#sala-v6-daily-system');if(sysSel)sysSel.addEventListener('change',()=>{DASH_SALA_FILTER_V6.dailySystem=sysSel.value;dashSalaRenderUnificado();});
    host.querySelectorAll('[data-sala-v6-daily-equipment]').forEach(sel=>sel.addEventListener('change',()=>{DASH_SALA_FILTER_V6.dailyEquipment[sel.dataset.salaV6DailyEquipment]=sel.value;dashSalaRenderUnificado();}));
  }

  const dev=rows.filter(waEsPrioridad).sort((a,b)=>(waEstadoClase(a)==='crit'?0:1)-(waEstadoClase(b)==='crit'?0:1)||dashSalaSistema(a).localeCompare(dashSalaSistema(b),'es'));
  const dh=document.getElementById('aire-desviaciones'),dc=document.getElementById('aire-desv-count');if(dc)dc.textContent=dev.length?`${dev.length} detectada${dev.length===1?'':'s'}`:'ninguna';
  if(dh)dh.innerHTML=dev.length?dev.map(r=>`<div class="ptar-dev wa-dev ${waEstadoClase(r)}"><span class="bar" style="background:${waColorEstado(r)}"></span><div class="body"><div class="title">${esc(r.equipo)} · ${esc(r.variable)} · ${esc(waValorTexto(r,true))}</div><div class="meta">${esc(dashSalaSistema(r))} · ${esc(r.area||'')} · ${esc(waEstadoTxt(r))}</div>${r.observacion?`<div class="obs">${esc(r.observacion)}</div>`:''}</div><time>${esc(dashSalaTurnLabelV4(r.turno))}</time></div>`).join(''):`<p class="empty">No hay alertas ni condiciones fuera de servicio para ${fecha?waFechaTxt(fecha,true):'la fecha seleccionada'}.</p>`;
  const graphs=document.getElementById('aire-graficas-procesos');if(graphs)dashSalaRenderHistoricosV5(graphs);
};

// Históricos con filtros jerárquicos Sistema > Equipo > Variable/valor.
dashSalaRenderHistoricosV5=function(host){
  if(!host)return;host.hidden=false;
  const all=dashSalaRowsAll().filter(r=>r&&r.fecha),defMap=dashSalaHistoryDefMapV5();
  if(!all.length){host.innerHTML='<div class="card"><div class="card-b"><p class="empty">Todavía no hay histórico fechado de Sala de Compresores.</p></div></div>';return;}
  DASH_SALA_FILTER_V6.historySystem=dashSalaValidChoiceV6(DASH_SALA_FILTER_V6.historySystem,DASH_SALA_V4_SYSTEMS);
  const visibleSystems=dashSalaSystemListV6(DASH_SALA_FILTER_V6.historySystem);
  const sysOptions=dashSalaSelectOptionsV6(DASH_SALA_V4_SYSTEMS,DASH_SALA_FILTER_V6.historySystem,'Todos los sistemas','Ningún sistema');
  const toolbar=`<section class="card sala-v6-filter-card"><div class="card-h"><div><h3>Comportamiento histórico</h3><span class="ptar-process-chart-sub">Selecciona todos, uno o ninguno en cada nivel: sistema, equipo y variable.</span></div><label class="history-chart-selector">Sistema a visualizar<select id="sala-v6-history-system">${sysOptions}</select></label></div></section>`;

  const sections=visibleSystems.map((system,si)=>{
    const sr=all.filter(r=>dashSalaSistema(r)===system);
    const defs=[...defMap.values()].filter(d=>(d.sistema||dashSalaSistemaPorArea(d.area))===system);
    const byEq=new Map();defs.forEach(d=>{const eq=d.equipo||'Sin equipo';if(!byEq.has(eq))byEq.set(eq,[]);byEq.get(eq).push(d);});
    const eqNames=[...byEq.keys()];
    let eqSel=dashSalaValidChoiceV6(DASH_SALA_FILTER_V6.historyEquipment[system]||'__all__',eqNames);DASH_SALA_FILTER_V6.historyEquipment[system]=eqSel;
    const eqOptions=dashSalaSelectOptionsV6(eqNames,eqSel,'Todos los equipos','Ningún equipo');
    const visibleEq=eqSel==='__none__'?[]:eqSel==='__all__'?eqNames:[eqSel];
    const fechas=[...new Set(sr.map(r=>r.fecha).filter(Boolean))].sort();
    const equipments=visibleEq.map(eq=>{
      let vars=(byEq.get(eq)||[]).slice().sort((a,b)=>String(a.variable).localeCompare(String(b.variable),'es',{numeric:true}));
      const key=dashSalaHistoryKeyV5(system,eq);
      let sel=dashSalaValidChoiceV6(DASH_SALA_FILTER_V6.historyVariable[key]||DASH_SALA_HIST_SEL_V5[key]||'__all__',vars.map(v=>v.id));
      DASH_SALA_FILTER_V6.historyVariable[key]=sel;DASH_SALA_HIST_SEL_V5[key]=sel;
      const options=`<option value="__all__"${sel==='__all__'?' selected':''}>Todas las gráficas</option><option value="__none__"${sel==='__none__'?' selected':''}>Ninguna gráfica</option>`+vars.map(v=>`<option value="${esc(v.id)}"${sel===v.id?' selected':''}>${esc(v.variable)}</option>`).join('');
      const chosen=sel==='__none__'?[]:sel==='__all__'?vars:vars.filter(v=>v.id===sel);
      const cards=chosen.map(v=>{
        const tab=dashSalaTabForDefV5(v),vr=waRowsVar(tab,v.id,true),days=[...new Set(vr.map(r=>r.fecha).filter(Boolean))];
        return `<article class="ptar-history-var-card wa-history-card sala-v5-history-card"><div class="ptar-history-var-h"><div><strong>${esc(v.variable)}</strong><span>${esc(eq)}</span></div><span class="ptar-history-range">${v.unidad?esc(v.unidad):'Histórico'}</span></div><div class="ptar-history-var-meta"><span>${vr.length} lectura${vr.length===1?'':'s'} · ${days.length} día${days.length===1?'':'s'}</span></div><div class="ptar-history-chart" data-sala-v6-history="${esc(v.id)}"></div></article>`;
      }).join('');
      return `<div class="sala-v5-equipment-history"><div class="sala-v5-equipment-history-h"><div><h4>${esc(eq)}</h4><p>${vars.length} variable${vars.length===1?'':'s'} disponibles</p></div><label class="history-chart-selector">Variables / valores<select data-sala-v6-history-variable="${esc(key)}">${options}</select></label></div><div class="ptar-history-grid ${sel==='__all__'?'':'is-single'}">${cards||'<p class="empty">No se seleccionó ninguna gráfica para este equipo.</p>'}</div></div>`;
    }).join('');
    return `<section class="card ptar-chart-process-card wa-theme wa-aire-theme sala-v5-system-history"><div class="card-h"><div><h3>${esc(system)}</h3><span class="ptar-process-chart-sub">${fechas.length} día${fechas.length===1?'':'s'} con registros</span></div><label class="history-chart-selector">Equipo a visualizar<select data-sala-v6-history-equipment="${esc(system)}">${eqOptions}</select></label></div><div class="card-b">${equipments||'<p class="empty">No se seleccionó ningún equipo para este sistema.</p>'}</div></section>`;
  }).join('');

  host.innerHTML=toolbar+(sections||'<div class="card"><div class="card-b"><p class="empty">No se seleccionó ningún sistema para el histórico.</p></div></div>');
  host.querySelectorAll('[data-sala-v6-history]').forEach(el=>{const id=el.getAttribute('data-sala-v6-history'),def=defMap.get(id);if(def)renderWAHistoricoCompleto(el,dashSalaTabForDefV5(def),def);});
  const sysSel=host.querySelector('#sala-v6-history-system');if(sysSel)sysSel.addEventListener('change',()=>{DASH_SALA_FILTER_V6.historySystem=sysSel.value;dashSalaRenderHistoricosV5(host);});
  host.querySelectorAll('[data-sala-v6-history-equipment]').forEach(sel=>sel.addEventListener('change',()=>{DASH_SALA_FILTER_V6.historyEquipment[sel.dataset.salaV6HistoryEquipment]=sel.value;dashSalaRenderHistoricosV5(host);}));
  host.querySelectorAll('[data-sala-v6-history-variable]').forEach(sel=>sel.addEventListener('change',()=>{DASH_SALA_FILTER_V6.historyVariable[sel.dataset.salaV6HistoryVariable]=sel.value;DASH_SALA_HIST_SEL_V5[sel.dataset.salaV6HistoryVariable]=sel.value;dashSalaRenderHistoricosV5(host);}));
};

setTimeout(()=>{try{dashSalaRenderUnificado();}catch(e){console.warn('Sala V6',e);}},450);


/* =========================================================
   ACTUALIZACIÓN V7 · 24-09-2026
   Nuevas variables:
   - VAPOR / Alimentación Calderas:
     vapor_59 Presión del desaireador <= 15 psi
     vapor_60 Temperatura del desaireador <= 104 °C
     vapor_61 Temperatura del Intercambiador <= 100 °C
   - PTAB / Tanque Subterráneo:
     ptab_40 Bomba 1
     ptab_41 Bomba 2
     ptab_42 Bomba 3
   PTAB se lee directamente desde "Carga diaria" para conservar también valores
   de texto en las bombas, sin depender de los valores cacheados de Control.
   ========================================================= */
const DASH_NEWVARS_V7_VERSION='V7-2026-09-24';

function dashEnsureNewVariablesV7(){
  const vapNew=[
    {id:'vapor_59',fila:null,proceso:'Alimentación Calderas',variable:'Presión del desaireador',frecuencia:'Diaria',rango:'≤ 15 psi',unidad:'psi',tipo:'max',min:null,max:15},
    {id:'vapor_60',fila:null,proceso:'Alimentación Calderas',variable:'Temperatura del desaireador',frecuencia:'Diaria',rango:'≤ 104 °C',unidad:'°C',tipo:'max',min:null,max:104},
    {id:'vapor_61',fila:null,proceso:'Alimentación Calderas',variable:'Temperatura del Intercambiador',frecuencia:'Diaria',rango:'≤ 100 °C',unidad:'°C',tipo:'max',min:null,max:100}
  ];
  let vp=VAPOR_PROCESOS.find(p=>p.nombre==='Alimentación Calderas');
  if(vp){
    vp.variables=vp.variables||[];
    const anchor=vp.variables.findIndex(v=>v.id==='vapor_08');
    vapNew.forEach((v,k)=>{
      if(vp.variables.some(x=>x.id===v.id))return;
      const pos=anchor>=0?anchor+1+k:vp.variables.length;
      vp.variables.splice(pos,0,v);
    });
  }

  const ptabNew=[
    {id:'ptab_40',proceso:'Agua cruda',puesto:'Tanque Subterráneo',variable:'Bomba 1',rango:'—',unidad:'',tipo:'none',min:null,max:null},
    {id:'ptab_41',proceso:'Agua cruda',puesto:'Tanque Subterráneo',variable:'Bomba 2',rango:'—',unidad:'',tipo:'none',min:null,max:null},
    {id:'ptab_42',proceso:'Agua cruda',puesto:'Tanque Subterráneo',variable:'Bomba 3',rango:'—',unidad:'',tipo:'none',min:null,max:null}
  ];
  const pp=PTABR_PROCESOS.find(p=>p.nombre==='Agua cruda');
  const tank=pp&&(pp.puestos||[]).find(e=>e.nombre==='Tanque Subterráneo');
  if(tank){
    tank.variables=tank.variables||[];
    ptabNew.forEach(v=>{if(!tank.variables.some(x=>x.id===v.id))tank.variables.push(v);});
  }
}
dashEnsureNewVariablesV7();

async function dashLeerFormatoPtabV7(buffer){
  const m=await dashLeerMatrizHoja(buffer,'Carga diaria');
  const fecha=dashIsoDateStrict(m[2]&&m[2][1]);
  if(!fecha)throw new Error('No se pudo leer la fecha de Carga diaria (celda B3). Use dd/mm/aaaa.');
  const op1=dashCellText(m[2]&&m[2][4]),op2=dashCellText(m[2]&&m[2][7]),out=[];
  for(let i=6;i<m.length;i++){
    const r=m[i]||[],id=dashCellText(r[9]);
    if(!id)continue;
    const def=ptabrDefPorId(id);
    if(!def)continue;
    [
      [5,6,'1er Turno','06:00 am',op1],
      [7,8,'2do Turno','06:00 pm',op2]
    ].forEach(([vc,oc,turno,hora,operador])=>{
      const raw=r[vc];
      if(!dashCellHas(raw))return;
      const num=ptabrNumeroLocal(raw);
      out.push({
        fecha,turno,hora,operador,
        proceso:def.proceso,puesto:def.puesto,variable:def.variable,rango:def.rango,
        valor:num,original:raw,unidad:def.unidad,tipo:def.tipo,min:def.min,max:def.max,
        estadoFuente:'',observacion:dashCellText(r[oc]),fuente:'Carga diaria operador',id:def.id
      });
    });
  }
  if(!out.length)throw new Error('La hoja Carga diaria no contiene lecturas PTAB.');
  return out;
}

cargarExcelPtabrArchivo=async function(file){
  try{
    dashEnsureNewVariablesV7();
    const norm=await dashLeerFormatoPtabV7(await file.arrayBuffer());
    await dashDriveAppend('ptab',norm,'PTAB');
  }catch(e){
    alert('PTAB: '+e.message);
    throw e;
  }
};

/* Vuelve a pintar catálogos/controles por si el navegador conservó un fallback anterior. */
setTimeout(()=>{
  try{
    dashEnsureNewVariablesV7();
    if(document.body&&document.body.dataset.dashboardReady==='1'){
      pintarPtabr();
      pintarVapor();
      if(typeof dashUiPopulateServiceControls==='function'){
        dashUiPopulateServiceControls('ptab');
        dashUiPopulateServiceControls('vapor');
      }
    }
  }catch(e){console.warn('Variables V7',e);}
},250);


/* =========================================================
   ACTUALIZACIÓN V8 · 24-09-2026
   Sistema de Enfriamiento UMA
   - Bombas Formulación: Temperatura 12-20 °C / Presión 40-120 psi
   - Bombas Envasado:    Temperatura 12-20 °C / Presión 40-120 psi
   - Lecturas 7AM, 1PM, 7PM y 1AM desde filas 132-135 de Hoja1.
   - Se integra como quinto sistema a los filtros, tablas e históricos
     de Compresores · Refrigeración · NH3.
   ========================================================= */
const DASH_SALA_V8_VERSION='V8-2026-09-24';
const DASH_SALA_UMA_SYSTEM='Sistema de Enfriamiento UMA';

if(!DASH_SALA_V4_SYSTEMS.includes(DASH_SALA_UMA_SYSTEM))DASH_SALA_V4_SYSTEMS.push(DASH_SALA_UMA_SYSTEM);
if(typeof DASH_SALA_SYSTEMS!=='undefined'&&Array.isArray(DASH_SALA_SYSTEMS)&&!DASH_SALA_SYSTEMS.includes(DASH_SALA_UMA_SYSTEM))DASH_SALA_SYSTEMS.push(DASH_SALA_UMA_SYSTEM);

const _dashSalaSistemaPorAreaV8=dashSalaSistemaPorArea;
dashSalaSistemaPorArea=function(area){
  const a=dashCellText(area);
  if(a==='Sistema de Enfriamiento UMA'||a==='Enfriamiento UMA'||a==='UMA')return DASH_SALA_UMA_SYSTEM;
  return _dashSalaSistemaPorAreaV8(area);
};

function dashUmaDefsV8(){
  return [
    {id:'sala_uma_132_temperatura_timed',area:'Sistema de Enfriamiento UMA',equipo:'Bombas Formulación',variable:'Temperatura',unidad:'°C',tipoDato:'Numérico',rango:'12 - 20 °C',criterio:'Rango operativo 12 - 20 °C',sistema:DASH_SALA_UMA_SYSTEM,slotMode:'timed',row:132},
    {id:'sala_uma_133_presion_timed',area:'Sistema de Enfriamiento UMA',equipo:'Bombas Formulación',variable:'Presión',unidad:'psi',tipoDato:'Numérico',rango:'40 - 120 psi',criterio:'Rango operativo 40 - 120 psi',sistema:DASH_SALA_UMA_SYSTEM,slotMode:'timed',row:133},
    {id:'sala_uma_134_temperatura_timed',area:'Sistema de Enfriamiento UMA',equipo:'Bombas Envasado',variable:'Temperatura',unidad:'°C',tipoDato:'Numérico',rango:'12 - 20 °C',criterio:'Rango operativo 12 - 20 °C',sistema:DASH_SALA_UMA_SYSTEM,slotMode:'timed',row:134},
    {id:'sala_uma_135_presion_timed',area:'Sistema de Enfriamiento UMA',equipo:'Bombas Envasado',variable:'Presión',unidad:'psi',tipoDato:'Numérico',rango:'40 - 120 psi',criterio:'Rango operativo 40 - 120 psi',sistema:DASH_SALA_UMA_SYSTEM,slotMode:'timed',row:135}
  ];
}

const _dashSalaTemplateCatalogV8=dashSalaTemplateCatalogV4;
dashSalaTemplateCatalogV4=function(){
  const out=_dashSalaTemplateCatalogV8();
  const ids=new Set(out.map(d=>d.id));
  dashUmaDefsV8().forEach(d=>{if(!ids.has(d.id)){out.push(Object.assign({},d));ids.add(d.id);}});
  return out;
};

function dashUmaRangeStateV8(value,min,max){
  const n=salaNum(value);
  if(n===null)return {valor:null,texto:dashCellText(value),indicador:'⚠️',estado:'Alerta'};
  const ok=n>=min&&n<=max;
  return {valor:n,texto:'',indicador:ok?'✅':'⛔',estado:ok?'Operativo / normal reportado':'Fuera de norma'};
}

const _leerSalaCompresoresV8=leerSalaCompresores;
leerSalaCompresores=async function(buffer){
  let base=null,baseError=null;
  try{base=await _leerSalaCompresoresV8(buffer);}catch(e){baseError=e;}
  const m=await dashLeerMatrizHoja(buffer,'Hoja1');
  const fecha=(base&&base.fecha)||dashIsoDateStrict(m[1]&&m[1][10]);
  if(!fecha)throw baseError||new Error('No se pudo leer la fecha de la planilla Sala de Compresores (K2). Use dd/mm/aaaa.');
  const opDia=salaFirst(m,5,[4,5,6]),opNoche=salaFirst(m,5,[9,10,11]);
  const slots=[
    {col:5,turno:'07:00',orig:'7AM',op:opDia,tag:'0700'},
    {col:7,turno:'13:00',orig:'1PM',op:opDia,tag:'1300'},
    {col:9,turno:'19:00',orig:'7PM',op:opNoche,tag:'1900'},
    {col:11,turno:'01:00',orig:'1AM',op:opNoche,tag:'0100'}
  ];
  const umaDefs=dashUmaDefsV8(),umaRows=[];
  umaDefs.forEach(def=>{
    const isTemp=def.variable==='Temperatura',min=isTemp?12:40,max=isTemp?20:120;
    slots.forEach(sl=>{
      const raw=m[def.row-1]&&m[def.row-1][sl.col-1];
      if(!dashCellHas(raw))return;
      const st=dashUmaRangeStateV8(raw,min,max);
      umaRows.push({
        fecha,confianzaFecha:'Fecha ingresada por operador',turno:sl.turno,turnoOriginal:sl.orig,operador:sl.op||'',
        reporteId:`SALA-${fecha.replace(/-/g,'')}-${sl.tag}`,area:def.area,equipo:def.equipo,variable:def.variable,
        valor:st.valor,texto:st.texto,unidad:def.unidad,indicador:st.indicador,estado:st.estado,observacion:'',
        linea:`Sala de Compresores · fila ${def.row}`,id:def.id,tipoDato:def.tipoDato,rango:def.rango,criterio:def.criterio,sistema:DASH_SALA_UMA_SYSTEM
      });
    });
  });
  if(baseError&&(!/ninguna lectura diligenciada|no contiene datos válidos/i.test(String(baseError.message||baseError)))&&!umaRows.length)throw baseError;
  const baseRows=(base&&base.rows)||[],baseCatalog=(base&&base.catalogo)||dashSalaTemplateCatalogV4();
  const catMap=new Map(baseCatalog.map(d=>[d.id,Object.assign({},d)]));
  umaDefs.forEach(d=>catMap.set(d.id,Object.assign({},catMap.get(d.id)||{},d)));
  const rows=[...baseRows.filter(r=>!String(r.id||'').startsWith('sala_uma_')),...umaRows];
  if(!rows.length)throw baseError||new Error('La planilla no contiene ninguna lectura diligenciada.');
  return {rows,catalogo:[...catMap.values()],fecha};
};

// La nueva área se guarda en la mitad de Refrigeración/NH3 del servicio unificado.
if(WA_CFG&&WA_CFG.frio&&Array.isArray(WA_CFG.frio.areasPermitidas)&&!WA_CFG.frio.areasPermitidas.includes('Sistema de Enfriamiento UMA')){
  WA_CFG.frio.areasPermitidas.push('Sistema de Enfriamiento UMA');
}

// Re-render para que el quinto sistema aparezca inmediatamente en los filtros.
setTimeout(()=>{try{dashSalaRenderUnificado();}catch(e){console.warn('Sala V8 · UMA',e);}},520);


/* =========================================================
   V10.2 · INVENTARIO QUÍMICO + GRÁFICAS + CARGA EXCEL · 27-09-2026
   Fuente normal: Google Drive / Base_Maestra_Dashboard / INVENTARIO_QUIMICO
   Respaldo: window.INVENTARIO_QUIMICO_FALLBACK
   ========================================================= */
let INVENTARIO_QUIMICO_ROWS = Array.isArray(window.INVENTARIO_QUIMICO_FALLBACK)
  ? invNormalize(window.INVENTARIO_QUIMICO_FALLBACK)
  : [];
let INVENTARIO_QUIMICO_SOURCE = INVENTARIO_QUIMICO_ROWS.length ? 'Respaldo local del inventario' : 'Sin datos';

function invText(v){return String(v===null||v===undefined?'':v).trim();}
function invNum(v){
  if(typeof v==='number'&&Number.isFinite(v))return v;
  let s=invText(v);if(!s)return null;
  s=s.replace(/\s/g,'').replace(/[^\d,.\-]/g,'');
  if(!s||s==='-'||s===','||s==='.')return null;
  const neg=s.startsWith('-'); if(neg)s=s.slice(1);
  if(s.includes(',')&&s.includes('.')){
    if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(/,/g,'');
  }else if(s.includes(',')){
    const p=s.split(',');
    if(p.length===2&&p[1].length<=2)s=p[0].replace(/\./g,'')+'.'+p[1];
    else s=s.replace(/,/g,'');
  }else if((s.match(/\./g)||[]).length>1){
    s=s.replace(/\./g,'');
  }else if(s.includes('.')){
    const p=s.split('.');
    if(p.length===2&&p[1].length===3&&p[0].length>=1)s=p[0]+p[1];
  }
  const n=Number((neg?'-':'')+s);return Number.isFinite(n)?n:null;
}
function invGet(o,names){
  for(const n of names){if(o&&Object.prototype.hasOwnProperty.call(o,n))return o[n];}
  return '';
}
function invNormalize(raw){
  return (raw||[]).map((o,i)=>({
    Categoria:invText(invGet(o,['Categoria','Categoría']))||'Productos químicos',
    Planta:invText(invGet(o,['Planta / Área','Planta','Area','Área'])),
    Quimico:invText(invGet(o,['Químico','Quimico','Quimico '])),
    Codigo:invText(invGet(o,['Código de Material','Codigo de Material','Código','Codigo'])),
    StockSegActual:invText(invGet(o,['Stock Seguridad Actual','Stock Seguridad'])),
    StockMaxActual:invText(invGet(o,['Stock Máximo Actual','Stock Maximo Actual'])),
    StockSegReq:invText(invGet(o,['Stock Seguridad Requerido','Stock de Seguridad Requerido'])),
    StockMaxReq:invText(invGet(o,['Stock Máximo Requerido','Stock Maximo Requerido'])),
    Disponibilidad:invText(invGet(o,['Disponibilidad (Almacén 0003)','Disponibilidad (Almacen 0003)','Disponibilidad'])),
    Solicitud:invText(invGet(o,['Solicitud de Pedido / Orden de Compra','Solicitud / OC','Solicitud de Pedido / Orden de Compra '])),
    FechaEstimada:invText(invGet(o,['Fecha Estimada'])),
    Observaciones:invText(invGet(o,['Observaciones'])),
    _i:i
  })).filter(r=>r.Quimico||r.Codigo);
}
function invStatus(r){
  const disp=invNum(r.Disponibilidad);
  const req=invNum(r.StockSegReq),act=invNum(r.StockSegActual);
  const ref=req!==null?req:act;
  if(disp!==null&&disp<0)return {key:'critical',label:'Stock negativo',reason:'Disponibilidad por debajo de 0'};
  if(disp!==null&&ref!==null&&disp<ref)return {key:'low',label:'Bajo stock',reason:'Por debajo del stock de seguridad'};
  if(disp!==null&&ref!==null)return {key:'ok',label:'Suficiente',reason:'En o sobre el stock de seguridad'};
  return {key:'review',label:'Revisar',reason:'Sin referencia comparable'};
}
function invEsc(s){return invText(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function invFilters(){
  const q=invText(document.getElementById('inv-search')?.value).toLowerCase();
  const cat=invText(document.getElementById('inv-category')?.value);
  const area=invText(document.getElementById('inv-area')?.value);
  const st=invText(document.getElementById('inv-status')?.value);
  return INVENTARIO_QUIMICO_ROWS.filter(r=>{
    const x=invStatus(r);
    if(q&&!(`${r.Quimico} ${r.Codigo} ${r.Planta}`.toLowerCase().includes(q)))return false;
    if(cat&&r.Categoria!==cat)return false;
    if(area&&r.Planta!==area)return false;
    if(st&&x.key!==st)return false;
    return true;
  });
}
function invPopulateSelect(id,values,label){
  const el=document.getElementById(id);if(!el)return;
  const old=el.value;
  el.innerHTML=`<option value="">${label}</option>`+[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).map(v=>`<option value="${invEsc(v)}">${invEsc(v)}</option>`).join('');
  if([...el.options].some(o=>o.value===old))el.value=old;
}
function invDateLabel(v){
  const s=invText(v);if(!s)return '';
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m)return `${m[3]}/${m[2]}/${m[1]}`;
  const m2=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m2)return `${('0'+m2[1]).slice(-2)}/${('0'+m2[2]).slice(-2)}/${m2[3]}`;
  return s;
}
function invChartValues(r){
  const safetyText=r.StockSegReq||r.StockSegActual||'';
  const maxText=r.StockMaxReq||r.StockMaxActual||'';
  return {
    safety:invNum(safetyText),
    max:invNum(maxText),
    available:invNum(r.Disponibilidad),
    safetyText:safetyText||'—',
    maxText:maxText||'—',
    availableText:r.Disponibilidad||'—'
  };
}
function invChartPct(v,scale){
  if(v===null||!Number.isFinite(v)||!scale)return 0;
  return Math.max(2,Math.min(100,Math.abs(v)/scale*100));
}
function invChartStatusRank(key){return ({critical:0,low:1,ok:2,review:3})[key]??4;}
function invRenderCharts(filtered){
  const grid=document.getElementById('inv-chart-grid');
  const summary=document.getElementById('inv-chart-summary');
  if(!grid)return;
  const mode=invText(document.getElementById('inv-chart-mode')?.value)||'all';
  let rows=[...(filtered||[])].sort((a,b)=>{
    const sa=invStatus(a),sb=invStatus(b);
    return invChartStatusRank(sa.key)-invChartStatusRank(sb.key)||a.Quimico.localeCompare(b.Quimico,'es');
  });
  if(mode==='attention')rows=rows.filter(r=>['critical','low'].includes(invStatus(r).key));
  else if(mode!=='all')rows=rows.filter(r=>invStatus(r).key===mode);

  const attention=rows.filter(r=>['critical','low'].includes(invStatus(r).key)).length;
  if(summary){
    const crit=rows.filter(r=>invStatus(r).key==='critical').length;
    const low=rows.filter(r=>invStatus(r).key==='low').length;
    summary.innerHTML=`<strong>${rows.length}</strong> químico${rows.length===1?'':'s'} en la vista`+
      (attention?` · <span>${attention} requieren atención</span> (${crit} con stock negativo · ${low} bajo el stock de seguridad). Se muestran primero.`:' · sin productos por debajo del stock mínimo en esta selección');
  }
  if(!rows.length){
    grid.innerHTML='<div class="inv-chart-empty">No hay productos para graficar con los filtros seleccionados.</div>';
    return;
  }

  grid.innerHTML=rows.map(r=>{
    const st=invStatus(r),v=invChartValues(r);
    const nums=[v.safety,v.max,v.available].filter(n=>n!==null&&Number.isFinite(n));
    const scale=Math.max(1,...nums.map(n=>Math.abs(n)));
    const deficit=(v.safety!==null&&v.available!==null&&v.available<v.safety)?v.safety-v.available:null;
    const arrival=invDateLabel(r.FechaEstimada);
    const needsAttention=st.key==='critical'||st.key==='low';
    const availableClass=st.key==='critical'?'negative':st.key==='low'?'low':'ok';
    const arrivalHtml=needsAttention
      ? `<div class="inv-arrival ${arrival?'has-date':'no-date'}"><span>${arrival?'Llegada estimada':'Fecha de llegada'}</span><strong>${invEsc(arrival||'Sin fecha registrada')}</strong>${r.Solicitud?`<small>Solicitud / OC: ${invEsc(r.Solicitud)}</small>`:''}</div>`
      : '';
    const deficitHtml=needsAttention&&deficit!==null
      ? `<div class="inv-deficit"><span>Falta para stock de seguridad</span><strong>${invEsc(String(+deficit.toFixed(3)))}</strong></div>`
      : '';
    const noData=nums.length<2?'<div class="inv-chart-nodata">Datos insuficientes para comparar las tres referencias.</div>':'';
    return `<article class="inv-chart-card ${needsAttention?'attention':''} ${st.key}" id="inv-chart-${r._i}" data-inv-chart-id="${r._i}">
      <div class="inv-chart-card-head">
        <div><h4>${invEsc(r.Quimico)}</h4><div class="note">${invEsc(r.Planta||'—')} · Código ${invEsc(r.Codigo||'—')}</div></div>
        <span class="inv-stock-badge ${st.key}">${invEsc(st.label)}</span>
      </div>
      <div class="inv-warehouse"><span>Disponible en almacén</span><strong>${invEsc(v.availableText)}</strong></div>
      <div class="inv-bars" role="img" aria-label="Stock de ${invEsc(r.Quimico)}: seguridad ${invEsc(v.safetyText)}, máximo ${invEsc(v.maxText)}, disponibilidad ${invEsc(v.availableText)}">
        <div class="inv-bar-row"><div class="inv-bar-label"><span>Stock seguridad</span><b>${invEsc(v.safetyText)}</b></div><div class="inv-bar-track"><i class="inv-bar-fill safety ${v.safety===null?'missing':''}" style="width:${invChartPct(v.safety,scale).toFixed(1)}%"></i></div></div>
        <div class="inv-bar-row"><div class="inv-bar-label"><span>Stock máximo</span><b>${invEsc(v.maxText)}</b></div><div class="inv-bar-track"><i class="inv-bar-fill maximum ${v.max===null?'missing':''}" style="width:${invChartPct(v.max,scale).toFixed(1)}%"></i></div></div>
        <div class="inv-bar-row"><div class="inv-bar-label"><span>Disponibilidad</span><b>${invEsc(v.availableText)}</b></div><div class="inv-bar-track"><i class="inv-bar-fill available ${availableClass} ${v.available===null?'missing':''}" style="width:${invChartPct(v.available,scale).toFixed(1)}%"></i></div></div>
      </div>
      ${noData}
      ${deficitHtml}
      ${arrivalHtml}
    </article>`;
  }).join('');
}

function pintarInventarioQuimico(){
  const rows=INVENTARIO_QUIMICO_ROWS;
  invPopulateSelect('inv-category',rows.map(r=>r.Categoria),'Todas');
  invPopulateSelect('inv-area',rows.map(r=>r.Planta),'Todas');
  const filtered=invFilters();
  const states=rows.map(r=>invStatus(r));
  const total=rows.length,withStock=rows.filter(r=>invNum(r.Disponibilidad)!==null).length;
  const low=states.filter(s=>s.key==='low').length,neg=states.filter(s=>s.key==='critical').length;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v);};
  set('inv-kpi-total',total);set('inv-kpi-stock',withStock);set('inv-kpi-low',low);set('inv-kpi-neg',neg);
  const note=document.getElementById('inv-source-note');if(note)note.textContent='Fuente · '+INVENTARIO_QUIMICO_SOURCE;
  const pill=document.getElementById('inv-count-pill');if(pill){pill.className='pill '+((low||neg)?'crit':'');pill.innerHTML=`<i></i>${filtered.length} de ${total}`;}

  // Las alertas separadas se eliminan para evitar duplicar información.
  // Las gráficas son ahora la vista prioritaria y ya resaltan stock bajo/negativo.


  invRenderCharts(filtered);

  const body=document.getElementById('inv-table-body');
  if(body){
    if(!filtered.length)body.innerHTML='<tr><td colspan="13" class="inv-empty">No hay productos que coincidan con los filtros seleccionados.</td></tr>';
    else body.innerHTML=filtered.map(r=>{
      const s=invStatus(r),cls=s.key==='critical'?'inv-row-critical':s.key==='low'?'inv-row-low':'';
      return `<tr class="${cls}">
        <td><span class="inv-stock-badge ${s.key}">${invEsc(s.label)}</span></td>
        <td>${invEsc(r.Categoria||'—')}</td><td>${invEsc(r.Planta||'—')}</td><td><strong>${invEsc(r.Quimico)}</strong></td>
        <td class="tnum">${invEsc(r.Codigo||'—')}</td><td>${invEsc(r.StockSegActual||'—')}</td><td>${invEsc(r.StockMaxActual||'—')}</td>
        <td>${invEsc(r.StockSegReq||'—')}</td><td>${invEsc(r.StockMaxReq||'—')}</td>
        <td class="tnum">${invEsc(r.Disponibilidad||'—')}</td><td>${invEsc(r.Solicitud||'—')}</td>
        <td>${invEsc(r.FechaEstimada||'—')}</td><td>${invEsc(r.Observaciones||'—')}</td>
      </tr>`;
    }).join('');
  }
  const dot=document.querySelector('[data-tabst="inventario"]');
  if(dot)dot.className='st '+((neg||low)?'crit':'');
}
function cargarInventarioDesdeDrive(raw,source='Google Drive · Base Maestra · INVENTARIO_QUIMICO'){
  if(!Array.isArray(raw))return false;
  const norm=invNormalize(raw);
  if(!norm.length)return false;
  INVENTARIO_QUIMICO_ROWS=norm;INVENTARIO_QUIMICO_SOURCE=source;
  pintarInventarioQuimico();return true;
}

const INV_EXCEL_HEADERS = [
  'Categoria','Planta / Área','Químico','Código de Material','Stock Seguridad Actual','Stock Máximo Actual',
  'Stock Seguridad Requerido','Stock Máximo Requerido','Disponibilidad (Almacén 0003)',
  'Solicitud de Pedido / Orden de Compra','Fecha Estimada','Observaciones'
];
function invHeaderKey(v){return invText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function invCanonicalHeader(v){
  const k=invHeaderKey(v);
  const map={
    'categoria':'Categoria','categoría':'Categoria',
    'planta / area':'Planta / Área','planta / área':'Planta / Área','planta':'Planta / Área','area':'Planta / Área','área':'Planta / Área',
    'quimico':'Químico','químico':'Químico',
    'codigo de material':'Código de Material','código de material':'Código de Material','codigo':'Código de Material','código':'Código de Material',
    'stock seguridad actual':'Stock Seguridad Actual','stock de seguridad actual':'Stock Seguridad Actual',
    'stock maximo actual':'Stock Máximo Actual','stock máximo actual':'Stock Máximo Actual',
    'stock seguridad requerido':'Stock Seguridad Requerido','stock de seguridad requerido':'Stock Seguridad Requerido',
    'stock maximo requerido':'Stock Máximo Requerido','stock máximo requerido':'Stock Máximo Requerido',
    'disponibilidad (almacen 0003)':'Disponibilidad (Almacén 0003)','disponibilidad (almacén 0003)':'Disponibilidad (Almacén 0003)','disponibilidad':'Disponibilidad (Almacén 0003)',
    'solicitud de pedido / orden de compra':'Solicitud de Pedido / Orden de Compra','solicitud / oc':'Solicitud de Pedido / Orden de Compra',
    'fecha estimada':'Fecha Estimada','observaciones':'Observaciones'
  };
  return map[k]||'';
}
function invExcelDate(v){
  if(v===null||v===undefined||v==='')return '';
  if(typeof v==='number'&&Number.isFinite(v)){
    const d=new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000);
    return d.toISOString().slice(0,10);
  }
  const s=invText(v);
  if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
  const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
  if(m){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;}
  return s;
}
function invEsCategoriaOriginal_(v){
  const k=invHeaderKey(v);
  if(!k)return '';
  if(k.includes('reactivos')&&k.includes('laboratorio'))return 'REACTIVOS (LABORATORIO)';
  if(k.includes('lubricacion')&&k.includes('compresores'))return 'LUBRICACIÓN (COMPRESORES AMONIACO Y AIRE)';
  return '';
}
function invLeerFormatoOriginal_(rows){
  // Formato oficial: "Inventario de Quimicos Servicios a Planta SyU.xlsx".
  // Encabezado principal en una fila y subencabezados de Stock Seguridad / Stock Máximo
  // en la fila siguiente. Las áreas y categorías se heredan hacia abajo cuando Excel
  // deja sus celdas vacías.
  let hrow=-1;
  for(let i=0;i<Math.min(rows.length,35);i++){
    const rr=rows[i]||[];
    const a=invHeaderKey(rr[0]),b=invHeaderKey(rr[1]),c=invHeaderKey(rr[2]),h=invHeaderKey(rr[7]);
    if(a==='planta'&&b==='quimico'&&c==='codigo de material'&&h.includes('disponibilidad')){hrow=i;break;}
  }
  if(hrow<0)return null;
  const out=[];
  let categoria='PRODUCTOS QUÍMICOS', area='';
  for(let i=hrow+2;i<rows.length;i++){
    const rr=rows[i]||[];
    const colA=invText(rr[0]),quimico=invText(rr[1]),codigo=invText(rr[2]);
    const cat=invEsCategoriaOriginal_(colA);
    if(cat&&!quimico&&!codigo){categoria=cat;area='';continue;}
    if(!quimico&&!codigo)continue;
    if(colA)area=colA;
    const item={
      'Categoria':categoria,
      'Planta / Área':area,
      'Químico':quimico,
      'Código de Material':codigo,
      'Stock Seguridad Actual':rr[3]===undefined||rr[3]===null?'':rr[3],
      'Stock Máximo Actual':rr[4]===undefined||rr[4]===null?'':rr[4],
      'Stock Seguridad Requerido':rr[5]===undefined||rr[5]===null?'':rr[5],
      'Stock Máximo Requerido':rr[6]===undefined||rr[6]===null?'':rr[6],
      'Disponibilidad (Almacén 0003)':rr[7]===undefined||rr[7]===null?'':rr[7],
      'Solicitud de Pedido / Orden de Compra':rr[8]===undefined||rr[8]===null?'':rr[8],
      'Fecha Estimada':invExcelDate(rr[9]),
      'Observaciones':rr[10]===undefined||rr[10]===null?'':rr[10]
    };
    out.push(item);
  }
  return out.length?out:null;
}
async function invLeerExcel(buffer){
  const zip=await abrirZipPTAR(buffer),parser=new DOMParser();
  const wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml');
  const relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml');
  const rels=[...relXml.getElementsByTagNameNS('*','Relationship')];
  let shared=[];
  if(zip.entries.has('xl/sharedStrings.xml')){
    const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');
    shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));
  }
  const sheets=[...wbXml.getElementsByTagNameNS('*','sheet')];
  const preferred=['Inventario de quimicos','Inventario de Quimicos','Inventario Quimico','Inventario','Actualización Inventario','Actualizacion Inventario','INVENTARIO_QUIMICO'];
  let sheet=null;
  for(const n of preferred){sheet=sheets.find(x=>x.getAttribute('name')===n);if(sheet)break;}
  if(!sheet)sheet=sheets[0];
  if(!sheet)throw new Error('El archivo no contiene hojas para leer.');
  const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id');
  const rel=rels.find(r=>r.getAttribute('Id')===rid);if(!rel)throw new Error('No se pudo resolver la hoja del inventario.');
  let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');
  const rows=await leerHojaXLSXPTAR(zip,target,shared);

  // Primero intenta el formato oficial original de Servicios a Planta SyU.
  const original=invLeerFormatoOriginal_(rows);
  if(original&&original.length)return original;

  // Compatibilidad con el formato tabular simplificado de versiones anteriores.
  let hrow=-1,headerMap=[];
  for(let i=0;i<Math.min(rows.length,30);i++){
    const rr=rows[i]||[];const mapped=rr.map(invCanonicalHeader);
    if(mapped.includes('Químico')&&mapped.includes('Código de Material')&&mapped.includes('Disponibilidad (Almacén 0003)')){hrow=i;headerMap=mapped;break;}
  }
  if(hrow<0)throw new Error('No se reconoció la estructura del inventario. Use el archivo oficial "Inventario de Quimicos Servicios a Planta SyU.xlsx".');
  const out=[];
  for(let i=hrow+1;i<rows.length;i++){
    const rr=rows[i]||[],o={};
    headerMap.forEach((h,j)=>{if(h)o[h]=rr[j]===undefined||rr[j]===null?'':rr[j];});
    if(!invText(o['Químico'])&&!invText(o['Código de Material']))continue;
    const item={};INV_EXCEL_HEADERS.forEach(h=>item[h]=o[h]===undefined||o[h]===null?'':o[h]);
    item['Fecha Estimada']=invExcelDate(item['Fecha Estimada']);
    out.push(item);
  }
  if(!out.length)throw new Error('El archivo no contiene productos de inventario para actualizar.');
  return out;
}
async function invReemplazarDrive(rows,fileName='archivo seleccionado'){
  const key=dashDriveWriteKey();if(!key)throw new Error('No se ingresó la clave de actualización.');
  if(!confirm(`Se actualizará la hoja INVENTARIO_QUIMICO de Drive con ${rows.length} productos del archivo "${fileName}". ¿Desea continuar?`))return false;
  const payload={action:'replace_inventory',key,rows};
  let ans=null,postError=null;
  try{ans=await dashDriveRequest(payload);}catch(err){postError=err;console.warn('Inventario: POST enviado; se confirmará leyendo Drive.',err);}
  if(ans&&ans.data)dashDriveApplyMasterData(ans,'inventario',null);
  let ok=false,lastReadError=null;
  for(let intento=0;intento<6&&!ok;intento++){
    if(intento)await dashDriveSleep(700*intento);
    try{
      const readAns=await dashDriveRead({action:'read_master'});
      const raw=readAns&&readAns.data&&readAns.data.INVENTARIO_QUIMICO;
      if(Array.isArray(raw)&&raw.length){cargarInventarioDesdeDrive(raw);ok=true;break;}
    }catch(err){lastReadError=err;}
  }
  if(ok){dashDriveRefreshStatus('Inventario sincronizado','ok');alert(`Inventario Químico: ${rows.length} productos guardados en Drive y dashboard actualizado.`);return true;}
  dashDriveRefreshStatus('Inventario pendiente de confirmar','error');
  const e=lastReadError||postError;throw new Error('La actualización fue enviada, pero no se pudo confirmar la lectura desde Drive.'+(e?' Detalle: '+(e.message||e):''));
}
async function invCargarArchivo(file){
  const rows=await invLeerExcel(await file.arrayBuffer());
  return invReemplazarDrive(rows,file.name);
}
document.addEventListener('change',async e=>{
  const input=e.target;if(!input||input.id!=='inv-excel-input')return;
  const file=input.files&&input.files[0];if(!file)return;
  try{await invCargarArchivo(file);}catch(err){alert('Inventario Químico: '+err.message);console.error(err);}finally{input.value='';}
});

['inv-search','inv-category','inv-area','inv-status','inv-chart-mode'].forEach(id=>{
  document.addEventListener('input',e=>{if(e.target&&e.target.id===id)pintarInventarioQuimico();});
  document.addEventListener('change',e=>{if(e.target&&e.target.id===id)pintarInventarioQuimico();});
});



const _dashDriveApplyMasterDataV10Inv=dashDriveApplyMasterData;
dashDriveApplyMasterData=function(ans,focusArea=null,focusDate=null){
  const base=_dashDriveApplyMasterDataV10Inv(ans,focusArea,focusDate);
  try{
    const raw=ans&&ans.data&&ans.data.INVENTARIO_QUIMICO;
    if(Array.isArray(raw))cargarInventarioDesdeDrive(raw);
  }catch(e){
    console.error('Drive: no se pudo aplicar INVENTARIO_QUIMICO',e);
    window.__DASH_DRIVE_LAST_APPLY_ERRORS=[...(window.__DASH_DRIVE_LAST_APPLY_ERRORS||[]),'INVENTARIO_QUIMICO: '+e.message];
  }
  return base;
};

setTimeout(()=>{try{pintarInventarioQuimico();}catch(e){console.warn('Inventario químico',e);}},120);

/* =========================================================
   24. LISTA DE VERIFICADOS · CHECKLIST VAPOR Y CONDENSADO
   Fuente maestra: Google Drive / LISTA_VERIFICADOS
   ========================================================= */
const VERIF_AREAS = ['QUESO','TOMATE','MAYONESA','MANIFOLD','MARGARINA'];
const VERIF_FIELDS = ['Condicion Fuga','Condicion by pass','Condicion Manometros','Condicion Aislamiento','Condicion Seguridad'];
const VERIF_HEADERS = ['Registro ID','Fecha','Turno','Supervisor','Operador','Área','Punto / Equipo','Condicion Fuga','Condicion by pass','Condicion Manometros','Condicion Aislamiento','Condicion Seguridad','#Aviso B1','Observacion Operador','Archivo origen','Fecha de carga'];
let LISTA_VERIFICADOS_ROWS = Array.isArray(window.LISTA_VERIFICADOS_FALLBACK) ? window.LISTA_VERIFICADOS_FALLBACK.slice() : [];
let LISTA_VERIFICADOS_SOURCE = LISTA_VERIFICADOS_ROWS.length ? 'Respaldo local' : 'Google Drive · sin registros';
SERVICIOS.verificados={nom:'Lista de Verificados',sub:'Checklist Vapor y Condensado · Queso, Tomate, Mayonesa, Manifold y Margarina',color:'#1E63C8',corto:'Checklist Vapor y Condensado',kpi:null,keys:[]};
const VERIF_PAGE_SIZE = 10;
let VERIF_PAGE = 1;
let VERIF_PAGE_ANIM_DIR = 0;

/* Referencias visuales extraídas de DIAGRAMAS CONDENSADO PLANTA SALSAS Y UNTABLES.pdf. */
const VERIF_PHOTOS = [
  {area:'QUESO',point:'Linea Alimentacion',src:'referencias_condensado/queso_linea_alimentacion.jpg',label:'Queso · Línea Alimentación',page:1},
  {area:'QUESO',point:'Linea Cocina 1',src:'referencias_condensado/queso_cocina_1.jpg',label:'Queso · Cocina 1',page:2},
  {area:'QUESO',point:'Linea Vapor Alimentacion',src:'referencias_condensado/queso_cocina_1.jpg',label:'Queso · Cocina 1 · Vapor / condensado',page:2},
  {area:'QUESO',point:'Linea Vapor Alimentacion',src:'referencias_condensado/queso_cocina_2.jpg',label:'Queso · Cocina 2 · Vapor / condensado',page:3},
  {area:'QUESO',point:'Linea de condensado #1 entrada vapor',src:'referencias_condensado/queso_cocina_1.jpg',label:'Queso · Cocina 1 · Línea condensado #1',page:2},
  {area:'QUESO',point:'Linea de condensado #1 entrada vapor',src:'referencias_condensado/queso_cocina_2.jpg',label:'Queso · Cocina 2 · Línea condensado #1',page:3},
  {area:'QUESO',point:'Linea de condensado #2 Filtro',src:'referencias_condensado/queso_cocina_1.jpg',label:'Queso · Cocina 1 · Línea condensado #2',page:2},
  {area:'QUESO',point:'Linea de condensado #2 Filtro',src:'referencias_condensado/queso_cocina_2.jpg',label:'Queso · Cocina 2 · Línea condensado #2',page:3},
  {area:'QUESO',point:'Linea de condensado #3 Cocina',src:'referencias_condensado/queso_cocina_1.jpg',label:'Queso · Cocina 1 · Línea condensado #3',page:2},
  {area:'QUESO',point:'Linea de condensado #3 Cocina',src:'referencias_condensado/queso_cocina_2.jpg',label:'Queso · Cocina 2 · Línea condensado #3',page:3},
  {area:'QUESO',point:'Linea Cocina 2',src:'referencias_condensado/queso_cocina_2.jpg',label:'Queso · Cocina 2',page:3},
  {area:'QUESO',point:'Intercambiador CIP',src:'referencias_condensado/queso_intercambiador_cip.jpg',label:'Queso · Intercambiador CIP',page:4},
  {area:'QUESO',point:'Fase Oleosa',src:'referencias_condensado/queso_fase_oleosa.jpg',label:'Queso · Fase Oleosa',page:5},
  {area:'QUESO',point:'Tina de fundicion',src:'referencias_condensado/queso_tina_fundicion.jpg',label:'Queso · Tina de fundición',page:6},
  {area:'QUESO',point:'Tapadora',src:'referencias_condensado/queso_tapadora.jpg',label:'Queso · Tapadora',page:7},
  {area:'TOMATE',point:'Intercambiador de Calor',src:'referencias_condensado/tomate_intercambiador_calor.jpg',label:'Tomate · Intercambiador de Calor',page:8},
  {area:'TOMATE',point:'Intercambiador Tubular Salsa Base',src:'referencias_condensado/tomate_intercambiador_tubular_salsa_base.jpg',label:'Tomate · Intercambiador Tubular Salsa Base',page:9},
  {area:'MAYONESA',point:'CIP',src:'referencias_condensado/mayonesa_cip.jpg',label:'Mayonesa · CIP',page:10},
  {area:'MAYONESA',point:'Manifold',src:'referencias_condensado/mayonesa_manifold.jpg',label:'Mayonesa · Manifold',page:11},
  {area:'MANIFOLD',point:'Vapor Principal',src:'referencias_condensado/manifold_vapor_principal.jpg',label:'Manifold · Vapor Principal',page:12},
  {area:'MANIFOLD',point:'Manifold Vapor Margarina',src:'referencias_condensado/manifold_vapor_margarina.jpg',label:'Manifold · Vapor Margarina',page:13},
  {area:'MANIFOLD',point:'Vapor Pick Heater',src:'referencias_condensado/manifold_pick_heater.jpg',label:'Manifold · Pick Heater',page:14},
  {area:'MARGARINA',point:'Area de Pasteurizacion',src:'referencias_condensado/margarina_pasteurizacion_1.jpg',label:'Margarina · Área de Pasteurización · Vista 1',page:15},
  {area:'MARGARINA',point:'Area de Pasteurizacion',src:'referencias_condensado/margarina_pasteurizacion_2.jpg',label:'Margarina · Área de Pasteurización · Vista 2',page:16},
  {area:'MARGARINA',point:'Area de Pasteurizacion',src:'referencias_condensado/margarina_pasteurizacion_3.jpg',label:'Margarina · Área de Pasteurización · Vista 3',page:17},
  {area:'MARGARINA',point:'Area de Pasteurizacion',src:'referencias_condensado/margarina_pasteurizacion_4.jpg',label:'Margarina · Área de Pasteurización · Vista 4',page:18},
  {area:'MARGARINA',point:'Area de Fundicion de Emulsificante',src:'referencias_condensado/margarina_fundicion_emulsificante_1.jpg',label:'Margarina · Fundición de Emulsificante · Vista 1',page:19},
  {area:'MARGARINA',point:'Area de Fundicion de Emulsificante',src:'referencias_condensado/margarina_fundicion_emulsificante_2.jpg',label:'Margarina · Fundición de Emulsificante · Vista 2',page:20},
  {area:'MARGARINA',point:'Area de Fundicion de Emulsificante',src:'referencias_condensado/margarina_fundicion_emulsificante_3.jpg',label:'Margarina · Fundición de Emulsificante · Vista 3',page:21},
  {area:'MARGARINA',point:'Area de Fundicion de Emulsificante',src:'referencias_condensado/margarina_fundicion_emulsificante_4.jpg',label:'Margarina · Fundición de Emulsificante · Vista 4',page:22},
  {area:'MANIFOLD',point:'Manifold Vapor Investigacion y Desarrollo',src:'referencias_condensado/manifold_investigacion_desarrollo.jpg',label:'Manifold · Investigación y Desarrollo',page:23}
];
const VERIF_POINT_ORDER = {
  QUESO:['Linea Alimentacion','Linea Cocina 1','Linea Vapor Alimentacion','Linea de condensado #1 entrada vapor','Linea de condensado #2 Filtro','Linea de condensado #3 Cocina','Linea Cocina 2','Intercambiador CIP','Fase Oleosa','Tina de fundicion','Tapadora'],
  TOMATE:['Intercambiador de Calor','Intercambiador Tubular Salsa Base'],
  MAYONESA:['CIP','Manifold'],
  MANIFOLD:['Vapor Principal','Vapor Pick Heater','Manifold Vapor Investigacion y Desarrollo','Manifold Vapor Margarina'],
  MARGARINA:['Area de Pasteurizacion','Area de Fundicion de Emulsificante']
};

function verifText(v){return String(v===null||v===undefined?'':v).trim();}
function verifNormKey(v){return verifText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');}
function verifDate(v){
  const s=verifText(v);if(!s)return '';let m;
  if((m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/)))return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
  if((m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/))){let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;}
  return s;
}
function verifExcelDate(v){
  if(v===null||v===undefined||v==='')return '';
  if(typeof v==='number'&&Number.isFinite(v)){const d=new Date(Date.UTC(1899,11,30)+Math.round(v*86400000));return d.toISOString().slice(0,10);}
  return verifDate(v);
}
function verifFmtDate(v){const s=verifDate(v);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:(s||'—');}
function verifCellState(v){
  const n=verifNormKey(v);
  if(!n)return 'pending';
  if(['N/A','NA','NO APLICA','NO APLICA.'].includes(n))return 'na';
  if(['OK','BIEN','BUENO','OPTIMO','ÓPTIMO','SI','SÍ','✓','✔'].includes(n))return 'ok';
  return 'issue';
}
function verifRowState(r){
  const states=VERIF_FIELDS.map(f=>verifCellState(r[f]));
  if(states.includes('issue'))return 'issue';
  if(states.some(s=>s==='ok'||s==='na'))return 'ok';
  return 'pending';
}
function verifStatusLabel(s){return s==='issue'?'Con desviación':s==='ok'?'Verificado':'Pendiente';}
function verifStatusCell(v){const s=verifCellState(v),txt=verifText(v)||'—';return `<span class="verif-status ${s==='pending'?'':s}">${esc(txt)}</span>`;}
function verifNormalizeRow(o){
  const r={};VERIF_HEADERS.forEach(h=>r[h]=o&&o[h]!==undefined&&o[h]!==null?String(o[h]):'');
  /* Compatibilidad con registros/formatos previos que usaban el encabezado "Fugas". */
  if(!verifText(r['Condicion Fuga'])&&o&&o.Fugas!==undefined&&o.Fugas!==null)r['Condicion Fuga']=String(o.Fugas);
  r.Fecha=verifDate(r.Fecha);r.Turno=verifText(r.Turno);r['Área']=verifText(r['Área']).toUpperCase();return r;
}
function cargarListaVerificadosDesdeDrive(raw){
  LISTA_VERIFICADOS_ROWS=(raw||[]).map(verifNormalizeRow).filter(r=>r.Fecha&&r['Área']&&r['Punto / Equipo']);
  LISTA_VERIFICADOS_SOURCE='Google Drive · Base Maestra · LISTA_VERIFICADOS';
  if(activa==='verificados')pintarListaVerificados();
  else verifUpdateNavStatus();
}
function verifCurrentFilters(){
  const g=id=>document.getElementById(id);
  return {area:g('verif-area')?.value||'__all__',date:g('verif-date')?.value||'__all__',turno:g('verif-turno')?.value||'__all__',status:g('verif-status')?.value||'__all__',search:verifNormKey(g('verif-search')?.value||'')};
}
function verifFilteredRows(){
  const f=verifCurrentFilters();
  return LISTA_VERIFICADOS_ROWS.filter(r=>{
    if(f.area!=='__all__'&&r['Área']!==f.area)return false;
    if(f.date!=='__all__'&&r.Fecha!==f.date)return false;
    if(f.turno!=='__all__'&&r.Turno!==f.turno)return false;
    if(f.status!=='__all__'&&verifRowState(r)!==f.status)return false;
    if(f.search){const hay=[r['Punto / Equipo'],r.Supervisor,r.Operador,r['#Aviso B1'],r['Observacion Operador'],r['Área']].some(v=>verifNormKey(v).includes(f.search));if(!hay)return false;}
    return true;
  }).sort((a,b)=>(b.Fecha||'').localeCompare(a.Fecha||'')||(b.Turno||'').localeCompare(a.Turno||'')||(a['Área']||'').localeCompare(b['Área']||'')||(a['Punto / Equipo']||'').localeCompare(b['Punto / Equipo']||''));
}
function verifFillSelect(id,values,labelFn,allLabel){
  const el=document.getElementById(id);if(!el)return;const old=el.value;
  el.innerHTML=`<option value="__all__">${esc(allLabel)}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(labelFn?labelFn(v):v)}</option>`).join('');
  el.value=[...el.options].some(o=>o.value===old)?old:'__all__';
}
function verifLatestPerArea(){
  const out={};VERIF_AREAS.forEach(a=>{const ar=LISTA_VERIFICADOS_ROWS.filter(r=>r['Área']===a);if(!ar.length){out[a]=[];return;}const latest=ar.map(r=>r.Fecha).filter(Boolean).sort().slice(-1)[0];const day=ar.filter(r=>r.Fecha===latest);const turno=day.map(r=>r.Turno).filter(Boolean).sort().slice(-1)[0];out[a]=turno?day.filter(r=>r.Turno===turno):day;});return out;
}
function verifUpdateNavStatus(){
  const dot=document.querySelector('[data-tabst="verificados"]');if(!dot)return;
  const latest=verifLatestPerArea(),rows=Object.values(latest).flat();
  const issue=rows.some(r=>verifRowState(r)==='issue');
  dot.className='st '+(!rows.length?'idle':issue?'crit':'');
}
function verifPhotosFor(area,point){
  const a=verifNormKey(area),p=verifNormKey(point);
  return VERIF_PHOTOS.filter(x=>verifNormKey(x.area)===a&&verifNormKey(x.point)===p);
}
function verifPhotosForArea(area){
  const a=verifNormKey(area),seen=new Set();
  return VERIF_PHOTOS.filter(x=>verifNormKey(x.area)===a).filter(x=>{const k=x.src; if(seen.has(k))return false; seen.add(k); return true;});
}
function verifPhotoFillAreas(preferred){
  const el=document.getElementById('verif-ref-area');if(!el)return;
  const old=preferred||el.value||'';
  el.innerHTML=VERIF_AREAS.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');
  el.value=VERIF_AREAS.includes(old)?old:VERIF_AREAS[0];
}
function verifPhotoFillPoints(preferred){
  const a=document.getElementById('verif-ref-area'),p=document.getElementById('verif-ref-point');if(!a||!p)return;
  const pts=VERIF_POINT_ORDER[a.value]||[],old=preferred||p.value||'';
  p.innerHTML=pts.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  p.value=pts.includes(old)?old:(pts[0]||'');
}
function verifRenderPhotos(){
  const a=document.getElementById('verif-ref-area'),p=document.getElementById('verif-ref-point'),modeEl=document.getElementById('verif-ref-mode'),view=document.getElementById('verif-ref-view');if(!a||!p||!view)return;
  const area=a.value,point=p.value,mode=modeEl?modeEl.value:'point';
  if(p)p.disabled=mode!=='point';
  /* Al elegir "Ocultar Referencias" desaparece por completo el bloque inferior,
     sin dejar un rectángulo/placeholder vacío. */
  if(mode==='hide'){
    view.hidden=true;
    view.innerHTML='';
    return;
  }
  view.hidden=false;
  if(mode==='point'&&!point){view.innerHTML='<div class="empty">Seleccione un punto o equipo para ver la referencia visual.</div>';return;}
  const photos=mode==='area'?verifPhotosForArea(area):verifPhotosFor(area,point);
  const layoutClass=photos.length===1?'is-single':'is-multiple';
  const cards=photos.map(ph=>`<button type="button" class="verif-photo-card" data-verif-photo-src="${esc(ph.src)}" data-verif-photo-title="${esc(ph.label)}"><span class="verif-photo-frame"><img src="${esc(ph.src)}" alt="${esc(ph.label)}" loading="lazy" decoding="async"></span><span class="verif-photo-caption"><strong>${esc(ph.label)}</strong></span><span class="verif-photo-zoom">Ampliar</span></button>`).join('');
  const title=mode==='area'?'Todas las fotos del área':point;
  const helper=mode==='area'?'Vista general de las referencias disponibles para esta área.':'Use estas fotografías como referencia de ubicación antes y durante la verificación en campo.';
  const gallery=!photos.length?'<div class="empty">No hay fotografía asociada a esta selección.</div>':`<div class="verif-photo-grid ${layoutClass}">${cards}</div>`;
  view.innerHTML=`<div class="verif-ref-summary"><div><span class="pill idle"><i></i>${esc(area)}</span><h4>${esc(title)}</h4><p>${esc(helper)}</p></div><span class="verif-ref-count">${photos.length} foto${photos.length===1?'':'s'}</span></div>${gallery}`;
}

function verifSetPhotoSelection(area,point){
  const mode=document.getElementById('verif-ref-mode');if(mode)mode.value='point';
  verifPhotoFillAreas(area);verifPhotoFillPoints(point);verifRenderPhotos();
}
function verifEnsurePhotoControls(preferredArea){
  const a=document.getElementById('verif-ref-area');if(!a)return;
  if(!a.options.length)verifPhotoFillAreas(preferredArea||VERIF_AREAS[0]);
  else if(preferredArea&&VERIF_AREAS.includes(preferredArea)&&!a.dataset.userSelected)a.value=preferredArea;
  verifPhotoFillPoints();verifRenderPhotos();
}
function verifOpenPhoto(src,title){
  const m=document.getElementById('verif-photo-modal'),img=document.getElementById('verif-photo-modal-img'),cap=document.getElementById('verif-photo-modal-title');if(!m||!img)return;
  img.src=src;img.alt=title||'Referencia visual';if(cap)cap.textContent=title||'Referencia visual';m.hidden=false;document.body.classList.add('verif-modal-open');
}
function verifClosePhoto(){
  const m=document.getElementById('verif-photo-modal'),img=document.getElementById('verif-photo-modal-img');if(m)m.hidden=true;if(img)img.removeAttribute('src');document.body.classList.remove('verif-modal-open');
}

function verifAnimateRows(dir){
  const table=document.querySelector('.verif-table');
  if(!table||!dir)return;
  table.classList.remove('verif-page-in-next','verif-page-in-prev');
  void table.offsetWidth;
  table.classList.add(dir>0?'verif-page-in-next':'verif-page-in-prev');
  setTimeout(()=>table.classList.remove('verif-page-in-next','verif-page-in-prev'),280);
}
function verifRenderPagination(totalRows){
  const pages=Math.max(1,Math.ceil(totalRows/VERIF_PAGE_SIZE));
  VERIF_PAGE=Math.min(Math.max(1,VERIF_PAGE),pages);
  const start=totalRows?((VERIF_PAGE-1)*VERIF_PAGE_SIZE)+1:0;
  const end=Math.min(VERIF_PAGE*VERIF_PAGE_SIZE,totalRows);
  const sel=document.getElementById('verif-page-select');
  if(sel){
    sel.innerHTML=Array.from({length:pages},(_,i)=>`<option value="${i+1}">${i+1} de ${pages}</option>`).join('');
    sel.value=String(VERIF_PAGE);
    sel.disabled=pages<=1;
  }
  const prev=document.getElementById('verif-page-prev'),next=document.getElementById('verif-page-next');
  if(prev)prev.disabled=VERIF_PAGE<=1||!totalRows;
  if(next)next.disabled=VERIF_PAGE>=pages||!totalRows;
  const meta=document.getElementById('verif-page-meta');
  if(meta)meta.textContent=`${start}–${end} de ${totalRows}`;
  const nav=document.getElementById('verif-history-nav');
  if(nav)nav.classList.toggle('is-single',pages<=1);
  return {pages,start,end};
}
function pintarListaVerificados(){
  const areas=[...new Set(LISTA_VERIFICADOS_ROWS.map(r=>r['Área']).filter(Boolean))].sort();
  const dates=[...new Set(LISTA_VERIFICADOS_ROWS.map(r=>r.Fecha).filter(Boolean))].sort().reverse();
  const turns=[...new Set(LISTA_VERIFICADOS_ROWS.map(r=>r.Turno).filter(Boolean))].sort();
  verifFillSelect('verif-area',areas,null,'Todas las áreas');verifFillSelect('verif-date',dates,verifFmtDate,'Todas las fechas');verifFillSelect('verif-turno',turns,null,'Todos los turnos');
  const rows=verifFilteredRows();
  const total=document.getElementById('verif-kpi-total'),latestEl=document.getElementById('verif-kpi-latest'),latestMeta=document.getElementById('verif-kpi-latest-meta'),issuesEl=document.getElementById('verif-kpi-issues'),b1El=document.getElementById('verif-kpi-b1');
  if(total)total.textContent=rows.length;
  const latestDate=rows.map(r=>r.Fecha).filter(Boolean).sort().slice(-1)[0]||'';
  if(latestEl)latestEl.textContent=latestDate?verifFmtDate(latestDate):'—';
  const latestRows=latestDate?rows.filter(r=>r.Fecha===latestDate):[];
  if(latestMeta)latestMeta.textContent=latestRows.length?`${latestRows.length} registros · ${[...new Set(latestRows.map(r=>r.Turno).filter(Boolean))].join(' · ')||'turno sin indicar'}`:'Sin información';
  if(issuesEl)issuesEl.textContent=rows.filter(r=>verifRowState(r)==='issue').length;
  if(b1El)b1El.textContent=rows.filter(r=>verifText(r['#Aviso B1'])).length;
  const src=document.getElementById('verif-source');if(src){src.className='pill '+(LISTA_VERIFICADOS_ROWS.length?'ok':'idle');src.innerHTML=`<i></i>${esc(LISTA_VERIFICADOS_SOURCE)}`;}
  const count=document.getElementById('verif-count');if(count)count.textContent=`${rows.length} registro${rows.length===1?'':'s'} · 10 por página`;
  const pageInfo=verifRenderPagination(rows.length);
  const pageRows=rows.slice((VERIF_PAGE-1)*VERIF_PAGE_SIZE,VERIF_PAGE*VERIF_PAGE_SIZE);

  const selected=verifCurrentFilters().area;
  const latestByArea=verifLatestPerArea(),grid=document.getElementById('verif-area-grid');
  if(grid)grid.innerHTML=VERIF_AREAS.map(area=>{
    const ar=latestByArea[area]||[],issue=ar.filter(r=>verifRowState(r)==='issue').length,pending=ar.filter(r=>verifRowState(r)==='pending').length,ok=ar.filter(r=>verifRowState(r)==='ok').length;
    const cls=issue?'issue':pending?'pending':ar.length?'ok':'pending',d=ar[0]?.Fecha||'',turnos=[...new Set(ar.map(r=>r.Turno).filter(Boolean))].join(' · ');
    const metric=issue?issue:pending?pending:ok,label=issue?'desviaciones':pending?'pendientes':ar.length?'verificados':'sin registros';return `<button type="button" class="verif-area-card ${cls}${selected===area?' is-active':''}" data-verif-area-card="${esc(area)}"><div class="verif-area-name"><span>${esc(area)}</span><i></i></div><div class="verif-area-metrics"><strong>${metric}</strong><span>${label}</span></div><div class="verif-area-meta">${d?`Último: ${esc(verifFmtDate(d))}${turnos?' · '+esc(turnos):''}`:'Aún no hay verificaciones'}${ar.length?`<br>${ok} OK · ${pending} pendientes`:''}</div></button>`;
  }).join('');

  const body=document.getElementById('verif-table-body');
  if(body){
    if(!rows.length)body.innerHTML='<tr class="verif-empty-row"><td colspan="13">No hay registros que coincidan con los filtros seleccionados.</td></tr>';
    else body.innerHTML=pageRows.map(r=>{const hasPhoto=verifPhotosFor(r['Área'],r['Punto / Equipo']).length>0;return `<tr class="${verifRowState(r)==='issue'?'has-dev':''}"><td>${esc(verifFmtDate(r.Fecha))}</td><td>${esc(r.Turno||'—')}</td><td><strong>${esc(r['Área'])}</strong></td><td><div class="verif-point-cell"><span>${esc(r['Punto / Equipo'])}</span>${hasPhoto?`<button type="button" class="verif-photo-link" data-verif-photo-area="${esc(r['Área'])}" data-verif-photo-point="${esc(r['Punto / Equipo'])}">Ver foto</button>`:''}</div></td><td>${verifStatusCell(r['Condicion Fuga'])}</td><td>${verifStatusCell(r['Condicion by pass'])}</td><td>${verifStatusCell(r['Condicion Manometros'])}</td><td>${verifStatusCell(r['Condicion Aislamiento'])}</td><td>${verifStatusCell(r['Condicion Seguridad'])}</td><td>${esc(r['#Aviso B1']||'—')}</td><td>${esc(r['Observacion Operador']||'—')}</td><td>${esc(r.Supervisor||'—')}</td><td>${esc(r.Operador||'—')}</td></tr>`;}).join('');
    if(VERIF_PAGE_ANIM_DIR){verifAnimateRows(VERIF_PAGE_ANIM_DIR);VERIF_PAGE_ANIM_DIR=0;}
  }
  verifUpdateNavStatus();
  verifEnsurePhotoControls(selected!=='__all__'?selected:null);
}

async function verifLeerExcel(buffer,fileName){
  const zip=await abrirZipPTAR(buffer),parser=new DOMParser();
  const wbXml=parser.parseFromString(await zip.text('xl/workbook.xml'),'application/xml');
  const relXml=parser.parseFromString(await zip.text('xl/_rels/workbook.xml.rels'),'application/xml');
  const rels=[...relXml.getElementsByTagNameNS('*','Relationship')];
  let shared=[];
  if(zip.entries.has('xl/sharedStrings.xml')){const ssXml=parser.parseFromString(await zip.text('xl/sharedStrings.xml'),'application/xml');shared=[...ssXml.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent||'').join(''));}
  const sheets=[...wbXml.getElementsByTagNameNS('*','sheet')],out=[];
  for(const area of VERIF_AREAS){
    const sheet=sheets.find(x=>verifNormKey(x.getAttribute('name'))===verifNormKey(area));if(!sheet)continue;
    const rid=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id');
    const rel=rels.find(r=>r.getAttribute('Id')===rid);if(!rel)continue;
    let target=rel.getAttribute('Target').replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');
    const rows=await leerHojaXLSXPTAR(zip,target,shared);
    const supervisor=verifText(rows[2]?.[1]),operador=verifText(rows[2]?.[4]),fecha=verifExcelDate(rows[3]?.[1]),turno=verifText(rows[3]?.[4]);
    let h=-1;for(let i=0;i<Math.min(rows.length,15);i++){if(verifNormKey(rows[i]?.[0])==='PUNTO / EQUIPO'){h=i;break;}}
    if(h<0)continue;
    let areaHasData=false;
    for(let i=h+1;i<rows.length;i++){
      const rr=rows[i]||[],punto=verifText(rr[0]);if(!punto)continue;
      const vals=rr.slice(1,8).map(verifText);if(!vals.some(Boolean))continue;
      areaHasData=true;
      const seq=String(i-h).padStart(2,'0'),id=[fecha||'SINFECHA',turno||'SINTURNO',area,seq].join('|');
      out.push({'Registro ID':id,'Fecha':fecha,'Turno':turno,'Supervisor':supervisor,'Operador':operador,'Área':area,'Punto / Equipo':punto,'Condicion Fuga':vals[0]||'','Condicion by pass':vals[1]||'','Condicion Manometros':vals[2]||'','Condicion Aislamiento':vals[3]||'','Condicion Seguridad':vals[4]||'','#Aviso B1':vals[5]||'','Observacion Operador':vals[6]||'','Archivo origen':fileName||'Checklist operador','Fecha de carga':''});
    }
    if(areaHasData&&(!fecha||!turno||!supervisor||!operador))throw new Error(`${area}: complete Supervisor, Operador, Día y Turno antes de cargar el archivo.`);
  }
  if(!out.length)throw new Error('No se encontraron verificaciones diligenciadas. Complete al menos una condición del checklist.');
  return out;
}
async function verifGuardarDrive(rows,fileName){
  const key=dashDriveWriteKey();if(!key)throw new Error('No se ingresó la clave de actualización.');
  if(!confirm(`Se guardarán ${rows.length} verificaciones del archivo "${fileName}" en la hoja LISTA_VERIFICADOS de Drive. ¿Desea continuar?`))return false;
  let ans=null,postError=null;
  try{ans=await dashDriveRequest({action:'upsert_verified',key,rows});}catch(err){postError=err;console.warn('Lista de Verificados: POST enviado; se confirmará leyendo Drive.',err);}
  if(ans&&ans.data)dashDriveApplyMasterData(ans);
  let ok=false,last=null;for(let intento=0;intento<6&&!ok;intento++){if(intento)await dashDriveSleep(700*intento);try{const r=await dashDriveRead({action:'read_master'}),raw=r&&r.data&&r.data.LISTA_VERIFICADOS;if(Array.isArray(raw)){cargarListaVerificadosDesdeDrive(raw);ok=true;}}catch(e){last=e;}}
  if(ok){dashDriveRefreshStatus('Checklist sincronizado','ok');alert(`Lista de Verificados: ${rows.length} registros guardados/actualizados en Drive.`);return true;}
  throw new Error('La carga fue enviada, pero no se pudo confirmar desde Drive.'+((last||postError)?' Detalle: '+((last||postError).message||last||postError):''));
}

document.addEventListener('change',async e=>{
  const t=e.target;if(!t)return;
  if(t.id==='verif-excel-input'){const file=t.files&&t.files[0];if(!file)return;try{const rows=await verifLeerExcel(await file.arrayBuffer(),file.name);await verifGuardarDrive(rows,file.name);}catch(err){alert('Lista de Verificados: '+(err.message||err));console.error(err);}finally{t.value='';}return;}
  if(t.id==='verif-ref-area'){t.dataset.userSelected='1';verifPhotoFillPoints();verifRenderPhotos();return;}
  if(t.id==='verif-ref-point'){verifRenderPhotos();return;}
  if(t.id==='verif-ref-mode'){verifRenderPhotos();return;}
  if(t.id==='verif-page-select'){const next=Number(t.value)||1;VERIF_PAGE_ANIM_DIR=next>VERIF_PAGE?1:next<VERIF_PAGE?-1:0;VERIF_PAGE=next;pintarListaVerificados();return;}
  if(['verif-area','verif-date','verif-turno','verif-status'].includes(t.id)){VERIF_PAGE=1;VERIF_PAGE_ANIM_DIR=0;pintarListaVerificados();if(t.id==='verif-area'&&t.value!=='__all__')verifSetPhotoSelection(t.value);}
});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='verif-search'){VERIF_PAGE=1;VERIF_PAGE_ANIM_DIR=0;pintarListaVerificados();}});
document.addEventListener('click',e=>{
  if(e.target&&e.target.id==='verif-page-prev'){if(VERIF_PAGE>1){VERIF_PAGE--;VERIF_PAGE_ANIM_DIR=-1;pintarListaVerificados();}return;}
  if(e.target&&e.target.id==='verif-page-next'){const total=verifFilteredRows().length,pages=Math.max(1,Math.ceil(total/VERIF_PAGE_SIZE));if(VERIF_PAGE<pages){VERIF_PAGE++;VERIF_PAGE_ANIM_DIR=1;pintarListaVerificados();}return;}
  const photoLink=e.target&&e.target.closest?e.target.closest('[data-verif-photo-point]'):null;if(photoLink){verifSetPhotoSelection(photoLink.dataset.verifPhotoArea||'QUESO',photoLink.dataset.verifPhotoPoint||'');document.getElementById('verif-reference')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const photo=e.target&&e.target.closest?e.target.closest('[data-verif-photo-src]'):null;if(photo){verifOpenPhoto(photo.dataset.verifPhotoSrc||'',photo.dataset.verifPhotoTitle||'Referencia visual');return;}
  if(e.target&&e.target.closest&&e.target.closest('[data-verif-photo-close]')){verifClosePhoto();return;}
  if(e.target&&e.target.id==='verif-photo-modal'){verifClosePhoto();return;}
  const c=e.target&&e.target.closest?e.target.closest('[data-verif-area-card]'):null;if(c){const area=c.dataset.verifAreaCard||'__all__',sel=document.getElementById('verif-area');VERIF_PAGE=1;VERIF_PAGE_ANIM_DIR=0;if(sel){sel.value=area;pintarListaVerificados();}if(area!=='__all__')verifSetPhotoSelection(area);return;}
  if(e.target&&e.target.id==='verif-clear'){VERIF_PAGE=1;VERIF_PAGE_ANIM_DIR=0;['verif-area','verif-date','verif-turno','verif-status'].forEach(id=>{const x=document.getElementById(id);if(x)x.value='__all__';});const q=document.getElementById('verif-search');if(q)q.value='';pintarListaVerificados();}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')verifClosePhoto();});

const _verifPintarEncabezado=pintarEncabezado;
pintarEncabezado=function(){if(activa==='verificados'){const t=document.getElementById('view-title'),s=document.getElementById('view-sub');if(t)t.textContent=SERVICIOS.verificados.nom;if(s)s.textContent=SERVICIOS.verificados.sub+' · histórico centralizado en Google Drive';return;}return _verifPintarEncabezado.apply(this,arguments);};
const _verifIr=ir;ir=function(id){const r=_verifIr(id);if(id==='verificados')pintarListaVerificados();return r;};
const _verifRefrescar=refrescar;refrescar=function(){const r=_verifRefrescar.apply(this,arguments);if(activa==='verificados')pintarListaVerificados();return r;};
const _verifDriveApply=dashDriveApplyMasterData;
dashDriveApplyMasterData=function(ans,focusArea=null,focusDate=null){const base=_verifDriveApply(ans,focusArea,focusDate);try{const raw=ans&&ans.data&&ans.data.LISTA_VERIFICADOS;if(Array.isArray(raw))cargarListaVerificadosDesdeDrive(raw);}catch(e){console.error('Drive: no se pudo aplicar LISTA_VERIFICADOS',e);window.__DASH_DRIVE_LAST_APPLY_ERRORS=[...(window.__DASH_DRIVE_LAST_APPLY_ERRORS||[]),'LISTA_VERIFICADOS: '+e.message];}return base;};
setTimeout(()=>{try{pintarListaVerificados();}catch(e){console.warn('Lista de Verificados',e);}},160);


/* ---------------------------------------------------------
   V11.6 · presentación numérica
   Los valores de proceso que llegan con más de dos decimales
   se muestran con dos, sin alterar el dato original en Drive.
   --------------------------------------------------------- */
function dashRoundLongDecimalsText(value){
  return String(value ?? '').replace(/(^|[^\d.,])(-?\d+[.,]\d{3,})(?![\d.,])/g,(m,prefix,raw)=>{
    const comma=raw.includes(',');
    const n=Number(raw.replace(',','.'));
    if(!Number.isFinite(n))return m;
    const safe=Math.abs(n)<0.005?0:n;
    let rounded=safe.toFixed(2);
    if(comma)rounded=rounded.replace('.',',');
    return prefix+rounded;
  });
}
function dashRoundVisibleLongDecimals(root){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    const p=node.parentElement;
    if(!p||/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(p.tagName))return;
    const old=node.nodeValue||'',next=dashRoundLongDecimalsText(old);
    if(next!==old)node.nodeValue=next;
  });
}
(function dashInitTwoDecimalDisplay(){
  const root=document.querySelector('.main');
  if(!root)return;
  let raf=0;
  const schedule=()=>{
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{raf=0;dashRoundVisibleLongDecimals(root);});
  };
  new MutationObserver(schedule).observe(root,{subtree:true,childList:true,characterData:true});
  schedule();
})();

/* ---------------------------------------------------------
   V11.8 · fecha más reciente disponible al iniciar
   - El respaldo local puede inicializar una fecha antigua antes
     de que termine la lectura de Google Drive.
   - Al completar la primera lectura válida de la Base Maestra,
     cada servicio se enfoca en su fecha más reciente disponible.
   - La selección manual del usuario se conserva después de esa
     sincronización inicial.
   --------------------------------------------------------- */
let DASH_V118_INITIAL_LATEST_DONE=false;

function dashV118LatestDateFor(area){
  const dates=(typeof dashUiDates==='function'?dashUiDates(area):[])
    .filter(f=>/^\d{4}-\d{2}-\d{2}$/.test(String(f||'')))
    .slice().sort();
  return dates.length?dates[dates.length-1]:null;
}

function dashV118FocusLatestServices(){
  ['ptab','ptar','vapor','suav'].forEach(area=>{
    const latest=dashV118LatestDateFor(area);
    if(latest)dashDriveFocusDate(area,latest);
  });

  /* Compresores/Refrigeración comparten una sola fecha visible. */
  try{
    const salaDates=(typeof dashSalaFechas==='function'?dashSalaFechas():[])
      .filter(f=>/^\d{4}-\d{2}-\d{2}$/.test(String(f||'')))
      .slice().sort();
    const latestSala=salaDates.length?salaDates[salaDates.length-1]:null;
    if(latestSala){
      if(typeof DASH_UI_FILTERS!=='undefined'){
        DASH_UI_FILTERS.month.aire=latestSala.slice(0,7);
        DASH_UI_FILTERS.month.frio=latestSala.slice(0,7);
        DASH_UI_FILTERS.globalMonth='__all__';
      }
      if(typeof dashSalaSetFecha==='function')dashSalaSetFecha(latestSala);
      if(typeof dashSalaRenderUnificado==='function')dashSalaRenderUnificado();
      if(typeof dashUiPopulateServiceControls==='function')dashUiPopulateServiceControls('aire');
      if(typeof dashUiAfterRender==='function')dashUiAfterRender('aire');
    }
  }catch(e){console.warn('V11.8: no se pudo enfocar la fecha más reciente de Sala de Compresores.',e);}

  try{
    if(typeof pintarValores==='function')pintarValores();
    if(typeof pintarEncabezado==='function')pintarEncabezado();
    if(typeof pintarPrioridades==='function')pintarPrioridades();
  }catch(e){console.warn('V11.8: actualización final de la interfaz.',e);}
}

/* Al escoger un mes, siempre entrar en la última fecha disponible de ese mes. */
dashUiSelectLatestInMonth=function(area,month){
  const dates=dashUiDates(area)
    .filter(f=>month==='__all__'||dashUiMonthFromDate(f)===month)
    .slice().sort();
  if(dates.length){dashUiSetDate(area,dates[dates.length-1]);return true;}
  dashUiSetDate(area,null);return false;
};

const _dashDriveApplyMasterDataV118=dashDriveApplyMasterData;
dashDriveApplyMasterData=function(ans,focusArea=null,focusDate=null){
  const result=_dashDriveApplyMasterDataV118(ans,focusArea,focusDate);
  if(!focusArea&&!focusDate&&!DASH_V118_INITIAL_LATEST_DONE){
    DASH_V118_INITIAL_LATEST_DONE=true;
    /* Diferir un frame permite que todas las listas de fecha queden pobladas. */
    requestAnimationFrame(()=>dashV118FocusLatestServices());
  }
  return result;
};

