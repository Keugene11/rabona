import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'live.rabona.app',
  appName: 'Rabona',
  webDir: 'mobile-shell',
  server: {
    url: 'https://rabona.live',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
  },
}

export default config
