/* Alertas para supervisores con el dashboard abierto: seguimiento por Google Drive. */
(function(){
'use strict';
const button=document.getElementById('supervisor-alert-toggle');
const indicator=document.getElementById('supervisor-alert-status');
if(!button||!indicator)return;
const KEY='preinca-supervisor-alerts-v1',SEEN='preinca-supervisor-alerts-seen-v1';
let enabled=localStorage.getItem(KEY)==='1',busy=false,initialized=false,seen=new Set();
try{seen=new Set(JSON.parse(sessionStorage.getItem(SEEN)||'[]'));initialized=seen.size>0;}catch(_){}
function ui(msg){button.textContent=enabled?'Desactivar alertas':'Activar alertas';button.setAttribute('aria-pressed',String(enabled));indicator.textContent=msg||(enabled?'Alertas activas':'Alertas desactivadas');}
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
 if(!enabled||busy||document.hidden)return;
 busy=true;
 try{
  if(typeof dashDriveRead!=='function')throw Error('Lectura Drive no disponible');
  const ans=await dashDriveRead({action:'read_master'},30000);
  if(!ans?.ok)throw Error('No se pudo consultar la Base Maestra');
  const current=alerts(ans.data||{});
  if(!initialized){current.forEach(x=>seen.add(x.id));initialized=true;ui('Supervisando nuevas desviaciones');}
  else{
   const updates=current.filter(x=>!seen.has(x.id));
   updates.forEach(x=>seen.add(x.id));
   if(updates.length){
    const first=updates[0];
    const msg=first.area+' · '+first.variable+': '+first.valor+(updates.length>1?' (+ '+(updates.length-1)+' adicionales)':'');
    if('Notification' in window && Notification.permission==='granted'){
      const n=new Notification('Desviación detectada · Servicios a Planta',{body:msg,tag:'preinca-desviacion-'+Date.now()});
      n.onclick=()=>{window.focus();n.close();};
    }
    indicator.textContent=updates.length+' nueva(s) desviación(es). '+msg;
   }else ui('Sin nuevas desviaciones');
  }
  // Conservar IDs vistos durante la sesión para evitar avisos repetidos.
  const arr=[...seen].slice(-12000);seen=new Set(arr);sessionStorage.setItem(SEEN,JSON.stringify(arr));
 }catch(e){console.warn('Supervisor: revisión de alertas',e);ui('No se pudo comprobar Drive; se reintentará');}
 finally{busy=false;}
}
button.addEventListener('click',async()=>{
 if(enabled){enabled=false;localStorage.removeItem(KEY);ui();return;}
 if(!('Notification' in window)){ui('Este navegador no admite notificaciones');return;}
 if(!window.isSecureContext){ui('Se requiere HTTPS para notificaciones');return;}
 const permission=await Notification.requestPermission();
 if(permission!=='granted'){ui('Permiso de notificaciones no concedido');return;}
 enabled=true;localStorage.setItem(KEY,'1');ui('Activando supervisión…');check();
});
ui();if(enabled)check();
setInterval(check,60000);
})();
