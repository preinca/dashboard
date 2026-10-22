/* PTAB Pozo #2 · predicción experimental; modelos validados sin fuga temporal. */
(function(){
'use strict';
const HOST=document.getElementById('cep-ptab-predictions');if(!HOST)return;
const CONFIG=[
 {id:'ptab_01',name:'Presión',unit:'psi',label:'Presión (psi) · Pozo 2',validation:{'1':{mae:2.1,n:10,method:'Persistencia'},'7':{mae:3.0714,n:7,method:'Persistencia'}}},
 {id:'ptab_02',name:'Caudal',unit:'L/s',label:'Caudal (l/s) · Pozo 2',validation:{'1':{mae:.2231,n:13,method:'Persistencia'},'7':{mae:.4724,n:6,method:'Ridge regularizado'}}}
];
const ridge7={mean:[14.016944444444443,14.085787037037035,14.14046693121693,14.015390542328042,4.722222222222222,7.722222222222222,1.7222222222222223],scale:[.2656916492273246,.2051599933141282,.1814562014850286,.4962911693997586,2.2061921835183087,2.103054803416411,2.049540749521858],coef:[.0009238134406014765,-.007441430560321879,-.012114550941751599,-.02793144398024879,.08873758913960449,.07453693440309295,.04727192250978675],intercept:14.071388888888889};
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
 const val=rows[rows.length-1].valor;if(cfg.id!=='ptab_02'||horizon!==7)return val;
 const x=vector(rows);
 return ridge7.intercept+ridge7.coef.reduce((s,c,i)=>s+c*(x[i]-ridge7.mean[i])/(ridge7.scale[i]||1),0);
}
function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function graph(rows,p1,p7,unit){
 const sample=rows.slice(-24), values=[...sample.map(r=>r.valor),p1,p7],low=Math.min(...values),high=Math.max(...values),pad=(high-low)*.15||1;
 const lo=Math.max(0,low-pad),hi=high+pad,start=dateValue(sample[0].fecha),end=dateValue(future(rows[rows.length-1].fecha,7)),sx=d=>35+(dateValue(d)-start)/(end-start||1)*820,sy=n=>16+(hi-n)/(hi-lo)*184;
 const real=sample.map(r=>sx(r.fecha).toFixed(1)+','+sy(r.valor).toFixed(1)).join(' ');
 const last=rows[rows.length-1],predict=[last.fecha,future(last.fecha,1),future(last.fecha,7)].map((d,i)=>sx(d).toFixed(1)+','+sy([last.valor,p1,p7][i]).toFixed(1)).join(' ');
 return '<svg viewBox="0 0 900 240" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Valores históricos y pronóstico '+escapeText(unit)+'" style="width:100%;max-height:260px"><polyline points="'+real+'" fill="none" stroke="#2563a4" stroke-width="3"/><polyline points="'+predict+'" fill="none" stroke="#d47927" stroke-width="3" stroke-dasharray="8 5"/><text x="20" y="15" font-size="16" fill="currentColor">'+fmt(hi)+' '+escapeText(unit)+'</text><text x="20" y="222" font-size="16" fill="currentColor">'+fmt(lo)+' '+escapeText(unit)+'</text></svg>';
}
function install(cfg){
 const card=document.createElement('section');card.className='card ptab-ml-card mb';card.id='cep-model-'+cfg.id;
 card.innerHTML='<div class="ptab-ml-head"><div><span class="ptab-ml-kicker">PREDICCIÓN EXPERIMENTAL · SERIE TEMPORAL</span><h3>'+cfg.label+'</h3><p>Histórico de Agua cruda · Pozo #2. Valores promedio de las lecturas diarias disponibles.</p></div><label class="ptab-ml-toggle"><input type="checkbox" role="switch" aria-label="Mostrar predicción de '+cfg.name+'"><span class="ptab-ml-toggle-ui" aria-hidden="true"></span><span class="ptab-ml-toggle-text">Mostrar predicción</span></label></div><div class="ptab-ml-body" hidden><div class="ptab-ml-state"></div><div class="ptab-ml-kpis"></div><div class="ptab-ml-chart-wrap"><div class="ptab-ml-chart-head"><div><strong>Histórico reciente y proyección</strong><span>Predicción a +1 y +7 días calendario</span></div></div><div class="ptab-ml-chart"></div></div><div class="ptab-ml-foot"></div></div>';
 HOST.appendChild(card);const toggle=card.querySelector('input'),body=card.querySelector('.ptab-ml-body');try{toggle.checked=localStorage.getItem('preinca_ml_'+cfg.id)==='1';}catch(e){}
 function render(){body.hidden=!toggle.checked;card.classList.toggle('is-enabled',toggle.checked);if(!toggle.checked)return;const rows=daily(cfg.id),state=card.querySelector('.ptab-ml-state'),k=card.querySelector('.ptab-ml-kpis'),chart=card.querySelector('.ptab-ml-chart'),foot=card.querySelector('.ptab-ml-foot');
 if(rows.length<14){state.textContent='Histórico insuficiente: se necesitan al menos 14 días con mediciones.';k.innerHTML='';chart.innerHTML='';foot.textContent='';return;}
 const last=rows[rows.length-1],p1=estimate(cfg,rows,1),p7=estimate(cfg,rows,7);
 state.innerHTML='<span class="ptab-ml-state-chip ok">Estimación disponible</span><span>Último dato: '+datestr(last.fecha)+' · '+rows.length+' días con medición disponibles.</span>';
 const box=(name,value,desc,err)=>'<article class="ptab-ml-kpi"><span>'+name+'</span><strong>'+fmt(value)+' <small>'+cfg.unit+'</small></strong><small>'+desc+'</small>'+(err?'<em>MAE de validación: '+fmt(err.mae)+' '+cfg.unit+'</em>':'')+'</article>';
 k.innerHTML=box('Último valor medido',last.valor,datestr(last.fecha),null)+box('Predicción día siguiente',p1,datestr(future(last.fecha,1)),cfg.validation['1'])+box('Predicción a 7 días',p7,datestr(future(last.fecha,7)),cfg.validation['7']);
 chart.innerHTML=graph(rows,p1,p7,cfg.unit);
 foot.textContent='Entrenado con registros de agosto–octubre de 2026 (hasta 20/10/2026). Validación cronológica: +1 día '+cfg.validation['1'].method+' (MAE '+fmt(cfg.validation['1'].mae)+' '+cfg.unit+', n='+cfg.validation['1'].n+'); +7 días '+cfg.validation['7'].method+' (MAE '+fmt(cfg.validation['7'].mae)+' '+cfg.unit+', n='+cfg.validation['7'].n+'). No se reentrena automáticamente al cargar nuevos datos. Estas estimaciones no sustituyen la medición real.';
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
