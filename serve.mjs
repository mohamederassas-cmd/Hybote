import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const mime = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
};

// Nur für lokale Screenshots: ?dev=1 schaltet die Scroll-Reveal-Animation ab und
// ?y=<px> springt hart an eine Scrollposition. Headless Chrome löst den
// IntersectionObserver sonst nie aus und fotografiert eine leere Seite.
// Diese Datei ist in .gitignore, geht also nie live.
const DEV_PATCH = `
<style>.reveal{opacity:1!important;transform:none!important}html{scroll-behavior:auto!important}</style>
<script>addEventListener('DOMContentLoaded',function(){
  var y=new URLSearchParams(location.search).get('y');
  if(y)addEventListener('load',function(){scrollTo(0,+y)});
});</script>
</head>`;

createServer(async (req, res) => {
  const query = new URLSearchParams(req.url.split('?')[1] || '');
  let url = req.url.split('?')[0].split('#')[0];
  if (url === '/') url = '/index.html';

  // Verzeichnis-Index wie bei Vercel: /real-estate und /real-estate/ liefern
  // real-estate/index.html. Ohne das lassen sich die Landingpages lokal nicht testen.
  const candidates = extname(url)
    ? [url]
    : [url.replace(/\/$/, '') + '/index.html', url];

  for (const c of candidates) {
    try {
      let data = await readFile(join(__dirname, c));
      if (query.get('dev') === '1' && extname(c) === '.html') {
        let html = data.toString('utf8').replace('</head>', DEV_PATCH);
        // ?nobg=1 nimmt das WebGL-Terrain heraus (die Modul-IIFE steigt ohne
        // Canvas sofort aus). Ganzseiten-Screenshots über 9000px rendern sonst
        // in die Zeitüberschreitung.
        // Zusätzlich fliegt der Spline-Roboter raus: er animiert ebenfalls und
        // macht jeden Screenshot-Vergleich verrauscht.
        if (query.get('nobg') === '1') {
          html = html
            .replace('<canvas id="beams-canvas"></canvas>', '')
            .replace(/<spline-viewer[\s\S]*?<\/spline-viewer>/, '');
        }
        data = Buffer.from(html, 'utf8');
      }
      res.writeHead(200, { 'Content-Type': mime[extname(c)] || 'application/octet-stream' });
      res.end(data);
      return;
    } catch { /* nächster Kandidat */ }
  }
  res.writeHead(404);
  res.end('Not found');
}).listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
