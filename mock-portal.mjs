// mock-portal.mjs — a fake Stalker portal to exercise the shim
import http from 'node:http';
let issued = new Set();
let handshakeCount = 0, expireNext = false;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = Object.fromEntries(url.searchParams);
  const auth = (req.headers['authorization'] || '').replace('Bearer ', '');
  const j = (o) => { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(o)); };

  // only respond on the "real" path to test path-probing
  if (url.pathname !== '/stalker_portal/server/load.php') { res.writeHead(404); return res.end('nope'); }

  if (p.action === 'handshake') {
    handshakeCount++;
    const tok = 'TOK' + handshakeCount + 'X'.repeat(29);
    issued.add(tok);
    return j({ js: { token: tok } });
  }
  // simulate one expiry: first get_profile after an expire flag fails auth
  if (expireNext && p.action === 'get_profile') { expireNext = false; res.writeHead(200); return res.end('Authorization failed.'); }
  if (!issued.has(auth)) { res.writeHead(200); return res.end('Authorization failed.'); }

  if (p.action === 'get_profile')      return j({ js: { id:'42', name:'Test Profile', mac:p.mac||'', status:0 } });
  if (p.action === 'get_genres')       return j({ js: [{id:'*',title:'All'},{id:'1',title:'News'},{id:'2',title:'Sports'}] });
  if (p.action === 'get_all_channels') return j({ js: { total_items:2, data:[{id:'1',name:'Ch One'},{id:'2',name:'Ch Two'}] } });
  if (p.action === 'get_ordered_list') {
    const page = Number(p.p || '1');
    const all = [
      { id:'1', name:'Ch One', number:'1', cmd:'ffmpeg http://stream.example/live/1.ts', tv_genre_id:'1' },
      { id:'2', name:'Ch Two', number:'2', cmd:'ffmpeg http://stream.example/live/2.ts', tv_genre_id:'2' },
    ];
    const filtered = p.genre ? all.filter((c) => c.tv_genre_id === p.genre) : all;
    return j({ js: { total_items: page === 1 ? filtered.length : 0, data: page === 1 ? filtered : [] } });
  }
  if (p.action === 'create_link')      return j({ js: { cmd:'ffmpeg http://stream.example/live/1.ts' } });
  return j({ js: {} });
}).listen(9999, () => console.log('mock portal on :9999'));

// flip an expiry 1.2s in, to test auto-re-handshake
setTimeout(() => { expireNext = true; console.log('mock: will expire next token once'); }, 1200);
