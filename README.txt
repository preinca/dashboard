DASHBOARD SERVICIOS INDUSTRIALES · V11.5 · 01-10-2026

CAMBIOS DE ESTA VERSION
- Checklist Vapor y Condensado: referencias visuales redimensionadas segun la cantidad de fotos mostradas.
- Cuando la seleccion tiene una sola foto: ancho objetivo 900 px y alto 504 px, centrada.
- Cuando la seleccion tiene varias fotos: cada tarjeta usa ancho objetivo 450 px y alto 252 px, centradas y adaptables.
- Nuevo selector Vista: Punto / equipo, Todas las fotos del area u Ocultar fotos.
- La vista de area elimina fotografias duplicadas que reutilizan el mismo archivo.
- Se elimino de las tarjetas el texto Referencia · pagina X del PDF.
- Se conserva la ampliacion en modal, la paginacion del historico y el resto de la logica.
- Sin cambios de backend ni estructura de Google Drive respecto de V11.4.

INSTALACION
1. Sustituya los archivos del repositorio por los de este paquete.
2. Mantenga completa la carpeta referencias_condensado/.
3. Haga Commit changes y luego Ctrl+F5.
4. No es necesario volver a desplegar Apps Script si ya esta instalada la version compatible con LISTA_VERIFICADOS.


ACTUALIZACIÓN V11.6 · 01-10-2026
- Vista: “Ocultar fotos” pasa a “Ocultar Referencias”.
- Al ocultar referencias desaparece completamente el bloque inferior de fotografías.
- Valores numéricos con más de dos decimales se muestran redondeados a 2 decimales en el dashboard; el dato almacenado no se modifica.
- No requiere cambios ni nuevo despliegue de Apps Script.


ACTUALIZACIÓN V11.7 · 01-10-2026
- Lista de Verificados: se elimina el botón “Descargar formato”.
- Lista de Verificados: se elimina el indicador visible “Google Drive · Base Maestra · LISTA_VERIFICADOS”.
- Sin cambios de backend ni estructura de Drive.


ACTUALIZACIÓN V11.8 · 02-10-2026
- Corrección de fecha inicial en PTAB, PTAR, VAPOR, SUAVIZADORES y Compresores/Refrigeración.
- Después de la primera lectura válida de Google Drive, cada servicio muestra automáticamente su fecha más reciente disponible.
- Al cambiar el filtro de mes se selecciona la última fecha disponible de ese mes.
- La selección manual de fechas del operador se conserva después de la sincronización inicial.
- No requiere cambios de Apps Script ni de la Base Maestra.
