import CSS from './hostStyles.css';

export function hostPage(roomCode) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no">
<title>Cocktail Battle — ведущий</title>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;900&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>

<div class="conn-banner" id="connBanner">Нет связи с сервером — переподключаюсь…</div>

<div class="app">
  <div class="topbar">
    <div class="logo-wrap">
      <svg viewBox="0 0 24 24" fill="none" stroke="#17A5AE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h16l-7 8v6h3v2H8v-2h3v-6L4 4z"/>
        <path d="M7.2 6.5h9.6" stroke="#F5495F" stroke-width="1.2"/>
      </svg>
    </div>
    <div class="brand">
      <span class="eyebrow">Cocktail Battle</span>
      <h1 id="partyTitle">Вечеринка коктейлей</h1>
    </div>
  </div>
  <div class="room-badge">Комната: ${roomCode} · показывается на ТВ</div>

  <main id="viewRoot">
    <p class="hint">Подключаюсь к комнате…</p>
  </main>
</div>

<div class="lightbox" id="lightbox" onclick="closeLightbox()">
  <img id="lightboxImg" src="">
</div>

<script>
const ROOM_CODE = ${JSON.stringify(roomCode)};
let state = null;
let ws = null;
let reconnectDelay = 1000;

function connect(){
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(proto + '//' + location.host + '/room/' + ROOM_CODE + '/ws?role=host');
  ws.onopen = () => { document.getElementById('connBanner').classList.remove('show'); reconnectDelay = 1000; };
  ws.onclose = () => { document.getElementById('connBanner').classList.add('show'); setTimeout(connect, reconnectDelay); reconnectDelay = Math.min(reconnectDelay*1.5, 8000); };
  ws.onerror = () => { try{ ws.close(); }catch(e){} };
  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if(msg.type === 'state'){
      const firstLoad = (state === null);
      state = msg.data;
      if(state.partyName){
        document.getElementById('partyTitle').textContent = state.partyName.trim() || 'Вечеринка коктейлей';
      }
      const activeIsTextInput = document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text';
      if(firstLoad || !activeIsTextInput) render();
    }
  };
}
function send(action){
  if(ws && ws.readyState === WebSocket.OPEN){
    ws.send(JSON.stringify(action));
  }
}

function esc(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escAttr(s){ return esc(s); }

// ---------- LOCAL MUTATIONS (оптимистично обновляем локально + отправляем на сервер) ----------
function addParticipant(){
  send({type:'addParticipant'});
  // Не добавляем строку локально с временным ID — ждём подтверждения от
  // сервера с настоящим ID, чтобы дальнейший ввод в новую строку точно
  // долетал до сервера (иначе TV мог не видеть данные этого участника).
}
function removeParticipant(id){
  if(state.participants.length <= 3) return;
  state.participants = state.participants.filter(p=>p.id!==id);
  send({type:'removeParticipant', id});
  render();
}
function updateParticipant(id, field, value){
  const p = state.participants.find(p=>p.id===id);
  if(p) p[field] = value;
  send({type:'updateParticipant', id, field, value});
}
function handlePhotoChange(id, input){
  const file = input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = function(){
      const maxDim = 480;
      let w = img.width, h = img.height;
      if(w > h && w > maxDim){ h = Math.round(h * maxDim/w); w = maxDim; }
      else if(h >= w && h > maxDim){ w = Math.round(w * maxDim/h); h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.72);
      const p = state.participants.find(p=>p.id===id);
      if(p){ p.photo = compressed; send({type:'setPhoto', id, photo: compressed}); render(); }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function updatePartyName(value){
  state.partyName = value;
  document.getElementById('partyTitle').textContent = value.trim() || 'Вечеринка коктейлей';
  send({type:'updatePartyName', value});
}
function canStart(){
  if(state.participants.length < 3) return false;
  return state.participants.every(p => p.name.trim() && p.cocktail.trim());
}
function startHintText(){
  if(state.participants.length < 3){
    return 'Добавьте ещё ' + (3 - state.participants.length) + ' участник(ов) — минимум 3.';
  }
  const missing = state.participants
    .map((p,idx)=> !p.name.trim() ? ('№'+(idx+1)+': нет имени') : (!p.cocktail.trim() ? ('№'+(idx+1)+': нет коктейля') : null))
    .filter(Boolean);
  if(missing.length) return 'Не заполнено — ' + missing.join(', ');
  return 'Всё заполнено, можно начинать ✓';
}
function startScoring(){
  if(!canStart()) return;
  state.view = 'scoring';
  state.expanded = state.participants[0].id;
  send({type:'startScoring'});
  render();
}
function newParty(){
  send({type:'newParty'});
  // ждём подтверждения с сервера (там же пересоздаются id участников) — не мутируем локально
}
function toggleCard(id){
  state.expanded = (state.expanded === id) ? null : id;
  send({type:'toggleCard', id});
  render();
}
function openLightbox(src){
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('open');
}
function setScore(raterId, authorId, value){
  state.scores[raterId+'_'+authorId] = value;
  send({type:'setScore', raterId, authorId, value});
  render();
}
function ratingsFor(authorId){
  return state.participants
    .filter(p=>p.id!==authorId)
    .map(rater => ({rater, value: state.scores[rater.id+'_'+authorId] || 0}));
}
function allRatingsDone(){
  if(state.participants.length < 3) return false;
  return state.participants.every(author => ratingsFor(author.id).every(r=>r.value>0));
}
function missingRatingsCount(){
  let missing = 0;
  state.participants.forEach(author=>{ ratingsFor(author.id).forEach(r=>{ if(r.value<=0) missing++; }); });
  return missing;
}
function goToResults(){
  if(!allRatingsDone()) return;
  state.view = 'results';
  send({type:'goToResults'});
  render();
}
function computeResults(){
  return state.participants.map(author=>{
    const ratings = ratingsFor(author.id);
    const rated = ratings.filter(r=>r.value>0);
    const sum = rated.reduce((s,r)=>s+r.value,0);
    const avg = rated.length ? sum/rated.length : 0;
    return { author, sum, avg, count: rated.length, total: ratings.length };
  }).sort((a,b)=> b.avg - a.avg || b.sum - a.sum);
}
function backToSetup(){ state.view='setup'; send({type:'backToSetup'}); render(); }
function backToScoring(){ state.view='scoring'; send({type:'backToScoring'}); render(); }

// ---------- STAR RENDERING ----------
const STAR_PATH = "M12 2.6l2.85 6.2 6.75.62-5.1 4.55 1.52 6.63L12 17.9l-6.02 3.7 1.52-6.63-5.1-4.55 6.75-.62L12 2.6z";
function starsHTML(value, raterId, authorId){
  let html = '<div class="stars">';
  for(let i=1;i<=5;i++){
    const fillPct = value >= i ? 100 : (value >= i-0.5 ? 50 : 0);
    html += \`
      <span class="star-slot">
        <svg class="star-bg" viewBox="0 0 24 24"><path d="\${STAR_PATH}"/></svg>
        <svg class="star-fill" viewBox="0 0 24 24" style="clip-path: inset(0 \${100-fillPct}% 0 0)"><path d="\${STAR_PATH}"/></svg>
        <span class="hit hit-left" onclick="setScore('\${raterId}','\${authorId}',\${i-0.5})"></span>
        <span class="hit hit-right" onclick="setScore('\${raterId}','\${authorId}',\${i})"></span>
      </span>\`;
  }
  html += '</div>';
  return html;
}

// ---------- RENDER ----------
function render(){
  closeLightbox();
  const root = document.getElementById('viewRoot');
  if(state.view==='setup') root.innerHTML = renderSetup();
  else if(state.view==='scoring') root.innerHTML = renderScoring();
  else root.innerHTML = renderResults();
}

function renderSetup(){
  let rows = state.participants.map((p,idx)=>\`
    <div class="participant-row">
      <div class="idx">\${idx+1}</div>
      <label class="photo-upload" title="Фото коктейля">
        \${p.photo ? \`<img src="\${p.photo}">\` : \`<svg viewBox="0 0 24 24" fill="none" stroke="#B8A6A9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.2"/><path d="M8 6l1.4-2h5.2L16 6"/></svg>\`}
        <input type="file" accept="image/*" onchange="handlePhotoChange('\${p.id}', this)">
      </label>
      <div class="inputs">
        <input type="text" placeholder="Имя участника" value="\${escAttr(p.name)}"
          oninput="updateParticipant('\${p.id}','name',this.value); document.getElementById('startBtn').disabled=!canStart(); document.getElementById('startHint').textContent=startHintText(); document.getElementById('startHint').classList.toggle('ok', canStart());">
        <input type="text" placeholder="Название коктейля" value="\${escAttr(p.cocktail)}"
          oninput="updateParticipant('\${p.id}','cocktail',this.value); document.getElementById('startBtn').disabled=!canStart(); document.getElementById('startHint').textContent=startHintText(); document.getElementById('startHint').classList.toggle('ok', canStart());">
      </div>
      <button class="remove-btn" onclick="removeParticipant('\${p.id}')" \${state.participants.length<=3?'disabled':''}>✕</button>
    </div>
  \`).join('');

  return \`
    <div class="screen active">
      <div class="field">
        <label>Название вечеринки</label>
        <input type="text" placeholder="Например: Коктейльный вечер у Наташи" value="\${escAttr(state.partyName)}"
          oninput="updatePartyName(this.value)">
      </div>

      <div class="section-title">
        Участники и коктейли
        <span class="counter-pill">\${state.participants.length}</span>
      </div>

      \${rows}

      <button class="btn btn-outline-add" onclick="addParticipant()">+ Добавить участника</button>

      <p class="hint">Минимум 3 участника. У каждого — своё имя, название коктейля и фото (по желанию).</p>

      <div id="startHint" class="start-hint \${canStart()?'ok':''}">\${startHintText()}</div>
      <button id="startBtn" class="btn btn-primary" onclick="startScoring()" \${canStart()?'':'disabled'}>Начать оценивание →</button>
    </div>
  \`;
}

function renderScoring(){
  const cards = state.participants.map(author=>{
    const ratings = ratingsFor(author.id);
    const doneCount = ratings.filter(r=>r.value>0).length;
    const isOpen = state.expanded === author.id;
    const raterRows = ratings.map(r=>\`
      <div class="rater-row">
        <span class="rater-name">\${esc(r.rater.name)}</span>
        \${starsHTML(r.value, r.rater.id, author.id)}
      </div>
    \`).join('');

    return \`
      <div class="cocktail-card \${isOpen?'open':''}">
        <div class="cocktail-head" onclick="toggleCard('\${author.id}')">
          <div class="cocktail-head-main">
            \${author.photo ? \`<img class="cocktail-thumb" src="\${author.photo}">\` : ''}
            <div class="cocktail-text">
              <div class="cocktail-name">\${esc(author.cocktail)}</div>
              <div class="cocktail-author">\${esc(author.name)}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="progress-pill \${doneCount===ratings.length?'done':''}">\${doneCount}/\${ratings.length}</span>
            <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <div class="rater-list">
          \${author.photo ? \`<img class="cocktail-thumb-large" src="\${author.photo}" onclick="openLightbox('\${author.photo}')">\` : ''}
          \${raterRows}
        </div>
      </div>
    \`;
  }).join('');

  return \`
    <div class="screen active">
      <div class="top-nav">
        <button class="btn btn-ghost" onclick="backToSetup()">← Участники</button>
        <button class="btn btn-ghost" onclick="goToResults()" \${allRatingsDone()?'':'disabled'}>Результаты →</button>
      </div>
      \${allRatingsDone()
        ? '<p class="hint" style="color:var(--green); font-weight:600;">Все оценки собраны — можно смотреть результаты ✓</p>'
        : '<p class="hint" style="color:var(--red); font-weight:600;">Осталось оценок: ' + missingRatingsCount() + ' — результаты откроются, когда все коктейли оценят все участники.</p>'}
      <p class="hint">Нажмите на коктейль, чтобы развернуть список и выставить оценки. Экран ТВ показывает текущий развёрнутый коктейль.</p>
      \${cards}
    </div>
  \`;
}

function renderResults(){
  const results = computeResults();
  const maxAvg = results.length ? results[0].avg : 0;
  const winners = results.filter(r=>r.avg===maxAvg && maxAvg>0);

  let banner = '';
  if(winners.length===0){
    banner = '<div class="empty-note">Пока нет оценок.</div>';
  } else if(winners.length===1){
    const w = winners[0];
    banner = \`
      <div class="winner-banner">
        <div class="winner-title">ПОБЕДИТЕЛЬ!!!</div>
        \${w.author.photo
          ? \`<div class="winner-photo-wrap"><img class="winner-photo" src="\${w.author.photo}"><span class="medal-badge">🏆</span></div>\`
          : '<div class="medal">🏆</div>'}
        <div class="wname">\${esc(w.author.name)}</div>
        <div class="wcocktail">\${esc(w.author.cocktail)}</div>
        <div class="wscore">Средний балл: \${w.avg.toFixed(2)} · сумма: \${w.sum % 1 === 0 ? w.sum : w.sum.toFixed(1)} · оценок: \${w.count}/\${w.total}</div>
      </div>\`;
  } else {
    banner = \`
      <div class="winner-banner">
        <div class="medal">🏆</div>
        <div class="wname">Ничья!</div>
        <div class="wcocktail">\${winners.map(w=>esc(w.author.name)).join(' и ')}</div>
        <div class="wscore">Средний балл: \${maxAvg.toFixed(2)}</div>
      </div>\`;
  }

  const rows = results.map((r,idx)=>\`
    <tr>
      <td class="rank">\${idx+1}</td>
      <td>
        <div class="lb-cell-main">
          \${r.author.photo ? \`<img class="lb-thumb" src="\${r.author.photo}">\` : ''}
          <div>
            <div class="lb-cocktail">\${esc(r.author.cocktail)}</div>
            <div class="lb-author">\${esc(r.author.name)}</div>
          </div>
        </div>
      </td>
      <td class="lb-sum">\${r.sum % 1 === 0 ? r.sum : r.sum.toFixed(1)}</td>
      <td class="lb-avg">\${r.avg? r.avg.toFixed(2):'—'}</td>
      <td class="lb-count">\${r.count}/\${r.total}<br>оценок</td>
    </tr>
  \`).join('');

  return \`
    <div class="screen active">
      \${banner}
      <table class="leaderboard">
        <thead>
          <tr><th>#</th><th>Коктейль</th><th style="text-align:right">Сумма</th><th style="text-align:right">Средний</th><th style="text-align:right">Оценки</th></tr>
        </thead>
        <tbody>\${rows}</tbody>
      </table>
      <div class="btn-row">
        <button class="btn btn-ghost" onclick="backToScoring()">← К оценкам</button>
        <button class="btn btn-primary" onclick="newParty()">Новая вечеринка</button>
      </div>
    </div>
  \`;
}

connect();
</script>
</body>
</html>`;
}
