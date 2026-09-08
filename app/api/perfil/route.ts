import { NextResponse } from 'next/server'

import { sesion } from '@/lib/autorizacion'

/**
 * Endpoint JSON protegido.
 *
 * Acepta la cookie de sesión (navegación normal) y la cabecera
 * "Authorization: Bearer <token>", que es lo que usaría un cliente externo.
 * Clerk resuelve ambas en auth() gracias al proxy.
 */
export async function GET() {
  const { usuarioId, claims, datos } = await sesion()

  if (!usuarioId) {
    return NextResponse.json(
      { message: 'No autenticado.', reason: 'No se encontró una sesión válida de Clerk.' },
      { status: 401 },
    )
  }

  return NextResponse.json({ ...datos, claims })
}
