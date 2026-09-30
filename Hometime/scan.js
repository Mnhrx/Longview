/* Home Time: scanner for payslips and timetables */
/* ================= scanner: read a payslip or timetable from a picture, PDF or text =================
   Everything runs on the phone. Pictures go through text recognition (Tesseract), PDFs are read
   directly, pasted text is used as is. You tag what's what once; the layout is saved as a template
   so the next file that looks the same fills in by itself. */
const SC_LIB='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const SC_OPT={workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'};
const SC_PDF='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', SC_PDFW='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const loaded={};
function loadScript(src){ return loaded[src]||(loaded[src]=new Promise((res,rej)=>{ const e=document.createElement('script'); e.src=src; e.onload=res; e.onerror=()=>{ delete loaded[src]; e.remove(); rej(new Error('net')); }; document.head.appendChild(e); })); }
let ocrW=null, ocrProg=null;
function getOcr(){
  if(!ocrW) ocrW=loadScript(SC_LIB).then(()=>Tesseract.createWorker('eng',1,Object.assign({logger:m=>ocrProg&&ocrProg(m)},SC_OPT)))
    .then(async w=>{ await w.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1',user_defined_dpi:'300'}); return w; })
    .catch(e=>{ ocrW=null; throw e; });
  return ocrW;
}
const SLIP_ROLES=[
  {k:'gross',n:'Gross pay',c:'#FFB020'},{k:'ee',n:'Your CPF',c:'#19D9A0'},{k:'er',n:'Employer CPF',c:'#0FA37A',opt:1},
  {k:'shg',n:'Fund (MBMF etc.)',c:'#7B5CFF',opt:1},{k:'other',n:'Other deductions',c:'#FF4D6D',opt:1,multi:1},{k:'net',n:'Net pay',c:'#3FB8FF'}];
const TT_ROLES=[{k:'name',n:'Class',c:'#7B5CFF',multi:1},{k:'when',n:'Day or date',c:'#19D9A0',multi:1},{k:'time',n:'Time',c:'#3FB8FF',multi:1}];
let sc=null; // the current scan
const scShow=id=>['scPick','scRead','scTag'].forEach(x=>$(x).hidden=x!==id);
function openScan(kind,cb){
  sc={kind,cb,assign:{},zoom:1};
  $('scTitle').textContent=kind==='slip'?'Scan payslip':'Scan timetable';
  $('scLead').textContent=kind==='slip'?'A screenshot, photo or PDF of your payslip.':'A screenshot, photo, PDF or calendar file (.ics) of your timetable.';
  $('scPasteBox').hidden=true; $('scText').value=''; scShow('scPick');
  const el=$('scan'); el.hidden=false; el.scrollTop=0; if(!openId) lockScroll(true);
  if(ANIM) G.fromTo(el,{opacity:0,y:30},{opacity:1,y:0,duration:.4,ease:'power3.out',clearProps:'transform,opacity'});
}
function closeScan(){ const el=$('scan'); if(el.hidden) return; ocrProg=null;
  const done=()=>{ el.hidden=true; scShow('scPick'); if(!openId) lockScroll(false); };
  if(ANIM) G.to(el,{opacity:0,y:30,duration:.25,ease:'power2.in',onComplete:()=>{ done(); G.set(el,{clearProps:'all'}); }}); else done(); }
$('scClose').onclick=()=>{ if(!$('scTag').hidden&&sc&&sc.words){ scShow('scPick'); return; } closeScan(); };
$('scFileBtn').onclick=()=>$('scFile').click();
$('scPasteBtn').onclick=()=>{ $('scPasteBox').hidden=false; $('scText').focus(); };
$('scTextGo').onclick=()=>{ const t=$('scText').value.trim(); if(!t){ shake('#scText'); return; } fromText(t); };
$('scFile').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; if(f) readFile(f); };

// progress bar in the same liquid as everything else
const scLv={v:0}; let scRAF=null;
function scBarLoop(){ if($('scRead').hidden||!Liquid){ scRAF=null; return; } Liquid.draw($('scBar'),{mode:'h',items:[{level:scLv.v,pal:Liquid.ID.OA,bubbles:true}],T:8,pad:3,t:performance.now()/1000}); scRAF=requestAnimationFrame(scBarLoop); }
function scStatus(msg,sub,p){ $('scMsg').textContent=msg; if(sub!=null) $('scSub').textContent=sub; if(p!=null){ if(ANIM) G.to(scLv,{v:Math.max(.03,p),duration:.4,ease:'power2.out'}); else scLv.v=p; } }
function reading(){ scShow('scRead'); scLv.v=.03; if(!scRAF) scRAF=requestAnimationFrame(scBarLoop); }

async function readFile(f){
  const name=(f.name||'').toLowerCase();
  if(name.endsWith('.ics')||f.type==='text/calendar'){ if(sc.kind!=='tt'){ toast('That’s a calendar file. Use it under Settings → Classes.',false); return; } const txt=await f.text(); closeScan(); icsImport(txt); return; }
  if(f.type.startsWith('text/')||/\.(txt|csv)$/.test(name)){ fromText(await f.text()); return; }
  reading();
  try{
    if(f.type==='application/pdf'||name.endsWith('.pdf')){ await fromPdf(f); return; }
    scStatus('Opening the picture…','',.05);
    const cv=await imageCanvas(f); await ocrCanvas(cv);
  }catch(err){ console.warn(err); scShow('scPick'); toast(err&&err.message==='net'?'The reader needs internet the first time. Try again when you’re online.':'Couldn’t read that file. Try a clearer screenshot or a PDF.',false); }
}
async function imageCanvas(f){
  const url=URL.createObjectURL(f), img=new Image();
  await new Promise((r,j)=>{ img.onload=r; img.onerror=j; img.src=url; });
  const w=img.naturalWidth, h=img.naturalHeight, k=Math.min(Math.max(1,1800/w),4000/Math.max(w,h));
  const cv=document.createElement('canvas'); cv.width=Math.round(w*k); cv.height=Math.round(h*k);
  const c=cv.getContext('2d'); c.fillStyle='#fff'; c.fillRect(0,0,cv.width,cv.height); c.imageSmoothingQuality='high'; c.drawImage(img,0,0,cv.width,cv.height);
  URL.revokeObjectURL(url); return cv;
}
async function ocrCanvas(cv){
  const first=!localStorage.getItem('ht-ocr-ready');
  scStatus(first?'Downloading the text reader…':'Getting the reader ready…',first?'About 5 MB, only this once.':'',.08);
  ocrProg=m=>{ if(m.status==='recognizing text') scStatus('Reading your file…','',.25+.75*m.progress);
    else if(/loading|initializ/.test(m.status||'')) scStatus(first?'Downloading the text reader…':'Getting the reader ready…',null,.08+.17*(m.progress||0)); };
  const w=await getOcr(); try{ localStorage.setItem('ht-ocr-ready','1'); }catch(e){}
  const {data}=await w.recognize(cv,{},{blocks:true,text:true});
  const words=[]; (data.blocks||[]).forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>(l.words||[]).forEach(wd=>{ const t=(wd.text||'').trim(); if(t&&wd.confidence>15) words.push({t,x0:wd.bbox.x0,y0:wd.bbox.y0,x1:wd.bbox.x1,y1:wd.bbox.y1}); }))));
  ocrProg=null; gotWords(words,cv);
}
async function fromPdf(f){
  scStatus('Opening the PDF…','',.1);
  await loadScript(SC_PDF); pdfjsLib.GlobalWorkerOptions.workerSrc=SC_PDFW;
  const doc=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise, n=Math.min(3,doc.numPages), pages=[];
  let W=0,H=0;
  for(let i=1;i<=n;i++){ const pg=await doc.getPage(i), vp=pg.getViewport({scale:2}), cv=document.createElement('canvas'); cv.width=Math.round(vp.width); cv.height=Math.round(vp.height);
    await pg.render({canvasContext:cv.getContext('2d'),viewport:vp,background:'#fff'}).promise; const tc=await pg.getTextContent(); pages.push({cv,vp,tc,y:H}); W=Math.max(W,cv.width); H+=cv.height; scStatus('Opening the PDF…','',.1+.4*i/n); }
  const all=document.createElement('canvas'); all.width=W; all.height=H; const c=all.getContext('2d'); c.fillStyle='#fff'; c.fillRect(0,0,W,H);
  const words=[];
  pages.forEach(p=>{ c.drawImage(p.cv,0,p.y);
    p.tc.items.forEach(it=>{ const s=(it.str||''); if(!s.trim()) return; const tr=pdfjsLib.Util.transform(p.vp.transform,it.transform), fh=Math.hypot(tr[2],tr[3]), x=tr[4], yb=tr[5]+p.y, wTot=(it.width||0)*2||s.length*fh*.5;
      let off=0; s.split(/(\s+)/).forEach(part=>{ const pw=wTot*part.length/Math.max(1,s.length); if(part.trim()) words.push({t:part.trim(),x0:x+off,y0:yb-fh*.85,x1:x+off+pw,y1:yb+fh*.2}); off+=pw; }); }); });
  if(words.map(w=>w.t).join('').length<20){ await ocrCanvas(all); return; } // a scanned PDF: read the picture instead
  gotWords(words,all);
}
function fromText(txt){
  const lines=txt.replace(/\r/g,'').split('\n').slice(0,300), cw=13, lh=34, W=Math.max(400,Math.min(1600,Math.max(...lines.map(l=>l.length))*cw+40)), H=lines.length*lh+30;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const c=cv.getContext('2d'); c.fillStyle='#fff'; c.fillRect(0,0,W,H); c.fillStyle='#1B1240'; c.font='22px ui-monospace,Menlo,monospace';
  const words=[];
  lines.forEach((l,i)=>{ const y=20+i*lh; l=l.replace(/\t/g,'    '); c.fillText(l,20,y+22); const re=/\S+/g; let m; while((m=re.exec(l))) words.push({t:m[0],x0:20+m.index*cw,y0:y,x1:20+(m.index+m[0].length)*cw,y1:y+28}); });
  // measure the drawn text so boxes line up with it
  words.forEach(w=>{ const li=Math.round((w.y0-20)/lh), l=lines[li].replace(/\t/g,'    '), pre=l.slice(0,Math.round((w.x0-20)/cw)); const x=20+c.measureText(pre).width; w.x1=x+c.measureText(w.t).width; w.x0=x; });
  gotWords(words,cv);
}

/* ---------- layout: lines, numbers and the words that label them ---------- */
const normT=t=>String(t||'').toLowerCase().replace(/[^a-z]+/g,' ').trim();
function dice(a,b){ a=normT(a).replace(/ /g,''); b=normT(b).replace(/ /g,''); if(!a||!b) return 0; if(a===b) return 1; if(a.length<2||b.length<2) return 0;
  const bg=s=>{ const m=new Map(); for(let i=0;i<s.length-1;i++){ const g=s.substr(i,2); m.set(g,(m.get(g)||0)+1); } return m; };
  const A=bg(a),B=bg(b); let n=0; A.forEach((v,g)=>{ n+=Math.min(v,B.get(g)||0); }); return 2*n/(a.length+b.length-2); }
function moneyOf(t){ let s=String(t).replace(/[Ss]\$|\$|SGD/g,'').replace(/[Oo](?=[\d,.]*\d)/g,'0').trim(); const neg=/^\(.*\)$/.test(s)||/^-/.test(s); s=s.replace(/[()\-–]/g,'');
  if(!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(s)) return null; const v=parseFloat(s.replace(/,/g,'')); return isFinite(v)?{v,neg,dec:/\.\d{2}$/.test(s)}:null; }
function buildLines(words){
  const ws=words.map((w,i)=>Object.assign({i,cy:(w.y0+w.y1)/2,h:w.y1-w.y0},w)).sort((a,b)=>a.cy-b.cy), lines=[];
  ws.forEach(w=>{ let best=null,bo=0; for(let k=lines.length-1;k>=0&&k>=lines.length-4;k--){ const L=lines[k], ov=Math.min(L.y1,w.y1)-Math.max(L.y0,w.y0); const f=ov/Math.min(w.h,L.y1-L.y0); if(f>.45&&f>bo){ bo=f; best=L; } }
    if(best){ best.ws.push(w); best.y0=Math.min(best.y0,w.y0); best.y1=Math.max(best.y1,w.y1); } else lines.push({ws:[w],y0:w.y0,y1:w.y1}); });
  lines.forEach(L=>{ L.ws.sort((a,b)=>a.x0-b.x0); let off=0; L.map=[]; L.text=L.ws.map(w=>{ L.map.push([off,w.i]); off+=w.t.length+1; return w.t; }).join(' '); });
  return lines.sort((a,b)=>a.y0-b.y0);
}
// every number on the page, with the words just before it on the same line as its label
function numbersOf(words,lines,W,H){
  const out=[];
  lines.forEach((L,li)=>{ let lastLabel='', lastEnd=-1, col=0;
    L.ws.forEach((w,k)=>{ const m=moneyOf(w.t); if(!m) return;
      const lbl=L.ws.slice(lastEnd+1,k).filter(x=>!moneyOf(x.t)).map(x=>x.t).join(' ');
      if(normT(lbl)){ lastLabel=lbl; col=0; } else col++;
      out.push({i:w.i,v:m.v,dec:m.dec,label:lastLabel,col,li,xr:(w.x0+w.x1)/2/W,yr:(w.y0+w.y1)/2/H}); lastEnd=k; }); });
  return out;
}
function fingerprint(words){ const s=new Set(); words.forEach(w=>{ const t=normT(w.t); if(t.length>=3&&!/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)$/.test(t)) s.add(t); }); return [...s].slice(0,120); }
function bestTemplate(kind,fp){ let best=null,bs=0; const set=new Set(fp);
  Object.entries(state.templates||{}).forEach(([id,t])=>{ if(t.kind!==kind||!t.words||!t.words.length) return; const hit=t.words.filter(w=>set.has(w)).length/t.words.length; if(hit>bs){ bs=hit; best=Object.assign({id},t); } });
  return bs>=.55?best:null; }

function gotWords(words,cv){
  if(!words.length){ scShow('scPick'); toast('No text found. Try a sharper screenshot, or zoom in before taking it.',false); return; }
  const W=cv.width,H=cv.height, lines=buildLines(words);
  Object.assign(sc,{words,cv,W,H,lines,fp:fingerprint(words),assign:{}});
  sc.tpl=bestTemplate(sc.kind,sc.fp);
  if(sc.kind==='slip'){ sc.nums=numbersOf(words,lines,W,H); sc.assign=sc.tpl?applySlipTpl(sc.tpl):guessSlip(); sc.role=firstEmpty(); }
  else { sc.found=findClasses(sc); sc.role='name'; }
  scStatus('Done','',1);
  if(sc.kind==='slip'&&sc.tpl&&sc.assign.gross&&(sc.assign.net||sc.assign.ee)){ finishSlip(true); return; } // a known layout: straight back to the payslip
  showTag();
}

/* ---------- payslips ---------- */
const SLIP_RX={gross:/gross|total (earnings|wages|pay|income|salary)|total remuneration/,
  ee:/(employee|staff|emp ee|\bee\b|your).{0,14}cpf|cpf.{0,14}(employee|staff|\bee\b)|employee.{0,6}(share|contribution)/,
  er:/(employer|company|\ber\b).{0,14}cpf|cpf.{0,14}(employer|company|\ber\b)|employer.{0,6}(share|contribution)/,
  shg:/mbmf|mendaki|cdac|sinda|\becf\b|eurasian|self help|shg/,
  net:/\bnett? (pay|salary|wages|amount|income)|^nett?$|take home|amount (payable|paid|credited)|net pay/};
function guessSlip(){ const a={}, used=new Set();
  const pick=(k,test)=>{ const c=sc.nums.filter(n=>!used.has(n.i)&&test(normT(n.label))).sort((x,y)=>(y.dec-x.dec)||(x.col-y.col)||(x.yr-y.yr))[0]; if(c){ a[k]=[c.i]; used.add(c.i); } };
  pick('shg',l=>SLIP_RX.shg.test(l)); pick('er',l=>SLIP_RX.er.test(l)); pick('ee',l=>SLIP_RX.ee.test(l)&&!SLIP_RX.er.test(l));
  if(!a.ee) pick('ee',l=>/\bcpf\b/.test(l)&&!SLIP_RX.er.test(l));
  pick('gross',l=>SLIP_RX.gross.test(l)); pick('net',l=>SLIP_RX.net.test(l)&&!SLIP_RX.gross.test(l));
  return a; }
function applySlipTpl(t){ const a={}, used=new Set();
  const find=r=>{ let best=null,bs=.5; sc.nums.forEach(n=>{ if(used.has(n.i)) return; const d=dice(n.label,r.a); if(d<.5) return; const sc2=d+(n.col===r.col?.15:0)-Math.abs(n.xr-r.xr)*.35-Math.abs(n.yr-r.yr)*.15; if(sc2>bs){ bs=sc2; best=n; } }); return best; };
  Object.entries(t.roles||{}).forEach(([k,list])=>{ (Array.isArray(list)?list:[list]).forEach(r=>{ const n=find(r); if(n){ (a[k]=a[k]||[]).push(n.i); used.add(n.i); } }); });
  return a; }
const roleList=()=>sc.kind==='slip'?SLIP_ROLES:TT_ROLES;
function firstEmpty(){ const r=SLIP_ROLES.find(r=>!(sc.assign[r.k]||[]).length&&!r.opt)||SLIP_ROLES.find(r=>!(sc.assign[r.k]||[]).length); return r?r.k:'gross'; }
const wordOf=i=>sc.words[i];
function valOf(k){ const l=sc.assign[k]||[]; if(!l.length) return null; return l.reduce((s,i)=>s+((moneyOf(wordOf(i).t)||{v:0}).v),0); }

/* ---------- the tagging view ---------- */
function showTag(){
  scShow('scTag'); const page=$('scPage'); page.innerHTML=''; page.appendChild(sc.cv); sc.cv.style.cssText='display:block;width:100%;height:auto';
  const slip=sc.kind==='slip', decs=slip?sc.nums.filter(n=>n.dec):[], nums=new Set(slip?(decs.length>=3?decs:sc.nums).map(n=>n.i).concat(Object.values(sc.assign).flat()):[]);
  sc.words.forEach((w,i)=>{ if(slip&&!nums.has(i)) return; const b=document.createElement('button'); b.type='button'; b.className='scBox'+(slip?'':' word'); b.dataset.i=i;
    b.style.cssText=`left:${w.x0/sc.W*100}%;top:${w.y0/sc.H*100}%;width:${(w.x1-w.x0)/sc.W*100}%;height:${(w.y1-w.y0)/sc.H*100}%`;
    b.setAttribute('aria-label',w.t); b.onclick=()=>tapBox(i); page.appendChild(b); });
  setZoom(sc.W>1400&&slip?1.6:1);
  $('scTT').hidden=slip; $('scSkip').hidden=!slip; $('scDone').textContent=slip?'Use these':'Save classes';
  renderTag(); renderFound();
  const first=sc.words.length&&sc.nums&&sc.assign.gross&&wordOf(sc.assign.gross[0]);
  requestAnimationFrame(()=>{ const v=$('scView'); if(first){ v.scrollTop=Math.max(0,first.y0/sc.H*v.scrollHeight-80); v.scrollLeft=Math.max(0,(first.x0+first.x1)/2/sc.W*v.scrollWidth-v.clientWidth*.6); } });
}
function setZoom(z){ sc.zoom=Math.max(1,Math.min(3,z)); $('scPage').style.width=sc.zoom*100+'%'; }
$('scZoomIn').onclick=()=>setZoom(sc.zoom*1.4); $('scZoomOut').onclick=()=>setZoom(sc.zoom/1.4);
function roleOfBox(i){ for(const [k,l] of Object.entries(sc.assign)) if(l.includes(i)) return k; return null; }
function tapBox(i){
  const k=sc.role, R=roleList().find(r=>r.k===k); if(!R) return;
  const had=roleOfBox(i);
  if(had){ sc.assign[had]=sc.assign[had].filter(x=>x!==i); if(had===k){ haptic(); Sound.tap(); renderTag(); return; } }
  if(R.multi) (sc.assign[k]=sc.assign[k]||[]).push(i); else sc.assign[k]=[i];
  Sound.bubble(); haptic();
  if(sc.kind==='slip'&&!R.multi){ const nx=SLIP_ROLES.find(r=>!(sc.assign[r.k]||[]).length&&r.k!==k); if(nx) sc.role=nx.k; }
  renderTag();
}
function renderTag(){
  const roles=roleList(), slip=sc.kind==='slip';
  $('scRoles').innerHTML=roles.map(r=>{ const l=sc.assign[r.k]||[]; const v=slip?(l.length?money(valOf(r.k)):r.opt?'optional':'—'):(l.length?l.map(i=>wordOf(i).t).join(' ').slice(0,18):'tap words');
    return `<button type="button" class="scChip${sc.role===r.k?' cur':''}${l.length?' got':''}" data-k="${r.k}" style="--c:${r.c}"><span><i></i>${r.n}</span><small>${esc(v)}</small></button>`; }).join('');
  $('scRoles').querySelectorAll('.scChip').forEach(b=>b.onclick=()=>{ sc.role=b.dataset.k; renderTag(); });
  const R=roles.find(r=>r.k===sc.role);
  $('scAsk').textContent=slip?(sc.tpl?`Used your saved layout. Check each amount, tap to fix.`:`Tap the ${R.n.toLowerCase()} amount`+(R.multi?' (tap each one)':'')):`Missing a class? ${R.k==='name'?'Tap its name':R.k==='when'?'Tap its day or date':'Tap its start and end time'}`;
  document.querySelectorAll('#scPage .scBox').forEach(b=>{ const k=roleOfBox(+b.dataset.i), r=k&&roles.find(x=>x.k===k); b.classList.toggle('on',!!r); b.style.setProperty('--c',r?r.c:'');
    b.innerHTML=r&&(slip||k)?`<span class="bdg">${esc(slip?r.n:r.n)}</span>`:''; });
  if(!slip) $('scAddTag').hidden=!((sc.assign.time||[]).length);
  const cur=document.querySelector('.scChip.cur'); cur&&cur.scrollIntoView&&cur.scrollIntoView({inline:'nearest',block:'nearest'});
}
$('scSkip').onclick=()=>{ const i=SLIP_ROLES.findIndex(r=>r.k===sc.role); sc.role=SLIP_ROLES[(i+1)%SLIP_ROLES.length].k; renderTag(); };
$('scDone').onclick=()=>{ if(sc.kind==='slip') finishSlip(false); else finishTT(); };

function slipName(){ const L=sc.lines.find(L=>normT(L.text).length>=4&&!/payslip|pay slip|salary slip|statement|confidential|private/.test(normT(L.text))); return ((L?L.text.replace(/[^A-Za-z&.' ]+/g,' ').trim():'')||'Payslip').slice(0,28)+' payslip'; }
function saveSlipTpl(){
  const roles={};
  Object.entries(sc.assign).forEach(([k,l])=>{ if(!l.length) return; roles[k]=l.map(i=>{ const n=sc.nums.find(x=>x.i===i); return {a:n.label,col:n.col,xr:n.xr,yr:n.yr}; }); if(!SLIP_ROLES.find(r=>r.k===k).multi) roles[k]=roles[k][0]; });
  if(!roles.gross&&!roles.net) return;
  const id=sc.tpl?sc.tpl.id:'t'+Date.now().toString(36);
  const old=(state.templates||{})[id]||{};
  sc.tplId=id; state.templates=state.templates||{}; state.templates[id]={kind:'slip',name:old.name||slipName(),words:sc.fp,roles,uses:(old.uses||0)+1,at:Date.now()};
}
function finishSlip(auto){
  const g=valOf('gross'), net=valOf('net');
  if(g==null&&net==null){ sc.role='gross'; renderTag(); $('scAsk').textContent='Tap at least the gross pay or the net pay'; shake('#scAsk'); return; }
  saveSlipTpl(); save();
  let fund=''; const fw=(sc.assign.shg||[]).length&&sc.nums.find(n=>n.i===sc.assign.shg[0]); const fl=normT(fw?fw.label:'');
  if(/mbmf|mendaki/.test(fl)) fund='MBMF'; else if(/cdac/.test(fl)) fund='CDAC'; else if(/sinda/.test(fl)) fund='SINDA'; else if(/ecf|eurasian/.test(fl)) fund='ECF'; else if(fw) fund=S().shg||'';
  const out={gross:g,ee:valOf('ee'),er:valOf('er'),shg:valOf('shg'),fund,other:valOf('other'),net};
  const cb=sc.cb, tn=(state.templates[sc.tplId]||{}).name;
  closeScan(); cb&&cb(out);
  if(auto) toast(`Filled from your saved layout${tn?` (${tn})`:''}. Check the ticks.`,false,{label:'Fix',fn:()=>{ $('scan').hidden=false; if(!openId) lockScroll(true); showTag(); }});
}
// fill the payslip sheet from a scan
function slipFromScan(o){
  if(o.gross!=null){ setSlMode('gross'); $('slGross').value=o.gross.toFixed(2); }
  else { setSlMode('net'); $('slNet').value=o.net.toFixed(2); }
  $('slEe').value=o.ee!=null?o.ee.toFixed(2):''; $('slEr').value=o.er!=null?o.er.toFixed(2):'';
  if(o.fund) $('slFund').value=o.fund;
  if(o.shg!=null){ $('slShg').value=o.shg.toFixed(2); slShgTouched=true; } else { slShgTouched=false; slAutoShg(); }
  $('slOther').value=o.other?o.other.toFixed(2):''; $('slNet2').value=o.gross!=null&&o.net!=null?o.net.toFixed(2):'';
  $('slQuick').hidden=true; slipPreview();
  const sh=$('slipSheet'); requestAnimationFrame(()=>{ const p=$('slPreview'); sh.scrollTop=Math.max(0,p.offsetTop-sh.clientHeight/2); });
}

/* ---------- timetables ---------- */
const MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
const DOW={sun:0,mon:1,tue:2,tues:2,wed:3,thu:4,thur:4,thurs:4,fri:5,sat:6};
const DAY_RX=/\b(mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)(?:day|sday|nesday|rsday|urday|\.)?\b/gi;
const DATE_RX=[
  [/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,m=>[+m[1],+m[2]-1,+m[3]]],
  [/\b(\d{1,2})[\s\-\/.]*(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?[\s\-\/.,]*(\d{4}|\d{2}(?!\s*[:.]\d))?\b/gi,m=>[m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):null,MON[m[2].toLowerCase()],+m[1]]],
  [/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/gi,m=>[m[3]?+m[3]:null,MON[m[1].toLowerCase()],+m[2]]],
  [/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g,m=>[+m[3]<100?2000+ +m[3]:+m[3],+m[2]-1,+m[1]]]];
const TIME_RX=/(\d{1,2})(?:[:.h](\d{2})|(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to|till|until|~)\s*(\d{1,2})(?:[:.h](\d{2})|(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi;
const CODE_RX=/\b[A-Z]{2,4}\d{3,4}[A-Z]{0,2}\b/g;
function toMinT(h,m,ap){ h=+h; m=+(m||0); if(ap){ const p=ap[0].toLowerCase()==='p'; if(p&&h<12) h+=12; if(!p&&h===12) h=0; } return h*60+m; }
const mhm=m=>`${pad(Math.floor(m/60))}:${pad(m%60)}`;
function yearFor(mo,d){ const now=new Date(), y=now.getFullYear(); const c=[y-1,y,y+1].map(Y=>new Date(Y,mo,d)).sort((a,b)=>Math.abs(a-now-100*DAY)-Math.abs(b-now-100*DAY)); return c[0].getFullYear(); }
function datesIn(text){ const out=[]; let t=text;
  DATE_RX.forEach(([rx,f])=>{ t=t.replace(rx,(...a)=>{ const m=a; const [Y,M,D]=f(m); if(M==null||M<0||M>11||!(D>=1&&D<=31)) return m[0]; const y=Y||yearFor(M,D); out.push({iso:`${y}-${pad(M+1)}-${pad(D)}`,at:m[m.length-2]}); return ' '.repeat(m[0].length); }); });
  return {dates:out,rest:t}; }
function timesIn(text){ const out=[]; let m; TIME_RX.lastIndex=0;
  while((m=TIME_RX.exec(text))){
    const a1=m[4], a2=m[8], mm1=m[2]||m[3], mm2=m[6]||m[7];
    if(!mm1&&!mm2&&!a1&&!a2) continue; // "1-2" is not a time
    let s=toMinT(m[1],mm1,a1||a2), e=toMinT(m[5],mm2,a2||a1);
    if(!a1&&a2&&s>e) s=toMinT(m[1],mm1,a2[0].toLowerCase()==='p'?'am':'pm');
    if(!a1&&!a2&&+m[1]<=12&&s<7*60){ s+=720; if(e<s) e+=720; }
    if(!a1&&!a2&&e<=s&&e+720>s&&e+720<=1440) e+=720;
    if(e<=s||e-s>6*60||e-s<20||s<6*60||e>1440) continue;
    out.push({s,e,at:m.index,len:m[0].length}); }
  return out; }
function daysIn(text){ const out=[]; let m; DAY_RX.lastIndex=0; while((m=DAY_RX.exec(text))){ const k=m[1].toLowerCase(); const d=DOW[k]??DOW[k.slice(0,3)]; if(d!=null) out.push({d,at:m.index}); } return out; }
function xAt(L,at){ let wi=L.map[0][1]; for(const [o,i] of L.map){ if(o<=at) wi=i; else break; } const w=sc.words[wi]; return (w.x0+w.x1)/2; }
function findClasses(s){
  const found=[], seen=new Set(), H=s.H, W=s.W;
  // a header row with three or more day names means a grid (days across the top)
  let head=null; s.lines.forEach(L=>{ const ds=daysIn(L.text); if(!head&&new Set(ds.map(d=>d.d)).size>=3&&!timesIn(L.text).length) head={y:L.y1,cols:ds.map(d=>({d:d.d,x:xAt(L,d.at)}))}; });
  const nameX=s.tpl&&s.tpl.nameX;
  let ctx={d:null,date:null};
  s.lines.forEach((L,li)=>{
    const {dates,rest}=datesIn(L.text), ts=timesIn(rest), ds=daysIn(rest);
    if(!ts.length){ if(dates.length) ctx={date:dates[0].iso,d:null}; else if(ds.length===1) ctx={d:ds[0].d,date:null}; return; }
    ts.forEach((t,ti)=>{
      const tx=xAt(L,t.at);
      let d=null,date=null;
      if(dates.length) date=dates[Math.min(ti,dates.length-1)].iso; else if(ds.length) d=ds[Math.min(ti,ds.length-1)].d;
      else if(head&&L.y0>head.y){ d=head.cols.reduce((a,c)=>Math.abs(c.x-tx)<Math.abs(a.x-tx)?c:a).d; }
      else { d=ctx.d; date=ctx.date; }
      if(d==null&&!date) return;
      // what the class is called: a course code on the line, or above it in the same column, or the text around it
      let name=null; CODE_RX.lastIndex=0; const codes=[...L.text.matchAll(CODE_RX)];
      if(codes.length){ const c=codes.reduce((a,c)=>Math.abs(xAt(L,c.index)-tx)<Math.abs(xAt(L,a.index)-tx)?c:a); name=c[0];
        // plus the course title right after the code, e.g. "ENG201 Circuits"
        const after=L.text.slice(c.index+c[0].length).split(/\s+/).filter(Boolean), extra=[];
        for(const w of after){ if(extra.length>=3||!/^[A-Za-z&][A-Za-z&\-]+$/.test(w)||daysIn(w).length||MON[w.toLowerCase().slice(0,3)]!=null&&w.length<=4||/^(am|pm|to|venue|room|online)$/i.test(w)) break; extra.push(w); }
        if(extra.length) name+=' '+extra.join(' '); }
      if(!name) for(let k=li-1;k>=Math.max(0,li-5)&&!name;k--){ const P=s.lines[k]; for(const c of P.text.matchAll(CODE_RX)){ if(!head||Math.abs(xAt(P,c.index)-tx)<W*.12){ name=c[0]; break; } } }
      if(!name){ const cut=new Set(); ts.forEach(x=>{ for(let i=x.at;i<x.at+x.len;i++) cut.add(i); });
        const ws=L.ws.filter(w=>{ const o=L.map.find(([o,i])=>i===w.i)[0]; return !cut.has(o)&&/[A-Za-z]{2,}/.test(w.t)&&!daysIn(w.t).length&&!/^(am|pm|to|venue|room|lecture|tutorial|lab)$/i.test(w.t); });
        const near=nameX!=null?ws.filter(w=>Math.abs((w.x0+w.x1)/2/W-nameX)<.18):ws;
        name=(near.length?near:ws).slice(0,4).map(w=>w.t).join(' ').slice(0,32)||'Class'; }
      const key=[name,d,date,t.s].join('|'); if(seen.has(key)) return; seen.add(key);
      found.push({name,dow:d,date,start:mhm(t.s),end:mhm(t.e),on:true,src:li});
    });
  });
  return found;
}
function whenTxt(c){ return (c.date?new Date(c.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}):['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][c.dow]+', weekly')+' · '+fmtHM(c.start)+' – '+fmtHM(c.end); }
function renderFound(){
  if(sc.kind!=='tt') return; const f=sc.found||[];
  $('scFoundT').textContent=f.length?`${f.length} class${f.length===1?'':'es'} found`:'No classes found yet';
  $('scFoundList').innerHTML=f.length?f.map((c,i)=>`<label class="ttRow"><input type="checkbox" data-i="${i}" ${c.on?'checked':''}><b>${esc(c.name)}</b><small>${whenTxt(c)}</small></label>`).join('')
    :'<p class="note" style="margin:0">Tag one yourself: pick <b>Class</b>, tap its name, then <b>Day or date</b> and <b>Time</b>, then tap “Add the tagged class”.</p>';
  $('scFoundList').querySelectorAll('input').forEach(b=>b.onchange=()=>{ f[+b.dataset.i].on=b.checked; });
}
$('scAddTag').onclick=()=>{
  const txt=k=>(sc.assign[k]||[]).map(i=>wordOf(i).t).join(' ');
  const ts=timesIn(txt('time')); if(!ts.length){ toast('Couldn’t read a time from that. Tap the start and end times.',false); return; }
  const {dates,rest}=datesIn(txt('when')), ds=daysIn(rest);
  if(!dates.length&&!ds.length){ toast('Tap the day or date too.',false); sc.role='when'; renderTag(); return; }
  const nm=txt('name')||'Class';
  // remember where class names sit on this layout
  const ni=(sc.assign.name||[])[0]; if(ni!=null){ const w=wordOf(ni); sc.nameX=(w.x0+w.x1)/2/sc.W; }
  sc.found.push({name:nm.slice(0,32),dow:dates.length?null:ds[0].d,date:dates.length?dates[0].iso:null,start:mhm(ts[0].s),end:mhm(ts[0].e),on:true});
  sc.assign={}; sc.role='name'; renderTag(); renderFound(); Sound.stack&&Sound.stack(); haptic();
};
function finishTT(){
  const list=(sc.found||[]).filter(c=>c.on);
  if(!list.length){ toast('Pick at least one class, or tag one yourself.',false); return; }
  const id=sc.tpl?sc.tpl.id:'t'+Date.now().toString(36), old=(state.templates||{})[id]||{};
  state.templates=state.templates||{}; state.templates[id]={kind:'tt',name:old.name||'Timetable layout',words:sc.fp,nameX:sc.nameX??old.nameX??null,uses:(old.uses||0)+1,at:Date.now()};
  save(); const cb=sc.cb; closeScan(); cb&&cb(list.map(c=>({name:c.name,dow:c.dow,date:c.date,start:c.start,end:c.end})),'scan');
}

