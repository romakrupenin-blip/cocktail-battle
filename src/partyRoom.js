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

    this.sendTo(session, { type: 'state', data: this.data, hostConnected: this.hostConnected() });
    this.broadcastMeta();

    server.addEventListener('message', (evt) => this.onMessage(session, evt));
    const cleanup = () => { this.sessions.delete(session); this.broadcastMeta(); };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  hostConnected() {
    for (const s of this.sessions) if (s.role === 'host') return true;
    return false;
  }

  async onMessage(session, evt) {
    // Только ведущий (role=host) может менять состояние — ТВ всегда read-only.
    if (session.role !== 'host') return;
    let action;
    try { action = JSON.parse(evt.data); } catch (e) { return; }
    if (!action || typeof action.type !== 'string') return;

    applyAction(this.data, action);
    await this.ctx.storage.put('data', this.data);
    this.broadcastState();
  }

  sendTo(session, payload) {
    try { session.ws.send(JSON.stringify(payload)); }
    catch (e) { this.sessions.delete(session); }
  }

  broadcastState() {
    const payload = { type: 'state', data: this.data, hostConnected: this.hostConnected() };
    for (const s of this.sessions) this.sendTo(s, payload);
  }

  broadcastMeta() {
    const payload = { type: 'meta', hostConnected: this.hostConnected() };
    for (const s of this.sessions) this.sendTo(s, payload);
  }
}
