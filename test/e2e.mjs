import WebSocket from 'ws';

const ROOM = 'TESTX';
const BASE = 'ws://localhost:8787/room/' + ROOM + '/ws';

function connect(role){
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE + '?role=' + role);
    const messages = [];
    ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
    ws.on('open', () => resolve({ ws, messages }));
    ws.on('error', reject);
  });
}

function waitFor(messages, predicate, timeoutMs=3000){
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const found = messages.slice().reverse().find(predicate);
      if(found){ clearInterval(iv); resolve(found); }
      else if(Date.now()-start > timeoutMs){ clearInterval(iv); reject(new Error('timeout waiting for message')); }
    }, 50);
  });
}

function send(ws, action){ ws.send(JSON.stringify(action)); }

async function main(){
  const tv = await connect('tv');
  console.log('TV connected. initial hostConnected:', (await waitFor(tv.messages, m=>m.type==='state')).hostConnected);

  const host = await connect('host');
  await waitFor(host.messages, m=>m.type==='state');

  // TV should now see hostConnected=true
  const metaAfterHost = await waitFor(tv.messages, m => (m.type==='meta'||m.type==='state') && m.hostConnected===true);
  console.log('TV sees hostConnected=true:', metaAfterHost.hostConnected);

  // Host fills 3 participants
  const first = (await waitFor(host.messages, m=>m.type==='state')).data;
  const ids = first.participants.map(p=>p.id);
  ids.forEach((id, i) => {
    send(host.ws, {type:'updateParticipant', id, field:'name', value:'Name'+i});
    send(host.ws, {type:'updateParticipant', id, field:'cocktail', value:'Cocktail'+i});
  });

  await new Promise(r=>setTimeout(r, 300));

  // TV should reflect participant names via latest state broadcast
  const tvStateAfterFill = tv.messages.slice().reverse().find(m=>m.type==='state');
  console.log('TV sees filled participants:', tvStateAfterFill.data.participants.map(p=>p.name+':'+p.cocktail));

  // Try to start scoring
  send(host.ws, {type:'startScoring'});
  const scoringState = await waitFor(host.messages, m=>m.type==='state' && m.data.view==='scoring');
  console.log('view after startScoring:', scoringState.data.view);

  // Try to jump to results too early -- should be rejected server-side
  send(host.ws, {type:'goToResults'});
  await new Promise(r=>setTimeout(r, 300));
  const afterEarlyResults = host.messages.slice().reverse().find(m=>m.type==='state');
  console.log('view after premature goToResults (should still be scoring):', afterEarlyResults.data.view);

  // Rate everything
  for(const authorId of ids){
    for(const raterId of ids){
      if(raterId===authorId) continue;
      send(host.ws, {type:'setScore', raterId, authorId, value:4.5});
    }
  }
  await new Promise(r=>setTimeout(r, 400));

  send(host.ws, {type:'goToResults'});
  const resultsState = await waitFor(host.messages, m=>m.type==='state' && m.data.view==='results');
  console.log('view after full ratings + goToResults:', resultsState.data.view);

  // TV should also see results view
  const tvResultsState = await waitFor(tv.messages, m=>m.type==='state' && m.data.view==='results');
  console.log('TV also sees results view:', tvResultsState.data.view);

  // Security check: TV tries to mutate state directly -- must be ignored
  send(tv.ws, {type:'newParty'});
  await new Promise(r=>setTimeout(r, 300));
  const afterTvHack = host.messages.slice().reverse().find(m=>m.type==='state');
  console.log('view after TV tried newParty (should remain results, TV cannot mutate):', afterTvHack.data.view);

  // Host does newParty for real
  send(host.ws, {type:'newParty'});
  const afterRealNewParty = await waitFor(host.messages, m=>m.type==='state' && m.data.view==='setup' && m.data.participants.every(p=>!p.name));
  console.log('view after real newParty:', afterRealNewParty.data.view, 'participants blank:', afterRealNewParty.data.participants.every(p=>!p.name));

  tv.ws.close(); host.ws.close();
  console.log('\\nALL E2E CHECKS COMPLETED');
}

main().catch(e => { console.error('E2E TEST FAILED:', e); process.exit(1); });
