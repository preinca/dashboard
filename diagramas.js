/* Galería de diagramas industriales, integrada sin cambiar app.js. */
(function(){
  'use strict';
  if(typeof SERVICIOS !== 'undefined'){
    SERVICIOS.diagramas = {
      nom:'Diagramas de Procesos',sub:'Documentación visual de servicios industriales · 6 diagramas',
      color:'#375C91',corto:'Diagramas de Procesos',kpi:null,keys:[]
    };
  }
  if(typeof pintarEncabezado === 'function'){
    const anterior=pintarEncabezado;
    pintarEncabezado=function(){
      if(typeof activa !== 'undefined' && activa==='diagramas'){
        const t=document.getElementById('view-title');
        const s=document.getElementById('view-sub');
        if(t)t.textContent='Diagramas de Procesos';
        if(s)s.textContent='Documentación técnica de los sistemas y servicios de planta';
        return;
      }
      return anterior.apply(this,arguments);
    };
  }

  const gallery=document.getElementById('diagramas-gallery');
  const modal=document.getElementById('diagramas-modal');
  const title=document.getElementById('diagramas-modal-title');
  const pdfLink=document.getElementById('diagramas-modal-open');
  const closeBtn=document.getElementById('diagramas-modal-close');
  const viewport=document.getElementById('diagramas-modal-body');
  const stage=document.getElementById('diagramas-modal-stage');
  const photo=document.getElementById('diagramas-modal-image');
  const zoomOut=document.getElementById('diagramas-zoom-out');
  const zoomIn=document.getElementById('diagramas-zoom-in');
  const zoomReset=document.getElementById('diagramas-zoom-reset');
  const zoomText=document.getElementById('diagramas-zoom-level');
  if(!gallery||!modal||!title||!pdfLink||!closeBtn||!photo||!stage||!viewport||!zoomOut||!zoomIn||!zoomReset||!zoomText)return;

  let lastFocus=null;
  let zoom=1;
  let fitWidth=0,fitHeight=0;
  const MIN_ZOOM=0.5,MAX_ZOOM=5;

  function fitImage(){
    if(!photo.naturalWidth||!photo.naturalHeight)return;
    const safeWidth=Math.max(120,viewport.clientWidth-32);
    const safeHeight=Math.max(120,viewport.clientHeight-32);
    const factor=Math.min(safeWidth/photo.naturalWidth,safeHeight/photo.naturalHeight);
    fitWidth=Math.max(1,Math.round(photo.naturalWidth*factor));
    fitHeight=Math.max(1,Math.round(photo.naturalHeight*factor));
    zoom=1;
    renderZoom();
  }
  function renderZoom(){
    if(!fitWidth)return;
    const w=Math.round(fitWidth*zoom),h=Math.round(fitHeight*zoom);
    const scrolledX=viewport.scrollLeft/Math.max(1,viewport.scrollWidth);
    const scrolledY=viewport.scrollTop/Math.max(1,viewport.scrollHeight);
    photo.style.width=w+'px';
    photo.style.height=h+'px';
    stage.style.width=Math.max(viewport.clientWidth,w+32)+'px';
    stage.style.height=Math.max(viewport.clientHeight,h+32)+'px';
    zoomText.textContent=Math.round(zoom*100)+'%';
    zoomOut.disabled=zoom<=MIN_ZOOM;
    zoomIn.disabled=zoom>=MAX_ZOOM;
    // Cuando se amplía, mostrar inicialmente la zona central.
    viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);
    viewport.scrollTop=Math.max(0,(viewport.scrollHeight-viewport.clientHeight)/2);
  }
  function setZoom(value){
    zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,Math.round(value*100)/100));
    renderZoom();
  }
  function openDiagram(card){
    const pdf=card.dataset.diagramaPdf||'';
    const image=card.dataset.diagramaImg||'';
    if(!/^diagramas\/[a-z0-9-]+\.pdf$/.test(pdf)||!/^diagramas\/vistas\/[a-z0-9-]+\.webp$/.test(image))return;
    lastFocus=card;
    title.textContent=card.dataset.diagramaTitle||'Diagrama';
    pdfLink.href=pdf;
    modal.hidden=false;
    document.body.classList.add('diagramas-modal-open');
    photo.alt='Vista ampliada: '+title.textContent;
    fitWidth=0;fitHeight=0;
    zoomText.textContent='100%';
    photo.onload=fitImage;
    photo.src=image;
    if(photo.complete && photo.naturalWidth)fitImage();
    closeBtn.focus();
  }
  function closeDiagram(){
    if(modal.hidden)return;
    modal.hidden=true;
    document.body.classList.remove('diagramas-modal-open');
    photo.onload=null;
    photo.removeAttribute('src');
    photo.style.width='';photo.style.height='';
    stage.style.width='';stage.style.height='';
    if(lastFocus&&lastFocus.isConnected)lastFocus.focus();
    lastFocus=null;
  }
  gallery.addEventListener('click',function(e){
    const card=e.target.closest('[data-diagrama-pdf]');
    if(card)openDiagram(card);
  });
  closeBtn.addEventListener('click',closeDiagram);
  zoomIn.addEventListener('click',function(){setZoom(zoom*1.5);});
  zoomOut.addEventListener('click',function(){setZoom(zoom/1.5);});
  zoomReset.addEventListener('click',function(){setZoom(1);});
  modal.addEventListener('click',function(e){if(e.target===modal)closeDiagram();});
  document.addEventListener('keydown',function(e){
    if(modal.hidden)return;
    if(e.key==='Escape'){e.preventDefault();closeDiagram();return;}
    if(e.key==='+'||e.key==='='){e.preventDefault();setZoom(zoom*1.5);}
    if(e.key==='-'){e.preventDefault();setZoom(zoom/1.5);}
  });
  document.querySelectorAll('.nav .tab').forEach(function(tab){
    tab.addEventListener('click',function(){if(!modal.hidden)closeDiagram();});
  });
  window.addEventListener('resize',function(){if(!modal.hidden)fitImage();});
})();
