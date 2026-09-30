/* Home Time: navigation, clock and start-up */
/* ================= pages & nav ================= */
let page='today';
function refreshAll(){
  updateIdleSub(); renderDays(); updatePayPills();
  if(page==='today'){ if(state.active){ showActive(false); world&&world.go('work'); } else { showIdle(false); world&&world.go('home'); } }
  else if(page==='month') renderMonth(false); else if(page==='cpf') renderCpf(false); else if(page==='year'){ if(yMode==='month') renderCal(false); else renderYear(false); } else if(page==='stats'){ renderStats(false); renderBadges(false); } else if(page==='jars') renderJars(false); else if(page==='settings') fillSettings();
}
const PAGES={today:'pgToday',month:'pgMonth',days:'pgDays',settings:'pgSettings',cpf:'pgCpf',year:'pgYear',stats:'pgStats',jars:'pgJars'};
const NAVOF={year:'month',stats:'month',jars:'month'};
let lastPage='today';
const IND={cpf:'linear-gradient(135deg,#A8FFE0,#19D9A0 50%,#0FA37A)',today:'linear-gradient(135deg,#FFB020,#FF4D6D 55%,#7B5CFF)',month:'linear-gradient(135deg,#FFE08A,#FFB020 50%,#FF9F1C)',days:'linear-gradient(135deg,#D9CCFF,#9E8CF0 55%,#7A86C2)'};
const navBtns=[...document.querySelectorAll('#nav button')];
function moveInd(pg,animate){
  pg=NAVOF[pg]||pg;
  const ind=$('navInd');
  $('gearBtn').classList.toggle('on',pg==='settings');
  if(pg==='settings'){ if(ANIM&&animate) G.to(ind,{scale:.4,opacity:0,duration:.3,ease:'back.in(2)'}); else if(G) G.set(ind,{scale:.4,opacity:0}); else ind.style.opacity=0; return; }
  if(G&&+G.getProperty(ind,'opacity')<1){ G.set(ind,{x:navBtns[navBtns.findIndex(b=>b.dataset.pg===pg)].offsetLeft-6}); if(ANIM&&animate) G.to(ind,{scale:1,opacity:1,duration:.6,ease:'elastic.out(1,.5)'}); else G.set(ind,{scale:1,opacity:1}); }
  const i=navBtns.findIndex(b=>b.dataset.pg===pg);
  const x=navBtns[i].offsetLeft-6;
  ind.style.background=IND[pg];
  if(!animate||!ANIM){ if(G) G.set(ind,{x}); else ind.style.transform=`translateX(${x}px)`; return; }
  G.timeline()
    .to(ind,{scaleX:1.35,scaleY:.82,duration:.14,ease:'power2.out'})
    .to(ind,{x,duration:.5,ease:'elastic.out(1,.65)'},.05)
    .to(ind,{scaleX:1,scaleY:1,duration:.6,ease:'elastic.out(1.2,.4)'},.18);
  G.fromTo(navBtns[i].querySelector('.ic'),{y:0,scale:1},{keyframes:[{y:-7,scale:1.2,duration:.16,ease:'power2.out'},{y:0,scale:1,duration:.6,ease:'elastic.out(1.2,.35)'}]});
}
navBtns.forEach(b=>b.onclick=()=>goPage(b.dataset.pg));
$('goYear').onclick=()=>goPage('year'); $('goStats').onclick=()=>goPage('stats'); $('goJars').onclick=()=>goPage('jars');
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>goPage('month'));
addEventListener('resize',()=>moveInd(page,false));
// switch pages instantly (e.g. behind a cover), making sure the new page isn't left faded out
function showPageDirect(pg){
  Object.values(PAGES).forEach(id=>{ if(id!==PAGES[pg]) $(id).hidden=true; });
  const el=$(PAGES[pg]); el.hidden=false; if(G) G.set(el,{clearProps:'all'}); else el.removeAttribute('style');
  if(page!=='settings'&&pg==='settings') lastPage=page;
  page=pg;
  navBtns.forEach(b=>b.dataset.pg===(NAVOF[pg]||pg)?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  moveInd(pg,false);
}
function goPage(pg){
  lastInput=Date.now();
  if(pg===page||busy) return;
  if(openId) closeSheet();
  const from=page; page=pg; if(from!=='settings') lastPage=from;
  navBtns.forEach(b=>b.dataset.pg===(NAVOF[pg]||pg)?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  if((NAVOF[pg]||pg)!==(NAVOF[from]||from)) moveInd(pg,true);
  { const zf=from==='today'?(state.active?'work':'home'):from, zt=pg==='today'?(state.active?'work':'home'):pg; Sound.swoosh(world?world.dir(zf,zt):null); Sound.zone(zt); }
  world&&world.go(pg==='today'?(state.active?'work':'home'):pg);
  (state.seen=state.seen||{})[pg]=1;
  const show=()=>{
    $(PAGES[from]).hidden=true; $(PAGES[pg]).hidden=false; if(G) G.set('#'+PAGES[pg],{clearProps:'all'});
    scrollTo(0,0);
    if(pg==='today'){ if(state.active) showActive(true); else showIdle(true); }
    if(pg==='month'){ if(!NAVOF[from]) pOff=0; renderMonth(true); updatePayPills(); }
    if(pg==='cpf'){ cOff=0; renderCpf(true); }
    if(pg==='year'){ yOff=0; calOff=0; calSel=null; if(yMode==='month') setYMode('month'); else renderYear(true); }
    if(pg==='stats'){ sOff=pOff; renderStats(true); renderBadges(true); }
    if(pg==='jars'){ renderJars(true); }
    if(pg==='settings'){ showCat(inSetup()?setupSteps()[Math.min(state.setup.step||0,setupSteps().length-1)]:null,false); fillSettings(); $('savedTag').textContent=''; if(ANIM) G.from(['#sHead','#setMenu .setTile'],{y:24,opacity:0,stagger:.035,duration:.45,ease:'power4.out',clearProps:'all'}); }
    if(pg==='days'){ renderDays(); if(ANIM) G.from(['#dHead','#dTabs','#dSum','#addDay'],{y:24,opacity:0,stagger:.05,duration:.45,ease:'power4.out',clearProps:'all'}); animateDays(); }
  };
  if(!ANIM){ show(); return; }
  G.to('#'+PAGES[from],{opacity:0,y:-18,scale:.98,duration:.28,ease:'power2.in',onComplete:()=>setTimeout(show,300)});
}

document.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||b.closest('.hapt')) return;
  if(b.id==='clockIn'||b.id==='outBtn') return; if(b.closest('#nav')){ Sound.pop(); haptic(); return; } Sound.tap(); haptic(); });
document.addEventListener('change',e=>{ if(e.target.matches('.switch input')){ Sound.tap(); } });

/* ================= clock ================= */
function updateIdleSub(){ $('idleSub').textContent=`Tap the orb as you punch in. Your day is ${dur(SHIFT())}.`; }
function tick(){
  const now=new Date();
  $('today').textContent=now.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
  const h=now.getHours(); $('hello').textContent=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  $('nowTxt').textContent=`now ${fmt(now)}`;
  if(now.getSeconds()===0||!tick.pp){ tick.pp=1; updatePayPills(); }
  maybePayday();
  if(rollOver()){ renderDays(); if(page==='today'){ world&&world.go('home'); showIdle(true); } return; }
  if(state.active){
    const p=progress();
    if(!ring.animating) ring.set(p);
    world&&world.setProgress(p);
    updateLive();
    if(!state.active.celebrated&&now.getTime()>=state.active.in+SHIFT()) celebrate();
  }
}
$('clockIn').addEventListener('click',e=>startDay(Date.now(),e.currentTarget));
$('manualBtn').onclick=openTime; $('editBtn').onclick=openTime; $('outBtn').onclick=clockOut;

updateIdleSub(); renderDays(); tick(); moveInd('today',false); Sound.zone(state.active?'work':'home');
/* ================= opening transition =================
   Glossy blobs slide in and melt into the Home Time orb, it bounces, then bursts open
   while the camera swoops into the home zone. About a second and a half. */
function runIntro(done){
  const b=window.__boot;
  const reveal=()=>{ document.body.classList.remove('booting'); world&&world.swoopIn(0); done(); };
  if(!b){ reveal(); return; }
  // wait for the font and a couple of frames of the 3D scene, then let the loader finish
  const fontsReady=document.fonts&&document.fonts.ready?document.fonts.ready.catch(()=>{}):Promise.resolve();
  const frames=new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  Promise.race([Promise.all([fontsReady,frames]),new Promise(r=>setTimeout(r,4000))]).then(()=>b.finish(reveal));
}
runIntro(()=>{
  setTimeout(()=>{ introDone=true; maybePayday(); setTimeout(()=>{ if(!document.getElementById('payday')||getComputedStyle($('payday')).display==='none') backupNudge(); },2500); },900);
  if(ANIM) G.from('#nav',{y:120,opacity:0,duration:.9,delay:.2,ease:'elastic.out(1,.7)',clearProps:'transform,opacity'});
  if(state.active) showActive(true); else showIdle(true);
  if(inSetup()) setTimeout(()=>goPage('settings'),ANIM?500:0);
});

setInterval(tick,1000);
setTimeout(()=>{ creditJars(); checkBadges(); },2500);
setInterval(()=>{ creditJars(); checkBadges(); },60000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) tick(); });
