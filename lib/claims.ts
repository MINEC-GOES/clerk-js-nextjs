/**
 * Lectura de los datos de autorización que vienen en el token de sesión.
 *
 * Son funciones puras: reciben los claims y no dependen de Next.js ni de la
 * red, de modo que se pueden probar directamente (ver tests/claims.test.ts).
 *
 * Clerk entrega tres fuentes distintas de datos de autorización:
 *
 *  - Metadatos públicos del usuario (claim "metadata"): rol y features
 *    propios de la aplicación, por ejemplo {"role": "admin",
 *    "features": ["reportes"]}.
 *  - Clerk Billing: plan activo (claim "pla") y features del plan (claim
 *    "fea"), ambos con prefijo de alcance "u:" (usuario) u "o:"
 *    (organización).
 *  - Organización activa: en los tokens versión 2 viene en el claim "o" en
 *    forma compacta; en los de versión 1, en org_id, org_slug, org_role y
 *    org_permissions.
 */

/** Forma de los claims que interesan a la aplicación. */
export interface ClaimsDeSesion {
  sub?: string
  sid?: string
  v?: number
  metadata?: { role?: string; features?: string[] }
  pla?: string
  fea?: string
  o?: { id?: string; slg?: string; rol?: string; per?: string; fpm?: string }
  org_id?: string
  org_slug?: string
  org_role?: string
  org_permissions?: string[]
  [clave: string]: unknown
}

export interface Organizacion {
  id: string | null
  slug: string | null
  rol: string | null
  permisos: string[]
}

export interface ResumenDeAutorizacion {
  usuario: string | null
  sesion: string | null
  rol: string | null
  features: string[]
  plan: string | null
  organizacion: Organizacion | null
}

const textoONulo = (valor: unknown): string | null =>
  typeof valor === 'string' && valor !== '' ? valor : null

const sinPrefijoOrg = (rol: unknown): string | null => {
  const texto = textoONulo(rol)

  return texto === null ? null : texto.replace(/^org:/, '')
}

/** Rol guardado en public_metadata.role, o null si no tiene. */
export function rol(claims: ClaimsDeSesion | null | undefined): string | null {
  return textoONulo(claims?.metadata?.role)
}

export function tieneRol(claims: ClaimsDeSesion | null | undefined, ...roles: string[]): boolean {
  const actual = rol(claims)

  return actual !== null && roles.includes(actual)
}

/** Features declaradas en public_metadata.features. */
export function featuresDeMetadatos(claims: ClaimsDeSesion | null | undefined): string[] {
  const features = claims?.metadata?.features

  return Array.isArray(features) ? features.filter((f): f is string => typeof f === 'string' && f !== '') : []
}

/**
 * Features del claim "fea" de Clerk Billing, sin el prefijo de alcance.
 *
 * El claim tiene la forma "u:premium,o:reportes".
 */
export function featuresDeBilling(claims: ClaimsDeSesion | null | undefined): string[] {
  const fea = claims?.fea

  if (typeof fea !== 'string' || fea === '') {
    return []
  }

  const nombres = fea
    .split(',')
    .map((entrada) => {
      const partes = entrada.trim().split(':')

      return (partes.length > 1 ? partes[1] : partes[0]).trim()
    })
    .filter((nombre) => nombre !== '')

  return [...new Set(nombres)]
}

/** Todas las features del usuario: metadatos más Clerk Billing. */
export function features(claims: ClaimsDeSesion | null | undefined): string[] {
  return [...new Set([...featuresDeMetadatos(claims), ...featuresDeBilling(claims)])]
}

export function tieneFeature(claims: ClaimsDeSesion | null | undefined, feature: string): boolean {
  return features(claims).includes(feature)
}

/** Plan activo de Clerk Billing (claim "pla"), sin el prefijo de alcance. */
export function plan(claims: ClaimsDeSesion | null | undefined): string | null {
  const pla = textoONulo(claims?.pla)

  if (pla === null) {
    return null
  }

  const partes = pla.split(':')

  return (partes.length > 1 ? partes[1] : partes[0]) || null
}

/**
 * Expande el mapa "fpm" a permisos con la forma "org:<feature>:<permiso>".
 *
 * Ejemplo: fea "o:reportes,u:premium", per "read,manage", fpm "3,0".
 * El primer valor (3, binario 11) corresponde a o:reportes y activa los
 * permisos de las posiciones 0 y 1: org:reportes:read y org:reportes:manage.
 * El segundo (0) corresponde a u:premium, que además no es de organización.
 */
export function expandirPermisos(fea: string, per: string, fpm: string): string[] {
  if (fea === '' || per === '' || fpm === '') {
    return []
  }

  const listaFeatures = fea.split(',').map((f) => f.trim())
  const permisos = per.split(',').map((p) => p.trim())
  const resultado: string[] = []

  fpm.split(',').forEach((mascara, indice) => {
    const [alcance, feature] = (listaFeatures[indice] ?? '').split(':')

    if (!feature || !alcance?.includes('o')) {
      return
    }

    const bits = Number.parseInt(mascara.trim(), 10)

    if (!Number.isFinite(bits)) {
      return
    }

    permisos.forEach((permiso, posicion) => {
      if (permiso !== '' && (bits & (1 << posicion)) !== 0) {
        resultado.push(`org:${feature}:${permiso}`)
      }
    })
  })

  return [...new Set(resultado)]
}

/** Organización activa, tomada del claim "o" (versión 2) o de org_* (versión 1). */
export function organizacion(claims: ClaimsDeSesion | null | undefined): Organizacion | null {
  const compacta = claims?.o

  if (compacta && typeof compacta === 'object') {
    return {
      id: textoONulo(compacta.id),
      slug: textoONulo(compacta.slg),
      rol: sinPrefijoOrg(compacta.rol),
      permisos: expandirPermisos(
        typeof claims?.fea === 'string' ? claims.fea : '',
        typeof compacta.per === 'string' ? compacta.per : '',
        typeof compacta.fpm === 'string' ? compacta.fpm : '',
      ),
    }
  }

  const id = textoONulo(claims?.org_id)

  if (id === null) {
    return null
  }

  const permisos = claims?.org_permissions

  return {
    id,
    slug: textoONulo(claims?.org_slug),
    rol: sinPrefijoOrg(claims?.org_role),
    permisos: Array.isArray(permisos) ? permisos.filter((p): p is string => typeof p === 'string') : [],
  }
}

export function tienePermisoDeOrganizacion(
  claims: ClaimsDeSesion | null | undefined,
  permiso: string,
): boolean {
  return organizacion(claims)?.permisos.includes(permiso) ?? false
}

/** Resumen de todo lo anterior, para mostrarlo o devolverlo en JSON. */
export function resumen(claims: ClaimsDeSesion | null | undefined): ResumenDeAutorizacion {
  return {
    usuario: textoONulo(claims?.sub),
    sesion: textoONulo(claims?.sid),
    rol: rol(claims),
    features: features(claims),
    plan: plan(claims),
    organizacion: organizacion(claims),
  }
}
