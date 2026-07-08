export function tvPage(code, qrSvg, hostUrl) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cocktail Battle — экран</title>
<style>
  :root{
    --bg: #FCF7F4;
    --pink: #F5495F;
    --turquoise: #17A5AE;
    --line: #EDDBDF;
    --text: #332B2C;
    --muted: #9C8B8D;
    --green: #0E8A8F;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0; height:100%;}
  body{
    background: radial-gradient(circle at 50% -10%, #FFFFFF 0%, var(--bg) 60%);
    color: var(--text);
    font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    height:100vh; width:100vw;
    display:flex; align-items:center; justify-content:center;
    overflow:hidden;
  }
  .stage{width:100%; height:100%; display:none; flex-direction:column; align-items:center; justify-content:center; padding:60px; text-align:center;}
  .stage.active{display:flex;}

  .eyebrow{font-size:22px; letter-spacing:.16em; text-transform:uppercase; color:var(--pink); font-weight:700; margin-bottom:10px;}
  h1{font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size:64px; font-weight:900; margin:0 0 20px; color:var(--text);}

  /* lobby */
  .qr-box{background:#fff; border-radius:28px; padding:28px; box-shadow:0 20px 60px rgba(0,0,0,.08); border:1px solid var(--line);}
  .qr-box svg{display:block; width:320px; height:320px;}
  .code-badge{
    margin-top:22px; font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size:34px; font-weight:800;
    letter-spacing:.1em; color:var(--turquoise); background:#fff; border:1px solid var(--line);
    padding:10px 28px; border-radius:999px;
  }
  .lobby-hint{margin-top:18px; font-size:22px; color:var(--muted);}

  /* setup */
  .party-count{font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size:120px; font-weight:900; color:var(--turquoise); line-height:1;}
  .party-count-label{font-size:26px; color:var(--muted); margin-top:6px;}
  .chip-row{display:flex; flex-wrap:wrap; gap:20px; justify-content:center; margin-top:34px; max-width:1200px;}
  .chip{
    background:#fff; border:1px solid var(--line); border-radius:20px; padding:16px;
    width:200px; display:flex; flex-direction:column; align-items:center; text-align:center;
  }
  .chip-photo{width:160px; height:160px; border-radius:16px; object-fit:cover; margin-bottom:12px;}
  .chip-photo-placeholder{
    width:160px; height:160px; border-radius:16px; margin-bottom:12px;
    background:linear-gradient(135deg,#FFE3E8,#DFF5F6); display:flex; align-items:center; justify-content:center;
    font-size:40px;
  }
  .chip .cocktail-name-line{font-size:20px; font-weight:700;}
  .chip .who{color:var(--muted); font-weight:500; font-size:15px; display:block; margin-top:4px;}

  /* scoring spotlight */
  .spot-photo{width:340px; height:340px; border-radius:32px; object-fit:cover; box-shadow:0 24px 70px rgba(0,0,0,.14); margin-bottom:30px;}
  .spot-photo-placeholder{
    width:340px; height:340px; border-radius:32px; margin-bottom:30px;
    background:linear-gradient(135deg,#FFE3E8,#DFF5F6); display:flex; align-items:center; justify-content:center;
  }
  .spot-cocktail{font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size:72px; font-weight:800; line-height:1;}
  .spot-author{font-size:28px; color:var(--muted); margin-top:8px;}
  .spot-progress{
    margin-top:30px; font-size:28px; font-weight:700; color:var(--turquoise);
    background:#fff; border:1px solid var(--line); border-radius:999px; padding:10px 30px;
  }

  /* results */
  .win-title{font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size:40px; font-weight:900; color:var(--pink); letter-spacing:.05em; margin-bottom:14px;}
  .win-photo{width:340px; height:340px; border-radius:50%; object-fit:cover; border:8px solid #fff; box-shadow:0 24px 70px rgba(0,0,0,.18);}
  .win-medal{font-size:220px; line-height:1;}
  .win-name{font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size:56px; font-weight:800; color:var(--turquoise); margin-top:14px;}
  .win-cocktail{font-size:28px; color:var(--text); margin-top:4px;}

  table.board{border-collapse:collapse; margin-top:34px; font-size:24px; width:100%; max-width:960px;}
  table.board th{color:var(--muted); font-size:16px; text-transform:uppercase; letter-spacing:.06em; padding:8px 14px; text-align:left;}
  table.board td{padding:14px; border-top:1px solid var(--line); vertical-align:middle;}
  table.board .rank{font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size:32px; color:var(--pink);}
  table.board .avg{font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; font-size:30px; color:var(--turquoise); text-align:right;}
  table.board img{width:88px; height:88px; border-radius:16px; object-fit:cover; margin-right:16px; vertical-align:middle;}

  .conn-dot{position:fixed; top:20px; right:24px; width:14px; height:14px; border-radius:50%; background:#e0a; opacity:.5;}
  .conn-dot.live{background:var(--green); opacity:1;}
</style>
</head>
<body>

<div class="conn-dot" id="connDot"></div>

<div class="stage active" id="stage-lobby">
  <div class="eyebrow">Cocktail Battle</div>
  <h1>Отсканируйте, чтобы начать</h1>
  <div class="qr-box">${qrSvg}</div>
  <div class="code-badge">${code}</div>
  <div class="lobby-hint" style="font-size:14px; opacity:.7; word-break:break-all; max-width:500px;">Или вручную: ${hostUrl}</div>
  <div class="lobby-hint">Ведущий сканирует QR своим телефоном и вносит участников</div>
  <div class="lobby-hint" style="font-size:16px; margin-top:6px;">Совет: сканируйте через сканер в Chrome — стандартная камера некоторых телефонов иногда зависает на открытии ссылки</div>
</div>

<div class="stage" id="stage-setup">
  <div class="eyebrow" id="setupPartyName">Вечеринка коктейлей</div>
  <div class="party-count" id="setupCount">0</div>
  <div class="party-count-label">участников готовятся</div>
  <div class="chip-row" id="setupChips"></div>
</div>

<div class="stage" id="stage-scoring">
  <div class="eyebrow">Сейчас оценивают</div>
  <div id="spotPhotoWrap"></div>
  <div class="spot-cocktail" id="spotCocktail">—</div>
  <div class="spot-author" id="spotAuthor"></div>
  <div class="spot-progress" id="spotProgress">0 / 0</div>
</div>

<div class="stage" id="stage-results">
  <div class="win-title">ПОБЕДИТЕЛЬ!!!</div>
  <div id="winPhotoWrap"></div>
  <div class="win-name" id="winName"></div>
  <div class="win-cocktail" id="winCocktail"></div>
  <table class="board">
    <thead><tr><th>#</th><th>Коктейль</th><th style="text-align:right">Балл</th></tr></thead>
    <tbody id="boardBody"></tbody>
  </table>
</div>

<script>
const ROOM_CODE = ${JSON.stringify(code)};
let state = null;
let hostConnected = false;
let ws = null;
let reconnectDelay = 1000;
let lastActivity = Date.now();
let pingTimer = null;
let watchdogTimer = null;

function esc(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function startHeartbeat(){
  clearInterval(pingTimer);
  clearInterval(watchdogTimer);
  pingTimer = setInterval(() => {
    if(ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type:'ping'}));
  }, 15000);
  watchdogTimer = setInterval(() => {
    if(Date.now() - lastActivity > 25000){
      console.warn('Соединение выглядит "зависшим", переподключаюсь...');
      try{ ws.close(); }catch(e){}
    }
  }, 5000);
}

function connect(){
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(proto + '//' + location.host + '/room/' + ROOM_CODE + '/ws?role=tv');
  ws.onopen = () => { document.getElementById('connDot').classList.add('live'); reconnectDelay = 1000; lastActivity = Date.now(); startHeartbeat(); };
  ws.onclose = () => { document.getElementById('connDot').classList.remove('live'); clearInterval(pingTimer); clearInterval(watchdogTimer); setTimeout(connect, reconnectDelay); reconnectDelay = Math.min(reconnectDelay*1.5, 8000); };
  ws.onerror = () => { try{ ws.close(); }catch(e){} };
  ws.onmessage = (evt) => {
    lastActivity = Date.now();
    const msg = JSON.parse(evt.data);
    if(msg.type === 'pong') return;
    if(msg.type === 'state'){ state = msg.data; hostConnected = msg.hostConnected; render(); }
    else if(msg.type === 'meta'){ hostConnected = msg.hostConnected; render(); }
  };
}

function showStage(id){
  document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function ratingsFor(authorId){
  return state.participants
    .filter(p=>p.id!==authorId)
    .map(rater => ({raterId: rater.id, value: state.scores[rater.id+'_'+authorId] || 0}));
}

function computeResults(){
  return state.participants.map(author=>{
    const ratings = ratingsFor(author.id);
    const rated = ratings.filter(r=>r.value>0);
    const sum = rated.reduce((s,r)=>s+r.value,0);
    const avg = rated.length ? sum/rated.length : 0;
    return {author, sum, avg, count: rated.length, total: ratings.length};
  }).sort((a,b)=> b.avg-a.avg || b.sum-a.sum);
}

function render(){
  if(!hostConnected || !state){ showStage('stage-lobby'); return; }

  if(state.view === 'setup'){
    showStage('stage-setup');
    document.getElementById('setupPartyName').textContent = state.partyName.trim() || 'Cocktail Battle';
    document.getElementById('setupCount').textContent = state.participants.length;
    document.getElementById('setupChips').innerHTML = state.participants.map((p, idx) => {
      const cocktail = p.cocktail && p.cocktail.trim() ? esc(p.cocktail) : '<span style="opacity:.4">Коктейль №'+(idx+1)+'</span>';
      const name = p.name && p.name.trim() ? esc(p.name) : '<span style="opacity:.4">имя не введено</span>';
      const photo = p.photo ? '<img class="chip-photo" src="'+p.photo+'">' : '<div class="chip-photo-placeholder">🍹</div>';
      return '<div class="chip">' + photo + '<div class="cocktail-name-line">' + cocktail + '</div><span class="who">' + name + '</span></div>';
    }).join('');
    return;
  }

  if(state.view === 'scoring'){
    showStage('stage-scoring');
    const author = state.participants.find(p=>p.id===state.expanded) || state.participants[0];
    if(author){
      document.getElementById('spotCocktail').textContent = author.cocktail || '—';
      document.getElementById('spotAuthor').textContent = author.name || '';
      const ratings = ratingsFor(author.id);
      const done = ratings.filter(r=>r.value>0).length;
      document.getElementById('spotProgress').textContent = done + ' / ' + ratings.length + ' оценок';
      const wrap = document.getElementById('spotPhotoWrap');
      wrap.innerHTML = author.photo
        ? '<img class="spot-photo" src="'+author.photo+'">'
        : '<div class="spot-photo-placeholder">🍹</div>';
    }
    return;
  }

  if(state.view === 'results'){
    showStage('stage-results');
    const results = computeResults();
    const winner = results[0];
    document.getElementById('winName').textContent = winner ? winner.author.name : '';
    document.getElementById('winCocktail').textContent = winner ? winner.author.cocktail : '';
    const wrap = document.getElementById('winPhotoWrap');
    wrap.innerHTML = winner && winner.author.photo
      ? '<img class="win-photo" src="'+winner.author.photo+'">'
      : '<div class="win-medal">🏆</div>';
    document.getElementById('boardBody').innerHTML = results.map((r,idx) => (
      '<tr><td class="rank">'+(idx+1)+'</td>' +
      '<td>' + (r.author.photo ? '<img src="'+r.author.photo+'">' : '') +
        esc(r.author.cocktail) + ' <span style="color:var(--muted); font-size:18px;">— '+esc(r.author.name)+'</span></td>' +
      '<td class="avg">'+(r.avg? r.avg.toFixed(2):'—')+'</td></tr>'
    )).join('');
    return;
  }
}

connect();
</script>
</body>
</html>`;
}
