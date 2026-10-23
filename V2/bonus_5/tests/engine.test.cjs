'use strict';

const test = require('node:test');
const assert = require('node:assert');

global.window = global;
require('../data.js');
require('../engine.js');

const D = window.TAVERN_DATA;
const E = window.TAVERN_ENGINE;

const USER_WORDS = ['自', '相', '目', '的', '白', '用心', '用品', '用', '林', '术', '木', '朋', '有用', '有名', '有', '月日', '月', '明白', '明月', '明', '日用品', '日用', '日月', '日', '想', '息', '必', '心', '夕', '品', '名人', '名', '右', '口', '勺', '众人', '众', '人心', '人品', '人口', '人', '中心', '中'];

function makeMatch() {
  const rng = E.createRng(20261011);
  const state = E.createMatch('wizard', 'raccoon', rng, 1000);
  return state;
}

function putMinion(side, slot, atk, hp, ready) {
  const m = {
    isMinion: true,
    uid: 'test-' + side.heroId + '-' + slot + '-' + Math.random().toString(36).slice(2),
    card: null,
    atk,
    hp,
    maxHp: hp,
    ready: !!ready,
    attacked: false,
    justPlayed: false
  };
  side.board[slot] = m;
  return m;
}

test('словарь совпадает с пользовательским списком', () => {
  assert.strictEqual(D.WORDS.length, USER_WORDS.length);
  const hanzi = D.WORDS.map((w) => w.hanzi);
  for (const word of USER_WORDS) {
    assert.ok(hanzi.includes(word), 'отсутствует: ' + word);
  }
  assert.strictEqual(new Set(D.WORDS.map((w) => w.id)).size, D.WORDS.length, 'id уникальны');
  assert.strictEqual(new Set(hanzi).size, hanzi.length, 'иероглифы уникальны');
});

test('согласованные значения редких записей', () => {
  const byHanzi = Object.fromEntries(D.WORDS.map((w) => [w.hanzi, w]));
  assert.strictEqual(byHanzi['相'].pinyin, 'xiāng');
  assert.ok(byHanzi['相'].ru.includes('взаимно'));
  assert.strictEqual(byHanzi['的'].pinyin, 'de');
  assert.strictEqual(byHanzi['术'].pinyin, 'shù');
  assert.strictEqual(byHanzi['朋'].pinyin, 'péng');
  assert.strictEqual(byHanzi['月日'].pinyin, 'yuè rì');
  assert.strictEqual(byHanzi['明白'].pinyin, 'míngbai');
});

test('колода: две трети бойцов, треть эффектов', () => {
  const rng = E.createRng(42);
  const deck = E.createDeck(rng);
  assert.strictEqual(deck.length, USER_WORDS.length);
  const minions = deck.filter((c) => c.kind === 'minion').length;
  const spells = deck.filter((c) => c.kind === 'spell').length;
  assert.strictEqual(minions, 29);
  assert.strictEqual(spells, 14);
});

test('вопрос всегда имеет четыре уникальных варианта и один верный', () => {
  const rng = E.createRng(7);
  for (const word of D.WORDS) {
    for (const mode of ['ru', 'pinyin']) {
      const card = { wordId: word.id };
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const q = E.makeQuestion(card, rng);
        assert.ok(['ru', 'pinyin'].includes(q.mode));
        assert.strictEqual(q.options.length, 4, word.hanzi + ' ' + q.mode);
        assert.strictEqual(new Set(q.options).size, 4, 'дубликаты вариантов для ' + word.hanzi);
        const hits = q.options.filter((o) => o === q.correct).length;
        assert.strictEqual(hits, 1, 'верный вариант встречается один раз');
        if (q.mode === 'ru') {
          assert.strictEqual(q.correct, word.ru);
        } else {
          assert.strictEqual(q.correct, word.pinyin);
        }
      }
    }
  }
});

test('начальное состояние матча', () => {
  const s = makeMatch();
  assert.strictEqual(s.turn, 'player');
  assert.strictEqual(s.player.hp, 30);
  assert.strictEqual(s.ai.hp, 30);
  assert.strictEqual(s.player.mana, 1);
  assert.strictEqual(s.player.maxMana, 1);
  assert.strictEqual(s.player.hand.length, D.START_HAND_SIZE + 1);
  assert.strictEqual(s.ai.hand.length, D.START_HAND_SIZE);
  assert.strictEqual(s.deadline, 1000 + D.MATCH_MS);
  assert.strictEqual(s.player.board.filter(Boolean).length, 0);
  assert.strictEqual(s.ai.board.filter(Boolean).length, 0);
});

test('мана растёт до 10 и восстанавливается', () => {
  const s = makeMatch();
  s.player.mana = 0;
  E.endTurn(s, []);
  E.endTurn(s, []);
  assert.strictEqual(s.player.maxMana, 2);
  assert.strictEqual(s.player.mana, 2);
  for (let i = 0; i < 20; i += 1) {
    E.endTurn(s, []);
    E.endTurn(s, []);
  }
  assert.strictEqual(s.player.maxMana, 10);
  assert.strictEqual(s.player.mana, 10);
});

test('ошибка не списывает ману и блокирует карту до следующего хода', () => {
  const s = makeMatch();
  const card = s.player.hand[0];
  card.cost = 1;
  const manaBefore = s.player.mana;
  const events = [];
  assert.strictEqual(E.resolveAnswer(s, card, false, events), false);
  assert.ok(card.locked);
  assert.strictEqual(s.player.mana, manaBefore);
  assert.ok(events.some((e) => e.type === 'card-locked'));
  assert.strictEqual(s.stats.wrong, 1);
  assert.ok(E.playCard(s, card, { slot: 0 }, []).ok === false);
  E.endTurn(s, []);
  E.endTurn(s, []);
  assert.strictEqual(card.locked, false);
});

test('правильный ответ учитывается в статистике', () => {
  const s = makeMatch();
  const card = s.player.hand[0];
  E.resolveAnswer(s, card, true, []);
  assert.strictEqual(s.stats.correct, 1);
  assert.strictEqual(s.stats.learned[card.wordId], 1);
});

test('розыгрыш бойца: только в свободную ячейку своей половины', () => {
  const s = makeMatch();
  s.player.mana = 5;
  const card = s.player.hand[0];
  card.kind = 'minion';
  card.cost = 1;
  card.minionAtk = 2;
  card.minionHp = 3;
  card.locked = false;
  assert.strictEqual(E.isValidDrop(s, card, 0), true);
  assert.strictEqual(E.isValidDrop(s, card, 9), false);
  assert.strictEqual(E.isValidDrop(s, card, -1), false);
  const r = E.playCard(s, card, { slot: 0 }, []);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.player.board[0].atk, 2);
  assert.strictEqual(s.player.board[0].hp, 3);
  const second = s.player.hand[0];
  second.kind = 'minion';
  second.cost = 1;
  second.locked = false;
  assert.strictEqual(E.isValidDrop(s, second, 0), false, 'ячейка занята');
  assert.strictEqual(E.isValidDrop(s, second, 1), true);
  assert.strictEqual(s.player.mana, 4, 'мана списана за разыгранную карту');
});

test('недостаточно маны запрещает розыгрыш', () => {
  const s = makeMatch();
  const card = s.player.hand[0];
  card.cost = 5;
  card.locked = false;
  assert.strictEqual(E.canPlayCard(s, card), false);
  assert.strictEqual(E.playCard(s, card, { slot: 1 }, []).ok, false);
});

test('боец не атакует в тот же ход и атакует со следующего', () => {
  const s = makeMatch();
  const m = putMinion(s.player, 2, 3, 3, false);
  putMinion(s.ai, 2, 2, 2, false);
  assert.strictEqual(E.canAttack(s, m), false);
  E.endTurn(s, []);
  E.endTurn(s, []);
  assert.strictEqual(E.canAttack(s, m), true);
});

test('атака по бойцу наносит ответный урон одновременно', () => {
  const s = makeMatch();
  const mine = putMinion(s.player, 1, 4, 4, true);
  const foe = putMinion(s.ai, 1, 3, 2, true);
  const events = [];
  const r = E.attack(s, mine, foe, events);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(mine.hp, 1);
  assert.strictEqual(s.ai.board[1], null);
  assert.ok(events.some((e) => e.type === 'attack-start'));
  assert.ok(events.some((e) => e.type === 'death'));
  assert.strictEqual(E.canAttack(s, mine), false, 'одна атака за ход');
});

test('атака по герою и победа', () => {
  const s = makeMatch();
  const mine = putMinion(s.player, 0, 6, 6, true);
  s.ai.hp = 5;
  const r = E.attack(s, mine, s.ai, []);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.over, true);
  assert.strictEqual(s.result, 'player');
  assert.strictEqual(s.resultReason, 'hp');
});

test('одновременная гибель героев даёт ничью', () => {
  const s = makeMatch();
  s.player.hp = 2;
  s.ai.hp = 2;
  E.dealDamage(s.player, 5, []);
  E.dealDamage(s.ai, 5, []);
  E.checkOver(s, []);
  assert.strictEqual(s.result, 'draw');
});

test('заклинания требуют допустимую цель', () => {
  const s = makeMatch();
  const foeMinion = putMinion(s.ai, 0, 2, 2, false);
  const cases = [
    { effect: { id: 'damage', amount: 2, target: 'enemy-any' } },
    { effect: { id: 'heal', amount: 4, target: 'own-minion' } },
    { effect: { id: 'heal', amount: 3, target: 'own-hero' } },
    { effect: { id: 'draw', amount: 1, target: 'none' } },
    { effect: { id: 'buff', amount: 1, target: 'own-minion' } }
  ];
  for (const c of cases) {
    const card = s.player.hand[0];
    card.kind = 'spell';
    card.cost = 1;
    card.locked = false;
    card.effect = c.effect;
    const mine = putMinion(s.player, 4, 2, 2, false);
    if (c.effect.target === 'none') {
      assert.strictEqual(E.isValidSpellDrop(s, card, null), true);
      assert.strictEqual(E.isValidSpellDrop(s, card, foeMinion), false);
    } else if (c.effect.target === 'own-hero') {
      assert.strictEqual(E.isValidSpellDrop(s, card, s.player), true);
      assert.strictEqual(E.isValidSpellDrop(s, card, foeMinion), false);
    } else if (c.effect.target === 'enemy-any') {
      assert.strictEqual(E.isValidSpellDrop(s, card, foeMinion), true);
      assert.strictEqual(E.isValidSpellDrop(s, card, s.ai), true);
      assert.strictEqual(E.isValidSpellDrop(s, card, s.player), false);
    } else {
      assert.strictEqual(E.isValidSpellDrop(s, card, mine), true);
      assert.strictEqual(E.isValidSpellDrop(s, card, foeMinion), false);
    }
  }
});

test('усталость растёт при пустой колоде', () => {
  const s = makeMatch();
  s.player.deck = [];
  s.player.fatigue = 0;
  const hp = s.player.hp;
  E.drawCard(s.player, []);
  assert.strictEqual(s.player.fatigue, 1);
  assert.strictEqual(s.player.hp, hp - 1);
  E.drawCard(s.player, []);
  assert.strictEqual(s.player.fatigue, 2);
  assert.strictEqual(s.player.hp, hp - 3);
});

test('переполнение руки сжигает добор', () => {
  const s = makeMatch();
  while (s.player.hand.length < D.HAND_LIMIT) {
    s.player.hand.push({ uid: 'fill' + s.player.hand.length, kind: 'spell', cost: 9 });
  }
  assert.strictEqual(s.player.hand.length, D.HAND_LIMIT);
  const before = s.player.hand.length;
  const drew = E.drawCard(s.player, []);
  assert.strictEqual(drew, null);
  assert.strictEqual(s.player.hand.length, before);
});

test('силы героев работают по правилам', () => {
  const s1 = makeMatch();
  s1.player.power = D.PLAYERS.find((p) => p.id === 'cinnabon').power;
  s1.player.mana = 5;
  s1.player.hp = 10;
  assert.strictEqual(E.usePower(s1, null, []).ok, true);
  assert.strictEqual(s1.player.hp, 13);
  assert.strictEqual(E.canUsePower(s1), false, 'раз за ход');
  s1.player.hp = 29;
  s1.player.powerUsed = false;
  E.usePower(s1, null, []);
  assert.strictEqual(s1.player.hp, 30, 'лечение не выше 30');

  const s2 = makeMatch();
  s2.player.power = D.PLAYERS.find((p) => p.id === 'robot').power;
  s2.player.mana = 5;
  E.usePower(s2, null, []);
  assert.strictEqual(s2.player.shield, 3);
  E.dealDamage(s2.player, 2, []);
  assert.strictEqual(s2.player.hp, 30, 'щит поглощает урон');
  assert.strictEqual(s2.player.shield, 1);
  s2.player.powerUsed = false;
  E.usePower(s2, null, []);
  assert.strictEqual(s2.player.shield, 3, 'щит не суммируется');
  E.endTurn(s2, []);
  assert.strictEqual(s2.player.shield, 3, 'щит держится пока не начнётся свой ход');
  E.endTurn(s2, []);
  assert.strictEqual(s2.turn, 'player');
  assert.strictEqual(s2.player.shield, 0, 'щит сбрасывается в начале своего хода');

  const s3 = makeMatch();
  s3.player.power = D.PLAYERS.find((p) => p.id === 'wizard').power;
  s3.player.mana = 5;
  const foeM = putMinion(s3.ai, 0, 2, 2, false);
  assert.strictEqual(E.usePower(s3, foeM, []).ok, true);
  assert.strictEqual(foeM.hp, 0);

  const s4 = makeMatch();
  s4.player.power = D.PLAYERS.find((p) => p.id === 'zhabert').power;
  s4.player.mana = 5;
  const mine = putMinion(s4.player, 0, 2, 2, false);
  assert.strictEqual(E.usePower(s4, mine, []).ok, true);
  assert.strictEqual(mine.atk, 3);
  assert.strictEqual(mine.hp, 3);
  assert.strictEqual(mine.maxHp, 3);

  const s5 = makeMatch();
  s5.player.power = D.PLAYERS.find((p) => p.id === 'raccoon').power;
  s5.player.mana = 5;
  const handBefore = s5.player.hand.length;
  assert.strictEqual(E.usePower(s5, null, []).ok, true);
  assert.strictEqual(s5.player.hand.length, handBefore + 1);
  assert.strictEqual(s5.player.mana, 3, 'сила стоит 2 маны');
});

test('лимит времени завершает матч по HP', () => {
  const s = makeMatch();
  s.player.hp = 25;
  s.ai.hp = 20;
  assert.strictEqual(E.checkTime(s, s.deadline - 1, []), false);
  assert.strictEqual(E.checkTime(s, s.deadline, []).ok === undefined, true);
  assert.strictEqual(s.over, true);
  assert.strictEqual(s.result, 'player');
  assert.strictEqual(s.resultReason, 'time');

  const s2 = makeMatch();
  E.checkTime(s2, s2.deadline + 5000, []);
  assert.strictEqual(s2.result, 'draw');
});

test('ход ИИ соблюдает правила и передаёт ход', () => {
  const s = makeMatch();
  E.endTurn(s, []);
  assert.strictEqual(s.turn, 'ai');
  assert.strictEqual(s.ai.mana, 1, 'первый ход ИИ — 1 мана');
  const events = [];
  E.AI.takeTurn(s, events);
  assert.ok(!s.over);
  const next = E.endTurn(s, events);
  assert.strictEqual(next, 'player');
  assert.strictEqual(s.player.maxMana, 2);
  assert.strictEqual(s.player.mana, 2);
});

test('ИИ не действует вне своего хода и после конца матча', () => {
  const s = makeMatch();
  E.AI.takeTurn(s, []);
  assert.strictEqual(s.turn, 'player');
  s.over = true;
  E.AI.takeTurn(s, []);
});

test('полный матч ИИ против ИИ завершается без ошибок', () => {
  const rng = E.createRng(2026);
  const s = E.createMatch('raccoon', 'zhabert', rng, 0);
  let guard = 0;
  while (!s.over && guard < 400) {
    guard += 1;
    if (s.turn === 'ai') {
      E.AI.takeTurn(s, []);
    } else {
      const side = s.player;
      for (let i = 0; i < side.hand.length; i += 1) {
        const card = side.hand[i];
        if (card.cost > side.mana || card.locked) {
          continue;
        }
        if (card.kind === 'minion') {
          const slot = side.board.findIndex((b) => !b);
          if (slot !== -1) {
            E.resolveAnswer(s, card, true, []);
            E.playCard(s, card, { slot }, []);
          }
        } else if (card.effect && card.effect.target === 'none') {
          E.resolveAnswer(s, card, true, []);
          E.playCard(s, card, { target: null }, []);
        } else if (card.effect && card.effect.target === 'enemy-any') {
          E.resolveAnswer(s, card, true, []);
          E.playCard(s, card, { target: s.ai }, []);
        }
      }
      for (let i = 0; i < side.board.length; i += 1) {
        const m = side.board[i];
        if (m && E.canAttack(s, m)) {
          E.attack(s, m, s.ai, []);
        }
      }
    }
    E.endTurn(s, []);
    E.checkTime(s, guard * 1000, []);
  }
  assert.ok(s.over, 'матч завершился');
  assert.ok(['player', 'ai', 'draw'].includes(s.result));
});

function abilityCard(state, ability, side = state.player) {
  const card = E.createDeck(E.createRng(57)).find(c => c.ability === ability);
  side.hand = [card];
  side.mana = 10;
  return card;
}

function abilityMinion(state, ability, side = state.player, slot = 0) {
  const card = abilityCard(state, ability, side);
  return E.playCard(state, card, { slot }, []).minion;
}

test('колоды гарантируют три способности и неизменный учебный набор', () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const deck = E.createDeck(E.createRng(seed));
    assert.strictEqual(deck.length, 43);
    assert.strictEqual(new Set(deck.map(c => c.wordId)).size, 43);
    assert.strictEqual(deck.filter(c => c.kind === 'minion').length, 29);
    for (const ability of Object.keys(D.ABILITIES)) {
      assert.strictEqual(deck.filter(c => c.ability === ability).length, 3);
    }
    for (const card of deck) {
      assert.ok(card.cost >= 0 && card.cost <= 5);
      if (card.ability) {
        assert.strictEqual(typeof card.ability, 'string');
        assert.strictEqual(card.kind, 'minion');
        const template = D.MINION_TEMPLATES.find(t => t.ability === card.ability);
        assert.strictEqual(card.minionAtk, template.atk);
        assert.strictEqual(card.minionHp, template.hp);
        assert.strictEqual(card.cost, template.cost);
      }
    }
  }
});

test('щит поглощает всё первое попадание, но не нулевой урон', () => {
  const s = makeMatch();
  const m = abilityMinion(s, 'barrier');
  const events = [];
  const hp = m.hp;
  assert.strictEqual(E.dealDamage(m, 0, events), 0);
  assert.strictEqual(m.barrierActive, true);
  assert.strictEqual(E.dealDamage(m, 99, events), 0);
  assert.strictEqual(m.hp, hp);
  assert.strictEqual(m.barrierActive, false);
  assert.strictEqual(events.filter(e => e.type === 'barrier-break').length, 1);
  E.dealDamage(m, 1, events);
  assert.strictEqual(m.hp, hp - 1);
  E.endTurn(s, []);
  E.endTurn(s, []);
  assert.strictEqual(m.barrierActive, false, 'щит не возвращается каждый ход');
});

test('щит при защите не отменяет ответный урон', () => {
  const s = makeMatch();
  const shield = abilityMinion(s, 'barrier');
  s.turn = 'ai';
  const attacker = putMinion(s.ai, 0, 5, 5, true);
  assert.strictEqual(E.attack(s, attacker, shield, []).ok, true);
  assert.strictEqual(shield.hp, 2);
  assert.strictEqual(attacker.hp, 4);
});

test('щит поглощает ответный урон, заклинание и силу Волшебника', () => {
  const s = makeMatch();
  const shield = abilityMinion(s, 'barrier');
  shield.ready = true;
  const foe = putMinion(s.ai, 0, 5, 5, true);
  assert.strictEqual(E.attack(s, shield, foe, []).ok, true);
  assert.strictEqual(shield.hp, 2);
  assert.strictEqual(foe.hp, 4);
  s.turn = 'ai';
  shield.barrierActive = true;
  const spell = E.createDeck(E.createRng(7)).find(c => c.effect && c.effect.id === 'damage');
  s.ai.hand = [spell];
  s.ai.mana = 10;
  E.playCard(s, spell, { target: shield }, []);
  assert.strictEqual(shield.hp, 2);
  assert.strictEqual(shield.barrierActive, false);
  shield.barrierActive = true;
  s.ai.power = D.PLAYERS.find(p => p.id === 'wizard').power;
  E.usePower(s, shield, []);
  assert.strictEqual(shield.hp, 2);
  assert.strictEqual(shield.barrierActive, false);
});

test('натиск разрешает только бойца в ход появления и один удар', () => {
  const s = makeMatch();
  const rush = abilityMinion(s, 'rush');
  assert.strictEqual(E.canAttack(s, rush), false, 'без бойцов нет цели натиска');
  const target = putMinion(s.ai, 0, 1, 5, true);
  assert.strictEqual(E.canAttack(s, rush), true);
  assert.deepStrictEqual(E.validAttackTargets(s, rush), [target]);
  assert.strictEqual(E.attack(s, rush, s.ai, []).ok, false);
  assert.strictEqual(rush.attacked, false);
  assert.strictEqual(E.attack(s, rush, target, []).ok, true);
  assert.strictEqual(E.attack(s, rush, target, []).ok, false);
  E.endTurn(s, []);
  E.endTurn(s, []);
  assert.strictEqual(rush.justPlayed, false);
  assert.strictEqual(E.attack(s, rush, s.ai, []).ok, true);
  assert.strictEqual(s.ai.hp, 27);
});

test('лекарь лечит ровно при успешном появлении и не выше 30', () => {
  for (const hp of [20, 29, 30]) {
    const s = makeMatch();
    const card = abilityCard(s, 'medic');
    s.player.hp = hp;
    assert.strictEqual(s.player.hp, hp, 'добор не лечит');
    assert.strictEqual(E.playCard(s, card, { slot: 9 }, []).ok, false);
    assert.strictEqual(s.player.hp, hp, 'невалидный розыгрыш не лечит');
    const events = [];
    E.resolveAnswer(s, card, true, []);
    assert.strictEqual(s.player.hp, hp, 'ответ ещё не лечит');
    const m = E.playCard(s, card, { slot: 0 }, events).minion;
    assert.strictEqual(s.player.hp, Math.min(30, hp + 2));
    assert.strictEqual(m.abilitySpent, true);
    assert.strictEqual(events.find(e => e.source === 'medic').amount, Math.min(2, 30 - hp));
    assert.strictEqual(E.playCard(s, card, { slot: 1 }, []).ok, false);
    E.endTurn(s, []);
    E.endTurn(s, []);
    assert.strictEqual(s.player.hp, Math.min(30, hp + 2));
  }
});

test('ошибка и отмена не активируют лекаря', () => {
  const s = makeMatch();
  const card = abilityCard(s, 'medic');
  s.player.hp = 21;
  assert.strictEqual(E.isValidDrop(s, card, 0), true);
  assert.strictEqual(s.player.hp, 21, 'предпросмотр и отмена не лечат');
  E.resolveAnswer(s, card, false, []);
  assert.strictEqual(E.playCard(s, card, { slot: 0 }, []).ok, false);
  assert.strictEqual(s.player.hp, 21);
  assert.strictEqual(s.player.mana, 10);
  assert.strictEqual(s.player.board[0], null);
});

test('ИИ использует натиск по бойцу, но не бьёт героя в ход появления', () => {
  const s = makeMatch();
  s.turn = 'ai';
  const card = abilityCard(s, 'rush', s.ai);
  const target = putMinion(s.player, 0, 1, 2, false);
  const events = [];
  E.AI.takeTurn(s, events);
  assert.strictEqual(s.player.hp, 30);
  assert.strictEqual(target.hp, -1);
  assert.strictEqual(s.ai.board[0].card, card);
  assert.strictEqual(s.ai.board[0].attacked, true);
  const s2 = makeMatch();
  s2.turn = 'ai';
  abilityCard(s2, 'rush', s2.ai);
  E.AI.takeTurn(s2, []);
  assert.strictEqual(s2.player.hp, 30);
  assert.strictEqual(s2.ai.board[0].attacked, false);
});

test('ИИ не считает пробитый щит убийством и лечит только свою сторону', () => {
  const s = makeMatch();
  const shield = abilityMinion(s, 'barrier');
  s.turn = 'ai';
  s.ai.hand = [];
  s.ai.mana = 0;
  const attacker = putMinion(s.ai, 0, 2, 5, true);
  E.AI.takeTurn(s, []);
  assert.strictEqual(shield.barrierActive, true, 'обычный атакующий предпочёл героя ложному убийству');
  assert.strictEqual(attacker.hp, 5);
  assert.strictEqual(s.player.hp, 28);
  s.ai.hp = 20;
  abilityCard(s, 'medic', s.ai);
  E.AI.takeTurn(s, []);
  assert.strictEqual(s.ai.hp, 22);
  assert.strictEqual(s.player.hp, 28);
});

test('после окончания матча новые умения не срабатывают', () => {
  const s = makeMatch();
  const card = abilityCard(s, 'medic');
  s.player.hp = 15;
  s.over = true;
  assert.strictEqual(E.playCard(s, card, { slot: 0 }, []).ok, false);
  assert.strictEqual(s.player.hp, 15);
  const s2 = makeMatch();
  const rush = abilityMinion(s2, 'rush');
  const target = putMinion(s2.ai, 0, 1, 5, true);
  s2.over = true;
  assert.strictEqual(E.attack(s2, rush, target, []).ok, false);
  assert.strictEqual(target.hp, 5);
});

test('заклинание сохраняет сторону и ячейку погибшей цели для анимации', () => {
  for (const who of ['player', 'ai']) {
    const s = makeMatch();
    s.turn = who;
    const caster = s[who];
    const targetSide = who === 'player' ? 'ai' : 'player';
    const target = putMinion(s[targetSide], 3, 1, 1, false);
    const spell = E.createDeck(E.createRng(7)).find(c => c.effect && c.effect.id === 'damage');
    caster.hand = [spell];
    caster.mana = 10;
    const events = [];
    assert.strictEqual(E.playCard(s, spell, { target }, events).ok, true);
    const cast = events.find(e => e.type === 'spell');
    assert.strictEqual(cast.side, who);
    assert.strictEqual(cast.targetSide, targetSide);
    assert.strictEqual(cast.targetSlot, 3);
    assert.strictEqual(cast.target, target);
    assert.strictEqual(s[targetSide].board[3], null);
    assert.ok(events.indexOf(cast) < events.findIndex(e => e.type === 'damage'));
  }
});

test('заклинания по герою и без цели имеют правильные визуальные адреса', () => {
  const s = makeMatch();
  s.player.mana = 10;
  const deck = E.createDeck(E.createRng(7));
  for (const effect of ['damage', 'draw']) {
    const card = deck.find(c => c.effect && c.effect.id === effect);
    s.player.hand = [card];
    const target = effect === 'damage' ? s.ai : null;
    const events = [];
    assert.strictEqual(E.playCard(s, card, { target }, events).ok, true);
    const cast = events.find(e => e.type === 'spell');
    assert.strictEqual(cast.targetSide, target ? 'ai' : null);
    assert.strictEqual(cast.targetSlot, null);
  }
});
