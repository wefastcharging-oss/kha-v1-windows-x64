'use strict';
const {dialog,shell}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const crypto=require('node:crypto');
const AdmZip=require('adm-zip');
const C=require('./service-config.cjs');
const LIMIT={archive:200*1024*1024,files:600,file:64*1024*1024};
const DATA='files';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const safeRel=p=>{const n=String(p).replace(/\\/g,'/');if(!n||n.startsWith('/')||/^[a-zA-Z]:/.test(n)||n.split('/').includes('..'))return null;return n;};
module.exports=function attach(app,ipcMain,getWindow,getSteamRoot){
 const base=path.join(app.getPath('userData'),'fixes');
 const store=path.join(base,'fixes');
 const idxFile=path.join(base,'index.json');
 const appliedFile=path.join(base,'applied.json');
 fs.mkdirSync(store,{recursive:true});
 const readJson=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return d;}};
 const writeJson=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2));
 let index=readJson(idxFile,[]),applied=readJson(appliedFile,{});
 const saveIndex=()=>writeJson(idxFile,index);
 const saveApplied=()=>writeJson(appliedFile,applied);
 const fileOf=(fix,rel)=>path.join(store,fix.id,DATA,rel);
 function libraries(root){const list=[root];try{const vdf=fs.readFileSync(path.join(root,'steamapps','libraryfolders.vdf'),'utf8');for(const m of vdf.matchAll(/"path"\s*"([^"]+)"/g))list.push(m[1].replace(/\\\\/g,'\\'));}catch{}return [...new Set(list)];}
 function guessPath(root,appid){if(!root||!/^\d{1,12}$/.test(String(appid)))return null;for(const lib of libraries(root)){try{const acf=fs.readFileSync(path.join(lib,'steamapps',`appmanifest_${appid}.acf`),'utf8');const m=acf.match(/"installdir"\s*"([^"]+)"/);if(m){const p=path.join(lib,'steamapps','common',m[1]);if(fs.existsSync(p))return p;}}catch{}}return null;}
 const confirm=async(message,detail)=>{const {response}=await dialog.showMessageBox(getWindow(),{type:'warning',title:'kha — تأكيد تعديل ملفات اللعبة',message,detail,buttons:['إلغاء','متابعة'],defaultId:0,cancelId:0,noLink:true});if(response!==1)throw Error('أُلغي الإجراء دون تغيير الملفات.');};
 async function importZip(win){
  const result=await dialog.showOpenDialog(win,{title:'استيراد حزمة إصلاح .kha-fix أو .zip',properties:['openFile'],filters:[{name:'kha fix',extensions:['kha-fix','zip']}]});
  if(result.canceled)return null;
  const file=result.filePaths[0];
  if((await fsp.stat(file)).size>LIMIT.archive)throw Error('الحزمة أكبر من 200 ميغابايت.');
  const zip=new AdmZip(await fsp.readFile(file));
  const entries=zip.getEntries().filter(e=>!e.isDirectory);
  if(entries.length>LIMIT.files+1)throw Error('الحزمة تحتوي أكثر من 600 ملف.');
  const metaEntry=entries.find(e=>e.entryName.replace(/\\/g,'/')==='fix.json');
  if(!metaEntry)throw Error('الحزمة لا تحتوي fix.json.');
  let meta;try{meta=JSON.parse(metaEntry.getData().toString('utf8'));}catch{throw Error('fix.json غير صالح.');}
  const appid=String(meta.appid||'');if(!/^\d{1,12}$/.test(appid))throw Error('appid في fix.json غير صالح.');
  const name=String(meta.name||'').trim().slice(0,120);if(!name)throw Error('اسم الحزمة مطلوب في fix.json.');
  const id=crypto.randomUUID(),files=[];
  for(const e of entries){
   const raw=e.entryName.replace(/\\/g,'/');
   if(raw==='fix.json'||!raw.startsWith(DATA+'/'))continue;
   const rel=safeRel(raw.slice(DATA.length+1));if(!rel)throw Error('مسار غير آمن: '+raw);
   const data=e.getData();if(data.length>LIMIT.file)throw Error('الملف '+rel+' أكبر من 64 ميغابايت.');
   const dest=path.join(store,id,DATA,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});
   await fsp.writeFile(dest,data);
   files.push({rel,sha256:sha(data),bytes:data.length});
  }
  if(!files.length)throw Error('لا توجد ملفات داخل مجلد files/.');
  const fix={id,name,appid,game:String(meta.game||'').slice(0,120),version:String(meta.version||'1.0').slice(0,20),author:String(meta.author||'').slice(0,80),notes:String(meta.notes||'').slice(0,800),origin:'local',created:Date.now(),bytes:files.reduce((n,f)=>n+f.bytes,0),sha256:sha(Buffer.from(files.map(f=>f.rel+f.sha256).join('|'))),files};
  index=index.filter(f=>f.id!==id);index.push(fix);saveIndex();
  return fix;
 }
 async function ensureLocal(fix){
  if(fix.origin!=='remote')return fix;
  const res=await fetch(fix.url);if(!res.ok)throw Error('فشل تنزيل الحزمة ('+res.status+').');
  const buf=Buffer.from(await res.arrayBuffer());
  if(fix.sha256&&sha(buf)!==fix.sha256)throw Error('بصمة الحزمة لا تطابق الفهرس.');
  const zip=new AdmZip(buf),files=[];
  for(const e of zip.getEntries()){
   if(e.isDirectory)continue;
   const raw=e.entryName.replace(/\\/g,'/');if(!raw.startsWith(DATA+'/'))continue;
   const rel=safeRel(raw.slice(DATA.length+1));if(!rel)continue;
   const data=e.getData();const dest=path.join(store,fix.id,DATA,rel);
   fs.mkdirSync(path.dirname(dest),{recursive:true});await fsp.writeFile(dest,data);
   files.push({rel,sha256:sha(data),bytes:data.length});
  }
  if(!files.length)throw Error('الحزمة البعيدة لا تحتوي ملفات.');
  fix.files=files;fix.bytes=files.reduce((n,f)=>n+f.bytes,0);fix.origin='cached';saveIndex();
  return fix;
 }
 async function applyFix(win,args){
  const fix=index.find(f=>f.id===args.id);if(!fix)throw Error('الحزمة غير موجودة.');
  if(applied[fix.id])throw Error('هذه الحزمة مطبّقة بالفعل. تراجع عنها أولًا.');
  await ensureLocal(fix);
  let target=args.path||guessPath(getSteamRoot(),fix.appid);
  if(!target||!fs.existsSync(target)){
   const r=await dialog.showOpenDialog(win,{title:'اختر مجلد تثبيت اللعبة'+(fix.game?' — '+fix.game:''),properties:['openDirectory']});
   if(r.canceled)return null;target=r.filePaths[0];
  }
  for(const f of fix.files){const b=await fsp.readFile(fileOf(fix,f.rel));if(sha(b)!==f.sha256)throw Error('ملف تالف في الحزمة: '+f.rel);}
  await confirm(`تطبيق «${fix.name}»؟`,['المجلد: '+target,'',`${fix.files.length} ملفات ستُكتب. كل ملف موجود سيُحفظ في .kha-fix قبل الاستبدال. أغلق اللعبة أولًا.`].join('\n'));
  const backup=path.join(target,'.kha-fix',fix.id),backed=[],created=[];
  fs.mkdirSync(path.join(backup,'backup'),{recursive:true});
  for(const f of fix.files){
   const dest=path.join(target,f.rel),src=fileOf(fix,f.rel);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   if(fs.existsSync(dest)){const old=await fsp.readFile(dest);const bpath=path.join(backup,'backup',f.rel);fs.mkdirSync(path.dirname(bpath),{recursive:true});await fsp.writeFile(bpath,old);backed.push({rel:f.rel});}
   else created.push(f.rel);
   await fsp.copyFile(src,dest);
  }
  writeJson(path.join(backup,'state.json'),{appid:fix.appid,date:Date.now(),backed,created});
  applied[fix.id]={appid:fix.appid,path:target,date:Date.now()};saveApplied();
  return {path:target,written:fix.files.length};
 }
 async function revertFix(args){
  const fix=index.find(f=>f.id===args.id),rec=applied[fix?.id];if(!fix||!rec)throw Error('لا توجد نسخة رجوع لهذه الحزمة.');
  const backup=path.join(rec.path,'.kha-fix',fix.id),state=readJson(path.join(backup,'state.json'),null);
  if(!state)throw Error('ملف حالة الرجوع مفقود.');
  await confirm(`التراجع عن «${fix.name}»؟`,[`المجلد: ${rec.path}`,'',`ستُعاد ${state.backed.length} ملفات وتُحذف ${state.created.length}.`].join('\n'));
  for(const rel of state.created)await fsp.rm(path.join(rec.path,rel),{force:true});
  for(const b of state.backed){const src=path.join(backup,'backup',b.rel),dest=path.join(rec.path,b.rel);fs.mkdirSync(path.dirname(dest),{recursive:true});await fsp.copyFile(src,dest);}
  await fsp.rm(backup,{recursive:true,force:true});
  delete applied[fix.id];saveApplied();
  return true;
 }
 async function fetchIndex(){
  const local=index.filter(f=>f.origin!=='remote');
  if(!C.fixIndex)return local;
  const res=await fetch(C.fixIndex);if(!res.ok)throw Error('تعذّر قراءة الفهرس ('+res.status+').');
  const remote=await res.json();if(!Array.isArray(remote))throw Error('الفهرس غير صالح.');
  for(const r of remote.slice(0,500)){
   if(!r||!/^\d{1,12}$/.test(String(r.appid))||!r.url||!r.name)continue;
   local.push({id:String(r.id||sha(Buffer.from(String(r.url)))),name:String(r.name).slice(0,120),appid:String(r.appid),game:String(r.game||'').slice(0,120),version:String(r.version||'1.0').slice(0,20),author:String(r.author||'').slice(0,80),notes:String(r.notes||'').slice(0,800),origin:'remote',url:String(r.url),sha256:String(r.sha256||''),bytes:Number(r.bytes)||0,files:[],created:Number(r.created)||0});
  }
  index=local;saveIndex();return index;
 }
 ipcMain.handle('kha:fix',async(event,command,args={})=>{
  const win=getWindow();if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)return {ok:false,error:'طلب غير موثوق.'};
  try{
   if(typeof command!=='string'||!args||typeof args!=='object'||JSON.stringify(args).length>16000)throw Error('طلب غير صالح.');
   let value;
   switch(command){
    case 'list':value={fixes:index,applied};break;
    case 'index':value={fixes:await fetchIndex(),applied};break;
    case 'import':{const f=await importZip(win);value=f?{fixes:index,applied}:null;break;}
    case 'remove':{const f=index.find(x=>x.id===args.id);if(!f)throw Error('الحزمة غير موجودة.');if(applied[f.id])throw Error('تراجع قبل الحذف.');await confirm(`حذف «${f.name}»؟`,'تُحذف الملفات المستخرجة فقط، ولا تُمس لعبتك.');await fsp.rm(path.join(store,f.id),{recursive:true,force:true});index=index.filter(x=>x.id!==f.id);saveIndex();value={fixes:index,applied};break;}
    case 'apply':value=await applyFix(win,args);break;
    case 'revert':await revertFix(args);value={fixes:index,applied};break;
    case 'guess':value=guessPath(getSteamRoot(),String(args.appid));break;
    case 'reveal':{const f=index.find(x=>x.id===args.id);const p=args.which==='game'?applied[f?.id]?.path:path.join(store,String(args.id),DATA);if(!p||!fs.existsSync(p))throw Error('المجلد غير موجود.');const err=await shell.openPath(p);if(err)throw Error('تعذّر فتح المجلد.');value=true;break;}
    case 'open-store':{fs.mkdirSync(base,{recursive:true});const err=await shell.openPath(base);if(err)throw Error('تعذّر فتح المجلد.');value=true;break;}
    default:throw Error('أمر غير معروف.');
   }
   return {ok:true,value};
  }catch(e){return {ok:false,error:String(e.message||'تعذّر تنفيذ العملية.').slice(0,500)};}
 });
};
