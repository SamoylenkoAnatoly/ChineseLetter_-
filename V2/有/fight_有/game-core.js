(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ForestBattle = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var strokesTotal = 6;

  var enemies = [
    { name: "Зерновой барабан", place: "Мешочный ряд", kind: "drum", hp: 13, threshold: 3, counterEvery: 0, leniency: 1.15, outline: true, visualHints: true, fizzle: false, description: "Гремит мешками и сбивает счёт.", intention: "Не контратакует. Ударит только после 3 ошибок." },
    { name: "Жаба-скопидиха", place: "Жабий прудик", kind: "frog", hp: 13, threshold: 3, counterEvery: 2, leniency: 1.15, outline: true, visualHints: true, fizzle: false, description: "Складывает всё в рот и не отдаёт.", intention: "Отвечает после каждого второго приземившегося заклинания." },
    { name: "Мешочек-обжора", place: "Угол обжор", kind: "panda", hp: 15, threshold: 2, counterEvery: 0, leniency: 1.15, outline: false, visualHints: false, secondsPerStroke: 4, fizzle: false, description: "Съел бы и сундук — если б влез.", intention: "Образец скрыт, на написание 24 секунд. Ударит после 2 ошибок или промедления." },
    { name: "Рой-занос", place: "Ройный проулок", kind: "swarm", hp: 17, threshold: 2, counterEvery: 1, leniency: 1, outline: false, visualHints: false, secondsPerStroke: 4, fizzle: true, description: "Носит товары мимо прилавков.", intention: "Точность строга: нечистое заклинание рассеется и вернёт ему силы. Отвечает на каждое приземившееся заклинание." },
    { name: "Хозяин лавки", place: "Лавка хозяина", kind: "chef", hp: 20, threshold: 2, counterEvery: 1, leniency: 1, outline: false, visualHints: false, secondsPerStroke: 4, phase2SecondsPerStroke: 3, phase2Hp: 10, fizzle: true, gate: true, description: "Всё взвесил, всё посчитал — и тебя посчитает.", intention: "Все испытания разом. При половине сил таймер короче. Отвечает на каждое приземившееся заклинание." }
  ];

  function create() {
    return { phase: "intro", stage: 0, hp: 6, maxHp: 6, enemyHp: enemies[0].hp, shield: 0, streak: 0, danger: 0, potions: 2, turns: 0, attacks: 0, perfect: 0, mistakes: 0, timeouts: 0, strokes: 0, attemptDamage: 0, dirty: false, quiz: 0, rests: 0, gateOpen: false, gateMisses: 0 };
  }

  function bossPhase(state) {
    var enemy = enemies[state.stage];
    return enemy.phase2Hp !== undefined && state.enemyHp <= enemy.phase2Hp ? 2 : 1;
  }

  function timerSeconds(state) {
    var enemy = enemies[state.stage];
    if (!enemy.secondsPerStroke) return 0;
    var per = bossPhase(state) === 2 ? enemy.phase2SecondsPerStroke : enemy.secondsPerStroke;
    return per * strokesTotal;
  }

  function start(state) {
    if (state.phase !== "intro") return false;
    state.phase = "ready";
    return true;
  }

  function beginQuiz(state) {
    if (state.phase !== "ready") return null;
    state.quiz += 1;
    state.strokes = 0;
    state.attemptDamage = 0;
    state.gateOpen = false;
    state.phase = "writing";
    return state.quiz;
  }

  function beginGate(state) {
    var enemy = enemies[state.stage];
    if (state.phase !== "ready" || !enemy.gate || state.gateOpen) return false;
    state.phase = "gate";
    state.quiz += 1;
    state.strokes = 0;
    state.attemptDamage = 0;
    return true;
  }

  function gatePass(state) {
    if (state.phase !== "gate") return false;
    state.phase = "ready";
    state.gateOpen = true;
    return true;
  }

  function gateMiss(state) {
    if (state.phase !== "gate") return null;
    state.hp = Math.max(0, state.hp - 1);
    var healed = Math.min(enemies[state.stage].hp - state.enemyHp, 1);
    state.enemyHp += healed;
    state.streak = 0;
    state.gateMisses += 1;
    var defeated = false;
    if (state.hp === 0) {
      state.phase = "defeat";
      state.quiz += 1;
      defeated = true;
    }
    return { damage: 1, healed: healed, defeated: defeated };
  }

  function valid(state, token) {
    return state.phase === "writing" && token === state.quiz;
  }

  function correct(state, token, stroke) {
    if (!valid(state, token) || stroke !== state.strokes || stroke > strokesTotal - 1) return false;
    state.strokes += 1;
    state.enemyHp = Math.max(0, state.enemyHp - 1);
    state.attemptDamage += 1;
    return { damage: 1 };
  }

  function hurt(state) {
    if (state.shield) {
      state.shield = 0;
      return { blocked: true, damage: 0 };
    }
    state.hp = Math.max(0, state.hp - 1);
    if (state.hp === 0) {
      state.phase = "defeat";
      state.quiz += 1;
    }
    return { blocked: false, damage: 1 };
  }

  function mistake(state, token) {
    if (!valid(state, token)) return null;
    state.dirty = true;
    state.streak = 0;
    state.mistakes += 1;
    state.danger += 1;
    if (state.danger >= enemies[state.stage].threshold) {
      state.danger = 0;
      return hurt(state);
    }
    return { damage: 0, blocked: false, warning: true };
  }

  function timeout(state) {
    if (state.phase !== "writing") return null;
    state.quiz += 1;
    state.mistakes += 1;
    state.timeouts += 1;
    state.streak = 0;
    state.dirty = false;
    state.strokes = 0;
    state.attemptDamage = 0;
    state.danger += 1;
    if (state.danger >= enemies[state.stage].threshold) {
      state.danger = 0;
      var hit = hurt(state);
      if (state.phase !== "defeat") state.phase = "ready";
      return hit;
    }
    state.phase = "ready";
    return { damage: 0, blocked: false, warning: true };
  }

  function attack(state, token) {
    if (!valid(state, token) || state.strokes !== strokesTotal) return null;
    var enemy = enemies[state.stage];
    var clean = !state.dirty;
    var fizzle = enemy.fizzle && !clean;
    state.phase = "resolving";
    state.quiz += 1;
    var bonus = 0;
    var regained = 0;
    var killed = false;
    var response = null;
    if (fizzle) {
      state.streak = 0;
      regained = Math.min(enemy.hp - state.enemyHp, state.attemptDamage);
      state.enemyHp += regained;
    } else {
      state.streak = clean ? state.streak + 1 : 0;
      if (clean) {
        state.perfect += 1;
        state.shield = 1;
        if (state.streak >= 3) {
          bonus = strokesTotal;
          state.streak = 0;
        }
      }
      state.enemyHp = Math.max(0, state.enemyHp - bonus);
      killed = state.enemyHp === 0;
    }
    state.turns += 1;
    state.attacks += 1;
    state.danger = 0;
    if (state.enemyHp > 0) {
      if (fizzle) response = hurt(state);
      else if (enemy.counterEvery && state.turns % enemy.counterEvery === 0) response = hurt(state);
    }
    var result = { clean: clean, fizzle: fizzle, bonus: bonus, regained: regained, killed: killed, response: response };
    if (state.phase !== "defeat") state.phase = "resolving";
    return result;
  }

  function finishAttack(state) {
    if (state.phase !== "resolving") return false;
    state.dirty = false;
    state.strokes = 0;
    state.attemptDamage = 0;
    if (state.enemyHp > 0) state.phase = "ready";
    else if (state.stage === enemies.length - 1) state.phase = "victory";
    else if (state.stage === 2 || state.stage === 3) state.phase = "rest";
    else state.phase = "intermission";
    return true;
  }

  function next(state, choice) {
    if (state.phase !== "intermission" && state.phase !== "rest") return false;
    if (state.phase === "rest") {
      if (choice !== "heal" && choice !== "shield") return false;
      if (choice === "heal") state.hp = Math.min(state.maxHp, state.hp + 3);
      else state.shield = 1;
      state.rests += 1;
    }
    state.stage += 1;
    state.enemyHp = enemies[state.stage].hp;
    state.turns = 0;
    state.danger = 0;
    state.dirty = false;
    state.strokes = 0;
    state.attemptDamage = 0;
    state.gateOpen = false;
    state.phase = "ready";
    return true;
  }

  function heal(state) {
    if (state.phase !== "writing" || !state.potions || state.hp === state.maxHp) return 0;
    var amount = Math.min(2, state.maxHp - state.hp);
    state.hp += amount;
    state.potions -= 1;
    return amount;
  }

  function help(state) {
    if (state.phase !== "writing") return false;
    state.phase = "help";
    state.quiz += 1;
    state.streak = 0;
    state.dirty = true;
    state.strokes = 0;
    state.attemptDamage = 0;
    return true;
  }

  function finishHelp(state) {
    if (state.phase !== "help") return false;
    state.phase = "ready";
    return true;
  }

  function failLoad(state) {
    if (!["ready", "writing", "gate", "help"].includes(state.phase)) return false;
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

  return { enemies: enemies, strokesTotal: strokesTotal, create: create, start: start, beginQuiz: beginQuiz, beginGate: beginGate, gatePass: gatePass, gateMiss: gateMiss, valid: valid, correct: correct, mistake: mistake, timeout: timeout, attack: attack, finishAttack: finishAttack, next: next, heal: heal, help: help, finishHelp: finishHelp, failLoad: failLoad, retryLoad: retryLoad, timerSeconds: timerSeconds, bossPhase: bossPhase };
}));