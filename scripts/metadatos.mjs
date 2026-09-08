#!/usr/bin/env node
/**
 * Muestra o actualiza el rol y las features de un usuario en los metadatos
 * públicos de Clerk. Es el equivalente de un comando administrativo.
 *
 *   npm run metadatos -- user_123 --rol=admin --feature=reportes --feature=exportar
 *   npm run metadatos -- user_123 --quitar-rol
 *   npm run metadatos -- user_123 --quitar-features
 *   npm run metadatos -- user_123
 *
 * Lee CLERK_SECRET_KEY de .env.local (el script npm usa --env-file).
 */

import { createClerkClient } from '@clerk/backend'

const argumentos = process.argv.slice(2)
const usuarioId = argumentos.find((argumento) => !argumento.startsWith('--'))

if (!usuarioId) {
  console.error('Uso: npm run metadatos -- <user_id> [--rol=admin] [--feature=nombre] [--quitar-rol] [--quitar-features]')
  process.exit(1)
}

const secretKey = process.env.CLERK_SECRET_KEY

if (!secretKey) {
  console.error('Falta CLERK_SECRET_KEY. Defínala en .env.local.')
  process.exit(1)
}

const opcion = (nombre) => argumentos.find((a) => a.startsWith(`--${nombre}=`))?.split('=').slice(1).join('=')
const bandera = (nombre) => argumentos.includes(`--${nombre}`)
const features = argumentos
  .filter((a) => a.startsWith('--feature='))
  .map((a) => a.slice('--feature='.length))
  .filter((f) => f !== '')

const publicMetadata = {}

if (bandera('quitar-rol')) {
  publicMetadata.role = null
} else if (opcion('rol')) {
  publicMetadata.role = opcion('rol')
}

if (bandera('quitar-features')) {
  publicMetadata.features = null
} else if (features.length > 0) {
  publicMetadata.features = [...new Set(features)]
}

const clerk = createClerkClient({ secretKey })

try {
  if (Object.keys(publicMetadata).length === 0) {
    const usuario = await clerk.users.getUser(usuarioId)
    console.log(JSON.stringify(usuario.publicMetadata, null, 2))
  } else {
    // Clerk combina los metadatos clave por clave: las nuevas se agregan, las
    // existentes se reemplazan y las que llegan con null se eliminan.
    const usuario = await clerk.users.updateUserMetadata(usuarioId, { publicMetadata })
    console.log(`Metadatos actualizados para ${usuarioId}.`)
    console.log(JSON.stringify(usuario.publicMetadata, null, 2))
  }
} catch (error) {
  console.error('Error al comunicarse con la Backend API de Clerk:', error.message)
  process.exit(1)
}
