/* Home Time: jars, long weekends, month in review, badges */
/* ================= jars: savings goals =================
   Each jar has a target and an amount that goes in every payday. It's a plan: the app keeps
   count, you move the real money. Same glossy liquid as the CPF columns. */
const JPAL=[{id:7,c:'#3FB8FF'},{id:3,c:'#7B5CFF'},{id:6,c:'#19D9A0'},{id:2,c:'#FFC53D'},{id:5,c:'#FF7A45'}];
if(!state.jars) state.jars=[];
const jarCol=j=>(JPAL.find(p=>p.id===j.pal)||JPAL[0]).c;
const jarTotal=()=>state.jars.reduce((a,j)=>a+j.saved,0);
const moneyR=n=>'$'+Math.round(n).toLocaleString('en-SG');
// on payday every jar gets its amount (once per payday, capped at the target)
function creditJars(){
  if(!state.jars.length) return null;
  const now=new Date(), due=[];
  for(let k=-24;k<=0;k++){ const pd=paydayOf(now.getFullYear(),now.getMonth()+k); if(dayStart(pd)<=dayStart(now.getTime())) due.push(pd); }
  let todo=due.filter(pd=>!state.jarPd||isoDate(pd)>state.jarPd);
  if(!state.jarPd) todo=todo.slice(-1);           // first time: just the latest payday
  if(!todo.length) return null;
  let total=0; const moved=new Set();
  todo.forEach(pd=>state.jars.forEach(j=>{ if(j.created&&j.created>pd+DAY) return; const room=Math.max(0,j.target-j.saved), amt=Math.min(room,j.per||0); if(amt<=0) return;
    if(j.from==null) j.from=j.saved; j.saved+=amt; total+=amt; moved.add(j.id); (j.log=j.log||[]).unshift({t:pd,amt,why:'Payday'}); j.log=j.log.slice(0,30); }));
  state.jarPd=isoDate(due[due.length-1]);
  if(total>0) state.jarFresh={pd:state.jarPd,total:(state.jarFresh&&state.jarFresh.total||0)+total,ids:[...new Set([...(state.jarFresh?state.jarFresh.ids:[]),...moved])]};
  save(); return total>0?total:null;
}
let jOff=null, jEditing=null, jLv={}, jRAF=null;
function renderJars(animate){
  const J=state.jars, tot=jarTotal(), per=J.reduce((a,j)=>a+(j.saved<j.target?j.per||0:0),0);
  const show=v=>$('jAmt').textContent=money(v);
  const fresh=state.jarFresh;
  if(animate&&ANIM){ const o={v:fresh?tot-fresh.total:0}; G.to(o,{v:tot,duration:1.4,delay:fresh?.9:.1,ease:'power3.out',onUpdate:()=>show(o.v)}); } else show(tot);
  $('jNote').textContent=J.length?`${J.length} jar${J.length===1?'':'s'}${fresh?` · ${money(fresh.total)} went in on payday`:''}`:'Make a jar for something you’re saving up for.';
  $('jCard').hidden=!J.length; $('jSplit').hidden=!J.length;
  const pd=nextPayday(), take=pd?paydayAmount(pd):null;
  $('jSplit').innerHTML=`<div><span>Into jars each payday</span><b>${money(per)}</b></div><div><span>Left to spend${take!=null?'':' (after jars)'}</span><b>${take!=null?money(Math.max(0,take-per)):'—'}</b></div>`;
  $('jLbls').style.gridTemplateColumns=`repeat(${Math.max(1,Math.min(6,J.length))},1fr)`;
  $('jLbls').innerHTML=J.slice(0,6).map(j=>`<div><b>${moneyR(j.saved)}</b><span>${esc(j.name)}</span></div>`).join('');
  $('jList').innerHTML=J.map((j,i)=>{ const full=j.saved>=j.target, left=Math.max(0,j.target-j.saved), n=j.per>0?Math.ceil(left/j.per):null;
    const eta=full?'Full! 🎉':n==null?'No amount set for payday':`Full in ${n} payday${n===1?'':'s'}${pd?`, around ${new Date(new Date(pd).setMonth(new Date(pd).getMonth()+n-1)).toLocaleDateString(undefined,{month:'short',year:'numeric'})}`:''}`;
    return `<button type="button" class="card jRow${full?' full':''}" data-i="${i}" style="--jc:${jarCol(j)}"><span class="dot"></span><b>${esc(j.name)}</b><small>${eta}</small><span class="amt">${moneyR(j.saved)}<small>of ${moneyR(j.target)}</small></span></button>`; }).join('');
  $('jList').querySelectorAll('.jRow').forEach(b=>b.onclick=()=>openJar(+b.dataset.i,true));
  // liquid levels: from before payday to now, so you see it fill
  J.forEach(j=>{ const to=Math.min(1,j.saved/Math.max(1,j.target))*.94, from=fresh&&fresh.ids.includes(j.id)?Math.min(1,(j.from??j.saved)/Math.max(1,j.target))*.94:0;
    jLv[j.id]=jLv[j.id]||{v:0,amp:1}; const L=jLv[j.id]; G&&G.killTweensOf(L);
    if(animate&&ANIM){ L.v=from; G.to(L,{v:to,duration:1.8,delay:fresh?1.1:.3,ease:'elastic.out(1,.6)'}); G.fromTo(L,{amp:2.4},{amp:1,duration:2.4,delay:.3}); } else L.v=to; });
  if(animate&&ANIM&&fresh){ setTimeout(()=>{ const r=$('jCard').getBoundingClientRect(); if(r.width){ burst(r.left+r.width/2,r.top+10,70,'c'); Sound.bubble&&[0,1,2,3,4].forEach(k=>setTimeout(()=>Sound.bubble(300+k*60),k*120)); } },500); }
  if(fresh){ delete state.jarFresh; J.forEach(j=>delete j.from); save(); }
  if(animate&&ANIM) G.from(['#jHero','#jCard','#jSplit','#jList .jRow','#jAdd'],{y:24,opacity:0,stagger:.05,duration:.5,ease:'power4.out',clearProps:'transform,opacity'});
  if(!jRAF&&Liquid) jRAF=requestAnimationFrame(jarLoop);
}
function jarLoop(){ if(page!=='jars'||document.hidden||!Liquid){ jRAF=null; return; }
  const cv=$('jCv'), J=state.jars.slice(0,6); if(J.length){ const W=cv.clientWidth, sw=W/J.length;
    Liquid.draw(cv,{mode:'v',items:J.map(j=>({level:(jLv[j.id]||{v:0}).v,pal:j.pal,amp:(jLv[j.id]||{amp:1}).amp,bubbles:true})),slot:sw,T:Math.min(sw*.085,9),len:cv.clientHeight-10,pad:6,t:performance.now()/1000}); }
  jRAF=RM?null:requestAnimationFrame(jarLoop); }
$('jCv').addEventListener('pointerdown',e=>{ const J=state.jars.slice(0,6); if(!J.length) return; const r=$('jCv').getBoundingClientRect(), j=J[Math.min(J.length-1,Math.floor((e.clientX-r.left)/r.width*J.length))], L=jLv[j.id];
  if(L&&ANIM){ G.killTweensOf(L,'amp'); G.fromTo(L,{amp:3},{amp:1,duration:1.8,ease:'power2.out'}); } Sound.bubble(); haptic(); });
let jPal=7;
function setJPal(v){ jPal=+v; document.querySelectorAll('#jCols button').forEach(b=>b.setAttribute('aria-checked',String(+b.dataset.v===jPal))); }
$('jCols').innerHTML=JPAL.map(p=>`<button type="button" role="radio" data-v="${p.id}" style="--jc:${p.c}" aria-label="Colour"></button>`).join('');
document.querySelectorAll('#jCols button').forEach(b=>b.onclick=()=>setJPal(b.dataset.v));
function openJar(i,move){
  const j=i!=null?state.jars[i]:null; jEditing=i;
  $('jarTitle').textContent=j?j.name:'New jar'; $('jarHint').textContent=j?(move?'Put money in or take some out.':'Change the jar.'):'What are you saving for?'; $('jarHint').style.color='';
  $('jarEdit').hidden=!!(j&&move); $('jarMove').hidden=!(j&&move);
  $('jName').value=j?j.name:''; $('jTarget').value=j?j.target:''; $('jPer').value=j?j.per:''; $('jSaved').value=j?Math.round(j.saved*100)/100:''; $('jSavedWrap').hidden=!!j;
  setJPal(j?j.pal:JPAL[state.jars.length%JPAL.length].id); $('jMoveAmt').value='';
  $('jSave').textContent=j&&move?'Edit jar':'Save jar'; $('jDel').hidden=!j||move;
  $('jLog').innerHTML=j&&j.log&&j.log.length?j.log.slice(0,8).map(l=>`<div><span>${new Date(l.t).toLocaleDateString(undefined,{day:'numeric',month:'short'})} · ${esc(l.why)}</span><b>${l.amt<0?'−':'+'}${money(Math.abs(l.amt))}</b></div>`).join(''):'';
  jPreview(); openSheet('jarSheet');
}
function jPreview(){ const t=+$('jTarget').value||0, p=+$('jPer').value||0, s=+$('jSaved').value||0, el=$('jPreview');
  if(!t){ el.textContent='Set a target to see when it fills up.'; return; }
  const n=p>0?Math.ceil(Math.max(0,t-(jEditing!=null?state.jars[jEditing].saved:s))/p):null; el.textContent=n==null?'Add an amount for each payday.':n===0?'Already full!':`Full in ${n} payday${n===1?'':'s'} at ${money(p)} each`; }
['jTarget','jPer','jSaved'].forEach(id=>$(id).addEventListener('input',jPreview));
$('jAdd').onclick=()=>openJar(null,false);
$('jCancel').onclick=closeSheet;
$('jSave').onclick=()=>{
  if(jEditing!=null&&!$('jarMove').hidden){ $('jarEdit').hidden=false; $('jarMove').hidden=true; $('jSave').textContent='Save jar'; $('jDel').hidden=false; $('jarHint').textContent='Change the jar.'; return; }
  const name=$('jName').value.trim(), target=+$('jTarget').value, per=+$('jPer').value||0;
  if(!name){ shake('#jName'); $('jarHint').textContent='Give your jar a name.'; $('jarHint').style.color='var(--coral)'; return; }
  if(!(target>0)){ shake('#jTarget'); $('jarHint').textContent='Set a target amount.'; $('jarHint').style.color='var(--coral)'; return; }
  if(jEditing!=null){ Object.assign(state.jars[jEditing],{name,target,per,pal:jPal}); }
  else { if(state.jars.length>=6){ toast('Six jars is the most that fit. Delete one first.',false); return; }
    const saved=Math.max(0,+$('jSaved').value||0); state.jarMade=1; state.jars.push({id:'j'+Date.now().toString(36),name,target,per,saved,pal:jPal,created:Date.now(),log:saved?[{t:Date.now(),amt:saved,why:'Starting amount'}]:[]}); }
  save(); closeSheet(); renderJars(true); checkBadges(); toast(jEditing!=null?'Jar updated':'Jar made 🫙',false);
};
function jMove(sign){ const j=state.jars[jEditing], a=+$('jMoveAmt').value; if(!(a>0)){ shake('#jMoveAmt'); return; }
  const amt=sign>0?a:-Math.min(a,j.saved); j.saved=Math.max(0,j.saved+amt); (j.log=j.log||[]).unshift({t:Date.now(),amt,why:sign>0?'Put in':'Taken out'}); j.log=j.log.slice(0,30);
  save(); closeSheet(); renderJars(true); checkBadges(); if(sign>0){ Sound.bubble(); } toast(`${sign>0?'Added':'Took out'} ${money(Math.abs(amt))} ${sign>0?'to':'from'} ${j.name}`,false); }
$('jIn').onclick=()=>jMove(1); $('jOut').onclick=()=>jMove(-1);
let jDelArmed=false;
$('jDel').onclick=()=>{ if(!jDelArmed){ jDelArmed=true; $('jDel').classList.add('armed'); $('jDel').textContent='Tap again to delete'; setTimeout(()=>{ jDelArmed=false; $('jDel').classList.remove('armed'); $('jDel').textContent='Delete this jar'; },4000); return; }
  jDelArmed=false; const j=state.jars.splice(jEditing,1)[0]; save(); closeSheet(); renderJars(true); toast(`Deleted ${j.name}`,false); };

/* ================= long weekends: where a day or two of leave goes furthest ================= */
const dayIso=ts=>isoDate(ts);
function leaveLeft(year){ const ls=leaveStart(); const used=state.history.filter(r=>typeOf(r)==='al'&&new Date(r.in).getFullYear()===year).length; return {left:Math.max(0,(+S().al||0)-used),from:ls}; }
function longWeekends(){
  const today=dayStart(Date.now()), end=today+365*DAY, days=+S().days||5;
  const rec={}; state.history.forEach(r=>{ const t=typeOf(r); if(t!=='work') rec[dayIso(r.in)]=t; });
  const off=ts=>{ const d=new Date(ts), wd=(d.getDay()+6)%7; const k=dayIso(ts); return wd>=days||!!PH[k]||rec[k]==='al'||rec[k]==='ph'; };
  const kind=ts=>{ const k=dayIso(ts); return PH[k]?'ph':rec[k]==='al'?'bk':((new Date(ts).getDay()+6)%7>=days?'we':'al'); };
  const seen=new Set(), out=[];
  Object.keys(PH).sort().forEach(k=>{ const p=dayStart(isoTs(k)); if(p<today||p>end) return;
    const opts=[];
    for(let s=p-9*DAY;s<=p;s+=DAY) for(let e=p;e<=p+9*DAY;e+=DAY){ if(e-s>12*DAY) continue;
      let need=0; for(let t=s;t<=e;t+=DAY) if(!off(t)) need++; if(need>3) continue;
      let a=s,b=e; while(off(a-DAY)) a-=DAY; while(off(b+DAY)) b+=DAY;
      const len=Math.round((b-a)/DAY)+1, prev=opts.find(o=>o.need===need);
      if(!prev||len>prev.len||(len===prev.len&&a<prev.a)) { if(prev) opts.splice(opts.indexOf(prev),1); opts.push({a,b,len,need}); } }
    opts.sort((x,y)=>x.need-y.need);
    const keep=[]; opts.forEach(o=>{ const best=keep[keep.length-1]; if(!best||o.len>=best.len+2) keep.push(o); });
    keep.forEach(o=>{ if(o.len<3||(o.need>0&&o.len<4)) return; const key=o.a+'|'+o.b; if(seen.has(key)) return; seen.add(key);
      const hols=[]; for(let t=o.a;t<=o.b;t+=DAY){ const n=PH[dayIso(t)]; if(n&&!hols.includes(n)) hols.push(n); }
      const take=[]; for(let t=o.a;t<=o.b;t+=DAY) if(!off(t)) take.push(t);
      const strip=[]; for(let t=o.a;t<=o.b;t+=DAY) strip.push({t,k:kind(t)});
      out.push(Object.assign(o,{name:hols.join(' + ').replace(/ \(in lieu\)/g,''),take,strip})); });
  });
  return out.sort((x,y)=>x.a-y.a||x.need-y.need);
}
function renderLong(){
  const box=$('lwList'); if(!box) return;
  const L=longWeekends().filter(o=>o.need>0||o.len>=3).slice(0,10), ls=leaveStart();
  if(!L.length){ box.innerHTML='<p class="note" style="margin:0 0 6px">No public holidays in the next year are loaded yet.</p>'; return; }
  const MS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], dd=ts=>{ const d=new Date(ts); return `${DOWS[d.getDay()]} ${d.getDate()}`; }, dm=ts=>`${dd(ts)} ${MS[new Date(ts).getMonth()]}`;
  box.innerHTML=L.map((o,i)=>{ const yr=new Date(o.a).getFullYear(), lf=leaveLeft(yr).left, booked=o.need===0&&o.strip.some(x=>x.k==='bk');
    const early=ls&&o.take.some(t=>t<ls), short=o.need>lf;
    const btn=o.need===0?'':`<button type="button" class="lwBtn" data-i="${i}" ${early||short?'disabled':''}>${early?`Leave starts ${new Date(ls).toLocaleDateString(undefined,{day:'numeric',month:'short'})}`:short?`Only ${lf} day${lf===1?'':'s'} left`:`Book ${o.need} day${o.need===1?'':'s'} of leave`}</button>`;
    return `<div class="lwRow"><div class="lwTop"><b>${o.len} days off</b><small>${esc(o.name)}</small></div>
      <p class="lwSub">${o.need===0?(booked?'<strong>Booked ✓</strong> · ':'<strong>Free</strong>, no leave needed · '):`Take <strong>${o.take.map(dd).join(' &amp; ')} ${MS[new Date(o.take[o.take.length-1]).getMonth()]}</strong> off → `}${dm(o.a)} to ${dm(o.b)}</p>
      <div class="lwStrip">${o.strip.map(x=>`<i class="${x.k}">${DOWS[new Date(x.t).getDay()]}<small>${new Date(x.t).getDate()}</small></i>`).join('')}</div>${btn}</div>`; }).join('');
  box.querySelectorAll('.lwBtn').forEach(b=>b.onclick=()=>{ const o=L[+b.dataset.i];
    o.take.forEach(t=>{ const d=new Date(t); d.setHours(12,0,0,0); if(!state.history.some(r=>sameDay(r.in,d.getTime()))) state.history.push(priceRec({in:d.getTime(),type:'al',rate:rates(),shift:SHIFT()})); });
    sortHist(); state.lwBooked=(state.lwBooked||0)+1; save(); renderDays(); animateDays();
    Sound.stack&&Sound.stack(); haptic(); const r=b.getBoundingClientRect(); burst(r.left+r.width/2,r.top,50,'c');
    toast(`Booked ${o.need} day${o.need===1?'':'s'} of leave: ${o.len} days off 🏖️`,false); });
}

/* ================= month in review =================
   One liquid scene behind every card: glossy blobs that swim, merge and split into a new shape for
   each card while the background colour blends across. Its own generated music plays underneath. */
if(!state.wrapped) state.wrapped={};
const WDN=['Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays','Sundays'];
function wrapData(p){
  const L=state.history.filter(r=>r.in>=p.start&&r.in<p.end), x=statsOf(L); if(!x) return null;
  const m=monthForStart(p.start), slip=state.payslips&&state.payslips[p.start];
  const pay=m?(slip?(slip.net!=null?slip.net:slip.gross-(slip.ee||0)-(slip.shg||0)-(slip.other||0)):takeHomeEst(m)):null;
  let cpf=null, mine=0, boss=0; for(let off=0;off>-24;off--){ const pp=periodOf(Date.now(),off); if(pp.start===p.start){ const c=cpfFor(off); if(c){ cpf=c.total; mine=c.mine; boss=c.boss; } break; } if(pp.start<p.start) break; }
  let cpfAllT=0; try{ const sd=startTs(); for(let off=0;off>-240;off--){ const pp=periodOf(Date.now(),off); if(sd&&pp.end<=sd) break; if(pp.start>p.start) continue; if(!sd&&pp.start<p.start&&!state.history.some(r=>r.in>=pp.start&&r.in<pp.end)&&!slipOf(pp)) break; const c=cpfFor(off); if(c) cpfAllT+=c.total; } }catch(e){}
  const jarIn=state.jars.reduce((a,j)=>a+(j.log||[]).filter(l=>l.t>=p.start&&l.t<p.end+10*DAY&&l.amt>0&&l.why!=='Starting amount').reduce((s,l)=>s+l.amt,0),0);
  const inWin=t=>t>=p.start&&t<p.end+10*DAY;
  const badges=[]; Object.entries(state.bdg||{}).forEach(([k,v])=>{ const b=BADGES.find(x=>x.id===k); if(!b) return; (v.t||[]).forEach((t,i)=>{ if(t&&inWin(t)) badges.push({b,lv:i+1}); }); });
  const days=[...x.w].sort((a,b)=>a.in-b.in).map(r=>({d:new Date(r.in).getDate(),h:(r.out-r.in)/3.6e6,ot:!!r.otMs}));
  const wd=[0,0,0,0,0,0,0].map(()=>({h:0,n:0})); x.w.forEach(r=>{ const k=(new Date(r.in).getDay()+6)%7; wd[k].h+=(r.out-r.in)/3.6e6; wd[k].n++; });
  const avgWd=wd.map(o=>o.n?o.h/o.n:0), busiest=avgWd.indexOf(Math.max(...avgWd));
  // longest run of workdays clocked in this period
  let run=0,best=0; const worked=new Set(x.w.map(r=>isoDate(r.in))), offK=new Set(L.filter(r=>typeOf(r)!=='work').map(r=>isoDate(r.in)));
  for(let t=dayStart(p.start);t<Math.min(p.end,Date.now()+DAY);t+=DAY){ const k=isoDate(t), w=(new Date(t).getDay()+6)%7; if(w>=(+S().days||5)||PH[k]||offK.has(k)) continue; if(worked.has(k)){ run++; best=Math.max(best,run); } else if(t<dayStart(Date.now())) run=0; }
  const earned=x.w.reduce((a,r)=>a+(r.earn||0),0);
  const prevP={start:periodOf(p.start,-1).start,end:p.start}, prev=statsOf(state.history.filter(r=>r.in>=prevP.start&&r.in<prevP.end));
  const y=new Date(p.start).getFullYear(), alUsed=state.history.filter(r=>typeOf(r)==='al'&&new Date(r.in).getFullYear()===y).length, ls=leaveStart();
  const nights=x.w.filter(r=>clsOn(r.in).some(s=>toMin(s.start)>=17*60)).length;
  const monthName=new Date(p.start+15*DAY).toLocaleDateString(undefined,{month:'long'});
  return {p,x,pay,cpf,mine,boss,cpfAllT,jarIn,badges,monthName,slip:!!slip,days,avgWd,busiest,best,earned,prev,alLeft:Math.max(0,(+S().al||0)-alUsed),leaveOn:!ls||Date.now()>=ls,nights};
}


/* what didn't go so well in a pay period: only things that actually happened */
function weakStats(p){
  const L=state.history.filter(r=>r.in>=p.start&&r.in<p.end), x=statsOf(L), out=[];
  const w=x?x.w:[], lateAfter=toMin(S().lateAfter||S().to||'09:00'), shift=SHIFT();
  const late=w.filter(r=>tod(r.in)>lateAfter);
  if(late.length){ const mins=late.reduce((a,r)=>a+tod(r.in)-lateAfter,0); out.push({t:'Late starts',v:`${late.length}`,s:`${dur(mins*60000)} late in total`}); }
  if(w.length){ const r=w.reduce((a,r)=>tod(r.in)>tod(a.in)?r:a,w[0]); if(tod(r.in)>lateAfter) out.push({t:'Latest arrival',v:fmt(r.in),s:dayName(r.in)}); }
  const early=w.filter(r=>r.out-r.in<shift-15*60000);
  if(early.length){ const r=x.shortest; out.push({t:'Short days',v:`${early.length}`,s:`shortest ${dur(r.out-r.in)} on ${dayName(r.in)}`}); }
  const open=L.filter(r=>typeOf(r)==='work'&&!r.out).length; if(open) out.push({t:'Forgot to clock out',v:`${open}`,s:`day${open===1?'':'s'} with no clock-out`});
  const mc=L.filter(r=>typeOf(r)==='mc').length; if(mc) out.push({t:'MC days',v:`${mc}`,s:'hope you’re feeling better'});
  const unpaid=L.filter(r=>isUnpaid(r)).length; if(unpaid) out.push({t:'Unpaid days',v:`${unpaid}`,s:'taken off your pay'});
  const lp=w.reduce((a,r)=>a+(r.late||0),0); if(lp>0) out.push({t:'Pay lost to lateness',v:money(lp),s:'from late clock-ins'});
  const pp={start:periodOf(p.start,-1).start,end:p.start}, prev=statsOf(state.history.filter(r=>r.in>=pp.start&&r.in<pp.end));
  if(x&&prev){ const a=x.hours/x.w.length, b=prev.hours/prev.w.length;
    if(a<b-15*60000) out.push({t:'Shorter days',v:`−${dur(b-a)}`,s:'a day, compared with last month'});
    if(prev.otMs>0&&x.otMs<prev.otMs) out.push({t:'Less overtime',v:`−${dur(prev.otMs-x.otMs)}`,s:'than last month'});
    const ra=x.onTime/x.w.length, rb=prev.onTime/prev.w.length; if(ra<rb-.05) out.push({t:'On-time rate',v:`${Math.round(ra*100)}%`,s:`down from ${Math.round(rb*100)}% last month`}); }
  return out;
}
function renderWeak(){ const box=$('sWeak'); if(!box) return; const p=periodOf(Date.now(),sOff), L=weakStats(p);
  box.innerHTML=L.length?L.map(o=>`<div class="wkRow"><span class="dn">↓</span><div><b>${esc(o.t)}</b><small>${esc(o.s)}</small></div><em>${esc(o.v)}</em></div>`).join('')
    :'<p class="note" style="margin:0">Nothing to improve this pay period. Keep it up.</p>';
  if(ANIM) G.from('#sWeak .wkRow',{x:-20,opacity:0,stagger:.05,duration:.4,ease:'power3.out',clearProps:'all'}); }
{ const _rs=renderStats; renderStats=function(a){ _rs.apply(this,arguments); try{ renderWeak(); }catch(e){} }; }

/* ---- music: small generated tracks, no audio files ----
   A tiny sequencer with a few instruments made from oscillators and noise. Each track decides
   what plays on each 16th note. Everything goes through the app's sound-effects volume. */
const Synth=(function(){
  const N=m=>440*Math.pow(2,(m-69)/12);
  function make(){
    const A=Sound.raw&&Sound.raw(); if(!A||!A.on()) return null;
    const c=A.ctx, bus=c.createGain(), pump=c.createGain(), fade=c.createGain(), lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=20000; lp.Q.value=.8;
    fade.gain.value=0; bus.connect(pump); pump.connect(fade); fade.connect(lp); lp.connect(A.out);
    const dly=c.createGain(), d=c.createDelay(1), fb=c.createGain(), dl=c.createBiquadFilter(); fb.gain.value=.3; dl.type='lowpass'; dl.frequency.value=2800;
    dly.connect(bus); dly.connect(d); d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(bus);
    const S={c,A,bus,lp,dly,d,N,fade,pump};
    // the "pumping" dance-music feel: everything ducks for a moment on each kick
    S.duckOn=(t,depth=.55,rel=.22)=>{ pump.gain.cancelScheduledValues(t); pump.gain.setValueAtTime(1-depth,t); pump.gain.linearRampToValueAtTime(1,t+rel); };
    const env=(g,t,a,dd,pk)=>{ g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(pk,t+a); g.gain.exponentialRampToValueAtTime(.0001,t+a+dd); };
    S.osc=(type,f,t,dd,pk,dest=bus,a=.005,bend)=>{ const o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); if(bend) o.frequency.exponentialRampToValueAtTime(f*bend,t+dd*.6); env(g,t,a,dd,pk); o.connect(g); g.connect(dest); o.start(t); o.stop(t+a+dd+.05); };
    S.noise=(t,type,f,q,dd,pk,dest=bus,f2)=>{ const s=c.createBufferSource(), fl=c.createBiquadFilter(), g=c.createGain(); s.buffer=A.noise; fl.type=type; fl.frequency.setValueAtTime(f,t); if(f2) fl.frequency.exponentialRampToValueAtTime(f2,t+dd); fl.Q.value=q; env(g,t,.002,dd,pk); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t,Math.random()*.5); s.stop(t+dd+.1); };
    S.kick=(t,pk=.45,f0=140)=>{ const o=c.createOscillator(), g=c.createGain(); o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(42,t+.18); env(g,t,.003,.3,pk); o.connect(g); g.connect(fade); o.start(t); o.stop(t+.36); };
    S.clap=(t,pk=.12)=>{ [0,.012,.024].forEach(k=>S.noise(t+k,'bandpass',1600,.9,.14,pk*(k?0.6:1))); };
    S.hat=(t,open,pk=.05)=>S.noise(t,'highpass',7800,.7,open?.14:.035,pk);
    S.rim=(t)=>{ S.osc('triangle',1700,t,.03,.07); S.noise(t,'bandpass',2600,4,.03,.06); };
    S.pad=(t,ch,dur,cut=900,pk=.013,type='sawtooth')=>ch.forEach(m=>[-7,7].forEach(dt=>{ const o=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter(); o.type=type; o.frequency.value=N(m); o.detune.value=dt; f.type='lowpass'; f.frequency.value=cut;
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(pk,t+.45); g.gain.setValueAtTime(pk,t+Math.max(.5,dur-.35)); g.gain.linearRampToValueAtTime(0,t+dur); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t+dur+.05); }));
    S.stab=(t,ch,dd=.18,pk=.05,cut=2200)=>ch.forEach(m=>{ const o=c.createOscillator(), o2=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter(); o.type='square'; o2.type='sawtooth'; o.frequency.value=N(m); o2.frequency.value=N(m)*1.003; f.type='lowpass'; f.frequency.setValueAtTime(cut,t); f.frequency.exponentialRampToValueAtTime(400,t+dd); env(g,t,.004,dd,pk/ch.length*2.2); o.connect(f); o2.connect(f); f.connect(g); g.connect(S.dly); o.start(t); o2.start(t); o.stop(t+dd+.1); o2.stop(t+dd+.1); });
    S.keys=(t,ch,dd=1,pk=.05)=>ch.forEach((m,i)=>{ S.osc('sine',N(m),t+i*.012,dd,pk/ch.length*2); S.osc('sine',N(m)*2,t+i*.012,dd*.4,pk/ch.length*.5); });
    S.bell=(t,m,pk=.05)=>{ S.osc('sine',N(m),t,1.4,pk,S.dly,.002); S.osc('sine',N(m)*2.76,t,.5,pk*.35,S.dly,.002); S.osc('sine',N(m)*5.4,t,.2,pk*.15,S.dly,.002); };
    S.pluck=(t,m,pk=.045)=>S.osc('triangle',N(m),t,.24,pk,S.dly,.004);
    S.bass=(t,m,dd,pk=.2,glide)=>{ const o=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter(); o.type='sine'; o.frequency.setValueAtTime(N(m)*(glide?.94:1),t); if(glide) o.frequency.exponentialRampToValueAtTime(N(m),t+.06); f.type='lowpass'; f.frequency.value=600; env(g,t,.01,dd,pk); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t+dd+.05); };
    // a bright two-oscillator lead, and a breathy flute
    S.lead=(t,m,dd,pk=.04,type='sawtooth',cut=3200)=>{ const f=c.createBiquadFilter(), g=c.createGain(); f.type='lowpass'; f.frequency.setValueAtTime(cut,t); f.frequency.exponentialRampToValueAtTime(cut*.35,t+dd);
      [-8,8].forEach(dt=>{ const o=c.createOscillator(); o.type=type; o.frequency.value=N(m); o.detune.value=dt; o.connect(f); o.start(t); o.stop(t+dd+.1); }); env(g,t,.006,dd,pk); f.connect(g); g.connect(S.dly); };
    S.flute=(t,m,dd,pk=.05)=>{ const o=c.createOscillator(), o2=c.createOscillator(), g=c.createGain(), v=c.createOscillator(), vg=c.createGain(); o.type='sine'; o2.type='triangle'; o.frequency.value=N(m); o2.frequency.value=N(m)*2;
      v.frequency.value=5.2; vg.gain.value=N(m)*.008; v.connect(vg); vg.connect(o.frequency); const g2=c.createGain(); g2.gain.value=.25; o2.connect(g2); g2.connect(g); o.connect(g);
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(pk,t+.04); g.gain.setValueAtTime(pk,t+dd*.7); g.gain.exponentialRampToValueAtTime(.0001,t+dd+.15); g.connect(S.dly);
      S.noise(t,'bandpass',N(m)*2,6,.06,pk*.25,S.dly); [o,o2,v].forEach(x=>{ x.start(t); x.stop(t+dd+.2); }); };
    S.guitar=(t,m,dd=.14,pk=.05)=>{ const o=c.createOscillator(), f=c.createBiquadFilter(), g=c.createGain(); o.type='sawtooth'; o.frequency.value=N(m); f.type='lowpass'; f.Q.value=4; f.frequency.setValueAtTime(3500,t); f.frequency.exponentialRampToValueAtTime(500,t+dd); env(g,t,.002,dd,pk); o.connect(f); f.connect(g); g.connect(S.dly); o.start(t); o.stop(t+dd+.1); };
    // a sung "ooh / ah": a buzzy tone shaped by the resonances of a voice
    const VOW={a:[800,1150,2900],o:[450,800,2830],u:[325,700,2530],e:[400,1700,2600]};
    S.chop=(t,m,v='a',dd=.22,pk=.09,bend=1)=>{ const o=c.createOscillator(), g=c.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(N(m)*(bend>1?.97:1),t); o.frequency.exponentialRampToValueAtTime(N(m)*bend,t+dd*.5);
      const vib=c.createOscillator(), vg=c.createGain(); vib.frequency.value=5.5; vg.gain.value=N(m)*.012; vib.connect(vg); vg.connect(o.frequency);
      env(g,t,.012,dd,pk); o.connect(g); VOW[v].forEach((f,k)=>{ const b=c.createBiquadFilter(), bg=c.createGain(); b.type='bandpass'; b.frequency.value=f; b.Q.value=9-k*2; bg.gain.value=[1,.55,.25][k]; g.connect(b); b.connect(bg); bg.connect(S.dly); });
      o.start(t); vib.start(t); o.stop(t+dd+.1); vib.stop(t+dd+.1); };
    return S;
  }
  return {make,N};
})();
// a track is a tempo, a chord loop and what to play on each 16th note (level = how busy)
const TRACKS={
  pop:{bpm:100,sw:0,ch:[[62,66,69],[59,62,66],[55,59,62],[57,61,64]],play(S,b,bar,ch,t,lv,sp){
    if(b===0) S.pad(t,ch,sp*16);
    if(b===0||b===8||(lv>=1&&(b===6||b===11))) S.bass(t,ch[0]-24,sp*(b===0?3.5:2));
    if(b%2===0){ const k=[0,1,2,3,2,1,2,1][(b/2)%8]; S.pluck(t,ch[k%3]+12+(k>=3?12:0)); }
    if(lv>=1&&(b===0||b===8||(b===10&&bar%2))) S.kick(t);
    if(lv>=2&&(b===4||b===12)) S.clap(t);
    if(lv>=2&&b%4===2) S.hat(t,b===14);
    if(lv>=3&&b%2===1) S.hat(t,false,.03); }},
  lofi:{bpm:78,sw:.28,ch:[[52,55,59,62,66],[57,60,64,67,71],[50,54,57,61,64],[55,59,62,66,69]],play(S,b,bar,ch,t,lv,sp){
    if(b===0) S.keys(t,ch,sp*9,.06); if(b===6) S.keys(t,ch.slice(1),sp*5,.035);
    if(b===0||b===10) S.bass(t,ch[0]-12,sp*5,.18);
    if(b===0||b===7||(b===10&&lv>=1)) S.kick(t,.32,110);
    if(b===4||b===12) S.noise(t,'bandpass',1200,.6,.18,lv>=1?.1:.05);
    if(b%2===0) S.hat(t,false,lv>=2?.04:.02);
    if(b%4===0) S.noise(t,'highpass',3000,.3,.3,.006);   // a little vinyl hiss
    if(lv>=2&&b%8===3) S.bell(t,ch[2]+12,.025); }},
  house:{bpm:122,sw:0,ch:[[57,60,64,67],[53,57,60,64],[55,59,62,66],[52,55,59,62]],play(S,b,bar,ch,t,lv,sp){
    if(b===0) S.pad(t,ch,sp*16,1200,.009);
    if(b%4===0&&lv>=1) S.kick(t,.42,130); if(lv<1&&b===0) S.kick(t,.3);
    if(b%4===2) S.hat(t,true,lv>=2?.06:.035);
    if(lv>=2&&(b===4||b===12)) S.clap(t,.1);
    if([3,6,10,14].includes(b)) S.stab(t,ch,.16,.05);
    if(lv>=1&&b%4===2) S.bass(t,ch[0]-24,sp*1.6,.18);
    if(lv>=3&&b%2===1) S.hat(t,false,.025); }},
  anthem:{bpm:128,sw:0,ch:[[55,59,62],[50,54,57],[52,55,59],[48,52,55]],play(S,b,bar,ch,t,lv,sp){
    if(b%4===0){ S.kick(t,.5,135); S.duckOn(t,.6,sp*3); }
    if(b===0) S.pad(t,ch.map(m=>m+12),sp*16,1800,.007);
    if(b%4===2) S.stab(t,ch.map(m=>m+12),.12,.07,3200); else if(lv>=1&&b%4===3) S.stab(t,ch.map(m=>m+12),.07,.03,2400);
    if(b%4===2) S.bass(t,ch[0]-12,sp*1.6,.2); if(lv>=1&&b%4===3) S.bass(t,ch[0],sp*.8,.1);
    if(lv>=1&&(b===4||b===12)) S.clap(t,.13);
    if(b%4===2) S.hat(t,true,.05); if(lv>=2&&b%2===1) S.hat(t,false,.025);
    const hook=[[0,67],[3,67],[6,69],[8,71],[11,69],[14,67],[16,74],[19,71],[22,69],[24,67],[27,69],[30,71]];
    if(lv>=2){ const pos=(bar%2)*16+b, h=hook.find(x=>x[0]===pos); if(h) S.lead(t,h[1]+12,sp*2.6,.035,'square',4200); }
    if(lv>=1&&bar%2===1&&b===0) S.chop(t,ch[2]+12,'e',sp*2.5,.09,1.04); }},
  indie:{bpm:118,sw:.06,ch:[[62,66,69],[57,61,64],[59,62,66],[55,59,62]],play(S,b,bar,ch,t,lv,sp){
    if(b===0) S.pad(t,ch,sp*16,2200,.008);
    S.osc('square',Synth.N(ch[b%3]+24+(b%8===7?12:0)),t,.07,lv>=1?.012:.008,S.dly,.002);
    if(b%2===0) S.guitar(t,ch[(b/2)%2]+12,.12,lv>=1?.05:.03);
    if(b===0||b===8||(b%8===6&&lv>=1)) S.bass(t,ch[0]-12+(b===6?12:0),sp*1.8,.18);
    if(lv>=1&&(b===0||b===6||b===8||(lv>=2&&b===11))) S.kick(t,.42,120);
    if(lv>=1&&(b===4||b===12)){ S.noise(t,'bandpass',1900,.7,.18,.13); S.osc('triangle',200,t,.09,.07); }
    if(b%2===0) S.hat(t,false,lv>=2?.035:.02);
    if(lv>=2){ const m={0:[ch[2]+12,'u'],6:[ch[1]+12,'o'],10:[ch[2]+12,'u'],12:[ch[0]+24,'a']}[b]; if(m) S.chop(t,m[0],m[1],sp*(b===12?3.5:2),.075,b===12?1.03:1); } }},
  italo:{bpm:136,sw:0,ch:[[57,60,64],[53,57,60],[55,60,64],[55,59,62]],play(S,b,bar,ch,t,lv,sp){
    if(b%4===0){ S.kick(t,.48,130); S.duckOn(t,.4,sp*2.5); }
    if(b===0) S.pad(t,ch,sp*16,1400,.008);
    if(b%4===2){ S.bass(t,ch[0]-12,sp*1.4,.22); S.hat(t,true,.045); }
    if(lv>=1&&(b===4||b===12)) S.clap(t,.1);
    const hook=[[76,76,79,76,74,72,74,76],[72,72,74,72,71,69,71,72],[76,76,79,76,74,72,74,79],[79,77,76,74,72,71,72,74]];
    if(lv>=1&&b%2===0&&(lv>=2||bar<2)) S.flute(t,hook[bar%4][b/2],sp*1.7,.05);
    if(lv>=3&&b%2===1) S.hat(t,false,.02); }},
  dream:{bpm:88,sw:.12,ch:[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,69]],play(S,b,bar,ch,t,lv,sp){
    if(b===0) S.pad(t,ch,sp*16,700,.012,'triangle');
    if(b%3===0) S.bell(t,ch[(b/3)%ch.length]+12,.035);
    if(b===0||b===9) S.bass(t,ch[0]-24,sp*6,.15);
    if(lv>=1&&(b===0||b===10)) S.kick(t,.28,100);
    if(lv>=2&&b%4===2) S.noise(t,'highpass',6000,.5,.08,.03);
    if(lv>=2&&b===12) S.noise(t,'bandpass',1800,.7,.2,.06); }}
};
function Player(track){
  let S=null, timer=null, step=0, next=0, lv=0, on=false;
  const sp=60/track.bpm/4;
  function loop(){ if(!on) return; while(next<S.c.currentTime+.2){ const b=step%16, bar=Math.floor(step/16)%track.ch.length, t=next+(b%2?track.sw*sp:0);
    track.play(S,b,bar,track.ch[bar],t,lv,sp); step++; next+=sp; } }
  return {
    start(fade=1.2){ S=Synth.make(); if(!S) return false; on=true; step=0; next=S.c.currentTime+.08; const t=S.c.currentTime; S.fade.gain.setValueAtTime(0,t); S.fade.gain.linearRampToValueAtTime(.9,t+fade); timer=setInterval(loop,25); loop(); return true; },
    level(v){ lv=v; },
    chord(){ return track.ch[Math.floor(step/16)%track.ch.length]; },
    S:()=>S,
    stop(fade=.6){ if(!on) return; on=false; clearInterval(timer); const t=S.c.currentTime, b=S.fade; b.gain.cancelScheduledValues(t); b.gain.setTargetAtTime(0,t,fade/3); setTimeout(()=>{ try{ b.disconnect(); }catch(e){} },fade*1000+800); },
    playing:()=>on
  };
}
const TNAME={pop:'Pop',lofi:'Lo-fi',house:'House',dream:'Dreamy',anthem:'Electro anthem',indie:'Indie electronic',italo:'Italo dance'};
// the month-in-review music: a different track each time, never the same one twice in a row
const Music=(function(){
  let P=null, cur=null;
  return {
    start(){ const keys=Object.keys(TRACKS).filter(k=>k!==state.lastTrack); cur=keys[Math.floor(Math.random()*keys.length)]; state.lastTrack=cur;
      P=Player(TRACKS[cur]); if(!P.start()){ P=null; $('wrTrk').hidden=true; return; } Sound.duck&&Sound.duck(true); $('wrTrk').textContent='♪ '+TNAME[cur]; $('wrTrk').hidden=false; },
    scene(i,lv){ if(!P) return; P.level(lv); },
    // moving between cards: a liquid whoosh, up going forward, down going back
    whoosh(dir){ const S=P&&P.S(); if(!S) return; const t=S.c.currentTime; S.noise(t,'bandpass',dir>0?500:2600,1.4,.45,.07,S.bus,dir>0?2600:500); S.osc('sine',dir>0?260:520,t,.3,.05,S.bus,.01,dir>0?2:.5); },
    // each line of text lands with a soft note from the current chord
    plink(k){ const S=P&&P.S(); if(!S) return; const ch=P.chord(), m=ch[k%ch.length]+24; S.osc('sine',Synth.N(m),S.c.currentTime,.35,.035,S.dly,.003); },
    count(p){ const S=P&&P.S(); if(!S) return; const sc=[0,2,4,7,9,12,14,16,19,21,24], m=62+sc[Math.min(sc.length-1,Math.floor(p*sc.length))]; S.osc('sine',Synth.N(m+12),S.c.currentTime,.09,.045,S.bus,.002); },
    stop(){ if(!P) return; P.stop(); P=null; Sound.duck&&Sound.duck(false); },
    track:()=>cur
  };
})();
// setup: synthwave — driving octave bass, gated snare, arpeggio through the echo
const SYNTHWAVE={bpm:96,sw:0,ch:[[57,60,64],[53,57,60],[60,64,67],[55,59,62]],play(S,b,bar,ch,t,lv,sp){
  if(b===0) S.pad(t,ch.concat([ch[0]+12]),sp*16,1500,.012);
  if(b%2===0) S.bass(t,ch[0]-24+(b%4===2?12:0),sp*1.8,.2);
  if(lv>=1&&b%4===0) S.kick(t,.45,120);
  if(lv>=1&&(b===4||b===12)){ S.noise(t,'bandpass',1800,.6,.32,.16); S.noise(t,'lowpass',5000,.4,.5,.05,S.dly); S.osc('triangle',190,t,.12,.08); }
  if(lv>=2&&b%2===1) S.hat(t,false,.03);
  if(lv>=1&&b%2===0){ const k=[0,1,2,1,0,1,2,3][(b/2|0)%8]; S.osc('sawtooth',Synth.N(ch[k%3]+24+(k===3?12:0)),t,.16,.022,S.dly,.004); }
  if(lv>=2&&b===0&&bar%2===0) S.osc('square',Synth.N(ch[2]+24),t,sp*7,.02,S.dly,.08); }};
// payday: an original 2-step garage track. Muffled while the gold builds up, the beat drops on the explosion.
const GARAGE={bpm:132,sw:.22,ch:[[61,65,68,72],[60,63,67,70],[53,56,60,63,67],[51,55,58,62]],play(S,b,bar,ch,t,lv,sp){
  if(b===0) S.pad(t,ch,sp*16,lv>=1?1600:700,.011);
  // skippy 2-step kick, snare on 2 and 4
  if(b===0||(b===10)||(lv>=1&&bar%2===1&&b===7)) S.kick(t,.46,125);
  if(lv>=1&&(b===4||b===12)) { S.clap(t,.11); S.rim(t+sp*.5); }
  if(lv>=1&&(b===7||b===15)&&bar%2===0) S.rim(t);
  // shuffled hats and a shaker
  if(b%4===2) S.hat(t,b===14&&bar%2===1,.055); if(lv>=1&&b%2===1) S.hat(t,false,.022);
  // organ stabs on the offbeats
  if(lv>=1&&[3,6,11].includes(b)) S.stab(t,ch.slice(0,3).map(m=>m+12),.15,.045,2600);
  // rolling sub bass
  if([0,3,10,13].includes(b)) S.bass(t,ch[0]-24,sp*(b===0?2.5:1.6),.24,b!==0);
  // chopped vocal hook over two bars
  if(lv>=1){ const hook=[[0,'a',0,1],[3,'o',2,1],[6,'a',1,1.03],[10,'u',0,1],[14,'e',2,1.05]]; const h=hook.find(x=>x[0]===b); if(h&&(bar%2===0||b<8)) S.chop(t,ch[h[2]%ch.length]+12,h[1],sp*(b===14?2.5:1.6),.08,h[3]); } }};
const PayMusic=(function(){
  let P=null, riseT=null;
  return {
    start(){ if(P) return; P=Player(GARAGE); if(!P.start(1.6)){ P=null; return; } Sound.duck&&Sound.duck(true); P.level(0);
      const S=P.S(), t=S.c.currentTime; S.lp.frequency.setValueAtTime(380,t); S.lp.frequency.exponentialRampToValueAtTime(900,t+2);
      S.noise(t,'bandpass',300,1.2,2.1,.05,S.bus,4000); },
    drop(){ if(!P) return; const S=P.S(), t=S.c.currentTime; P.level(1); S.lp.frequency.cancelScheduledValues(t); S.lp.frequency.setValueAtTime(900,t); S.lp.frequency.exponentialRampToValueAtTime(20000,t+.25);
      S.noise(t,'highpass',5000,.5,1.6,.08); S.kick(t,.55,160); },
    out(){ if(!P) return; const S=P.S(), t=S.c.currentTime; S.lp.frequency.cancelScheduledValues(t); S.lp.frequency.setValueAtTime(S.lp.frequency.value,t); S.lp.frequency.exponentialRampToValueAtTime(300,t+1.8); const p=P; P=null; setTimeout(()=>{ p.stop(.8); Sound.duck&&Sound.duck(false); },1400); },
    playing:()=>!!P
  };
})();


/* setup music, and a little player in Settings so you can hear every track */
const SetupMusic=(function(){ let P=null, muted=false, tries=0;
  function start(){ if(P||muted||!inSetup()) return; P=Player(SYNTHWAVE); if(!P.start(2.5)){ P=null; if(tries++<4) setTimeout(start,400); return; }
    P.level(1); setTimeout(()=>P&&P.level(2),16000); Sound.duck&&Sound.duck(true); $('stepMute').classList.remove('off'); }
  addEventListener('pointerdown',()=>{ if(inSetup()&&!P&&!muted){ tries=0; setTimeout(start,120); } },{capture:true,passive:true});
  $('stepMute').onclick=e=>{ e.stopPropagation(); muted=!muted; $('stepMute').classList.toggle('off',muted); if(muted){ if(P){ P.stop(.8); P=null; Sound.duck&&Sound.duck(false); } } else start(); };
  return { stop(){ if(P){ P.stop(1.5); P=null; Sound.duck&&Sound.duck(false); } } };
})();
const MLIST=[['payday','Payday','UK garage · plays on payday',GARAGE],['setup','Setup','Synthwave · first-time setup',SYNTHWAVE]].concat(Object.keys(TRACKS).map(k=>[k,TNAME[k],'Month review',TRACKS[k]]));
let mPrev=null, mPrevK=null;
function stopPreview(){ if(mPrev){ mPrev.stop(.4); mPrev=null; Sound.duck&&Sound.duck(false); } mPrevK=null; document.querySelectorAll('#musList .mRow').forEach(r=>r.classList.remove('on')); }
function renderMusList(){
  $('musList').innerHTML=MLIST.map(([k,n,d])=>`<button type="button" class="mRow" data-k="${k}"><span class="mPlay"><svg viewBox="0 0 24 24" fill="currentColor"><path class="pl" d="M8 5.5v13l11-6.5z"/><path class="st" d="M7 6h4v12H7zM13 6h4v12h-4z"/></svg></span><b>${n}</b><small>${d}</small></button>`).join('');
  $('musList').querySelectorAll('.mRow').forEach(b=>b.onclick=()=>{ const k=b.dataset.k, was=mPrevK===k; stopPreview(); if(was) return;
    const t=MLIST.find(x=>x[0]===k)[3]; mPrev=Player(t); if(!mPrev.start(.6)){ mPrev=null; toast(S().sfx?'Tap once more to allow sound':'Turn on Sound effects to hear music',false); return; }
    mPrev.level(k==='payday'?1:2); mPrevK=k; Sound.duck&&Sound.duck(true); b.classList.add('on'); });
}
renderMusList();

/* ---- the liquid scene ---- */
const WrapGL=(function(){
  const cv=$('wrCv'); let gl=null, U={}, raf=null, W=0, H=0, dpr=1, t0=0;
  const NB=12, B=[...Array(NB)].map((_,i)=>({x:.5,y:.5,r:0,c:[1,.6,.3],ph:Math.random()*6,sp:.3+Math.random()*.5})), bg={a:[.16,.06,.23],b:[.08,.05,.2]};
  const hx=h=>{ const n=parseInt(h.slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; };
  function init(){ if(gl) return true; try{ gl=cv.getContext('webgl',{premultipliedAlpha:false,alpha:false,antialias:false}); }catch(e){} if(!gl) return false;
    const fs=`precision highp float; uniform vec3 uB[${NB}]; uniform vec3 uC[${NB}]; uniform vec3 uG1,uG2; uniform float uD,uT; uniform vec2 uR;
      void main(){ vec2 p=gl_FragCoord.xy/uD; float v=gl_FragCoord.y/uR.y; vec3 bg=mix(uG2,uG1,v); bg+=.035*sin(p.x*.018+uT*.6)*sin(p.y*.015-uT*.45);
        float f=0.; vec2 g=vec2(0.); vec3 cs=vec3(0.); float ws=0.; float R=30.;
        for(int i=0;i<${NB};i++){ if(uB[i].z<=.5) continue; vec2 q=p-uB[i].xy; float r2=dot(q,q)+1.; float s=uB[i].z*uB[i].z; float w=s/r2; f+=w; g+=-2.*s*q/(r2*r2); cs+=uC[i]*w*w; ws+=w*w; R=max(R,min(uB[i].z,70.)); }
        float edge=max(length(g)/uD,1e-4), a=smoothstep(1.-edge,1.+edge,f);
        float sh=smoothstep(.35,1.,f)*.25*(1.-a); bg*=1.-sh;
        if(a<=0.){ gl_FragColor=vec4(bg,1.); return; }
        vec3 base=cs/max(ws,1e-5); float h=sqrt(clamp(1.-1./f,0.,1.)); vec2 dh=(1./(f*f))*g/(2.*max(h,.05)); vec3 n=normalize(vec3(-dh*R,1.));
        vec3 L=normalize(vec3(-.45,.6,.75)); float dif=.55+.45*max(dot(n,L),0.), sp=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),55.);
        float sp2=pow(max(dot(reflect(-normalize(vec3(.6,-.5,.6)),n),vec3(0.,0.,1.)),0.),18.)*.3;
        vec3 col=base*dif+vec3(sp)+vec3(.75,.85,1.)*sp2; col=mix(col,col*.62,pow(1.-n.z,2.)*.55);
        gl_FragColor=vec4(mix(bg,col,a),1.); }`;
    const mk=(t,src)=>{ const x=gl.createShader(t); gl.shaderSource(x,src); gl.compileShader(x); return x; };
    const pr=gl.createProgram(); gl.attachShader(pr,mk(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}')); gl.attachShader(pr,mk(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){ gl=null; return false; }
    gl.useProgram(pr); const bf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,bf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const la=gl.getAttribLocation(pr,'a'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la,2,gl.FLOAT,false,0,0);
    ['uB','uC','uG1','uG2','uD','uT','uR'].forEach(k=>U[k]=gl.getUniformLocation(pr,k)); return true; }
  const arrB=new Float32Array(NB*3), arrC=new Float32Array(NB*3);
  function frame(now){ const t=(now-t0)/1000, m=Math.min(W,H);
    B.forEach((b,i)=>{ const wob=RM?0:1, x=b.x*W+Math.sin(t*b.sp+b.ph)*m*.035*wob, y=b.y*H+Math.cos(t*b.sp*.8+b.ph*1.3)*m*.03*wob;
      arrB.set([x,H-y,b.r*m*(1+.05*Math.sin(t*1.7+b.ph)*wob)],i*3); arrC.set(b.c,i*3); });
    gl.uniform3fv(U.uB,arrB); gl.uniform3fv(U.uC,arrC); gl.uniform3fv(U.uG1,bg.a); gl.uniform3fv(U.uG2,bg.b); gl.uniform1f(U.uT,t);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4); raf=requestAnimationFrame(frame); }
  // shapes the blobs make: x, y (0-1 of the screen) and size (of the shorter side)
  const F={
    edges:i=>{ const a=i/NB*6.283+.3; return [.5+.6*Math.cos(a),.5+.56*Math.sin(a),.12+(i%4)*.035]; },
    low:i=>i===0?[.5,.9,.42]:[.5+Math.cos(i)*.12,.88+Math.sin(i*1.7)*.05,.1+(i%3)*.03],
    top:i=>i===0?[.5,.08,.36]:[.5+Math.cos(i)*.14,.1+Math.sin(i*1.3)*.05,.09+(i%3)*.03],
    split:(i,k)=>{ const L=i%2===0, s=L?k:1-k; return i<2?[L?.2:.8,.88,.1+.3*s]:[(L?.2:.8)+Math.cos(i)*.08,.88+Math.sin(i)*.05,.05+.1*s]; },
    rise:i=>[(i+.5)/NB,1.02-(i%3)*.03,.08+(i%2)*.03],
    rain:i=>[(i*.37+.1)%1,-.02+(i%4)*.04,.07+(i%3)*.025],
    corners:i=>{ const c=[[0,0],[1,0],[0,1],[1,1]][i%4]; return [c[0]+(c[0]?-1:1)*(i%3)*.06,c[1]+(c[1]?-1:1)*(Math.floor(i/4))*.06,.12+(i%3)*.04]; },
    ring:i=>{ const a=i/NB*6.283; return [.5+.44*Math.cos(a),.48+.36*Math.sin(a),.07]; },
    burst:i=>{ const a=i/NB*6.283; return [.5+.75*Math.cos(a),.5+.7*Math.sin(a),.2]; }};
  return {
    open(){ if(!init()) { cv.hidden=true; return false; } cv.hidden=false; dpr=Math.min(devicePixelRatio||1,2); W=innerWidth; H=innerHeight; cv.width=W*dpr; cv.height=H*dpr;
      gl.viewport(0,0,W*dpr,H*dpr); gl.uniform1f(U.uD,dpr); gl.uniform2f(U.uR,W*dpr,H*dpr); t0=performance.now();
      B.forEach(b=>{ b.x=.5; b.y=.5; b.r=0; }); if(!raf) raf=requestAnimationFrame(frame); return true; },
    close(){ cancelAnimationFrame(raf); raf=null; },
    shape(name,pal,bgc,k=.5,dur=1.3){ const f=F[name]||F.edges, cols=pal.map(hx), a=hx(bgc[0]), b=hx(bgc[1]);
      B.forEach((bl,i)=>{ const [x,y,r]=f(i,k); G.to(bl,{x,y,r,duration:dur*(.8+Math.random()*.4),delay:i*.025,ease:'elastic.out(1,.75)',overwrite:'auto'}); G.to(bl.c,{0:cols[i%cols.length][0],1:cols[i%cols.length][1],2:cols[i%cols.length][2],duration:dur*.8,overwrite:'auto'}); });
      G.to(bg.a,{0:a[0],1:a[1],2:a[2],duration:1,overwrite:'auto'}); G.to(bg.b,{0:b[0],1:b[1],2:b[2],duration:1,overwrite:'auto'}); },
    pulse(){ B.forEach((bl,i)=>G.fromTo(bl,{r:bl.r*1.25},{r:bl.r,duration:.9,delay:i*.02,ease:'elastic.out(1,.4)'})); }
  };
})();

/* ---- the cards ---- */
const WP={warm:['#FFB020','#FF4D6D','#7B5CFF'],sky:['#3FB8FF','#7B5CFF','#9BE3FF'],mint:['#19D9A0','#3FB8FF','#A8FFE0'],gold:['#FFC53D','#FF9F1C','#FFE08A'],pink:['#FF6FB1','#FF4D6D','#FFB3E0'],violet:['#7B5CFF','#C9B8FF','#3FB8FF']};
const WB=[['#2A1142','#12092E'],['#0F2150','#0B0F2E'],['#0B3B34','#07181F'],['#3B2108','#1A0B18'],['#3A0F2E','#170922'],['#1E1450','#0C0A26']];
function wrapCards(d){
  const x=d.x, C=[], hrs=x.hours/3.6e6, mx=Math.max(...d.days.map(z=>z.h),1);
  const card=(o)=>C.push(o);
  card({s:'edges',p:WP.warm,b:WB[0],lv:0,h:`<p class="k">Your month in review</p><p class="t hero">${d.monthName}</p><p class="s">${rangeTxt(d.p)} · tap to go on</p>`});
  card({s:'rise',p:WP.warm,b:WB[0],lv:1,h:`<p class="k">At work</p><p class="big" data-n="${hrs.toFixed(1)}" data-f="h">0</p><p class="s">hours over <b>${x.w.length}</b> day${x.w.length===1?'':'s'}, about ${dur(x.hours/x.w.length)} a day.</p>`});
  if(d.days.length>=2) card({s:'top',p:WP.sky,b:WB[1],lv:1,h:`<p class="k">Day by day</p><canvas class="wrBars2" data-bars="1"></canvas><div class="wrDays">${d.days.map(z=>`<span>${z.d}</span>`).join('')}</div><p class="s">Your longest was <b>${dur(x.longest.out-x.longest.in)}</b> on ${dayName(x.longest.in)}.</p>`,bars:d.days.map(z=>({v:z.h/mx,ot:z.ot}))});
  if(x.w.length>=3){ const top=d.avgWd.slice(0,5), m2=Math.max(...top,1);
    card({s:'corners',p:WP.violet,b:WB[5],lv:1,h:`<p class="k">Your busiest day</p><p class="t">${WDN[d.busiest]}</p><div class="wrWk">${top.map((v,i)=>`<div class="${i===d.busiest?'on':''}"><i style="height:${Math.max(6,v/m2*100)}%"></i><span>${'MTWTF'[i]}</span></div>`).join('')}</div><p class="s">about ${dur(d.avgWd[d.busiest]*3.6e6)} at work on average.</p>`}); }
  const lo=Math.min(...x.w.map(r=>tod(r.in)),7*60), hi=Math.max(...x.w.map(r=>tod(r.in)),9*60+30), A=Math.floor(lo/30)*30, Z=Math.ceil(hi/30)*30;
  card({s:'rain',p:WP.gold,b:WB[3],lv:2,h:`<p class="k">Early bird</p><p class="big">${fmt(x.early.in)}</p><div class="wrStrip">${x.w.map(r=>`<i style="left:${(tod(r.in)-A)/(Z-A)*100}%"></i>`).join('')}<span style="left:0">${hm(A)}</span><span style="left:100%">${hm(Z)}</span></div><p class="s">was your earliest, on ${dayName(x.early.in)}. You usually arrived around <b>${hm(x.avgIn)}</b>.</p>`});
  card({s:'ring',p:WP.mint,b:WB[2],lv:2,h:`<p class="k">Right on time</p><div class="row"><div class="chip2">On time<b>${x.onTime} / ${x.w.length}</b></div><div class="chip2">Longest streak<b>${d.best} day${d.best===1?'':'s'}</b></div></div><p class="s">${x.onTime===x.w.length?'Never late once. Nice.':`${x.w.length-x.onTime} late start${x.w.length-x.onTime===1?'':'s'}. Next month’s yours.`}</p>`});
  { const W2=weakStats(d.p); if(W2.length) card({s:'corners',p:WP.pink,b:WB[4],lv:1,h:`<p class="k">Room to grow</p><div class="wrWeak">${W2.slice(0,4).map(o=>`<div><span>↓</span><div><b>${esc(o.t)}</b><small>${esc(o.s)}</small></div><em>${esc(o.v)}</em></div>`).join('')}</div><p class="s">Something to aim for next month.</p>`}); }
  card(x.otMs>0?{s:'low',p:WP.pink,b:WB[4],lv:2,h:`<p class="k">Overtime</p><p class="big" data-n="${(x.otMs/3.6e6).toFixed(1)}" data-f="h">0</p><p class="s">hours of OT${x.ot?`, worth about <b>${money(x.ot)}</b>`:''}.</p>`}
    :{s:'low',p:WP.mint,b:WB[2],lv:2,h:`<p class="k">Home on time</p><p class="big">${hm(x.avgOut)}</p><p class="s">was when you usually left. No overtime this month.</p>`});
  if(d.pay!=null) card({s:'low',p:WP.gold,b:WB[3],lv:3,h:`<p class="k">${d.slip?'Your pay':'Your pay (estimate)'}</p><p class="big mny" data-n="${d.pay.toFixed(2)}" data-f="$">$0</p><p class="s">went into your bank${x.ot?`, including about ${money(x.ot)} of overtime`:''}.</p>`});
  if(d.cpf) card({s:'split',k:d.mine/Math.max(1,d.cpf),p:WP.mint,b:WB[2],lv:2,h:`<p class="k">Into your CPF</p><p class="big mny" data-n="${d.cpf.toFixed(2)}" data-f="$">$0</p><div class="row"><div class="chip2">You<b>${money(d.mine)}</b></div><div class="chip2">Employer<b>${money(d.boss)}</b></div></div><p class="s">That’s <b>${money(d.cpfAllT)}</b> in your CPF since you started.</p>`});
  if(d.prev){ const dh=(x.hours-d.prev.hours)/3.6e6, a=d.prev.hours/3.6e6, m3=Math.max(a,hrs,1);
    card({s:'corners',p:WP.sky,b:WB[1],lv:2,h:`<p class="k">Versus last month</p><p class="t">${dh>=0?'+':'−'}${dur(Math.abs(dh)*3.6e6)}</p><div class="wrCmp"><div><span>Last month</span><i style="width:${a/m3*100}%"></i><b>${dur(d.prev.hours)}</b></div><div class="on"><span>This month</span><i style="width:${hrs/m3*100}%"></i><b>${dur(x.hours)}</b></div></div><p class="s">${dh>=0?'more':'less'} time at work than the month before.</p>`}); }
  if(d.jarIn>0) card({s:'rain',p:WP.sky,b:WB[1],lv:2,h:`<p class="k">Your jars</p><p class="big" data-n="${d.jarIn.toFixed(0)}" data-f="$0">$0</p><div class="wrJars">${state.jars.slice(0,4).map(j=>`<div><span>${esc(j.name)}</span><i style="--jc:${jarCol(j)}"><b style="width:${Math.min(100,j.saved/Math.max(1,j.target)*100)}%"></b></i></div>`).join('')}</div><p class="s">saved. You’re at <b>${moneyR(jarTotal())}</b> in total.</p>`});
  if(x.al+x.mc>0||d.leaveOn) card({s:'edges',p:WP.mint,b:WB[2],lv:1,h:`<p class="k">Time off</p><div class="row"><div class="chip2">Taken<b>${x.al+x.mc} day${x.al+x.mc===1?'':'s'}</b></div>${d.leaveOn?`<div class="chip2">Leave left<b>${d.alLeft} days</b></div>`:''}</div><p class="s">${x.al?`${x.al} day${x.al===1?'':'s'} of leave`:'No leave'}${x.mc?`, ${x.mc} MC`:''} this month.</p>`});
  if(d.nights>0) card({s:'ring',p:WP.violet,b:WB[5],lv:2,h:`<p class="k">Work + study</p><p class="big" data-n="${d.nights}" data-f="n">0</p><p class="s">class night${d.nights===1?'':'s'} straight after a workday. That takes something.</p>`});
  if(d.badges.length) card({s:'ring',p:WP.gold,b:WB[3],lv:3,h:`<p class="k">New badges</p><div class="wrBadges">${d.badges.slice(0,6).map(({b,lv})=>`<div>${bdOrb(b,lv,64)}<b>${esc(b.n)}</b>${b.lv.length>1?`<small>${LV[lv]}</small>`:''}</div>`).join('')}</div>`});
  const np=nextPayday(); card({s:'burst',p:WP.warm,b:WB[0],lv:3,h:`<p class="k">That’s a wrap</p><p class="t hero">See you next payday</p><p class="s">${np?new Date(np).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'}):''}</p><button class="wrBtn" type="button" id="wrDone">Done</button>`});
  return C;
}
let wr=null;
function openWrap(p){
  const d=wrapData(p); if(!d) return false;
  const cards=wrapCards(d); wr={i:-1,n:cards.length,cards,timer:null,p,raf:null};
  $('wrStage').innerHTML=''; $('wrBars').innerHTML=cards.map(()=>'<i><b></b></i>').join('');
  $('wrap').hidden=false; lockScroll(true); state.wrapped[p.start]=true; save();
  WrapGL.open(); Music.start();
  if(ANIM) G.fromTo('#wrap',{opacity:0},{opacity:1,duration:.5,ease:'power2.out',clearProps:'opacity'});
  wrGo(0); return true;
}
function wrGo(i){
  if(!wr) return; if(i<0) i=0; if(i>=wr.n){ closeWrap(); return; }
  const dir=i>=wr.i?1:-1, c=wr.cards[i], stage=$('wrStage'), bars=[...$('wrBars').querySelectorAll('b')];
  clearTimeout(wr.timer); cancelAnimationFrame(wr.raf); G&&G.killTweensOf(bars);
  bars.forEach((b,k)=>{ b.style.width=k<i?'100%':'0%'; });
  // the old words leave the way you're going; the liquid behind simply reshapes
  [...stage.children].forEach(el=>{ if(ANIM) G.to(el,{x:-40*dir,opacity:0,duration:.25,ease:'power2.in',onComplete:()=>el.remove()}); else el.remove(); });
  const el=document.createElement('div'); el.className='wrCard'; el.innerHTML=c.h; stage.appendChild(el);
  wr.i=i;
  if(G) WrapGL.shape(c.s,c.p,c.b,c.k);
  Music.scene(i,c.lv); Music.whoosh(dir);
  [...el.querySelectorAll('.k,.t,.big,.s,.row,.wrBadges,.wrWeak,.wrWk,.wrStrip,.wrCmp,.wrJars')].forEach((n,k)=>setTimeout(()=>Music.plink(k),180+k*85));
  if(ANIM){ G.fromTo(el.querySelectorAll('.k,.t,.big,.s,.row,.wrBadges,.wrBtn,.wrWk,.wrStrip,.wrCmp,.wrJars,canvas,.wrDays'),{y:34*dir>0?34:-34,opacity:0,scale:.94},{y:0,opacity:1,scale:1,duration:.7,stagger:.08,delay:.15,ease:'back.out(1.8)'}); }
  el.querySelectorAll('[data-n]').forEach(n=>{ const v=+n.dataset.n, f=n.dataset.f, put=q=>n.textContent=f==='$'?money(q):f==='$0'?moneyR(q):f==='n'?String(Math.round(q)):`${q.toFixed(1)}h`;
    if(ANIM){ const o={v:0}; let last=0; G.to(o,{v,duration:1.4,delay:.3,ease:'power3.out',onUpdate:()=>{ put(o.v); const now=performance.now(); if(now-last>70){ last=now; Music.count(o.v/v); } }}); } else put(v); });
  // bars that fill one by one, in the app's liquid
  const bc=el.querySelector('canvas[data-bars]');
  if(bc&&Liquid){ const items=c.bars.map(b=>({level:0,pal:b.ot?6:5,amp:1,bubbles:false})), t0=performance.now();
    items.forEach((it,k)=>{ if(ANIM) G.to(it,{level:c.bars[k].v*.92,duration:1.1,delay:.4+k*.06,ease:'elastic.out(1,.65)',onStart:()=>Sound.bubble&&Sound.bubble(400+c.bars[k].v*600)}); else it.level=c.bars[k].v*.92; });
    const loop=()=>{ if(!wr||!bc.isConnected) return; const w=bc.clientWidth, sw=w/items.length; Liquid.draw(bc,{mode:'v',items,slot:sw,T:Math.min(sw*.3,7),len:bc.clientHeight-8,pad:4,t:performance.now()/1000}); wr.raf=requestAnimationFrame(loop); }; loop(); }
  if(ANIM) G.from(el.querySelectorAll('.wrWeak>div'),{x:-40,opacity:0,stagger:.12,delay:.35,duration:.6,ease:'back.out(1.6)'});
  if(ANIM){ el.querySelectorAll('.wrWk i').forEach((b,k)=>G.from(b,{scaleY:0,transformOrigin:'50% 100%',duration:.9,delay:.4+k*.08,ease:'elastic.out(1,.5)'}));
    G.from(el.querySelectorAll('.wrStrip i'),{y:-60,opacity:0,duration:.8,stagger:.05,delay:.4,ease:'bounce.out'});
    G.from(el.querySelectorAll('.wrCmp i, .wrJars b'),{width:0,duration:1.1,stagger:.15,delay:.45,ease:'power3.out'});
    G.from(el.querySelectorAll('.wrBadges .bdOrb'),{scale:0,rotation:-40,duration:.9,stagger:.12,delay:.35,ease:'elastic.out(1,.45)'}); }
  const done=el.querySelector('#wrDone'); if(done) done.onclick=e=>{ e.stopPropagation(); closeWrap(); };
  haptic();
  const last=i===wr.n-1;
  if(!last){ if(ANIM) G.fromTo(bars[i],{width:'0%'},{width:'100%',duration:7,ease:'none'}); wr.timer=setTimeout(()=>wrGo(i+1),7000); } else { bars[i].style.width='100%'; if(ANIM&&!RM) setTimeout(()=>{ burst(innerWidth/2,innerHeight*.45,120,'c'); Sound.fanfare&&Sound.fanfare(); },500); }
}
function closeWrap(){ if(!wr) return; clearTimeout(wr.timer); cancelAnimationFrame(wr.raf); wr=null; Music.stop();
  const done=()=>{ $('wrap').hidden=true; WrapGL.close(); $('wrStage').innerHTML=''; lockScroll(false); checkBadges(); };
  if(ANIM) G.to('#wrap',{opacity:0,duration:.35,onComplete:()=>{ done(); G.set('#wrap',{clearProps:'all'}); }}); else done(); }
$('wrNext').onclick=()=>wr&&wrGo(wr.i+1); $('wrPrev').onclick=()=>wr&&wrGo(wr.i-1); $('wrX').onclick=closeWrap;
addEventListener('keydown',e=>{ if(!wr) return; if(e.key==='Escape') closeWrap(); if(e.key==='ArrowRight') wrGo(wr.i+1); if(e.key==='ArrowLeft') wrGo(wr.i-1); });
let wantReview=false, payQuiet=false;
// the recap rises straight out of the gold; the payday screen tidies itself up underneath
$('pdReview').onclick=()=>{ if(!payRun||payRun.closing) return; const p=forPeriod(lastPdShown); if(!wrapData(p)||p.end>Date.now()) return;
  try{ PayMusic.out(); }catch(e){} openWrap(p); setTimeout(()=>{ payQuiet=true; $('pdClose').onclick(); payQuiet=false; },750); };
function afterPayday(pd){
  const credited=creditJars(), p=forPeriod(pd||Date.now()), force=wantReview; wantReview=false;
  setTimeout(()=>{ if(wr) return; if((force||!state.wrapped[p.start])&&p.end<=Date.now()&&wrapData(p)) openWrap(p); else if(credited) toast(`${money(credited)} went into your jars`,false); },900);
}

/* ================= badges =================
   Glossy orbs with line icons, grouped, most with bronze / silver / gold levels. */
const BI={
  sunrise:'<path d="M3 18h18M6 18a6 6 0 0 1 12 0"/><path d="M12 4v4M4.9 8.9l1.4 1.4M19.1 8.9l-1.4 1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  shield:'<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  home:'<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  flame:'<path d="M12 21c-4 0-7-3-7-7 0-3 2-5 3-7 1 2 2 3 3 3 0-3 1-6 4-8 0 4 4 6 4 11 0 5-3 8-7 8z"/>',
  hourglass:'<path d="M7 3h10M7 21h10"/><path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  calcheck:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  stack:'<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  coins:'<ellipse cx="9" cy="7" rx="5" ry="2.5"/><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7"/><ellipse cx="15" cy="15" rx="5" ry="2.5"/><path d="M10 15v3c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-3"/>',
  sprout:'<path d="M12 21V11"/><path d="M12 11C12 6 8 3 4 3c0 5 3 8 8 8z"/><path d="M12 14c0-4 3-7 8-7 0 4-3 7-8 7z"/>',
  jar:'<path d="M8 3h8M9 3v3c-2 1-3 3-3 5v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8c0-2-1-4-3-5V3"/>',
  jarfull:'<path d="M8 3h8M9 3v3c-2 1-3 3-3 5v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8c0-2-1-4-3-5V3"/><path d="M6 13c2 1 4-1 6 0s4 1 6 0"/>',
  piggy:'<path d="M5 11a7 6 0 0 1 12-3h2l-1 3 2 1v3h-2l-1 3h-3v-2H9v2H6l-1-4a5 5 0 0 1 0-3z"/><circle cx="15" cy="11" r="1"/>',
  cap:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  bookopen:'<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>',
  umbrella:'<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 12v7a2 2 0 0 0 4 0"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  cloud:'<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 7.9z"/><path d="M12 11v5M9.5 13.5 12 11l2.5 2.5"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  play:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'};
const BGRP={time:{n:'Timekeeping',c:['#FFD36E','#FF7A45']},ot:{n:'Overtime',c:['#FF9DB8','#FF4D6D']},streak:{n:'Streaks',c:['#C9B8FF','#7B5CFF']},money:{n:'Money',c:['#FFE08A','#E0A100']},
  jars:{n:'Jars',c:['#9BE3FF','#3FB8FF']},study:{n:'Study',c:['#A9BDFF','#3345C9']},leave:{n:'Leave',c:['#A8FFE0','#19D9A0']},app:{n:'App',c:['#FFB3E0','#C04A98']}};
const LV=['','Bronze','Silver','Gold'];
// [id, group, name, icon, what it counts, levels]
const BADGES=[
  ['early','time','Early bird','sunrise','Clock in before 8 am',[10,50,150]],
  ['dawn','time','Dawn patrol','moon','Clock in before 7:15 am',[5,25,75]],
  ['ontime','time','On the dot','target','On-time clock-ins',[20,100,250]],
  ['iron','time','Iron month','shield','Pay periods of 15+ days, never late',[1,3,6]],
  ['homeon','time','Home on time','home','Clock out within 15 min of leave time',[20,100,250]],
  ['ot1','ot','First OT','bolt','Earn an overtime hour',[1]],
  ['othours','ot','Overtimer','flame','Hours of overtime',[10,50,150]],
  ['owl','ot','Night owl','moon','Clock out after 9 pm',[1,10,30]],
  ['marathon','ot','Marathon','hourglass','Days of 12 hours or more',[1,5,20]],
  ['streak','streak','In a row','link','Workdays in a row',[10,30,60]],
  ['days','streak','Showing up','calcheck','Days worked',[30,100,250]],
  ['hours','streak','Clocked on','clock','Hours at work',[100,500,1500]],
  ['weeks','streak','Full weeks','stack','Weeks with every workday clocked',[4,12,40]],
  ['slips','money','Payslips','receipt','Payslips saved',[1,6,12]],
  ['match','money','Spot on','check','Payslips within $1 of the estimate',[1,3,6]],
  ['paydays','money','Paydays','coins','Paydays celebrated',[1,6,12]],
  ['cpf','money','CPF builder','sprout','Dollars into your CPF',[1000,10000,30000]],
  ['jar1','jars','First jar','jar','Make a savings jar',[1]],
  ['jarfull','jars','Jar filled','jarfull','Jars filled to the target',[1,3,6]],
  ['saver','jars','Saver','piggy','Dollars in your jars',[1000,5000,20000]],
  ['scholar','study','Work + study','cap','Weeks with 3 workdays and 2 class nights',[1,5,12]],
  ['classes','study','Timetable','book','Add your classes',[1]],
  ['nights','study','Night class','bookopen','Class nights after a workday',[10,40,100]],
  ['beach','leave','Long weekender','umbrella','Long weekends booked',[1,3,8]],
  ['rest','leave','Recharged','sun','Days of annual leave taken',[5,15,40]],
  ['well','leave','Well month','heart','Pay periods of 15+ days with no MC',[1,3,6]],
  ['backup','app','Safe keeper','cloud','Backups made',[1,5,12]],
  ['scan','app','Scanner','camera','Payslips or timetables scanned',[1,5,12]],
  ['review','app','Rewind','play','Month reviews watched',[1,6,12]],
  ['explore','app','Explorer','compass','Open every page of the app',[1]]].map(([id,g,n,ic,d,lv])=>({id,g,n,ic,d,lv}));
function badgeStats(){
  const work=state.history.filter(r=>typeOf(r)==='work'&&r.out).sort((a,b)=>a.in-b.in), shift=SHIFT();
  const lateAfter=toMin(S().lateAfter||S().to||'09:00'), days=+S().days||5;
  const byP={}; work.forEach(r=>{ const k=periodOf(r.in).start; const o=byP[k]=byP[k]||{n:0,late:false,mc:false}; o.n++; if(tod(r.in)>lateAfter) o.late=true; });
  state.history.filter(r=>typeOf(r)==='mc').forEach(r=>{ const o=byP[periodOf(r.in).start]; if(o) o.mc=true; });
  const worked=new Set(work.map(r=>isoDate(r.in))), offK=new Set(state.history.filter(r=>typeOf(r)!=='work').map(r=>isoDate(r.in)));
  let streak=0,best=0; if(work.length){ for(let t=dayStart(work[0].in);t<=dayStart(Date.now());t+=DAY){ const k=isoDate(t), wd=(new Date(t).getDay()+6)%7;
    if(wd>=days||PH[k]||offK.has(k)) continue; if(worked.has(k)){ streak++; best=Math.max(best,streak); } else if(t<dayStart(Date.now())) streak=0; } }
  const wk={}; work.forEach(r=>{ const m=mondayIso(r.in); const o=wk[m]=wk[m]||{w:0,c:0,days:new Set()}; o.w++; o.days.add((new Date(r.in).getDay()+6)%7); if(clsOn(r.in).some(s=>toMin(s.start)>=17*60)) o.c++; });
  const fullWeeks=Object.entries(wk).filter(([m,o])=>{ let need=0; for(let i=0;i<days;i++){ const t=isoTs(m)+i*DAY, k=isoDate(t); if(!PH[k]&&!offK.has(k)) need++; } return o.w>=need&&need>0; }).length;
  let match=0; Object.entries(state.payslips||{}).forEach(([st,sl])=>{ try{ const m=monthForStart(+st); const est=m&&takeHomeEst(m); const net=sl.net!=null?sl.net:sl.gross-(sl.ee||0)-(sl.shg||0)-(sl.other||0); if(est!=null&&Math.abs(est-net)<=1) match++; }catch(e){} });
  let cpf=0; try{ cpf=cpfAll().total; }catch(e){}
  const pages=['today','month','days','cpf','year','stats','jars','settings'];
  return {
    early:work.filter(r=>tod(r.in)<480).length, dawn:work.filter(r=>tod(r.in)<435).length, ontime:work.filter(r=>tod(r.in)<=lateAfter).length,
    iron:Object.values(byP).filter(o=>o.n>=15&&!o.late).length, homeon:work.filter(r=>{ const d=r.out-(r.in+shift); return d>=0&&d<=15*60000; }).length,
    ot1:work.some(r=>r.otMs>0)?1:0, othours:Math.floor(work.reduce((a,r)=>a+(r.otMs||0),0)/3.6e6),
    owl:work.filter(r=>tod(r.out)>=21*60||!sameDay(r.in,r.out)).length, marathon:work.filter(r=>r.out-r.in>=12*3.6e6).length,
    streak:best, days:work.length, hours:Math.floor(work.reduce((a,r)=>a+(r.out-r.in),0)/3.6e6), weeks:fullWeeks,
    slips:Object.keys(state.payslips||{}).length, match, paydays:Object.values(state.celebrated||{}).filter(Boolean).length, cpf:Math.floor(cpf),
    jar1:(state.jars.length||state.jarMade)?1:0, jarfull:state.jars.filter(j=>j.target>0&&j.saved>=j.target).length, saver:Math.floor(jarTotal()),
    scholar:Object.values(wk).filter(o=>o.w>=3&&o.c>=2).length, classes:state.classes&&state.classes.terms&&state.classes.terms.length?1:0,
    nights:work.filter(r=>clsOn(r.in).some(s=>toMin(s.start)>=17*60)).length,
    beach:state.lwBooked||0, rest:state.history.filter(r=>typeOf(r)==='al'&&r.in<=Date.now()).length, well:Object.values(byP).filter(o=>o.n>=15&&!o.mc).length,
    backup:state.bkCount||(state.lastBackup?1:0), scan:state.scanCount||0, review:Object.keys(state.wrapped||{}).length,
    explore:pages.every(p=>(state.seen||{})[p])?1:0 };
}
const levelOf=(b,v)=>b.lv.filter(x=>v>=x).length;
let badgeQueue=[];
function checkBadges(quiet){
  if(inSetup()) return;
  const first=!state.bdg; if(first) state.bdg={};
  const s=badgeStats(), now=Date.now(), fresh=[];
  BADGES.forEach(b=>{ const lv=levelOf(b,s[b.id]||0), cur=state.bdg[b.id]||{lv:0,t:[]};
    if(lv>cur.lv){ for(let k=cur.lv;k<lv;k++) cur.t[k]=now; cur.lv=lv; state.bdg[b.id]=cur; if(!first&&!quiet) fresh.push({b,lv}); } });
  if(first||fresh.length) save();
  if(fresh.length){ badgeQueue.push(...fresh); showBadgeToasts(); }
  if(page==='stats') renderBadges(false);
}
function bdOrb(b,lv,size){ const g=BGRP[b.g]; return `<span class="bdOrb${lv?'':' off'} t${lv}" style="--b1:${g.c[0]};--b2:${g.c[1]};${size?`width:${size}px;height:${size}px`:''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${BI[b.ic]}</svg></span>`; }
function showBadgeToasts(){
  if(!badgeQueue.length) return;
  if(payRun||wr||inSetup()||!$('scan').hidden||!$('pick').hidden||openId||$('toast').classList.contains('show')||!$('bdPop').hidden){ setTimeout(showBadgeToasts,3000); return; }
  const {b,lv}=badgeQueue.shift(), el=$('bdPop');
  el.innerHTML=`${bdOrb(b,lv,52)}<div><small>New badge${b.lv.length>1?` · ${LV[lv]}`:''}</small><b>${esc(b.n)}</b><span>${esc(b.d)}${b.lv.length>1?`: ${b.lv[lv-1].toLocaleString('en-SG')}`:''}</span></div>`;
  el.hidden=false; el.onclick=()=>{ el.hidden=true; goPage('stats'); };
  if(ANIM){ G.fromTo(el,{y:-120,scale:.8,opacity:0},{y:0,scale:1,opacity:1,duration:.7,ease:'elastic.out(1,.6)'}); G.fromTo(el.querySelector('.bdOrb'),{rotation:-30,scale:.4},{rotation:0,scale:1,duration:.9,delay:.15,ease:'elastic.out(1,.4)'}); }
  const r=el.getBoundingClientRect(); if(ANIM&&!RM) setTimeout(()=>burst(r.left+40,r.top+r.height/2,50,'c'),250);
  Sound.fanfare&&lv===3?Sound.fanfare():(Sound.ting&&Sound.ting(),Sound.stack&&Sound.stack(lv)); haptic();
  setTimeout(()=>{ if(ANIM) G.to(el,{y:-120,opacity:0,duration:.4,ease:'power2.in',onComplete:()=>{ el.hidden=true; G.set(el,{clearProps:'all'}); if(badgeQueue.length) setTimeout(showBadgeToasts,600); }}); else { el.hidden=true; if(badgeQueue.length) setTimeout(showBadgeToasts,600); } },3600);
}
function renderBadges(animate){
  const box=$('bdGrid'); if(!box) return; const s=badgeStats(), B=state.bdg||{};
  const got=BADGES.filter(b=>(B[b.id]||{}).lv>0).length; $('bdHead').textContent=`Badges · ${got} of ${BADGES.length}`;
  box.innerHTML=Object.keys(BGRP).map(g=>`<p class="bdG">${BGRP[g].n}</p><div class="bdGrid3">${BADGES.filter(b=>b.g===g).map(b=>{ const lv=(B[b.id]||{}).lv||0, v=s[b.id]||0, next=b.lv[lv];
      const sub=next!=null?`<span class="bdBar"><i style="width:${Math.min(100,v/next*100)}%"></i></span><small>${Math.min(v,next).toLocaleString('en-SG')} / ${next.toLocaleString('en-SG')}</small>`:`<small class="max">${b.lv.length>1?'Gold':'Done'}</small>`;
      return `<button type="button" class="card bd${lv?'':' locked'}" data-id="${b.id}">${bdOrb(b,lv)}<b>${esc(b.n)}</b>${lv&&b.lv.length>1?`<em class="lvTag t${lv}">${LV[lv]}</em>`:''}${sub}</button>`; }).join('')}</div>`).join('');
  box.querySelectorAll('.bd').forEach(el=>el.onclick=()=>{ const b=BADGES.find(x=>x.id===el.dataset.id), lv=(B[b.id]||{}).lv||0;
    toast(`${b.n}: ${b.d}${b.lv.length>1?` (${b.lv.map((x,i)=>`${LV[i+1]} ${x.toLocaleString('en-SG')}`).join(' · ')})`:''}`,false);
    if(ANIM) G.fromTo(el.querySelector('.bdOrb'),{scale:.75,rotation:-12},{scale:1,rotation:0,duration:.8,ease:'elastic.out(1,.35)'}); Sound.tap(); });
  if(animate&&ANIM) G.from('#bdGrid .bd',{y:20,opacity:0,scale:.9,stagger:.02,duration:.45,ease:'back.out(1.7)',clearProps:'all'});
}

{ const _rd=renderDays; renderDays=function(){ _rd.apply(this,arguments); try{ renderLong(); }catch(e){} clearTimeout(renderDays.bt); renderDays.bt=setTimeout(()=>checkBadges(),1200); }; }
{ const _rm=renderMonth; renderMonth=function(a){ _rm.apply(this,arguments); try{ const p=periodOf(Date.now(),pOff), ok=p.end<=Date.now()&&!!wrapData(p); $('wrapBtn').hidden=!ok; $('wrapBtn').onclick=()=>openWrap(p); }catch(e){} }; }
$('bkSave').addEventListener('click',()=>setTimeout(()=>checkBadges(),1500));

/* ================= calendar: a month at a glance, with your classes ================= */
let yMode='year', calOff=0, calSel=null;
function setYMode(v){ yMode=v; document.querySelectorAll('#yMode button').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.v===v)));
  $('yCard').hidden=v!=='year'; $('yHols').hidden=v!=='year'; $('calCard').hidden=v!=='month'; $('calDay').hidden=v!=='month'||!calSel;
  if(v==='month') renderCal(true); else renderYear(true); }
document.querySelectorAll('#yMode button').forEach(b=>b.onclick=()=>{ if(b.dataset.v!==yMode){ Sound.swoosh({x:b.dataset.v==='month'?1:-1,y:0}); setYMode(b.dataset.v); } });
function clsOn(ts){ try{ return classesOn(ts); }catch(e){ return []; } }
function dayInfo(ts,map){
  const k=isoDate(ts), r=map[k]||null, cls=clsOn(ts), ph=PH[k]||null;
  return {k,r,cls,ph,t:r?typeOf(r):null};
}
function renderCal(animate){
  const base=new Date(); base.setDate(1); base.setMonth(base.getMonth()+calOff);
  const y=base.getFullYear(), m=base.getMonth(), map=yearData(y), today=isoDate(Date.now());
  if(m===0||m===11) Object.assign(map,yearData(m===0?y-1:y+1));
  $('yLbl').textContent='Month'; $('yRange').textContent=base.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  $('yNext').disabled=calOff>=12;
  const first=(new Date(y,m,1).getDay()+6)%7, days=new Date(y,m+1,0).getDate(), cells=[];
  for(let i=0;i<first;i++) cells.push('<div class="calC blank"></div>');
  let worked=0,hrs=0,ot=0,nights=0,off=0;
  for(let d=1;d<=days;d++){
    const ts=new Date(y,m,d,12).getTime(), I=dayInfo(ts,map), wk=(new Date(ts).getDay()+6)%7>=(+S().days||5);
    let body='';
    if(I.t==='work'&&I.r.out){ const h=(I.r.out-I.r.in)/3.6e6, f=Math.min(1,(I.r.out-I.r.in)/SHIFT()); worked++; hrs+=h; ot+=(I.r.otMs||0);
      body+=`<span class="calBar${I.r.otMs?' ot':''}"><i style="width:${Math.max(18,f*100)}%"></i></span><span class="calH">${h.toFixed(1)}h</span>`; }
    else if(I.t==='work') body+=`<span class="calBar live"><i style="width:60%"></i></span>`;
    else if(I.t) { off++; body+=`<span class="calTag ${I.t==='mc'?'mc':I.t==='al'?'al':I.t==='ph'?'ph':'un'}">${I.t==='al'?'Leave':I.t==='ph'?'Holiday':I.t==='mc'?'MC':'Unpaid'}</span>`; }
    else if(I.ph) body+=`<span class="calTag ph">Holiday</span>`;
    const ev=I.cls.filter(s=>toMin(s.start)>=12*60||true); if(ev.length) nights++;
    body+=ev.slice(0,2).map(s=>`<span class="calCls">${fmtHM(s.start).replace(':00','').replace(' pm','p').replace(' am','a')}</span>`).join('')+(ev.length>2?`<span class="calMore">+${ev.length-2}</span>`:'');
    cells.push(`<button type="button" class="calC${wk?' we':''}${I.k===today?' today':''}${calSel===I.k?' sel':''}${ts>Date.now()?' fut':''}" data-k="${I.k}"><b>${d}</b>${body}</button>`);
  }
  $('calGrid').innerHTML=['M','T','W','T','F','S','S'].map(x=>`<div class="calW">${x}</div>`).join('')+cells.join('');
  $('calGrid').querySelectorAll('.calC[data-k]').forEach(b=>b.onclick=()=>{ calSel=b.dataset.k; $('calGrid').querySelectorAll('.calC').forEach(x=>x.classList.toggle('sel',x===b)); showCalDay(calSel); Sound.tap(); haptic();
    if(ANIM) G.fromTo(b,{scale:.9},{scale:1,duration:.5,ease:'elastic.out(1,.4)'}); });
  $('yStats').innerHTML=stat('Days worked',String(worked))+stat('Hours at work',dur(hrs*3.6e6))+stat('Overtime',ot?dur(ot):'0h')+stat('Class nights',String(nights));
  $('calLeg').innerHTML='<span><i class="lg w"></i>Worked</span><span><i class="lg o"></i>Overtime</span><span><i class="lg l"></i>Leave</span><span><i class="lg h"></i>Holiday</span><span><i class="lg c"></i>Class</span>';
  if(calSel&&!calSel.startsWith(`${y}-${pad(m+1)}`)) calSel=null;
  showCalDay(calSel);
  if(animate&&ANIM){ G.from('#calGrid .calC',{scale:.6,opacity:0,stagger:{each:.012,from:'start'},duration:.4,ease:'back.out(2)',clearProps:'transform,opacity'}); G.from('#yStats .stat',{y:20,opacity:0,stagger:.05,duration:.45,ease:'power4.out',clearProps:'transform,opacity'}); }
}
function showCalDay(k){
  const box=$('calDay'); if(!k||yMode!=='month'){ box.hidden=true; return; }
  const ts=isoTs(k), map=yearData(new Date(ts).getFullYear()), I=dayInfo(ts,map), rows=[];
  if(I.t==='work'){ const r=I.r; rows.push(`<div class="cdRow"><i class="lg ${r.otMs?'o':'w'}"></i><span>${r.out?`Worked ${fmt(r.in)} – ${fmt(r.out)}`:`Clocked in ${fmt(r.in)}`}</span><b>${r.out?dur(r.out-r.in):''}</b></div>`);
    if(r.otMs) rows.push(`<div class="cdRow"><i class="lg o"></i><span>Overtime</span><b>${dur(r.otMs)}${r.ot?` · ${money(r.ot)}`:''}</b></div>`); }
  else if(I.t) rows.push(`<div class="cdRow"><i class="lg ${I.t==='al'?'l':I.t==='ph'?'h':'m'}"></i><span>${I.t==='ph'?(I.r.name||I.ph||'Public holiday'):typeLabel(I.r)}</span><b></b></div>`);
  else if(I.ph) rows.push(`<div class="cdRow"><i class="lg h"></i><span>${esc(I.ph)}</span><b>Public holiday</b></div>`);
  I.cls.forEach(s=>rows.push(`<div class="cdRow"><i class="lg c"></i><span>${esc(s.name)}${s.venue?` · ${esc(s.venue)}`:''}</span><b>${fmtHM(s.start)} – ${fmtHM(s.end)}</b></div>`));
  if(!rows.length) rows.push(`<p class="note" style="margin:0">${ts>Date.now()?'Nothing planned.':(new Date(ts).getDay()%6===0?'Weekend.':'Nothing recorded.')}</p>`);
  const past=ts<=Date.now()&&!(I.r&&I.r.live);
  box.innerHTML=`<p class="cardT">${new Date(ts).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</p>${rows.join('')}${past?`<button class="linkish" id="cdEdit" type="button" style="margin-top:10px">${I.r?'Edit this day':'Add this day'}</button>`:''}`;
  box.hidden=false;
  const e=$('cdEdit'); if(e) e.onclick=()=>{ const i=I.r?state.history.indexOf(I.r):-1; if(i>=0) openDay(i); else { openDay(null); $('dDate').value=k; dayPreview(); } };
  if(ANIM) G.fromTo(box,{y:14,opacity:0},{y:0,opacity:1,duration:.35,ease:'power3.out',clearProps:'transform,opacity'});
}


/* ---- the recap blob on Today: a glossy drop that drifts in from the edge now and then ---- */
const RevBlob=(function(){
  const el=$('revBlob'); let timer=null, out=true, tl=null;
  // the last finished pay period, from when its recap is ready (period over and paid) for 10 days
  function target(){ const p=periodOf(Date.now(),-1), d=new Date(p.start+15*DAY), pd=paydayOf(d.getFullYear(),d.getMonth()+(S().payFor==='prev'?1:0)), ready=Math.max(p.end,dayStart(pd));
    if(Date.now()<ready||Date.now()-ready>10*DAY) return null; return wrapData(p)?p:null; }
  function free(){ return page==='today'&&!openId&&!payRun&&!wr&&!inSetup()&&$('scan').hidden&&$('pick').hidden&&!document.hidden; }
  function hide(fast){ if(tl) tl.kill(); tl=null; if(out){ el.hidden=true; return; } out=true;
    if(ANIM&&!fast){ const side=el.dataset.side==='l'?-1:1; G.to(el,{x:side*140,duration:.7,ease:'back.in(1.4)',onComplete:()=>{ el.hidden=true; }}); } else el.hidden=true; }
  function visit(){
    if(!out) return;
    const p=target(); if(!p||!free()) { schedule(); return; }
    const watched=!!state.wrapped[p.start], side=Math.random()<.5?'l':'r';
    el.dataset.side=side; el.style.top=Math.round(innerHeight*(.3+Math.random()*.35))+'px';
    const mon=new Date(p.start+15*DAY).toLocaleDateString(undefined,{month:'short'}); el.querySelector('small').textContent=mon; el.querySelector('.rbTag').textContent=`Your ${mon} recap`;
    el.onclick=()=>{ hide(true); Sound.pop(); haptic(); openWrap(p); };
    el.hidden=false; out=false; const s=side==='l'?-1:1;
    el.style.left=side==='l'?'-4px':'auto'; el.style.right=side==='r'?'-4px':'auto';
    if(ANIM){ tl=G.timeline({onComplete:()=>{ hide(); schedule(); }})
        .fromTo(el,{x:s*140,rotation:s*30},{x:0,rotation:0,duration:1.1,ease:'elastic.out(1,.55)'})
        .to(el,{y:'-=14',duration:1.1,yoyo:true,repeat:3,ease:'sine.inOut'},.6)
        .to(el,{scaleX:1.12,scaleY:.9,duration:.18,yoyo:true,repeat:1,ease:'power2.inOut'},1.4)
        .fromTo(el.querySelector('.rbTag'),{opacity:0,x:s*-10,scale:.8},{opacity:1,x:0,scale:1,duration:.5,ease:'back.out(2)'},.7)
        .to(el.querySelector('.rbTag'),{opacity:0,duration:.3},4.6)
        .to({},{duration:watched?.8:2.2}); Sound.bubble&&Sound.bubble(520); }
    else { setTimeout(()=>{ hide(); schedule(); },6000); }
  }
  function schedule(){ clearTimeout(timer); const p=target(); if(!p) { timer=setTimeout(schedule,60000); return; }
    timer=setTimeout(visit,(state.wrapped[p.start]?45:12)*1000*(0.8+Math.random()*.4)); }
  return {start(){ schedule(); }, hide, poke(){ clearTimeout(timer); timer=setTimeout(visit,2500); }};
})();

