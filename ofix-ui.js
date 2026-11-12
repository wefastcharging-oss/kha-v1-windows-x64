/* kha Online Fix UI */
(()=>{
if(!window.khaDesktop?.ofix)return;
const I=icon,E=esc;
const O={q:'',results:null,busy:false};
const btn=(t,tool,extra='',cls='secondary')=>`<button class="button ${cls}" type="button" data-oftool="${tool}" ${extra}>${t}</button>`;
function opage(){return title('ONLINE FIX.','Online Fix.','ابحث عن إصلاح اللعب الجماعي وافتح صفحته للتحميل.',false)+`<div class="tool-columns"><section class="tool-card"><form id="ofix-form"><label>ابحث في online-fix.me<input id="ofix-q" dir="auto" placeholder="اسم اللعبة بالإنجليزية" value="${E(O.q)}"></label>${btn(I('search')+'  بحث','of-search','','primary')}</form>${O.busy?'<p class="tool-muted" role="status">جارٍ البحث…</p>':''}<div id="ofix-results">${O.results?O.results.length?O.results.map(x=>`<div class="version-row"><div><strong dir="auto">${E(x.title)}</strong></div>${btn(I('external')+'  فتح الصفحة','of-open',`data-url="${E(x.url)}"`,'primary')}</div>`).join(''):'<p class="tool-muted">لا نتائج.</p>':'<p class="tool-muted">اكتب اسم اللعبة ثم اضغط بحث. النتيجة تفتح في متصفحك لتحميل الإصلاح وتطبيقه الى مجلد اللعبة.</p>'}</div></section></div>`;}
const K=window.KhaTools;
window.KhaTools=Object.assign({},K,{renderPage:r=>r==='online-fix'?opage():K.renderPage(r),isRoute:r=>r==='online-fix'||K.isRoute(r),afterRender:K.afterRender});
const ACT={'of-search':async()=>{O.q=$('#ofix-q').value.trim();O.busy=true;render();try{O.results=await window.khaDesktop.ofix('search',{q:O.q});}finally{O.busy=false;render();}},'of-open':b=>window.khaDesktop.ofix('open',{url:b.dataset.url})};
document.addEventListener('submit',e=>{if(e.target.id==='ofix-form'){e.preventDefault();const b=e.target.querySelector('[data-oftool]');b&&b.click();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-oftool]');if(b&&ACT[b.dataset.oftool]&&!O.busy){O.busy=true;b.disabled=true;ACT[b.dataset.oftool](b).catch(err=>toast(err.message)).finally(()=>{O.busy=false;if(b.isConnected)b.disabled=false;});}});
})();