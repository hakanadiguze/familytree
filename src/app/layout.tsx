import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Family Tree',
  description: 'Create and share beautiful family trees — for families, mythologies, and more.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icon-192.png',
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Family Tree' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#534AB7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{ style: { fontSize: 14, borderRadius: 10 }, duration: 2500 }}
          />
        </AuthProvider>
        {/* Buy Me a Coffee widget — loaded globally */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          data-name="BMC-Widget"
          data-cfasync="false"
          src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"
          data-id="hakanadigui"
          data-description="Support me on Buy me a coffee!"
          data-message=""
          data-color="#5F7FFF"
          data-position="Right"
          data-x_margin="18"
          data-y_margin="18"
        />
      </body>
    </html>
  )
}
