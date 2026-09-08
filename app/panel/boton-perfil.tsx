'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'

/**
 * Componente de cliente que llama al endpoint protegido de dos maneras:
 * con la cookie de sesión y con el token en la cabecera Authorization.
 */
export default function BotonPerfil() {
  const { getToken } = useAuth()
  const [respuesta, setRespuesta] = useState('Sin respuesta todavía.')

  async function llamar(conBearer: boolean) {
    const cabeceras: Record<string, string> = { Accept: 'application/json' }

    if (conBearer) {
      const token = await getToken()

      if (!token) {
        setRespuesta('No hay sesión activa en el navegador.')
        return
      }

      cabeceras.Authorization = `Bearer ${token}`
    }

    const resultado = await fetch('/api/perfil', { headers: cabeceras })

    setRespuesta(
      `${resultado.status} ${resultado.statusText}\n\n${JSON.stringify(await resultado.json(), null, 2)}`,
    )
  }

  return (
    <>
      <p>
        <button type="button" onClick={() => llamar(false)}>
          Llamar con la cookie
        </button>{' '}
        <button type="button" onClick={() => llamar(true)}>
          Llamar con Bearer
        </button>
      </p>
      <pre>{respuesta}</pre>
    </>
  )
}
