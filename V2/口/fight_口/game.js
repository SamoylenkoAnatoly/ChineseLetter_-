document.addEventListener("DOMContentLoaded", function () {
  "use strict";
  var model = window.ForestBattle;
  var state = model.create();
  var writer = null;
  var libraryTask = null;
  var session = 0;
  var loadVersion = 0;
  var outline = true;
  var primaryAction = null;
  var secondaryAction = null;
  var previousFocus = null;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var bossPhaseSeen = 1;
  var resolutionTimer = null;
  var libraryUrl = "https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js";
  var gateBank = {
    pinyin: { prompt: "Как читается этот иероглиф?", options: ["kǒu", "mù", "yuè", "xīn"], correct: "kǒu" },
    meaning: { prompt: "Что означает этот иероглиф?", options: ["рот", "глаз", "луна", "сердце"], correct: "рот" }
  };
  var $ = function (id) { return document.getElementById(id); };
  var scene = $("scene");
  var target = $("writer-target");
  var overlay = $("overlay");
  var card = overlay.querySelector(".story-card");
  var shell = document.querySelector(".page-shell");
  var cover = $("writer-cover");
  var gameArea = $("game-area");

  var audio = { ctx: null, master: null, enabled: loadSound(), started: false };
  function loadSound() {
    try { return localStorage.getItem("fight-kou-sound") !== "0"; } catch (error) { return true; }
  }
  function saveSound(on) {
    try { localStorage.setItem("fight-kou-sound", on ? "1" : "0"); } catch (error) {}
  }
  function ensureAudio() {
    if (audio.started) {
      if (audio.ctx && audio.ctx.state === "suspended" && audio.enabled) audio.ctx.resume().catch(function () {});
      return;
    }
    audio.started = true;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.enabled ? 0.5 : 0;
      audio.master.connect(audio.ctx.destination);
    } catch (error) { audio.ctx = null; }
  }
  document.addEventListener("pointerdown", ensureAudio, { capture: true });
  document.addEventListener("keydown", ensureAudio, { capture: true });
  function tone(delay, duration, type, from, to, peak) {
    if (!audio.enabled || !audio.ctx || !audio.master || audio.ctx.state !== "running") return;
    var ctx = audio.ctx;
    var at = ctx.currentTime + delay;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.onended = function () { osc.disconnect(); gain.disconnect(); };
    osc.start(at);
    osc.stop(at + duration + 0.05);
  }
  var sfx = {
    stroke: function (n) { tone(0, 0.12, "triangle", 430 + n * 130, 560 + n * 130, 0.15); },
    mistake: function () { tone(0, 0.22, "square", 170, 90, 0.11); },
    timeout: function () { tone(0, 0.18, "square", 320, 240, 0.11); tone(0.2, 0.3, "square", 240, 120, 0.11); },
    tick: function () { tone(0, 0.05, "square", 950, 0, 0.06); },
    land: function () { tone(0, 0.16, "triangle", 520, 260, 0.2); tone(0.05, 0.2, "sine", 390, 200, 0.15); },
    bonus: function () { tone(0, 0.09, "triangle", 620, 0, 0.15); tone(0.09, 0.09, "triangle", 780, 0, 0.15); tone(0.18, 0.14, "triangle", 990, 0, 0.15); },
    fizzle: function () { tone(0, 0.45, "sawtooth", 640, 110, 0.09); },
    heroHurt: function () { tone(0, 0.25, "square", 200, 70, 0.13); },
    shield: function () { tone(0, 0.12, "triangle", 720, 0, 0.13); tone(0.08, 0.16, "triangle", 940, 0, 0.09); },
    heal: function () { tone(0, 0.28, "sine", 480, 820, 0.13); },
    defeatMonster: function () { tone(0, 0.12, "triangle", 500, 0, 0.15); tone(0.12, 0.3, "triangle", 320, 140, 0.17); },
    bossPhase: function () { tone(0, 0.5, "sawtooth", 90, 55, 0.15); tone(0.25, 0.2, "square", 420, 300, 0.09); },
    victory: function () { tone(0, 0.14, "triangle", 520, 0, 0.15); tone(0.15, 0.14, "triangle", 660, 0, 0.15); tone(0.3, 0.3, "triangle", 840, 0, 0.17); },
    defeat: function () { tone(0, 0.3, "triangle", 300, 0, 0.13); tone(0.3, 0.45, "triangle", 200, 120, 0.13); }
  };
  function setSound(on) {
    audio.enabled = on;
    saveSound(on);
    if (audio.master) audio.master.gain.value = on ? 0.5 : 0;
    [$("sound-button"), $("story-sound")].forEach(function (button) {
      button.textContent = "Звук: " + (on ? "вкл." : "выкл.");
      button.setAttribute("aria-pressed", String(on));
    });
  }
  [$("sound-button"), $("story-sound")].forEach(function (button) {
    button.addEventListener("click", function () { ensureAudio(); setSound(!audio.enabled); });
  });
  setSound(audio.enabled);
  function cutSounds() {
    if (!audio.ctx || !audio.master) return;
    var gain = audio.master.gain;
    gain.cancelScheduledValues(audio.ctx.currentTime);
    gain.value = 0;
    setTimeout(function () { if (audio.master) audio.master.gain.value = audio.enabled ? 0.5 : 0; }, 120);
  }

  var clock = { id: 0, total: 0, left: 0, mark: 0, tickedAt: "" };
  function armTimer() {
    var seconds = model.timerSeconds(state);
    clock.tickedAt = "";
    if (!seconds) { clock.total = 0; $("quiz-timer").hidden = true; return; }
    clock.total = seconds * 1000;
    clock.left = clock.total;
    clock.mark = performance.now();
    $("quiz-timer").hidden = false;
    paintTimer();
    if (!clock.id) clock.id = setInterval(tickTimer, 100);
  }
  function stopTicker() {
    if (clock.id) { clearInterval(clock.id); clock.id = 0; }
    clock.total = 0;
    $("quiz-timer").hidden = true;
  }
  function tickTimer() {
    var now = performance.now();
    if (!clock.total || state.phase !== "writing" || document.hidden || !overlay.hidden) { clock.mark = now; return; }
    clock.left -= now - clock.mark;
    clock.mark = now;
    if (clock.left <= 0) { clock.left = 0; paintTimer(); handleTimeout(); return; }
    paintTimer();
  }
  function paintTimer() {
    if (!clock.total) return;
    var seconds = Math.ceil(clock.left / 1000);
    $("timer-fill").style.width = Math.max(0, clock.left / clock.total * 100) + "%";
    $("timer-text").textContent = seconds + " с";
    $("quiz-timer").classList.toggle("low", clock.left <= 3200);
    if (clock.left <= 3200 && seconds >= 1 && clock.tickedAt !== String(seconds)) {
      clock.tickedAt = String(seconds);
      sfx.tick();
    }
  }
  function handleTimeout() {
    var result = model.timeout(state);
    if (!result) return;
    if (writer) writer.cancelQuiz();
    sfx.timeout();
    say("Время вышло! Заклинание сорвалось — шум в лесу растёт, начни написание заново.");
    log("Тайм-аут: заклинание рассеялось, черты сброшены.");
    if (result.blocked) { log("Щит поглотил ответный удар монстра."); sfx.shield(); }
    else if (result.damage) { log("Монстр ответил на промедление: −1 здоровья."); $("hero").classList.add("hit"); sfx.heroHurt(); }
    render();
    if (state.phase === "defeat") { showDefeat(); return; }
    startQuiz();
  }

  function say(text) { $("writer-status").textContent = text; }
  function log(text) {
    var item = document.createElement("li");
    item.textContent = text;
    $("journal-list").prepend(item);
    while ($("journal-list").children.length > 4) $("journal-list").lastElementChild.remove();
  }
  function updateGlyphs() {
    var enemy = model.enemies[state.stage];
    var mem = !enemy.outline;
    document.body.classList.toggle("memory", mem);
    $("spell").textContent = mem ? "✦" : "口";
    target.setAttribute("aria-label", mem ? "Напишите три черты заклинания по памяти" : "Напишите три черты иероглифа 口");
  }
  function setBattleMode(on) {
    document.body.classList.toggle("battle-active", on);
    if (on && window.innerWidth < 800) document.querySelectorAll(".extra-block").forEach(function (block) { block.open = false; });
  }

  function render() {
    var enemy = model.enemies[state.stage];
    $("hero-hp-text").textContent = state.hp + " / " + state.maxHp;
    $("hero-hp").style.width = state.hp / state.maxHp * 100 + "%";
    $("enemy-hp-text").textContent = state.enemyHp + " / " + enemy.hp;
    $("enemy-hp").style.width = state.enemyHp / enemy.hp * 100 + "%";
    $("enemy-name").textContent = enemy.name;
    $("location").textContent = enemy.place;
    $("encounter").textContent = "Встреча " + (state.stage + 1) + " / " + model.enemies.length;
    scene.dataset.land = enemy.kind;
    scene.classList.toggle("boss-rage", model.bossPhase(state) === 2);
    $("monster-use").setAttribute("href", "#" + enemy.kind);
    document.querySelector(".monster").setAttribute("aria-label", enemy.name);
    $("enemy").classList.toggle("defeated", state.enemyHp === 0);
    $("shield-aura").hidden = !state.shield;
    $("shield-text").textContent = state.shield ? "Заряжен: держит 1 удар" : "Не заряжен";
    $("danger-text").textContent = state.danger + " / " + enemy.threshold + " ошибки";
    $("stroke-count").textContent = state.strokes + " / " + model.strokesTotal + " черты";
    $("stroke-dots").querySelectorAll("i").forEach(function (dot, i) { dot.classList.toggle("done", i < state.strokes); });
    $("combo-dots").querySelectorAll("i").forEach(function (dot, i) { dot.classList.toggle("done", i < state.streak); });
    $("attack-count").textContent = "Заклинаний: " + state.attacks;
    $("potion-count").textContent = "×" + state.potions;
    var writing = state.phase === "writing";
    var helping = state.phase === "help";
    $("help-button").disabled = !(writing || helping);
    $("help-button").textContent = helping ? "Продолжить письмо" : enemy.visualHints ? "Показать черты" : "Напомнить порядок";
    $("outline-button").disabled = !writing || !enemy.outline;
    $("outline-button").textContent = enemy.outline ? "Контур: " + (outline ? "вкл." : "выкл.") : "Контур скрыт";
    $("outline-button").setAttribute("aria-pressed", String(enemy.outline && outline));
    $("potion-button").disabled = !writing || !state.potions || state.hp === state.maxHp;
    target.style.pointerEvents = writing ? "auto" : "none";
    target.setAttribute("aria-disabled", String(!writing));
    cover.hidden = writing || state.phase === "resolving" || state.phase === "gate" || (helping && enemy.visualHints);
    $("gate-panel").hidden = state.phase !== "gate";
    if (helping) {}
    else if (state.phase === "ready") $("cover-label").textContent = "Заклинание готово: начни написание";
    else if (state.phase === "error") $("cover-label").textContent = "Не удалось загрузить данные Hanzi Writer";
    else if (state.phase !== "intro") $("cover-label").textContent = "Лесная магия ждёт новой черты";
    document.querySelectorAll(".trail li").forEach(function (item, i) {
      item.classList.toggle("visited", i < state.stage || state.phase === "victory");
      if (i === state.stage && state.phase !== "victory") item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    var intent = enemy.intention;
    if (enemy.counterEvery && state.enemyHp > 0) {
      intent += (state.turns + 1) % enemy.counterEvery === 0 ? " Следующее заклинание разозлит его." : " Пока он просто наблюдает.";
    }
    $("intention").textContent = intent;
  }

  function openStory(config) {
    if (overlay.hidden) previousFocus = document.activeElement;
    $("story-eyebrow").textContent = config.eyebrow;
    $("story-title").textContent = config.title;
    $("story-text").textContent = config.text;
    $("story-rules").hidden = !config.rules;
    $("story-footnote").textContent = config.footnote || "Пошаговое приключение. Ошибки будят монстров, но время обдумать черту есть всегда.";
    $("story-primary").textContent = config.primary;
    $("story-secondary").hidden = !config.secondary;
    $("story-secondary").textContent = config.secondary || "";
    $("reward").hidden = !config.reward;
    $("reward-code").textContent = config.reward ? "7878" : "";
    $("reward-stats").textContent = config.reward ? "Заклинаний: " + state.attacks + " · чистых: " + state.perfect + " · тайм-аутов: " + state.timeouts + " · здоровье: " + state.hp + "/" + state.maxHp : "";
    var art = $("story-art");
    art.classList.toggle("chest", !!config.reward);
    art.replaceChildren();
    if (config.reward) {
      var chest = document.createElement("div");
      chest.className = "chest-drawing";
      chest.setAttribute("aria-hidden", "true");
      art.appendChild(chest);
    } else {
      var image = document.createElement("img");
      image.src = "../../assets/characters/cinnabon.svg";
      image.alt = "Синнабон";
      image.width = 110;
      image.height = 100;
      var upcoming = (state.phase === "intermission" || state.phase === "rest") ? model.enemies[state.stage + 1] : model.enemies[state.stage];
      var hiddenGlyph = !!upcoming && !upcoming.outline;
      var glyph = document.createElement("span");
      if (!hiddenGlyph) glyph.lang = "zh-CN";
      glyph.className = "zh-glyph";
      glyph.textContent = hiddenGlyph ? "✦" : "口";
      var glyphAlt = document.createElement("span");
      glyphAlt.setAttribute("aria-hidden", "true");
      glyphAlt.className = "zh-glyph-alt";
      glyphAlt.textContent = "✦";
      art.append(image, glyph, glyphAlt);
    }
    primaryAction = config.onPrimary;
    secondaryAction = config.onSecondary || null;
    overlay.hidden = false;
    shell.inert = true;
    $("story-primary").focus({ preventScroll: true });
  }

  function closeStory() {
    overlay.hidden = true;
    shell.inert = false;
    primaryAction = null;
    secondaryAction = null;
    if (state.phase !== "intro") setBattleMode(true);
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }

  $("story-primary").addEventListener("click", function () { if (primaryAction) primaryAction(); });
  $("story-secondary").addEventListener("click", function () { if (secondaryAction) secondaryAction(); });
  overlay.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;
    var buttons = [$("story-primary")];
    if (!$("story-secondary").hidden) buttons.push($("story-secondary"));
    buttons.push($("story-sound"));
    var first = buttons[0];
    var last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === card)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });

  function withTimeout(promise, duration) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("Load timeout")); }, duration);
      promise.then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }

  function loadLibrary() {
    if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
    if (libraryTask) return libraryTask;
    libraryTask = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = libraryUrl;
      script.async = true;
      var timer = setTimeout(function () { script.remove(); libraryTask = null; reject(new Error("Library timeout")); }, 15000);
      script.onload = function () {
        clearTimeout(timer);
        if (window.HanziWriter) resolve(window.HanziWriter);
        else { libraryTask = null; script.remove(); reject(new Error("Library unavailable")); }
      };
      script.onerror = function () { clearTimeout(timer); libraryTask = null; script.remove(); reject(new Error("Library unavailable")); };
      document.head.appendChild(script);
    });
    return libraryTask;
  }

  function resetEffects() {
    scene.classList.remove("casting", "stroked", "fizzle");
    $("hero").classList.remove("casting", "hit");
    $("enemy").classList.remove("hit", "stroked", "regained");
  }

  function flashStroke(damage) {
    resetEffects();
    void scene.offsetWidth;
    $("damage-number").textContent = "−" + damage;
    scene.classList.add("stroked");
    $("enemy").classList.add("stroked");
  }

  function showDefeat() {
    if (writer) writer.cancelQuiz();
    stopTicker();
    cutSounds();
    sfx.defeat();
    render();
    openStory({ eyebrow: "ПРИКЛЮЧЕНИЕ ОКОНЧЕНО", title: "Синнабон возвращается к костру", text: "Лес на этот раз оказался сильнее. Отдохни, вспомни порядок черт — и попробуй снова. Код победы ждёт самого упорного путника!", primary: "Попробовать снова", onPrimary: restart });
  }

  function presentPhase() {
    render();
    if (state.phase === "ready") { startQuiz(); return; }
    if (state.phase === "defeat") { showDefeat(); return; }
    if (state.phase === "victory") {
      sfx.victory();
      log("Все пять стражей леса повержены. Сундук открыт!");
      $("dialogue").textContent = "«Мы сделали это! Лес снова тихий, а в сундуке — награда для нас!»";
      openStory({ eyebrow: "ФИНАЛЬНАЯ ПОБЕДА", title: "Древний владыка повержен", text: "Сердце леса снова дышит спокойно. Синнабон открывает древний сундук и достаёт свиток с кодом победы. Ты прошёл все пять встреч!", primary: "Сыграть ещё раз", reward: true, footnote: "Код открывает тайник учителя. Покажи его, чтобы получить награду.", onPrimary: restart });
      return;
    }
    if (state.phase === "rest") {
      var beforeBoss = state.stage === 3;
      if (beforeBoss) log("Последний привал: впереди Древний владыка леса.");
      else log("Привал: Синнабон отдыхает у ручья.");
      openStory({
        eyebrow: "ПРИВАЛ У КОСТРА",
        title: beforeBoss ? "Последний привал" : "Тихая поляна",
        text: beforeBoss ? "Корневой страж повержен, но впереди — Древний владыка леса. Образца не будет, точность строга, время ограничено, а нечистые заклинания рассеиваются. Соберись с силами!" : "Туманный дух отступил. Привал вернёт силы: выбери, что важнее — здоровье или щит перед древним дубом.",
        primary: "Отдохнуть: +3 здоровья",
        secondary: "Взять щит",
        onPrimary: function () { continueJourney("heal"); },
        onSecondary: function () { continueJourney("shield"); }
      });
      return;
    }
    if (state.phase === "intermission") {
      var next = model.enemies[state.stage + 1];
      var hints = {
        1: " Гриб отвечает на каждое второе приземлившееся заклинание.",
        2: " Дух прячет образец: пиши по памяти, на заклинание всего 12 секунд.",
        3: " Страж строг к точности: нечистое или подсказанное заклинание рассеется."
      };
      openStory({ eyebrow: "ТРОПА ПРОДОЛЖАЕТСЯ", title: model.enemies[state.stage].name + " повержена!", text: "Синнабон радуется победе и идёт дальше. Впереди — " + next.place.toLowerCase() + ". " + next.description + (hints[state.stage + 1] || ""), primary: "Идти дальше", onPrimary: function () { continueJourney(); } });
    }
  }

  function continueJourney(choice) {
    if (!model.next(state, choice)) return;
    closeStory();
    scene.classList.remove("boss-rage");
    resetEffects();
    var enemy = model.enemies[state.stage];
    $("dialogue").textContent = "«" + enemy.description + "»";
    log("Новая встреча: " + enemy.name + ". " + enemy.place + ".");
    render();
    updateGlyphs();
    startQuiz();
  }

  function showGate() {
    var keys = Object.keys(gateBank);
    var bank = gateBank[keys[Math.floor(Math.random() * keys.length)]];
    var wrongs = bank.options.filter(function (option) { return option !== bank.correct; }).sort(function () { return Math.random() - 0.5; });
    var choices = wrongs.slice(0, 2).concat([bank.correct]).sort(function () { return Math.random() - 0.5; });
    $("gate-text").textContent = bank.prompt;
    var holder = $("gate-options");
    holder.replaceChildren();
    choices.forEach(function (choice) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = choice;
      button.addEventListener("click", function () { answerGate(choice === bank.correct); });
      holder.appendChild(button);
    });
    holder.firstElementChild.focus({ preventScroll: true });
  }

  function answerGate(correct) {
    if (state.phase !== "gate") return;
    if (correct) {
      if (!model.gatePass(state)) return;
      sfx.shield();
      log("Верный ответ: печать снята, поле открыто.");
      say("Печать снята. Пиши заклинание!");
      startQuiz();
      return;
    }
    var result = model.gateMiss(state);
    if (!result) return;
    sfx.heroHurt();
    if (result.healed) sfx.fizzle();
    $("hero").classList.add("hit");
    $("enemy").classList.add("regained");
    setTimeout(function () { $("hero").classList.remove("hit"); $("enemy").classList.remove("regained"); }, 650);
    log("Неверный ответ! Владыка ударил на 1" + (result.healed ? " и восстановил 1 силу." : "."));
    render();
    if (state.phase === "defeat") showDefeat();
  }

  function startQuiz() {
    if (!writer || state.phase !== "ready") return;
    var enemy = model.enemies[state.stage];
    if (enemy.gate && !state.gateOpen) {
      model.beginGate(state);
      stopTicker();
      resetEffects();
      showGate();
      say("Владыка требует ответа: выбери верное прочтение или значение иероглифа.");
      log("Владыка запечатал поле. Ответь на вопрос, чтобы писать.");
      render();
      return;
    }
    var currentSession = session;
    var token = model.beginQuiz(state);
    var showOutline = enemy.outline && outline;
    writer.cancelQuiz();
    writer.hideCharacter({ duration: 0 });
    writer[showOutline ? "showOutline" : "hideOutline"]({ duration: 0 });
    bossPhaseSeen = model.bossPhase(state);
    updateGlyphs();
    say(enemy.secondsPerStroke ? "Пиши по памяти: на заклинание " + model.timerSeconds(state) + " секунд. Каждая верная черта бьёт монстра." : "Пиши спокойно: каждая верная черта бьёт монстра.");
    render();
    armTimer();
    writer.quiz({
      showHintAfterMisses: enemy.visualHints ? 2 : false,
      highlightOnComplete: false,
      acceptBackwardsStrokes: false,
      leniency: enemy.leniency,
      onCorrectStroke: function (data) {
        if (currentSession !== session) return;
        var result = model.correct(state, token, data.strokeNum);
        if (!result) return;
        sfx.stroke(data.strokeNum);
        var notes = ["Отлично! Первая черта легла — монстр получил урон.", "Верная черта! Ещё одна — и заклинание завершится.", "Последняя черта на месте! Заклинание собрано."];
        say(notes[data.strokeNum]);
        render();
        flashStroke(result.damage);
        if (state.stage === model.enemies.length - 1 && bossPhaseSeen === 1 && model.bossPhase(state) === 2) {
          bossPhaseSeen = 2;
          sfx.bossPhase();
          log("Владыка леса в ярости: время на написание сократилось!");
          $("dialogue").textContent = "«Держись! Лес дрожит от его рёва — но мы уже близко!»";
        }
        if (result.killed) {
          writer.cancelQuiz();
          sfx.defeatMonster();
          log("Финальная черта добила монстра!");
          clearTimeout(resolutionTimer);
          resolutionTimer = setTimeout(function () {
            if (currentSession !== session) return;
            resetEffects();
            model.finishAttack(state);
            presentPhase();
          }, reducedMotion.matches ? 300 : 900);
        }
      },
      onMistake: function (data) {
        if (currentSession !== session) return;
        var result = model.mistake(state, token);
        if (!result) return;
        sfx.mistake();
        say("Промах: черта №" + (data.strokeNum + 1) + " неверна. Попробуй другую.");
        if (result.blocked) { log("Щит поглотил удар монстра, но рассыпался."); sfx.shield(); }
        else if (result.damage) { log("Шум разбудил монстра. Синнабон теряет 1 здоровья."); $("hero").classList.add("hit"); sfx.heroHurt(); }
        render();
        if (state.phase === "defeat") showDefeat();
      },
      onComplete: function () {
        if (currentSession !== session) return;
        var result = model.attack(state, token);
        if (!result) return;
        var enemyNow = model.enemies[state.stage];
        writer.cancelQuiz();
        resetEffects();
        void scene.offsetWidth;
        if (result.fizzle) {
          scene.classList.add("fizzle");
          $("enemy").classList.add("regained");
          sfx.fizzle();
          log("Заклинание рассеялось! " + enemyNow.name + " восстановил силы (" + result.regained + ").");
          say("Нечистое написание рассеялось. Пиши без ошибок и подсказок — иначе страж крепнет.");
        } else {
          scene.classList.add("casting");
          $("hero").classList.add("casting");
          $("enemy").classList.add("hit");
          $("damage-number").textContent = "−" + (model.strokesTotal + result.bonus);
          sfx.land();
          if (result.bonus) { sfx.bonus(); log("Третье чистое заклинание подряд — удар вдвое сильнее!"); }
          log("Заклинание нанесло " + (model.strokesTotal + result.bonus) + " урона." + (result.clean ? " Чистое написание заряжает щит." : ""));
          say(result.killed ? "Монстр повержен! Лес освобождается." : "Заклинание приземлилось! Готовься к следующему.");
        }
        if (result.response) {
          if (result.response.blocked) { log("Контратака! Щит поглотил удар монстра."); sfx.shield(); }
          else { log("Контратака монстра: Синнабон теряет 1 здоровья."); $("hero").classList.add("hit"); sfx.heroHurt(); }
        }
        if (result.killed && !result.fizzle) sfx.defeatMonster();
        render();
        clearTimeout(resolutionTimer);
        resolutionTimer = setTimeout(function () {
          if (currentSession !== session) return;
          resetEffects();
          model.finishAttack(state);
          presentPhase();
        }, reducedMotion.matches ? 300 : 1050);
      }
    });
  }

  function loadError(currentSession, version) {
    if (currentSession !== session || version !== loadVersion) return;
    model.failLoad(state);
    if (writer) writer.cancelQuiz();
    stopTicker();
    say("Нет связи с библиотекой написания. Попробуй повторить загрузку.");
    render();
    openStory({ eyebrow: "ПРОБЛЕМА С ЛЕСОМ", title: "Не удалось загрузить Hanzi Writer", text: "Библиотека написания не ответила: возможно, пропала сеть. Проверь соединение и повтори попытку. Прогресс приключения сохранён.", primary: "Повторить загрузку", onPrimary: function () { if (!model.retryLoad(state)) return; closeStory(); initializeWriter(); } });
  }

  function initializeWriter() {
    var currentSession = session;
    var version = ++loadVersion;
    render();
    say("Загружаем Hanzi Writer и данные иероглифа…");
    loadLibrary().then(function (library) {
      return withTimeout(library.loadCharacterData("口"), 15000);
    }).then(function (data) {
      if (currentSession !== session || version !== loadVersion || state.phase !== "ready") return;
      if (writer) { writer.cancelQuiz(); writer.pauseAnimation(); }
      target.replaceChildren();
      var size = Math.max(100, target.clientWidth);
      writer = window.HanziWriter.create(target, "口", {
        width: size,
        height: size,
        padding: 24,
        showCharacter: false,
        showOutline: outline,
        strokeColor: "#305d3b",
        radicalColor: "#305d3b",
        outlineColor: "#c7bfa0",
        drawingColor: "#355f42",
        highlightColor: "#b6924e",
        drawingWidth: 8,
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 450,
        charDataLoader: function () { return data; },
        onLoadCharDataError: function () { loadError(currentSession, version); }
      });
      startQuiz();
    }).catch(function () { loadError(currentSession, version); });
  }

  function restart() {
    session += 1;
    loadVersion += 1;
    clearTimeout(resolutionTimer);
    stopTicker();
    cutSounds();
    if (writer) { writer.cancelQuiz(); writer.pauseAnimation(); }
    resetEffects();
    scene.classList.remove("boss-rage");
    state = model.create();
    model.start(state);
    outline = true;
    bossPhaseSeen = 1;
    updateGlyphs();
    $("journal-list").replaceChildren();
    log("Новое приключение. Синнабон снова входит в зачарованный лес.");
    $("dialogue").textContent = "«Пять встреч, один иероглиф и целый лес приключений. Пойдём!»";
    closeStory();
    render();
    if (writer) { writer.resumeAnimation(); startQuiz(); }
    else initializeWriter();
    gameArea.scrollIntoView({ block: "start", behavior: "auto" });
  }

  $("help-button").addEventListener("click", function () {
    if (state.phase === "help") {
      if (!model.finishHelp(state)) return;
      startQuiz();
      return;
    }
    if (!writer || !model.help(state)) return;
    var currentSession = session;
    var enemy = model.enemies[state.stage];
    var token = state.quiz;
    writer.cancelQuiz();
    writer.hideCharacter({ duration: 0 });
    if (enemy.visualHints) {
      $("cover-label").textContent = "Смотри и запоминай порядок черт";
      say("Смотри: вот порядок черт. Помощь не атакует и сбрасывает серию.");
      log("Синнабон показал порядок черт. Помощь не бьёт монстра.");
      render();
      writer.animateCharacter({ onComplete: function () {
        if (currentSession !== session || token !== state.quiz || !model.finishHelp(state)) return;
        startQuiz();
      } });
    } else {
      $("cover-label").textContent = "Порядок черт: 1 вниз, 2 уголком, 3 снизу";
      say("Порядок черт: 1 — слева сверху вниз; 2 — сверху вправо и вниз одной чертой; 3 — снизу слева направо." + (enemy.fizzle ? " Помни: подсказанное заклинание рассеется." : " Помощь ослабляет следующее заклинание."));
      log("Синнабон напомнил порядок черт словами.");
      render();
    }
  });

  $("outline-button").addEventListener("click", function () {
    var enemy = model.enemies[state.stage];
    if (!writer || state.phase !== "writing" || !enemy.outline) return;
    outline = !outline;
    writer[outline ? "showOutline" : "hideOutline"]({ duration: 0 });
    render();
  });

  $("potion-button").addEventListener("click", function () {
    var amount = model.heal(state);
    if (!amount) return;
    sfx.heal();
    log("Лесной настой восстановил " + amount + " здоровья. Осталось: " + state.potions + ".");
    $("dialogue").textContent = "«Горьковато, но лапки снова чешутся в поход!»";
    render();
  });

  function resizeWriter() {
    if (!writer || !target.clientWidth) return;
    writer.updateDimensions({ width: target.clientWidth, height: target.clientWidth, padding: 24 });
  }
  if (window.ResizeObserver) new ResizeObserver(resizeWriter).observe(target);
  else window.addEventListener("resize", resizeWriter);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (audio.ctx && audio.ctx.state === "running") audio.ctx.suspend().catch(function () {});
      if (writer) writer.pauseAnimation();
    } else {
      if (audio.ctx && audio.ctx.state === "suspended" && audio.enabled) audio.ctx.resume().catch(function () {});
      if (writer) writer.resumeAnimation();
    }
  });

  render();
  openStory({
    eyebrow: "ПРИКЛЮЧЕНИЕ НАЧИНАЕТСЯ",
    title: "Лес знает твоё заклинание",
    text: "Синнабон идёт к древнему сундуку через зачарованный лес. Напиши три черты иероглифа «рот» — и каждая верная черта ударит монстра. Впереди пять встреч: с третьей образец исчезнет, а время пойдёт.",
    rules: true,
    primary: "Отправиться в лес",
    footnote: "5 встреч · таймер с третьей · звук отключается",
    onPrimary: function () {
      if (!model.start(state)) return;
      closeStory();
      setBattleMode(true);
      log("Синнабон вошёл в зачарованный лес.");
      initializeWriter();
      gameArea.scrollIntoView({ block: "start", behavior: "auto" });
    }
  });
});
