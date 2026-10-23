window.TAVERN_APP = (function () {
  'use strict';

  var D = window.TAVERN_DATA;
  var E = window.TAVERN_ENGINE;

  var state = null;
  var selectedHeroId = null;
  var seedParam = null;
  try {
    var sp = new URLSearchParams(window.location.search).get('seed');
    if (sp && /^\d+$/.test(sp)) {
      seedParam = parseInt(sp, 10);
    }
  } catch (err) { }
  var rng = E.createRng((seedParam !== null ? seedParam : Date.now()) & 0xffffffff);
  var busy = false;
  var pendingQuestion = null;
  var currentQuestion = null;
  var drag = null;
  var selectedCardUid = null;
  var selectedAttackerUid = null;
  var powerTargeting = false;
  var timerId = null;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var el = {};

  function cacheDom() {
    var ids = [
      'screen-select', 'screen-game', 'heroGrid', 'startMatch', 'soundToggle',
      'turnLabel', 'timer', 'endTurnBtn', 'enemyBoard', 'playerBoard',
      'enemyPortrait', 'enemyName', 'enemyPowerName', 'enemyHp', 'enemyShield',
      'enemyMana', 'enemyDeck', 'enemyHand', 'playerPortrait', 'playerName',
      'playerHp', 'playerShield', 'playerMana', 'playerDeck', 'powerBtn',
      'powerCost', 'powerName', 'hand', 'questionModal', 'questionKind',
      'questionHanzi', 'questionTitle', 'questionOptions', 'questionFeedback',
      'feedbackLine', 'wordHanzi', 'wordPinyin', 'wordRu', 'wordNote',
      'pronounceBtn', 'feedbackClose', 'questionCancel', 'questionActions', 'endModal', 'endTitle',
      'endReason', 'endStats', 'endWords', 'rematchBtn', 'changeHeroBtn',
      'toast', 'dragLayer', 'arrowLayer', 'dropZoneNone', 'rules', 'rulesLink', 'rulesClose'
    ];
    for (var i = 0; i < ids.length; i += 1) {
      el[ids[i]] = document.getElementById(ids[i]);
    }
  }

  function g(id) {
    return el[id];
  }

  var toastTimer = null;

  function toast(message) {
    var node = g('toast');
    node.textContent = message;
    node.hidden = false;
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      node.hidden = true;
    }, 2600);
  }

  var sound = { enabled: true, ctx: null };

  function audioCtx() {
    if (!sound.ctx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        return null;
      }
      sound.ctx = new Ctx();
    }
    if (sound.ctx.state === 'suspended') {
      sound.ctx.resume();
    }
    return sound.ctx;
  }

  function tone(freq, dur, type, gain, delay) {
    if (!sound.enabled) {
      return;
    }
    var ctx = audioCtx();
    if (!ctx) {
      return;
    }
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var gn = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(gain || 0.05, t0 + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gn);
    gn.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  var sfx = {
    play: function () { tone(392, 0.1); tone(523, 0.14, 'square', 0.05, 0.09); },
    wrong: function () { tone(146, 0.22, 'sawtooth', 0.06); tone(110, 0.26, 'sawtooth', 0.05, 0.12); },
    attack: function () { tone(220, 0.08, 'sawtooth', 0.06); tone(130, 0.12, 'sawtooth', 0.05, 0.06); },
    damage: function () { tone(98, 0.14, 'square', 0.06); },
    death: function () { tone(200, 0.3, 'triangle', 0.05); tone(90, 0.4, 'triangle', 0.05, 0.12); },
    heal: function () { tone(523, 0.1, 'triangle', 0.05); tone(659, 0.12, 'triangle', 0.05, 0.09); },
    buff: function () { tone(440, 0.08, 'triangle', 0.05); tone(587, 0.1, 'triangle', 0.05, 0.07); },
    shield: function () { tone(330, 0.12, 'sine', 0.06); tone(440, 0.12, 'sine', 0.05, 0.1); },
    summon: function () { tone(160, 0.12, 'square', 0.05); tone(240, 0.1, 'square', 0.04, 0.08); },
    spell: function () { tone(660, 0.08, 'triangle', 0.05); tone(880, 0.08, 'triangle', 0.04, 0.06); tone(1100, 0.1, 'triangle', 0.04, 0.12); },
    turn: function () { tone(392, 0.09, 'triangle', 0.05); },
    win: function () { tone(523, 0.14); tone(659, 0.14, 'square', 0.05, 0.13); tone(784, 0.22, 'square', 0.05, 0.26); },
    lose: function () { tone(330, 0.16, 'sawtooth', 0.05); tone(262, 0.18, 'sawtooth', 0.05, 0.15); tone(196, 0.3, 'sawtooth', 0.05, 0.32); }
  };

  var speech = { synth: window.speechSynthesis || null, voice: null, ready: false };

  function pickVoice() {
    if (!speech.synth) {
      return;
    }
    var voices = speech.synth.getVoices() || [];
    for (var i = 0; i < voices.length; i += 1) {
      if (voices[i].lang && voices[i].lang.toLowerCase().indexOf('zh') === 0) {
        speech.voice = voices[i];
        speech.ready = true;
        return;
      }
    }
    speech.ready = false;
  }

  if (speech.synth) {
    pickVoice();
    if (typeof speech.synth.addEventListener === 'function') {
      speech.synth.addEventListener('voiceschanged', pickVoice);
    }
  }

  function speak(text) {
    if (!speech.synth) {
      toast('Произношение недоступно: браузер не поддерживает синтез речи');
      return;
    }
    if (!speech.ready) {
      pickVoice();
    }
    if (!speech.ready) {
      toast('Китайский голос не найден в системе');
      return;
    }
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.voice = speech.voice;
      u.lang = speech.voice.lang;
      u.rate = 0.85;
      speech.synth.cancel();
      speech.synth.speak(u);
    } catch (err) {
      toast('Не удалось произнести слово');
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, reducedMotion ? 0 : ms);
    });
  }

  function fmtTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function findMinionByUid(uid) {
    var sides = [state.player, state.ai];
    for (var s = 0; s < sides.length; s += 1) {
      for (var i = 0; i < sides[s].board.length; i += 1) {
        if (sides[s].board[i] && sides[s].board[i].uid === uid) {
          return sides[s].board[i];
        }
      }
    }
    return null;
  }

  function getCardByUid(uid) {
    var found = null;
    state.player.hand.forEach(function (c) {
      if (c.uid === uid) {
        found = c;
      }
    });
    return found;
  }

  function minionEl(uid) {
    return document.querySelector('.minion[data-uid="' + uid + '"]');
  }

  function heroRowEl(which) {
    return document.querySelector('.hero-row[data-hero="' + which + '"]');
  }

  var spellTargetAnchors = new WeakMap();

  function targetElOf(target) {
    if (!target) {
      return null;
    }
    if (target.isMinion) {
      var node = minionEl(target.uid);
      var anchor = spellTargetAnchors.get(target);
      if (!node && anchor) {
        var board = g(anchor.side === 'player' ? 'playerBoard' : 'enemyBoard');
        node = board.children[anchor.slot] || null;
      }
      return node;
    }
    if (target === state.player) {
      return heroRowEl('player');
    }
    if (target === state.ai) {
      return heroRowEl('ai');
    }
    return null;
  }

  function floatNumber(target, amount, kind) {
    var node = targetElOf(target);
    if (!node) {
      return;
    }
    var rect = node.getBoundingClientRect();
    var span = document.createElement('span');
    span.className = 'float-num float-num--' + kind;
    span.textContent = String(amount);
    span.style.left = (rect.left + rect.width / 2 - 12 + (Math.random() * 16 - 8)) + 'px';
    span.style.top = (rect.top + rect.height * 0.3) + 'px';
    document.body.appendChild(span);
    setTimeout(function () {
      if (span.parentNode) {
        span.parentNode.removeChild(span);
      }
    }, 950);
  }

  function centerOf(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function clearArrow() {
    var layer = g('arrowLayer');
    while (layer.firstChild) {
      layer.removeChild(layer.firstChild);
    }
  }

  function drawArrow(from, to) {
    clearArrow();
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    var nx = -dy / len;
    var ny = dx / len;
    var bend = 26;
    var d = 'M ' + from.x + ' ' + from.y +
      ' Q ' + (from.x + dx / 2 + nx * bend) + ' ' + (from.y + dy / 2 + ny * bend) +
      ' ' + to.x + ' ' + to.y;
    path.setAttribute('d', d);
    g('arrowLayer').appendChild(path);
  }

  function renderHeroSelect() {
    var grid = g('heroGrid');
    grid.innerHTML = '';
    D.PLAYERS.forEach(function (hero) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'hero-card';
      card.dataset.heroId = hero.id;
      card.setAttribute('aria-pressed', 'false');
      card.innerHTML =
        '<img class="portrait" src="' + hero.portrait + '" alt="Портрет героя ' + hero.name + '">' +
        '<h3>' + hero.name + '</h3>' +
        '<p class="hero-title">' + hero.title + '</p>' +
        '<p class="hero-power"><b>' + hero.power.name + '</b> (' + hero.power.mana + ' маны): ' + hero.power.desc + '</p>';
      card.addEventListener('click', function () {
        selectedHeroId = hero.id;
        Array.prototype.forEach.call(grid.children, function (c) {
          c.classList.toggle('is-selected', c === card);
          c.setAttribute('aria-pressed', c === card ? 'true' : 'false');
        });
        g('startMatch').disabled = false;
      });
      grid.appendChild(card);
    });
  }

  function render() {
    if (!state) {
      return;
    }
    renderHeroes();
    renderBoard(g('enemyBoard'), state.ai, 'ai');
    renderBoard(g('playerBoard'), state.player, 'player');
    renderHand();
    renderBar();
  }

  function renderHeroes() {
    var p = state.player;
    var a = state.ai;
    g('playerPortrait').src = p.heroPortrait;
    g('playerPortrait').alt = 'Портрет вашего героя ' + p.heroName;
    g('playerName').textContent = p.heroName;
    g('playerHp').textContent = p.hp + ' HP';
    g('playerShield').hidden = p.shield <= 0;
    g('playerShield').textContent = 'щит ' + p.shield;
    g('playerMana').textContent = 'мана ' + p.mana + '/' + p.maxMana;
    g('playerDeck').textContent = 'колода ' + p.deck.length;
    g('powerCost').textContent = p.power.mana;
    g('powerName').textContent = p.power.name;
    g('powerBtn').title = p.power.name + ': ' + p.power.desc;
    g('powerBtn').disabled = busy || state.over || state.turn !== 'player' || !E.canUsePower(state) || powerTargeting;

    g('enemyPortrait').src = a.heroPortrait;
    g('enemyPortrait').alt = 'Портрет противника ' + a.heroName;
    g('enemyName').textContent = a.heroName;
    g('enemyPowerName').textContent = 'сила: ' + a.power.name;
    g('enemyHp').textContent = a.hp + ' HP';
    g('enemyShield').hidden = a.shield <= 0;
    g('enemyShield').textContent = 'щит ' + a.shield;
    g('enemyMana').textContent = 'мана ' + a.mana + '/' + a.maxMana;
    g('enemyDeck').textContent = 'колода ' + a.deck.length;
    g('enemyHand').textContent = 'рука ' + a.hand.length;
  }

  function renderBoard(container, side, which) {
    container.innerHTML = '';
    for (var i = 0; i < side.board.length; i += 1) {
      var m = side.board[i];
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.drop = 'slot-' + i;
      cell.setAttribute('aria-label', 'Ячейка ' + (i + 1) + (m ? ', занята бойцом' : ', свободна'));
      if (m) {
        cell.appendChild(renderMinion(m, which));
      }
      container.appendChild(cell);
    }
  }

  function cardEmblem(type) {
    var drawings = {
      minion: '<path fill="#cbd4d0" d="M17 2h6v17h-6zM13 6h4v9h-4zM23 6h4v9h-4z"/><path fill="#f4cc85" d="M11 20h18v4H11zM18 24h4v9h-4zM15 33h10v4H15z"/><path fill="#577681" d="M17 4h3v15h-3z"/>',
      damage: '<path fill="#e17b52" d="M17 2h6v9h6v7h5v14h-5v5H11v-5H6V21h5v-8h6z"/><path fill="#ffda88" d="M18 17h6v8h4v8H13v-8h5z"/>',
      heal: '<path fill="#adcecd" d="M14 3h12v5H14zM16 8h8v8h5v4h4v14H7V20h4v-4h5z"/><path fill="#6ea381" d="M11 23h18v9H11z"/><path fill="#eff0ca" d="M18 21h4v13h-4zM14 25h12v4H14z"/>',
      buff: '<path fill="#a584c6" d="M17 2h6v6h6v6h6v12h-6v6h-6v6h-6v-6h-6v-6H5V14h6V8h6z"/><path fill="#f3dfb1" d="M18 10h4v5h5v4h-5v11h-4V19h-5v-4h5z"/>',
      draw: '<path fill="#5b829a" d="M3 9h14v3h6V9h14v26H23v3h-6v-3H3z"/><path fill="#f0deb9" d="M6 5h11v3h3v25h-3v-3H6zM23 8V5h11v25H23v3h-3V8z"/><path fill="#9d7c67" d="M9 11h6v3H9zM9 18h6v3H9zM25 11h6v3h-6zM25 18h6v3h-6z"/>'
    };
    var span = document.createElement('span');
    span.className = 'card-emblem';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 40 40" shape-rendering="crispEdges" focusable="false">' + drawings[type] + '</svg>';
    return span;
  }

  function abilityStatus(m) {
    if (m.ability === 'barrier') {
      return m.barrierActive ? 'Щит цел' : 'Щит снят';
    }
    if (m.ability === 'rush') {
      return m.justPlayed ? 'Натиск' : 'Натиск: готов';
    }
    return m.ability === 'medic' ? 'Лекарь: +2' : '';
  }

  function renderMinion(m, which) {
    var node = document.createElement('div');
    node.className = 'minion';
    node.dataset.uid = m.uid;
    node.dataset.side = which;
    node.dataset.drop = 'minion-' + which + '-' + m.uid;
    var canAct = which === 'player' && state.turn === 'player' && !busy && E.canAttack(state, m);
    if (m.ability) {
      node.dataset.ability = m.ability;
      node.classList.toggle('minion--barrier', !!m.barrierActive);
      var badge = document.createElement('span');
      badge.className = 'minion-ability';
      badge.textContent = abilityStatus(m);
      badge.title = D.ABILITIES[m.ability].text;
      node.appendChild(badge);
    }
    if (canAct) {
      node.classList.add('minion--ready');
    } else if (which === 'player' && !m.ready) {
      node.classList.add('minion--sleeping');
    }
    if (selectedAttackerUid === m.uid) {
      node.classList.add('is-selected');
    }
    var hanzi = document.createElement('span');
    hanzi.className = 'minion-hanzi';
    hanzi.lang = 'zh';
    hanzi.textContent = m.card ? m.card.hanzi : '';
    hanzi.dataset.length = String(Array.from(hanzi.textContent).length);
    var name = document.createElement('span');
    name.className = 'minion-name';
    name.textContent = m.card ? m.card.name : '';
    var stats = document.createElement('span');
    stats.className = 'minion-stats';
    var atk = document.createElement('span');
    atk.className = 'stat-atk';
    atk.textContent = String(m.atk);
    atk.title = 'Атака';
    var hp = document.createElement('span');
    hp.className = 'stat-hp';
    hp.textContent = String(m.hp);
    hp.title = 'Здоровье';
    stats.appendChild(atk);
    stats.appendChild(hp);
    node.appendChild(hanzi);
    node.appendChild(name);
    node.appendChild(stats);
    node.setAttribute('role', 'button');
    node.tabIndex = 0;
    node.setAttribute('aria-label', (which === 'player' ? 'Ваш боец' : 'Боец противника') + ' ' +
      (m.card ? m.card.hanzi + ' ' + m.card.pinyin + ' (' + m.card.ru + ')' : '') +
      ': атака ' + m.atk + ', здоровье ' + m.hp + (m.ability ? ', ' + abilityStatus(m) + '. ' + D.ABILITIES[m.ability].text : '') + (canAct ? ', может атаковать' : ''));
    node.title = m.ability ? abilityStatus(m) + '. ' + D.ABILITIES[m.ability].text : 'Обычный боец';
    return node;
  }

  function renderHand() {
    var hand = g('hand');
    hand.innerHTML = '';
    state.player.hand.forEach(function (card) {
      var node = document.createElement('button');
      node.type = 'button';
      var visualType = card.kind === 'spell' ? card.effect.id : 'minion';
      var typeLabels = { minion: 'Боец', damage: 'Урон', heal: 'Лечение', buff: 'Усиление', draw: 'Добор' };
      node.className = 'card card--' + visualType + (card.kind === 'spell' ? ' card--spell' : '');
      node.dataset.uid = card.uid;
      node.dataset.type = visualType;
      var surface = document.createElement('span');
      surface.className = 'card-surface';
      surface.setAttribute('aria-hidden', 'true');
      node.appendChild(surface);
      var playable = state.turn === 'player' && !busy && !state.over && E.canPlayCard(state, card);
      if (!playable) {
        node.classList.add(card.locked ? 'is-locked' : 'is-unplayable');
      }
      if (card.locked) {
        node.classList.add('card--locked-badge');
      }
      if (selectedCardUid === card.uid) {
        node.classList.add('is-selected');
      }
      var top = document.createElement('span');
      top.className = 'card-top';
      var cost = document.createElement('span');
      cost.className = 'card-cost';
      cost.textContent = String(card.cost);
      var kindLabel = document.createElement('span');
      kindLabel.className = 'card-kind-label';
      kindLabel.textContent = card.kind === 'spell' ? 'заклинание' : 'боец';
      top.appendChild(cost);
      top.appendChild(kindLabel);
      var hanzi = document.createElement('span');
      hanzi.className = 'card-hanzi';
      hanzi.lang = 'zh';
      hanzi.textContent = card.hanzi;
      hanzi.dataset.length = String(Array.from(card.hanzi).length);
      var name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = card.name;
      node.appendChild(top);
      node.appendChild(cardEmblem(visualType));
      var seal = document.createElement('span');
      seal.className = 'card-type-seal';
      seal.textContent = typeLabels[visualType];
      node.appendChild(seal);
      node.appendChild(hanzi);
      node.appendChild(name);
      if (card.kind === 'minion') {
        var ability = document.createElement('span');
        ability.className = 'card-ability';
        ability.textContent = card.ability ? D.ABILITIES[card.ability].name + ' · ' + D.ABILITIES[card.ability].short : 'Без способности';
        ability.title = card.ability ? D.ABILITIES[card.ability].text : 'Атака со следующего своего хода';
        node.appendChild(ability);
      }
      if (card.kind === 'spell') {
        var text = document.createElement('span');
        text.className = 'card-text';
        text.textContent = card.text;
        node.appendChild(text);
      }
      var bottom = document.createElement('span');
      bottom.className = 'card-stats';
      if (card.kind === 'minion') {
        var atk = document.createElement('span');
        atk.className = 'stat-atk';
        atk.textContent = String(card.minionAtk);
        atk.title = 'Атака';
        var hp = document.createElement('span');
        hp.className = 'stat-hp';
        hp.textContent = String(card.minionHp);
        hp.title = 'Здоровье';
        bottom.appendChild(atk);
        bottom.appendChild(hp);
      } else {
        var hint = document.createElement('span');
        hint.className = 'card-hint';
        hint.textContent = { 'enemy-any': 'Цель: враг', 'own-minion': 'Цель: ваш боец', 'own-hero': 'Цель: ваш герой', none: 'Без цели · в зону' }[card.effect.target];
        bottom.appendChild(hint);
      }
      node.appendChild(bottom);
      node.setAttribute('aria-label', (card.kind === 'spell' ? 'Заклинание' : 'Боец') + ' ' + card.hanzi +
        ', стоимость ' + card.cost + (card.locked ? ', ждёт следующего хода' : ''));
      var mechanics = card.kind === 'minion' ? card.minionAtk + '/' + card.minionHp + (card.ability ? ' · ' + D.ABILITIES[card.ability].name + ': ' + D.ABILITIES[card.ability].text : '') : card.text;
      node.title = card.hanzi + ' · ' + mechanics;
      node.setAttribute('aria-label', node.getAttribute('aria-label') + '. ' + typeLabels[visualType] + '. ' + mechanics);
      hand.appendChild(node);
    });
  }

  function renderBar() {
    g('endTurnBtn').disabled = busy || state.over || state.turn !== 'player' || !!pendingQuestion;
    var label = g('turnLabel');
    if (state.over) {
      label.textContent = 'Матч завершён';
      label.classList.remove('turn-label--ai');
    } else if (state.turn === 'player') {
      label.textContent = 'Ваш ход';
      label.classList.remove('turn-label--ai');
    } else {
      label.textContent = 'Ход противника';
      label.classList.add('turn-label--ai');
    }
    updateTimer();
  }

  function updateTimer() {
    if (!state) {
      return;
    }
    var left = state.deadline - Date.now();
    g('timer').textContent = fmtTime(left);
    g('timer').classList.toggle('timer--low', left < 60000);
    if (left <= 0 && !state.over) {
      finishByTime();
    }
  }

  function finishByTime() {
    if (pendingQuestion) {
      discardQuestion();
      toast('Время вышло: вопрос отменён, карта не разыграна');
    }
    var events = [];
    E.checkTime(state, Date.now(), events);
    render();
    runEvents(events).then(function () {
      if (state.over) {
        showEnd();
      }
    });
  }

  function startTimer() {
    stopTimer();
    updateTimer();
    timerId = setInterval(updateTimer, 400);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startMatch() {
    if (!selectedHeroId) {
      return;
    }
    var others = D.PLAYERS.filter(function (h) { return h.id !== selectedHeroId; });
    var aiHeroId = others[Math.floor(rng() * others.length)].id;
    state = E.createMatch(selectedHeroId, aiHeroId, rng, Date.now());
    busy = false;
    pendingQuestion = null;
    currentQuestion = null;
    selectedCardUid = null;
    selectedAttackerUid = null;
    powerTargeting = false;
    document.getElementById('app').classList.add('is-playing');
    g('screen-select').hidden = true;
    g('screen-game').hidden = false;
    g('endModal').hidden = true;
    g('questionModal').hidden = true;
    render();
    startTimer();
    sfx.turn();
    toast('Ваш ход. Перетащите карту из руки на свою половину стола.');
  }

  function endPlayerTurn() {
    if (busy || state.over || state.turn !== 'player' || pendingQuestion) {
      return;
    }
    clearSelection();
    var events = [];
    E.endTurn(state, events);
    busy = true;
    render();
    runEvents(events).then(aiTurn);
  }

  function aiTurn() {
    if (state.over) {
      busy = false;
      render();
      showEnd();
      return;
    }
    sleep(650).then(function () {
      var events = [];
      E.AI.takeTurn(state, events);
      return runEvents(events);
    }).then(function () {
      if (state.over) {
        busy = false;
        render();
        showEnd();
        return null;
      }
      var events2 = [];
      E.endTurn(state, events2);
      return runEvents(events2);
    }).then(function () {
      busy = false;
      if (!state.over) {
        sfx.turn();
        toast('Ваш ход');
      }
      render();
      if (state.over) {
        showEnd();
      }
    });
  }

  function runEvents(events) {
    var chain = Promise.resolve();
    events.forEach(function (ev) {
      chain = chain.then(function () {
        return handleEvent(ev);
      });
    });
    return chain;
  }

  function animateSpell(ev) {
    if (ev.target && ev.target.isMinion && ev.targetSlot >= 0 && ev.targetSlot !== null) {
      spellTargetAnchors.set(ev.target, { side: ev.targetSide, slot: ev.targetSlot });
    }
    var source = heroRowEl(ev.side);
    var target = targetElOf(ev.target) || source;
    if (!source || !target) {
      return Promise.resolve();
    }
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    var from = centerOf(source);
    var to = centerOf(target);
    var width = document.documentElement.clientWidth;
    var height = window.innerHeight;
    from.x = Math.max(25, Math.min(width - 25, from.x));
    from.y = Math.max(25, Math.min(height - 25, from.y));
    var effect = ev.card.effect.id;
    var layer = document.createElement('div');
    layer.className = 'spell-fx spell-fx--' + effect;
    layer.dataset.caster = ev.side;
    layer.dataset.targetSide = ev.targetSide || ev.side;
    layer.setAttribute('aria-hidden', 'true');
    var projectile = document.createElement('div');
    projectile.className = 'spell-projectile';
    projectile.appendChild(cardEmblem(effect));
    var label = document.createElement('span');
    label.className = 'spell-cast-label';
    label.textContent = (ev.side === 'ai' ? 'Противник: ' : 'Вы: ') + ev.card.hanzi + ' · ' + ev.card.name;
    label.style.left = Math.max(8, Math.min(width - Math.min(250, width - 16) - 8, from.x - 125)) + 'px';
    label.style.top = Math.max(8, from.y - 80) + 'px';
    var impact = document.createElement('div');
    impact.className = 'spell-impact';
    impact.style.left = to.x + 'px';
    impact.style.top = to.y + 'px';
    impact.hidden = true;
    for (var n = 0; n < 8; n += 1) {
      var spark = document.createElement('span');
      spark.style.setProperty('--spark-angle', n * 45 + 'deg');
      impact.appendChild(spark);
    }
    layer.appendChild(projectile);
    layer.appendChild(label);
    layer.appendChild(impact);
    document.body.appendChild(layer);
    var reduce = reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    projectile.style.left = (reduce ? to.x : from.x) + 'px';
    projectile.style.top = (reduce ? to.y : from.y) + 'px';
    var flight = null;
    if (!reduce) {
      flight = projectile.animate([
        { transform: 'translate(-50%, -50%) scale(.7)', opacity: .6 },
        { transform: 'translate(calc(-50% + ' + (to.x - from.x) * .5 + 'px), calc(-50% + ' + ((to.y - from.y) * .5 - 26) + 'px)) scale(1.15)', opacity: 1, offset: .5 },
        { transform: 'translate(calc(-50% + ' + (to.x - from.x) + 'px), calc(-50% + ' + (to.y - from.y) + 'px)) scale(.9)', opacity: 1 }
      ], { duration: 480, easing: 'ease-in-out', fill: 'forwards' });
    }
    var match = state;
    return new Promise(function (resolve) {
      setTimeout(resolve, reduce ? 0 : 480);
    }).then(function () {
      if (state !== match) {
        return;
      }
      projectile.hidden = true;
      impact.hidden = false;
      target.classList.add('spell-target-hit');
      target.style.setProperty('--spell-color', { damage: '#ffac69', heal: '#9fddb0', buff: '#d2a7f2', draw: '#a7d9ed' }[effect]);
      return new Promise(function (resolve) {
        setTimeout(resolve, reduce ? 240 : 320);
      });
    }).finally(function () {
      if (flight) {
        flight.cancel();
      }
      target.classList.remove('spell-target-hit');
      target.style.removeProperty('--spell-color');
      layer.remove();
    });
  }

  function handleEvent(ev) {
    switch (ev.type) {
      case 'summon':
        render();
        var sNode = minionEl(ev.minion.uid);
        if (sNode) {
          sNode.classList.add('anim-spawn');
        }
        sfx.summon();
        return sleep(340);
      case 'spell':
        sfx.spell();
        return animateSpell(ev);
      case 'attack-start':
        var aNode = targetElOf(ev.attacker);
        var tNode = targetElOf(ev.target);
        if (aNode && tNode) {
          var ac = centerOf(aNode);
          var tc = centerOf(tNode);
          aNode.style.setProperty('--lx', (tc.x - ac.x) * 0.7 + 'px');
          aNode.style.setProperty('--ly', (tc.y - ac.y) * 0.7 + 'px');
          aNode.classList.add('anim-lunge');
        }
        sfx.attack();
        return sleep(330);
      case 'attack-end':
        render();
        return sleep(120);
      case 'damage':
        var dNode = targetElOf(ev.target);
        if (dNode) {
          dNode.classList.remove('anim-lunge');
          dNode.classList.add('anim-hit');
        }
        floatNumber(ev.target, ev.amount, 'dmg');
        sfx.damage();
        return sleep(260);
      case 'heal':
        if (ev.source === 'medic') {
          toast('Лекарь: герою +' + ev.amount + ' HP');
        }
        floatNumber(ev.target, ev.amount, 'heal');
        var hNode = targetElOf(ev.target);
        if (hNode) {
          hNode.classList.add('anim-healed');
        }
        sfx.heal();
        return sleep(260);
      case 'buff':
        floatNumber(ev.target, '+' + ev.amount + '/+' + ev.amount, 'buff');
        var bNode = targetElOf(ev.target);
        if (bNode) {
          bNode.classList.add('anim-buffed');
        }
        sfx.buff();
        return sleep(260);
      case 'shield':
        floatNumber(ev.target, ev.amount, 'shield');
        sfx.shield();
        return sleep(220);
      case 'barrier-break':
        var barrierNode = targetElOf(ev.target);
        if (barrierNode) {
          barrierNode.classList.add('anim-barrier-break');
          barrierNode.classList.remove('minion--barrier');
          var abilityBadge = barrierNode.querySelector('.minion-ability');
          if (abilityBadge) {
            abilityBadge.textContent = 'Щит снят';
          }
        }
        floatNumber(ev.target, 'Щит!', 'shield');
        sfx.shield();
        return sleep(300);
      case 'shield-absorb':
        floatNumber(ev.target, ev.amount, 'shield');
        return sleep(140);
      case 'death':
        var deadNode = minionEl(ev.minion.uid);
        if (deadNode) {
          deadNode.classList.add('anim-death');
        }
        sfx.death();
        return sleep(420).then(function () {
          render();
        });
      case 'card-locked':
        render();
        return sleep(120);
      case 'burn':
        toast('Рука переполнена: карта ' + ev.card.hanzi + ' сгорела');
        return sleep(200);
      case 'over':
        return sleep(200);
      default:
        return Promise.resolve();
    }
  }

  function clearHighlights() {
    Array.prototype.forEach.call(document.querySelectorAll('.drop-ok, .is-target-ok, .is-spell-target'), function (n) {
      n.classList.remove('drop-ok', 'is-target-ok', 'is-spell-target');
    });
    g('dropZoneNone').hidden = true;
    clearArrow();
  }

  function highlightOwnMinions(cls) {
    Array.prototype.forEach.call(g('playerBoard').querySelectorAll('.minion'), function (n) {
      n.classList.add(cls);
    });
  }

  function highlightEnemyMinions(cls) {
    Array.prototype.forEach.call(g('enemyBoard').querySelectorAll('.minion'), function (n) {
      n.classList.add(cls);
    });
  }

  function highlightForCard(card) {
    clearHighlights();
    if (card.kind === 'minion') {
      Array.prototype.forEach.call(g('playerBoard').children, function (cell, i) {
        if (!state.player.board[i]) {
          cell.classList.add('drop-ok');
        }
      });
    } else if (card.effect) {
      var t = card.effect.target;
      if (t === 'none') {
        var zone = g('dropZoneNone');
        zone.hidden = false;
        zone.classList.add('drop-ok');
      } else if (t === 'own-hero') {
        heroRowEl('player').classList.add('is-spell-target');
      } else if (t === 'enemy-any') {
        heroRowEl('ai').classList.add('is-spell-target');
        highlightEnemyMinions('is-spell-target');
      } else if (t === 'own-minion') {
        highlightOwnMinions('is-spell-target');
      }
    }
  }

  function highlightForAttack() {
    clearHighlights();
    var attacker = findMinionByUid(selectedAttackerUid);
    if (!attacker) {
      return;
    }
    E.validAttackTargets(state, attacker).forEach(function (target) {
      var node = targetElOf(target);
      if (node) {
        node.classList.add('is-target-ok');
      }
    });
  }

  function highlightForPower() {
    clearHighlights();
    var spec = D.POWERS[state.player.power.id];
    if (spec.target === 'enemy-any') {
      heroRowEl('ai').classList.add('is-spell-target');
      highlightEnemyMinions('is-spell-target');
    } else if (spec.target === 'own-minion') {
      highlightOwnMinions('is-spell-target');
    }
    toast('Выберите цель для силы героя');
  }

  function clearSelection() {
    selectedCardUid = null;
    selectedAttackerUid = null;
    powerTargeting = false;
    clearHighlights();
    render();
  }

  function dropZoneAt(x, y, dragInfo) {
    var ghost = dragInfo && dragInfo.ghost;
    var prev = null;
    if (ghost) {
      prev = ghost.style.display;
      ghost.style.display = 'none';
    }
    var node = document.elementFromPoint(x, y);
    if (ghost && prev !== null) {
      ghost.style.display = prev;
    }
    if (!node) {
      return null;
    }
    var zone = node.closest('[data-drop]');
    return zone ? zone.dataset.drop : null;
  }

  function beginCardDrag(card, cardNode, x, y) {
    var ghost = cardNode.cloneNode(true);
    ghost.classList.add('ghost');
    ghost.classList.remove('is-selected');
    var rect = cardNode.getBoundingClientRect();
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.left = (x - rect.width / 2) + 'px';
    ghost.style.top = (y - rect.height / 2) + 'px';
    g('dragLayer').appendChild(ghost);
    drag = { mode: 'card', card: card, ghost: ghost };
    highlightForCard(card);
  }

  function beginAttackDrag(minion, minionNode, x, y) {
    selectedAttackerUid = minion.uid;
    drag = { mode: 'attack', minion: minion, from: centerOf(minionNode) };
    highlightForAttack();
    drawArrow(drag.from, { x: x, y: y });
  }

  function onPointerMove(e) {
    if (!drag) {
      return;
    }
    if (drag.mode === 'card') {
      drag.ghost.style.left = (e.clientX - drag.ghost.offsetWidth / 2) + 'px';
      drag.ghost.style.top = (e.clientY - drag.ghost.offsetHeight / 2) + 'px';
    } else if (drag.mode === 'attack') {
      drawArrow(drag.from, { x: e.clientX, y: e.clientY });
    }
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!drag) {
      return;
    }
    var current = drag;
    drag = null;
    clearArrow();
    var drop = dropZoneAt(e.clientX, e.clientY, current);
    if (current.mode === 'card') {
      if (current.ghost.parentNode) {
        current.ghost.parentNode.removeChild(current.ghost);
      }
      handleCardDrop(current.card, drop);
    } else if (current.mode === 'attack') {
      handleAttackDrop(current.minion, drop);
    }
    clearHighlights();
    if (state && !state.over && state.turn === 'player' && !pendingQuestion) {
      render();
    }
  }

  function onPointerCancel() {
    if (!drag) {
      return;
    }
    if (drag.mode === 'card' && drag.ghost && drag.ghost.parentNode) {
      drag.ghost.parentNode.removeChild(drag.ghost);
    }
    drag = null;
    clearHighlights();
    render();
  }

  function resolveTarget(drop) {
    if (!drop) {
      return null;
    }
    if (drop === 'enemy-hero') {
      return state.ai;
    }
    if (drop === 'own-hero') {
      return state.player;
    }
    var m = /^minion-(ai|player)-(.+)$/.exec(drop);
    if (m) {
      return findMinionByUid(m[2]);
    }
    return null;
  }

  function handleCardDrop(card, drop) {
    if (!drop || !card || state.over || state.turn !== 'player' || busy || pendingQuestion) {
      return;
    }
    if (card.kind === 'minion') {
      var m = /^slot-(\d)$/.exec(drop);
      if (!m) {
        return;
      }
      var slot = parseInt(m[1], 10);
      if (!E.isValidDrop(state, card, slot)) {
        toast('Эта ячейка занята или карта сейчас недоступна');
        return;
      }
      openQuestion(card, { slot: slot });
    } else {
      if (card.effect.target === 'none' && drop !== 'none-zone') {
        return;
      }
      var target = resolveTarget(drop);
      if (!E.isValidSpellDrop(state, card, target)) {
        toast('Это заклинание нельзя применить к этой цели');
        return;
      }
      openQuestion(card, { target: target });
    }
  }

  function handleAttackDrop(attacker, drop) {
    if (!drop || state.over || state.turn !== 'player' || busy || pendingQuestion) {
      return;
    }
    if (drop === 'enemy-hero') {
      performAttack(attacker, state.ai);
      return;
    }
    var target = resolveTarget(drop);
    if (target && target.isMinion && target !== attacker) {
      performAttack(attacker, target);
    }
  }

  function performAttack(attacker, target) {
    if (!E.canAttack(state, attacker) || E.validAttackTargets(state, attacker).indexOf(target) === -1) {
      toast('Этот боец сейчас не может атаковать');
      return;
    }
    busy = true;
    selectedAttackerUid = null;
    render();
    var events = [];
    E.attack(state, attacker, target, events);
    runEvents(events).then(function () {
      busy = false;
      render();
      if (state.over) {
        showEnd();
      }
    });
  }

  function openQuestion(card, placement) {
    if (pendingQuestion || state.over) {
      return;
    }
    currentQuestion = E.makeQuestion(card, rng);
    pendingQuestion = { card: card, placement: placement, answered: false, correct: false };
    g('questionKind').textContent = currentQuestion.mode === 'ru' ? 'вопрос о значении' : 'вопрос о чтении';
    g('questionHanzi').textContent = currentQuestion.hanzi;
    g('questionTitle').textContent = currentQuestion.mode === 'ru'
      ? 'Что означает этот знак?'
      : 'Как читается этот знак (пиньинь)?';
    var box = g('questionOptions');
    box.innerHTML = '';
    currentQuestion.options.forEach(function (opt, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt;
      btn.dataset.index = String(idx);
      btn.addEventListener('click', function () {
        answerQuestion(idx);
      });
      box.appendChild(btn);
    });
    g('questionFeedback').hidden = true;
    g('questionActions').hidden = false;
    g('questionModal').hidden = false;
    var firstBtn = box.querySelector('button');
    if (firstBtn) {
      firstBtn.focus();
    }
  }

  function answerQuestion(idx) {
    if (!pendingQuestion || !currentQuestion || pendingQuestion.answered) {
      return;
    }
    pendingQuestion.answered = true;
    var card = pendingQuestion.card;
    var chosen = currentQuestion.options[idx];
    var correct = chosen === currentQuestion.correct;
    pendingQuestion.correct = correct;
    E.resolveAnswer(state, card, correct, []);
    Array.prototype.forEach.call(g('questionOptions').children, function (btn) {
      btn.disabled = true;
      var value = currentQuestion.options[parseInt(btn.dataset.index, 10)];
      if (value === currentQuestion.correct) {
        btn.classList.add('is-correct');
      } else if (value === chosen && !correct) {
        btn.classList.add('is-wrong');
      }
    });
    g('questionActions').hidden = true;
    g('questionFeedback').hidden = false;
    var line = g('feedbackLine');
    line.textContent = correct ? 'Верно! Карта разыграна.' : 'Ошибка. Карта вернётся в руку и ждёт следующего хода.';
    line.className = 'feedback-line ' + (correct ? 'feedback-line--good' : 'feedback-line--bad');
    g('wordHanzi').textContent = currentQuestion.hanzi;
    g('wordPinyin').textContent = currentQuestion.pinyin;
    g('wordRu').textContent = currentQuestion.ru;
    g('wordNote').textContent = currentQuestion.note;
    if (correct) {
      sfx.play();
    } else {
      sfx.wrong();
    }
    g('feedbackClose').focus();
  }

  function discardQuestion() {
    pendingQuestion = null;
    currentQuestion = null;
    g('questionModal').hidden = true;
    render();
  }

  function finishQuestion() {
    if (!pendingQuestion) {
      return;
    }
    var pending = pendingQuestion;
    pendingQuestion = null;
    currentQuestion = null;
    g('questionModal').hidden = true;
    if (!pending.answered) {
      discardQuestion();
      return;
    }
    if (!pending.correct || state.over || state.turn !== 'player') {
      render();
      if (!pending.correct) {
        toast('Карта ' + pending.card.hanzi + ' ждёт следующего хода');
      }
      return;
    }
    var events = [];
    var res = E.playCard(state, pending.card, pending.placement, events);
    if (!res.ok) {
      toast('Карта больше не может быть разыграна');
      render();
      return;
    }
    busy = true;
    renderHeroes();
    renderBar();
    var match = state;
    runEvents(events).finally(function () {
      if (state !== match) {
        return;
      }
      busy = false;
      render();
      if (state.over) {
        showEnd();
      }
    });
  }

  function usePowerFlow(target) {
    var events = [];
    var res = E.usePower(state, target, events);
    powerTargeting = false;
    if (!res.ok) {
      toast(res.reason === 'target' ? 'Недопустимая цель для силы героя' : 'Сила героя сейчас недоступна');
      render();
      return;
    }
    busy = true;
    render();
    runEvents(events).then(function () {
      busy = false;
      render();
      if (state.over) {
        showEnd();
      }
    });
  }

  function showEnd() {
    closeRules();
    stopTimer();
    var titles = { player: 'Победа!', ai: 'Поражение', draw: 'Ничья' };
    g('endTitle').textContent = titles[state.result] || 'Матч завершён';
    g('endReason').textContent = state.resultReason === 'time'
      ? 'Время вышло: победил герой с большим запасом здоровья.'
      : 'Здоровье одного из героев исчерпано.';
    var total = state.stats.correct + state.stats.wrong;
    var accuracy = total > 0 ? Math.round(state.stats.correct / total * 100) : 0;
    var duration = Math.min(Date.now() - state.startedAt, D.MATCH_MS);
    var statsBox = g('endStats');
    statsBox.innerHTML = '';
    [
      { label: 'Длительность', value: fmtTime(duration) },
      { label: 'Верных ответов', value: state.stats.correct },
      { label: 'Ошибок', value: state.stats.wrong },
      { label: 'Точность', value: accuracy + '%' }
    ].forEach(function (item) {
      var box = document.createElement('div');
      box.className = 'end-stat';
      var b = document.createElement('b');
      b.textContent = String(item.value);
      var label = document.createElement('span');
      label.textContent = item.label;
      box.appendChild(b);
      box.appendChild(label);
      statsBox.appendChild(box);
    });
    var wordsBox = g('endWords');
    wordsBox.innerHTML = '';
    var byId = {};
    D.WORDS.forEach(function (w) { byId[w.id] = w; });
    var learnedIds = Object.keys(state.stats.learned);
    var mistakeIds = Object.keys(state.stats.mistakes);
    if (learnedIds.length) {
      var h1 = document.createElement('h3');
      h1.textContent = 'Разобраны в матче';
      var ul1 = document.createElement('ul');
      learnedIds.forEach(function (id) {
        var w = byId[id];
        var li = document.createElement('li');
        li.textContent = '';
        var zh = document.createElement('span');
        zh.className = 'zh';
        zh.lang = 'zh';
        zh.textContent = w.hanzi;
        li.appendChild(zh);
        li.appendChild(document.createTextNode(' ' + w.pinyin + ' — ' + w.ru + ' (верно: ' + state.stats.learned[id] + ')'));
        ul1.appendChild(li);
      });
      wordsBox.appendChild(h1);
      wordsBox.appendChild(ul1);
    }
    if (mistakeIds.length) {
      var h2 = document.createElement('h3');
      h2.textContent = 'Ошибки — повторите';
      var ul2 = document.createElement('ul');
      mistakeIds.forEach(function (id) {
        var w = byId[id];
        var li = document.createElement('li');
        var zh = document.createElement('span');
        zh.className = 'zh';
        zh.lang = 'zh';
        zh.textContent = w.hanzi;
        li.appendChild(zh);
        li.appendChild(document.createTextNode(' ' + w.pinyin + ' — ' + w.ru + ' (ошибок: ' + state.stats.mistakes[id] + ')'));
        ul2.appendChild(li);
      });
      wordsBox.appendChild(h2);
      wordsBox.appendChild(ul2);
    }
    if (!learnedIds.length && !mistakeIds.length) {
      var p = document.createElement('p');
      p.textContent = 'Ни одной карты не разыграно.';
      wordsBox.appendChild(p);
    }
    g('endModal').hidden = false;
    g('rematchBtn').focus();
    if (state.result === 'player') {
      sfx.win();
    } else if (state.result === 'ai') {
      sfx.lose();
    }
  }

  function guardActive() {
    return !busy && state && !state.over && state.turn === 'player' && !pendingQuestion && !drag;
  }

  function onHandPointerDown(e) {
    if (!guardActive()) {
      return;
    }
    var cardNode = e.target.closest('.card');
    if (!cardNode) {
      return;
    }
    var card = getCardByUid(cardNode.dataset.uid);
    if (!card) {
      return;
    }
    if (!E.canPlayCard(state, card)) {
      toast(card.locked ? 'Карта ждёт следующего хода' : 'Не хватает маны: нужно ' + card.cost);
      return;
    }
    e.preventDefault();
    beginCardDrag(card, cardNode, e.clientX, e.clientY);
  }

  function onBoardPointerDown(e) {
    if (!guardActive() || powerTargeting || selectedCardUid) {
      return;
    }
    var minionNode = e.target.closest('.minion');
    if (!minionNode || minionNode.dataset.side !== 'player') {
      return;
    }
    var minion = findMinionByUid(minionNode.dataset.uid);
    if (!minion || !E.canAttack(state, minion)) {
      return;
    }
    e.preventDefault();
    beginAttackDrag(minion, minionNode, e.clientX, e.clientY);
  }

  function onHandClick(e) {
    if (!guardActive()) {
      return;
    }
    var cardNode = e.target.closest('.card');
    if (!cardNode) {
      return;
    }
    var card = getCardByUid(cardNode.dataset.uid);
    if (!card) {
      return;
    }
    if (!E.canPlayCard(state, card)) {
      toast(card.locked ? 'Карта ждёт следующего хода' : 'Не хватает маны: нужно ' + card.cost);
      return;
    }
    if (selectedCardUid === card.uid) {
      clearSelection();
      return;
    }
    selectedCardUid = card.uid;
    selectedAttackerUid = null;
    powerTargeting = false;
    render();
    highlightForCard(card);
    toast(card.kind === 'minion' ? 'Выберите свободную ячейку своей половины' : 'Выберите цель заклинания');
  }

  function trySpellOn(dropValue) {
    var cardSel = getCardByUid(selectedCardUid);
    if (!cardSel || cardSel.kind !== 'spell') {
      return false;
    }
    var target = resolveTarget(dropValue);
    if (E.isValidSpellDrop(state, cardSel, target)) {
      handleCardDrop(cardSel, dropValue);
      clearSelection();
      return true;
    }
    return false;
  }

  function onPlayerBoardClick(e) {
    if (!guardActive()) {
      return;
    }
    if (selectedCardUid) {
      var minionNode = e.target.closest('.minion');
      if (minionNode && trySpellOn(minionNode.dataset.drop)) {
        return;
      }
      var cell = e.target.closest('.cell');
      if (cell) {
        var cardSel = getCardByUid(selectedCardUid);
        if (cardSel && cardSel.kind === 'minion' && /^slot-\d$/.test(cell.dataset.drop)) {
          handleCardDrop(cardSel, cell.dataset.drop);
        }
        clearSelection();
      }
      return;
    }
    if (powerTargeting) {
      var pn = e.target.closest('.minion');
      if (pn) {
        var pt = resolveTarget(pn.dataset.drop);
        if (E.powerTargetValid(state, pt)) {
          usePowerFlow(pt);
          return;
        }
      }
      toast('Сила героя отменена');
      powerTargeting = false;
      clearHighlights();
      render();
      return;
    }
    var own = e.target.closest('.minion');
    if (own) {
      var minion = findMinionByUid(own.dataset.uid);
      if (minion && E.canAttack(state, minion)) {
        selectedAttackerUid = minion.uid;
        render();
        highlightForAttack();
        toast('Выберите цель атаки: врага или героя противника');
      }
    }
  }

  function onEnemySideClick(e) {
    if (!guardActive()) {
      return;
    }
    var dropValue = null;
    var minionNode = e.target.closest('.minion');
    var heroRow = e.target.closest('.hero-row[data-hero="ai"]');
    if (minionNode && g('enemyBoard').contains(minionNode)) {
      dropValue = minionNode.dataset.drop;
    } else if (heroRow) {
      dropValue = 'enemy-hero';
    } else {
      return;
    }
    if (powerTargeting) {
      var pt = resolveTarget(dropValue);
      if (E.powerTargetValid(state, pt)) {
        usePowerFlow(pt);
      } else {
        toast('Сила героя не действует на эту цель');
      }
      return;
    }
    if (selectedCardUid && trySpellOn(dropValue)) {
      return;
    }
    if (selectedAttackerUid) {
      var attacker = findMinionByUid(selectedAttackerUid);
      if (attacker) {
        handleAttackDrop(attacker, dropValue);
      }
      clearSelection();
    }
  }

  function onPlayerHeroRowClick(e) {
    if (!guardActive()) {
      return;
    }
    if (!e.target.closest('.hero-row[data-hero="player"]')) {
      return;
    }
    if (selectedCardUid && trySpellOn('own-hero')) {
      return;
    }
  }

  var rulesReturnFocus = null;

  function closeRules() {
    if (g('rules').open) {
      g('rules').close();
    }
  }

  function bindEvents() {
    g('rulesLink').addEventListener('click', function () {
      rulesReturnFocus = document.activeElement;
      g('rules').showModal();
      g('rulesClose').focus();
    });
    g('rulesClose').addEventListener('click', closeRules);
    g('rules').addEventListener('close', function () {
      if (rulesReturnFocus && rulesReturnFocus.isConnected) {
        rulesReturnFocus.focus();
      }
      rulesReturnFocus = null;
    });
    g('startMatch').addEventListener('click', startMatch);
    g('soundToggle').addEventListener('click', function () {
      sound.enabled = !sound.enabled;
      var btn = g('soundToggle');
      btn.textContent = 'Звук: ' + (sound.enabled ? 'вкл' : 'выкл');
      btn.setAttribute('aria-pressed', sound.enabled ? 'true' : 'false');
      if (sound.enabled) {
        audioCtx();
        sfx.turn();
      }
    });
    g('endTurnBtn').addEventListener('click', endPlayerTurn);
    g('rematchBtn').addEventListener('click', startMatch);
    g('changeHeroBtn').addEventListener('click', function () {
      g('endModal').hidden = true;
      g('screen-game').hidden = true;
      g('screen-select').hidden = false;
      document.getElementById('app').classList.remove('is-playing');
      stopTimer();
      state = null;
      selectedHeroId = null;
      renderHeroSelect();
      g('startMatch').disabled = true;
    });
    g('questionCancel').addEventListener('click', discardQuestion);
    g('feedbackClose').addEventListener('click', finishQuestion);
    g('pronounceBtn').addEventListener('click', function () {
      if (currentQuestion) {
        speak(currentQuestion.hanzi);
      }
    });

    g('hand').addEventListener('pointerdown', onHandPointerDown);
    g('hand').addEventListener('click', onHandClick);
    g('playerBoard').addEventListener('pointerdown', onBoardPointerDown);
    g('playerBoard').addEventListener('click', onPlayerBoardClick);
    g('enemyBoard').addEventListener('click', onEnemySideClick);
    heroRowEl('ai').addEventListener('click', onEnemySideClick);
    heroRowEl('player').addEventListener('click', onPlayerHeroRowClick);

    g('powerBtn').addEventListener('click', function () {
      if (!guardActive() || !E.canUsePower(state)) {
        return;
      }
      var spec = D.POWERS[state.player.power.id];
      if (spec.target === 'none') {
        usePowerFlow(null);
        return;
      }
      powerTargeting = true;
      selectedCardUid = null;
      selectedAttackerUid = null;
      render();
      highlightForPower();
    });

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);

    document.addEventListener('keydown', function (e) {
      if (g('rules').open) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeRules();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (pendingQuestion) {
          if (!pendingQuestion.answered) {
            discardQuestion();
          }
          return;
        }
        if (drag) {
          onPointerCancel();
          return;
        }
        if (powerTargeting || selectedCardUid || selectedAttackerUid) {
          clearSelection();
        }
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state && !state.over) {
        updateTimer();
      }
    });
  }

  function init() {
    cacheDom();
    renderHeroSelect();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {};
}());
