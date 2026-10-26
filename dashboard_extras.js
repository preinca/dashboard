/* Dashboard extras V13 · Sugerencias + eliminación + confirmación de fechas existentes */
(function(){
'use strict';

let SUG_ROWS=[];
// Datos estructurados en la columna Sugerencia, compatibles con la versión actual del backend.
const MEJORA_PREFIX='MEJORA_V1:';
function desglosarMejora(value){
 const raw=txt(value);
 if(raw.startsWith(MEJORA_PREFIX)){
  try{const o=JSON.parse(raw.slice(MEJORA_PREFIX.length));
   return {area:txt(o.area),problema:txt(o.problema),propuesta:txt(o.propuesta),beneficios:txt(o.beneficios)};
  }catch(e){console.warn('Registro de mejora sin formato válido',e);}
 }
 return {area:'Registro anterior',problema:'—',propuesta:raw,beneficios:'—'};
}

const txt=v=>String(v==null?'':v).trim();
const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(txt(v))?txt(v):'';
const fmt=v=>{const s=iso(v);return s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):(txt(v)||'—');};
const esc2=v=>typeof window.esc==='function'?window.esc(v):txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setSug(raw){
  SUG_ROWS=(Array.isArray(raw)?raw:[]).map(r=>({
    ID:txt(r.ID),
    Fecha:txt(r.Fecha),
    Hora:txt(r.Hora),
    Nombre:txt(r.Nombre),
    Sugerencia:txt(r.Sugerencia),
    ...desglosarMejora(r.Sugerencia),
    'Fecha de registro':txt(r['Fecha de registro'])
  })).filter(r=>r.Nombre||r.Sugerencia)
    .sort((a,b)=>(b.Fecha+' '+b.Hora).localeCompare(a.Fecha+' '+a.Hora));
  window.SUGERENCIAS_ROWS=SUG_ROWS;
  const dot=document.querySelector('[data-tabst="sugerencias"]');
  if(dot)dot.className='st '+(SUG_ROWS.length?'':'idle');
}

function pintarSug(){
 const body=document.getElementById('sug-table-body');
 const count=document.getElementById('sug-count');
 if(count)count.textContent=SUG_ROWS.length+' mejora'+(SUG_ROWS.length===1?'':'s')+' registrada'+(SUG_ROWS.length===1?'':'s');
 if(!body)return;
 if(!SUG_ROWS.length){body.innerHTML='<tr><td colspan="7" class="sug-empty">Aún no hay mejoras registradas.</td></tr>';return;}
 body.innerHTML=SUG_ROWS.map(r=>{
  const del=r.ID?'<button type="button" class="sug-delete" data-sug-delete="'+esc2(r.ID)+'" aria-label="Eliminar mejora de '+esc2(r.Nombre||'operador')+'">Eliminar</button>':'<span class="note">Sin ID</span>';
  const cell=v=>'<td>'+esc2(v||'—')+'</td>';
  return '<tr><td><strong>'+esc2(fmt(r.Fecha))+'</strong><small>'+esc2(r.Hora)+'</small></td>'+
   cell(r.Nombre)+cell(r.area)+cell(r.problema)+cell(r.propuesta)+cell(r.beneficios)+'<td>'+del+'</td></tr>';
 }).join('');
}

async function leerSug(){
  if(typeof dashDriveRead!=='function')return false;
  try{
    const a=await dashDriveRead({action:'read_master'});
    const raw=a&&a.data&&a.data.SUGERENCIAS;
    if(Array.isArray(raw)){setSug(raw);pintarSug();return true;}
  }catch(e){
    console.warn('Sugerencias: no se pudo leer la información.',e);
  }
  return false;
}

async function guardarSug(){
 const n=document.getElementById('sug-name'),ar=document.getElementById('sug-area'),pr=document.getElementById('sug-problema'),m=document.getElementById('sug-message'),be=document.getElementById('sug-beneficios');
 const b=document.getElementById('sug-send'),status=document.getElementById('sug-form-status');
 const nombre=txt(n?.value),area=txt(ar?.value),problema=txt(pr?.value),propuesta=txt(m?.value),beneficios=txt(be?.value);
 if(!nombre||!area||problema.length<4||propuesta.length<4||beneficios.length<4){
  if(status)status.textContent='Complete su nombre, área, problemática, propuesta y beneficios.';return;
 }
 // Validar contra las opciones permitidas, no admitir categorías ajenas a Servicios.
 if(![...ar.options].some(o=>o.value===area&&area)){if(status)status.textContent='Seleccione un área de servicio válida.';return;}
 const sugerencia=MEJORA_PREFIX+JSON.stringify({area,problema,propuesta,beneficios});
 if(sugerencia.length>2000){if(status)status.textContent='El texto de la propuesta es demasiado largo. Resuma alguno de los campos.';return;}
 const key=typeof dashDriveWriteKey==='function'?dashDriveWriteKey():'';
 if(!key){if(status)status.textContent='No se ingresó la clave de actualización.';return;}
 if(b)b.disabled=true;
 if(status)status.textContent='Guardando mejora…';
 try{
  let a=null,err=null;
  try{a=await dashDriveRequest({action:'append_suggestion',key,nombre,sugerencia});}
  catch(e){err=e;}
  if(a?.data&&Array.isArray(a.data.SUGERENCIAS))setSug(a.data.SUGERENCIAS);
  let saved=SUG_ROWS.some(r=>r.Nombre===nombre&&r.Sugerencia===sugerencia);
  for(let i=0;i<5&&!saved;i++){
   if(i&&typeof dashDriveSleep==='function')await dashDriveSleep(600*i);
   try{const resp=await dashDriveRead({action:'read_master'});const raw=resp?.data?.SUGERENCIAS;
    if(Array.isArray(raw)){setSug(raw);saved=SUG_ROWS.some(r=>r.Nombre===nombre&&r.Sugerencia===sugerencia);}
   }catch(e){err=e;}
  }
  if(!saved)throw err||new Error('No se pudo confirmar la mejora en la Base Maestra.');
  if(pr)pr.value='';if(m)m.value='';if(be)be.value='';
  if(status)status.textContent='Mejora guardada correctamente.';
  pintarSug();
  if(typeof dashDriveRefreshStatus==='function')dashDriveRefreshStatus('Mejora sincronizada','ok');
 }catch(e){if(status)status.textContent='No se pudo guardar: '+(e.message||e);console.error(e);}
 finally{if(b)b.disabled=false;}
}

async function eliminarSug(id,button){
  id=txt(id);
  if(!id)return;

  const row=SUG_ROWS.find(r=>r.ID===id);
  if(!row){alert('No se encontró la mejora seleccionada. Actualice la información e intente nuevamente.');return;}

  const resumen=row.Sugerencia.length>140?row.Sugerencia.slice(0,137)+'…':row.Sugerencia;
  const ok=confirm(
    'Eliminar mejora\n\n'+
    'Nombre: '+(row.Nombre||'—')+'\n'+
    'Sugerencia: '+(resumen||'—')+'\n\n'+
    'Esta acción eliminará definitivamente el registro. ¿Desea continuar?'
  );
  if(!ok)return;

  const key=typeof dashDriveWriteKey==='function'?dashDriveWriteKey():'';
  if(!key)return;

  const status=document.getElementById('sug-form-status');
  if(button)button.disabled=true;
  if(status)status.textContent='Eliminando sugerencia…';

  try{
    let ans=null,last=null;
    try{ans=await dashDriveRequest({action:'delete_suggestion',key,id});}
    catch(e){last=e;}

    if(ans&&ans.data&&Array.isArray(ans.data.SUGERENCIAS))setSug(ans.data.SUGERENCIAS);
    let synced=!!(ans&&ans.data&&Array.isArray(ans.data.SUGERENCIAS));

    for(let i=0;i<5&&!synced;i++){
      if(i&&typeof dashDriveSleep==='function')await dashDriveSleep(550*i);
      try{
        const r=await dashDriveRead({action:'read_master'});
        const raw=r&&r.data&&r.data.SUGERENCIAS;
        if(Array.isArray(raw)){
          setSug(raw);
          synced=!raw.some(x=>txt(x&&x.ID)===id);
        }
      }catch(e){last=e;}
    }

    if(!synced)throw last||new Error('No se pudo confirmar la eliminación.');
    pintarSug();
    if(status)status.textContent='Mejora eliminada correctamente.';
    if(typeof dashDriveRefreshStatus==='function')dashDriveRefreshStatus('Sugerencia eliminada','ok');
  }catch(e){
    if(status)status.textContent='No se pudo eliminar: '+(e.message||e);
    console.error(e);
  }finally{
    if(button&&document.body.contains(button))button.disabled=false;
  }
}

function fechas(rows){return [...new Set((rows||[]).map(r=>iso(r&&r.fecha)).filter(Boolean))].sort();}
function confirmar(label,dup){
  if(!dup.length)return true;
  const listado=dup.map(fmt).join(', ');
  return confirm(
    'Aviso de actualización\n\n'+
    'La plantilla de '+label+' contiene '+(dup.length===1?'una fecha ya registrada':'fechas ya registradas')+': '+listado+'.\n\n'+
    'Si continúa, los registros coincidentes de esa fecha se actualizarán con los valores de la nueva plantilla. Los demás registros se conservarán.\n\n'+
    '¿Desea continuar?'
  );
}

function instalarAvisos(){
  if(typeof dashDriveAppend==='function'&&!dashDriveAppend.__dateGuard){
    const base=dashDriveAppend;
    const f=async function(area,norm,label){
      const inc=fechas(norm);
      const cur=typeof dashDriveCurrentRows==='function'?(dashDriveCurrentRows(area)||[]):[];
      const have=new Set(fechas(cur));
      const dup=inc.filter(d=>have.has(d));
      if(dup.length&&!confirmar(label||String(area).toUpperCase(),dup))return false;
      return base.apply(this,arguments);
    };
    f.__dateGuard=true;
    window.dashDriveAppend=f;
  }

  if(typeof dashDriveAppendWA==='function'&&!dashDriveAppendWA.__dateGuard){
    const base=dashDriveAppendWA;
    const f=async function(rows,catalogo,label){
      const cur=[];
      try{
        if(WA_CFG.aire&&Array.isArray(WA_CFG.aire.data))cur.push(...WA_CFG.aire.data);
        if(WA_CFG.frio&&Array.isArray(WA_CFG.frio.data))cur.push(...WA_CFG.frio.data);
      }catch(e){}
      const have=new Set(fechas(cur)),dup=fechas(rows).filter(d=>have.has(d));
      if(dup.length&&!confirmar(label||'Compresores · Refrigeración · NH₃',dup))return false;
      return base.apply(this,arguments);
    };
    f.__dateGuard=true;
    window.dashDriveAppendWA=f;
  }
}

function instalarSug(){
  if(typeof SERVICIOS!=='undefined'&&!SERVICIOS.sugerencias){
    SERVICIOS.sugerencias={
      nom:'Mejoras',
      sub:'Propuestas de mejora para las áreas operativas de Servicios de Planta',
      color:'#1E63C8',
      corto:'Mejoras',
      kpi:null,
      keys:[]
    };
  }

  const form=document.getElementById('sug-form');
  if(form&&!form.dataset.bound){
    form.dataset.bound='1';
    form.addEventListener('submit',e=>{e.preventDefault();guardarSug();});
  }

  if(typeof ir==='function'&&!ir.__sug){
    const base=ir;
    const f=function(id){
      const r=base.apply(this,arguments);
      if(id==='sugerencias')pintarSug();
      return r;
    };
    f.__sug=true;
    window.ir=f;
  }

  if(typeof dashDriveApplyMasterData==='function'&&!dashDriveApplyMasterData.__sug){
    const base=dashDriveApplyMasterData;
    const f=function(a){
      const r=base.apply(this,arguments);
      try{
        const raw=a&&a.data&&a.data.SUGERENCIAS;
        if(Array.isArray(raw)){
          setSug(raw);
          if(typeof activa!=='undefined'&&activa==='sugerencias')pintarSug();
        }
      }catch(e){}
      return r;
    };
    f.__sug=true;
    window.dashDriveApplyMasterData=f;
  }

  document.addEventListener('click',e=>{
    const button=e.target&&e.target.closest?e.target.closest('[data-sug-delete]'):null;
    if(button){e.preventDefault();eliminarSug(button.dataset.sugDelete,button);}
  });

  pintarSug();
  leerSug();
}

instalarAvisos();
instalarSug();
})();
