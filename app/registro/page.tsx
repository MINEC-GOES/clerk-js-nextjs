import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'

export default async function Registro() {
  const { userId } = await auth()

  if (userId) {
    redirect('/panel')
  }

  return (
    <>
      <div className="tarjeta">
        <h1>Crear cuenta</h1>
        <p>
          Si ya tiene cuenta, puede <Link href="/">iniciar sesión</Link>.
        </p>
      </div>

      <div className="centrado">
        <SignUp routing="hash" signInUrl="/" fallbackRedirectUrl="/panel" />
      </div>
    </>
  )
}
