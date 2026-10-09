"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./game-core.js");
const data = require("./data.js");
const fs = require("node:fs");
const path = require("node:path");

function next(state) { return core.dispatch(state, { type: "next" }); }
function expected(state) { return state.current.words.map(id => core.words[id].tone); }
function answer(state, tones = expected(state)) { return core.dispatch(state, { type: "answer", tones }); }
function finish(state, wrongIds = new Set()) {
  let safety = 0;
  while (state.phase !== "reward" && safety++ < 250) {
    if (state.phase === "question") {
      const tones = expected(state);
      if (!state.repeat && wrongIds.has(state.current.id)) tones[0] = state.current.options.find(t => t !== tones[0]);
      state = answer(state, tones);
    } else state = next(state);
  }
  assert.equal(state.phase, "reward");
  return state;
}

test("30 questions, balanced tones, deterministic seeds and unseen final vocabulary", () => {
  for (let seed = 0; seed < 100; seed++) {
    const state = core.create(seed);
    assert.deepEqual(state.decks.map(d => d.length), [8, 8, 6, 8]);
    assert.deepEqual(core.create(seed).decks, state.decks);
    for (const room of [0, 1, 3]) {
      const counts = [0, 0, 0, 0];
      state.decks[room].forEach(q => counts[core.words[q.words[0]].tone - 1]++);
      assert.deepEqual(counts, [2, 2, 2, 2]);
    }
    const early = new Set(state.decks.slice(0, 3).flat().flatMap(q => q.words));
    state.decks[3].forEach(q => assert.ok(!early.has(q.words[0])));
    const tones = state.decks[2].flatMap(q => q.words.map(id => core.words[id].tone));
    assert.deepEqual([1, 2, 3, 4].map(t => tones.filter(n => n === t).length), [3, 3, 3, 3]);
    for (const deck of state.decks) {
      const sequence = deck.map(q => core.words[q.words[0]].tone);
      for (let i = 2; i < sequence.length; i++) assert.ok(!(sequence[i] === sequence[i - 1] && sequence[i] === sequence[i - 2]));
    }
  }
});

test("code appears only after all rooms and all required answers", () => {
  let state = core.create(42);
  assert.equal(core.reward(state), null);
  state = finish(state);
  assert.equal(core.reward(state), "1234");
  assert.equal(state.firstAnswers, 30);
  assert.equal(state.firstCorrect, 30);
  assert.equal(state.repeats, 0);
  assert.deepEqual(state.completed, [0, 1, 2, 3]);
  assert.equal(state.mastered.length, 30);
  assert.equal(core.dispatch(state, { type: "next" }), state);
});

test("mistake returns after two other questions and must be mastered", () => {
  let state = next(core.create(7));
  const question = state.current.id;
  const wrong = state.current.options.find(t => t !== expected(state)[0]);
  state = answer(state, [wrong]);
  assert.equal(state.firstCorrect, 0);
  assert.equal(state.pending.length, 1);
  assert.ok(!state.mastered.includes(question));
  for (let i = 0; i < 2; i++) {
    state = next(state);
    assert.notEqual(state.current.id, question);
    state = answer(state);
  }
  state = next(state);
  assert.equal(state.current.id, question);
  assert.equal(state.repeat, true);
  const firstAnswers = state.firstAnswers;
  state = answer(state);
  assert.equal(state.firstAnswers, firstAnswers);
  assert.equal(state.repeats, 1);
  assert.ok(state.mastered.includes(question));
});

test("last question mistake blocks room completion until corrected", () => {
  let state = next(core.create(8));
  for (let i = 0; i < 7; i++) state = next(answer(state));
  const id = state.current.id;
  state = answer(state, [state.current.options.find(t => t !== expected(state)[0])]);
  state = next(state);
  assert.equal(state.phase, "question");
  assert.equal(state.current.id, id);
  assert.equal(state.completed.length, 0);
  state = next(answer(state));
  assert.equal(state.phase, "cleared");
  assert.deepEqual(state.completed, [0]);
  state = next(state);
  assert.equal(state.phase, "room");
  assert.equal(state.room, 1);
});

test("pair requires both correct tones and rejects incomplete answers", () => {
  let state = core.create(4);
  while (!(state.room === 2 && state.phase === "question")) {
    state = state.phase === "question" ? answer(state) : next(state);
  }
  assert.equal(state.current.words.length, 2);
  assert.equal(answer(state, [expected(state)[0]]), state);
  const tones = expected(state);
  tones[1] = tones[1] % 4 + 1;
  const wrong = answer(state, tones);
  assert.equal(wrong.feedback.correct, false);
  assert.equal(wrong.pending.length, 1);
});

test("duplicate answers and malformed actions cannot change statistics", () => {
  const state = next(core.create(1));
  for (const event of [null, [], {}, { type: "answer", tones: [0] }, { type: "answer", tones: ["1"] }, { type: "answer", tones: [1], extra: true }, { type: "next" }]) {
    assert.equal(core.dispatch(state, event), state);
  }
  const answered = answer(state);
  assert.equal(answer(answered, expected(state)), answered);
  assert.equal(answered.firstAnswers, 1);
  assert.equal(state.firstAnswers, 0);
});

test("saving and restoring replays valid progress including errors and feedback", () => {
  const done = finish(core.create(998), new Set(["0:0", "1:7", "2:2", "3:7"]));
  assert.equal(done.firstCorrect, 26);
  assert.equal(done.repeats, 4);
  assert.equal(core.reward(core.restore(core.serialize(done))), "1234");
  let state = core.create(24);
  for (let i = 0; i < 35; i++) {
    state = state.phase === "question" ? answer(state) : next(state);
    assert.deepEqual(core.restore(core.serialize(state)), state);
  }
});

test("reject corrupted, invalid and fabricated saves", () => {
  for (const text of ["", "null", "{", "{}", JSON.stringify({ version: 9, seed: 1, events: [] }), JSON.stringify({ version: 1, seed: -1, events: [] }), JSON.stringify({ version: 1, seed: 1.5, events: [] }), JSON.stringify({ version: 1, seed: 1, events: [{ type: "answer", tones: [1] }] }), JSON.stringify({ version: 1, seed: 1, events: [], phase: "reward" })]) {
    assert.equal(core.restore(text), null);
  }
});

test("shield depletes without defeat, restores and never exceeds limits", () => {
  let state = next(core.create(19));
  for (let i = 0; i < 5; i++) {
    const wrong = state.current.options.find(t => t !== expected(state)[0]);
    state = answer(state, [wrong]);
    assert.equal(state.shield, Math.max(0, 2 - i));
    assert.equal(state.streak, 0);
    assert.equal(core.battle(state).hp, 8);
    state = next(state);
    assert.equal(state.phase, "question");
  }
  state = answer(state);
  assert.equal(state.shield, 1);
  assert.equal(state.feedback.damage, 1);
  for (let i = 0; i < 4; i++) state = answer(next(state));
  assert.equal(state.shield, 3);
  assert.equal(state.streak, 5);
});

test("combo is visual only and damage tracks mastery once", () => {
  let state = next(core.create(12));
  for (let i = 1; i <= 3; i++) {
    state = answer(state);
    assert.equal(state.feedback.damage, 1);
    assert.equal(state.feedback.combo, i === 3);
    assert.equal(core.battle(state).hp, 8 - i);
    assert.equal(state.streak, i);
    if (i < 3) state = next(state);
  }
  assert.equal(state.bestStreak, 3);
  assert.equal(answer(state, [1]), state);
  state = next(state);
  state = answer(state, [state.current.options.find(t => t !== expected(state)[0])]);
  assert.equal(state.streak, 0);
  assert.equal(state.bestStreak, 3);
  assert.equal(state.feedback.damage, 0);
  assert.equal(core.battle(state).hp, 5);
});

test("new floor refills shield and resets only current streak", () => {
  let state = next(core.create(30));
  while (state.phase !== "cleared") state = state.phase === "question" ? answer(state) : next(state);
  assert.equal(core.battle(state).hp, 0);
  assert.equal(core.battle(state).defeated, true);
  assert.equal(state.bestStreak, 8);
  state = next(state);
  assert.equal(state.shield, 3);
  assert.equal(state.streak, 0);
  assert.equal(state.bestStreak, 8);
  assert.equal(core.battle(state).hp, 8);
});

test("wrong pair costs one shield, correct pair does one damage", () => {
  let state = core.create(9);
  while (!(state.room === 2 && state.phase === "question")) state = state.phase === "question" ? answer(state) : next(state);
  const tones = expected(state);
  tones[1] = tones[1] % 4 + 1;
  state = answer(state, tones);
  assert.equal(state.shield, 2);
  assert.equal(core.battle(state).hp, 6);
  assert.equal(state.feedback.damage, 0);
  state = answer(next(state));
  assert.equal(state.shield, 3);
  assert.equal(core.battle(state).hp, 5);
  assert.equal(state.feedback.damage, 1);
});

test("version-one saves reconstruct combat without new stored fields", () => {
  const oldJournal = JSON.stringify({ version: 1, seed: 42, events: [{ type: "next" }, { type: "answer", tones: [1] }] });
  const restored = core.restore(oldJournal);
  assert.ok(restored);
  assert.equal(restored.firstAnswers, 1);
  assert.equal(restored.shield, restored.feedback.correct ? 3 : 2);
  assert.equal(restored.streak, restored.feedback.correct ? 1 : 0);
  assert.equal(core.battle(restored).hp, restored.feedback.correct ? 7 : 8);
  assert.deepEqual(core.restore(core.serialize(restored)), restored);
});

test("wizard is the exact source artwork and all combat assets exist", () => {
  const source = fs.readFileSync(path.join(__dirname, "../assets/characters/wizard.svg"), "utf8").replace(/\r\n/g, "\n");
  const copy = fs.readFileSync(path.join(__dirname, "assets/wizard.svg"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(copy.trim(), source.trim());
  for (const room of data.rooms) assert.ok(fs.existsSync(path.join(__dirname, room.sprite)));
  for (const word of data.words) {
    assert.ok(fs.statSync(path.join(__dirname, word.audio)).size > 1000);
    assert.ok(fs.statSync(path.join(__dirname, word.slow)).size > 1000);
  }
});

test("vocabulary and audio paths are unique and well formed", () => {
  assert.equal(data.words.length, 24);
  assert.equal(new Set(data.words.map(w => w.id)).size, 24);
  assert.equal(new Set(data.words.map(w => w.hanzi)).size, 24);
  for (const word of data.words) {
    assert.match(word.audio, /^audio\/[a-z]+[1-4]\.mp3$/);
    assert.match(word.slow, /^audio\/[a-z]+[1-4]-slow\.mp3$/);
    assert.ok([1, 2, 3, 4].includes(word.tone));
    assert.equal(Array.from(word.hanzi).length, 1);
  }
});
