(function (global) {
  function isEmbedded() {
    try {
      return global.self !== global.top;
    } catch (err) {
      return true;
    }
  }

  function preparePage() {
    document.documentElement.classList.toggle("in-iframe", isEmbedded());
    document.addEventListener("touchstart", function () {}, { passive: true });
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
    if (evt.touches && evt.touches.length) {
      return clientPoint(el, evt.touches[0].clientX, evt.touches[0].clientY, size);
    }
    if (evt.changedTouches && evt.changedTouches.length) {
      return clientPoint(
        el,
        evt.changedTouches[0].clientX,
        evt.changedTouches[0].clientY,
        size
      );
    }
    return clientPoint(el, evt.clientX, evt.clientY, size);
  }

  function enableTouchDrawing(writer, el) {
    let drawing = false;
    const opts = { passive: false, capture: true };

    function size() {
      return writer._options && writer._options.width;
    }

    function quiz() {
      return writer._quiz;
    }

    function start(evt) {
      if (!quiz()) return;
      if (evt.pointerType === "mouse") return;
      evt.preventDefault();
      evt.stopImmediatePropagation();
      drawing = true;
      if (evt.pointerId != null && el.setPointerCapture) {
        try {
          el.setPointerCapture(evt.pointerId);
        } catch (err) {}
      }
      quiz().startUserStroke(eventPoint(el, evt, size()));
    }

    function move(evt) {
      if (!drawing || !quiz()) return;
      if (evt.pointerType === "mouse") return;
      evt.preventDefault();
      evt.stopImmediatePropagation();
      quiz().continueUserStroke(eventPoint(el, evt, size()));
    }

    function end(evt) {
      if (!drawing) return;
      if (evt && evt.pointerType === "mouse") return;
      if (evt) {
        evt.preventDefault();
        evt.stopImmediatePropagation();
      }
      drawing = false;
      if (quiz()) quiz().endUserStroke();
    }

    if (global.PointerEvent) {
      el.addEventListener("pointerdown", start, opts);
      el.addEventListener("pointermove", move, opts);
      el.addEventListener("pointerup", end, opts);
      el.addEventListener("pointercancel", end, opts);
      document.addEventListener(
        "pointermove",
        function (evt) {
          if (drawing) move(evt);
        },
        opts
      );
      document.addEventListener(
        "pointerup",
        function (evt) {
          if (drawing) end(evt);
        },
        opts
      );
      document.addEventListener(
        "pointercancel",
        function (evt) {
          if (drawing) end(evt);
        },
        opts
      );
    } else {
      el.addEventListener("touchstart", start, opts);
      el.addEventListener("touchmove", move, opts);
      el.addEventListener("touchend", end, opts);
      el.addEventListener("touchcancel", end, opts);
    }

    document.body.addEventListener(
      "touchmove",
      function (evt) {
        if (drawing) move(evt);
      },
      opts
    );
    document.body.addEventListener(
      "touchend",
      function (evt) {
        if (drawing) end(evt);
      },
      opts
    );
    document.body.addEventListener(
      "touchcancel",
      function (evt) {
        if (drawing) end(evt);
      },
      opts
    );

    writer.target._getMousePoint = function (evt) {
      return clientPoint(el, evt.clientX, evt.clientY, size());
    };
    writer.target._getTouchPoint = function (evt) {
      return eventPoint(el, evt, size());
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
    const size = Math.max(
      168,
      Math.min(280, Math.floor(availW), Math.floor(availH))
    );

    el.style.width = size + "px";
    el.style.height = size + "px";
    if (el.parentElement && el.parentElement.classList.contains("writer-wrap")) {
      el.parentElement.style.width = size + "px";
      el.parentElement.style.height = size + "px";
    }
    writer.updateDimensions({
      width: size,
      height: size,
      padding: Math.round(size * 0.085)
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
