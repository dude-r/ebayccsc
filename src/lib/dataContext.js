import { createContext, useContext } from 'react'

// Holds the decrypted dataset once the viewer unlocks the report.
export const DataContext = createContext(null)

export function useData() {
  const d = useContext(DataContext)
  if (!d) throw new Error('useData must be used inside <PasswordGate> (data not unlocked)')
  return d
}
