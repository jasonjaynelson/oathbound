/* Mage integration check: isolated saves, real Blender assets, and test-only hooks. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=process.env.OATHBOUND_URL||'http://127.0.0.1:8765/';
const out=path.join(root,'art/verification');
const source=fs.readFileSync(path.join(root,'js/game.js'),'utf8')
 .replaceAll('requestAnimationFrame(frame);','/* manual frames */')
 .replace('loadImages().then(() => {',`loadImages().then(() => {
 window.__mage={G,save,keys,CHARS,enemies,projs,zones,player:()=>player,makePlayer,startRun,
 spawnEnemy,hurtEnemy,weaponTick,updatePlayer,updateProjs,updateZones,rebuildHash,recacheStats,
 applyCard,poolCards,rankPreview,renderChars,paintDock,paintHud,render,updateCamera};`);
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/js/game.js',route=>route.fulfill({contentType:'text/javascript',body:source}));
 await page.addInitScript(()=>{if(!localStorage.getItem('oathbound_v1'))localStorage.setItem('oathbound_v1',JSON.stringify({gold:500,unlocked:['aldric'],selected:'aldric',perm:{hp:0,dmg:0,spd:0,luck:0}}));});
 await page.goto(base);await page.waitForFunction(()=>window.__mage);
 await page.click('#btn-chars');
 const card=page.locator('.char-card').nth(1);assert((await card.innerText()).includes('Lady Mara'));assert((await card.innerText()).includes('500 gold'));
 await card.click();
 assert.equal(await page.evaluate(()=>window.__mage.save.gold),0);assert(await page.evaluate(()=>window.__mage.save.unlocked.includes('mara')));
 await page.screenshot({path:path.join(out,'mage-selection.png')});
 await page.click('#chars-back');await page.click('#btn-play');
 await page.waitForFunction(()=>window.OathArt.stats().actors.includes('mara'));
 assert.equal(await page.evaluate(()=>window.__mage.player().weapons[0].id),'hex');
 const spells=await page.evaluate(()=>{
 const q=window.__mage,p=q.player();q.enemies.length=0;q.projs.length=0;p.inv=999;p.crit=0;
 const target=q.spawnEnemy('golem',p.x+160,p.y),near=q.spawnEnemy('golem',p.x+178,p.y+18);target.hp=near.hp=1000;
 q.rebuildHash();q.weaponTick(.01);const pr=q.projs.find(pr=>pr.source==='hex');if(!pr)throw Error('starter did not cast');
 target.y+=45;const angle=pr.a;
 for(let i=0;i<80&&target.hp===1000;i++){q.rebuildHash();q.updateProjs(.016);}
 if(target.hp===1000||near.hp===1000)throw Error('homing/splash missed');
 if(target.slow<=0||near.slow<=0)throw Error('curse did not bind');
 if(!q.G.damage.hex||Math.abs(pr.a-angle)<.01)throw Error('homing/attribution');
 if(p.castUntil<=0)throw Error('cast animation never triggered');
 return {targetDamage:1000-target.hp,splashDamage:1000-near.hp,source:q.G.damage.hex};
 });console.log('HEX_HOMING_SPLASH_BIND PASS');
 const passive=await page.evaluate(()=>{
 const q=window.__mage,p=q.player();p.hp=30;q.G.t=10;
 const kill=(source)=>{const e=q.spawnEnemy('slime',p.x+200,p.y);e.hp=1;q.hurtEnemy(e,2,false,p.x,p.y,source);};
 for(let i=0;i<5;i++)kill('hex');if(p.hp!==33)throw Error('Witchblood cap');
 kill('holy');if(p.hp!==33)throw Error('unrelated weapon heals');
 q.G.t=10.9;kill('hex');if(p.hp!==33)throw Error('cap reset too early');
 q.G.t=11.1;kill('nightbloom');if(p.hp!==34)throw Error('siphon failed to reset');
 p.hp=p.maxHp;kill('hex');if(p.hp>p.maxHp)throw Error('overheal');
 return {cap:3,resets:true};
 });console.log('WITCHBLOOD_PASSIVE_CAP PASS');
 const dash=await page.evaluate(()=>{
 const q=window.__mage,p=q.player();q.enemies.length=0;q.zones.length=0;p.dash=p.dashCd=0;p.lastX=1;p.lastY=0;p.dashHeld=false;
 q.keys.Space=true;q.updatePlayer(.016);q.keys.Space=false;
 const z=q.zones.find(z=>z.kind==='veil');if(!z||p.dash<=0)throw Error('Veilstep not created');
 const origin=z.x;p.x+=200;const e=q.spawnEnemy('golem',z.x-40,z.y);e.hp=1000;
 q.rebuildHash();q.updateZones(.016);if(e.hp>=1000||e.slow<.8)throw Error('sigil damage/bind');
 if(z.x!==origin||!q.G.damage['Lady Mara · Dash'])throw Error('sigil follows or attribution lost');
 q.updateZones(2.6);if(q.zones.some(z=>z.kind==='veil'))throw Error('sigil never expired');
 return {stationary:true,bind:.8,duration:2.5};
 });console.log('VEILSTEP_DASH PASS');
 const evolution=await page.evaluate(()=>{
 const q=window.__mage,p=q.player();p.weapons=[{id:'hex',lv:6}];p.passives=[{id:'focus',lv:1}];q.recacheStats();
 if(!q.poolCards().some(c=>c.id==='nightbloom'&&c.type==='evo'))throw Error('evolution unavailable');
 const preview=q.rankPreview({type:'wup',id:'hex'});if(!preview.includes('curses 2 → 3'))throw Error('rank-seven curse threshold');
 q.applyCard({type:'evo',id:'nightbloom',from:'hex'});if(p.weapons[0].id!=='nightbloom'||p.weapons[0].lv!==6)throw Error('evolution replacement');
 q.projs.length=0;p.cd={};q.weaponTick(.016);
 const curses=q.projs.filter(pr=>pr.source==='nightbloom');if(curses.length!==3||curses[0].blast<98)throw Error('Nightbloom does not flower');
 return {curses:curses.length,blast:curses[0].blast,preview};
 });console.log('NIGHTBLOOM_EVOLUTION PASS');
 await page.evaluate(()=>{const q=window.__mage;q.startRun();q.enemies.length=0;q.player().inv=0;q.paintHud();q.render();});
 await page.screenshot({path:path.join(out,'mage-gameplay.png')});
 await page.evaluate(()=>{const q=window.__mage,p=q.player();q.enemies.length=0;p.inv=0;p.weapons=[{id:'nightbloom',lv:6}];p.passives=[{id:'focus',lv:1}];q.recacheStats();p.dashCd=0;p.lastX=1;p.lastY=0;q.keys.Space=true;q.updatePlayer(.016);q.keys.Space=false;
 for(let i=0;i<9;i++)q.spawnEnemy('golem',p.x+80+Math.cos(i)*40,p.y+Math.sin(i)*65);q.rebuildHash();q.weaponTick(.016);for(let i=0;i<18;i++)q.updateProjs(.016);p.dash=0;p.inv=0;q.paintDock();q.paintHud();q.render();});
 await page.screenshot({path:path.join(out,'mage-spells.png')});
 // Old stored unlock/selection still routes to the same actor identifier after reload.
 await page.reload();await page.waitForFunction(()=>window.__mage);assert.equal(await page.evaluate(()=>window.__mage.save.selected),'mara');
 await page.goto(base+'?boot=play&art=legacy');await page.waitForFunction(()=>window.__mage?.player());await page.evaluate(()=>{window.__mage.paintHud();window.__mage.render();});await page.screenshot({path:path.join(out,'mage-fallback.png')});
 await page.goto(base+'art/preview.html');await page.waitForFunction(()=>window.galleryReady);await page.selectOption('#clip','cast');await page.selectOption('#direction','north');await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'mage-gallery.png'),fullPage:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/asset-manifest.json'),'utf8')),actor=manifest.actors.mara;
 assert(actor.clips.cast);assert.equal(actor.sourceSize,192);assert.equal(actor.directions.length,4);
 for(const clip of Object.values(actor.clips))for(const rects of Object.values(clip.directions))assert.equal(rects.length,clip.count);
 assert(manifest.icons.hex&&manifest.icons.nightbloom);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'mage-report.json'),JSON.stringify({status:'PASS',spells,passive,dash,evolution,art:{directions:4,clips:Object.keys(actor.clips),sourceSize:actor.sourceSize},browserErrors:errors},null,2)+'\n');console.log('MAGE_CHECK PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
