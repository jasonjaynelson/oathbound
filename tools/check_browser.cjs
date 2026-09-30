/* Browser verification. Requires Playwright via node_modules or NODE_PATH. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "art", "verification");
fs.mkdirSync(out, { recursive: true });
const baseline = process.argv.includes("--baseline");
const base = process.env.OATHBOUND_URL || "http://127.0.0.1:8876/oathbound/";
const sourcePath = baseline ? "/tmp/oathbound-before/js/game.js" : path.join(root, "js/game.js");
let source = fs.readFileSync(sourcePath, "utf8");
source = source.replace("loadImages().then(() => {", `loadImages().then(() => {
  window.__qa = { G, enemies, projs, pickups, shrines, parts, zones, keys,
    player: () => player, spawnEnemy, makePlayer, recacheStats, resetWorld,
    drawKnight, drawEnemy, render, updatePlayer, updateEnemies, updateShrines, weaponTick,
    updateProjs, updateZones, updateEnemyProjs, updatePickups, updateFx,
    hurtPlayer, hurtEnemy, director, startRun, pauseGame, resumeGame,
    save, IM, CHARS, ENEMY, telegraphs, runSelfTest, paintDock,
    frameTimes: [], renderTimes: [] };
`);
source = source.replace("function frame(now) {", "function frame(now) { const qaStart = performance.now();");
source = source.replace("      director(dt);", "      if (!window.__qa.stress) director(dt);");
source = source.replace("    render();\n    requestAnimationFrame(frame);", `
    const qaRender = performance.now(); render();
    if (window.__qa) {
      window.__qa.frameTimes.push(performance.now() - qaStart);
      window.__qa.renderTimes.push(performance.now() - qaRender);
    }
    requestAnimationFrame(frame);`);

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return +(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0).toFixed(3);
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/js/game.js", route => route.fulfill({ contentType: "text/javascript", body: source }));
  await page.addInitScript(() => {
    let seed = 37291;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  const report = { version: baseline ? "baseline" : "blender", scenarios: [] };
  await page.goto(base + "?boot=test");
  await page.waitForFunction(() => document.title === "PASS" || document.title.startsWith("FAIL"));
  assert.equal(await page.title(), "PASS", "existing game self-test");
  report.selfTest = "PASS";
  console.log("SELF_TEST PASS");
  await page.goto(base + "?boot=play");
  await page.waitForFunction(() => window.__qa && window.__qa.player());
  if (!baseline) await page.waitForTimeout(1500);
  for (const count of [100, 340]) {
    await page.evaluate(count => {
      const q = window.__qa;
      q.resetWorld(); q.makePlayer("aldric"); q.recacheStats();
      const p = q.player();
      p.inv = 999999; p.next = 9999999;
      p.weapons = [{ id: "crown", lv: 6 }, { id: "tempest", lv: 6 }, { id: "crimson", lv: 6 }];
      q.recacheStats(); q.paintDock();
      q.G.mode = "pause"; q.G.t = 240; q.stress = true;
      document.querySelectorAll("#overlay .layer").forEach(el => el.classList.remove("show"));
      for (let i = 0; i < count; i++) {
        const angle = i * 2.3999632297;
        const radius = 80 + 310 * Math.sqrt(i / count);
        const e = q.spawnEnemy(["skeleton", "slime", "bat", "shade", "wight", "golem"][i % 6],
          p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius);
        e.hp = e.maxHp = 99999999;
      }
      const boss = q.spawnEnemy("duke", p.x, p.y - 210); boss.hp = boss.maxHp = 99999999;
      q.frameTimes.length = 0; q.renderTimes.length = 0;
    }, count);
    await page.waitForTimeout(800);
    await page.evaluate(() => { window.__qa.frameTimes.length = 0; window.__qa.renderTimes.length = 0; });
    await page.waitForFunction(() => window.__qa.frameTimes.length >= 180, { timeout: 20000 });
    const samples = await page.evaluate(() => ({ frame: window.__qa.frameTimes.slice(-180), render: window.__qa.renderTimes.slice(-180) }));
    const timing = { enemies: count, renderMedianMs: percentile(samples.render, .5), renderP95Ms: percentile(samples.render, .95) };
    await page.evaluate(() => { const q = window.__qa; q.G.mode = "play"; q.frameTimes.length = 0; q.renderTimes.length = 0; });
    await page.waitForFunction(() => window.__qa.frameTimes.length >= 180, { timeout: 20000 });
    const updates = await page.evaluate(() => { window.__qa.G.mode = "pause"; return window.__qa.frameTimes.slice(-180); });
    timing.updateAndRenderMedianMs = percentile(updates, .5);
    timing.updateAndRenderP95Ms = percentile(updates, .95);
    report.scenarios.push(timing);
    await page.screenshot({ path: path.join(out, `${report.version}-${count}.png`) });
    console.log(JSON.stringify(timing));
  }
  if (!baseline) {
    await page.evaluate(async () => {
      const manifest = await fetch("assets/asset-manifest.json").then(r => r.json());
      await Promise.all(Object.keys(manifest.actors).map(window.OathArt.requestActor));
    });
    report.art = await page.evaluate(() => window.OathArt.stats());
    assert.equal(report.art.actors.length, 12, "all actor atlases loaded");
    for (const id of ["aldric", "mara", "hollow"]) {
      await page.evaluate(id => {
        const q = window.__qa; q.resetWorld(); q.makePlayer(id); q.recacheStats();
        q.G.mode = "play"; q.player().inv = 999999; q.player().next = 999999;
        q.stress = true;
        q.keys.KeyD = true;
      }, id);
      await page.waitForTimeout(160);
      await page.evaluate(() => { window.__qa.keys.Space = true; });
      await page.waitForTimeout(50);
      assert(await page.evaluate(() => window.__qa.player().dash > 0), id + " dash");
      await page.evaluate(() => { window.__qa.keys.KeyD = false; window.__qa.keys.Space = false; window.__qa.G.mode = "pause"; });
    }
    report.knightDash = "PASS";
    const mechanics = await page.evaluate(() => {
      const q = window.__qa;
      const setup = () => { q.resetWorld(); q.makePlayer("aldric"); q.recacheStats(); q.G.mode = "play"; q.player().inv = 999999; q.player().next = 999999; };
      setup();
      let e = q.spawnEnemy("hydra", 1980, 1800);
      e.cd = 9; e.atkT = 4.3;
      q.updateEnemies(.01);
      const hydraWarning = e.state === "tel" && e.vx === 0 && e.vy === 0 && q.telegraphs.some(t => t.kind === "line");
      q.updateEnemies(.30);
      const hydraLunge = e.state === "lunge" && Math.hypot(e.vx, e.vy) > 400;
      e.hp = e.maxHp * .5; q.updateEnemies(.01);
      const hydraSplit = q.enemies.filter(e => e.type === "hydra").length === 2;
      setup(); e = q.spawnEnemy("duke", 1980, 1800); e.hp = e.maxHp * .6;
      q.updateEnemies(.01); const dukePhase = e.phase === 2;
      setup(); e = q.spawnEnemy("eater", 1980, 1800); e.cd = .01;
      q.updateEnemies(.05); const meteor = q.telegraphs.some(t => t.kind === "meteor");
      e.hp = e.maxHp * .4; q.updateEnemies(.01); const eaterPhase = e.phase === 2;
      setup(); const s = q.shrines.find(s => s.kind === "wind");
      q.player().x = s.x; q.player().y = s.y; q.updateShrines(.016);
      const shrine = s.t > 0 && q.player().buffs.wind > 0;
      q.G.mode = "pause";
      return { hydraWarning, hydraLunge, hydraSplit, dukePhase, meteor, eaterPhase, shrine };
    });
    for (const [name, result] of Object.entries(mechanics)) assert(result, name);
    report.mechanics = mechanics;
    await page.setViewportSize({ width: 854, height: 480 });
    await page.goto(base + "?boot=play");
    await page.waitForFunction(() => window.__qa && window.__qa.player());
    await page.evaluate(() => { window.__qa.G.mode = "pause"; });
    await page.screenshot({ path: path.join(out, "blender-small.png") });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(base + "art/preview.html");
    await page.waitForFunction(() => window.galleryReady);
    await page.screenshot({ path: path.join(out, "blender-gallery.png"), fullPage: true });
    for (const clip of ["run", "dash", "hurt", "death", "tel", "slam", "cast"]) {
      await page.selectOption("#clip", clip);
      await page.waitForTimeout(100);
    }
    report.gallery = "PASS";
    await page.route("**/assets/atlases/aldric.png", route => route.abort());
    await page.goto(base + "?boot=play");
    await page.waitForFunction(() => window.__qa && window.__qa.player());
    await page.evaluate(() => { window.__qa.G.mode = "pause"; window.__qa.render(); });
    assert(!(await page.evaluate(() => window.OathArt.stats().actors)).includes("aldric"), "missing atlas uses original fallback");
    report.missingAtlasFallback = "PASS";
  }
  assert.deepEqual(errors, [], "browser runtime errors");
  report.browserErrors = errors;
  report.measurement = "Headless Chromium, 1280x720, DPR 1. JavaScript frame submission cost; not GPU completion time or a real-display FPS benchmark.";
  fs.writeFileSync(path.join(out, report.version + "-report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
  console.log("BROWSER_CHECK PASS");
})().catch(error => { console.error(error); process.exit(1); });
