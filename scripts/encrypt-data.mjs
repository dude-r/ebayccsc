// Encrypts the scrubbed dataset into public/ccsc-data.enc.json — the ONLY form
// of the data that gets committed and deployed. The app fetches this blob and
// decrypts it in the browser with the viewer's password (Web Crypto, AES-GCM
// with a PBKDF2-derived key). Plaintext financials never ship.
//
// Run:  SITE_PASSWORD='your-password' npm run encrypt
//   (or `npm run encrypt` and type it when prompted)
//
// Key derivation here must match src/lib/crypto.js exactly:
//   PBKDF2(password, salt, 250000 iters, SHA-256) -> 32-byte AES-256-GCM key.

import { pbkdf2Sync, randomBytes, createCipheriv } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '../raw/ccsc-data.scrubbed.json')
const OUT = resolve(__dirname, '../public/ccsc-data.enc.json')
const ITERATIONS = 250000

if (!existsSync(SRC)) {
  console.error(`Missing ${SRC}\nRun \`npm run build:data\` first to produce the scrubbed dataset.`)
  process.exit(1)
}

const data = JSON.parse(readFileSync(SRC, 'utf8'))

// Guard: never encrypt/ship a dataset that doesn't reconcile.
const near = (a, b) => Math.abs(a - b) < 0.01
if (!near(data.H1?.net_after_supplies, 1614.09) || data.cards?.length !== 112) {
  console.error('Reconciliation check failed — refusing to encrypt. Regenerate with npm run build:data.')
  process.exit(1)
}
// Belt-and-suspenders: refuse to encrypt if PII slipped back in.
if (/"(city|state)"\s*:/.test(JSON.stringify(data))) {
  console.error('PII (city/state) present in dataset — refusing to encrypt. Run npm run build:data.')
  process.exit(1)
}

async function getPassword() {
  if (process.env.SITE_PASSWORD) return process.env.SITE_PASSWORD
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const pw = await new Promise((res) => rl.question('Set the site password: ', res))
  rl.close()
  return pw
}

const password = (await getPassword()).trim()
if (!password) {
  console.error('Empty password — aborting.')
  process.exit(1)
}

const salt = randomBytes(16)
const iv = randomBytes(12)
const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256')

const cipher = createCipheriv('aes-256-gcm', key, iv)
const plaintext = Buffer.from(JSON.stringify(data), 'utf8')
const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
const tag = cipher.getAuthTag()

// Web Crypto expects the auth tag appended to the ciphertext.
const blob = {
  v: 1,
  alg: 'AES-GCM',
  kdf: 'PBKDF2-SHA256',
  iterations: ITERATIONS,
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  ct: Buffer.concat([ct, tag]).toString('base64'),
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(blob) + '\n')
console.log(`Wrote ${OUT}\n  encrypted ${plaintext.length} bytes → ${blob.ct.length} b64 chars\n  ${data.cards.length} cards, PBKDF2 ${ITERATIONS} iters, AES-256-GCM`)
