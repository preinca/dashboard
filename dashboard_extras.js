/* Dashboard extras V12 · Sugerencias + confirmación de fechas existentes */
(function(){
'use strict';
let SUG_ROWS=[];
const txt=v=>String(v==null?'':v).trim();
const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(txt(v))?txt(v):'';
const fmt=v=>{const s=iso(v);return s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):(txt(v)||'—');};
const esc2=v=>typeof window.esc==='function'?window.esc(v):txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setSug(raw){
  SUG_ROWS=(Array.isArray(raw)?raw:[]).map(r=>({
    ID:txt(r.ID),Fecha:txt(r.Fecha),Hora:txt(r.Hora),Nombre:txt(r.Nombre),
    Sugerencia:txt(r.Sugerencia),'Fecha de registro':txt(r['Fecha de registro'])
  })).filter(r=>r.Nombre||r.Sugerencia).sort((a,b)=>(b.Fecha+' '+b.Hora).localeCompare(a.Fecha+' '+a.Hora));
  window.SUGERENCIAS_ROWS=SUG_ROWS;
  const dot=document.querySelector('[data-tabst="sugerencias"]');if(dot)dot.className='st '+(SUG_ROWS.length?'':'idle');
}
function pintarSug(){
  const body=document.getElementById('sug-table-body'),count=document.getElementById('sug-count'),src=document.getElementById('sug-source');
  if(count)count.textContent=SUG_ROWS.length+' sugerencia'+(SUG_ROWS.length===1?'':'s')+' registrada'+(SUG_ROWS.length===1?'':'s');
  if(src){src.className='pill '+(SUG_ROWS.length?'ok':'idle');src.innerHTML='<i></i>Google Drive · Base Maestra';}
  if(!body)return;
  body.innerHTML=SUG_ROWS.length?SUG_ROWS.map(r=>'<tr><td><strong>'+esc2(fmt(r.Fecha))+'</strong><small>'+esc2(r.Hora)+'</small></td><td><strong>'+esc2(r.Nombre||'—')+'</strong></td><td>'+esc2(r.Sugerencia||'—')+'</td></tr>').join(''):'<tr><td colspan="3" class="sug-empty">Aún no hay sugerencias registradas.</td></tr>';
}
async function leerSug(){
  if(typeof dashDriveRead!=='function')return;
  try{const a=await dashDriveRead({action:'read_master'}),raw=a&&a.data&&a.data.SUGERENCIAS;if(Array.isArray(raw)){setSug(raw);pintarSug();}}catch(e){console.warn('Sugerencias: no se pudo leer Drive.',e);}
}
async function guardarSug(){
  const n=document.getElementById('sug-name'),m=document.getElementById('sug-message'),b=document.getElementById('sug-send'),s=document.getElementById('sug-form-status');
  const nombre=txt(n&&n.value),sugerencia=txt(m&&m.value);
  if(!nombre){if(s)s.textContent='Escriba su nombre antes de enviar.';n&&n.focus();return;}
  if(sugerencia.length<4){if(s)s.textContent='Escriba una sugerencia un poco más detallada.';m&&m.focus();return;}
  if(sugerencia.length>2000){if(s)s.textContent='La sugerencia no puede superar 2000 caracteres.';return;}
  const key=typeof dashDriveWriteKey==='function'?dashDriveWriteKey():'';
  if(!key){if(s)s.textContent='No se ingresó la clave de actualización.';return;}
  if(b)b.disabled=true;if(s)s.textContent='Guardando sugerencia…';
  try{
    let a=null,err=null;try{a=await dashDriveRequest({action:'append_suggestion',key,nombre,sugerencia});}catch(e){err=e;}
    if(a&&a.data&&Array.isArray(a.data.SUGERENCIAS))setSug(a.data.SUGERENCIAS);
    let ok=!!(a&&a.data&&Array.isArray(a.data.SUGERENCIAS));
    for(let i=0;i<5&&!ok;i++){if(i&&typeof dashDriveSleep==='function')await dashDriveSleep(600*i);try{const r=await dashDriveRead({action:'read_master'}),raw=r&&r.data&&r.data.SUGERENCIAS;if(Array.isArray(raw)){setSug(raw);ok=true;}}catch(e){err=e;}}
    if(!ok)throw err||new Error('No se pudo confirmar la sugerencia desde Drive.');
    if(m)m.value='';if(s)s.textContent='Sugerencia guardada correctamente.';pintarSug();
    if(typeof dashDriveRefreshStatus==='function')dashDriveRefreshStatus('Sugerencia sincronizada','ok');
  }catch(e){if(s)s.textContent='No se pudo guardar: '+(e.message||e);console.error(e);}finally{if(b)b.disabled=false;}
}

function fechas(rows){return [...new Set((rows||[]).map(r=>iso(r&&r.fecha)).filter(Boolean))].sort();}
function confirmar(label,dup){
  if(!dup.length)return true;
  const listado=dup.map(fmt).join(', ');
  return confirm('Aviso de actualización\n\nLa plantilla de '+label+' contiene '+(dup.length===1?'una fecha ya registrada':'fechas ya registradas')+': '+listado+'.\n\nSi continúa, los registros coincidentes de esa fecha se actualizarán con los valores de la nueva plantilla. Los demás registros se conservarán.\n\n¿Desea continuar?');
}
function instalarAvisos(){
  if(typeof dashDriveAppend==='function'&&!dashDriveAppend.__dateGuard){
    const base=dashDriveAppend;
    const f=async function(area,norm,label){const inc=fechas(norm),cur=typeof dashDriveCurrentRows==='function'?(dashDriveCurrentRows(area)||[]):[],have=new Set(fechas(cur)),dup=inc.filter(d=>have.has(d));if(dup.length&&!confirmar(label||String(area).toUpperCase(),dup))return false;return base.apply(this,arguments);};
    f.__dateGuard=true;window.dashDriveAppend=f;
  }
  if(typeof dashDriveAppendWA==='function'&&!dashDriveAppendWA.__dateGuard){
    const base=dashDriveAppendWA;
    const f=async function(rows,catalogo,label){const cur=[];try{if(WA_CFG.aire&&Array.isArray(WA_CFG.aire.data))cur.push(...WA_CFG.aire.data);if(WA_CFG.frio&&Array.isArray(WA_CFG.frio.data))cur.push(...WA_CFG.frio.data);}catch(e){}const have=new Set(fechas(cur)),dup=fechas(rows).filter(d=>have.has(d));if(dup.length&&!confirmar(label||'Compresores · Refrigeración · NH₃',dup))return false;return base.apply(this,arguments);};
    f.__dateGuard=true;window.dashDriveAppendWA=f;
  }
}
function instalarSug(){
  if(typeof SERVICIOS!=='undefined'&&!SERVICIOS.sugerencias)SERVICIOS.sugerencias={nom:'Sugerencias',sub:'Ideas y oportunidades de mejora para el dashboard',color:'#1E63C8',corto:'Sugerencias',kpi:null,keys:[]};
  const form=document.getElementById('sug-form');if(form&&!form.dataset.bound){form.dataset.bound='1';form.addEventListener('submit',e=>{e.preventDefault();guardarSug();});}
  if(typeof ir==='function'&&!ir.__sug){const base=ir;const f=function(id){const r=base.apply(this,arguments);if(id==='sugerencias')pintarSug();return r;};f.__sug=true;window.ir=f;}
  if(typeof dashDriveApplyMasterData==='function'&&!dashDriveApplyMasterData.__sug){const base=dashDriveApplyMasterData;const f=function(a){const r=base.apply(this,arguments);try{const raw=a&&a.data&&a.data.SUGERENCIAS;if(Array.isArray(raw)){setSug(raw);if(typeof activa!=='undefined'&&activa==='sugerencias')pintarSug();}}catch(e){}return r;};f.__sug=true;window.dashDriveApplyMasterData=f;}
  pintarSug();leerSug();
}
instalarAvisos();instalarSug();
})();