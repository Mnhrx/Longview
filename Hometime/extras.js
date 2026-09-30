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
  const now=Date.now(), pd=paydayOf(new Date(now).getFullYear(),new Date(now).getMonth());
  const last=dayStart(pd)<=dayStart(now)?pd:paydayOf(new Date(now).getFullYear(),new Date(now).getMonth()-1);
  const key=isoDate(last); if(state.jarPd===key) return null;
  let total=0; const moved=[];
  state.jars.forEach(j=>{ if(j.created&&j.created>last+DAY) return; const room=Math.max(0,j.target-j.saved), amt=Math.min(room,j.per||0); if(amt<=0) return;
    j.from=j.from??j.saved; j.saved+=amt; total+=amt; moved.push(j.id); (j.log=j.log||[]).unshift({t:last,amt,why:'Payday'}); j.log=j.log.slice(0,30); });
  state.jarPd=key; if(total>0) state.jarFresh={pd:key,total,ids:moved}; save(); return total>0?total:null;
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
    const saved=Math.max(0,+$('jSaved').value||0); state.jars.push({id:'j'+Date.now().toString(36),name,target,per,saved,pal:jPal,created:Date.now(),log:saved?[{t:Date.now(),amt:saved,why:'Starting amount'}]:[]}); }
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

/* ================= month in review ================= */
if(!state.wrapped) state.wrapped={};
function wrapData(p){
  const L=state.history.filter(r=>r.in>=p.start&&r.in<p.end), x=statsOf(L); if(!x) return null;
  const m=monthForStart(p.start), slip=state.payslips&&state.payslips[p.start];
  const pay=m?(slip?(slip.net!=null?slip.net:slip.gross-(slip.ee||0)-(slip.shg||0)-(slip.other||0)):takeHomeEst(m)):null;
  let cpf=null; for(let off=0;off>-24;off--){ const pp=periodOf(Date.now(),off); if(pp.start===p.start){ const c=cpfFor(off); cpf=c?c.total:null; break; } if(pp.start<p.start) break; }
  const jarIn=state.jars.reduce((a,j)=>a+(j.log||[]).filter(l=>l.t>=p.start&&l.t<p.end+10*DAY&&l.amt>0&&l.why!=='Starting amount').reduce((s,l)=>s+l.amt,0),0);
  const badges=Object.entries(state.badges||{}).filter(([k,t])=>t>=p.start&&t<p.end+10*DAY).map(([k])=>BADGES.find(b=>b.id===k)).filter(Boolean);
  const monthName=new Date(p.start+15*DAY).toLocaleDateString(undefined,{month:'long'});
  return {p,x,pay,cpf,jarIn,badges,monthName,slip:!!slip};
}
let wr=null;
const WG=['linear-gradient(160deg,#FFB020 0%,#FF4D6D 55%,#7B5CFF 100%)','linear-gradient(160deg,#3FB8FF 0%,#7B5CFF 70%,#3A2A8C 100%)','linear-gradient(160deg,#FF8FB3 0%,#FF4D6D 45%,#B8327A 100%)',
  'linear-gradient(160deg,#FFE08A 0%,#FFB020 45%,#E0531F 100%)','linear-gradient(160deg,#7CF0C2 0%,#19D9A0 45%,#0B6F55 100%)','linear-gradient(160deg,#9BE3FF 0%,#3FB8FF 45%,#3345C9 100%)','linear-gradient(160deg,#D9CCFF 0%,#9E8CF0 45%,#4B2FC9 100%)'];
const BL=[['#FFE08A','#FF7A45'],['#9BE3FF','#3FB8FF'],['#FFB3E0','#FF4D6D'],['#A8FFE0','#19D9A0'],['#D9CCFF','#7B5CFF'],['#FFFFFF','#FFC53D']];
// blobs sit around the edges so they never sit behind the numbers
const SPOTS=[[-12,6],[68,10],[-8,72],[70,74],[30,-6],[34,84]];
function blobs(n,seed){ let h=''; for(let i=0;i<n;i++){ const b=BL[(seed+i)%BL.length], s=90+((seed*37+i*53)%110), sp=SPOTS[(seed+i*2)%SPOTS.length], x=sp[0]+((seed*7+i*11)%10), y=sp[1]+((seed*5+i*13)%8);
  h+=`<i class="wrBlob" style="--b1:${b[0]};--b2:${b[1]};width:${s}px;height:${s}px;left:${x}%;top:${y}%;animation-delay:-${i*1.7}s"></i>`; } return h; }
function wrapCards(d){
  const x=d.x, C=[], hrs=x.hours/3.6e6;
  C.push(`<p class="k">Your month in review</p><p class="t">${d.monthName}</p><p class="s">${rangeTxt(d.p)}</p>`);
  C.push(`<p class="k">At work</p><p class="big" data-n="${hrs.toFixed(1)}" data-f="h">0</p><p class="s">hours over <b>${x.w.length}</b> day${x.w.length===1?'':'s'}. That’s ${dur(x.hours/x.w.length)} a day on average.</p>`);
  C.push(`<p class="k">Early bird</p><p class="big">${fmt(x.early.in)}</p><p class="s">Your earliest clock-in, on ${dayName(x.early.in)}. You usually arrived around ${hm(x.avgIn)}.</p>`);
  C.push(x.otMs>0?`<p class="k">Overtime</p><p class="big" data-n="${(x.otMs/3.6e6).toFixed(1)}" data-f="h">0</p><p class="s">hours of OT${x.ot?`, worth about <b>${money(x.ot)}</b>`:''}. Your longest day was ${dur(x.longest.out-x.longest.in)}.</p>`
    :`<p class="k">Home on time</p><p class="big">${hm(x.avgOut)}</p><p class="s">was when you usually left. No overtime this month 🏠</p>`);
  if(d.pay!=null) C.push(`<p class="k">${d.slip?'Your pay':'Your pay (estimate)'}</p><p class="big" style="font-size:clamp(40px,12.5vw,72px)" data-n="${d.pay.toFixed(2)}" data-f="$">$0</p><p class="s">went into your bank${d.cpf?`, and <b>${money(d.cpf)}</b> into your CPF`:''}.</p>`);
  if(d.jarIn>0) C.push(`<p class="k">Your jars</p><p class="big" data-n="${d.jarIn.toFixed(0)}" data-f="$0">$0</p><p class="s">saved into your jars. You’re at <b>${moneyR(jarTotal())}</b> in total.</p>`);
  if(x.al+x.mc>0) C.push(`<p class="k">Time off</p><p class="big">${x.al+x.mc}</p><p class="s">day${x.al+x.mc===1?'':'s'} off: ${x.al} leave, ${x.mc} MC.</p>`);
  if(d.badges.length) C.push(`<p class="k">New badges</p><div class="wrBadges">${d.badges.map(b=>`<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><span class="bdOrb" style="--b1:${b.c[0]};--b2:${b.c[1]};width:72px;height:72px;font-size:34px">${b.e}</span><b style="font-size:14px">${esc(b.n)}</b></div>`).join('')}</div>`);
  const np=nextPayday(); C.push(`<p class="k">That’s a wrap</p><p class="t">See you next payday</p><p class="s">${np?new Date(np).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'}):''}</p><button class="wrBtn" type="button" id="wrDone">Done</button>`);
  return C;
}
function openWrap(p){
  const d=wrapData(p); if(!d) return false;
  const cards=wrapCards(d); wr={i:-1,n:cards.length,timer:null,p};
  $('wrStage').innerHTML=cards.map((c,i)=>`<div class="wrCard" style="--wg:${WG[i%WG.length]}" hidden>${blobs(3,i*3+1)}${c}</div>`).join('');
  $('wrBars').innerHTML=cards.map(()=>'<i><b></b></i>').join('');
  $('wrap').hidden=false; lockScroll(true); state.wrapped[p.start]=true; save();
  if(ANIM) G.fromTo('#wrap',{opacity:0,scale:1.04},{opacity:1,scale:1,duration:.45,ease:'power3.out',clearProps:'transform,opacity'});
  wrGo(0); return true;
}
function wrGo(i){
  if(!wr) return; if(i<0) i=0; if(i>=wr.n){ closeWrap(); return; }
  const cards=[...$('wrStage').children], bars=[...$('wrBars').querySelectorAll('b')], prev=cards[wr.i];
  clearTimeout(wr.timer); G&&G.killTweensOf(bars);
  bars.forEach((b,k)=>{ b.style.width=k<i?'100%':'0%'; });
  const cur=cards[i]; cur.hidden=false;
  if(prev&&prev!==cur){ if(ANIM) G.to(prev,{opacity:0,scale:.96,duration:.25,onComplete:()=>{ prev.hidden=true; G.set(prev,{clearProps:'all'}); }}); else prev.hidden=true; }
  wr.i=i;
  if(ANIM){ G.fromTo(cur,{opacity:0,scale:1.04},{opacity:1,scale:1,duration:.4,ease:'power3.out'});
    G.fromTo(cur.querySelectorAll('.k,.t,.big,.s,.row,.wrBadges,.wrBtn'),{y:30,opacity:0},{y:0,opacity:1,duration:.6,stagger:.08,delay:.1,ease:'back.out(1.8)'}); }
  cur.querySelectorAll('[data-n]').forEach(el=>{ const n=+el.dataset.n, f=el.dataset.f, put=v=>el.textContent=f==='$'?money(v):f==='$0'?moneyR(v):`${v.toFixed(1)}h`;
    if(ANIM){ const o={v:0}; G.to(o,{v:n,duration:1.3,delay:.25,ease:'power3.out',onUpdate:()=>put(o.v)}); } else put(n); });
  const done=cur.querySelector('#wrDone'); if(done) done.onclick=e=>{ e.stopPropagation(); closeWrap(); };
  Sound.pop&&Sound.pop(); haptic();
  const last=i===wr.n-1;
  if(!last){ if(ANIM) G.fromTo(bars[i],{width:'0%'},{width:'100%',duration:6,ease:'none'}); wr.timer=setTimeout(()=>wrGo(i+1),6000); } else bars[i].style.width='100%';
}
function closeWrap(){ if(!wr) return; clearTimeout(wr.timer); wr=null; const done=()=>{ $('wrap').hidden=true; lockScroll(false); };
  if(ANIM) G.to('#wrap',{opacity:0,duration:.3,onComplete:()=>{ done(); G.set('#wrap',{clearProps:'all'}); }}); else done(); }
$('wrNext').onclick=()=>wr&&wrGo(wr.i+1); $('wrPrev').onclick=()=>wr&&wrGo(wr.i-1); $('wrX').onclick=closeWrap;
addEventListener('keydown',e=>{ if(!wr) return; if(e.key==='Escape') closeWrap(); if(e.key==='ArrowRight') wrGo(wr.i+1); if(e.key==='ArrowLeft') wrGo(wr.i-1); });
// right after the payday celebration: the month that payday paid for
function afterPayday(pd){
  const credited=creditJars();
  const p=forPeriod(pd||Date.now());
  setTimeout(()=>{ if(!state.wrapped[p.start]&&wrapData(p)) openWrap(p); else if(credited) toast(`💧 ${money(credited)} went into your jars`,false); },900);
}

/* ================= badges ================= */
const BADGES=[
  {id:'first',n:'First day',e:'🟢',c:['#A8FFE0','#19D9A0'],d:'Clock your first day',p:s=>[s.work.length,1]},
  {id:'early',n:'Early bird',e:'🐦',c:['#FFE08A','#FFB020'],d:'Clock in before 8 am, 10 times',p:s=>[s.work.filter(r=>tod(r.in)<480).length,10]},
  {id:'dawn',n:'Dawn patrol',e:'🌅',c:['#FFB3A1','#FF7A45'],d:'Clock in before 7:15 am, 5 times',p:s=>[s.work.filter(r=>tod(r.in)<435).length,5]},
  {id:'iron',n:'Iron month',e:'🛡️',c:['#C9D3F0','#6C8BFF'],d:'A pay period of 15+ days, never late',p:s=>[s.ironBest,15]},
  {id:'ot1',n:'First OT',e:'⚡',c:['#FFE08A','#FF9F1C'],d:'Earn your first overtime hour',p:s=>[s.otH>=1?1:0,1]},
  {id:'ot20',n:'OT machine',e:'🔥',c:['#FFB3A1','#FF4D6D'],d:'20 hours of overtime in total',p:s=>[Math.floor(s.otH),20]},
  {id:'streak',n:'10 in a row',e:'🔗',c:['#D9CCFF','#7B5CFF'],d:'Clock 10 workdays in a row',p:s=>[s.streak,10]},
  {id:'century',n:'Century',e:'💯',c:['#FFB3E0','#FF6FB1'],d:'Work 100 days',p:s=>[s.work.length,100]},
  {id:'slip1',n:'First payslip',e:'🧾',c:['#FFFFFF','#FFC53D'],d:'Save your first payslip',p:s=>[s.slips,1]},
  {id:'slip3',n:'Payslip pro',e:'📚',c:['#9BE3FF','#3FB8FF'],d:'Save 3 payslips',p:s=>[s.slips,3]},
  {id:'jarfull',n:'Jar filled',e:'🫙',c:['#A8FFE0','#0FA37A'],d:'Fill a jar to its target',p:s=>[s.jarFull,1]},
  {id:'saver',n:'Saver',e:'💰',c:['#FFE08A','#E0A100'],d:'$1,000 across your jars',p:s=>[Math.floor(s.jarTot),1000]},
  {id:'scholar',n:'Work + study',e:'🎓',c:['#9BE3FF','#7B5CFF'],d:'A week with 3 workdays and 2 class nights',p:s=>[s.scholar,1]},
  {id:'beach',n:'Long weekender',e:'🏖️',c:['#9BE3FF','#19D9A0'],d:'Book a long weekend from the planner',p:s=>[s.booked,1]},
  {id:'backup',n:'Safe keeper',e:'🛟',c:['#FFB3A1','#FF4D6D'],d:'Back up your data',p:s=>[s.backup,1]}];
function badgeStats(){
  const work=state.history.filter(r=>typeOf(r)==='work'&&r.out).sort((a,b)=>a.in-b.in);
  const otH=work.reduce((a,r)=>a+(r.otMs||0),0)/3.6e6;
  const lateAfter=toMin(S().lateAfter||S().to||'09:00');
  const byP={}; work.forEach(r=>{ const k=periodOf(r.in).start; const o=byP[k]=byP[k]||{n:0,late:false}; o.n++; if(tod(r.in)>lateAfter) o.late=true; });
  const ironBest=Math.max(0,...Object.values(byP).map(o=>o.late?0:o.n));
  // streak: workdays (not weekends, holidays or leave) you clocked, one after another
  const worked=new Set(work.map(r=>dayIso(r.in))), offK=new Set(state.history.filter(r=>typeOf(r)!=='work').map(r=>dayIso(r.in)));
  let streak=0,best=0; if(work.length){ const days=+S().days||5; for(let t=dayStart(work[0].in);t<=dayStart(Date.now());t+=DAY){ const k=dayIso(t), wd=(new Date(t).getDay()+6)%7;
    if(wd>=days||PH[k]||offK.has(k)) continue; if(worked.has(k)){ streak++; best=Math.max(best,streak); } else if(t<dayStart(Date.now())) streak=0; } }
  let scholar=0; const wk={}; work.forEach(r=>{ const m=mondayIso(r.in); const o=wk[m]=wk[m]||{w:0,c:0}; o.w++; if(classesOn(r.in).some(s=>toMin(s.start)>=17*60)) o.c++; });
  if(Object.values(wk).some(o=>o.w>=3&&o.c>=2)) scholar=1;
  return {work,otH,ironBest,streak:best,slips:Object.keys(state.payslips||{}).length,jarFull:state.jars.some(j=>j.saved>=j.target&&j.target>0)?1:0,jarTot:jarTotal(),scholar,booked:state.lwBooked?1:0,backup:state.lastBackup?1:0};
}
let badgeQueue=[];
function checkBadges(quiet){
  if(inSetup()) return;
  const first=!state.badges; if(first) state.badges={};
  const s=badgeStats(), now=Date.now(), fresh=[];
  BADGES.forEach(b=>{ const [v,of]=b.p(s); if(v>=of&&!state.badges[b.id]){ state.badges[b.id]=now; if(!first&&!quiet) fresh.push(b); } });
  if(first||fresh.length) save();
  if(fresh.length){ badgeQueue.push(...fresh); showBadgeToasts(); }
  if(page==='stats') renderBadges(false);
}
function showBadgeToasts(){
  if(!badgeQueue.length) return;
  if(payRun||wr||inSetup()||!$('scan').hidden||!$('pick').hidden||openId||$('toast').classList.contains('show')){ setTimeout(showBadgeToasts,3000); return; }
  const b=badgeQueue.shift(); toast(`🏅 New badge: ${b.e} ${b.n}`,false,{label:'See',fn:()=>goPage('stats')});
  if(ANIM&&!RM){ burst(innerWidth/2,innerHeight*.72,60,'c'); } Sound.ting&&Sound.ting();
  if(badgeQueue.length) setTimeout(showBadgeToasts,4200);
}
function renderBadges(animate){
  const box=$('bdGrid'); if(!box) return; const s=badgeStats();
  const n=Object.keys(state.badges||{}).length; $('bdHead').textContent=`Badges · ${n} of ${BADGES.length}`;
  box.innerHTML=BADGES.map(b=>{ const got=state.badges&&state.badges[b.id], [v,of]=b.p(s);
    return `<button type="button" class="card bd${got?'':' locked'}" data-id="${b.id}"><span class="bdOrb" style="--b1:${b.c[0]};--b2:${b.c[1]}">${b.e}</span><b>${esc(b.n)}</b>${got?`<small>${new Date(got).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</small>`:(of>1?`<span class="bdBar"><i style="width:${Math.min(100,v/of*100)}%"></i></span><small>${Math.min(v,of).toLocaleString('en-SG')} / ${of.toLocaleString('en-SG')}</small>`:'<small>Locked</small>')}</button>`; }).join('');
  box.querySelectorAll('.bd').forEach(el=>el.onclick=()=>{ const b=BADGES.find(x=>x.id===el.dataset.id); toast(`${b.e} ${b.n}: ${b.d}`,false); if(ANIM) G.fromTo(el.querySelector('.bdOrb'),{scale:.8},{scale:1,duration:.7,ease:'elastic.out(1,.35)'}); });
  if(animate&&ANIM) G.from('#bdGrid .bd',{y:20,opacity:0,scale:.9,stagger:.03,duration:.45,ease:'back.out(1.7)',clearProps:'all'});
}

{ const _rd=renderDays; renderDays=function(){ _rd.apply(this,arguments); try{ renderLong(); }catch(e){} clearTimeout(renderDays.bt); renderDays.bt=setTimeout(()=>checkBadges(),1200); }; }
{ const _rm=renderMonth; renderMonth=function(a){ _rm.apply(this,arguments); try{ const p=periodOf(Date.now(),pOff), ok=!!wrapData(p); $('wrapBtn').hidden=!ok; $('wrapBtn').onclick=()=>openWrap(p); }catch(e){} }; }
$('bkSave').addEventListener('click',()=>setTimeout(()=>checkBadges(),1500));
