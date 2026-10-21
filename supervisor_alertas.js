/* Alertas para supervisores con el dashboard abierto: seguimiento por Google Drive. */
(function(){
'use strict';
const indicator=document.getElementById('supervisor-alert-status');
const permissionLink=document.getElementById('supervisor-alert-permission');
const toast=document.getElementById('supervisor-alert-toast');
if(!indicator)return;
const SEEN='preinca-supervisor-alerts-seen-v3';
let busy=false,initialized=false,seen=new Set();
try{seen=new Set(JSON.parse(localStorage.getItem(SEEN)||'[]'));initialized=seen.size>0;}catch(_){}
function ui(msg){indicator.textContent=msg||'Vigilancia de desviaciones activa';if(permissionLink)permissionLink.hidden=!("Notification" in window && Notification.permission==='default');}
function showToast(msg){
 if(!toast)return;
 toast.textContent='⚠ Nueva desviación: '+msg;
 toast.hidden=false;
 clearTimeout(showToast.timer);
 showToast.timer=setTimeout(()=>{toast.hidden=true;},16000);
}
const schemas=[
 {key:'PTAB',normalize:'normalizarFilasPtabr',state:'estadoRegistroPtabr',label:'PTAB'},
 {key:'PTAR',normalize:'normalizarFilasPTAR',state:'estadoRegistroPTAR',label:'PTAR'},
 {key:'VAPOR',normalize:'normalizarFilasVapor',state:'estadoRegistroVapor',label:'Vapor'},
 {key:'SUAVIZADORES',normalize:'normalizarFilasSuav',state:'estadoRegistroSuav',label:'Suavizadores'}
];
function alerts(data){
 const found=[];
 for(const s of schemas){
  const parse=window[s.normalize],test=window[s.state];
  // Los analizadores del dashboard son funciones globales, también accesibles por nombre léxico.
  const fn=({PTAB:typeof normalizarFilasPtabr==='function'?normalizarFilasPtabr:null,PTAR:typeof normalizarFilasPTAR==='function'?normalizarFilasPTAR:null,VAPOR:typeof normalizarFilasVapor==='function'?normalizarFilasVapor:null,SUAVIZADORES:typeof normalizarFilasSuav==='function'?normalizarFilasSuav:null})[s.key];
  const checker=({PTAB:typeof estadoRegistroPtabr==='function'?estadoRegistroPtabr:null,PTAR:typeof estadoRegistroPTAR==='function'?estadoRegistroPTAR:null,VAPOR:typeof estadoRegistroVapor==='function'?estadoRegistroVapor:null,SUAVIZADORES:typeof estadoRegistroSuav==='function'?estadoRegistroSuav:null})[s.key];
  if(!fn||!checker||!Array.isArray(data[s.key]))continue;
  try{
   for(const row of fn(data[s.key])){
    if(checker(row)!=='FUERA DE RANGO')continue;
    const id=[s.key,row.fecha,row.turno,row.id,row.valor,row.operador||''].join('|');
    found.push({id,area:s.label,variable:row.variable||row.id,valor:String(row.valor??''),fecha:row.fecha});
   }
  }catch(e){console.warn('Alertas: error al revisar '+s.key,e);}
 }
 const wa=data.COMPRESORES_REFRIGERACION;
 if(Array.isArray(wa)){
  for(const raw of wa){
   const obj=raw||{};
   const state=String(obj['Estado normalizado']||obj.Estado||'').toLowerCase();
   if(!/fuera de norma|fuera de rango|alerta/.test(state))continue;
   const id=['COMPRESORES',obj['Fecha operativa'],obj.Turno,obj.VariableId,obj['Valor numérico'],obj['Valor texto']].join('|');
   found.push({id,area:'Compresores / Refrigeración',variable:obj.Variable||obj.VariableId||'Variable',valor:String(obj['Valor numérico']||obj['Valor texto']||''),fecha:obj['Fecha operativa']||''});
  }
 }
 return found;
}
async function check(){
 if(busy)return;
 busy=true;
 try{
  if(typeof dashDriveRead!=='function')throw Error('Lectura Drive no disponible');
  const ans=await dashDriveRead({action:'read_master'},30000);
  if(!ans?.ok)throw Error('No se pudo consultar la Base Maestra');
  const current=alerts(ans.data||{});
  if(!initialized){initialized=true;}
  {
   const updates=current.filter(x=>!seen.has(x.id));
   updates.forEach(x=>seen.add(x.id));
   if(updates.length){
    const first=updates[0];
    const msg=first.area+' · '+first.variable+': '+first.valor+(updates.length>1?' (+ '+(updates.length-1)+' adicionales)':'');
    showToast(msg);
    if('Notification' in window && Notification.permission==='granted'){
      try{const n=new Notification('Desviación detectada · Servicios a Planta',{body:msg,tag:'preinca-desviacion-'+Date.now()});n.onclick=()=>{window.focus();n.close();};}
      catch(e){console.warn('Aviso del sistema no disponible',e);}
    }
    indicator.textContent=updates.length+' nueva(s) desviación(es). '+msg;
   }else ui('Sin nuevas desviaciones');
  }
  // Conservar IDs vistos durante la sesión para evitar avisos repetidos.
  const arr=[...seen].slice(-12000);seen=new Set(arr);localStorage.setItem(SEEN,JSON.stringify(arr));
 }catch(e){console.warn('Supervisor: revisión de alertas',e);ui('No se pudo comprobar Drive; se reintentará');}
 finally{busy=false;}
}
if(permissionLink)permissionLink.addEventListener('click',async()=>{
 if(!('Notification' in window)){ui('El navegador no permite notificaciones del sistema');return;}
 try{
  const result=await Notification.requestPermission();
  ui(result==='granted'?'Notificaciones del navegador permitidas':'Las alertas siguen visibles dentro del dashboard');
 }catch(e){ui('Las alertas siguen visibles dentro del dashboard');}
});
ui();
check();
window.addEventListener('focus',check);
window.addEventListener('preinca:drive-actualizado',()=>{setTimeout(check,250);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
setInterval(check,60000);
})();
