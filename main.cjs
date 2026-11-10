const {app,BrowserWindow,ipcMain,shell} = require('electron');
const path = require('node:path');
let win;
app.setName('kha');
app.setAppUserModelId('app.kha.library');
if(!app.requestSingleInstanceLock()){app.quit();}else{
 function createWindow(){
  win=new BrowserWindow({width:1440,height:980,minWidth:800,minHeight:640,backgroundColor:'#101111',title:'kha',icon:path.join(__dirname,'assets/kha.ico'),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.loadFile('index.html');
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.on('closed',()=>{win=null});
 }
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(()=>{
  createWindow();
  require('./engine/ticket.cjs')(app,ipcMain,()=>win);
  require('./engine/desktop.cjs')(app,ipcMain,()=>win);
  ipcMain.handle('open-game',async(event,id,store)=>{
   if(!win||event.sender!==win.webContents||!/^\d{1,12}$/.test(String(id)))return false;
   await shell.openExternal(store===true?`https://store.steampowered.com/app/${id}/`:`steam://rungameid/${id}`);return true;
  });
 });
 app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
}
