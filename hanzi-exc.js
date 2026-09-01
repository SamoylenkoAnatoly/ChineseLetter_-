(function () {
  const cfg = window.HANZI || {};
  const CHAR = cfg.char;
  const ROUNDS = 5;
  const targetEl = document.getElementById("character-target");
  const progressEl = document.getElementById("progress");
  const statusEl = document.getElementById("status");
  const roundsEl = document.getElementById("rounds");
  const animateBtn = document.getElementById("animate-btn");
  const retryBtn = document.getElementById("retry-btn");
  const prizeEl = document.getElementById("prize");
  const prizeSpan = prizeEl.querySelector("span");
  if (cfg.prize && prizeSpan) prizeSpan.textContent = String(cfg.prize);

  let strokeCount = 0;
  let completed = 0;
  let finished = false;
  let nextTimer = null;

  for (let i = 0; i < ROUNDS; i++) {
    const slot = document.createElement("div");
    slot.className = "round-slot" + (i === 0 ? " current" : "");
    slot.textContent = CHAR;
    slot.setAttribute("aria-label", "Написание " + (i + 1));
    roundsEl.appendChild(slot);
  }

  function slots() {
    return roundsEl.querySelectorAll(".round-slot");
  }

  function renderSlots(justFilledIndex) {
    slots().forEach(function (slot, i) {
      slot.className = "round-slot";
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

  const writer = HanziWriter.create(targetEl, CHAR, {
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
    highlightOnComplete: true,
    onLoadCharDataSuccess: function (data) {
      strokeCount = data.strokes.length;
      setProgress(0);
    },
    onLoadCharDataError: function () {
      setStatus("Не удалось загрузить данные иероглифа", "miss");
    }
  });

  HanziEmbed.setup(writer, targetEl);

  function startQuiz() {
    if (finished) return;
    setProgress(0);
    setStatus("Обведите контур, начиная с первой черты");
    writer.quiz({
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
        const justFilled = completed;
        completed += 1;
        renderSlots(justFilled);

        if (completed >= ROUNDS) {
          finished = true;
          setProgress(strokeCount);
          setStatus("Готово: " + CHAR + " написан 5 раз", "ok");
          prizeEl.classList.add("show");
          retryBtn.textContent = "Начать сначала";
          animateBtn.disabled = true;
          return;
        }

        progressEl.textContent = "Написание " + completed + " из " + ROUNDS + " готово";
        setStatus("Верно: " + CHAR + ". Следующее написание…", "ok");
        nextTimer = setTimeout(function () {
          writer.cancelQuiz();
          writer.hideCharacter({ duration: 0 });
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
    writer.cancelQuiz();
    writer.hideCharacter({ duration: 0 });
    startQuiz();
  }

  retryBtn.addEventListener("click", function () {
    if (finished) {
      resetAll();
      return;
    }
    clearTimer();
    writer.cancelQuiz();
    writer.hideCharacter({ duration: 0 });
    startQuiz();
  });

  animateBtn.addEventListener("click", function () {
    if (finished) return;
    clearTimer();
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
