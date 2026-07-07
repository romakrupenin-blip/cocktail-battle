// Общая логика состояния вечеринки.
// Используется Durable Object как единственный источник правды —
// сервер сам проверяет допустимость действий, а не доверяет клиенту.

export function freshParticipants(count, startId) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({ id: 'p' + (startId + i), name: '', cocktail: '', photo: '' });
  }
  return arr;
}

export function defaultState() {
  const state = {
    partyName: '',
    participants: [],
    scores: {},
    view: 'setup',   // setup | scoring | results
    expanded: null,
    nextId: 1
  };
  state.participants = freshParticipants(3, state.nextId);
  state.nextId += 3;
  return state;
}

export function ratingsFor(state, authorId) {
  return state.participants
    .filter(p => p.id !== authorId)
    .map(rater => ({
      raterId: rater.id,
      raterName: rater.name,
      value: state.scores[rater.id + '_' + authorId] || 0
    }));
}

export function allRatingsDone(state) {
  if (state.participants.length < 3) return false;
  return state.participants.every(author =>
    ratingsFor(state, author.id).every(r => r.value > 0)
  );
}

export function missingRatingsCount(state) {
  let missing = 0;
  state.participants.forEach(author => {
    ratingsFor(state, author.id).forEach(r => { if (r.value <= 0) missing++; });
  });
  return missing;
}

export function canStart(state) {
  if (state.participants.length < 3) return false;
  return state.participants.every(p => p.name.trim() && p.cocktail.trim());
}

export function computeResults(state) {
  return state.participants.map(author => {
    const ratings = ratingsFor(state, author.id);
    const rated = ratings.filter(r => r.value > 0);
    const sum = rated.reduce((s, r) => s + r.value, 0);
    const avg = rated.length ? sum / rated.length : 0;
    return { author, sum, avg, count: rated.length, total: ratings.length };
  }).sort((a, b) => b.avg - a.avg || b.sum - a.sum);
}

// Применяет действие ведущего к состоянию (мутирует state напрямую).
// Сервер — единственный, кто реально исполняет действие; недопустимые
// переходы (например "к результатам", пока не все оценили) тихо игнорируются.
export function applyAction(state, action) {
  switch (action.type) {
    case 'updatePartyName':
      state.partyName = String(action.value || '').slice(0, 200);
      break;

    case 'addParticipant':
      state.participants.push({ id: 'p' + (state.nextId++), name: '', cocktail: '', photo: '' });
      break;

    case 'removeParticipant':
      if (state.participants.length > 3) {
        state.participants = state.participants.filter(p => p.id !== action.id);
      }
      break;

    case 'updateParticipant': {
      const p = state.participants.find(p => p.id === action.id);
      if (p && (action.field === 'name' || action.field === 'cocktail')) {
        p[action.field] = String(action.value || '').slice(0, 200);
      }
      break;
    }

    case 'setPhoto': {
      const p = state.participants.find(p => p.id === action.id);
      if (p && typeof action.photo === 'string' && action.photo.length < 400000) {
        p.photo = action.photo;
      }
      break;
    }

    case 'startScoring':
      if (canStart(state)) {
        state.view = 'scoring';
        state.expanded = state.participants[0] ? state.participants[0].id : null;
      }
      break;

    case 'toggleCard':
      if (state.view === 'scoring') {
        state.expanded = (state.expanded === action.id) ? null : action.id;
      }
      break;

    case 'setScore': {
      if (state.view !== 'scoring') break;
      const rater = state.participants.find(p => p.id === action.raterId);
      const author = state.participants.find(p => p.id === action.authorId);
      if (rater && author && rater.id !== author.id) {
        const v = Number(action.value);
        if (v >= 0.5 && v <= 5) {
          state.scores[action.raterId + '_' + action.authorId] = v;
        }
      }
      break;
    }

    case 'goToResults':
      if (allRatingsDone(state)) state.view = 'results';
      break;

    case 'backToScoring':
      if (state.view === 'results') state.view = 'scoring';
      break;

    case 'backToSetup':
      if (state.view === 'scoring') state.view = 'setup';
      break;

    case 'newParty': {
      const nextId = state.nextId;
      const fresh = defaultState();
      fresh.nextId = nextId;
      fresh.participants = freshParticipants(3, nextId);
      fresh.nextId = nextId + 3;
      Object.assign(state, fresh);
      break;
    }

    default:
      break;
  }
}
