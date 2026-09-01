(function (global) {
  function isEmbedded() {
    try {
      return global.self !== global.top;
    } catch (err) {
      return true;
    }
  }

  function injectStyle() {
    if (document.getElementById("hanzi-embed-style")) return;
    const style = document.createElement("style");
    style.id = "hanzi-embed-style";
    style.textContent =
      ".hanzi-draw-surface{position:absolute;inset:0;z-index:2;touch-action:none;cursor:crosshair;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}";
    document.head.appendChild(style);
  }

  function tellParent(type, extra) {
    if (!isEmbedded()) return;
    try {
      global.parent.postMessage(
        Object.assign({ type: type }, extra || {}),
        "*"
      );
    } catch (err) {}
  }

  function preventScroll(evt) {
    evt.preventDefault();
  }

  function styleHostIframe() {
    try {
      const frame = global.frameElement;
      if (!frame) return;
      frame.setAttribute("scrolling", "no");
      frame.style.overflow = "hidden";
      frame.style.touchAction = "none";
      frame.style.overscrollBehavior = "none";
    } catch (err) {}
  }

  function preparePage() {
    document.documentElement.classList.toggle("in-iframe", isEmbedded());
    document.documentElement.style.touchAction = "none";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.addEventListener("touchstart", function () {}, { passive: true });
    document.body.addEventListener("touchstart", function () {}, { passive: true });
    document.addEventListener("touchmove", preventScroll, { passive: false, capture: true });
    document.addEventListener("wheel", preventScroll, { passive: false, capture: true });
    styleHostIframe();
    injectStyle();
  }

  function findQuiz(writer) {
    if (writer._quiz && typeof writer._quiz.startUserStroke === "function") {
      return writer._quiz;
    }
    for (const key in writer) {
      if (!Object.prototype.hasOwnProperty.call(writer, key)) continue;
      const value = writer[key];
      if (
        value &&
        typeof value.startUserStroke === "function" &&
        typeof value.continueUserStroke === "function" &&
        typeof value.endUserStroke === "function"
      ) {
        return value;
      }
    }
    return null;
  }

  function clientPoint(el, clientX, clientY, size) {
    const rect = el.getBoundingClientRect();
    const w = size || rect.width;
    const h = size || rect.height;
    const sx = w / Math.max(rect.width, 1);
    const sy = h / Math.max(rect.height, 1);
    let x = (clientX - rect.left) * sx;
    let y = (clientY - rect.top) * sy;

    if (x < -40 || y < -40 || x > w + 40 || y > h + 40) {
      try {
        if (global.frameElement) {
          const iframeRect = global.frameElement.getBoundingClientRect();
          x = (clientX - iframeRect.left - rect.left) * sx;
          y = (clientY - iframeRect.top - rect.top) * sy;
        }
      } catch (err) {}
    }

    return { x: x, y: y };
  }

  function eventPoint(el, evt, size) {
    const w = size || el.getBoundingClientRect().width;
    const rect = el.getBoundingClientRect();

    if (
      typeof evt.offsetX === "number" &&
      !evt.touches &&
      (evt.target === el || (evt.target && el.contains(evt.target)))
    ) {
      return {
        x: evt.offsetX * (w / Math.max(rect.width, 1)),
        y: evt.offsetY * (w / Math.max(rect.height, 1))
      };
    }

    const touch =
      (evt.touches && evt.touches[0]) ||
      (evt.changedTouches && evt.changedTouches[0]);
    if (touch) {
      return clientPoint(el, touch.clientX, touch.clientY, w);
    }
    return clientPoint(el, evt.clientX, evt.clientY, w);
  }

  function enableTouchDrawing(writer, el) {
    const wrap = el.parentElement || el;
    let surface = wrap.querySelector(".hanzi-draw-surface");
    if (!surface) {
      surface = document.createElement("div");
      surface.className = "hanzi-draw-surface";
      wrap.appendChild(surface);
    }

    let drawing = false;
    let stream = null;
    const opts = { passive: false, capture: true };

    function size() {
      return (writer._options && writer._options.width) || 280;
    }

    function quiz() {
      return findQuiz(writer);
    }

    function block(evt) {
      evt.preventDefault();
      if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
      else evt.stopPropagation();
    }

    function start(evt, kind) {
      if (evt.pointerType === "mouse" && kind === "pointer") {
        // still handle mouse on the overlay so HanziWriter never needs the event
      }
      block(evt);
      if (drawing) return;
      const q = quiz();
      if (!q) return;
      drawing = true;
      stream = kind;
      tellParent("hanzi-embed-lock-scroll");
      styleHostIframe();
      if (kind === "pointer" && evt.pointerId != null && surface.setPointerCapture) {
        try {
          surface.setPointerCapture(evt.pointerId);
        } catch (err) {}
      }
      q.startUserStroke(eventPoint(surface, evt, size()));
    }

    function move(evt, kind) {
      if (!drawing) return;
      if (stream && kind !== stream) {
        block(evt);
        return;
      }
      block(evt);
      const q = quiz();
      if (q) q.continueUserStroke(eventPoint(surface, evt, size()));
    }

    function end(evt, kind) {
      if (!drawing) return;
      if (stream && kind && kind !== stream) {
        block(evt);
        return;
      }
      if (evt) block(evt);
      drawing = false;
      stream = null;
      tellParent("hanzi-embed-unlock-scroll");
      const q = quiz();
      if (q) q.endUserStroke();
    }

    surface.addEventListener("pointerdown", function (evt) {
      start(evt, "pointer");
    }, opts);
    surface.addEventListener("pointermove", function (evt) {
      move(evt, "pointer");
    }, opts);
    surface.addEventListener("pointerup", function (evt) {
      end(evt, "pointer");
    }, opts);
    surface.addEventListener("pointercancel", function (evt) {
      end(evt, "pointer");
    }, opts);

    surface.addEventListener("touchstart", function (evt) {
      start(evt, "touch");
    }, opts);
    surface.addEventListener("touchmove", function (evt) {
      move(evt, "touch");
    }, opts);
    surface.addEventListener("touchend", function (evt) {
      end(evt, "touch");
    }, opts);
    surface.addEventListener("touchcancel", function (evt) {
      end(evt, "touch");
    }, opts);

    surface.addEventListener("mousedown", function (evt) {
      start(evt, "mouse");
    }, opts);
    surface.addEventListener("mousemove", function (evt) {
      move(evt, "mouse");
    }, opts);
    surface.addEventListener("mouseup", function (evt) {
      end(evt, "mouse");
    }, opts);

    document.addEventListener("pointermove", function (evt) {
      if (drawing && stream === "pointer") move(evt, "pointer");
    }, opts);
    document.addEventListener("pointerup", function (evt) {
      if (drawing && stream === "pointer") end(evt, "pointer");
    }, opts);
    document.addEventListener("touchmove", function (evt) {
      if (drawing && stream === "touch") move(evt, "touch");
    }, opts);
    document.addEventListener("touchend", function (evt) {
      if (drawing && stream === "touch") end(evt, "touch");
    }, opts);
    document.addEventListener("mouseup", function (evt) {
      if (drawing && stream === "mouse") end(evt, "mouse");
    }, opts);

    writer.target._getMousePoint = function (evt) {
      return eventPoint(surface, evt, size());
    };
    writer.target._getTouchPoint = function (evt) {
      return eventPoint(surface, evt, size());
    };
  }

  function fitWriter(writer, el) {
    const main = document.querySelector("main");
    if (!main) return;

    const viewportH =
      (global.visualViewport && global.visualViewport.height) || global.innerHeight;
    let used = 0;
    Array.prototype.forEach.call(main.children, function (child) {
      if (child.classList.contains("writer-wrap")) return;
      const cs = getComputedStyle(child);
      used +=
        child.offsetHeight +
        parseFloat(cs.marginTop) +
        parseFloat(cs.marginBottom);
    });

    const mainStyle = getComputedStyle(main);
    const bodyStyle = getComputedStyle(document.body);
    const chrome =
      used +
      parseFloat(mainStyle.paddingTop) +
      parseFloat(mainStyle.paddingBottom) +
      parseFloat(bodyStyle.paddingTop) +
      parseFloat(bodyStyle.paddingBottom) +
      12;
    const availH = viewportH - chrome;
    const availW = Math.min(main.clientWidth, global.innerWidth);
    const nextSize = Math.max(
      168,
      Math.min(280, Math.floor(availW), Math.floor(availH))
    );

    el.style.width = nextSize + "px";
    el.style.height = nextSize + "px";
    if (el.parentElement && el.parentElement.classList.contains("writer-wrap")) {
      el.parentElement.style.width = nextSize + "px";
      el.parentElement.style.height = nextSize + "px";
    }
    writer.updateDimensions({
      width: nextSize,
      height: nextSize,
      padding: Math.round(nextSize * 0.085)
    });
  }

  function reportHeight() {
    if (!isEmbedded()) return;
    const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    global.parent.postMessage({ type: "hanzi-embed-size", height: height }, "*");
  }

  global.HanziEmbed = {
    preparePage: preparePage,
    enableTouchDrawing: enableTouchDrawing,
    fitWriter: fitWriter,
    reportHeight: reportHeight,
    setup: function (writer, el) {
      preparePage();
      enableTouchDrawing(writer, el);
      fitWriter(writer, el);
      reportHeight();
      global.addEventListener("resize", function () {
        fitWriter(writer, el);
        reportHeight();
      });
      if (global.visualViewport) {
        global.visualViewport.addEventListener("resize", function () {
          fitWriter(writer, el);
          reportHeight();
        });
      }
    }
  };
})(window);
