(function () {
  "use strict";
  var model = window.CinnabonFarm;
  if (!model) return;
  var $ = function (id) { return document.getElementById(id); };
  var SAVE_KEY = "bonus3-farm-v2";
  var LEGACY_KEY = "bonus3-farm-v1";
  var legacyRaw = null;
  var legacyState = null;
  var autoTimer = null;
  var autoRemaining = 0;
  var autoStarted = 0;
  var shopMessage = "";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var SETTINGS_KEY = "bonus3-farm-settings-v1";
  var settings = { sound: true, calm: false };
  var state = model.create();
  var resumeState = null;
  var writer = null;
  var writerQuizOptions = null;
  var writerVersion = 0;
  var clip = null;
  var audioVersion = 0;
  var speech = null;
  var audioBusy = false;
  var audioContext = null;
  var clock = { active: false, left: 0, total: 0, last: performance.now() };
  var story = $("story-dialog");
  var dialogAction = null;
  var dialogSecondary = null;
  var dialogCanClose = false;
  var dialogReturnFocus = null;
  var dialogPausedTask = false;
  var lastResult = null;
  var effectTimer = null;
  var resizeTimer = null;
  var loadedSave = null;
  var TYPES = {
    write: { label: "01 / ПОСЕВ", title: "Посади иероглиф", description: "Напиши знак мышью или пальцем. Каждая верная черта помогает семени проснуться." },
    meaning: { label: "02 / ПОЛИВ", title: "Полей правильный смысл", description: "Что означает этот знак? Выбери лейку с верным переводом." },
    pinyin: { label: "03 / УХОД", title: "Помоги чтению вырасти", description: "Как читается этот знак? Выбери пиньинь — обязательно с правильным тоном." },
    sound: { label: "04 / СБОР УРОЖАЯ", title: "Собери знак на слух", description: "Послушай китайское звучание и выбери подходящий иероглиф на корзине." }
  };

  try {
    var storedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (storedSettings && typeof storedSettings.sound === "boolean" && typeof storedSettings.calm === "boolean") settings = storedSettings;
    loadedSave = localStorage.getItem(SAVE_KEY);
    resumeState = loadedSave ? model.restore(loadedSave) : null;
    legacyRaw = localStorage.getItem(LEGACY_KEY);
    legacyState = legacyRaw ? model.legacy(legacyRaw) : null;
  } catch (error) {}

  function save() {
    if (state.phase === "intro") return;
    try {
      localStorage.setItem(SAVE_KEY, model.serialize(state));
      $("save-status").textContent = "Урожай и коды сохранены";
    } catch (error) {
      $("save-status").textContent = "Сохранение недоступно в браузере";
    }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (error) {}
  }

  function sfx(success) {
    if (!settings.sound) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioContext) audioContext = new Ctx();
      if (audioContext.state === "suspended") audioContext.resume().catch(function () {});
      var notes = success ? [440, 554, 660] : [180];
      notes.forEach(function (frequency, i) {
        var oscillator = audioContext.createOscillator();
        var gain = audioContext.createGain();
        var at = audioContext.currentTime + i * 0.08;
        oscillator.type = "triangle";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.075, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
        oscillator.connect(gain); gain.connect(audioContext.destination);
        oscillator.onended = function () { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(at); oscillator.stop(at + 0.21);
      });
    } catch (error) {}
  }

  function stopAudio() {
    audioVersion += 1;
    if (clip) { clip.onended = null; clip.onerror = null; clip.pause(); clip = null; }
    if (speech && window.speechSynthesis) window.speechSynthesis.cancel();
    speech = null;
    audioBusy = false;
    $("listen-button").classList.remove("playing");
    $("listen-button").disabled = false;
    $("listen-label").textContent = "Послушать";
  }

  function clearWriter() {
    writerVersion += 1;
    if (writer) { writer.cancelQuiz(); writer.pauseAnimation(); writer = null; }
    writerQuizOptions = null;
    $("writer-target").replaceChildren();
  }

  function clearTask() {
    clearWriter();
    stopAudio();
    clock.active = false;
    clearTimeout(effectTimer);
    clearTimeout(autoTimer);
    autoTimer = null;
    autoRemaining = 0;
    $("hero").classList.remove("working");
    $("harvest-pop").hidden = true;
  }

  function feedback(message, type) {
    $("feedback").textContent = message;
    $("feedback").className = "feedback" + (type ? " " + type : "");
  }

  function renderHud() {
    var stage = model.STAGES[state.stage];
    $("coins").textContent = state.coins;
    $("farm-dashboard").hidden = state.phase === "intro";
    $("quality-status").textContent = state.quality.filter(Boolean).length + " золотых грядок";
    $("protections").replaceChildren();
    model.UPGRADES.forEach(function (item) {
      var badge = document.createElement("span");
      badge.className = "protection" + (state.charges[item.id] ? " charged" : "");
      badge.textContent = item.name + ": " + (state.charges[item.id] ? "1 защита" : state.bought[item.id] ? "израсходовано" : "нет");
      $("protections").appendChild(badge);
    });
    $("order-status").textContent = state.chain ? state.chain.name + " · " + state.chain.position + " / " + state.chain.ids.length : state.event ? "Событие в саду" : "Свободная работа · выбирай дела";
    $("shop-button").disabled = ["choice", "event"].indexOf(state.phase) === -1;
    document.body.classList.toggle("calm", settings.calm);
    $("scene").dataset.can = state.charges.can;
    $("scene").dataset.scarecrow = state.charges.scarecrow;
    $("scene").dataset.greenhouse = state.charges.greenhouse;
    $("score").textContent = state.score.toLocaleString("ru-RU");
    $("streak").textContent = state.streak;
    var done = state.index;
    $("progress-label").textContent = state.phase === "intro" ? "Первый сезон ждёт" : "Уход за садом: " + done + " / " + stage.count;
    $("progress-fill").style.width = done / stage.count * 100 + "%";
    $("task-number").textContent = String(Math.min(state.index + 1, stage.count)).padStart(2, "0") + " / " + stage.count;
    $("scene").dataset.season = state.stage;
    $("season-caption").textContent = stage.season.toUpperCase() + " · " + (state.stage === 3 ? "ЛУННАЯ ЯРМАРКА" : "ДЕНЬ " + String(state.stage + 1).padStart(2, "0"));
    $("farm-caption").textContent = stage.name;
    $("pause-button").disabled = ["choice", "event", "task", "feedback"].indexOf(state.phase) === -1;
    $("seasons").replaceChildren();
    model.STAGES.forEach(function (entry, index) {
      var item = document.createElement("div");
      item.className = "season" + (index === state.stage ? " current" : "") + (state.codes[index] ? " complete" : "");
      if (index === state.stage) item.setAttribute("aria-current", "step");
      var number = document.createElement("span"); number.className = "season-order"; number.textContent = "0" + (index + 1);
      var info = document.createElement("span"); info.className = "season-info";
      var title = document.createElement("b"); title.textContent = entry.season;
      var small = document.createElement("small"); small.textContent = entry.name;
      info.append(title, small);
      var code = document.createElement("span"); code.className = "season-code"; code.textContent = state.codes[index] || "—";
      item.append(number, info, code);
      $("seasons").appendChild(item);
    });
    renderGarden();
  }

  function renderGarden() {
    if (!$("garden").children.length) {
      model.VOCAB.forEach(function (_, i) {
        var plot = document.createElement("button");
        plot.type = "button";
        plot.className = "plot";
        plot.dataset.index = i;
        plot.addEventListener("click", function () {
          if (state.phase === "event" && state.event.ids.length) {
            var threatId = state.event.ids.find(function (id) { return state.plan[id].vocab === i; });
            if (threatId !== undefined) eventPick(threatId);
          } else if (state.phase === "choice") {
            var job = model.available(state).find(function (entry) { return entry.vocab === i && entry.type !== "sound"; });
            if (job) startJob(job.id);
          }
        });
        var plant = document.createElement("div"); plant.className = "plant";
        plant.appendChild(document.createElement("i"));
        var label = document.createElement("span"); label.className = "plot-label"; label.lang = "zh-CN";
        plot.append(plant, label);
        $("garden").appendChild(plot);
      });
    }
    var isSound = state.task && state.task.type === "sound" && state.phase === "task";
    var isMemory = state.task && state.task.type === "write" && state.phase === "task" && !model.STAGES[state.stage].outline && !state.task.hint;
    var hiddenLabels = isSound || isMemory;
    var jobs = model.available(state);
    $("hero").dataset.action = state.task ? state.task.type : "idle";
    $("scene").dataset.event = state.event ? (state.event.kind === "drought" ? "Засуха — спаси одну грядку" : state.event.kind === "pest" ? "Вредитель в саду" : "В саду гости") : state.chain ? state.chain.name : "";
    var hero = $("hero");
    hero.style.marginTop = "0px";
    if (state.task && !isSound) {
      var sceneRect = $("scene").getBoundingClientRect();
      var plotRect = $("garden").children[state.task.vocab].getBoundingClientRect();
      var heroWidth = window.innerWidth <= 480 ? 60 : 90;
      hero.style.left = Math.min(sceneRect.width - heroWidth - 12, plotRect.right - sceneRect.left + 8) + "px";
      hero.style.top = Math.max(200, plotRect.top - sceneRect.top - (window.innerWidth <= 480 ? 22 : 35)) + "px";
    } else {
      hero.style.left = "74%";
      hero.style.top = window.innerWidth <= 480 ? "230px" : window.innerWidth <= 780 ? "259px" : "325px";
    }
    Array.from($("garden").children).forEach(function (plot, i) {
      var total = state.plan.filter(function (spec) { return spec.vocab === i; }).length;
      plot.dataset.growth = state.growth[i] ? (state.growth[i] >= total ? 3 : 1) : 0;
      var threat = state.event && state.event.ids.some(function (id) { return state.plan[id].vocab === i; });
      var selectable = state.phase === "choice" && jobs.some(function (job) { return job.vocab === i && job.type !== "sound"; });
      plot.disabled = !(selectable || (state.phase === "event" && threat));
      plot.classList.toggle("available", selectable);
      plot.classList.toggle("threat", !!threat);
      plot.classList.toggle("ordinary", !state.quality[i]);
      plot.classList.toggle("wilted", state.wilted[i]);
      plot.classList.toggle("active", !!state.task && !isSound && state.task.vocab === i);
      plot.querySelector(".plot-label").textContent = hiddenLabels ? "·" : model.VOCAB[i].char;
      plot.setAttribute("aria-label", hiddenLabels ? "Грядка " + (i + 1) : "Грядка " + model.VOCAB[i].char + ", выполнено действий: " + state.growth[i]);
    });
  }

  function startJob(id) {
    if (!model.selectJob(state, state.token, id)) return;
    lastResult = null;
    renderTask(); save();
    if (window.innerWidth <= 780) $("task-panel").scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "auto" : "smooth" });
    if (state.task.type === "sound") $("listen-button").focus({ preventScroll: true });
  }

  function eventPick(choice) {
    if (!model.resolveEvent(state, state.token, choice)) return;
    save(); renderTask();
  }

  function workCard(title, description, type, action, number) {
    var card = document.createElement("button");
    card.className = "work-card"; card.type = "button";
    var icon = document.createElement("span"); icon.className = "tool-icon " + type; icon.setAttribute("aria-hidden", "true");
    var b = document.createElement("b"); b.textContent = title;
    var small = document.createElement("small"); small.textContent = description;
    var key = document.createElement("span"); key.className = "work-number"; key.textContent = number;
    card.append(icon, b, small, key); card.addEventListener("click", action);
    $("work-choices").appendChild(card);
  }

  function renderBoard() {
    $("work-board").hidden = false;
    $("task-panel").classList.add("in-choice");
    $("work-choices").replaceChildren();
    $("event-banner").textContent = state.notice;
    $("task-kind").textContent = state.phase === "event" ? "СОБЫТИЕ В САДУ" : "ТЫ РЕШАЕШЬ, ЧТО ДЕЛАТЬ";
    $("task-title").textContent = state.phase === "event" ? "Ферме нужна твоя забота" : state.chain ? state.chain.name : "Выбери следующее дело";
    $("task-description").textContent = state.chain ? "Поставка: " + (state.chain.position + 1) + " из " + state.chain.ids.length + ". У каждого действия свой инструмент." : "Работай с грядками, выбирай инструменты и трать монеты на защиту в лавке.";
    $("board-tip").textContent = "Карточки: клавиши 1–3 · Лавка доступна между делами.";
    if (state.phase === "event") {
      var kind = state.event.kind;
      $("event-banner").textContent = kind === "gift" ? "Сосед пришёл помочь. Вернуть золотое качество всех растений дождём или взять 4 монеты?" : kind === "drought" ? "Две грядки засыхают. Выбери, какую полить сейчас. Вторую спасёт запасная лейка; без неё потеряется только золотой бонус." : kind === "pest" ? "Вредитель пробрался к двум растениям. Спаси одно заданием; пугало защитит второе." : kind === "market" ? "Два покупателя, одна поставка из двух дел. Надёжный платит +2 монеты; гурман — +8, но только за чистые ответы." : "Лунные караваны ждут три дела. Тихая поставка даёт +3 монеты; премиальная +12 за чистую цепочку.";
      model.eventChoices(state).forEach(function (choice, i) {
        if (typeof choice === "number") {
          var job = state.plan[choice];
          workCard("Спасти «" + model.VOCAB[job.vocab].meaning.toLowerCase() + "»", "Следующее действие: " + TYPES[job.type].title.toLowerCase() + ".", job.type, function () { eventPick(choice); }, i + 1);
        } else {
          var title = choice === "rain" ? "Позвать весенний дождь" : choice === "coins" ? "Принять 4 монеты" : choice === "safe" ? "Надёжная поставка" : "Премиальный контракт";
          workCard(title, choice === "premium" ? "Больше награда, но ошибки отменяют только премию." : choice === "safe" ? "Гарантированная премия. Ошибки не срывают заказ." : "Выбор поможет следующим делам, новых заданий не добавится.", choice === "rain" ? "meaning" : "sound", function () { eventPick(choice); }, i + 1);
        }
      });
    } else {
      model.available(state).forEach(function (job, i) {
        var hidden = job.type === "sound" || (job.type === "write" && !model.STAGES[state.stage].outline);
        var title = job.type === "sound" ? "Собрать корзину на слух" : job.type === "write" ? "Посеять «" + model.VOCAB[job.vocab].meaning.toLowerCase() + "»" : job.type === "meaning" ? "Полить грядку " + model.VOCAB[job.vocab].char : "Помочь грядке " + model.VOCAB[job.vocab].char + " вырасти";
        workCard(title, hidden ? "Знак откроется только в самом испытании." : TYPES[job.type].description, job.type, function () { startJob(job.id); }, i + 1);
      });
    }
    $("farmer-line").textContent = "«" + state.notice + "»";
  }

  function shopDialog() {
    if (["choice", "event"].indexOf(state.phase) === -1) return;
    var shopToken = state.token;
    openDialog("ИНСТРУМЕНТЫ, А НЕ ПОДСКАЗКИ", "Лавка у амбара", function (content) {
      var wallet = addParagraph(content, "В кошельке: " + state.coins + " монет. " + shopMessage); wallet.className = "shop-wallet";
      model.UPGRADES.forEach(function (item) {
        var row = document.createElement("div"); row.className = "shop-row";
        var info = document.createElement("div"); var name = document.createElement("b"); name.textContent = item.name;
        info.appendChild(name); addParagraph(info, item.description);
        var button = document.createElement("button"); button.type = "button"; button.className = "quiet";
        button.textContent = state.bought[item.id] ? "Уже куплено" : item.price + " монет";
        button.disabled = state.bought[item.id] || state.coins < item.price;
        button.addEventListener("click", function () {
          if (model.buy(state, shopToken, item.id)) {
            shopMessage = item.name + " готова к работе."; save(); renderHud(); shopDialog();
          }
        });
        row.append(info, button); content.appendChild(row);
      });
      addParagraph(content, "Каждое улучшение покупается один раз за сезон и защищает один раз. В следующем сезоне защиты сбросятся. Покупки не обязательны.");
    }, "Вернуться к грядкам", function () { shopMessage = ""; renderTask(); }, null, null, true);
  }

  function armClock() {
    clock.total = model.seconds(state, settings.calm);
    clock.left = clock.total;
    clock.active = clock.total > 0;
    clock.last = performance.now();
    renderClock();
  }

  function renderClock() {
    $("timer").hidden = !clock.total;
    $("timer-fill").style.width = clock.total ? Math.max(0, clock.left / clock.total * 100) + "%" : "100%";
    $("timer-text").textContent = Math.ceil(clock.left) + " с";
    $("timer").classList.toggle("urgent", clock.left <= 7);
  }

  function renderAnswers() {
    $("answers").replaceChildren();
    var task = state.task;
    $("answers").className = "answers tool-" + task.type + (task.type === "sound" ? " glyph-answers" : "");
    task.options.forEach(function (value, i) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "answer";
      button.disabled = state.phase !== "task" || (task.type === "sound" && !task.heard);
      var number = document.createElement("span"); number.className = "answer-number"; number.textContent = i + 1; number.setAttribute("aria-hidden", "true");
      var text = document.createElement("span"); text.className = "answer-value"; text.textContent = value;
      if (task.type === "sound" || task.type === "pinyin") text.lang = "zh-CN";
      button.append(number, text);
      button.addEventListener("click", function () { choose(value, button); });
      $("answers").appendChild(button);
    });
  }

  function writerError(message) {
    clock.active = false;
    clearWriter();
    openDialog("НЕБОЛЬШАЯ ПАУЗА", "Грядка подождёт", function (content) {
      addParagraph(content, message + " Силы и урожай не теряются. Проверь наличие vendor/hanzi-writer.min.js и char-data.js в папке сайта.");
    }, "Повторить загрузку", function () { buildWriter(); }, "Остаться на паузе", pauseDialog, false);
  }

  function buildWriter() {
    clearWriter();
    if (state.phase !== "task" || state.task.type !== "write") return;
    var task = state.task;
    var entry = model.VOCAB[task.vocab];
    var stage = model.STAGES[state.stage];
    var data = window.HANZI_DATA && window.HANZI_DATA[entry.char];
    if (!window.HanziWriter || !data) { writerError("Не удалось открыть стол для письма."); return; }
    var version = writerVersion;
    var token = state.token;
    var size = Math.floor($("writer-target").getBoundingClientRect().width) || 276;
    var instance;
    try {
      instance = window.HanziWriter.create($("writer-target"), entry.char, {
        width: size, height: size, padding: 16, showCharacter: false,
        showOutline: stage.outline || task.hint, strokeColor: "#365b3d", radicalColor: "#365b3d",
        drawingColor: "#365b3d", outlineColor: "#c2b89e", highlightColor: "#be9348", drawingWidth: 7,
        strokeAnimationSpeed: 1.5, delayBetweenStrokes: 250,
        charDataLoader: function () { return data; },
        onLoadCharDataSuccess: function () {
          setTimeout(function () {
            if (version !== writerVersion || state.token !== token || state.phase !== "task") return;
            armClock();
          }, 0);
        },
        onLoadCharDataError: function () { if (version === writerVersion) writerError("Данные черт не прочитались."); }
      });
      writer = instance;
      writerQuizOptions = {
        showHintAfterMisses: stage.hints, highlightOnComplete: false, acceptBackwardsStrokes: false,
        leniency: stage.leniency,
        onCorrectStroke: function (result) {
          if (version !== writerVersion) return;
          if (model.stroke(state, token, result.strokeNum)) {
            $("stroke-status").textContent = "Черта " + state.task.strokes + " / " + entry.strokes;
            $("writer-status").textContent = "Росток проснулся. Продолжай по порядку.";
            save();
          }
        },
        onMistake: function () {
          if (version !== writerVersion) return;
          var result = model.strokeMistake(state, token);
          if (!result) return;
          sfx(false);
          renderHud(); save();
          $("writer-status").textContent = result.warning ? "Проверь направление и порядок черт. Ошибки: " + state.task.strokeErrors + " / " + stage.threshold + "." : result.protected ? "Теплица сохранила качество. Исправь черту." : "Росток поник. Верная черта его восстановит — продолжай!";
        },
        onComplete: function () {
          if (version !== writerVersion) return;
          var result = model.completeWriting(state, token);
          if (result) success(result);
        }
      };
      if (!state.paused) instance.quiz(writerQuizOptions);
      else instance.pauseAnimation();
    } catch (error) { writerError("Библиотека письма не смогла запуститься."); }
  }

  function renderTask() {
    clearTask();
    renderHud();
    feedback("", "");
    $("task-idle").hidden = true;
    $("continue-button").hidden = true;
    $("keyboard-tip").hidden = false;
    $("writer-area").hidden = true;
    $("listen-area").hidden = true;
    $("question-glyph").textContent = "";
    $("question-reading").textContent = "";
    $("answers").replaceChildren();
    $("timer").hidden = true;
    $("work-board").hidden = true;
    $("task-panel").classList.remove("in-choice");
    $("task-panel").classList.toggle("moon-task", state.stage === 3);
    clock.total = 0;
    if (state.phase === "choice" || state.phase === "event") { renderBoard(); return; }
    if (!state.task) return;
    var task = state.task;
    var entry = model.VOCAB[task.vocab];
    var stage = model.STAGES[state.stage];
    var type = TYPES[task.type];
    $("task-kind").textContent = type.label;
    $("task-title").textContent = type.title;
    $("task-description").textContent = type.description;
    if (state.event && state.event.selected !== null) {
      $("task-title").textContent = state.event.kind === "drought" ? "Спаси грядку от засухи" : "Отгони вредителя";
      $("task-description").textContent = type.description + " Верный ответ спасёт выбранное растение.";
    } else if (state.chain) $("task-kind").textContent = state.chain.name.toUpperCase() + " · " + (state.chain.position + 1) + " / " + state.chain.ids.length;
    $("farmer-line").textContent = task.type === "sound" ? "«Не смотри на таблички. Доверься ушам — урожай сам тебя позовёт!»" : "«Грядка «" + entry.meaning.toLowerCase() + "» ждёт заботы. У тебя всё получится!»";
    if (task.type === "write") {
      $("writer-area").hidden = false;
      if (stage.outline || task.hint) {
        $("question-glyph").textContent = entry.char;
        $("question-reading").textContent = entry.pinyin + " · " + entry.meaning;
      } else {
        $("question-reading").textContent = entry.meaning + " · " + entry.pinyin;
        $("task-description").textContent = "Напиши по памяти знак по значению и чтению. Контур скрыт — порядок черт важен.";
      }
      $("hint-button").hidden = state.stage < 2;
      $("hint-button").disabled = task.hint;
      $("hint-button").textContent = task.hint ? "Образец открыт" : "Образец · без бонуса";
      $("stroke-status").textContent = "Черта " + task.strokes + " / " + entry.strokes;
      $("writer-status").textContent = stage.outline ? "Пиши по контуру, черта за чертой." : "Пиши по памяти, черта за чертой.";
      if (state.phase === "task") buildWriter();
    } else {
      if (task.type === "sound") {
        $("listen-area").hidden = false;
        $("audio-status").textContent = "Сначала послушай, затем выбери знак. Повторы не штрафуются.";
      } else $("question-glyph").textContent = entry.char;
      renderAnswers();
      if (task.type !== "sound" && state.phase === "task") armClock();
    }
    if (state.phase === "feedback") { showFeedback(); scheduleAdvance(); }
  }

  function choose(value, button) {
    var result = model.answer(state, state.token, value);
    if (!result) return;
    if (result.correct) { button.classList.add("right"); success(result); return; }
    button.classList.add("wrong");
    button.disabled = true;
    sfx(false); renderHud(); save();
    var consequence = result.protected ? " Теплица сохранила качество, но ответ нужно исправить." : " Росток поник, верный ответ его восстановит.";
    if (state.task.type === "sound") {
      feedback("Этот знак звучит иначе. Послушай ещё раз и выбери другую корзину." + consequence, "error");
    } else if (state.task.type === "pinyin") {
      feedback("Не то чтение. Проверь слог и тон на другом мешочке." + consequence, "error");
    } else feedback("Этот смысл принадлежит другому знаку. Выбери другую лейку." + consequence, "error");
  }

  function showFeedback() {
    var entry = model.VOCAB[state.task.vocab];
    $("question-glyph").textContent = entry.char;
    $("question-reading").textContent = entry.pinyin + " · " + entry.meaning;
    $("continue-button").hidden = false;
    $("timer").hidden = true;
    $("hint-button").disabled = true;
    $("listen-button").disabled = true;
    if (state.task.type === "write") {
      $("stroke-status").textContent = "Черта " + entry.strokes + " / " + entry.strokes;
      $("writer-status").textContent = "Все черты завершены. Иероглиф написан!";
    }
    Array.from($("answers").children).forEach(function (button) {
      button.disabled = true;
      if (button.querySelector(".answer-value").textContent === state.task.correct) button.classList.add("right");
    });
    var amount = lastResult ? " +" + lastResult.gained + " зёрнышек, +" + lastResult.coins + " монет." : "";
    feedback("Верно! " + entry.char + " · " + entry.pinyin + " — " + entry.meaning.toLowerCase() + "." + amount, "success");
    $("farmer-line").textContent = state.task.dirty ? "«Ошибаться можно. Главное — продолжать заботиться о своём саде!»" : "«Смотри, как подросло! Чистые ответы — лучшее удобрение.»";
    renderGarden();
  }

  function success(result) {
    lastResult = result;
    clock.active = false;
    stopAudio();
    if (writer) writer.showCharacter({ duration: 0 });
    renderHud(); showFeedback(); save(); sfx(true);
    $("hero").classList.add("working");
    var plot = $("garden").children[state.task.vocab];
    plot.classList.add("growing");
    $("harvest-pop").textContent = "+" + result.gained;
    $("harvest-pop").hidden = false;
    effectTimer = setTimeout(function () {
      $("hero").classList.remove("working");
      plot.classList.remove("growing");
      $("harvest-pop").hidden = true;
    }, 1200);
    $("continue-button").focus({ preventScroll: true });
    scheduleAdvance();
  }

  function scheduleAdvance() {
    clearTimeout(autoTimer);
    if (state.phase !== "feedback") return;
    if (!autoRemaining) autoRemaining = reducedMotion.matches ? 0 : 1700;
    if (state.paused || story.open || document.hidden) return;
    var token = state.token;
    autoStarted = performance.now();
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (state.token !== token || state.phase !== "feedback" || state.paused || story.open || document.hidden) return;
      completeFeedback();
    }, autoRemaining);
  }

  function completeFeedback() {
    if (!model.advance(state, state.token)) return;
    lastResult = null;
    clearTask(); save(); renderTask(); showPhase();
  }

  function audioFailed(version, token) {
    if (version !== audioVersion || token !== state.token) return;
    var voice = window.speechSynthesis && window.speechSynthesis.getVoices().find(function (candidate) { return /^zh(?:-|_)(?:CN|Hans)/i.test(candidate.lang); });
    if (voice) {
      speech = new SpeechSynthesisUtterance(model.VOCAB[state.task.vocab].char);
      speech.lang = "zh-CN"; speech.voice = voice; speech.rate = 0.8;
      speech.onend = function () { audioFinished(version, token); };
      speech.onerror = function () { audioUnavailable(version, token); };
      window.speechSynthesis.speak(speech);
    } else audioUnavailable(version, token);
  }

  function audioUnavailable(version, token) {
    if (version !== audioVersion || token !== state.token) return;
    stopAudio();
    clock.active = false;
    $("audio-status").textContent = "Запись не воспроизвелась. Проверь звук и папку audio, затем нажми «Послушать». Штрафа нет.";
    feedback("Без звучания угадывать не нужно. Попробуй воспроизвести запись ещё раз.", "error");
  }

  function audioFinished(version, token) {
    if (version !== audioVersion || token !== state.token || state.paused) return;
    var first = !state.task.heard;
    audioBusy = false;
    $("listen-button").classList.remove("playing");
    $("listen-button").disabled = false;
    $("listen-label").textContent = "Послушать ещё раз";
    if (!model.hear(state, token)) return;
    $("audio-status").textContent = "Теперь выбери знак. Можно слушать сколько угодно.";
    Array.from($("answers").children).forEach(function (button) { if (!button.classList.contains("wrong")) button.disabled = false; });
    if (first || !clock.active) armClock();
    clock.last = performance.now();
    save();
  }

  function playAudio() {
    if (state.phase !== "task" || state.paused || state.task.type !== "sound" || audioBusy) return;
    stopAudio();
    var version = audioVersion;
    var token = state.token;
    audioBusy = true;
    $("listen-button").disabled = true;
    $("listen-button").classList.add("playing");
    $("listen-label").textContent = "Слушаем…";
    $("audio-status").textContent = "Прислушайся к слогу и тону. Таймер во время записи не идёт.";
    clip = new Audio(model.VOCAB[state.task.vocab].audio);
    clip.onended = function () { audioFinished(version, token); };
    clip.onerror = function () { audioFailed(version, token); };
    clip.play().catch(function () { audioFailed(version, token); });
  }

  function onTimeout() {
    var result = model.timeout(state, state.token);
    if (!result) return;
    clock.active = false;
    save();
    renderTask();
    feedback(result.protected ? "Время закончилось. Теплица сохранила качество. Попробуй ещё раз." : "Время закончилось. Росток поник, но задание и урожай не потеряны. Попробуй ещё раз.", "error");
    sfx(false);
  }

  function addParagraph(content, text) {
    var p = document.createElement("p"); p.textContent = text; content.appendChild(p); return p;
  }

  function openDialog(eyebrow, title, build, primary, action, secondary, secondaryAction, canClose) {
    if (!story.open) {
      dialogReturnFocus = document.activeElement;
      dialogPausedTask = state.phase === "task" || state.phase === "feedback";
      if (dialogPausedTask) {
        if (state.phase === "feedback" && autoTimer) {
          autoRemaining = Math.max(0, autoRemaining - (performance.now() - autoStarted));
          clearTimeout(autoTimer); autoTimer = null;
        }
        model.pause(state, true);
        if (writer && state.phase === "task") { writer.cancelQuiz(); writer.pauseAnimation(); }
      }
    }
    stopAudio();
    if (state.phase === "task" && state.task.type === "sound" && state.task.heard) {
      $("listen-label").textContent = "Послушать ещё раз";
      $("audio-status").textContent = "Выбери знак или прослушай запись ещё раз.";
    }
    $("scene").classList.add("is-paused");
    $("task-panel").classList.add("paused-mask");
    $("dialog-eyebrow").textContent = eyebrow;
    $("dialog-title").textContent = title;
    $("dialog-content").replaceChildren();
    build($("dialog-content"));
    $("dialog-primary").textContent = primary;
    $("dialog-secondary").hidden = !secondary;
    $("dialog-secondary").textContent = secondary || "";
    dialogAction = action;
    dialogSecondary = secondaryAction;
    dialogCanClose = !!canClose;
    if (!story.open) story.showModal();
  }

  function closeDialog() {
    if (!story.open) return;
    story.close();
    if (dialogPausedTask) {
      model.pause(state, false);
      if (state.phase === "task" && writer && writerQuizOptions) {
        writer.resumeAnimation();
        writer.quiz(Object.assign({}, writerQuizOptions, { quizStartStrokeNum: state.task.strokes }));
      }
    }
    dialogPausedTask = false;
    clock.last = performance.now();
    $("scene").classList.remove("is-paused");
    $("task-panel").classList.remove("paused-mask");
    if (state.phase === "feedback") scheduleAdvance();
    if (dialogReturnFocus && document.contains(dialogReturnFocus) && !dialogReturnFocus.disabled) dialogReturnFocus.focus({ preventScroll: true });
  }

  function copyCode(code, button) {
    function fallback() {
      var input = document.createElement("textarea");
      input.value = code; input.setAttribute("readonly", "");
      input.style.position = "fixed"; input.style.opacity = "0";
      story.appendChild(input); input.select();
      try { button.textContent = document.execCommand("copy") ? "Скопировано" : "Запиши код"; } catch (error) { button.textContent = "Запиши код"; }
      input.remove(); button.focus();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(function () { button.textContent = "Скопировано"; }).catch(fallback);
    else fallback();
  }

  function codeCard(content, index, source) {
    var savedCode = (source || state).codes[index];
    var card = document.createElement("div"); card.className = "code-card";
    var info = document.createElement("div");
    var small = document.createElement("small"); small.textContent = "ЭТАП " + (index + 1) + " · " + model.STAGES[index].name;
    var code = document.createElement("code"); code.textContent = savedCode;
    var button = document.createElement("button"); button.type = "button"; button.className = "quiet"; button.textContent = "Копировать";
    button.setAttribute("aria-label", "Копировать код этапа " + (index + 1));
    button.addEventListener("click", function () { copyCode(savedCode, button); });
    info.append(small, code); card.append(info, button); content.appendChild(card);
  }

  function introDialog() {
    openDialog("ДЕВЯТЬ СЕМЯН · ЧЕТЫРЕ УРОЖАЯ", "Добро пожаловать на ферму", function (content) {
      addParagraph(content, "Синнабон получил девять грядок. Помоги ему вырастить урожай: пиши знаки, выбирай перевод и пиньинь, узнавай иероглифы на слух.");
      var list = document.createElement("div"); list.className = "dialog-list";
      ["Посев — напиши знак мышью или пальцем через Hanzi Writer.", "Полив и уход — найди смысл и чтение с верным тоном.", "Сбор — послушай запись и выбери знак. Одинаковые чтения не спорят в одном задании."].forEach(function (text) { var row = document.createElement("div"); row.textContent = text; list.appendChild(row); });
      content.appendChild(list);
      addParagraph(content, "Выбирай, какой грядкой заняться. Каждые четыре дела — новое событие: дождь, вредители или покупатели. За работу получай монеты, покупай защиту в лавке. Ошибки не обнуляют сезон: следующий верный ответ восстановит росток.");
      addParagraph(content, "После правильного ответа Синнабон поработает и сам вернётся к выбору дел. Последние четыре дела — финальная поставка за секретный код.");
      addCalmSetting(content);
    }, "Посадить первое семя", function () { model.start(state); renderTask(); save(); }, "Закрыть", function () {}, true);
  }

  function pauseDialog() {
    if (["choice", "event", "task", "feedback"].indexOf(state.phase) === -1) return;
    openDialog("СИННАБОН ОТДЫХАЕТ", "Тихая пауза", function (content) {
      addParagraph(content, "Таймер остановлен. Грядки, урожай и коды ждут тебя. Нажми «Продолжить», когда будешь готов.");
    }, "Продолжить работу", function () {
      if (state.phase === "task" && state.task.type === "write" && !writer) buildWriter();
    }, null, null, true);
  }

  function stageDialog() {
    clearTask(); renderHud();
    var stage = model.STAGES[state.stage];
    openDialog("СЕЗОН " + (state.stage + 1) + " ЗАВЕРШЁН", "Урожай собран!", function (content) {
      addParagraph(content, "«" + stage.name + "» пройден. Твой секретный код — в деревянном ящике. Он также сохранён в журнале фермы.");
      codeCard(content, state.stage);
      addParagraph(content, "Следующий сезон: " + model.STAGES[state.stage + 1].description);
      addParagraph(content, "Монеты сохранятся. Одноразовые защиты начнутся заново — их можно купить в лавке следующего сезона.");
    }, "Открыть следующий сезон", function () { model.nextStage(state); lastResult = null; renderTask(); save(); }, null, null, false);
  }

  function victoryDialog() {
    clearTask(); renderHud();
    $("task-title").textContent = "Сад полон знаний";
    $("task-description").textContent = "Все четыре урожая собраны. Синнабон тобой гордится!";
    openDialog("ПРАЗДНИК ЛУННОГО УРОЖАЯ", "Фермер с характером", function (content) {
      addParagraph(content, "Все девять знаков пустили корни. Синнабон открывает ярмарку, а ты забираешь четыре заслуженных кода.");
      state.codes.forEach(function (_, i) { codeCard(content, i); });
      var stats = document.createElement("div"); stats.className = "stats-grid";
      [[state.score, "зёрнышек"], [state.stats.perfect, "чистых ответов"], [state.stats.mistakes, "попыток с ошибкой"]].forEach(function (item) {
        var cell = document.createElement("div"); var b = document.createElement("b"); b.textContent = item[0]; var small = document.createElement("small"); small.textContent = item[1]; cell.append(b, small); stats.appendChild(cell);
      });
      content.appendChild(stats);
      var review = model.VOCAB.filter(function (entry) { return state.misses[entry.char]; });
      if (review.length) {
        addParagraph(content, "Этим росткам пригодится ещё немного заботы:");
        review.forEach(function (entry) { addParagraph(content, entry.char + " · " + entry.pinyin + " — " + entry.meaning + " (ошибок: " + state.misses[entry.char] + ")"); });
      } else addParagraph(content, "Ни одной ошибки! Твой сад сияет.");
    }, "Новый урожай", resetDialog, "Полюбоваться фермой", function () {}, true);
  }

  function addCalmSetting(content) {
    addSetting(content, "calm", "Спокойный режим", "Без таймеров. Задания и подсказки всё равно усложняются.");
  }

  function addSetting(content, key, title, description) {
    var row = document.createElement("label"); row.className = "setting-row";
    var input = document.createElement("input"); input.type = "checkbox"; input.checked = settings[key];
    input.addEventListener("change", function () {
      settings[key] = input.checked; saveSettings();
      document.body.classList.toggle("calm", settings.calm);
      if (key === "calm" && state.phase === "task") {
        if (settings.calm) { clock.total = 0; clock.active = false; renderClock(); }
        else if (state.task.type !== "sound" || state.task.heard) armClock();
      }
    });
    var text = document.createElement("span"); text.textContent = title;
    var small = document.createElement("small"); small.textContent = description; text.appendChild(small);
    row.append(input, text); content.appendChild(row);
  }

  function settingsDialog() {
    openDialog("ПОД ТВОЙ РИТМ", "Настройки фермы", function (content) {
      addSetting(content, "sound", "Звуки фермы", "Короткие сигналы успеха и ошибки. Учебные записи работают независимо.");
      addCalmSetting(content);
      addParagraph(content, "Чтобы рисовать, веди мышью или пальцем в светлом квадрате. На телефоне листай страницу вне квадрата.");
    }, "Сохранить и вернуться", function () {}, null, null, true);
  }

  function journalDialog() {
    var journalState = state.phase === "intro" ? (resumeState || legacyState || state) : state;
    openDialog("ЗАПИСКИ СИННАБОНА", "Журнал фермы", function (content) {
      if (!journalState.codes.length) addParagraph(content, "Коды появятся здесь после завершения сезонов. Двери следующего сезона открываются только после урожая.");
      journalState.codes.forEach(function (_, i) { codeCard(content, i, journalState); });
      addParagraph(content, "Девять семян твоей фермы:");
      var list = document.createElement("div"); list.className = "dialog-list";
      model.VOCAB.forEach(function (entry) {
        var row = document.createElement("div"); row.textContent = entry.char + " · " + entry.pinyin + " — " + entry.meaning.toLowerCase(); list.appendChild(row);
      });
      content.appendChild(list);
      addParagraph(content, "明 и 名 читаются míng, а 夕 и 息 — xī. В заданиях на слух одинаковое чтение всегда представлено только одним знаком.");
    }, "Вернуться на ферму", function () {}, null, null, true);
  }

  function migrationDialog() {
    openDialog("ТВОИ КОДЫ НЕ ПРОПАДУТ", "Ферма стала живее", function (content) {
      addParagraph(content, "Найдено прежнее прохождение. Перенесём его коды, общий урожай и статистику. " + (legacyState.phase === "victory" ? "Все четыре сезона уже завершены — проходить заново не нужно." : "Незавершённый сезон начнётся с новых дел и четырьмя монетами; прежние завершённые сезоны сохранятся."));
      legacyState.codes.forEach(function (_, i) { codeCard(content, i, legacyState); });
      addParagraph(content, "Оригинальное сохранение не удаляется. Можно начать отдельный новый урожай, а старые коды останутся в прежнем сейве.");
    }, "Перенести мою ферму", function () {
      state = model.migrate(legacyRaw); lastResult = null;
      renderTask(); save(); showPhase();
    }, "Отдельный новый урожай", function () { introDialog(); }, true);
  }

  function resetDialog() {
    openDialog("НОВЫЙ ЦИКЛ", "Начать с чистой грядки?", function (content) {
      addParagraph(content, "Урожай, прогресс и коды этого прохождения будут сброшены. Сначала сохрани нужные коды из журнала. Настройки останутся.");
    }, "Да, начать заново", function () {
      clearTask();
      state = model.create(); resumeState = null; lastResult = null;
      try { localStorage.removeItem(SAVE_KEY); } catch (error) {}
      model.start(state); renderTask(); save();
    }, "Оставить урожай", function () { showPhase(); }, false);
  }

  function showPhase() {
    if (state.phase === "stageclear") stageDialog();
    else if (state.phase === "victory") victoryDialog();
    else if (state.phase === "choice" || state.phase === "event") $("work-choices").querySelector("button").focus({ preventScroll: true });
  }

  $("dialog-primary").addEventListener("click", function () { var action = dialogAction; closeDialog(); if (action) action(); });
  $("dialog-secondary").addEventListener("click", function () { var action = dialogSecondary; closeDialog(); if (action) action(); });
  story.addEventListener("cancel", function (event) { event.preventDefault(); if (dialogCanClose) closeDialog(); });
  $("start-button").addEventListener("click", function () {
    if (resumeState) {
      state = resumeState; resumeState = null; lastResult = null;
      renderTask(); showPhase(); save();
    } else if (legacyState) migrationDialog();
    else introDialog();
  });
  $("continue-button").addEventListener("click", completeFeedback);
  $("listen-button").addEventListener("click", playAudio);
  $("hint-button").addEventListener("click", function () {
    if (!model.hint(state, state.token)) return;
    if (writer) writer.showOutline();
    $("question-glyph").textContent = model.VOCAB[state.task.vocab].char;
    $("hint-button").disabled = true;
    $("hint-button").textContent = "Образец открыт";
    feedback("Образец открыт. Напиши знак: обычный урожай сохранится, бонус чистого ответа — нет.", "");
    renderHud(); save();
  });
  $("pause-button").addEventListener("click", pauseDialog);
  $("settings-button").addEventListener("click", settingsDialog);
  $("journal-button").addEventListener("click", journalDialog);
  $("shop-button").addEventListener("click", function () { shopMessage = ""; shopDialog(); });
  $("restart-button").addEventListener("click", resetDialog);
  document.addEventListener("keydown", function (event) {
    if (story.open || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key === "Escape" && ["choice", "event", "task", "feedback"].indexOf(state.phase) !== -1) { event.preventDefault(); pauseDialog(); return; }
    if ((state.phase === "choice" || state.phase === "event") && /^[1-3]$/.test(event.key)) {
      var work = $("work-choices").children[Number(event.key) - 1];
      if (work) { event.preventDefault(); work.click(); }
    }
    if (state.phase === "task" && !state.paused && /^[1-6]$/.test(event.key)) {
      var button = $("answers").children[Number(event.key) - 1];
      if (button && !button.disabled) { event.preventDefault(); button.click(); }
    }
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && ["task", "feedback"].indexOf(state.phase) !== -1) { if (!story.open) pauseDialog(); save(); }
    clock.last = performance.now();
  });
  window.addEventListener("pagehide", save);
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (state.phase !== "task" || state.task.type !== "write" || !writer) return;
      var size = Math.floor($("writer-target").getBoundingClientRect().width);
      if (size > 0) writer.updateDimensions({ width: size, height: size });
    }, 150);
  });
  setInterval(function () {
    var now = performance.now();
    var elapsed = (now - clock.last) / 1000;
    clock.last = now;
    if (!clock.active || state.phase !== "task" || state.paused || document.hidden || story.open || audioBusy) return;
    clock.left = Math.max(0, clock.left - elapsed);
    renderClock();
    if (clock.left === 0) onTimeout();
  }, 100);

  renderHud();
  if (resumeState) {
    $("start-button").textContent = "Продолжить мой урожай →";
    $("task-description").textContent = "Твоя ферма ждёт. Сохранено: сезон " + (resumeState.stage + 1) + ", урожай " + resumeState.score + " зёрнышек.";
    $("save-status").textContent = "Сохранённое прохождение найдено";
  } else if (legacyState) {
    $("start-button").textContent = "Перенести прежнюю ферму →";
    $("save-status").textContent = "Старые коды сохранены. Доступен перенос.";
  } else if (loadedSave) $("save-status").textContent = "Сейв не подходит — начни новый урожай";
}());
