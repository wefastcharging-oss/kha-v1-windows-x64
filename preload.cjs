const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('khaDesktop',{
 generateTicket:id=>ipcRenderer.invoke('ticket:generate',id),
 onTicketOutput:fn=>ipcRenderer.on('ticket:output',(_e,msg)=>fn(msg)),
 openGame:(id,store=false)=>ipcRenderer.invoke('open-game',id,store),
 request:(command,args={})=>ipcRenderer.invoke('kha:request',command,args),
 onJobs:callback=>{if(typeof callback!=='function')return ()=>{};const handler=(_event,jobs)=>callback(jobs);ipcRenderer.on('kha:jobs',handler);return ()=>ipcRenderer.removeListener('kha:jobs',handler);}
});
