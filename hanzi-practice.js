(function () {
  const cfg = window.HANZI || {};
  const CHAR = cfg.char;
  const targetEl = document.getElementById("character-target");
  const progressEl = document.getElementById("progress");
  const statusEl = document.getElementById("status");
  let strokeCount = 0;

  function setProgress(done) {
    progressEl.textContent = "Черта " + done + " из " + strokeCount;
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
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
        setProgress(strokeCount);
        setStatus("Верно: " + CHAR, "ok");
      }
    });
  }

  document.getElementById("retry-btn").addEventListener("click", function () {
    writer.cancelQuiz();
    writer.hideCharacter({ duration: 0 });
    startQuiz();
  });

  document.getElementById("animate-btn").addEventListener("click", function () {
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
