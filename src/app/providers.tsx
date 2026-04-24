'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'
import ThemeProvider from '@/components/ThemeProvider'

const GOOGLE_CLIENT_ID = '372750643272-3ab0ptudlj2s8vofsbumj7n5jiaa060e.apps.googleusercontent.com'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}
