/* Run with Playwright available through node_modules or NODE_PATH. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const base = process.env.OATHBOUND_URL || "http://127.0.0.1:8876/oathbound/";
const out = path.join(root, "art", "verification");
fs.mkdirSync(out, { recursive: true });
const source = fs.readFileSync(path.join(root, "js/game.js"), "utf8")
  .replace("loadImages().then(() => {", `loadImages().then(() => {
    window.__arena = { G, KEEP, cam, keys, obstacles, shrines, enemies, resetWorld,
      makePlayer, updatePlayer, updateCamera, approachPoint, director, render,
      player: () => player, view: () => ({ W, H, zoom }) };
  `);

(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/js/game.js", route => route.fulfill({ contentType: "text/javascript", body: source }));
    await page.goto(base + "?boot=test");
    await page.waitForFunction(() => document.title === "PASS" || document.title.startsWith("FAIL"));
    assert.equal(await page.title(), "PASS", "game self-test");
    await page.goto(base + "?boot=play");
    await page.waitForFunction(() => window.__arena && window.__arena.player());
    await page.evaluate(() => { window.__arena.G.mode = "pause"; });
    const report = [];
    for (const [width, height] of [[1280, 720], [1920, 1080], [854, 480], [3840, 2160], [5120, 1440]]) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(([w, h]) => window.__arena.view().W === w && window.__arena.view().H === h, [width, height]);
      const checks = await page.evaluate(() => {
        const q = window.__arena;
        q.resetWorld(); q.makePlayer("aldric"); q.G.mode = "pause";
        const p = q.player(), inner = q.KEEP.inner, { W, H, zoom } = q.view();
        const halfW = W / (2 * zoom), halfH = H / (2 * zoom);
        const contains = o => o.x >= inner.x + o.r && o.x <= inner.x + inner.w - o.r &&
          o.y >= inner.y + o.r && o.y <= inner.y + inner.h - o.r;
        let cameraBounds = true, spawnsOutside = true, spawnsInside = true;
        for (const [x, y] of [[1800,1800], [300,300], [3300,300], [300,3300], [3300,3300]]) {
          p.x = x; p.y = y; q.updateCamera(1);
          cameraBounds &&= q.cam.x - halfW >= q.KEEP.x - .01 && q.cam.x + halfW <= q.KEEP.x + q.KEEP.w + .01 &&
            q.cam.y - halfH >= q.KEEP.y - .01 && q.cam.y + halfH <= q.KEEP.y + q.KEEP.h + .01;
          for (let n = 0; n < 60; n++) {
            const at = q.approachPoint();
            spawnsOutside &&= Math.abs(at.x - q.cam.x) > halfW || Math.abs(at.y - q.cam.y) > halfH;
            spawnsInside &&= contains({ ...at, r: 32 });
          }
        }
        // Stay clear of the pillars along the central east/west aisle.
        p.x = 1800; p.y = 1740; p.vx = p.vy = 0;
        q.keys.KeyD = true;
        for (let n = 0; n < 420; n++) { q.updatePlayer(1 / 60); q.updateCamera(.12); }
        q.keys.KeyD = false;
        const travelsBeyondOldArena = p.x > 2300;
        const follows = Math.abs(q.cam.x - Math.min(p.x, q.KEEP.x + q.KEEP.w - halfW)) < 35;
        p.x = inner.x + 1; p.y = inner.y + 1;
        q.updatePlayer(1 / 60);
        const collision = contains(p);
        p.x = 1800; p.y = 1800; q.updateCamera(1);
        q.G.spawnAcc = 1; q.director(0);
        const combat = q.enemies.length > 0;
        return { width: W, height: H, zoom, extends: inner.w > W / zoom && inner.h > H / zoom,
          cameraBounds, spawnsOutside, spawnsInside, travelsBeyondOldArena, follows, collision, combat,
          scenery: q.obstacles.every(contains) && q.shrines.every(s => contains({ ...s, r: 42 })) };
      });
      for (const [name, value] of Object.entries(checks)) if (typeof value === "boolean") assert(value, `${width}x${height}: ${name}`);
      report.push(checks);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => {
      const q = window.__arena;
      q.makePlayer("aldric"); q.G.mode = "play";
      document.querySelectorAll(".layer").forEach(el => el.classList.remove("show"));
      q.G.mode = "pause"; q.updateCamera(1); q.render();
    });
    await page.screenshot({ path: path.join(out, "arena-full-window.png") });
    await page.evaluate(() => {
      const q = window.__arena; q.player().x = 2900; q.player().y = 2800; q.updateCamera(1); q.render();
    });
    await page.screenshot({ path: path.join(out, "arena-outer-grounds.png") });
    assert.deepEqual(errors, [], "browser runtime errors");
    console.log(JSON.stringify({ selfTest: "PASS", viewports: report, browserErrors: errors }, null, 2));
    console.log("ARENA_CHECK PASS");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
