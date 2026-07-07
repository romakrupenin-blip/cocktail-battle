import assert from 'node:assert';
import {
  defaultState, applyAction, canStart, allRatingsDone,
  missingRatingsCount, computeResults
} from '../src/shared.js';

let state = defaultState();
assert.strictEqual(state.participants.length, 3);
assert.strictEqual(canStart(state), false);

// fill 3 participants
state.participants.forEach((p, i) => {
  applyAction(state, { type: 'updateParticipant', id: p.id, field: 'name', value: 'Name' + i });
  applyAction(state, { type: 'updateParticipant', id: p.id, field: 'cocktail', value: 'Cocktail' + i });
});
assert.strictEqual(canStart(state), true);

applyAction(state, { type: 'startScoring' });
assert.strictEqual(state.view, 'scoring');
assert.strictEqual(allRatingsDone(state), false);

// try to jump to results too early -> must be rejected
applyAction(state, { type: 'goToResults' });
assert.strictEqual(state.view, 'scoring', 'должен остаться на scoring, пока не все оценки внесены');

// rate everything (each of 3 participants rated by 2 others = 6 ratings)
const ids = state.participants.map(p => p.id);
for (const authorId of ids) {
  for (const raterId of ids) {
    if (raterId === authorId) continue;
    applyAction(state, { type: 'setScore', raterId, authorId, value: 4 });
  }
}
assert.strictEqual(missingRatingsCount(state), 0);
assert.strictEqual(allRatingsDone(state), true);

applyAction(state, { type: 'goToResults' });
assert.strictEqual(state.view, 'results', 'теперь переход должен пройти');

const results = computeResults(state);
assert.strictEqual(results.length, 3);
assert.strictEqual(results[0].avg, 4);

// invalid score value must be rejected
const before = JSON.stringify(state.scores);
applyAction(state, { type: 'setScore', raterId: ids[0], authorId: ids[1], value: 99 });
assert.strictEqual(JSON.stringify(state.scores), before, 'некорректное значение оценки не должно применяться');

// self-rating must be rejected
applyAction(state, { type: 'setScore', raterId: ids[0], authorId: ids[0], value: 5 });
assert.strictEqual(state.scores[ids[0] + '_' + ids[0]], undefined, 'самооценка должна игнорироваться');

// newParty resets but keeps incrementing ids (no collisions)
const oldNextId = state.nextId;
applyAction(state, { type: 'newParty' });
assert.strictEqual(state.view, 'setup');
assert.strictEqual(state.participants.length, 3);
assert.strictEqual(state.participants[0].id, 'p' + oldNextId);
assert.deepStrictEqual(state.scores, {});
assert.strictEqual(canStart(state), false);

console.log('OK: все проверки shared.js прошли успешно');
