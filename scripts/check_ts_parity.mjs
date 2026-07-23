// Verifies web/lib/safety.ts reproduces src/silentguard/models/safety.py exactly.
// The interactive safety dial recomputes the operating point client-side, so this
// guards that the port stays faithful. Run: node scripts/check_ts_parity.mjs

import fs from 'fs';
const EPS=1e-9;
function calibrate(pf,y,floor){
  const T=pf.filter((_,i)=>y[i]===1).sort((a,b)=>a-b);
  const F=pf.filter((_,i)=>y[i]===0).sort((a,b)=>a-b);
  const kT=Math.floor((1-floor)*T.length);
  const tHigh = kT<=0 ? T[T.length-1]+EPS : T[T.length-kT];
  const kF=Math.floor((1-floor)*F.length);
  let tLow = kF<=0 ? F[0]-EPS : F[kF-1];
  return {tHigh, tLow: Math.min(tLow,tHigh)};
}
function report(pf,y,tHigh,tLow){
  let nT=0,nF=0,sT=0,sF=0,nK=0,nS=0,nD=0;
  for(let i=0;i<y.length;i++){
    const t=y[i]===1; t?nT++:nF++;
    const d = pf[i]>=tHigh?'s':(pf[i]<=tLow?'k':'d');
    if(d==='s'){nS++; t?sT++:sF++;} else if(d==='k') nK++; else nD++;
  }
  return {trueSens:1-sT/nT, faSupp:sF/nF, deferRate:nD/y.length, nK,nS,nD,sT,sF};
}
const lines=fs.readFileSync('data/processed/oof_predictions.csv','utf8').trim().split('\n');
const hdr=lines[0].split(','); const rows=lines.slice(1).map(l=>l.split(','));
const col=n=>{const i=hdr.indexOf(n); return rows.map(r=>r[i]);};
const y=col('label').map(Number);
const sd=fs.readFileSync('data/processed/safety_detail.csv','utf8').trim().split('\n');
const sh=sd[0].split(','); const sr=sd.slice(1).map(l=>l.split(','));
const NAME={rf:'RandomForest',cnn:'1D-CNN',ens:'RF+CNN ensemble'};
console.log('model        | metric      | TypeScript port | Python engine   | match');
console.log('-'.repeat(72));
let allOk=true;
for(const k of ['rf','cnn','ens']){
  const pf=col(`p_true_indist_${k}`).map(v=>1-Number(v));
  const th=calibrate(pf,y,0.99); const rep=report(pf,y,th.tHigh,th.tLow);
  const py=sr.find(r=>r[sh.indexOf('model')]===NAME[k]);
  const g=n=>Number(py[sh.indexOf(n)]);
  const checks=[['true_sens',rep.trueSens,g('true_alarm_sensitivity')],
                ['fa_supp',rep.faSupp,g('false_alarm_suppression')],
                ['defer',rep.deferRate,g('defer_rate')],
                ['t_high',th.tHigh,g('t_high')],
                ['n_suppress',rep.nS,g('n_suppress')]];
  for(const [n,a,b] of checks){
    const ok=Math.abs(a-b)<1e-9; if(!ok) allOk=false;
    console.log(`${NAME[k].padEnd(12)} | ${n.padEnd(11)} | ${String(a).slice(0,15).padEnd(15)} | ${String(b).slice(0,15).padEnd(15)} | ${ok?'OK':'MISMATCH'}`);
  }
}
console.log('-'.repeat(72));
console.log(allOk?'ALL MATCH — TS port is faithful to the Python engine':'PARITY FAILURE');
