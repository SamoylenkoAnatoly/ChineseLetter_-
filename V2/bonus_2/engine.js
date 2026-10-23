(function () {
  "use strict";

  var PALETTES = [
    {
      name: "shallows",
      top: "#2f9d8f", bottom: "#0c3b46", glow: "#bdf2df",
      ray: 0.16, current: 0, fog: false, gold: false, silt: 0,
      fish: ["#7fae6a", "#e0915c", "#6fb5c9", "#d8b95e", "#c97f8e", "#8f9fce", "#a8c986"]
    },
    {
      name: "current",
      top: "#1f6f96", bottom: "#092a44", glow: "#aee4f4",
      ray: 0.1, current: 1, fog: false, gold: false, silt: 0,
      fish: ["#5b9fb0", "#c76d84", "#8f9fce", "#d8b95e", "#7fae6a", "#c97f8e", "#6fb5c9"]
    },
    {
      name: "abyss",
      top: "#1c3a5c", bottom: "#050c1a", glow: "#93b8d8",
      ray: 0.04, current: 0.5, fog: true, gold: false, silt: 1,
      fish: ["#5f7d9e", "#8a7fa8", "#4c8a8a", "#7d8a6b", "#9e7f7f", "#6f8ab0", "#8fa87f"]
    },
    {
      name: "golden",
      top: "#96622a", bottom: "#331b07", glow: "#ffd98a",
      ray: 0.2, current: 0, fog: false, gold: true, silt: 0,
      fish: ["#f2b234", "#e0915c", "#d8b95e", "#c9a04c", "#f6c95c", "#e8a86a", "#f2913d"]
    }
  ];

  PALETTES.push({ name: "legend", top: "#514479", bottom: "#10182e", glow: "#dbcafa", ray: 0.16, current: 0, fog: false, gold: true, silt: 0, fish: ["#B7A6DB"] });

  var AMBIENT_COUNT = 3;
  var BUBBLE_COUNT = 26;

  function rand(rng, min, max) { return min + rng() * (max - min); }

  function isCJK(label) { return /[\u4e00-\u9fff]/.test(label); }

  function fontFor(label) {
    return isCJK(label) ? '26px "Noto Sans SC", "Microsoft YaHei", sans-serif'
      : '700 15.5px Nunito, "Segoe UI", sans-serif';
  }

  function makeLayout(rng, ctx, labels, correctLabel, zone, bounds, palIndex) {
    var fish = [];
    var taken = [];
    labels.forEach(function (label, index) {
      var font = fontFor(label);
      ctx.font = font;
      var lines = [];
      var line = "";
      label.split(" ").forEach(function (word) {
        var next = line ? line + " " + word : word;
        if (line && ctx.measureText(next).width > 175) { lines.push(line); line = word; }
        else line = next;
      });
      if (line) lines.push(line);
      var textW = Math.max.apply(null, lines.map(function (text) { return ctx.measureText(text).width; }));
      var w = Math.max(148, textW + 100);
      var h = Math.max(76, lines.length * 21 + 44);
      var x, y, tries = 0;
      do {
        x = rand(rng, w / 2 + 14, bounds.w - w / 2 - 14);
        y = rand(rng, bounds.h * 0.3, bounds.h * 0.86);
        tries += 1;
      } while (tries < 40 && taken.some(function (t) { return Math.abs(t.x - x) < (t.w + w) / 2 + 10 && Math.abs(t.y - y) < (t.h + h) / 2 + 14; }));
      taken.push({ x: x, y: y, w: w, h: h });
      fish.push({
        id: index, x: x, y: y, w: w, h: h,
        dir: rng() < 0.5 ? -1 : 1,
        speed: rand(rng, zone.speedMin, zone.speedMax),
        label: label, lines: lines, shape: index % 3, correct: label === correctLabel,
        color: PALETTES[palIndex].fish[index % 7],
        phase: rng() * Math.PI * 2,
        state: "swim", fleeT: 0, fleeVx: 0, fleeVy: 0,
        dodgeCd: rand(rng, 1.5, 4), dodgeT: 0, dodgeVx: 0, dodgeVy: 0,
        flash: 0, flashKind: "", font: font
      });
    });
    return fish;
  }

  function makeAmbient(rng, bounds) {
    var list = [];
    for (var i = 0; i < AMBIENT_COUNT; i++) {
      list.push({
        x: rand(rng, 20, bounds.w - 20), y: rand(rng, bounds.h * 0.35, bounds.h * 0.9),
        dir: rng() < 0.5 ? -1 : 1, speed: rand(rng, 18, 34),
        size: rand(rng, 7, 13), phase: rng() * 6.28
      });
    }
    return list;
  }

  function makeBubbles(rng, bounds) {
    var list = [];
    for (var i = 0; i < BUBBLE_COUNT; i++) {
      list.push({
        x: rand(rng, 0, bounds.w), y: rand(rng, 0, bounds.h),
        r: rand(rng, 1.5, 4.5), speed: rand(rng, 12, 30), phase: rng() * 6.28
      });
    }
    return list;
  }

  function stepFish(f, dt, zone, bounds, t) {
    if (f.state === "hooked" || f.state === "gone") return;
    var vx, vy;
    var drift = zone.drift * 26;
    if (f.fleeT > 0) {
      f.fleeT -= dt;
      vx = f.fleeVx; vy = f.fleeVy;
      if (f.fleeT <= 0) f.state = "swim";
    } else if (f.dodgeT > 0) {
      f.dodgeT -= dt;
      vx = f.dodgeVx; vy = f.dodgeVy;
    } else {
      f.dodgeCd -= dt;
      vx = f.dir * f.speed + drift;
      vy = Math.sin(t * 1.6 + f.phase) * 12;
      if (zone.dodge && f.dodgeCd <= 0) {
        f.dodgeCd = rand(Math.random, 1.6, 3.6);
        f.dodgeT = 0.38;
        f.dodgeVx = f.dir * f.speed * 2.6;
        f.dodgeVy = rand(Math.random, -160, 160);
      }
    }
    f.x += vx * dt;
    f.y += vy * dt;
    var half = f.w / 2 + 4;
    if (f.x < half) { f.x = half; f.dir = 1; if (f.fleeT > 0) f.fleeVx = Math.abs(f.fleeVx); }
    if (f.x > bounds.w - half) { f.x = bounds.w - half; f.dir = -1; if (f.fleeT > 0) f.fleeVx = -Math.abs(f.fleeVx); }
    var minY = bounds.h * 0.24, maxY = bounds.h * 0.92 - f.h / 2;
    if (f.y < minY) { f.y = minY; if (f.fleeT > 0) f.fleeVy = Math.abs(f.fleeVy); if (f.dodgeT > 0) f.dodgeVy = Math.abs(f.dodgeVy); }
    if (f.y > maxY) { f.y = maxY; if (f.fleeT > 0) f.fleeVy = -Math.abs(f.fleeVy); if (f.dodgeT > 0) f.dodgeVy = -Math.abs(f.dodgeVy); }
    if (f.flash > 0) f.flash -= dt;
  }

  function stepAmbient(a, dt, bounds, t) {
    a.x += a.dir * a.speed * dt;
    if (a.x < 12) { a.x = 12; a.dir = 1; }
    if (a.x > bounds.w - 12) { a.x = bounds.w - 12; a.dir = -1; }
    a.y += Math.sin(t * 1.2 + a.phase) * 6 * dt;
  }

  function fleeAll(fish, fromX, fromY) {
    fish.forEach(function (f) {
      if (f.state !== "swim") return;
      var dx = f.x - fromX, dy = f.y - fromY;
      var d = Math.max(1, Math.hypot(dx, dy));
      f.state = "flee";
      f.fleeT = 1.15;
      f.fleeVx = (dx / d) * 260 + f.dir * 60;
      f.fleeVy = (dy / d) * 190;
      f.dir = f.fleeVx >= 0 ? 1 : -1;
    });
  }

  function nearest(fish, x, y, radius) {
    var best = null, bestD = radius;
    fish.forEach(function (f) {
      if (f.state !== "swim" && f.state !== "flee") return;
      var dx = Math.abs(f.x - x), dy = Math.abs(f.y - y);
      var inside = Math.pow(dx / (f.w / 2), 2) + Math.pow(dy / (f.h / 2), 2) <= 1;
      var d = inside ? 0 : Math.hypot(Math.max(0, dx - f.w / 2), Math.max(0, dy - f.h / 2));
      if (d < bestD) { bestD = d; best = f; }
    });
    return best;
  }

  function makeHook(boatX, boatY) {
    return { state: "idle", x: boatX, y: boatY, homeX: boatX, homeY: boatY, tx: 0, ty: 0, fish: null, event: "", splashX: 0, splashY: 0 };
  }

  function stepHook(hook, fish, dt, bounds) {
    if (hook.state === "idle") return null;
    var events = null;
    if (hook.state === "drop") {
      var dx = hook.tx - hook.x, dy = hook.ty - hook.y;
      var d = Math.hypot(dx, dy);
      var step = 1000 * dt;
      if (d <= step) {
        hook.x = hook.tx; hook.y = hook.ty;
        var target = nearest(fish, hook.x, hook.y, 58);
        if (target) {
          target.state = "hooked";
          hook.fish = target;
          hook.state = "reel";
          events = { caught: target };
        } else {
          hook.state = "miss";
          hook.event = "splash";
          hook.splashX = hook.x; hook.splashY = hook.y;
          events = { splash: true };
        }
      } else {
        hook.x += (dx / d) * step;
        hook.y += (dy / d) * step;
      }
    } else if (hook.state === "reel") {
      var f = hook.fish;
      var dx2 = hook.homeX - f.x, dy2 = hook.homeY - f.y;
      var d2 = Math.hypot(dx2, dy2);
      var step2 = 780 * dt;
      if (d2 <= step2) {
        f.x = hook.homeX; f.y = hook.homeY;
        f.state = "gone";
        hook.state = "idle";
        hook.event = "landed";
        hook.x = hook.homeX; hook.y = hook.homeY;
        events = { landed: f };
      } else {
        f.x += (dx2 / d2) * step2;
        f.y += (dy2 / d2) * step2;
        hook.x = f.x; hook.y = f.y - f.h / 2 - 4;
      }
    } else if (hook.state === "miss") {
      hook.y += 120 * dt;
      if (hook.y > hook.ty + 26) { hook.state = "idle"; hook.x = hook.homeX; hook.y = hook.homeY; }
    }
    return events;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amount));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    var b = Math.max(0, Math.min(255, (n & 255) + amount));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function drawBackground(ctx, bounds, pal, t, bubbles, ambient) {
    var grad = ctx.createLinearGradient(0, 0, 0, bounds.h);
    grad.addColorStop(0, pal.top);
    grad.addColorStop(1, pal.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, bounds.w, bounds.h);

    if (pal.ray > 0) {
      ctx.save();
      ctx.globalAlpha = pal.ray * 0.45;
      ctx.fillStyle = pal.glow;
      for (var i = 0; i < 3; i++) {
        var cx = bounds.w * (0.24 + i * 0.26) + Math.sin(t * 0.22 + i) * 26;
        ctx.beginPath();
        ctx.moveTo(cx - 8, 0);
        ctx.lineTo(cx + 12, 0);
        ctx.lineTo(cx + 52, bounds.h);
        ctx.lineTo(cx - 32, bounds.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (pal.current > 0) {
      ctx.save();
      ctx.strokeStyle = pal.glow;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 2;
      for (var s = 0; s < 6; s++) {
        var y = bounds.h * (0.3 + s * 0.12);
        var off = (t * (90 + s * 26) * pal.current) % (bounds.w + 240) - 120;
        ctx.beginPath();
        ctx.moveTo(off - 120, y);
        ctx.quadraticCurveTo(off, y - 7, off + 120, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (pal.gold) {
      ctx.save();
      ctx.fillStyle = "#ffe9a8";
      for (var g = 0; g < 14; g++) {
        var gx = (g * 137 + t * 20) % bounds.w;
        var gy = bounds.h - ((t * (14 + g * 3) + g * 90) % bounds.h);
        ctx.globalAlpha = 0.12 + 0.14 * Math.abs(Math.sin(t + g));
        ctx.beginPath();
        ctx.arc(gx, gy, 1.6 + (g % 3), 0, 6.29);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    bubbles.forEach(function (b) {
      ctx.beginPath();
      ctx.arc(b.x + Math.sin(t * 1.4 + b.phase) * 4, b.y, b.r, 0, 6.29);
      ctx.stroke();
    });
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ambient.forEach(function (a) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.translate(Math.round(a.x), Math.round(a.y));
      ctx.scale(a.dir, 1);
      pixelFish(ctx, a.size * 3.2, a.size * 1.6, "#7fd8c4", 0, Math.floor(t * 3));
      ctx.restore();
    });
    ctx.restore();
  }

  function drawFog(ctx, bounds, pal, t) {
    if (!pal.fog) return;
    ctx.save();
    for (var i = 0; i < 3; i++) {
      var x = ((t * (12 + i * 7) + i * 380) % (bounds.w + 640)) - 320;
      var y = bounds.h * (0.35 + i * 0.22);
      var r = 230 + i * 40;
      var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(150,180,205,0.34)");
      grad.addColorStop(1, "rgba(150,180,205,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.29);
      ctx.fill();
    }
    ctx.restore();
  }

  function fogCover(fish, bounds, t) {
    if (!fish) return 0;
    for (var i = 0; i < 3; i++) {
      var x = ((t * (12 + i * 7) + i * 380) % (bounds.w + 640)) - 320;
      var y = bounds.h * (0.35 + i * 0.22);
      var r = 230 + i * 40;
      if (Math.hypot(fish.x - x, fish.y - y) < r * 0.75) return 1;
    }
    return 0;
  }

  function pixelFish(ctx, w, h, color, shape, frame) {
    var unit = Math.max(2, Math.round(h / 18));
    var left = -Math.round(w / 2 / unit) * unit;
    var top = -Math.round(h / 2 / unit) * unit;
    var cols = Math.round(w / unit), rows = Math.round(h / unit);
    function block(x, y, width, height, fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(left + Math.round(x) * unit, top + Math.round(y) * unit, Math.round(width) * unit, Math.round(height) * unit);
    }
    var ink = "#3E4353";
    var tail = frame % 2 ? 1 : -1;
    block(-5, 2 + tail, 2, rows - 4, ink);
    block(-3, 4 + tail, 2, rows - 8, ink);
    block(-1, 6, 3, rows - 12, ink);
    block(-4, 3 + tail, 1, rows - 6, color);
    block(-2, 5 + tail, 2, rows - 10, color);
    block(cols * 0.35, -3, 5, 4, ink);
    block(cols * 0.35 + 1, -2, 3, 3, shade(color, -22));
    for (var row = 0; row < rows; row++) {
      var edge = row < 2 || row >= rows - 2 ? (shape === 2 ? 5 : 4) : row < 4 || row >= rows - 4 ? 2 : 0;
      block(edge, row, cols - edge * 2, 1, ink);
      if (row > 0 && row < rows - 1) block(edge + 1, row, cols - edge * 2 - 2, 1, row >= rows - 5 ? "#F4F5FA" : color);
    }
    block(6, 2, Math.max(3, cols - 15), 1, "#F4F5FA");
    block(cols - 6, 4, 3, 3, ink);
    block(cols - 5, 4, 1, 1, "#FFFFFF");
    block(cols - 3, rows / 2, 2, 1, ink);
    block(cols - 8, rows / 2, 2, 1, "#EAA7A1");
    block(cols * 0.6, rows - 3 + frame % 2, 4, 3, ink);
    block(cols * 0.6 + 1, rows - 3 + frame % 2, 2, 2, shade(color, -22));
    if (shape === 2) {
      block(cols - 2, rows / 2 + 2, 4, 1, ink);
      block(cols + 1, rows / 2 + 3, 1, 2, ink);
    }
  }

  function drawFish(ctx, f, t, cover) {
    if (f.state === "gone") return;
    ctx.save();
    ctx.globalAlpha = Math.max(0.2, f.state === "hooked" ? 1 : 1 - cover * 0.62);
    ctx.translate(Math.round(f.x), Math.round(f.y));
    var body = f.color;
    if (f.flash > 0) body = f.flashKind === "wrong" ? "#ff8d70" : "#9fe6a0";
    ctx.save();
    ctx.scale(f.dir, 1);
    pixelFish(ctx, f.w, f.h, body, f.shape || 0, Math.floor(t * 4 + (f.phase || 0)));
    ctx.restore();
    var lines = f.lines || [f.label];
    if (f.label) {
      ctx.fillStyle = "#F4F5FA";
      ctx.fillRect(-f.w / 2 + 24, -lines.length * 11 - 5, f.w - 76, lines.length * 22 + 10);
      ctx.font = f.font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#3E4353";
      lines.forEach(function (line, i) { ctx.fillText(line, -14, (i - (lines.length - 1) / 2) * 22); });
    }
    ctx.restore();
  }

  function drawBoss(ctx, bounds, boat, boss, t, victory, learning, mobile) {
    var progress = boss.progress / 100;
    var x = bounds.w * (learning ? mobile ? 0.50 : 0.25 : 0.62 - progress * 0.16);
    var y = bounds.h * (learning ? mobile ? 0.42 : 0.40 : 0.5 - progress * 0.14);
    var surge = boss.motion === "surge";
    x += Math.sin(t * (surge ? 15 : 1.2)) * (surge ? 16 : 10);
    var width = learning ? Math.min(260, bounds.w * 0.30) : Math.min(380, bounds.w * 0.47);
    var aspect = (ctx.canvas.clientWidth / bounds.w) / (ctx.canvas.clientHeight / bounds.h);
    var height = width * 0.48 * aspect;
    ctx.save();
    ctx.strokeStyle = boss.tension > 75 ? "#ff8d70" : "#F4F5FA";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(boat.x + 106, boat.y + 4);
    ctx.quadraticCurveTo(x, boat.y + 70 + (100 - boss.tension), x - width / 2, y);
    ctx.stroke();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(-1, 1);
    pixelFish(ctx, width, height, victory ? "#ffd76a" : "#B7A6DB", 2, Math.floor(t * (surge ? 12 : 3)));
    ctx.fillStyle = "#ffd76a";
    ctx.fillRect(-width * 0.18, -height * 0.65, width * 0.25, height * 0.12);
    ctx.fillRect(-width * 0.18, -height * 0.8, width * 0.05, height * 0.18);
    ctx.fillRect(-width * 0.08, -height * 0.84, width * 0.05, height * 0.2);
    ctx.fillRect(width * 0.02, -height * 0.8, width * 0.05, height * 0.18);
    ctx.restore();
  }

  function drawBoat(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 1.3) * 2);
    ctx.fillStyle = "#5f4730";
    ctx.beginPath();
    ctx.moveTo(-64, 0);
    ctx.lineTo(64, 0);
    ctx.lineTo(46, 20);
    ctx.lineTo(-46, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8a6a44";
    ctx.fillRect(-64, -4, 128, 7);
    ctx.strokeStyle = "#4c3826";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, -4);
    ctx.quadraticCurveTo(96, -44, 132, -6);
    ctx.stroke();
    ctx.restore();
  }

  function drawLine(ctx, hook, fishFlash) {
    ctx.save();
    ctx.strokeStyle = "rgba(240,250,250,0.75)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hook.homeX + 30, hook.homeY - 8);
    var endX = hook.state === "idle" ? hook.homeX + 30 : hook.x;
    var endY = hook.state === "idle" ? hook.homeY + 22 : hook.y;
    ctx.quadraticCurveTo((hook.homeX + endX) / 2 + 12, (hook.homeY + endY) / 2, endX, endY);
    ctx.stroke();
    ctx.fillStyle = "#e0523e";
    ctx.beginPath();
    ctx.arc(endX, endY, 6, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = "#f6f2e4";
    ctx.beginPath();
    ctx.arc(endX, endY - 3.4, 3.4, 0, 6.29);
    ctx.fill();
    ctx.restore();
  }

  function drawSplash(ctx, x, y, p) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.strokeStyle = "rgba(240,252,252,0.9)";
    ctx.lineWidth = 3;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(x, y, 14 + p * 46 + i * 10, (14 + p * 46 + i * 10) * 0.4, 0, 0, 6.29);
      ctx.stroke();
    }
    ctx.restore();
  }

  window.SeaEngine = {
    PALETTES: PALETTES,
    makeLayout: makeLayout,
    makeAmbient: makeAmbient,
    makeBubbles: makeBubbles,
    makeHook: makeHook,
    stepFish: stepFish,
    stepAmbient: stepAmbient,
    stepBubbles: function (bubbles, dt, bounds) {
      bubbles.forEach(function (b) {
        b.y -= b.speed * dt;
        if (b.y < -6) { b.y = bounds.h + 6; b.x = Math.random() * bounds.w; }
      });
    },
    fleeAll: fleeAll,
    nearest: nearest,
    stepHook: stepHook,
    drawBackground: drawBackground,
    drawFog: drawFog,
    fogCover: fogCover,
    drawFish: drawFish,
    drawBoss: drawBoss,
    drawBoat: drawBoat,
    drawLine: drawLine,
    drawSplash: drawSplash
  };
})();
