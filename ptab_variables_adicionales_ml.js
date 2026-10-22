/* PTAB: 4 variables adicionales, entrenamiento causal y validación temporal. */
(function(){
'use strict';
const host=document.getElementById('cep-ptab-predictions');
if(!host)return;
const CONFIG=[
 {id:'ptab_08',key:'pozo3-caudal',name:'Caudal',unit:'L/s',place:'Pozo #3'},
 {id:'ptab_13',key:'tanque-nivel',name:'Nivel TQ',unit:'%',place:'Tanque Subterráneo'},
 {id:'ptab_15',key:'tanque-tds',name:'TDS',unit:'mg/L',place:'Tanque Subterráneo'},
 {id:'ptab_16',key:'tanque-turbidez',name:'Turbidez',unit:'NTU',place:'Tanque Subterráneo'}
];
const DAY=86400000,fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('es-VE',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
function dateValue(d){return Date.parse(d+'T00:00:00Z');}
function future(d,n){return new Date(dateValue(d)+n*DAY).toISOString().slice(0,10);}
function datestr(d){return d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4);}
function num(v){
 if(v===null||v===undefined||String(v).trim()==='')return null;
 const t=String(v).trim().replace(/\s/g,'');let n=Number(t);
 if(!Number.isFinite(n))n=Number(t.replace(',','.'));
 return Number.isFinite(n)&&n>=0?n:null;
}
function daily(id){
 if(typeof PTABR_DATA==='undefined'||!Array.isArray(PTABR_DATA))return [];
 const map=new Map();
 for(const r of PTABR_DATA){if(r.id!==id||!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha||''))continue;
 const v=num(r.valor);if(v===null)continue;
 if(!map.has(r.fecha))map.set(r.fecha,[]);map.get(r.fecha).push(v);
 }
 return [...map].map(([fecha,a])=>({fecha,valor:a.reduce((x,y)=>x+y,0)/a.length})).sort((a,b)=>a.fecha.localeCompare(b.fecha));
}
function features(rows,i){
 const cur=rows[i], t=dateValue(cur.fecha);
 const within=n=>rows.slice(0,i+1).filter(r=>t-dateValue(r.fecha)<DAY*n).map(r=>r.valor);
 const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
 const w3=within(3),w7=within(7),w14=within(14);
 return [cur.valor,avg(w3),avg(w7),avg(w14),w7.length,w14.length,
 i>0?(t-dateValue(rows[i-1].fecha))/DAY:30];
}
function targetPairs(rows,h){
 const lookup=new Map(rows.map(r=>[r.fecha,r.valor]));const out=[];
 for(let i=5;i<rows.length;i++){const y=lookup.get(future(rows[i].fecha,h));if(y===undefined)continue;out.push({x:features(rows,i),y,date:rows[i].fecha});}
 return out;
}
function standardize(pairs){
 const len=pairs[0].x.length,mean=[],scale=[];
 for(let i=0;i<len;i++){const a=pairs.map(p=>p.x[i]),m=a.reduce((x,y)=>x+y,0)/a.length;
 const v=Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length)||1;mean.push(m);scale.push(v);}
 return {mean,scale,transform:x=>x.map((v,j)=>(v-mean[j])/scale[j])};
}
function solve(matrix,values){
 const n=values.length,a=matrix.map((r,i)=>[...r,values[i]]);
 for(let k=0;k<n;k++){
 let pivot=k;for(let j=k+1;j<n;j++)if(Math.abs(a[j][k])>Math.abs(a[pivot][k]))pivot=j;
 [a[k],a[pivot]]=[a[pivot],a[k]];
 let v=a[k][k];if(Math.abs(v)<1e-10)return null;
 for(let j=k;j<=n;j++)a[k][j]/=v;
 for(let i=0;i<n;i++)if(i!==k){const factor=a[i][k];for(let j=k;j<=n;j++)a[i][j]-=factor*a[k][j];}
 }
 return a.map(r=>r[n]);
}
function fitKrr(pairs,gamma,lambda){
 const stats=standardize(pairs),x=pairs.map(p=>stats.transform(p.x));
 const meanY=pairs.reduce((s,p)=>s+p.y,0)/pairs.length;
 const kernel=(a,b)=>Math.exp(-gamma*a.reduce((s,v,i)=>s+(v-b[i])**2,0));
 const A=x.map((xi,i)=>x.map((xj,j)=>kernel(xi,xj)+(i===j?lambda:0)));
 const weights=solve(A,pairs.map(p=>p.y-meanY));
 if(!weights)return null;
 return v=>{const z=stats.transform(v);return meanY+x.reduce((s,xi,i)=>s+weights[i]*kernel(z,xi),0);};
}
function predictor(pairs,method){
 if(method==='last')return x=>x[0];
 if(method==='mean3')return x=>x[1];
 const [,gamma,lambda]=method.split(':');return fitKrr(pairs,+gamma,+lambda);
}
function train(rows,h){
 const pairs=targetPairs(rows,h);
 if(pairs.length<14)return {mae:null,n:0,predict:x=>x[0],method:'Referencia temporal',samples:pairs.length};
 const nval=Math.max(4,Math.min(12,Math.floor(pairs.length*.23))),cut=pairs.length-nval;
 const train=pairs.slice(0,cut),valid=pairs.slice(cut);
 const methods=['last','mean3','krr:0.05:0.5','krr:0.2:0.5','krr:0.05:2','krr:0.2:2'];
 let best=null;
 for(const m of methods){const model=predictor(train,m);if(!model)continue;
 const errors=valid.map(p=>Math.abs(model(p.x)-p.y));const mae=errors.reduce((a,b)=>a+b,0)/errors.length;
 if(!best||mae<best.mae)best={method:m,mae,n:nval};
 }
 if(!best)return {mae:null,n:0,predict:x=>x[0],method:'Referencia temporal',samples:pairs.length};
 return {...best,predict:predictor(pairs,best.method),samples:pairs.length};
}
function renderChart(host,daily,p1,p7,lastDate){
    if(!host) return;
    const recent=daily.slice(-24);
    if(!recent.length){host.innerHTML='<div class="ptab-ml-empty">No hay histórico suficiente para graficar.</div>';return;}

    const W=900,H=260,ml=50,mr=24,mt=20,mb=44;
    const actualVals=recent.map(x=>x.valor).filter(Number.isFinite);
    const predVals=[p1,p7].filter(Number.isFinite);
    // Escala propia de cada variable (no aplicar el rango 0–14 del pH).
    const minVal=Math.min(...actualVals,...predVals),maxVal=Math.max(...actualVals,...predVals);
    const margin=Math.max((maxVal-minVal)*0.16,Math.abs(maxVal)*0.025,0.05);
    let ymin=Math.max(0,minVal-margin),ymax=maxVal+margin;
    if(ymax<=ymin)ymax=ymin+1;
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
    const tickIdx=[0,Math.floor((recent.length-1)/2)];
    const dateTicks=tickIdx.map(i=>{
      const r=recent[i],x=sx(dateValue(r.fecha));
      return `<text x="${x}" y="${H-13}" text-anchor="middle" class="ptab-ml-axis">${r.fecha.slice(8,10)+'/'+r.fecha.slice(5,7)}</text>`;
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
      <text x="${p1x}" y="${H-30}" text-anchor="middle" class="ptab-ml-axis ptab-ml-axis-future">${future1.slice(8,10)+'/'+future1.slice(5,7)}</text>
      <text x="${p7x}" y="${H-13}" text-anchor="middle" class="ptab-ml-axis ptab-ml-axis-future">${future7.slice(8,10)+'/'+future7.slice(5,7)}</text>
    </svg>`;
  }


const renders=[];
for(const cfg of CONFIG){
 const card=document.createElement('section');card.className='card ptab-ml-card cep-ml-card mb';card.id='cep-model-'+cfg.id;card.dataset.mlId=cfg.key;
 card.innerHTML='<div class="ptab-ml-head"><div><span class="ptab-ml-kicker">PREDICCIÓN DE VARIABLES CON IA</span><h3>Predicción de '+cfg.name+' ('+cfg.unit+') · PTAB · Agua cruda · '+cfg.place+'</h3><p>Área: <strong>PTAB · Agua cruda · '+cfg.place+'</strong> · '+cfg.name+' ('+cfg.unit+').</p></div></div><div class="ptab-ml-body"><div class="ptab-ml-state"></div><div class="ptab-ml-kpis"></div><div class="ptab-ml-chart-wrap"><div class="ptab-ml-chart-head"><div><strong>Comportamiento reciente y proyección</strong><span>Promedio diario de las lecturas disponibles</span></div></div><div class="ptab-ml-chart"></div></div></div>';
 host.appendChild(card);
 let lastSignature='';
 renders.push(function render(){
  const rows=daily(cfg.id),status=card.querySelector('.ptab-ml-state'),kpis=card.querySelector('.ptab-ml-kpis'),chart=card.querySelector('.ptab-ml-chart');
  if(rows.length<15){status.innerHTML='<span class="ptab-ml-state-chip warn">Histórico insuficiente</span><span>Se necesitan más mediciones para estimar la variable.</span>';kpis.innerHTML='';chart.innerHTML='';return;}
  const signature=rows.map(r=>r.fecha+':'+r.valor).join('|');
  if(signature===lastSignature)return;lastSignature=signature;
  const one=train(rows,1),week=train(rows,7),last=rows[rows.length-1],fv=features(rows,rows.length-1);
  const p1=Math.max(0,one.predict(fv)),p7=Math.max(0,week.predict(fv));
  const mae=t=>t.mae===null?'Validación insuficiente':'MAE de validación: '+fmt(t.mae)+' '+cfg.unit+' (n='+t.n+')';
  status.innerHTML='<span class="ptab-ml-state-chip ok">Estimación disponible</span><span>Último dato disponible: '+datestr(last.fecha)+' · '+rows.length+' días con medición.</span>';
  function box(label,val,detail,metric){
   return '<article class="ptab-ml-kpi'+(metric?' ok':'')+'"><span>'+label+'</span><strong>'+fmt(val)+' <small>'+cfg.unit+'</small></strong><small>'+detail+'</small>'+(metric?'<em>'+mae(metric)+'</em>':'')+'</article>';
  }
  kpis.innerHTML=box('Último valor real',last.valor,datestr(last.fecha))+box('Predicción día siguiente',p1,datestr(future(last.fecha,1)),one)+box('Predicción a 7 días',p7,datestr(future(last.fecha,7)),week);
  renderChart(chart,rows,p1,p7,last.fecha);
 });
}
function refresh(){renders.forEach(fn=>{try{fn();}catch(e){console.error('Predicción adicional PTAB',e);}});}
window.addEventListener('preinca:drive-actualizado',refresh);
document.getElementById('drive-refresh-btn')?.addEventListener('click',()=>setTimeout(refresh,1000));
const prev=typeof pintarPtabr==='function'?pintarPtabr:null;
if(prev){pintarPtabr=function(){const res=prev.apply(this,arguments);queueMicrotask(refresh);return res;};}
setTimeout(refresh,300);
})();
