'use strict';
const {dialog,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs'),fsp=require('node:fs/promises');
const {fetchLua}=require('./lua-source.cjs');
module.exports=function attach(app,ipcMain,getWindow,getSteamRoot){
 const apF=path.join(app.getPath('userData'),'fixes','applied.json');
 const rj=()=>{try{return JSON.parse(fs.readFileSync(apF,'utf8'));}catch{return{};}};
 const wj=v=>{fs.mkdirSync(path.dirname(apF),{recursive:true});fs.writeFileSync(apF,JSON.stringify(v,null,2));};
 const root=()=>{const r=getSteamRoot();if(!r)throw Error('حدّد مجلد Steam أولًا.');return r;};
 const dir=()=>path.join(root(),'config','stplug-in');
 const bak=()=>path.join(dir(),'.kha-fix');
 async function save(f,tag){if(!fs.existsSync(f))return;fs.mkdirSync(bak(),{recursive:true});await fsp.copyFile(f,path.join(bak(),tag+'.bak'));}
 ipcMain.handle('kha:lua',async(e,cmd,a={})=>{
  const win=getWindow();if(!win||e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)return{ok:false,error:'طلب غير موثوق.'};
  try{
   if(typeof cmd!=='string'||!a||typeof a!=='object')throw Error('طلب غير صالح.');
   const id=String(a.appid||'');if(!/^\d{1,12}$/.test(id))throw Error('App ID غير صالح.');
   let v;
   switch(cmd){
    case 'status':{const ap=rj();v={installed:!!ap['lua-'+id],source:ap['lua-'+id]?.source||''};break;}
    case 'get':{
     const d=dir();fs.mkdirSync(d,{recursive:true});
     const out=await fetchLua(id);
     const target=path.join(d,id+'.lua');
     await save(target,id+'.lua');
     await fsp.writeFile(target,out.lua,'utf8');
     if(out.keyVdf){const kf=path.join(root(),'key.vdf');await save(kf,'key.vdf');await fsp.writeFile(kf,out.keyVdf,'utf8');}
     const ap=rj();ap['lua-'+id]={appid:id,source:out.source,date:Date.now()};wj(ap);
     v={file:target,source:out.source,bytes:Buffer.byteLength(out.lua)};break;}
    case 'revert':{
     const ap=rj();if(!ap['lua-'+id])throw Error('لا نسخة رجوع.');
     const {response}=await dialog.showMessageBox(win,{type:'warning',title:'kha — تأكيد',message:'إزالة Lua للعبة '+id+'؟',detail:'سيُحذف الملف من stplug-in وتُستعاد النسخة السابقة إن وجدت.',buttons:['إلغاء','متابعة'],defaultId:0,cancelId:0,noLink:true});
     if(response!==1)return{ok:true,value:null};
     const target=path.join(dir(),id+'.lua'),b=path.join(bak(),id+'.lua.bak');
     if(fs.existsSync(b))await fsp.copyFile(b,target);else await fsp.rm(target,{force:true});
     const kb=path.join(bak(),'key.vdf.bak');
     if(fs.existsSync(kb))await fsp.copyFile(kb,path.join(root(),'key.vdf'));
     delete ap['lua-'+id];wj(ap);v=true;break;}
    case 'open':{const d=dir();fs.mkdirSync(d,{recursive:true});const er=await shell.openPath(d);if(er)throw Error('تعذّر الفتح.');v=true;break;}
    default:throw Error('أمر غير معروف.');
   }
   return{ok:true,value:v};
  }catch(err){return{ok:false,error:String(err.message||'فشل').slice(0,400)};}
 });
};
