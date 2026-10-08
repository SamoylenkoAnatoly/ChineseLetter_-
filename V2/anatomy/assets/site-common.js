/* Общая логика страниц: произношение (Web Speech API), искры, высота iframe */
(function () {
  "use strict";

  var Site = {
    toneColors: { 1: "#e53935", 2: "#fb8c00", 3: "#29b6f6", 4: "#8e24aa", 0: "#9e9e9e" },

    /* Произношение китайского слога встроенным синтезатором речи браузера */
    speak: function (text, rate) {
      if (!("speechSynthesis" in window)) { Site.warnNoVoice(); return false; }
      var voices = speechSynthesis.getVoices();
      var voice = null;
      for (var i = 0; i < voices.length; i++) {
        if (/^zh[-_]CN/i.test(voices[i].lang)) { voice = voices[i]; break; }
      }
      if (!voice) {
        for (var j = 0; j < voices.length; j++) {
          if (/^zh/i.test(voices[j].lang)) { voice = voices[j]; break; }
        }
      }
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      if (voice) u.voice = voice;
      u.rate = rate || 0.85;
      u.pitch = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      if (!voice) Site.warnNoVoice();
      return true;
    },

    warnNoVoice: function () {
      var tip = document.getElementById("voice-tip");
      if (!tip) return;
      tip.style.display = "block";
    },

    /* Воспроизведение вшитого mp3-файла произношения */
    playAudio: function (src, rate, fallbackText) {
      if (!Site._audioEl) Site._audioEl = new Audio();
      var a = Site._audioEl;
      a.pause();
      try {
        if (Site._audioSrc !== src) {
          a.src = src;
          Site._audioSrc = src;
        }
        a.currentTime = 0;
      } catch (e) { /* ignore */ }
      a.playbackRate = rate || 1;
      var p = a.play();
      if (p && p.catch) {
        p.catch(function () {
          /* mp3 не загрузился — пробуем синтезатор речи */
          Site.speak(fallbackText || "口", 0.85);
        });
      }
      return true;
    },

    initSpeak: function () {
      var els = document.querySelectorAll("[data-speak], [data-audio]");
      Array.prototype.forEach.call(els, function (el) {
        el.addEventListener("click", function () {
          var rate = parseFloat(el.getAttribute("data-rate") || "0.85");
          var audio = el.getAttribute("data-audio");
          var ok;
          if (audio) {
            ok = Site.playAudio(audio, rate, el.getAttribute("data-speak"));
          } else {
            ok = Site.speak(el.getAttribute("data-speak"), rate);
          }
          if (ok !== false) {
            el.classList.add("speaking");
            setTimeout(function () { el.classList.remove("speaking"); }, 900);
          }
        });
      });
      if ("speechSynthesis" in window && speechSynthesis.getVoices().length === 0) {
        speechSynthesis.onvoiceschanged = function () {};
      }
    },

    /* Волшебные искры поверх элемента */
    sparkBurst: function (host, opts) {
      if (!host) return;
      opts = opts || {};
      var colors = opts.colors || ["#ffd54f", "#fff3c4", "#ffb74d", "#ffffff"];
      var count = opts.count || 70;
      var rect = host.getBoundingClientRect();
      var canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "50";
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.appendChild(canvas);
      var ctx = canvas.getContext("2d");
      var cx = rect.width / 2;
      var cy = rect.height / 2;
      var parts = [];
      var d, ang, spd;
      for (var i = 0; i < count; i++) {
        d = Math.random();
        ang = Math.random() * Math.PI * 2;
        spd = 1.5 + Math.random() * 4.5;
        parts.push({
          x: cx + (Math.random() - 0.5) * rect.width * 0.35,
          y: cy + (Math.random() - 0.5) * rect.height * 0.35,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 2,
          size: 2 + Math.random() * 4,
          life: 1,
          decay: 0.012 + Math.random() * 0.02,
          color: colors[Math.floor(Math.random() * colors.length)],
          star: d > 0.65
        });
      }
      var frame = 0;
      (function tick() {
        frame++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var alive = false;
        for (var k = 0; k < parts.length; k++) {
          var p = parts[k];
          if (p.life <= 0) continue;
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.09;
          p.vx *= 0.985;
          p.life -= p.decay;
          ctx.globalAlpha = Math.max(p.life, 0);
          ctx.fillStyle = p.color;
          if (p.star) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(frame * 0.15);
            var s = p.size * 1.6;
            ctx.beginPath();
            for (var a = 0; a < 4; a++) {
              ctx.rotate(Math.PI / 2);
              ctx.moveTo(0, 0);
              ctx.lineTo(s, 0.4);
              ctx.lineTo(s * 2.2, 0);
              ctx.lineTo(s, -0.4);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else {
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          }
        }
        ctx.globalAlpha = 1;
        if (alive) {
          requestAnimationFrame(tick);
        } else {
          canvas.parentNode.removeChild(canvas);
        }
      })();
    },

    /* Полноэкранный просмотр картинки */
    lightbox: function (src, caption) {
      Site.closeOverlays();
      var ov = document.createElement("div");
      ov.className = "hz-lightbox";
      var img = document.createElement("img");
      img.src = src;
      img.alt = caption || "";
      ov.appendChild(img);
      if (caption) {
        var cap = document.createElement("div");
        cap.className = "hz-cap";
        cap.textContent = caption;
        ov.appendChild(cap);
      }
      ov.addEventListener("click", function () { Site.closeOverlays(); });
      document.body.appendChild(ov);
      document.addEventListener("keydown", Site._escHandler);
    },

    _escHandler: function (e) {
      if (e.key === "Escape") Site.closeOverlays();
    },

    closeOverlays: function () {
      var els = document.querySelectorAll(".hz-lightbox, .hz-peek");
      Array.prototype.forEach.call(els, function (el) { el.remove(); });
    },

    initLightbox: function () {
      var els = document.querySelectorAll("[data-lightbox]");
      Array.prototype.forEach.call(els, function (el) {
        el.classList.add("hz-zoomable");
        el.addEventListener("click", function () {
          var img = el.tagName === "IMG" ? el : el.querySelector("img");
          if (!img) return;
          Site.lightbox(img.getAttribute("src"), el.getAttribute("data-caption") || img.getAttribute("alt"));
        });
      });
    },

    /* Полная картинка при наведении (оверлей без перехвата курсора) */
    initHoverPreview: function () {
      var touch = "ontouchstart" in window;
      var els = document.querySelectorAll("[data-hover-full]");
      Array.prototype.forEach.call(els, function (el) {
        var timer = null;
        var peek = null;
        function showPeek() {
          var img = el.tagName === "IMG" ? el : el.querySelector("img");
          if (!img) return;
          Site.closeOverlays();
          peek = document.createElement("div");
          peek.className = "hz-peek";
          var big = document.createElement("img");
          big.src = img.getAttribute("src");
          peek.appendChild(big);
          var cap = el.getAttribute("data-caption") || img.getAttribute("alt");
          if (cap) {
            var c = document.createElement("div");
            c.className = "hz-cap";
            c.textContent = cap;
            peek.appendChild(c);
          }
          document.body.appendChild(peek);
        }
        function hidePeek() {
          clearTimeout(timer);
          timer = null;
          if (peek) { peek.remove(); peek = null; }
        }
        el.addEventListener("mouseenter", function () {
          if (touch) return;
          timer = setTimeout(showPeek, 250);
        });
        el.addEventListener("mouseleave", hidePeek);
        el.addEventListener("click", function () {
          var img = el.tagName === "IMG" ? el : el.querySelector("img");
          if (img) Site.lightbox(img.getAttribute("src"), el.getAttribute("data-caption") || img.getAttribute("alt"));
        });
      });
    },

    initStyles: function () {
      if (document.getElementById("hz-overlays-style")) return;
      var st = document.createElement("style");
      st.id = "hz-overlays-style";
      st.textContent =
        ".hz-lightbox{position:fixed;inset:0;z-index:9999;background:rgba(8,6,18,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:zoom-out;padding:16px;box-sizing:border-box;animation:hzFade .18s ease}" +
        ".hz-lightbox img{max-width:92vw;max-height:82vh;border:4px solid #fff;border-radius:10px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.6)}" +
        ".hz-peek{position:fixed;inset:0;z-index:9998;background:rgba(8,6,18,0.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;pointer-events:none;padding:16px;box-sizing:border-box;animation:hzFade .18s ease}" +
        ".hz-peek img{max-width:90vw;max-height:78vh;border:4px solid #fff;border-radius:10px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.6)}" +
        ".hz-cap{color:#fff;font:600 14px/1.35 'Nunito','Segoe UI',sans-serif;text-shadow:0 2px 6px #000;text-align:center;padding:0 12px}" +
        ".hz-zoomable{cursor:zoom-in}" +
        "@keyframes hzFade{from{opacity:0}to{opacity:1}}";
      document.head.appendChild(st);
    },

    /* Сообщаем родительскому окну (Stepik iframe) высоту страницы */
    reportHeight: function () {
      var post = function () {
        if (window.parent === window) return;
        var h = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );
        window.parent.postMessage(
          { type: "hanzi-site:height", url: location.href, height: h },
          "*"
        );
      };
      post();
      window.addEventListener("load", post);
      var t;
      window.addEventListener("resize", function () {
        clearTimeout(t);
        t = setTimeout(post, 200);
      });
    }
  };

  window.HanziSite = Site;
  document.addEventListener("DOMContentLoaded", function () {
    Site.initStyles();
    Site.initSpeak();
    Site.initLightbox();
    Site.initHoverPreview();
    Site.reportHeight();
  });
})();
