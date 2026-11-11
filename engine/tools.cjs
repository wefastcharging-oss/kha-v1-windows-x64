'use strict';
const {spawn}=require('node:child_process');
const {dialog,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs');
module.exports=(app,ipc,win)=>{
 const tf=n=>path.join(__dirname,'tools',n);
 const exe=(dir,name)=>{const p=path.join(tf(dir),name);return fs.existsSync(p)?p:null;};
 const runTool=(file,args,send,timeoutMs=600000)=>new Promise((resolve,reject)=>{
  const p=spawn(file,args,{windowsHide:true,shell:false});
  let out='',done=false;
  const fin=code=>{if(done)return;done=true;resolve(code);};
  for(const s of [p.stdout,p.stderr]){s.setEncoding('utf8');s.on('data',d=>{out+=d;for(const line of d.split(/\r?\n/))if(line.trim())send(line.trimEnd());if(/press any key/i.test(d)){try{p.kill();}catch{}}});}
  p.on('error',err=>{if(!done){done=true;reject(err);}});
  p.on('close',code=>fin(code));
  setTimeout(()=>{try{p.kill();}catch{}fin(-1);},timeoutMs).unref();
 });
 ipc.handle('kha:tools',async(e,cmd,a={})=>{
  const w=win();if(!w||e.sender!==w.webContents)return{ok:false,error:'طلب غير موثوق.'};
  const send=m=>{if(!e.sender.isDestroyed())e.sender.send('tools:output',m);};
  try{
   if(typeof cmd!=='string'||!a||typeof a!=='object')throw Error('طلب غير صالح.');
   let v;
   switch(cmd){
    case 'status':v={depot:!!exe('depotdownloader','DepotDownloader.exe'),steamless:!!exe('steamless','Steamless.CLI.exe')};break;
    case 'pick':{const r=await dialog.showOpenDialog(w,{title:'kha - اختر ملف EXE',properties:['openFile'],filters:[{name:'EXE',extensions:['exe']}]});v=r.canceled?null:r.filePaths[0];break;}
    case 'depot':{
     const dd=exe('depotdownloader','DepotDownloader.exe');if(!dd)throw Error('DepotDownloader غير موجود في هذه النسخة.');
      const id=String(a.appid||'');if(!/^\d{1,12}$/.test(id))throw Error('App ID غير صالح.');
      const dirOut=String(a.dir||'').trim()||path.join(app.getPath('userData'),'depot-downloads',id);fs.mkdirSync(dirOut,{recursive:true});
      const args=['-app',id,'-dir',dirOut,'-max-downloads','8'];
      const dep=String(a.depot||'').trim();if(dep)args.push('-depot',dep);
      const man=String(a.manifest||'').trim();if(man)args.push('-manifest',man);
      const u=String(a.username||'').trim(),pw=String(a.password||'');
      if(u&&pw)args.push('-username',u,'-password',pw);else args.push('-username','anonymous');
      send('$ DepotDownloader -app '+id);
      const code=await runTool(dd,args,send);
      v={code,dir:dirOut};break;}
    case 'steamless':{
      const cli=exe('steamless','Steamless.CLI.exe');if(!cli)throw Error('Steamless غير موجود في هذه النسخة.');
       const f=String(a.file||'');if(!f||!f.toLowerCase().endsWith('.exe')||!fs.existsSync(f))throw Error('اختر ملف EXE صالح.');
       send('$ Steamless '+path.basename(f));
       const code=await runTool(cli,[f,'-keepattr'],send,180000);
       v={code};break;}
    case 'open-downloads':{const d=path.join(app.getPath('userData'),'depot-downloads');fs.mkdirSync(d,{recursive:true});const er=await shell.openPath(d);if(er)throw Error('تعذّر الفتح.');v=true;break;}
    default:throw Error('أمر غير معروف.');
   }
    return{ok:true,value:v};
  }catch(err){return{ok:false,error:String(err.message||'فشل').slice(0,400)};}
 });
};