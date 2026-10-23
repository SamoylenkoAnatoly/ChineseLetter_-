(function () {
  "use strict";

  var model = window.FrogAlchemy;
  if (!model) return;

  var $ = function (id) { return document.getElementById(id); };

  var scene = $("scene");
  var trailItems = Array.prototype.slice.call($("trail").children);
  var locationText = $("location");
  var encounterText = $("encounter");
  var intention = $("intention");
  var captionTitle = $("scene-caption-title");
  var captionText = $("scene-caption-text");
  var heroHeat = $("hero-heat");
  var heroHeatText = $("hero-heat-text");
  var brewGlyph = $("brew-glyph");
  var smoke = $("smoke");
  var orderCard = $("order-card");
  var orderCover = $("order-cover");
  var orderGlyph = $("order-glyph");
  var orderPy = $("order-py");
  var orderMeta = $("order-meta");
  var orderHint = $("order-hint");
  var quizPanel = $("quiz-panel");
  var quizQuestion = $("quiz-question");
  var quizTarget = $("quiz-target");
  var quizOptions = $("quiz-options");
  var slots = Array.prototype.slice.call(document.querySelectorAll(".slot"));
  var timerBox = $("quiz-timer");
  var timerFill = $("timer-fill");
  var timerText = $("timer-text");
  var brewStatus = $("brew-status");
  var brewButton = $("brew-button");
  var clearButton = $("clear-button");
  var hintButton = $("hint-button");
  var chipButton = $("chip-button");
  var chipCount = $("chip-count");
  var soundButton = $("sound-button");
  var shelfEl = $("shelf");
  var heatDots = Array.prototype.slice.call($("heat-dots").children);
  var heatText = $("heat-text");
  var heatPanel = $("heat-dots");
  var statClean = $("stat-clean");
  var statFail = $("stat-fail");
  var statQuiz = $("stat-quiz");
  var dialogue = $("dialogue");
  var grimoire = $("grimoire");
  var grimoireCount = $("grimoire-count");
  var journalList = $("journal-list");
  var journalCount = $("journal-count");
  var overlay = $("overlay");
  var storyArt = $("story-art");
  var storyEyebrow = $("story-eyebrow");
  var storyTitle = $("story-title");
  var storyText = $("story-text");
  var storyRules = $("story-rules");
  var reward = $("reward");
  var rewardLabel = $("reward-label");
  var rewardCode = $("reward-code");
  var rewardStats = $("reward-stats");
  var codesList = $("codes-list");
  var codesItems = $("codes-items");
  var storyPrimary = $("story-primary");
  var storySound = $("story-sound");
  var storyFootnote = $("story-footnote");

  var UNIQUE_GLYPHS = [];
  model.RECIPES.forEach(function (recipe) {
    if (UNIQUE_GLYPHS.indexOf(recipe.glyph) === -1) UNIQUE_GLYPHS.push(recipe.glyph);
  });

  var LIQUIDS = ["#9fe870", "#ffd76a", "#7fd8ff", "#ff9de2", "#c9a0ff", "#7fbf6a", "#ffb37a", "#8ef0d8"];

  var state = model.create();
  var busy = false;
  var overlayMode = "";
  var journal = [];
  var freshGlyph = "";

  var audio = { ctx: null, on: true };

  function beep(freq, duration, type, gain, delay) {
    if (!audio.on) return;
    try {
      if (!audio.ctx) audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      var ctx = audio.ctx;
      var osc = ctx.createOscillator();
      var vol = ctx.createGain();
      var t = ctx.currentTime + (delay || 0);
      osc.type = type || "sine";
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(gain || 0.1, t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + (duration || 0.15));
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + (duration || 0.15) + 0.05);
    } catch (err) { }
  }

  var sounds = {
    drop: function () { beep(520, 0.12, "triangle", 0.1); },
    take: function () { beep(300, 0.1, "triangle", 0.08); },
    brew: function () { beep(392, 0.14, "sine", 0.12); beep(523, 0.16, "sine", 0.12, 0.12); beep(784, 0.24, "sine", 0.12, 0.24); },
    fail: function () { beep(180, 0.25, "sawtooth", 0.08); beep(120, 0.3, "sawtooth", 0.07, 0.1); },
    right: function () { beep(660, 0.12, "square", 0.07); beep(880, 0.14, "square", 0.07, 0.1); },
    wrong: function () { beep(150, 0.2, "square", 0.07); },
    chip: function () { beep(240, 0.18, "triangle", 0.1); beep(360, 0.14, "triangle", 0.09, 0.14); },
    clear: function () { beep(523, 0.12, "sine", 0.12); beep(659, 0.12, "sine", 0.12, 0.12); beep(784, 0.12, "sine", 0.12, 0.24); beep(1047, 0.3, "sine", 0.12, 0.36); }
  };

  function plural(n, forms) {
    var a = Math.abs(n) % 100;
    var b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  function liquidFor(glyph) {
    var code = 0;
    for (var i = 0; i < glyph.length; i++) code += glyph.codePointAt(i);
    return LIQUIDS[code % LIQUIDS.length];
  }

  function log(text) {
    journal.unshift(text);
    if (journal.length > 12) journal.pop();
    journalList.innerHTML = "";
    journal.forEach(function (entry) {
      var li = document.createElement("li");
      li.textContent = entry;
      journalList.appendChild(li);
    });
    journalCount.textContent = journal.length + " " + plural(journal.length, ["запись", "записи", "записей"]);
  }

  function setStatus(text, kind) {
    brewStatus.textContent = text;
    brewStatus.className = "brew-status" + (kind ? " " + kind : "");
  }

  function renderScene() {
    var stage = model.STAGES[state.stage];
    locationText.textContent = stage.place;
    encounterText.textContent = "Варка " + Math.min(state.order + 1, model.ordersInStage(state)) + " / " + model.ordersInStage(state);
    intention.textContent = stage.mood;
    captionTitle.textContent = "Этап " + (state.stage + 1) + " · " + stage.name;
    captionText.textContent = stage.caption;
    dialogue.textContent = "«" + stage.dialogue + "»";
    scene.setAttribute("data-heat", state.heat >= 5 ? "high" : state.heat >= 3 ? "mid" : "low");
    trailItems.forEach(function (li, i) {
      li.classList.toggle("done", i < state.stage);
      if (i === state.stage) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
  }

  function renderOrder() {
    var stage = model.STAGES[state.stage];
    var recipe = model.currentRecipe(state);
    orderCover.hidden = state.phase !== "intro";
    orderCard.hidden = state.phase === "quiz";
    quizPanel.hidden = state.phase !== "quiz";
    if (!recipe) return;
    var vocab = model.VOCAB[recipe.glyph];
    orderGlyph.classList.remove("blind", "word");
    if (recipe.blind) {
      orderGlyph.textContent = "?";
      orderGlyph.classList.add("blind");
      orderGlyph.setAttribute("lang", "zh-CN");
      orderPy.textContent = vocab ? vocab.py : "";
    } else if (stage.targetMode === "meaning") {
      orderGlyph.textContent = vocab ? vocab.mean : "";
      orderGlyph.classList.add("word");
      orderGlyph.setAttribute("lang", "ru");
      orderPy.textContent = "";
    } else {
      orderGlyph.textContent = recipe.glyph;
      orderGlyph.setAttribute("lang", "zh-CN");
      orderPy.textContent = vocab ? vocab.py : "";
    }
    orderMeta.textContent = "Варка " + (state.order + 1) + " из " + model.ordersInStage(state) + " · " + stage.name + (recipe.blind ? " · заказ по слуху" : "");
    if (stage.hintMode === "open" || state.hintUsed) {
      orderHint.textContent = "Реагенты: " + recipe.parts.join(" + ");
      orderHint.classList.add("revealed");
    } else {
      orderHint.textContent = recipe.hint;
      orderHint.classList.remove("revealed");
    }
  }

  function renderQuiz() {
    if (state.phase !== "quiz" || !state.quiz) return;
    quizQuestion.textContent = state.quiz.question;
    quizTarget.textContent = state.quiz.glyph;
    quizOptions.innerHTML = "";
    state.quiz.options.forEach(function (option, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = option;
      btn.addEventListener("click", function () { answerQuiz(i); });
      quizOptions.appendChild(btn);
    });
  }

  function answerQuiz(index) {
    var out = model.answerQuiz(state, index);
    if (!out) return;
    if (out.correct) {
      sounds.right();
      setStatus("Котёл открыт: собирай реагенты!", "good");
      log("Экзамен сдан: Жаберт открывает котёл.");
    } else {
      sounds.wrong();
      hitHeat();
      setStatus("Неверно! Жаберт хмурится, жар очага упал.", "bad");
      log("Ошибка на экзамене Жаберта.");
    }
    renderAll();
    if (state.phase === "defeat") showOverlay("defeat");
  }

  function renderCauldron() {
    slots.forEach(function (slot, i) {
      var glyph = state.cauldron[i];
      slot.textContent = glyph || "";
      slot.classList.toggle("filled", !!glyph);
      slot.setAttribute("aria-label", glyph ? "Убрать реагент " + glyph + " из котла" : "Пустой слот котла");
      slot.disabled = !glyph || state.phase !== "ready" || busy;
    });
  }

  function renderHeat() {
    heatDots.forEach(function (dot, i) {
      dot.classList.toggle("on", i < state.heat);
    });
    heatText.textContent = state.heat + " / " + state.maxHeat;
    heroHeat.style.width = (state.heat / state.maxHeat * 100) + "%";
    heroHeatText.textContent = state.heat + " / " + state.maxHeat;
  }

  function hitHeat() {
    heatPanel.classList.remove("hit");
    void heatPanel.offsetWidth;
    heatPanel.classList.add("hit");
  }

  function renderStats() {
    statClean.textContent = state.stats.perfect + " / " + model.RECIPES.length;
    statFail.textContent = state.stats.mistakes + state.stats.timeouts;
    statQuiz.textContent = state.stats.quizRight + " / " + state.stats.quizWrong;
  }

  function renderGrimoire() {
    grimoire.innerHTML = "";
    var done = 0;
    UNIQUE_GLYPHS.forEach(function (glyph) {
      var cell = document.createElement("span");
      cell.className = "cell";
      var made = state.crafted.indexOf(glyph) !== -1;
      if (made) {
        cell.classList.add("done");
        done += 1;
        if (glyph === freshGlyph) {
          cell.classList.add("new");
          freshGlyph = "";
        }
      }
      cell.innerHTML = "<b></b><small></small>";
      cell.querySelector("b").textContent = glyph;
      cell.querySelector("small").textContent = model.VOCAB[glyph] ? model.VOCAB[glyph].py : "";
      cell.title = model.VOCAB[glyph] ? glyph + " · " + model.VOCAB[glyph].py + " · " + model.VOCAB[glyph].mean : glyph;
      grimoire.appendChild(cell);
    });
    grimoireCount.textContent = done + " / " + UNIQUE_GLYPHS.length + " " + plural(done, ["знак", "знака", "знаков"]);
  }

  function renderControls() {
    var stage = model.STAGES[state.stage];
    brewButton.disabled = state.phase !== "ready" || busy || !state.cauldron.length;
    clearButton.disabled = state.phase !== "ready" || busy || !state.cauldron.length;
    hintButton.hidden = stage.hintMode !== "hidden";
    hintButton.disabled = state.hintUsed || state.phase !== "ready" || busy;
    var hintCost = stage.hintCost || 1;
    hintButton.textContent = state.hintUsed ? "Рецепт показан" : "Подсказка · −" + hintCost + " " + plural(hintCost, ["жар", "жара", "жаров"]);
    chipButton.disabled = !state.chips || state.heat >= state.maxHeat || busy || (state.phase !== "ready" && state.phase !== "quiz");
    chipCount.textContent = "×" + state.chips;
  }

  function renderShelf() {
    if (drag && drag.ghost) {
      drag.ghost.remove();
      drag = null;
      document.body.classList.remove("over-cauldron");
    }
    shelfEl.innerHTML = "";
    var glyphs = state.phase === "intro" ? model.STAGES[0].shelf : model.shelf(state);
    glyphs.forEach(function (glyph) {
      var crafted = model.CHAIN_OUTPUTS.indexOf(glyph) !== -1;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flask" + (crafted ? " crafted" : "");
      btn.dataset.glyph = glyph;
      btn.setAttribute("lang", "zh-CN");
      btn.style.setProperty("--liquid", liquidFor(glyph));
      var vocab = model.VOCAB[glyph];
      btn.setAttribute("aria-label", "Реагент " + glyph + (vocab ? " (" + vocab.py + " — " + vocab.mean + ")" : "") + ": положить в котёл");
      btn.innerHTML = '<svg class="flask-svg" viewBox="0 0 60 84" aria-hidden="true"><use href="#flask"/></svg><span class="flask-glyph"></span><b class="flask-tag"></b>';
      btn.querySelector(".flask-glyph").textContent = glyph;
      btn.querySelector(".flask-tag").textContent = crafted ? "новый" : (vocab ? vocab.py : "");
      attachDrag(btn);
      shelfEl.appendChild(btn);
    });
  }

  function renderAll() {
    renderScene();
    renderOrder();
    renderQuiz();
    renderCauldron();
    renderHeat();
    renderStats();
    renderGrimoire();
    renderControls();
    renderShelf();
  }

  function dropGlyph(glyph) {
    var out = model.addElement(state, glyph);
    if (!out) return;
    if (!out.ok) {
      sounds.wrong();
      setStatus(out.full ? "В котле нет места: максимум " + model.CAULDRON_CAP + " реагента." : "Такого реагента нет на полке.", "bad");
      return;
    }
    sounds.drop();
    setStatus("");
    renderCauldron();
    renderControls();
    var slot = slots[state.cauldron.length - 1];
    if (slot) {
      slot.classList.remove("pop");
      void slot.offsetWidth;
      slot.classList.add("pop");
    }
  }

  function hitCauldron(x, y) {
    var zones = [$("cauldron-slots"), $("cauldron-hot")];
    for (var i = 0; i < zones.length; i++) {
      var r = zones[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    return false;
  }

  var drag = null;

  function attachDrag(btn) {
    btn.addEventListener("pointerdown", function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (state.phase !== "ready" || busy) return;
      drag = { glyph: btn.dataset.glyph, x: event.clientX, y: event.clientY, moved: false, ghost: null, btn: btn };
      try { btn.setPointerCapture(event.pointerId); } catch (err) { }
    });
    btn.addEventListener("pointermove", function (event) {
      if (!drag || drag.btn !== btn) return;
      var dx = event.clientX - drag.x;
      var dy = event.clientY - drag.y;
      if (!drag.moved && Math.sqrt(dx * dx + dy * dy) > 10) {
        drag.moved = true;
        var ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        ghost.style.setProperty("--liquid", liquidFor(drag.glyph));
        ghost.innerHTML = '<svg viewBox="0 0 60 84" aria-hidden="true"><use href="#flask"/></svg><span></span>';
        ghost.querySelector("span").textContent = drag.glyph;
        document.body.appendChild(ghost);
        drag.ghost = ghost;
      }
      if (drag.moved) {
        drag.ghost.style.left = event.clientX + "px";
        drag.ghost.style.top = event.clientY + "px";
        document.body.classList.toggle("over-cauldron", hitCauldron(event.clientX, event.clientY));
      }
    });
    function release(event) {
      if (!drag || drag.btn !== btn) return;
      var d = drag;
      drag = null;
      document.body.classList.remove("over-cauldron");
      if (d.ghost) d.ghost.remove();
      if (state.phase !== "ready" || busy) return;
      if (d.moved) {
        btn.dataset.dragconsumed = "1";
        setTimeout(function () { delete btn.dataset.dragconsumed; }, 300);
        if (hitCauldron(event.clientX, event.clientY)) dropGlyph(d.glyph);
      }
    }
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", function () {
      if (!drag || drag.btn !== btn) return;
      if (drag.ghost) drag.ghost.remove();
      drag = null;
      document.body.classList.remove("over-cauldron");
    });
    btn.addEventListener("click", function () {
      if (btn.dataset.dragconsumed) {
        delete btn.dataset.dragconsumed;
        return;
      }
      if (state.phase !== "ready" || busy) return;
      dropGlyph(btn.dataset.glyph);
    });
  }

  function sceneFlash(kind) {
    scene.classList.remove("flash-success", "flash-fail");
    void scene.offsetWidth;
    scene.classList.add(kind === "success" ? "flash-success" : "flash-fail");
    if (kind !== "success") {
      scene.classList.remove("shake");
      void scene.offsetWidth;
      scene.classList.add("shake");
    }
    setTimeout(function () { scene.classList.remove("flash-success", "flash-fail"); }, 800);
  }

  function doBrew() {
    if (state.phase !== "ready" || busy || !state.cauldron.length) return;
    var out = model.brew(state, state.token);
    if (!out) return;
    busy = true;
    renderControls();
    renderCauldron();
    if (out.success) {
      sounds.brew();
      sceneFlash("success");
      brewGlyph.textContent = out.result;
      brewGlyph.classList.remove("show");
      void brewGlyph.offsetWidth;
      brewGlyph.classList.add("show");
      setStatus("Реакция пошла! Знак " + out.result + " рождается в котле…", "good");
    } else {
      sounds.fail();
      sceneFlash("fail");
      smoke.classList.remove("show");
      void smoke.offsetWidth;
      smoke.classList.add("show");
      var msg;
      if (out.diag) {
        var inter = out.diag.intermediates.join(" и ");
        var interParts = model.FLATTEN[out.diag.intermediates[0]].join(" + ");
        msg = "Почти! Нужен готовый реагент " + inter + " (" + interParts + "), а не его части по отдельности. Свари " + inter + " отдельно и положи в котёл его" + (out.diag.rest.length ? " вместе с " + out.diag.rest.join(" + ") : "") + ".";
      } else if (out.cooled) {
        msg = "Котёл зашипел и остыл…";
      } else {
        msg = "Реакция не пошла: не те реагенты. Жар очага упал.";
      }
      setStatus(msg, "bad");
      hitHeat();
    }
    setTimeout(function () {
      busy = false;
      brewGlyph.classList.remove("show");
      smoke.classList.remove("show");
      if (state.phase === "defeat") {
        renderAll();
        showOverlay("defeat");
        return;
      }
      var result = model.finishBrew(state);
      if (result && result.success) {
        freshGlyph = result.glyph;
        var vocab = model.VOCAB[result.glyph];
        log("Сварен знак " + result.glyph + " — " + (vocab ? vocab.py + ", " + vocab.mean : "") + ".");
        setStatus("Гримуар пополнился: " + result.glyph + " (" + (vocab ? vocab.py + " — " + vocab.mean : "") + ").", "good");
        if (model.CHAIN_OUTPUTS.indexOf(result.glyph) !== -1) {
          log("Свежий реагент " + result.glyph + " падает на полку — он пойдёт в следующий рецепт.");
        }
        if (result.next === "stageclear") {
          sounds.clear();
          log("Этап «" + model.STAGES[state.stage].name + "» пройден! Код: " + result.code + ".");
          showOverlay("stageclear", result.code);
        } else if (result.next === "victory") {
          sounds.clear();
          log("Великий эликсир готов! Финальный код: " + result.code + ".");
          showOverlay("victory", result.code);
        }
      } else if (result && !result.success) {
        log(out.diag ? "Жаберт ворчит: " + out.diag.intermediates.join(" и ") + " должен попасть в котёл готовым реагентом." : "Варка сорвалась: Жаберт выплёскивает неудачную смесь в ведро.");
      }
      renderAll();
    }, 950);
  }

  function doClear() {
    if (state.phase !== "ready" || busy || !state.cauldron.length) return;
    sounds.take();
    while (state.cauldron.length) model.removeElement(state, 0);
    setStatus("Котёл вылит: начинай сбор заново.");
    renderCauldron();
    renderControls();
  }

  function doHint() {
    var ok = model.useHint(state);
    if (!ok) return;
    sounds.wrong();
    hitHeat();
    setStatus("Жаберт шепчет рецепт — но жар очага чуть упал.", "bad");
    renderAll();
    if (state.phase === "defeat") showOverlay("defeat");
  }

  function doChip() {
    var amount = model.useChip(state);
    if (!amount) return;
    sounds.chip();
    setStatus("Сосновая щепка в огне: +" + amount + " к жару.", "good");
    log("Синнабон подбрасывает щепку в очаг.");
    renderAll();
  }

  function artFor(mode) {
    var imgs = '<img src="../assets/characters/cinnabon.svg" alt="Синнабон" width="96" height="88"><img src="../assets/characters/zhabert.svg" alt="Жаберт" width="96" height="88">';
    var mark = mode === "victory" ? "月" : model.currentRecipe(state) ? model.currentRecipe(state).glyph : "月";
    if (mode === "intro") return imgs;
    return '<img src="../assets/characters/' + (mode === "defeat" ? "cinnabon" : "zhabert") + '.svg" alt="" width="96" height="88"><span class="zh-mark" lang="zh-CN">' + mark + "</span>";
  }

  function statsLine() {
    return "Чистых варок: " + state.stats.perfect + " / " + model.RECIPES.length +
      " · срывов: " + (state.stats.mistakes + state.stats.timeouts) +
      " · экзамен: " + state.stats.quizRight + " из " + (state.stats.quizRight + state.stats.quizWrong);
  }

  function showOverlay(mode, code) {
    overlayMode = mode;
    storyArt.innerHTML = artFor(mode);
    storyRules.hidden = mode !== "intro";
    reward.hidden = !(mode === "stageclear" || mode === "victory");
    codesList.hidden = mode !== "victory";
    if (mode === "intro") {
      storyEyebrow.textContent = "БОЛОТНАЯ АЛХИМИЯ";
      storyTitle.textContent = "Котёл ждёт помощника";
      storyText.textContent = "Глубоко на болоте, в хижине из коряг, живёт лягушка-алхимик Жаберт. Он варит Великий Эликсир Ясной Луны, но реагенты рассыпались по полкам! Синнабон надевает фартук: подавать колбы, мешать котёл и складывать иероглифы из частей — его работа.";
      storyPrimary.textContent = "Надеть фартук";
      storyFootnote.textContent = "3 этапа · 17 знаков · код после каждого этапа";
    } else if (mode === "stageclear") {
      storyEyebrow.textContent = "ЭТАП " + (state.stage + 1) + " ПРОЙДЕН";
      storyTitle.textContent = model.STAGES[state.stage].name + " звенит";
      storyText.textContent = model.STAGES[state.stage].teaser + " Гримуар и коды остаются с тобой, жар очага снова полный.";
      rewardLabel.textContent = "ТВОЙ КОД ЭТАПА " + (state.stage + 1);
      rewardCode.textContent = code;
      rewardStats.textContent = statsLine();
      storyPrimary.textContent = "Варить дальше";
    } else if (mode === "defeat") {
      storyEyebrow.textContent = "КОТЁЛ ОСТЫЛ";
      storyTitle.textContent = "Жаберт подбрасывает дров";
      storyText.textContent = "Шесть делений жара погасли, и варка замерла. Ничего страшного: гримуар, коды и пройденные этапы остаются с тобой — этот этап просто начнётся заново.";
      storyPrimary.textContent = "Разжечь очаг";
    } else {
      storyEyebrow.textContent = "ВЕЛИКИЙ ЭЛИКСИР ГОТОВ";
      storyTitle.textContent = "Луна в колбе светит ярко";
      storyText.textContent = "Все семнадцать знаков легли в гримуар, эликсир Ясной Луны бурлит в котле, а Жаберт от счастья сыграл туш на флейте. Синнабон получил пожизненный запас болотных крекеров.";
      rewardLabel.textContent = "ФИНАЛЬНЫЙ КОД";
      rewardCode.textContent = code;
      rewardStats.textContent = statsLine();
      codesItems.innerHTML = "";
      model.CODES.forEach(function (item, i) {
        var span = document.createElement("span");
        span.innerHTML = "<small>этап " + (i + 1) + "</small><b></b>";
        span.querySelector("b").textContent = item;
        codesItems.appendChild(span);
      });
      storyPrimary.textContent = "Сварить заново";
    }
    overlay.hidden = false;
  }

  storyPrimary.addEventListener("click", function () {
    if (overlayMode === "intro") {
      model.start(state);
      log("Синнабон надевает фартук и встаёт за котёл.");
      setStatus("Котёл открыт: собери реагенты и жми «Варить!».");
    } else if (overlayMode === "stageclear") {
      model.nextStage(state);
      log("Новый этап: «" + model.STAGES[state.stage].name + "».");
      setStatus("Новый этап, новый заказ Жаберта.");
    } else if (overlayMode === "defeat") {
      model.retryStage(state);
      log("Очаг разожжён, котёл греется заново.");
      setStatus("Пробуем этот этап ещё раз!");
    } else if (overlayMode === "victory") {
      state = model.create();
      model.start(state);
      journal = [];
      log("Синнабон возвращается к первому котлу: всё заново!");
      setStatus("Новая варка: собери реагенты.");
    }
    overlay.hidden = true;
    renderAll();
  });

  function setSound(on) {
    audio.on = on;
    soundButton.textContent = on ? "Звук: вкл." : "Звук: выкл.";
    soundButton.setAttribute("aria-pressed", on ? "true" : "false");
    storySound.textContent = soundButton.textContent;
    storySound.setAttribute("aria-pressed", on ? "true" : "false");
  }

  soundButton.addEventListener("click", function () { setSound(!audio.on); });
  storySound.addEventListener("click", function () { setSound(!audio.on); });

  brewButton.addEventListener("click", doBrew);
  clearButton.addEventListener("click", doClear);
  hintButton.addEventListener("click", doHint);
  chipButton.addEventListener("click", doChip);

  slots.forEach(function (slot, index) {
    slot.addEventListener("click", function () {
      if (model.removeElement(state, index)) {
        sounds.take();
        renderCauldron();
        renderControls();
      }
    });
  });

  var timerToken = -1;
  var timerStart = 0;

  setInterval(function () {
    var total = model.timerSeconds(state);
    if (state.phase !== "ready" || !total || busy || !overlay.hidden) {
      timerBox.hidden = true;
      return;
    }
    if (timerToken !== state.token) {
      timerToken = state.token;
      timerStart = Date.now();
    }
    var left = Math.max(0, total - (Date.now() - timerStart) / 1000);
    timerBox.hidden = false;
    timerFill.style.width = (left / total * 100) + "%";
    timerFill.classList.toggle("low", left / total < 0.3);
    timerText.textContent = Math.ceil(left) + " с";
    if (left <= 0) {
      var out = model.timeout(state, state.token);
      if (out) {
        sounds.fail();
        hitHeat();
        setStatus(out.cooled ? "Время вышло — котёл остыл…" : "Время вышло: варка сорвалась, жар упал.", "bad");
        log("Таймер Жаберта тикнул громче — варка сорвана.");
        renderAll();
        if (state.phase === "defeat") showOverlay("defeat");
      }
    }
  }, 150);

  renderAll();
  setStatus("Начни варку, чтобы открыть котёл.");
  showOverlay("intro");
})();
