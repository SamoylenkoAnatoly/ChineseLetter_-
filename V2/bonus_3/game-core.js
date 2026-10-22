(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CinnabonFarm = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VOCAB = [
    { char: "月", pinyin: "yuè", meaning: "Луна, месяц", strokes: 4, audio: "audio/yue.mp3" },
    { char: "明", pinyin: "míng", meaning: "Светлый, ясный", strokes: 8, audio: "audio/ming.mp3" },
    { char: "有", pinyin: "yǒu", meaning: "Иметь, есть", strokes: 6, audio: "audio/you2.mp3" },
    { char: "朋", pinyin: "péng", meaning: "Друг", strokes: 8, audio: "audio/peng.mp3" },
    { char: "用", pinyin: "yòng", meaning: "Использовать", strokes: 5, audio: "audio/yong.mp3" },
    { char: "夕", pinyin: "xī", meaning: "Вечер", strokes: 3, audio: "audio/xi.mp3" },
    { char: "名", pinyin: "míng", meaning: "Имя", strokes: 6, audio: "audio/ming2.mp3" },
    { char: "自", pinyin: "zì", meaning: "Сам", strokes: 6, audio: "audio/zi.mp3" },
    { char: "息", pinyin: "xī", meaning: "Дыхание, отдых", strokes: 10, audio: "audio/xi2.mp3" }
  ];
  var TYPES = ["write", "meaning", "pinyin", "sound"];
  var CODES = ["3434", "4445", "5222", "9219"];
  var STAGES = [
    { name: "Первые ростки", season: "Весна", crop: "редис", count: 12, options: 3, outline: true, hints: 2, leniency: 1.2, threshold: 3, choiceSeconds: 0, strokeSeconds: 0, minSeconds: 0, maxSeconds: 0, description: "Выбирай грядки и инструменты. Весенний дождь поможет саду, а урожай оплатит первые улучшения." },
    { name: "Спасение сада", season: "Лето", crop: "морковь", count: 16, options: 4, outline: true, hints: false, leniency: 1.15, threshold: 2, choiceSeconds: 35, strokeSeconds: 0, minSeconds: 0, maxSeconds: 0, description: "Засуха и вредители угрожают двум растениям. Реши, какое спасать, и подготовь лейку или пугало." },
    { name: "Осенний рынок", season: "Осень", crop: "тыква", count: 20, options: 5, outline: false, hints: false, leniency: 1.1, threshold: 2, choiceSeconds: 25, strokeSeconds: 5, minSeconds: 25, maxSeconds: 60, description: "Выбирай покупателя: надёжный заказ или премия за две чистые работы. Пиши по памяти, выполняй поставки." },
    { name: "Лунная ярмарка", season: "Ночь", crop: "лунный плод", count: 24, options: 6, outline: false, hints: false, leniency: 1, threshold: 1, choiceSeconds: 18, strokeSeconds: 4, minSeconds: 20, maxSeconds: 50, description: "Цепочки из трёх дел, лунные корзины и шесть вариантов. Последняя поставка откроет четвёртый код." }
  ];
  var UPGRADES = [
    { id: "can", name: "Запасная лейка", price: 4, description: "Один раз защитит вторую грядку от засухи." },
    { id: "scarecrow", name: "Пугало", price: 4, description: "Один раз отгонит вредителя от второй грядки." },
    { id: "greenhouse", name: "Теплица", price: 6, description: "Один раз сохранит качество при ошибке или таймауте. Ответ всё равно нужно исправить." }
  ];
  var KEYS = ["phase", "stage", "index", "token", "score", "streak", "coins", "codes", "plan", "task", "growth", "quality", "wilted", "charges", "bought", "misses", "stats", "lastVocab", "event", "eventAt", "chain", "notice"];

  function shuffle(list, rng) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
      var temp = copy[i]; copy[i] = copy[j]; copy[j] = temp;
    }
    return copy;
  }

  function schedule(stage, rng) {
    var count = STAGES[stage].count;
    var chars = shuffle(VOCAB.map(function (_, i) { return i; }), rng);
    var types = [];
    TYPES.forEach(function (type) { for (var i = 0; i < count / 4 - 1; i++) types.push(type); });
    types = shuffle(types, rng).concat(shuffle(TYPES, rng));
    return types.map(function (type, i) { return { id: i, vocab: chars[i % 9], type: type, done: false, final: i >= count - 4 }; });
  }

  function field(entry, type) {
    return type === "meaning" ? entry.meaning : type === "pinyin" ? entry.pinyin : entry.char;
  }

  function optionsFor(entry, type, count, rng) {
    if (type === "write") return [];
    var seen = {};
    seen[type === "sound" ? entry.pinyin : field(entry, type)] = true;
    var options = [field(entry, type)];
    shuffle(VOCAB, rng).forEach(function (candidate) {
      var key = type === "sound" ? candidate.pinyin : field(candidate, type);
      if (!seen[key] && options.length < count) { seen[key] = true; options.push(field(candidate, type)); }
    });
    return shuffle(options, rng);
  }

  function blankFlags() { return { can: false, scarecrow: false, greenhouse: false }; }
  function create(rng) {
    return {
      phase: "intro", stage: 0, index: 0, token: 0, score: 0, streak: 0, coins: 4,
      codes: [], plan: [], task: null, paused: false, lastVocab: -1,
      growth: VOCAB.map(function () { return 0; }), quality: VOCAB.map(function () { return true; }),
      wilted: VOCAB.map(function () { return false; }), charges: blankFlags(), bought: blankFlags(),
      misses: {}, stats: { correct: 0, perfect: 0, mistakes: 0, timeouts: 0, contracts: 0 },
      event: null, eventAt: 0, chain: null, notice: "", rng: rng || Math.random
    };
  }

  function beginSeason(state) {
    state.index = 0; state.streak = 0; state.lastVocab = -1;
    state.coins = Math.max(4, state.coins);
    state.growth = VOCAB.map(function () { return 0; });
    state.quality = VOCAB.map(function () { return true; });
    state.wilted = VOCAB.map(function () { return false; });
    state.charges = blankFlags(); state.bought = blankFlags();
    state.event = null; state.chain = null; state.eventAt = 0; state.task = null;
    state.plan = schedule(state.stage, state.rng);
    state.phase = "choice"; state.token += 1;
    state.notice = "Выбери дело. Монеты можно потратить в лавке; без покупок тоже можно пройти весь сезон.";
  }

  function start(state) {
    if (state.phase !== "intro") return false;
    beginSeason(state); return true;
  }

  function ranked(state, list) {
    return list.slice().sort(function (a, b) {
      var rankA = (state.growth[a.vocab] > 0 ? 2 : 0) + (a.vocab === state.lastVocab ? 4 : 0);
      var rankB = (state.growth[b.vocab] > 0 ? 2 : 0) + (b.vocab === state.lastVocab ? 4 : 0);
      return rankA - rankB || a.id - b.id;
    });
  }

  function remaining(state) { return state.plan.filter(function (job) { return !job.done && !job.final; }); }
  function available(state) {
    if (state.phase !== "choice") return [];
    if (state.chain) return [state.plan[state.chain.ids[state.chain.position]]];
    if (state.event && state.event.selected !== null) return [state.plan[state.event.selected]];
    var list = ranked(state, remaining(state));
    if (!list.length) return state.plan.filter(function (job) { return !job.done && job.final; }).slice(0, 1);
    var picked = [], seen = {};
    list.forEach(function (job) { if (!seen[job.type] && picked.length < 3) { seen[job.type] = true; picked.push(job); } });
    list.forEach(function (job) { if (picked.length < 3 && picked.indexOf(job) === -1) picked.push(job); });
    return picked;
  }

  function selectJob(state, token, id) {
    if (state.phase !== "choice" || state.paused || token !== state.token) return false;
    if (!available(state).some(function (job) { return job.id === id; })) return false;
    var job = state.plan[id];
    var entry = VOCAB[job.vocab];
    state.task = {
      id: id, vocab: job.vocab, type: job.type, correct: field(entry, job.type),
      options: optionsFor(entry, job.type, STAGES[state.stage].options, state.rng),
      strokes: 0, strokeErrors: 0, dirty: false, heard: false, hint: false
    };
    state.phase = "task"; state.token += 1;
    return true;
  }

  function valid(state, token) { return state.phase === "task" && !state.paused && token === state.token; }
  function noteMiss(state) {
    state.task.dirty = true; state.streak = 0; state.stats.mistakes += 1;
    var char = VOCAB[state.task.vocab].char;
    state.misses[char] = (state.misses[char] || 0) + 1;
  }

  function damage(state, vocab, protection) {
    if (state.charges[protection]) {
      state.charges[protection] = false;
      return { correct: false, protected: true, protection: protection };
    }
    state.quality[vocab] = false; state.wilted[vocab] = true;
    return { correct: false, protected: false };
  }

  function finish(state) {
    var task = state.task;
    var clean = !task.dirty;
    state.stats.correct += 1;
    state.streak = clean ? state.streak + 1 : 0;
    if (clean) state.stats.perfect += 1;
    var gained = clean ? 100 + Math.min(state.streak, 5) * 15 : 70;
    if (state.quality[task.vocab] && clean) gained += 20;
    var coins = 2 + (clean ? 1 : 0) + (state.streak > 0 && state.streak % 4 === 0 ? 2 : 0);
    state.score += gained; state.coins += coins;
    state.growth[task.vocab] += 1; state.wilted[task.vocab] = false;
    state.plan[task.id].done = true; state.index += 1; state.lastVocab = task.vocab;
    state.notice = "Урожай растёт. Выбирай, что сделать дальше.";
    if (state.event && state.event.selected === task.id) {
      var event = state.event;
      event.ids.forEach(function (id) {
        if (id !== task.id) {
          var result = damage(state, state.plan[id].vocab, event.kind === "drought" ? "can" : "scarecrow");
          state.wilted[state.plan[id].vocab] = false;
          state.notice = result.protected ? "Защита спасла второе растение и израсходовалась." : "Второе растение потеряло золотое качество, но все его дела доступны.";
        }
      });
      state.event = null;
    }
    if (state.chain) {
      state.chain.clean = state.chain.clean && clean;
      state.chain.position += 1;
      if (state.chain.position === state.chain.ids.length) {
        var bonus = state.chain.premium ? (state.chain.clean ? state.chain.reward : 0) : state.chain.reward;
        state.coins += bonus; coins += bonus; state.stats.contracts += 1;
        state.notice = bonus ? "Поставка завершена! Премия: " + bonus + " монет." : "Поставка завершена. Премия за чистую цепочку не получена, но урожай твой.";
        state.chain = null;
      }
    }
    state.phase = "feedback"; state.token += 1;
    return { correct: true, clean: clean, gained: gained, coins: coins };
  }

  function hear(state, token) {
    if (!valid(state, token) || state.task.type !== "sound") return false;
    state.task.heard = true; return true;
  }
  function answer(state, token, value) {
    if (!valid(state, token) || state.task.type === "write" || (state.task.type === "sound" && !state.task.heard)) return null;
    if (state.task.options.indexOf(value) === -1) return null;
    if (value !== state.task.correct) { noteMiss(state); return damage(state, state.task.vocab, "greenhouse"); }
    return finish(state);
  }
  function stroke(state, token, index) {
    if (!valid(state, token) || state.task.type !== "write" || index !== state.task.strokes || index >= VOCAB[state.task.vocab].strokes) return false;
    state.task.strokes += 1; state.wilted[state.task.vocab] = false; return true;
  }
  function strokeMistake(state, token) {
    if (!valid(state, token) || state.task.type !== "write") return null;
    noteMiss(state); state.task.strokeErrors += 1;
    if (state.task.strokeErrors >= STAGES[state.stage].threshold) {
      state.task.strokeErrors = 0;
      return damage(state, state.task.vocab, "greenhouse");
    }
    return { correct: false, warning: true };
  }
  function completeWriting(state, token) {
    if (!valid(state, token) || state.task.type !== "write" || state.task.strokes !== VOCAB[state.task.vocab].strokes) return null;
    return finish(state);
  }
  function hint(state, token) {
    if (!valid(state, token) || state.task.type !== "write") return false;
    state.task.hint = true; state.task.dirty = true; state.streak = 0; return true;
  }
  function timeout(state, token) {
    if (!valid(state, token)) return null;
    noteMiss(state); state.stats.timeouts += 1;
    state.task.strokes = 0; state.task.strokeErrors = 0; state.task.heard = false;
    state.token += 1;
    return damage(state, state.task.vocab, "greenhouse");
  }

  function makeEvent(state) {
    var jobs = ranked(state, remaining(state));
    if (state.stage === 1) {
      var kind = state.index % 8 === 4 ? "drought" : "pest";
      var preferred = jobs.filter(function (job) { return job.type === (kind === "drought" ? "meaning" : "pinyin"); });
      if (!preferred.length) {
        kind = kind === "drought" ? "pest" : "drought";
        preferred = jobs.filter(function (job) { return job.type === (kind === "drought" ? "meaning" : "pinyin"); });
      }
      var candidates = preferred.concat(jobs.filter(function (job) { return job.type !== "sound" && preferred.indexOf(job) === -1; }));
      var ids = [];
      candidates.forEach(function (job) {
        if (ids.length < 2 && !ids.some(function (id) { return state.plan[id].vocab === job.vocab; })) ids.push(job.id);
      });
      if (ids.length < 2) return false;
      state.event = { kind: kind, ids: ids, selected: null };
    } else state.event = { kind: state.stage === 0 ? "gift" : state.stage === 2 ? "market" : "moon", ids: [], selected: null };
    state.phase = "event"; return true;
  }

  function eventChoices(state) {
    if (state.phase !== "event" || !state.event) return [];
    var kind = state.event.kind;
    if (kind === "gift") return ["rain", "coins"];
    if (kind === "drought" || kind === "pest") return state.event.ids.slice();
    return ["safe", "premium"];
  }

  function resolveEvent(state, token, choice) {
    if (state.phase !== "event" || state.paused || token !== state.token || eventChoices(state).indexOf(choice) === -1) return false;
    var event = state.event;
    if (event.kind === "gift") {
      if (choice === "coins") { state.coins += 4; state.notice = "Сосед подарил 4 монеты. Можно заглянуть в лавку."; }
      else {
        state.quality = VOCAB.map(function () { return true; }); state.wilted = VOCAB.map(function () { return false; });
        state.notice = "Весенний дождь восстановил золотое качество всех грядок.";
      }
      state.event = null;
    } else if (event.kind === "drought" || event.kind === "pest") {
      event.selected = choice;
      state.notice = "Спаси выбранное растение. Второе защитит улучшение, если оно куплено.";
    } else {
      var length = event.kind === "market" ? 2 : 3;
      var jobs = ranked(state, remaining(state));
      var selected = [], used = {};
      jobs.forEach(function (job) { if (selected.length < length && !used[job.type]) { selected.push(job.id); used[job.type] = true; } });
      jobs.forEach(function (job) { if (selected.length < length && selected.indexOf(job.id) === -1) selected.push(job.id); });
      state.chain = { ids: selected, position: 0, clean: true, premium: choice === "premium", reward: choice === "premium" ? length * 4 : length, name: event.kind === "market" ? (choice === "premium" ? "Заказ гурмана" : "Заказ соседа") : (choice === "premium" ? "Лунный караван" : "Тихая поставка") };
      state.event = null;
      state.notice = "Контракт принят. Следующие " + selected.length + " дела — одна поставка.";
    }
    state.phase = "choice"; state.token += 1; return true;
  }

  function advance(state, token) {
    if (state.phase !== "feedback" || state.paused || token !== state.token) return false;
    state.task = null; state.token += 1;
    if (state.index === state.plan.length) {
      state.codes = CODES.slice(0, state.stage + 1); state.chain = null; state.event = null;
      state.phase = state.stage === 3 ? "victory" : "stageclear";
    } else {
      state.phase = "choice";
      if (state.index === state.plan.length - 4) {
        state.chain = { ids: state.plan.filter(function (job) { return job.final; }).map(function (job) { return job.id; }), position: 0, clean: true, premium: false, reward: 4, name: "Финальная поставка" };
        state.notice = "Последняя поставка: четыре разных инструмента. Код ждёт в амбаре.";
      } else if (!state.chain && !state.event && state.index % 4 === 0 && state.eventAt !== state.index) {
        state.eventAt = state.index;
        makeEvent(state);
      }
    }
    return true;
  }

  function nextStage(state) {
    if (state.phase !== "stageclear") return false;
    state.stage += 1; beginSeason(state); return true;
  }
  function buy(state, token, id) {
    if (["choice", "event"].indexOf(state.phase) === -1 || state.paused || token !== state.token) return false;
    var item = UPGRADES.filter(function (upgrade) { return upgrade.id === id; })[0];
    if (!item || state.bought[id] || state.coins < item.price) return false;
    state.coins -= item.price; state.bought[id] = true; state.charges[id] = true; state.token += 1;
    return true;
  }
  function pause(state, value) {
    if (["choice", "event", "task", "feedback"].indexOf(state.phase) === -1) return false;
    state.paused = !!value; return true;
  }
  function seconds(state, calm) {
    if (calm || state.phase !== "task" || !state.task) return 0;
    var stage = STAGES[state.stage];
    return state.task.type !== "write" ? stage.choiceSeconds : stage.strokeSeconds ? Math.min(stage.maxSeconds, Math.max(stage.minSeconds, VOCAB[state.task.vocab].strokes * stage.strokeSeconds)) : 0;
  }
  function serialize(state) {
    var saved = { version: 2 };
    KEYS.forEach(function (key) { saved[key] = state[key]; });
    return JSON.stringify(saved);
  }
  function integer(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }
  function flags(value) { return value && Object.keys(blankFlags()).every(function (key) { return typeof value[key] === "boolean"; }); }
  function vector(value, check) { return Array.isArray(value) && value.length === 9 && value.every(check); }
  function validPool(plan, stage, legacy) {
    if (!Array.isArray(plan) || plan.length !== STAGES[stage].count) return false;
    var types = {}, chars = {};
    if (!plan.every(function (job, i) {
      if (!job || !integer(job.vocab, 0, 8) || TYPES.indexOf(job.type) === -1) return false;
      if (!legacy && (job.id !== i || typeof job.done !== "boolean" || job.final !== (i >= plan.length - 4))) return false;
      types[job.type] = (types[job.type] || 0) + 1; chars[job.vocab] = true; return true;
    })) return false;
    return Object.keys(chars).length === 9 && TYPES.every(function (type) {
      return types[type] === plan.length / 4 && (legacy || plan.slice(-4).filter(function (job) { return job.type === type; }).length === 1);
    });
  }
  function validTask(task, job, stage) {
    if (!task || !job || task.vocab !== job.vocab || task.type !== job.type || task.correct !== field(VOCAB[job.vocab], job.type)) return false;
    if (!["dirty", "hint", "heard"].every(function (key) { return typeof task[key] === "boolean"; })) return false;
    if (!integer(task.strokes, 0, VOCAB[job.vocab].strokes) || !integer(task.strokeErrors, 0, STAGES[stage].threshold - 1)) return false;
    if (!Array.isArray(task.options) || task.options.length !== (task.type === "write" ? 0 : STAGES[stage].options) || new Set(task.options).size !== task.options.length) return false;
    if (task.type !== "write" && (task.options.indexOf(task.correct) === -1 || !task.options.every(function (value) { return VOCAB.some(function (entry) { return field(entry, task.type) === value; }); }))) return false;
    if (task.type === "sound") {
      var readings = task.options.map(function (value) { return VOCAB.filter(function (entry) { return entry.char === value; })[0].pinyin; });
      if (new Set(readings).size !== readings.length) return false;
    }
    return true;
  }
  function validMisses(saved) {
    return saved && typeof saved === "object" && !Array.isArray(saved) && Object.keys(saved).every(function (char) {
      return VOCAB.some(function (entry) { return entry.char === char; }) && integer(saved[char], 1, 10000000);
    });
  }

  function restore(raw, rng) {
    try {
      var s = JSON.parse(raw);
      if (!s || s.version !== 2 || !integer(s.stage, 0, 3) || !validPool(s.plan, s.stage, false)) return null;
      if (["choice", "task", "feedback", "event", "stageclear", "victory"].indexOf(s.phase) === -1) return null;
      if (!integer(s.token, 0, 100000000) || !integer(s.index, 0, s.plan.length) || !integer(s.coins, 0, 10000000) || !integer(s.score, 0, 10000000) || !integer(s.streak, 0, 100000) || !integer(s.lastVocab, -1, 8) || !integer(s.eventAt, 0, s.index) || typeof s.notice !== "string" || s.notice.length > 1000) return null;
      if (!flags(s.charges) || !flags(s.bought) || Object.keys(s.charges).some(function (key) { return s.charges[key] && !s.bought[key]; })) return null;
      if (!vector(s.quality, function (value) { return typeof value === "boolean"; }) || !vector(s.wilted, function (value) { return typeof value === "boolean"; })) return null;
      if (!validMisses(s.misses) || !s.stats || !Object.keys(create().stats).every(function (key) { return integer(s.stats[key], 0, 10000000); })) return null;
      var cleared = s.phase === "stageclear" || s.phase === "victory";
      if ((cleared && s.index !== s.plan.length) || (!cleared && s.index === s.plan.length && s.phase !== "feedback") || (s.phase === "victory" && s.stage !== 3) || (s.phase === "stageclear" && s.stage === 3)) return null;
      if (JSON.stringify(s.codes) !== JSON.stringify(CODES.slice(0, s.stage + (cleared ? 1 : 0)))) return null;
      if (s.plan.filter(function (job) { return job.done; }).length !== s.index) return null;
      var growth = VOCAB.map(function () { return 0; });
      s.plan.forEach(function (job) { if (job.done) growth[job.vocab] += 1; });
      if (JSON.stringify(growth) !== JSON.stringify(s.growth)) return null;
      if ((s.phase === "task" || s.phase === "feedback") !== !!s.task) return null;
      if (s.task) {
        if (!integer(s.task.id, 0, s.plan.length - 1) || !validTask(s.task, s.plan[s.task.id], s.stage)) return null;
        if (s.plan[s.task.id].done !== (s.phase === "feedback") || (s.phase === "feedback" && s.task.type === "write" && s.task.strokes !== VOCAB[s.task.vocab].strokes)) return null;
      }
      if (s.event) {
        var expected = s.stage === 0 ? ["gift"] : s.stage === 1 ? ["drought", "pest"] : s.stage === 2 ? ["market"] : ["moon"];
        if (expected.indexOf(s.event.kind) === -1 || !Array.isArray(s.event.ids) || new Set(s.event.ids).size !== s.event.ids.length) return null;
        var threat = s.event.kind === "drought" || s.event.kind === "pest";
        if (s.event.ids.length !== (threat ? 2 : 0) || !s.event.ids.every(function (id) { return integer(id, 0, s.plan.length - 5) && !s.plan[id].done && s.plan[id].type !== "sound"; })) return null;
        if (s.event.selected !== null && (!threat || s.event.ids.indexOf(s.event.selected) === -1)) return null;
        if ((s.phase === "event") !== (s.event.selected === null)) return null;
      } else if (s.phase === "event") return null;
      if (s.chain) {
        var chain = s.chain;
        if (!Array.isArray(chain.ids) || !integer(chain.ids.length, 2, 4) || new Set(chain.ids).size !== chain.ids.length || !integer(chain.position, 0, chain.ids.length - 1) || typeof chain.clean !== "boolean" || typeof chain.premium !== "boolean" || !integer(chain.reward, 0, 20) || typeof chain.name !== "string" || chain.name.length > 60 || s.event) return null;
        if (!chain.ids.every(function (id, i) { return integer(id, 0, s.plan.length - 1) && s.plan[id].done === (i < chain.position); })) return null;
        if (s.phase === "task" && s.task.id !== chain.ids[chain.position]) return null;
      }
      if (cleared && (s.event || s.chain)) return null;
      var state = create(rng);
      KEYS.forEach(function (key) { state[key] = s[key]; });
      state.token += 1;
      if (state.phase === "task") {
        state.task.strokes = 0; state.task.strokeErrors = 0; state.task.heard = false;
      }
      return state;
    } catch (error) { return null; }
  }

  function legacy(raw) {
    try {
      var s = JSON.parse(raw);
      if (!s || s.version !== 1 || !integer(s.stage, 0, 3) || !validPool(s.plan, s.stage, true)) return null;
      if (["task", "feedback", "stageclear", "victory", "defeat"].indexOf(s.phase) === -1 || !integer(s.index, 0, s.plan.length) || !integer(s.energy, 0, 6) || !integer(s.score, 0, 10000000) || !integer(s.stageScore, 0, s.score) || !integer(s.streak, 0, 100000)) return null;
      var cleared = s.phase === "stageclear" || s.phase === "victory";
      if (cleared !== (s.index === s.plan.length) || (s.phase === "victory" && s.stage !== 3) || (s.phase === "stageclear" && s.stage === 3) || (s.phase === "defeat") !== (s.energy === 0)) return null;
      if (JSON.stringify(s.codes) !== JSON.stringify(CODES.slice(0, s.stage + (cleared ? 1 : 0))) || !validMisses(s.misses)) return null;
      if (!s.stats || !["correct", "perfect", "mistakes", "timeouts", "retries"].every(function (key) { return integer(s.stats[key], 0, 10000000); })) return null;
      var growth = VOCAB.map(function () { return 0; });
      for (var i = 0; i < s.index + (s.phase === "feedback" ? 1 : 0); i++) growth[s.plan[i].vocab] += 1;
      if (JSON.stringify(growth) !== JSON.stringify(s.growth)) return null;
      if (!cleared && !validTask(s.task, s.plan[s.index], s.stage)) return null;
      if (s.phase === "feedback" && s.task.type === "write" && s.task.strokes !== VOCAB[s.task.vocab].strokes) return null;
      return s;
    } catch (error) { return null; }
  }
  function migrate(raw, rng) {
    var old = legacy(raw);
    if (!old) return null;
    var state = create(rng);
    state.stage = old.phase === "stageclear" ? old.stage + 1 : old.stage;
    state.codes = old.codes.slice(); state.score = old.score; state.misses = old.misses;
    ["correct", "perfect", "mistakes", "timeouts"].forEach(function (key) { state.stats[key] = old.stats[key]; });
    beginSeason(state);
    if (old.phase === "victory") {
      state.plan.forEach(function (job) { job.done = true; state.growth[job.vocab] += 1; });
      state.index = state.plan.length; state.phase = "victory";
    }
    return state;
  }

  return {
    VOCAB: VOCAB, TYPES: TYPES, CODES: CODES, STAGES: STAGES, UPGRADES: UPGRADES,
    create: create, start: start, available: available, selectJob: selectJob,
    eventChoices: eventChoices, resolveEvent: resolveEvent, buy: buy,
    answer: answer, hear: hear, stroke: stroke, strokeMistake: strokeMistake,
    completeWriting: completeWriting, hint: hint, timeout: timeout, advance: advance,
    nextStage: nextStage, pause: pause, seconds: seconds, serialize: serialize,
    restore: restore, legacy: legacy, migrate: migrate, schedule: schedule, optionsFor: optionsFor
  };
}));
