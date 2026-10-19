/**
 * BACKEND GOOGLE DRIVE / GOOGLE SHEETS
 * Dashboard Servicios Industriales
 *
 * La base central debe ser un Google Sheet (no un XLSX binario) con 8 hojas:
 * PTAB, PTAR, VAPOR, SUAVIZADORES, COMPRESORES_REFRIGERACION, INVENTARIO_QUIMICO, LISTA_VERIFICADOS y SUGERENCIAS.
 *
 * Script Properties:
 * MASTER_SHEET_ID = ID del Google Sheet Base_Maestra_Dashboard
 * WRITE_KEY       = clave compartida para autorizar cargas del operador
 */
const BACKEND_VERSION = 'V12-2026-10-19';
const AREA_SHEETS = {ptab:'PTAB', ptar:'PTAR', vapor:'VAPOR', suav:'SUAVIZADORES', wa:'COMPRESORES_REFRIGERACION'};
const AREA_ALIASES = {
  ptab:'ptab', ptar:'ptar', vapor:'vapor', suav:'suav', suavizadores:'suav',
  wa:'wa', aire:'wa', frio:'wa', refrigeracion:'wa', nh3:'wa',
  sala:'wa', compresores:'wa', compresores_refrigeracion:'wa',
  'compresores-refrigeracion':'wa', 'compresores/refrigeracion':'wa'
};
const WA_SCHEMA = ['Fecha operativa','Confianza fecha','Turno','Turno original','Operador','Reporte ID','Proceso / Área','Equipo / Puesto','Variable','Valor numérico','Valor texto','Unidad','Indicador','Estado normalizado','Observación','Línea original','Incluir dashboard','VariableId','Tipo de dato','Rango operativo','Criterio disponible en fuente','Sistema'];
const AREA_VALUE_HEADERS = {
  ptab:['Valor','Valor original turno'],
  ptar:['Valor'],
  vapor:['Valor'],
  suav:['Valor numérico / promedio','Valor original'],
  wa:['Valor numérico','Valor texto','Estado normalizado','Observación']
};
const INVENTORY_HEADERS = ['Categoria','Planta / Área','Químico','Código de Material','Stock Seguridad Actual','Stock Máximo Actual','Stock Seguridad Requerido','Stock Máximo Requerido','Disponibilidad (Almacén 0003)','Solicitud de Pedido / Orden de Compra','Fecha Estimada','Observaciones'];
const VERIFIED_HEADERS = ['Registro ID','Fecha','Turno','Supervisor','Operador','Área','Punto / Equipo','Condicion Fuga','Condicion by pass','Condicion Manometros','Condicion Aislamiento','Condicion Seguridad','#Aviso B1','Observacion Operador','Archivo origen','Fecha de carga'];
const SUGGESTION_HEADERS = ['ID','Fecha','Hora','Nombre','Sugerencia','Fecha de registro'];

function readMasterPayload_(){
  const ss=openMaster_(), data={};
  Object.keys(AREA_SHEETS).forEach(function(area){
    ensureAreaSheet_(ss,area);
    data[AREA_SHEETS[area]]=dedupeObjects_(area,readSheetObjects_(ss,AREA_SHEETS[area]));
  });
  const inv=ss.getSheetByName('INVENTARIO_QUIMICO');
  data.INVENTARIO_QUIMICO=inv?readSheetObjects_(ss,'INVENTARIO_QUIMICO'):[];
  const ver=ss.getSheetByName('LISTA_VERIFICADOS');
  data.LISTA_VERIFICADOS=ver?readSheetObjects_(ss,'LISTA_VERIFICADOS'):[];
  const sug=ss.getSheetByName('SUGERENCIAS');
  data.SUGERENCIAS=sug?readSheetObjects_(ss,'SUGERENCIAS'):[];
  return {ok:true,version:BACKEND_VERSION,acceptedAreas:Object.keys(AREA_ALIASES),data:data,updatedAt:new Date().toISOString(),spreadsheetId:ss.getId(),spreadsheetName:ss.getName()};
}

function doGet(e){
  const p=(e&&e.parameter)||{};
  const callback=String(p.callback||'').trim();
  const transport=String(p.transport||'').trim().toLowerCase();
  const nonce=String(p.nonce||'').trim();
  const parentOrigin=String(p.parentOrigin||'').trim();
  let payload;
  try{
    const action=String(p.action||'read_master');
    if(action==='health') payload={ok:true,service:'Dashboard Servicios · Google Drive',version:BACKEND_VERSION,acceptedAreas:Object.keys(AREA_ALIASES),supportsAppendSala:true,supportsSalaV5:true,supportsSalaV6:true,supportsNewPtabVaporVars:true,supportsUmaCooling:true,supportsChemicalInventory:true,supportsInventoryExcelUpload:true,supportsVerifiedChecklist:true,supportsVerifiedVisualReferences:true,verifiedLeakHeader:'Condicion Fuga',supportsSuggestions:true,time:new Date().toISOString()};
    else if(action==='read_master') payload=readMasterPayload_();
    else payload={ok:false,error:'Acción GET no soportada.'};
  }catch(err){
    payload={ok:false,error:String(err&&err.message||err)};
  }
  if(transport==='iframe') return iframeResponse_(payload,nonce,parentOrigin);
  return callback ? jsonp_(payload,callback) : json_(payload);
}
function doPost(e){
  try{
    const body=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');

    // La lectura usa el mismo canal POST que la escritura. Esto evita diferencias
    // de caché/redirecciones entre GET y POST en GitHub Pages + Apps Script.
    if(body.action==='read_master') return json_(readMasterPayload_());

    if(body.action==='replace_inventory'){
      authorize_(body.key);
      const invRows=Array.isArray(body.rows)?body.rows:[];
      if(!invRows.length) return json_({ok:false,error:'El archivo de inventario no contiene productos válidos.'});
      const ss=openMaster_();
      const result=replaceInventory_(ss,invRows);
      const payload=readMasterPayload_();
      payload.sheet='INVENTARIO_QUIMICO';payload.replaced=result.replaced;payload.total=result.total;
      return json_(payload);
    }

    if(body.action==='upsert_verified'){
      authorize_(body.key);
      const verRows=Array.isArray(body.rows)?body.rows:[];
      if(!verRows.length) return json_({ok:false,error:'El checklist no contiene verificaciones válidas.'});
      const ss=openMaster_();
      const result=upsertVerified_(ss,verRows);
      const payload=readMasterPayload_();
      payload.sheet='LISTA_VERIFICADOS';payload.added=result.added;payload.updated=result.updated;payload.total=result.total;
      return json_(payload);
    }

    if(body.action==='append_suggestion'){
      authorize_(body.key);
      const nombre=String(body.nombre||'').trim();
      const sugerencia=String(body.sugerencia||'').trim();
      if(!nombre) return json_({ok:false,error:'Debe indicar el nombre de la persona que envía la sugerencia.'});
      if(sugerencia.length<4) return json_({ok:false,error:'La sugerencia es demasiado corta.'});
      if(sugerencia.length>2000) return json_({ok:false,error:'La sugerencia no puede superar 2000 caracteres.'});
      const ss=openMaster_();
      const result=appendSuggestion_(ss,nombre,sugerencia);
      const payload=readMasterPayload_();
      payload.sheet='SUGERENCIAS';payload.added=1;payload.id=result.id;payload.total=result.total;
      return json_(payload);
    }

    if(body.action!=='append_rows'&&body.action!=='append_sala') return json_({ok:false,error:'Acción POST no soportada. Backend '+BACKEND_VERSION});
    authorize_(body.key);
    const rows=Array.isArray(body.rows)?body.rows:[];
    if(!rows.length) return json_({ok:false,error:'La planilla no contiene registros válidos para añadir.'});
    const area=(body.action==='append_sala'||looksLikeWARows_(rows))?'wa':canonicalArea_(body.area,rows), sheetName=AREA_SHEETS[area];
    if(!sheetName) return json_({ok:false,code:'AREA',error:'Área no válida. Backend '+BACKEND_VERSION+' recibió: '+String(body.area||'')});
    const ss=openMaster_();
    ensureAreaSheet_(ss,area);
    const result=mergeRows_(ss,sheetName,area,rows);

    // La misma respuesta de la escritura devuelve la base ya actualizada.
    // Así el dashboard no depende de una segunda petición para mostrar la fecha nueva.
    const payload=readMasterPayload_();
    payload.area=area;
    payload.sheet=sheetName;
    payload.added=result.added;
    payload.filled=result.filled;
    payload.updated=result.updated||0;
    payload.kept=result.kept;
    payload.total=result.total;
    return json_(payload);
  }catch(err){return json_({ok:false,code:err&&err.code||'',error:String(err&&err.message||err)});}
}


function looksLikeWARows_(rows){
  return Array.isArray(rows)&&rows.some(function(o){
    return o&&typeof o==='object'&&(('Fecha operativa' in o)||('Proceso / Área' in o)||('Equipo / Puesto' in o)||('Sistema' in o)||('Reporte ID' in o));
  });
}
function canonicalArea_(value,rows){
  // El esquema de Sala de Compresores manda por encima del alias recibido.
  // Así una versión antigua del front que envíe aire/frio/wa/otro alias
  // nunca termina en "Área no válida" si las filas son del esquema WA.
  if(looksLikeWARows_(rows)) return 'wa';
  const raw=String(value===null||value===undefined?'':value).trim().toLowerCase();
  return AREA_ALIASES[raw]||raw;
}
function ensureAreaSheet_(ss,area){
  const name=AREA_SHEETS[area]; if(!name) return null;
  let sh=ss.getSheetByName(name);
  if(!sh&&area==='wa'){
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,WA_SCHEMA.length).setValues([WA_SCHEMA]);
    sh.setFrozenRows(1);
    return sh;
  }
  if(!sh) throw new Error('No existe la hoja '+name+'.');
  if(area==='wa'){
    const lc=Math.max(sh.getLastColumn(),1),headers=sh.getRange(1,1,1,lc).getDisplayValues()[0].map(function(x){return String(x||'').trim();});
    const missing=WA_SCHEMA.filter(function(h){return headers.indexOf(h)<0;});
    if(missing.length){sh.getRange(1,lc+1,1,missing.length).setValues([missing]);}
  }
  return sh;
}
function openMaster_(){
  const id=PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
  if(!id) throw new Error('Falta Script Property MASTER_SHEET_ID.');
  return SpreadsheetApp.openById(id);
}
function authorize_(key){
  const expected=PropertiesService.getScriptProperties().getProperty('WRITE_KEY')||'';
  if(!expected) throw new Error('Falta Script Property WRITE_KEY.');
  if(String(key||'')!==expected){const er=new Error('Clave de actualización incorrecta.');er.code='AUTH';throw er;}
}
function readSheetObjects_(ss,name){
  const sh=ss.getSheetByName(name); if(!sh) throw new Error('No existe la hoja '+name+'.');
  const lr=sh.getLastRow(), lc=sh.getLastColumn(); if(lr<2||lc<1) return [];
  const vals=sh.getRange(1,1,lr,lc).getDisplayValues(), h=vals[0].map(function(x){return String(x||'').trim();});
  return vals.slice(1).filter(function(r){return r.some(function(v){return String(v||'').trim()!=='';});}).map(function(r){const o={};h.forEach(function(k,i){if(k)o[k]=r[i]===undefined?'':r[i];});return o;});
}
function meaningful_(v){const s=String(v===null||v===undefined?'':v).trim(),k=s.toLowerCase();return s!==''&&s!=='—'&&s!=='-'&&s!=='--'&&s!=='/'&&k!=='sin dato'&&k!=='sin indicador'&&k!=='no medido';}
function normTurn_(v){
  const raw=String(v===null||v===undefined?'':v).trim(),s=raw.toLowerCase().replace(/\s+/g,'');
  if(/^(0?7)(:00(:00)?)?(am)?$/.test(s)||s==='7am')return '07:00';
  if(/^(19)(:00(:00)?)?$/.test(s)||/^(0?7)(:00(:00)?)?pm$/.test(s)||s==='7pm')return '19:00';
  if(/^(0?6)(:00(:00)?)?(am)?$/.test(s)||s==='6am')return '06:00';
  if(/^(18)(:00(:00)?)?$/.test(s)||/^(0?6)(:00(:00)?)?pm$/.test(s)||s==='6pm')return '18:00';
  if(/^(13)(:00(:00)?)?$/.test(s)||/^(0?1)(:00(:00)?)?pm$/.test(s)||s==='1pm')return '13:00';
  if(/^(0?1)(:00(:00)?)?(am)?$/.test(s)||s==='1am')return '01:00';
  const m=s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);return m?('0'+Number(m[1])).slice(-2)+':'+m[2]:raw;
}
function dedupeObjects_(area,rows){
  const isWA=area==='wa',dateHead=isWA?'Fecha operativa':'Fecha',valueHeads=AREA_VALUE_HEADERS[area]||['Valor'],out=[],pos=new Map();
  (rows||[]).forEach(function(o0){const o=Object.assign({},o0);o[dateHead]=normDate_(o[dateHead]);o.Turno=normTurn_(o.Turno);const p=[o[dateHead],o.Turno];if(isWA)p.push(String(o['Reporte ID']||'').trim());p.push(String(o.VariableId||'').trim());const k=p.join('|');if(!String(o.VariableId||'').trim())return;let nv='';valueHeads.some(function(h){if(meaningful_(o[h])){nv=o[h];return true;}return false;});if(!pos.has(k)){pos.set(k,out.length);out.push(o);return;}const i=pos.get(k),old=out[i];let ov='';valueHeads.some(function(h){if(meaningful_(old[h])){ov=old[h];return true;}return false;});if(meaningful_(nv)||!meaningful_(ov))out[i]=o;});
  return out;
}
function normDate_(v){
  if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v)) return Utilities.formatDate(v,Session.getScriptTimeZone()||'America/Caracas','yyyy-MM-dd');
  let s=String(v===null||v===undefined?'':v).trim(),m;
  m=s.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)$/);
  if(m) return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
  // Formato operativo venezolano: dd/mm/aaaa. Nunca invertir día y mes.
  m=s.match(/^([0-3]?\d)[\/\-]([01]?\d)[\/\-](\d{2}|\d{4})$/);
  if(m){let y=Number(m[3]);if(y<100)y+=2000;return String(y).padStart(4,'0')+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);}
  return s;
}
function mergeRows_(ss,sheetName,area,incoming){
  const sh=ss.getSheetByName(sheetName); if(!sh) throw new Error('No existe la hoja '+sheetName+'.');
  const lc=sh.getLastColumn(), lr=Math.max(sh.getLastRow(),1), headers=sh.getRange(1,1,1,lc).getDisplayValues()[0].map(function(x){return String(x||'').trim();});
  const idx={};headers.forEach(function(h,i){idx[h]=i;});

  const isWA=area==='wa';
  const dateHead=isWA?'Fecha operativa':'Fecha';
  const required=isWA?[dateHead,'Turno','Reporte ID','VariableId']:[dateHead,'Turno','VariableId'];
  required.forEach(function(h){if(idx[h]===undefined)throw new Error('La hoja '+sheetName+' no contiene la columna '+h+'.');});

  function keyFromRow_(r){
    const p=[normDate_(r[idx[dateHead]]),normTurn_(r[idx.Turno])];
    if(isWA)p.push(String(r[idx['Reporte ID']]||'').trim());
    p.push(String(r[idx.VariableId]||'').trim());
    return p.join('|');
  }
  function keyFromObj_(o){
    const p=[normDate_(o[dateHead]),normTurn_(o.Turno)];
    if(isWA)p.push(String(o['Reporte ID']||'').trim());
    p.push(String(o.VariableId||'').trim());
    return p.join('|');
  }

  const existing=lr>1?sh.getRange(2,1,lr-1,lc).getValues():[], map=new Map();
  existing.forEach(function(r,i){const key=keyFromRow_(r);if(key.replace(/\|/g,'')!=='')map.set(key,i);});
  const valueHeads=AREA_VALUE_HEADERS[area]||['Valor']; let addedRows=[], added=0,filled=0,updated=0,kept=0;
  incoming.forEach(function(obj){
    const key=keyFromObj_(obj); if(key.replace(/\|/g,'')==='')return;
    const row=headers.map(function(h){let v=obj[h];if(h===dateHead)v=normDate_(v);if(h==='Turno')v=normTurn_(v);return v===undefined||v===null?'':v;});
    if(!map.has(key)){addedRows.push(row);map.set(key,existing.length+addedRows.length-1);added++;return;}
    const ei=map.get(key), current=ei<existing.length?existing[ei]:addedRows[ei-existing.length];
    let oldVal='',newVal='';
    valueHeads.some(function(h){if(idx[h]!==undefined&&meaningful_(current[idx[h]])){oldVal=current[idx[h]];return true;}return false;});
    valueHeads.some(function(h){if(idx[h]!==undefined&&meaningful_(row[idx[h]])){newVal=row[idx[h]];return true;}return false;});
    if(meaningful_(newVal)){
      if(ei<existing.length){sh.getRange(ei+2,1,1,lc).setValues([row]);existing[ei]=row;}else{addedRows[ei-existing.length]=row;}
      if(!meaningful_(oldVal))filled++;else updated++;
    }else kept++;
  });
  if(addedRows.length) sh.getRange(sh.getLastRow()+1,1,addedRows.length,lc).setValues(addedRows);
  SpreadsheetApp.flush();
  return {added:added,filled:filled,updated:updated,kept:kept,total:Math.max(sh.getLastRow()-1,0)};
}

function replaceInventory_(ss,incoming){
  let sh=ss.getSheetByName('INVENTARIO_QUIMICO');
  if(!sh){sh=ss.insertSheet('INVENTARIO_QUIMICO');sh.setFrozenRows(1);}
  if(sh.getMaxColumns()<INVENTORY_HEADERS.length)sh.insertColumnsAfter(sh.getMaxColumns(),INVENTORY_HEADERS.length-sh.getMaxColumns());
  sh.getRange(1,1,1,INVENTORY_HEADERS.length).setValues([INVENTORY_HEADERS]);
  const rows=(incoming||[]).map(function(o){
    return INVENTORY_HEADERS.map(function(h){
      let v=o&&Object.prototype.hasOwnProperty.call(o,h)?o[h]:'';
      if(h==='Fecha Estimada'&&v)v=normDate_(v);
      return v===undefined||v===null?'':v;
    });
  }).filter(function(r){return String(r[2]||'').trim()!==''||String(r[3]||'').trim()!=='';});
  if(!rows.length)throw new Error('No se encontraron productos válidos para reemplazar INVENTARIO_QUIMICO.');
  const maxRows=sh.getMaxRows();
  if(maxRows<rows.length+1)sh.insertRowsAfter(maxRows,rows.length+1-maxRows);
  const last=Math.max(sh.getLastRow(),2);
  if(last>1)sh.getRange(2,1,last-1,Math.max(sh.getLastColumn(),INVENTORY_HEADERS.length)).clearContent();
  sh.getRange(2,1,rows.length,INVENTORY_HEADERS.length).setValues(rows);
  sh.setFrozenRows(1);
  SpreadsheetApp.flush();
  return {replaced:rows.length,total:rows.length};
}

function ensureVerifiedSheet_(ss){
  let sh=ss.getSheetByName('LISTA_VERIFICADOS');
  if(!sh){sh=ss.insertSheet('LISTA_VERIFICADOS');sh.setFrozenRows(1);}
  if(sh.getMaxColumns()<VERIFIED_HEADERS.length)sh.insertColumnsAfter(sh.getMaxColumns(),VERIFIED_HEADERS.length-sh.getMaxColumns());
  sh.getRange(1,1,1,VERIFIED_HEADERS.length).setValues([VERIFIED_HEADERS]);
  sh.setFrozenRows(1);
  return sh;
}
function upsertVerified_(ss,incoming){
  const sh=ensureVerifiedSheet_(ss),lc=VERIFIED_HEADERS.length,lr=Math.max(sh.getLastRow(),1);
  const existing=lr>1?sh.getRange(2,1,lr-1,lc).getValues():[],byId=new Map();
  existing.forEach(function(r,i){const id=String(r[0]||'').trim();if(id)byId.set(id,i);});
  const now=new Date(),appended=[];let added=0,updated=0;
  (incoming||[]).forEach(function(o){
    const obj=Object.assign({},o||{});obj.Fecha=normDate_(obj.Fecha);obj.Turno=normTurn_(obj.Turno);
    if((obj['Condicion Fuga']===undefined||String(obj['Condicion Fuga']||'').trim()==='')&&obj.Fugas!==undefined)obj['Condicion Fuga']=obj.Fugas;
    let id=String(obj['Registro ID']||'').trim();
    if(!id)id=[obj.Fecha,obj.Turno,obj['Área'],obj['Punto / Equipo']].map(function(x){return String(x||'').trim();}).join('|');
    if(!obj.Fecha||!String(obj['Área']||'').trim()||!String(obj['Punto / Equipo']||'').trim())return;
    obj['Registro ID']=id;obj['Fecha de carga']=now;
    const row=VERIFIED_HEADERS.map(function(h){let v=obj[h];if(h==='Fecha')v=normDate_(v);return v===undefined||v===null?'':v;});
    if(byId.has(id)){const i=byId.get(id);sh.getRange(i+2,1,1,lc).setValues([row]);existing[i]=row;updated++;}
    else{appended.push(row);byId.set(id,existing.length+appended.length-1);added++;}
  });
  if(appended.length)sh.getRange(sh.getLastRow()+1,1,appended.length,lc).setValues(appended);
  SpreadsheetApp.flush();
  return {added:added,updated:updated,total:Math.max(sh.getLastRow()-1,0)};
}

function ensureSuggestionsSheet_(ss){
  let sh=ss.getSheetByName('SUGERENCIAS');
  if(!sh){sh=ss.insertSheet('SUGERENCIAS');sh.setFrozenRows(1);}
  if(sh.getMaxColumns()<SUGGESTION_HEADERS.length)sh.insertColumnsAfter(sh.getMaxColumns(),SUGGESTION_HEADERS.length-sh.getMaxColumns());
  sh.getRange(1,1,1,SUGGESTION_HEADERS.length).setValues([SUGGESTION_HEADERS]);
  sh.setFrozenRows(1);
  return sh;
}
function appendSuggestion_(ss,nombre,sugerencia){
  const sh=ensureSuggestionsSheet_(ss),now=new Date(),tz=Session.getScriptTimeZone()||'America/Caracas';
  const id='SUG-'+Utilities.getUuid();
  const fecha=Utilities.formatDate(now,tz,'yyyy-MM-dd');
  const hora=Utilities.formatDate(now,tz,'HH:mm:ss');
  sh.appendRow([id,fecha,hora,nombre,sugerencia,now]);
  SpreadsheetApp.flush();
  return {id:id,total:Math.max(sh.getLastRow()-1,0)};
}

function iframeResponse_(obj,nonce,parentOrigin){
  const origin=/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(String(parentOrigin||'')) ? String(parentOrigin) : '*';
  const envelope={type:'POLAR_DRIVE_RESPONSE',nonce:String(nonce||''),payload:obj};
  const data=JSON.stringify(envelope).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const target=JSON.stringify(origin);
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body><script>try{parent.postMessage('+data+','+target+');}catch(e){parent.postMessage('+data+',"*");}<\\/script></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function jsonp_(obj,callback){
  const cb=String(callback||'').trim();
  if(!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)) return json_({ok:false,error:'Callback JSONP inválido.'});
  return ContentService.createTextOutput(cb+'('+JSON.stringify(obj)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}