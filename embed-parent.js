(function () {
  var lockCount = 0;
  var prev = {
    htmlOverflow: "",
    bodyOverflow: "",
    bodyTouch: "",
    htmlOverscroll: "",
    bodyOverscroll: ""
  };

  function applyIframe(iframe) {
    iframe.setAttribute("scrolling", "no");
    iframe.style.touchAction = "none";
    iframe.style.overflow = "hidden";
    iframe.style.overscrollBehavior = "none";
  }

  function lock() {
    lockCount += 1;
    if (lockCount !== 1) return;
    prev.htmlOverflow = document.documentElement.style.overflow;
    prev.bodyOverflow = document.body.style.overflow;
    prev.bodyTouch = document.body.style.touchAction;
    prev.htmlOverscroll = document.documentElement.style.overscrollBehavior;
    prev.bodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overscrollBehavior = "none";
  }

  function unlock() {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount !== 0) return;
    document.documentElement.style.overflow = prev.htmlOverflow;
    document.body.style.overflow = prev.bodyOverflow;
    document.body.style.touchAction = prev.bodyTouch;
    document.documentElement.style.overscrollBehavior = prev.htmlOverscroll;
    document.body.style.overscrollBehavior = prev.bodyOverscroll;
  }

  function iframeFromSource(source) {
    var frames = document.querySelectorAll("iframe");
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === source) return frames[i];
    }
    return null;
  }

  window.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data.type === "hanzi-embed-lock-scroll") lock();
    if (data.type === "hanzi-embed-unlock-scroll") unlock();
    if (data.type === "hanzi-embed-size" && typeof data.height === "number") {
      var frame = iframeFromSource(event.source);
      if (frame) frame.style.height = data.height + "px";
    }
  });

  document.addEventListener(
    "touchmove",
    function (event) {
      var node = event.target;
      if (node && (node.tagName === "IFRAME" || (node.closest && node.closest("iframe")))) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  function setup() {
    document.querySelectorAll("iframe").forEach(applyIframe);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
