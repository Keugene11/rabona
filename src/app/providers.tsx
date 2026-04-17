'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'
import ThemeProvider from '@/components/ThemeProvider'

const GOOGLE_CLIENT_ID = '385342744199-occekpb40kb9r4a21oojsfta0t14etbi.apps.googleusercontent.com'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}
