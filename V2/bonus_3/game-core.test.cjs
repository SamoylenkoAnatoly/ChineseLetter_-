const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const game = require("./game-core.js");

function rng(seed = 42) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function fresh(seed = 42) { const state = game.create(rng(seed)); game.start(state); return state; }
function prepare(state, pick = 0, premium = false) {
  if (state.phase === "event") {
    const choices = game.eventChoices(state);
    assert.equal(game.resolveEvent(state, state.token, choices[premium ? choices.length - 1 : 0]), true);
  }
  if (state.phase === "choice") {
    const jobs = game.available(state);
    assert.ok(jobs.length);
    assert.equal(game.selectJob(state, state.token, jobs[pick % jobs.length].id), true);
  }
}
function solve(state) {
  const token = state.token;
  if (state.task.type === "write") {
    for (let i = 0; i < game.VOCAB[state.task.vocab].strokes; i++) assert.equal(game.stroke(state, token, i), true);
    return game.completeWriting(state, token);
  }
  if (state.task.type === "sound") game.hear(state, token);
  return game.answer(state, token, state.task.correct);
}
function step(state, pick = 0, premium = false) {
  prepare(state, pick, premium);
  const result = solve(state);
  assert.equal(result.correct, true);
  game.advance(state, state.token);
  return result;
}
function reach(stage) {
  const state = fresh();
  while (state.stage < stage) { step(state); if (state.phase === "stageclear") game.nextStage(state); }
  return state;
}
function findType(state, type) {
  while (true) {
    if (state.phase === "event") game.resolveEvent(state, state.token, game.eventChoices(state)[0]);
    const job = game.available(state).find(j => j.type === type);
    if (job) { game.selectJob(state, state.token, job.id); return; }
    step(state);
  }
}
function oldSave(stage, phase = "task") {
  const plan = game.schedule(stage, rng()).map(j => ({ vocab: j.vocab, type: j.type }));
  const clear = phase === "stageclear" || phase === "victory";
  const spec = plan[0];
  const entry = game.VOCAB[spec.vocab];
  const correct = spec.type === "meaning" ? entry.meaning : spec.type === "pinyin" ? entry.pinyin : entry.char;
  const growth = Array(9).fill(0);
  if (clear) plan.forEach(j => growth[j.vocab]++);
  return JSON.stringify({ version: 1, stage, phase, index: clear ? plan.length : 0, energy: 6, score: 3000, stageScore: 200, streak: 0, codes: game.CODES.slice(0, stage + (clear ? 1 : 0)), plan, growth, misses: { 月: 2 }, stats: { correct: 20, perfect: 18, mistakes: 2, timeouts: 0, retries: 0 }, task: clear ? null : { vocab: spec.vocab, type: spec.type, correct, options: game.optionsFor(entry, spec.type, game.STAGES[stage].options, rng()), strokes: 0, strokeErrors: 0, dirty: false, hint: false, heard: false } });
}

test("пулы сохраняют квоты, девять знаков и четыре разных финальных дела", () => {
  for (let seed = 0; seed < 100; seed++) for (let stage = 0; stage < 4; stage++) {
    const plan = game.schedule(stage, rng(seed));
    assert.equal(plan.length, [12, 16, 20, 24][stage]);
    assert.equal(new Set(plan.map(j => j.vocab)).size, 9);
    for (const type of game.TYPES) {
      assert.equal(plan.filter(j => j.type === type).length, plan.length / 4);
      assert.equal(plan.slice(-4).filter(j => j.type === type).length, 1);
    }
    assert.ok(plan.slice(-4).every(j => j.final));
  }
});

test("разные стратегии, ошибки и покупки не блокируют прохождение", () => {
  for (let seed = 0; seed < 30; seed++) {
    const state = fresh(seed);
    let count = 0;
    while (state.phase !== "victory") {
      if (seed % 2 === 0 && ["choice", "event"].includes(state.phase)) {
        for (const upgrade of game.UPGRADES) game.buy(state, state.token, upgrade.id);
      }
      prepare(state, seed + count, seed % 2 === 0);
      if (seed % 3 === 0) game.timeout(state, state.token);
      solve(state); count++;
      assert.equal(game.advance(state, state.token), true);
      if (state.phase === "stageclear") game.nextStage(state);
      assert.ok(count <= 72);
      assert.ok(state.coins >= 0);
    }
    assert.equal(count, 72);
    assert.deepEqual(state.codes, ["3434", "4445", "5222", "9219"]);
    assert.ok(state.growth.every(n => n > 0));
  }
});

test("выбор меняет следующее задание, финальные дела недоступны раньше времени", () => {
  const state = fresh();
  const jobs = game.available(state);
  assert.ok(jobs.length >= 2 && jobs.length <= 3);
  assert.equal(new Set(jobs.map(j => j.type)).size, jobs.length);
  assert.equal(game.selectJob(state, state.token, state.plan.at(-1).id), false);
  const chosen = jobs.at(-1);
  assert.equal(game.selectJob(state, state.token, chosen.id), true);
  assert.equal(state.task.id, chosen.id);
  assert.equal(game.selectJob(state, state.token, chosen.id), false);
});

test("ошибки локальны, восстановление не засчитывает неверный ответ", () => {
  const state = fresh(); findType(state, "meaning");
  const vocab = state.task.vocab;
  const wrong = state.task.options.find(o => o !== state.task.correct);
  for (let i = 0; i < 20; i++) assert.equal(game.answer(state, state.token, wrong).correct, false);
  assert.equal(state.phase, "task"); assert.equal(state.index, 0);
  assert.equal(state.wilted[vocab], true); assert.equal(state.quality[vocab], false);
  const result = solve(state);
  assert.equal(result.coins, 2); assert.equal(result.gained, 70);
  assert.equal(state.wilted[vocab], false);
  assert.equal(state.growth[vocab], 1);
});

test("магазин предотвращает отрицательный баланс и повторную покупку", () => {
  const state = fresh(); const token = state.token;
  assert.equal(game.buy(state, token, "greenhouse"), false);
  assert.equal(game.buy(state, token, "can"), true);
  assert.equal(state.coins, 0); assert.equal(state.charges.can, true);
  assert.equal(game.buy(state, token, "scarecrow"), false);
  state.coins = 100;
  assert.equal(game.buy(state, state.token, "can"), false);
  assert.equal(game.buy(state, state.token, "scarecrow"), true);
  assert.equal(game.buy(state, state.token, "greenhouse"), true);
  prepare(state);
  assert.equal(game.buy(state, state.token, "can"), false);
});

test("теплица страхует качество, но не ответ; расходуется единожды", () => {
  const state = fresh(); state.coins = 6; game.buy(state, state.token, "greenhouse");
  findType(state, "meaning");
  const vocab = state.task.vocab;
  const wrong = state.task.options.find(o => o !== state.task.correct);
  const result = game.answer(state, state.token, wrong);
  assert.equal(result.protected, true); assert.equal(state.charges.greenhouse, false);
  assert.equal(state.quality[vocab], true); assert.equal(state.task.dirty, true);
  assert.equal(state.phase, "task"); assert.equal(state.index, 0);
  game.answer(state, state.token, wrong);
  assert.equal(state.quality[vocab], false);
  assert.equal(solve(state).coins, 2);
});

test("летом выбор спасает одну грядку, защита сохраняет другую", () => {
  for (const protection of [false, true]) {
    const state = reach(1);
    if (protection) game.buy(state, state.token, "can");
    while (state.phase !== "event") step(state);
    assert.equal(state.event.kind, "drought");
    const [selected, other] = state.event.ids;
    game.resolveEvent(state, state.token, selected);
    assert.deepEqual(game.available(state).map(j => j.id), [selected]);
    prepare(state); solve(state);
    assert.equal(state.quality[state.plan[other].vocab], protection);
    if (protection) assert.equal(state.charges.can, false);
    game.advance(state, state.token);
    while (state.phase !== "event") step(state);
    assert.equal(state.event.kind, "pest");
    game.buy(state, state.token, "scarecrow");
    const second = state.event.ids[1];
    const qualityBefore = state.quality[state.plan[second].vocab];
    game.resolveEvent(state, state.token, state.event.ids[0]); prepare(state); solve(state);
    assert.equal(state.quality[state.plan[second].vocab], qualityBefore);
    assert.equal(state.charges.scarecrow, false);
  }
});

test("контракты используют будущие дела, премия зависит от чистоты", () => {
  for (const dirty of [false, true]) {
    const state = reach(2);
    while (state.phase !== "event") step(state);
    game.resolveEvent(state, state.token, "premium");
    assert.equal(state.chain.ids.length, 2);
    const count = state.index;
    prepare(state);
    if (dirty) game.timeout(state, state.token);
    solve(state); game.advance(state, state.token); prepare(state);
    const result = solve(state);
    assert.equal(state.index, count + 2);
    assert.equal(state.chain, null);
    assert.equal(state.stats.contracts > 0, true);
    assert.equal(result.coins >= 11, !dirty);
  }
  const moon = reach(3);
  while (moon.phase !== "event") step(moon);
  game.resolveEvent(moon, moon.token, "safe");
  assert.equal(moon.chain.ids.length, 3);
});

test("дождь восстанавливает качество, подарок меняет кошелёк", () => {
  for (const choice of ["rain", "coins"]) {
    const state = fresh(); while (state.phase !== "event") step(state);
    state.quality[0] = false; state.wilted[0] = true;
    const coins = state.coins;
    game.resolveEvent(state, state.token, choice);
    assert.equal(state.phase, "choice");
    assert.equal(state.coins, coins + (choice === "coins" ? 4 : 0));
    assert.equal(state.quality[0], choice === "rain");
  }
});

test("пауза, устаревшие токены и повторные события не выдают наград", () => {
  const state = fresh(); const token = state.token;
  game.pause(state, true); assert.equal(game.selectJob(state, token, game.available(state)[0].id), false);
  game.pause(state, false); prepare(state);
  const taskToken = state.token;
  game.pause(state, true);
  assert.equal(game.timeout(state, taskToken), null); assert.equal(game.stroke(state, taskToken, 0), false);
  game.pause(state, false);
  solve(state); const score = state.score;
  assert.equal(game.completeWriting(state, taskToken), null);
  assert.equal(state.score, score);
  assert.equal(game.advance(state, token), false);
  const feedbackToken = state.token; assert.equal(game.advance(state, feedbackToken), true);
  assert.equal(game.advance(state, feedbackToken), false);
});

test("все состояния восстанавливаются, включая середину контрактов и событий", () => {
  let state = fresh(); let count = 0;
  while (state.phase !== "victory") {
    state = game.restore(game.serialize(state), rng(count)); assert.ok(state, "before prepare "+count);
    if (state.phase === "event") {
      game.resolveEvent(state, state.token, game.eventChoices(state).at(-1));
      state = game.restore(game.serialize(state), rng(count)); assert.ok(state, "event "+count);
    }
    prepare(state, count);
    state = game.restore(game.serialize(state), rng(count)); assert.ok(state, "task "+count);
    solve(state);
    state = game.restore(game.serialize(state), rng(count)); assert.ok(state, "feedback "+count);
    game.advance(state, state.token);
    state = game.restore(game.serialize(state), rng(count)); assert.ok(state, "advance "+count);
    if (state.phase === "stageclear") game.nextStage(state);
    count++;
  }
  assert.equal(count, 72);
});

test("письмо защищено от досрочного завершения, паузы и повреждённых сейвов", () => {
  const state = fresh(); findType(state, "write");
  const token = state.token;
  assert.equal(game.completeWriting(state, token), null);
  assert.equal(game.stroke(state, token, 1), false);
  assert.equal(game.stroke(state, token, 0), true);
  assert.equal(game.stroke(state, token, 0), false);
  game.strokeMistake(state, token);
  const restored = game.restore(game.serialize(state));
  assert.equal(restored.task.strokes, 0); assert.equal(restored.task.dirty, true);
  for (let i = 1; i < game.VOCAB[state.task.vocab].strokes; i++) game.stroke(state, token, i);
  assert.equal(game.completeWriting(state, token).correct, true);
});

test("варианты без омонимов, слух начинается только после записи", () => {
  for (const entry of game.VOCAB) for (const stage of game.STAGES) for (const type of ["meaning", "pinyin", "sound"]) {
    const options = game.optionsFor(entry, type, stage.options, rng());
    assert.equal(options.length, stage.options); assert.equal(new Set(options).size, options.length);
    if (type === "sound") assert.equal(new Set(options.map(c => game.VOCAB.find(v => v.char === c).pinyin)).size, options.length);
  }
  const state = fresh(); findType(state, "sound");
  assert.equal(game.answer(state, state.token, state.task.correct), null);
  assert.equal(game.hear(state, state.token), true);
  assert.equal(game.answer(state, state.token, state.task.correct).correct, true);
});

test("таймер только у задачи, спокойный режим не меняет квоты", () => {
  const state = reach(3);
  assert.equal(game.seconds(state, false), 0);
  prepare(state); assert.ok(game.seconds(state, false) > 0);
  assert.equal(game.seconds(state, true), 0);
});

test("перенос v1 сохраняет коды, урожай и статистику на каждом этапе", () => {
  for (let stage = 0; stage < 4; stage++) {
    const migrated = game.migrate(oldSave(stage), rng());
    assert.ok(migrated); assert.equal(migrated.stage, stage); assert.equal(migrated.index, 0);
    assert.equal(migrated.coins, 4); assert.equal(migrated.score, 3000);
    assert.deepEqual(migrated.codes, game.CODES.slice(0, stage));
    assert.ok(game.restore(game.serialize(migrated)));
  }
  const next = game.migrate(oldSave(1, "stageclear"));
  assert.equal(next.stage, 2); assert.deepEqual(next.codes, game.CODES.slice(0,2));
  const done = game.migrate(oldSave(3, "victory"));
  assert.equal(done.phase, "victory"); assert.deepEqual(done.codes, game.CODES);
  assert.ok(game.restore(game.serialize(done)));
  assert.equal(game.migrate("{}"), null);
});

test("повреждённые сейвы отвергаются", () => {
  assert.equal(game.restore("bad"), null);
  const raw = JSON.parse(game.serialize(fresh()));
  for (const change of [s=>s.version=1,s=>s.coins=-1,s=>s.stage=8,s=>s.codes=["3434"],s=>s.plan[0].done=true,s=>s.quality=[],s=>s.growth[0]=3,s=>s.event={kind:"moon",ids:[],selected:null},s=>s.charges.can=true,s=>s.misses={fake:3},s=>s.chain={ids:[0,0],position:0,clean:true,premium:true,reward:10,name:"x"}]) {
    const s = structuredClone(raw); change(s); assert.equal(game.restore(JSON.stringify(s)), null);
  }
});

test("локальные ресурсы и DOM существуют", () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"char-data.js"),"utf8"),context);
  for (const entry of game.VOCAB) {
    assert.equal(context.window.HANZI_DATA[entry.char].strokes.length,entry.strokes);
    assert.equal(context.window.HANZI_DATA[entry.char].medians.length,entry.strokes);
    assert.ok(fs.statSync(path.join(__dirname,entry.audio)).size>1000);
  }
  const html = fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
  const js = fs.readFileSync(path.join(__dirname,"game.js"),"utf8");
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  for (const m of js.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(ids.includes(m[1]),m[1]);
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) if (!m[1].startsWith("#")) {
    assert.ok(!m[1].includes("..")&&!m[1].includes("://")); assert.ok(fs.existsSync(path.join(__dirname,m[1])));
  }
});

test("завершение письма не останавливает последнюю черту", () => {
  const source=fs.readFileSync(path.join(__dirname,"game.js"),"utf8");
  const start=source.indexOf("  function success(result) {");
  const end=source.indexOf("\n  function audioFailed",start);
  const body=source.slice(start,end);
  assert.ok(body.includes("writer.showCharacter({ duration: 0 })"));
  assert.ok(!body.includes("writer.pauseAnimation()")&&!body.includes("writer.cancelQuiz()"));
});
