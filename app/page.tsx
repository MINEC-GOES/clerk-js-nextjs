import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SignIn } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'

export default async function Inicio() {
  const { userId } = await auth()

  // Si ya hay sesión, no tiene sentido mostrar el formulario.
  if (userId) {
    redirect('/panel')
  }

  return (
    <>
      <div className="tarjeta">
        <h1>Iniciar sesión</h1>
        <p>
          Este formulario lo genera Clerk en el navegador. Al completarlo, Clerk crea una sesión y
          guarda el token en una cookie que Next.js verifica en el servidor en cada petición.
        </p>
        <p>
          Si no tiene cuenta, puede <Link href="/registro">registrarse</Link>.
        </p>
      </div>

      <div className="centrado">
        <SignIn routing="hash" signUpUrl="/registro" fallbackRedirectUrl="/panel" />
      </div>
    </>
  )
}
