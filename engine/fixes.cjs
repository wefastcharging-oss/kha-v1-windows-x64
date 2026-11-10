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
const kindOf=v=>v==='lua'?'lua':'files';

module.exports=function attach(app,ipcMain,getWindow,getSteamRoot){
 const base=path.join(app.getPath('userData'),'fixes');
 const store=path.join(base,'fixes');
 const idxFile=path.join(base,'index.json');
 const appliedFile=path.join(base,'applied.json');
 fs.mkdirSync(store,{recursive:true});
 const readJson=(f,d)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return d;}};
 const writeJson=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2));
 let index=readJson(idxFile,[]),applied=readJson(appliedFile,{});
 const builtin=readJson(path.join(__dirname,'fixes-catalog.json'),[]).map(x=>({...x,origin:'builtin',files:[]}));
 const saveIndex=()=>writeJson(idxFile,index);
 const saveApplied=()=>writeJson(appliedFile,applied);
 const fileOf=(fix,rel)=>path.join(store,fix.id,DATA,rel);
 const merged=()=>{const byId=new Map();for(const f of [...builtin,...index])byId.set(f.id,f);return [...byId.values()];};

 function libraries(root){const list=[root];try{const vdf=fs.readFileSync(path.join(root,'steamapps','libraryfolders.vdf'),'utf8');for(const m of vdf.matchAll(/"path"\s*"([^"]+)"/g))list.push(m[1].replace(/\\\\/g,'\\'));}catch{}return [...new Set(list)];}
 function guessPath(root,appid){if(!root||!/^\d{1,12}$/.test(String(appid)))return null;for(const lib of libraries(root)){try{const acf=fs.readFileSync(path.join(lib,'steamapps',`appmanifest_${appid}.acf`),'utf8');const m=acf.match(/"installdir"\s*"([^"]+)"/);if(m){const p=path.join(lib,'steamapps','common',m[1]);if(fs.existsSync(p))return p;}}catch{}}return null;}
 function scan(){const root=getSteamRoot();if(!root)return [];const out=[];
  for(const lib of libraries(root)){let names=[];try{names=fs.readdirSync(path.join(lib,'steamapps'));}catch{continue;}
   for(const n of names){if(!/^appmanifest_\d+\.acf$/.test(n))continue;
    try{const acf=fs.readFileSync(path.join(lib,'steamapps',n),'utf8');
     const appid=n.match(/\d+/)[0],dir=acf.match(/"installdir"\s*"([^"]+)"/)?.[1],name=acf.match(/"name"\s*"([^"]+)"/)?.[1];
     if(!dir||!fs.existsSync(path.join(lib,'steamapps','common',dir)))continue;
     out.push({appid,name:name||dir,path:path.join(lib,'steamapps','common',dir)});
    }catch{}}
   if(out.length>2000)break;}
  return out;}

 const confirm=async(message,detail)=>{const {response}=await dialog.showMessageBox(getWindow(),{type:'warning',title:'kha — تأكيد تعديل الملفات',message,detail,buttons:['إلغاء','متابعة'],defaultId:0,cancelId:0,noLink:true});if(response!==1)throw Error('أُلغي الإجراء دون تغيير الملفات.');};

 async function importZip(win){
  const result=await dialog.showOpenDialog(win,{title:'استيراد حزمة .kha-fix أو .zip',properties:['openFile'],filters:[{name:'kha fix',extensions:['kha-fix','zip']}]});
  if(result.canceled)return null;
  const file=result.filePaths[0];
  if((await fsp.stat(file)).size>LIMIT.archive)throw Error('الحزمة أكبر من 200 ميغابايت.');
  const zip=new AdmZip(await fsp.readFile(file));
  const entries=zip.getEntries().filter(e=>!e.isDirectory);
  if(entries.length>LIMIT.files+1)throw Error('أكثر من 600 ملف.');
  const metaEntry=entries.find(e=>e.entryName.replace(/\\/g,'/')==='fix.json');
  if(!metaEntry)throw Error('الحزمة لا تحتوي fix.json.');
  let meta;try{meta=JSON.parse(metaEntry.getData().toString('utf8'));}catch{throw Error('fix.json غير صالح.');}
  const appid=String(meta.appid||'');if(!/^\d{1,12}$/.test(appid))throw Error('appid غير صالح.');
  const name=String(meta.name||'').trim().slice(0,120);if(!name)throw Error('اسم الحزمة مطلوب.');
  const kind=kindOf(meta.kind),id=crypto.randomUUID(),files=[];
  for(const e of entries){
   const raw=e.entryName.replace(/\\/g,'/');
   if(raw==='fix.json'||!raw.startsWith(DATA+'/'))continue;
   const rel=safeRel(raw.slice(DATA.length+1));if(!rel)throw Error('مسار غير آمن: '+raw);
   const data=e.getData();if(data.length>LIMIT.file)throw Error('الملف '+rel+' كبير.');
   const dest=path.join(store,id,DATA,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});
   await fsp.writeFile(dest,data);
   files.push({rel,sha256:sha(data),bytes:data.length});
  }
  if(!files.length)throw Error('لا توجد ملفات داخل files/.');
  const fix={id,name,appid,game:String(meta.game||'').slice(0,120),version:String(meta.version||'1.0').slice(0,20),author:String(meta.author||'').slice(0,80),notes:String(meta.notes||'').slice(0,800),kind,origin:'local',created:Date.now(),bytes:files.reduce((n,f)=>n+f.bytes,0),sha256:sha(Buffer.from(files.map(f=>f.rel+f.sha256).join('|'))),files};
  index=index.filter(f=>f.id!==id);index.push(fix);saveIndex();
  return fix;
 }

 async function ensureLocal(fix){
  if(fix.origin!=='remote')return fix;
  if(!fix.url)throw Error('لا يوجد رابط تنزيل لهذا الإصلاح.');
  const res=await fetch(fix.url);if(!res.ok)throw Error('فشل التنزيل ('+res.status+').');
  const buf=Buffer.from(await res.arrayBuffer());
  if(fix.sha256&&sha(buf)!==fix.sha256)throw Error('بصمة الملف لا تطابق الفهرس.');
  const files=[];
  if(fix.kind==='lua'){
   if(buf.length>LIMIT.file)throw Error('ملف Lua كبير.');
   const rel=fix.appid+'.lua',dest=path.join(store,fix.id,DATA,rel);
   fs.mkdirSync(path.dirname(dest),{recursive:true});await fsp.writeFile(dest,buf);
   files.push({rel,sha256:sha(buf),bytes:buf.length});
  }else{
   if(buf.length>LIMIT.archive)throw Error('الحزمة كبيرة.');
   const zip=new AdmZip(buf);
   for(const e of zip.getEntries()){
    if(e.isDirectory)continue;
    const raw=e.entryName.replace(/\\/g,'/');if(!raw.startsWith(DATA+'/'))continue;
    const rel=safeRel(raw.slice(DATA.length+1));if(!rel)continue;
    const data=e.getData();const dest=path.join(store,fix.id,DATA,rel);
    fs.mkdirSync(path.dirname(dest),{recursive:true});await fsp.writeFile(dest,data);
    files.push({rel,sha256:sha(data),bytes:data.length});
   }
  }
  if(!files.length)throw Error('لا ملفات بعد التنزيل.');
  fix.files=files;fix.bytes=files.reduce((n,f)=>n+f.bytes,0);fix.origin='cached';saveIndex();
  return fix;
 }

 async function applyFix(win,args){
  const fix=merged().find(f=>f.id===args.id);if(!fix)throw Error('الإصلاح غير موجود.');
  if(applied[fix.id])throw Error('مطبّق بالفعل. تراجع أولًا.');
  await ensureLocal(fix);
  let dir,label;
  if(fix.kind==='lua'){
   const root=getSteamRoot();if(!root)throw Error('حدّد مجلد Steam أولًا.');
   dir=path.join(root,'config','stplug-in');label='stplug-in';
   if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});
  }else{
   dir=args.path||guessPath(getSteamRoot(),fix.appid);
   if(!dir||!fs.existsSync(dir)){
    const r=await dialog.showOpenDialog(win,{title:'اختر مجلد اللعبة'+(fix.game?' — '+fix.game:''),properties:['openDirectory']});
    if(r.canceled)return null;dir=r.filePaths[0];
   }
   label=dir;
  }
  for(const f of fix.files){const b=await fsp.readFile(fileOf(fix,f.rel));if(sha(b)!==f.sha256)throw Error('ملف تالف: '+f.rel);}
  await confirm(`تطبيق «${fix.name}»؟`,['الوجهة: '+label,'',`${fix.files.length} ملفات. كل ملف موجود يُحفظ في .kha-fix قبل الاستبدال. أغلق Steam واللعبة أولًا.`].join('\n'));
  const backup=path.join(dir,'.kha-fix',fix.id),backed=[],created=[];
  fs.mkdirSync(path.join(backup,'backup'),{recursive:true});
  for(const f of fix.files){
   const dest=path.join(dir,f.rel),src=fileOf(fix,f.rel);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   if(fs.existsSync(dest)){const old=await fsp.readFile(dest);const bp=path.join(backup,'backup',f.rel);fs.mkdirSync(path.dirname(bp),{recursive:true});await fsp.writeFile(bp,old);backed.push({rel:f.rel});}
   else created.push(f.rel);
   await fsp.copyFile(src,dest);
  }
  writeJson(path.join(backup,'state.json'),{appid:fix.appid,dir,date:Date.now(),backed,created});
  applied[fix.id]={appid:fix.appid,dir,date:Date.now()};saveApplied();
  return {dir,written:fix.files.length};
 }

 async function revertFix(args){
  const rec=applied[args.id];if(!rec)throw Error('لا نسخة رجوع.');
  const fix=merged().find(f=>f.id===args.id);
  const backup=path.join(rec.dir,'.kha-fix',args.id),state=readJson(path.join(backup,'state.json'),null);
  if(!state)throw Error('حالة الرجوع مفقودة.');
  await confirm(`التراجع عن «${fix?.name||args.id}»؟`,[`الوجهة: ${rec.dir}`,'',`ستُعاد ${state.backed.length} ملفات وتُحذف ${state.created.length}.`].join('\n'));
  for(const rel of state.created)await fsp.rm(path.join(rec.dir,rel),{force:true});
  for(const b of state.backed){const src=path.join(backup,'backup',b.rel),dest=path.join(rec.dir,b.rel);fs.mkdirSync(path.dirname(dest),{recursive:true});await fsp.copyFile(src,dest);}
  await fsp.rm(backup,{recursive:true,force:true});
  delete applied[args.id];saveApplied();
  return true;
 }

 async function fetchIndex(){
  if(!C.fixIndex)return merged();
  const res=await fetch(C.fixIndex);if(!res.ok)throw Error('تعذّر قراءة الفهرس ('+res.status+').');
  const remote=await res.json();if(!Array.isArray(remote))throw Error('الفهرس غير صالح.');
  index=index.filter(f=>f.origin!=='remote');
  for(const r of remote.slice(0,800)){
   if(!r||!/^\d{1,12}$/.test(String(r.appid))||!r.name)continue;
   index.push({id:String(r.id||sha(Buffer.from(String(r.name)+r.appid))),name:String(r.name).slice(0,120),appid:String(r.appid),game:String(r.game||'').slice(0,120),version:String(r.version||'1.0').slice(0,20),author:String(r.author||'').slice(0,80),notes:String(r.notes||'').slice(0,800),kind:kindOf(r.kind),origin:'remote',url:String(r.url||''),sha256:String(r.sha256||''),bytes:Number(r.bytes)||0,files:[],created:Number(r.created)||0});
  }
  saveIndex();return merged();
 }

 ipcMain.handle('kha:fix',async(event,command,args={})=>{
  const win=getWindow();if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)return {ok:false,error:'طلب غير موثوق.'};
  try{
   if(typeof command!=='string'||!args||typeof args!=='object'||JSON.stringify(args).length>16000)throw Error('طلب غير صالح.');
   let value;
   switch(command){
    case 'list':value={fixes:merged(),applied};break;
    case 'index':value={fixes:await fetchIndex(),applied};break;
    case 'scan':value=scan();break;
    case 'import':{const f=await importZip(win);value=f?{fixes:merged(),applied}:null;break;}
    case 'remove':{const f=index.find(x=>x.id===args.id);if(!f)throw Error('الإصلاح غير موجود أو مضمّن.');if(applied[f.id])throw Error('تراجع قبل الحذف.');await confirm(`حذف «${f.name}»؟`,'تُحذف الملفات المستخرجة فقط.');await fsp.rm(path.join(store,f.id),{recursive:true,force:true});index=index.filter(x=>x.id!==f.id);saveIndex();value={fixes:merged(),applied};break;}
    case 'apply':value=await applyFix(win,args);break;
    case 'revert':await revertFix(args);value={fixes:merged(),applied};break;
    case 'reveal':{const p=args.which==='game'?applied[args.id]?.dir:path.join(store,String(args.id),DATA);if(!p||!fs.existsSync(p))throw Error('المجلد غير موجود.');const err=await shell.openPath(p);if(err)throw Error('تعذّر فتح المجلد.');value=true;break;}
    case 'open-store':{fs.mkdirSync(base,{recursive:true});const err=await shell.openPath(base);if(err)throw Error('تعذّر فتح المجلد.');value=true;break;}
    default:throw Error('أمر غير معروف.');
   }
   return {ok:true,value};
  }catch(e){return {ok:false,error:String(e.message||'تعذّر تنفيذ العملية.').slice(0,500)};}
 });
};
