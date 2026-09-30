/* Home Time: classes, NUS picker */
/* ================= class nights =================
   Your class schedule, per semester. On class days the Today page shows when to leave for class. */
// NUS instructional weeks (from the NUS Registrar's academic calendars). Week 7 starts the Monday after recess.
const NUS_TERMS={'2026-2027':{1:['2026-08-10','2026-11-13'],2:['2027-01-11','2027-04-16']},'2027-2028':{1:['2027-08-09','2027-11-12'],2:['2028-01-10','2028-04-14']}};
const DOWS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function CL(){ if(!state.classes) state.classes={school:'',travel:45,remind:true,terms:[]}; if(!state.classes.terms) state.classes.terms=[]; return state.classes; }
const isoTs=iso=>new Date(iso+'T12:00:00').getTime();
function mondayIso(ts){ const d=new Date(ts); d.setHours(12,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return isoDate(d.getTime()); }
function nusWeek(start,ts){ const w=Math.floor((dayStart(ts)-dayStart(isoTs(start)))/(7*DAY)); if(w<0) return 0; if(w<6) return w+1; if(w===6) return 0; return w<=13?w:0; }
function classesOn(ts){
  const c=state.classes; if(!c||!c.terms) return [];
  const iso=isoDate(ts), dow=new Date(ts).getDay(), out=[];
  c.terms.forEach(t=>{ if(iso<t.start||iso>t.end) return;
    t.sessions.forEach(s=>{
      if(s.date){ if(s.date===iso) out.push(s); return; }
      if(s.dow!==dow) return;
      if(t.nus){ const wk=nusWeek(t.start,ts); if(!wk||(s.weeks&&!s.weeks.includes(wk))) return; }
      else if((t.skip||[]).includes(mondayIso(ts))) return;
      if(PH&&PH[iso]&&t.nus) return; // no NUS classes on public holidays
      out.push(s); }); });
  return out.sort((a,b)=>a.start<b.start?-1:1);
}
function schoolSummary(){ const c=state.classes; if(!c||!c.terms.length) return 'Not set up';
  const now=isoDate(Date.now()), cur=c.terms.filter(t=>t.end>=now), n=cur.reduce((a,t)=>a+sessGroups(t.sessions).length,0);
  return n?`${c.school?c.school+' · ':''}${n} class${n===1?'':'es'} this term`:`${c.school?c.school+' · ':''}no upcoming classes`; }

/* settings panel */
function renderSchool(){
  const c=CL(), box=$('schoolBody'), now=isoDate(Date.now());
  const terms=[...c.terms].sort((a,b)=>a.start<b.start?1:-1);
  const ic=(g,svg)=>`<span class="stIc" style="background:${g}">${svg}</span>`;
  const I={link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>',
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
    pen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>'};
  const nus=c.school==='NUS';
  const add=[
    ['pick','Pick NUS modules','Search and tap your slots, right here','linear-gradient(135deg,#FFB86B,#FF7A45 50%,#E0531F)','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>'],
    ['nus','Paste NUSMods link','If you already made it on NUSMods','linear-gradient(135deg,#FFD2A6,#FFA45C 50%,#E07A2F)',I.link],
    ['scan','Scan timetable','Screenshot, photo or PDF','linear-gradient(135deg,#9BE3FF,#3FB8FF 50%,#3345C9)',I.cam],
    ['ics','Calendar file','.ics from your school or calendar app','linear-gradient(135deg,#A8FFE0,#19D9A0 50%,#0FA37A)',I.cal],
    ['manual','Add by hand','Pick the day and time','linear-gradient(135deg,#D9CCFF,#9E8CF0 55%,#6B5BD6)',I.pen]];
  if(!nus){ const n2=add.splice(0,2); if(!c.school) add.push(...n2); } // NUS options only for NUS (or if no school chosen yet)
  box.innerHTML=`
  <div class="card">
    <label class="lab full">Your school<select class="fld" id="clSchool">${['','NUS','NTU','SMU','SUSS','SIT','SUTD','Polytechnic','ITE','Other'].map(v=>`<option value="${v}"${c.school===v?' selected':''}>${v||'Choose…'}</option>`).join('')}</select></label>
    <label class="lab full">Travel from work to class (min)<input type="number" class="fld" id="clTravel" inputmode="numeric" min="0" max="240" step="5" value="${c.travel}"></label>
    <label class="toggle"><span>Show class times on Today</span><span class="switch"><input type="checkbox" id="clRemind" ${c.remind?'checked':''} aria-label="Show class times on Today"><span></span></span></label>
  </div>
  ${terms.map(t=>`<div class="card termCard"><div class="termHead"><b>${esc(t.name)}</b><small>${new Date(isoTs(t.start)).toLocaleDateString(undefined,{day:'numeric',month:'short'})} – ${new Date(isoTs(t.end)).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}${t.end<now?' · ended':''}</small></div>
    ${sessGroups(t.sessions).map(g=>{ const s=g.s, ds=g.dates, dsh=iso=>new Date(isoTs(iso)).toLocaleDateString(undefined,{day:'numeric',month:'short'});
      return `<div class="clsRow"><b>${esc(s.name)}</b><small>${ds?(ds.length>1?`${DOWS[new Date(isoTs(ds[0])).getDay()]} · ${ds.length} dates, ${dsh(ds[0])} – ${dsh(ds[ds.length-1])}`:new Date(isoTs(ds[0])).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})):DOWS[s.dow]+(s.weeks&&s.weeks.length<13?` · week${s.weeks.length>1?'s':''} ${weeksTxt(s.weeks)}`:'')} · ${fmtHM(s.start)} – ${fmtHM(s.end)}${s.venue?' · '+esc(s.venue):''}</small><button type="button" aria-label="Remove" data-t="${t.id}" data-i="${g.idx.join(',')}">✕</button></div>`; }).join('')}
    <div class="termBtns">${t.picks?`<button class="rmTerm edit" type="button" data-ed="${t.id}">Change classes</button>`:''}<button class="rmTerm" type="button" data-rm="${t.id}">Remove this semester</button></div></div>`).join('')}
  <div class="card"><p class="cardT">Add classes</p><div class="addGrid">${add.map((a,i)=>`<button type="button" class="addBtn${i===0?' main':''}" data-add="${a[0]}">${ic(a[3],a[4])}<span>${a[1]}<small style="display:block">${a[2]}</small></span></button>`).join('')}</div></div>
  <input type="file" id="icsFile" accept=".ics,text/calendar" hidden>`;
  $('clSchool').onchange=e=>{ c.school=e.target.value; save(); renderSchool(); setSummaries(); };
  $('clTravel').oninput=e=>{ c.travel=Math.max(0,+e.target.value||0); save(); updateClassPill(); };
  $('clRemind').onchange=e=>{ c.remind=e.target.checked; save(); updateClassPill(); };
  box.querySelectorAll('.clsRow button').forEach(b=>b.onclick=()=>{ const t=c.terms.find(x=>x.id===b.dataset.t), rm=new Set(b.dataset.i.split(',').map(Number)); t.sessions=t.sessions.filter((x,i)=>!rm.has(i)); if(!t.sessions.length) c.terms=c.terms.filter(x=>x!==t); save(); renderSchool(); setSummaries(); updateClassPill(); });
  box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ if(!b.classList.contains('armed')){ b.classList.add('armed'); b.textContent='Tap again to remove'; setTimeout(()=>{ if(b.isConnected){ b.classList.remove('armed'); b.textContent='Remove this semester'; } },3000); return; }
    c.terms=c.terms.filter(x=>x.id!==b.dataset.rm); save(); renderSchool(); setSummaries(); updateClassPill(); });
  box.querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>openPick(c.terms.find(t=>t.id===b.dataset.ed)));
  box.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{ const k=b.dataset.add; if(k==='pick'){ openPick(); return; }
    if(k==='nus') openTT('nus'); else if(k==='manual') openTT('manual'); else if(k==='ics') $('icsFile').click(); else openScan('tt',(list)=>openTT('review',list,'Scanned timetable')); });
  $('icsFile').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f) icsImport(await f.text()); };
}
function sessGroups(list){ const out=[], by={};
  list.forEach((s,i)=>{ if(!s.date){ out.push({s,idx:[i]}); return; } const k=[s.name,s.start,s.end,new Date(isoTs(s.date)).getDay()].join('|'); if(!by[k]){ by[k]={s,idx:[],dates:[]}; out.push(by[k]); } by[k].idx.push(i); by[k].dates.push(s.date); });
  out.forEach(g=>g.dates&&g.dates.sort()); return out; }
function weeksTxt(w){ const r=[]; let a=w[0],p=w[0]; for(let i=1;i<=w.length;i++){ if(w[i]===p+1){ p=w[i]; continue; } r.push(a===p?a:a+'–'+p); a=p=w[i]; } return r.join(', '); }

/* the add / review sheet */
let tt={mode:'',list:[],name:'',nus:null};
function openTT(mode,list=[],name=''){
  tt={mode,list:list.map(x=>Object.assign({on:true},x)),name,nus:null};
  $('ttNus').hidden=mode!=='nus'; $('ttManual').hidden=mode!=='manual';
  $('ttTitle').textContent=mode==='nus'?'Classes from NUSMods':mode==='manual'?'Add a class':'Check your classes';
  $('ttHint').textContent=mode==='nus'?'Paste the share link to your NUSMods timetable. The app gets the exact times from NUSMods.':mode==='manual'?'Add each class, then save.':'Untick anything that isn’t a class.';
  if(mode==='nus'){ $('nmLink').value=''; fillNusTerms(); }
  if(mode==='manual'){ $('mnName').value=''; $('mnOnce').checked=false; setDow(1); $('mnDate').value=isoDate(Date.now()); syncOnce(); }
  const today=isoDate(Date.now()), d13=isoDate(Date.now()+13*7*DAY), nt=nusTermNow();
  $('ttFrom').value=nt&&CL().school==='NUS'?nt.s:today; $('ttTo').value=nt&&CL().school==='NUS'?nt.e:d13; $('ttSkip').value='';
  renderTTList(); openSheet('ttSheet');
}
function nusTermNow(){ const now=isoDate(Date.now()); for(const [ay,o] of Object.entries(NUS_TERMS)) for(const [sem,[s,e]] of Object.entries(o)) if(e>=now) return {ay,sem:+sem,s,e}; return null; }
function fillNusTerms(sem){ const now=isoDate(Date.now()), opts=[];
  Object.entries(NUS_TERMS).forEach(([ay,o])=>Object.entries(o).forEach(([sm,[s,e]])=>{ if(e>=now) opts.push({v:ay+'|'+sm,t:`AY${ay.slice(2,4)}/${ay.slice(7)} Semester ${sm}`,sm:+sm}); }));
  $('nmTerm').innerHTML=opts.map(o=>`<option value="${o.v}">${o.t}</option>`).join('');
  if(sem){ const o=opts.find(o=>o.sm===sem); if(o) $('nmTerm').value=o.v; } }
$('nmLink').addEventListener('input',()=>{ const m=$('nmLink').value.match(/sem-(\d)/); if(m) fillNusTerms(+m[1]); });
function setDow(v){ tt.dow=+v; document.querySelectorAll('#mnDow button').forEach(b=>b.setAttribute('aria-checked',String(+b.dataset.v===tt.dow))); }
document.querySelectorAll('#mnDow button').forEach(b=>b.onclick=()=>setDow(b.dataset.v));
function syncOnce(){ const o=$('mnOnce').checked; $('mnDow').hidden=o; $('mnDateWrap').hidden=!o; }
$('mnOnce').onchange=syncOnce;
$('mnAdd').onclick=()=>{ const n=$('mnName').value.trim()||'Class', s=$('mnStart').value, e=$('mnEnd').value;
  if(!s||!e||e<=s){ shake('#mnEnd'); return; }
  tt.list.push({name:n,dow:$('mnOnce').checked?null:tt.dow,date:$('mnOnce').checked?$('mnDate').value:null,start:s,end:e,on:true});
  $('mnName').value=''; renderTTList(); Sound.stack&&Sound.stack(); };
function ttGroups(){ const G2=[], by={};
  tt.list.forEach((c,i)=>{ if(!c.date){ G2.push({idx:[i],c}); return; } const k=[c.name,c.start,c.end,new Date(isoTs(c.date)).getDay()].join('|'); if(!by[k]){ by[k]={idx:[],c,dates:[]}; G2.push(by[k]); } by[k].idx.push(i); by[k].dates.push(c.date); });
  return G2; }
function renderTTList(){
  const L=tt.list, box=$('ttList'); box.hidden=!L.length;
  $('ttDates').hidden=!L.some(x=>x.on&&x.date==null)||!!tt.nus;
  const gs=ttGroups(), dshort=iso=>new Date(isoTs(iso)).toLocaleDateString(undefined,{day:'numeric',month:'short'});
  box.innerHTML=gs.map((g,gi)=>{ const c=g.c, on=g.idx.some(i=>L[i].on);
    const when=g.dates?(g.dates.length>1?`${DOWS[new Date(isoTs(g.dates[0])).getDay()]} · ${g.dates.length} dates, ${dshort(g.dates[0])} – ${dshort(g.dates[g.dates.length-1])}`:new Date(isoTs(g.dates[0])).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}))
      :DOWS[c.dow]+(c.weeks&&c.weeks.length<13?` · week${c.weeks.length>1?'s':''} ${weeksTxt(c.weeks)}`:', weekly');
    return `<label class="ttRow"><input type="checkbox" data-g="${gi}" ${on?'checked':''}><b>${esc(c.name)}</b><small>${when} · ${fmtHM(c.start)} – ${fmtHM(c.end)}${c.venue?' · '+esc(c.venue):''}</small></label>`; }).join('');
  box.querySelectorAll('input').forEach(b=>b.onchange=()=>{ gs[+b.dataset.g].idx.forEach(i=>L[i].on=b.checked); renderTTList(); });
  const n=gs.filter(g=>g.idx.some(i=>L[i].on)).length; $('ttSave').disabled=!n; $('ttSave').textContent=n?`Save ${n} class${n===1?'':'es'}`:'Save classes';
  $('ttNote').hidden=!tt.nus; if(tt.nus) $('ttNote').textContent=`${tt.nus.label}: ${dshort(tt.nus.s)} – ${dshort(tt.nus.e)}. Recess week and public holidays are skipped.`;
  $('ttSave').hidden=tt.mode==='nus'&&!L.length;
}
$('ttCancel').onclick=closeSheet;
$('ttSave').onclick=()=>{
  const list=tt.list.filter(x=>x.on); if(!list.length) return;
  const c=CL(); let start,end,name=tt.name||'Classes',skip=[],nus=false;
  if(tt.nus){ start=tt.nus.s; end=tt.nus.e; name=tt.nus.label; nus=true; }
  else { const ds=list.filter(x=>x.date).map(x=>x.date).sort(); const wk=list.some(x=>x.date==null);
    start=wk?$('ttFrom').value:ds[0]; end=wk?$('ttTo').value:ds[ds.length-1];
    if(wk&&ds.length){ if(ds[0]<start) start=ds[0]; if(ds[ds.length-1]>end) end=ds[ds.length-1]; }
    if(!start||!end||end<start){ $('ttHint').textContent='Check the start and end dates.'; $('ttHint').style.color='var(--coral)'; shake('#ttTo'); return; }
    if($('ttSkip').value) skip=[mondayIso(isoTs($('ttSkip').value))];
    if(tt.mode==='manual') name=`Classes from ${new Date(isoTs(start)).toLocaleDateString(undefined,{month:'short',year:'numeric'})}`; }
  c.terms.push({id:'c'+Date.now().toString(36),name,start,end,skip,nus,sessions:list.map(({on,...s})=>s)});
  save(); closeSheet(); if(setCat==='school') renderSchool(); setSummaries(); updateClassPill();
  toast(`Saved ${list.length} class${list.length===1?'':'es'} ✓`,false);
};

/* NUSMods share link → exact lessons from the NUSMods data */
const LT={DLEC:'Design Lecture',LAB:'Laboratory',LEC:'Lecture',PLAB:'Packaged Laboratory',PLEC:'Packaged Lecture',PTUT:'Packaged Tutorial',REC:'Recitation',SEC:'Sectional Teaching',SEM:'Seminar-Style Module Class',TUT:'Tutorial',TUT2:'Tutorial Type 2',TUT3:'Tutorial Type 3',WS:'Workshop'};
const SHORT={Laboratory:'Lab',Lecture:'Lecture',Tutorial:'Tutorial',Recitation:'Recitation','Sectional Teaching':'Sectional','Seminar-Style Module Class':'Seminar',Workshop:'Workshop','Design Lecture':'Design Lecture','Packaged Lecture':'Lecture','Packaged Tutorial':'Tutorial','Packaged Laboratory':'Lab','Tutorial Type 2':'Tutorial','Tutorial Type 3':'Tutorial'};
const FULLDAY={MON:1,TUE:2,WED:3,THU:4,FRI:5,SAT:6,SUN:0};
function parseNusLink(link){
  let u; try{ u=new URL(link.trim().replace(/^(?!https?:)/,'https://')); }catch(e){ return null; }
  if(!/nusmods\.com$/.test(u.hostname)) return null;
  const sm=(u.pathname.match(/sem-(\d)/)||[])[1], hidden=(u.searchParams.get('hidden')||'').split(',').filter(Boolean), mods=[];
  u.searchParams.forEach((v,k)=>{ if(k==='hidden'||k==='ta'||!/^[A-Z]{2,4}\d{3,4}[A-Z]{0,2}$/i.test(k)||hidden.includes(k)) return;
    const parts=v.includes(';')||/\)$/.test(v)?v.split(';'):v.split(',');
    const picks=parts.map(p=>{ const [ab,rest]=p.split(':'); if(!rest) return null; const ids=rest.replace(/^\(|\)$/g,'');
      return {type:LT[ab],ids:ids.split(','),v2:/^\(/.test(rest)}; }).filter(x=>x&&x.type);
    mods.push({code:k.toUpperCase(),picks}); });
  return {sem:sm?+sm:null,mods};
}
$('nmGo').onclick=async()=>{
  const p=parseNusLink($('nmLink').value); if(!p||!p.mods.length){ $('ttHint').textContent='That doesn’t look like a NUSMods timetable link. It should start with nusmods.com/timetable/…'; $('ttHint').style.color='var(--coral)'; shake('#nmLink'); return; }
  const [ay,sem]=$('nmTerm').value.split('|'), T=NUS_TERMS[ay][sem];
  $('nmGo').disabled=true; $('nmGo').textContent='Getting your classes…'; $('ttHint').style.color='';
  const list=[], miss=[];
  await Promise.all(p.mods.map(async m=>{
    try{ const r=await fetch(`https://api.nusmods.com/v2/${ay}/modules/${m.code}.json`); if(!r.ok) throw 0; const d=await r.json();
      const semD=(d.semesterData||[]).find(x=>x.semester===+sem); if(!semD){ miss.push(m.code); return; }
      const tt0=semD.timetable||[];
      m.picks.forEach(pk=>{ pk.ids.forEach(id=>{
        let lessons;
        if(/\|/.test(id)){ const [cls,dy,st,en,venue,...wk]=id.split('|'); lessons=[{classNo:cls,day:dy,startTime:st,endTime:en,venue,weeks:wk.join('_').split('_').map(Number).filter(Boolean),lessonType:pk.type}]; }
        else if(pk.v2&&/^\d+$/.test(id)) lessons=[tt0[+id]].filter(x=>x&&x.lessonType===pk.type);
        else lessons=tt0.filter(x=>x.lessonType===pk.type&&x.classNo===id);
        lessons.forEach(l=>{ const dow=typeof l.day==='string'?(FULLDAY[l.day.slice(0,3).toUpperCase()]):null; if(dow==null) return;
          const wk=Array.isArray(l.weeks)?l.weeks:null;
          list.push({name:`${m.code} ${SHORT[l.lessonType]||l.lessonType}`,dow,start:`${l.startTime.slice(0,2)}:${l.startTime.slice(2)}`,end:`${l.endTime.slice(0,2)}:${l.endTime.slice(2)}`,weeks:wk,venue:l.venue||'',on:true}); }); }); });
    }catch(e){ miss.push(m.code); } }));
  $('nmGo').disabled=false; $('nmGo').textContent='Get my classes';
  if(!list.length){ $('ttHint').textContent=miss.length?`Couldn’t get ${miss.join(', ')} from NUSMods. Check your internet, and that the semester is right.`:'No classes found in that link.'; $('ttHint').style.color='var(--coral)'; return; }
  list.sort((a,b)=>a.dow-b.dow||(a.start<b.start?-1:1));
  tt.list=list; tt.nus={s:T[0],e:T[1],label:`AY${ay.slice(2,4)}/${ay.slice(7)} Sem ${sem}`};
  $('ttHint').textContent=miss.length?`Got everything except ${miss.join(', ')}. Add ${miss.length>1?'those':'that one'} by hand if needed.`:'Here’s what NUSMods has for you.';
  renderTTList(); Sound.stack&&Sound.stack();
};

/* calendar files (.ics): every event becomes a dated class */
function icsImport(txt){
  const lines=txt.replace(/\r\n[ \t]/g,'').replace(/\n[ \t]/g,'').split(/\r?\n/), evs=[]; let ev=null;
  const dt=v=>{ const m=(v||'').match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if(!m) return null;
    return m[7]?new Date(Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5])):new Date(+m[1],m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)); };
  lines.forEach(l=>{ if(l==='BEGIN:VEVENT') ev={ex:[]}; else if(l==='END:VEVENT'){ if(ev) evs.push(ev); ev=null; } else if(ev){ const i=l.indexOf(':'); if(i<0) return; const k=l.slice(0,i).split(';')[0], v=l.slice(i+1);
    if(k==='DTSTART') ev.s=dt(v); else if(k==='DTEND') ev.e=dt(v); else if(k==='SUMMARY') ev.name=v.replace(/\\,/g,',').replace(/\\n/g,' ').trim(); else if(k==='LOCATION') ev.venue=v.replace(/\\,/g,',').trim(); else if(k==='RRULE') ev.rr=v; else if(k==='EXDATE') v.split(',').forEach(x=>{ const d=dt(x); d&&ev.ex.push(isoDate(d.getTime())); }); } });
  const from=Date.now()-7*DAY, to=Date.now()+400*DAY, list=[];
  evs.forEach(e=>{ if(!e.s||!e.e) return; const dur=e.e-e.s; if(dur<15*60000||dur>8*3600000) return;
    const push=d=>{ const iso=isoDate(d.getTime()); if(d.getTime()<from||d.getTime()>to||e.ex.includes(iso)) return; list.push({name:(e.name||'Class').slice(0,40),date:iso,start:`${pad(d.getHours())}:${pad(d.getMinutes())}`,end:`${pad(new Date(d.getTime()+dur).getHours())}:${pad(new Date(d.getTime()+dur).getMinutes())}`,venue:e.venue||''}); };
    if(e.rr){ const R={}; e.rr.split(';').forEach(p=>{ const [k,v]=p.split('='); R[k]=v; }); const until=R.UNTIL?dt(R.UNTIL):null, cnt=+R.COUNT||0, iv=+R.INTERVAL||1;
      const step=R.FREQ==='DAILY'?DAY:R.FREQ==='WEEKLY'?7*DAY:0;
      if(!step){ push(e.s); return; }
      const byday=R.FREQ==='WEEKLY'&&R.BYDAY?R.BYDAY.split(',').map(x=>({SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6}[x.slice(-2)])):[e.s.getDay()];
      let n=0; for(let w=0;w<120;w++){ const base=new Date(e.s.getTime()+w*step*iv);
        for(const bd of (R.FREQ==='WEEKLY'?byday:[base.getDay()])){ const d=new Date(base); d.setDate(d.getDate()+((bd-base.getDay()+7)%7)); if(d<e.s) continue; if(until&&d>until) { w=999; break; } if(cnt&&n>=cnt){ w=999; break; } n++; push(d); } } }
    else push(e.s); });
  if(!list.length){ toast('No upcoming classes in that calendar file.',false); return; }
  list.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.start<b.start?-1:1);
  // many dates of the same class become one line per class in the list
  openTT('review',list.slice(0,400),'Calendar classes');
}

/* Today: when to leave for class */
function updateClassPill(){
  const c=state.classes, el=$('clsPill'), el2=$('clsPillIdle'); if(!el) return;
  const today=c&&c.remind?classesOn(Date.now()).filter(s=>toMin(s.start)>=12*60):[];
  if(!today.length){ el.hidden=true; el2.hidden=true; return; }
  const s=today[0], d=new Date(); d.setHours(0,0,0,0);
  const classAt=d.getTime()+toMin(s.start)*60000, leaveBy=classAt-(c.travel||0)*60000;
  const nm=(s.name.match(/^[A-Z]{2,4}\d{3,4}[A-Z]{0,2}\b/)||[s.name.length>14?s.name.slice(0,13)+'…':s.name])[0];
  el2.hidden=Date.now()>classAt; el2.textContent=`🎓 ${nm} at ${fmt(classAt)} tonight`;
  if(!state.active||Date.now()>classAt){ el.hidden=true; return; }
  const leave=state.active.in+SHIFT(), late=leave>leaveBy;
  el.hidden=false; el.classList.toggle('late',late);
  el.textContent=late?`🎓 ${nm} ${fmt(classAt)}: leave by ${fmt(leaveBy)}, ${dur(leave-leaveBy)} before your day ends`:`🎓 ${nm} ${fmt(classAt)} · leave by ${fmt(leaveBy)}`;
}

$('slScan').onclick=()=>openScan('slip',slipFromScan);
{ const _upp=updatePayPills; updatePayPills=function(){ _upp.apply(this,arguments); try{ updateClassPill(); }catch(e){} }; }
addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('scan').hidden) closeScan(); });

/* ================= NUS class picker =================
   Pick your modules and lesson slots right here, using the NUSMods data feed.
   It knows your work hours, so it warns you about slots you can't make after work. */
const NM={list:{},mods:{}};
async function nmList(ay){ if(NM.list[ay]) return NM.list[ay]; const r=await fetch(`https://api.nusmods.com/v2/${ay}/moduleList.json`); if(!r.ok) throw new Error('net'); return NM.list[ay]=await r.json(); }
async function nmMod(ay,code){ const k=ay+'/'+code; if(NM.mods[k]) return NM.mods[k]; const r=await fetch(`https://api.nusmods.com/v2/${ay}/modules/${code}.json`); if(!r.ok) throw new Error(r.status===404?'404':'net'); return NM.mods[k]=await r.json(); }
const MCOL=['#7B5CFF','#3FB8FF','#19D9A0','#FFB020','#FF6FB1','#0FA37A','#E0531F','#6C8BFF'];
const fmtM=m=>fmtHM(`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`);
const hm4=t=>`${t.slice(0,2)}:${t.slice(2)}`;
let pk=null;
function openPick(term){
  const nt=nusTermNow(); let ay=nt?nt.ay:'2026-2027', sem=nt?nt.sem:1;
  if(term&&term.ay){ ay=term.ay; sem=term.sem; }
  pk={ay,sem,mods:[],editing:term?term.id:null};
  const now=isoDate(Date.now()), opts=[];
  Object.entries(NUS_TERMS).forEach(([a,o])=>Object.entries(o).forEach(([sm,[s,e]])=>{ if(e>=now||(term&&a===ay&&+sm===sem)) opts.push({v:a+'|'+sm,t:`AY${a.slice(2,4)}/${a.slice(7)} Semester ${sm} · from ${new Date(isoTs(s)).toLocaleDateString(undefined,{day:'numeric',month:'short'})}`}); }));
  $('pkTerm').innerHTML=opts.map(o=>`<option value="${o.v}">${o.t}</option>`).join(''); $('pkTerm').value=ay+'|'+sem;
  $('pkQ').value=''; $('pkRes').hidden=true; $('pkMsg').textContent='Add each module, then tap the class you’re in for each lesson.'; $('pkMsg').style.color='';
  const el=$('pick'); el.hidden=false; el.scrollTop=0; if(!openId) lockScroll(true);
  if(ANIM) G.fromTo(el,{opacity:0,y:30},{opacity:1,y:0,duration:.4,ease:'power3.out',clearProps:'transform,opacity'});
  renderPick();
  if(term&&term.picks) term.picks.forEach(p=>addMod(p.code,p.pick,true));
  nmList(ay).catch(()=>{});
}
function closePick(){ const el=$('pick'); if(el.hidden) return; const done=()=>{ el.hidden=true; if(!openId) lockScroll(false); };
  if(ANIM) G.to(el,{opacity:0,y:30,duration:.25,ease:'power2.in',onComplete:()=>{ done(); G.set(el,{clearProps:'all'}); }}); else done(); }
$('pkClose').onclick=closePick; $('pkCancel').onclick=closePick;
$('pkTerm').onchange=()=>{ const [ay,sem]=$('pkTerm').value.split('|'); const keep=pk.mods.map(m=>m.code); pk.ay=ay; pk.sem=+sem; pk.mods=[]; renderPick(); keep.forEach(c=>addMod(c,null,true)); nmList(ay).catch(()=>{}); };

/* search */
let pkT=null;
$('pkQ').addEventListener('input',()=>{ clearTimeout(pkT); pkT=setTimeout(pkSearch,120); });
$('pkQ').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const b=$('pkRes').querySelector('button'); b&&b.click(); } });
document.addEventListener('pointerdown',e=>{ if(!$('pkRes').hidden&&!e.target.closest('.pkSearch')) $('pkRes').hidden=true; },true);
$('pkQ').addEventListener('focus',()=>{ if($('pkQ').value.trim()) pkSearch(); });
async function pkSearch(){
  const q=$('pkQ').value.trim(), box=$('pkRes'); if(q.length<2){ box.hidden=true; return; }
  const Q=q.toUpperCase().replace(/\s+/g,''), words=q.toLowerCase().split(/\s+/).filter(Boolean);
  let list=null; try{ list=await nmList(pk.ay); }catch(e){}
  if(q!==$('pkQ').value.trim()) return;
  let hits=[];
  if(list){ const inSem=m=>!m.semesters||m.semesters.includes(pk.sem);
    const byCode=list.filter(m=>m.moduleCode.startsWith(Q)), byTitle=list.filter(m=>!m.moduleCode.startsWith(Q)&&words.every(w=>m.title.toLowerCase().includes(w)));
    hits=byCode.concat(byTitle).filter(inSem).slice(0,8); }
  const have=new Set(pk.mods.map(m=>m.code));
  if(!list&&/^[A-Z]{2,4}\d{3,4}[A-Z]{0,2}$/.test(Q)) hits=[{moduleCode:Q,title:'Add by code'}];
  box.innerHTML=hits.length?hits.map(m=>`<button type="button" data-c="${esc(m.moduleCode)}"${have.has(m.moduleCode)?' disabled style="opacity:.45"':''}><b>${esc(m.moduleCode)}</b><small>${esc(m.title)}${have.has(m.moduleCode)?' · added':''}</small></button>`).join('')
    :`<div class="hint">${list?`No Semester ${pk.sem} module matches “${esc(q)}”.`:'Can’t reach NUSMods right now. Type the full module code to try it directly.'}</div>`;
  box.hidden=false;
  box.querySelectorAll('button[data-c]').forEach(b=>b.onclick=()=>{ box.hidden=true; $('pkQ').value=''; $('pkQ').blur(); addMod(b.dataset.c); });
}
async function addMod(code,pick,quiet){
  if(pk.mods.some(m=>m.code===code)) return;
  const m={code,title:'Loading…',types:[],pick:Object.assign({},pick||{}),col:MCOL[pk.mods.length%MCOL.length],loading:true};
  pk.mods.push(m); renderPick();
  try{ const d=await nmMod(pk.ay,code); m.title=d.title||'';
    const sd=(d.semesterData||[]).find(x=>x.semester===pk.sem);
    if(!sd||!(sd.timetable||[]).length){ m.err=`Not offered in Semester ${pk.sem}, or has no fixed class times.`; }
    else { const by={};
      sd.timetable.forEach(l=>{ const t=l.lessonType; (by[t]=by[t]||{}); (by[t][l.classNo]=by[t][l.classNo]||[]).push(l); });
      const ORDER=['Lecture','Packaged Lecture','Design Lecture','Sectional Teaching','Seminar-Style Module Class','Tutorial','Packaged Tutorial','Tutorial Type 2','Tutorial Type 3','Recitation','Laboratory','Packaged Laboratory','Workshop'];
      m.types=Object.keys(by).sort((a,b)=>(ORDER.indexOf(a)+99)%99-(ORDER.indexOf(b)+99)%99).map(t=>({type:t,opts:Object.entries(by[t]).map(([cls,ls])=>({cls,ls:ls.sort((a,b)=>dowOf(a.day)-dowOf(b.day)||(a.startTime<b.startTime?-1:1))}))
        .sort((a,b)=>dowOf(a.ls[0].day)-dowOf(b.ls[0].day)||(a.ls[0].startTime<b.ls[0].startTime?-1:1))}));
      m.types.forEach(t=>{ if(t.opts.length===1) m.pick[t.type]=t.opts[0].cls; else if(m.pick[t.type]&&!t.opts.some(o=>o.cls===m.pick[t.type])) delete m.pick[t.type]; }); }
  }catch(e){ m.err=e.message==='404'?`${code} isn’t in NUSMods for this year.`:'Couldn’t reach NUSMods. Check your internet and try again.'; }
  m.loading=false; renderPick(); if(!quiet){ Sound.stack&&Sound.stack(); haptic(); }
}
const dowOf=d=>{ const k=String(d||'').slice(0,3).toUpperCase(); return ({MON:1,TUE:2,WED:3,THU:4,FRI:5,SAT:6,SUN:7})[k]||8; };

/* can you make it after work? */
function workFit(dow,startMin){
  const s=S(), days=+s.days||5; if(dow>days) return null; // weekend (or not a work day)
  const shift=shiftMin(s), travel=CL().travel||0, latestIn=startMin-travel-shift;
  const norm=toMin(s.start), earliest=s.flex?toMin(s.from):norm;
  if(latestIn>=norm) return null;
  if(latestIn>=earliest) return {lvl:'fit',txt:`clock in by ${fmtM(latestIn)}`};
  return {lvl:'bad',txt:`can’t make it after work (earliest ${fmtM(earliest+shift+travel)})`};
}
function weeksOverlap(a,b){ if(!Array.isArray(a)||!Array.isArray(b)) return true; return a.some(w=>b.includes(w)); }
function chosenLessons(){ const out=[]; pk.mods.forEach(m=>m.types.forEach(t=>{ const o=t.opts.find(o=>o.cls===m.pick[t.type]); if(o) o.ls.forEach(l=>out.push({m,t:t.type,l})); })); return out; }
function clashes(l,except){ const s=toMin(hm4(l.startTime)), e=toMin(hm4(l.endTime)), d=dowOf(l.day);
  return chosenLessons().some(x=>x.l!==l&&x.m!==except&&dowOf(x.l.day)===d&&toMin(hm4(x.l.startTime))<e&&toMin(hm4(x.l.endTime))>s&&weeksOverlap(x.l.weeks,l.weeks)); }
const SHORTT={Lecture:'Lecture','Packaged Lecture':'Lecture','Design Lecture':'Design Lecture','Sectional Teaching':'Sectional','Seminar-Style Module Class':'Seminar',Tutorial:'Tutorial','Packaged Tutorial':'Tutorial','Tutorial Type 2':'Tutorial 2','Tutorial Type 3':'Tutorial 3',Recitation:'Recitation',Laboratory:'Lab','Packaged Laboratory':'Lab',Workshop:'Workshop'};
function wkNote(w){ if(!Array.isArray(w)) return 'special dates'; if(w.length>=13) return ''; return `week${w.length>1?'s':''} ${weeksTxt(w)}`; }

function renderPick(){
  const box=$('pkMods');
  box.innerHTML=pk.mods.map((m,mi)=>`<div class="card pkMod" style="--mc:${m.col}">
    <div class="pkHead"><span class="pkDot"></span><div><b>${esc(m.code)}</b><small>${esc(m.err||m.title)}</small></div><button type="button" data-rm="${mi}" aria-label="Remove ${esc(m.code)}">✕</button></div>
    ${m.types.map((t,ti)=>`<div class="pkType"><p>${esc(SHORTT[t.type]||t.type)}${m.pick[t.type]?'':'<span class="need">pick one</span>'}</p><div class="pkOpts">
      ${t.opts.map(o=>{ const on=m.pick[t.type]===o.cls, l0=o.ls[0];
        const when=o.ls.map(l=>`${DOWS[dowOf(l.day)%7]} ${fmtM(toMin(hm4(l.startTime)))}–${fmtM(toMin(hm4(l.endTime)))}`).join(' + ');
        const fits=o.ls.map(l=>workFit(dowOf(l.day),toMin(hm4(l.startTime)))).filter(Boolean), worst=fits.find(f=>f.lvl==='bad')||fits[0];
        const clash=on&&o.ls.some(l=>clashes(l));
        const notes=[wkNote(l0.weeks),worst?`<span class="${worst.lvl}">${worst.lvl==='bad'?'⚠ ':''}${worst.txt}</span>`:'',clash?'<span class="bad">⚠ clashes with another class</span>':''].filter(Boolean).join(' · ');
        return `<button type="button" class="pkOpt${on?' on':''}${clash?' clash':''}" data-m="${mi}" data-t="${ti}" data-c="${esc(o.cls)}">${when}${notes?`<small>${notes}</small>`:''}</button>`; }).join('')}
    </div></div>`).join('')}
    ${m.loading?'<p class="note" style="margin:0">Getting class times…</p>':''}
  </div>`).join('');
  box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ pk.mods.splice(+b.dataset.rm,1); renderPick(); });
  box.querySelectorAll('.pkOpt').forEach(b=>b.onclick=()=>{ const m=pk.mods[+b.dataset.m], t=m.types[+b.dataset.t]; m.pick[t.type]=b.dataset.c; Sound.bubble(); haptic(); renderPick(); });
  renderWeek();
  const missing=pk.mods.reduce((n,m)=>n+m.types.filter(t=>!m.pick[t.type]).length,0), n=chosenLessons().length;
  $('pkSave').textContent=missing?`Pick ${missing} more`:n?`Save ${n} class${n===1?'':'es'}`:'Save classes';
  $('pkSave').disabled=!n;
}
function renderWeek(){
  const L=chosenLessons(), card=$('pkWeek'); card.hidden=!L.length; if(!L.length) return;
  const s=S(), days=[1,2,3,4,5].concat(L.some(x=>dowOf(x.l.day)===6)?[6]:[],L.some(x=>dowOf(x.l.day)===7)?[7]:[]);
  const workEnd=toMin(s.end), travel=CL().travel||0;
  let lo=Math.min(workEnd-60,...L.map(x=>toMin(hm4(x.l.startTime)))), hi=Math.max(workEnd+travel+60,...L.map(x=>toMin(hm4(x.l.endTime))));
  lo=Math.floor(lo/60)*60; hi=Math.ceil(hi/60)*60; const span=hi-lo, y=m=>(m-lo)/span*100;
  const wk=$('wk'); wk.style.gridTemplateColumns=`repeat(${days.length},1fr)`;
  wk.innerHTML=days.map(d=>{ const work=d<=(+s.days||5);
    const hrs=[]; for(let h=lo+60;h<hi;h+=60) hrs.push(`<div class="wkHr" style="top:${y(h)}%">${d===days[0]?fmtM(h).replace(':00',''):''}</div>`);
    const dl=L.filter(x=>dowOf(x.l.day)===d).map(x=>({x,a:toMin(hm4(x.l.startTime)),b:toMin(hm4(x.l.endTime))})).sort((p,q)=>p.a-q.a), lanes=[];
    dl.forEach(o=>{ let k=lanes.findIndex(e=>e<=o.a); if(k<0){ k=lanes.length; lanes.push(0); } lanes[k]=o.b; o.k=k; });
    dl.forEach(o=>{ o.n=Math.max(...dl.filter(p=>p.a<o.b&&p.b>o.a).map(p=>p.k))+1; });
    const blocks=dl.map(({x,a,b,k,n})=>{ const part=Array.isArray(x.l.weeks)&&x.l.weeks.length<13, cl=clashes(x.l);
      return `<div class="wkB${part?' part':''}${cl?' clash':''}" style="--mc:${x.m.col};top:${y(a)}%;height:${(b-a)/span*100}%;left:calc(${k/n*100}% + 2px);right:auto;width:calc(${100/n}% - 4px)">${esc(x.m.code.replace(/^[A-Z]+/,''))}<br>${esc((SHORTT[x.t]||x.t).slice(0,4))}</div>`; }).join('');
    return `<div class="wkCol"><span class="wkDay">${DOWS[d%7]}</span>${work?`<div class="wkWork" style="height:${Math.max(0,y(workEnd))}%"></div><div class="wkTravel" style="top:${Math.max(0,y(workEnd))}%;height:${travel/span*100}%"></div>`:''}${hrs.join('')}${blocks}</div>`; }).join('');
  $('wkLeg').innerHTML=`<span><i style="background:rgba(123,92,255,.35)"></i>Work till ${fmtM(workEnd)}</span><span><i style="background:rgba(255,176,32,.5)"></i>Travel ${travel} min</span>`+(L.some(x=>Array.isArray(x.l.weeks)&&x.l.weeks.length<13)?'<span><i style="background:transparent;border:1.5px dashed var(--muted)"></i>Some weeks only</span>':'');
}
$('pkSave').onclick=()=>{
  const missing=pk.mods.filter(m=>m.types.some(t=>!m.pick[t.type]));
  if(missing.length){ $('pkMsg').textContent=`Pick a slot for every lesson in ${missing.map(m=>m.code).join(', ')}.`; $('pkMsg').style.color='var(--coral)'; shake('#pkMods'); return; }
  const L=chosenLessons(); if(!L.length) return;
  const [s,e]=NUS_TERMS[pk.ay][pk.sem], label=`AY${pk.ay.slice(2,4)}/${pk.ay.slice(7)} Sem ${pk.sem}`;
  const sessions=L.map(x=>({name:`${x.m.code} ${SHORTT[x.t]||x.t}`,dow:dowOf(x.l.day)%7,start:hm4(x.l.startTime),end:hm4(x.l.endTime),weeks:Array.isArray(x.l.weeks)?x.l.weeks:null,venue:x.l.venue||''}));
  const c=CL();
  c.terms=c.terms.filter(t=>t.id!==pk.editing&&!(t.nus&&t.name===label));
  c.terms.push({id:'c'+Date.now().toString(36),name:label,start:s,end:e,skip:[],nus:true,ay:pk.ay,sem:pk.sem,picks:pk.mods.filter(m=>m.types.length).map(m=>({code:m.code,pick:m.pick})),sessions});
  if(!c.school) c.school='NUS';
  save(); closePick(); if(setCat==='school') renderSchool(); setSummaries(); updateClassPill();
  toast(`Saved ${sessions.length} class${sessions.length===1?'':'es'} for ${label} ✓`,false);
};
addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('pick').hidden) closePick(); });


