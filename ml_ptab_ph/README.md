# Modelo experimental PTAB · pH Tanque Subterráneo

Esta carpeta documenta el entrenamiento offline de la función experimental de predicción del dashboard.

## Alcance
- Servicio: PTAB
- Proceso: Agua cruda
- Equipo: Tanque Subterráneo
- Variable: pH (Adim)
- VariableId: `ptab_14`
- Rango operativo: 6,5–8,5

## Datos y limpieza
El entrenamiento usa la hoja `PTAB` de `Base_Maestra_Dashboard.xlsx`. Se conserva únicamente `ptab_14`; se eliminan blancos, valores no numéricos y valores físicamente imposibles de pH fuera de 0–14. Si hay dos turnos el mismo día, se usa el promedio diario.

Los huecos de calendario se completan solo hacia adelante para construir retardos, usando únicamente información pasada. Un valor completado nunca se usa como objetivo de entrenamiento.

## Variables de entrada
Se usan retardos de 1, 2, 3, 7 y 14 días; medias y desviaciones móviles de 3, 7 y 14 días; cambios respecto a 1, 3 y 7 días; cobertura de lecturas; día de la semana codificado de forma cíclica y tendencia temporal.

Los datos se estandarizan con `StandardScaler`.

## Validación
La selección usa `TimeSeriesSplit`, no una división aleatoria, para respetar el orden temporal.

Con el histórico disponible al 14/10/2026:
- +1 día: 65 % SVR RBF + 35 % persistencia. MAE ≈ 0,070 pH; RMSE ≈ 0,094.
- +7 días: 70 % SVR RBF + 30 % media móvil de 3 días. MAE ≈ 0,075 pH; RMSE ≈ 0,102.

## Reentrenamiento
Ejecute:

```bash
python ml_ptab_ph/entrenar_ptab_ph_ml.py Base_Maestra_Dashboard.xlsx ptab_ph_ml_model.js
```

Dependencias: `numpy` y `scikit-learn`.

El navegador solo ejecuta inferencia; no requiere Python. La predicción es experimental y no sustituye una medición real ni el criterio operativo.
