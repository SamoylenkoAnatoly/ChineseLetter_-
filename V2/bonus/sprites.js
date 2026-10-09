(function (root) {
  "use strict";

  var SPRITES = {
    goblin: {
      palette: { k: "#12240f", g: "#4a7c3a", G: "#7db463", d: "#2f5426", y: "#ffd76a", o: "#ff9c4a", w: "#8a5a34", b: "#5d3a1f", t: "#e8e4d8" },
      rows: [
        "................",
        ".....kkkkkk.....",
        ".oo..kgggggk....",
        "oyyokkgggggkk...",
        ".ow.kgygkgygk...",
        "..wkkgggggggkk..",
        "...kggkttkggk...",
        "....kkgggggk....",
        "..okkkgggkkko...",
        ".oyokggggggkoy..",
        "..wkgGGGGGGgk...",
        "..w.kbbbbbbk....",
        "....kgbbbbgk....",
        "....kgk..kgk....",
        "....kgk..kgk....",
        "...kkk....kkk..."
      ]
    },
    wolf: {
      palette: { k: "#151a24", g: "#5a6270", G: "#8b93a4", d: "#3a4150", y: "#ffd76a", w: "#e8e4d8", b: "#5d3a1f", e: "#7db463", o: "#ff9c4a" },
      rows: [
        "................",
        "......keeeek....",
        "......kekekek...",
        ".....keeGeeeek..",
        "..kkkkeeeeekk...",
        ".kggggkgggk.....",
        "kgGGGGkgyGgk....",
        "kgGGGGkggggk....",
        "kgGwGGGkkkkkkk..",
        "kgGGGGGGggggggk.",
        ".kkgGGGGGGGGgk..",
        "..kgggggggggk...",
        "..kgk..kgk..k...",
        "..kgk..kgk......",
        ".kkk..kkk.......",
        "................"
      ]
    },
    troll: {
      palette: { k: "#101828", g: "#4c5d8a", G: "#7d8cab", d: "#33415f", y: "#ffd76a", w: "#8a5a34", W: "#b08a5a", b: "#5d3a1f", t: "#e8e4d8" },
      rows: [
        "....kkkkkkkk....",
        "...kggggggggk...",
        "...kgykggkygk...",
        "...kggggggggk...",
        "...kgkttttkgk...",
        "....kkggggkk....",
        "..kkkkgggkkkk...",
        ".wkgGGGGGGGgkw..",
        "wWkgGGGGGGGgkWw.",
        "wW.kgGGGGGgk.Ww.",
        "wW.kgbbbbbGk.Ww.",
        "...kgbbbbbGk....",
        "...kggGGGggk....",
        "...kgk...kgk....",
        "...kgk...kgk....",
        "..kkkk...kkkk..."
      ]
    },
    warlord: {
      palette: { k: "#160f0f", r: "#8a3428", R: "#b5502f", d: "#571d16", y: "#ffcf4a", s: "#9aa2b8", S: "#cdd4e4", w: "#8a5a34", b: "#3a2a1a" },
      rows: [
        "..k....kk....k..",
        "..ks.kkkkk.ks...",
        "...kskrrrrksk...",
        "....krrrrrrk....",
        "...kryrrryrk....",
        "...krrrrrrrk....",
        "....kkkkkkk.....",
        "..kkkrrrrrkkk...",
        ".skrRRRRRRRrks..",
        "sskrRyRRRyRkrss.",
        "ss.krrRRRRrk.ss.",
        "ss.kdrrrrrdk.ss.",
        "...krrk.krrk....",
        "...krk...krk....",
        "...krk...krk....",
        "..kkkk...kkkk..."
      ]
    }
  };

  var VARIANTS = {
    elite: {
      label: "Элита",
      palette: { g: "#7c8a4a", G: "#b0bd76" },
      overlay: [
        ".......yy.......",
        ".......yy.......",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        ".......ss.......",
        ".......ss.......",
        "................",
        "................",
        "................",
        "................",
        "................"
      ]
    },
    final: {
      label: "Владыка · финал",
      palette: { r: "#6a1f2a", R: "#94323c" },
      overlay: [
        "....y.yy.y......",
        "....yyyyy.......",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................"
      ]
    },
    armor: {
      label: "Щитоносец",
      palette: { g: "#5d6a8a", G: "#8d9ab8" },
      overlay: [
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "sSs.............",
        "sSS.............",
        "sSS.............",
        "sSs.............",
        ".s..............",
        "................",
        "................",
        "................"
      ]
    },
    ram: {
      label: "Таран",
      palette: {},
      overlay: [
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "WWww............",
        "Wwww............",
        "WWww............",
        "................",
        "................",
        "................",
        "................",
        "................"
      ]
    },
    herald: {
      label: "Глашатай",
      palette: { G: "#c9a45a" },
      overlay: [
        "................",
        "................",
        "hh..............",
        "hhh.............",
        ".hh.............",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................"
      ]
    },
    shaman: {
      label: "Шаман",
      palette: { r: "#6a3a8a", R: "#9a5ab8", d: "#3f2260" },
      overlay: [
        "................",
        "..tt............",
        ".t.tt...........",
        ".tttt...........",
        "..tt............",
        "..ww............",
        "..ww............",
        "..ww............",
        "..ww............",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................"
      ]
    }
  };

  var EXTRA_COLORS = { s: "#6a7690", S: "#a8b4cc", h: "#c9a45a", t: "#e8e4d8" };

  function symbolMarkup(name, def, variantName) {
    var palette = {};
    var key;
    for (key in def.palette) palette[key] = def.palette[key];
    for (key in EXTRA_COLORS) if (!palette[key]) palette[key] = EXTRA_COLORS[key];
    var overlay = null;
    if (variantName && VARIANTS[variantName]) {
      var variant = VARIANTS[variantName];
      for (key in variant.palette) palette[key] = variant.palette[key];
      overlay = variant.overlay;
    }
    var size = def.rows.length;
    var rects = "";
    for (var y = 0; y < size; y++) {
      var row = def.rows[y];
      for (var x = 0; x < row.length && x < size; x++) {
        var ch = row[x];
        if (ch === "." || !palette[ch]) continue;
        rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + palette[ch] + '"/>';
      }
    }
    if (overlay) {
      for (var oy = 0; oy < overlay.length && oy < size; oy++) {
        var orow = overlay[oy];
        for (var ox = 0; ox < orow.length && ox < size; ox++) {
          var och = orow[ox];
          if (och === "." || !palette[och]) continue;
          rects += '<rect x="' + ox + '" y="' + oy + '" width="1" height="1" fill="' + palette[och] + '"/>';
        }
      }
    }
    return '<symbol id="' + name + '" viewBox="0 0 ' + size + " " + size + '" shape-rendering="crispEdges">' + rects + "</symbol>";
  }

  root.PixelSprites = {
    VARIANTS: VARIANTS,
    mount: function (defs) {
      if (!defs) return;
      var markup = "";
      for (var kind in SPRITES) {
        markup += symbolMarkup(kind, SPRITES[kind], null);
        for (var special in VARIANTS) {
          markup += symbolMarkup(kind + "-" + special, SPRITES[kind], special);
        }
      }
      defs.innerHTML = markup;
    },
    idFor: function (kind, special) {
      return special && VARIANTS[special] ? kind + "-" + special : kind;
    }
  };
}(typeof globalThis !== "undefined" ? globalThis : this));
