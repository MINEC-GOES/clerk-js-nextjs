import { describe, expect, it } from 'vitest'

import {
  expandirPermisos,
  features,
  featuresDeBilling,
  featuresDeMetadatos,
  organizacion,
  plan,
  resumen,
  rol,
  tieneFeature,
  tienePermisoDeOrganizacion,
  tieneRol,
} from '../lib/claims'

/**
 * Pruebas de la lectura de claims. No dependen de la red ni de Next.js: se
 * pasan claims con la misma forma que emite Clerk.
 */

const base = { sub: 'user_123', sid: 'sess_456' }

describe('rol y features de los metadatos públicos', () => {
  it('lee el rol del claim metadata', () => {
    expect(rol({ ...base, metadata: { role: 'admin' } })).toBe('admin')
    expect(tieneRol({ ...base, metadata: { role: 'admin' } }, 'editor', 'admin')).toBe(true)
    expect(tieneRol({ ...base, metadata: { role: 'editor' } }, 'admin')).toBe(false)
  })

  it('devuelve null sin metadatos o con metadatos vacíos', () => {
    expect(rol(base)).toBeNull()
    expect(rol({ ...base, metadata: {} })).toBeNull()
    expect(rol(null)).toBeNull()
    expect(tieneRol(null, 'admin')).toBe(false)
  })

  it('descarta valores que no son cadenas en features', () => {
    const claims = { ...base, metadata: { features: ['reportes', '', 42, null] } } as never

    expect(featuresDeMetadatos(claims)).toEqual(['reportes'])
  })
})

describe('plan y features de Clerk Billing', () => {
  it('quita el prefijo de alcance del claim fea', () => {
    expect(featuresDeBilling({ ...base, fea: 'u:premium,o:reportes' })).toEqual(['premium', 'reportes'])
  })

  it('tolera espacios, entradas vacías y nombres sin alcance', () => {
    expect(featuresDeBilling({ ...base, fea: ' u:reportes , ,o:reportes,premium ' })).toEqual([
      'reportes',
      'premium',
    ])
  })

  it('devuelve una lista vacía sin el claim', () => {
    expect(featuresDeBilling(base)).toEqual([])
    expect(featuresDeBilling({ ...base, fea: '' })).toEqual([])
  })

  it('quita el prefijo de alcance del claim pla', () => {
    expect(plan({ ...base, pla: 'u:pro' })).toBe('pro')
    expect(plan({ ...base, pla: 'o:enterprise' })).toBe('enterprise')
    expect(plan({ ...base, pla: 'gratis' })).toBe('gratis')
    expect(plan(base)).toBeNull()
  })
})

describe('features combinadas', () => {
  it('une metadatos y Clerk Billing sin repetir', () => {
    const claims = { ...base, metadata: { features: ['reportes', 'exportar'] }, fea: 'u:reportes,u:premium' }

    expect(features(claims)).toEqual(['reportes', 'exportar', 'premium'])
    expect(tieneFeature(claims, 'premium')).toBe(true)
    expect(tieneFeature(claims, 'facturacion')).toBe(false)
  })
})

describe('organización activa', () => {
  it('expande el mapa fpm a permisos completos', () => {
    // fpm "3,0": para o:reportes (índice 0) aplican los permisos de las
    // posiciones 0 y 1; u:premium (índice 1) no es de organización.
    const claims = {
      ...base,
      v: 2,
      fea: 'o:reportes,u:premium',
      o: { id: 'org_1', slg: 'minec', rol: 'admin', per: 'read,manage', fpm: '3,0' },
    }

    expect(organizacion(claims)).toEqual({
      id: 'org_1',
      slug: 'minec',
      rol: 'admin',
      permisos: ['org:reportes:read', 'org:reportes:manage'],
    })
    expect(tienePermisoDeOrganizacion(claims, 'org:reportes:manage')).toBe(true)
    expect(tienePermisoDeOrganizacion(claims, 'org:reportes:delete')).toBe(false)
  })

  it('respeta la posición de cada bit', () => {
    expect(expandirPermisos('o:reportes', 'read,manage', '1')).toEqual(['org:reportes:read'])
    expect(expandirPermisos('o:reportes', 'read,manage', '2')).toEqual(['org:reportes:manage'])
    expect(expandirPermisos('o:reportes', 'read,manage', '0')).toEqual([])
  })

  it('ignora las features que no son de organización y los datos incompletos', () => {
    expect(expandirPermisos('u:premium', 'read', '1')).toEqual([])
    expect(expandirPermisos('', 'read', '1')).toEqual([])
    expect(expandirPermisos('o:reportes', '', '1')).toEqual([])
    expect(expandirPermisos('o:reportes', 'read', '')).toEqual([])
  })

  it('tolera un fpm más largo que la lista de features', () => {
    expect(expandirPermisos('o:reportes', 'read,manage', '1,7,3')).toEqual(['org:reportes:read'])
  })

  it('acepta los claims de los tokens versión 1', () => {
    const claims = {
      ...base,
      org_id: 'org_1',
      org_slug: 'minec',
      org_role: 'org:admin',
      org_permissions: ['org:sys_profile:manage'],
    }

    expect(organizacion(claims)).toEqual({
      id: 'org_1',
      slug: 'minec',
      rol: 'admin',
      permisos: ['org:sys_profile:manage'],
    })
  })

  it('devuelve null sin organización activa', () => {
    expect(organizacion({ ...base, v: 2, fea: 'u:premium' })).toBeNull()
    expect(organizacion(base)).toBeNull()
    expect(tienePermisoDeOrganizacion(base, 'org:reportes:read')).toBe(false)
  })
})

describe('resumen', () => {
  it('reúne todas las fuentes en un solo objeto', () => {
    expect(
      resumen({
        ...base,
        v: 2,
        metadata: { role: 'admin', features: ['exportar'] },
        pla: 'u:pro',
        fea: 'o:reportes',
        o: { id: 'org_1', slg: 'minec', rol: 'member', per: 'read,manage', fpm: '1' },
      }),
    ).toEqual({
      usuario: 'user_123',
      sesion: 'sess_456',
      rol: 'admin',
      features: ['exportar', 'reportes'],
      plan: 'pro',
      organizacion: { id: 'org_1', slug: 'minec', rol: 'member', permisos: ['org:reportes:read'] },
    })
  })

  it('funciona sin claims', () => {
    expect(resumen(null)).toEqual({
      usuario: null,
      sesion: null,
      rol: null,
      features: [],
      plan: null,
      organizacion: null,
    })
  })
})
