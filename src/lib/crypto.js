// Client-side decryption of the report data. The deployed site ships only
// public/ccsc-data.enc.json (ciphertext); this decrypts it in the browser with
// the viewer's password. Key derivation must match scripts/encrypt-data.mjs:
//   PBKDF2(password, salt, iterations, SHA-256) -> 32-byte AES-256-GCM key.

function b64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Fetch the encrypted blob that ships alongside the app.
export async function fetchEncrypted(base = import.meta.env.BASE_URL) {
  const res = await fetch(base + 'ccsc-data.enc.json', { cache: 'no-store' })
  if (!res.ok) throw new Error('Could not load encrypted data (HTTP ' + res.status + ')')
  return res.json()
}

// Decrypt a blob with a password. Throws on a wrong password (GCM auth fails).
export async function decryptBlob(password, blob) {
  const subtle = globalThis.crypto.subtle
  const enc = new TextEncoder()
  const keyMaterial = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: b64ToBytes(blob.salt), iterations: blob.iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const key = await subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt'])
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(blob.iv) }, key, b64ToBytes(blob.ct))
  return JSON.parse(new TextDecoder().decode(plain))
}
