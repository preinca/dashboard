/* Dashboard extras · Mejoras numeradas y estado persistente + avisos de fechas */
(function(){
'use strict';

let SUG_ROWS=[];
let SUG_STATE_TOKENS=new Set();
// Se mantiene el backend actual: las mejoras y sus cambios de estado
// se registran en SUGERENCIAS de forma persistente, sin borrar propuestas.
const MEJORA_PREFIX='MEJORA_V1:';
const MEJORA_ESTADO_PREFIX='MEJORA_ESTADO_V1:';
const txt=v=>String(v==null?'':v).trim();
const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(txt(v))?txt(v):'';
const fmt=v=>{const s=iso(v);return s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):(txt(v)||'—');};
const esc2=v=>typeof window.esc==='function'?window.esc(v):txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function desglosarMejora(value){
 const raw=txt(value);
 if(raw.startsWith(MEJORA_PREFIX)){
  try{const o=JSON.parse(raw.slice(MEJORA_PREFIX.length));
   return {area:txt(o.area),problema:txt(o.problema),propuesta:txt(o.propuesta),beneficios:txt(o.beneficios),numero:Number(o.numero)||0};
  }catch(e){console.warn('Registro de mejora sin formato válido',e);}
 }
 return {area:'Registro anterior',problema:'—',propuesta:raw,beneficios:'—',numero:0};
}
function setSug(raw){
 const all=Array.isArray(raw)?raw:[];
 const lastState=new Map(),tokens=new Set();
 for(const entry of all){
  const val=txt(entry&&entry.Sugerencia);
  if(!val.startsWith(MEJORA_ESTADO_PREFIX))continue;
  try{
   const e=JSON.parse(val.slice(MEJORA_ESTADO_PREFIX.length));
   if(txt(e.id)&&['En espera','Finalizada'].includes(e.estado))lastState.set(txt(e.id),e.estado);
   if(txt(e.token))tokens.add(txt(e.token));
  }catch(err){console.warn('Evento de estado de mejora inválido',err);}
 }
 SUG_STATE_TOKENS=tokens;
 const used=new Set();let maxNum=0;
 // El orden físico de la hoja es cronológico: se respeta al asignar los folios
 // antiguos. Los nuevos incluyen su número en el contenido guardado.
 SUG_ROWS=all.filter(r=>!txt(r&&r.Sugerencia).startsWith(MEJORA_ESTADO_PREFIX)).map(r=>{
  const detail=desglosarMejora(r.Sugerencia);
  let numero=Number(txt(r['Número de mejora']))||detail.numero;
  if(!Number.isInteger(numero)||numero<=0||used.has(numero)){
   numero=maxNum+1;
   while(used.has(numero))numero++;
  }
  used.add(numero);maxNum=Math.max(maxNum,numero);
  const ID=txt(r.ID);
  const estado=lastState.get(ID)||(['En espera','Finalizada'].includes(txt(r['Estado inicial']))?txt(r['Estado inicial']):'En espera');
  return {
   ID,Fecha:txt(r.Fecha),Hora:txt(r.Hora),Nombre:txt(r.Nombre),
   Sugerencia:txt(r.Sugerencia),...detail,numero,estado,
   'Fecha de registro':txt(r['Fecha de registro'])
  };
 }).filter(r=>r.Nombre||r.Sugerencia).sort((a,b)=>
  (b.Fecha+' '+b.Hora).localeCompare(a.Fecha+' '+a.Hora)||b.numero-a.numero);
 window.SUGERENCIAS_ROWS=SUG_ROWS;
 const dot=document.querySelector('[data-tabst="sugerencias"]');
 if(dot)dot.className='st '+(SUG_ROWS.length?'':'idle');
}

function pintarSug(){
 const body=document.getElementById('sug-table-body');
 const count=document.getElementById('sug-count');
 if(count)count.textContent=SUG_ROWS.length+' mejora'+(SUG_ROWS.length===1?'':'s')+' registrada'+(SUG_ROWS.length===1?'':'s');
 if(!body)return;
 if(!SUG_ROWS.length){body.innerHTML='<tr><td colspan="8" class="sug-empty">Aún no hay mejoras registradas.</td></tr>';return;}
 body.innerHTML=SUG_ROWS.map(r=>{
  const cell=v=>'<td>'+esc2(v||'—')+'</td>';
  const f='#'+String(r.numero).padStart(3,'0');
  const finished=r.estado==='Finalizada';
  const status= r.ID?'<div class="sug-state-wrap"><span class="sug-state-chip '+(finished?'finished':'pending')+'">'+r.estado+'</span>'+
   '<select class="sug-state-select" data-sug-status="'+esc2(r.ID)+'" aria-label="Estado de la mejora '+f+'">'+
   '<option value="En espera"'+(!finished?' selected':'')+'>En espera</option>'+
   '<option value="Finalizada"'+(finished?' selected':'')+'>Finalizada</option></select></div>':
   '<span class="sug-state-chip pending">En espera</span>';
  return '<tr><td><strong class="sug-folio">'+f+'</strong></td>'+
   '<td><strong>'+esc2(fmt(r.Fecha))+'</strong><small>'+esc2(r.Hora)+'</small></td>'+
   cell(r.Nombre)+cell(r.area)+cell(r.problema)+cell(r.propuesta)+cell(r.beneficios)+'<td>'+status+'</td></tr>';
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
 if(![...ar.options].some(o=>o.value===area&&area)){
  if(status)status.textContent='Seleccione un área de servicio válida.';return;
 }
 const key=typeof dashDriveWriteKey==='function'?dashDriveWriteKey():'';
 if(!key){if(status)status.textContent='No se ingresó la clave de actualización.';return;}
 if(b)b.disabled=true;
 if(status)status.textContent='Guardando mejora…';
 try{
  // Leer el folio mayor compartido antes de crear la siguiente petición.
  if(!await leerSug())throw new Error('No se pudo consultar la numeración actual de Drive.');
  const numero=Math.max(0,...SUG_ROWS.map(r=>r.numero||0))+1;
  const sugerencia=MEJORA_PREFIX+JSON.stringify({area,problema,propuesta,beneficios,numero});
  if(sugerencia.length>2000)throw new Error('La propuesta supera 2000 caracteres. Resuma alguno de los campos.');
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
  if(status)status.textContent='Mejora #'+String(SUG_ROWS.find(r=>r.Nombre===nombre&&r.Sugerencia===sugerencia)?.numero||numero).padStart(3,'0')+' registrada en espera.';
  pintarSug();
  if(typeof dashDriveRefreshStatus==='function')dashDriveRefreshStatus('Mejora sincronizada','ok');
 }catch(e){if(status)status.textContent='No se pudo guardar: '+(e.message||e);console.error(e);}
 finally{if(b)b.disabled=false;}
}

async function cambiarEstadoSug(id,estado,select){
 const row=SUG_ROWS.find(r=>r.ID===id);
 if(!row||!['En espera','Finalizada'].includes(estado)){pintarSug();return;}
 if(row.estado===estado)return;
 const key=typeof dashDriveWriteKey==='function'?dashDriveWriteKey():'';
 const status=document.getElementById('sug-form-status');
 if(!key){
  if(status)status.textContent='Ingrese la clave de actualización para modificar el estado.';
  pintarSug();return;
 }
 const token=id+':'+Date.now()+':'+Math.random().toString(36).slice(2);
 const sugerencia=MEJORA_ESTADO_PREFIX+JSON.stringify({id,estado,token});
 if(select)select.disabled=true;
 if(status)status.textContent='Actualizando estado de la mejora #'+String(row.numero).padStart(3,'0')+'…';
 try{
  let err=null,a=null;
  try{a=await dashDriveRequest({action:'append_suggestion',key,nombre:'Control de mejoras',sugerencia});}
  catch(e){err=e;}
  if(a?.data&&Array.isArray(a.data.SUGERENCIAS))setSug(a.data.SUGERENCIAS);
  for(let i=0;i<5&&!SUG_STATE_TOKENS.has(token);i++){
   if(i&&typeof dashDriveSleep==='function')await dashDriveSleep(600*i);
   try{const resp=await dashDriveRead({action:'read_master'});const raw=resp?.data?.SUGERENCIAS;
    if(Array.isArray(raw))setSug(raw);
   }catch(e){err=e;}
  }
  if(!SUG_STATE_TOKENS.has(token))throw err||new Error('No se pudo confirmar el cambio de estado en Drive.');
  pintarSug();
  if(status)status.textContent='Mejora #'+String(row.numero).padStart(3,'0')+': estado guardado como '+estado+'.';
  if(typeof dashDriveRefreshStatus==='function')dashDriveRefreshStatus('Estado de mejora sincronizado','ok');
 }catch(e){
  if(status)status.textContent='No se pudo actualizar el estado: '+(e.message||e);
  console.error(e);pintarSug();
 }finally{if(select&&document.body.contains(select))select.disabled=false;}
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

  document.addEventListener('change',e=>{
    const select=e.target;
    if(select&&select.matches&&select.matches('select[data-sug-status]')){
      cambiarEstadoSug(select.dataset.sugStatus,select.value,select);
    }
  });

  pintarSug();
  leerSug();
}

instalarAvisos();
instalarSug();
})();
