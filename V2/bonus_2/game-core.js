(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DepthDive = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VOCAB = [
    { char: "术", pinyin: "shù", plain: "shu", tone: 4, meaning: "Приём, техника", strokes: 5, audio: "audio/shu.mp3" },
    { char: "中", pinyin: "zhōng", plain: "zhong", tone: 1, meaning: "Середина, центр", strokes: 4, audio: "audio/zhong.mp3" },
    { char: "右", pinyin: "yòu", plain: "you", tone: 4, meaning: "Право, правая сторона", strokes: 5, audio: "audio/you.mp3" },
    { char: "心", pinyin: "xīn", plain: "xin", tone: 1, meaning: "Сердце", strokes: 4, audio: "audio/xin.mp3" },
    { char: "必", pinyin: "bì", plain: "bi", tone: 4, meaning: "Обязательно, непременно", strokes: 5, audio: "audio/bi.mp3" },
    { char: "想", pinyin: "xiǎng", plain: "xiang", tone: 3, meaning: "Думать, хотеть", strokes: 13, audio: "audio/xiang.mp3" },
    { char: "白", pinyin: "bái", plain: "bai", tone: 2, meaning: "Белый", strokes: 5, audio: "audio/bai.mp3" },
    { char: "勺", pinyin: "sháo", plain: "shao", tone: 2, meaning: "Ложка, ковш", strokes: 3, audio: "audio/shao.mp3" },
    { char: "的", pinyin: "de", plain: "de", tone: 5, meaning: "Частица «-де» (принадлежность)", strokes: 8, audio: "audio/de.mp3" }
  ];

  var TYPES = ["write", "meaning", "pinyin", "sound"];
  var CODES = ["3456", "4444", "5454", "9999"];
  var WORMS_START = 6;
  var WORMS_ZONE_RESTART = 4;
  var STREAK_GOAL = 3;
  var SCORE = { fish: 100, clean: 50, golden: 300, bigCatch: 150, zoneBonus: 150 };
  var RANKS = [
    { min: 5000, name: "Золотой рыбак" },
    { min: 4000, name: "Мастер удочки" },
    { min: 2500, name: "Рыбак с поплавком" },
    { min: 0, name: "Юнга на плоту" }
  ];
  var BOSS_TYPES = ["write", "meaning", "pinyin", "sound"];
  var BOSS_ZONE = { name: "Большой улов", depth: "25–40 м", fish: 1, options: 4, outline: false, hints: false, leniency: 1.15, snap: false, oxygenWrite: 0, oxygenChoice: 0 };
  var BOSS_REWARD = 1000;
  var BOSS_RHYTHM = {
    pull: 6.5,
    tensionCalm: 22,
    tensionWarning: 35,
    tensionSurge: 65,
    relax: 75,
    calmFirst: 1.8,
    calmMin: 1.4,
    warning: 0.8,
    surge: 1.1,
    calmAfterSurge: 2.0,
    tensionStart: 20
  };
  var WRITE_SECONDS_CAP = 40;

  var ZONES = [
    {
      name: "Солнечные отмели", depth: "0–4 м", fish: 5, options: 4, threshold: 3,
      speedMin: 25, speedMax: 40, drift: 0, dodge: 0, fog: false,
      oxygenChoice: 0, oxygenWrite: 0, outline: true, hints: true, leniency: 1.15, snap: false, finale: false,
      pool: [0, 1, 2, 0, 1, 2]
    },
    {
      name: "Быстрое течение", depth: "4–9 м", fish: 6, options: 5, threshold: 2,
      speedMin: 45, speedMax: 65, drift: 1, dodge: 0, fog: false,
      oxygenChoice: 20, oxygenWrite: 0, outline: true, hints: false, leniency: 1.15, snap: false, finale: false,
      pool: [3, 4, 0, 1, 2, 5, 6]
    },
    {
      name: "Туманная бездна", depth: "9–16 м", fish: 7, options: 6, threshold: 1,
      speedMin: 55, speedMax: 80, drift: 0.6, dodge: 0.5, fog: true,
      oxygenChoice: 15, oxygenWrite: 3.5, outline: false, hints: false, leniency: 1.15, snap: false, finale: false,
      pool: [5, 6, 7, 3, 4, 0, 1]
    },
    {
      name: "Золотая река", depth: "16–25 м", fish: 8, options: 7, threshold: 1,
      speedMin: 70, speedMax: 100, drift: 0, dodge: 1, fog: false,
      oxygenChoice: 12, oxygenWrite: 3, outline: false, hints: false, leniency: 1.0, snap: true, finale: false,
      pool: [8, 7, 6, 5, 4, 3, 2, 1, 0]
    }
  ];

  function rankFor(score) {
    for (var i = 0; i < RANKS.length; i++) {
      if (score >= RANKS[i].min) return RANKS[i].name;
    }
    return RANKS[RANKS.length - 1].name;
  }

  function multiplierFor(streak) {
    return streak >= 4 ? 2 : streak >= 2 ? 1.5 : 1;
  }

  function create(rng) {
    return {
      phase: "intro", zone: 0, fishIndex: 1,
      worms: WORMS_START, maxWorms: WORMS_START,
      zoneWormHits: 0,
      streak: 0, score: 0, caught: 0, zoneCaught: 0,
      task: null, danger: 0, dirty: false,
      quiz: 0,
      mastery: {}, charMisses: {}, lastChar: "",
      codes: [], lastCode: "", boss: null, trophy: false,
      rng: rng || Math.random,
      stats: { perfect: 0, mistakes: 0, timeouts: 0, wormLosses: 0, bigCatches: 0, zoneRestarts: 0 }
    };
  }

  function currentZone(state) {
    return state.zone === 4 ? BOSS_ZONE : ZONES[state.zone];
  }

  function taskSpec(state) {
    var zone = ZONES[state.zone];
    var slot = (state.fishIndex - 1) % TYPES.length;
    var phases = [TYPES[slot]];
    var vocab = VOCAB[zone.pool[(state.fishIndex - 1) % zone.pool.length]];
    var hot = Object.keys(state.mastery);
    if (hot.length && state.rng() < 0.5) {
      var pick = hot[Math.floor(state.rng() * hot.length) % hot.length];
      if (pick !== state.lastChar) {
        for (var i = 0; i < VOCAB.length; i++) {
          if (VOCAB[i].char === pick) { vocab = VOCAB[i]; break; }
        }
      }
    }
    return { phases: phases, special: "", vocab: vocab };
  }

  function fieldValue(entry, type) {
    if (type === "meaning") return entry.meaning;
    if (type === "pinyin") return entry.pinyin;
    return entry.char;
  }

  function pickDistractors(target, type, count) {
    var seen = {};
    seen[fieldValue(target, type)] = true;
    var scored = [];
    for (var i = 0; i < VOCAB.length; i++) {
      var entry = VOCAB[i];
      if (entry.char === target.char) continue;
      if (type !== "meaning" && entry.plain === target.plain) continue;
      var score = type === "meaning" && entry.plain === target.plain ? 0 : entry.tone === target.tone ? 1 : 2;
      scored.push({ entry: entry, order: i, score: score });
    }
    scored.sort(function (a, b) { return a.score - b.score || a.order - b.order; });
    var picked = [];
    for (var j = 0; j < scored.length && picked.length < count; j++) {
      var value = fieldValue(scored[j].entry, type);
      if (seen[value]) continue;
      seen[value] = true;
      picked.push(value);
    }
    return picked;
  }

  function buildPhase(task, vocab, type, options) {
    task.type = type;
    task.vocab = vocab;
    task.char = vocab.char;
    task.pinyin = vocab.pinyin;
    task.tone = vocab.tone;
    task.meaning = vocab.meaning;
    task.audio = vocab.audio;
    task.strokeTotal = vocab.strokes;
    task.strokes = 0;
    task.correct = fieldValue(vocab, type);
    task.options = type === "write" ? [task.correct] : pickDistractors(vocab, type, options - 1).concat([task.correct]);
  }

  function beginTask(state) {
    if (state.zone === 4) return null;
    if (state.phase !== "ready") return null;
    var zone = ZONES[state.zone];
    var spec = taskSpec(state);
    var task = { phases: spec.phases, phaseIndex: 0, special: spec.special, misses: 0 };
    buildPhase(task, spec.vocab, spec.phases[0], zone.options);
    state.task = task;
    state.lastChar = task.char;
    state.danger = 0;
    state.dirty = false;
    state.quiz += 1;
    state.phase = task.type === "write" ? "grotto" : "fishing";
    return task;
  }

  function start(state) {
    if (state.phase !== "intro") return false;
    state.phase = "ready";
    return true;
  }

  function valid(state, token) {
    return token === state.quiz && (state.phase === "fishing" || state.phase === "grotto");
  }

  function loseWorm(state, damage) {
    state.stats.wormLosses += 1;
    state.zoneWormHits += 1;
    state.worms = Math.max(0, state.worms - damage);
    if (state.worms === 0) {
      state.phase = "defeat";
      state.quiz += 1;
      return { defeated: true, damage: damage };
    }
    return { defeated: false, damage: damage };
  }

  function noteMiss(state) {
    state.dirty = true;
    state.streak = 0;
    state.stats.mistakes += 1;
    state.task.misses += 1;
    state.charMisses[state.task.char] = (state.charMisses[state.task.char] || 0) + 1;
    state.mastery[state.task.char] = true;
  }

  function chargeDanger(state) {
    state.danger += 1;
    if (state.danger >= ZONES[state.zone].threshold) {
      state.danger = 0;
      var damage = state.task.special === "golden" ? 2 : 1;
      var loss = loseWorm(state, damage);
      if (loss.defeated) return { wormLoss: loss, defeated: true };
      return { wormLoss: loss, defeated: false };
    }
    return { wormLoss: null, defeated: false };
  }

  function reissue(state) {
    state.danger = 0;
    state.dirty = false;
    state.quiz += 1;
    state.phase = "ready";
    var task = beginTask(state);
    return task;
  }

  function taskSeconds(state) {
    var task = state.task;
    if (!task || state.zone === 4) return 0;
    var zone = ZONES[state.zone];
    if (task.type === "write") {
      if (!zone.oxygenWrite) return 0;
      return Math.min(WRITE_SECONDS_CAP, zone.oxygenWrite * task.strokeTotal);
    }
    return zone.oxygenChoice || 0;
  }

  function finishCatch(state) {
    var result = { correct: true, caught: true, advanced: false, gained: 0, bigCatch: false, baitBack: 0 };
    state.caught += 1;
    state.zoneCaught += 1;
    var task = state.task;
    var base = task.special === "golden" ? SCORE.golden : SCORE.fish;
    if (!state.dirty) {
      state.stats.perfect += 1;
      state.streak += 1;
      var mult = multiplierFor(state.streak);
      var points = Math.round((base + SCORE.clean) * mult);
      state.score += points;
      result.gained = points;
      delete state.mastery[task.char];
      if (state.streak % STREAK_GOAL === 0) {
        state.stats.bigCatches += 1;
        state.score += SCORE.bigCatch;
        result.bigCatch = true;
        if (state.worms < state.maxWorms) {
          state.worms += 1;
          result.baitBack = 1;
        }
      }
    } else {
      state.streak = 0;
      var dirtyPoints = Math.round(base);
      state.score += dirtyPoints;
      result.gained = dirtyPoints;
    }
    state.phase = "resolving";
    state.quiz += 1;
    return result;
  }

  function hookFish(state, token, label) {
    if (state.phase !== "fishing" || !valid(state, token)) return null;
    if (label !== state.task.correct) {
      noteMiss(state);
      var miss = chargeDanger(state);
      if (miss.defeated) return { correct: false, defeated: true };
      if (miss.wormLoss) {
        var task = reissue(state);
        return { correct: false, wormLoss: miss.wormLoss, reissued: task };
      }
      return { correct: false, wormLoss: null };
    }
    if (state.task.phaseIndex < state.task.phases.length - 1) {
      state.task.phaseIndex += 1;
      buildPhase(state.task, state.task.vocab, state.task.phases[state.task.phaseIndex], ZONES[state.zone].options);
      state.danger = 0;
      state.quiz += 1;
      state.phase = state.task.type === "write" ? "grotto" : "fishing";
      return { correct: true, advanced: true };
    }
    return finishCatch(state);
  }

  function strokeCorrect(state, token, stroke) {
    if (state.phase !== "grotto" || !valid(state, token)) return null;
    if (stroke !== state.task.strokes || stroke > state.task.strokeTotal - 1) return false;
    state.task.strokes += 1;
    return { damage: 1 };
  }

  function strokeMistake(state, token) {
    if (state.phase !== "grotto" || !valid(state, token)) return null;
    noteMiss(state);
    if (state.zone === 4) {
      var loss = loseWorm(state, 1);
      return { defeated: loss.defeated, wormLoss: loss };
    }
    var miss = chargeDanger(state);
    if (miss.defeated) return { defeated: true };
    if (miss.wormLoss) return { wormLoss: miss.wormLoss };
    return { wormLoss: null };
  }

  function completeWriting(state, token) {
    if (state.phase !== "grotto" || !valid(state, token)) return null;
    if (!state.task.strokes || state.task.strokes < state.task.strokeTotal) return false;
    if (state.zone === 4) return bossSuccess(state);
    var zone = ZONES[state.zone];
    var phased = state.task.phases.length > 1;
    if (!phased && zone.snap && state.dirty) {
      var loss = loseWorm(state, 1);
      if (loss.defeated) return { snap: true, defeated: true };
      var task = reissue(state);
      return { snap: true, wormLoss: loss, reissued: task };
    }
    if (phased && state.task.phaseIndex < state.task.phases.length - 1) {
      state.task.phaseIndex += 1;
      buildPhase(state.task, state.task.vocab, state.task.phases[state.task.phaseIndex], zone.options);
      state.danger = 0;
      state.quiz += 1;
      state.phase = state.task.type === "write" ? "grotto" : "fishing";
      return { advanced: true };
    }
    return finishCatch(state);
  }

  function oxygenOut(state) {
    if (state.zone === 4 || (state.phase !== "fishing" && state.phase !== "grotto")) return null;
    state.stats.timeouts += 1;
    noteMiss(state);
    var damage = state.task.special === "golden" ? 2 : 1;
    var loss = loseWorm(state, damage);
    if (loss.defeated) return { defeated: true };
    var task = reissue(state);
    return { wormLoss: loss, reissued: task };
  }

  function resolveFish(state) {
    if (state.phase !== "resolving") return null;
    var zone = ZONES[state.zone];
    if (state.fishIndex < zone.fish) {
      state.fishIndex += 1;
      state.phase = "ready";
      var task = beginTask(state);
      return { next: "task", task: task };
    }
    state.lastCode = CODES[state.zone];
    state.codes.push(state.lastCode);
    var bonus = false;
    if (state.zoneWormHits === 0) {
      state.score += SCORE.zoneBonus;
      bonus = true;
    }
    state.phase = "zoneclear";
    state.quiz += 1;
    return { next: "zoneclear", code: state.lastCode, zoneBonus: bonus };
  }

  function nextZone(state) {
    if (state.phase !== "zoneclear") return false;
    state.zone += 1;
    if (state.zone === 4) { startBoss(state); return true; }
    state.fishIndex = 1;
    state.zoneCaught = 0;
    state.zoneWormHits = 0;
    state.task = null;
    state.danger = 0;
    state.dirty = false;
    state.phase = "ready";
    beginTask(state);
    return true;
  }

  function restartZone(state) {
    if (state.phase !== "defeat") return false;
    state.stats.zoneRestarts += 1;
    state.fishIndex = 1;
    state.zoneCaught = 0;
    state.zoneWormHits = 0;
    state.task = null;
    state.danger = 0;
    state.dirty = false;
    state.worms = Math.min(WORMS_ZONE_RESTART, state.maxWorms);
    state.streak = 0;
    if (state.zone === 4) startBoss(state);
    else { state.phase = "ready"; beginTask(state); }
    return true;
  }

  function startBoss(state) {
    state.task = null;
    state.fishIndex = 1;
    state.zoneCaught = 0;
    state.quiz += 1;
    state.phase = "boss";
    state.boss = { progress: 0, tension: BOSS_RHYTHM.tensionStart, checkpoint: 0, motion: "calm", remaining: BOSS_RHYTHM.calmFirst, elapsed: 0, armed: false };
  }

  function bossChallenge(state) {
    var b = state.boss;
    var vocab = VOCAB[[5, 6, 2, 8][b.checkpoint]];
    var type = BOSS_TYPES[b.checkpoint];
    var task = { phases: [type], phaseIndex: 0, special: "boss", misses: 0 };
    buildPhase(task, vocab, type, 4);
    state.task = task;
    state.dirty = false;
    state.quiz += 1;
    state.phase = type === "write" ? "grotto" : "bossquiz";
    return { challenge: true };
  }

  function bossSuccess(state) {
    state.boss.checkpoint += 1;
    state.boss.motion = "calm";
    state.boss.remaining = BOSS_RHYTHM.calmFirst;
    state.boss.tension = BOSS_RHYTHM.tensionStart;
    state.boss.armed = false;
    state.task = null;
    state.quiz += 1;
    state.phase = "boss";
    return { bossResume: true };
  }

  function bossAnswer(state, token, answer) {
    if (state.phase !== "bossquiz" || token !== state.quiz) return null;
    if (answer !== state.task.correct) {
      noteMiss(state);
      var loss = loseWorm(state, 1);
      return { correct: false, defeated: loss.defeated, wormLoss: loss };
    }
    return bossSuccess(state);
  }

  function bossCalmWindow(b) {
    var base = Math.max(BOSS_RHYTHM.calmMin, BOSS_RHYTHM.calmFirst - b.checkpoint * 0.1);
    return base;
  }

  function bossTick(state, dt, held) {
    if (state.phase !== "boss" || !state.boss || !Number.isFinite(dt) || dt <= 0) return null;
    dt = Math.min(dt, 0.05);
    var b = state.boss;
    if (!b.armed) {
      if (!held) return null;
      b.armed = true;
      b.remaining = bossCalmWindow(b);
    }
    b.elapsed += dt;
    b.remaining -= dt;
    var pull = b.motion === "calm" ? BOSS_RHYTHM.tensionCalm : b.motion === "warning" ? BOSS_RHYTHM.tensionWarning : BOSS_RHYTHM.tensionSurge;
    b.tension = Math.max(0, Math.min(100, b.tension + dt * (held ? pull : -BOSS_RHYTHM.relax)));
    if (b.tension >= 100) {
      var loss = loseWorm(state, 1);
      b.progress = b.checkpoint * 20;
      b.tension = BOSS_RHYTHM.tensionStart;
      b.motion = "calm";
      b.remaining = BOSS_RHYTHM.calmFirst;
      b.armed = false;
      return { snap: true, defeated: loss.defeated, wormLoss: loss };
    }
    if (held && b.motion === "calm") b.progress = Math.min(100, b.progress + dt * BOSS_RHYTHM.pull);
    if (b.progress >= (b.checkpoint + 1) * 20) {
      if (b.checkpoint < 4) return bossChallenge(state);
      state.trophy = true;
      state.score += BOSS_REWARD;
      state.caught += 1;
      state.zoneCaught = 1;
      state.quiz += 1;
      state.phase = "victory";
      return { victory: true, gained: BOSS_REWARD };
    }
    if (b.remaining <= 0) {
      if (b.motion === "calm") { b.motion = "warning"; b.remaining = BOSS_RHYTHM.warning; }
      else if (b.motion === "warning") { b.motion = "surge"; b.remaining = BOSS_RHYTHM.surge; }
      else { b.motion = "calm"; b.remaining = BOSS_RHYTHM.calmAfterSurge; }
      return { motion: b.motion };
    }
    return null;
  }

  return {
    VOCAB: VOCAB, TYPES: TYPES, CODES: CODES, ZONES: ZONES, SCORE: SCORE, RANKS: RANKS,
    WORMS_START: WORMS_START, WORMS_ZONE_RESTART: WORMS_ZONE_RESTART, STREAK_GOAL: STREAK_GOAL,
    BOSS_TYPES: BOSS_TYPES, BOSS_REWARD: BOSS_REWARD, BOSS_RHYTHM: BOSS_RHYTHM,
    bossTick: bossTick, bossAnswer: bossAnswer,
    rankFor: rankFor, multiplierFor: multiplierFor,
    create: create, start: start, currentZone: currentZone, beginTask: beginTask, valid: valid,
    taskSeconds: taskSeconds,
    hookFish: hookFish, strokeCorrect: strokeCorrect, strokeMistake: strokeMistake,
    completeWriting: completeWriting, oxygenOut: oxygenOut,
    resolveFish: resolveFish, nextZone: nextZone, restartZone: restartZone
  };
}));
