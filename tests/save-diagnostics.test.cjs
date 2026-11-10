'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const Zip=require('adm-zip');
const {SteamEngine}=require('../engine/steam-engine.cjs');

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kha-v12-'));
 const steam=path.join(root,'Steam'),data=path.join(root,'data'),saves=path.join(root,'saves');
 fs.mkdirSync(path.join(steam,'steamapps'),{recursive:true});
 fs.mkdirSync(path.join(steam,'config'),{recursive:true});
 fs.mkdirSync(path.join(steam,'depotcache'),{recursive:true});
 fs.mkdirSync(saves,{recursive:true});
 fs.writeFileSync(path.join(steam,'steam.exe'),'fixture');
 const engine=new SteamEngine(data,{testMode:true});
 engine.setRoot(steam);
 return {root,steam,data,saves,engine};
}

test('creates and restores a save backup with a safety checkpoint',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(f.saves,'slot.dat'),'before');
 f.engine.setSaveFolder('10',f.saves);
 const first=f.engine.backupSave('10','Checkpoint');
 assert.equal(first.files,1);
 fs.writeFileSync(path.join(f.saves,'slot.dat'),'after');
 const restored=f.engine.restoreSave('10',first.id);
 assert.equal(fs.readFileSync(path.join(f.saves,'slot.dat'),'utf8'),'before');
 assert.equal(restored.restored,1);
 assert.equal(f.engine.saveBackups('10').length,2);
});

test('diagnostics and repair create the required local folders',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const result=f.engine.repairLocal();
 assert.equal(result.checks.find(x=>x.id==='steam-root').ok,true);
 assert.equal(fs.statSync(path.join(f.steam,'config','stplug-in')).isDirectory(),true);
 assert.equal(fs.statSync(path.join(f.data,'save-vault')).isDirectory(),true);
});

test('imports a ZIP save archive without extracting it immediately',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const archive=path.join(f.root,'import.zip'),zip=new Zip();
 zip.addFile('profile/slot1.dat',Buffer.from('save-data'));
 zip.writeZip(archive);
 const item=f.engine.importSaveBackup('20',archive);
 assert.equal(item.files,1);
 assert.equal(f.engine.saveBackups('20')[0].id,item.id);
 assert.equal(fs.existsSync(path.join(f.saves,'profile','slot1.dat')),false);
});

test('filters Steam redistributable entries from the installed games list',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const common=path.join(f.steam,'steamapps','common','Steamworks Shared');
 fs.mkdirSync(common,{recursive:true});
 fs.writeFileSync(path.join(f.steam,'steamapps','appmanifest_228980.acf'),'"AppState" { "appid" "228980" "name" "Steamworks Common Redistributables" "installdir" "Steamworks Shared" }');
 assert.equal(f.engine.installed().some(x=>x.appid==='228980'),false);
});
