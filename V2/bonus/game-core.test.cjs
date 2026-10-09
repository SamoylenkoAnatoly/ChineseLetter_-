const test = require("node:test");
const assert = require("node:assert/strict");
const game = require("./game-core.js");

const noRand = () => 1;
const q = (values) => () => (values.length ? values.shift() : 1);

function ready(stage = 0, rng = noRand) {
  const state = game.create(rng);
  game.start(state);
  state.stage = stage;
  return state;
}

function begin(state) {
  const task = game.beginTask(state);
  return { task, token: state.quiz };
}

function wrongValue(task) {
  return task.options.find(value => value !== task.correct);
}

function fightPhase(state, mistakes = 0) {
  const token = state.quiz;
  for (let i = 0; i < mistakes; i++) {
    if (state.phase === "writing") game.strokeMistake(state, token);
    else game.answerChoice(state, token, wrongValue(state.task));
  }
  if (state.phase === "writing") {
    for (let i = 0; i < state.task.strokeTotal; i++) game.strokeCorrect(state, token, i);
    return game.completeWriting(state, token);
  }
  return game.answerChoice(state, token, state.task.correct);
}

function repel(state, mistakes = 0) {
  assert.equal(state.phase, "ready");
  begin(state);
  let first = true;
  let result = null;
  let guard = 0;
  while ((state.phase === "writing" || state.phase === "choice") && guard++ < 10) {
    result = fightPhase(state, first ? mistakes : 0);
    first = false;
  }
  if (state.phase === "resolving") game.finishMonster(state);
  return result;
}

test("конфигурация волн, спецмонстров, маны и очков", () => {
  assert.deepEqual(game.STAGES.map(s => s.monsters), [5, 6, 7, 8]);
  assert.deepEqual(game.STAGES.map(s => s.threshold), [2, 2, 1, 1]);
  assert.deepEqual(game.STAGES.map(s => s.options), [3, 4, 4, 4]);
  assert.deepEqual(game.STAGES.map(s => s.secondsPerStroke), [0, 0, 3, 4]);
  assert.deepEqual(game.STAGES.map(s => s.choiceSeconds), [0, 15, 10, 8]);
  assert.equal(game.STAGES[3].phase2SecondsPerStroke, 2);
  assert.equal(game.STAGES[3].rage, 4);
  assert.deepEqual(game.STAGES[0].specials, {});
  assert.deepEqual(game.STAGES[1].specials, { 2: "elite" });
  assert.deepEqual(game.STAGES[2].specials, { 2: "ram", 3: "elite", 6: "herald" });
  assert.deepEqual(game.STAGES[3].specials, { 2: "shaman", 3: "elite", 5: "armor", 7: "ram", 8: "final" });
  assert.deepEqual(game.CODES, ["3771", "4567", "6656", "8777"]);
  assert.deepEqual(game.TYPES, ["write", "meaning", "pinyin", "sound", "tone"]);
  assert.deepEqual(game.SCORE, { monster: 100, clean: 50, repair: 30, waveBonus: 150, finalMonster: 200 });
  assert.deepEqual(game.RANKS.map(r => r.min), [7000, 5000, 3000, 0]);
  assert.equal(game.MANA_MAX, 10);
  assert.equal(game.MANA_GAIN, 2);
  assert.equal(game.VOLLEY_COST, 4);
  assert.equal(game.SALVO_COST, 3);
  assert.equal(game.SALVO_SECONDS, 5);
});

test("множитель комбо растёт с серией чистых заданий", () => {
  assert.equal(game.multiplierFor(0), 1);
  assert.equal(game.multiplierFor(1), 1);
  assert.equal(game.multiplierFor(2), 1.5);
  assert.equal(game.multiplierFor(3), 1.5);
  assert.equal(game.multiplierFor(4), 2);
  assert.equal(game.multiplierFor(11), 2);
});

test("каждая волна покрывает все пять типов заданий", () => {
  game.STAGES.forEach((stage, index) => {
    const state = ready(index);
    const seen = [];
    for (let i = 0; i < game.effectiveMonsters(state); i++) {
      const { task } = begin(state);
      seen.push(...task.covers);
      let guard = 0;
      while ((state.phase === "writing" || state.phase === "choice") && guard++ < 10) fightPhase(state, 0);
      game.finishMonster(state);
    }
    game.TYPES.forEach(type => assert.ok(seen.includes(type), "волна " + (index + 1) + " без " + type));
    if (index === 0) assert.deepEqual(seen, game.TYPES);
    assert.equal(state.phase, index === 3 ? "victory" : "stageclear");
  });
});

test("таран и глашатай переопределяют тип задания", () => {
  const state = ready(2);
  repel(state);
  const ram = begin(state);
  assert.equal(ram.task.special, "ram");
  assert.equal(ram.task.type, "write");
  let guard = 0;
  while ((state.phase === "writing" || state.phase === "choice") && guard++ < 10) fightPhase(state, 0);
  game.finishMonster(state);
  repel(state);
  repel(state);
  repel(state);
  const herald = begin(state);
  assert.equal(herald.task.special, "herald");
  assert.equal(herald.task.type, "sound");
});

test("элита: две фазы одного знака, ошибки сквозные", () => {
  const state = ready(1);
  repel(state);
  state.shield = 0;
  const elite = begin(state);
  assert.equal(elite.task.special, "elite");
  assert.equal(elite.task.type, "meaning");
  assert.deepEqual(elite.task.covers, ["meaning", "pinyin"]);
  assert.equal(elite.task.char, "木");
  assert.equal(state.monsterMaxHp, 2);
  const step = game.answerChoice(state, elite.token, elite.task.correct);
  assert.equal(step.advanced, true);
  assert.equal(step.killed, false);
  assert.equal(state.task.type, "pinyin");
  assert.equal(state.task.char, "木");
  assert.equal(state.monsterHp, 1);
  assert.equal(state.monsterIndex, 2);
  const wrong = wrongValue(state.task);
  assert.equal(game.answerChoice(state, state.quiz, wrong).response.damage, 0);
  const miss = game.answerChoice(state, state.quiz, wrong);
  assert.equal(miss.response.damage, 1);
  assert.equal(state.wall, 9);
  const finish = game.answerChoice(state, state.quiz, state.task.correct);
  assert.equal(finish.killed, true);
  game.finishMonster(state);
  assert.equal(state.monsterIndex, 3);
  assert.equal(state.stats.perfect, 1);
});

test("финал: три испытания, двойной удар, двойная награда", () => {
  const state = ready(3);
  state.monsterIndex = 8;
  state.monsterHp = null;
  const final = begin(state);
  assert.equal(final.task.special, "final");
  assert.deepEqual(final.task.covers, ["write", "meaning", "tone"]);
  assert.equal(final.task.char, "日");
  assert.equal(state.monsterMaxHp, 6);
  assert.equal(game.taskSeconds(state), 8);
  for (let i = 0; i < final.task.strokeTotal; i++) game.strokeCorrect(state, final.token, i);
  let step = game.completeWriting(state, final.token);
  assert.equal(step.advanced, true);
  assert.equal(state.task.type, "meaning");
  assert.equal(state.monsterHp, 2);
  step = game.answerChoice(state, state.quiz, state.task.correct);
  assert.equal(step.advanced, true);
  assert.equal(state.task.type, "tone");
  assert.equal(state.monsterHp, 1);
  step = game.answerChoice(state, state.quiz, state.task.correct);
  assert.equal(step.killed, true);
  assert.equal(step.gained, 250);
  assert.equal(state.phase, "resolving");
  game.finishMonster(state);
  assert.equal(state.phase, "victory");
});

test("финал: ошибка бьёт по стене двойным, щит гасит обе", () => {
  const state = ready(3);
  state.monsterIndex = 8;
  state.monsterHp = null;
  begin(state);
  const hit = game.strokeMistake(state, state.quiz);
  assert.equal(hit.damage, 2);
  assert.equal(state.wall, 8);

  const shielded = ready(3);
  shielded.monsterIndex = 8;
  shielded.monsterHp = null;
  shielded.shield = 1;
  begin(shielded);
  const blocked = game.strokeMistake(shielded, shielded.quiz);
  assert.equal(blocked.blocked, true);
  assert.equal(shielded.wall, 10);
  assert.equal(shielded.shield, 0);
});

test("комбо-множитель в очках и латание без сброса серии", () => {
  const state = ready(0);
  repel(state, 2);
  assert.equal(state.wall, 9);
  repel(state);
  repel(state);
  assert.equal(state.score, 100 + 150 + 225);
  repel(state);
  assert.equal(state.stats.repairs, 1);
  assert.equal(state.wall, 10);
  assert.equal(state.streak, 3);
  repel(state);
  assert.equal(state.streak, 4);
  assert.equal(state.stats.repairs, 1);
  assert.equal(state.score, 100 + 150 + 225 + 225 + 30 + 300);
});

test("чистая игра — 8300 очков и золотое звание", () => {
  const state = ready(0);
  const totals = [1350, 3300, 5550, 8300];
  for (let wave = 0; wave < 4; wave++) {
    for (let i = 0; i < game.effectiveMonsters(state); i++) repel(state);
    if (wave < 3) {
      assert.equal(state.phase, "stageclear");
      game.nextStage(state);
    } else {
      assert.equal(state.phase, "victory");
    }
    assert.equal(state.score, totals[wave], "итог волны " + (wave + 1));
  }
  assert.equal(game.rankFor(state.score), "Золотой владыка стен");
  assert.equal(game.rankFor(7000), "Золотой владыка стен");
  assert.equal(game.rankFor(5000), "Серебряный рыцарь");
  assert.equal(game.rankFor(3000), "Бронзовый страж");
  assert.equal(game.rankFor(2999), "Ополченец");
});

test("мана растёт за чистоту и тратится на способности", () => {
  const state = ready(0);
  repel(state);
  repel(state);
  assert.equal(state.mana, 4);
  const volleyState = ready(1);
  repel(volleyState, 2);
  repel(volleyState);
  assert.equal(volleyState.mana, 2);
  repel(volleyState);
  assert.equal(volleyState.mana, 4);
  volleyState.monsterIndex = 5;
  volleyState.monsterHp = null;
  begin(volleyState);
  assert.equal(volleyState.task.type, "tone");
  assert.equal(game.castVolley(volleyState), true);
  assert.equal(volleyState.mana, 0);
  assert.equal(volleyState.task.volley, true);
  volleyState.mana = 10;
  assert.equal(game.castVolley(volleyState), false);
  assert.equal(volleyState.mana, 10);
});

test("залп добавляет секунды только при активном таймере", () => {
  const calm = ready(0);
  begin(calm);
  calm.mana = 10;
  assert.equal(game.castSalvo(calm), null);
  const timed = ready(2);
  begin(timed);
  timed.mana = 2;
  assert.equal(game.castSalvo(timed), null);
  timed.mana = 5;
  assert.deepEqual(game.castSalvo(timed), { seconds: 5 });
  assert.equal(timed.mana, 2);
});

test("адаптивное повторение подменяет знак и снимается чистой победой", () => {
  const state = game.create(q([1, 0.1, 0]));
  game.start(state);
  begin(state);
  assert.equal(state.task.char, "人");
  game.strokeMistake(state, state.quiz);
  game.strokeCorrect(state, state.quiz, 0);
  game.strokeCorrect(state, state.quiz, 1);
  game.completeWriting(state, state.quiz);
  game.finishMonster(state);
  assert.deepEqual(Object.keys(state.mastery), ["人"]);
  assert.equal(state.charMisses["人"], 1);
  repel(state);
  assert.equal(state.task.char, "口");
  const adaptive = begin(state);
  assert.equal(adaptive.task.type, "pinyin");
  assert.equal(adaptive.task.char, "人");
  fightPhase(state, 0);
  assert.equal(state.phase, "resolving");
  game.finishMonster(state);
  assert.deepEqual(state.mastery, {});
  assert.equal(state.charMisses["人"], 1);
});

test("события волн: туман, ливень, дезертиры и рать", () => {
  const throughWave1 = (rngValues) => {
    const state = game.create(q(rngValues));
    game.start(state);
    for (let i = 0; i < 5; i++) repel(state);
    assert.equal(state.phase, "stageclear");
    assert.equal(game.nextStage(state), true);
    return state;
  };

  const fog = throughWave1([0.1]);
  assert.equal(fog.wave.event, "fog");
  assert.equal(fog.wave.outline, false);
  assert.equal(game.effectiveMonsters(fog), 6);

  const rain = throughWave1([0.3]);
  assert.equal(rain.wave.event, "rain");
  assert.equal(rain.wave.timerScale, 0.75);

  const desert = throughWave1([0.5]);
  assert.equal(desert.wave.event, "desert");
  assert.equal(game.effectiveMonsters(desert), 5);

  const horde = throughWave1([0.7]);
  assert.equal(horde.wave.event, "horde");
  assert.equal(game.effectiveMonsters(horde), 7);
  assert.equal(horde.wave.scoreScale, 1.25);

  const none = throughWave1([0.9]);
  assert.equal(none.wave.event, "");
  assert.equal(game.effectiveMonsters(none), 6);
});

test("ливень укорачивает таймеры выбора, рать усиливает очки", () => {
  const rain = ready(2);
  rain.wave.timerScale = 0.75;
  repel(rain);
  repel(rain);
  const elite = begin(rain);
  assert.equal(elite.task.type, "meaning");
  assert.equal(game.taskSeconds(rain), Math.ceil(10 * 0.75));

  const horde = ready(3);
  horde.wave.scoreScale = 1.25;
  horde.wave.monstersDelta = 1;
  assert.equal(game.effectiveMonsters(horde), 9);
  const gained = repel(horde);
  assert.equal(gained.gained, Math.round(150 * 1.25));
});

test("таймеры: память, ярость, шаман и финал", () => {
  const calm = ready(0);
  begin(calm);
  assert.equal(game.taskSeconds(calm), 0);
  const wave2 = ready(1);
  for (let i = 0; i < 4; i++) repel(wave2);
  begin(wave2);
  assert.equal(wave2.task.type, "tone");
  assert.equal(game.taskSeconds(wave2), 15);
  const memory = ready(2);
  begin(memory);
  assert.equal(game.taskSeconds(memory), 15);
  const shaman = ready(3);
  shaman.monsterIndex = 2;
  shaman.monsterHp = null;
  begin(shaman);
  assert.equal(shaman.task.special, "shaman");
  assert.equal(game.taskSeconds(shaman), 4);
  const rage = ready(3);
  rage.monsterIndex = 7;
  rage.monsterHp = null;
  begin(rage);
  assert.equal(game.bossPhase(rage), 2);
  assert.equal(game.bossPhase({ stage: 3, monsterIndex: 3 }), 1);
  assert.equal(game.taskSeconds(rage), 6);
  const final = ready(3);
  final.monsterIndex = 8;
  final.monsterHp = null;
  begin(final);
  assert.equal(game.bossPhase(final), 2);
  assert.equal(game.taskSeconds(final), 8);
});

test("таймаут письма перезапускает задание, таймаут выбора продолжает фазу", () => {
  const state = ready(2);
  const { task, token } = begin(state);
  assert.equal(task.char, "目");
  game.strokeCorrect(state, token, 0);
  const result = game.timeoutTask(state);
  assert.equal(result.restarted, true);
  assert.equal(result.response.damage, 1);
  assert.equal(state.wall, 9);
  assert.equal(state.phase, "ready");
  const again = begin(state);
  assert.equal(again.task.char, "目");
  assert.equal(state.monsterHp, 4);
  const elite = ready(2);
  repel(elite);
  repel(elite);
  const phase = begin(elite);
  elite.shield = 0;
  const timeout = game.timeoutTask(elite);
  assert.equal(timeout.restarted, false);
  assert.equal(timeout.response.damage, 1);
  assert.equal(elite.wall, 9);
  assert.equal(elite.phase, "choice");
  assert.equal(elite.task.type, phase.task.type);
});

test("нечистое письмо у владыки рассеивается", () => {
  const state = ready(3);
  const { task, token } = begin(state);
  assert.equal(task.char, "品");
  assert.equal(game.strokeMistake(state, token).damage, 1);
  for (let i = 0; i < task.strokeTotal; i++) game.strokeCorrect(state, token, i);
  const result = game.completeWriting(state, token);
  assert.equal(result.fizzle, true);
  assert.equal(state.monsterHp, 9);
  assert.equal(state.wall, 8);
  assert.deepEqual(game.finishMonster(state), { restarted: true, next: "ready" });
  assert.equal(state.phase, "ready");
  const retry = repel(state);
  assert.equal(retry.killed, true);
  assert.equal(state.monsterIndex, 2);
});

test("щитоносец прощает первый промах", () => {
  const state = ready(3);
  state.monsterIndex = 5;
  state.monsterHp = null;
  const { task, token } = begin(state);
  assert.equal(task.special, "armor");
  assert.equal(task.type, "tone");
  const first = game.answerChoice(state, token, wrongValue(task));
  assert.equal(first.response.armor, true);
  assert.equal(state.danger, 0);
  assert.equal(state.wall, 10);
  const second = game.answerChoice(state, token, wrongValue(task));
  assert.equal(second.response.damage, 1);
  assert.equal(state.wall, 9);
});

test("щит стены блокирует удар", () => {
  const state = ready(1);
  state.shield = 1;
  const { token } = begin(state);
  game.strokeMistake(state, token);
  const hit = game.strokeMistake(state, token);
  assert.equal(hit.blocked, true);
  assert.equal(state.wall, 10);
  assert.equal(state.shield, 0);
});

test("варианты уникальны во всех фазах всех волн", () => {
  game.STAGES.forEach((stage, index) => {
    const state = ready(index);
    for (let i = 0; i < game.effectiveMonsters(state); i++) {
      begin(state);
      let guard = 0;
      while ((state.phase === "writing" || state.phase === "choice") && guard++ < 10) {
        const expected = state.task.type === "tone" ? 4 : stage.options;
        assert.equal(state.task.options.length, expected, "волна " + (index + 1) + " монстр " + (i + 1) + " фаза " + state.task.type);
        assert.equal(new Set(state.task.options).size, state.task.options.length);
        assert.ok(state.task.options.includes(state.task.correct));
        fightPhase(state, 0);
      }
      game.finishMonster(state);
    }
  });
});

test("после каждой волны выдаётся свой код, в финале победа", () => {
  const state = ready(0);
  const codes = [];
  for (let wave = 0; wave < 4; wave++) {
    for (let i = 0; i < game.effectiveMonsters(state); i++) repel(state);
    if (wave < 3) {
      assert.equal(state.phase, "stageclear");
      codes.push(state.lastCode);
      game.nextStage(state);
    } else {
      assert.equal(state.phase, "victory");
    }
  }
  assert.deepEqual(codes, ["3771", "4567", "6656"]);
  assert.equal(game.nextStage(state), false);
});

test("бонус волны выдаётся только без единого удара по стене", () => {
  const state = ready(0);
  const first = begin(state);
  game.strokeMistake(state, first.token);
  game.strokeMistake(state, first.token);
  assert.equal(state.wall, 9);
  for (let i = 0; i < first.task.strokeTotal; i++) game.strokeCorrect(state, first.token, i);
  game.completeWriting(state, first.token);
  game.finishMonster(state);
  repel(state);
  repel(state);
  repel(state);
  const last = begin(state);
  game.answerChoice(state, last.token, last.task.correct);
  const finish = game.finishMonster(state);
  assert.equal(state.phase, "stageclear");
  assert.equal(finish.waveBonus, false);
});

test("разрушение стены приводит к поражению", () => {
  const state = ready(1);
  let guard = 0;
  while (state.phase !== "defeat" && guard++ < 30) {
    if (state.phase === "stageclear") game.nextStage(state);
    if (state.phase !== "ready") break;
    repel(state, state.stage >= 2 ? 1 : 2);
  }
  assert.equal(state.wall, 0);
  assert.equal(state.phase, "defeat");
});

test("ремонтные леса восстанавливают стену и тратятся", () => {
  const state = ready(2);
  begin(state);
  state.wall = 5;
  assert.equal(game.repairWall(state), 3);
  assert.equal(state.wall, 8);
  assert.equal(state.potions, 1);
  state.wall = 10;
  assert.equal(game.repairWall(state), 0);
  state.wall = 9;
  assert.equal(game.repairWall(state), 1);
  assert.equal(game.repairWall(state), 0);
});

test("служебные переходы и защиты способностей", () => {
  const state = game.create();
  assert.equal(game.beginTask(state), null);
  assert.equal(game.start(state), true);
  assert.equal(game.start(state), false);
  assert.equal(game.castVolley(state), false);
  assert.equal(game.castSalvo(state), null);
  assert.equal(game.failLoad(state), true);
  assert.equal(state.phase, "error");
  assert.equal(game.retryLoad(state), true);
  assert.equal(game.retryLoad(state), false);
  assert.equal(game.finishMonster(state), null);
  assert.equal(game.timeoutTask(state), null);
  assert.equal(game.strokeCorrect(state, 0, 0), null);
});
