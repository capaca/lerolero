// Servidor estático que imita o GitHub Pages: caminho desconhecido → 404.html (com status 404).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
const root = process.argv[2], port = Number(process.argv[3])
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' }
createServer(async (req, res) => {
  let p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  const isFile = async (f) => { try { return (await stat(f)).isFile() } catch { return false } }
  try { if (!(await isFile(p))) p = (await isFile(p + '.html')) ? p + '.html' : join(p, 'index.html'); const body = await readFile(p); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream', ...(process.env.CACHE_SECONDS ? { 'cache-control': 'max-age=' + process.env.CACHE_SECONDS } : {}) }); res.end(body) }
  catch { res.writeHead(404, { 'content-type': 'text/html' }); res.end(await readFile(join(root, 'lerolero', '404.html'))) }
}).listen(port)
