(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const WORLD = 3600;
  const MAX_ENEMIES = 340;
  const CELL = 88;
  const RUN_DAWN = 510; // Dawn Eater at 8:30
  const SAVE_KEY = "oathbound_v1";
  const ART = window.OathArt;
  let artTime = 0;

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
    swear: 0,
    brand: 0,
    oathWins: 0,
  });
  let save = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = defaultSave();
      save = Object.assign(base, parsed);
      save.perm = Object.assign(base.perm, parsed.perm || {});
      if (!Array.isArray(save.unlocked) || !save.unlocked.length) save.unlocked = ["aldric"];
    }
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
      blurb: "Balanced oath-knight. His dash cuts a blade arc.",
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
      blurb: "Swift battle-sister. Her dash plants a cross that fires.",
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
      blurb: "A walking reliquary. His dash leaves a pool of blood.",
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
      desc: "A vast blood field. Kills restore you. Once, it refuses your death.",
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

  const VIRTUE_NOTE = {
    rage: " Blades spin faster, and reverse when you dash.",
    faith: " Holy bolts bend toward the nearest foe.",
    might: " Flame reaches farther and leaves embers.",
    focus: " Frost slows harder.",
    wrath: " Lightning chains through the swarm.",
    swift: " The thorn ring pulses sooner.",
    vitality: " The blood aura drinks deeper.",
    magnet: " Returning skulls drag the horde with them.",
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
    slime: { hp: 18, spd: 62, r: 16, dmg: 8, xp: 3, gold: 1, img: "slime", draw: 42, mass: 1.2 },
    mite: { hp: 8, spd: 92, r: 10, dmg: 5, xp: 1, gold: 0, img: "slime", draw: 24, mass: 0.6 },
    skeleton: { hp: 16, spd: 104, r: 14, dmg: 9, xp: 4, gold: 1, img: "skeleton", draw: 48, mass: 0.9 },
    bat: { hp: 10, spd: 128, r: 13, dmg: 7, xp: 3, gold: 1, img: "bat", draw: 44, mass: 0.5, ai: "sine" },
    wight: { hp: 28, spd: 78, r: 16, dmg: 8, xp: 7, gold: 2, img: "wight", draw: 52, mass: 1, ai: "kite" },
    shade: { hp: 42, spd: 88, r: 17, dmg: 14, xp: 10, gold: 3, img: "shade", draw: 56, mass: 1.3, ai: "charge" },
    golem: { hp: 140, spd: 42, r: 26, dmg: 20, xp: 22, gold: 6, img: "golem", draw: 88, mass: 3, ai: "slam" },
    duke: { hp: 980, spd: 78, r: 30, dmg: 18, xp: 120, gold: 40, img: "duke", draw: 124, mass: 4, ai: "boss_duke", boss: 1 },
    hydra: { hp: 1680, spd: 64, r: 34, dmg: 16, xp: 180, gold: 55, img: "hydra", draw: 132, mass: 5, ai: "boss_hydra", boss: 1 },
    eater: { hp: 3200, spd: 72, r: 38, dmg: 22, xp: 400, gold: 120, img: "dawneater", draw: 156, mass: 6, ai: "boss_eater", boss: 1 },
  };

  const BOSS_NAME = {
    duke: "The Wailing Duke",
    hydra: "Bone Hydra",
    eater: "The Dawn Eater",
  };

  const META_UP = [
    { id: "hp", name: "Iron Constitution", desc: "+12 max HP each rank", max: 5, base: 80 },
    { id: "dmg", name: "Tempered Edge", desc: "+8% damage each rank", max: 5, base: 90 },
    { id: "spd", name: "Oiled Joints", desc: "+6% move speed each rank", max: 5, base: 80 },
    { id: "luck", name: "Saint's Coin", desc: "+10% gold, and blessings lean away from scraps", max: 5, base: 100 },
  ];

  const INTROS = [
    { t: 22, text: "THE DEAD RISE" },
    { t: 48, text: "WINGS OVER THE GATES" },
    { t: 110, text: "WIGHTS IN THE BREACH" },
    { t: 155, text: "SHADES BREAK IN" },
    { t: 215, text: "THE STONES WAKE" },
  ];

  // ─────────────────────────────────────────────
  // Audio
  // ─────────────────────────────────────────────
  const SFX = {
    ctx: null,
    drone: null,
    ready: false,
    last: {},
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
    allow(name, gap) {
      if (!this.ctx) return false;
      const now = this.ctx.currentTime;
      if (this.last[name] && now - this.last[name] < gap) return false;
      this.last[name] = now;
      return true;
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
    hit() { if (this.allow("hit", 0.05)) this.beep(180 + Math.random() * 80, 0.05, "square", 0.03); },
    pickup() { this.beep(880, 0.07, "sine", 0.04); },
    level() { this.beep(523, 0.1, "triangle", 0.06); setTimeout(() => this.beep(784, 0.14, "triangle", 0.06), 80); },
    dash() { this.noise(0.12, 0.05); },
    hurt() { if (this.allow("hurt", 0.12)) this.beep(90, 0.16, "sawtooth", 0.07); },
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
    const originals = Promise.all(IMG_NAMES.map((n) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { IM[n] = im; res(); };
      im.onerror = () => { IM[n] = null; res(); };
      im.src = "assets/sprites/" + (n === "ground" ? "ground.png" : n + ".png");
    })));
    return Promise.all([originals, ART ? ART.init(save.selected || "aldric") : Promise.resolve()]);
  }

  // ─────────────────────────────────────────────
  // Canvas / camera
  // ─────────────────────────────────────────────
  const canvas = $("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  let W = 1280, H = 720, DPR = 1, zoom = 1;
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
    updateZoom();
    if (player) updateCamera(1);
  }
  function updateZoom() {
    // Keep actors readable instead of shrinking the entire arena into the window.
    zoom = Math.max(clamp(Math.min(W / 1280, H / 720), 0.8, 1.25),
      W / (KEEP.inner.w - 480), H / (KEEP.inner.h - 480));
  }
  function updateCamera(follow) {
    const halfW = W / (2 * zoom), halfH = H / (2 * zoom);
    const minX = KEEP.x + halfW, maxX = KEEP.x + KEEP.w - halfW;
    const minY = KEEP.y + halfH, maxY = KEEP.y + KEEP.h - halfH;
    const targetX = clamp(player.x, minX, maxX);
    const targetY = clamp(player.y, minY, maxY);
    cam.x = clamp(lerp(cam.x, targetX, follow), minX, maxX);
    cam.y = clamp(lerp(cam.y, targetY, follow), minY, maxY);
  }
  window.addEventListener("resize", resize);

  // ─────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────
  const keys = Object.create(null);
  const mouse = { x: 0, y: 0, wx: 0, wy: 0 };
  window.addEventListener("keydown", (e) => {
    if (G.mode === "levelup") {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === "ArrowLeft" || e.code === "ArrowUp") selectCard(selectedCard - 1, true);
      else if (e.code === "ArrowRight" || e.code === "ArrowDown") selectCard(selectedCard + 1, true);
      else if (e.code === "Enter" || e.code === "Space") pickCard(selectedCard);
      else if (e.code === "Digit1") pickCard(0);
      else if (e.code === "Digit2") pickCard(1);
      else if (e.code === "Digit3") pickCard(2);
      return;
    }
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (G.mode === "play" && (e.code === "Escape" || e.code === "KeyP")) pauseGame();
    else if (G.mode === "pause" && (e.code === "Escape" || e.code === "KeyP")) resumeGame();
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
  // The keep
  // ─────────────────────────────────────────────
  function buildKeep() {
    const w = 3200, h = 3200, t = 44, gap = 156;
    const x = (WORLD - w) / 2, y = (WORLD - h) / 2;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const gapL = cx - gap / 2;
    const gapR = cx + gap / 2;
    const gapT = cy - gap / 2;
    const gapB = cy + gap / 2;
    const walls = [
      { x: x, y: y, w: gapL - x, h: t },
      { x: gapR, y: y, w: x + w - gapR, h: t },
      { x: x, y: y + h - t, w: gapL - x, h: t },
      { x: gapR, y: y + h - t, w: x + w - gapR, h: t },
      { x: x, y: y, w: t, h: gapT - y },
      { x: x, y: gapB, w: t, h: y + h - gapB },
      { x: x + w - t, y: y, w: t, h: gapT - y },
      { x: x + w - t, y: gapB, w: t, h: y + h - gapB },
    ];
    const gates = [
      { name: "north", x: cx, y: y + t * 0.5, nx: 0, ny: 1, tx: 1, ty: 0 },
      { name: "south", x: cx, y: y + h - t * 0.5, nx: 0, ny: -1, tx: 1, ty: 0 },
      { name: "west", x: x + t * 0.5, y: cy, nx: 1, ny: 0, tx: 0, ty: 1 },
      { name: "east", x: x + w - t * 0.5, y: cy, nx: -1, ny: 0, tx: 0, ty: 1 },
    ];
    return {
      x, y, w, h, t, gap, walls, gates,
      inner: { x: x + t, y: y + t, w: w - 2 * t, h: h - 2 * t },
    };
  }
  const KEEP = buildKeep();

  function pointInWalls(px, py) {
    for (const w of KEEP.walls) {
      if (px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h) return true;
    }
    return false;
  }

  function pushOutOfRect(ent, w) {
    const r = ent.r;
    const cx = clamp(ent.x, w.x, w.x + w.w);
    const cy = clamp(ent.y, w.y, w.y + w.h);
    let dx = ent.x - cx;
    let dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) return;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      ent.x += (dx / d) * (r - d);
      ent.y += (dy / d) * (r - d);
      return;
    }
    const left = ent.x - w.x;
    const right = w.x + w.w - ent.x;
    const top = ent.y - w.y;
    const bot = w.y + w.h - ent.y;
    const m = Math.min(left, right, top, bot);
    if (m === left) ent.x = w.x - r;
    else if (m === right) ent.x = w.x + w.w + r;
    else if (m === top) ent.y = w.y - r;
    else ent.y = w.y + w.h + r;
  }

  function resolveWalls(ent) {
    for (let n = 0; n < 2; n++) {
      for (const w of KEEP.walls) pushOutOfRect(ent, w);
    }
    ent.x = clamp(ent.x, KEEP.x + ent.r, KEEP.x + KEEP.w - ent.r);
    ent.y = clamp(ent.y, KEEP.y + ent.r, KEEP.y + KEEP.h - ent.r);
  }

  function resolvePillars(ent) {
    for (const o of obstacles) {
      const dx = ent.x - o.x, dy = ent.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = o.r + ent.r;
      if (d < min) {
        const ux = d ? dx / d : 1, uy = d ? dy / d : 0;
        ent.x = o.x + ux * min;
        ent.y = o.y + uy * min;
      }
    }
  }

  function gatePoint(i, depth, jitter) {
    const g = KEEP.gates[((i % KEEP.gates.length) + KEEP.gates.length) % KEEP.gates.length];
    const limit = KEEP.gap * 0.5 - 28;
    let j = jitter == null ? rand(-limit, limit) : jitter;
    j = clamp(j, -limit, limit);
    return {
      x: g.x + g.nx * depth + g.tx * j,
      y: g.y + g.ny * depth + g.ty * j,
      g,
    };
  }

  function approachPoint() {
    // Use entrances just beyond the camera so a larger courtyard stays active.
    const inner = KEEP.inner;
    const minX = inner.x + 64, maxX = inner.x + inner.w - 64;
    const minY = inner.y + 64, maxY = inner.y + inner.h - 64;
    const halfW = W / (2 * zoom), halfH = H / (2 * zoom), margin = 120;
    const left = cam.x - halfW - margin, right = cam.x + halfW + margin;
    const top = cam.y - halfH - margin, bottom = cam.y + halfH + margin;
    const edges = [];
    if (left >= minX) edges.push({ x: left, y: rand(Math.max(minY, top), Math.min(maxY, bottom)) });
    if (right <= maxX) edges.push({ x: right, y: rand(Math.max(minY, top), Math.min(maxY, bottom)) });
    if (top >= minY) edges.push({ x: rand(Math.max(minX, left), Math.min(maxX, right)), y: top });
    if (bottom <= maxY) edges.push({ x: rand(Math.max(minX, left), Math.min(maxX, right)), y: bottom });
    return edges.length ? pick(edges) : gatePoint(irand(0, 3), 80);
  }

  // ─────────────────────────────────────────────
  // Pools / world
  // ─────────────────────────────────────────────
  const G = {
    mode: "menu",
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
    spawnAcc: 0,
    oath: 0,
    dawn: 0,
    brandNew: 0,
  };

  let player = null;
  const enemies = [];
  const projs = [];
  const pickups = [];
  const parts = [];
  const floats = [];
  const obstacles = [];
  const telegraphs = [];
  const zones = [];
  const bolts = [];
  const corpses = [];
  const impacts = [];

  const PILLARS = [
    [1600, 1600, 32], [2000, 1600, 34], [1600, 2000, 30], [2000, 2000, 36],
    [1800, 1520, 26], [1540, 1800, 28], [2060, 1800, 28], [1800, 2080, 32],
    [1680, 1900, 26], [1920, 1700, 28],
  ].flatMap(([x, y, r]) => [1, 2.5, 4.5].map((scale) => [
    WORLD / 2 + (x - WORLD / 2) * scale,
    WORLD / 2 + (y - WORLD / 2) * scale, r,
  ]));

  const SHRINE_DEFS = [
    { x: 1688, y: 1464, kind: "armory", name: "Armory", wait: 58 },
    { x: 1912, y: 2144, kind: "soul", name: "Soul Well", wait: 26 },
    { x: 1452, y: 1800, kind: "wind", name: "Wind Censer", wait: 30 },
    { x: 2148, y: 1800, kind: "wrath", name: "Wrath Brazier", wait: 30 },
    { x: 1500, y: 1500, kind: "phial", name: "Phial", wait: 34 },
    { x: 2100, y: 1500, kind: "might", name: "Ember", wait: 32 },
    { x: 1500, y: 2100, kind: "aegis", name: "Aegis", wait: 38 },
    { x: 2100, y: 2100, kind: "magnet", name: "Lodestone", wait: 36 },
  ];
  const OUTER_SHRINES = SHRINE_DEFS.map((s) => ({ ...s,
    x: WORLD / 2 + (s.x - WORLD / 2) * 3.8,
    y: WORLD / 2 + (s.y - WORLD / 2) * 3.8,
  }));
  const SHRINE_COL = {
    armory: "#d4b06a",
    soul: "#8ec4ff",
    wind: "#9ad8c8",
    wrath: "#ffb15a",
    phial: "#e07070",
    might: "#ff7a3a",
    aegis: "#ffe08a",
    magnet: "#c8b8e0",
  };
  const shrines = [];

  function resetWorld() {
    enemies.length = 0;
    projs.length = 0;
    pickups.length = 0;
    parts.length = 0;
    floats.length = 0;
    obstacles.length = 0;
    telegraphs.length = 0;
    zones.length = 0;
    bolts.length = 0;
    corpses.length = 0;
    impacts.length = 0;
    artTime = 0;
    G.t = 0; G.kills = 0; G.gold = 0; G.combo = 0; G.comboT = 0;
    G.shake = 0; G.hitstop = 0; G.spawnAcc = 0; G.dawn = 0; G.brandNew = 0;
    G.spawnedBoss = { duke: 0, hydra: 0, eater: 0 };
    G.shopAfter = 0;
    shrines.length = 0;
    for (const s of PILLARS) obstacles.push({ x: s[0], y: s[1], r: s[2] });
    for (const s of [...SHRINE_DEFS, ...OUTER_SHRINES]) shrines.push({ x: s.x, y: s.y, kind: s.kind, name: s.name, wait: s.wait, t: 0 });
  }

  function makePlayer(id) {
    const c = CHARS[id];
    const p = {
      id, x: WORLD / 2, y: WORLD / 2, vx: 0, vy: 0,
      r: 16,
      maxHp: c.hp,
      hp: 0,
      baseSpd: c.spd,
      armor: c.armor,
      atkMul: c.atk,
      area: 1, cooldown: 1, pickup: 78, crit: 0.06, proj: 1,
      facing: 1, moving: 0,
      artTime: 0, artState: null, hurtUntil: 0, castUntil: 0,
      dash: 0, dashCd: 0, dashCdMax: 2.15, inv: 0,
      dashDirX: 1, dashDirY: 0, dashHeld: false,
      lastX: 1, lastY: 0,
      xp: 0, level: 1, next: 10,
      weapons: [{ id: c.start, lv: 1 }],
      passives: [],
      mods: { hp: 0, atk: 1, cd: 1, spd: 1, pickup: 0 },
      cd: {},
      orbA: 0,
      bladeA: 0,
      brandId: null,
      usedPact: 0,
      buffs: { wind: 0, might: 0, wrath: 0, magnet: 0 },
      shield: 0,
      swing: 0,
    };
    player = p;
    if (save.brand) {
      const ids = Object.keys(PASSIVES);
      const vid = ids[(Math.random() * ids.length) | 0];
      p.passives.push({ id: vid, lv: 1 });
      p.brandId = vid;
    }
    recacheStats();
    p.hp = p.maxHp;
    cam.x = p.x; cam.y = p.y;
  }

  function hasW(id) { return player.weapons.some((w) => w.id === id); }
  function hasP(id) { return player.passives.some((p) => p.id === id); }
  function wlv(id) { const w = player.weapons.find((x) => x.id === id); return w ? w.lv : 0; }
  function plv(id) { const p = player.passives.find((x) => x.id === id); return p ? p.lv : 0; }

  function recacheStats() {
    const c = CHARS[player.id];
    const mods = player.mods;
    player.maxHp = c.hp + save.perm.hp * 12 + plv("vitality") * 22 + mods.hp;
    player.armor = c.armor + plv("vitality") * 1;
    player.atkMul = c.atk * (1 + save.perm.dmg * 0.08) * (1 + plv("might") * 0.14) * mods.atk;
    player.cooldown = (1 / (1 + plv("rage") * 0.12) / (player.id === "mara" ? 1.1 : 1)) * mods.cd;
    player.area = 1 + plv("faith") * 0.14;
    player.pickup = 78 + plv("magnet") * 46 + plv("focus") * 10 + mods.pickup;
    player.crit = 0.06 + plv("wrath") * 0.08;
    player.proj = 1 + plv("focus") * 0.16;
    player.baseSpd = c.spd * (1 + save.perm.spd * 0.06) * (1 + plv("swift") * 0.08) * mods.spd;
    player.dashCdMax = 2.15 / (1 + plv("swift") * 0.1);
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
  let selectedCard = 0;

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
    if (ART && ART.available() && impacts.length < 24) {
      const kind = col === "#9ad8ff" ? "frost" : col === "#c8d0e0" || col === "#c0a070" ? "bone" : col === "#ffe08a" || col === "#d4b06a" ? "holy" : null;
      if (kind) impacts.push({ kind, x, y, born: artTime, size: n > 20 ? 70 : 38 });
    }
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
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
  }

  // ─────────────────────────────────────────────
  // Combat helpers
  // ─────────────────────────────────────────────
  function dmgRoll(base) {
    let d = base * player.atkMul;
    if (player.buffs && player.buffs.might > 0) d *= 1.2;
    let crit = false;
    const chance = player.crit + ((player.buffs && player.buffs.wrath > 0) ? 0.12 : 0);
    if (Math.random() < chance) { d *= 2; crit = true; }
    return { d: d | 0 || 1, crit };
  }

  function hurtEnemy(e, amount, crit, hx, hy) {
    if (e.hp <= 0) return;
    e.hp -= amount;
    e.flash = 0.1;
    e.hurtUntil = artTime + .16;
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
    if (ART && ART.available()) {
      if (corpses.length >= 32) corpses.shift();
      corpses.push({ ...e, flash: 0, inv: 0, born: artTime, artState: null });
    }
    const col = e.boss ? "#d4b06a" : e.elite ? "#ffd36a" : "#c8d0e0";
    burst(e.x, e.y, e.boss ? 40 : e.elite ? 18 : 8, col, e.boss ? 260 : 160);
    if (e.boss) { G.shake = 14; G.hitstop = Math.max(G.hitstop, 0.05); SFX.boss(); }
    dropLoot(e);
    if (e.type === "duke") G.shopAfter = 1.4;
    if (e.type === "hydra") {
      const left = enemies.some((o) => o !== e && o.type === "hydra" && o.hp > 0);
      if (!left) G.shopAfter = 1.4;
    }
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
    if (!G.oath && e.elite && Math.random() < 0.35) spawnPickup("meat", e.x, e.y, 24);
    if (e.boss) spawnPickup("chest", e.x, e.y, 1);
  }

  function mergeXpInto(x, y, val) {
    for (let i = 0; i < pickups.length; i++) {
      const u = pickups[i];
      if (u.kind !== "xp") continue;
      if (dist2(u.x, u.y, x, y) < 36 * 36) {
        u.val += val;
        u.x = (u.x + x) * 0.5;
        u.y = (u.y + y) * 0.5;
        return true;
      }
    }
    return false;
  }

  function spawnPickup(kind, x, y, val) {
    if (kind === "xp" && mergeXpInto(x, y, val)) return;
    if (pickups.length > 260) {
      for (let i = 0; i < pickups.length; i++) {
        if (pickups[i].kind === "xp") { pickups.splice(i, 1); break; }
      }
    }
    pickups.push({ kind, x, y, val, t: 0 });
  }

  function hurtPlayer(amount, srcx, srcy) {
    if (!player || player.inv > 0 || G.mode !== "play") return;
    if (player.shield > 0) {
      player.shield--;
      player.inv = 0.4;
      burst(player.x, player.y, 14, "#ffe08a", 140);
      floatText(player.x, player.y - 24, "AEGIS", "#ffe08a");
      SFX.dash();
      return;
    }
    const red = amount * (100 / (100 + player.armor));
    player.hp -= red;
    player.hurtUntil = artTime + .25;
    player.inv = 0.55;
    G.shake = 10;
    G.hitstop = Math.max(G.hitstop, 0.045);
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
  // Projectiles and weapons
  // ─────────────────────────────────────────────
  function fireBolt(x, y, a, spec) {
    if (player && !spec.enemy) player.swing = 0.14;
    if (projs.length > 240) return;
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
      home: spec.home || 0,
      ash: spec.ash || 0,
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

  function evoLine(id) {
    const ev = EVOS.find((e) => e.from === id);
    if (!ev) return "";
    return " Evolves with " + PASSIVES[ev.need].name + " at rank 6.";
  }
  function virtueLine(id) {
    const ev = EVOS.find((e) => e.need === id);
    const note = VIRTUE_NOTE[id] || "";
    const pair = ev ? " Evolves " + WEAPONS[ev.from].name + "." : "";
    return pair + note;
  }

  function weaponTick(dt) {
    const p = player;
    p.orbA += dt * 2.4;
    const rage = plv("rage");
    p.bladeA += dt * (2.15 + rage * 0.42) * (p.dash > 0 && rage ? -1.65 : 1);
    for (const w of p.weapons) {
      const id = w.id, lv = w.lv;
      p.cd[id] = (p.cd[id] || 0) - dt;
      const area = p.area;
      if (id === "oathblade" || id === "crown") {
        const n = id === "crown" ? 8 + lv : 2 + lv;
        const rad = (id === "crown" ? 78 : 54) * area + lv * 4;
        const dmg = (id === "crown" ? 16 : 9) + lv * 3;
        for (let i = 0; i < n; i++) {
          const a = p.bladeA + (TAU * i) / n;
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
          const faith = plv("faith");
          for (let i = 0; i < dirs; i++) {
            fireBolt(p.x, p.y, (TAU * i) / dirs, {
              spd: 380 * p.proj, dmg, r: 7 * area,
              pierce: id === "judgment" ? 6 : 1 + (lv > 4 ? 2 : 0),
              life: 1.05, kind: "holy",
              home: faith ? (id === "judgment" ? 0.45 : 1.15) : 0,
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
          const might = plv("might");
          for (let i = 0; i < count; i++) {
            const a = id === "dragon"
              ? (TAU * i) / count + G.t
              : aim + (i - (count - 1) / 2) * (spread / count);
            fireBolt(p.x, p.y, a, {
              spd: 260 + rand(-20, 40), dmg, r: 8 * area,
              pierce: 2, life: 0.38 + lv * 0.02 + might * 0.04, kind: "fire",
              ash: might ? (id === "dragon" ? 0.1 : 0.42) : 0,
            });
          }
        }
      } else if (id === "frost" || id === "glacier") {
        if (p.cd[id] <= 0) {
          p.cd[id] = (id === "glacier" ? 0.55 : 0.7) * p.cooldown;
          const t = nearestEnemy(p.x, p.y, 520);
          const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
          const extra = id === "glacier" ? 2 : (lv >= 6 ? 1 : 0);
          const slow = (id === "glacier" ? 0.55 : 0.45) + plv("focus") * 0.1;
          for (let i = -extra; i <= extra; i++) {
            fireBolt(p.x, p.y, a + i * 0.14, {
              spd: 460 * p.proj, dmg: (id === "glacier" ? 16 : 11) + lv * 2,
              r: (id === "glacier" ? 10 : 6) * area,
              pierce: id === "glacier" ? 8 : 3 + lv,
              life: 1.15, kind: "frost", slow,
            });
          }
        }
      } else if (id === "storm" || id === "tempest") {
        if (p.cd[id] <= 0) {
          p.cd[id] = (id === "tempest" ? 0.48 : 0.62) * p.cooldown;
          const n = (id === "tempest" ? 3 : 1) + (lv > 4 ? 1 : 0);
          const wrath = plv("wrath");
          const chains = id === "tempest" ? 3 + Math.min(2, wrath) : wrath;
          zapStorm(n, (id === "tempest" ? 18 : 13) + lv * 3, chains);
        }
      } else if (id === "thorn" || id === "worldthorn") {
        if (p.cd[id] <= 0) {
          const swift = 1 / (1 + plv("swift") * 0.08);
          p.cd[id] = (id === "worldthorn" ? 1.1 : 1.45) * p.cooldown * swift;
          const maxR = (id === "worldthorn" ? 210 : 130) * area + lv * 8;
          const dmg = (id === "worldthorn" ? 18 : 12) + lv * 2;
          telegraphs.push({ kind: "ring", x: p.x, y: p.y, r: 10, maxR, t: 0, life: 0.32, dmg, friendly: 1 });
        }
      } else if (id === "bloodwell" || id === "crimson") {
        if (p.cd[id] <= 0) {
          p.cd[id] = 0.4 * p.cooldown;
          const rad = (id === "crimson" ? 130 : 78) * area + lv * 6;
          const dmg = (id === "crimson" ? 10 : 6) + lv * 2;
          const healMul = 1 + plv("vitality") * 0.22;
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
            player.hp = Math.min(player.maxHp, player.hp + hits * (id === "crimson" ? 1.2 : 0.35) * healMul);
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

  function lightning(x1, y1, x2, y2) {
    bolts.push({ x1, y1, x2, y2, life: 0.12 });
  }

  function updateProjs(dt) {
    const magnet = player ? plv("magnet") : 0;
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      if (pr.home && !pr.enemy) {
        const tgt = nearestEnemy(pr.x, pr.y, 360);
        if (tgt) {
          const want = Math.atan2(tgt.y - pr.y, tgt.x - pr.x);
          let cur = Math.atan2(pr.vy, pr.vx);
          let dlt = want - cur;
          while (dlt > Math.PI) dlt -= TAU;
          while (dlt < -Math.PI) dlt += TAU;
          cur += clamp(dlt, -pr.home * dt * 5.5, pr.home * dt * 5.5);
          const sp = Math.hypot(pr.vx, pr.vy);
          pr.vx = Math.cos(cur) * sp;
          pr.vy = Math.sin(cur) * sp;
          pr.a = cur;
        }
      }
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.kind === "skull" && pr.life < 0.45 && player) {
        const dx = player.x - pr.x, dy = player.y - pr.y;
        const pull = magnet ? 0.22 : 0.15;
        pr.vx = lerp(pr.vx, dx * (magnet ? 7.5 : 6), pull);
        pr.vy = lerp(pr.vy, dy * (magnet ? 7.5 : 6), pull);
        pr.a = Math.atan2(pr.vy, pr.vx);
        if (magnet) {
          query(pr.x, pr.y, 64, qbuf);
          for (const e of qbuf) {
            if (e.hp <= 0 || e.boss) continue;
            const ddx = pr.x - e.x, ddy = pr.y - e.y;
            const L = len(ddx, ddy);
            e.kx += (ddx / L) * 22;
            e.ky += (ddy / L) * 22;
          }
        }
      }
      if (pr.life <= 0) {
        if (pr.kind === "fire" && pr.ash && zones.length < 18 && Math.random() < pr.ash) {
          zones.push({
            kind: "fire", x: pr.x, y: pr.y,
            r: 30 * (player ? player.area : 1),
            t: 0, life: 1.3, tick: 0.22, dmg: Math.max(2, pr.dmg * 0.5),
          });
        }
        projs.splice(i, 1);
        continue;
      }
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
      if (tg.kind === "line") {
        if (tg.t >= tg.life) telegraphs.splice(i, 1);
        continue;
      }
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

  function knightPower() {
    if (!player) return 8;
    if (player.id === "aldric") return 8 + ((wlv("crown") || wlv("oathblade")) * 2);
    if (player.id === "mara") return 10 + ((wlv("judgment") || wlv("holy")) * 2);
    return 6 + (wlv("crimson") || wlv("bloodwell"));
  }

  function knightDash(p) {
    const dmg = knightPower();
    if (p.id === "aldric") {
      zones.push({
        kind: "arc", x: p.x, y: p.y, r: 64, t: 0, life: 0.2,
        dmg, hit: new Set(),
      });
    } else if (p.id === "mara") {
      zones.push({
        kind: "cross", x: p.x, y: p.y, r: 18, t: 0, life: 0.4, dmg, fired: 0,
      });
    } else {
      zones.push({
        kind: "blood", x: p.x, y: p.y, r: 76, t: 0, life: 3.3,
        tick: 0.12, dmg,
      });
    }
  }

  function updateZones(dt) {
    if (!player) return;
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.t += dt;
      if (z.kind === "arc") {
        z.x = player.x + player.dashDirX * 36;
        z.y = player.y + player.dashDirY * 36;
        query(z.x, z.y, z.r + 16, qbuf);
        for (const e of qbuf) {
          if (e.hp <= 0 || z.hit.has(e)) continue;
          const dx = e.x - player.x, dy = e.y - player.y;
          if (dx * player.dashDirX + dy * player.dashDirY < 6) continue;
          if (dist2(e.x, e.y, z.x, z.y) <= (z.r + e.r) * (z.r + e.r)) {
            z.hit.add(e);
            const roll = dmgRoll(z.dmg);
            hurtEnemy(e, roll.d, roll.crit, player.x, player.y);
          }
        }
      } else if (z.kind === "blood" || z.kind === "fire") {
        z.tick -= dt;
        if (z.tick <= 0) {
          z.tick = z.kind === "fire" ? 0.34 : 0.4;
          query(z.x, z.y, z.r, qbuf);
          let hits = 0;
          for (const e of qbuf) {
            if (e.hp <= 0) continue;
            if (dist2(e.x, e.y, z.x, z.y) <= (z.r + e.r) * (z.r + e.r)) {
              const roll = dmgRoll(z.dmg);
              hurtEnemy(e, roll.d, false, z.x, z.y);
              hits++;
            }
          }
          if (z.kind === "blood" && hits) {
            player.hp = Math.min(player.maxHp, player.hp + Math.min(4, hits * 0.5));
          }
        }
      } else if (z.kind === "cross" && !z.fired && z.t >= z.life) {
        z.fired = 1;
        for (let k = 0; k < 4; k++) {
          fireBolt(z.x, z.y, (TAU * k) / 4, {
            spd: 370, dmg: z.dmg, r: 7 * player.area, pierce: 2, life: 0.75, kind: "holy",
            home: plv("faith") ? 0.8 : 0,
          });
        }
        SFX.hit();
      }
      const done = z.kind === "cross" ? z.t > z.life + 0.05 : z.t >= z.life;
      if (done) zones.splice(i, 1);
    }
  }

  // ─────────────────────────────────────────────
  // Enemies
  // ─────────────────────────────────────────────
  function spawnEnemy(type, x, y, elite) {
    if (enemies.length >= MAX_ENEMIES && !ENEMY[type].boss) return null;
    const d = ENEMY[type];
    if (x === undefined) {
      const at = gatePoint(irand(0, 3), rand(24, 70));
      x = at.x;
      y = at.y;
    }
    x = clamp(x, KEEP.x + 20, KEEP.x + KEEP.w - 20);
    y = clamp(y, KEEP.y + 20, KEEP.y + KEEP.h - 20);
    const scale = 1 + G.t / 420;
    const e = {
      type, x, y, vx: 0, vy: 0, kx: 0, ky: 0,
      r: d.r * (elite ? 1.35 : 1),
      hp: Math.round(d.hp * scale * (elite ? 2.6 : 1)),
      maxHp: 0,
      spd: d.spd * (elite ? 1.08 : 1) * (G.oath ? 1.06 : 1),
      dmg: d.dmg,
      xp: d.xp, gold: d.gold,
      img: d.img, draw: d.draw * (elite ? 1.3 : 1),
      mass: d.mass, ai: d.ai || "seek",
      elite: !!elite, boss: !!d.boss,
      flash: 0, slow: 0, state: "idle", st: 0, phase: 1,
      cd: d.boss ? 1.05 : 0, facing: 1,
      atkT: 0, split: 0, noShop: 0, lx: 1, ly: 0,
      artTime: 0, artState: null, hurtUntil: 0, castUntil: 0,
    };
    e.maxHp = e.hp;
    enemies.push(e);
    if (ART) ART.requestActor(d.img);
    return e;
  }

  function dukeThink(e, ux, uy, spdMul) {
    if (e.phase === 1 && e.hp < e.maxHp * 0.62) {
      e.phase = 2;
      banner("THE DUKE CALLS THE DEAD", 2.2);
      for (let k = 0; k < 6; k++) {
        const ang = (TAU * k) / 6;
        spawnEnemy("shade", e.x + Math.cos(ang) * 78, e.y + Math.sin(ang) * 78);
      }
    }
    if (e.phase < 3 && e.hp < e.maxHp * 0.3) {
      e.phase = 3;
      e.spd *= 1.2;
      banner("THE DUKE BREAKS", 2);
    }
    if (e.state === "idle") {
      e.vx = ux * e.spd * spdMul;
      e.vy = uy * e.spd * spdMul;
      if (e.cd <= 0) {
        if (Math.random() < 0.58) {
          e.state = "tel";
          e.st = 0;
          e.lx = ux; e.ly = uy;
          telegraphs.push({
            kind: "line", x: e.x, y: e.y, dx: ux, dy: uy,
            len: e.phase === 3 ? 420 : 340, t: 0, life: 0.55,
          });
        } else {
          e.state = "slam";
          e.st = 0;
          telegraphs.push({
            kind: "slam", x: e.x, y: e.y,
            r: e.phase >= 2 ? 168 : 146, t: 0, life: 0.62, dmg: 24,
          });
        }
      }
    } else if (e.state === "tel") {
      e.vx *= 0.72; e.vy *= 0.72;
      if (e.st > 0.55) {
        e.state = "go";
        e.st = 0;
        const sp = e.phase === 3 ? 640 : 520;
        e.vx = e.lx * sp;
        e.vy = e.ly * sp;
      }
    } else if (e.state === "go") {
      if (e.st > 0.4) { e.state = "idle"; e.cd = e.phase === 3 ? 0.72 : 1.15; }
    } else if (e.state === "slam") {
      e.vx *= 0.45; e.vy *= 0.45;
      if (e.st > 0.7) { e.state = "idle"; e.cd = 1.05; }
    }
  }

  function hydraThink(e, ux, uy, dt) {
    if (!e.split && e.hp < e.maxHp * 0.55) {
      e.split = 1;
      e.phase = 2;
      banner("THE HYDRA SPLITS", 2.2);
      const child = spawnEnemy("hydra", e.x + 64, e.y + 36);
      if (child) {
        child.split = 1;
        child.phase = 2;
        child.noShop = 1;
        child.hp = Math.round(e.maxHp * 0.42);
        child.maxHp = child.hp;
        child.spd = e.spd * 1.22;
        child.r = e.r * 0.78;
        child.draw = e.draw * 0.8;
        child.xp = 60;
        child.gold = 18;
        child.cd = 0.35;
      }
      e.spd *= 1.12;
      e.r *= 0.84;
      e.draw *= 0.88;
    }
    if (e.state === "tel") {
      e.vx = 0; e.vy = 0;
      if (e.st >= 0.28) {
        e.state = "lunge"; e.st = 0;
        e.vx = e.lx * 490; e.vy = e.ly * 490;
      }
      return;
    }
    if (e.state === "lunge") {
      if (e.st > 0.42) { e.state = "idle"; e.cd = 0.85; e.atkT = 0; }
      return;
    }
    const ideal = e.phase === 2 ? 200 : 250;
    const d = Math.hypot(player.x - e.x, player.y - e.y) || 1;
    if (d < ideal) { e.vx = -ux * e.spd * 0.85; e.vy = -uy * e.spd * 0.85; }
    else { e.vx = ux * e.spd * 0.75; e.vy = uy * e.spd * 0.75; }
    e.atkT += dt;
    if (e.cd <= 0) {
      e.castUntil = artTime + .25;
      e.cd = e.phase === 2 ? 0.85 : 1.15;
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      const spread = e.phase === 2 ? 3 : 1;
      for (let k = -spread; k <= spread; k++) {
        if (spread === 3 && Math.abs(k) === 2) continue;
        projsEnemy(e.x, e.y, a + k * 0.2, e.phase === 2 ? 12 : 13, 280);
      }
    }
    if (e.atkT > (e.phase === 2 ? 3.1 : 4.2)) {
      e.state = "tel";
      e.st = 0;
      e.atkT = 0;
      e.lx = ux; e.ly = uy;
      e.vx = 0; e.vy = 0;
      telegraphs.push({
        kind: "line", x: e.x, y: e.y, dx: ux, dy: uy, len: 280, t: 0, life: 0.28,
      });
    }
  }

  function eaterThink(e, ux, uy) {
    const p = player;
    if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
      e.phase = 2;
      banner("THE DAWN EATER RAGES", 2.4);
      SFX.boss();
      for (let k = 0; k < 8; k++) spawnEnemy("skeleton");
    }
    if (e.phase === 1) {
      const orbit = 230;
      const tx = p.x + Math.cos(G.t * 0.55) * orbit;
      const ty = p.y + Math.sin(G.t * 0.55) * orbit;
      const lx = tx - e.x, ly = ty - e.y, ll = Math.hypot(lx, ly) || 1;
      e.vx = (lx / ll) * e.spd;
      e.vy = (ly / ll) * e.spd;
    } else {
      e.vx = ux * e.spd * 1.22;
      e.vy = uy * e.spd * 1.22;
    }
    if (e.cd <= 0) {
      e.castUntil = artTime + .35;
      const n = e.phase === 2 ? 2 : 1;
      e.cd = e.phase === 2 ? 1.05 : 1.35;
      const inner = KEEP.inner;
      for (let k = 0; k < n; k++) {
        const side = k - (n - 1) / 2;
        const ox = -uy * side * 92;
        const oy = ux * side * 92;
        telegraphs.push({
          kind: "meteor",
          x: clamp(p.x + ox, inner.x + 36, inner.x + inner.w - 36),
          y: clamp(p.y + oy, inner.y + 36, inner.y + inner.h - 36),
          r: e.phase === 2 ? 74 : 66,
          t: 0,
          life: e.phase === 2 ? 0.7 : 1.0,
          dmg: e.phase === 2 ? 22 : 18,
        });
      }
    }
  }

  function updateEnemies(dt) {
    const p = player;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, (e.slow || 0) - dt * 0.35);
      const spdMul = e.slow > 0 ? 0.55 : 1;
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
        const ideal = 220;
        if (d < ideal - 20) { e.vx = -ux * e.spd * spdMul; e.vy = -uy * e.spd * spdMul; }
        else if (d > ideal + 30) { e.vx = ux * e.spd * spdMul; e.vy = uy * e.spd * spdMul; }
        else {
          e.vx = -uy * e.spd * 0.6 * spdMul;
          e.vy = ux * e.spd * 0.6 * spdMul;
        }
        if (e.cd <= 0) {
          e.castUntil = artTime + .22;
          e.cd = 1.7;
          projsEnemy(e.x, e.y, Math.atan2(dy, dx), 12, 250);
        }
      } else if (e.ai === "charge") {
        if (e.state === "idle") {
          e.vx = ux * e.spd * spdMul; e.vy = uy * e.spd * spdMul;
          if (d < 280 && e.cd <= 0) { e.state = "tel"; e.st = 0; e.lx = ux; e.ly = uy; }
        } else if (e.state === "tel") {
          e.vx *= 0.8; e.vy *= 0.8;
          if (e.st > 0.5) {
            e.state = "go"; e.st = 0;
            e.vx = e.lx * 460; e.vy = e.ly * 460;
          }
        } else if (e.st > 0.38) { e.state = "idle"; e.cd = 1.6; }
      } else if (e.ai === "slam") {
        e.vx = ux * e.spd * spdMul; e.vy = uy * e.spd * spdMul;
        if (d < 110 && e.cd <= 0) {
          e.cd = 2.2;
          telegraphs.push({ kind: "slam", x: e.x, y: e.y, r: 108, t: 0, life: 0.55, dmg: e.dmg + 8 });
        }
      } else if (e.ai === "boss_duke") {
        dukeThink(e, ux, uy, spdMul);
      } else if (e.ai === "boss_hydra") {
        hydraThink(e, ux, uy, dt);
      } else if (e.ai === "boss_eater") {
        eaterThink(e, ux, uy);
      }

      e.kx *= 0.86; e.ky *= 0.86;
      e.x += (e.vx + e.kx) * dt;
      e.y += (e.vy + e.ky) * dt;
      resolvePillars(e);
      resolveWalls(e);

      const td = dist2(e.x, e.y, p.x, p.y);
      const rr = e.r + p.r;
      if (td < rr * rr) {
        const dist = Math.sqrt(td) || 1;
        const ov = rr - dist;
        const px = (e.x - p.x) / dist, py = (e.y - p.y) / dist;
        e.x += px * ov * 0.65;
        e.y += py * ov * 0.65;
        const body = e.state === "go" || e.ai === "seek" || e.ai === "sine" || e.ai === "charge" || e.ai === "slam" || e.boss;
        if (body) {
          const mul = e.ai === "slam" && e.state !== "go" ? 0.45 : 1;
          hurtPlayer(e.dmg * mul, e.x, e.y);
        }
      }
    }

    rebuildHash();
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (a.hp <= 0 || a.boss) continue;
      query(a.x, a.y, 40, qbuf);
      for (const b of qbuf) {
        if (b === a || b.hp <= 0) continue;
        const dx = a.x - b.x, dy = a.y - b.y;
        const dd = dx * dx + dy * dy;
        const min = (a.r + b.r) * 0.72;
        if (dd > 0 && dd < min * min) {
          const dist = Math.sqrt(dd);
          const f = (min - dist) / dist * 0.5;
          a.x += dx * f; a.y += dy * f;
        }
      }
    }
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].hp <= 0) continue;
      resolveWalls(enemies[i]);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) enemies.splice(i, 1);
    }
  }

  function projsEnemy(x, y, a, dmg, spd) {
    projs.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      r: 7, dmg, pierce: 0, life: 2.2, kind: "bone",
      hit: new Set(), enemy: 1, a, home: 0, ash: 0, slow: 0,
    });
  }

  function updateEnemyProjs() {
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
    if (t > 18) pool.push("skeleton", "slime");
    if (t > 42) pool.push("bat", "skeleton");
    if (t > 75) pool.push("mite", "mite", "bat");
    if (t > 105) pool.push("wight");
    if (t > 145) pool.push("shade");
    if (t > 200) pool.push("golem");
    if (t > 280) pool.push("shade", "golem", "wight");
    if (t > 400) pool.push("mite", "skeleton", "shade");
    return pick(pool);
  }

  function director(dt) {
    if (!player) return;
    const t = G.t;
    const oath = G.oath ? 1.42 : 1;
    const rate = (0.72 + t * 0.0065 + Math.floor(t / 40) * 0.2) * oath;
    G.spawnAcc = (G.spawnAcc || 0) + dt * rate;
    const eliteP = G.oath ? 0.055 + t / 7000 : 0.018 + t / 11000;
    while (G.spawnAcc >= 1) {
      G.spawnAcc -= 1;
      const at = approachPoint();
      spawnEnemy(pickType(), at.x, at.y, Math.random() < eliteP);
    }
    const every = G.oath ? 28 : 38;
    if (t > 14 && ((t / every) | 0) !== (((t - dt) / every) | 0)) {
      const gi = (t / every) | 0;
      const n = Math.min(16, 6 + ((t / 55) | 0));
      for (let i = 0; i < n; i++) {
        const at = gatePoint(gi, rand(20, 90), rand(-100, 100));
        spawnEnemy(pickType(), at.x, at.y, Math.random() < (G.oath ? 0.14 : 0.05));
      }
    }
    for (const intro of INTROS) {
      if (t >= intro.t && t - dt < intro.t) banner(intro.text, 1.7);
    }
    if (t >= 180 && !G.spawnedBoss.duke) {
      G.spawnedBoss.duke = 1;
      banner("THE WAILING DUKE", 2.6);
      SFX.boss();
      const at = approachPoint();
      spawnEnemy("duke", at.x, at.y);
    }
    if (t >= 360 && !G.spawnedBoss.hydra) {
      G.spawnedBoss.hydra = 1;
      banner("BONE HYDRA", 2.6);
      SFX.boss();
      const at = approachPoint();
      spawnEnemy("hydra", at.x, at.y);
    }
    if (t >= RUN_DAWN && !G.spawnedBoss.eater) {
      G.spawnedBoss.eater = 1;
      banner("THE DAWN EATER", 3);
      SFX.boss();
      const at = approachPoint();
      spawnEnemy("eater", at.x, at.y);
    }
  }

  // ─────────────────────────────────────────────
  // Player
  // ─────────────────────────────────────────────
  function updatePlayer(dt) {
    const p = player;
    const a = axis();
    p.moving = Math.abs(a.x) + Math.abs(a.y) > 0 ? 1 : 0;
    if (a.x || a.y) { p.lastX = a.x; p.lastY = a.y; }
    if (a.x) p.facing = a.x < 0 ? -1 : 1;
    const wantDash = !!(keys.ShiftLeft || keys.ShiftRight || keys.Space);
    if (wantDash && !p.dashHeld && p.dashCd <= 0 && p.dash <= 0) {
      const useA = a.x || a.y;
      p.dashDirX = useA ? a.x : p.lastX;
      p.dashDirY = useA ? a.y : p.lastY;
      const dl = len(p.dashDirX, p.dashDirY);
      p.dashDirX /= dl; p.dashDirY /= dl;
      p.dash = 0.16;
      p.dashCd = p.dashCdMax;
      p.inv = Math.max(p.inv, 0.26);
      if (Math.abs(p.dashDirX) > 0.25) p.facing = p.dashDirX < 0 ? -1 : 1;
      SFX.dash();
      burst(p.x, p.y, 8, "#d4b06a", 90);
      knightDash(p);
    }
    p.dashHeld = wantDash;
    const boost = p.buffs && p.buffs.wind > 0 ? 1.22 : 1;
    if (p.dash > 0) {
      const spd = p.baseSpd * 3.55 * boost;
      p.vx = p.dashDirX * spd;
      p.vy = p.dashDirY * spd;
    } else {
      const spd = p.baseSpd * boost;
      p.vx = lerp(p.vx, a.x * spd, 0.22);
      p.vy = lerp(p.vy, a.y * spd, 0.22);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    resolvePillars(p);
    const inner = KEEP.inner;
    p.x = clamp(p.x, inner.x + p.r, inner.x + inner.w - p.r);
    p.y = clamp(p.y, inner.y + p.r, inner.y + inner.h - p.r);
    resolvePillars(p);
    p.dash = Math.max(0, p.dash - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.inv = Math.max(0, p.inv - dt);
    p.swing = Math.max(0, (p.swing || 0) - dt);
    if (p.buffs) {
      p.buffs.wind = Math.max(0, p.buffs.wind - dt);
      p.buffs.might = Math.max(0, p.buffs.might - dt);
      p.buffs.wrath = Math.max(0, p.buffs.wrath - dt);
      p.buffs.magnet = Math.max(0, p.buffs.magnet - dt);
    }
    updateShrines(dt);

    mouse.wx = (mouse.x - W / 2) / zoom + cam.x;
    mouse.wy = (mouse.y - H / 2) / zoom + cam.y;
  }

  function grantArmory() {
    const owned = player.weapons.filter((w) => w.lv < 8);
    const fresh = Object.keys(WEAPONS).filter((id) => WEAPONS[id].kind === "weapon" && !hasW(id));
    if (fresh.length && player.weapons.length < 6 && (owned.length === 0 || Math.random() < 0.45)) {
      const id = pick(fresh);
      player.weapons.push({ id, lv: 1 });
      banner(WEAPONS[id].name.toUpperCase(), 1.3);
    } else if (owned.length) {
      const w = pick(owned);
      w.lv++;
      banner(WEAPONS[w.id].name.toUpperCase() + " +1", 1.2);
    } else {
      G.gold += 35;
      floatText(player.x, player.y - 22, "+35", "#d4b06a");
    }
    paintDock();
  }

  function applyShrine(s) {
    const p = player;
    SFX.pickup();
    burst(s.x, s.y - 12, 12, SHRINE_COL[s.kind] || "#d4b06a", 90);
    if (s.kind === "armory") grantArmory();
    else if (s.kind === "soul") {
      const n = 16 + p.level * 3;
      grantXp(n);
      floatText(p.x, p.y - 22, "+" + n, "#8ec4ff");
    } else if (s.kind === "wind") {
      p.buffs.wind = 14;
      floatText(p.x, p.y - 22, "WIND", "#9ad8c8");
    } else if (s.kind === "wrath") {
      p.buffs.wrath = 14;
      floatText(p.x, p.y - 22, "WRATH", "#ffb15a");
    } else if (s.kind === "phial") {
      const n = 42;
      p.hp = Math.min(p.maxHp, p.hp + n);
      floatText(p.x, p.y - 22, "+" + n, "#e07070");
    } else if (s.kind === "might") {
      p.buffs.might = 14;
      floatText(p.x, p.y - 22, "EMBER", "#ff7a3a");
    } else if (s.kind === "aegis") {
      p.shield = (p.shield || 0) + 1;
      floatText(p.x, p.y - 22, "AEGIS", "#ffe08a");
    } else if (s.kind === "magnet") {
      p.buffs.magnet = 16;
      floatText(p.x, p.y - 22, "LODESTONE", "#c8b8e0");
    }
  }

  function updateShrines(dt) {
    if (!player || G.mode !== "play") return;
    for (const s of shrines) {
      if (s.t > 0) s.t = Math.max(0, s.t - dt);
      if (s.t > 0) continue;
      if (dist2(player.x, player.y, s.x, s.y) < 42 * 42) {
        s.t = s.wait;
        applyShrine(s);
      }
    }
  }

  function coalesceSouls() {
    for (let i = 0; i < pickups.length; i++) {
      const a = pickups[i];
      if (!a || a.kind !== "xp") continue;
      for (let j = i + 1; j < pickups.length; j++) {
        const b = pickups[j];
        if (!b || b.kind !== "xp") continue;
        if (dist2(a.x, a.y, b.x, b.y) < 34 * 34) {
          a.val += b.val;
          a.x = (a.x + b.x) * 0.5;
          a.y = (a.y + b.y) * 0.5;
          pickups.splice(j, 1);
          j--;
        }
      }
    }
  }

  function updatePickups(dt) {
    const p = player;
    if (((G.t * 2) | 0) !== (((G.t - dt) * 2) | 0)) coalesceSouls();
    for (let i = pickups.length - 1; i >= 0; i--) {
      const u = pickups[i];
      if (!u) continue;
      u.t += dt;
      const d = Math.hypot(p.x - u.x, p.y - u.y);
      let reach = u.kind === "xp" || u.kind === "gold" ? p.pickup : 28;
      if (p.buffs && p.buffs.magnet > 0 && (u.kind === "xp" || u.kind === "gold")) reach += 100;
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
      if (G.bannerT <= 0) {
        const el = $("banner");
        if (el) el.classList.remove("show");
      }
    }
    if (G.shopAfter > 0 && G.mode === "play") {
      G.shopAfter -= dt;
      if (G.shopAfter <= 0) openShop();
    }
  }

  // ─────────────────────────────────────────────
  // Level up / shop
  // ─────────────────────────────────────────────
  function poolCards() {
    const cards = [];
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
    for (const w of player.weapons) {
      if (WEAPONS[w.id] && WEAPONS[w.id].kind === "evo" && w.lv < 8) {
        cards.push({ type: "wup", id: w.id });
      }
    }
    for (const id of Object.keys(PASSIVES)) {
      const p = player.passives.find((x) => x.id === id);
      if (!p) cards.push({ type: "pnew", id });
      else if (p.lv < 5) cards.push({ type: "pup", id });
    }
    if (!G.oath) cards.push({ type: "heal" });
    cards.push({ type: "gold" });
    return cards;
  }

  function drawCards() {
    const pool = poolCards();
    const evos = pool.filter((c) => c.type === "evo");
    const rest = pool.filter((c) => c.type !== "evo");
    const out = [];
    const luck = save.perm.luck || 0;
    if (evos.length && Math.random() < 0.85 + luck * 0.03) out.push(pick(evos));
    while (out.length < 3 && rest.length) {
      const i = (Math.random() * rest.length) | 0;
      const c = rest.splice(i, 1)[0];
      if (!out.some((o) => o.type === c.type && o.id === c.id)) out.push(c);
    }
    if (luck) {
      for (let i = 0; i < out.length; i++) {
        if (out[i].type !== "heal" && out[i].type !== "gold") continue;
        if (Math.random() > luck * 0.16) continue;
        const j = rest.findIndex((c) => c.type === "wnew" || c.type === "wup" || c.type === "pnew" || c.type === "pup");
        if (j >= 0) out[i] = rest.splice(j, 1)[0];
      }
    }
    while (out.length < 3) out.push(G.oath ? { type: "gold" } : { type: "heal" });
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
      const evolved = w.kind === "evo";
      return {
        title: w.name, ico: w.icon,
        kind: c.type === "wnew" ? "New Weapon" : (evolved ? "Evolution" : "Weapon"),
        body: w.desc + evoLine(c.id),
        lv: c.type === "wnew" ? "NEW" : "Lv " + lv + " → " + (lv + 1),
        evo: evolved ? 1 : 0,
      };
    }
    if (c.type === "pup" || c.type === "pnew") {
      const p = PASSIVES[c.id];
      const lv = plv(c.id);
      return {
        title: p.name, ico: p.icon, kind: "Virtue",
        body: p.desc + virtueLine(c.id),
        lv: c.type === "pnew" ? "NEW" : "Lv " + lv + " → " + (lv + 1),
      };
    }
    if (c.type === "heal") return { title: "Field Rations", ico: "🍖", kind: "Relief", body: "Restore 28 health.", lv: "" };
    return { title: "Spoils", ico: "🪙", kind: "Relief", body: "Gain 25 gold.", lv: "" };
  }

  function applyCard(c) {
    if (c.type === "evo") {
      const w = player.weapons.find((x) => x.id === c.from);
      if (w) { w.id = c.id; w.lv = Math.max(w.lv, 6); }
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

  function selectCard(i, focus = false) {
    if (!offered.length) return;
    selectedCard = (i + offered.length) % offered.length;
    Array.from($("level-cards").children).forEach((el, index) => {
      const selected = index === selectedCard;
      el.classList.toggle("selected", selected);
      el.tabIndex = selected ? 0 : -1;
      if (selected && focus) el.focus({ preventScroll: true });
    });
  }

  function openLevelUp() {
    if (G.mode !== "play" && G.mode !== "levelup") return;
    G.mode = "levelup";
    Object.keys(keys).forEach((code) => { keys[code] = false; });
    SFX.level();
    offered = drawCards();
    const box = $("level-cards");
    box.innerHTML = "";
    offered.forEach((c, i) => {
      const v = cardView(c);
      const el = document.createElement("div");
      el.className = "card" + (v.evo ? " evo" : "");
      el.setAttribute("role", "button");
      const icon = ART ? ART.iconHTML(c.id || (c.type === "heal" ? "meat" : "gold"), v.ico) : v.ico;
      el.innerHTML = `<div class="ico">${icon}</div><div class="kind">${i + 1} · ${v.kind}</div><h3>${v.title}</h3><p>${v.body}</p><div class="lv">${v.lv}</div>`;
      el.onclick = () => pickCard(i);
      el.onmouseenter = () => selectCard(i);
      el.onfocus = () => selectCard(i);
      box.appendChild(el);
    });
    showLayer("levelup");
    selectCard(0, true);
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
    { id: "max", name: "Iron Tonic", desc: "+18 max HP and heal 18.", price: 35, fn: () => { player.mods.hp += 18; player.hp += 18; recacheStats(); } },
    { id: "whet", name: "Whetstone", desc: "+12% damage this vigil.", price: 40, fn: () => { player.mods.atk *= 1.12; recacheStats(); } },
    { id: "oil", name: "Blade Oil", desc: "Weapons fire 10% faster.", price: 38, fn: () => { player.mods.cd *= 0.9; recacheStats(); } },
    { id: "boot", name: "Greaves", desc: "+10% move speed.", price: 28, fn: () => { player.mods.spd *= 1.1; recacheStats(); } },
    { id: "magnet", name: "Lodestone", desc: "Much larger pickup radius.", price: 30, fn: () => { player.mods.pickup += 70; recacheStats(); } },
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
    shopStock.forEach((it) => {
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
        renderShop();
        paintHud();
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
    return { x: (x - cam.x) * zoom + W / 2, y: (y - cam.y) * zoom + H / 2 };
  }

  function stepPose(moving, t, seed) {
    const phase = t * (moving ? 13 : 2.2) + seed;
    const s = Math.sin(phase);
    return {
      bob: moving ? -Math.abs(s) * 3.4 : Math.sin(t * 2.2 + seed) * 1.1,
      sx: 1 + (moving ? s * 0.07 : 0),
      sy: 1 - (moving ? s * 0.06 : 0),
      rot: moving ? s * 0.09 : Math.sin(t * 1.5 + seed) * 0.02,
    };
  }
  function flapPose(t, seed) {
    const f = Math.sin(t * 18 + seed);
    return {
      bob: Math.sin(t * 4.2 + seed) * 7,
      sx: 1 + f * 0.2,
      sy: 1 - f * 0.16,
      rot: Math.sin(t * 3.1 + seed) * 0.22,
    };
  }
  function blobPose(moving, t, seed) {
    const s = Math.sin(t * (moving ? 9 : 3.2) + seed);
    return {
      bob: moving ? -Math.max(0, s) * 3 : Math.sin(t * 2 + seed) * 1,
      sx: 1 + s * (moving ? 0.18 : 0.1),
      sy: 1 - s * (moving ? 0.16 : 0.08),
      rot: 0,
    };
  }
  function heavyPose(moving, t, seed) {
    const rate = moving ? 3.6 : 1.4;
    const s = Math.sin(t * rate + seed);
    const plant = moving ? Math.pow(Math.max(0, Math.sin(t * rate + seed)), 2) : 0;
    return {
      bob: -plant * 3,
      sx: 1 + plant * 0.1,
      sy: 1 - plant * 0.08 + s * 0.02,
      rot: s * 0.04,
    };
  }
  function driftPose(t, seed) {
    return {
      bob: Math.sin(t * 2.1 + seed) * 6,
      sx: 1 + Math.sin(t * 2.8 + seed) * 0.05,
      sy: 1 + Math.sin(t * 1.7 + seed) * 0.04,
      rot: Math.sin(t * 1.3 + seed) * 0.14,
    };
  }
  function swayPose(t, seed) {
    const s = Math.sin(t * 2.6 + seed);
    return {
      bob: Math.sin(t * 1.8 + seed) * 4,
      sx: 1 + Math.abs(s) * 0.05,
      sy: 1,
      rot: s * 0.12,
    };
  }
  function enemyPose(e) {
    const moving = Math.hypot(e.vx, e.vy) > 10;
    const seed = e.x * 0.02 + e.y * 0.013;
    if (e.ai === "sine" || e.type === "bat") return flapPose(G.t, seed);
    if (e.type === "slime" || e.type === "mite") return blobPose(moving, G.t, seed);
    if (e.type === "golem" || e.type === "duke") return heavyPose(moving, G.t, seed);
    if (e.type === "shade" || e.type === "wight" || e.type === "eater") return driftPose(G.t, seed);
    if (e.type === "hydra") return swayPose(G.t, seed);
    return stepPose(moving, G.t, seed);
  }
  function knightPose(p) {
    const pose = stepPose(!!(p.moving || p.dash > 0), G.t, 0.4);
    if (p.dash > 0) {
      pose.sx *= 1.14;
      pose.sy *= 0.88;
      pose.bob -= 3;
    }
    if (p.swing > 0) pose.rot -= 0.28 * (p.swing / 0.14);
    if (!p.moving && p.dash <= 0) pose.rot += Math.sin(G.t * 1.6) * 0.015;
    return pose;
  }

  function drawSprite(name, x, y, size, flip, flash, pose, actor, dying = false) {
    const im = IM[name];
    pose = pose || {};
    const bob = pose.bob || 0;
    const sx = pose.sx || 1;
    const sy = pose.sy || 1;
    const rot = pose.rot || 0;
    const s = worldToScreen(x, y);
    if (s.x < -120 || s.y < -120 || s.x > W + 120 || s.y > H + 120) return;
    ctx.save();
    ctx.translate(x, y + 2);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(0, 2, size * 0.22 * sx, size * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (actor && ART && ART.drawActor(ctx, name, x, y, size, actor, artTime, dying)) return;
    ctx.save();
    ctx.translate(x, y);
    if (flip < 0) ctx.scale(-1, 1);
    ctx.rotate(rot);
    ctx.translate(0, bob);
    ctx.scale(sx, sy);
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

  function drawWall(w) {
    const horiz = w.w >= w.h;
    if (ART && ART.drawWall(ctx, w, player)) return;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(w.x + 4, w.y + 6, w.w, w.h);
    ctx.fillStyle = "#4a4338";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = "#7a7060";
    if (horiz) ctx.fillRect(w.x, w.y, w.w, 7);
    else ctx.fillRect(w.x, w.y, 7, w.h);
    ctx.fillStyle = "#8d8472";
    if (horiz) {
      for (let x = w.x + 6; x < w.x + w.w - 14; x += 26) ctx.fillRect(x, w.y - 10, 14, 11);
    } else {
      for (let y = w.y + 6; y < w.y + w.h - 14; y += 26) ctx.fillRect(w.x - 10, y, 11, 14);
    }
  }

  function drawPillar(o) {
    if (ART && ART.drawProp(ctx, o.r > 30 ? "pillar" : "pillar_broken", o.x, o.y, o.r * 4.6,
      player && player.y < o.y && Math.abs(player.y - o.y) < 85 && Math.abs(player.x - o.x) < o.r + 20 ? .58 : 1)) return;
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

  function drawPickup(u) {
    const bob = Math.sin(G.t * 5 + u.x) * 3;
    const size = u.kind === "xp" ? clamp(9 + Math.sqrt(u.val) * 1.3, 10, 24) : u.kind === "chest" ? 26 : u.kind === "meat" ? 19 : 15;
    if (ART && ART.drawIcon(ctx, u.kind, u.x, u.y + bob, size)) return;
    if (u.kind === "xp") {
      const s = clamp(3.5 + Math.sqrt(u.val) * 0.7, 4, 13);
      ctx.fillStyle = u.val > 20 ? "#d4e6ff" : "#8ec4ff";
      ctx.beginPath();
      ctx.moveTo(u.x, u.y - s + bob);
      ctx.lineTo(u.x + s * 0.72, u.y + bob);
      ctx.lineTo(u.x, u.y + s + bob);
      ctx.lineTo(u.x - s * 0.72, u.y + bob);
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

  function drawShrine(s) {
    const ready = s.t <= 0;
    const bob = ready ? Math.sin(G.t * 3 + s.x) * 3 : 0;
    const col = SHRINE_COL[s.kind] || "#d4b06a";
    const rendered = ART && ART.drawProp(ctx, ready ? "shrine_" + s.kind : "shrine_spent", s.x, s.y, 100);
    if (!rendered) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 4, 18, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ready ? "#3e3830" : "#2a2622";
    ctx.fillRect(s.x - 11, s.y - 14, 22, 16);
    ctx.fillStyle = ready ? "#6a604e" : "#3a342c";
    ctx.fillRect(s.x - 14, s.y - 18, 28, 6);
    }
    if (ready) {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(s.x, s.y - 30 + bob, 18, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(s.x, s.y - 30 + bob, 5.5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 26 + Math.sin(G.t * 2 + s.y) * 2, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#efe6d4";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.name, s.x, s.y - 53 + bob);
    } else {
      ctx.strokeStyle = "rgba(180, 160, 120, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const u = 1 - s.t / s.wait;
      ctx.arc(s.x, s.y - 16, 12, -Math.PI / 2, -Math.PI / 2 + TAU * u);
      ctx.stroke();
    }
  }

  function drawEnemy(e) {
    if (e.elite) {
      ctx.strokeStyle = "rgba(212,176,106,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, TAU); ctx.stroke();
    }
    if (e.state === "tel" || e.state === "lunge") {
      ctx.strokeStyle = e.state === "lunge" ? "rgba(255,80,40,0.85)" : "rgba(255,60,40,0.7)";
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (e.boss && e.phase > 1) {
      ctx.strokeStyle = "rgba(236,139,70,.55)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r + 8, (e.r + 8) * .4, 0, 0, TAU); ctx.stroke();
    }
    drawSprite(e.img, e.x, e.y, e.draw, e.facing, e.flash, enemyPose(e), e);
    if (e.boss || e.elite) {
      const bw = e.boss ? 64 : 36;
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(e.x - bw / 2, e.y - e.draw - 8, bw, 5);
      ctx.fillStyle = e.boss ? "#d4b06a" : "#e07040";
      ctx.fillRect(e.x - bw / 2, e.y - e.draw - 8, bw * clamp(e.hp / e.maxHp, 0, 1), 5);
    }
  }

  function drawKnight() {
    const p = player;
    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(255, 224, 138, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 28, 30 + Math.sin(G.t * 6) * 2, 0, TAU);
      ctx.stroke();
    }
    if (p.dash > 0 || p.inv > 0) ctx.globalAlpha = 0.45 + Math.sin(G.t * 40) * 0.1;
    drawSprite(CHARS[p.id].img, p.x, p.y, 72, p.facing, p.inv > 0 ? 0.08 : 0, knightPose(p), p, G.mode === "dead");
    ctx.globalAlpha = 1;
    for (const w of p.weapons) {
      if (w.id !== "oathblade" && w.id !== "crown") continue;
      const n = w.id === "crown" ? 8 + w.lv : 2 + w.lv;
      const rad = (w.id === "crown" ? 78 : 54) * p.area + w.lv * 4;
      for (let i = 0; i < n; i++) {
        const a = p.bladeA + (TAU * i) / n;
        const x = p.x + Math.cos(a) * rad;
        const y = p.y + Math.sin(a) * rad;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 2);
        if (ART && ART.drawIcon(ctx, w.id === "crown" ? "crown" : "oathblade", 0, 0, w.id === "crown" ? 40 : 32)) { ctx.restore(); continue; }
        ctx.fillStyle = w.id === "crown" ? "#ffe08a" : "#d0d6de";
        ctx.fillRect(-2.5, -14, 5, 28);
        ctx.fillStyle = "#d4b06a";
        ctx.fillRect(-3, 8, 6, 6);
        ctx.restore();
      }
    }
    if (hasW("bloodwell") || hasW("crimson")) {
      const id = hasW("crimson") ? "crimson" : "bloodwell";
      const rad = (id === "crimson" ? 130 : 78) * p.area + wlv(id) * 6;
      ctx.strokeStyle = id === "crimson" ? "rgba(180,40,50,0.38)" : "rgba(180,40,50,0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.stroke();
    }
  }

  function drawZones() {
    for (const z of zones) {
      if (z.kind === "fire") {
        ctx.fillStyle = "rgba(255, 120, 40, " + (0.2 * (1 - z.t / z.life)).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      } else if (z.kind === "blood") {
        ctx.fillStyle = "rgba(150, 24, 36, " + (0.16 + 0.05 * Math.sin(G.t * 6)).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(180, 40, 50, 0.45)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (z.kind === "cross") {
        const u = clamp(z.t / z.life, 0, 1);
        ctx.strokeStyle = "rgba(255, 224, 140, " + (0.45 + u * 0.5) + ")";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(z.x - 14, z.y); ctx.lineTo(z.x + 14, z.y);
        ctx.moveTo(z.x, z.y - 16); ctx.lineTo(z.x, z.y + 16);
        ctx.stroke();
      } else if (z.kind === "arc" && player) {
        const a = Math.atan2(player.dashDirY, player.dashDirX);
        ctx.strokeStyle = "rgba(230, 226, 210, 0.8)";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 50, a - 1.0, a + 1.0);
        ctx.stroke();
      }
    }
  }

  function drawGates() {
    for (const g of KEEP.gates) {
      const gx = g.x + g.nx * 8;
      const gy = g.y + g.ny * 8;
      const grd = ctx.createRadialGradient(gx, gy, 8, gx, gy, 110);
      grd.addColorStop(0, "rgba(212, 120, 60, 0.28)");
      grd.addColorStop(1, "rgba(212, 120, 60, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(gx, gy, 110, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(212, 176, 106, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const span = KEEP.gap * 0.42;
      if (g.nx === 0) {
        const yy = KEEP.inner.y + (g.ny > 0 ? 2 : KEEP.inner.h - 2);
        ctx.moveTo(g.x - span, yy);
        ctx.lineTo(g.x + span, yy);
      } else {
        const xx = KEEP.inner.x + (g.nx > 0 ? 2 : KEEP.inner.w - 2);
        ctx.moveTo(xx, g.y - span);
        ctx.lineTo(xx, g.y + span);
      }
      ctx.stroke();
      for (const s of [-1, 1]) {
        const tx = g.x + g.tx * s * (KEEP.gap * 0.5 + 10);
        const ty = g.y + g.ty * s * (KEEP.gap * 0.5 + 10);
        const f = 5 + Math.sin(G.t * 9 + tx) * 1.6;
        if (ART) ART.drawProp(ctx, "brazier", tx, ty, 62);
        ctx.fillStyle = "rgba(255, 150, 50, 0.28)";
        ctx.beginPath(); ctx.arc(tx, ty, f * 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = "#ffb15a";
        ctx.beginPath(); ctx.arc(tx, ty, f * 0.42, 0, TAU); ctx.fill();
      }
    }
  }

  const drawList = [];
  function render() {
    const day = clamp((G.t - 420) / 130, 0, 1);
    const victory = G.dawn || 0;
    ctx.fillStyle = "#0c0a10";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    const shx = (Math.random() - 0.5) * G.shake;
    const shy = (Math.random() - 0.5) * G.shake;
    ctx.translate(W / 2 + shx, H / 2 + shy);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);

    if (groundPat && !(ART && ART.available())) {
      ctx.fillStyle = groundPat;
      ctx.fillRect(0, 0, WORLD, WORLD);
    } else {
      ctx.fillStyle = "#1a1714";
      ctx.fillRect(0, 0, WORLD, WORLD);
    }
    if (ART) ART.drawGround(ctx, KEEP);

    ctx.fillStyle = "rgba(8, 6, 12, 0.55)";
    ctx.fillRect(0, 0, WORLD, KEEP.y);
    ctx.fillRect(0, KEEP.y + KEEP.h, WORLD, WORLD - (KEEP.y + KEEP.h));
    ctx.fillRect(0, KEEP.y, KEEP.x, KEEP.h);
    ctx.fillRect(KEEP.x + KEEP.w, KEEP.y, WORLD - (KEEP.x + KEEP.w), KEEP.h);

    const nightA = 0.42 * (1 - day) + 0.1 - victory * 0.08;
    ctx.fillStyle = "rgba(16, 12, 32, " + clamp(nightA, 0, 0.6) + ")";
    ctx.fillRect(KEEP.x, KEEP.y, KEEP.w, KEEP.h);
    if (day > 0 || victory > 0) {
      const warm = Math.max(day * 0.16, victory * 0.28);
      ctx.fillStyle = "rgba(255, 186, 120, " + warm + ")";
      ctx.fillRect(KEEP.x, KEEP.y, KEEP.w, KEEP.h);
    }

    drawGates();
    if (ART && ART.available()) {
      for (const g of KEEP.gates) {
        const bx = g.x + g.tx * (KEEP.gap / 2 + 55);
        const by = g.y + g.ty * (KEEP.gap / 2 + 55);
        ART.drawProp(ctx, "banner", bx, by, 76, .75);
      }
    }

    for (const tg of telegraphs) {
      if (tg.kind === "meteor" || tg.kind === "slam") {
        const u = clamp(tg.t / tg.life, 0, 1);
        ctx.strokeStyle = "rgba(220,60,40," + (0.35 + u * 0.55) + ")";
        ctx.fillStyle = "rgba(180,30,20," + (0.1 + u * 0.2) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, TAU); ctx.fill(); ctx.stroke();
      } else if (tg.kind === "line") {
        const u = clamp(tg.t / tg.life, 0, 1);
        ctx.strokeStyle = "rgba(255, 64, 40, " + (0.3 + u * 0.6) + ")";
        ctx.lineWidth = 7 + u * 8;
        ctx.beginPath();
        ctx.moveTo(tg.x, tg.y);
        ctx.lineTo(tg.x + tg.dx * tg.len, tg.y + tg.dy * tg.len);
        ctx.stroke();
      } else if (tg.kind === "ring") {
        ctx.strokeStyle = "rgba(120,200,90,0.75)";
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, TAU); ctx.stroke();
      }
    }

    drawZones();

    const viewLeft = cam.x - W / (2 * zoom) - 180;
    const viewRight = cam.x + W / (2 * zoom) + 180;
    const viewTop = cam.y - H / (2 * zoom) - 180;
    const viewBottom = cam.y + H / (2 * zoom) + 180;
    const visible = (o) => o.x >= viewLeft && o.x <= viewRight && o.y >= viewTop && o.y <= viewBottom;
    drawList.length = 0;
    for (const w of KEEP.walls) if (w.x <= viewRight && w.x + w.w >= viewLeft && w.y <= viewBottom && w.y + w.h >= viewTop) drawList.push({ y: w.y + w.h, kind: "wall", w });
    for (const o of obstacles) if (visible(o)) drawList.push({ y: o.y, kind: "pillar", o });
    for (const u of pickups) if (visible(u)) drawList.push({ y: u.y, kind: "pickup", u });
    for (const s of shrines) if (visible(s)) drawList.push({ y: s.y, kind: "shrine", s });
    for (const e of enemies) if (e.hp > 0 && visible(e)) drawList.push({ y: e.y, kind: "enemy", e });
    for (const e of corpses) if (visible(e)) drawList.push({ y: e.y, kind: "corpse", e });
    if (player && G.mode !== "menu") drawList.push({ y: player.y, kind: "player" });
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) {
      if (d.kind === "wall") drawWall(d.w);
      else if (d.kind === "pillar") drawPillar(d.o);
      else if (d.kind === "pickup") drawPickup(d.u);
      else if (d.kind === "shrine") drawShrine(d.s);
      else if (d.kind === "enemy") drawEnemy(d.e);
      else if (d.kind === "corpse") {
        ctx.save();
        ctx.globalAlpha = clamp(1 - (artTime - d.e.born) / .7, 0, 1);
        drawSprite(d.e.img, d.e.x, d.e.y, d.e.draw, d.e.facing, 0, {}, d.e, true);
        ctx.restore();
      }
      else if (d.kind === "player") drawKnight();
    }

    for (const pr of projs) {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.a || Math.atan2(pr.vy, pr.vx));
      const projectileIcon = pr.kind === "holy" ? "holy" : pr.kind === "frost" ? "frost" : pr.kind === "skull" ? "grave" : pr.kind === "bone" || pr.enemy ? "bone" : null;
      if (projectileIcon && ART && ART.drawIcon(ctx, projectileIcon, 0, 0, pr.kind === "skull" ? pr.r * 2.7 : 23, Math.PI / 2)) { ctx.restore(); continue; }
      if (pr.kind === "holy") {
        ctx.fillStyle = "#ffe08a";
        ctx.fillRect(-8, -3, 16, 6);
        ctx.fillRect(-3, -8, 6, 16);
      } else if (pr.kind === "frost") {
        ctx.fillStyle = "#9ad8ff";
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-8, -5); ctx.lineTo(-8, 5); ctx.fill();
      } else if (pr.kind === "fire") {
        ctx.fillStyle = "rgba(255," + (120 + Math.random() * 80) + ",40,0.85)";
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
      ctx.strokeStyle = "rgba(180,220,255," + (b.life * 8) + ")";
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
    if (ART) for (const fx of impacts) ART.drawEffect(ctx, fx.kind, fx.x, fx.y, fx.size, artTime - fx.born);

    for (const f of floats) {
      ctx.globalAlpha = clamp(f.life / 0.4, 0, 1);
      ctx.fillStyle = f.col;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0," + (0.55 - day * 0.25 - victory * 0.2) + ")");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    if (day > 0.02 || victory > 0) {
      const a = Math.min(1, day * 0.9 + victory);
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, "rgba(255, 206, 140, " + (0.2 * a) + ")");
      sky.addColorStop(1, "rgba(255, 180, 90, 0)");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.55);
    }
  }

  function hudText(id, value) {
    const el = $(id);
    const text = String(value);
    if (el.textContent !== text) el.textContent = text;
  }

  function paintHud() {
    if (!player || (G.mode !== "play" && G.mode !== "levelup" && G.mode !== "shop" && G.mode !== "pause")) return;
    hudText("hud-time", fmtTime(G.t));
    hudText("hud-kills", G.combo >= 10 ? G.kills + " ×" + G.combo : String(G.kills));
    hudText("hud-gold", G.gold);
    hudText("hud-lv", player.level);
    $("hp-fill").style.width = (100 * player.hp / player.maxHp) + "%";
    hudText("hp-lbl", Math.ceil(player.hp) + " / " + player.maxHp);
    $("xp-fill").style.width = (100 * player.xp / player.next) + "%";
    hudText("xp-lbl", player.xp + " / " + player.next);
    const maxCd = player.dashCdMax || 2.15;
    const dash = player.dashCd <= 0 ? 1 : 1 - player.dashCd / maxCd;
    $("dash-fill").style.width = (100 * clamp(dash, 0, 1)) + "%";
    const brow = $("buff-row");
    if (brow) {
      const bits = [];
      if (player.shield > 0) bits.push("Aegis ×" + player.shield);
      if (player.buffs) {
        if (player.buffs.wind > 0) bits.push("Wind " + Math.ceil(player.buffs.wind));
        if (player.buffs.might > 0) bits.push("Ember " + Math.ceil(player.buffs.might));
        if (player.buffs.wrath > 0) bits.push("Wrath " + Math.ceil(player.buffs.wrath));
        if (player.buffs.magnet > 0) bits.push("Lode " + Math.ceil(player.buffs.magnet));
      }
      const text = bits.join("   ");
      if (brow.textContent !== text) brow.textContent = text;
    }
    const wrap = $("boss-wrap");
    if (!wrap) return;
    let hp = 0, max = 0, name = "", n = 0, type = "";
    for (const e of enemies) {
      if (!e.boss || e.hp <= 0) continue;
      hp += e.hp; max += e.maxHp; n++; type = e.type;
    }
    if (!n || max <= 0) wrap.classList.remove("show");
    else {
      wrap.classList.add("show");
      name = n > 1 && type === "hydra" ? "Bone Hydra" : (BOSS_NAME[type] || "Boss");
      hudText("boss-name", name);
      $("boss-fill").style.width = (100 * clamp(hp / max, 0, 1)) + "%";
    }
  }

  function paintDock() {
    const dock = $("weapon-dock");
    if (!player) { dock.innerHTML = ""; return; }
    dock.innerHTML = player.weapons.map((w) => {
      const d = WEAPONS[w.id];
      const tip = d.name + " " + w.lv + evoLine(w.id);
      return `<div class="wep" title="${tip}"><span>${ART ? ART.iconHTML(w.id, d.icon) : d.icon}</span><b>${w.lv}</b></div>`;
    }).join("") + player.passives.map((p) => {
      const d = PASSIVES[p.id];
      const tip = d.name + " " + p.lv + virtueLine(p.id);
      return `<div class="wep" title="${tip}"><span>${ART ? ART.iconHTML(p.id, d.icon) : d.icon}</span><b>${p.lv}</b></div>`;
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
      artTime += dt;
      updatePlayer(dt);
      updateCamera(0.12);
      director(dt);
      updateEnemies(dt);
      rebuildHash();
      weaponTick(dt);
      updateProjs(dt);
      updateZones(dt);
      updateEnemyProjs();
      updatePickups(dt);
      updateFx(dt);
      paintHud();
    } else if (player) {
      if (G.mode === "dead" || G.mode === "win") artTime += dt0;
      updateCamera(0.08);
      if (G.mode === "win") G.dawn = Math.min(1, G.dawn + dt0 * 0.65);
    }
    for (let i = corpses.length - 1; i >= 0; i--) if (artTime - corpses[i].born > .7) corpses.splice(i, 1);
    for (let i = impacts.length - 1; i >= 0; i--) if (artTime - impacts[i].born > .36) impacts.splice(i, 1);
    if (ART && G.mode === "play") {
      if (G.t > 135) ART.requestActor("duke");
      if (G.t > 315) ART.requestActor("hydra");
      if (G.t > 465) ART.requestActor("dawneater");
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
    const el = $("title-meta");
    if (!el) return;
    el.textContent =
      "Gold " + save.gold + " · Best " + fmtTime(save.bestTime) + " · Wins " + save.wins
      + (save.brand ? " · Brand" : "");
    $("gold-chip").textContent = "";
  }

  function paintOath() {
    const b = $("btn-oath");
    if (!b) return;
    b.classList.toggle("sworn", !!save.swear);
    b.textContent = save.swear ? "Red Hour: Sworn" : "Red Hour: Off";
    const note = $("oath-note");
    if (!note) return;
    note.textContent = save.swear
      ? "Faster gates, elites from the first minute, no field rations. A kept hour pays more."
      : "Swear before the vigil. The first dawn you keep under it wakes the Keeper's Brand.";
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
        <img src="${ART ? ART.portrait(c.img) : "assets/sprites/" + c.img + ".png"}" alt="" />
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
      box.appendChild(row);
    }
    const brand = document.createElement("div");
    brand.className = "meta-row";
    brand.innerHTML = `<div><b style="color:var(--gold)">Keeper's Brand</b> · ${save.brand ? "Kept" : "Locked"}<br><span style="color:var(--ash);font-size:.82rem">${save.brand ? "Each vigil begins with a random virtue." : "Keep the Red Hour once. It wakes beside your oath."}</span></div><div>${save.brand ? "Yours" : "—"}</div>`;
    box.appendChild(brand);
  }

  function openAt(gateDir, dist) {
    const g = KEEP.gates[gateDir];
    const dx = g.x - WORLD / 2, dy = g.y - WORLD / 2;
    const L = Math.hypot(dx, dy) || 1;
    return {
      x: WORLD / 2 + (dx / L) * dist + g.tx * rand(-40, 40),
      y: WORLD / 2 + (dy / L) * dist + g.ty * rand(-40, 40),
    };
  }

  function startRun() {
    SFX.resume();
    resetWorld();
    pendingLevels = 0;
    G.oath = save.swear ? 1 : 0;
    makePlayer(save.selected || "aldric");
    if (ART) ART.requestActor(player.id);
    recacheStats();
    player.hp = player.maxHp;
    player.inv = 1.4;
    G.mode = "play";
    hideLayers();
    $("hud").classList.add("show");
    paintDock();
    const brand = player.brandId ? " · " + PASSIVES[player.brandId].name.toUpperCase() : "";
    banner((G.oath ? "THE RED HOUR" : "HOLD THE KEEP") + brand, 2.4);
    for (let gi = 0; gi < KEEP.gates.length; gi++) {
      const near = openAt(gi, 175);
      const mid = openAt(gi, 340);
      const mouth = gatePoint(gi, 60, rand(-70, 70));
      spawnEnemy("slime", near.x, near.y);
      spawnEnemy("slime", mid.x, mid.y);
      spawnEnemy("slime", mouth.x, mouth.y);
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
    const wrap = $("boss-wrap");
    if (wrap) wrap.classList.remove("show");
    let mult = 1;
    if (win && G.oath) {
      mult = 1.5;
      save.oathWins = (save.oathWins || 0) + 1;
      if (!save.brand) {
        save.brand = 1;
        G.brandNew = 1;
      }
    }
    const bonus = Math.round((G.gold + G.kills * 0.35 + G.t * 0.15 + (win ? 80 : 0)) * mult);
    save.gold += bonus;
    save.bestTime = Math.max(save.bestTime, G.t);
    save.bestKills = Math.max(save.bestKills, G.kills);
    if (win) save.wins++;
    persist();
    $("end-title").textContent = win ? "Dawn" : "Fallen";
    let sub = "The oath is broken. Rise and swear it again.";
    if (win && G.brandNew) sub = "The Red Hour is kept. The Keeper's Brand will walk with you.";
    else if (win && G.oath) sub = "The Red Hour breaks. The sun finds you standing.";
    else if (win) sub = "The keep holds. The sun finds you standing.";
    $("end-sub").textContent = sub;
    $("end-stats").innerHTML = `
      <div><span>Time</span><b>${fmtTime(G.t)}</b></div>
      <div><span>Slain</span><b>${G.kills}</b></div>
      <div><span>Level</span><b>${player ? player.level : 1}</b></div>
      <div><span>Vigil</span><b>${G.oath ? "Red Hour" : "Open"}</b></div>
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
    G.dawn = Math.max(G.dawn, 0.05);
    SFX.win();
    banner("DAWN", 3);
    setTimeout(() => endRun(true), 1700);
  }

  $("btn-play").onclick = startRun;
  $("btn-chars").onclick = () => { renderChars(); showLayer("chars"); };
  $("btn-meta").onclick = () => { renderMeta(); showLayer("meta"); };
  $("btn-help").onclick = () => showLayer("help");
  $("btn-oath").onclick = () => {
    save.swear = save.swear ? 0 : 1;
    persist();
    paintOath();
  };
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
    paintOath();
  };

  function runSelfTest() {
    const fails = [];
    const assert = (c, m) => { if (!c) fails.push(m); };
    for (const g of KEEP.gates) {
      assert(!pointInWalls(g.x, g.y), "gate in wall " + g.name);
      assert(!pointInWalls(g.x + g.nx * 24, g.y + g.ny * 24), "mouth in wall " + g.name);
    }
    const w0 = KEEP.walls[0];
    assert(pointInWalls(w0.x + w0.w * 0.5, w0.y + w0.h * 0.5), "wall not solid");
    const inner = KEEP.inner;
    for (const s of [...SHRINE_DEFS, ...OUTER_SHRINES]) {
      assert(s.x > inner.x + 16 && s.x < inner.x + inner.w - 16, "shrine x " + s.name);
      assert(s.y > inner.y + 16 && s.y < inner.y + inner.h - 16, "shrine y " + s.name);
      assert(!pointInWalls(s.x, s.y), "shrine in wall " + s.name);
    }
    const flapA = flapPose(0, 1);
    const flapB = flapPose(0.12, 1);
    assert(Math.abs(flapA.sx - flapB.sx) > 0.02, "bat wings do not move");
    const stepA = stepPose(true, 0, 0);
    const stepB = stepPose(true, 0.18, 0);
    assert(stepA.bob !== stepB.bob || stepA.rot !== stepB.rot, "knight step is static");

    resetWorld();
    const brandWas = save.brand;
    save.brand = 0;
    makePlayer("aldric");
    save.brand = brandWas;
    player.passives.length = 0;
    player.brandId = null;
    recacheStats();
    G.mode = "play";
    G.oath = 0;
    const base = player.atkMul;
    player.mods.atk *= 1.12;
    recacheStats();
    const mid = player.atkMul;
    assert(mid > base * 1.1, "whetstone not applied");
    recacheStats();
    assert(Math.abs(player.atkMul - mid) < 0.0001, "whetstone wiped");
    const hp0 = player.maxHp;
    player.mods.hp += 18;
    recacheStats();
    assert(player.maxHp === hp0 + 18, "tonic wiped " + player.maxHp + " vs " + (hp0 + 18));

    const view = cardView({ type: "wup", id: "oathblade" });
    assert(view.body.indexOf("Rage") >= 0, "weapon recipe hidden");
    const rage = cardView({ type: "pnew", id: "rage" });
    assert(rage.body.indexOf("Oathblade") >= 0, "virtue recipe hidden");
    assert(rage.body.toLowerCase().indexOf("spin") >= 0, "virtue note missing");
    player.weapons = [{ id: "crown", lv: 6 }];
    player.passives = [];
    assert(poolCards().some((c) => c.type === "wup" && c.id === "crown"), "evolution cannot level");
    G.oath = 1;
    assert(!poolCards().some((c) => c.type === "heal"), "oath still offers rations");
    G.oath = 0;

    enemies.length = 0;
    const slime = spawnEnemy("slime");
    assert(!!slime, "slime failed to spawn");
    if (slime) {
      const near = KEEP.gates.some((g) => Math.hypot(slime.x - g.x, slime.y - g.y) < 180);
      assert(near, "slime not at a gate");
    }

    enemies.length = 0;
    const h = spawnEnemy("hydra", player.x + 280, player.y);
    h.state = "lunge";
    h.st = 0.05;
    h.vx = 460;
    h.vy = 0;
    h.cd = 5;
    h.atkT = 0;
    h.split = 1;
    updateEnemies(0.05);
    assert(h.state === "lunge", "lunge state dropped");
    assert(h.vx > 300, "lunge overwritten " + Math.round(h.vx));

    keys.Space = true;
    player.dash = 0;
    player.dashCd = 0;
    player.dashHeld = false;
    player.lastX = 0;
    player.lastY = -1;
    player.vx = 0;
    player.vy = 0;
    updatePlayer(0.016);
    assert(player.dash > 0, "dash did not start");
    assert(player.vy < -150, "dash did not commit " + Math.round(player.vy));
    assert(zones.some((z) => z.kind === "arc"), "aldric dash left no arc");
    keys.Space = false;
    player.dashHeld = false;

    const wind = shrines.find((s) => s.kind === "wind");
    player.x = wind.x;
    player.y = wind.y;
    player.buffs.wind = 0;
    updateShrines(0.05);
    assert(player.buffs.wind > 10, "wind shrine gave no speed");
    assert(wind.t > 20, "wind shrine stayed lit");
    const held = player.buffs.wind;
    updateShrines(0.05);
    assert(player.buffs.wind === held, "shrine fired twice");
    player.x = WORLD / 2;
    player.y = WORLD / 2;

    enemies.length = 0;
    zones.length = 0;
    telegraphs.length = 0;
    G.t = 0;
    G.spawnAcc = 0;
    G.oath = 0;
    G.spawnedBoss = { duke: 0, hydra: 0, eater: 0 };
    for (let n = 0; n < 60; n++) {
      G.t += 0.25;
      director(0.25);
    }
    assert(enemies.length > 8, "director quiet " + enemies.length);

    player.inv = 99;
    player.hp = player.maxHp;
    enemies.length = 0;
    telegraphs.length = 0;
    G.t = 180;
    G.spawnedBoss = { duke: 0, hydra: 0, eater: 0 };
    director(0.05);
    const duke = enemies.find((e) => e.type === "duke");
    assert(!!duke, "duke did not enter");
    let told = false;
    for (let n = 0; n < 160 && duke && duke.hp > 0; n++) {
      updateEnemies(0.05);
      if (duke.state !== "idle" || telegraphs.some((tg) => tg.kind === "line" || tg.kind === "slam")) told = true;
    }
    assert(told, "duke never swung");

    enemies.length = 0;
    telegraphs.length = 0;
    const eater = spawnEnemy("eater", player.x, player.y - 180);
    eater.cd = 0.01;
    updateEnemies(0.05);
    const meteor = telegraphs.find((tg) => tg.kind === "meteor");
    assert(!!meteor, "dawn eater dropped no meteor");
    if (meteor) {
      const away = Math.hypot(meteor.x - player.x, meteor.y - player.y);
      assert(away < meteor.r + 8, "meteor was not aimed " + Math.round(away));
    }

    const msg = fails.length ? "FAIL " + fails.join(" | ") : "PASS";
    document.title = msg;
    const meta = $("title-meta");
    if (meta) meta.textContent = msg;
    G.mode = "menu";
    console.log(msg);
    return msg;
  }

  // ─────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────
  loadImages().then(() => {
    resize();
    if (IM.ground) groundPat = ctx.createPattern(IM.ground, "repeat");
    refreshTitleMeta();
    paintOath();
    const boot = new URLSearchParams(location.search).get("boot");
    if (boot === "test") {
      runSelfTest();
      return;
    }
    requestAnimationFrame(frame);
    if (boot === "play") startRun();
    if (boot === "chars") { renderChars(); showLayer("chars"); }
  });
})();
