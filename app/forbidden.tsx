import Link from 'next/link'

/**
 * Página que Next.js muestra cuando el servidor llama a forbidden().
 * La respuesta lleva el código 403.
 */
export default function Prohibido() {
  return (
    <div className="tarjeta">
      <h1>No autorizado</h1>
      <p>
        Ha iniciado sesión correctamente, pero su cuenta no tiene el rol, la feature o el permiso que
        esta página requiere.
      </p>
      <p>
        <Link href="/panel">Volver al panel</Link>
      </p>
    </div>
  )
}
