import { PartyRoom } from './partyRoom.js';
import { tvPage } from './tvPage.js';
import { hostPage } from './hostPage.js';
import QRCode from 'qrcode';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих символов (0/O, 1/I)
function randomCode(len = 5) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ТВ: каждый заход генерирует новую комнату и QR на неё
    if (url.pathname === '/tv') {
      const code = randomCode();
      const hostUrl = `${url.origin}/host?room=${code}`;
      const qrSvg = await QRCode.toString(hostUrl, { type: 'svg', margin: 1, width: 320 });
      return new Response(tvPage(code, qrSvg), {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    }

    // Ведущий: открывается по ссылке из QR с кодом комнаты
    if (url.pathname === '/host') {
      const code = (url.searchParams.get('room') || '').toUpperCase().slice(0, 12);
      if (!code) {
        return new Response('Нет кода комнаты. Отсканируйте QR с экрана телевизора ещё раз.', { status: 400 });
      }
      return new Response(hostPage(code), {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    }

    // WebSocket-подключение к конкретной комнате (и от ТВ, и от ведущего)
    const wsMatch = url.pathname.match(/^\/room\/([A-Za-z0-9]+)\/ws$/);
    if (wsMatch) {
      const code = wsMatch[1].toUpperCase();
      const id = env.PARTY_ROOM.idFromName(code);
      const stub = env.PARTY_ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === '/') {
      return new Response(
        'Cocktail Battle server.\n\nОткройте /tv на экране телевизора — там появится QR-код для ведущего.',
        { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }
      );
    }

    return new Response('Not found', { status: 404 });
  }
};

export { PartyRoom };
