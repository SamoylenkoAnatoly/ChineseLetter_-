(function () {
  "use strict";

  var model = window.CastleSiege;
  if (!model) return;

  var $ = function (id) { return document.getElementById(id); };
  var scene = $("scene");
  var trail = $("trail");
  var locationText = $("location");
  var encounterText = $("encounter");
  var heroEl = $("hero");
  var heroHp = $("hero-hp");
  var heroHpText = $("hero-hp-text");
  var shieldAura = $("shield-aura");
  var enemyEl = $("enemy");
  var enemyName = $("enemy-name");
  var enemyBadge = $("enemy-badge");
  var enemyHp = $("enemy-hp");
  var enemyHpText = $("enemy-hp-text");
  var monsterUse = $("monster-use");
  var spell = $("spell");
  var damageNumber = $("damage-number");
  var intention = $("intention");
  var sceneCaption = document.querySelector(".scene-caption");
  var waveEvent = $("wave-event");
  var taskHeading = $("task-heading");
  var taskIntro = $("task-intro");
  var writeTarget = $("write-target");
  var writeTargetChar = $("write-target-char");
  var writeTargetPy = $("write-target-py");
  var writerFrame = $("writer-frame");
  var writerTarget = $("writer-target");
  var writerCover = $("writer-cover");
  var coverLabel = $("cover-label");
  var choicePanel = $("choice-panel");
  var choiceQuestion = $("choice-question");
  var choiceTargetFrame = $("choice-target-frame");
  var choiceTarget = $("choice-target");
  var soundReplay = $("sound-replay");
  var choiceOptions = $("choice-options");
  var choiceFeedback = $("choice-feedback");
  var strokeProgress = $("stroke-progress");
  var strokeCount = $("stroke-count");
  var strokeDots = $("stroke-dots");
  var phaseDots = $("phase-dots");
  var quizTimer = $("quiz-timer");
  var timerFill = $("timer-fill");
  var timerText = $("timer-text");
  var writerStatus = $("writer-status");
  var helpButton = $("help-button");
  var soundButton = $("sound-button");
  var potionButton = $("potion-button");
  var potionCount = $("potion-count");
  var manaFill = $("mana-fill");
  var manaText = $("mana-text");
  var volleyButton = $("volley-button");
  var salvoButton = $("salvo-button");
  var comboDots = $("combo-dots");
  var comboValue = $("combo-value");
  var shieldText = $("shield-text");
  var dangerText = $("danger-text");
  var scoreValue = $("score-value");
  var journalList = $("journal-list");
  var attackCount = $("attack-count");
  var dialogue = $("dialogue");
  var overlay = $("overlay");
  var storyCard = document.querySelector(".story-card");
  var storyEyebrow = $("story-eyebrow");
  var storyTitle = $("story-title");
  var storyText = $("story-text");
  var storyRules = $("story-rules");
  var reward = $("reward");
  var rewardLabel = $("reward-label");
  var rewardCode = $("reward-code");
  var codesList = $("codes-list");
  var storyRank = $("story-rank");
  var rewardStats = $("reward-stats");
  var review = $("review");
  var reviewList = $("review-list");
  var storyPrimary = $("story-primary");
  var storySecondary = $("story-secondary");
  var storySound = $("story-sound");
  var storyFootnote = $("story-footnote");

  var HANZI_CDN = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/{char}.json";
  var HANZI_CDN_BACKUP = "https://unpkg.com/hanzi-writer-data@2.0/{char}.json";
  var SOUND_KEY = "bonus-siege-sound";
  var TASK_LABELS = {
    write: "Отбей монстра письмом",
    meaning: "Выбери верный перевод",
    pinyin: "Выбери верное чтение",
    sound: "Выбери знак на слух",
    tone: "Определи тон знака"
  };
  var TASK_INTROS = {
    write: "Каждая верная черта ранит монстра. Знак и пиньинь указаны над свитком.",
    meaning: "Прочитай знак и найди его перевод. Ошибёшься — монстр приблизится к стене.",
    pinyin: "Вспомни чтение знака с тонами. Тон имеет значение!",
    sound: "Прослушай запись и найди знак. Слушать можно сколько угодно.",
    tone: "Звук и знак перед тобой: назови тон — 1 −, 2 ∕, 3 ˇ или 4 \\."
  };
  var TONE_LABELS = { "1": "1 −", "2": "2 ∕", "3": "3 ˇ", "4": "4 \\" };
  var TONE_HINTS = { "1": "высокий", "2": "восходящий", "3": "изгиб", "4": "падающий" };
  var SPECIAL_SHORT = { armor: "Щитоносец", ram: "Таран", herald: "Глашатай", shaman: "Шаман", elite: "Элита", final: "Владыка · 3 испытания" };
  var SPECIAL_HINTS = {
    armor: "Щитоносец: первый промах в задании не считается — броня гасит удар.",
    ram: "Таран: монстр признаёт только письмо иероглифа!",
    herald: "Глашатай: монстр слушает только задания на слух!",
    shaman: "Шаман: колдовство вдвое сокращает время на задание!",
    elite: "Элита: два верных ответа подряд — перевод, затем пиньинь того же знака.",
    final: "Владыка: три испытания подряд, любая ошибка бьёт по стене двойным!"
  };
  var EVENT_LABELS = {
    fog: "Туман: контуры письма скрыты!",
    rain: "Ливень: все таймеры короче на 25%!",
    desert: "Дезертиры: врагов на одного меньше.",
    horde: "Рать: +1 монстр, но очки волны ×1.25!"
  };
  var STAGE_CLEAR_TEXTS = [
    "Гоблины-разведчики разбежались. Стена выдержала первый натиск, а разведданные пошли на пользу: факелы горят ровнее.",
    "Волчья кавалерия отхлынула от ворот. Всадники уносят луки, а над равниной кружит лишь ворона.",
    "Осадные башни рухнули в ров. Тролли ретируются, бормоча что-то про письмо по памяти.",
    "Владыка орды повержен! Нечистые письмена не спасли его, и орда снимает осаду."
  ];
  var DEFENSE_QUOTES = [
    "В этом замке слова — оружие. Отбиваем волну за волной!",
    "Стена крепка, пока твоя память крепка.",
    "Каждый верный знак — ещё один час спокойствия для жителей.",
    "Тоны — это боевая стойка. Не теряй их!"
  ];

  var state = model.create();
  var session = 0;
  var writer = null;
  var outlineOn = true;
  var audio = { enabled: localStorage.getItem(SOUND_KEY) !== "off", ctx: null, master: null };
  var audioFiles = {};
  var ticker = null;
  var tickerToken = 0;
  var remaining = 0;
  var pausedRemaining = null;
  var currentTask = null;
  var currentToken = 0;
  var buttonsLocked = false;
  var eventTimer = null;

  function ensureAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      return;
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
  }

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
    mistake: function () { tone(0, 0.25, "sawtooth", 220, 150, 0.16); },
    wallHit: function () { tone(0, 0.35, "square", 95, 50, 0.28); tone(0.02, 0.2, "triangle", 140, 60, 0.2); },
    blocked: function () { tone(0, 0.3, "sine", 660, 880, 0.16); },
    kill: function () { tone(0, 0.16, "triangle", 520, 780, 0.18); tone(0.1, 0.22, "triangle", 780, 1180, 0.16); },
    repair: function () { tone(0, 0.18, "sine", 440, 660, 0.14); tone(0.14, 0.22, "sine", 660, 880, 0.12); },
    timeout: function () { tone(0, 0.4, "sawtooth", 330, 170, 0.14); },
    fizzle: function () { tone(0, 0.2, "triangle", 700, 460, 0.15); tone(0.16, 0.26, "triangle", 460, 240, 0.15); },
    mana: function () { tone(0, 0.1, "sine", 740, 0, 0.12); tone(0.09, 0.12, "sine", 920, 0, 0.12); },
    volley: function () { tone(0, 0.06, "square", 900, 500, 0.09); tone(0.07, 0.06, "square", 800, 420, 0.09); tone(0.14, 0.08, "square", 700, 360, 0.09); },
    phase: function () { tone(0, 0.12, "triangle", 620, 0, 0.15); tone(0.12, 0.16, "triangle", 830, 0, 0.15); },
    code: function () { tone(0, 0.14, "sine", 660, 0, 0.16); tone(0.13, 0.14, "sine", 830, 0, 0.16); tone(0.26, 0.3, "sine", 990, 0, 0.18); },
    victory: function () { tone(0, 0.18, "triangle", 523, 0, 0.18); tone(0.16, 0.18, "triangle", 659, 0, 0.18); tone(0.32, 0.18, "triangle", 784, 0, 0.18); tone(0.48, 0.5, "triangle", 1046, 0, 0.2); },
    defeat: function () { tone(0, 0.5, "sawtooth", 240, 90, 0.2); },
    click: function () { tone(0, 0.06, "triangle", 700, 0, 0.08); }
  };

  function setSound(enabled) {
    audio.enabled = enabled;
    localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
    paintSound();
  }

  function paintSound() {
    var label = "Звук: " + (audio.enabled ? "вкл." : "выкл.");
    soundButton.textContent = label;
    soundButton.setAttribute("aria-pressed", String(audio.enabled));
    storySound.textContent = label;
    storySound.setAttribute("aria-pressed", String(audio.enabled));
  }

  function playTargetAudio() {
    if (!currentTask) return;
    if (!audio.enabled) { speakPinyin(); return; }
    var src = currentTask.audio;
    if (!src) return;
    var clip = audioFiles[src];
    if (!clip) {
      clip = new Audio(src);
      audioFiles[src] = clip;
    }
    clip.currentTime = 0;
    soundReplay.classList.add("speaking");
    var done = function () { soundReplay.classList.remove("speaking"); };
    clip.onended = done;
    clip.onerror = done;
    clip.play().catch(function () {
      done();
      speakPinyin();
    });
  }

  function speakPinyin() {
    if (!window.speechSynthesis || !currentTask) return;
    try {
      var utter = new SpeechSynthesisUtterance(currentTask.char);
      utter.lang = "zh-CN";
      utter.rate = 0.8;
      window.speechSynthesis.speak(utter);
    } catch (e) { /* озвучка недоступна */ }
  }

  function say(text) { dialogue.textContent = "<" + text + ">"; }

  function log(text) {
    var item = document.createElement("li");
    item.textContent = text;
    journalList.insertBefore(item, journalList.firstChild);
    while (journalList.children.length > 8) journalList.removeChild(journalList.lastChild);
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (resolve, reject) { setTimeout(reject, ms); })
    ]);
  }

  function fetchJson(url) {
    return fetch(url, { mode: "cors" }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    });
  }

  var libraryCache = {};
  function loadLibrary(char) {
    if (libraryCache[char]) return libraryCache[char];
    if (window.HANZI_DATA && window.HANZI_DATA[char]) {
      libraryCache[char] = Promise.resolve(window.HANZI_DATA[char]);
      return libraryCache[char];
    }
    if (location.protocol === "file:") {
      libraryCache[char] = Promise.reject(new Error("нет локальных данных знака"));
      return libraryCache[char];
    }
    libraryCache[char] = withTimeout(
      fetchJson(HANZI_CDN.replace("{char}", char)).catch(function () {
        return fetchJson(HANZI_CDN_BACKUP.replace("{char}", char));
      }),
      9000
    );
    return libraryCache[char];
  }

  function stopTicker() {
    if (ticker) { clearInterval(ticker); ticker = null; }
  }

  function paintTimer() {
    var total = model.taskSeconds(state);
    if (!total) { quizTimer.hidden = true; return; }
    var ratio = Math.max(0, Math.min(1, remaining / total));
    timerFill.style.width = (ratio * 100).toFixed(1) + "%";
    timerText.textContent = Math.max(0, Math.ceil(remaining)) + " с";
    quizTimer.classList.toggle("low", remaining <= 5.05);
  }

  function armTimer() {
    stopTicker();
    remaining = model.taskSeconds(state);
    if (!remaining) { quizTimer.hidden = true; return; }
    quizTimer.hidden = false;
    paintTimer();
    tickerToken += 1;
    var token = tickerToken;
    var last = Date.now();
    ticker = setInterval(function () {
      if (token !== tickerToken) return;
      var now = Date.now();
      remaining -= (now - last) / 1000;
      last = now;
      paintTimer();
      if (remaining <= 0) { stopTicker(); handleTimeout(); }
    }, 100);
  }

  function handleTimeout() {
    var result = model.timeoutTask(state);
    if (!result) return;
    stopTicker();
    sfx.timeout();
    log("Время вышло — монстр злее, а стены ближе.");
    if (result.response && result.response.armor) {
      say("Броня щитоносца погасила удар. Второго промаха она не простит!");
    } else if (result.response && result.response.damage) {
      applyWallHit(result.response);
    } else if (result.response && !result.response.blocked) {
      say(result.restarted ? "Не успел! Пиши заново — задание то же." : "Не успел! Монстр в ярости. Попробуй ещё раз.");
    }
    if (!result.restarted && state.phase === "choice") {
      quizTimer.hidden = true;
      choiceFeedback.textContent = "Время вышло! Монстр барабанит в щиты. Ответ всё ещё ждёт тебя.";
      choiceFeedback.className = "choice-feedback bad";
    }
    render();
    if (state.phase === "ready") presentPhase("ready");
    if (state.phase === "defeat") presentPhase("defeat");
  }

  function resetEffects() {
    scene.classList.remove("casting", "wallhit", "hard", "fizzle", "boss-rage");
    heroEl.classList.remove("casting", "hit");
    enemyEl.classList.remove("hit", "defeated", "stroked", "advance");
    damageNumber.classList.remove("pop");
  }

  function flashStroke(char) {
    spell.textContent = char;
    scene.classList.add("casting");
    heroEl.classList.add("casting");
    setTimeout(function () {
      scene.classList.remove("casting");
      heroEl.classList.remove("casting");
    }, 900);
    popDamage("-1");
    enemyEl.classList.add("stroked");
    setTimeout(function () { enemyEl.classList.remove("stroked"); }, 500);
  }

  function popDamage(text) {
    damageNumber.textContent = text;
    damageNumber.classList.remove("pop");
    void damageNumber.offsetWidth;
    damageNumber.classList.add("pop");
  }

  function applyWallHit(response) {
    if (!response) return;
    if (response.armor) {
      say("Броня щитоносца погасила удар. Второго промаха она не простит!");
      log("Щитоносец погасил удар бронёй.");
      return;
    }
    if (response.blocked) {
      sfx.blocked();
      say("Щит стены поглотил удар! Заряди его следующим чистым заданием.");
      log("Щит спас стену от удара.");
      return;
    }
    if (!response.damage) {
      say("Монстр злится, но пока лишь метает искры.");
      return;
    }
    sfx.wallHit();
    scene.classList.add("wallhit");
    if (response.damage > 1) scene.classList.add("hard");
    heroEl.classList.add("hit");
    setTimeout(function () {
      scene.classList.remove("wallhit", "hard");
      heroEl.classList.remove("hit");
    }, response.damage > 1 ? 620 : 460);
    say(response.damage > 1 ? "Двойной удар по стене! Камни летят вниз. Стена: " + state.wall + " / " + state.maxWall + "." : "Удар по стене! Замок трясётся. Стена: " + state.wall + " / " + state.maxWall + ".");
    log("Монстр пробил стену (−" + response.damage + "). Осталось прочности: " + state.wall + ".");
  }

  function effectiveOutline() {
    return state.wave.outline && outlineOn;
  }

  function initializeWriter(currentSession, token, task) {
    var stage = model.currentStage(state);
    loadLibrary(task.char).then(function (data) {
      if (currentSession !== session || state.phase !== "writing" || !state.task || state.task.char !== task.char) return;
      if (writer) { writer.cancelQuiz(); writer.pauseAnimation(); }
      writerTarget.replaceChildren();
      var size = Math.min(340, Math.max(120, writerTarget.clientWidth || 280));
      writer = window.HanziWriter.create(writerTarget, task.char, {
        width: size,
        height: size,
        padding: 22,
        showCharacter: false,
        showOutline: effectiveOutline(),
        strokeColor: "#22354f",
        radicalColor: "#22354f",
        outlineColor: "#c7bfa0",
        drawingColor: "#22354f",
        highlightColor: "#b6924e",
        drawingWidth: 9,
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 420,
        charDataLoader: function () { return data; },
        onLoadCharDataError: function () { loadError(currentSession); }
      });
      startQuiz(currentSession, token, task, stage);
    }).catch(function () { loadError(currentSession); });
  }

  function startQuiz(currentSession, token, task, stage) {
    if (currentSession !== session || state.phase !== "writing" || !state.task || state.task.char !== task.char) return;
    writer.cancelQuiz();
    writer.hideCharacter({ duration: 0 });
    writer[effectiveOutline() ? "showOutline" : "hideOutline"]({ duration: 0 });
    coverLabel.textContent = effectiveOutline()
      ? "Контур подсказывает форму — обводи по порядку черт"
      : "Пиши по памяти! Знак и пиньинь — над свитком";
    writerFrame.hidden = false;
    writerCover.hidden = true;
    var seconds = model.taskSeconds(state);
    say(seconds ? "Пиши по памяти: на задание " + seconds + " секунд. Каждая верная черта ранит монстра." : "Пиши спокойно: каждая верная черта ранит монстра.");
    render();
    armTimer();
    writer.quiz({
      showHintAfterMisses: stage.visualHints ? 2 : false,
      highlightOnComplete: false,
      acceptBackwardsStrokes: false,
      leniency: stage.leniency,
      onCorrectStroke: function (data) {
        if (currentSession !== session) return;
        var result = model.strokeCorrect(state, token, data.strokeNum);
        if (!result) return;
        sfx.stroke(data.strokeNum);
        flashStroke(task.char);
        render();
      },
      onComplete: function () {
        if (currentSession !== session) return;
        stopTicker();
        var result = model.completeWriting(state, token);
        if (!result) return;
        if (result.fizzle) {
          sfx.fizzle();
          scene.classList.add("fizzle");
          say("Заклинание рассеялось! Нечистые черты вернули монстру силы.");
          log("Нечистое письмо: урон ушёл, монстр восстановился.");
          if (result.response) applyWallHit(result.response);
          setTimeout(function () {
            scene.classList.remove("fizzle");
            if (state.phase === "defeat") { presentPhase("defeat"); return; }
            resolveMonster();
          }, 1500);
          return;
        }
        if (result.advanced) {
          writer.showCharacter({ duration: 250 });
          sfx.phase();
          log("Испытание " + state.task.phaseIndex + " пройдено! Дальше — " + TASK_LABELS[state.task.type].toLowerCase() + ".");
          setTimeout(function () {
            if (currentSession !== session) return;
            currentTask = state.task;
            currentToken = state.quiz;
            writerFrame.hidden = true;
            strokeProgress.hidden = true;
            writeTarget.hidden = true;
            showChoice(currentToken, state.task);
            armTimer();
            render();
          }, 750);
          return;
        }
        writer.showCharacter({ duration: 300 });
        monsterDefeatedFx(result);
      },
      onMistake: function () {
        if (currentSession !== session) return;
        var response = model.strokeMistake(state, token);
        if (!response) return;
        sfx.mistake();
        render();
        if (response.damage) applyWallHit(response);
        else if (response.armor) applyWallHit(response);
        else say("Мимо! Монстр копит гнев: " + state.danger + " / " + model.currentStage(state).threshold + ".");
      }
    });
  }

  function monsterDefeatedFx(result) {
    sfx.kill();
    enemyEl.classList.add("defeated");
    popDamage("+" + (result && result.gained ? result.gained : model.SCORE.monster));
    var mult = model.multiplierFor(state.streak);
    if (result && result.repair) {
      sfx.repair();
      log("Стойкая оборона: стена +1, +" + model.SCORE.repair + " очков.");
    }
    if (mult > 1) log("Комбо ×" + mult + "! Очки умножаются.");
    setTimeout(resolveMonster, 1300);
  }

  function resolveMonster() {
    var result = model.finishMonster(state);
    if (!result) return;
    if (result.waveBonus) {
      sfx.code();
      log("Волна отбита без единого удара: +" + model.SCORE.waveBonus + " очков!");
    }
    render();
    presentPhase(state.phase);
  }

  function shuffle(values) {
    var list = values.slice();
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = list[i]; list[i] = list[j]; list[j] = swap;
    }
    return list;
  }

  function pinyinTone(value) {
    for (var i = 0; i < model.VOCAB.length; i++) {
      if (model.VOCAB[i].pinyin === value) return model.VOCAB[i].tone;
    }
    return 0;
  }

  function showChoice(token, task) {
    buttonsLocked = false;
    writerFrame.hidden = true;
    choicePanel.hidden = false;
    choiceFeedback.textContent = "";
    choiceFeedback.className = "choice-feedback";
    if (task.type === "meaning") choiceQuestion.textContent = "Что означает знак " + task.char + "?";
    else if (task.type === "pinyin") choiceQuestion.textContent = "Как читается знак " + task.char + "?";
    else if (task.type === "tone") choiceQuestion.textContent = "Какой тон у знака " + task.char + "?";
    else choiceQuestion.textContent = "Прослушай и выбери верный знак";
    choiceTargetFrame.hidden = task.type === "sound";
    choiceTarget.textContent = task.char;
    soundReplay.hidden = !(task.type === "sound" || task.type === "tone");
    choiceOptions.innerHTML = "";
    shuffle(task.options).forEach(function (value) {
      var button = document.createElement("button");
      button.type = "button";
      button.dataset.value = value;
      if (task.type === "sound") {
        button.className = "option option-char";
        button.setAttribute("lang", "zh-CN");
        button.textContent = value;
      } else if (task.type === "tone") {
        button.className = "option option-pinyin tone-" + value;
        button.innerHTML = "<b>" + TONE_LABELS[value] + "</b><small>" + TONE_HINTS[value] + "</small>";
      } else if (task.type === "pinyin") {
        button.className = "option option-pinyin tone-" + pinyinTone(value);
        button.textContent = value;
      } else {
        button.className = "option option-meaning";
        button.textContent = value;
      }
      button.addEventListener("click", function () { answerChoiceClick(token, value, button); });
      choiceOptions.appendChild(button);
    });
    if (!soundReplay.hidden) setTimeout(playTargetAudio, 400);
  }

  function answerChoiceClick(token, value, button) {
    if (buttonsLocked || !model.valid(state, token)) return;
    ensureAudio();
    var result = model.answerChoice(state, token, value);
    if (!result) return;
    var stage = model.currentStage(state);
    if (result.correct && result.advanced) {
      sfx.phase();
      button.classList.add("correct");
      choiceFeedback.textContent = "Верно! Испытание " + (state.task.phaseIndex + 1) + " из " + state.task.phases.length + ": " + TASK_LABELS[state.task.type].toLowerCase() + ".";
      choiceFeedback.className = "choice-feedback good";
      currentTask = state.task;
      currentToken = state.quiz;
      showChoice(currentToken, state.task);
      armTimer();
      render();
      return;
    }
    if (result.correct) {
      buttonsLocked = true;
      stopTicker();
      sfx.click();
      button.classList.add("correct");
      choiceFeedback.textContent = result.repair ? "Точно! Монстр разбит, а стена подлатана: +1." : "Точно! Монстр разбит.";
      if (result.repair) sfx.repair();
      choiceFeedback.className = "choice-feedback good";
      monsterDefeatedFx(result);
      render();
      return;
    }
    sfx.mistake();
    button.classList.add("wrong");
    button.disabled = true;
    choiceFeedback.textContent = "Мимо! " + state.danger + " / " + stage.threshold + " ошибок до удара по стене.";
    choiceFeedback.className = "choice-feedback bad";
    if (result.response) applyWallHit(result.response);
    render();
    if (state.phase === "defeat") presentPhase("defeat");
  }

  function startTask() {
    var task = model.beginTask(state);
    if (!task) return;
    currentTask = task;
    currentToken = state.quiz;
    buttonsLocked = false;
    enemyEl.classList.remove("defeated", "hit", "stroked", "advance");
    var stage = model.currentStage(state);
    phaseDots.hidden = task.phases.length < 2;
    paintPhaseDots();
    if (task.type === "write") {
      writeTarget.hidden = false;
      writeTargetChar.textContent = task.char;
      writeTargetPy.textContent = task.pinyin;
      writeTargetPy.className = "write-target-py tone-" + task.tone;
      choicePanel.hidden = true;
      writerFrame.hidden = false;
      strokeProgress.hidden = false;
      helpButton.hidden = !stage.visualHints;
    } else {
      writeTarget.hidden = true;
      writerFrame.hidden = true;
      strokeProgress.hidden = true;
      helpButton.hidden = true;
    }
    writerCover.hidden = false;
    coverLabel.textContent = "Свиток разматывается...";
    helpButton.disabled = true;
    paintStrokeDots();
    if (task.type === "write") {
      var currentSession = session;
      initializeWriter(currentSession, currentToken, task);
      render();
    } else {
      render();
      showChoice(currentToken, task);
      armTimer();
    }
  }

  function paintStrokeDots() {
    if (!currentTask || currentTask.type !== "write") return;
    strokeCount.textContent = state.strokes + " / " + currentTask.strokeTotal + " черт";
    strokeDots.innerHTML = "";
    for (var i = 0; i < currentTask.strokeTotal; i++) {
      var dot = document.createElement("i");
      if (i < state.strokes) dot.className = "done";
      strokeDots.appendChild(dot);
    }
  }

  function paintPhaseDots() {
    if (!currentTask || currentTask.phases.length < 2) return;
    phaseDots.innerHTML = "";
    currentTask.phases.forEach(function (type, index) {
      var dot = document.createElement("i");
      if (index < currentTask.phaseIndex) dot.className = "done";
      else if (index === currentTask.phaseIndex) dot.className = "current";
      dot.title = "Испытание " + (index + 1) + ": " + TASK_LABELS[type];
      phaseDots.appendChild(dot);
    });
  }

  function presentPhase(phase) {
    if (phase === "ready") { startTask(); return; }
    if (phase === "stageclear") { openStory("stageclear"); return; }
    if (phase === "victory") { openStory("victory"); return; }
    if (phase === "defeat") { openStory("defeat"); return; }
    if (phase === "error") { openStory("error"); return; }
  }

  function loadError(currentSession) {
    if (currentSession !== session) return;
    stopTicker();
    model.failLoad(state);
    if (writer) writer.cancelQuiz();
    render();
    openStory("error");
  }

  function paintEventToast() {
    var event = state.wave.event;
    scene.dataset.event = event || "";
    if (!event) {
      waveEvent.hidden = true;
      return;
    }
    waveEvent.textContent = EVENT_LABELS[event] || event;
    waveEvent.hidden = false;
    clearTimeout(eventTimer);
    eventTimer = setTimeout(function () { waveEvent.hidden = true; }, 4000);
    log("Событие волны: " + EVENT_LABELS[event]);
  }

  function render() {
    var stage = model.currentStage(state);
    var rage = model.bossPhase(state) === 2;
    var special = stage.specials[state.monsterIndex] || "";
    scene.dataset.wave = stage.kind;
    if (!state.wave.event) scene.dataset.event = "";
    scene.classList.toggle("boss-rage", rage && state.monsterHp !== null);
    Array.prototype.forEach.call(trail.children, function (li, index) {
      li.classList.toggle("visited", index < state.stage || state.phase === "victory");
      if (index === state.stage && state.phase !== "victory") li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    locationText.textContent = stage.place + (state.wave.event ? " · " + ({ fog: "туман", rain: "ливень", desert: "дезертиры", horde: "рать" }[state.wave.event] || "") : "");
    encounterText.textContent = "Волна " + (state.stage + 1) + " · Монстр " + state.monsterIndex + " / " + model.effectiveMonsters(state);
    enemyName.textContent = stage.name + (rage ? " (ярость!)" : "");
    enemyBadge.hidden = !special;
    enemyBadge.textContent = special ? SPECIAL_SHORT[special] : "";
    monsterUse.setAttribute("href", "#" + (window.PixelSprites ? window.PixelSprites.idFor(stage.kind, special) : stage.kind));
    document.querySelector(".monster").setAttribute("aria-label", stage.name + (special ? " (" + SPECIAL_SHORT[special] + ")" : ""));
    heroHp.style.width = (state.wall / state.maxWall * 100) + "%";
    heroHpText.textContent = state.wall + " / " + state.maxWall;
    shieldAura.hidden = !state.shield;
    var hpRatio = state.monsterHp === null ? 100 : Math.round(state.monsterHp / Math.max(1, state.monsterMaxHp) * 100);
    enemyHp.style.width = hpRatio + "%";
    enemyHpText.textContent = state.monsterHp === null ? "—" : state.monsterHp + " / " + state.monsterMaxHp;
    intention.textContent = special ? SPECIAL_HINTS[special] : stage.intention;
    var mult = model.multiplierFor(state.streak);
    comboValue.textContent = "×" + mult;
    Array.prototype.forEach.call(comboDots.children, function (dot, index) {
      dot.classList.toggle("done", index < state.streak % model.STREAK_GOAL);
    });
    shieldText.textContent = state.shield ? "Готов" : "Не заряжен";
    dangerText.textContent = state.danger + " / " + stage.threshold + " ошибок";
    scoreValue.textContent = String(state.score);
    manaFill.style.width = (state.mana / model.MANA_MAX * 100) + "%";
    manaText.textContent = state.mana + "/" + model.MANA_MAX;
    potionCount.textContent = "×" + state.potions;
    potionButton.disabled = !(state.potions && state.wall < state.maxWall && (state.phase === "writing" || state.phase === "choice"));
    var inBattle = state.phase === "writing" || state.phase === "choice";
    volleyButton.disabled = !(inBattle && state.phase === "choice" && state.mana >= model.VOLLEY_COST && state.task && !state.task.volley);
    salvoButton.disabled = !(inBattle && state.mana >= model.SALVO_COST && model.taskSeconds(state) > 0);
    attackCount.textContent = state.stats.repelled + " отбито";
    paintStrokeDots();
    paintPhaseDots();
    var task = state.task;
    if (task) {
      taskHeading.textContent = TASK_LABELS[task.type];
      taskIntro.textContent = TASK_INTROS[task.type];
    } else {
      taskHeading.textContent = "Отбей атаку знанием";
      taskIntro.textContent = "Каждое задание — один монстр. Ошибка — удар по стене замка.";
    }
    if (state.phase === "intro") writerStatus.textContent = "Нажми «Встать на стену», чтобы начать оборону.";
    else if (state.phase === "ready") writerStatus.textContent = currentTask && currentTask.type === "write" ? "Свиток разматывается... Готовь руку." : "Монстр подступает...";
    else if (state.phase === "writing") writerStatus.textContent = state.dirty ? "Письмо нечистое: щита не будет" + (model.currentStage(state).fizzle && (!state.task || state.task.phases.length === 1) ? ", а у владыки — рассеивание!" : ".") : "Пиши по порядку черт. Ошибки злят монстра.";
    else if (state.phase === "choice") writerStatus.textContent = task && task.misses ? "Монстр уже ранен твоей памятью. Добивай верным ответом." : "Один верный ответ — и монстр падёт.";
    else if (state.phase === "resolving") writerStatus.textContent = "Монстр отброшен от стен!";
    else if (state.phase === "defeat") writerStatus.textContent = "Стена пала...";
    sceneCaption.querySelector("span").textContent = "Волна " + (state.stage + 1) + " · " + stage.name;
    sceneCaption.querySelector("p").textContent = stage.description;
  }

  function paintReview() {
    var chars = Object.keys(state.charMisses);
    reviewList.innerHTML = "";
    if (!chars.length) {
      var clean = document.createElement("i");
      clean.className = "clean";
      clean.textContent = "Безупречная оборона — ни одного промаха!";
      reviewList.appendChild(clean);
      review.hidden = false;
      return;
    }
    chars.sort(function (a, b) { return state.charMisses[b] - state.charMisses[a]; });
    chars.forEach(function (char) {
      var entry = null;
      for (var i = 0; i < model.VOCAB.length; i++) {
        if (model.VOCAB[i].char === char) { entry = model.VOCAB[i]; break; }
      }
      if (!entry) return;
      var item = document.createElement("i");
      var glyph = document.createElement("b");
      glyph.setAttribute("lang", "zh-CN");
      glyph.textContent = entry.char;
      var mid = document.createElement("span");
      mid.innerHTML = '<span class="py tone-' + entry.tone + '">' + entry.pinyin + "</span> · " + entry.meaning;
      var count = document.createElement("em");
      count.textContent = state.charMisses[char] + "×";
      item.append(glyph, mid, count);
      reviewList.appendChild(item);
    });
    review.hidden = false;
  }

  function openStory(kind) {
    paintPrimary();
    stopTicker();
    resetEffects();
    reward.hidden = true;
    codesList.hidden = true;
    storyRank.hidden = true;
    review.hidden = true;
    rewardCode.hidden = false;
    rewardCode.classList.remove("full");
    storyRules.hidden = kind !== "intro";
    storySecondary.hidden = true;
    storyFootnote.hidden = false;
    if (kind === "intro") {
      storyEyebrow.textContent = "Осадный договор";
      storyTitle.textContent = "Замок под осадой";
      storyText.textContent = "Орда из четырёх волн встала под стенами замка Синнабона. Каждый монстр — одно задание: письмо, перевод, пиньинь, знак на слух или тон. Элита требует двух ответов подряд, а финал — трёх испытаний. Отбей волну — получи код обороны.";
      storyPrimary.textContent = "Встать на стену";
      storyFootnote.textContent = "4 волны, 5 типов заданий и 16 цифр кода. Записывай!";
    } else if (kind === "stageclear") {
      storyEyebrow.textContent = "Волна " + (state.stage + 1) + " отбита!";
      storyTitle.textContent = "Атака отражена!";
      storyText.textContent = STAGE_CLEAR_TEXTS[state.stage];
      reward.hidden = false;
      rewardLabel.textContent = "Код волны " + (state.stage + 1);
      rewardCode.textContent = state.lastCode;
      rewardStats.textContent = "Очки: " + state.score + " · Отбито: " + state.stats.repelled + " · Чистых: " + state.stats.perfect + " · Стена: " + state.wall + " / " + state.maxWall;
      storyPrimary.textContent = "Встретить волну " + (state.stage + 2);
      storySecondary.textContent = "Начать осаду заново";
      storySecondary.hidden = false;
      storyFootnote.textContent = "Запиши код — он пригодится после игры.";
      sfx.code();
      log("Код волны " + (state.stage + 1) + " получен: " + state.lastCode + ".");
    } else if (kind === "victory") {
      storyEyebrow.textContent = "Осада снята";
      storyTitle.textContent = "Орда отступила!";
      storyText.textContent = "Четыре волны разбились о стены, а владыка пал в трёх испытаниях. Синнабон гасит факелы и чинит ворота, а ты собираешь награду — полный код обороны из 16 цифр.";
      reward.hidden = false;
      rewardLabel.textContent = "Полный код осады";
      rewardCode.textContent = model.CODES.join("");
      rewardCode.classList.add("full");
      codesList.innerHTML = "";
      model.CODES.forEach(function (code, index) {
        var item = document.createElement("i");
        var name = document.createElement("b");
        name.textContent = "Волна " + (index + 1);
        var value = document.createElement("span");
        value.textContent = code;
        item.appendChild(name);
        item.appendChild(value);
        codesList.appendChild(item);
      });
      codesList.hidden = false;
      storyRank.hidden = false;
      storyRank.textContent = "Звание: " + model.rankFor(state.score);
      rewardStats.textContent = "Очки: " + state.score + " · Отбито: " + state.stats.repelled + " · Чистых: " + state.stats.perfect + " · Ошибок: " + state.stats.mistakes + " · Стена: " + state.wall + " / " + state.maxWall;
      storyPrimary.textContent = "Оборонять снова";
      storyFootnote.textContent = "Коды осады: " + model.CODES.join(" · ") + " — не потеряй их.";
      paintReview();
      sfx.victory();
      log("Осада снята! Все коды собраны.");
    } else if (kind === "defeat") {
      storyEyebrow.textContent = "Стена пала";
      storyTitle.textContent = "Ворота пробиты";
      storyText.textContent = "Орда прорвалась на " + (state.stage + 1) + "-й волне... но стены можно отстроить, а знания — отточить. Новая осада начнётся с первой волны.";
      storyPrimary.textContent = "Отстроить стены";
      storyFootnote.textContent = "Подсказка: чистые задания дают щит, ману и комбо-множитель.";
      paintReview();
      sfx.defeat();
      log("Стена пала на волне " + (state.stage + 1) + ".");
    } else if (kind === "error") {
      storyEyebrow.textContent = "Свиток повреждён";
      storyTitle.textContent = "Знак не загрузился";
      storyText.textContent = "HanziWriter не смог получить начертание знака. Проверь подключение к сети — или попробуй загрузить ещё раз.";
      storyPrimary.textContent = "Повторить загрузку";
      storyFootnote.textContent = "Прогресс осады сохранится.";
    }
    overlay.hidden = false;
    storyCard.focus();
  }

  function closeStory() { overlay.hidden = true; }

  function restart() {
    session += 1;
    tickerToken += 1;
    stopTicker();
    if (writer) { writer.cancelQuiz(); writer.pauseAnimation(); }
    writer = null;
    writerTarget.replaceChildren();
    resetEffects();
    journalList.innerHTML = "";
    var item = document.createElement("li");
    item.textContent = "Стены отстроены. Орда собирается снова.";
    journalList.appendChild(item);
    state = model.create();
    currentTask = null;
    render();
    openStory("intro");
  }

  function primaryAction() {
    ensureAudio();
    sfx.click();
    var kind = storyPrimary.dataset.kind || "intro";
    if (kind === "error") {
      closeStory();
      model.retryLoad(state);
      render();
      presentPhase("ready");
      return;
    }
    if (kind === "restart") { restart(); return; }
    closeStory();
    if (state.phase === "stageclear") {
      model.nextStage(state);
      log("Волна " + (state.stage + 1) + ": " + model.currentStage(state).name + " подходят к стенам.");
      render();
      paintEventToast();
      presentPhase("ready");
      return;
    }
    if (state.phase === "intro") {
      model.start(state);
      say(DEFENSE_QUOTES[0]);
      log("Осада началась: " + model.currentStage(state).name + " у стен.");
      render();
      paintEventToast();
      presentPhase("ready");
      return;
    }
    restart();
  }

  function paintPrimary() {
    var kind = "restart";
    if (state.phase === "error") kind = "error";
    else if (state.phase === "stageclear" || state.phase === "intro") kind = "continue";
    storyPrimary.dataset.kind = kind;
  }

  function bindEvents() {
    storyPrimary.addEventListener("click", primaryAction);
    storySecondary.addEventListener("click", function () { ensureAudio(); sfx.click(); restart(); });
    storySound.addEventListener("click", function () { ensureAudio(); setSound(!audio.enabled); });
    soundButton.addEventListener("click", function () { ensureAudio(); setSound(!audio.enabled); });
    soundReplay.addEventListener("click", function () { ensureAudio(); playTargetAudio(); });
    potionButton.addEventListener("click", function () {
      if (potionButton.disabled) return;
      var amount = model.repairWall(state);
      if (!amount) return;
      sfx.repair();
      say("Ремонтные леса подняты! Стена: " + state.wall + " / " + state.maxWall + ".");
      log("Ремонтные леса: стена +" + amount + ".");
      render();
    });
    volleyButton.addEventListener("click", function () {
      if (volleyButton.disabled || !model.valid(state, currentToken)) return;
      if (!model.castVolley(state)) return;
      ensureAudio();
      sfx.volley();
      var pool = Array.prototype.filter.call(choiceOptions.children, function (button) {
        return !button.disabled && button.dataset.value !== state.task.correct;
      });
      shuffle(pool).slice(0, 2).forEach(function (button) {
        button.disabled = true;
        button.classList.add("removed");
      });
      choiceFeedback.textContent = "Град стрел! Два неверных варианта пали.";
      choiceFeedback.className = "choice-feedback good";
      log("Град стрел: −2 неверных варианта.");
      render();
    });
    salvoButton.addEventListener("click", function () {
      if (salvoButton.disabled) return;
      var shot = model.castSalvo(state);
      if (!shot) return;
      ensureAudio();
      sfx.mana();
      remaining += shot.seconds;
      quizTimer.hidden = false;
      paintTimer();
      say("Залп бастиона выигрывает " + shot.seconds + " секунд!");
      log("Залп: +" + shot.seconds + " секунд к таймеру.");
      render();
    });
    helpButton.addEventListener("click", function () {
      if (helpButton.disabled || helpButton.hidden || !writer || state.phase !== "writing") return;
      var stage = model.currentStage(state);
      if (stage.visualHints) writer.animateCharacter({ strokeAnimationSpeed: 1.4, delayBetweenStrokes: 300 });
    });
    document.addEventListener("visibilitychange", function () {
      var inBattle = state.phase === "writing" || state.phase === "choice";
      if (!inBattle) return;
      if (document.hidden) {
        if (ticker) { pausedRemaining = remaining; stopTicker(); }
      } else if (pausedRemaining !== null) {
        remaining = pausedRemaining;
        pausedRemaining = null;
        armTimer();
      }
    });
    window.addEventListener("resize", function () {
      if (writer && state.phase === "writing") {
        var size = Math.min(340, Math.max(120, writerTarget.clientWidth || 280));
        if (writer.updateDimensions) writer.updateDimensions({ width: size, height: size, padding: 22 });
      }
    });
  }

  function init() {
    if (window.PixelSprites) window.PixelSprites.mount($("sprite-defs"));
    bindEvents();
    paintSound();
    render();
    openStory("intro");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
