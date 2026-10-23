(function () {
  "use strict";

  var model = window.DepthDive;
  var SE = window.SeaEngine;
  if (!model || !SE) return;

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("sea");
  var ctx = canvas.getContext("2d");
  var stage = $("stage");
  var cat = $("cat");
  var bottle = $("bottle");
  var bottleEyebrow = $("bottle-eyebrow");
  var bottleText = $("bottle-text");
  var bottleAudio = $("bottle-audio");
  var bottleSub = $("bottle-sub");
  var grotto = $("grotto");
  var grottoChar = $("grotto-char");
  var grottoPy = $("grotto-py");
  var writerTarget = $("writer-target");
  var grottoStatus = $("grotto-status");
  var grottoNote = $("grotto-note");
  var scorePop = $("score-pop");
  var introCard = $("intro");
  var introButton = $("intro-button");
  var zoneCard = $("zone-card");
  var zoneCardEyebrow = $("zone-card-eyebrow");
  var zoneCardTitle = $("zone-card-title");
  var zoneCardText = $("zone-card-text");
  var zoneCode = $("zone-code");
  var zoneCardStats = $("zone-card-stats");
  var zoneButton = $("zone-button");
  var defeatCard = $("defeat-card");
  var defeatCardText = $("defeat-card-text");
  var defeatButton = $("defeat-button");
  var victoryCard = $("victory");
  var victoryCode = $("victory-code");
  var codesRow = $("codes-row");
  var victoryStats = $("victory-stats");
  var review = $("review");
  var reviewList = $("review-list");
  var victoryButton = $("victory-button");
  var wormIcons = $("worm-icons");
  var wormCount = $("worm-count");
  var oxygenBlock = $("oxygen-block");
  var oxygenFill = $("oxygen-fill");
  var oxygenText = $("oxygen-text");
  var scoreValue = $("score-value");
  var rankText = $("rank-text");
  var creelValue = $("creel-value");
  var fishProgress = $("fish-progress");
  var zoneName = $("zone-name");
  var zoneTask = $("zone-task");
  var soundButton = $("sound-button");
  var legend = $("legend");
  var rulerMarker = $("ruler-marker");
  var rulerScale = document.querySelector(".ruler-scale");

  var bossPanel = $("boss-panel");
  var bossQuiz = $("boss-quiz");
  var bossOptions = $("boss-options");
  var reelButton = $("reel-button");
  var reelPointer = null;
  var reelKey = false;
  var bossVisualTime = 0;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var SOUND_KEY = "bonus2-dive-sound";
  var TASK_LABELS = {
    write: "Грот: письмо",
    meaning: "Поймай перевод",
    pinyin: "Поймай пиньинь",
    sound: "Поймай знак по звуку"
  };

  var state = model.create();
  var bounds = { w: canvas.width, h: canvas.height };
  var boat = { x: Math.round(bounds.w * 0.22), y: 94 };
  var fish = [];
  var ambient = [];
  var bubbles = [];
  var hook = SE.makeHook(boat.x + 76, boat.y + 12);
  var splash = { active: false, x: 0, y: 0, t: 0 };
  var writer = null;
  var rng = Math.random;
  var rafId = 0;
  var lastTime = 0;
  var clockTime = 0;
  var oxygen = { active: false, total: 0, left: 0, fired: false, tickedAt: "" };
  var taskToken = 0;
  var cardsOpen = false;
  var pendingTimeout = null;
  var session = 0;
  var audio = { enabled: loadSound(), ctx: null, master: null };
  var audioFiles = {};

  function loadSound() {
    try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) { return true; }
  }

  function ensureAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      return;
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    } catch (e) { audio.ctx = null; }
  }
  document.addEventListener("pointerdown", ensureAudio, { capture: true });

  function tone(delay, duration, type, from, to, peak) {
    if (!audio.enabled || !audio.ctx || !audio.master || audio.ctx.state !== "running") return;
    var c = audio.ctx;
    var at = c.currentTime + delay;
    var osc = c.createOscillator();
    var gain = c.createGain();
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
    click: function () { tone(0, 0.06, "triangle", 480, 0, 0.1); },
    cast: function () { tone(0, 0.14, "sine", 720, 220, 0.12); },
    splash: function () { tone(0, 0.16, "sine", 520, 180, 0.15); tone(0.05, 0.18, "triangle", 300, 140, 0.1); },
    stroke: function (n) { tone(0, 0.1, "triangle", 420 + n * 80, 540 + n * 80, 0.12); },
    reel: function () { tone(0, 0.04, "square", 880, 0, 0.05); },
    catch: function () { tone(0, 0.12, "triangle", 520, 0, 0.14); tone(0.12, 0.12, "triangle", 660, 0, 0.14); tone(0.24, 0.22, "triangle", 840, 560, 0.15); sfx.splash(); },
    bigCatch: function () { tone(0, 0.09, "triangle", 620, 0, 0.13); tone(0.09, 0.09, "triangle", 780, 0, 0.13); tone(0.18, 0.09, "triangle", 990, 0, 0.13); tone(0.27, 0.22, "triangle", 1240, 880, 0.14); },
    wrong: function () { tone(0, 0.2, "square", 170, 90, 0.1); },
    wormLoss: function () { tone(0, 0.22, "square", 200, 70, 0.12); },
    snap: function () { tone(0, 0.4, "sawtooth", 640, 110, 0.09); tone(0.3, 0.2, "square", 180, 80, 0.1); },
    tick: function () { tone(0, 0.045, "square", 950, 0, 0.05); },
    phase: function () { tone(0, 0.1, "triangle", 560, 700, 0.12); },
    code: function () { tone(0, 0.1, "triangle", 660, 0, 0.13); tone(0.11, 0.18, "triangle", 880, 0, 0.13); },
    zoneDown: function () { tone(0, 0.5, "sine", 360, 90, 0.14); },
    victory: function () { tone(0, 0.14, "triangle", 520, 0, 0.14); tone(0.15, 0.14, "triangle", 660, 0, 0.14); tone(0.3, 0.16, "triangle", 840, 0, 0.15); tone(0.46, 0.32, "triangle", 1040, 700, 0.16); },
    defeat: function () { tone(0, 0.28, "triangle", 300, 0, 0.12); tone(0.3, 0.42, "triangle", 200, 120, 0.12); }
  };

  function setSound(on) {
    audio.enabled = on;
    try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch (e) {}
    if (audio.master) audio.master.gain.value = on ? 0.5 : 0;
    soundButton.textContent = "Звук: " + (on ? "вкл." : "выкл.");
    soundButton.setAttribute("aria-pressed", String(on));
  }
  soundButton.addEventListener("click", function () { ensureAudio(); setSound(!audio.enabled); });
  setSound(audio.enabled);

  function playTaskAudio() {
    if (!state.task || !audio.enabled) return;
    var src = state.task.audio;
    var clip = audioFiles[src];
    if (!clip) { clip = new Audio(src); audioFiles[src] = clip; }
    clip.currentTime = 0;
    bottleAudio.classList.add("playing");
    var done = function () { bottleAudio.classList.remove("playing"); };
    clip.onended = done;
    clip.onerror = done;
    clip.play().catch(function () { done(); speakTask(); });
  }

  function speakTask() {
    if (!window.speechSynthesis || !state.task || !audio.enabled) return;
    try {
      var utter = new SpeechSynthesisUtterance(state.task.char);
      utter.lang = "zh-CN";
      utter.rate = 0.8;
      window.speechSynthesis.speak(utter);
    } catch (e) { /* озвучка недоступна */ }
  }

  bottleAudio.addEventListener("click", function () { ensureAudio(); playTaskAudio(); });

  /* ===== Задачи ===== */

  function zonePal() { return SE.PALETTES[state.zone]; }

  function releaseReel() {
    var pointer = reelPointer;
    reelPointer = null;
    if (pointer !== null && reelButton.hasPointerCapture(pointer)) reelButton.releasePointerCapture(pointer);
    reelKey = false;
    reelButton.classList.remove("held");
  }

  function resetInteraction() {
    releaseReel();
    clearTimeout(pendingTimeout);
    session += 1;
    closeGrotto();
    bossPanel.hidden = true;
    bossQuiz.hidden = true;
    stage.classList.remove("boss-learning");
  }

  reelButton.addEventListener("pointerdown", function (event) {
    if (state.phase !== "boss" || anyCardOpen() || event.button !== 0) return;
    event.preventDefault();
    ensureAudio();
    reelPointer = event.pointerId;
    if (event.isTrusted) reelButton.setPointerCapture(event.pointerId);
    reelButton.classList.add("held");
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (name) {
    reelButton.addEventListener(name, function () { reelPointer = null; reelButton.classList.toggle("held", reelKey); });
  });
  document.addEventListener("keydown", function (event) {
    if (event.code !== "Space" || state.phase !== "boss" || anyCardOpen() || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    event.preventDefault();
    ensureAudio();
    reelKey = true;
    reelButton.classList.add("held");
  });
  document.addEventListener("keyup", function (event) { if (event.code === "Space") releaseReel(); });
  window.addEventListener("blur", releaseReel);

  function paintBoss() {
    var b = state.boss;
    if (state.zone !== 4 || !b) return;
    var text = !b.armed ? "Возьмись за катушку — и тяни!" : b.motion === "warning" ? "Рывок через мгновение — отпусти!" : b.motion === "surge" ? "Рывок — не тяни!" : b.tension >= 75 ? "Леска натянута — отпусти" : b.checkpoint === 4 ? "Финальная подсечка — тяни!" : "Тяни!";
    var instruction = $("boss-instruction");
    if (instruction.textContent !== text) instruction.textContent = text;
    $("boss-distance").textContent = "До лодки: " + Math.ceil(100 - b.progress) + " м · " + b.checkpoint + "/4";
    $("tension-value").textContent = Math.round(b.tension) + "%";
    $("tension-fill").style.width = b.tension + "%";
    $("tension-meter").setAttribute("aria-valuenow", Math.round(b.tension));
    bossPanel.classList.toggle("warning", b.motion === "warning");
    bossPanel.classList.toggle("danger", b.motion === "surge" || b.tension >= 75);
    $("ruler-fill-4").style.width = b.progress + "%";
  }

  function showBoss() {
    releaseReel();
    fish = [];
    hook = SE.makeHook(boat.x + 76, boat.y + 12);
    oxygen.active = false;
    oxygenBlock.hidden = true;
    closeGrotto();
    bossPanel.hidden = state.phase !== "boss";
    bossQuiz.hidden = state.phase !== "bossquiz";
    stage.classList.toggle("boss-learning", state.phase !== "boss");
    if (state.phase === "boss") {
      bottle.hidden = true;
      legend.textContent = "Удерживай катушку или пробел. Перед рывком отпускай. Перегрузка лески — минус червь.";
    } else {
      showBottle(state.task);
      bottleEyebrow.textContent = "БОЛЬШОЙ УЛОВ · ИСПЫТАНИЕ " + (state.boss.checkpoint + 1) + " ИЗ 4";
      bottleSub.textContent = "Рыба и натяжение на паузе. Ошибка — минус один червь.";
      if (state.phase === "grotto") openGrotto(state.task);
      else {
        bossOptions.replaceChildren();
        $("boss-quiz-status").textContent = "Выбери ответ. Леска и время на паузе.";
        var token = state.quiz;
        var currentSession = session;
        var labels = state.task.options.slice();
        for (var i = labels.length - 1; i > 0; i--) {
          var j = Math.floor(rng() * (i + 1));
          var swap = labels[i]; labels[i] = labels[j]; labels[j] = swap;
        }
        labels.forEach(function (label) {
          var button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          if (state.task.type === "sound") button.lang = "zh-CN";
          button.addEventListener("click", function () {
            if (currentSession !== session) return;
            var result = model.bossAnswer(state, token, label);
            if (!result) return;
            if (result.defeated) { showDefeat(); return; }
            if (result.bossResume) { sfx.phase(); showBoss(); paintHud(); }
            else { sfx.wrong(); applyWormLoss(1); $("boss-quiz-status").textContent = "Неверно — минус червь. Попробуй ещё раз."; }
          });
          bossOptions.appendChild(button);
        });
      }
    }
    paintBoss();
    paintHud();
  }

  function armOxygen() {
    var total = model.taskSeconds(state);
    if (!total) { oxygen.active = false; oxygenBlock.hidden = true; return; }
    oxygen.active = true;
    oxygen.total = total;
    oxygen.left = total;
    oxygen.fired = false;
    oxygenBlock.hidden = false;
    paintOxygen();
  }

  function paintOxygen() {
    if (!oxygen.active) return;
    var ratio = Math.max(0, oxygen.left / oxygen.total);
    oxygenFill.style.width = (ratio * 100).toFixed(1) + "%";
    oxygenText.textContent = Math.max(0, Math.ceil(oxygen.left)) + " с";
    oxygenBlock.classList.toggle("low", ratio <= 0.25);
  }

  function showBottle(task) {
    bottle.hidden = false;
    bottleEyebrow.textContent = task.special === "golden"
      ? "ЗОЛОТАЯ РЫБКА · ИСПЫТАНИЕ " + (task.phaseIndex + 1) + " ИЗ " + task.phases.length
      : "ЗАПИСКА В БУТЫЛКЕ";
    if (task.type === "meaning") {
      bottleText.innerHTML = 'Поймай перевод знака <span class="zh" lang="zh-CN">' + task.char + "</span>";
      bottleSub.textContent = "Кликни по рыбе с верным переводом.";
    } else if (task.type === "pinyin") {
      bottleText.innerHTML = 'Поймай пиньинь знака <span class="zh" lang="zh-CN">' + task.char + "</span>";
      bottleSub.textContent = "Тон имеет значение!";
    } else if (task.type === "sound") {
      bottleText.textContent = "Прослушай слог и пойми его знак";
      bottleSub.textContent = "Слушать можно сколько угодно раз.";
    } else {
      if (state.zone >= 2) {
        bottleText.textContent = "Грот: напиши знак по пиньиню «" + task.pinyin + "»";
      } else {
        bottleText.innerHTML = 'Грот: напиши знак <span class="zh" lang="zh-CN">' + task.char + "</span> · " + task.pinyin;
      }
      bottleSub.textContent = "Курьер уже утащил крючок в грот.";
    }
    bottleAudio.hidden = task.type !== "sound";
  }

  function layoutFish() {
    var task = state.task;
    fish = SE.makeLayout(rng, ctx, task.options, task.correct, model.currentZone(state), bounds, state.zone);
    hook = SE.makeHook(boat.x + 76, boat.y + 12);
    legend.textContent = "Клик по рыбе — заброс крючка. Промах по воде не страшен.";
  }

  function openGrotto(task) {
    grotto.hidden = false;
    grottoChar.hidden = state.zone >= 2;
    grottoChar.textContent = state.zone >= 2 ? "" : task.char;
    grottoPy.textContent = task.pinyin;
    var zone = model.currentZone(state);
    grottoNote.textContent = state.zone === 4 ? "Время и леска на паузе. Ошибка — один червь; второго штрафа нет." : zone.snap
      ? "Нечистое письмо обрывает леску: ошибка — минус червяк."
      : zone.outline ? "Контур подсказывает форму." : "Пиши по памяти: контура нет.";
    grottoStatus.textContent = state.zone >= 2 ? "Пиши знак по памяти, черты — по порядку." : "Обводи черты по порядку.";
    createWriter(task);
    armOxygen();
  }

  function closeGrotto() {
    grotto.hidden = true;
    if (writer) { writer.cancelQuiz(); writer = null; }
    writerTarget.replaceChildren();
  }

  function createWriter(task) {
    if (writer) { writer.cancelQuiz(); writer = null; }
    writerTarget.replaceChildren();
    var data = window.HANZI_DATA && window.HANZI_DATA[task.char];
    if (!data) { taskFallback(); return; }
    var zone = model.currentZone(state);
    var size = Math.min(300, writerTarget.clientWidth || 260);
    var token = state.quiz;
    var currentSession = session;
    writer = window.HanziWriter.create(writerTarget, task.char, {
      width: size, height: size, padding: 16,
      showCharacter: false,
      showOutline: zone.outline,
      strokeColor: "#1e4650",
      radicalColor: "#1e4650",
      outlineColor: "#c7bfa0",
      drawingColor: "#1e4650",
      highlightColor: "#b6924e",
      drawingWidth: 8,
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 380,
      charDataLoader: function () { return data; },
      onLoadCharDataError: function () { taskFallback(); }
    });
    writer.quiz({
      showHintAfterMisses: zone.hints ? 2 : false,
      highlightOnComplete: false,
      acceptBackwardsStrokes: false,
      leniency: zone.leniency,
      onCorrectStroke: function (d) {
        if (currentSession !== session) return;
        var result = model.strokeCorrect(state, token, d.strokeNum);
        if (!result) return;
        sfx.stroke(d.strokeNum);
        sfx.reel();
        grottoStatus.textContent = "Черта " + state.task.strokes + " / " + state.task.strokeTotal + " — леска натягивается.";
      },
      onMistake: function () {
        if (currentSession !== session) return;
        var response = model.strokeMistake(state, token);
        if (!response) return;
        sfx.wrong();
        if (response.defeated) { showDefeat(); return; }
        if (response.wormLoss) {
          applyWormLoss(response.wormLoss.damage);
          grottoStatus.textContent = "Рывок! Минус " + response.wormLoss.damage + " червя. Продолжай писать.";
        } else {
          grottoStatus.textContent = "Черта неверна. Рыба дёргает: " + state.danger + " / " + model.currentZone(state).threshold + ".";
        }
        paintHud();
      },
      onComplete: function () {
        if (currentSession !== session) return;
        var result = model.completeWriting(state, token);
        if (!result) return;
        if (result.defeated) { showDefeat(); return; }
        if (result.bossResume) { sfx.phase(); closeGrotto(); showBoss(); return; }
        if (result.snap) {
          sfx.snap();
          closeGrotto();
          applyWormLoss(result.wormLoss.damage);
          toast("Обрыв! Нечистое письмо — леска лопнула");
          paintHud();
          pendingTimeout = setTimeout(function () { onTask(); }, 1000);
          return;
        }
        if (result.advanced) {
          sfx.phase();
          closeGrotto();
          paintHud();
          onTask();
          return;
        }
        closeGrotto();
        landedCatch(result);
      }
    });
  }

  function taskFallback() {
    grottoStatus.textContent = "Данные знака не загрузились — обнови страницу.";
  }

  function onTask() {
    if (state.zone === 4) { showBoss(); return; }
    if (state.phase === "ready") model.beginTask(state);
    if (state.phase !== "fishing" && state.phase !== "grotto") return;
    var task = state.task;
    taskToken = state.quiz;
    showBottle(task);
    if (state.phase === "fishing") {
      closeGrotto();
      layoutFish();
      armOxygen();
      if (task.type === "sound") {
        var soundToken = state.quiz;
        var soundSession = session;
        setTimeout(function () { if (soundToken === state.quiz && soundSession === session && state.phase === "fishing") playTaskAudio(); }, 350);
      }
    } else {
      fish = [];
      openGrotto(task);
    }
    paintHud();
  }

  /* ===== Крючок и ловля ===== */

  canvas.addEventListener("pointerdown", function (event) {
    ensureAudio();
    if (state.phase !== "fishing" || cardsOpen || hook.state !== "idle") return;
    var rect = canvas.getBoundingClientRect();
    var x = (event.clientX - rect.left) / rect.width * bounds.w;
    var y = (event.clientY - rect.top) / rect.height * bounds.h;
    if (window.__dive) {
      window.__dive.stats.casts += 1;
      window.__dive.stats.lastClick = Math.round(x) + "," + Math.round(y);
    }
    hook.tx = Math.max(10, Math.min(bounds.w - 10, x));
    hook.ty = Math.max(boat.y + 24, Math.min(bounds.h - 10, y));
    hook.state = "drop";
    sfx.cast();
  });

  function landedCatch(result) {
    sfx.catch();
    var text = "+" + result.gained;
    if (result.bigCatch) {
      sfx.bigCatch();
      text = "БОЛЬШОЙ УЛОВ! +" + result.gained;
    }
    popScore(text);
    state.phase = "resolving";
    paintHud();
    pendingTimeout = setTimeout(function () {
      if (window.__dive) window.__dive.stats.resolveAt = Math.round(performance.now());
      var next = model.resolveFish(state);
      if (window.__dive) window.__dive.stats.resolveNext = next ? next.next : "null";
      if (!next) return;
      if (next.next === "task") { onTask(); return; }
      if (next.next === "zoneclear") { showZoneCard(next); return; }
      if (next.next === "victory") { showVictory(); }
    }, 650);
  }

  function handleHookEvents(events) {
    if (!events) return;
    if (events.splash) {
      sfx.splash();
      splash.active = true; splash.t = 0;
      splash.x = hook.splashX; splash.y = hook.splashY;
    }
    if (events.caught) {
      sfx.reel();
    }
    if (events.landed) {
      var hooked = events.landed;
      var label = hooked.label;
      var result = model.hookFish(state, taskToken, label);
      if (window.__dive) {
        window.__dive.stats.lands += 1;
        window.__dive.stats.lastResult = result ? (result.correct ? "ok" + (result.advanced ? "+" : "") + (result.gained || "") : "miss d" + state.danger) : "NULL(tok" + taskToken + "/q" + state.quiz + ")";
      }
      if (!result) return;
      if (result.defeated) { showDefeat(); return; }
      if (result.correct && result.advanced) {
        sfx.phase();
        toast("Испытание пройдено! Дальше — " + TASK_LABELS[state.task.type].toLowerCase());
        pendingTimeout = setTimeout(function () { onTask(); }, 700);
        paintHud();
        return;
      }
      if (result.correct) {
        landedCatch(result);
        return;
      }
      sfx.wrong();
      hooked.flash = 0.7;
      hooked.flashKind = "wrong";
      SE.fleeAll(fish, hooked.x, hooked.y);
      if (result.wormLoss) {
        applyWormLoss(result.wormLoss.damage);
        toast("Рывок! Минус " + result.wormLoss.damage + " червя — расстановка новая");
        pendingTimeout = setTimeout(function () { onTask(); }, 900);
      } else {
        toast("Мимо! Ошибок: " + state.danger + " / " + model.currentZone(state).threshold);
      }
      paintHud();
    }
  }

  function applyWormLoss(damage) {
    sfx.wormLoss();
    paintHud();
  }

  function popScore(text) {
    scorePop.hidden = false;
    scorePop.textContent = text;
    scorePop.classList.remove("score-pop");
    void scorePop.offsetWidth;
    scorePop.classList.add("score-pop");
    setTimeout(function () { scorePop.hidden = true; }, 1100);
  }

  var toastTimer = null;
  function toast(text) {
    legend.textContent = text;
    legend.classList.remove("flash");
    void legend.offsetWidth;
    legend.classList.add("flash");
    clearTimeout(toastTimer);
  }

  /* ===== Кислород ===== */

  function oxygenTick(dt) {
    if (!oxygen.active || oxygen.fired || cardsOpen || document.hidden) return;
    if (state.phase !== "fishing" && state.phase !== "grotto") return;
    oxygen.left -= dt;
    var ratio = oxygen.left / oxygen.total;
    var seconds = Math.ceil(oxygen.left);
    if (oxygen.left <= 3.05 && oxygen.left > 0 && oxygen.tickedAt !== String(seconds)) {
      oxygen.tickedAt = String(seconds);
      sfx.tick();
    }
    paintOxygen();
    if (oxygen.left <= 0) {
      oxygen.fired = true;
      var result = model.oxygenOut(state);
      if (!result) return;
      if (result.defeated) { showDefeat(); return; }
      closeGrotto();
      applyWormLoss(result.wormLoss.damage);
      toast("Кислород кончился! Минус " + result.wormLoss.damage + " червя");
      pendingTimeout = setTimeout(function () { onTask(); }, 900);
      paintHud();
    }
  }

  /* ===== Карточки ===== */

  function anyCardOpen() {
    return !introCard.hidden || !zoneCard.hidden || !defeatCard.hidden || !victoryCard.hidden;
  }

  function showZoneCard(info) {
    cardsOpen = true;
    sfx.code();
    zoneCardEyebrow.textContent = "ЗОНА " + (state.zone + 1) + " ВЫЛОВЛЕНА";
    zoneCardTitle.textContent = "Бутылка с кодом всплыла!";
    var clearTexts = [
      "Окуни отмелей отправились в садок. Ниже ждёт быстрое течение — держи крючок крепче.",
      "Форель течения сдалась. Глубже начинается туманная бездна: надписи на рыбах будет прятать мгла.",
      "Сом бездны повержен в мутной воде. Ещё глубже золотая река — и та самая рыбка.",
      "Четыре кода собраны. Ниже один Хранитель глубины: короткие рывки — тяни и отпускай по сигналу, а между ними четыре учебных испытания."
    ];
    zoneCardText.textContent = clearTexts[state.zone] + (info.zoneBonus ? " Бонус зоны без потерь: +150 жемчуга!" : "");
    zoneCode.textContent = info.code;
    zoneCardStats.textContent = "Жемчуг: " + state.score + " · В садке: " + state.caught + " · Черви: " + state.worms + " / " + state.maxWorms;
    zoneButton.textContent = state.zone === 3 ? "К большому улову" : state.zone === 2 ? "К золотой реке" : "Ныряем глубже";
    zoneCard.hidden = false;
    paintHud();
  }

  zoneButton.addEventListener("click", function () {
    ensureAudio();
    sfx.click();
    if (state.phase !== "zoneclear") return;
    resetInteraction();
    zoneCard.hidden = true;
    cardsOpen = false;
    model.nextZone(state);
    sfx.zoneDown();
    toast("Зона " + (state.zone + 1) + ": " + model.currentZone(state).name + " (" + model.currentZone(state).depth + ")");
    onTask();
  });

  function showDefeat() {
    resetInteraction();
    cardsOpen = true;
    sfx.defeat();
    defeatCardText.textContent = "На зоне «" + model.currentZone(state).name + "» черви закончились. Но коды и пройденные зоны остались с тобой: «" + model.currentZone(state).name + "» начнётся заново с четырьмя червями.";
    defeatCard.hidden = false;
    closeGrotto();
    oxygen.active = false;
    paintHud();
  }

  defeatButton.addEventListener("click", function () {
    ensureAudio();
    sfx.click();
    if (state.phase !== "defeat") return;
    resetInteraction();
    defeatCard.hidden = true;
    cardsOpen = false;
    model.restartZone(state);
    toast("Снова в зону: " + model.currentZone(state).name);
    onTask();
  });

  function fillReview() {
    reviewList.innerHTML = "";
    var chars = Object.keys(state.charMisses);
    if (!chars.length) {
      var clean = document.createElement("li");
      clean.innerHTML = '<i class="clean">Безупречное погружение — ни одного промаха!</i>';
      reviewList.appendChild(clean);
      review.hidden = false;
      return;
    }
    chars.sort(function (a, b) { return state.charMisses[b] - state.charMisses[a]; });
    chars.forEach(function (ch) {
      var entry = model.VOCAB.filter(function (v) { return v.char === ch; })[0];
      if (!entry) return;
      var li = document.createElement("li");
      li.innerHTML = '<b lang="zh-CN">' + entry.char + '</b><span><span class="py">' + entry.pinyin + "</span> · " + entry.meaning + "</span><em>" + state.charMisses[ch] + "×</em>";
      reviewList.appendChild(li);
    });
    review.hidden = false;
  }

  function showVictory() {
    resetInteraction();
    cardsOpen = true;
    sfx.victory();
    victoryCode.textContent = model.CODES.join("");
    codesRow.innerHTML = "";
    model.CODES.forEach(function (code, index) {
      codesRow.insertAdjacentHTML("beforeend",
        '<i><b>Зона ' + (index + 1) + "</b><span>" + code + "</span></i>");
    });
    victoryStats.textContent = "Жемчуг: " + state.score + " · Звание: " + model.rankFor(state.score) +
      " · В садке: " + state.caught + " · Чистых: " + state.stats.perfect + " · Ошибок: " + state.stats.mistakes;
    fillReview();
    victoryCard.hidden = false;
    fish = [];
    oxygen.active = false;
    oxygenBlock.hidden = true;
    paintHud();
  }

  victoryButton.addEventListener("click", function () {
    ensureAudio();
    sfx.click();
    resetInteraction();
    victoryCard.hidden = true;
    review.hidden = true;
    state = model.create(rng);
    fish = [];
    hook = SE.makeHook(boat.x + 76, boat.y + 12);
    bottle.hidden = true;
    oxygen.active = false;
    cardsOpen = true;
    paintHud();
    introCard.hidden = false;
  });

  introButton.addEventListener("click", function () {
    ensureAudio();
    sfx.click();
    introCard.hidden = true;
    cardsOpen = false;
    model.start(state);
    toast("Зона 1: " + model.currentZone(state).name + " (" + model.currentZone(state).depth + ")");
    onTask();
  });

  /* ===== HUD ===== */

  function paintHud() {
    wormCount.textContent = state.worms;
    wormIcons.innerHTML = "";
    for (var i = 0; i < state.maxWorms; i++) {
      wormIcons.insertAdjacentHTML("beforeend", "<i" + (i < state.worms ? "" : ' class="spent"') + "></i>");
    }
    scoreValue.textContent = state.score;
    rankText.textContent = model.rankFor(state.score);
    creelValue.textContent = state.caught;
    var zone = model.currentZone(state);
    fishProgress.textContent = state.zone === 4
      ? "один гигант · " + (state.boss ? state.boss.checkpoint : 0) + "/4"
      : "рыба " + Math.min(state.fishIndex, zone.fish) + " / " + zone.fish;
    zoneName.textContent = zone.name;
    zoneTask.textContent = state.task ? TASK_LABELS[state.task.type] : state.zone === 4 ? "Катушка и натяжение" : "";
    var trophySeg = document.querySelector('.ruler-seg[data-zone="4"]');
    trophySeg.classList.toggle("active", state.zone === 4 && state.phase !== "victory");
    trophySeg.classList.toggle("cleared", state.trophy);
    $("ruler-code-4").textContent = state.trophy ? "Пойман!" : "Трофей";
    $("ruler-fill-4").style.width = state.boss ? state.boss.progress + "%" : "0%";
    for (var z = 0; z < 4; z++) {
      var seg = document.querySelector('.ruler-seg[data-zone="' + z + '"]');
      seg.classList.toggle("active", z === state.zone && state.phase !== "victory");
      seg.classList.toggle("cleared", state.codes.indexOf(model.CODES[z]) !== -1);
      var codeEl = $("ruler-code-" + z);
      codeEl.textContent = state.codes.indexOf(model.CODES[z]) !== -1 ? model.CODES[z] : "···";
      var caughtInZone = state.codes.indexOf(model.CODES[z]) !== -1 ? model.ZONES[z].fish : z === state.zone ? state.fishIndex - 1 : 0;
      $("ruler-fill-" + z).style.width = Math.min(100, caughtInZone / model.ZONES[z].fish * 100) + "%";
    }
    if (state.phase !== "victory") {
      var segBounds = document.querySelector('.ruler-seg[data-zone="' + state.zone + '"]');
      if (segBounds) {
        var horizontal = window.matchMedia("(max-width: 860px)").matches;
        rulerMarker.style.top = horizontal ? "2px" : (segBounds.offsetTop + segBounds.offsetHeight * 0.5 - 6) + "px";
        rulerMarker.style.left = horizontal ? (segBounds.offsetLeft + segBounds.offsetWidth * 0.5 - 6) + "px" : "2px";
      }
    }
    if (!oxygen.active) oxygenBlock.hidden = true;
  }

  /* ===== Цикл ===== */

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    tickFrame(now);
  }

  function tickFrame(now) {
    if (window.__dive) window.__frames = (window.__frames || 0) + 1;
    var dt = (now - lastTime) / 1000;
    dt = dt > 0 ? Math.min(0.05, dt) : 0.016;
    lastTime = now;
    clockTime += dt;
    cardsOpen = anyCardOpen();

    if (!cardsOpen && !document.hidden) {
      if (state.zone === 4) {
        if (state.phase === "boss") {
          if (!reducedMotion.matches) bossVisualTime += dt;
          var result = model.bossTick(state, dt, reelKey || reelPointer !== null);
          if (result) {
            if (result.defeated) showDefeat();
            else if (result.victory) { popScore("ТРОФЕЙ! +" + result.gained); showVictory(); }
            else if (result.challenge) { sfx.phase(); showBoss(); }
            else if (result.snap) { releaseReel(); sfx.snap(); applyWormLoss(1); toast("Обрыв! Один червь потерян. Контрольные точки сохранены."); }
            else if (result.motion === "warning") sfx.tick();
          }
          paintBoss();
        }
      } else {
        fish.forEach(function (f) { SE.stepFish(f, dt, model.currentZone(state), bounds, clockTime); });
        ambient.forEach(function (a) { SE.stepAmbient(a, dt, bounds, clockTime); });
        handleHookEvents(SE.stepHook(hook, fish, dt, bounds));
        oxygenTick(dt);
      }
    }
    SE.stepBubbles(bubbles, dt, bounds);
    if (splash.active) {
      splash.t += dt;
      if (splash.t > 0.7) splash.active = false;
    }

    draw();
  }

  function draw() {
    var pal = zonePal();
    SE.drawBackground(ctx, bounds, pal, clockTime, bubbles, state.zone === 4 ? [] : ambient);
    SE.drawFog(ctx, bounds, pal, clockTime);
    var coverAny = pal.fog;
    fish.forEach(function (f) {
      var cover = coverAny ? SE.fogCover(f, bounds, clockTime) : 0;
      SE.drawFish(ctx, f, clockTime, cover);
    });
    SE.drawBoat(ctx, boat.x, boat.y, clockTime);
    cat.style.left = (boat.x / bounds.w * 100) + "%";
    cat.style.top = ((boat.y - 3 + Math.sin(clockTime * 1.3) * 2) / bounds.h * canvas.clientHeight) + "px";
    cat.style.width = (88 / bounds.w * canvas.clientWidth) + "px";
    stage.style.setProperty("--boat-bottom", ((boat.y + 30) / bounds.h * canvas.clientHeight) + "px");
    if (state.zone === 4 && state.boss) SE.drawBoss(ctx, bounds, boat, state.boss, bossVisualTime, state.trophy, state.phase === "grotto" || state.phase === "bossquiz", stage.clientWidth < 700);
    else SE.drawLine(ctx, hook);
    if (splash.active) SE.drawSplash(ctx, splash.x, splash.y, splash.t / 0.7);
  }

  /* ===== Старт ===== */

  function boot() {
    ambient = SE.makeAmbient(rng, bounds);
    bubbles = SE.makeBubbles(rng, bounds);
    paintHud();
    rafId = requestAnimationFrame(frame);
    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    fontsReady.then(function () {
      if (state.phase !== "intro") return;
      introCard.hidden = false;
      cardsOpen = true;
    });
  }

  if (window.location.search.indexOf("debug") !== -1) {
    window.__dive = {
      state: function () { return state; },
      fishList: function () { return fish; },
      catchCorrect: function () {
        var target = null;
        fish.forEach(function (f) { if (!target && f.correct && (f.state === "swim" || f.state === "flee")) target = f; });
        if (!target || state.phase !== "fishing" || hook.state !== "idle") return false;
        var rect = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent("pointerdown", {
          clientX: rect.left + target.x / bounds.w * rect.width,
          clientY: rect.top + target.y / bounds.h * rect.height,
          bubbles: true
        }));
        return true;
      },
      writeThrough: function () {
        if (state.phase !== "grotto") return false;
        var token = state.quiz;
        for (var i = 0; i < state.task.strokeTotal; i++) model.strokeCorrect(state, token, i);
        var result = model.completeWriting(state, token);
        if (!result) return false;
        if (result.defeated) { showDefeat(); }
        else if (result.bossResume) { closeGrotto(); showBoss(); }
        else if (result.advanced) { closeGrotto(); onTask(); }
        else if (result.snap) { closeGrotto(); applyWormLoss(result.wormLoss.damage); toast("Обрыв! Леска лопнула"); setTimeout(function () { onTask(); }, 200); }
        else { closeGrotto(); landedCatch(result); }
        return true;
      },
      clickEl: function (id) { var el = document.getElementById(id); if (el) el.click(); },
      pump: function (n) {
        for (var i = 0; i < (n || 10); i++) tickFrame((lastTime += 16.7));
      },
      stats: { casts: 0, lands: 0, lastResult: "-", lastClick: "-" },
      hookInfo: function () {
        var f0 = fish[0];
        var d = window.__dive;
        var st = d ? d.stats : { casts: 0, lands: 0, lastResult: "-", lastClick: "-" };
        var r = canvas.getBoundingClientRect();
        return "fr=" + (window.__frames || 0) + " r=" + Math.round(r.left) + "," + Math.round(r.top) + "x" + Math.round(r.width) +
          " hook=" + hook.state + " hxy=" + Math.round(hook.x) + "," + Math.round(hook.y) +
          " txy=" + Math.round(hook.tx) + "," + Math.round(hook.ty) +
          " casts=" + st.casts + " lands=" + st.lands + " res=" + st.lastResult + " click=" + st.lastClick +
          " rsAt=" + (st.resolveAt || "-") + " rsNext=" + (st.resolveNext || "-") +
          " boots=" + (window.__boots || 0) + " ic=" + (window.__introClicks || 0) +
          " fish=" + fish.length + (f0 ? " f0=" + f0.label.slice(0, 8) + "@" + Math.round(f0.x) + "," + Math.round(f0.y) + " " + f0.state + (f0.correct ? "!" : "") : "");
      }
    };
  }

  document.addEventListener("visibilitychange", function () {
    releaseReel();
    lastTime = performance.now();
    if (audio.ctx) {
      if (document.hidden) audio.ctx.suspend().catch(function () {});
      else if (audio.enabled) audio.ctx.resume().catch(function () {});
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
