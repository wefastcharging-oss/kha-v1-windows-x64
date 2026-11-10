/* kha fixes UI — standalone, loaded after steam-ui.js */
(()=>{
if(!window.khaDesktop?.fixes||!window.KhaTools)return;
const I=icon,E=esc;
const FX={list:[],applied:{},mineOnly:false,loaded:false,busy:false};
const btn=(t,tool,extra='',cls='secondary')=>`<button class="button ${cls}" data-fxtool="${tool}" ${extra}>${t}</button>`;
const sz=n=>{const v=Number(n)||0;return v>=1048576?(v/1048576).toFixed(1)+' MB':(v/1024).toFixed(1)+' KB';};
async function fq(command,args={}){const r=await window.khaDesktop.fixes(command,args);if(!r?.ok)throw Error(r?.error||'تعذّر تنفيذ العملية.');return r.value;}
async function load(withIndex=false){if(FX.busy)return;FX.busy=true;render();try{const r=await fq(withIndex?'index':'list');FX.list=r.fixes||[];FX.applied=r.applied||{};FX.loaded=true;}catch(e){toast(e.message);}finally{FX.busy=false;render();}}
function fcard(f){const rec=FX.applied[f.id],mine=state.games.some(g=>g.appid===f.appid);return `<article class="tool-card managed-game"><div class="managed-top"><span class="tool-chip" dir="ltr">APP ${E(f.appid)}</span><span class="tool-chip ${rec?'good':''}">${rec?'مطبّقة':'غير مطبّقة'}</span></div><h2 dir="auto">${E(f.name)}</h2><div class="game-meta"><span class="platform" dir="ltr">v${E(f.version)}</span><span class="meta-separator"></span><span>${mine?'في مكتبتي':'ليست في مكتبتي'}</span><span class="meta-separator"></span><span>${f.files?.length||0} ملفات · ${sz(f.bytes)}</span></div>${f.notes?`<p class="tool-muted" dir="auto">${E(f.notes)}</p>`:''}${rec?`<p class="engine-root" dir="ltr">${E(rec.path)}</p>`:''}<div class="tool-action-row">${rec?btn(I('stop')+' تراجع','fix-revert',`data-fix="${E(f.id)}"`,'primary'):btn(I('check')+' تطبيق','fix-apply',`data-fix="${E(f.id)}"`,'primary')}${rec?btn('فتح مجلد اللعبة','fix-open',`data-fix="${E(f.id)}" data-which="game"`):''}${btn(I('trash')+' حذف','fix-remove',`data-fix="${E(f.id)}"`)}</div></article>`;}
function fpage(){const list=FX.list.filter(f=>!FX.mineOnly||state.games.some(g=>g.appid===f.appid));return title('FIX. LAUNCH. PLAY.','اصلاحات.','حزم إصلاح لألعابك، بنسخة رجوع لكل ملف يُستبدل.',false)+`<div class="tool-page-actions">${btn(I('upload')+' استيراد حزمة','fix-import','','primary')}${btn('تحديث القائمة','fix-refresh')}${btn(FX.mineOnly?'كل الألعاب':'ألعابي فقط','fix-filter')}${btn('فتح مخزن الحزم','fix-open-store')}</div><div class="tool-hint"><strong>قبل التطبيق</strong><p>أغلق اللعبة. كل ملف سيُستبدل يُحفظ في <bdi>.kha-fix</bdi> داخل مجلد اللعبة، والتراجع يعيده كما كان.</p></div>${!FX.loaded?'<p class="tool-muted" role="status">جارٍ التحميل…</p>':list.length?`<div class="managed-grid">${list.map(fcard).join('')}</div>`:empty('game',FX.mineOnly?'لا حزم لألعابك.':'مخزن الإصلاحات فارغ.','استورد حزمة <bdi>.kha-fix</bdi> جاهزة، أو اربط فهرسك السحابي لاحقًا.',btn('استيراد حزمة','fix-import','','primary'))}`;}
const K=window.KhaTools,oPage=K.renderPage,oIs=K.isRoute,oAfter=K.afterRender;
window.KhaTools={renderPage:r=>r==='fixes'?fpage():oPage(r),isRoute:r=>r==='fixes'||oIs(r),afterRender:r=>{oAfter(r);if(r==='fixes'&&!FX.loaded)load();}};
const NAV=[['home','home','الرئيسية'],['discover','plus','إضافة الألعاب'],['library','library','مكتبتي'],['fixes','fix','اصلاحات'],['token-local','game','Token Tools'],['online-fix','external','Online Fix'],['account','star','الحساب'],['settings','settings','الإعدادات']];
window.nav=()=>{$('#navigation').innerHTML=NAV.map(([r,i,t])=>`<button class="nav-item ${route===r?'active':''}" data-route="${r}" ${route===r?'aria-current="page"':''}>${icon(i)}<span>${t}</span>${r==='library'?`<span class="nav-count">${state.games.length}</span>`:''}</button>`).join('');$('#breadcrumb').textContent=NAV.find(x=>x[0]===route)?.[2]||'الرئيسية';};
window.navigate=r=>{if(!NAV.some(x=>x[0]===r))return;route=r;filter='all';query='';$('#global-search').value='';$('#sidebar').classList.remove('open');$('#shade').classList.remove('open');render();window.scrollTo(0,0);};
const ACT={
 'fix-import':async()=>{const r=await fq('import');if(r){FX.list=r.fixes;FX.applied=r.applied;FX.loaded=true;}render();toast('أُضيفت الحزمة. لم تُطبّق بعد.');},
 'fix-refresh':()=>load(true),
 'fix-filter':()=>{FX.mineOnly=!FX.mineOnly;render();},
 'fix-apply':async b=>{const r=await fq('apply',{id:b.dataset.fix});if(!r)return;await load();toast('طُبّقت الحزمة: '+r.written+' ملفات.');},
 'fix-revert':async b=>{const r=await fq('revert',{id:b.dataset.fix});if(r){FX.list=r.fixes;FX.applied=r.applied;}render();toast('تم التراجع.');},
 'fix-remove':async b=>{const r=await fq('remove',{id:b.dataset.fix});if(r){FX.list=r.fixes;FX.applied=r.applied;}render();toast('حُذفت الحزمة.');},
 'fix-open':b=>fq('reveal',{id:b.dataset.fix,which:b.dataset.which||'game'}),
 'fix-open-store':()=>fq('open-store')
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-fxtool]');if(!b)return;const fn=ACT[b.dataset.fxtool];if(!fn)return;b.disabled=true;fn(b).catch(err=>toast(err.message)).finally(()=>{if(b.isConnected)b.disabled=false;});});
nav();render();
})();
