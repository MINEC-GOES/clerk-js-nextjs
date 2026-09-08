/**
 * Tipos de los claims personalizados del token de sesión de Clerk.
 *
 * Clerk usa la interfaz global CustomJwtSessionClaims para tipar
 * sessionClaims. Aquí se declara el claim "metadata", que se agrega en el
 * panel de Clerk (Configure > Sessions > Customize session token) con:
 *
 *   { "metadata": "{{user.public_metadata}}" }
 */

export type Rol = 'admin' | 'editor' | 'lector'

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: Rol
      features?: string[]
    }
  }
}
