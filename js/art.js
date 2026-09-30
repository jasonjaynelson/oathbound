/* Blender-rendered art for the Canvas game. Gameplay remains in game.js. */
(() => {
  "use strict";
  const legacy = new URLSearchParams(location.search).get("art") === "legacy";
  let manifest = null;
  let propImage = null;
  const actors = new Map();
  const loading = new Map();
  const icons = new Map();
  const floors = [];
  const effects = new Map();
  let ground = null;
  const wallCache = new WeakMap();

  function image(src) {
    return new Promise(resolve => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  function requestActor(name) {
    if (legacy || !manifest || !manifest.actors[name]) return Promise.resolve(null);
    if (!loading.has(name)) {
      loading.set(name, image(manifest.actors[name].src).then(im => {
        if (im) actors.set(name, im);
        return im;
      }));
    }
    return loading.get(name);
  }

  async function init(selected = "aldric") {
    if (legacy) return;
    try {
      const response = await fetch("assets/asset-manifest.json");
      if (!response.ok) return;
      manifest = await response.json();
      await Promise.all([
        image(manifest.propsSrc).then(im => { propImage = im; }),
        ...manifest.floor.map(src => image(src).then(im => { if (im) floors.push(im); })),
        ...Object.entries(manifest.icons).map(([name, src]) => image(src).then(im => { if (im) icons.set(name, im); })),
        ...Object.entries(manifest.effects || {}).map(([name, spec]) => image(spec.src).then(im => { if (im) effects.set(name, im); })),
        ...[selected, "slime", "skeleton", "bat"].map(requestActor),
      ]);
    } catch (error) {
      console.warn("Oathbound art unavailable; using original sprites.", error);
    }
  }

  function direction(actor, spec) {
    if (spec.directions.length === 2) return actor.facing < 0 ? "west" : "east";
    const x = actor.lastX || actor.vx || 0;
    const y = actor.lastY || actor.vy || 0;
    if (Math.abs(x) > Math.abs(y)) return x < 0 ? "west" : "east";
    return y < 0 ? "north" : "south";
  }

  function clipFor(actor, dying) {
    if (dying) return "death";
    if (actor.dash > 0) return "dash";
    if (actor.state === "tel") return "tel";
    if (actor.state === "slam") return "slam";
    if (actor.state === "go" || actor.state === "lunge") return "go";
    if (actor.castUntil > actor.artTime) return "cast";
    if (actor.hurtUntil > actor.artTime) return "hurt";
    return actor.moving || Math.hypot(actor.vx || 0, actor.vy || 0) > 10 ? "run" : "idle";
  }

  function drawActor(ctx, name, x, y, height, actor, time, dying = false) {
    const im = actors.get(name);
    const spec = manifest && manifest.actors[name];
    if (!im || !spec) return false;
    actor.artTime = time;
    let clipName = clipFor(actor, dying);
    if (!spec.clips[clipName]) clipName = "run";
    let state = actor.artState;
    if (!state || state.clip !== clipName) {
      const seed = ((actor.x * 13 + actor.y * 7) % 101) / 101;
      state = actor.artState = { clip: clipName, start: time, offset: seed };
    }
    const clip = spec.clips[clipName];
    const dir = direction(actor, spec);
    const frames = clip.directions[dir] || Object.values(clip.directions)[0];
    let u = (time - state.start) / clip.duration;
    if (actor.dash > 0 && clipName === "dash") u = 1 - actor.dash / .16;
    else if (["tel", "slam", "go", "lunge"].includes(actor.state) && !dying && clipName !== "hurt") {
      u = actor.st / (actor.state === "lunge" ? .42 : clip.duration);
    }
    if (clip.loop) u = (u + state.offset) % 1;
    const frame = frames[Math.min(frames.length - 1, Math.max(0, Math.floor(u * frames.length)))];
    const scale = height / spec.bodyPixels;
    const dx = x - spec.anchor[0] * scale;
    const dy = y - spec.anchor[1] * scale;
    ctx.drawImage(im, ...frame, dx, dy, frame[2] * scale, frame[3] * scale);
    if (actor.flash > 0 || actor.inv > 0 && !dying) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= .30;
      ctx.drawImage(im, ...frame, dx, dy, frame[2] * scale, frame[3] * scale);
      ctx.restore();
    }
    return true;
  }

  function drawProp(ctx, name, x, y, width, alpha = 1) {
    const spec = manifest && manifest.props[name];
    if (!propImage || !spec) return false;
    const [sx, sy, sw, sh] = spec.rect;
    const scale = width / sw;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(propImage, sx, sy, sw, sh, x - spec.anchor[0] * scale, y - spec.anchor[1] * scale, width, sh * scale);
    ctx.restore();
    return true;
  }

  function drawWall(ctx, wall, player) {
    if (!propImage) return false;
    let cached = wallCache.get(wall);
    if (!cached) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(wall.w + 200); canvas.height = Math.ceil(wall.h + 180);
      const paint = canvas.getContext("2d");
      const x0 = wall.x - 100, y0 = wall.y - 130;
      paint.translate(-x0, -y0);
      paint.fillStyle = "#302d2a"; paint.fillRect(wall.x, wall.y, wall.w, wall.h);
      const horiz = wall.w >= wall.h;
      const span = horiz ? wall.w : wall.h;
      const count = Math.ceil(span / 58);
      const step = span / count;
      for (let i = 0; i < count; i++) {
        drawProp(paint, horiz ? "wall_horizontal" : "wall_vertical",
          horiz ? wall.x + (i + .5) * step : wall.x + wall.w / 2,
          horiz ? wall.y + wall.h * .72 : wall.y + (i + .5) * step,
          horiz ? step * 1.62 : step * 2.8);
      }
      cached = { canvas, x: x0, y: y0 };
      wallCache.set(wall, cached);
    }
    ctx.save();
    if (player && player.x > wall.x - 30 && player.x < wall.x + wall.w + 30 &&
      player.y < wall.y + wall.h && player.y > wall.y - 50) ctx.globalAlpha *= .65;
    ctx.drawImage(cached.canvas, cached.x, cached.y);
    ctx.restore();
    return true;
  }

  function makeGround(width, height) {
    if (!floors.length) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    const tile = 256;
    for (let y = 0; y < height; y += tile) {
      for (let x = 0; x < width; x += tile) {
        const index = ((x / tile) * 7 + (y / tile) * 11) % floors.length;
        ctx.drawImage(floors[index], x, y, tile, tile);
      }
    }
    const wash = ctx.createRadialGradient(width / 2, height / 2, 90, width / 2, height / 2, width * .7);
    wash.addColorStop(0, "rgba(25,22,30,.44)");
    wash.addColorStop(1, "rgba(10,9,15,.72)");
    ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);
    // Quiet floor markings show the oath without competing with attack warnings.
    ctx.strokeStyle = "rgba(191,154,94,.22)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(width / 2, height / 2, 102, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(width / 2, height / 2, 93, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const x = width / 2 + Math.cos(a) * 98;
      const y = height / 2 + Math.sin(a) * 98;
      ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.stroke();
    }
    ground = canvas;
    return canvas;
  }

  function drawGround(ctx, keep) {
    if (!ground) makeGround(keep.w, keep.h);
    if (!ground) return false;
    ctx.drawImage(ground, keep.x, keep.y);
    return true;
  }

  function drawIcon(ctx, name, x, y, size, rotation = 0) {
    const im = icons.get(name);
    if (!im) return false;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    ctx.drawImage(im, -size / 2, -size / 2, size, size); ctx.restore();
    return true;
  }

  function iconHTML(name, fallback = "") {
    const src = manifest && manifest.icons[name];
    return src && icons.has(name) && !legacy ? `<img class="relic-icon" src="${src}" alt="" />` : fallback;
  }

  function drawEffect(ctx, name, x, y, size, age) {
    const im = effects.get(name);
    const spec = manifest && manifest.effects && manifest.effects[name];
    if (!im || !spec || age < 0 || age >= spec.duration) return false;
    const frame = spec.frames[Math.min(spec.frames.length - 1, Math.floor(age / spec.duration * spec.frames.length))];
    ctx.save(); ctx.globalAlpha *= 1 - age / spec.duration;
    ctx.drawImage(im, ...frame, x - size / 2, y - size / 2, size, size);
    ctx.restore(); return true;
  }

  function portrait(name) {
    return manifest && manifest.actors[name] && !legacy ? manifest.actors[name].portrait : `assets/sprites/${name}.png`;
  }

  function stats() {
    let decodedBytes = propImage ? propImage.width * propImage.height * 4 : 0;
    for (const im of [...actors.values(), ...icons.values(), ...floors, ...effects.values()]) decodedBytes += im.width * im.height * 4;
    return { ready: !!manifest && !legacy, actors: [...actors.keys()], decodedBytes };
  }

  window.OathArt = { init, requestActor, drawActor, drawProp, drawWall, drawGround, drawIcon, drawEffect, iconHTML, portrait, stats,
    available: () => !!propImage && !legacy };
})();
