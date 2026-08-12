(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const WORLD = 3600;
  const MAX_ENEMIES = 280;
  const CELL = 88;
  const RUN_DAWN = 510; // Dawn Eater at 8:30
  const SAVE_KEY = "oathbound_v1";

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  const len = (x, y) => Math.hypot(x, y) || 1;
  const fmtTime = (s) => {
    s = Math.max(0, s | 0);
    const m = (s / 60) | 0;
    const r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  };

  // ─────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────
  const defaultSave = () => ({
    gold: 0,
    unlocked: ["aldric"],
    perm: { hp: 0, dmg: 0, spd: 0, luck: 0 },
    bestTime: 0,
    bestKills: 0,
    wins: 0,
    selected: "aldric",
  });
  let save = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) save = Object.assign(defaultSave(), JSON.parse(raw));
  } catch (_) {}
  const persist = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) {}
    refreshTitleMeta();
  };

  // ─────────────────────────────────────────────
  // Data
  // ─────────────────────────────────────────────
  const CHARS = {
    aldric: {
      name: "Sir Aldric",
      img: "aldric",
      hp: 108,
      spd: 188,
      armor: 0,
      atk: 1,
      start: "oathblade",
      blurb: "Balanced oath-knight. Starts with circling blades.",
      cost: 0,
    },
    mara: {
      name: "Sister Mara",
      img: "mara",
      hp: 82,
      spd: 228,
      armor: 0,
      atk: 1.12,
      start: "holy",
      blurb: "Swift battle-sister. Holy bolts, faster strikes.",
      cost: 500,
    },
    hollow: {
      name: "The Hollow",
      img: "hollow",
      hp: 168,
      spd: 146,
      armor: 14,
      atk: 0.95,
      start: "bloodwell",
      blurb: "A walking reliquary. Huge vitality, blood aura.",
      cost: 1200,
    },
  };

  const WEAPONS = {
    oathblade: {
      name: "Oathblade", icon: "⚔", kind: "weapon",
      desc: "Swords orbit you and carve anything they touch.",
    },
    holy: {
      name: "Holy Cross", icon: "✝", kind: "weapon",
      desc: "Sanctified bolts fire in the cardinal directions.",
    },
    firebrand: {
      name: "Firebrand", icon: "🔥", kind: "weapon",
      desc: "A cone of flame in the direction you face.",
    },
    frost: {
      name: "Frost Lance", icon: "❄", kind: "weapon",
      desc: "Piercing ice seeks the nearest foe and slows them.",
    },
    storm: {
      name: "Storm Hammer", icon: "⚡", kind: "weapon",
      desc: "Lightning smites nearby enemies.",
    },
    thorn: {
      name: "Thorn Halo", icon: "✿", kind: "weapon",
      desc: "A ring of thorns bursts outward from you.",
    },
    bloodwell: {
      name: "Blood Well", icon: "❤", kind: "weapon",
      desc: "An aura that wounds the close and drinks a little life.",
    },
    grave: {
      name: "Grave Orbit", icon: "☠", kind: "weapon",
      desc: "Skulls fly out, then snap back like a yo-yo of bone.",
    },
    crown: {
      name: "Crown of Blades", icon: "👑", kind: "evo",
      desc: "A whirling crown of oversized blades.",
    },
    judgment: {
      name: "Judgment", icon: "☀", kind: "evo",
      desc: "Eight-way holy lances that pierce the horde.",
    },
    dragon: {
      name: "Dragon's Breath", icon: "🐉", kind: "evo",
      desc: "Fire in every direction. The keep becomes an oven.",
    },
    glacier: {
      name: "Glacier", icon: "🔷", kind: "evo",
      desc: "Huge frost spears that shatter and freeze.",
    },
    tempest: {
      name: "Tempest", icon: "🌩", kind: "evo",
      desc: "Chain lightning that leaps through the swarm.",
    },
    worldthorn: {
      name: "Worldthorn", icon: "❀", kind: "evo",
      desc: "A colossal thorn wave that lingers.",
    },
    crimson: {
      name: "Crimson Pact", icon: "🩸", kind: "evo",
      desc: "A vast blood field. Kills restore you.",
    },
    soulstorm: {
      name: "Soulstorm", icon: "👻", kind: "evo",
      desc: "A cyclone of screaming skulls.",
    },
  };

  const PASSIVES = {
    might: { name: "Might", icon: "💪", desc: "All damage increased." },
    rage: { name: "Rage", icon: "💢", desc: "Weapons strike more often." },
    vitality: { name: "Vitality", icon: "✚", desc: "Maximum health rises. Heal a little." },
    swift: { name: "Swiftness", icon: "💨", desc: "Move faster. Dash recovers sooner." },
    focus: { name: "Focus", icon: "◎", desc: "Projectiles fly farther and hit harder." },
    faith: { name: "Faith", icon: "🕯", desc: "Weapon area and reach grow." },
    wrath: { name: "Wrath", icon: "💥", desc: "Critical strikes become common." },
    magnet: { name: "Magnet", icon: "🧲", desc: "Souls fly to you from farther away." },
  };

  const EVOS = [
    { id: "crown", from: "oathblade", need: "rage" },
    { id: "judgment", from: "holy", need: "faith" },
    { id: "dragon", from: "firebrand", need: "might" },
    { id: "glacier", from: "frost", need: "focus" },
    { id: "tempest", from: "storm", need: "wrath" },
    { id: "worldthorn", from: "thorn", need: "swift" },
    { id: "crimson", from: "bloodwell", need: "vitality" },
    { id: "soulstorm", from: "grave", need: "magnet" },
  ];

  const ENEMY = {
    slime: { hp: 18, spd: 52, r: 16, dmg: 8, xp: 3, gold: 1, img: "slime", draw: 42, mass: 1.2 },
    mite: { hp: 8, spd: 78, r: 10, dmg: 5, xp: 1, gold: 0, img: "slime", draw: 24, mass: 0.6 },
    skeleton: { hp: 16, spd: 96, r: 14, dmg: 9, xp: 4, gold: 1, img: "skeleton", draw: 48, mass: 0.9 },
    bat: { hp: 10, spd: 118, r: 13, dmg: 7, xp: 3, gold: 1, img: "bat", draw: 44, mass: 0.5, ai: "sine" },
    wight: { hp: 28, spd: 70, r: 16, dmg: 8, xp: 7, gold: 2, img: "wight", draw: 52, mass: 1, ai: "kite" },
    shade: { hp: 42, spd: 80, r: 17, dmg: 14, xp: 10, gold: 3, img: "shade", draw: 56, mass: 1.3, ai: "charge" },
    golem: { hp: 140, spd: 38, r: 26, dmg: 20, xp: 22, gold: 6, img: "golem", draw: 88, mass: 3, ai: "slam" },
    duke: { hp: 980, spd: 78, r: 30, dmg: 18, xp: 120, gold: 40, img: "duke", draw: 124, mass: 4, ai: "boss_duke", boss: 1 },
    hydra: { hp: 1680, spd: 64, r: 34, dmg: 16, xp: 180, gold: 55, img: "hydra", draw: 132, mass: 5, ai: "boss_hydra", boss: 1 },
    eater: { hp: 3200, spd: 72, r: 38, dmg: 22, xp: 400, gold: 120, img: "dawneater", draw: 156, mass: 6, ai: "boss_eater", boss: 1 },
  };

  const META_UP = [
    { id: "hp", name: "Iron Constitution", desc: "+12 max HP each rank", max: 5, base: 80 },
    { id: "dmg", name: "Tempered Edge", desc: "+8% damage each rank", max: 5, base: 90 },
    { id: "spd", name: "Oiled Joints", desc: "+6% move speed each rank", max: 5, base: 80 },
    { id: "luck", name: "Saint's Coin", desc: "+10% gold and better rolls", max: 5, base: 100 },
  ];

  // ─────────────────────────────────────────────
  // Audio
  // ─────────────────────────────────────────────
  const SFX = {
    ctx: null,
    drone: null,
    ready: false,
    ensure() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.ready = true;
    },
    resume() {
      this.ensure();
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      this.startDrone();
    },
    startDrone() {
      if (!this.ctx || this.drone) return;
      const c = this.ctx;
      const o1 = c.createOscillator();
      const o2 = c.createOscillator();
      const g = c.createGain();
      o1.type = "sine"; o1.frequency.value = 55;
      o2.type = "triangle"; o2.frequency.value = 82.5;
      g.gain.value = 0.028;
      o1.connect(g); o2.connect(g); g.connect(c.destination);
      o1.start(); o2.start();
      this.drone = { o1, o2, g };
    },
    beep(freq, dur, type, vol) {
      if (!this.ctx) return;
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      g.gain.value = vol || 0.05;
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    },
    noise(dur, vol) {
      if (!this.ctx) return;
      const c = this.ctx;
      const n = (dur * c.sampleRate) | 0;
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 900;
      s.buffer = buf;
      g.gain.value = vol || 0.06;
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      s.connect(f); f.connect(g); g.connect(c.destination);
      s.start();
    },
    hit() { this.beep(180 + Math.random() * 80, 0.05, "square", 0.035); },
    pickup() { this.beep(880, 0.07, "sine", 0.04); },
    level() { this.beep(523, 0.1, "triangle", 0.06); setTimeout(() => this.beep(784, 0.14, "triangle", 0.06), 80); },
    dash() { this.noise(0.12, 0.05); },
    hurt() { this.beep(90, 0.16, "sawtooth", 0.07); },
    boss() { this.beep(70, 0.4, "sawtooth", 0.08); },
    dead() { this.beep(60, 0.6, "sawtooth", 0.1); },
    win() { this.beep(523, 0.2, "triangle", 0.07); setTimeout(() => this.beep(659, 0.2, "triangle", 0.07), 160); setTimeout(() => this.beep(784, 0.4, "triangle", 0.08), 320); },
  };

  // ─────────────────────────────────────────────
  // Assets
  // ─────────────────────────────────────────────
  const IM = {};
  const IMG_NAMES = [
    "aldric", "mara", "hollow", "slime", "skeleton", "bat", "wight",
    "shade", "golem", "duke", "hydra", "dawneater", "ground",
  ];
  function loadImages() {
    return Promise.all(IMG_NAMES.map((n) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { IM[n] = im; res(); };
      im.onerror = () => { IM[n] = null; res(); };
      im.src = "assets/sprites/" + (n === "ground" ? "ground.png" : n + ".png");
    })));
  }

  // ─────────────────────────────────────────────
  // Canvas / camera
  // ─────────────────────────────────────────────
  const canvas = $("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  let W = 1280, H = 720, DPR = 1;
  const cam = { x: WORLD / 2, y: WORLD / 2, sx: 0, sy: 0 };
  let groundPat = null;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = (W * DPR) | 0;
    canvas.height = (H * DPR) | 0;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (IM.ground) groundPat = ctx.createPattern(IM.ground, "repeat");
  }
  window.addEventListener("resize", resize);

  // ─────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────
  const keys = Object.create(null);
  const mouse = { x: 0, y: 0, wx: 0, wy: 0 };
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (G.mode === "play" && (e.code === "Escape" || e.code === "KeyP")) pauseGame();
    else if (G.mode === "pause" && (e.code === "Escape" || e.code === "KeyP")) resumeGame();
    if (G.mode === "levelup") {
      if (e.code === "Digit1") pickCard(0);
      if (e.code === "Digit2") pickCard(1);
      if (e.code === "Digit3") pickCard(2);
    }
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("pointerdown", () => SFX.resume());

  function axis() {
    let x = 0, y = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    const l = Math.hypot(x, y);
    if (l > 0) { x /= l; y /= l; }
    return { x, y };
  }

  // ─────────────────────────────────────────────
  // Pools / world
  // ─────────────────────────────────────────────
  const G = {
    mode: "menu", // menu play levelup shop pause dead win
    t: 0,
    kills: 0,
    gold: 0,
    combo: 0,
    comboT: 0,
    shake: 0,
    bannerT: 0,
    banner: "",
    hitstop: 0,
    spawnedBoss: { duke: 0, hydra: 0, eater: 0 },
    shopAfter: 0,
  };

  let player = null;
  const enemies = [];
  const projs = [];
  const pickups = [];
  const parts = [];
  const floats = [];
  const obstacles = [];
  const telegraphs = [];

  function resetWorld() {
    enemies.length = 0;
    projs.length = 0;
    pickups.length = 0;
    parts.length = 0;
    floats.length = 0;
    obstacles.length = 0;
    telegraphs.length = 0;
    G.t = 0; G.kills = 0; G.gold = 0; G.combo = 0; G.comboT = 0;
    G.shake = 0; G.hitstop = 0;
    G.spawnedBoss = { duke: 0, hydra: 0, eater: 0 };
    G.shopAfter = 0;
    G.spawnAcc = 0;
    obstacles.push(
      { x: 780, y: 820, r: 38 }, { x: 2820, y: 900, r: 42 },
      { x: 1040, y: 2680, r: 36 }, { x: 2680, y: 2740, r: 48 },
      { x: 1800, y: 980, r: 32 }, { x: 2480, y: 2480, r: 40 },
      { x: 620, y: 1980, r: 34 }, { x: 3120, y: 1680, r: 36 },
      { x: 1480, y: 560, r: 30 }, { x: 1960, y: 3140, r: 44 },
      { x: 920, y: 1520, r: 28 }, { x: 2920, y: 2280, r: 33 }
    );
  }

  function makePlayer(id) {
    const c = CHARS[id];
    const p = {
      id, x: WORLD / 2, y: WORLD / 2, vx: 0, vy: 0,
      r: 16,
      maxHp: c.hp + save.perm.hp * 12,
      hp: 0,
      baseSpd: c.spd * (1 + save.perm.spd * 0.06),
      armor: c.armor,
      atkMul: c.atk * (1 + save.perm.dmg * 0.08),
      area: 1, cooldown: 1, pickup: 78, crit: 0.06, proj: 1,
      facing: 1, moving: 0,
      dash: 0, dashCd: 0, inv: 0,
      xp: 0, level: 1, next: 10,
      weapons: [{ id: c.start, lv: 1 }],
      passives: [],
      cd: {},
      orbA: 0,
    };
    p.hp = p.maxHp;
    player = p;
    cam.x = p.x; cam.y = p.y;
  }

  function hasW(id) { return player.weapons.some((w) => w.id === id); }
  function hasP(id) { return player.passives.some((p) => p.id === id); }
  function wlv(id) { const w = player.weapons.find((x) => x.id === id); return w ? w.lv : 0; }
  function plv(id) { const p = player.passives.find((x) => x.id === id); return p ? p.lv : 0; }

  function recacheStats() {
    const c = CHARS[player.id];
    player.maxHp = c.hp + save.perm.hp * 12 + plv("vitality") * 22;
    player.armor = c.armor + plv("vitality") * 1;
    player.atkMul = c.atk * (1 + save.perm.dmg * 0.08) * (1 + plv("might") * 0.14);
    player.cooldown = 1 / (1 + plv("rage") * 0.12) / (player.id === "mara" ? 1.1 : 1);
    player.area = 1 + plv("faith") * 0.14;
    player.pickup = 78 + plv("magnet") * 46 + plv("focus") * 10;
    player.crit = 0.06 + plv("wrath") * 0.08;
    player.proj = 1 + plv("focus") * 0.16;
    player.baseSpd = c.spd * (1 + save.perm.spd * 0.06) * (1 + plv("swift") * 0.08);
  }

  function xpNeed(lv) { return Math.floor(8 + lv * 5 + lv * lv * 0.42); }

  function grantXp(n) {
    player.xp += n;
    while (player.xp >= player.next) {
      player.xp -= player.next;
      player.level++;
      player.next = xpNeed(player.level);
      pendingLevels++;
    }
    if (pendingLevels > 0 && G.mode === "play") openLevelUp();
  }
  let pendingLevels = 0;
  let offered = [];

  // ─────────────────────────────────────────────
  // Spatial hash
  // ─────────────────────────────────────────────
  const hash = new Map();
  const hkey = (cx, cy) => cx + "," + cy;
  function rebuildHash() {
    hash.clear();
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const cx = (e.x / CELL) | 0, cy = (e.y / CELL) | 0;
      const k = hkey(cx, cy);
      let b = hash.get(k);
      if (!b) { b = []; hash.set(k, b); }
      b.push(e);
    }
  }
  function query(x, y, r, out) {
    out.length = 0;
    const r0 = ((x - r) / CELL) | 0, r1 = ((x + r) / CELL) | 0;
    const c0 = ((y - r) / CELL) | 0, c1 = ((y + r) / CELL) | 0;
    for (let cy = c0; cy <= c1; cy++) {
      for (let cx = r0; cx <= r1; cx++) {
        const b = hash.get(hkey(cx, cy));
        if (!b) continue;
        for (let i = 0; i < b.length; i++) out.push(b[i]);
      }
    }
    return out;
  }
  const qbuf = [];

  // ─────────────────────────────────────────────
  // FX
  // ─────────────────────────────────────────────
  function burst(x, y, n, col, spd) {
    for (let i = 0; i < n && parts.length < 500; i++) {
      const a = Math.random() * TAU;
      const s = rand(0.3, 1) * (spd || 140);
      parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.25, 0.7), max: 0.7, r: rand(1.5, 4), col,
      });
    }
  }
  function floatText(x, y, text, col) {
    if (floats.length > 80) floats.shift();
    floats.push({ x, y, text, col: col || "#ffe8a0", life: 0.7 });
  }
  function banner(text, t) {
    G.banner = text; G.bannerT = t || 2.2;
    const el = $("banner");
    el.textContent = text;
    el.classList.add("show");
  }

  // ─────────────────────────────────────────────
  // Combat helpers
  // ─────────────────────────────────────────────
  function dmgRoll(base) {
    let d = base * player.atkMul;
    let crit = false;
    if (Math.random() < player.crit) { d *= 2; crit = true; }
    return { d: d | 0 || 1, crit };
  }

  function hurtEnemy(e, amount, crit, hx, hy) {
    if (e.hp <= 0) return;
    e.hp -= amount;
    e.flash = 0.1;
    if (hx !== undefined) {
      const l = len(e.x - hx, e.y - hy);
      e.kx += ((e.x - hx) / l) * (90 / e.mass);
      e.ky += ((e.y - hy) / l) * (90 / e.mass);
    }
    if (crit) floatText(e.x, e.y - 10, amount, "#ffd36a");
    else if (Math.random() < 0.35) floatText(e.x, e.y - 8, amount, "#fff");
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.hp = 0;
    G.kills++;
    G.combo++;
    G.comboT = 1.3;
    const col = e.boss ? "#d4b06a" : e.elite ? "#ffd36a" : "#c8d0e0";
    burst(e.x, e.y, e.boss ? 40 : e.elite ? 18 : 8, col, e.boss ? 260 : 160);
    if (e.boss) { G.shake = 18; SFX.boss(); }
    dropLoot(e);
    if (e.type === "duke" || e.type === "hydra") G.shopAfter = 1.4;
    if (e.type === "eater") winRun();
  }

  function dropLoot(e) {
    const luck = 1 + save.perm.luck * 0.1;
    const xp = Math.round(e.xp * (e.elite ? 2.4 : 1));
    spawnPickup("xp", e.x + rand(-6, 6), e.y + rand(-6, 6), xp);
    if (Math.random() < 0.22 * luck || e.elite || e.boss) {
      const g = Math.max(1, Math.round(e.gold * (e.elite ? 3 : 1) * luck));
      spawnPickup("gold", e.x + rand(-8, 8), e.y + rand(-8, 8), g);
    }
    if (e.elite && Math.random() < 0.35) spawnPickup("meat", e.x, e.y, 24);
    if (e.boss) spawnPickup("chest", e.x, e.y, 1);
  }

  function spawnPickup(kind, x, y, val) {
    if (pickups.length > 260) {
      for (let i = 0; i < pickups.length; i++) {
        if (pickups[i].kind === "xp") { pickups.splice(i, 1); break; }
      }
    }
    pickups.push({ kind, x, y, val, t: 0 });
  }

  function hurtPlayer(amount, srcx, srcy) {
    if (player.inv > 0 || G.mode !== "play") return;
    const red = amount * (100 / (100 + player.armor));
    player.hp -= red;
    player.inv = 0.55;
    G.shake = 10;
    SFX.hurt();
    burst(player.x, player.y, 12, "#ff6a6a", 180);
    if (srcx !== undefined) {
      const l = len(player.x - srcx, player.y - srcy);
      player.vx += ((player.x - srcx) / l) * 220;
      player.vy += ((player.y - srcy) / l) * 220;
    }
    if (player.hp <= 0) {
      player.hp = 0;
      if (hasW("crimson") && !player.usedPact) {
        player.usedPact = 1;
        player.hp = player.maxHp * 0.4;
        player.inv = 2;
        banner("CRIMSON PACT", 2);
        burst(player.x, player.y, 36, "#b43333", 240);
        return;
      }
      dieRun();
    }
  }

  // ─────────────────────────────────────────────
  // Projectiles
  // ─────────────────────────────────────────────
  function fireBolt(x, y, a, spec) {
    if (projs.length > 220) return;
    const s = spec.spd || 320;
    projs.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      r: spec.r || 6,
      dmg: spec.dmg, pierce: spec.pierce || 0,
      life: spec.life || 1.1,
      kind: spec.kind || "bolt",
      hit: new Set(),
      slow: spec.slow || 0,
      chain: spec.chain || 0,
      a,
    });
  }

  function nearestEnemy(x, y, maxR) {
    let best = null, bd = maxR * maxR;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp <= 0) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function weaponTick(dt) {
    const p = player;
    p.orbA += dt * 2.4;
    for (const w of p.weapons) {
      const id = w.id, lv = w.lv;
      p.cd[id] = (p.cd[id] || 0) - dt;
      const area = p.area;
      if (id === "oathblade" || id === "crown") {
        const n = id === "crown" ? 8 + lv : 2 + lv;
        const rad = (id === "crown" ? 78 : 54) * area + lv * 4;
        const dmg = (id === "crown" ? 16 : 9) + lv * 3;
        for (let i = 0; i < n; i++) {
          const a = p.orbA + (TAU * i) / n;
          const x = p.x + Math.cos(a) * rad;
          const y = p.y + Math.sin(a) * rad;
          query(x, y, 18, qbuf);
          for (const e of qbuf) {
            if (e.hp <= 0) continue;
            if (dist2(x, y, e.x, e.y) < (18 + e.r) * (18 + e.r)) {
              if (!e._ob || e._ob < G.t) {
                const roll = dmgRoll(dmg);
                hurtEnemy(e, roll.d, roll.crit, p.x, p.y);
                e._ob = G.t + 0.18 * p.cooldown;
                SFX.hit();
              }
            }
          }
        }
      } else if (id === "holy" || id === "judgment") {
        if (p.cd[id] <= 0) {
          p.cd[id] = (id === "judgment" ? 0.72 : 0.95) * p.cooldown;
          const dirs = id === "judgment" ? 8 : (lv >= 5 ? 8 : 4);
          const dmg = (id === "judgment" ? 14 : 8) + lv * 2;
          for (let i = 0; i < dirs; i++) {
            fireBolt(p.x, p.y, (TAU * i) / dirs, {
              spd: 380 * p.proj, dmg, r: 7 * area,
              pierce: id === "judgment" ? 6 : 1 + (lv > 4 ? 2 : 0),
              life: 1.05, kind: "holy",
            });
          }
        }
      } else if (id === "firebrand" || id === "dragon") {
        if (p.cd[id] <= 0) {
          p.cd[id] = 0.12 * p.cooldown;
          const aim = Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
          const count = id === "dragon" ? 10 : 3 + (lv > 4 ? 2 : 0);
          const spread = id === "dragon" ? TAU : 0.7;
          const dmg = (id === "dragon" ? 7 : 5) + lv;
          for (let i = 0; i < count; i++) {
            const a = id === "dragon"
              ? (TAU * i) / count + G.t
              : aim + (i - (count - 1) / 2) * (spread / count);
            fireBolt(p.x, p.y, a, {
              spd: 260 + rand(-20, 40), dmg, r: 8 * area,
              pierce: 2, life: 0.38 + lv * 0.02, kind: "fire",
            });
          }
        }
      } else if (id === "frost" || id === "glacier") {
        if (p.cd[id] <= 0) {
          p.cd[id] = (id === "glacier" ? 0.55 : 0.7) * p.cooldown;
          const t = nearestEnemy(p.x, p.y, 520);
          const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
          const extra = id === "glacier" ? 2 : (lv >= 6 ? 1 : 0);
          for (let i = -extra; i <= extra; i++) {
            fireBolt(p.x, p.y, a + i * 0.14, {
              spd: 460 * p.proj, dmg: (id === "glacier" ? 16 : 11) + lv * 2,
              r: (id === "glacier" ? 10 : 6) * area,
              pierce: id === "glacier" ? 8 : 3 + lv,
              life: 1.15, kind: "frost", slow: 0.45,
            });
          }
        }
      } else if (id === "storm" || id === "tempest") {
        if (p.cd[id] <= 0) {
          p.cd[id] = (id === "tempest" ? 0.48 : 0.62) * p.cooldown;
          const n = (id === "tempest" ? 3 : 1) + (lv > 4 ? 1 : 0);
          zapStorm(n, (id === "tempest" ? 18 : 13) + lv * 3, id === "tempest" ? 4 : 0);
        }
      } else if (id === "thorn" || id === "worldthorn") {
        if (p.cd[id] <= 0) {
          p.cd[id] = (id === "worldthorn" ? 1.1 : 1.45) * p.cooldown;
          const maxR = (id === "worldthorn" ? 210 : 130) * area + lv * 8;
          const dmg = (id === "worldthorn" ? 18 : 12) + lv * 2;
          telegraphs.push({ kind: "ring", x: p.x, y: p.y, r: 10, maxR, t: 0, life: 0.35, dmg, friendly: 1 });
        }
      } else if (id === "bloodwell" || id === "crimson") {
        if (p.cd[id] <= 0) {
          p.cd[id] = 0.4 * p.cooldown;
          const rad = (id === "crimson" ? 130 : 78) * area + lv * 6;
          const dmg = (id === "crimson" ? 10 : 6) + lv * 2;
          query(p.x, p.y, rad, qbuf);
          let hits = 0;
          for (const e of qbuf) {
            if (e.hp <= 0) continue;
            if (dist2(p.x, p.y, e.x, e.y) < (rad + e.r) * (rad + e.r)) {
              const roll = dmgRoll(dmg);
              hurtEnemy(e, roll.d, roll.crit, p.x, p.y);
              hits++;
            }
          }
          if (hits && (id === "crimson" || lv >= 4)) {
            player.hp = Math.min(player.maxHp, player.hp + hits * (id === "crimson" ? 1.2 : 0.35));
          }
        }
      } else if (id === "grave" || id === "soulstorm") {
        if (p.cd[id] <= 0) {
          p.cd[id] = (id === "soulstorm" ? 0.7 : 0.95) * p.cooldown;
          const n = id === "soulstorm" ? 6 + lv : 2 + Math.min(3, lv);
          const dmg = (id === "soulstorm" ? 12 : 9) + lv * 2;
          for (let i = 0; i < n; i++) {
            const a = (TAU * i) / n + p.orbA;
            fireBolt(p.x, p.y, a, {
              spd: 280 * p.proj, dmg, r: 8 * area, pierce: 4,
              life: 0.9, kind: "skull",
            });
          }
        }
      }
    }
  }

  function zapStorm(n, dmg, chains) {
    const used = new Set();
    for (let k = 0; k < n; k++) {
      const t = nearestEnemy(player.x, player.y, 300 * player.area);
      if (!t || used.has(t)) continue;
      used.add(t);
      lightning(player.x, player.y, t.x, t.y);
      const roll = dmgRoll(dmg);
      hurtEnemy(t, roll.d, roll.crit, player.x, player.y);
      let cur = t;
      for (let c = 0; c < chains; c++) {
        const nxt = nearestEnemy(cur.x, cur.y, 180);
        if (!nxt || used.has(nxt)) break;
        used.add(nxt);
        lightning(cur.x, cur.y, nxt.x, nxt.y);
        const r2 = dmgRoll(dmg * 0.7);
        hurtEnemy(nxt, r2.d, r2.crit, cur.x, cur.y);
        cur = nxt;
      }
    }
    if (used.size) SFX.hit();
  }

  const bolts = [];
  function lightning(x1, y1, x2, y2) {
    bolts.push({ x1, y1, x2, y2, life: 0.12 });
  }

  function updateProjs(dt) {
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.kind === "skull") {
        // ease back home in second half
        if (pr.life < 0.45) {
          const dx = player.x - pr.x, dy = player.y - pr.y;
          pr.vx = lerp(pr.vx, dx * 6, 0.15);
          pr.vy = lerp(pr.vy, dy * 6, 0.15);
        }
      }
      if (pr.life <= 0) { projs.splice(i, 1); continue; }
      if (pr.enemy) continue;
      query(pr.x, pr.y, pr.r + 24, qbuf);
      for (const e of qbuf) {
        if (e.hp <= 0 || pr.hit.has(e)) continue;
        if (dist2(pr.x, pr.y, e.x, e.y) < (pr.r + e.r) * (pr.r + e.r)) {
          pr.hit.add(e);
          const roll = dmgRoll(pr.dmg);
          hurtEnemy(e, roll.d, roll.crit, pr.x - pr.vx, pr.y - pr.vy);
          if (pr.slow) e.slow = Math.max(e.slow || 0, pr.slow);
          if (pr.kind === "frost") burst(pr.x, pr.y, 4, "#9ad8ff", 80);
          if (pr.kind === "fire") burst(pr.x, pr.y, 3, "#ff8a3a", 60);
          if (pr.pierce <= 0) { projs.splice(i, 1); break; }
          pr.pierce--;
        }
      }
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      bolts[i].life -= dt;
      if (bolts[i].life <= 0) bolts.splice(i, 1);
    }
    for (let i = telegraphs.length - 1; i >= 0; i--) {
      const tg = telegraphs[i];
      tg.t += dt;
      if (tg.kind === "ring" && tg.friendly) {
        const u = tg.t / tg.life;
        tg.r = tg.maxR * u;
        query(tg.x, tg.y, tg.r + 20, qbuf);
        for (const e of qbuf) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - tg.x, e.y - tg.y);
          if (Math.abs(d - tg.r) < 16 + e.r * 0.4) {
            if (!e._th || e._th < G.t) {
              const roll = dmgRoll(tg.dmg);
              hurtEnemy(e, roll.d, roll.crit, tg.x, tg.y);
              e._th = G.t + 0.25;
            }
          }
        }
        if (tg.t >= tg.life) telegraphs.splice(i, 1);
      } else if (tg.kind === "meteor") {
        if (tg.t >= tg.life) {
          burst(tg.x, tg.y, 22, "#ff7030", 200);
          G.shake = Math.max(G.shake, 8);
          if (player && dist2(player.x, player.y, tg.x, tg.y) < (tg.r + player.r) * (tg.r + player.r)) {
            hurtPlayer(tg.dmg, tg.x, tg.y);
          }
          telegraphs.splice(i, 1);
        }
      } else if (tg.kind === "slam") {
        if (tg.t >= tg.life) {
          burst(tg.x, tg.y, 16, "#c0a070", 160);
          if (player && dist2(player.x, player.y, tg.x, tg.y) < (tg.r + player.r) * (tg.r + player.r)) {
            hurtPlayer(tg.dmg, tg.x, tg.y);
          }
          telegraphs.splice(i, 1);
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // Enemies
  // ─────────────────────────────────────────────
  function spawnEnemy(type, x, y, elite) {
    if (enemies.length >= MAX_ENEMIES && !ENEMY[type].boss) return;
    const d = ENEMY[type];
    if (x === undefined) {
      const hw = W * 0.5 + 48;
      const hh = H * 0.5 + 48;
      const side = irand(0, 3);
      if (side === 0) { x = player.x + rand(-hw, hw); y = player.y - hh; }
      else if (side === 1) { x = player.x + rand(-hw, hw); y = player.y + hh; }
      else if (side === 2) { x = player.x - hw; y = player.y + rand(-hh, hh); }
      else { x = player.x + hw; y = player.y + rand(-hh, hh); }
      x = clamp(x, 80, WORLD - 80);
      y = clamp(y, 80, WORLD - 80);
    }
    const scale = 1 + G.t / 420;
    const e = {
      type, x, y, vx: 0, vy: 0, kx: 0, ky: 0,
      r: d.r * (elite ? 1.35 : 1),
      hp: Math.round(d.hp * scale * (elite ? 2.6 : 1)),
      maxHp: 0,
      spd: d.spd * (elite ? 1.08 : 1),
      dmg: d.dmg,
      xp: d.xp, gold: d.gold,
      img: d.img, draw: d.draw * (elite ? 1.3 : 1),
      mass: d.mass, ai: d.ai || "seek",
      elite: !!elite, boss: !!d.boss,
      flash: 0, slow: 0, state: "idle", st: 0, phase: 1,
      cd: 0, facing: 1,
    };
    e.maxHp = e.hp;
    enemies.push(e);
    return e;
  }

  function updateEnemies(dt) {
    const p = player;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, e.slow - dt * 0.25);
      const spdMul = (e.slow > 0 ? 0.55 : 1);
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      e.facing = ux < 0 ? -1 : 1;
      e.st += dt;
      e.cd -= dt;

      if (e.ai === "seek") {
        e.vx = ux * e.spd * spdMul;
        e.vy = uy * e.spd * spdMul;
      } else if (e.ai === "sine") {
        const n = Math.sin(G.t * 6 + e.x * 0.01) * 0.7;
        e.vx = (ux + -uy * n) * e.spd * spdMul;
        e.vy = (uy + ux * n) * e.spd * spdMul;
      } else if (e.ai === "kite") {
        const ideal = 240;
        if (d < ideal - 20) { e.vx = -ux * e.spd * spdMul; e.vy = -uy * e.spd * spdMul; }
        else if (d > ideal + 30) { e.vx = ux * e.spd * spdMul; e.vy = uy * e.spd * spdMul; }
        else {
          e.vx = -uy * e.spd * 0.6 * spdMul;
          e.vy = ux * e.spd * 0.6 * spdMul;
        }
        if (e.cd <= 0) {
          e.cd = 1.7;
          const a = Math.atan2(dy, dx);
          projsEnemy(e.x, e.y, a, 12, 240);
        }
      } else if (e.ai === "charge") {
        if (e.state === "idle") {
          e.vx = ux * e.spd * spdMul; e.vy = uy * e.spd * spdMul;
          if (d < 280 && e.cd <= 0) { e.state = "tel"; e.st = 0; }
        } else if (e.state === "tel") {
          e.vx *= 0.8; e.vy *= 0.8;
          if (e.st > 0.55) {
            e.state = "go"; e.st = 0;
            e.vx = ux * 460; e.vy = uy * 460;
          }
        } else {
          if (e.st > 0.38) { e.state = "idle"; e.cd = 1.6; }
        }
      } else if (e.ai === "slam") {
        e.vx = ux * e.spd * spdMul; e.vy = uy * e.spd * spdMul;
        if (d < 90 && e.cd <= 0) {
          e.cd = 2.2;
          telegraphs.push({ kind: "slam", x: e.x, y: e.y, r: 100, t: 0, life: 0.55, dmg: e.dmg + 6 });
        }
      } else if (e.ai === "boss_duke") {
        if (e.state === "idle") {
          e.vx = ux * e.spd * spdMul; e.vy = uy * e.spd * spdMul;
          if (e.cd <= 0) {
            e.cd = 0;
            if (Math.random() < 0.5) { e.state = "tel"; e.st = 0; }
            else {
              e.state = "slam"; e.st = 0;
              telegraphs.push({ kind: "slam", x: e.x, y: e.y, r: 150, t: 0, life: 0.7, dmg: 22 });
            }
          }
        } else if (e.state === "tel") {
          e.vx *= 0.75; e.vy *= 0.75;
          if (e.st > 0.6) { e.state = "go"; e.st = 0; e.vx = ux * 520; e.vy = uy * 520; }
        } else if (e.state === "go") {
          if (e.st > 0.42) { e.state = "idle"; e.cd = 1.4; }
        } else if (e.state === "slam") {
          e.vx *= 0.5; e.vy *= 0.5;
          if (e.st > 0.75) { e.state = "idle"; e.cd = 1.2; }
        }
      } else if (e.ai === "boss_hydra") {
        const ideal = 260;
        if (d < ideal) { e.vx = -ux * e.spd * 0.8; e.vy = -uy * e.spd * 0.8; }
        else { e.vx = ux * e.spd * 0.7; e.vy = uy * e.spd * 0.7; }
        if (e.cd <= 0) {
          e.cd = 1.15;
          const a = Math.atan2(dy, dx);
          for (let k = -1; k <= 1; k++) projsEnemy(e.x, e.y, a + k * 0.22, 13, 270);
        }
        if (e.st > 5) {
          e.st = 0;
          e.vx = ux * 400; e.vy = uy * 400;
        }
      } else if (e.ai === "boss_eater") {
        if (e.hp < e.maxHp * 0.5 && e.phase === 1) {
          e.phase = 2; e.spd *= 1.15; banner("THE DAWN EATER RAGES", 2.4);
          for (let k = 0; k < 8; k++) spawnEnemy("skeleton");
        }
        const orbit = 200;
        const tx = p.x + Math.cos(G.t * 0.6) * orbit;
        const ty = p.y + Math.sin(G.t * 0.6) * orbit;
        const lx = tx - e.x, ly = ty - e.y, ll = Math.hypot(lx, ly) || 1;
        e.vx = (lx / ll) * e.spd; e.vy = (ly / ll) * e.spd;
        if (e.cd <= 0) {
          e.cd = e.phase === 2 ? 0.7 : 1.1;
          const ang = Math.random() * TAU;
          const rr = rand(80, 220);
          telegraphs.push({
            kind: "meteor",
            x: p.x + Math.cos(ang) * rr,
            y: p.y + Math.sin(ang) * rr,
            r: 70 + e.phase * 10, t: 0, life: 0.85, dmg: 20,
          });
        }
      }

      e.kx *= 0.86; e.ky *= 0.86;
      e.x += (e.vx + e.kx) * dt;
      e.y += (e.vy + e.ky) * dt;
      e.x = clamp(e.x, 40, WORLD - 40);
      e.y = clamp(e.y, 40, WORLD - 40);

      // contact
      if (d < e.r + p.r) {
        // soft push
        const ov = e.r + p.r - d;
        e.x -= ux * ov * 0.55;
        e.y -= uy * ov * 0.55;
        if (e.state === "go" || e.ai === "seek" || e.ai === "sine" || e.ai === "charge" || e.boss) {
          hurtPlayer(e.dmg, e.x, e.y);
        }
      }
    }

    // separation
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (a.hp <= 0 || a.boss) continue;
      query(a.x, a.y, 40, qbuf);
      for (const b of qbuf) {
        if (b === a || b.hp <= 0) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        const min = (a.r + b.r) * 0.72;
        if (d2 > 0 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const f = (min - d) / d * 0.5;
          a.x += dx * f; a.y += dy * f;
        }
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) enemies.splice(i, 1);
    }
  }

  function projsEnemy(x, y, a, dmg, spd) {
    projs.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      r: 7, dmg, pierce: 0, life: 2.2, kind: "bone",
      hit: new Set(), enemy: 1, a,
    });
  }

  function updateEnemyProjs(dt) {
    // handled in updateProjs but enemy flag
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      if (!pr.enemy) continue;
      if (player && dist2(pr.x, pr.y, player.x, player.y) < (pr.r + player.r) * (pr.r + player.r)) {
        hurtPlayer(pr.dmg, pr.x, pr.y);
        projs.splice(i, 1);
      }
    }
  }

  // ─────────────────────────────────────────────
  // Director
  // ─────────────────────────────────────────────
  function pickType() {
    const t = G.t;
    const pool = ["slime"];
    if (t > 20) pool.push("skeleton", "slime");
    if (t > 45) pool.push("bat", "skeleton");
    if (t > 80) pool.push("mite", "mite", "bat");
    if (t > 110) pool.push("wight");
    if (t > 150) pool.push("shade");
    if (t > 210) pool.push("golem");
    if (t > 300) pool.push("shade", "golem", "wight");
    if (t > 400) pool.push("mite", "mite", "skeleton", "shade");
    return pick(pool);
  }

  function director(dt) {
    if (!player) return;
    const t = G.t;
    const rate = 1.1 + t * 0.012 + Math.floor(t / 30) * 0.35;
    G.spawnAcc = (G.spawnAcc || 0) + dt * rate;
    while (G.spawnAcc >= 1) {
      G.spawnAcc -= 1;
      const elite = Math.random() < 0.025 + t / 9000;
      spawnEnemy(pickType(), undefined, undefined, elite);
    }
    // timed swarms
    if ((t / 25 | 0) !== ((t - dt) / 25 | 0) && t > 15) {
      banner("THE DEAD PRESS IN", 1.4);
      for (let i = 0; i < 10 + t / 40; i++) spawnEnemy(pickType());
    }
    if (t >= 180 && !G.spawnedBoss.duke) {
      G.spawnedBoss.duke = 1;
      banner("THE WAILING DUKE", 2.6);
      SFX.boss();
      spawnEnemy("duke", player.x + 280, player.y);
    }
    if (t >= 360 && !G.spawnedBoss.hydra) {
      G.spawnedBoss.hydra = 1;
      banner("BONE HYDRA", 2.6);
      SFX.boss();
      spawnEnemy("hydra", player.x - 260, player.y - 80);
    }
    if (t >= RUN_DAWN && !G.spawnedBoss.eater) {
      G.spawnedBoss.eater = 1;
      banner("THE DAWN EATER", 3);
      SFX.boss();
      spawnEnemy("eater", player.x, player.y - 300);
    }
  }

  // ─────────────────────────────────────────────
  // Player
  // ─────────────────────────────────────────────
  function updatePlayer(dt) {
    const p = player;
    const a = axis();
    p.moving = Math.abs(a.x) + Math.abs(a.y) > 0 ? 1 : 0;
    if (a.x) p.facing = a.x < 0 ? -1 : 1;
    const dashPressed = keys.ShiftLeft || keys.ShiftRight || keys.Space;
    if (dashPressed && p.dashCd <= 0 && p.dash <= 0) {
      p.dash = 0.18;
      p.dashCd = 2.15 / (1 + plv("swift") * 0.1);
      p.inv = Math.max(p.inv, 0.28);
      SFX.dash();
      burst(p.x, p.y, 8, "#d4b06a", 80);
    }
    const spd = p.baseSpd * (p.dash > 0 ? 3.3 : 1);
    p.vx = lerp(p.vx, a.x * spd, p.dash > 0 ? 0.45 : 0.22);
    p.vy = lerp(p.vy, a.y * spd, p.dash > 0 ? 0.45 : 0.22);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, 50, WORLD - 50);
    p.y = clamp(p.y, 50, WORLD - 50);
    p.dash = Math.max(0, p.dash - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.inv = Math.max(0, p.inv - dt);

    for (const o of obstacles) {
      const d = Math.hypot(p.x - o.x, p.y - o.y);
      if (d < o.r + p.r) {
        const ux = (p.x - o.x) / (d || 1), uy = (p.y - o.y) / (d || 1);
        p.x = o.x + ux * (o.r + p.r);
        p.y = o.y + uy * (o.r + p.r);
      }
    }

    mouse.wx = mouse.x - W / 2 + cam.x;
    mouse.wy = mouse.y - H / 2 + cam.y;
  }

  function updatePickups(dt) {
    const p = player;
    for (let i = pickups.length - 1; i >= 0; i--) {
      const u = pickups[i];
      u.t += dt;
      const d = Math.hypot(p.x - u.x, p.y - u.y);
      const reach = u.kind === "xp" || u.kind === "gold" ? p.pickup : 28;
      if (d < reach + 40) {
        const pull = clamp(1 - d / (reach + 40), 0, 1);
        u.x += (p.x - u.x) * pull * 8 * dt;
        u.y += (p.y - u.y) * pull * 8 * dt;
      }
      if (d < 22) {
        if (u.kind === "xp") grantXp(u.val);
        else if (u.kind === "gold") G.gold += u.val;
        else if (u.kind === "meat") {
          p.hp = Math.min(p.maxHp, p.hp + u.val);
          floatText(p.x, p.y - 20, "+" + u.val, "#7dcf8a");
        } else if (u.kind === "chest") {
          pendingLevels++;
          banner("RELIC CHEST", 1.4);
          if (G.mode === "play") openLevelUp();
        }
        SFX.pickup();
        pickups.splice(i, 1);
      }
    }
  }

  function updateFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.92; q.vy *= 0.92;
      if (q.life <= 0) parts.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= dt;
      floats[i].y -= 28 * dt;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }
    G.shake *= 0.88;
    if (G.shake < 0.3) G.shake = 0;
    G.comboT -= dt;
    if (G.comboT <= 0) G.combo = 0;
    if (G.bannerT > 0) {
      G.bannerT -= dt;
      if (G.bannerT <= 0) $("banner").classList.remove("show");
    }
    if (G.shopAfter > 0) {
      G.shopAfter -= dt;
      if (G.shopAfter <= 0) openShop();
    }
  }

  // ─────────────────────────────────────────────
  // Level up / shop
  // ─────────────────────────────────────────────
  function poolCards() {
    const cards = [];
    // evolutions first
    for (const ev of EVOS) {
      if (hasW(ev.from) && wlv(ev.from) >= 6 && hasP(ev.need) && !hasW(ev.id)) {
        cards.push({ type: "evo", id: ev.id, from: ev.from });
      }
    }
    for (const id of Object.keys(WEAPONS)) {
      if (WEAPONS[id].kind !== "weapon") continue;
      const w = player.weapons.find((x) => x.id === id);
      if (w && w.lv < 8) cards.push({ type: "wup", id });
      else if (!w && player.weapons.length < 6) cards.push({ type: "wnew", id });
    }
    for (const id of Object.keys(PASSIVES)) {
      const p = player.passives.find((x) => x.id === id);
      if (!p) cards.push({ type: "pnew", id });
      else if (p.lv < 5) cards.push({ type: "pup", id });
    }
    cards.push({ type: "heal" });
    cards.push({ type: "gold" });
    return cards;
  }

  function drawCards() {
    const pool = poolCards();
    const evos = pool.filter((c) => c.type === "evo");
    const rest = pool.filter((c) => c.type !== "evo");
    const out = [];
    if (evos.length && Math.random() < 0.85 + save.perm.luck * 0.03) out.push(pick(evos));
    while (out.length < 3 && rest.length) {
      const i = (Math.random() * rest.length) | 0;
      const c = rest.splice(i, 1)[0];
      if (!out.some((o) => o.type === c.type && o.id === c.id)) out.push(c);
    }
    while (out.length < 3) out.push({ type: "heal" });
    return out;
  }

  function cardView(c) {
    if (c.type === "evo") {
      const w = WEAPONS[c.id];
      return { title: w.name, ico: w.icon, kind: "Evolution", body: w.desc, lv: "TRANSFIGURE", evo: 1 };
    }
    if (c.type === "wup" || c.type === "wnew") {
      const w = WEAPONS[c.id];
      const lv = wlv(c.id);
      return { title: w.name, ico: w.icon, kind: c.type === "wnew" ? "New Weapon" : "Weapon", body: w.desc, lv: c.type === "wnew" ? "NEW" : "Lv " + lv + " → " + (lv + 1) };
    }
    if (c.type === "pup" || c.type === "pnew") {
      const p = PASSIVES[c.id];
      const lv = plv(c.id);
      return { title: p.name, ico: p.icon, kind: "Virtue", body: p.desc, lv: c.type === "pnew" ? "NEW" : "Lv " + lv + " → " + (lv + 1) };
    }
    if (c.type === "heal") return { title: "Field Rations", ico: "🍖", kind: "Relief", body: "Restore 28 health.", lv: "" };
    return { title: "Spoils", ico: "🪙", kind: "Relief", body: "Gain 25 gold.", lv: "" };
  }

  function applyCard(c) {
    if (c.type === "evo") {
      const w = player.weapons.find((x) => x.id === c.from);
      if (w) { w.id = c.id; w.lv = Math.max(w.lv, 1); }
      banner(WEAPONS[c.id].name.toUpperCase(), 2);
    } else if (c.type === "wnew") {
      player.weapons.push({ id: c.id, lv: 1 });
    } else if (c.type === "wup") {
      const w = player.weapons.find((x) => x.id === c.id);
      if (w) w.lv = Math.min(8, w.lv + 1);
    } else if (c.type === "pnew") {
      player.passives.push({ id: c.id, lv: 1 });
      if (c.id === "vitality") player.hp += 22;
    } else if (c.type === "pup") {
      const p = player.passives.find((x) => x.id === c.id);
      if (p) p.lv = Math.min(5, p.lv + 1);
      if (c.id === "vitality") player.hp += 22;
    } else if (c.type === "heal") {
      player.hp = Math.min(player.maxHp, player.hp + 28);
    } else {
      G.gold += 25;
    }
    recacheStats();
    player.hp = Math.min(player.hp, player.maxHp);
  }

  function openLevelUp() {
    if (G.mode !== "play" && G.mode !== "levelup") return;
    G.mode = "levelup";
    SFX.level();
    offered = drawCards();
    const box = $("level-cards");
    box.innerHTML = "";
    offered.forEach((c, i) => {
      const v = cardView(c);
      const el = document.createElement("div");
      el.className = "card" + (v.evo ? " evo" : "");
      el.innerHTML = `<div class="ico">${v.ico}</div><div class="kind">${i + 1} · ${v.kind}</div><h3>${v.title}</h3><p>${v.body}</p><div class="lv">${v.lv}</div>`;
      el.onclick = () => pickCard(i);
      box.appendChild(el);
    });
    showLayer("levelup");
  }

  function pickCard(i) {
    if (G.mode !== "levelup" || !offered[i]) return;
    applyCard(offered[i]);
    pendingLevels = Math.max(0, pendingLevels - 1);
    if (pendingLevels > 0) openLevelUp();
    else {
      G.mode = "play";
      hideLayers();
      $("hud").classList.add("show");
    }
    paintDock();
  }

  const SHOP_POOL = [
    { id: "heal", name: "Bandages", desc: "Restore 40 HP.", price: 22, fn: () => { player.hp = Math.min(player.maxHp, player.hp + 40); } },
    { id: "max", name: "Iron Tonic", desc: "+18 max HP and heal 18.", price: 35, fn: () => { player.maxHp += 18; player.hp += 18; } },
    { id: "whet", name: "Whetstone", desc: "+12% damage this vigil.", price: 40, fn: () => { player.atkMul *= 1.12; } },
    { id: "oil", name: "Blade Oil", desc: "Weapons fire 10% faster.", price: 38, fn: () => { player.cooldown *= 0.9; } },
    { id: "boot", name: "Greaves", desc: "+10% move speed.", price: 28, fn: () => { player.baseSpd *= 1.1; } },
    { id: "magnet", name: "Lodestone", desc: "Much larger pickup radius.", price: 30, fn: () => { player.pickup += 70; } },
    { id: "reroll", name: "Saint's Die", desc: "Instant extra blessing.", price: 45, fn: () => { pendingLevels++; } },
    { id: "meat", name: "Full Roast", desc: "Fully restore health.", price: 50, fn: () => { player.hp = player.maxHp; } },
  ];

  let shopStock = [];
  function openShop() {
    if (G.mode !== "play") return;
    G.mode = "shop";
    shopStock = [];
    const pool = SHOP_POOL.slice();
    while (shopStock.length < 4 && pool.length) {
      shopStock.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    }
    renderShop();
    showLayer("shop");
  }
  function renderShop() {
    $("shop-gold").textContent = "Gold " + G.gold;
    const box = $("shop-list");
    box.innerHTML = "";
    shopStock.forEach((it, i) => {
      const el = document.createElement("div");
      el.className = "shop-item";
      el.innerHTML = `<h3>${it.name}</h3><p>${it.desc}</p><div class="price">${it.price} gold</div>`;
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = it.sold ? "Sold" : "Buy";
      b.disabled = !!it.sold || G.gold < it.price;
      b.onclick = () => {
        if (it.sold || G.gold < it.price) return;
        G.gold -= it.price;
        it.fn();
        it.sold = 1;
        if (pendingLevels > 0) {
          // leave shop then level
        }
        renderShop();
      };
      el.appendChild(b);
      box.appendChild(el);
    });
  }
  $("shop-leave").onclick = () => {
    G.mode = "play";
    hideLayers();
    $("hud").classList.add("show");
    if (pendingLevels > 0) openLevelUp();
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  function worldToScreen(x, y) {
    return { x: x - cam.x + W / 2, y: y - cam.y + H / 2 };
  }

  function drawSprite(name, x, y, size, flip, flash, bob) {
    const im = IM[name];
    const sy = y + (bob || 0);
    const s = worldToScreen(x, sy);
    if (s.x < -80 || s.y < -80 || s.x > W + 80 || s.y > H + 80) return;
    ctx.save();
    ctx.translate(x, sy);
    if (flip < 0) ctx.scale(-1, 1);
    if (im) {
      const aspect = im.width / im.height;
      const h = size, w = size * aspect;
      if (flash > 0) ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(im, -w / 2, -h + 6, w, h);
      if (flash > 0) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(im, -w / 2, -h + 6, w, h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    } else {
      ctx.fillStyle = flash > 0 ? "#fff" : "#888";
      ctx.beginPath(); ctx.arc(0, -size * 0.3, size * 0.35, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function render() {
    const night = clamp(1 - G.t / 620, 0, 1);
    ctx.fillStyle = "#0c0a10";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    const shx = (Math.random() - 0.5) * G.shake;
    const shy = (Math.random() - 0.5) * G.shake;
    ctx.translate(W / 2 + shx, H / 2 + shy);
    ctx.translate(-cam.x, -cam.y);

    if (groundPat) {
      ctx.fillStyle = groundPat;
      ctx.fillRect(0, 0, WORLD, WORLD);
    } else {
      ctx.fillStyle = "#1a1714";
      ctx.fillRect(0, 0, WORLD, WORLD);
    }

    // night wash
    ctx.fillStyle = `rgba(18, 12, 36, ${0.18 + night * 0.28})`;
    ctx.fillRect(0, 0, WORLD, WORLD);

    // obstacles — ruined pillar stacks
    for (const o of obstacles) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(o.x + 3, o.y + 6, o.r * 1.05, o.r * 0.45, 0, 0, TAU); ctx.fill();
      const layers = 4;
      for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1);
        const rr = o.r * (1 - t * 0.22);
        const yy = o.y - i * (o.r * 0.42);
        ctx.fillStyle = i % 2 ? "#3a3630" : "#2c2924";
        ctx.beginPath(); ctx.ellipse(o.x, yy, rr, rr * 0.55, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#4a453c";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = "#4a5a38";
      ctx.beginPath();
      ctx.ellipse(o.x, o.y - layers * (o.r * 0.38), o.r * 0.55, o.r * 0.22, 0, 0, TAU);
      ctx.fill();
    }

    // pickups
    for (const u of pickups) {
      const bob = Math.sin(G.t * 5 + u.x) * 3;
      if (u.kind === "xp") {
        ctx.fillStyle = "#8ec4ff";
        ctx.beginPath();
        ctx.moveTo(u.x, u.y - 6 + bob);
        ctx.lineTo(u.x + 5, u.y + bob);
        ctx.lineTo(u.x, u.y + 6 + bob);
        ctx.lineTo(u.x - 5, u.y + bob);
        ctx.closePath(); ctx.fill();
      } else if (u.kind === "gold") {
        ctx.fillStyle = "#d4b06a";
        ctx.beginPath(); ctx.arc(u.x, u.y + bob, 5, 0, TAU); ctx.fill();
      } else if (u.kind === "meat") {
        ctx.fillStyle = "#c44";
        ctx.beginPath(); ctx.arc(u.x, u.y + bob, 7, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = "#d4b06a";
        ctx.fillRect(u.x - 7, u.y - 6 + bob, 14, 12);
      }
    }

    // telegraphs
    for (const tg of telegraphs) {
      if (tg.kind === "meteor" || tg.kind === "slam") {
        const u = tg.t / tg.life;
        ctx.strokeStyle = `rgba(220,60,40,${0.4 + u * 0.5})`;
        ctx.fillStyle = `rgba(180,30,20,${0.12 + u * 0.18})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, TAU); ctx.fill(); ctx.stroke();
      } else if (tg.kind === "ring") {
        ctx.strokeStyle = "rgba(120,200,90,0.75)";
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, TAU); ctx.stroke();
      }
    }

    // sort-ish: enemies then player
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const bob = Math.sin(G.t * (e.ai === "sine" ? 10 : 6) + e.x) * (e.moving === 0 ? 1 : 2);
      if (e.elite) {
        ctx.save();
        const s = worldToScreen(e.x, e.y);
        ctx.strokeStyle = "rgba(212,176,106,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      if (e.state === "tel") {
        ctx.strokeStyle = "rgba(255,60,40,0.7)";
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      drawSprite(e.img, e.x, e.y, e.draw, e.facing, e.flash, bob);
      if (e.boss || e.elite) {
        const bw = e.boss ? 64 : 36;
        ctx.fillStyle = "#1a1010";
        ctx.fillRect(e.x - bw / 2, e.y - e.draw - 8, bw, 5);
        ctx.fillStyle = e.boss ? "#d4b06a" : "#e07040";
        ctx.fillRect(e.x - bw / 2, e.y - e.draw - 8, bw * clamp(e.hp / e.maxHp, 0, 1), 5);
      }
    }

    if (player) {
      const bob = player.moving ? Math.sin(G.t * 14) * 2.5 : Math.sin(G.t * 3) * 1.2;
      if (player.dash > 0 || player.inv > 0) {
        ctx.globalAlpha = 0.35 + Math.sin(G.t * 40) * 0.1;
      }
      drawSprite(CHARS[player.id].img, player.x, player.y, 72, player.facing, player.inv > 0 ? 0.08 : 0, bob);
      ctx.globalAlpha = 1;

      // orbiting blades
      for (const w of player.weapons) {
        if (w.id !== "oathblade" && w.id !== "crown") continue;
        const n = w.id === "crown" ? 8 + w.lv : 2 + w.lv;
        const rad = (w.id === "crown" ? 78 : 54) * player.area + w.lv * 4;
        for (let i = 0; i < n; i++) {
          const a = player.orbA + (TAU * i) / n;
          const x = player.x + Math.cos(a) * rad;
          const y = player.y + Math.sin(a) * rad;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = w.id === "crown" ? "#ffe08a" : "#d0d6de";
          ctx.fillRect(-2.5, -14, 5, 28);
          ctx.fillStyle = "#d4b06a";
          ctx.fillRect(-3, 8, 6, 6);
          ctx.restore();
        }
      }
      if (hasW("bloodwell") || hasW("crimson")) {
        const id = hasW("crimson") ? "crimson" : "bloodwell";
        const rad = (id === "crimson" ? 130 : 78) * player.area + wlv(id) * 6;
        ctx.strokeStyle = "rgba(180,40,50,0.28)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(player.x, player.y, rad, 0, TAU); ctx.stroke();
      }
    }

    // projectiles
    for (const pr of projs) {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.a || Math.atan2(pr.vy, pr.vx));
      if (pr.kind === "holy") {
        ctx.fillStyle = "#ffe08a";
        ctx.fillRect(-8, -3, 16, 6);
        ctx.fillRect(-3, -8, 6, 16);
      } else if (pr.kind === "frost") {
        ctx.fillStyle = "#9ad8ff";
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-8, -5); ctx.lineTo(-8, 5); ctx.fill();
      } else if (pr.kind === "fire") {
        ctx.fillStyle = `rgba(255,${120 + Math.random() * 80},40,0.85)`;
        ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      } else if (pr.kind === "skull") {
        ctx.fillStyle = "#c8b8e0";
        ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
        ctx.fillStyle = "#1a1020";
        ctx.beginPath(); ctx.arc(-3, -1, 1.6, 0, TAU); ctx.arc(3, -1, 1.6, 0, TAU); ctx.fill();
      } else if (pr.kind === "bone" || pr.enemy) {
        ctx.fillStyle = "#e8d8b0";
        ctx.fillRect(-7, -2.5, 14, 5);
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    for (const b of bolts) {
      ctx.strokeStyle = `rgba(180,220,255,${b.life * 8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      const mx = (b.x1 + b.x2) / 2 + (Math.random() - 0.5) * 18;
      const my = (b.y1 + b.y2) / 2 + (Math.random() - 0.5) * 18;
      ctx.lineTo(mx, my);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }

    for (const q of parts) {
      ctx.globalAlpha = clamp(q.life / 0.5, 0, 1);
      ctx.fillStyle = q.col;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const f of floats) {
      ctx.globalAlpha = clamp(f.life / 0.4, 0, 1);
      ctx.fillStyle = f.col;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // vignette
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function paintHud() {
    if (!player || (G.mode !== "play" && G.mode !== "levelup" && G.mode !== "shop" && G.mode !== "pause")) return;
    $("hud-time").textContent = fmtTime(G.t);
    $("hud-kills").textContent = G.kills;
    $("hud-gold").textContent = G.gold;
    $("hud-lv").textContent = player.level;
    $("hp-fill").style.width = (100 * player.hp / player.maxHp) + "%";
    $("hp-lbl").textContent = Math.ceil(player.hp) + " / " + player.maxHp;
    $("xp-fill").style.width = (100 * player.xp / player.next) + "%";
    $("xp-lbl").textContent = player.xp + " / " + player.next;
    const dash = player.dashCd <= 0 ? 1 : 1 - player.dashCd / 2.15;
    $("dash-fill").style.width = (100 * clamp(dash, 0, 1)) + "%";
  }

  function paintDock() {
    const dock = $("weapon-dock");
    if (!player) { dock.innerHTML = ""; return; }
    const letter = (name) => name.replace(/[^A-Za-z]/g, "").charAt(0);
    dock.innerHTML = player.weapons.map((w) => {
      const d = WEAPONS[w.id];
      return `<div class="wep" title="${d.name}"><span>${letter(d.name)}</span><b>${w.lv}</b></div>`;
    }).join("") + player.passives.map((p) => {
      const d = PASSIVES[p.id];
      return `<div class="wep" title="${d.name}"><span>${letter(d.name)}</span><b>${p.lv}</b></div>`;
    }).join("");
  }

  // ─────────────────────────────────────────────
  // Loop
  // ─────────────────────────────────────────────
  let last = 0;
  function frame(now) {
    const dt0 = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (G.mode === "play") {
      let dt = dt0;
      if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.15; }
      G.t += dt;
      updatePlayer(dt);
      cam.x = lerp(cam.x, player.x, 0.12);
      cam.y = lerp(cam.y, player.y, 0.12);
      director(dt);
      updateEnemies(dt);
      rebuildHash();
      weaponTick(dt);
      updateProjs(dt);
      updateEnemyProjs(dt);
      updatePickups(dt);
      updateFx(dt);
      paintHud();
    } else if (player) {
      cam.x = lerp(cam.x, player.x, 0.08);
      cam.y = lerp(cam.y, player.y, 0.08);
    }
    render();
    requestAnimationFrame(frame);
  }

  // ─────────────────────────────────────────────
  // UI / flow
  // ─────────────────────────────────────────────
  function hideLayers() {
    document.querySelectorAll("#overlay .layer").forEach((el) => el.classList.remove("show"));
  }
  function showLayer(id) {
    hideLayers();
    $(id).classList.add("show");
  }

  function refreshTitleMeta() {
    $("title-meta").textContent =
      "Gold " + save.gold + " · Best " + fmtTime(save.bestTime) + " · Wins " + save.wins;
    $("gold-chip").textContent = "";
  }

  function renderChars() {
    const box = $("char-list");
    box.innerHTML = "";
    for (const id of Object.keys(CHARS)) {
      const c = CHARS[id];
      const unlocked = save.unlocked.includes(id);
      const el = document.createElement("div");
      el.className = "char-card" + (unlocked ? "" : " locked");
      el.innerHTML = `
        <img src="assets/sprites/${c.img}.png" alt="" />
        <h3>${c.name}</h3>
        <p>${c.blurb}</p>
        <p>HP ${c.hp} · Speed ${c.spd} · ${WEAPONS[c.start].name}</p>
        <div class="cost">${unlocked ? (save.selected === id ? "Selected" : "Select") : "Unlock · " + c.cost + " gold"}</div>`;
      el.onclick = () => {
        if (unlocked) {
          save.selected = id;
          persist();
          renderChars();
        } else if (save.gold >= c.cost) {
          save.gold -= c.cost;
          save.unlocked.push(id);
          save.selected = id;
          persist();
          renderChars();
        }
      };
      box.appendChild(el);
    }
  }

  function renderMeta() {
    $("meta-gold").textContent = "Permanent gold: " + save.gold;
    const box = $("meta-list");
    box.innerHTML = "";
    for (const u of META_UP) {
      const lv = save.perm[u.id];
      const cost = Math.round(u.base * Math.pow(1.65, lv));
      const row = document.createElement("div");
      row.className = "meta-row";
      row.innerHTML = `<div><b style="color:var(--gold)">${u.name}</b> · ${lv}/${u.max}<br><span style="color:var(--ash);font-size:.82rem">${u.desc}</span></div>
        <div>${lv >= u.max ? "MAX" : cost + " g"}</div>`;
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = lv >= u.max ? "—" : "Buy";
      b.disabled = lv >= u.max || save.gold < cost;
      b.onclick = () => {
        if (lv >= u.max || save.gold < cost) return;
        save.gold -= cost;
        save.perm[u.id]++;
        persist();
        renderMeta();
      };
      row.appendChild(b);
      box.appendChild(elOr(row));
    }
  }
  function elOr(x) { return x; }

  function startRun() {
    SFX.resume();
    resetWorld();
    pendingLevels = 0;
    makePlayer(save.selected || "aldric");
    recacheStats();
    player.hp = player.maxHp;
    player.inv = 1.2;
    G.mode = "play";
    hideLayers();
    $("hud").classList.add("show");
    paintDock();
    banner("HOLD THE KEEP", 2);
    for (let i = 0; i < 10; i++) {
      const a = (TAU * i) / 10 + rand(-0.1, 0.1);
      const r = rand(240, 340);
      spawnEnemy("slime", player.x + Math.cos(a) * r, player.y + Math.sin(a) * r);
    }
  }

  function pauseGame() {
    if (G.mode !== "play") return;
    G.mode = "pause";
    showLayer("pause");
  }
  function resumeGame() {
    if (G.mode !== "pause") return;
    G.mode = "play";
    hideLayers();
    $("hud").classList.add("show");
  }

  function endRun(win) {
    $("hud").classList.remove("show");
    const bonus = Math.round(G.gold + G.kills * 0.35 + G.t * 0.15 + (win ? 80 : 0));
    save.gold += bonus;
    save.bestTime = Math.max(save.bestTime, G.t);
    save.bestKills = Math.max(save.bestKills, G.kills);
    if (win) save.wins++;
    persist();
    $("end-title").textContent = win ? "Dawn" : "Fallen";
    $("end-sub").textContent = win
      ? "The keep holds. The sun finds you standing."
      : "The oath is broken. Rise and swear it again.";
    $("end-stats").innerHTML = `
      <div><span>Time</span><b>${fmtTime(G.t)}</b></div>
      <div><span>Slain</span><b>${G.kills}</b></div>
      <div><span>Level</span><b>${player ? player.level : 1}</b></div>
      <div><span>Gold earned</span><b>${bonus}</b></div>`;
    showLayer("end");
  }
  function dieRun() {
    G.mode = "dead";
    SFX.dead();
    burst(player.x, player.y, 40, "#d4b06a", 240);
    setTimeout(() => endRun(false), 700);
  }
  function winRun() {
    G.mode = "win";
    SFX.win();
    banner("DAWN", 3);
    setTimeout(() => endRun(true), 1200);
  }

  $("btn-play").onclick = startRun;
  $("btn-chars").onclick = () => { renderChars(); showLayer("chars"); };
  $("btn-meta").onclick = () => { renderMeta(); showLayer("meta"); };
  $("btn-help").onclick = () => showLayer("help");
  $("chars-back").onclick = () => showLayer("title-screen");
  $("meta-back").onclick = () => showLayer("title-screen");
  $("help-back").onclick = () => showLayer("title-screen");
  $("pause-resume").onclick = resumeGame;
  $("pause-quit").onclick = () => { G.mode = "dead"; endRun(false); };
  $("end-again").onclick = startRun;
  $("end-menu").onclick = () => {
    G.mode = "menu";
    player = null;
    showLayer("title-screen");
    refreshTitleMeta();
  };

  // ─────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────
  loadImages().then(() => {
    resize();
    if (IM.ground) groundPat = ctx.createPattern(IM.ground, "repeat");
    refreshTitleMeta();
    requestAnimationFrame(frame);
    const boot = new URLSearchParams(location.search).get("boot");
    if (boot === "play") startRun();
    if (boot === "chars") { renderChars(); showLayer("chars"); }
  });
})();
