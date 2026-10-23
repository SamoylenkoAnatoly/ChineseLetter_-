window.TAVERN_ENGINE = (function () {
  'use strict';

  var D = window.TAVERN_DATA;
  var BOARD = D.BOARD_SIZE;

  function shuffle(list, rng) {
    var arr = list.slice();
    var current = arr.length;
    while (current > 1) {
      current -= 1;
      var idx = Math.floor(rng() * (current + 1));
      var tmp = arr[current];
      arr[current] = arr[idx];
      arr[idx] = tmp;
    }
    return arr;
  }

  function createRng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  }

  function createCard(word, action, rng) {
    return {
      uid: 'c' + Math.floor(rng() * 1e9).toString(36) + Math.floor(rng() * 1e9).toString(36),
      wordId: word.id,
      hanzi: word.hanzi,
      pinyin: word.pinyin,
      ru: word.ru,
      note: word.note,
      cost: action.cost,
      kind: action.kind,
      name: action.name,
      text: action.text,
      minionAtk: action.kind === 'minion' ? action.atk : 0,
      minionHp: action.kind === 'minion' ? action.hp : 0,
      effect: action.effect || null,
      ability: action.ability || null
    };
  }

  function pickSpell(rng) {
    var pools = [
      { kind: 'spell', name: 'Кувшин злости', cost: 1, text: 'Нанести 2 урона выбранному врагу.', effect: { id: 'damage', amount: 2, target: 'enemy-any' } },
      { kind: 'spell', name: 'Кружка доброты', cost: 2, text: 'Восстановить 4 HP выбранному своему бойцу.', effect: { id: 'heal', amount: 4, target: 'own-minion' } },
      { kind: 'spell', name: 'Тёплый эль', cost: 1, text: 'Восстановить 3 HP вашему герою.', effect: { id: 'heal', amount: 3, target: 'own-hero' } },
      { kind: 'spell', name: 'Двойная порция', cost: 0, text: 'Взять карту.', effect: { id: 'draw', amount: 1, target: 'none' } },
      { kind: 'spell', name: 'Жар погребальной свечи', cost: 3, text: 'Нанести 3 урона выбранному врагу.', effect: { id: 'damage', amount: 3, target: 'enemy-any' } },
      { kind: 'spell', name: 'Расписная пика', cost: 2, text: 'Дать выбранному своему бойцу +1/+1.', effect: { id: 'buff', amount: 1, target: 'own-minion' } }
    ];
    return pools[Math.floor(rng() * pools.length)];
  }

  function createDeck(rng) {
    var words = shuffle(D.WORDS, rng);
    var fighters = [];
    var weights = [5, 5, 4, 3, 3, 3, 3, 3];
    D.MINION_TEMPLATES.forEach(function (template, index) {
      for (var n = 0; n < weights[index]; n += 1) {
        fighters.push(template);
      }
    });
    fighters = shuffle(fighters, rng);
    var deck = [];
    for (var i = 0; i < words.length; i += 1) {
      var word = words[i];
      var kind = i % 3 === 2 ? 'spell' : 'minion';
      var action = kind === 'spell' ? pickSpell(rng) : fighters.pop();
      deck.push(createCard(word, action, rng));
    }
    return shuffle(deck, rng);
  }

  function newSide(heroId) {
    var hero = null;
    for (var i = 0; i < D.PLAYERS.length; i += 1) {
      if (D.PLAYERS[i].id === heroId) {
        hero = D.PLAYERS[i];
        break;
      }
    }
    if (!hero) {
      throw new Error('engine: unknown hero ' + heroId);
    }
    return {
      isHero: true,
      heroId: hero.id,
      heroName: hero.name,
      heroPortrait: hero.portrait,
      power: hero.power,
      hp: D.HERO_MAX_HP,
      shield: 0,
      mana: 0,
      maxMana: 0,
      deck: [],
      hand: [],
      board: new Array(BOARD).fill(null),
      fatigue: 0,
      powerUsed: false
    };
  }

  function sideLabel(state, side) {
    return side === state.player ? 'player' : 'ai';
  }

  function drawCard(side, events) {
    if (side.deck.length === 0) {
      side.fatigue += 1;
      dealDamage(side, side.fatigue, events);
      return null;
    }
    var card = side.deck.pop();
    if (side.hand.length >= D.HAND_LIMIT) {
      if (events) {
        events.push({ type: 'burn', side: side.heroId, card: card });
      }
      return null;
    }
    side.hand.push(card);
    return card;
  }

  function startTurn(state, who, events) {
    var side = who === 'player' ? state.player : state.ai;
    state.turn = who;
    state.turnNumber += 1;
    side.maxMana = Math.min(D.MAX_MANA, side.maxMana + 1);
    side.mana = side.maxMana;
    side.powerUsed = false;
    side.shield = 0;
    for (var i = 0; i < side.board.length; i += 1) {
      var m = side.board[i];
      if (m) {
        m.ready = true;
        m.attacked = false;
        m.justPlayed = false;
      }
    }
    for (var h = 0; h < side.hand.length; h += 1) {
      side.hand[h].locked = false;
    }
    drawCard(side, events);
  }

  function createMatch(playerHeroId, aiHeroId, rng, now) {
    var random = rng || Math.random;
    var player = newSide(playerHeroId);
    var ai = newSide(aiHeroId);
    player.deck = createDeck(random);
    ai.deck = createDeck(random);
    for (var i = 0; i < D.START_HAND_SIZE; i += 1) {
      drawCard(player, null);
      drawCard(ai, null);
    }
    var state = {
      turn: 'player',
      turnNumber: 0,
      player: player,
      ai: ai,
      over: false,
      result: null,
      resultReason: null,
      startedAt: now,
      deadline: now + D.MATCH_MS,
      stats: { correct: 0, wrong: 0, learned: {}, mistakes: {} },
      log: []
    };
    startTurn(state, 'player', null);
    return state;
  }

  function dealDamage(target, amount, events) {
    if (!target || amount <= 0) {
      return 0;
    }
    if (target.isMinion && target.barrierActive) {
      target.barrierActive = false;
      target.abilitySpent = true;
      if (events) {
        events.push({ type: 'barrier-break', target: target, amount: amount });
      }
      return 0;
    }
    var actual = amount;
    if (target.shield > 0) {
      var absorbed = Math.min(target.shield, amount);
      target.shield -= absorbed;
      actual = amount - absorbed;
      if (events) {
        events.push({ type: 'shield-absorb', target: target, amount: absorbed });
      }
    }
    if (actual <= 0) {
      return 0;
    }
    target.hp -= actual;
    if (events) {
      events.push({ type: 'damage', target: target, amount: actual });
    }
    return actual;
  }

  function cleanupBoard(state, side, events) {
    for (var i = 0; i < side.board.length; i += 1) {
      var m = side.board[i];
      if (m && m.hp <= 0) {
        side.board[i] = null;
        if (events) {
          events.push({ type: 'death', side: sideLabel(state, side), slot: i, minion: m });
        }
      }
    }
  }

  function checkOver(state, events) {
    if (state.over) {
      return true;
    }
    var playerDead = state.player.hp <= 0;
    var aiDead = state.ai.hp <= 0;
    if (playerDead || aiDead) {
      state.over = true;
      if (playerDead && aiDead) {
        state.result = 'draw';
      } else if (aiDead) {
        state.result = 'player';
      } else {
        state.result = 'ai';
      }
      state.resultReason = 'hp';
      if (events) {
        events.push({ type: 'over', result: state.result, reason: 'hp' });
      }
      return true;
    }
    return false;
  }

  function checkTime(state, now, events) {
    if (!state.over && now >= state.deadline) {
      state.over = true;
      if (state.player.hp > state.ai.hp) {
        state.result = 'player';
      } else if (state.ai.hp > state.player.hp) {
        state.result = 'ai';
      } else {
        state.result = 'draw';
      }
      state.resultReason = 'time';
      if (events) {
        events.push({ type: 'over', result: state.result, reason: 'time' });
      }
      return true;
    }
    return false;
  }

  function mySide(state) {
    return state.turn === 'player' ? state.player : state.ai;
  }

  function foeSide(state) {
    return state.turn === 'player' ? state.ai : state.player;
  }

  function isOnBoard(side, target) {
    if (!target || !target.isMinion) {
      return false;
    }
    for (var i = 0; i < side.board.length; i += 1) {
      if (side.board[i] === target) {
        return true;
      }
    }
    return false;
  }

  function canPlayCard(state, card) {
    if (state.over) {
      return false;
    }
    var side = mySide(state);
    if (card.locked || card.cost > side.mana) {
      return false;
    }
    return side.hand.indexOf(card) !== -1;
  }

  function isValidDrop(state, card, slot) {
    if (!canPlayCard(state, card) || card.kind !== 'minion') {
      return false;
    }
    if (slot < 0 || slot >= BOARD) {
      return false;
    }
    return !mySide(state).board[slot];
  }

  function spellTargetValid(state, card, target) {
    var eff = card.effect;
    if (!eff) {
      return false;
    }
    var side = mySide(state);
    var foe = foeSide(state);
    if (eff.target === 'none') {
      return target === null;
    }
    if (eff.target === 'own-hero') {
      return target === side;
    }
    if (eff.target === 'enemy-any') {
      return target === foe || isOnBoard(foe, target);
    }
    if (eff.target === 'own-minion') {
      return isOnBoard(side, target);
    }
    return false;
  }

  function isValidSpellDrop(state, card, target) {
    return canPlayCard(state, card) && card.kind === 'spell' && spellTargetValid(state, card, target);
  }

  function summonMinion(side, card, slot) {
    var minion = {
      isMinion: true,
      uid: card.uid,
      card: card,
      atk: card.minionAtk,
      hp: card.minionHp,
      maxHp: card.minionHp,
      ready: card.ability === 'rush',
      attacked: false,
      justPlayed: true,
      ability: card.ability || null,
      barrierActive: card.ability === 'barrier',
      abilitySpent: false
    };
    side.board[slot] = minion;
    return minion;
  }

  function applyEffect(state, side, eff, target, events) {
    var foe = side === state.player ? state.ai : state.player;
    if (eff.id === 'damage') {
      dealDamage(target, eff.amount, events);
    } else if (eff.id === 'heal') {
      if (target === side) {
        target.hp = Math.min(D.HERO_MAX_HP, target.hp + eff.amount);
      } else if (target && target.isMinion) {
        target.hp = Math.min(target.maxHp, target.hp + eff.amount);
      }
      if (events) {
        events.push({ type: 'heal', target: target, amount: eff.amount });
      }
    } else if (eff.id === 'draw') {
      drawCard(side, events);
    } else if (eff.id === 'buff') {
      if (target && target.isMinion) {
        target.atk += eff.amount;
        target.hp += eff.amount;
        target.maxHp += eff.amount;
        if (events) {
          events.push({ type: 'buff', target: target, amount: eff.amount });
        }
      }
    }
    cleanupBoard(state, foe, events);
    checkOver(state, events);
  }

  function playCard(state, card, placement, events) {
    if (state.over) {
      return { ok: false, reason: 'over' };
    }
    if (!canPlayCard(state, card)) {
      return { ok: false, reason: card.locked ? 'locked' : 'mana' };
    }
    var side = mySide(state);
    if (card.kind === 'minion') {
      var slot = placement && typeof placement.slot === 'number' ? placement.slot : -1;
      if (!isValidDrop(state, card, slot)) {
        return { ok: false, reason: 'slot' };
      }
      side.mana -= card.cost;
      side.hand.splice(side.hand.indexOf(card), 1);
      var minion = summonMinion(side, card, slot);
      if (events) {
        events.push({ type: 'summon', side: sideLabel(state, side), slot: slot, minion: minion });
      }
      if (card.ability === 'medic') {
        var restored = Math.min(2, D.HERO_MAX_HP - side.hp);
        side.hp += restored;
        minion.abilitySpent = true;
        if (events) {
          events.push({ type: 'heal', target: side, amount: restored, source: 'medic' });
        }
      }
      return { ok: true, minion: minion };
    }
    var target = placement ? placement.target : null;
    if (!isValidSpellDrop(state, card, target)) {
      return { ok: false, reason: 'target' };
    }
    side.mana -= card.cost;
    side.hand.splice(side.hand.indexOf(card), 1);
    if (events) {
      var targetSide = target === state.player || isOnBoard(state.player, target) ? state.player : state.ai;
      events.push({
        type: 'spell',
        side: sideLabel(state, side),
        card: card,
        target: target,
        targetSide: target ? sideLabel(state, targetSide) : null,
        targetSlot: target && target.isMinion ? targetSide.board.indexOf(target) : null
      });
    }
    applyEffect(state, side, card.effect, target, events);
    return { ok: true };
  }

  function canAttack(state, minion) {
    if (state.over) {
      return false;
    }
    if (!isOnBoard(mySide(state), minion)) {
      return false;
    }
    return minion.ready && !minion.attacked && minion.atk > 0 && validAttackTargets(state, minion).length > 0;
  }

  function validAttackTargets(state, attacker) {
    var foe = foeSide(state);
    var rushOnly = attacker && attacker.ability === 'rush' && attacker.justPlayed;
    var list = rushOnly ? [] : [foe];
    for (var i = 0; i < foe.board.length; i += 1) {
      if (foe.board[i]) {
        list.push(foe.board[i]);
      }
    }
    return list;
  }

  function attack(state, attacker, target, events) {
    if (state.over) {
      return { ok: false, reason: 'over' };
    }
    if (!canAttack(state, attacker)) {
      return { ok: false, reason: 'not-ready' };
    }
    if (validAttackTargets(state, attacker).indexOf(target) === -1) {
      return { ok: false, reason: 'target' };
    }
    var side = mySide(state);
    var foe = foeSide(state);
    attacker.attacked = true;
    if (events) {
      events.push({ type: 'attack-start', attacker: attacker, target: target });
    }
    dealDamage(target, attacker.atk, events);
    if (target !== foe) {
      dealDamage(attacker, target.atk, events);
    }
    cleanupBoard(state, side, events);
    cleanupBoard(state, foe, events);
    checkOver(state, events);
    if (events) {
      events.push({ type: 'attack-end', attacker: attacker, target: target });
    }
    return { ok: true };
  }

  function canUsePower(state) {
    if (state.over) {
      return false;
    }
    var side = mySide(state);
    return !side.powerUsed && side.mana >= side.power.mana;
  }

  function powerTargetValid(state, target) {
    var spec = D.POWERS[mySide(state).power.id];
    var side = mySide(state);
    var foe = foeSide(state);
    if (spec.target === 'none') {
      return target === null;
    }
    if (spec.target === 'enemy-any') {
      return target === foe || isOnBoard(foe, target);
    }
    if (spec.target === 'own-minion') {
      return isOnBoard(side, target);
    }
    return false;
  }

  function usePower(state, target, events) {
    if (!canUsePower(state)) {
      return { ok: false, reason: 'power' };
    }
    if (!powerTargetValid(state, target)) {
      return { ok: false, reason: 'target' };
    }
    var side = mySide(state);
    var foe = foeSide(state);
    side.mana -= side.power.mana;
    side.powerUsed = true;
    if (side.power.id === 'heal') {
      side.hp = Math.min(D.HERO_MAX_HP, side.hp + 3);
      if (events) {
        events.push({ type: 'heal', target: side, amount: 3 });
      }
    } else if (side.power.id === 'bolt') {
      dealDamage(target, 2, events);
      cleanupBoard(state, foe, events);
      checkOver(state, events);
    } else if (side.power.id === 'buff') {
      target.atk += 1;
      target.hp += 1;
      target.maxHp += 1;
      if (events) {
        events.push({ type: 'buff', target: target, amount: 1 });
      }
    } else if (side.power.id === 'shield') {
      side.shield = 3;
      if (events) {
        events.push({ type: 'shield', target: side, amount: 3 });
      }
    } else if (side.power.id === 'draw') {
      drawCard(side, events);
    }
    return { ok: true };
  }

  function endTurn(state, events) {
    if (state.over) {
      return null;
    }
    var next = state.turn === 'player' ? 'ai' : 'player';
    startTurn(state, next, events);
    return next;
  }

  function resolveAnswer(state, card, correct, events) {
    if (correct) {
      state.stats.correct += 1;
      state.stats.learned[card.wordId] = (state.stats.learned[card.wordId] || 0) + 1;
    } else {
      state.stats.wrong += 1;
      state.stats.mistakes[card.wordId] = (state.stats.mistakes[card.wordId] || 0) + 1;
      card.locked = true;
      if (events) {
        events.push({ type: 'card-locked', card: card });
      }
    }
    return correct;
  }

  function makeQuestion(card, rng) {
    var random = rng || Math.random;
    var mode = random() < 0.5 ? 'ru' : 'pinyin';
    var correctWord = null;
    for (var i = 0; i < D.WORDS.length; i += 1) {
      if (D.WORDS[i].id === card.wordId) {
        correctWord = D.WORDS[i];
        break;
      }
    }
    if (!correctWord) {
      throw new Error('engine: unknown word for card');
    }
    var field = mode === 'ru' ? 'ru' : 'pinyin';
    var pool = shuffle(D.WORDS.filter(function (w) { return w.id !== correctWord.id; }), random);
    var used = Object.create(null);
    used[correctWord[field]] = true;
    var distractors = [];
    for (var p = 0; p < pool.length && distractors.length < 3; p += 1) {
      var val = pool[p][field];
      if (!used[val]) {
        used[val] = true;
        distractors.push(val);
      }
    }
    if (distractors.length < 3) {
      throw new Error('engine: not enough distractors');
    }
    var options = shuffle(distractors.concat([correctWord[field]]), random);
    return {
      mode: mode,
      hanzi: correctWord.hanzi,
      field: field,
      correct: correctWord[field],
      options: options,
      note: correctWord.note,
      pinyin: correctWord.pinyin,
      ru: correctWord.ru
    };
  }

  function firstFreeSlot(side) {
    for (var i = 0; i < side.board.length; i += 1) {
      if (!side.board[i]) {
        return i;
      }
    }
    return -1;
  }

  function pickDamageTarget(state, amount) {
    var foe = state.player;
    if (foe.hp <= amount) {
      return foe;
    }
    var best = null;
    var bestAtk = 0;
    for (var i = 0; i < foe.board.length; i += 1) {
      var m = foe.board[i];
      if (m && !m.barrierActive && m.hp <= amount && m.atk > bestAtk) {
        best = m;
        bestAtk = m.atk;
      }
    }
    return best || foe;
  }

  function chooseTrade(state, attacker) {
    var foe = state.player;
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < foe.board.length; i += 1) {
      var m = foe.board[i];
      if (!m) {
        continue;
      }
      if ((attacker.barrierActive || attacker.hp > m.atk) && !m.barrierActive && attacker.atk >= m.hp) {
        var score = m.atk * 2 + m.hp;
        if (score > bestScore) {
          bestScore = score;
          best = m;
        }
      }
    }
    return best;
  }

  var AI = {
    takeTurn: function (state, events) {
      if (state.over || state.turn !== 'ai') {
        return;
      }
      var side = state.ai;
      var i;
      var guard = 0;
      var played = true;
      while (played && !state.over && guard < 30) {
        guard += 1;
        played = false;
        var bestCard = null;
        var bestScore = 0.5;
        var bestPlacement = null;
        for (i = 0; i < side.hand.length; i += 1) {
          var card = side.hand[i];
          if (card.cost > side.mana || card.locked) {
            continue;
          }
          if (card.kind === 'minion') {
            var slot = firstFreeSlot(side);
            if (slot === -1) {
              continue;
            }
            var score = card.minionAtk + card.minionHp + 1;
            if (card.ability === 'barrier') {
              score += 1.5;
            } else if (card.ability === 'medic') {
              score += Math.min(2, D.HERO_MAX_HP - side.hp);
            } else if (card.ability === 'rush' && state.player.board.some(function (m) { return !!m; })) {
              score += 1;
            }
            if (score > bestScore) {
              bestScore = score;
              bestCard = card;
              bestPlacement = { slot: slot };
            }
          } else if (card.effect) {
            var eff = card.effect;
            var escore = 0;
            var etarget = null;
            if (eff.id === 'damage') {
              etarget = pickDamageTarget(state, eff.amount);
              escore = eff.amount + 1;
            } else if (eff.id === 'draw') {
              escore = 1.5;
            } else if (eff.id === 'heal') {
              if (eff.target === 'own-hero') {
                etarget = side;
                escore = side.hp <= D.HERO_MAX_HP - eff.amount ? 2 : 0;
              } else {
                for (var b = 0; b < side.board.length; b += 1) {
                  var bm = side.board[b];
                  if (bm && bm.maxHp - bm.hp >= eff.amount && bm.atk >= 3) {
                    etarget = bm;
                    escore = 2;
                    break;
                  }
                }
              }
            } else if (eff.id === 'buff') {
              for (var b2 = 0; b2 < side.board.length; b2 += 1) {
                var bm2 = side.board[b2];
                if (bm2) {
                  etarget = bm2;
                  escore = 1.2;
                  break;
                }
              }
            }
            if (escore > bestScore) {
              bestScore = escore;
              bestCard = card;
              bestPlacement = { target: etarget };
            }
          }
        }
        if (bestCard && bestPlacement) {
          var res = playCard(state, bestCard, bestPlacement, events);
          played = res.ok;
        }
      }
      if (canUsePower(state)) {
        var spec = D.POWERS[side.power.id];
        var target = null;
        if (spec.target === 'enemy-any') {
          target = pickDamageTarget(state, 2);
        } else if (spec.target === 'own-minion') {
          for (i = 0; i < side.board.length; i += 1) {
            if (side.board[i]) {
              target = side.board[i];
              break;
            }
          }
        }
        var worth = true;
        if (side.power.id === 'heal' && side.hp > D.HERO_MAX_HP - 3) {
          worth = false;
        }
        if (side.power.id === 'buff' && !target) {
          worth = false;
        }
        if (worth && (spec.target === 'none' || target)) {
          usePower(state, target, events);
        }
      }
      var attackers = [];
      for (i = 0; i < side.board.length; i += 1) {
        var m = side.board[i];
        if (m && canAttack(state, m)) {
          attackers.push(m);
        }
      }
      for (var a = 0; a < attackers.length && !state.over; a += 1) {
        var atk = attackers[a];
        if (!isOnBoard(side, atk) || atk.attacked) {
          continue;
        }
        var targets = validAttackTargets(state, atk);
        var victim = chooseTrade(state, atk);
        if (!victim) {
          victim = targets.indexOf(state.player) !== -1 ? state.player : targets.slice().sort(function (a, b) {
            return (a.barrierActive ? 100 : a.hp) - (b.barrierActive ? 100 : b.hp);
          })[0];
        }
        if (victim) {
          attack(state, atk, victim, events);
        }
      }
    }
  };

  return {
    createMatch: createMatch,
    createDeck: createDeck,
    createRng: createRng,
    drawCard: drawCard,
    startTurn: startTurn,
    canPlayCard: canPlayCard,
    canAttack: canAttack,
    canUsePower: canUsePower,
    isValidDrop: isValidDrop,
    isValidSpellDrop: isValidSpellDrop,
    spellTargetValid: spellTargetValid,
    powerTargetValid: powerTargetValid,
    validAttackTargets: validAttackTargets,
    playCard: playCard,
    attack: attack,
    usePower: usePower,
    endTurn: endTurn,
    resolveAnswer: resolveAnswer,
    makeQuestion: makeQuestion,
    checkTime: checkTime,
    checkOver: checkOver,
    cleanupBoard: cleanupBoard,
    dealDamage: dealDamage,
    AI: AI
  };
}());
