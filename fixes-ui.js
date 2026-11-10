/* kha fixes UI — standalone, loaded after steam-ui.js */
(()=>{
if(!window.khaDesktop?.fixes||!window.KhaTools)return;
const I=icon,E=esc;
const FX={list:[],applied:{},installed:[],q:'',mine:false,kind:'all',loaded:false,busy:false};
const btn=(t,tool,extra='',cls='secondary')=>`<button class="button ${cls}" data-fxtool="${tool}" ${extra}>${t}</button>`;
const sz=n=>{const v=Number(n)||0;return v>=1048576?(v/1048576).toFixed(1)+' MB':(v/1024).toFixed(1)+' KB';};
async function fq(c,a={}){const r=await window.khaDesktop.fixes(c,a);if(!r?.ok)throw Error(r?.error||'تعذّر تنفيذ العملية.');return r.value;}
async function load(withIndex=false){if(FX.busy)return;FX.busy=true;render();try{const r=await fq(withIndex?'index':'list');FX.list=r.fixes||[];FX.applied=r.applied||{};FX.installed=await fq('scan');FX.loaded=true;}catch(e){toast(e.message);}finally{FX.busy=false;render();}}
const owned=a=>FX.installed.some(g=>g.appid===a);
function fcard(f){const rec=FX.applied[f.id];return `<article class="tool-card managed-game"><div class="managed-top"><span class="tool-chip" dir="ltr">APP ${E(f.appid)}</span><span class="tool-chip ${f.kind==='lua'?'':'bad'}">${f.kind==='lua'?'Lua':'ملفات'}</span><span class="tool-chip ${rec?'good':''}">${rec?'مطبّقة':'غير مطبّقة'}</span></div><h2 dir="auto">${E(f.name)}</h2><div class="game-meta"><span class="platform" dir="ltr">v${E(f.version)}</span><span class="meta-separator"></span><span>${owned(f.appid)?'مثبتة عندك':'غير مثبتة'}</span><span class="meta-separator"></span><span>${f.files?.length||0} ملفات · ${sz(f.bytes)}</span></div>${f.notes?`<p class="tool-muted" dir="auto">${E(f.notes)}</p>`:''}${rec?`<p class="engine-root" dir="ltr">${E(rec.dir)}</p>`:''}<div class="tool-action-row">${rec?btn(I('stop')+' تراجع','fix-revert',`data-fix="${E(f.id)}"`,'primary'):btn(I('download')+' تطبيق','fix-apply',`data-fix="${E(f.id)}"`,'primary')}${rec?btn('فتح الوجهة','fix-open',`data-fix="${E(f.id)}" data-which="game"`):''}${f.origin!=='builtin'?btn(I('trash')+' حذف','fix-remove',`data-fix="${E(f.id)}"`):''}</div></article>`;}
function fpage(){
 const list=FX.list.filter(f=>(FX.kind==='all'||f.kind===FX.kind)&&(!FX.mine||owned(f.appid))&&(!FX.q||f.name.toLowerCase().includes(FX.q)||f.game.toLowerCase().includes(FX.q)||f.appid.includes(FX.q)));
 const mineCount=FX.list.filter(f=>owned(f.appid)).length;
 return luaPanel()+title('FIX. LAUNCH. PLAY.','اصلاحات.','فهرس إصلاحات، تنزيل بضغطة، ونسخة رجوع لكل ملف.',false)+
 `<div class="tool-page-actions">${btn(I('upload')+' استيراد حزمة','fix-import','','primary')}${btn('تحديث الفهرس','fix-refresh')}${btn(FX.mine?'كل الإصلاحات':'لألعابي فقط','fix-mine')}${btn('فتح المخزن','fix-open-store')}</div>`+
 `<div class="toolbar"><input id="fix-q" class="sort-select" style="flex:1" type="search" placeholder="ابحث باسم اللعبة أو App ID" value="${E(FX.q)}"><div class="filter-buttons">${[['all','الكل'],['lua','Lua'],['files','ملفات']].map(([v,t])=>`<button class="filter-button ${FX.kind===v?'active':''}" data-fixkind="${v}">${t}</button>`).join('')}</div></div>`+
 `<div class="tool-hint"><strong>قبل التطبيق</strong><p>أغلق Steam واللعبة. إصلاحات Lua تذهب إلى <bdi>config/stplug-in</bdi>، وإصلاحات الملفات إلى مجلد اللعبة. كل ملف يُستبدل يُحفظ في <bdi>.kha-fix</bdi>، والتراجع يعيده.</p></div>`+
 (FX.installed.length?`<p class="tool-muted">${FX.installed.length} لعبة مثبتة عندك · ${mineCount} إصلاح متاح لها.</p>`:'<p class="tool-muted">لم يُعثر على ألعاب مثبتة عبر appmanifest. حدّد مجلد Steam من الإعدادات.</p>')+
 (!FX.loaded?'<p class="tool-muted" role="status">جارٍ التحميل…</p>':list.length?`<div class="managed-grid">${list.map(fcard).join('')}</div>`:empty('fix','لا نتائج.','جرّب بحثًا آخر، أو أطفئ فلتر «لألعابي فقط».',btn('استيراد حزمة','fix-import','','primary')));
}
const K=window.KhaTools,oPage=K.renderPage,oIs=K.isRoute,oAfter=K.afterRender;
window.KhaTools={renderPage:r=>r==='fixes'?fpage():oPage(r),isRoute:r=>r==='fixes'||oIs(r),afterRender:r=>{oAfter(r);if(r==='fixes'&&!FX.loaded)load();}};
const NAV=[['home','home','الرئيسية'],['discover','plus','إضافة الألعاب'],['library','library','مكتبتي'],['fixes','fix','اصلاحات'],['token-local','game','Token Tools'],['online-fix','external','Online Fix'],['account','star','الحساب'],['settings','settings','الإعدادات']];
window.nav=()=>{$('#navigation').innerHTML=NAV.map(([r,i,t])=>`<button class="nav-item ${route===r?'active':''}" data-route="${r}" ${route===r?'aria-current="page"':''}>${icon(i)}<span>${t}</span>${r==='library'?`<span class="nav-count">${state.games.length}</span>`:''}</button>`).join('');$('#breadcrumb').textContent=NAV.find(x=>x[0]===route)?.[2]||'الرئيسية';};
window.navigate=r=>{if(!NAV.some(x=>x[0]===r))return;route=r;filter='all';query='';$('#global-search').value='';$('#sidebar').classList.remove('open');$('#shade').classList.remove('open');render();window.scrollTo(0,0);};
const ACT={
 'fix-import':async()=>{const r=await fq('import');if(r){FX.list=r.fixes;FX.applied=r.applied;FX.loaded=true;}render();toast('أُضيفت الحزمة.');},
 'fix-refresh':()=>load(true),
 'fix-mine':()=>{FX.mine=!FX.mine;render();},
 'fix-apply':async b=>{const r=await fq('apply',{id:b.dataset.fix});if(!r)return;await load();toast('طُبّق: '+r.written+' ملفات في '+r.dir);},
 'fix-revert':async b=>{const r=await fq('revert',{id:b.dataset.fix});if(r){FX.list=r.fixes;FX.applied=r.applied;}render();toast('تم التراجع.');},
 'fix-remove':async b=>{const r=await fq('remove',{id:b.dataset.fix});if(r){FX.list=r.fixes;FX.applied=r.applied;}render();toast('حُذف.');},
 'fix-open':b=>fq('reveal',{id:b.dataset.fix,which:b.dataset.which||'game'}),
 'fix-open-store':()=>fq('open-store')
};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-fxtool]');
 if(b&&ACT[b.dataset.fxtool]){const fn=ACT[b.dataset.fxtool];b.disabled=true;fn(b).catch(err=>toast(err.message)).finally(()=>{if(b.isConnected)b.disabled=false;});return;}
 const k=e.target.closest('[data-fixkind]');if(k){FX.kind=k.dataset.fixkind;render();}
});
document.addEventListener('input',e=>{if(e.target.id==='fix-q'){FX.q=e.target.value.trim().toLowerCase();const c=$('#content');render();const i=$('#fix-q');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}}});
const lq=(c,a={})=>window.khaDesktop.lua(c,a).then(r=>{if(!r?.ok)throw Error(r?.error||'فشل');return r.value;});
const luaPanel=()=>`<div class="tool-card"><div class="managed-top"><span class="tool-chip good">Lua</span><span class="tool-chip">مصادر خارجية</span></div><h2>تنزيل Lua مباشرة</h2><p class="tool-muted">يجلب السكربت من ManifestHub أو مولّد steamtools.games ويكتبه في stplug-in مع نسخة رجوع.</p><div class="tool-action-row"><input id="fix-lua-id" class="sort-select" dir="ltr" inputmode="numeric" placeholder="Steam App ID" value="${E(FX.lua||'')}">${btn(I('download')+' جلب وتثبيت','fix-lua-get','','primary')}${btn('فتح stplug-in','fix-lua-open')}</div>${FX.installed.length?`<p class="tool-muted">من ألعابك المثبتة:</p><div class="tool-action-row" style="flex-wrap:wrap">${FX.installed.slice(0,8).map(g=>`<button class="button secondary" data-fxtool="fix-lua-game" data-appid="${E(g.appid)}">${E(g.name)}</button>`).join('')}</div>`:''}</div>`;
Object.assign(ACT,{
 'fix-lua-get':async()=>{const id=(FX.lua||'').trim();if(!/^\d{1,12}$/.test(id))throw Error('App ID غير صالح.');const r=await lq('get',{appid:id});toast('ثُبّت Lua — '+r.source);},
 'fix-lua-game':async b=>{const r=await lq('get',{appid:b.dataset.appid});toast('ثُبّت Lua — '+r.source);},
 'fix-lua-open':()=>lq('open')
});
document.addEventListener('input',e=>{if(e.target.id==='fix-lua-id')FX.lua=e.target.value;});
nav();render();
})();
