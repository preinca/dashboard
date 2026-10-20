/* Puntos interactivos PTAR — mismos identificadores del catálogo operacional. */
(function(){
'use strict';
const points=[
 {name:'Fosa de entrada',color:'#b927d5',x:8.0,y:41.1,ids:['pre_fosa_ph','pre_fosa_sst']},
 {name:'Homogeneizadores',color:'#22cbd0',x:32.3,y:44.3,ids:['lodo_hom']},
 {name:'Tanques de homogenización',color:'#1b65cf',x:33.3,y:40.2,ids:['pre_hom_nivel','pre_hom_ph','pre_hom_caudal','pre_hom_dqo','pre_hom_sst','pre_hom_nt','pre_hom_pt']},
 {name:'DAF primario',color:'#37d338',x:51.1,y:35.2,ids:['prim_ph','prim_dqo','prim_sst','prim_nt','prim_pt']},
 {name:'Reactor biológico',color:'#ef8b17',x:58.1,y:41.4,ids:['bio_reactor_ph','bio_reactor_od','bio_reactor_sv30','bio_reactor_ssvlm']},
 {name:'DAF secundario',color:'#ea2027',x:73.1,y:42.2,ids:['bio_daf_ph','bio_daf_caudal','bio_daf_recir','bio_daf_dqo','bio_daf_sst','bio_daf_sed','bio_daf_nt','bio_daf_pt','lodo_daf2']},
 {name:'Canal Parshall',color:'#e2dd08',x:79.6,y:59.8,ids:['lodo_parshall']},
 {name:'Espesador de lodos',color:'#171717',x:47.6,y:71.9,ids:['lodo_conc']}
];
const root=document.getElementById('ptar-diagrama-stage');
if(!root)return;
const panel=document.getElementById('ptar-diagrama-panel');
const normal=document.getElementById('ptar-operacion-panel');
const btn=document.getElementById('ptar-open-diagrama');
const back=document.getElementById('ptar-back-operacion');
const tooltip=document.getElementById('ptar-diagrama-tooltip');
const badge=document.getElementById('ptar-diagrama-fecha');
function latestDate(){
 if(typeof PTAR_DATA==='undefined')return null;
 const dates=[...new Set(PTAR_DATA.filter(r=>r.fecha&&typeof tieneLecturaPTAR==='function'&&tieneLecturaPTAR(r.valor)).map(r=>r.fecha))].sort();
 return dates[dates.length-1]||null;
}
function safe(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function content(point){
 const date=latestDate(), records=date?PTAR_DATA.filter(r=>r.fecha===date&&point.ids.includes(r.id)):[];
 const cells=point.ids.map(id=>{
  const def=typeof ptarDefPorId==='function'?ptarDefPorId(id):null;
  const values=records.filter(r=>r.id===id&&tieneLecturaPTAR(r.valor));
  const detail=values.length?values.map(r=>'<span class="ptar-diag-reading">'+safe(r.turno||'Lectura')+': <strong>'+safe(typeof valorTextoPTAR==='function'?valorTextoPTAR(r):r.valor)+'</strong>'+safe(def?.unidad?' '+def.unidad:'')+'</span>').join(''):'<span class="ptar-diag-empty">Sin datos</span>';
  const status=values.some(r=>typeof estadoRegistroPTAR==='function'&&estadoRegistroPTAR(r)==='FUERA DE RANGO')?' ptar-diag-alert':'';
  return '<div class="ptar-diag-variable'+status+'"><div><strong>'+safe(def?.variable||id)+'</strong><small>Rango: '+safe(def?.rango&&def.rango!=='—'?def.rango+(def.unidad?' '+def.unidad:''):'No establecido')+'</small></div><div class="ptar-diag-values">'+detail+'</div></div>';
 }).join('');
 return '<h4>'+safe(point.name)+'</h4><p>Último día con lecturas: '+safe(date?date.split('-').reverse().join('/'):'Sin registros')+'</p>'+cells;
}
function show(point,button){
 tooltip.innerHTML=content(point);
 tooltip.hidden=false;
 const stage=root.getBoundingClientRect(),node=button.getBoundingClientRect();
 const x=node.left-stage.left+node.width/2,y=node.top-stage.top;
 tooltip.style.left=Math.min(Math.max(x,200),Math.max(200,stage.width-200))+'px';
 tooltip.style.top=Math.max(10,y-8)+'px';
 tooltip.classList.toggle('ptar-diag-tooltip-below',y<220);
}
function hide(){tooltip.hidden=true;}
points.forEach(point=>{
 const b=document.createElement('button');b.type='button';b.className='ptar-diag-point';b.style.left=point.x+'%';b.style.top=point.y+'%';b.style.setProperty('--dot-color',point.color);
 b.setAttribute('aria-label','Ver lecturas de '+point.name);
 b.innerHTML='<span aria-hidden="true"></span>';
 b.addEventListener('mouseenter',()=>show(point,b));
 b.addEventListener('focus',()=>show(point,b));
 b.addEventListener('mouseleave',hide);b.addEventListener('blur',hide);
 b.addEventListener('click',()=>{if(!tooltip.hidden&&tooltip.dataset.current===point.name){hide();tooltip.dataset.current='';}else{show(point,b);tooltip.dataset.current=point.name;}});
 root.appendChild(b);
});
function refreshDate(){const d=latestDate();badge.textContent='Datos más recientes: '+(d?d.split('-').reverse().join('/'):'Sin registros');}
btn?.addEventListener('click',()=>{normal.hidden=true;panel.hidden=false;refreshDate();hide();});
back?.addEventListener('click',()=>{panel.hidden=true;normal.hidden=false;hide();});
})();
