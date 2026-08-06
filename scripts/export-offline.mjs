// Builds a single self-contained HTML file of the report that opens by
// double-click, no server and no password. The dataset is embedded IN THE
// CLEAR (Web Crypto doesn't run on file:// URLs, so the gate can't) — treat
// the output file like the financials it contains.
//
//   npm run build && SITE_PASSWORD=… node scripts/export-offline.mjs [out.html]
//
// Reads the dataset by decrypting dist/ccsc-data.enc.json, inlines the built
// JS and CSS, and writes one HTML file (default: ccsc-report-offline.html,
// which is gitignored — never commit it).
import { pbkdf2Sync, createDecipheriv } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rp = (p) => resolve(__dirname, '..', p)
const out = process.argv[2] || rp('ccsc-report-offline.html')
const PW = process.env.SITE_PASSWORD
if (!PW) { console.error('SITE_PASSWORD required'); process.exit(1) }

const b64 = (s) => Buffer.from(s, 'base64')
const blob = JSON.parse(readFileSync(rp('dist/ccsc-data.enc.json'), 'utf8'))
const key = pbkdf2Sync(PW, b64(blob.salt), blob.iterations, 32, 'sha256')
const ct = b64(blob.ct)
const d = createDecipheriv('aes-256-gcm', key, b64(blob.iv))
d.setAuthTag(ct.subarray(ct.length - 16))
const data = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString('utf8')

let html = readFileSync(rp('dist/index.html'), 'utf8')
const assets = readdirSync(rp('dist/assets'))
const js = assets.find((f) => f.endsWith('.js'))
const css = assets.find((f) => f.endsWith('.css'))

// Inject the dataset before the app script, then inline both assets.
// </script> inside the JSON would end the tag early — escape it.
const dataTag = `<script>window.__CCSC_DATA__ = ${data.replace(/<\//g, '<\\/')};</script>`
// Replacement callbacks, not strings: the bundled JS is full of `$&`-style
// sequences that String.replace would otherwise interpret.
const jsRe = new RegExp(`<script[^>]*src="\\./assets/${js}"[^>]*>\\s*</script>`)
const cssRe = new RegExp(`<link[^>]*href="\\./assets/${css}"[^>]*>`)
if (!jsRe.test(html) || !cssRe.test(html)) { console.error('asset tags not found in dist/index.html'); process.exit(1) }
html = html.replace(jsRe, () =>
  dataTag + '\n<script type="module">' + readFileSync(rp('dist/assets/' + js), 'utf8').replace(/<\/script>/g, '<\\/script>') + '</script>'
)
html = html.replace(cssRe, () => '<style>' + readFileSync(rp('dist/assets/' + css), 'utf8') + '</style>')
if (html.includes('./assets/')) { console.error('un-inlined asset reference remains — aborting'); process.exit(1) }
writeFileSync(out, html)
console.log('Wrote', out, Math.round(html.length / 1024) + ' KB — self-contained, UNENCRYPTED. Keep it private.')
