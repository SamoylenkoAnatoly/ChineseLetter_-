const test = require("node:test");
const assert = require("node:assert/strict");
const game = require("./game-core.js");

function fresh() {
  const state = game.create(() => 0.99);
  game.start(state);
  return state;
}

function serve(state) {
  let guard = 0;
  while (guard++ < 10) {
    if (state.phase === "quiz") { game.answerQuiz(state, state.quiz.correct); continue; }
    if (state.phase === "ready") break;
    throw new Error("неожиданная фаза: " + state.phase);
  }
  const recipe = game.currentRecipe(state);
  for (const glyph of recipe.parts) {
    const out = game.addElement(state, glyph);
    assert.ok(out && out.ok, "реагент добавлен: " + glyph);
  }
  const brew = game.brew(state, state.token);
  assert.ok(brew && brew.success, "варка удалась: " + recipe.glyph);
  return game.finishBrew(state);
}

function reach(stageIndex) {
  const state = fresh();
  let guard = 0;
  while (state.stage < stageIndex && guard++ < 100) {
    if (state.phase === "stageclear") { game.nextStage(state); continue; }
    serve(state);
  }
  assert.equal(state.stage, stageIndex);
  return state;
}

test("структура этапов: 3 + 5 + 9 заказов, три кода", () => {
  assert.deepEqual(game.BY_STAGE.map((list) => list.length), [3, 5, 9]);
  assert.deepEqual(game.CODES, ["1111", "1112", "1113"]);
  const total = game.RECIPES.length;
  assert.equal(total, 17);
});

test("подсказки-мнемоники не называют иероглифы напрямую", () => {
  for (const recipe of game.RECIPES) {
    for (const ch of recipe.hint) {
      assert.ok(ch.codePointAt(0) < 0x2e80, "подсказка «" + recipe.hint + "» называет знак: " + ch);
    }
  }
});

test("полное прохождение выдаёт коды 1111 1112 1113", () => {
  const state = fresh();
  const marks = [];
  let guard = 0;
  while (state.phase !== "victory" && guard++ < 100) {
    if (state.phase === "stageclear") { game.nextStage(state); continue; }
    const out = serve(state);
    if (out && (out.next === "stageclear" || out.next === "victory")) marks.push(out.code);
  }
  assert.equal(state.phase, "victory");
  assert.deepEqual(marks, ["1111", "1112", "1113"]);
  assert.deepEqual(state.codes, game.CODES);
  assert.equal(state.stats.brews, 17);
  const glyphs = new Set(game.RECIPES.map((r) => r.glyph));
  for (const glyph of glyphs) assert.ok(state.crafted.includes(glyph), "в гримуаре: " + glyph);
});

test("порядок реагентов не важен, лишний реагент срывает варку", () => {
  const state = fresh();
  game.addElement(state, "月");
  game.addElement(state, "日");
  let brew = game.brew(state, state.token);
  assert.equal(brew.success, true);
  let out = game.finishBrew(state);
  assert.equal(out.glyph, "明");
  assert.equal(state.phase, "ready");

  game.addElement(state, "月");
  game.addElement(state, "月");
  game.addElement(state, "木");
  brew = game.brew(state, state.token);
  assert.equal(brew.success, false);
  game.finishBrew(state);
  assert.equal(state.heat, 5);
  assert.equal(state.phase, "ready");
  assert.equal(state.order, 1);
});

test("чужой реагент тоже ошибка, дистрактор есть на полке", () => {
  const state = reach(1);
  const shelfNow = game.shelf(state);
  assert.ok(shelfNow.includes("用"));
  game.addElement(state, "用");
  game.addElement(state, "口");
  const brew = game.brew(state, state.token);
  assert.equal(brew.success, false);
  game.finishBrew(state);
  assert.equal(state.heat, 5);
});

test("ноль жара остужает котёл, перезапуск возвращает этап", () => {
  const state = fresh();
  for (let i = 0; i < 6; i++) {
    game.addElement(state, "月");
    const brew = game.brew(state, state.token);
    assert.equal(brew.success, false);
    if (state.phase === "defeat") break;
    game.finishBrew(state);
  }
  assert.equal(state.phase, "defeat");
  assert.equal(state.heat, 0);
  assert.equal(state.stats.cooled, 1);
  assert.equal(game.retryStage(state), true);
  assert.equal(state.phase, "ready");
  assert.equal(state.heat, game.HEAT_MAX);
  assert.equal(state.order, 0);
  assert.equal(state.chips, 2);
});

test("вопрос Жаберта охраняет котёл на третьем этапе", () => {
  const state = reach(2);
  assert.equal(state.phase, "quiz");
  assert.equal(game.addElement(state, "丿"), null);
  assert.equal(game.brew(state, state.token), null);
  assert.equal(game.timeout(state, state.token), null);

  const wrong = (state.quiz.correct + 1) % state.quiz.options.length;
  let out = game.answerQuiz(state, wrong);
  assert.equal(out.correct, false);
  assert.equal(state.heat, 5);
  assert.equal(state.phase, "quiz");

  out = game.answerQuiz(state, state.quiz.correct);
  assert.equal(out.correct, true);
  assert.equal(state.phase, "ready");
  assert.equal(state.quiz, null);
});

test("цепочка: сваренный белый свет становится реагентом для частицы", () => {
  const state = reach(2);
  assert.equal(game.shelf(state).includes("白"), false);
  game.answerQuiz(state, state.quiz.correct);
  let out = serve(state);
  assert.equal(out.glyph, "白");
  assert.ok(game.shelf(state).includes("白"));

  game.answerQuiz(state, state.quiz.correct);
  const added = game.addElement(state, "白");
  assert.deepEqual(added, { ok: true, size: 1 });
  game.addElement(state, "勺");
  const brew = game.brew(state, state.token);
  assert.equal(brew.success, true);
  out = game.finishBrew(state);
  assert.equal(out.glyph, "的");
  assert.ok(state.crafted.includes("的"));
});

test("таймер срывает варку и сбрасывает котёл", () => {
  const state = reach(1);
  assert.equal(game.timerSeconds(state), 30);
  const token = state.token;
  game.addElement(state, "口");
  const out = game.timeout(state, token);
  assert.deepEqual(out, { cooled: false });
  assert.equal(state.heat, 5);
  assert.deepEqual(state.cauldron, []);
  assert.equal(state.phase, "ready");
  assert.equal(game.brew(state, token), null);
  assert.ok(state.token > token);
});

test("щепка греет, подсказка раскрывает рецепт ценой жара", () => {
  const warm = fresh();
  assert.equal(game.useHint(warm), false);

  const state = reach(1);
  game.addElement(state, "用");
  game.brew(state, state.token);
  game.finishBrew(state);
  assert.equal(state.heat, 5);
  assert.equal(game.useChip(state), 1);
  assert.equal(state.heat, 6);
  assert.equal(state.chips, 1);
  assert.equal(game.useChip(state), 0);

  assert.equal(game.useHint(state), true);
  assert.equal(state.hintUsed, true);
  assert.equal(state.heat, 5);
  assert.equal(game.useHint(state), false);
});

test("котёл вмещает не больше четырёх реагентов", () => {
  const state = reach(1);
  for (let i = 0; i < 4; i++) {
    const out = game.addElement(state, "口");
    assert.equal(out.ok, true);
  }
  assert.deepEqual(game.addElement(state, "口"), { ok: false, full: true });
  assert.equal(game.removeElement(state, 0), true);
  assert.equal(game.addElement(state, "口").ok, true);
});

test("поражение на вопросе тоже остужает котёл", () => {
  const state = reach(2);
  for (let i = 0; i < 6; i++) {
    const wrong = (state.quiz.correct + 1) % state.quiz.options.length;
    const out = game.answerQuiz(state, wrong);
    if (out.cooled) break;
  }
  assert.equal(state.phase, "defeat");
  assert.equal(game.retryStage(state), true);
  assert.equal(state.phase, "quiz");
});

test("диагностика разобранного рецепта подсказывает про промежуточный реагент", () => {
  const state = reach(2);
  let guard = 0;
  while (state.order < 3 && guard++ < 40) serve(state);
  game.answerQuiz(state, state.quiz.correct);
  game.addElement(state, "木");
  game.addElement(state, "目");
  game.addElement(state, "心");
  const brew = game.brew(state, state.token);
  assert.equal(brew.success, false);
  assert.deepEqual(brew.diag.intermediates, ["相"]);
  assert.deepEqual(brew.diag.rest, ["心"]);
  game.finishBrew(state);
  game.addElement(state, "相");
  game.addElement(state, "心");
  assert.equal(game.brew(state, state.token).success, true);
});

test("заказ по слуху: знак скрыт, экзамен предлагает варианты-знаки", () => {
  const state = reach(2);
  let guard = 0;
  while (state.order < 8 && guard++ < 60) serve(state);
  assert.equal(state.order, 8);
  assert.equal(state.phase, "quiz");
  assert.equal(state.quiz.type, "glyph");
  assert.ok(state.quiz.options.includes("有"));
  assert.ok(state.quiz.question.includes("иметь"));
  game.answerQuiz(state, state.quiz.correct);
  assert.equal(game.currentRecipe(state).blind, true);
});

test("подсказка на финальном этапе стоит два деления жара", () => {
  const state = reach(2);
  game.answerQuiz(state, state.quiz.correct);
  assert.equal(game.useHint(state), true);
  assert.equal(state.heat, 4);
});

test("со второго этапа цель-знак никогда не стоит на полке", () => {
  const state = reach(1);
  let guard = 0;
  while (guard++ < 60) {
    if (state.phase === "stageclear") break;
    assert.equal(state.phase, "ready", "фаза: " + state.phase);
    const recipe = game.currentRecipe(state);
    assert.ok(!game.shelf(state).includes(recipe.glyph), "цель на полке: " + recipe.glyph);
    serve(state);
  }
  assert.equal(state.phase, "stageclear");
  game.nextStage(state);
  assert.equal(game.STAGES[1].targetMode, "meaning");
  assert.equal(game.STAGES[2].targetMode, "meaning");
  assert.equal(game.STAGES[0].targetMode, "glyph");

  guard = 0;
  while (state.order < 2 && guard++ < 40) serve(state);
  game.answerQuiz(state, state.quiz.correct);
  const recraft = game.currentRecipe(state);
  assert.equal(recraft.glyph, "相");
  assert.ok(state.crafted.includes("相"));
  assert.ok(!game.shelf(state).includes("相"));
  for (const part of recraft.parts) {
    assert.ok(game.shelf(state).includes(part), "часть на полке: " + part);
  }
});
