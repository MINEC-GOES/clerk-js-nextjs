import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // El proyecto es la raíz del workspace de Turbopack. Sin esto, Next.js busca
  // hacia arriba y puede tomar por raíz un directorio que contenga otro
  // package-lock.json.
  turbopack: {
    root: import.meta.dirname,
  },
  // No generar AGENTS.md ni CLAUDE.md automáticamente.
  agentRules: false,
  experimental: {
    // Habilita forbidden() y unauthorized() de next/navigation, que se usan
    // para responder 403 en las páginas protegidas por rol o feature.
    authInterrupts: true,
  },
}

export default nextConfig
