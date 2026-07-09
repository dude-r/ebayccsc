import { useEffect, useRef, useState } from 'react'
import { DataContext } from '../lib/dataContext.js'
import { fetchEncrypted, decryptBlob } from '../lib/crypto.js'

const CACHE_KEY = 'ccsc:data:v1'

// Gates the whole report behind a password. The app ships only ciphertext;
// this fetches it, decrypts in-browser on unlock, and provides the plaintext to
// the pages via context. The decrypted data is cached in sessionStorage so a
// refresh within the session doesn't re-prompt (cleared when the tab closes).
export default function PasswordGate({ children }) {
  const [data, setData] = useState(null)
  const [blob, setBlob] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | checking | error | missing
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    // Restore an already-unlocked session.
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        setData(JSON.parse(cached))
        return
      }
    } catch {
      /* ignore */
    }
    fetchEncrypted()
      .then((b) => {
        setBlob(b)
        setStatus('ready')
      })
      .catch(() => setStatus('missing'))
  }, [])

  useEffect(() => {
    if ((status === 'ready' || status === 'error') && inputRef.current) inputRef.current.focus()
  }, [status])

  async function onSubmit(e) {
    e.preventDefault()
    if (!password || status === 'checking') return
    setStatus('checking')
    setError('')
    try {
      const d = await decryptBlob(password, blob)
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(d))
      } catch {
        /* ignore quota */
      }
      setData(d)
    } catch {
      setStatus('error')
      setError('Incorrect password. Try again.')
      setPassword('')
    }
  }

  if (data) return <DataContext.Provider value={data}>{children}</DataContext.Provider>

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 46, height: 46, borderRadius: 11, background: '#1B5E43', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F4EFDF', fontWeight: 800, fontSize: 18, letterSpacing: '-.5px' }}>
            CC
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.4px', lineHeight: 1.1 }}>Cream City Sports Cards</div>
            <div style={{ fontSize: 12.5, color: '#6B6459', marginTop: 2 }}>H1 2026 financial report</div>
          </div>
        </div>

        <div style={{ background: '#FBF9F4', border: '1px solid #E0D8C7', borderRadius: 15, padding: '22px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: '#8A4A1C' }}>
            🔒 Private report
          </div>
          <p style={{ fontSize: 13, color: '#524B3F', lineHeight: 1.6, margin: '8px 0 16px' }}>
            {status === 'missing'
              ? 'The encrypted data file could not be loaded. Contact the owner.'
              : 'This report is password-protected. Enter the password to view it.'}
          </p>

          {status !== 'missing' && (
            <form onSubmit={onSubmit}>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                aria-label="Password"
                disabled={status === 'loading' || status === 'checking'}
                style={{ width: '100%', padding: '11px 13px', border: '1px solid ' + (error ? '#B4531F' : '#D3C9B6'), borderRadius: 9, background: '#fff', fontSize: 14, color: '#221F1A' }}
              />
              {error && <div style={{ color: '#B4531F', fontSize: 12.5, marginTop: 8 }}>{error}</div>}
              <button
                type="submit"
                disabled={status === 'loading' || status === 'checking' || !password}
                style={{ width: '100%', marginTop: 12, padding: '11px 13px', border: 'none', borderRadius: 9, background: '#1B5E43', color: '#F4EFDF', fontSize: 14, fontWeight: 700, opacity: status === 'loading' || status === 'checking' || !password ? 0.6 : 1 }}
              >
                {status === 'loading' ? 'Loading…' : status === 'checking' ? 'Unlocking…' : 'Unlock report'}
              </button>
            </form>
          )}
        </div>

        <div style={{ fontSize: 11, color: '#8A8272', lineHeight: 1.5, marginTop: 14, textAlign: 'center' }}>
          Data is encrypted (AES-256) and only decrypts in your browser with the correct password.
        </div>
      </div>
    </div>
  )
}
