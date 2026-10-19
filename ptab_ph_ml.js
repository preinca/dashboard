/* =========================================================
   PTAB · Predicción experimental de pH (Tanque Subterráneo)
   - Solo variable ptab_14
   - La inferencia usa el histórico ya cargado en PTABR_DATA
   - El modelo fue entrenado offline con scikit-learn
   ========================================================= */
(function(){
  'use strict';

  const MODEL = window.PTAB_PH_ML_MODEL;
  if(!MODEL) return;

  const VAR_ID = MODEL.variableId || 'ptab_14';
  const STORAGE_KEY = 'preinca_ptab_ph_ml_enabled_v1';
  const MAX_CHART_POINTS = 24;

  function num(v){
    if(v===null || v===undefined || v==='') return null;
    if(typeof v==='number') return Number.isFinite(v) ? v : null;
    let s=String(v).trim().replace(/\s/g,'');
    if(!s) return null;
    if(s.includes(',') && s.includes('.')){
      if(s.lastIndexOf(',') > s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.');
      else s=s.replace(/,/g,'');
    }else if(s.includes(',')) s=s.replace(',','.');
    const n=Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function isoDateToUtc(s){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));
    return m ? Date.UTC(+m[1],+m[2]-1,+m[3]) : NaN;
  }
  function utcToIso(ms){ return new Date(ms).toISOString().slice(0,10); }
  function addDays(iso,n){ const t=isoDateToUtc(iso); return Number.isFinite(t) ? utcToIso(t+n*86400000) : ''; }
  function fmtDate(iso){
    const t=isoDateToUtc(iso); if(!Number.isFinite(t)) return String(iso||'—');
    return new Intl.DateTimeFormat('es-VE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(t));
  }
  function fmt(v,d=2){
    if(!Number.isFinite(v)) return '—';
    return v.toLocaleString('es-VE',{minimumFractionDigits:d,maximumFractionDigits:d});
  }

  function mean(a){ return a.length ? a.reduce((x,y)=>x+y,0)/a.length : NaN; }
  function std(a){
    if(!a.length) return NaN;
    const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length);
  }

  function collectDaily(){
    if(typeof PTABR_DATA==='undefined' || !Array.isArray(PTABR_DATA)) return [];
    const byDate=new Map();
    PTABR_DATA.forEach(r=>{
      if(!r || r.id!==VAR_ID) return;
      const fecha=String(r.fecha||'').slice(0,10);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
      const v=num(r.valor);
      if(v===null || v<0 || v>14) return;
      if(!byDate.has(fecha)) byDate.set(fecha,[]);
      byDate.get(fecha).push(v);
    });
    return [...byDate.entries()]
      .map(([fecha,values])=>({fecha,valor:mean(values),lecturas:values.length}))
      .sort((a,b)=>a.fecha.localeCompare(b.fecha));
  }

  function buildFeatureVector(daily){
    if(!daily.length) return null;
    const obs=new Map(daily.map(x=>[x.fecha,x]));
    const first=daily[0].fecha, last=daily[daily.length-1].fecha;
    let t0=isoDateToUtc(first), t1=isoDateToUtc(last);
    if(!Number.isFinite(t0)||!Number.isFinite(t1)||t1<t0) return null;

    const dates=[], values=[], observed=[];
    let lastVal=null;
    for(let t=t0;t<=t1;t+=86400000){
      const d=utcToIso(t), row=obs.get(d);
      if(row){ lastVal=row.valor; observed.push(true); }
      else observed.push(false);
      dates.push(d); values.push(lastVal);
    }
    const i=values.length-1;
    if(i<14 || !Number.isFinite(values[i])) return null;
    const slice=(n)=>values.slice(i-n+1,i+1).filter(Number.isFinite);
    const coverage=(n)=>{
      let c=0; for(let j=Math.max(0,i-n+1);j<=i;j++) if(observed[j]) c++;
      return c/n;
    };
    const lag=k=>values[i-k];
    const w3=slice(3),w7=slice(7),w14=slice(14);
    const dateObj=new Date(isoDateToUtc(dates[i]));
    const dow=(dateObj.getUTCDay()+6)%7;
    const features=[
      lag(0),lag(1),lag(2),lag(3),lag(7),lag(14),
      mean(w3),mean(w7),mean(w14),std(w3),std(w7),std(w14),
      lag(0)-lag(1),lag(0)-lag(3),lag(0)-lag(7),
      coverage(3),coverage(7),coverage(14),
      Math.sin(2*Math.PI*dow/7),Math.cos(2*Math.PI*dow/7),
      i/values.length
    ];
    if(features.some(v=>!Number.isFinite(v))) return null;
    return {features,lastDate:last,lastValue:daily[daily.length-1].valor};
  }

  function predictOne(horizon,features){
    const cfg=MODEL.horizons && MODEL.horizons[String(horizon)];
    if(!cfg) return null;
    const mu=cfg.scaler.mean, sc=cfg.scaler.scale, sv=cfg.svr.supportVectors, dc=cfg.svr.dualCoef;
    const x=features.map((v,i)=>(v-mu[i])/(sc[i]||1));
    let sum=cfg.svr.intercept;
    for(let i=0;i<sv.length;i++){
      let dist=0;
      for(let j=0;j<x.length;j++){ const d=x[j]-sv[i][j]; dist+=d*d; }
      sum += dc[i]*Math.exp(-cfg.svr.gamma*dist);
    }
    const ens=cfg.ensemble||{svrWeight:1,baselineWeight:0,baselineFeatureIndex:0};
    const base=features[ens.baselineFeatureIndex] ?? features[0];
    return ens.svrWeight*sum + ens.baselineWeight*base;
  }

  function statusFor(v){
    const lo=MODEL.operatingRange.min, hi=MODEL.operatingRange.max;
    if(!Number.isFinite(v)) return {cls:'neutral',txt:'Sin estimación'};
    if(v<lo || v>hi) return {cls:'bad',txt:'Fuera de rango previsto'};
    return {cls:'ok',txt:'Dentro del rango previsto'};
  }

  function ensureCard(){
    const view=document.getElementById('cep-ptab-predictions');
    if(!view) return null;
    let card=document.getElementById('ptab-ph-ml-card');
    if(card) return card;
    card=document.createElement('section');
    card.id='ptab-ph-ml-card';
    card.className='card ptab-ml-card mb';
    card.innerHTML=`
      <div class="ptab-ml-head">
        <div>
          <span class="ptab-ml-kicker">IA EXPERIMENTAL · MACHINE LEARNING</span>
          <h3>Predicción de pH · Tanque Subterráneo</h3>
          <p>Estimación basada en el histórico real de <strong>PTAB · Agua cruda · pH (Adim)</strong>.</p>
        </div>
        <label class="ptab-ml-toggle">
          <input type="checkbox" id="ptab-ph-ml-toggle" role="switch" aria-controls="ptab-ph-ml-body">
          <span class="ptab-ml-toggle-ui" aria-hidden="true"></span>
          <span class="ptab-ml-toggle-text">Mostrar predicción</span>
        </label>
      </div>
      <div class="ptab-ml-body" id="ptab-ph-ml-body" hidden>
        <div class="ptab-ml-state" id="ptab-ph-ml-state"></div>
        <div class="ptab-ml-kpis" id="ptab-ph-ml-kpis"></div>
        <div class="ptab-ml-chart-wrap">
          <div class="ptab-ml-chart-head">
            <div><strong>Comportamiento reciente y proyección</strong><span>Promedio diario de las lecturas disponibles</span></div>
            <span class="ptab-ml-model-chip">Ensamble SVR · RBF</span>
          </div>
          <div class="ptab-ml-chart" id="ptab-ph-ml-chart" role="img" aria-label="Histórico reciente y predicción de pH"></div>
        </div>
        <div class="ptab-ml-foot" id="ptab-ph-ml-foot"></div>
      </div>`;
    view.appendChild(card);

    const toggle=card.querySelector('#ptab-ph-ml-toggle');
    let enabled=false;
    try{ enabled=localStorage.getItem(STORAGE_KEY)==='1'; }catch(_e){}
    toggle.checked=enabled;
    toggle.addEventListener('change',()=>{
      try{localStorage.setItem(STORAGE_KEY,toggle.checked?'1':'0');}catch(_e){}
      render();
    });
    return card;
  }

  function renderChart(host,daily,p1,p7,lastDate){
    if(!host) return;
    const recent=daily.slice(-MAX_CHART_POINTS);
    if(!recent.length){host.innerHTML='<div class="ptab-ml-empty">No hay histórico suficiente para graficar.</div>';return;}

    const W=900,H=260,ml=50,mr=24,mt=20,mb=44;
    const actualVals=recent.map(x=>x.valor).filter(Number.isFinite);
    const predVals=[p1,p7].filter(Number.isFinite);
    let ymin=Math.min(...actualVals,...predVals)-0.18, ymax=Math.max(...actualVals,...predVals)+0.18;
    if(ymax-ymin<0.45){const c=(ymax+ymin)/2;ymin=c-.225;ymax=c+.225;}
    ymin=Math.max(0,ymin);ymax=Math.min(14,ymax);
    const allDates=[...recent.map(x=>isoDateToUtc(x.fecha)),isoDateToUtc(addDays(lastDate,1)),isoDateToUtc(addDays(lastDate,7))];
    const xmin=Math.min(...allDates),xmax=Math.max(...allDates);
    const sx=t=>ml+(t-xmin)/(xmax-xmin||1)*(W-ml-mr);
    const sy=v=>mt+(ymax-v)/(ymax-ymin||1)*(H-mt-mb);

    const actualPts=recent.map(x=>`${sx(isoDateToUtc(x.fecha)).toFixed(1)},${sy(x.valor).toFixed(1)}`).join(' ');
    const last=recent[recent.length-1];
    const future1=addDays(lastDate,1),future7=addDays(lastDate,7);
    const projPts=[
      `${sx(isoDateToUtc(last.fecha)).toFixed(1)},${sy(last.valor).toFixed(1)}`,
      `${sx(isoDateToUtc(future1)).toFixed(1)},${sy(p1).toFixed(1)}`,
      `${sx(isoDateToUtc(future7)).toFixed(1)},${sy(p7).toFixed(1)}`
    ].join(' ');
    const grid=[];
    for(let k=0;k<4;k++){
      const v=ymin+(ymax-ymin)*k/3, y=sy(v);
      grid.push(`<line x1="${ml}" x2="${W-mr}" y1="${y}" y2="${y}" class="ptab-ml-grid"/><text x="${ml-9}" y="${y+4}" text-anchor="end" class="ptab-ml-axis">${fmt(v,2)}</text>`);
    }
    const tickIdx=[0,Math.floor((recent.length-1)/2),recent.length-1];
    const dateTicks=tickIdx.map(i=>{
      const r=recent[i],x=sx(isoDateToUtc(r.fecha));
      return `<text x="${x}" y="${H-13}" text-anchor="middle" class="ptab-ml-axis">${fmtDate(r.fecha).slice(0,5)}</text>`;
    }).join('');
    const p1x=sx(isoDateToUtc(future1)),p1y=sy(p1),p7x=sx(isoDateToUtc(future7)),p7y=sy(p7);
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      ${grid.join('')}
      <polyline points="${actualPts}" class="ptab-ml-line-real"/>
      ${recent.map(x=>`<circle cx="${sx(isoDateToUtc(x.fecha))}" cy="${sy(x.valor)}" r="2.6" class="ptab-ml-dot-real"/>`).join('')}
      <polyline points="${projPts}" class="ptab-ml-line-pred"/>
      <circle cx="${p1x}" cy="${p1y}" r="5" class="ptab-ml-dot-pred"/>
      <circle cx="${p7x}" cy="${p7y}" r="5" class="ptab-ml-dot-pred"/>
      <text x="${p1x}" y="${Math.max(15,p1y-10)}" text-anchor="middle" class="ptab-ml-pred-label">+1 d · ${fmt(p1,2)}</text>
      <text x="${p7x}" y="${Math.max(15,p7y-10)}" text-anchor="middle" class="ptab-ml-pred-label">+7 d · ${fmt(p7,2)}</text>
      ${dateTicks}
      <text x="${p1x}" y="${H-13}" text-anchor="middle" class="ptab-ml-axis ptab-ml-axis-future">${fmtDate(future1).slice(0,5)}</text>
      <text x="${p7x}" y="${H-13}" text-anchor="middle" class="ptab-ml-axis ptab-ml-axis-future">${fmtDate(future7).slice(0,5)}</text>
    </svg>`;
  }

  function render(){
    const card=ensureCard(); if(!card) return;
    const toggle=card.querySelector('#ptab-ph-ml-toggle');
    const body=card.querySelector('#ptab-ph-ml-body');
    const enabled=!!(toggle&&toggle.checked);
    card.classList.toggle('is-enabled',enabled);
    if(body) body.hidden=!enabled;
    if(!enabled) return;

    const daily=collectDaily();
    const ctx=buildFeatureVector(daily);
    const state=card.querySelector('#ptab-ph-ml-state');
    const kpis=card.querySelector('#ptab-ph-ml-kpis');
    const chart=card.querySelector('#ptab-ph-ml-chart');
    const foot=card.querySelector('#ptab-ph-ml-foot');

    if(!ctx || daily.length<15){
      if(state) state.innerHTML='<span class="ptab-ml-state-chip warn">Histórico insuficiente</span><span>Se requieren al menos 15 días de contexto para calcular las variables de entrada.</span>';
      if(kpis) kpis.innerHTML='';
      if(chart) chart.innerHTML='<div class="ptab-ml-empty">Sin datos suficientes para ejecutar el modelo.</div>';
      if(foot) foot.textContent='';
      return;
    }

    const p1=predictOne(1,ctx.features),p7=predictOne(7,ctx.features);
    const s1=statusFor(p1),s7=statusFor(p7);
    const m1=MODEL.horizons['1'].validation,m7=MODEL.horizons['7'].validation;
    const lo=MODEL.operatingRange.min,hi=MODEL.operatingRange.max;
    const i1=[p1-m1.absError90,p1+m1.absError90],i7=[p7-m7.absError90,p7+m7.absError90];

    if(state) state.innerHTML=`<span class="ptab-ml-state-chip ok">Modelo listo</span><span>Último histórico disponible: <strong>${fmtDate(ctx.lastDate)}</strong> · ${daily.length} días con medición · ${MODEL.training.rawValidReadings} lecturas válidas usadas para el entrenamiento actual.</span>`;
    if(kpis) kpis.innerHTML=`
      <article class="ptab-ml-kpi"><span>Último valor real</span><strong>${fmt(ctx.lastValue,2)}</strong><small>${fmtDate(ctx.lastDate)}</small></article>
      <article class="ptab-ml-kpi ${s1.cls}"><span>Predicción día siguiente</span><strong>${fmt(p1,2)}</strong><small>${fmtDate(addDays(ctx.lastDate,1))} · ${s1.txt}</small><em>90 % error histórico aprox.: ${fmt(i1[0],2)}–${fmt(i1[1],2)}</em></article>
      <article class="ptab-ml-kpi ${s7.cls}"><span>Predicción a 7 días</span><strong>${fmt(p7,2)}</strong><small>${fmtDate(addDays(ctx.lastDate,7))} · ${s7.txt}</small><em>90 % error histórico aprox.: ${fmt(i7[0],2)}–${fmt(i7[1],2)}</em></article>
      <article class="ptab-ml-kpi neutral"><span>Rango operativo</span><strong>${fmt(lo,1)}–${fmt(hi,1)}</strong><small>pH adimensional</small><em>La predicción no sustituye la lectura real.</em></article>`;
    renderChart(chart,daily,p1,p7,ctx.lastDate);
    if(foot) foot.innerHTML=`
      <span><strong>Validación temporal +1 día:</strong> MAE ${fmt(m1.mae,3)} pH · RMSE ${fmt(m1.rmse,3)}</span>
      <span><strong>+7 días:</strong> MAE ${fmt(m7.mae,3)} pH · RMSE ${fmt(m7.rmse,3)}</span>
      <span><strong>Entrenamiento:</strong> ${fmtDate(MODEL.training.firstDate)}–${fmtDate(MODEL.training.lastDate)} · StandardScaler + ensamble SVR RBF</span>`;
  }

  function installHooks(){
    try{
      if(typeof pintarPtabr==='function'){
        const prev=pintarPtabr;
        pintarPtabr=function(){ const out=prev.apply(this,arguments); queueMicrotask(render); return out; };
      }
      if(typeof cargarDatosPtabr==='function'){
        const prevLoad=cargarDatosPtabr;
        cargarDatosPtabr=function(){ const out=prevLoad.apply(this,arguments); queueMicrotask(render); return out; };
      }
    }catch(err){ console.warn('PTAB ML: no se pudieron instalar todos los hooks',err); }

    document.addEventListener('change',e=>{
      if(e.target && (e.target.id==='ptab-date-select' || e.target.dataset.serviceMonth==='ptab')) queueMicrotask(render);
    });
    const refresh=document.getElementById('drive-refresh-btn');
    if(refresh) refresh.addEventListener('click',()=>setTimeout(render,700));
  }

  ensureCard();
  installHooks();
  setTimeout(render,0);
  window.PTAB_PH_ML = {render,collectDaily,predict:function(){const d=collectDaily(),c=buildFeatureVector(d);return c?{latest:c.lastDate,nextDay:predictOne(1,c.features),week:predictOne(7,c.features)}:null;}};
})();
