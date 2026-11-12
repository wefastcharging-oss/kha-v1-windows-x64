/* kha advanced tools UI - DepotDownloader & Steamless */
(()=>{
if(!window.khaDesktop?.tools||!window.KhaTools)return;
const I=icon,E=esc;
const TW={log:'Ready.',status:null,picked:'',busy:false};
const btn=(t,tool,extra='',cls='secondary')=>`<button class="button ${cls}" type="button" data-twtool="${tool}" ${extra}>${t}</button>`;
function twline(m){TW.log=(TW.log+'\n'+m).slice(-32768);const o=$('#tw-log');if(o){o.textContent=TW.log;o.scrollTop=o.scrollHeight;}}
async function tw(c,a={}){const r=await window.khaDesktop.tools(c,a);if(!r?.ok)throw Error(r?.error||'فشل');return r.value;}
function twpage(){
const s=TW.status||{};
return title('ADVANCED TOOLS.','أدوات متقدمة.','DepotDownloader لتحميل ملفات اللعبة، وSteamless لإزالة الحماية.',false)+
`<div class="tool-columns">
<section class="tool-card"><div class="eyebrow">DEPOT DOWNLOADER</div><h2>تحميل ملفات اللعبة</h2><p class="tool-muted">ينزّل محتوى الـDepots من Steam CDN. ملف Lua المثبت يوفّر المفاتيح اللازمة.</p><form id="tw-depot-form"><label>Steam App ID<input id="tw-depot-id" dir="ltr" inputmode="numeric" maxlength="12" required placeholder="620"></label><label>حساب Steam (اختياري - للألعاب المحمية)<div style="display:flex;gap:8px"><input id="tw-user" dir="ltr" placeholder="username" style="flex:1"><input id="tw-pass" dir="ltr" type="password" placeholder="password" style="flex:1"></div></label>${btn(I('download')+'  بدء التحميل','tw-depot','','primary')}${btn(I('external')+'  فتح مجلد التنزيل','tw-open-dl')}</form></section>
<section class="tool-card"><div class="eyebrow">STEAMLESS</div><h2>إزالة حماية SteamStub</h2><p class="tool-muted">يفك تشفير ملف EXE مأخوذ من DepotDownloader. الملف الأصلي يبقى سالماً.</p><div class="tool-action-row"><input id="tw-file" dir="ltr" placeholder="${E(TW.picked)||'لم يتم اختيار ملف'}" readonly style="flex:1">${btn(I('upload')+'  اختيار EXE','tw-pick')}${btn(I('play')+'  فك الحماية','tw-unpack','','primary')}</div></section>
</section>
</div>`+
`<section class="ticket-console" dir="ltr"><h2>Console Output</h2><pre id="tw-log" role="log">${E(TW.log)}</pre></section>`;
}
window.KhaTools=Object.assign({},window.KhaTools,{renderPage:r=>r==='advtools'?twpage():window.KhaTools.renderPage(r),isRoute:r=>r==='advtools'||window.KhaTools.isRoute(r)});
const NAV=[['home','home','الرئيسية'],['discover','plus','إضافة الألعاب'],['library','library','مكتبتي'],['fixes','fix','اصلاحات'],['token-local','game','Token Tools'],['advtools','download','أدوات متقدمة'],['online-fix','external','Online Fix'],['account','star','الحساب'],['settings','settings','الإعدادات']];
window.nav=()=>{$('#navigation').innerHTML=NAV.map(([r,i,t])=>`<button class="nav-item ${route===r?'active':''}" data-route="${r}" ${route===r?'aria-current="page"':''}>${icon(i)}<span>${t}</span>${r==='library'?`<span class="nav-count">${state.games.length}</span>`:''}</button>`).join('');$('#breadcrumb').textContent=NAV.find(x=>x[0]===route)?.[2]||'الرئيسية';};
window.navigate=r=>{if(!NAV.some(x=>x[0]===r))return;route=r;filter='all';query='';$('#global-search').value='';$('#sidebar').classList.remove('open');$('#shade').classList.remove('open');render();window.scrollTo(0,0);};
const ACT={
'tw-depot':async()=>{const id=$('#tw-depot-id')?.value.trim();if(!/^\d{1,12}$/.test(id||''))throw Error('App ID غير صالح.');const u=$('#tw-user')?.value.trim(),p=$('#tw-pass')?.value;const r=await tw('depot',{appid:id,username:u,password:p});twline('DONE - exit code '+r.code+' - '+r.dir);toast(r.code===0?'تم التحميل.':'انتهى بكود '+r.code);},
'tw-open-dl':()=>tw('open-downloads'),
'tw-pick':async()=>{const f=await tw('pick');if(f){TW.picked=f;const i=$('#tw-file');if(i)i.value=f;}},
'tw-unpack':async()=>{if(!TW.picked)throw Error('اختر ملف EXE أولاً.');const r=await tw('steamless',{file:TW.picked});twline('DONE - exit code '+r.code);toast(r.code===0?'تم فك الحماية.':'انتهى بكود '+r.code);}
};
window.khaDesktop.onToolsOutput(twline);
document.addEventListener('submit',e=>{if(e.target.id==='tw-depot-form')e.preventDefault();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-twtool]');if(b&&ACT[b.dataset.twtool]&&!TW.busy){TW.busy=true;b.disabled=true;ACT[b.dataset.twtool](b).catch(err=>{twline('ERROR - '+err.message);toast(err.message);}).finally(()=>{TW.busy=false;if(b.isConnected)b.disabled=false;});}});
(async()=>{try{TW.status=await tw('status');}catch{}})();
nav();render();
})();