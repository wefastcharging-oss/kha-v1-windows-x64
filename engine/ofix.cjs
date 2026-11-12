'use strict';
module.exports=(app,ipc,win)=>{
 ipc.handle('kha:ofix',async(e,cmd,a={})=>{
  const w=win();if(!w||e.sender!==w.webContents)return{ok:false,error:'طلب غير موثوق.'};
  try{
   if(cmd==='search'){
     const q=String(a.q||'').trim();if(!q)throw Error('اكتب اسم اللعبة.');
      const u='https://online-fix.me/index.php?do=search&subaction=search&story='+encodeURIComponent(q);
       const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) kha/1.7'}});
       const t=await r.text();
       const out=[];const re=/<a href="(https:\/\/online-fix\.me\/\d+-[^"]+\.html)"[^>]*>([^<]{1,120})</g;let m;
       while((m=re.exec(t))&&out.length<25)out.push({url:m[1],title:m[2].trim()});
       if(!out.length)throw Error('لا نتائج أو تعذّر الوصول للموقع.');
       return{ok:true,value:out};
    }
    if(cmd==='open'){const {shell}=require('electron');await shell.openExternal(String(a.url||''));return{ok:true,value:true};}
    throw Error('أمر غير معروف.');
  }catch(err){return{ok:false,error:String(err.message).slice(0,300)};}
 });
};