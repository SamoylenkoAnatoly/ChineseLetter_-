(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CastleSiege = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VOCAB = [
    { char: "人", pinyin: "rén", plain: "ren", tone: 2, meaning: "Человек", strokes: 2, audio: "audio/ren.mp3" },
    { char: "口", pinyin: "kǒu", plain: "kou", tone: 3, meaning: "Рот", strokes: 3, audio: "audio/kou.mp3" },
    { char: "日", pinyin: "rì", plain: "ri", tone: 4, meaning: "Солнце, день", strokes: 4, audio: "audio/ri.mp3" },
    { char: "木", pinyin: "mù", plain: "mu", tone: 4, meaning: "Дерево", strokes: 4, audio: "audio/mu.mp3" },
    { char: "目", pinyin: "mù", plain: "mu", tone: 4, meaning: "Глаз", strokes: 5, audio: "audio/mu.mp3" },
    { char: "众", pinyin: "zhòng", plain: "zhong", tone: 4, meaning: "Толпа, множество", strokes: 6, audio: "audio/zhong.mp3" },
    { char: "林", pinyin: "lín", plain: "lin", tone: 2, meaning: "Лес, роща", strokes: 8, audio: "audio/lin.mp3" },
    { char: "品", pinyin: "pǐn", plain: "pin", tone: 3, meaning: "Предмет, продукт", strokes: 9, audio: "audio/pin.mp3" },
    { char: "相", pinyin: "xiāng", plain: "xiang", tone: 1, meaning: "Друг друга, взаимно", strokes: 9, audio: "audio/xiang.mp3" }
  ];

  var TYPES = ["write", "meaning", "pinyin", "sound", "tone"];
  var TONES = ["1", "2", "3", "4"];
  var CODES = ["3771", "4567", "6656", "8777"];
  var WALL_MAX = 10;
  var STREAK_GOAL = 3;
  var SCAFFOLD_REPAIR = 3;
  var SCORE = { monster: 100, clean: 50, repair: 30, waveBonus: 150, finalMonster: 200 };
  var RANKS = [
    { min: 7000, name: "Золотой владыка стен" },
    { min: 5000, name: "Серебряный рыцарь" },
    { min: 3000, name: "Бронзовый страж" },
    { min: 0, name: "Ополченец" }
  ];
  var MANA_MAX = 10;
  var MANA_GAIN = 2;
  var VOLLEY_COST = 4;
  var SALVO_COST = 3;
  var SALVO_SECONDS = 5;
  var ELITE_PHASES = ["meaning", "pinyin"];
  var FINAL_PHASES = ["write", "meaning", "tone"];

  var STAGES = [
    {
      name: "Гоблины-разведчики", kind: "goblin", place: "Передовой лагерь",
      monsters: 5, threshold: 2, options: 3,
      outline: true, visualHints: true, leniency: 1.15,
      secondsPerStroke: 0, choiceSeconds: 0, fizzle: false, rage: 0,
      pool: [0, 1, 2, 3, 6],
      specials: {},
      description: "Мелкие тени с факелами щупают стены. Идеальный повод размяться перед настоящей осадой.",
      intention: "Робкие: бьют по стене после 2 ошибок в одном задании. Образец и подсказки на месте."
    },
    {
      name: "Волчья кавалерия", kind: "wolf", place: "Подножие стены",
      monsters: 6, threshold: 2, options: 4,
      outline: true, visualHints: true, leniency: 1.15,
      secondsPerStroke: 0, choiceSeconds: 15, fizzle: false, rage: 0,
      pool: [2, 3, 4, 0, 1, 6],
      specials: { 2: "elite" },
      description: "Всадники на тощих волках нарезают круги у ворот и воют на луну.",
      intention: "Удар по стене после 2 ошибок, на выбор — 15 секунд. Элита требует два верных ответа подряд."
    },
    {
      name: "Осадные тролли", kind: "troll", place: "Осадные башни",
      monsters: 7, threshold: 1, options: 4,
      outline: false, visualHints: false, leniency: 1.15,
      secondsPerStroke: 3, choiceSeconds: 10, fizzle: false, rage: 0,
      pool: [4, 5, 6, 7, 8, 3, 0],
      specials: { 2: "ram", 3: "elite", 6: "herald" },
      description: "Тролли катят башни и тараны. Контура нет — пиши по памяти и не медли.",
      intention: "Письмо по памяти: 3 секунды на черту, выбор — 10 секунд. Любая ошибка — удар. Таран — только письмо, глашатай — только слух, элита — двойное задание."
    },
    {
      name: "Владыка орды", kind: "warlord", place: "Врата бури",
      monsters: 8, threshold: 1, options: 4,
      outline: false, visualHints: false, leniency: 1,
      secondsPerStroke: 4, phase2SecondsPerStroke: 2, choiceSeconds: 8, fizzle: true, rage: 4,
      pool: [7, 8, 6, 5, 4, 3, 1, 2],
      specials: { 2: "shaman", 3: "elite", 5: "armor", 7: "ram", 8: "final" },
      description: "Сам владыка орды встал под стенами. Его ярость растёт с каждым павшим монстром.",
      intention: "Нечистое письмо рассеивается. Ярость с 4-го монстра: 2 секунды на черту. Финал — три испытания подряд, ошибка бьёт по стене двойным. У шамана время вдвое короче."
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
      phase: "intro", stage: 0, monsterIndex: 1,
      wall: WALL_MAX, maxWall: WALL_MAX, waveStartWall: WALL_MAX, waveHits: 0,
      shield: 0, streak: 0,
      monsterHp: null, monsterMaxHp: 0,
      potions: 2,
      mana: 0,
      task: null, strokes: 0, attemptDamage: 0,
      danger: 0, dirty: false,
      quiz: 0,
      score: 0,
      mastery: {},
      charMisses: {},
      lastChar: "",
      wave: { event: "", timerScale: 1, scoreScale: 1, monstersDelta: 0, outline: STAGES[0].outline },
      rng: rng || Math.random,
      stats: { perfect: 0, mistakes: 0, timeouts: 0, wallHits: 0, repairs: 0, repelled: 0 },
      lastCode: ""
    };
  }

  function rollWave(state) {
    var stage = STAGES[state.stage];
    var wave = { event: "", timerScale: 1, scoreScale: 1, monstersDelta: 0, outline: stage.outline };
    if (state.stage > 0) {
      var roll = state.rng();
      if (roll < 0.2) {
        wave.event = "fog";
        wave.outline = false;
      } else if (roll < 0.4) {
        wave.event = "rain";
        wave.timerScale = 0.75;
      } else if (roll < 0.55) {
        wave.event = "desert";
        wave.monstersDelta = -1;
      } else if (roll < 0.75) {
        wave.event = "horde";
        wave.monstersDelta = 1;
        wave.scoreScale = 1.25;
      }
    }
    state.wave = wave;
  }

  function start(state) {
    if (state.phase !== "intro") return false;
    rollWave(state);
    state.phase = "ready";
    return true;
  }

  function currentStage(state) {
    return STAGES[state.stage];
  }

  function effectiveMonsters(state) {
    var stage = STAGES[state.stage];
    return Math.max(4, stage.monsters + state.wave.monstersDelta);
  }

  function bossPhase(state) {
    var rage = STAGES[state.stage].rage;
    return rage && state.monsterIndex >= rage ? 2 : 1;
  }

  function taskSpec(state) {
    var stage = STAGES[state.stage];
    var slot = (state.monsterIndex - 1) % TYPES.length;
    var special = stage.specials[state.monsterIndex] || "";
    var phases;
    if (special === "ram") phases = ["write"];
    else if (special === "herald") phases = ["sound"];
    else if (special === "elite") phases = ELITE_PHASES.slice();
    else if (special === "final") phases = FINAL_PHASES.slice();
    else phases = [TYPES[slot]];
    var vocab = VOCAB[stage.pool[(state.monsterIndex - 1) % stage.pool.length]];
    var hot = Object.keys(state.mastery);
    if (hot.length && state.rng() < 0.5) {
      var pick = hot[Math.floor(state.rng() * hot.length) % hot.length];
      if (pick !== state.lastChar) {
        for (var i = 0; i < VOCAB.length; i++) {
          if (VOCAB[i].char === pick) { vocab = VOCAB[i]; break; }
        }
      }
    }
    return { type: phases[0], phases: phases, slot: slot, special: special, vocab: vocab };
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
    var correct;
    var wrongs;
    if (type === "tone") {
      correct = String(vocab.tone);
      wrongs = TONES.filter(function (tone) { return tone !== correct; });
    } else {
      correct = fieldValue(vocab, type);
      wrongs = pickDistractors(vocab, type, options - 1);
    }
    task.correct = correct;
    task.options = wrongs.concat([correct]);
  }

  function taskSeconds(state) {
    var task = state.task;
    if (!task) return 0;
    var stage = STAGES[state.stage];
    var seconds = 0;
    if (task.type === "write") {
      if (stage.secondsPerStroke) {
        var per = bossPhase(state) === 2 ? stage.phase2SecondsPerStroke || stage.secondsPerStroke : stage.secondsPerStroke;
        seconds = per * task.strokeTotal;
      }
    } else {
      seconds = stage.choiceSeconds || 0;
    }
    if (seconds && task.special === "shaman") seconds = Math.ceil(seconds / 2);
    if (seconds && state.wave.timerScale !== 1) seconds = Math.ceil(seconds * state.wave.timerScale);
    return seconds;
  }

  function beginTask(state) {
    if (state.phase !== "ready") return null;
    var spec = taskSpec(state);
    var task = {
      phases: spec.phases,
      phaseIndex: 0,
      special: spec.special,
      covers: spec.phases.slice(),
      misses: 0,
      volley: false
    };
    buildPhase(task, spec.vocab, spec.phases[0], STAGES[state.stage].options);
    if (state.monsterHp === null) {
      var hp = 0;
      for (var i = 0; i < spec.phases.length; i++) hp += spec.phases[i] === "write" ? spec.vocab.strokes : 1;
      state.monsterHp = hp;
      state.monsterMaxHp = hp;
    }
    state.task = task;
    state.lastChar = task.char;
    state.strokes = 0;
    state.attemptDamage = 0;
    state.dirty = false;
    state.quiz += 1;
    state.phase = spec.phases[0] === "write" ? "writing" : "choice";
    return task;
  }

  function advancePhase(state) {
    var task = state.task;
    task.phaseIndex += 1;
    buildPhase(task, task.vocab, task.phases[task.phaseIndex], STAGES[state.stage].options);
    task.volley = false;
    state.strokes = 0;
    state.attemptDamage = 0;
    state.quiz += 1;
    state.phase = task.type === "write" ? "writing" : "choice";
  }

  function valid(state, token) {
    return token === state.quiz && (state.phase === "writing" || state.phase === "choice");
  }

  function hurt(state) {
    var damage = state.task && state.task.special === "final" ? 2 : 1;
    state.stats.wallHits += 1;
    state.waveHits += 1;
    if (state.shield) {
      state.shield = 0;
      return { blocked: true, damage: 0 };
    }
    state.wall = Math.max(0, state.wall - damage);
    if (state.wall === 0) {
      state.phase = "defeat";
      state.quiz += 1;
    }
    return { blocked: false, damage: damage };
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
    if (state.task.special === "armor" && state.task.misses === 1) {
      return { blocked: false, damage: 0, armor: true };
    }
    state.danger += 1;
    if (state.danger >= STAGES[state.stage].threshold) {
      state.danger = 0;
      return hurt(state);
    }
    return { blocked: false, damage: 0, warning: true };
  }

  function registerMistake(state) {
    noteMiss(state);
    return chargeDanger(state);
  }

  function strokeCorrect(state, token, stroke) {
    if (state.phase !== "writing" || !valid(state, token)) return null;
    if (stroke !== state.strokes || stroke > state.task.strokeTotal - 1) return false;
    state.strokes += 1;
    state.attemptDamage += 1;
    state.monsterHp = Math.max(0, state.monsterHp - 1);
    return { damage: 1 };
  }

  function strokeMistake(state, token) {
    if (state.phase !== "writing" || !valid(state, token)) return null;
    return registerMistake(state);
  }

  function finishClean(state) {
    var result = { correct: true, fizzle: false, killed: true, advanced: false, repair: 0, response: null, gained: 0 };
    state.stats.repelled += 1;
    var task = state.task;
    var base = task.special === "final" ? SCORE.finalMonster : SCORE.monster;
    var scale = state.wave.scoreScale;
    if (!state.dirty) {
      state.stats.perfect += 1;
      state.streak += 1;
      var mult = multiplierFor(state.streak);
      var points = Math.round((base + SCORE.clean) * mult * scale);
      state.score += points;
      result.gained = points;
      state.mana = Math.min(MANA_MAX, state.mana + MANA_GAIN);
      state.shield = 1;
      delete state.mastery[task.char];
      if (state.streak % STREAK_GOAL === 0 && state.wall < state.maxWall) {
        state.wall = Math.min(state.maxWall, state.wall + 1);
        state.stats.repairs += 1;
        state.score += SCORE.repair;
        result.repair = 1;
      }
    } else {
      state.streak = 0;
      var dirtyPoints = Math.round(base * scale);
      state.score += dirtyPoints;
      result.gained = dirtyPoints;
    }
    return result;
  }

  function completeWriting(state, token) {
    if (state.phase !== "writing" || !valid(state, token)) return null;
    if (state.strokes < state.task.strokeTotal) return false;
    var stage = STAGES[state.stage];
    var phased = state.task.phases.length > 1;
    if (!phased && stage.fizzle && state.dirty) {
      state.streak = 0;
      var regained = Math.min(state.monsterMaxHp - state.monsterHp, state.attemptDamage);
      state.monsterHp += regained;
      var response = hurt(state);
      state.phase = "resolving";
      state.quiz += 1;
      return { correct: false, fizzle: true, killed: false, advanced: false, regained: regained, repair: 0, response: response };
    }
    if (phased && state.task.phaseIndex < state.task.phases.length - 1) {
      advancePhase(state);
      return { correct: true, fizzle: false, killed: false, advanced: true, repair: 0, response: null };
    }
    state.phase = "resolving";
    state.quiz += 1;
    return finishClean(state);
  }

  function answerChoice(state, token, value) {
    if (state.phase !== "choice" || !valid(state, token)) return null;
    if (value !== state.task.correct) {
      return { correct: false, fizzle: false, killed: false, advanced: false, repair: 0, response: registerMistake(state) };
    }
    if (state.task.phaseIndex < state.task.phases.length - 1) {
      state.monsterHp = Math.max(0, state.monsterHp - 1);
      advancePhase(state);
      return { correct: true, fizzle: false, killed: false, advanced: true, repair: 0, response: null };
    }
    state.monsterHp = 0;
    state.phase = "resolving";
    state.quiz += 1;
    return finishClean(state);
  }

  function timeoutTask(state) {
    if (state.phase === "writing") {
      state.quiz += 1;
      state.stats.timeouts += 1;
      noteMiss(state);
      state.strokes = 0;
      state.attemptDamage = 0;
      var hit = chargeDanger(state);
      if (state.phase !== "defeat") state.phase = "ready";
      return { restarted: true, response: hit };
    }
    if (state.phase === "choice") {
      state.stats.timeouts += 1;
      return { restarted: false, response: registerMistake(state) };
    }
    return null;
  }

  function finishMonster(state) {
    if (state.phase !== "resolving") return null;
    var stage = STAGES[state.stage];
    state.dirty = false;
    state.strokes = 0;
    state.attemptDamage = 0;
    state.danger = 0;
    if (state.monsterHp > 0) {
      state.phase = "ready";
      state.quiz += 1;
      return { restarted: true, next: "ready" };
    }
    state.monsterHp = null;
    var result = { restarted: false, next: "ready", code: state.lastCode, waveBonus: false };
    if (state.monsterIndex >= effectiveMonsters(state)) {
      if (state.stage === STAGES.length - 1) {
        state.phase = "victory";
        result.next = "victory";
      } else {
        state.phase = "stageclear";
        state.lastCode = CODES[state.stage];
        result.next = "stageclear";
        result.code = state.lastCode;
      }
      if (state.waveHits === 0) {
        state.score += SCORE.waveBonus;
        result.waveBonus = true;
      }
    } else {
      state.monsterIndex += 1;
      state.phase = "ready";
    }
    state.quiz += 1;
    return result;
  }

  function nextStage(state) {
    if (state.phase !== "stageclear") return false;
    state.stage += 1;
    state.monsterIndex = 1;
    state.monsterHp = null;
    state.task = null;
    state.danger = 0;
    state.dirty = false;
    state.strokes = 0;
    state.attemptDamage = 0;
    state.waveHits = 0;
    state.waveStartWall = state.wall;
    rollWave(state);
    state.phase = "ready";
    return true;
  }

  function repairWall(state) {
    if ((state.phase !== "writing" && state.phase !== "choice") || !state.potions || state.wall === state.maxWall) return 0;
    var amount = Math.min(SCAFFOLD_REPAIR, state.maxWall - state.wall);
    state.wall += amount;
    state.potions -= 1;
    return amount;
  }

  function castVolley(state) {
    if (state.phase !== "choice" || state.mana < VOLLEY_COST || !state.task || state.task.volley) return false;
    state.mana -= VOLLEY_COST;
    state.task.volley = true;
    return true;
  }

  function castSalvo(state) {
    if ((state.phase !== "writing" && state.phase !== "choice") || state.mana < SALVO_COST || !state.task || !taskSeconds(state)) return null;
    state.mana -= SALVO_COST;
    return { seconds: SALVO_SECONDS };
  }

  function failLoad(state) {
    if (["ready", "writing", "choice"].indexOf(state.phase) === -1) return false;
    state.quiz += 1;
    state.phase = "error";
    state.strokes = 0;
    state.attemptDamage = 0;
    return true;
  }

  function retryLoad(state) {
    if (state.phase !== "error") return false;
    state.phase = "ready";
    return true;
  }

  return {
    VOCAB: VOCAB, TYPES: TYPES, TONES: TONES, CODES: CODES, WALL_MAX: WALL_MAX, STREAK_GOAL: STREAK_GOAL,
    STAGES: STAGES, SCORE: SCORE, RANKS: RANKS, rankFor: rankFor, multiplierFor: multiplierFor,
    MANA_MAX: MANA_MAX, MANA_GAIN: MANA_GAIN, VOLLEY_COST: VOLLEY_COST, SALVO_COST: SALVO_COST, SALVO_SECONDS: SALVO_SECONDS,
    create: create, start: start, currentStage: currentStage, effectiveMonsters: effectiveMonsters,
    bossPhase: bossPhase, taskSeconds: taskSeconds,
    beginTask: beginTask, valid: valid, strokeCorrect: strokeCorrect, strokeMistake: strokeMistake,
    completeWriting: completeWriting, answerChoice: answerChoice, timeoutTask: timeoutTask,
    finishMonster: finishMonster, nextStage: nextStage, repairWall: repairWall,
    castVolley: castVolley, castSalvo: castSalvo, failLoad: failLoad, retryLoad: retryLoad
  };
}));
