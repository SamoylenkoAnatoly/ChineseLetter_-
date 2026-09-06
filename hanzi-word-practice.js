(function () {
  const cfg = window.HANZI || {};
  const CHARS = cfg.chars || [];
  const WORD = CHARS.join("");
  const targetEls = CHARS.map(function (ch, i) {
    return document.getElementById("target-" + i);
  });
  const progressEl = document.getElementById("progress");
  const statusEl = document.getElementById("status");
  const animateBtn = document.getElementById("animate-btn");
  const retryBtn = document.getElementById("retry-btn");

  const strokeCounts = CHARS.map(function () { return 0; });
  let strokeCount = 0;
  let charIndex = 0;
  let nextTimer = null;

  function setProgress(done) {
    progressEl.textContent =
      "Иероглиф " + (charIndex + 1) + " из " + CHARS.length +
      " · черта " + done + " из " + strokeCount;
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
    setProgress(0);
    setStatus("Обведите контур, начиная с первой черты");
    writers[charIndex].quiz({
      onCorrectStroke: function (data) {
        setProgress(data.strokeNum + 1);
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
        setProgress(strokeCount);
        setStatus("Верно: " + WORD, "ok");
      }
    });
  }

  retryBtn.addEventListener("click", function () {
    clearTimer();
    resetChars();
    startQuiz();
  });

  animateBtn.addEventListener("click", function () {
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
