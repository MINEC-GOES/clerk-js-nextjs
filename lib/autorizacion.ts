import { cache } from 'react'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { forbidden } from 'next/navigation'

import {
  type ClaimsDeSesion,
  type ResumenDeAutorizacion,
  featuresDeMetadatos,
  resumen,
  tienePermisoDeOrganizacion,
  tieneRol,
} from './claims'

/**
 * Ayudantes de autorización para el servidor.
 *
 * Se usan dentro de páginas, layouts, server actions y route handlers. La
 * comprobación se hace junto al recurso y no en el proxy, que es lo que
 * recomienda Clerk: así la protección no depende de que el matcher del proxy
 * sea correcto.
 *
 * Reparto de responsabilidades:
 *
 *  - Rol y features propios de la aplicación: se leen del claim "metadata"
 *    (ver lib/claims.ts).
 *  - Plan y features de Clerk Billing, y rol y permisos de la organización
 *    activa: se comprueban con has(), que ya trae el SDK. No conviene
 *    reimplementarlo.
 *
 * Si el token no incluye el claim "metadata" (porque no se personalizó en el
 * panel de Clerk), los metadatos se piden a la Backend API. La consulta se
 * memoriza con cache() de React, así que se hace una sola vez por petición
 * aunque varias funciones la necesiten.
 */

/**
 * Metadatos públicos de un usuario, consultados a la Backend API.
 * Devuelve un objeto vacío si la consulta falla, para que la página pueda
 * seguir renderizándose sin rol ni features.
 */
const metadatosDelUsuario = cache(async (usuarioId: string): Promise<ClaimsDeSesion['metadata']> => {
  try {
    const clerk = await clerkClient()
    const usuario = await clerk.users.getUser(usuarioId)

    return (usuario.publicMetadata ?? {}) as ClaimsDeSesion['metadata']
  } catch (error) {
    console.error('No se pudieron obtener los metadatos del usuario desde Clerk.', error)

    return {}
  }
})

export interface Sesion {
  /** Identificador del usuario, o null si no ha iniciado sesión. */
  usuarioId: string | null
  claims: ClaimsDeSesion | null
  datos: ResumenDeAutorizacion
}

/** Datos de la sesión actual, sin exigir que haya una. */
export async function sesion(): Promise<Sesion> {
  const { userId, sessionClaims } = await auth()
  let claims = (sessionClaims ?? null) as ClaimsDeSesion | null

  // El token no trae el claim "metadata": se piden a la Backend API.
  if (userId && claims && claims.metadata === undefined) {
    claims = { ...claims, metadata: await metadatosDelUsuario(userId) }
  }

  return { usuarioId: userId, claims, datos: resumen(claims) }
}

/**
 * Exige una sesión válida. Si no la hay, redirige a la página de inicio de
 * sesión configurada en NEXT_PUBLIC_CLERK_SIGN_IN_URL.
 */
export async function exigirSesion(): Promise<Sesion> {
  await auth.protect()

  return sesion()
}

/**
 * Exige que el usuario tenga alguno de los roles indicados en
 * public_metadata.role. Responde 403 si no los tiene.
 */
export async function exigirRol(...roles: string[]): Promise<Sesion> {
  const actual = await exigirSesion()

  if (!tieneRol(actual.claims, ...roles)) {
    forbidden()
  }

  return actual
}

/**
 * Indica si el usuario tiene una feature, venga de los metadatos públicos o
 * del plan de Clerk Billing.
 */
export async function tieneFeature(feature: string): Promise<boolean> {
  const { claims } = await sesion()
  const { has } = await auth()

  return featuresDeMetadatos(claims).includes(feature) || has({ feature })
}

/** Exige una feature. Responde 403 si el usuario no la tiene. */
export async function exigirFeature(feature: string): Promise<Sesion> {
  const actual = await exigirSesion()

  if (!(await tieneFeature(feature))) {
    forbidden()
  }

  return actual
}

/**
 * Exige un permiso en la organización activa, con la forma
 * "org:<feature>:<permiso>". Responde 403 si no lo tiene.
 */
export async function exigirPermiso(permiso: string): Promise<Sesion> {
  const actual = await exigirSesion()
  const { has } = await auth()

  if (!has({ permission: permiso }) && !tienePermisoDeOrganizacion(actual.claims, permiso)) {
    forbidden()
  }

  return actual
}
