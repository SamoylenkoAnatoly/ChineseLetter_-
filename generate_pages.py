# -*- coding: utf-8 -*-
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

CHARS = [
    ("口", "kǒu", "рот", "35"),
    ("品", "pǐn", "сорт", "5451"),
    ("日", "rì", "солнце", "5827"),
    ("目", "mù", "глаз", "4155"),
    ("人", "rén", "человек", "2872"),
    ("众", "zhòng", "толпа", "1201"),
    ("木", "mù", "дерево", "9296"),
    ("林", "lín", "лес", "2492"),
    ("相", "xiāng", "взаимно", "9779"),
    ("术", "shù", "искусство", "6586"),
    ("中", "zhōng", "середина", "1656"),
    ("右", "yòu", "правый", "6981"),
    ("心", "xīn", "сердце", "2140"),
    ("必", "bì", "обязательно", "1487"),
    ("想", "xiǎng", "думать", "5682"),
    ("白", "bái", "белый", "8511"),
    ("勺", "sháo", "ложка", "5824"),
    ("的", "de", "частица", "4342"),
    ("月", "yuè", "луна", "2620"),
    ("明", "míng", "светлый", "1335"),
    ("有", "yǒu", "иметь", "7724"),
    ("朋", "péng", "друг", "5819"),
    ("用", "yòng", "использовать", "9033"),
    ("夕", "xī", "вечер", "4193"),
    ("名", "míng", "имя", "5296"),
    ("自", "zì", "сам", "7720"),
    ("息", "xī", "дыхание", "4919"),
]


def practice_html(char, pinyin, meaning):
    cfg = json.dumps({"char": char, "pinyin": pinyin, "meaning": meaning}, ensure_ascii=False)
    src = f"index_{char}_practice.html"
    return f"""<!DOCTYPE html>
<!--
  <iframe src="{src}" scrolling="no"
    style="border:0;width:100%;max-width:420px;height:640px;overflow:hidden;touch-action:none;overscroll-behavior:none"></iframe>
  <script src="embed-parent.js"></script>
-->
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <title>{char} — ввод по чертам</title>
  <link rel="stylesheet" href="hanzi-common.css">
  <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"></script>
  <script src="hanzi-embed.js"></script>
</head>
<body>
  <main>
    <h1>Китайский иероглиф</h1>
    <div class="hanzi" aria-hidden="true">{char}</div>
    <p class="meta">{pinyin} · {meaning}</p>
    <p class="hint">Нарисуйте {char} по чертам в правильном порядке</p>
    <div class="writer-wrap">
      <div id="character-target" aria-label="Поле для написания иероглифа {char}"></div>
    </div>
    <p id="progress" class="progress">Черта 0 из 0</p>
    <p id="status" class="status" role="status">Обведите контур, начиная с первой черты</p>
    <div class="actions">
      <button type="button" id="animate-btn">Показать черты</button>
      <button type="button" class="primary" id="retry-btn">Заново</button>
    </div>
  </main>
  <script>window.HANZI = {cfg};</script>
  <script src="hanzi-practice.js"></script>
</body>
</html>
"""


def exc_html(char, pinyin, meaning, prize):
    cfg = json.dumps(
        {"char": char, "pinyin": pinyin, "meaning": meaning, "prize": prize},
        ensure_ascii=False,
    )
    src = f"index_{char}_exc.html"
    return f"""<!DOCTYPE html>
<!--
  <iframe src="{src}" scrolling="no"
    style="border:0;width:100%;max-width:420px;height:720px;overflow:hidden;touch-action:none;overscroll-behavior:none"></iframe>
  <script src="embed-parent.js"></script>
-->
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <title>{char} — 5 написаний</title>
  <link rel="stylesheet" href="hanzi-common.css">
  <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"></script>
  <script src="hanzi-embed.js"></script>
</head>
<body>
  <main>
    <h1>Китайский иероглиф</h1>
    <div class="hanzi" aria-hidden="true">{char}</div>
    <p class="meta">{pinyin} · {meaning}</p>
    <p class="hint">Напишите {char} по чертам 5 раз</p>
    <div class="rounds" id="rounds" aria-label="Прогресс: 5 написаний"></div>
    <div class="writer-wrap">
      <div id="character-target" aria-label="Поле для написания иероглифа {char}"></div>
      <div id="prize" class="prize" aria-live="polite"><span>{prize}</span></div>
    </div>
    <p id="progress" class="progress">Написание 1 из 5 · черта 0 из 0</p>
    <p id="status" class="status" role="status">Обведите контур, начиная с первой черты</p>
    <div class="actions">
      <button type="button" id="animate-btn">Показать черты</button>
      <button type="button" class="primary" id="retry-btn">Заново</button>
    </div>
  </main>
  <script>window.HANZI = {cfg};</script>
  <script src="hanzi-exc.js"></script>
</body>
</html>
"""


def redirect_html(target):
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url={target}">
  <title>Переход</title>
  <script>location.replace({json.dumps(target, ensure_ascii=False)});</script>
</head>
<body>
  <p><a href="{target}">Открыть страницу</a></p>
</body>
</html>
"""


def main():
    for char, pinyin, meaning, prize in CHARS:
        (ROOT / f"index_{char}_practice.html").write_text(
            practice_html(char, pinyin, meaning), encoding="utf-8"
        )
        (ROOT / f"index_{char}_exc.html").write_text(
            exc_html(char, pinyin, meaning, prize), encoding="utf-8"
        )
    (ROOT / "index.html").write_text(
        redirect_html("index_口_practice.html"), encoding="utf-8"
    )
    (ROOT / "index_口.html").write_text(
        redirect_html("index_口_exc.html"), encoding="utf-8"
    )
    print(f"wrote {len(CHARS) * 2} pages")


if __name__ == "__main__":
    main()
