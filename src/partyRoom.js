import { defaultState, applyAction } from './shared.js';

export class PartyRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sessions = new Set(); // { ws, role: 'tv' | 'host' }
    this.data = null;
  }

  async ensureLoaded() {
    if (this.data) return;
    const stored = await this.ctx.storage.get('data');
    this.data = stored || defaultState();
  }

  async fetch(request) {
    await this.ensureLoaded();

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'tv';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    const session = { ws: server, role };
    this.sessions.add(session);

    // "Лёгкое" состояние — без байтов фото, чтобы разбор JSON на слабых
    // телефонах не блокировал главный поток на каждое действие.
    this.sendTo(session, { type: 'state', data: this.thinData(), hostConnected: this.hostConnected() });
    // Фото досылаем отдельно, каждое своим сообщением — сразу после подключения.
    for (const p of this.data.participants) {
      if (p.photo) this.sendTo(session, { type: 'photo', id: p.id, photo: p.photo });
    }
    this.broadcastMeta();

    server.addEventListener('message', (evt) => {
      this.onMessage(session, evt).catch(err => {
        console.error('Unhandled onMessage error:', err);
      });
    });
    const cleanup = () => { this.sessions.delete(session); this.broadcastMeta(); };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  hostConnected() {
    for (const s of this.sessions) if (s.role === 'host') return true;
    return false;
  }

  // Копия состояния без байтов фото — то, что реально гоняется туда-сюда
  // на каждое действие (ввод текста, оценка и т.д.)
  thinData() {
    return {
      ...this.data,
      participants: this.data.participants.map(p => ({ ...p, photo: '' }))
    };
  }

  async onMessage(session, evt) {
    let action;
    try { action = JSON.parse(evt.data); } catch (e) { return; }
    if (!action || typeof action.type !== 'string') return;

    if (action.type === 'ping') {
      this.sendTo(session, { type: 'pong' });
      return;
    }

    // Только ведущий (role=host) может менять состояние — ТВ всегда read-only.
    if (session.role !== 'host') return;

    const isPhotoAction = action.type === 'setPhoto';

    try {
      applyAction(this.data, action);
      await this.ctx.storage.put('data', this.data);
      this.broadcastState();
      if (isPhotoAction) {
        const p = this.data.participants.find(p => p.id === action.id);
        if (p && p.photo) {
          const payload = { type: 'photo', id: p.id, photo: p.photo };
          for (const s of this.sessions) this.sendTo(s, payload);
        }
      }
    } catch (err) {
      // Не даём одному сбойному действию "уронить" всю комнату молча —
      // логируем и сообщаем самому отправителю, остальные подключения не рвём.
      console.error('applyAction/storage error for action', action && action.type, err);
      this.sendTo(session, { type: 'error', message: String(err && err.message || err) });
    }
  }

  sendTo(session, payload) {
    try { session.ws.send(JSON.stringify(payload)); }
    catch (e) { this.sessions.delete(session); }
  }

  broadcastState() {
    const payload = { type: 'state', data: this.thinData(), hostConnected: this.hostConnected() };
    for (const s of this.sessions) this.sendTo(s, payload);
  }

  broadcastMeta() {
    const payload = { type: 'meta', hostConnected: this.hostConnected() };
    for (const s of this.sessions) this.sendTo(s, payload);
  }
}

