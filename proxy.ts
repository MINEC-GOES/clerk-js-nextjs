import { clerkMiddleware } from '@clerk/nextjs/server'

/**
 * Proxy de Clerk.
 *
 * En Next.js 16 este archivo se llama proxy.ts; en Next.js 15 y anteriores el
 * mismo contenido va en middleware.ts.
 *
 * clerkMiddleware() no protege ninguna ruta por sí solo: lo que hace es leer
 * el token de sesión de la petición y dejar disponible el objeto de
 * autenticación para auth() en páginas, layouts y route handlers.
 *
 * La protección se hace junto al recurso (ver lib/autorizacion.ts), que es lo
 * que recomienda Clerk: así una página o un endpoint queda protegido aunque
 * alguien cambie el matcher de este archivo.
 */
export default clerkMiddleware()

export const config = {
  matcher: [
    // Todas las rutas salvo los archivos estáticos de Next.js.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Rutas de API.
    '/(api|trpc)(.*)',
    // Endpoints internos de Clerk.
    '/__clerk/(.*)',
  ],
}
