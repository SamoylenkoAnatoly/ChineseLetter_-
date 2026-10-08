/* Мастерская Синнабона: анимация черт, конструктор, тренажёры письма, разборы ключей, картотека 214 ключей */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function sparkle(host, count) {
      if (!reducedMotion && window.HanziSite) {
        window.HanziSite.sparkBurst(host, { count: count || 40, colors: ["#29b6f6", "#cbb1fb", "#80e5dc", "#f4cc85"] });
      }
    }

    /* ── Маршрут: подсветка и клики по треку ─────────────── */
    (function initTrack() {
      var stops = ["strokes", "graphemes", "radicals", "keys", "finale"];
      var buttons = Array.prototype.slice.call(document.querySelectorAll(".chapter-track button"));
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var el = document.getElementById(btn.getAttribute("data-target"));
          if (el) el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
        });
      });
      function setCurrent(id) {
        var idx = stops.indexOf(id);
        if (idx < 0) return;
        buttons.forEach(function (btn, i) {
          btn.classList.toggle("current", i === idx);
          btn.classList.toggle("done", i < idx);
        });
      }
      if ("IntersectionObserver" in window) {
        var seen = {};
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) seen[entry.target.id] = entry.intersectionRatio;
            else delete seen[entry.target.id];
          });
          var bestId = null;
          var bestRatio = 0;
          for (var id in seen) {
            if (seen[id] > bestRatio) { bestRatio = seen[id]; bestId = id; }
          }
          if (bestId) setCurrent(bestId);
        }, { rootMargin: "-70px 0px -35% 0px", threshold: [0, 0.15, 0.4, 0.75] });
        stops.forEach(function (id) {
          var el = document.getElementById(id);
          if (el) observer.observe(el);
        });
      }
    })();

    /* ── Галерея черт: повтор анимации по клику ──────────── */
    Array.prototype.forEach.call(document.querySelectorAll(".stroke-tile"), function (tile) {
      tile.addEventListener("click", function () {
        var path = tile.querySelector(".stroke-path");
        if (!path) return;
        path.classList.remove("drawn");
        /* принудительный reflow, чтобы анимация перезапустилась */
        void path.getBoundingClientRect();
        path.classList.add("drawn");
      });
    });

    /* ── Конструктор 明 = 日 + 月 ─────────────────────────── */
    (function initConstructor() {
      var box = document.getElementById("constructor");
      var btn = document.getElementById("ctor-btn");
      var note = document.getElementById("ctor-note");
      if (!box || !btn) return;
      var merged = false;
      btn.addEventListener("click", function () {
        if (!merged) {
          merged = true;
          box.classList.add("merged");
          note.innerHTML = "<b>明 míng — «светлый, ясный».</b> Солнце и луна светят вместе — вот и яркий свет! Так графемы складываются в новые знаки.";
          btn.textContent = "Разобрать заново";
          sparkle(box, 55);
          if (window.HanziSite) window.HanziSite.playAudio("audio/ming.mp3", 1, "明");
        } else {
          merged = false;
          box.classList.remove("merged");
          note.textContent = "Свет солнца и луны вместе — яркий. Что же получится?";
          btn.textContent = "Соединить";
        }
      });
    })();

    /* ── Тренажёры письма (HanziWriter) ──────────────────── */
    var writers = [];

    function setupWriter(cfg) {
      var target = document.getElementById(cfg.target);
      var status = document.getElementById(cfg.statusId);
      var progress = document.getElementById(cfg.progressId);
      var dotsBox = document.getElementById(cfg.dotsId);
      var success = document.getElementById(cfg.successId);
      var retryBtn = document.getElementById(cfg.retryId);
      var animateBtn = document.getElementById(cfg.animateId);
      if (!target || !status || !progress) return null;

      var dots = [];
      var i;
      for (i = 0; i < cfg.strokes; i++) {
        var s = document.createElement("span");
        dotsBox.appendChild(s);
        dots.push(s);
      }

      var writer = null;
      var writerSize = 0;
      var loadFailed = false;
      var generation = 0;
      var quizVersion = 0;
      var completeTimer = null;
      var resizeTimer = null;

      function setProgress(count) {
        progress.textContent = "Черта " + count + " из " + cfg.strokes;
        dots.forEach(function (dot, index) { dot.classList.toggle("done", index < count); });
      }

      function startQuiz() {
        if (!writer || loadFailed) { createWriter(); return; }
        var version = ++quizVersion;
        clearTimeout(completeTimer);
        writer.cancelQuiz();
        writer.resumeAnimation();
        if (success) success.hidden = true;
        setProgress(0);
        status.textContent = "Обведи иероглиф пальцем или мышкой";
        writer.quiz({
          onCorrectStroke: function (data) {
            if (version !== quizVersion) return;
            setProgress(data.strokeNum + 1);
            status.textContent = "Отлично! Продолжай";
            sparkle(target, 12);
          },
          onMistake: function (data) {
            if (version !== quizVersion) return;
            status.textContent = "Попробуй черту №" + (data.strokeNum + 1) + " ещё раз. Кнопка «Показать черты» поможет";
          },
          onComplete: function () {
            if (version !== quizVersion) return;
            setProgress(cfg.strokes);
            status.textContent = "Иероглиф " + cfg.character + " написан верно!";
            if (success) success.hidden = false;
            sparkle(target, 60);
            completeTimer = setTimeout(function () { if (version === quizVersion) sparkle(target, 25); }, 300);
          }
        });
      }

      function createWriter() {
        quizVersion++;
        clearTimeout(completeTimer);
        if (!window.HanziWriter) {
          status.textContent = "Тренажёр не загрузился. Проверь интернет и обнови страницу";
          return;
        }
        var version = ++generation;
        if (writer) { writer.cancelQuiz(); writer.pauseAnimation(); }
        target.replaceChildren();
        loadFailed = false;
        var size = target.clientWidth || 200;
        writerSize = size;
        writer = HanziWriter.create(target, cfg.character, {
          width: size,
          height: size,
          padding: 10,
          showOutline: true,
          strokeColor: "#29b6f6",
          outlineColor: "#dacbb4",
          drawingColor: "#0288d1",
          highlightColor: "#b3e5fc",
          highlightCompleteColor: "#29b6f6",
          onLoadCharDataError: function () {
            if (version !== generation) return;
            loadFailed = true;
            status.textContent = "Не удалось загрузить черты. Проверь интернет и нажми «Попробовать заново»";
          }
        });
        startQuiz();
      }

      retryBtn.addEventListener("click", startQuiz);
      animateBtn.addEventListener("click", function () {
        if (!writer || loadFailed) { createWriter(); return; }
        var version = ++quizVersion;
        clearTimeout(completeTimer);
        writer.cancelQuiz();
        writer.resumeAnimation();
        if (success) success.hidden = true;
        setProgress(0);
        status.textContent = "Смотри порядок черт";
        writer.animateCharacter({
          onComplete: function () {
            if (version !== quizVersion) return;
            status.textContent = "Теперь твоя очередь — нажми «Попробовать заново»";
          }
        });
      });

      window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          if (writer && target.clientWidth > 0 && Math.abs(target.clientWidth - writerSize) > 1) createWriter();
        }, 150);
      });
      document.addEventListener("visibilitychange", function () {
        if (!writer) return;
        if (document.hidden) writer.pauseAnimation();
        else writer.resumeAnimation();
      });

      createWriter();
      return { reset: startQuiz };
    }

    var writerRen = setupWriter({ target: "writer-ren-target", statusId: "ren-status", progressId: "ren-progress", dotsId: "ren-dots", successId: "ren-success", retryId: "ren-retry", animateId: "ren-animate", character: "人", strokes: 2 });
    var writerMing = setupWriter({ target: "writer-ming-target", statusId: "ming-status", progressId: "ming-progress", dotsId: "ming-dots", successId: "ming-success", retryId: "ming-retry", animateId: "ming-animate", character: "明", strokes: 8 });

    /* ── Карточки-разборы: роль частей иероглифа ─────────── */
    var decompData = {
      "河": {
        radical: "<b class=\"rad\">氵 — ключ «вода» (три капли, sān diǎn shuǐ).</b> Он задаёт смысловую категорию: знак как-то связан с водой или жидкостью. 河 — это «река»!",
        rest: "<b class=\"pho\">可 kě «возможно» — фонетик.</b> К смыслу реки он отношения не имеет: его работа — подсказать звучание. kě похоже на hé, правда?"
      },
      "汁": {
        radical: "<b class=\"rad\">氵 — ключ «вода».</b> Смысловая категория «жидкость»: сок тоже жидкий! Именно ключ говорит, что 汁 — это «сок», а не что-то сухое.",
        rest: "<b class=\"pho\">十 shí «десять» — чистый фонетик.</b> О значении он не говорит ничего, зато подсказывает звук: shí → zhī. Хитрый конструктор!"
      },
      "拿": {
        radical: "<b class=\"rad\">扌 — ключ «рука» (tí shǒu páng).</b> Категория «действие рукой»: хватать, брать, держать. 拿 — «брать»!",
        rest: "<b class=\"pho\">合 hé «соединять» — смысловой компонент.</b> Чтобы взять предмет, соединяешь пальцы вокруг него. Здесь вторая часть работает на смысл, а не на звук."
      }
    };
    Array.prototype.forEach.call(document.querySelectorAll(".decomp-card"), function (card) {
      var word = card.getAttribute("data-word");
      var data = decompData[word];
      if (!data) return;
      var note = card.querySelector(".decomp-note");
      var parts = Array.prototype.slice.call(card.querySelectorAll(".part"));
      parts.forEach(function (part) {
        part.addEventListener("click", function () {
          var kind = part.getAttribute("data-part");
          parts.forEach(function (p) { p.classList.toggle("active", p === part); });
          if (note && data[kind]) note.innerHTML = data[kind];
          sparkle(card, 10);
        });
      });
    });

    /* ── Картотека: все 214 ключей Канси ─────────────────── */
    var resetKeys = (function initKeys() {
      var grid = document.getElementById("keys-grid");
      var prev = document.getElementById("keys-prev");
      var next = document.getElementById("keys-next");
      var range = document.getElementById("keys-range");
      var data = window.RADICALS || [];
      if (!grid || !prev || !next || !range || !data.length) return null;

      var PER_PAGE = 24;
      var pages = Math.ceil(data.length / PER_PAGE);
      var page = 0;

      function toneClass(pinyin) {
        if (/[āēīōūǖ]/.test(pinyin)) return "tone-1";
        if (/[áéíóúǘ]/.test(pinyin)) return "tone-2";
        if (/[ǎěǐǒǔǚ]/.test(pinyin)) return "tone-3";
        if (/[àèìòùǜ]/.test(pinyin)) return "tone-4";
        return "tone-0";
      }

      function strokesLabel(n) {
        var d10 = n % 10;
        var d100 = n % 100;
        if (d10 === 1 && d100 !== 11) return n + " черта";
        if (d10 >= 2 && d10 <= 4 && (d100 < 10 || d100 >= 20)) return n + " черты";
        return n + " черт";
      }

      function makeTile(r, index) {
        var tile = document.createElement("button");
        tile.type = "button";
        tile.className = "key-tile";
        tile.setAttribute("aria-label", "Ключ №" + r[0] + " " + r[1] + " (" + r[3] + ", " + r[4] + "). Послушать произношение");
        var num = document.createElement("span");
        num.className = "key-num";
        num.textContent = "№" + r[0];
        var strokes = document.createElement("span");
        strokes.className = "key-strokes";
        strokes.textContent = strokesLabel(r[2]);
        var hanzi = document.createElement("span");
        hanzi.className = "key-hanzi";
        hanzi.setAttribute("lang", "zh-CN");
        hanzi.textContent = r[1];
        var py = document.createElement("span");
        py.className = "key-pinyin tone-text " + toneClass(r[3]);
        py.textContent = r[3];
        var meaning = document.createElement("span");
        meaning.className = "key-meaning";
        meaning.textContent = r[4];
        tile.appendChild(num);
        tile.appendChild(strokes);
        tile.appendChild(hanzi);
        tile.appendChild(py);
        tile.appendChild(meaning);
        if (index < PER_PAGE / 2) tile.style.animationDelay = (index * 18) + "ms";
        tile.addEventListener("click", function () {
          if (window.HanziSite) window.HanziSite.speak(r[1], 0.8);
          tile.classList.add("speaking");
          setTimeout(function () { tile.classList.remove("speaking"); }, 900);
        });
        return tile;
      }

      function render(animate) {
        grid.replaceChildren();
        var from = page * PER_PAGE;
        var to = Math.min(from + PER_PAGE, data.length);
        for (var i = from; i < to; i++) {
          var tile = makeTile(data[i], i - from);
          if (animate && !reducedMotion) tile.classList.add("paged");
          else tile.style.animationDelay = "";
          grid.appendChild(tile);
        }
        range.textContent = "Ключи " + (from + 1) + "–" + to + " из " + data.length + " · страница " + (page + 1) + " из " + pages;
        prev.disabled = page === 0;
        next.disabled = page === pages - 1;
      }

      prev.addEventListener("click", function () {
        if (page > 0) { page--; render(true); }
      });
      next.addEventListener("click", function () {
        if (page < pages - 1) { page++; render(true); }
      });

      render(false);
      return function () {
        page = 0;
        render(false);
      };
    })();

    /* ── Полный сброс пути ───────────────────────────────── */
    var restart = document.getElementById("restart-btn");
    if (restart) {
      restart.addEventListener("click", function () {
        var ctor = document.getElementById("constructor");
        var ctorBtn = document.getElementById("ctor-btn");
        var ctorNote = document.getElementById("ctor-note");
        if (ctor) ctor.classList.remove("merged");
        if (ctorBtn) ctorBtn.textContent = "Соединить";
        if (ctorNote) ctorNote.textContent = "Свет солнца и луны вместе — яркий. Что же получится?";
        if (writerRen) writerRen.reset();
        if (writerMing) writerMing.reset();
        if (resetKeys) resetKeys();
        document.getElementById("main").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      });
    }
  });
})();
