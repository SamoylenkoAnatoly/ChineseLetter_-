(function () {
  "use strict";
  var data = window.ToneData;
  var core = window.ToneCore;
  var $ = function (id) { return document.getElementById(id); };
  var storageKey = "koko-tone-tower-v1";
  var state = null;
  var checked = new Set();
  var heard = false;
  var selected = [];
  var playing = false;
  var audio = new Audio();
  audio.preload = "auto";
  var generation = 0;
  var cancelWait = null;
  var sampleButton = null;
  var activeSlot = 0;
  var tips = data.tips;
  var tipIndex = 0;
  var effectTimer = null;
  var rulesDone = false;
  var warmupDone = false;
  var warmupWord = null;
  var warmupHeard = false;
  var departTimer = null;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function updatePrep() {
    var soundDone = checked.size === 4;
    $("step-sound").classList.toggle("done", soundDone);
    $("step-rules").classList.toggle("done", rulesDone);
    $("step-warmup").classList.toggle("done", warmupDone);
    var total = (soundDone ? 1 : 0) + (rulesDone ? 1 : 0) + (warmupDone ? 1 : 0);
    $("readiness-value").textContent = total + " / 3";
    $("readiness").querySelectorAll("i").forEach(function (pip, i) { pip.classList.toggle("on", i < total); });
    $("start").disabled = !soundDone;
    $("start-hint").textContent = soundDone ? "Готовность собрана — врата открываются!" : "Сначала послушай все четыре мелодии";
    $("sound-check").textContent = "Послушано: " + checked.size + " из 4" + (soundDone ? " — шаг выполнен" : " — обязательный шаг");
    if (rulesDone) $("step-rules").querySelector(".step-head small").textContent = "Правила изучены";
    if (warmupDone) $("step-warmup").querySelector(".step-head small").textContent = "Разминка завершена";
  }

  function buildGallery() {
    var gallery = $("enemy-gallery");
    gallery.replaceChildren();
    data.rooms.forEach(function (room, i) {
      var card = el("div", "foe-card");
      card.appendChild(el("span", "foe-floor", "ЭТ. " + (i + 1)));
      var img = el("img");
      img.src = room.sprite; img.alt = ""; img.width = 62; img.height = 62;
      card.append(img, el("b", "", room.monster), el("small", "", room.blurb), el("span", "foe-count", "защита: " + room.count + " атак"));
      gallery.appendChild(card);
    });
  }

  function resetWarmup() {
    warmupHeard = false;
    var pool = data.words.slice(0, 8);
    warmupWord = pool[Math.floor(Math.random() * pool.length)];
    $("warmup-listen-label").textContent = "Услышать пробную атаку";
    $("warmup-feedback").hidden = true;
    $("warmup-retry").hidden = true;
    $("warmup-runes").querySelectorAll("button").forEach(function (button) {
      button.disabled = true;
      button.classList.remove("selected");
      button.setAttribute("aria-pressed", "false");
    });
  }

  function buildWarmup() {
    var runes = $("warmup-runes");
    runes.replaceChildren();
    data.tones.forEach(function (tone) {
      var button = toneButton(tone, false);
      button.disabled = true;
      button.addEventListener("click", function () { warmupChoose(tone.num, button); });
      runes.appendChild(button);
    });
    resetWarmup();
  }

  async function warmupListen() {
    if (!warmupWord) return;
    var ok = await playWords([warmupWord.id], false, null);
    if (!ok) return;
    warmupHeard = true;
    $("warmup-listen-label").textContent = "Послушать ещё раз";
    $("warmup-runes").querySelectorAll("button").forEach(function (button) { button.disabled = false; });
    $("warmup-note").textContent = "Атака услышана. Выбери руну с этой мелодией!";
  }

  function warmupChoose(tone, button) {
    if (!warmupHeard || playing || warmupDone && $("warmup-retry").hidden) return;
    var correct = tone === warmupWord.tone;
    var toneData = data.tones[warmupWord.tone - 1];
    var feedback = $("warmup-feedback");
    feedback.hidden = false;
    feedback.classList.toggle("correct", correct);
    feedback.replaceChildren(el("h3", "", correct ? "Верно! Вот она, мелодия." : "Почти! Смотри, какой это был тон."));
    var row = el("div", "revealed-word");
    row.style.setProperty("--tone", toneData.color);
    var hanzi = el("span", "hanzi", warmupWord.hanzi);
    hanzi.lang = "zh-CN";
    var label = el("div");
    label.append(el("b", "", warmupWord.pinyin), el("small", "", warmupWord.meaning + " · " + warmupWord.tone + "-й тон"));
    row.append(hanzi, label, contour(toneData));
    feedback.appendChild(row);
    feedback.appendChild(el("p", "footnote", correct ? "В бою за такой ответ страж теряет сегмент защиты, а щит восстанавливается." : "Ошибиться не страшно: в бою атака вернётся позже, а щит можно восстановить. " + toneData.desc));
    $("warmup-runes").querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    button.classList.add("selected");
    button.setAttribute("aria-pressed", "true");
    $("warmup-retry").hidden = false;
    if (!warmupDone) { warmupDone = true; updatePrep(); }
    $("warmup-note").textContent = correct ? "Хе-хе, слух не подводит! Можно и ещё разок." : "Теперь ты знаешь эту мелодию. Попробуй другую атаку!";
  }

  function clearEffects() {
    clearTimeout(effectTimer);
    effectTimer = null;
    $("arena").classList.remove("counter", "hit", "combo");
    $("damage-number").textContent = "";
  }

  function renderBattle() {
    var room = data.rooms[state ? state.room : 0];
    var battle = state ? core.battle(state) : { hp: room.count, maxHp: room.count, shield: data.shieldMax, streak: 0, bestStreak: 0, defeated: false };
    $("arena").dataset.theme = room.arena;
    $("arena").classList.toggle("exhausted", battle.shield === 0);
    $("arena").classList.toggle("defeated", battle.defeated);
    $("arena-title").textContent = room.name;
    $("arena-kicker").textContent = state ? (battle.defeated ? "Страж побеждён" : "Слуховая дуэль · " + room.subtitle) : "Приключение начинается";
    $("arena-stage").textContent = "Этаж 0" + ((state ? state.room : 0) + 1);
    $("enemy-name").textContent = room.monster;
    $("enemy-sprite").src = room.sprite;
    $("enemy-sprite").alt = room.monster;
    $("enemy-caption").textContent = room.monster.toUpperCase();
    $("shield-value").textContent = battle.shield === 0 ? "Щит истощён · 0 / 3" : "Щит " + battle.shield + " / " + data.shieldMax;
    $("shield-bar").setAttribute("aria-valuenow", battle.shield);
    $("shield-bar").setAttribute("aria-valuetext", battle.shield === 0 ? "Щит истощён, бой продолжается" : battle.shield + " заряда из " + data.shieldMax);
    $("shield-bar").querySelectorAll("i").forEach(function (segment, i) { segment.classList.toggle("charged", i < battle.shield); });
    $("enemy-hp").textContent = battle.hp + " / " + battle.maxHp;
    $("enemy-bar").setAttribute("aria-valuemax", battle.maxHp);
    $("enemy-bar").setAttribute("aria-valuenow", battle.hp);
    $("enemy-hp-fill").style.width = battle.hp / battle.maxHp * 100 + "%";
    $("streak-value").textContent = battle.streak;
    $("best-streak-label").textContent = "Рекорд: " + battle.bestStreak;
    $("arena-banner").textContent = battle.defeated ? "Хитрый план сработал!" : battle.shield === 0 ? "Щит пуст — бой продолжается!" : "Хитрость против грубой силы";
  }

  function animateBattle() {
    clearEffects();
    var feedback = state.feedback;
    $("arena").classList.add(feedback.correct ? "counter" : "hit");
    if (feedback.combo) $("arena").classList.add("combo");
    $("damage-number").textContent = feedback.correct ? "−" + feedback.damage : (feedback.shieldDelta ? "ЩИТ −1" : "БЛОК");
    effectTimer = setTimeout(clearEffects, 1100);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function contour(tone) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 96 56");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", tone.path);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "4");
    svg.appendChild(path);
    return svg;
  }

  function toneButton(tone, example) {
    var button = el("button", "tone-card");
    button.type = "button";
    button.style.setProperty("--tone", tone.color);
    button.append(el("strong", "", example ? tone.mark : String(tone.num)), contour(tone), el("span", "", tone.num + "-й · " + tone.name.toLowerCase()));
    button.setAttribute("aria-label", tone.num + "-й тон, " + tone.name + (example ? ", послушать образец" : ""));
    return button;
  }

  function save() {
    try { if (state) localStorage.setItem(storageKey, core.serialize(state)); }
    catch (error) { $("storage-notice").textContent = "Сохранение недоступно. Игра работает, но после закрытия страницы прогресс может потеряться."; }
  }

  function stopAudio() {
    generation++;
    if (cancelWait) { cancelWait(); cancelWait = null; }
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    playing = false;
    $("altar").classList.remove("playing");
    $("wizard").classList.remove("casting");
    $("arena").classList.remove("charging");
    if (sampleButton) { sampleButton.removeAttribute("aria-busy"); sampleButton = null; }
  }

  function wait(ms, version) {
    return new Promise(function (resolve) {
      if (version !== generation) { resolve(false); return; }
      var timer = setTimeout(function () { cancelWait = null; resolve(version === generation); }, ms);
      cancelWait = function () { clearTimeout(timer); resolve(false); };
    });
  }

  function playFile(src, version, onStart) {
    return new Promise(function (resolve) {
      if (version !== generation) { resolve(false); return; }
      var settled = false;
      var timeout = setTimeout(function () { finish(false, true); }, 18000);
      function finish(ok, failed) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        audio.onended = null;
        audio.onerror = null;
        cancelWait = null;
        if (failed && version === generation) {
          audio.pause();
          $("audio-error").hidden = false;
          $("audio-error").textContent = "Не удалось воспроизвести запись. Проверь звук и подключение, затем нажми «Послушать» ещё раз. Ответ не засчитан.";
        }
        resolve(ok && version === generation);
      }
      cancelWait = function () { finish(false, false); };
      audio.onended = function () { finish(true, false); };
      audio.onerror = function () { finish(false, true); };
      try {
        audio.src = src;
        audio.load();
        var promise = audio.play();
        if (promise && promise.then) promise.then(function () { if (!settled && version === generation && onStart) onStart(); }, function () { finish(false, true); });
        if (promise && promise.catch) promise.catch(function () { finish(false, true); });
      } catch (error) { finish(false, true); }
    });
  }

  async function playWords(ids, slow, onSegment, onStart) {
    stopAudio();
    var version = generation;
    playing = true;
    $("audio-error").hidden = true;
    $("altar").classList.add("playing");
    if (onSegment && state && state.phase === "question") { clearEffects(); $("arena").classList.add("charging"); }
    updateAnswers();
    for (var i = 0; i < ids.length; i++) {
      if (onSegment) onSegment(i);
      var word = core.words[ids[i]];
      var ok = await playFile(slow ? word.slow : word.audio, version, i === 0 ? onStart : null);
      if (!ok) {
        if (version === generation) { playing = false; $("altar").classList.remove("playing"); $("arena").classList.remove("charging"); updateAnswers(); }
        return false;
      }
      if (i < ids.length - 1 && !(await wait(650, version))) return false;
    }
    if (version !== generation) return false;
    playing = false;
    $("altar").classList.remove("playing");
    $("arena").classList.remove("charging");
    return true;
  }

  async function sample(tone, button, isIntro) {
    var marked = false;
    function markHeard() {
      if (!isIntro || marked) return;
      marked = true;
      checked.add(tone);
      button.classList.add("heard");
      updatePrep();
    }
    var okPromise = playWords(["ma" + tone], false, null, markHeard);
    sampleButton = button;
    button.setAttribute("aria-busy", "true");
    button.classList.add("playing");
    var ok = await okPromise;
    if (sampleButton === button) { button.removeAttribute("aria-busy"); sampleButton = null; }
    button.classList.remove("playing");
    if (!ok && marked && !$("audio-error").hidden) {
      marked = false;
      checked.delete(tone);
      button.classList.remove("heard");
      updatePrep();
    }
    updateAnswers();
  }

  function buildExamples(target, isIntro) {
    data.tones.forEach(function (tone) {
      var button = toneButton(tone, true);
      if (!isIntro) button.appendChild(el("small", "", tone.desc));
      button.addEventListener("click", function () { sample(tone.num, button, isIntro); });
      target.appendChild(button);
    });
  }

  function updateBattleOffset() {
    var active = $("adventure").classList.contains("battle-active");
    var height = active ? document.querySelector(".arena-frame").getBoundingClientRect().height + 20 : 0;
    document.documentElement.style.setProperty("--battle-offset", height + "px");
  }

  function showStart(on) {
    $("start-page").hidden = !on;
    $("battle-layout").hidden = on;
    $("journey").hidden = on;
  }

  function show(screen) {
    $("adventure").classList.toggle("battle-active", screen === "question-screen");
    ["room-screen", "question-screen", "reward-screen"].forEach(function (id) { $(id).hidden = id !== screen; });
    updateBattleOffset();
  }

  function focusHeading() {
    var heading = document.querySelector(".screen:not([hidden]) h2");
    if (heading) heading.focus({ preventScroll: true });
    if ($("adventure").classList.contains("battle-active")) document.querySelector(".arena-frame").scrollIntoView({ block: "start", behavior: "instant" });
  }

  function renderMap() {
    $("room-map").replaceChildren();
    data.rooms.forEach(function (room, i) {
      var done = state && state.completed.includes(i);
      var active = state && state.room === i && !done;
      var li = el("li", "map-room " + (done ? "done" : active ? "active" : "locked"));
      if (active) li.setAttribute("aria-current", "step");
      li.setAttribute("aria-label", "Этаж " + (i + 1) + ": " + room.name + ", " + (done ? "страж побеждён" : active ? "текущий бой" : "ещё закрыт"));
      li.appendChild(el("span", "room-rune", done ? "✓" : String(i + 1)));
      var label = el("div");
      label.append(el("b", "", room.name), el("small", "", done ? "Страж побеждён" : active ? "Текущий бой" : "Ещё закрыто"));
      var monster = el("img", "map-monster");
      monster.src = room.sprite; monster.alt = "";
      li.append(label, monster);
      if (active) { var hero = el("img", "map-hero"); hero.src = "assets/wizard.svg"; hero.alt = ""; li.appendChild(hero); }
      $("room-map").appendChild(li);
    });
    var count = state ? state.mastered.length : 0;
    $("quest-count").textContent = count + " / 30";
    $("progress-fill").style.width = count / 30 * 100 + "%";
    $("quest-label").textContent = state ? "Побеждено стражей: " + state.completed.length + " / 4 · освоено атак" : "Четыре стража между нами и сокровищем";
    $("quest-progress").setAttribute("aria-valuenow", count);
    $("reset").hidden = !state;
  }

  function buildAnswers(question) {
    $("answers").replaceChildren();
    question.words.forEach(function (id, slot) {
      var fieldset = el("fieldset", "answer-group");
      fieldset.appendChild(el("legend", "", question.words.length === 2 ? (slot === 0 ? "Первая руна · первый слог" : "Вторая руна · второй слог") : "Выбери мелодию услышанного слога"));
      var cards = el("div", "tone-cards" + (question.options.length === 2 ? " two" : ""));
      question.options.forEach(function (num) {
        var button = toneButton(data.tones[num - 1], false);
        button.dataset.slot = slot;
        button.dataset.tone = num;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("focus", function () { activeSlot = slot; });
        button.addEventListener("click", function () { choose(slot, num); });
        cards.appendChild(button);
      });
      fieldset.appendChild(cards);
      $("answers").appendChild(fieldset);
    });
  }

  function updateAnswers() {
    var available = state && state.phase === "question" && heard && !playing && !$("tone-scroll").open;
    $("answers").querySelectorAll("button").forEach(function (button) {
      button.disabled = !available;
      var isSelected = selected[Number(button.dataset.slot)] === Number(button.dataset.tone);
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    $("submit-pair").disabled = !available || selected.filter(Number.isInteger).length !== 2;
  }

  function choose(slot, tone) {
    if (!state || state.phase !== "question" || !heard || playing || $("tone-scroll").open || !state.current.options.includes(tone)) return;
    selected[slot] = tone;
    activeSlot = slot;
    if (state.current.words.length === 1) answer();
    else {
      updateAnswers();
      if (slot === 0 && !selected[1]) {
        activeSlot = 1;
        $("answers").querySelector('[data-slot="1"]').focus({ preventScroll: true });
      }
    }
  }

  function answer() {
    if (!state || !heard || playing || state.phase !== "question") return;
    var nextState = core.dispatch(state, { type: "answer", tones: selected.slice() });
    if (nextState === state) return;
    state = nextState;
    save();
    renderFeedback();
    renderMap();
    renderBattle();
    animateBattle();
    updateAnswers();
    $("next").focus({ preventScroll: true });
  }

  function renderFeedback() {
    var feedback = state.feedback;
    selected = feedback.selected.slice();
    $("feedback").hidden = false;
    $("feedback").classList.toggle("correct", feedback.correct);
    $("feedback-heading").textContent = feedback.correct ? (feedback.combo ? "Тройная серия! Хитрое отражение!" : "Атака отражена! Страж получил урон.") : "Щит принял удар. Разберём заклинание!";
    $("dialogue").textContent = feedback.correct ? (core.battle(state).defeated ? "Хе-хе! Страж повержен, а посох даже не запылился. Отличная работа!" : "Хе-хе! Его же магией — по его же броне. Вот это я называю хитрым планом!") : state.shield === 0 ? "Щит пуст, но хитрость при нас! Следующий верный ответ вернёт заряд. Бой продолжается." : "Упс! Проверка щита прошла успешно. Теперь разберём тон — и вернём эту атаку позже.";
    $("battle-log").textContent = feedback.correct ? "Контрзаклинание: −" + feedback.damage + " здоровья стража · " + (feedback.shieldDelta ? "щит +1" : "щит полон") + " · серия " + state.streak : "Атака не отражена · " + (feedback.shieldDelta ? "щит −1" : "щит истощён, бой продолжается") + " · серия сброшена";
    $("revealed-words").replaceChildren();
    state.current.words.forEach(function (id, i) {
      var word = core.words[id];
      var tone = data.tones[word.tone - 1];
      var row = el("div", "revealed-word");
      row.style.setProperty("--tone", tone.color);
      var hanzi = el("span", "hanzi", word.hanzi);
      hanzi.lang = "zh-CN";
      var label = el("div");
      label.append(el("b", "", word.pinyin), el("small", "", word.meaning + " · " + word.tone + "-й тон"));
      row.append(hanzi, label, contour(tone));
      $("revealed-words").appendChild(row);
      var desc = el("p", "footnote", (state.current.words.length === 2 ? "Слог " + (i + 1) + ": " : "") + tone.desc);
      $("revealed-words").appendChild(desc);
    });
    $("feedback-note").textContent = feedback.correct ? (state.repeat ? "Повторная атака отражена. Ещё один сегмент защиты стража сломан!" : "Заклинание освоено. Защита стража ослабла на один сегмент.") : "Эта атака вернётся позже. Для победы её нужно отразить верно без подсказки. Даже с пустым щитом можно продолжать.";
    $("compare-tones").replaceChildren();
    data.tones.forEach(function (tone) {
      var button = el("button", "", tone.num + " · " + tone.mark);
      button.type = "button";
      button.style.setProperty("--tone", tone.color);
      button.addEventListener("click", function () { sample(tone.num, button, false); });
      $("compare-tones").appendChild(button);
    });
    $("submit-pair").hidden = true;
    $("next").hidden = false;
  }

  function render() {
    stopAudio();
    clearEffects();
    heard = false;
    selected = [];
    activeSlot = 0;
    $("audio-error").hidden = true;
    $("final-code").textContent = "";
    $("feedback").hidden = true;
    $("revealed-words").replaceChildren();
    $("compare-tones").replaceChildren();
    $("feedback-heading").textContent = "";
    $("feedback-note").textContent = "";
    $("next").hidden = true;
    $("copy-status").textContent = "";
    renderMap();
    renderBattle();
    if (!state) { showStart(true); show("room-screen"); return; }
    showStart(false);
    if (state.phase === "reward") {
      show("reward-screen");
      $("final-code").textContent = core.reward(state) || "";
      $("accuracy").textContent = Math.round(state.firstCorrect / state.firstAnswers * 100) + "%";
      $("repeats").textContent = String(state.repeats);
      $("best-streak").textContent = String(state.bestStreak);
      $("battle-log").textContent = "Победа! Четыре стража побеждены. Все 30 заклинаний освоены.";
      $("dialogue").textContent = "Хе-хе! Ни одного дракона не обидели — просто перехитрили всех слухом. Забирай наш честно заработанный код!";
      return;
    }
    var room = data.rooms[state.room];
    if (state.phase === "room" || state.phase === "cleared") {
      show("room-screen");
      var cleared = state.phase === "cleared";
      $("room-kicker").textContent = cleared ? "Победа · печать «" + room.seal + "» получена" : "Этаж " + (state.room + 1) + " из 4 · " + room.count + " атак";
      $("room-heading").textContent = cleared ? room.monster + " побеждён!" : "Противник: " + room.monster;
      $("room-description").textContent = cleared ? "Все атаки этого стража отражены, включая повторные. Лестница наверх открыта — поднимемся к следующему противнику!" : room.description;
      $("room-note").textContent = cleared ? "На новом этаже щит восстановится до 3 зарядов. Лучшая серия останется в твоих достижениях." : "Слушай атаку целиком, затем выбирай тон-контрзаклинание. Верный ответ наносит урон и восстанавливает щит.";
      $("enter-room").textContent = cleared ? "Подняться выше →" : "Вступить в бой →";
      $("dialogue").textContent = cleared ? "Хе-хе! Этот страж теперь знает, что уши сильнее кулаков. Пойдём выше?" : room.quip;
      $("battle-log").textContent = cleared ? "Страж побеждён · защита 0 / " + room.count : "Страж готов к дуэли · щит полон · никакой спешки";
      return;
    }
    show("question-screen");
    var pair = state.current.words.length === 2;
    $("question-counter").textContent = "Этаж " + (state.room + 1) + " · " + (state.repeat ? "повторная атака" : "атака " + state.cursor + " / " + room.count);
    $("repeat-tag").hidden = !state.repeat;
    $("question-heading").textContent = pair ? "Подготовь двойное контрзаклинание" : "Выбери тон-контрзаклинание";
    $("pair-note").hidden = !pair;
    $("submit-pair").hidden = !pair;
    $("listen-label").textContent = "Услышать атаку";
    $("listen-status").textContent = "Сначала прослушай атаку до конца.";
    $("battle-log").textContent = "Страж готовит " + (pair ? "двойную атаку" : "заклинание") + ". Слушай и выбирай контрруну.";
    $("dialogue").textContent = state.repeat ? "Опять эта атака? Хе-хе, теперь мы знаем, на что обратить внимание. Узнай тон сам!" : pair ? "Одна голова, вторая голова… Две мелодии, две руны. Перехитрим обеих по порядку!" : room.quip;
    buildAnswers(state.current);
    if (state.phase === "feedback") renderFeedback();
    updateAnswers();
  }

  async function listen(slow) {
    if (!state || !["question", "feedback"].includes(state.phase) || $("tone-scroll").open) return;
    var questionId = state.current.id;
    heard = false;
    var playback = playWords(state.current.words, slow, function (index) {
      $("listen-label").textContent = state.current.words.length === 2 ? "Звучит слог " + (index + 1) + " из 2…" : "Слушай мелодию…";
      $("listen-status").textContent = slow ? "Замедленная атака" : "Слушай движение голоса";
    });
    var version = generation;
    var ok = await playback;
    if (version !== generation || !state || !state.current || state.current.id !== questionId) return;
    $("listen-label").textContent = "Послушать ещё раз";
    if (ok) {
      heard = true;
      $("listen-status").textContent = "Атака услышана. Выбирай контрзаклинание!";
    } else $("listen-status").textContent = "Прослушай атаку до конца перед ответом.";
    updateAnswers();
  }

  function next() {
    if (!state) return;
    var nextState = core.dispatch(state, { type: "next" });
    if (nextState === state) return;
    state = nextState;
    save(); render(); focusHeading();
  }

  function reset() {
    if (!window.confirm("Начать заново? Текущий прогресс и полученные печати будут сброшены.")) return;
    stopAudio();
    clearTimeout(departTimer); departTimer = null;
    $("start-page").classList.remove("departing");
    state = null; checked.clear();
    rulesDone = false; warmupDone = false;
    $("intro-tones").querySelectorAll("button").forEach(function (b) { b.classList.remove("heard"); });
    $("step-rules").querySelector(".step-head small").textContent = "Как работают щит и урон";
    $("step-warmup").querySelector(".step-head small").textContent = "Пробная атака без риска — по желанию";
    $("warmup-note").textContent = "Хе-хе, попробуй хитрый план на пробном страже! Это не влияет на приключение.";
    buildWarmup();
    updatePrep();
    try { localStorage.removeItem(storageKey); } catch (error) {}
    $("dialogue").textContent = "Новое приключение? Хе-хе, у меня уже есть хитрый план. Послушаем четыре мелодии — и в бой!";
    render(); focusHeading();
  }

  window.addEventListener("resize", updateBattleOffset);
  if ("ResizeObserver" in window) new ResizeObserver(updateBattleOffset).observe(document.querySelector(".arena-frame"));

  buildExamples($("intro-tones"), true);
  buildExamples($("help-tones"), false);
  buildGallery();
  buildWarmup();
  updatePrep();
  $("start").addEventListener("click", function () {
    if (checked.size !== 4 || departTimer) return;
    var seed = window.crypto && window.crypto.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
    state = core.create(seed); save();
    function enterBattle() {
      departTimer = null;
      $("start-page").classList.remove("departing");
      showStart(false);
      render(); focusHeading();
    }
    if (motion.matches) { enterBattle(); return; }
    stopAudio();
    $("start-page").classList.add("departing");
    departTimer = setTimeout(enterBattle, 950);
  });
  $("rules-ok").addEventListener("click", function () { rulesDone = true; updatePrep(); });
  $("warmup-listen").addEventListener("click", warmupListen);
  $("warmup-retry").addEventListener("click", resetWarmup);
  $("warmup-skip").addEventListener("click", function () {
    if (warmupDone) return;
    warmupDone = true; updatePrep();
    $("warmup-note").textContent = "Разминка пропущена — хитрость победит и без неё. В бой!";
    resetWarmup();
  });
  $("enter-room").addEventListener("click", next);
  $("next").addEventListener("click", next);
  $("submit-pair").addEventListener("click", answer);
  $("listen").addEventListener("click", function () { listen(false); });
  $("slow").addEventListener("click", function () { listen(true); });
  $("reset").addEventListener("click", reset);
  $("again").addEventListener("click", reset);
  $("wizard").addEventListener("click", function () {
    $("dialogue").textContent = tips[tipIndex++ % tips.length];
    clearEffects();
    if (!playing) {
      $("wizard").classList.remove("casting");
      void $("wizard").offsetWidth;
      $("wizard").classList.add("casting");
    }
  });
  $("help").addEventListener("click", function () {
    var interrupted = playing;
    stopAudio();
    if (interrupted) { heard = false; $("listen-label").textContent = "Послушать ещё раз"; $("listen-status").textContent = "Запись прервана. Прослушай её ещё раз."; }
    $("tone-scroll").showModal(); updateAnswers();
  });
  $("close-help").addEventListener("click", function () { $("tone-scroll").close(); });
  $("tone-scroll").addEventListener("close", function () { stopAudio(); updateAnswers(); $("help").focus({ preventScroll: true }); });
  $("copy-code").addEventListener("click", async function () {
    var code = state && core.reward(state);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      $("copy-status").textContent = "Код скопирован!";
    } catch (error) {
      var selection = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents($("final-code"));
      selection.removeAllRanges(); selection.addRange(range);
      $("copy-status").textContent = "Код выделен. Нажми Ctrl+C или скопируй четыре цифры вручную.";
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || $("tone-scroll").open || event.target.closest("input,textarea,select,[contenteditable]")) return;
    if (!state || state.phase !== "question") return;
    if (/^[1-4]$/.test(event.key)) { event.preventDefault(); choose(activeSlot, Number(event.key)); }
    else if (event.code === "Space" && !event.target.closest("button,a")) { event.preventDefault(); listen(false); }
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      clearEffects();
      var interrupted = playing;
      stopAudio();
      if (interrupted) { heard = false; $("listen-label").textContent = "Послушать ещё раз"; $("listen-status").textContent = "Запись прервана. Прослушай её ещё раз."; }
      updateAnswers();
    }
  });
  try {
    var stored = localStorage.getItem(storageKey);
    if (stored) {
      state = core.restore(stored);
      $("storage-notice").textContent = state ? "Прогресс восстановлен. Продолжай с того места, где остановился." : "Сохранение повреждено или устарело. Начни новое приключение.";
    }
  } catch (error) { $("storage-notice").textContent = "Сохранение недоступно. Прогресс останется только на этой странице."; }
  render();
})();
