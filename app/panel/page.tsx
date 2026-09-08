import Link from 'next/link'
import { currentUser } from '@clerk/nextjs/server'

import { exigirSesion, tieneFeature } from '@/lib/autorizacion'
import { tieneRol } from '@/lib/claims'
import BotonPerfil from './boton-perfil'

export default async function Panel() {
  const { claims, datos } = await exigirSesion()

  // currentUser() consulta la Backend API y devuelve el perfil completo.
  const usuario = await currentUser()

  const esAdmin = tieneRol(claims, 'admin')
  const verReportes = await tieneFeature('reportes')

  return (
    <>
      <div className="tarjeta">
        <h1>Panel protegido</h1>
        <p>
          Esta página llama a <code>exigirSesion()</code>, que usa <code>auth.protect()</code>. Sin
          sesión válida, Clerk redirige al formulario de inicio de sesión.
        </p>
      </div>

      <div className="tarjeta">
        <h2>Datos verificados en el servidor</h2>
        <dl>
          <dt>Usuario</dt>
          <dd>{datos.usuario}</dd>
          <dt>Sesión</dt>
          <dd>{datos.sesion}</dd>
          <dt>Nombre</dt>
          <dd>{[usuario?.firstName, usuario?.lastName].filter(Boolean).join(' ') || 'Sin nombre'}</dd>
          <dt>Correo</dt>
          <dd>{usuario?.primaryEmailAddress?.emailAddress ?? 'Sin correo principal'}</dd>
        </dl>
      </div>

      <div className="tarjeta">
        <h2>Rol, features y organización</h2>
        <dl>
          <dt>Rol</dt>
          <dd>{datos.rol ?? 'Sin rol'}</dd>
          <dt>Features</dt>
          <dd>{datos.features.length > 0 ? datos.features.join(', ') : 'Sin features'}</dd>
          <dt>Plan</dt>
          <dd>{datos.plan ?? 'Sin plan'}</dd>
          <dt>Organización</dt>
          <dd>{datos.organizacion ? (datos.organizacion.slug ?? datos.organizacion.id) : 'Sin organización activa'}</dd>
          {datos.organizacion ? (
            <>
              <dt>Rol en la organización</dt>
              <dd>{datos.organizacion.rol ?? 'Sin rol'}</dd>
              <dt>Permisos</dt>
              <dd>
                {datos.organizacion.permisos.length > 0
                  ? datos.organizacion.permisos.join(', ')
                  : 'Sin permisos'}
              </dd>
            </>
          ) : null}
        </dl>

        <h3>Accesos según autorización</h3>
        <ul>
          <li>
            {esAdmin ? (
              <Link href="/admin">Zona de administración</Link>
            ) : (
              'Zona de administración: no disponible, requiere el rol admin.'
            )}
          </li>
          <li>
            {verReportes ? (
              <Link href="/reportes">Reportes</Link>
            ) : (
              'Reportes: no disponible, requiere la feature reportes.'
            )}
          </li>
        </ul>
        <p>
          Para asignar rol y features desde la terminal:{' '}
          <code>npm run metadatos -- {datos.usuario} --rol=admin --feature=reportes</code>
        </p>
      </div>

      <div className="tarjeta">
        <h2>Claims del token</h2>
        <pre>{JSON.stringify(claims, null, 2)}</pre>
      </div>

      <div className="tarjeta">
        <h2>Consumir el endpoint protegido</h2>
        <p>
          El botón llama a <code>GET /api/perfil</code>. La primera llamada usa la cookie de sesión,
          igual que una navegación normal. La segunda envía el token en la cabecera{' '}
          <code>Authorization</code>, que es como lo haría un cliente externo o una aplicación móvil.
        </p>
        <BotonPerfil />
      </div>
    </>
  )
}
