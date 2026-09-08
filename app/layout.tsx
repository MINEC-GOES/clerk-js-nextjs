import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ClerkProvider, Show, SignInButton, UserButton } from '@clerk/nextjs'

import './globals.css'

export const metadata: Metadata = {
  title: 'Clerk con Next.js',
  description: 'Ejemplo de integración de Clerk con Next.js en español',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        {/* ClerkProvider carga Clerk en el navegador y deja disponibles los
            componentes y hooks. Lee NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. */}
        <ClerkProvider>
          <header>
            <Link href="/" className="marca">
              Clerk con Next.js
            </Link>
            <nav>
              {/* <Show> reemplaza a <SignedIn> y <SignedOut>, que se
                  eliminaron en la versión 7 del SDK (Core 3). */}
              <Show when="signed-in">
                <Link href="/panel">Panel</Link>
                <UserButton />
              </Show>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button type="button">Iniciar sesión</button>
                </SignInButton>
              </Show>
            </nav>
          </header>

          <main>{children}</main>
        </ClerkProvider>
      </body>
    </html>
  )
}
