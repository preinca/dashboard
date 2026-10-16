#!/usr/bin/env python3
"""Entrenamiento reproducible del modelo experimental PTAB -> Tanque Subterráneo -> pH.

Uso:
  python ml_ptab_ph/entrenar_ptab_ph_ml.py Base_Maestra_Dashboard.xlsx ptab_ph_ml_model.js

Dependencias:
  numpy
  scikit-learn
"""
from __future__ import annotations
import json, math, re, sys, zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
import numpy as np
from sklearn.base import clone
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

VAR_ID="ptab_14"
FEATURE_NAMES=[
 "lag0","lag1","lag2","lag3","lag7","lag14",
 "mean3","mean7","mean14","std3","std7","std14",
 "diff1","diff3","diff7","coverage3","coverage7","coverage14",
 "dow_sin","dow_cos","trend_time"
]

def ns(tag): return tag.split("}")[-1]

def shared_strings(z):
    name="xl/sharedStrings.xml"
    if name not in z.namelist(): return []
    root=ET.fromstring(z.read(name))
    out=[]
    for si in root.iter():
        if ns(si.tag)=="si":
            out.append("".join(x.text or "" for x in si.iter() if ns(x.tag)=="t"))
    return out

def sheet_target(z,sheet_name):
    wb=ET.fromstring(z.read("xl/workbook.xml")); rid=None
    for node in wb.iter():
        if ns(node.tag)=="sheet" and node.attrib.get("name")==sheet_name:
            rid=next((v for k,v in node.attrib.items() if k.endswith("}id") or k=="r:id"),None)
            break
    if not rid: raise ValueError(f'No se encontró la hoja "{sheet_name}"')
    rels=ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    target=next((n.attrib.get("Target") for n in rels.iter() if ns(n.tag)=="Relationship" and n.attrib.get("Id")==rid),None)
    if not target: raise ValueError("No se pudo resolver la hoja")
    target=target.lstrip("/")
    return target if target.startswith("xl/") else "xl/"+target.lstrip("./")

def col_index(ref):
    m=re.match(r"[A-Z]+",ref or "A1"); n=0
    for ch in m.group(0): n=n*26+ord(ch)-64
    return n-1

def read_sheet_rows(path,sheet_name):
    with zipfile.ZipFile(path) as z:
        shared=shared_strings(z); root=ET.fromstring(z.read(sheet_target(z,sheet_name)))
        rows=[]
        for row in root.iter():
            if ns(row.tag)!="row": continue
            cells={}; max_col=-1
            for c in row:
                if ns(c.tag)!="c": continue
                ci=col_index(c.attrib.get("r","A1")); max_col=max(max_col,ci)
                typ=c.attrib.get("t",""); value=None
                if typ=="inlineStr":
                    value="".join(x.text or "" for x in c.iter() if ns(x.tag)=="t")
                else:
                    vn=next((x for x in c if ns(x.tag)=="v"),None); raw="" if vn is None else (vn.text or "")
                    if typ=="s" and raw: value=shared[int(raw)]
                    elif raw!="":
                        try: value=float(raw)
                        except ValueError: value=raw
                cells[ci]=value
            if max_col>=0:
                arr=[None]*(max_col+1)
                for i,v in cells.items(): arr[i]=v
                rows.append(arr)
        return rows

def parse_date(v):
    if isinstance(v,(int,float)) and not isinstance(v,bool):
        return (datetime(1899,12,30)+timedelta(days=float(v))).date()
    s=str(v or "").strip()
    for fmt in ("%Y-%m-%d","%d/%m/%Y","%m/%d/%Y"):
        try: return datetime.strptime(s[:10],fmt).date()
        except ValueError: pass
    return None

def number(v):
    if isinstance(v,(int,float)) and not isinstance(v,bool):
        x=float(v); return x if math.isfinite(x) else None
    s=str(v or "").strip().replace("\xa0","").replace(" ","")
    if not s: return None
    if "," in s and "." in s:
        s=s.replace(".","").replace(",",".") if s.rfind(",")>s.rfind(".") else s.replace(",","")
    elif "," in s: s=s.replace(",",".")
    try: x=float(s)
    except ValueError: return None
    return x if math.isfinite(x) else None

def load_daily(path):
    rows=read_sheet_rows(path,"PTAB")
    headers=[str(x or "").strip() for x in rows[0]]; pos={h:i for i,h in enumerate(headers)}
    by_day=defaultdict(list); raw_valid=0
    for row in rows[1:]:
        get=lambda name: row[pos[name]] if name in pos and pos[name]<len(row) else None
        if str(get("VariableId") or "").strip()!=VAR_ID: continue
        d=parse_date(get("Fecha")); y=number(get("Valor"))
        if d is None or y is None or not (0<=y<=14): continue
        by_day[d].append(y); raw_valid+=1
    daily={d:float(np.mean(v)) for d,v in by_day.items()}
    if not daily: raise ValueError("No hay lecturas válidas de ptab_14")
    return daily,raw_valid

def context(daily):
    first,last=min(daily),max(daily); dates=[];values=[];observed=[];d=first;last_value=None
    while d<=last:
        if d in daily: last_value=daily[d]; observed.append(True)
        else: observed.append(False)
        dates.append(d); values.append(last_value); d+=timedelta(days=1)
    return dates,np.asarray(values,float),observed

def feature_at(i,dates,values,observed):
    if i<14 or not np.isfinite(values[i]): return None
    lag=lambda k: values[i-k]
    w3,w7,w14=values[i-2:i+1],values[i-6:i+1],values[i-13:i+1]
    coverage=lambda n: sum(observed[max(0,i-n+1):i+1])/n
    dow=dates[i].weekday()
    return np.asarray([
      lag(0),lag(1),lag(2),lag(3),lag(7),lag(14),
      np.mean(w3),np.mean(w7),np.mean(w14),np.std(w3),np.std(w7),np.std(w14),
      lag(0)-lag(1),lag(0)-lag(3),lag(0)-lag(7),
      coverage(3),coverage(7),coverage(14),
      math.sin(2*math.pi*dow/7),math.cos(2*math.pi*dow/7),i/len(values)
    ],float)

def dataset(daily,horizon):
    dates,values,observed=context(daily); pos={d:i for i,d in enumerate(dates)}; X=[];y=[]
    for d in sorted(daily):
        f=feature_at(pos[d],dates,values,observed); target=d+timedelta(days=horizon)
        if f is not None and target in daily: X.append(f);y.append(daily[target])
    return np.vstack(X),np.asarray(y)

def oof(model,X,y):
    cv=TimeSeriesSplit(n_splits=5); yy=[];pp=[];ids=[]
    for tr,te in cv.split(X):
        m=clone(model);m.fit(X[tr],y[tr]);p=m.predict(X[te])
        yy.extend(y[te]);pp.extend(p);ids.extend(te)
    return np.asarray(yy),np.asarray(pp),np.asarray(ids,int)

def select_ensemble(X,y):
    baselines={0:"lag0 / persistencia",6:"media móvil 3 días",7:"media móvil 7 días",8:"media móvil 14 días"}
    scored=[]
    for C in (0.03,0.1,0.3,1,3,10):
      for eps in (0.03,0.05,0.08,0.10,0.12,0.15):
        model=Pipeline([("sc",StandardScaler()),("m",SVR(kernel="rbf",C=C,epsilon=eps,gamma="scale"))])
        yy,p_svr,ids=oof(model,X,y)
        for bi,bn in baselines.items():
          p_base=X[ids,bi]
          for w in np.arange(.50,1.001,.05):
            p=w*p_svr+(1-w)*p_base
            scored.append((float(mean_absolute_error(yy,p)),float(mean_squared_error(yy,p)**.5),C,eps,bi,bn,float(round(w,2)),model))
    return sorted(scored,key=lambda x:(x[0],x[1]))

def export_model(pipe,X,y,h,bi,bn,w):
    sc=pipe.named_steps["sc"];m=pipe.named_steps["m"];yy,p_svr,ids=oof(pipe,X,y);p=w*p_svr+(1-w)*X[ids,bi];ae=np.abs(yy-p)
    return {
      "horizonDays":h,"algorithm":"Ensamble SVR RBF + referencia temporal",
      "ensemble":{"svrWeight":w,"baselineWeight":1-w,"baselineFeatureIndex":bi,"baselineName":bn},
      "scaler":{"mean":sc.mean_.tolist(),"scale":sc.scale_.tolist()},
      "svr":{"supportVectors":m.support_vectors_.tolist(),"dualCoef":m.dual_coef_[0].tolist(),"intercept":float(m.intercept_[0]),"gamma":float(m._gamma),"C":float(m.C),"epsilon":float(m.epsilon)},
      "validation":{"mae":float(mean_absolute_error(yy,p)),"rmse":float(mean_squared_error(yy,p)**.5),"mape":float(np.mean(ae/yy)*100),"accuracyProxy":float(100-np.mean(ae/yy)*100),"absError80":float(np.quantile(ae,.8)),"absError90":float(np.quantile(ae,.9)),"samples":int(len(y)),"evaluationPoints":int(len(yy))}
    }

def main():
    if len(sys.argv)<2: raise SystemExit("Uso: entrenar_ptab_ph_ml.py Base_Maestra_Dashboard.xlsx [ptab_ph_ml_model.js]")
    src=Path(sys.argv[1]); out=Path(sys.argv[2]) if len(sys.argv)>2 else Path("ptab_ph_ml_model.js")
    daily,raw_valid=load_daily(src); horizons={}; selection={}
    for h in (1,7):
        X,y=dataset(daily,h); best=select_ensemble(X,y)[0]
        mae,rmse,C,eps,bi,bn,w,model=best; model.fit(X,y)
        horizons[str(h)]=export_model(model,X,y,h,bi,bn,w)
        selection[str(h)]={"selected":f"{w:.0%} SVR RBF (C={C}, eps={eps}) + {1-w:.0%} {bn}","cv_mae":mae,"cv_rmse":rmse}
    payload={"version":"PTAB-PH-ML-"+datetime.now().strftime("%Y-%m-%d"),"variableId":VAR_ID,"service":"PTAB","process":"Agua cruda","equipment":"Tanque Subterráneo","variable":"pH (Adim)","operatingRange":{"min":6.5,"max":8.5},"training":{"source":"Base_Maestra_Dashboard → PTAB","firstDate":str(min(daily)),"lastDate":str(max(daily)),"rawValidReadings":raw_valid,"dailyObservedPoints":len(daily),"featureNames":FEATURE_NAMES,"method":"Promedio diario; forward-fill causal para retardos; objetivos observados; StandardScaler; TimeSeriesSplit; ensamble seleccionado por MAE."},"horizons":horizons}
    out.write_text("/* Generado con scikit-learn. */\nwindow.PTAB_PH_ML_MODEL = "+json.dumps(payload,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
    out.with_name("metricas_modelo.json").write_text(json.dumps({"training":payload["training"],"selection":selection,"validation":{h:horizons[h]["validation"] for h in horizons}},ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(selection,ensure_ascii=False,indent=2))

if __name__=="__main__": main()
