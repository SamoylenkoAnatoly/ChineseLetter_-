(function () {
  const cfg = window.HANZI || {};
  const CHARS = cfg.chars || [];
  const WORD = CHARS.join("");
  const ROUNDS = 5;
  const targetEls = CHARS.map(function (ch, i) {
    return document.getElementById("target-" + i);
  });
  const progressEl = document.getElementById("progress");
  const statusEl = document.getElementById("status");
  const roundsEl = document.getElementById("rounds");
  const animateBtn = document.getElementById("animate-btn");
  const retryBtn = document.getElementById("retry-btn");
  const prizeEl = document.getElementById("prize");
  const prizeSpan = prizeEl && prizeEl.querySelector("span");
  if (cfg.prize && prizeSpan) prizeSpan.textContent = String(cfg.prize);

  const strokeCounts = CHARS.map(function () { return 0; });
  let strokeCount = 0;
  let charIndex = 0;
  let completed = 0;
  let finished = false;
  let nextTimer = null;

  for (let i = 0; i < ROUNDS; i++) {
    const slot = document.createElement("div");
    slot.className = "round-slot wide" + (i === 0 ? " current" : "");
    slot.textContent = WORD;
    slot.setAttribute("aria-label", "Написание " + (i + 1));
    roundsEl.appendChild(slot);
  }

  function slots() {
    return roundsEl.querySelectorAll(".round-slot");
  }

  function renderSlots(justFilledIndex) {
    slots().forEach(function (slot, i) {
      slot.className = "round-slot wide";
      if (i < completed) {
        slot.classList.add("done");
        if (i === justFilledIndex) slot.classList.add("just-filled");
      } else if (!finished && i === completed) {
        slot.classList.add("current");
      }
    });
  }

  function setProgress(strokeDone) {
    if (finished) {
      progressEl.textContent = "Написано 5 из 5";
      return;
    }
    progressEl.textContent =
      "Написание " + (completed + 1) + " из " + ROUNDS +
      " · иероглиф " + (charIndex + 1) + " из " + CHARS.length +
      " · черта " + strokeDone + " из " + strokeCount;
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function clearTimer() {
    if (nextTimer) {
      clearTimeout(nextTimer);
      nextTimer = null;
    }
  }

  const writerOptions = {
    width: 280,
    height: 280,
    padding: 24,
    renderer: "canvas",
    showCharacter: false,
    showOutline: true,
    strokeColor: "#1c1917",
    outlineColor: "#d6cfc3",
    drawingColor: "#b42318",
    highlightColor: "#b42318",
    highlightCompleteColor: "#166534",
    drawingWidth: 8,
    leniency: 2,
    acceptBackwardsStrokes: true,
    showHintAfterMisses: 2,
    highlightOnComplete: true
  };

  const writers = CHARS.map(function (ch, i) {
    return HanziWriter.create(targetEls[i], ch, Object.assign({}, writerOptions, {
      onLoadCharDataSuccess: function (data) {
        strokeCounts[i] = data.strokes.length;
        if (i === charIndex) {
          strokeCount = strokeCounts[i];
          setProgress(0);
        }
      },
      onLoadCharDataError: function () {
        if (i === charIndex) {
          setStatus("Не удалось загрузить данные иероглифа", "miss");
        }
      }
    }));
  });

  HanziEmbed.setupWord(writers, targetEls);

  function resetChars() {
    writers.forEach(function (writer) {
      writer.cancelQuiz();
      writer.hideCharacter({ duration: 0 });
    });
    charIndex = 0;
    strokeCount = strokeCounts[0];
  }

  function startQuiz() {
    if (finished) return;
    setProgress(0);
    setStatus("Обведите контур, начиная с первой черты");
    writers[charIndex].quiz({
      onCorrectStroke: function (data) {
        const done = data.strokeNum + 1;
        setProgress(done);
        if (data.strokesRemaining > 0) {
          setStatus("Верно. Осталось черт: " + data.strokesRemaining);
        }
      },
      onMistake: function (data) {
        if (data.mistakesOnStroke >= 2) {
          setStatus("Не та черта — смотрите подсказку", "miss");
        } else {
          setStatus("Попробуйте ещё раз эту черту", "miss");
        }
      },
      onComplete: function () {
        const writer = writers[charIndex];
        if (charIndex < CHARS.length - 1) {
          setStatus("Верно: " + CHARS[charIndex] + ". Следующий иероглиф…", "ok");
          nextTimer = setTimeout(function () {
            writer.cancelQuiz();
            writer.showCharacter({ duration: 0 });
            charIndex += 1;
            strokeCount = strokeCounts[charIndex];
            startQuiz();
          }, 500);
          return;
        }

        const justFilled = completed;
        completed += 1;
        renderSlots(justFilled);

        if (completed >= ROUNDS) {
          finished = true;
          setProgress(strokeCount);
          setStatus("Готово: " + WORD + " написан 5 раз", "ok");
          prizeEl.classList.add("show");
          retryBtn.textContent = "Начать сначала";
          animateBtn.disabled = true;
          return;
        }

        progressEl.textContent = "Написание " + completed + " из " + ROUNDS + " готово";
        setStatus("Верно: " + WORD + ". Следующее написание…", "ok");
        nextTimer = setTimeout(function () {
          resetChars();
          startQuiz();
        }, 700);
      }
    });
  }

  function resetAll() {
    clearTimer();
    finished = false;
    completed = 0;
    prizeEl.classList.remove("show");
    retryBtn.textContent = "Заново";
    animateBtn.disabled = false;
    renderSlots();
    resetChars();
    startQuiz();
  }

  retryBtn.addEventListener("click", function () {
    if (finished) {
      resetAll();
      return;
    }
    clearTimer();
    resetChars();
    startQuiz();
  });

  animateBtn.addEventListener("click", function () {
    if (finished) return;
    clearTimer();
    const writer = writers[charIndex];
    writer.cancelQuiz();
    writer.hideCharacter({ duration: 0 });
    setStatus("Смотрите порядок черт");
    writer.animateCharacter({
      onComplete: function () {
        writer.hideCharacter({ duration: 200 });
        startQuiz();
      }
    });
  });

  startQuiz();
})();
