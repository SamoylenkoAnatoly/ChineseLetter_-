const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const game = require("./game-core.js");

function ready(stage = 0) {
  const state = game.create();
  game.start(state);
  state.stage = stage;
  state.enemyHp = game.enemies[stage].hp;
  return state;
}

function write(state, mistakes = 0) {
  if (game.enemies[state.stage].gate && state.phase === "ready") {
    game.beginGate(state);
    game.gatePass(state);
  }
  const token = game.beginQuiz(state);
  for (let i = 0; i < mistakes; i++) game.mistake(state, token);
  for (let i = 0; i < 5; i++) game.correct(state, token, i);
  return { token, result: game.attack(state, token) };
}

function strike(state, mistakes = 0) {
  const output = write(state, mistakes);
  game.finishAttack(state);
  return output;
}

test("каждая верная черта немедленно наносит один урон", () => {
  const state = game.create();
  assert.equal(game.beginQuiz(state), null);
  assert.equal(game.start(state), true);
  assert.equal(game.start(state), false);
  const token = game.beginQuiz(state);
  assert.equal(game.attack(state, token), null);
  assert.equal(game.correct(state, token, 1), false);
  assert.deepEqual(game.correct(state, token, 0), { damage: 1 });
  assert.equal(state.enemyHp, 10);
  assert.equal(game.correct(state, token, 0), false);
  for (let i = 1; i < 5; i++) game.correct(state, token, i);
  const output = game.attack(state, token);
  assert.equal(output.clean, true);
  assert.equal(output.bonus, 0);
  assert.equal(output.fizzle, false);
  assert.equal(state.enemyHp, 6);
  assert.equal(state.strokes, 5);
  assert.equal(state.attemptDamage, 5);
  assert.equal(state.shield, 1);
  assert.equal(state.perfect, 1);
});

test("конфигурация противников: HP, пороги, точность, таймер, рассеивание", () => {
  assert.deepEqual(game.enemies.map(enemy => enemy.hp), [11,11,13,14,17]);
  assert.deepEqual(game.enemies.map(enemy => enemy.threshold), [3, 3, 2, 2, 2]);
  assert.deepEqual(game.enemies.map(enemy => enemy.leniency), [1.15, 1.15, 1.15, 1, 1]);
  assert.deepEqual(game.enemies.map(enemy => enemy.fizzle), [false, false, false, true, true]);
  assert.deepEqual(game.enemies.map(enemy => !!enemy.gate), [false, false, false, false, true]);
  assert.deepEqual(game.enemies.map(enemy => game.timerSeconds({ stage: game.enemies.indexOf(enemy), enemyHp: enemy.hp })), [0, 0, 20, 20, 20]);
  assert.equal(game.strokesTotal, 5);
});

test("третье чистое написание подряд усиливает урон и сбрасывает серию", () => {
  const state = ready(4);
  state.enemyHp = 30;
  assert.equal(strike(state).result.bonus, 0);
  assert.equal(strike(state).result.bonus, 0);
  assert.equal(state.streak, 2);
  assert.equal(state.enemyHp, 20);
  assert.equal(strike(state).result.bonus, 5);
  assert.equal(state.streak, 0);
  assert.equal(state.enemyHp, 10);
  assert.equal(state.hp, 6);
  assert.equal(state.perfect, 3);
});

test("ошибка сохраняет верные черты, сбрасывает серию и не даёт щит", () => {
  const state = ready(4);
  state.streak = 2;
  const token = game.beginQuiz(state);
  game.correct(state, token, 0);
  game.mistake(state, token);
  for (let i = 1; i < 5; i++) game.correct(state, token, i);
  assert.equal(state.enemyHp, 12);
  const output = game.attack(state, token);
  assert.equal(output.clean, false);
  assert.equal(output.bonus, 0);
  assert.equal(output.response.damage, 1);
  assert.equal(state.hp, 5);
  assert.equal(state.shield, 0);
  game.finishAttack(state);
  assert.equal(state.dirty, false);
  assert.equal(state.danger, 0);
});

test("шум наносит урон после трёх ошибок, у третьего после двух", () => {
  for (const stage of [0, 2]) {
    const state = ready(stage);
    const token = game.beginQuiz(state);
    const threshold = game.enemies[stage].threshold;
    for (let i = 0; i < threshold - 1; i++) assert.equal(game.mistake(state, token).warning, true);
    assert.equal(state.hp, 6);
    assert.equal(game.mistake(state, token).damage, 1);
    assert.equal(state.hp, 5);
    assert.equal(state.danger, 0);
  }
});

test("щит одноразовый, не складывается и срабатывает до урона", () => {
  const state = ready();
  state.shield = 1;
  const token = game.beginQuiz(state);
  game.mistake(state, token);
  game.mistake(state, token);
  assert.equal(game.mistake(state, token).blocked, true);
  assert.equal(state.shield, 0);
  assert.equal(state.hp, 6);
  game.mistake(state, token);
  game.mistake(state, token);
  assert.equal(game.mistake(state, token).damage, 1);
  assert.equal(state.hp, 5);
});

test("тайм-аут ведёт себя как ошибка и перезапускает написание", () => {
  const state = ready(2);
  assert.equal(game.timeout(state), null);
  const token = game.beginQuiz(state);
  state.streak = 2;
  game.correct(state, token, 0);
  game.correct(state, token, 1);
  assert.equal(state.enemyHp, 11);
  assert.deepEqual(game.timeout(state), { damage: 0, blocked: false, warning: true });
  assert.equal(state.phase, "ready");
  assert.equal(state.strokes, 0);
  assert.equal(state.attemptDamage, 0);
  assert.equal(state.dirty, false);
  assert.equal(state.streak, 0);
  assert.equal(state.mistakes, 1);
  assert.equal(state.timeouts, 1);
  assert.equal(state.enemyHp, 11);
  assert.equal(game.correct(state, token, 2), false);
  assert.equal(game.attack(state, token), null);
  game.beginQuiz(state);
  assert.equal(game.timeout(state).damage, 1);
  assert.equal(state.hp, 5);
  assert.equal(state.danger, 0);
  assert.equal(state.phase, "ready");
});

test("тайм-аут недоступен в defeat и добивает героя по порогу", () => {
  const state = ready(2);
  state.hp = 1;
  game.beginQuiz(state);
  game.timeout(state);
  game.beginQuiz(state);
  assert.equal(game.timeout(state).damage, 1);
  assert.equal(state.phase, "defeat");
  assert.equal(state.hp, 0);
  assert.equal(game.timeout(state), null);
});

test("рассеивание возвращает силы стража, лишает щита и вызывает ответ", () => {
  const state = ready(3);
  state.streak = 2;
  const token = game.beginQuiz(state);
  game.correct(state, token, 0);
  game.mistake(state, token);
  for (let i = 1; i < 5; i++) game.correct(state, token, i);
  assert.equal(state.enemyHp, 9);
  const output = game.attack(state, token);
  assert.equal(output.fizzle, true);
  assert.equal(output.clean, false);
  assert.equal(output.regained, 5);
  assert.equal(output.killed, false);
  assert.equal(state.enemyHp, 14);
  assert.equal(state.streak, 0);
  assert.equal(state.shield, 0);
  assert.equal(output.response.damage, 1);
  assert.equal(state.hp, 5);
  game.finishAttack(state);
  assert.equal(state.phase, "ready");
  const next = game.beginQuiz(state);
  game.correct(state, next, 0);
  game.mistake(state, next);
  for (let i = 1; i < 5; i++) game.correct(state, next, i);
  state.attemptDamage = 40;
  assert.equal(game.attack(state, next).regained, 5);
  assert.equal(state.enemyHp, 14);
});

test("помощь помечает новое написание и рассеивает его у стража", () => {
  const state = ready(3);
  const token = game.beginQuiz(state);
  game.correct(state, token, 0);
  game.correct(state, token, 1);
  assert.equal(state.enemyHp, 12);
  assert.equal(game.help(state), true);
  assert.equal(game.help(state), false);
  assert.equal(state.strokes, 0);
  assert.equal(state.attemptDamage, 0);
  assert.equal(state.dirty, true);
  assert.equal(state.enemyHp, 12);
  assert.equal(game.correct(state, token, 2), false);
  assert.equal(game.attack(state, token), null);
  assert.equal(game.finishHelp(state), true);
  const fresh = game.beginQuiz(state);
  for (let i = 0; i < 5; i++) game.correct(state, fresh, i);
  const output = game.attack(state, fresh);
  assert.equal(output.fizzle, true);
  assert.equal(output.clean, false);
  assert.equal(output.regained, 5);
  assert.equal(state.enemyHp, 12);
});

test("второй отвечает на каждое второе заклинание, страж и хозяин на каждое, третий молчит", () => {
  const second = ready(1);
  assert.equal(strike(second, 1).result.response, null);
  assert.equal(strike(second, 1).result.response.damage, 1);
  const guard = ready(3);
  assert.equal(strike(guard, 1).result.response.damage, 1);
  assert.equal(strike(guard, 1).result.response.damage, 1);
  const quiet = ready(2);
  assert.equal(strike(quiet).result.response, null);
  assert.equal(strike(quiet).result.response, null);
  const boss = ready(4);
  boss.shield = 0;
  assert.equal(strike(boss).result.response.blocked, true);
  boss.shield = 0;
  assert.equal(strike(boss, 1).result.response.damage, 1);
});

test("чистое написание заряжает щит до контратаки", () => {
  const state = ready(3);
  const output = strike(state);
  assert.equal(output.result.response.blocked, true);
  assert.equal(state.hp, 6);
  assert.equal(state.shield, 0);
});

test("победа требует полного иероглифа даже при обессилевшем противнике", () => {
  const state = ready(4);
  state.enemyHp = 2;
  const token = game.beginQuiz(state);
  assert.deepEqual(game.correct(state, token, 0), { damage: 1 });
  assert.equal(state.enemyHp, 1);
  for (let i = 1; i < 5; i++) {
    assert.deepEqual(game.correct(state, token, i), { damage: 1 });
    assert.equal(state.enemyHp, Math.max(0, 1 - i));
  }
  assert.equal(state.phase, "writing");
  assert.equal(state.strokes, 5);
  assert.equal(game.attack(state, token).killed, true);
  assert.equal(state.attacks, 1);
  assert.equal(state.enemyHp, 0);
  assert.equal(game.correct(state, token, 0), false);
  assert.equal(game.finishAttack(state), true);
  assert.equal(state.phase, "victory");
  assert.equal(state.hp, 6);
});

test("лечение ограничено здоровьем, запасом и фазой написания", () => {
  const state = ready();
  assert.equal(game.heal(state), 0);
  game.beginQuiz(state);
  assert.equal(game.heal(state), 0);
  assert.equal(state.potions, 2);
  state.hp = 5;
  assert.equal(game.heal(state), 1);
  assert.equal(state.hp, 6);
  assert.equal(state.potions, 1);
  state.hp = 2;
  assert.equal(game.heal(state), 2);
  assert.equal(state.hp, 4);
  assert.equal(game.heal(state), 0);
});

test("два привала требуют выбора и не превышают максимум здоровья", () => {
  const state = ready(2);
  state.enemyHp = 5;
  state.hp = 5;
  strike(state);
  assert.equal(state.phase, "rest");
  assert.equal(game.next(state), false);
  assert.equal(game.next(state, "heal"), true);
  assert.equal(state.hp, 6);
  assert.equal(state.rests, 1);
  assert.equal(state.stage, 3);
  assert.equal(state.enemyHp, 14);
  state.enemyHp = 5;
  strike(state);
  assert.equal(state.phase, "rest");
  assert.equal(game.next(state, "shield"), true);
  assert.equal(state.shield, 1);
  assert.equal(state.rests, 2);
  assert.equal(state.stage, 4);
  assert.equal(game.next(state, "heal"), false);
});

test("хозяин переходит во вторую фазу при половине сил без урона и сброса", () => {
  const state = ready(4);
  assert.equal(game.bossPhase(state), 1);
  assert.equal(game.timerSeconds(state), 20);
  state.enemyHp = 10;
  assert.equal(game.bossPhase(state), 1);
  const token = game.beginQuiz(state);
  assert.equal(game.timerSeconds(state), 20);
  assert.equal(game.correct(state, token, 0).damage, 1);
  assert.equal(state.enemyHp, 9);
  assert.equal(game.bossPhase(state), 2);
  assert.equal(game.timerSeconds(state), 15);
  assert.equal(state.phase, "writing");
  assert.equal(state.strokes, 1);
  assert.equal(state.hp, 6);
  for (let i = 1; i < 5; i++) game.correct(state, token, i);
  assert.equal(game.attack(state, token).bonus, 0);
  game.finishAttack(state);
  assert.equal(game.timerSeconds(state), 15);
});

test("ворота хозяина блокируют написание до верного ответа", () => {
  const state = ready(0);
  assert.equal(game.beginGate(state), false);
  const boss = ready(4);
  assert.equal(game.beginGate(boss), true);
  assert.equal(boss.phase, "gate");
  assert.equal(game.beginGate(boss), false);
  assert.equal(game.beginQuiz(boss), null);
  assert.equal(game.help(boss), false);
  assert.equal(game.heal(boss), 0);
  assert.equal(game.correct(boss, boss.quiz, 0), false);
  assert.equal(game.timeout(boss), null);
  assert.equal(game.gatePass(boss), true);
  assert.equal(boss.gateOpen, true);
  const token = game.beginQuiz(boss);
  assert.ok(token > 0);
  assert.equal(boss.gateOpen, false);
  assert.equal(game.gatePass(boss), false);
});

test("неверный ответ бьёт героя напрямую и лечит хозяина", () => {
  const state = ready(4);
  state.shield = 1;
  state.streak = 2;
  state.enemyHp = 12;
  game.beginGate(state);
  assert.deepEqual(game.gateMiss(state), { damage: 1, healed: 1, defeated: false });
  assert.equal(state.hp, 5);
  assert.equal(state.shield, 1);
  assert.equal(state.enemyHp, 13);
  assert.equal(state.streak, 0);
  assert.equal(state.gateMisses, 1);
  assert.equal(state.danger, 0);
  assert.equal(state.phase, "gate");
  state.enemyHp = 17;
  assert.equal(game.gateMiss(state).healed, 0);
  assert.equal(state.enemyHp, 17);
  state.hp = 1;
  assert.equal(game.gateMiss(state).defeated, true);
  assert.equal(state.phase, "defeat");
  assert.equal(game.gateMiss(state), null);
  assert.equal(game.gatePass(state), false);
});

test("ворота возвращаются перед каждым написанием и переживают сбой загрузки", () => {
  const state = ready(4);
  game.beginGate(state);
  game.gatePass(state);
  const token = game.beginQuiz(state);
  for (let i = 0; i < 5; i++) game.correct(state, token, i);
  game.attack(state, token);
  game.finishAttack(state);
  assert.equal(state.phase, "ready");
  assert.equal(state.gateOpen, false);
  assert.equal(game.beginGate(state), true);
  game.gatePass(state);
  game.beginQuiz(state);
  assert.equal(game.failLoad(state), true);
  assert.equal(state.phase, "error");
  assert.equal(game.retryLoad(state), true);
  assert.equal(game.beginGate(state), true);
  game.gatePass(state);
  assert.equal(game.beginQuiz(state) > 0, true);
});

test("повторные callbacks и завершения не наносят лишний урон", () => {
  const state = ready();
  const { token } = write(state);
  assert.equal(game.attack(state, token), null);
  assert.equal(game.mistake(state, token), null);
  assert.equal(game.correct(state, token, 2), false);
  assert.equal(state.attacks, 1);
  assert.equal(game.finishAttack(state), true);
  assert.equal(game.finishAttack(state), false);
  game.beginQuiz(state);
  assert.equal(game.attack(state, token), null);
  assert.equal(game.mistake(state, token), null);
  assert.equal(game.timeout(state).warning, true);
});

test("поражение от ошибок блокирует все дальнейшие действия", () => {
  const state = ready();
  state.hp = 1;
  const token = game.beginQuiz(state);
  for (let i = 0; i < 3; i++) game.mistake(state, token);
  assert.equal(state.phase, "defeat");
  assert.equal(state.hp, 0);
  assert.equal(game.correct(state, token, 0), false);
  assert.equal(game.attack(state, token), null);
  assert.equal(game.heal(state), 0);
  assert.equal(game.next(state), false);
});

test("поражение от контратаки не заменяется следующей фазой", () => {
  const state = ready(3);
  state.hp = 1;
  state.shield = 0;
  const { result } = write(state, 1);
  assert.equal(result.fizzle, true);
  assert.equal(result.response.damage, 1);
  assert.equal(state.phase, "defeat");
  assert.equal(game.finishAttack(state), false);
  assert.equal(state.phase, "defeat");
});

test("ошибка загрузки и повтор сохраняют здоровье, этап и запасы", () => {
  const state = ready(2);
  state.hp = 4;
  state.potions = 1;
  state.enemyHp = 2;
  const token = game.beginQuiz(state);
  assert.equal(game.failLoad(state), true);
  assert.equal(game.correct(state, token, 0), false);
  assert.equal(game.retryLoad(state), true);
  assert.equal(game.retryLoad(state), false);
  assert.equal(state.hp, 4);
  assert.equal(state.stage, 2);
  assert.equal(state.potions, 1);
  assert.equal(state.enemyHp, 2);
});

test("приключение завершается только после всех пяти противников", () => {
  const state = ready();
  const stages = [];
  while (state.phase !== "victory") {
    if (state.phase === "ready") strike(state);
    else {
      stages.push(state.stage);
      assert.notEqual(state.phase, "victory");
      game.next(state, "heal");
    }
  }
  assert.deepEqual(stages, [0,1,2,3]);
  assert.equal(state.stage, 4);
  assert.equal(state.enemyHp, 0);
  assert.equal(state.hp, 6);
  assert.equal(state.shield, 1);
  assert.equal(state.attacks, 15);
  assert.equal(state.rests, 2);
  assert.equal(state.perfect, 15);
  assert.equal(state.gateMisses, 0);
  assert.equal(state.gateOpen, false);
  assert.equal(game.beginQuiz(state), null);
  assert.equal(game.next(state), false);
  assert.deepEqual(game.create(), freshState());
});

function freshState() {
  return { phase: "intro", stage: 0, hp: 6, maxHp: 6, enemyHp: 11, shield: 0, streak: 0, danger: 0, potions: 2, turns: 0, attacks: 0, perfect: 0, mistakes: 0, timeouts: 0, strokes: 0, attemptDamage: 0, dirty: false, quiz: 0, rests: 0, gateOpen: false, gateMisses: 0 };
}

test("браузерная экспортная ветка модели работает без Node", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "game-core.js"), "utf8"), context);
  assert.equal(context.ForestBattle.create().phase, "intro");
  assert.equal(context.ForestBattle.enemies.length, 5);
  assert.equal(context.ForestBattle.timerSeconds({ stage: 4, enemyHp: 17 }), 20);
});

test("локальные ресурсы существуют, DOM-id уникальны, код награды не находится в HTML", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const controller = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of controller.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(ids.includes(id), "Missing DOM id: " + id);
  for (const [, source] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (source.startsWith("#") || source.includes("://")) continue;
    assert.ok(fs.existsSync(path.resolve(__dirname, source)), "Missing resource: " + source);
  }
  assert.equal(html.includes("4101"), false);
  assert.match(controller, /state\.phase === "victory"/);
  new vm.Script(controller);
});
