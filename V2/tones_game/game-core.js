(function (root) {
  "use strict";
  var data = typeof module === "object" && module.exports ? require("./data.js") : root.ToneData;
  var words = Object.fromEntries(data.words.map(function (w) { return [w.id, w]; }));

  function rng(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, random) {
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var swap = result[i]; result[i] = result[j]; result[j] = swap;
    }
    return result;
  }

  function decks(seed) {
    var random = rng(seed);
    var early = data.words.slice(0, 16);
    var late = data.words.slice(16);
    var result = [[], [], [], []];
    function add(room, ids, options) {
      result[room].push({ id: room + ":" + result[room].length, words: ids, options: options || [1, 2, 3, 4] });
    }
    [[1, 4], [2, 3]].forEach(function (pair) {
      var order = shuffle(pair, random).concat(shuffle(pair, random));
      order.forEach(function (tone, i) {
        var family = i < 2 ? "ma" : "shi";
        add(0, [family + tone], pair);
      });
    });
    var used = new Set();
    [0, 1].forEach(function () {
      shuffle([1, 2, 3, 4], random).forEach(function (tone) {
        var pool = shuffle(early.filter(function (w) { return w.tone === tone && !used.has(w.id); }), random);
        used.add(pool[0].id);
        add(1, [pool[0].id]);
      });
    });
    var first = shuffle([1, 2, 3, 4], random).concat(shuffle([1, 4], random));
    var second = shuffle([1, 2, 3, 4], random).concat(shuffle([2, 3], random));
    first.forEach(function (tone, i) {
      var a = shuffle(early.filter(function (w) { return w.tone === tone; }), random)[0];
      var b = shuffle(early.filter(function (w) { return w.tone === second[i] && w.id !== a.id; }), random)[0];
      add(2, [a.id, b.id]);
    });
    used = new Set();
    [0, 1].forEach(function () {
      shuffle([1, 2, 3, 4], random).forEach(function (tone) {
        var w = shuffle(late.filter(function (w) { return w.tone === tone && !used.has(w.id); }), random)[0];
        used.add(w.id); add(3, [w.id]);
      });
    });
    return result;
  }

  function create(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("Invalid seed");
    return { version: data.version, seed: seed, events: [], decks: decks(seed), room: 0, phase: "room", cursor: 0, pending: [], step: 0, current: null, repeat: false, feedback: null, firstAnswers: 0, firstCorrect: 0, repeats: 0, mastered: [], completed: [], shield: data.shieldMax, streak: 0, bestStreak: 0 };
  }

  function select(state) {
    var due = state.pending.findIndex(function (p) { return p.due <= state.step; });
    if (state.cursor >= state.decks[state.room].length && state.pending.length) due = 0;
    if (due >= 0) {
      state.current = state.pending.splice(due, 1)[0].question;
      state.repeat = true;
    } else if (state.cursor < state.decks[state.room].length) {
      state.current = state.decks[state.room][state.cursor++];
      state.repeat = false;
    } else {
      state.completed.push(state.room);
      state.current = null;
      state.phase = state.room === 3 ? "reward" : "cleared";
      return;
    }
    state.phase = "question";
    state.feedback = null;
  }

  function apply(state, event) {
    if (!event || typeof event !== "object" || Array.isArray(event)) return false;
    if (event.type === "next" && Object.keys(event).length === 1) {
      if (state.phase === "room" || state.phase === "feedback") {
        select(state);
      } else if (state.phase === "cleared") {
        state.room++;
        state.cursor = 0;
        state.step = 0;
        state.phase = "room";
        state.feedback = null;
        state.shield = data.shieldMax;
        state.streak = 0;
      } else return false;
    } else if (event.type === "answer" && Object.keys(event).length === 2) {
      if (state.phase !== "question" || !Array.isArray(event.tones) || event.tones.length !== state.current.words.length || !event.tones.every(function (t) { return state.current.options.includes(t); })) return false;
      var expected = state.current.words.map(function (id) { return words[id].tone; });
      var correct = expected.every(function (t, i) { return t === event.tones[i]; });
      if (state.repeat) state.repeats++;
      else { state.firstAnswers++; if (correct) state.firstCorrect++; }
      state.step++;
      var shieldBefore = state.shield;
      var damage = 0;
      if (correct) {
        if (!state.mastered.includes(state.current.id)) { state.mastered.push(state.current.id); damage = 1; }
        state.shield = Math.min(data.shieldMax, state.shield + 1);
        state.streak++;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
      } else {
        state.pending.push({ question: state.current, due: state.step + 2 });
        state.shield = Math.max(0, state.shield - 1);
        state.streak = 0;
      }
      state.feedback = { correct: correct, expected: expected, selected: event.tones.slice(), damage: damage, shieldDelta: state.shield - shieldBefore, combo: correct && state.streak % 3 === 0 };
      state.phase = "feedback";
    } else return false;
    return true;
  }

  function dispatch(state, event) {
    var copy = JSON.parse(JSON.stringify(state));
    if (!apply(copy, event)) return state;
    copy.events.push(JSON.parse(JSON.stringify(event)));
    return copy;
  }

  function serialize(state) {
    return JSON.stringify({ version: data.version, seed: state.seed, events: state.events });
  }

  function restore(text) {
    try {
      if (typeof text !== "string" || text.length > 500000) return null;
      var stored = JSON.parse(text);
      if (!stored || stored.version !== data.version || Object.keys(stored).length !== 3 || !Array.isArray(stored.events) || stored.events.length > 5000) return null;
      var state = create(stored.seed);
      for (var i = 0; i < stored.events.length; i++) {
        if (!apply(state, stored.events[i])) return null;
      }
      state.events = stored.events;
      return state;
    } catch (error) { return null; }
  }

  function reward(state) {
    return state.phase === "reward" && state.completed.length === 4 && state.mastered.length === 30 && state.pending.length === 0 ? data.code : null;
  }

  function battle(state) {
    var total = data.rooms[state.room].count;
    var mastered = state.mastered.filter(function (id) { return id.startsWith(state.room + ":"); }).length;
    return { hp: Math.max(0, total - mastered), maxHp: total, shield: state.shield, shieldMax: data.shieldMax, streak: state.streak, bestStreak: state.bestStreak, defeated: mastered === total && state.pending.length === 0 };
  }

  var core = { create: create, dispatch: dispatch, serialize: serialize, restore: restore, reward: reward, battle: battle, words: words };
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.ToneCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this);
