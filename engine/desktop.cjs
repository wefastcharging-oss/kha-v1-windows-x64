'use strict';
const {dialog,shell,safeStorage}=require('electron');const path=require('node:path');const fs=require('node:fs');const {SteamEngine}=require('./steam-engine.cjs');const C=require('./service-config.cjs');
module.exports=function attach(app,ipcMain,getWindow){const engine=new SteamEngine(path.join(app.getPath('userData'),'steam-manager'),{protect:s=>safeStorage.isEncryptionAvailable()?safeStorage.encryptString(s):null,unprotect:b=>safeStorage.decryptString(b)});engine.detect();engine.on('jobs',jobs=>{const w=getWindow();if(w&&!w.isDestroyed())w.webContents.send('kha:jobs',jobs);});
 const confirm=async(message,detail)=>{const {response}=await dialog.showMessageBox(getWindow(),{type:'warning',title:'kha — تأكيد تعديل ملفات Steam',message,detail,buttons:['إلغاء','متابعة'],defaultId:0,cancelId:0,noLink:true});if(response!==1)throw Error('أُلغي الإجراء دون تغيير الملفات.');};
 const mutate=async(message,detail,fn)=>{await confirm(message,detail);return fn();};
 ipcMain.handle('kha:request',async(event,command,args={})=>{const win=getWindow();if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)return {ok:false,error:'طلب غير موثوق.'};try{if(typeof command!=='string'||!args||typeof args!=='object'||JSON.stringify(args).length>16000)throw Error('طلب غير صالح.');let value;switch(command){
  case 'status':value=engine.detect();break;
  case 'choose-steam':{const result=await dialog.showOpenDialog(win,{title:'اختر مجلد Steam الذي يحتوي steam.exe',properties:['openDirectory']});value=result.canceled?null:engine.setRoot(result.filePaths[0]);break;}
  case 'auto-update':if(typeof args.value!=='boolean')throw Error('قيمة غير صالحة.');engine.prefs.autoUpdate=args.value;engine.savePrefs();value=engine.status();break;
  case 'installed':value=engine.installed();break;
  case 'save-profiles':value=engine.saveProfiles();break;
  case 'choose-save-folder':{const game=engine.installed().find(g=>g.appid===String(args.appid));const result=await dialog.showOpenDialog(win,{title:'اختر مجلد ملفات الحفظ'+(game?' — '+game.name:''),properties:['openDirectory']});value=result.canceled?null:engine.setSaveFolder(args.appid,result.filePaths[0]);break;}
  case 'backup-save':value=engine.backupSave(args.appid,args.label);break;
  case 'import-save':{const result=await dialog.showOpenDialog(win,{title:'استيراد نسخة حفظ ZIP',properties:['openFile'],filters:[{name:'Save backup',extensions:['zip']}]});value=result.canceled?null:engine.importSaveBackup(args.appid,result.filePaths[0]);break;}
  case 'restore-save':value=await mutate('استعادة ملفات الحفظ؟','سيتم إنشاء نسخة أمان من الوضع الحالي أولًا، ثم ستُكتب ملفات النسخة المحددة داخل مجلد الحفظ.',()=>engine.restoreSave(args.appid,args.id));break;
  case 'diagnostics':value=engine.diagnostics();break;
  case 'repair-local':value=engine.repairLocal();break;
  case 'list':value=engine.list();break;
  case 'details':value=engine.details(args.appid);break;
  case 'import':{const result=await dialog.showOpenDialog(win,{title:'استيراد Lua / Manifest / ZIP',properties:['openFile','multiSelections'],filters:[{name:'Steam configuration',extensions:['lua','manifest','zip']}]});value=result.canceled?null:engine.inspect(result.filePaths);break;}
  case 'install':{const s=engine.stageSummary(args.stageId);value=await mutate('تثبيت الملفات داخل مجلد Steam؟',`${s.files.map(f=>f.name).join('\n')}\n\nالوجهة: ${engine.root}\nستُحفظ نسخة احتياطية تلقائية قبل أي استبدال. أغلق Steam أولًا. يتطلب Lua محمّلًا متوافقًا مثبتًا مسبقًا.`,()=>engine.install(args.stageId));break;}
  case 'edit':if(typeof args.value!=='boolean'||typeof args.expected!=='string')throw Error('طلب تعديل غير صالح.');value=await mutate('تعديل إعداد Depot '+args.depot+'؟','سيُحفظ الملف مع نسخة احتياطية. حدّث Steam بعد إتمام تعديلاتك.',()=>engine.change(args.appid,args.depot,args.kind,args.value,args.expected));break;
  case 'pin':if(typeof args.expected!=='string')throw Error('بصمة غير صالحة.');value=await mutate('تثبيت Manifest محدد لهذا Depot؟','تغيير المعرف لا ينزّل ملف Manifest. يجب أن يكون الملف المناسب موجودًا في depotcache أو تثبّته بنفسك.',()=>engine.setPin(args.appid,args.depot,args.manifestId,args.expected));break;
  case 'capture':value=engine.capture(args.appid,args.label);break;
  case 'activate':value=await mutate('تفعيل الإصدار المحفوظ؟','ستُستبدل إعدادات Lua الحالية فقط، مع نسخة احتياطية. لا ينزّل هذا ملفات اللعبة أو ملفات Manifest المفقودة.',()=>engine.activate(args.appid,args.versionId,args.expected));break;
  case 'backups':value=engine.backups();break;
  case 'restore':value=await mutate('التراجع إلى الملفات قبل هذه العملية؟','سيُرفض التراجع إذا تغيّرت الملفات بعد العملية؛ لن تُكتب تعديلاتك الخارجية فوقها.',()=>engine.restore(args.id));break;
  case 'search':value=await engine.search(args.query);break;
  case 'game':value=await engine.game(args.appid);break;
  case 'sources':await confirm('فحص توفر المصادر عبر خادم LuaTools؟','التنفيذ الأصلي يستخدم اتصال HTTP غير مشفّر إلى 167.235.229.108. سيُرسل App ID فقط، دون رمز حساب أو كلمة مرور. يمكنك الإلغاء واختيار مصدر يدويًا.');value=await engine.sources(args.appid);break;
  case 'download':value=await engine.download(args.appid,args.source,args.name);break;
  case 'jobs':value=engine.jobList();break;
  case 'cancel-download':engine.cancelDownload(args.id);value=true;break;
  case 'restage':value=engine.restage(args.id);break;
  case 'login':value=await engine.login(url=>shell.openExternal(url));break;
  case 'cancel-login':engine.cancelLogin();value=true;break;
  case 'logout':value=engine.logout();break;
  case 'open-service':await shell.openExternal(C.apiBase);value=true;break;
  case 'open-folder':{const choices={steam:()=>engine.root,lua:()=>path.join(engine.root,'config','stplug-in'),manifests:()=>path.join(engine.root,'depotcache'),backups:()=>path.join(engine.base,'backups'),saves:()=>engine.prefs.saveFolders[String(args.appid)],'save-vault':()=>path.join(engine.base,'save-vault')};if(!choices[args.which])throw Error('مجلد غير صالح.');const p=choices[args.which]();if(args.which==='save-vault')fs.mkdirSync(p,{recursive:true});if(!p||!fs.existsSync(p))throw Error('المجلد غير موجود بعد.');const error=await shell.openPath(p);if(error)throw Error('تعذّر فتح المجلد.');value=true;break;}
  default:throw Error('أمر غير معروف.');
 }return {ok:true,value};}catch(e){return {ok:false,error:String(e.message||'تعذّر تنفيذ العملية.').slice(0,500)};}});
 app.on('before-quit',()=>{engine.cancelLogin();for(const c of engine.controllers.values())c.abort();});return engine;
};
