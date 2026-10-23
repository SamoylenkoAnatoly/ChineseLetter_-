const test = require("node:test");
const assert = require("node:assert/strict");
const game = require("./game-core.js");
const fs = require("node:fs");
const vm = require("node:vm");

test("число черт задания совпадает с офлайн-данными HanziWriter", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve("./char-data.js"), "utf8"), context);
  game.VOCAB.forEach((entry) => {
    const data = context.window.HANZI_DATA[entry.char];
    assert.equal(data.strokes.length, entry.strokes, entry.char);
    assert.equal(data.medians.length, entry.strokes, entry.char);
  });
});

function playTask(state, log) {
  let guard = 0;
  while ((state.phase === "fishing" || state.phase === "grotto") && guard++ < 30) {
    const token = state.quiz;
    if (log) log.push(state.task.type);
    if (state.phase === "fishing") {
      game.hookFish(state, token, state.task.correct);
    } else {
      for (let i = 0; i < state.task.strokeTotal; i++) {
        assert.deepEqual(game.strokeCorrect(state, token, i), { damage: 1 });
      }
      game.completeWriting(state, token);
    }
  }
}

function playBoss(state) {
  const types = [];
  for (let i = 0; i < 10000 && state.phase !== "victory" && state.phase !== "defeat"; i++) {
    if (state.phase === "boss") game.bossTick(state, 0.05, state.boss.motion === "calm");
    else if (state.phase === "grotto") { types.push(state.task.type); playTask(state); }
    else if (state.phase === "bossquiz") { types.push(state.task.type); game.bossAnswer(state, state.quiz, state.task.correct); }
  }
  return types;
}

function playClean(rng) {
  const state = game.create(rng || (() => 0.9));
  game.start(state);
  const typesSeen = [[], [], [], []];
  const optionChecks = [];
  const codes = [];
  let guard = 0;
  while (state.phase !== "victory" && state.phase !== "defeat" && guard++ < 400) {
    if (state.phase === "ready") game.beginTask(state);
    else if (state.phase === "boss") playBoss(state);
    else if (state.phase === "fishing" || state.phase === "grotto") {
      if (state.task.options.length > 1) {
        optionChecks.push({ zone: state.zone, options: state.task.options.slice(), correct: state.task.correct });
      }
      playTask(state, typesSeen[state.zone]);
    } else if (state.phase === "resolving") {
      const r = game.resolveFish(state);
      if (r && r.next === "zoneclear") codes.push(r.code);
    } else if (state.phase === "zoneclear") {
      game.nextZone(state);
    }
  }
  return { state, typesSeen, codes, optionChecks };
}

test("коды зон: 3456, 4444, 5454, 9999", () => {
  assert.deepEqual(game.CODES, ["3456", "4444", "5454", "9999"]);
  assert.equal(game.CODES.join(""), "3456444454549999");
});

test("в каждой зоне встречаются все четыре типа заданий", () => {
  const { typesSeen } = playClean();
  typesSeen.forEach((types, index) => {
    ["write", "meaning", "pinyin", "sound"].forEach((type) => {
      assert.ok(types.includes(type), "зона " + (index + 1) + " без типа " + type);
    });
  });
});

test("сложность растёт: обманки, порог, кислород, скорость, правила письма", () => {
  assert.deepEqual(game.ZONES.map((z) => z.options), [4, 5, 6, 7]);
  assert.deepEqual(game.ZONES.map((z) => z.threshold), [3, 2, 1, 1]);
  assert.deepEqual(game.ZONES.map((z) => z.oxygenChoice), [0, 20, 15, 12]);
  assert.deepEqual(game.ZONES.map((z) => z.oxygenWrite), [0, 0, 3.5, 3]);
  assert.deepEqual(game.ZONES.map((z) => z.outline), [true, true, false, false]);
  assert.deepEqual(game.ZONES.map((z) => z.snap), [false, false, false, true]);
  assert.deepEqual(
    game.ZONES.map((z) => z.speedMin),
    [25, 45, 55, 70]
  );
  assert.deepEqual(
    game.ZONES.map((z) => z.speedMax),
    [40, 65, 80, 100]
  );
  assert.deepEqual(game.ZONES.map((z) => z.fish), [5, 6, 7, 8]);
  assert.equal(game.ZONES[3].finale, false);
});

test("дистракторы уникальны и содержат ровно один верный ответ", () => {
  const { optionChecks } = playClean();
  assert.ok(optionChecks.length >= 16);
  optionChecks.forEach((check) => {
    const zone = game.ZONES[check.zone];
    assert.equal(check.options.length, zone.options);
    assert.equal(new Set(check.options).size, check.options.length);
    assert.ok(check.options.includes(check.correct));
    assert.equal(check.options.filter((v) => v === check.correct).length, 1);
  });
});

test("полная чистая игра: победа, все рыбы, звание, коды в порядке", () => {
  const { state, codes } = playClean();
  assert.equal(state.phase, "victory");
  assert.equal(state.caught, 27);
  assert.equal(state.trophy, true);
  assert.deepEqual(codes, ["3456", "4444", "5454", "9999"]);
  assert.equal(state.lastCode, "9999");
  assert.deepEqual(state.codes, ["3456", "4444", "5454", "9999"]);
  assert.equal(state.worms, game.WORMS_START);
  assert.ok(state.score >= 5000, "очки: " + state.score);
  assert.equal(game.rankFor(state.score), "Золотой рыбак");
  assert.equal(state.stats.mistakes, 0);
});

test("клик по верной рыбе ловит её, по неверной — ошибка и порог", () => {
  const state = game.create();
  game.start(state);
  let task = game.beginTask(state);
  assert.equal(state.phase, "grotto");
  game.resolve;
  state.phase = "ready";
  state.fishIndex = 2;
  state.task = null;
  task = game.beginTask(state);
  assert.equal(state.phase, "fishing");
  const token = state.quiz;
  assert.equal(task.char, "中");
  const wrong = game.hookFish(state, token, task.correct + "?");
  assert.equal(wrong.correct, false);
  assert.equal(wrong.wormLoss, null);
  assert.equal(state.danger, 1);
  assert.equal(state.worms, 6);
  const right = game.hookFish(state, token, task.correct);
  assert.equal(right.caught, true);
  assert.equal(state.phase, "resolving");
  const next = game.resolveFish(state);
  assert.equal(next.next, "task");
  assert.ok(next.task);
});

test("порог ошибок: червяк теряется, задание перевыпускается с чистым счётом", () => {
  const state = game.create();
  game.start(state);
  state.phase = "ready";
  state.fishIndex = 2;
  state.task = null;
  const task = game.beginTask(state);
  let token = state.quiz;
  game.hookFish(state, token, task.correct + "?");
  game.hookFish(state, token, task.correct + "?");
  assert.equal(state.worms, 6);
  const third = game.hookFish(state, token, task.correct + "?");
  assert.equal(third.correct, false);
  assert.ok(third.wormLoss);
  assert.equal(third.wormLoss.damage, 1);
  assert.equal(state.worms, 5);
  assert.ok(third.reissued);
  assert.equal(state.danger, 0);
  assert.equal(state.phase, "fishing");
  assert.notEqual(state.quiz, token);
  token = state.quiz;
  assert.equal(game.hookFish(state, token, state.task.correct).caught, true);
});

test("поражение: черви кончились — рестарт зоны с 4 червями, коды сохранены", () => {
  const state = game.create(() => 0.9);
  game.start(state);
  game.beginTask(state);
  let guard = 0;
  while (state.phase !== "defeat" && guard++ < 300) {
    if (state.phase === "fishing") game.hookFish(state, state.quiz, state.task.correct + "?");
    else if (state.phase === "grotto") game.strokeMistake(state, state.quiz);
    else if (state.phase === "ready") game.beginTask(state);
  }
  assert.equal(state.phase, "defeat");
  assert.equal(state.worms, 0);
  const zoneBefore = state.zone;
  assert.equal(game.restartZone(state), true);
  assert.equal(state.zone, zoneBefore);
  assert.equal(state.worms, game.WORMS_ZONE_RESTART);
  assert.equal(state.fishIndex, 1);
  assert.equal(state.zoneWormHits, 0);
  assert.ok(state.phase === "grotto" || state.phase === "fishing", "задание начато");
  assert.deepEqual(state.codes, []);
  state.phase = "zoneclear";
  state.codes.push("3456");
  state.phase = "defeat";
  game.restartZone(state);
  assert.deepEqual(state.codes, ["3456"]);
});

test("кислород: секунды по зонам и типам, грот по чертам", () => {
  const state = game.create();
  game.start(state);
  function beginAt(zone, fishIndex) {
    state.phase = "ready";
    state.zone = zone;
    state.fishIndex = fishIndex;
    state.task = null;
    return game.beginTask(state);
  }
  let task = beginAt(0, 2);
  assert.equal(task.type, "meaning");
  assert.equal(game.taskSeconds(state), 0);
  task = beginAt(1, 2);
  assert.equal(task.type, "meaning");
  assert.equal(game.taskSeconds(state), 20);
  task = beginAt(2, 1);
  assert.equal(task.type, "write");
  assert.equal(task.strokeTotal, 13);
  assert.equal(game.taskSeconds(state), 40);
  task = beginAt(2, 2);
  assert.equal(task.type, "meaning");
  assert.equal(game.taskSeconds(state), 15);
  task = beginAt(3, 1);
  assert.equal(task.type, "write");
  assert.equal(game.taskSeconds(state), Math.min(40, game.ZONES[3].oxygenWrite * task.strokeTotal));
  task = beginAt(3, 8);
   assert.equal(task.special, "");
  assert.deepEqual(task.phases, ["sound"]);
  assert.equal(task.type, "sound");
  assert.equal(game.taskSeconds(state), 12);
});

test("кислород кончился: червяк долой, задание перевыпускается", () => {
  const state = game.create();
  game.start(state);
  state.phase = "ready";
  state.fishIndex = 2;
  state.task = null;
  game.beginTask(state);
  const token = state.quiz;
  const out = game.oxygenOut(state);
  assert.ok(out.wormLoss);
  assert.equal(state.worms, 5);
  assert.ok(out.reissued);
  assert.equal(state.stats.timeouts, 1);
  assert.equal(state.phase, "fishing");
  assert.notEqual(state.quiz, token);
});

test("грот: верные черты пишутся по порядку, чистый ввод ловит", () => {
  const state = game.create();
  game.start(state);
  const task = game.beginTask(state);
  assert.equal(state.phase, "grotto");
  assert.equal(task.char, "术");
  assert.equal(task.strokeTotal, 5);
  const token = state.quiz;
  assert.equal(game.strokeCorrect(state, token, 1), false);
  assert.equal(game.strokeCorrect(state, token + 1), null);
  for (let i = 0; i < 5; i++) game.strokeCorrect(state, token, i);
  const caught = game.completeWriting(state, token);
  assert.equal(caught.caught, true);
  assert.ok(caught.gained >= game.SCORE.fish);
  assert.equal(state.stats.perfect, 1);
  assert.equal(state.streak, 1);
  assert.equal(game.completeWriting(state, token), null);
});

test("большой улов: каждый третий чистый лов возвращает червяка", () => {
  const state = game.create(() => 0.9);
  game.start(state);
  function grabClean() {
    let task = state.task || game.beginTask(state);
    const token = state.quiz;
    for (let i = 0; i < task.strokeTotal; i++) game.strokeCorrect(state, token, i);
    return game.completeWriting(state, token);
  }
  function fish(n) {
    state.phase = "ready";
    state.fishIndex = n;
    state.task = null;
  }
  fish(1);
  state.phase = "ready";
  game.beginTask(state);
  const r1 = grabClean();
  game.resolveFish(state);
  fish(5);
  state.phase = "ready";
  game.beginTask(state);
  state.worms = 3;
  const r2 = grabClean();
  game.resolveFish(state);
  game.nextZone(state);
  const r3 = grabClean();
  assert.equal(r1.bigCatch, false);
  assert.equal(r2.bigCatch, false);
  assert.equal(r3.bigCatch, true);
  assert.equal(r3.baitBack, 1);
  assert.equal(state.worms, 4);
  assert.ok(r2.gained > r1.gained);
});

test("обрыв лески: нечистое письмо в золотой реке стоит червяка", () => {
  const state = game.create();
  game.start(state);
  state.phase = "ready";
  state.zone = 3;
  state.fishIndex = 1;
  state.task = null;
  const task = game.beginTask(state);
  assert.equal(task.type, "write");
  const token = state.quiz;
  const miss = game.strokeMistake(state, token);
  assert.ok(miss.wormLoss);
  assert.equal(state.worms, 5);
  assert.equal(state.phase, "grotto");
  assert.equal(state.task.char, task.char);
  for (let i = 0; i < task.strokeTotal; i++) game.strokeCorrect(state, token, i);
  const snap = game.completeWriting(state, token);
  assert.equal(snap.snap, true);
  assert.ok(snap.wormLoss);
  assert.equal(state.worms, 4);
  assert.ok(snap.reissued);
  assert.equal(state.phase, "grotto");
  assert.equal(snap.reissued.char, task.char);
});

test("обрыв последней лески завершает реку поражением", () => {
  const state = game.create(() => 0.9);
  game.start(state);
  state.zone = 3;
  state.phase = "ready";
  state.worms = 2;
  const task = game.beginTask(state);
  const token = state.quiz;
  game.strokeMistake(state, token);
  assert.equal(state.worms, 1);
  for (let i = 0; i < task.strokeTotal; i++) game.strokeCorrect(state, token, i);
  const result = game.completeWriting(state, token);
  assert.deepEqual(result, { snap: true, defeated: true });
  assert.equal(state.phase, "defeat");
  assert.equal(state.worms, 0);
  assert.equal(game.completeWriting(state, token), null);
});

test("чистое письмо в реке переходит к следующему заданию", () => {
  const state = game.create(() => 0.9);
  game.start(state);
  state.zone = 3;
  state.phase = "ready";
  const task = game.beginTask(state);
  const token = state.quiz;
  for (let i = 0; i < task.strokeTotal; i++) game.strokeCorrect(state, token, i);
  assert.equal(game.completeWriting(state, token).caught, true);
  const next = game.resolveFish(state);
  assert.equal(next.next, "task");
  assert.equal(state.fishIndex, 2);
  assert.equal(state.phase, "fishing");
});

function bossState() {
  const state = game.create(() => 0.9);
  state.zone = 3;
  state.phase = "zoneclear";
  state.codes = game.CODES.slice();
  game.nextZone(state);
  return state;
}

test("четвёртая зона выдаёт 9999, но победа только после пятого этапа", () => {
  const state = game.create(() => 0.9);
  state.zone = 3;
  state.fishIndex = 8;
  state.phase = "ready";
  game.beginTask(state);
  assert.equal(state.task.type, "sound");
  playTask(state);
  const result = game.resolveFish(state);
  assert.equal(result.next, "zoneclear");
  assert.equal(result.code, "9999");
  assert.equal(state.phase, "zoneclear");
  game.nextZone(state);
  assert.equal(state.zone, 4);
  assert.equal(state.phase, "boss");
});

test("босс: четыре задания, 20–30 секунд механики и единственная награда", () => {
  const state = bossState();
  const score = state.score;
  assert.deepEqual(playBoss(state), game.BOSS_TYPES);
  assert.equal(state.phase, "victory");
  assert.ok(state.boss.elapsed >= 20 && state.boss.elapsed <= 30, String(state.boss.elapsed));
  assert.equal(state.score - score, game.BOSS_REWARD);
  assert.equal(state.caught, 1);
  assert.equal(state.trophy, true);
  assert.deepEqual(state.codes, game.CODES);
  assert.equal(game.bossTick(state, 0.05, true), null);
  assert.equal(state.caught, 1);
});

test("босс: отпускание, предупреждение, рывок и обрыв сохраняют контрольные точки", () => {
  const state = bossState();
  game.bossTick(state, 0.05, true);
  assert.ok(state.boss.progress > 0);
  const tension = state.boss.tension;
  game.bossTick(state, 0.05, false);
  assert.ok(state.boss.tension < tension);
  state.boss.remaining = 0;
  assert.equal(game.bossTick(state, 0.05, false).motion, "warning");
  state.boss.remaining = 0;
  assert.equal(game.bossTick(state, 0.05, false).motion, "surge");
  state.boss.checkpoint = 2;
  state.boss.progress = 55;
  state.boss.tension = 99;
  const result = game.bossTick(state, 0.05, true);
  assert.equal(result.snap, true);
  assert.equal(state.worms, 5);
  assert.equal(state.boss.checkpoint, 2);
  assert.equal(state.boss.progress, 40);
});

test("босс: каждый участок ждёт первого удержания, отпускание не останавливает цикл", () => {
  const state = bossState();
  for (let checkpoint = 0; checkpoint <= 4; checkpoint++) {
    const before = JSON.stringify(state.boss);
    for (let i = 0; i < 100; i++) game.bossTick(state, 0.05, false);
    assert.equal(JSON.stringify(state.boss), before);
    assert.equal(state.boss.armed, false);
    game.bossTick(state, 0.05, true);
    assert.equal(state.boss.armed, true);
    assert.ok(state.boss.remaining < game.BOSS_RHYTHM.calmFirst);
    const remaining = state.boss.remaining;
    game.bossTick(state, 0.05, false);
    assert.ok(state.boss.remaining < remaining);
    if (checkpoint < 4) {
      while (state.phase === "boss") game.bossTick(state, 0.05, state.boss.motion === "calm");
      if (state.phase === "grotto") playTask(state);
      else game.bossAnswer(state, state.quiz, state.task.correct);
    }
  }
});

test("босс: быстрые реакции лески и один рывок на каждом участке", () => {
  const state = bossState();
  game.bossTick(state, 0.05, true);
  assert.ok(Math.abs(state.boss.progress - 0.325) < 0.00001);
  state.boss.tension = 50;
  const progress = state.boss.progress;
  game.bossTick(state, 0.05, false);
  assert.equal(state.boss.progress, progress);
  assert.equal(state.boss.tension, 46.25);
  state.boss.motion = "warning";
  game.bossTick(state, 0.05, true);
  assert.equal(state.boss.progress, progress);
  assert.equal(state.boss.tension, 48);
  state.boss.motion = "surge";
  game.bossTick(state, 0.05, true);
  assert.equal(state.boss.progress, progress);
  assert.equal(state.boss.tension, 51.25);
  const clean = bossState();
  const surges = [];
  for (let i = 0; i < 2000 && clean.phase !== "victory"; i++) {
    if (clean.phase === "boss") {
      const result = game.bossTick(clean, 0.05, clean.boss.motion === "calm");
      if (result && result.motion === "surge") surges.push(clean.boss.checkpoint);
    } else if (clean.phase === "grotto") playTask(clean);
    else game.bossAnswer(clean, clean.quiz, clean.task.correct);
  }
  assert.deepEqual(surges, [0, 1, 2, 3, 4]);
  assert.equal(clean.worms, game.WORMS_START);
  assert.equal(clean.phase, "victory");
});

test("босс: непрерывное удержание обрывает леску, повторная попытка ждёт нажатия", () => {
  const state = bossState();
  let result;
  for (let i = 0; i < 100 && state.worms === game.WORMS_START; i++) result = game.bossTick(state, 0.05, true);
  assert.equal(result.snap, true);
  assert.equal(state.worms, game.WORMS_START - 1);
  assert.equal(state.boss.progress, 0);
  assert.equal(state.boss.armed, false);
  const before = JSON.stringify(state.boss);
  for (let i = 0; i < 100; i++) game.bossTick(state, 0.05, false);
  assert.equal(JSON.stringify(state.boss), before);
  game.bossTick(state, 0.05, true);
  assert.equal(state.boss.armed, true);
});

test("босс: пауза заданий, ошибки письма без второго штрафа и устаревшие ответы", () => {
  const state = bossState();
  state.boss.progress = 20;
  game.bossTick(state, 0.05, true);
  const token = state.quiz;
  const elapsed = state.boss.elapsed;
  assert.equal(game.taskSeconds(state), 0);
  assert.equal(game.bossTick(state, 0.05, true), null);
  assert.equal(state.boss.elapsed, elapsed);
  assert.equal(game.strokeMistake(state, token).wormLoss.damage, 1);
  const worms = state.worms;
  playTask(state);
  assert.equal(state.worms, worms);
  assert.equal(state.boss.checkpoint, 1);
  assert.equal(game.completeWriting(state, token), null);
  state.boss.progress = 40;
  game.bossTick(state, 0.05, true);
  assert.equal(game.bossAnswer(state, token, state.task.correct), null);
  const current = state.quiz;
  const task = state.task;
  assert.equal(game.bossAnswer(state, current, "wrong").wormLoss.damage, 1);
  assert.equal(state.task, task);
  assert.equal(state.phase, "bossquiz");
  assert.equal(game.bossAnswer(state, current, task.correct).bossResume, true);
});

test("босс: последний обрыв, рестарт с четырьмя червями и сохранёнными кодами", () => {
  const state = bossState();
  state.worms = 1;
  state.boss.armed = true;
  state.boss.motion = "surge";
  state.boss.tension = 99;
  assert.equal(game.bossTick(state, 0.05, true).defeated, true);
  assert.equal(state.phase, "defeat");
  game.restartZone(state);
  assert.equal(state.zone, 4);
  assert.equal(state.phase, "boss");
  assert.equal(state.worms, 4);
  assert.equal(state.boss.progress, 0);
  assert.deepEqual(state.codes, game.CODES);
  assert.equal(game.bossTick(state, NaN, true), null);
  assert.equal(game.bossTick(state, -1, true), null);
});

test("бонус зоны за погружение без потерь", () => {
  const state = game.create(() => 0.9);
  game.start(state);
  game.beginTask(state);
  let guard = 0;
  let clear = null;
  while (!clear && guard++ < 100) {
    if (state.phase === "fishing" || state.phase === "grotto") playTask(state);
    else if (state.phase === "resolving") {
      const r = game.resolveFish(state);
      if (r && r.next === "zoneclear") clear = r;
    }
  }
  assert.ok(clear);
  assert.equal(clear.zoneBonus, true);
  assert.equal(clear.code, "3456");
  assert.equal(game.nextZone(state), true);
  assert.equal(state.zone, 1);
  assert.equal(state.phase === "fishing" || state.phase === "grotto", true);
});

test("пиксельные рыбы: перенос подписей и захват всей формы", () => {
  const context = { window: {}, Math };
  vm.runInNewContext(fs.readFileSync(require.resolve("./engine.js"), "utf8"), context);
  const engine = context.window.SeaEngine;
  const ctx = { measureText: (text) => ({ width: text.length * 8 }) };
  const label = "Обязательно, непременно";
  const fish = engine.makeLayout(() => 0.4, ctx, [label], label, game.ZONES[0], { w: 960, h: 640 }, 0);
  assert.equal(fish[0].lines.length, 2);
  assert.equal(fish[0].lines.join(" "), label);
  assert.equal(engine.nearest(fish, fish[0].x + fish[0].w * 0.45, fish[0].y, 58), fish[0]);
  assert.equal(engine.PALETTES.length, 5);
});

test("знак с ошибкой возвращается на крючок", () => {
  const state = game.create(() => 0.3);
  game.start(state);
  state.mastery = { "心": true };
  state.lastChar = "术";
  state.phase = "ready";
  const task = game.beginTask(state);
  assert.equal(task.char, "心");
});
