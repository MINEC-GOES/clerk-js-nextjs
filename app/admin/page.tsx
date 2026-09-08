import Link from 'next/link'

import { exigirRol } from '@/lib/autorizacion'

export default async function Admin() {
  // Exige el rol "admin" de public_metadata. Sin sesión redirige al inicio de
  // sesión; con sesión pero sin el rol responde 403.
  const { datos } = await exigirRol('admin')

  return (
    <div className="tarjeta">
      <h1>Zona de administración</h1>
      <p>
        Esta página llama a <code>exigirRol(&apos;admin&apos;)</code>. Solo la ven los usuarios cuyo{' '}
        <code>public_metadata.role</code> es <code>admin</code>.
      </p>
      <dl>
        <dt>Usuario</dt>
        <dd>{datos.usuario}</dd>
        <dt>Rol</dt>
        <dd>{datos.rol}</dd>
      </dl>
      <p>
        <Link href="/panel">Volver al panel</Link>
      </p>
    </div>
  )
}
