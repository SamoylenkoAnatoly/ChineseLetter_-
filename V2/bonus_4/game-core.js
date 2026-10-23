(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FrogAlchemy = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CODES = ["1111", "1112", "1113"];
  var HEAT_MAX = 6;
  var CHIP_HEAL = 2;
  var CAULDRON_CAP = 4;

  var VOCAB = {
    "月": { py: "yuè", mean: "луна" },
    "日": { py: "rì", mean: "солнце" },
    "口": { py: "kǒu", mean: "рот" },
    "人": { py: "rén", mean: "человек" },
    "木": { py: "mù", mean: "дерево" },
    "心": { py: "xīn", mean: "сердце" },
    "目": { py: "mù", mean: "глаз" },
    "夕": { py: "xī", mean: "вечер" },
    "自": { py: "zì", mean: "сам" },
    "勺": { py: "sháo", mean: "ложка" },
    "用": { py: "yòng", mean: "использовать" },
    "明": { py: "míng", mean: "яркий" },
    "朋": { py: "péng", mean: "друг" },
    "林": { py: "lín", mean: "роща" },
    "品": { py: "pǐn", mean: "изделие" },
    "众": { py: "zhòng", mean: "толпа" },
    "名": { py: "míng", mean: "имя" },
    "相": { py: "xiāng", mean: "взаимно" },
    "息": { py: "xī", mean: "дыхание" },
    "白": { py: "bái", mean: "белый" },
    "的": { py: "de", mean: "частица «чей»" },
    "想": { py: "xiǎng", mean: "думать, мечтать" },
    "必": { py: "bì", mean: "обязательно" },
    "术": { py: "shù", mean: "умение" },
    "中": { py: "zhōng", mean: "середина" },
    "右": { py: "yòu", mean: "направо" },
    "有": { py: "yǒu", mean: "иметь" },
    "丿": { py: "piě", mean: "откидная черта" },
    "丶": { py: "diǎn", mean: "точка" },
    "丨": { py: "gǔn", mean: "вертикаль" },
    "𠂇": { py: "zuǒ", mean: "рука" }
  };

  var RECIPES = [
    { glyph: "明", parts: ["日", "月"], stage: 0, hint: "Солнце и луна встают вместе — сразу светло." },
    { glyph: "朋", parts: ["月", "月"], stage: 0, hint: "Две луны бок о бок — два друга." },
    { glyph: "林", parts: ["木", "木"], stage: 0, hint: "Дерево и дерево — уже целая роща." },
    { glyph: "品", parts: ["口", "口", "口"], stage: 1, hint: "Три открытых рта — товар на прилавке." },
    { glyph: "众", parts: ["人", "人", "人"], stage: 1, hint: "Три человека друг за другом — толпа." },
    { glyph: "名", parts: ["夕", "口"], stage: 1, hint: "Вечером окликают по имени через рот." },
    { glyph: "相", parts: ["木", "目"], stage: 1, hint: "Глаз смотрит на дерево — взаимный взгляд." },
    { glyph: "息", parts: ["自", "心"], stage: 1, hint: "Нос сверху, сердце снизу — дыхание." },
    { glyph: "白", parts: ["丿", "日"], stage: 2, hint: "Луч над солнцем — первый белый свет." },
    { glyph: "的", parts: ["白", "勺"], stage: 2, hint: "Белый свет, сваренный ранее, да ложка — чистая, а значит моя: частица «чей»." },
    { glyph: "相", parts: ["木", "目"], stage: 2, hint: "Взгляд на дерево — взаимный взгляд. Жаберт выпил весь запас, свари заново." },
    { glyph: "想", parts: ["相", "心"], stage: 2, hint: "Сердце рисует картину: сначала свари «взаимный взгляд», потом добавь сердце. Части по отдельности не засчитаются." },
    { glyph: "必", parts: ["心", "丿"], stage: 2, hint: "Сердце, пронзённое копьём, — решение твёрдое." },
    { glyph: "术", parts: ["木", "丶"], stage: 2, hint: "Дерево и решительный мазок — мастерство." },
    { glyph: "中", parts: ["口", "丨"], stage: 2, hint: "Палочка суши вошла ровно в центр квадрата." },
    { glyph: "右", parts: ["𠂇", "口"], stage: 2, hint: "Рука показывает, рот командует — направо!" },
    { glyph: "有", parts: ["𠂇", "月"], stage: 2, blind: true, hint: "Рука держит луну подмышкой — иметь." }
  ];

  var STAGES = [
    {
      name: "Первая ступка",
      place: "Учебный угол лаборатории",
      caption: "Первые настойки для разогрева лап",
      seconds: 0,
      hintMode: "open",
      targetMode: "glyph",
      quiz: false,
      shelf: ["日", "月", "木", "夕", "口"],
      mood: "Рецепт виден целиком, но на полке уже прячутся лишние колбы — собирай только то, что нужно.",
      teaser: "Дальше — тигль-двойка: Жаберт будет называть только перевод знака, прячет рецепты и заведёт таймер.",
      dialogue: "Ква! Начнём с простых настоек: солнце, луна и деревья. Только не тащи в котёл всё подряд — я подсыпал лишних колб."
    },
    {
      name: "Тигль-двойка",
      place: "Главный лабораторный стол",
      caption: "Настойки поглубже: время и лишние колбы",
      seconds: 30,
      hintMode: "hidden",
      targetMode: "meaning",
      quiz: false,
      shelf: ["口", "人", "夕", "木", "目", "自", "心", "日", "月", "用", "勺"],
      mood: "Жаберт называет только перевод знака — сам знак не показывается. Рецепт скрыт, лишних колб много, у варки 30 секунд.",
      teaser: "Дальше — Великий эликсир: цепные реакции, экзамен Жаберта и заказ по слуху.",
      dialogue: "Теперь я называю только перевод: «толпа», «имя», «дыхание»… Узнавай знак по смыслу, слушай подсказку и не тащи лишнего."
    },
    {
      name: "Великий эликсир",
      place: "Большой котёл у окна",
      caption: "Цепь мастера: из луча и солнца — частица «чей»",
      seconds: 25,
      hintMode: "hidden",
      hintCost: 2,
      targetMode: "meaning",
      quiz: true,
      shelf: ["日", "月", "木", "心", "目", "口", "勺", "丿", "丶", "丨", "𠂇", "夕", "自", "用"],
      mood: "Заказ — только перевод, перед варкой вопрос Жаберта, иногда по слуху: только чтение. Цепные реакции, подсказка −2 жара, 25 секунд.",
      teaser: "",
      dialogue: "Экзамен, ква! Заказ диктую переводом, а то и по слуху — только чтение. Цепочки: сваренный знак сам станет реагентом."
    }
  ];

  var CHAIN_OUTPUTS = ["白", "相"];
  var FLATTEN = { "白": ["丿", "日"], "相": ["木", "目"] };
  var STROKES = ["丿", "丶", "丨", "𠂇"];

  var BY_STAGE = STAGES.map(function (stage, index) {
    return RECIPES.filter(function (recipe) { return recipe.stage === index; });
  });

  function create(rng) {
    return {
      phase: "intro", stage: 0, order: 0, token: 0,
      heat: HEAT_MAX, maxHeat: HEAT_MAX, chips: 2,
      cauldron: [], quiz: null, lastBrew: null,
      crafted: [], codes: [], lastCode: "",
      hintUsed: false, cleanRun: true,
      rng: rng || Math.random,
      stats: { brews: 0, perfect: 0, mistakes: 0, timeouts: 0, quizRight: 0, quizWrong: 0, hints: 0, cooled: 0 }
    };
  }

  function currentRecipe(state) {
    var list = BY_STAGE[state.stage];
    return state.order < list.length ? list[state.order] : null;
  }

  function ordersInStage(state) {
    return BY_STAGE[state.stage].length;
  }

  function shelf(state) {
    var list = STAGES[state.stage].shelf.slice();
    if (state.stage === STAGES.length - 1) {
      for (var i = 0; i < CHAIN_OUTPUTS.length; i++) {
        var glyph = CHAIN_OUTPUTS[i];
        if (state.crafted.indexOf(glyph) !== -1 && list.indexOf(glyph) === -1) list.push(glyph);
      }
    }
    var recipe = currentRecipe(state);
    if (recipe) {
      var k = list.indexOf(recipe.glyph);
      if (k !== -1) list.splice(k, 1);
    }
    return list;
  }

  function timerSeconds(state) {
    return STAGES[state.stage].seconds;
  }

  function hurt(state) {
    state.heat = Math.max(0, state.heat - 1);
    if (state.heat === 0) {
      state.phase = "defeat";
      state.stats.cooled += 1;
      state.cauldron = [];
      state.quiz = null;
      state.lastBrew = null;
      return { cooled: true };
    }
    return { cooled: false };
  }

  function earnCode(state, code) {
    state.lastCode = code;
    if (state.codes.indexOf(code) === -1) state.codes.push(code);
  }

  function makeQuiz(state) {
    var recipe = currentRecipe(state);
    var vocab = VOCAB[recipe.glyph];
    var type, correct, question;
    if (recipe.blind) {
      type = "glyph";
      correct = recipe.glyph;
      question = "Какой знак значит «" + vocab.mean + "» (" + vocab.py + ")?";
    } else {
      type = state.rng() < 0.5 ? "pinyin" : "meaning";
      correct = type === "pinyin" ? vocab.py : vocab.mean;
      question = type === "pinyin" ? "Как читается знак " + recipe.glyph + "?" : "Что значит знак " + recipe.glyph + "?";
    }
    var keys = Object.keys(VOCAB).filter(function (g) {
      return g !== recipe.glyph && (type !== "glyph" || STROKES.indexOf(g) === -1);
    });
    var options = [correct];
    var guard = 0;
    while (options.length < 4 && guard++ < 300) {
      var key = keys[Math.floor(state.rng() * keys.length) % keys.length];
      var value = type === "glyph" ? key : type === "pinyin" ? VOCAB[key].py : VOCAB[key].mean;
      if (options.indexOf(value) === -1) options.push(value);
    }
    for (var k = 0; options.length < 4 && k < keys.length; k++) {
      var fallback = type === "glyph" ? keys[k] : type === "pinyin" ? VOCAB[keys[k]].py : VOCAB[keys[k]].mean;
      if (options.indexOf(fallback) === -1) options.push(fallback);
    }
    var shuffled = options.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(state.rng() * (i + 1));
      var temp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = temp;
    }
    return {
      type: type,
      glyph: recipe.glyph,
      question: question,
      options: shuffled,
      correct: shuffled.indexOf(correct)
    };
  }

  function openOrder(state) {
    state.cauldron = [];
    state.hintUsed = false;
    state.cleanRun = true;
    state.lastBrew = null;
    state.token += 1;
    if (STAGES[state.stage].quiz) {
      state.quiz = makeQuiz(state);
      state.phase = "quiz";
    } else {
      state.quiz = null;
      state.phase = "ready";
    }
  }

  function start(state) {
    if (state.phase !== "intro") return false;
    openOrder(state);
    return true;
  }

  function answerQuiz(state, index) {
    if (state.phase !== "quiz" || !state.quiz) return null;
    if (index === state.quiz.correct) {
      state.stats.quizRight += 1;
      state.quiz = null;
      state.token += 1;
      state.phase = "ready";
      return { correct: true };
    }
    state.stats.quizWrong += 1;
    state.cleanRun = false;
    var hit = hurt(state);
    return { correct: false, cooled: hit.cooled };
  }

  function addElement(state, glyph) {
    if (state.phase !== "ready") return null;
    if (state.cauldron.length >= CAULDRON_CAP) return { ok: false, full: true };
    if (shelf(state).indexOf(glyph) === -1) return { ok: false, unknown: true };
    state.cauldron.push(glyph);
    return { ok: true, size: state.cauldron.length };
  }

  function removeElement(state, index) {
    if (state.phase !== "ready") return false;
    if (index < 0 || index >= state.cauldron.length) return false;
    state.cauldron.splice(index, 1);
    return true;
  }

  function sameMulti(a, b) {
    if (a.length !== b.length) return false;
    var rest = b.slice();
    for (var i = 0; i < a.length; i++) {
      var k = rest.indexOf(a[i]);
      if (k === -1) return false;
      rest.splice(k, 1);
    }
    return true;
  }

  function flattenParts(parts) {
    var out = [];
    parts.forEach(function (part) {
      if (FLATTEN[part]) FLATTEN[part].forEach(function (sub) { out.push(sub); });
      else out.push(part);
    });
    return out;
  }

  function diagnose(state) {
    var recipe = currentRecipe(state);
    if (!recipe) return null;
    if (!sameMulti(state.cauldron, flattenParts(recipe.parts))) return null;
    var intermediates = recipe.parts.filter(function (part) { return !!FLATTEN[part]; });
    if (!intermediates.length) return null;
    return { intermediates: intermediates, rest: recipe.parts.filter(function (part) { return !FLATTEN[part]; }) };
  }

  function brew(state, token) {
    if (state.phase !== "ready" || token !== state.token) return null;
    var recipe = currentRecipe(state);
    if (!recipe) return null;
    var success = state.cauldron.length > 0 && sameMulti(state.cauldron, recipe.parts);
    state.lastBrew = success;
    state.phase = "resolving";
    if (!success) {
      state.stats.mistakes += 1;
      state.cleanRun = false;
      var diag = diagnose(state);
      var hit = hurt(state);
      if (hit.cooled) return { success: false, result: "", cooled: true, diag: diag };
      return { success: false, result: "", cooled: false, diag: diag };
    }
    return { success: success, result: success ? recipe.glyph : "", cooled: false, diag: null };
  }

  function finishBrew(state) {
    if (state.phase !== "resolving" || state.lastBrew === null) return null;
    var success = state.lastBrew;
    state.lastBrew = null;
    var recipe = currentRecipe(state);
    state.cauldron = [];
    if (!success) {
      state.token += 1;
      state.phase = "ready";
      return { success: false, next: "ready" };
    }
    state.stats.brews += 1;
    if (state.cleanRun) state.stats.perfect += 1;
    state.crafted.push(recipe.glyph);
    if (state.order >= BY_STAGE[state.stage].length - 1) {
      if (state.stage >= STAGES.length - 1) {
        state.phase = "victory";
        earnCode(state, CODES[CODES.length - 1]);
        state.codes = CODES.slice();
        return { success: true, glyph: recipe.glyph, next: "victory", code: state.lastCode };
      }
      state.phase = "stageclear";
      earnCode(state, CODES[state.stage]);
      return { success: true, glyph: recipe.glyph, next: "stageclear", code: state.lastCode };
    }
    state.order += 1;
    openOrder(state);
    return { success: true, glyph: recipe.glyph, next: STAGES[state.stage].quiz ? "quiz" : "ready" };
  }

  function timeout(state, token) {
    if (state.phase !== "ready" || token !== state.token) return null;
    state.stats.timeouts += 1;
    state.cleanRun = false;
    state.cauldron = [];
    state.token += 1;
    return hurt(state);
  }

  function useChip(state) {
    if ((state.phase !== "ready" && state.phase !== "quiz") || !state.chips || state.heat >= state.maxHeat) return 0;
    var amount = Math.min(CHIP_HEAL, state.maxHeat - state.heat);
    state.heat += amount;
    state.chips -= 1;
    return amount;
  }

  function useHint(state) {
    if (state.phase !== "ready") return false;
    var stage = STAGES[state.stage];
    if (stage.hintMode !== "hidden" || state.hintUsed) return false;
    state.hintUsed = true;
    state.stats.hints += 1;
    state.cleanRun = false;
    var cost = stage.hintCost || 1;
    for (var i = 0; i < cost; i++) {
      if (hurt(state).cooled) break;
    }
    return true;
  }

  function nextStage(state) {
    if (state.phase !== "stageclear") return false;
    state.stage += 1;
    state.order = 0;
    state.heat = state.maxHeat;
    state.chips = 2;
    openOrder(state);
    return true;
  }

  function retryStage(state) {
    if (state.phase !== "defeat") return false;
    state.order = 0;
    state.heat = state.maxHeat;
    state.chips = 2;
    openOrder(state);
    return true;
  }

  return {
    CODES: CODES, HEAT_MAX: HEAT_MAX, CAULDRON_CAP: CAULDRON_CAP,
    VOCAB: VOCAB, RECIPES: RECIPES, STAGES: STAGES, BY_STAGE: BY_STAGE, CHAIN_OUTPUTS: CHAIN_OUTPUTS, FLATTEN: FLATTEN,
    create: create, start: start, currentRecipe: currentRecipe, ordersInStage: ordersInStage,
    shelf: shelf, timerSeconds: timerSeconds, answerQuiz: answerQuiz,
    addElement: addElement, removeElement: removeElement, brew: brew, finishBrew: finishBrew,
    timeout: timeout, useChip: useChip, useHint: useHint, nextStage: nextStage, retryStage: retryStage
  };
}));
