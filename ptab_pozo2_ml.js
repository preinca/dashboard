/* PTAB Pozo #2 · predicción experimental; modelos validados sin fuga temporal. */
(function(){
'use strict';
const HOST=document.getElementById('cep-ptab-predictions');if(!HOST)return;
const CONFIG=[
 {id:'ptab_01',name:'Presión',unit:'psi',label:'Presión (psi) · Pozo 2',validation:{'1':{mae:2.1,n:10,method:'Persistencia (superó SVR)'},'7':{mae:1.4697,n:7,method:'SVR RBF'}}},
 {id:'ptab_02',name:'Caudal',unit:'L/s',label:'Caudal (l/s) · Pozo 2',validation:{'1':{mae:.2082,n:13,method:'SVR RBF'},'7':{mae:.3575,n:6,method:'SVR RBF'}}}
];
const SVR_MODELS={"ptab_01":{"7":{"mean":[26.568181818,26.662878788,26.606331169,26.833362849,5,8.545454545,1.363636364],"scale":[2.287790988,1.239724756,1.207303017,0.913729913,1.53741223,2.016461183,1.262949454],"sv":[[0.188749,1.34744,1.43046,0.80775,-1.30089,-0.76642,-0.28793],[0.62585,1.34744,1.36144,0.86638,-0.65044,-0.2705,-0.28793],[-0.90401,-0.13138,0.74022,0.48637,0,0.22542,-0.28793],[1.06295,0.40637,0.94729,0.67486,0.65044,0.72134,-0.28793],[0.62585,0.67525,0.53315,0.85118,0.65044,0.22542,-0.28793],[-0.0298,0.40637,0.46412,0.79038,0.65044,0.22542,-0.28793],[2.37426,0.54081,0.53315,0.72958,0.65044,1.71317,-0.28793],[-1.12256,0.00306,0.46412,0.41037,0.65044,1.71317,-0.28793],[0.62585,1.07856,1.15437,0.49506,-2.60177,-0.76642,4.46286],[1.50006,1.07856,1.2579,1.38623,-0.65044,-1.75826,-0.28793],[-0.68546,-1.54299,-1.53759,0.29181,-1.95133,-1.75826,-0.28793],[0.62585,-0.66914,-0.64027,0.45597,-1.30089,-1.26234,-0.28793],[-1.55966,-1.20689,-1.33051,-1.06839,0,-0.76642,-0.28793],[-1.99677,-2.41684,-1.56717,-1.59605,1.30089,-0.2705,-0.28793],[0.62585,-1.34133,-1.12344,-1.86966,0.65044,-0.2705,0.50387],[0.18875,0.67525,-1.26149,-1.64166,0.65044,0.22542,-0.28793]],"dual":[6.900293,-7.156832,-15.061661,30,-30,23.479887,-11.492151,0.573625,3.226196,-1.276773,1.061654,1.104694,1.95006,1.500707,-3.835473,-0.974227],"intercept":26.160175957,"gamma":0.14285714285714285}},"ptab_02":{"1":{"mean":[14.125731707,14.138658537,14.15964489,14.080239744,5.097560976,8.512195122,1.487804878],"scale":[0.353159193,0.28692805,0.241284536,0.365483262,2.093018337,2.733013625,1.740786915],"sv":[[0.32356,-0.45421,-0.54027,-0.13942,0.90895,-0.55331,-0.28022],[0.93235,0.60587,0.63351,-0.46775,-1.47995,-0.55331,-0.28022],[2.39062,1.36971,1.54184,0.2495,-1.00217,-0.55331,-0.28022],[-0.69581,-0.80854,-0.87775,-0.09642,0.90895,0.91028,-0.28022]],"dual":[-0.03,0.03,0.03,-0.03],"intercept":14.140862234,"gamma":0.14285714285714285},"7":{"mean":[],"scale":[],"sv":[],"dual":[],"intercept":14.03,"gamma":0.14285714285714285}}};
function parse(v){if(v==null||String(v).trim()==='')return null;const s=String(v).trim().replace(/\s/g,'');const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);return Number.isFinite(n)&&n>=0?n:null;}
function dateValue(d){return Date.parse(d+'T00:00:00Z');}
function future(d,n){return new Date(dateValue(d)+n*86400000).toISOString().slice(0,10);}
function fmt(n,d=2){return Number.isFinite(n)?n.toLocaleString('es-VE',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';}
function datestr(d){return d.split('-').reverse().join('/');}
function daily(id){if(typeof PTABR_DATA==='undefined')return [];const buckets=new Map();PTABR_DATA.forEach(r=>{if(r.id!==id||!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha||''))return;const v=parse(r.valor);if(v===null)return;const x=buckets.get(r.fecha)||[];x.push(v);buckets.set(r.fecha,x);});return [...buckets].map(([fecha,v])=>({fecha,valor:v.reduce((a,b)=>a+b,0)/v.length})).sort((a,b)=>a.fecha.localeCompare(b.fecha));}
function vector(rows){
 const now=rows[rows.length-1],t=dateValue(now.fecha);
 const windowDays=n=>rows.filter(r=>t-dateValue(r.fecha)<n*86400000&&t>=dateValue(r.fecha)).map(r=>r.valor);
 const a=windowDays(3),b=windowDays(7),c=windowDays(14),mean=z=>z.reduce((s,x)=>s+x,0)/z.length;
 return [now.valor,mean(a),mean(b),mean(c),b.length,c.length,rows.length>1?(t-dateValue(rows[rows.length-2].fecha))/86400000:30];
}
function estimate(cfg,rows,horizon){
 const last=rows[rows.length-1].valor;
 const m=SVR_MODELS[cfg.id]?.[String(horizon)];
 if(!m)return last;
 if(!m.sv.length)return m.intercept;
 const x=vector(rows).map((v,i)=>(v-m.mean[i])/(m.scale[i]||1));
 return m.intercept+m.sv.reduce((sum,sv,i)=>{
   const dist=sv.reduce((a,v,j)=>a+(x[j]-v)**2,0);
   return sum+m.dual[i]*Math.exp(-m.gamma*dist);
 },0);
}
function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function renderChart(host,daily,p1,p7,lastDate){
    if(!host) return;
    const recent=daily.slice(-24);
    if(!recent.length){host.innerHTML='<div class="ptab-ml-empty">No hay histórico suficiente para graficar.</div>';return;}

    const W=900,H=260,ml=50,mr=24,mt=20,mb=44;
    const actualVals=recent.map(x=>x.valor).filter(Number.isFinite);
    const predVals=[p1,p7].filter(Number.isFinite);
    let ymin=Math.min(...actualVals,...predVals)-0.18, ymax=Math.max(...actualVals,...predVals)+0.18;
    if(ymax-ymin<0.45){const c=(ymax+ymin)/2;ymin=c-.225;ymax=c+.225;}
    ymin=Math.max(0,ymin);ymax=Math.min(14,ymax);
    const allDates=[...recent.map(x=>dateValue(x.fecha)),dateValue(future(lastDate,1)),dateValue(future(lastDate,7))];
    const xmin=Math.min(...allDates),xmax=Math.max(...allDates);
    const sx=t=>ml+(t-xmin)/(xmax-xmin||1)*(W-ml-mr);
    const sy=v=>mt+(ymax-v)/(ymax-ymin||1)*(H-mt-mb);

    const actualPts=recent.map(x=>`${sx(dateValue(x.fecha)).toFixed(1)},${sy(x.valor).toFixed(1)}`).join(' ');
    const last=recent[recent.length-1];
    const future1=future(lastDate,1),future7=future(lastDate,7);
    const projPts=[
      `${sx(dateValue(last.fecha)).toFixed(1)},${sy(last.valor).toFixed(1)}`,
      `${sx(dateValue(future1)).toFixed(1)},${sy(p1).toFixed(1)}`,
      `${sx(dateValue(future7)).toFixed(1)},${sy(p7).toFixed(1)}`
    ].join(' ');
    const grid=[];
    for(let k=0;k<4;k++){
      const v=ymin+(ymax-ymin)*k/3, y=sy(v);
      grid.push(`<line x1="${ml}" x2="${W-mr}" y1="${y}" y2="${y}" class="ptab-ml-grid"/><text x="${ml-9}" y="${y+4}" text-anchor="end" class="ptab-ml-axis">${fmt(v,2)}</text>`);
    }
    const tickIdx=[0,Math.floor((recent.length-1)/2),recent.length-1];
    const dateTicks=tickIdx.map(i=>{
      const r=recent[i],x=sx(dateValue(r.fecha));
      return `<text x="${x}" y="${H-13}" text-anchor="middle" class="ptab-ml-axis">${datestr(r.fecha).slice(0,5)}</text>`;
    }).join('');
    const p1x=sx(dateValue(future1)),p1y=sy(p1),p7x=sx(dateValue(future7)),p7y=sy(p7);
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      ${grid.join('')}
      <polyline points="${actualPts}" class="ptab-ml-line-real"/>
      ${recent.map(x=>`<circle cx="${sx(dateValue(x.fecha))}" cy="${sy(x.valor)}" r="2.6" class="ptab-ml-dot-real"/>`).join('')}
      <polyline points="${projPts}" class="ptab-ml-line-pred"/>
      <circle cx="${p1x}" cy="${p1y}" r="5" class="ptab-ml-dot-pred"/>
      <circle cx="${p7x}" cy="${p7y}" r="5" class="ptab-ml-dot-pred"/>
      <text x="${p1x}" y="${Math.max(15,p1y-10)}" text-anchor="middle" class="ptab-ml-pred-label">+1 d · ${fmt(p1,2)}</text>
      <text x="${p7x}" y="${Math.max(15,p7y-10)}" text-anchor="middle" class="ptab-ml-pred-label">+7 d · ${fmt(p7,2)}</text>
      ${dateTicks}
      <text x="${p1x}" y="${H-13}" text-anchor="middle" class="ptab-ml-axis ptab-ml-axis-future">${datestr(future1).slice(0,5)}</text>
      <text x="${p7x}" y="${H-13}" text-anchor="middle" class="ptab-ml-axis ptab-ml-axis-future">${datestr(future7).slice(0,5)}</text>
    </svg>`;
  }

function install(cfg){
 const card=document.createElement('section');card.className='card ptab-ml-card mb';card.id='cep-model-'+cfg.id;
 card.innerHTML='<div class="ptab-ml-head"><div><span class="ptab-ml-kicker">PREDICCIÓN EXPERIMENTAL · SERIE TEMPORAL</span><h3>'+cfg.label+'</h3><p>Histórico de Agua cruda · Pozo #2. Valores promedio de las lecturas diarias disponibles.</p></div><label class="ptab-ml-toggle"><input type="checkbox" role="switch" aria-label="Mostrar predicción de '+cfg.name+'"><span class="ptab-ml-toggle-ui" aria-hidden="true"></span><span class="ptab-ml-toggle-text">Mostrar predicción</span></label></div><div class="ptab-ml-body" hidden><div class="ptab-ml-state"></div><div class="ptab-ml-kpis"></div><div class="ptab-ml-chart-wrap"><div class="ptab-ml-chart-head"><div><strong>Histórico reciente y proyección</strong><span>Promedio diario de las lecturas disponibles</span></div><span class="ptab-ml-model-chip">Ensamble SVR · RBF</span></div></div><div class="ptab-ml-chart"></div></div><div class="ptab-ml-foot"></div></div>';
 HOST.appendChild(card);const toggle=card.querySelector('input'),body=card.querySelector('.ptab-ml-body');try{toggle.checked=localStorage.getItem('preinca_ml_'+cfg.id)==='1';}catch(e){}
 function render(){body.hidden=!toggle.checked;card.classList.toggle('is-enabled',toggle.checked);if(!toggle.checked)return;const rows=daily(cfg.id),state=card.querySelector('.ptab-ml-state'),k=card.querySelector('.ptab-ml-kpis'),chart=card.querySelector('.ptab-ml-chart'),foot=card.querySelector('.ptab-ml-foot');
 if(rows.length<14){state.textContent='Histórico insuficiente: se necesitan al menos 14 días con mediciones.';k.innerHTML='';chart.innerHTML='';foot.textContent='';return;}
 const last=rows[rows.length-1],p1=estimate(cfg,rows,1),p7=estimate(cfg,rows,7);
 state.innerHTML='<span class="ptab-ml-state-chip ok">Estimación disponible</span><span>Último dato: '+datestr(last.fecha)+' · '+rows.length+' días con medición disponibles.</span>';
 const box=(name,value,desc,err)=>'<article class="ptab-ml-kpi"><span>'+name+'</span><strong>'+fmt(value)+' <small>'+cfg.unit+'</small></strong><small>'+desc+'</small>'+(err?'<em>MAE de validación: '+fmt(err.mae)+' '+cfg.unit+'</em>':'')+'</article>';
 k.innerHTML=box('Último valor medido',last.valor,datestr(last.fecha),null)+box('Predicción día siguiente',p1,datestr(future(last.fecha,1)),cfg.validation['1'])+box('Predicción a 7 días',p7,datestr(future(last.fecha,7)),cfg.validation['7']);
 renderChart(chart,rows,p1,p7,last.fecha);
 foot.textContent='Validación cronológica y modelos scikit-learn: agosto–octubre de 2026 (hasta 20/10/2026). Validación cronológica: +1 día '+cfg.validation['1'].method+' (MAE '+fmt(cfg.validation['1'].mae)+' '+cfg.unit+', n='+cfg.validation['1'].n+'); +7 días '+cfg.validation['7'].method+' (MAE '+fmt(cfg.validation['7'].mae)+' '+cfg.unit+', n='+cfg.validation['7'].n+'). No se reentrena automáticamente al cargar nuevos datos. Estas estimaciones no sustituyen la medición real.';
 }
 toggle.addEventListener('change',()=>{try{localStorage.setItem('preinca_ml_'+cfg.id,toggle.checked?'1':'0');}catch(e){}render()});return render;
}
const renders=CONFIG.map(install);
function update(){renders.forEach(f=>f())}
window.addEventListener('preinca:drive-actualizado',update);
const prior=typeof pintarPtabr==='function'?pintarPtabr:null;
if(prior){pintarPtabr=function(){const v=prior.apply(this,arguments);queueMicrotask(update);return v;};}
setTimeout(update,250);
})();
