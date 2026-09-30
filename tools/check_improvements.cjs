/* Focused integration checks. Uses an isolated browser profile and test-only hooks. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = process.env.OATHBOUND_URL || 'http://127.0.0.1:8765/';
const out = path.join(root, 'art/verification');
const source = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8')
  .replaceAll('requestAnimationFrame(frame);', '/* manual frames in integration checks */')
  .replace('loadImages().then(() => {', `loadImages().then(() => {
    window.__improve = { G, save, SFX, keys, encounters, shrines, enemies, projs, zones, telegraphs, floats,
      player: () => player, offered: () => offered, pending: () => pendingLevels,
      startRun, resetWorld, makePlayer, recacheStats, spawnEnemy, hurtEnemy, hurtPlayer,
      updateExploration, startEncounter, finishEncounter, updateEnemies, updateProjs,
      weaponTick, updateZones, rebuildHash, updatePlayer, director, updateCamera,
      render, paintHud, openLevelUp, pickCard, applyCard, cardView, rankPreview,
      weaponRankStats, awardChallenges, endRun, renderChallenges, unlockedModifier,
      view: () => ({ W, H, zoom }) };
  `);

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/js/game.js', route => route.fulfill({ contentType: 'text/javascript', body: source }));
    await page.addInitScript(() => {
      if (!localStorage.getItem('oathbound_v1')) localStorage.setItem('oathbound_v1', JSON.stringify({ gold:321, unlocked:['aldric','mara'], selected:'mara', perm:{hp:2,dmg:1,spd:0,luck:0}, wins:2 }));
    });
    await page.goto(base + '?boot=play');
    await page.waitForFunction(() => window.__improve?.player());
    const migration = await page.evaluate(() => { const q = window.__improve; return { gold:q.save.gold, selected:q.player().id, unlocked:q.save.unlocked, challenges:q.save.challenges, volume:q.save.settings.volume }; });
    assert.equal(migration.gold,321); assert.equal(migration.selected,'mara'); assert.deepEqual(migration.unlocked,['aldric','mara']); assert.deepEqual(migration.challenges,[]); assert.equal(migration.volume,.65);
    console.log('SAVE_MIGRATION PASS');
    await page.evaluate(() => {const q=window.__improve;q.player().x=850;q.player().y=850;});
    await page.keyboard.press('e');
    await page.evaluate(() => {const q=window.__improve;q.updateExploration(.01);if(q.encounters[0].state!=='active')throw Error('E failed to accept encounter');});
    console.log('ENCOUNTER_KEYBOARD PASS');
    const exploration = await page.evaluate(() => {
      const q=window.__improve; q.save.selected='aldric'; q.startRun(); const p=q.player(); p.inv=999;
      const assert = (ok,m) => { if(!ok) throw Error(m); };
      for(const e of q.encounters) {
        p.x=e.x; p.y=e.y; q.updateExploration(.01); assert(e.discovered,'discovery');
        q.startEncounter(e); assert(e.state==='active','start');
        if(e.kind==='defend') {
          p.x=e.x+250; q.updateExploration(5); assert(e.progress===0,'defend progresses outside');
          p.x=e.x; for(let i=0;i<21;i++) q.updateExploration(1);
          assert(p.shield>0,'chapel shield');
        } else if(e.kind==='altar'||e.kind==='champion') {
          const target=q.enemies.find(o=>o.encounter===e.id && (e.kind==='champion'||o.type==='altar'));
          assert(!!target,'encounter target');
          if(e.kind==='altar') { const x=target.x; q.updateEnemies(.01); assert(target.x===x,'altar moved'); }
          q.hurtEnemy(target,target.hp+100,false,p.x,p.y,'oathblade');
        } else {
          for(let wave=0;wave<3;wave++) {
            q.updateExploration(3);
            assert(q.enemies.some(o=>o.encounter===e.id&&o.hp>0),'missing gate wave');
            for(const target of q.enemies.filter(o=>o.encounter===e.id&&o.hp>0)) q.hurtEnemy(target,target.hp+1,false,p.x,p.y,'oathblade');
          }
          q.updateExploration(3);
        }
        assert(e.state==='complete','not completed '+e.id);
        assert(q.G.mode==='levelup','reward popup');
        assert(q.offered().every(c=>!['heal','gold'].includes(c.type)),'filler in event reward');
        const before=q.G.events; q.finishEncounter(e); assert(q.G.events===before,'duplicate event reward');
        q.pickCard(0); assert(q.G.mode==='play','event reward failed to resume');
      }
      assert(q.G.events===4&&q.G.gold>=200,'event count/gold');
      q.updateCamera(1); q.paintHud(); q.render();
      return q.encounters.map(e=>({id:e.id,state:e.state,discovered:e.discovered}));
    });
    console.log('FOUR_ENCOUNTERS PASS');
    await page.screenshot({path:path.join(out,'improvements-gate.png')});
    await page.evaluate(() => { const q=window.__improve; q.startRun(); q.player().x=850; q.player().y=850; q.updateExploration(.01); q.startEncounter(q.encounters[0]); q.updateCamera(1); q.paintHud(); q.render(); });
    await page.screenshot({path:path.join(out,'improvements-chapel.png')});
    await page.evaluate(() => { const q=window.__improve; q.player().x=2750; q.player().y=850; q.updateExploration(.01); q.startEncounter(q.encounters[1]); q.updateCamera(1); q.paintHud(); q.render(); });
    await page.screenshot({path:path.join(out,'improvements-graveyard.png')});
    await page.evaluate(() => { const q=window.__improve; q.startRun(); q.player().weapons=[{id:'oathblade',lv:5}]; q.openLevelUp(); });
    const before = await page.evaluate(()=>window.__improve.offered().map(c=>c.type+':'+c.id));
    await page.keyboard.press('r');
    const after = await page.evaluate(()=>({cards:window.__improve.offered().map(c=>c.type+':'+c.id),left:window.__improve.G.rerolls}));
    assert.equal(after.left,2); assert(after.cards.some(c=>!before.includes(c)),'reroll offered same cards');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('.card.selected .kind').innerText(), '3 · '+(await page.locator('.card').nth(2).locator('.kind').innerText()).split(' · ')[1]);
    await page.keyboard.press('r'); await page.keyboard.press('r'); await page.keyboard.press('r');
    assert.equal(await page.evaluate(()=>window.__improve.G.rerolls),0); assert(await page.locator('#btn-reroll').isDisabled());
    await page.screenshot({path:path.join(out,'improvements-blessings.png')});
    await page.keyboard.press('Enter'); assert.equal(await page.evaluate(()=>window.__improve.G.mode),'play');
    console.log('REROLL_KEYBOARD PASS');
    const combat = await page.evaluate(() => {
      const q=window.__improve; q.startRun(); const p=q.player(); q.enemies.length=0;
      p.weapons=[{id:'holy',lv:5},{id:'firebrand',lv:1}]; p.crit=0;
      q.weaponTick(.01);
      const holy=q.projs.find(pr=>pr.source==='holy'); if(!holy) throw Error('no holy projectile');
      const target=q.spawnEnemy('golem',holy.x+holy.vx*.01,holy.y+holy.vy*.01); target.hp=1000;
      q.rebuildHash(); q.updateProjs(.01);
      if(!q.G.damage.holy) throw Error('projectile attribution');
      const holyDamage=q.G.damage.holy;
      const original=q.G.damage.oathblade||0; q.hurtEnemy(target,5000,false,p.x,p.y,'oathblade');
      if(q.G.damage.oathblade-original>1000) throw Error('overkill counted');
      q.projs.length=0; q.enemies.length=0; q.G.damage={}; p.weapons=[{id:'oathblade',lv:1}]; p.lastX=1; p.lastY=0; q.keys.Space=true;
      q.updatePlayer(.016); q.keys.Space=false;
      const foe=q.spawnEnemy('golem',p.x+45,p.y); q.rebuildHash(); q.updateZones(.016);
      if(!q.G.damage['Sir Aldric · Dash']) throw Error('dash attribution');
      q.save.settings.numbers=true; q.floats.length=0;
      for(let i=0;i<15;i++) q.hurtEnemy(foe,1,true,p.x,p.y,'oathblade');
      if(q.floats.filter(f=>f.enemy===foe).length!==1) throw Error('numbers not aggregated');
      q.save.settings.numbers=false; const n=q.floats.length; q.hurtEnemy(foe,1,true,p.x,p.y,'oathblade'); if(q.floats.length!==n) throw Error('numbers setting ignored'); q.save.settings.numbers=true;
      const frost=q.weaponRankStats('frost',6); if(frost.spears!==3||frost.damage!==23) throw Error('frost preview');
      const holyStats=q.weaponRankStats('holy',5); if(holyStats.bolts!==8||holyStats.pierce!==3) throw Error('holy threshold');
      q.applyCard({type:'pnew',id:'rage'}); const preview=q.rankPreview({type:'wup',id:'oathblade'}); if(!preview.includes('12 → 15')) throw Error('rank preview');
      return {holy:holyDamage,dash:q.G.damage['Sir Aldric · Dash'],preview};
    });
    console.log('DAMAGE_ATTRIBUTION_PREVIEWS PASS');
    await page.evaluate(() => {
      const q=window.__improve; q.startRun(); q.enemies.length=0; q.player().inv=999;
      for (const id of ['hex','nightbloom','oathblade','holy','firebrand','frost','storm','thorn','bloodwell','grave','crown','judgment','dragon','glacier','tempest','worldthorn','crimson','soulstorm']) {
        q.player().weapons=[{id,lv:6}]; q.player().cd={}; q.projs.length=0;
        q.spawnEnemy('golem',q.player().x+60,q.player().y); q.rebuildHash();
        q.weaponTick(.016); q.updateProjs(.016);q.updateZones(.016);
        if(!q.rankPreview({type:'wup',id}).includes('damage')) throw Error('missing preview '+id);
      }
      q.player().weapons=[{id:'oathblade',lv:6}]; q.player().passives=[{id:'rage',lv:1}];
      q.applyCard({type:'evo',id:'crown',from:'oathblade'});
      if(!q.G.evolved||q.player().weapons[0].id!=='crown') throw Error('actual evolution reward trigger');
    });
    console.log('ALL_WEAPONS_EVOLUTION PASS');
    const challenges = await page.evaluate(() => {
      const q=window.__improve; q.startRun(); q.G.events=2; q.G.evolved=true; q.encounters.forEach(e=>e.discovered=true);
      const awards=q.awardChallenges(false).map(c=>c.id); if(awards.length!==3) throw Error('challenge awards');
      if(q.awardChallenges(false).length) throw Error('repeat challenge awards');
      if(!q.unlockedModifier('siege')||!q.unlockedModifier('pilgrim')) throw Error('modifiers locked');
      q.save.modifier='pilgrim'; q.startRun(); if(q.G.rerolls!==5) throw Error('reward rerolls');
      const hp=q.player().maxHp, speed=q.player().baseSpd;
      q.save.modifier='none'; q.startRun(); if(!(q.player().maxHp>hp&&q.player().baseSpd<speed)) throw Error('pilgrim tradeoff');
      q.save.modifier='siege'; q.startRun(); q.G.spawnAcc=0; q.G.t=0; q.director(1); if(Math.abs(q.G.spawnAcc-.864)>1e-6) throw Error('siege rate');
      q.G.events=0; q.G.evolved=false; q.G.damage={oathblade:300,holy:100}; const gold=q.save.gold; q.G.gold=100; q.G.kills=0; q.G.t=0; q.G.mode='dead'; q.G.lastHit='Bone Hydra · bone volley';
      q.endRun(false); const reward=q.save.gold-gold; if(reward!==125) throw Error('siege gold'); q.endRun(false); if(q.save.gold-gold!==125) throw Error('duplicate payout');
      return {awards,hp,speed,reward};
    });
    assert.equal(await page.locator('#end-cause').innerText(),'Fatal hit: Bone Hydra · bone volley');
    assert((await page.locator('#end-damage').innerText()).includes('75%'));
    console.log('CHALLENGES_MODIFIERS_REPORT PASS');
    await page.screenshot({path:path.join(out,'improvements-report.png')});
    await page.evaluate(() => {
      const q=window.__improve; q.save.challenges=[]; q.save.modifier='none'; q.startRun();
      q.G.events=2; q.G.evolved=true; q.encounters.forEach(e=>e.discovered=true); q.G.gold=q.G.kills=q.G.t=0; q.G.mode='dead';
      const gold=q.save.gold; q.endRun(false);
      if(q.save.gold-gold!==350) throw Error('end flow challenge payout');
      q.startRun(); q.G.events=2; q.G.evolved=true; q.encounters.forEach(e=>e.discovered=true); q.G.gold=q.G.kills=q.G.t=0; q.G.mode='dead';
      const again=q.save.gold; q.endRun(false); if(q.save.gold!==again) throw Error('reward repeated on next run');
    });
    console.log('ONE_TIME_CHALLENGE_PAYOUT PASS');
    await page.click('#end-menu'); await page.click('#btn-challenges');
    await page.screenshot({path:path.join(out,'improvements-challenges.png')});
    await page.click('#challenges-back'); await page.click('#btn-settings');
    await page.locator('#setting-volume').fill('0'); await page.locator('#setting-volume').dispatchEvent('input');
    await page.locator('#setting-motion').uncheck(); await page.click('#settings-back'); await page.click('#btn-play');
    await page.evaluate(()=>{const q=window.__improve;q.SFX.tick(.01);q.SFX.voice('bat');q.SFX.hit();});
    assert.equal(await page.evaluate(()=>window.__improve.save.settings.volume),0);
    await page.reload(); await page.waitForFunction(()=>window.__improve?.player());
    assert.equal(await page.evaluate(()=>window.__improve.save.settings.volume),0);
    assert.equal(await page.evaluate(()=>window.__improve.save.settings.motion),false);
    assert(await page.evaluate(()=>window.__improve.save.challenges.includes('smith')));
    console.log('SETTINGS_REWARD_PERSISTENCE PASS');
    // Verify fatal source through a real meteor update, not just report rendering.
    await page.evaluate(()=>{ const q=window.__improve; q.player().hp=1; q.player().inv=0; q.telegraphs.push({kind:'meteor',x:q.player().x,y:q.player().y,r:66,t:.98,life:1,dmg:100}); q.updateProjs(.05); });
    await page.waitForFunction(()=>document.getElementById('end-cause').textContent==='Fatal hit: The Dawn Eater · meteor');
    await page.setViewportSize({width:854,height:480});
    await page.click('#end-again');
    await page.evaluate(()=>{ const q=window.__improve;q.openLevelUp();q.paintHud();q.render(); });
    await page.screenshot({path:path.join(out,'improvements-small.png')});
    await page.setViewportSize({width:390,height:740});
    await page.screenshot({path:path.join(out,'improvements-mobile.png')});
    const layout=await page.evaluate(()=>{const panel=document.querySelector('#levelup .panel'),r=panel.getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,scroll:panel.scrollHeight>panel.clientHeight};});
    assert(layout.fits,'small blessing panel escapes viewport');
    // Real attacks can finish the altar with the starting build; events don't require debug damage.
    await page.evaluate(() => {
      const q=window.__improve; q.startRun(); q.enemies.length=0; q.player().inv=999;
      const e=q.encounters[1]; q.player().x=e.x+60; q.player().y=e.y; q.startEncounter(e);
      for(let i=0;i<1800 && e.state!=='complete';i++) {q.G.t+=.016; q.rebuildHash(); q.weaponTick(.016);q.updateProjs(.016);}
      if(e.state!=='complete') throw Error('starting weapon cannot destroy altar');
      while(q.G.mode==='levelup') q.pickCard(0);
      q.enemies.length=0;
      for(let i=0;i<340;i++) q.spawnEnemy('slime',1800,1800);
      const armory=q.encounters[2];q.startEncounter(armory);if(armory.state!=='ready') throw Error('capacity left empty active encounter');
    });
    console.log('ALTAR_GAMEPLAY_CAPACITY PASS');
    assert.deepEqual(errors,[],'browser runtime errors');
    fs.writeFileSync(path.join(out,'improvements-report.json'),JSON.stringify({status:'PASS',migration,exploration,combat,challenges,layout,browserErrors:errors},null,2)+'\n');
    console.log('IMPROVEMENTS_CHECK PASS');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
