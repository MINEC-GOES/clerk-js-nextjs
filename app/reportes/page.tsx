import Link from 'next/link'

import { exigirFeature } from '@/lib/autorizacion'

export default async function Reportes() {
  // La feature puede venir de public_metadata.features o del plan de Clerk
  // Billing (claim "fea"), que se comprueba con has().
  const { datos } = await exigirFeature('reportes')

  return (
    <div className="tarjeta">
      <h1>Reportes</h1>
      <p>
        Esta página requiere la feature <code>reportes</code>. La comprobación la hace{' '}
        <code>exigirFeature(&apos;reportes&apos;)</code>, que acepta tanto las features de los
        metadatos como las del plan de Clerk Billing.
      </p>
      <dl>
        <dt>Usuario</dt>
        <dd>{datos.usuario}</dd>
        <dt>Features</dt>
        <dd>{datos.features.join(', ') || 'Ninguna en los metadatos'}</dd>
        <dt>Plan</dt>
        <dd>{datos.plan ?? 'Sin plan'}</dd>
      </dl>
      <p>
        <Link href="/panel">Volver al panel</Link>
      </p>
    </div>
  )
}
