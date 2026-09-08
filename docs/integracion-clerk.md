# Integración de Clerk con Next.js

Esta guía explica, paso a paso, cómo agregar Clerk como sistema de autenticación y autorización a una aplicación Next.js con App Router. Cada paso corresponde a un cambio concreto que se puede seguir en el historial del repositorio.

## Índice

1. [Cómo funciona la integración](#1-cómo-funciona-la-integración)
2. [Crear el proyecto Next.js](#2-crear-el-proyecto-nextjs)
3. [Crear la aplicación en Clerk y obtener las claves](#3-crear-la-aplicación-en-clerk-y-obtener-las-claves)
4. [Instalar el SDK y configurar el entorno](#4-instalar-el-sdk-y-configurar-el-entorno)
5. [El proxy de Clerk](#5-el-proxy-de-clerk)
6. [ClerkProvider y los componentes del navegador](#6-clerkprovider-y-los-componentes-del-navegador)
7. [Páginas de inicio de sesión y registro](#7-páginas-de-inicio-de-sesión-y-registro)
8. [Leer la sesión en el servidor](#8-leer-la-sesión-en-el-servidor)
9. [Proteger páginas y endpoints](#9-proteger-páginas-y-endpoints)
10. [Roles y features en los datos del usuario](#10-roles-y-features-en-los-datos-del-usuario)
11. [Pruebas automatizadas](#11-pruebas-automatizadas)
12. [Ejecutar y probar la aplicación](#12-ejecutar-y-probar-la-aplicación)
13. [Consideraciones para producción](#13-consideraciones-para-producción)
14. [Solución de problemas](#14-solución-de-problemas)

## 1. Cómo funciona la integración

Clerk separa la autenticación en dos partes:

- **En el navegador**, `ClerkProvider` carga Clerk y sus componentes muestran los formularios de inicio de sesión y registro. Al terminar, Clerk mantiene un token de sesión (un JWT firmado con RS256) en una cookie del dominio de la aplicación. Ese token caduca cada 60 segundos y Clerk lo renueva automáticamente mientras la pestaña está abierta.
- **En el servidor**, Next.js no participa en el inicio de sesión. En cada petición, el proxy de Clerk lee el token y lo verifica, y `auth()` deja disponible el resultado en páginas, layouts, server actions y route handlers.

El token puede llegar de dos maneras:

| Escenario | Cómo llega el token |
| --- | --- |
| Navegación normal | Cookie de sesión, enviada automáticamente por el navegador. |
| Cliente externo o aplicación móvil | Cabecera `Authorization: Bearer <token>`, obtenida con `getToken()`. |

`auth()` resuelve ambas sin que la aplicación tenga que distinguirlas.

## 2. Crear el proyecto Next.js

```bash
npx create-next-app@latest clerk-js-nextjs --typescript --eslint --app --no-src-dir --no-tailwind --turbopack --import-alias "@/*"
cd clerk-js-nextjs
```

Este es el estado de la rama `main` del repositorio: Next.js 16 con App Router, TypeScript y ESLint, sin ninguna modificación.

## 3. Crear la aplicación en Clerk y obtener las claves

1. Entre a https://dashboard.clerk.com y cree una aplicación (o use una existente).
2. Active los métodos de inicio de sesión que necesite en **User & Authentication**. En la instancia usada para este proyecto solo está habilitado Google.
3. En **Configure > API Keys** copie:
   - **Publishable key** (`pk_test_...` en desarrollo, `pk_live_...` en producción). Viaja al navegador y no es secreta.
   - **Secret key** (`sk_test_...` o `sk_live_...`). Solo se usa en el servidor. Nunca debe subirse al repositorio ni exponerse al navegador.

## 4. Instalar el SDK y configurar el entorno

```bash
npm install @clerk/nextjs
```

El proyecto instala además `@clerk/backend`, que usa el script de la terminal para hablar con la Backend API fuera del contexto de Next.js.

Cree `.env.local` a partir de `.env.example`:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxx

# Rutas propias de inicio de sesión y registro. Clerk redirige a ellas cuando
# auth.protect() encuentra una petición sin sesión.
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/registro
```

El prefijo `NEXT_PUBLIC_` indica que la variable llega al navegador. La clave secreta no lo lleva, así que se queda en el servidor.

`.env.local` está en `.gitignore`. Para que `.env.example` sí se versione, el `.gitignore` incluye la línea `!.env.example` después de `.env*`.

Además, `next.config.ts` habilita una opción experimental:

```ts
const nextConfig: NextConfig = {
  turbopack: { root: import.meta.dirname },
  agentRules: false,
  experimental: {
    // Habilita forbidden() y unauthorized() de next/navigation.
    authInterrupts: true,
  },
}
```

`authInterrupts` es lo que permite responder `403` con `forbidden()` desde una página. `turbopack.root` evita que Next.js tome por raíz del proyecto un directorio superior si encuentra otro `package-lock.json` fuera del repositorio.

## 5. El proxy de Clerk

Cree `proxy.ts` en la raíz del proyecto:

```ts
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
```

Dos detalles importantes:

- **El nombre del archivo depende de la versión de Next.js.** En Next.js 16 se llama `proxy.ts`; en Next.js 15 y anteriores, `middleware.ts`. El contenido es el mismo. Si el archivo tiene el nombre equivocado, no se ejecuta y `auth()` devuelve siempre una sesión vacía.
- **`clerkMiddleware()` no protege ninguna ruta por sí solo.** Lo que hace es leer y verificar el token y dejar el resultado disponible para `auth()`. La protección se hace junto al recurso (sección 9). Clerk recomienda expresamente ese enfoque en lugar de listar rutas protegidas en el proxy con `createRouteMatcher`, porque así una página o un endpoint queda protegido aunque alguien cambie el matcher.

## 6. ClerkProvider y los componentes del navegador

En `app/layout.tsx`:

```tsx
import { ClerkProvider, Show, SignInButton, UserButton } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ClerkProvider>
          <header>
            <Link href="/" className="marca">Clerk con Next.js</Link>
            <nav>
              <Show when="signed-in">
                <Link href="/panel">Panel</Link>
                <UserButton />
              </Show>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button type="button">Iniciar sesión</button>
                </SignInButton>
              </Show>
            </nav>
          </header>
          <main>{children}</main>
        </ClerkProvider>
      </body>
    </html>
  )
}
```

Nota sobre la versión del SDK: en `@clerk/nextjs` 7 (Core 3) los componentes `<SignedIn>` y `<SignedOut>` se eliminaron. Siguen exportándose, pero al renderizarlos lanzan un error y la página responde `500`. El reemplazo es `<Show>`, que además acepta condiciones de autorización:

```tsx
<Show when="signed-in">...</Show>
<Show when={{ role: 'admin' }}>...</Show>
<Show when={{ feature: 'reportes' }} fallback={<p>No disponible en su plan.</p>}>...</Show>
<Show when={(has) => has({ permission: 'org:reportes:manage' })}>...</Show>
```

## 7. Páginas de inicio de sesión y registro

`app/page.tsx` monta el componente `SignIn` y `app/registro/page.tsx` monta `SignUp`. Ambas redirigen al panel si ya hay sesión:

```tsx
const { userId } = await auth()

if (userId) {
  redirect('/panel')
}

return <SignIn routing="hash" signUpUrl="/registro" fallbackRedirectUrl="/panel" />
```

`routing="hash"` permite montar el formulario en cualquier ruta sin crear rutas atrapatodo (`[[...sign-in]]`). Como estas páginas son las que indican `NEXT_PUBLIC_CLERK_SIGN_IN_URL` y `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, Clerk redirige a ellas cuando una página protegida no encuentra sesión.

## 8. Leer la sesión en el servidor

`auth()` devuelve el objeto de autenticación de la petición:

```ts
import { auth } from '@clerk/nextjs/server'

const { userId, sessionClaims, has, orgId } = await auth()
```

- `userId`: identificador del usuario, o `null` si no hay sesión.
- `sessionClaims`: todos los claims verificados del token.
- `has(...)`: comprobación de autorización de Clerk (roles y permisos de organización, planes y features de Clerk Billing).
- `redirectToSignIn()`: redirección al formulario de inicio de sesión.

Para el perfil completo (nombre, correo, imagen) está `currentUser()`, que consulta la Backend API.

El proyecto envuelve todo esto en `lib/autorizacion.ts` con una función `sesion()` que devuelve el identificador, los claims y un resumen ya interpretado (rol, features, plan y organización). Las funciones que interpretan los claims viven en `lib/claims.ts` y son puras, para poder probarlas sin red (sección 11).

Los claims personalizados se tipan con la interfaz global `CustomJwtSessionClaims`, en `types/globals.d.ts`:

```ts
export type Rol = 'admin' | 'editor' | 'lector'

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: Rol
      features?: string[]
    }
  }
}
```

## 9. Proteger páginas y endpoints

La protección se hace en el recurso. `lib/autorizacion.ts` expone cuatro funciones:

```ts
await exigirSesion()                        // auth.protect(): redirige al inicio de sesión
await exigirRol('admin')                    // rol de public_metadata; 403 si no lo tiene
await exigirFeature('reportes')             // metadatos o Clerk Billing; 403 si no la tiene
await exigirPermiso('org:reportes:manage')  // permiso de la organización activa; 403
```

Se usan al principio de la página:

```tsx
export default async function Admin() {
  const { datos } = await exigirRol('admin')

  return <h1>Hola, {datos.usuario}</h1>
}
```

Cuando la comprobación de autorización falla, la función llama a `forbidden()` de `next/navigation`. Next.js interrumpe el renderizado, responde con el código `403` y muestra `app/forbidden.tsx`. Por eso hace falta `experimental.authInterrupts` en `next.config.ts`.

Cuando no hay sesión, `auth.protect()` redirige a `NEXT_PUBLIC_CLERK_SIGN_IN_URL` con el parámetro `redirect_url`, de modo que el usuario vuelva a donde estaba después de iniciar sesión.

En un route handler no conviene redirigir; se devuelve JSON con el código correspondiente:

```ts
export async function GET() {
  const { usuarioId, claims, datos } = await sesion()

  if (!usuarioId) {
    return NextResponse.json({ message: 'No autenticado.' }, { status: 401 })
  }

  return NextResponse.json({ ...datos, claims })
}
```

## 10. Roles y features en los datos del usuario

Clerk no impone un modelo de autorización; guarda datos y los entrega en el token. La aplicación decide qué significan. Hay tres fuentes:

| Fuente | Dónde se define | Claims | Cómo se comprueba |
| --- | --- | --- | --- |
| Metadatos públicos del usuario | Panel de Clerk (Users > usuario > Metadata), Backend API o `npm run metadatos` | `metadata` | `sessionClaims.metadata.role` y `.features`, envuelto en `exigirRol()` y `tieneFeature()` |
| Clerk Billing | Planes y features definidos en el panel (Billing) | `pla`, `fea` | `has({ plan })` y `has({ feature })` |
| Organizaciones | Roles y permisos de la organización en el panel (Organizations) | `o` (versión 2) u `org_*` (versión 1) | `has({ role })` y `has({ permission })` |

El reparto que sigue el proyecto es deliberado: el rol propio de la aplicación se lee de los claims, y todo lo que Clerk ya sabe comprobar (planes, features de facturación, roles y permisos de organización) se delega en `has()`, sin reimplementarlo.

`lib/claims.ts` sí interpreta `fea`, `pla` y `o` para poder mostrarlos en el panel y en el JSON del endpoint, y para combinar las features de las dos fuentes.

### 10.1 Guardar el rol y las features en los metadatos públicos

Cada usuario de Clerk tiene tres bloques de metadatos:

- `publicMetadata`: lo escribe el servidor y lo puede leer el navegador. Es el lugar recomendado para el rol y las features, porque el usuario no puede modificarlo.
- `privateMetadata`: solo lo lee y escribe el servidor.
- `unsafeMetadata`: lo puede escribir el propio usuario desde el navegador. No sirve para autorización.

La forma que usa este proyecto:

```json
{
  "role": "admin",
  "features": ["reportes", "exportar"]
}
```

Hay tres maneras de asignarlos:

1. En el panel de Clerk: Users, abrir el usuario, pestaña Metadata, editar Public.
2. Con el script incluido, que usa la Backend API:

   ```bash
   npm run metadatos -- user_2abc... --rol=admin --feature=reportes --feature=exportar
   npm run metadatos -- user_2abc... --quitar-rol
   npm run metadatos -- user_2abc... --quitar-features
   npm run metadatos -- user_2abc...              # solo muestra los metadatos actuales
   ```

3. Desde una server action, con `clerkClient()`:

   ```ts
   'use server'

   const clerk = await clerkClient()
   await clerk.users.updateUserMetadata(usuarioId, {
     publicMetadata: { role: 'admin', features: ['reportes'] },
   })
   ```

Clerk combina los metadatos enviados con los existentes clave por clave: las claves nuevas se agregan, las existentes se reemplazan por completo (una lista de features sustituye a la anterior) y una clave con valor `null` se elimina.

### 10.2 Incluir los metadatos en el token de sesión

Por defecto el token no incluye los metadatos. Hay dos opciones y el proyecto soporta ambas:

**Opción recomendada: personalizar el token.** En el panel de Clerk, Configure > Sessions > Customize session token, agregar:

```json
{
  "metadata": "{{user.public_metadata}}"
}
```

A partir de entonces cada token trae el claim `metadata` y la autorización no hace ninguna llamada de red. Tenga en cuenta que el token debe caber en una cookie (4 KB), así que los metadatos deben ser pequeños.

**Alternativa: pedirlos a la Backend API.** Si el token no trae el claim, `sesion()` los consulta con `clerkClient().users.getUser()`. La consulta está envuelta en `cache()` de React, así que se hace una sola vez por petición aunque la necesiten el layout, la página y un componente. Si falla, se registra el error y el usuario queda sin rol en esa petición, en lugar de romper la página.

Un cambio de rol se refleja en el token la siguiente vez que Clerk lo renueva, como máximo 60 segundos. Con la alternativa, el cambio se ve en la siguiente petición, porque `cache()` solo memoriza dentro de una misma petición.

### 10.3 Autorizar en el servidor

```tsx
// Página completa
const { datos } = await exigirRol('admin')
const { datos } = await exigirFeature('reportes')
const { datos } = await exigirPermiso('org:reportes:manage')

// Condicional dentro de una página
const { has } = await auth()

if (has({ plan: 'pro' })) { ... }
if (has({ role: 'admin' })) { ... }          // rol de la organización activa
if (await tieneFeature('reportes')) { ... }  // metadatos o Clerk Billing
```

Cuidado con una diferencia sutil: `has({ role })` comprueba el rol del usuario **en la organización activa**, no el rol de `public_metadata`. Para el rol propio de la aplicación se usa `exigirRol()` o `tieneRol(claims, ...)`.

### 10.4 Autorizar en el navegador

En componentes de cliente y de servidor, `<Show>` acepta las mismas condiciones que `has()`:

```tsx
<Show when={{ feature: 'reportes' }} fallback={<p>Reportes no disponible en su plan.</p>}>
  <Link href="/reportes">Reportes</Link>
</Show>
```

Para el rol de los metadatos, el panel lo resuelve en el servidor y decide qué enlaces mostrar. Es importante recordar que ocultar un enlace no es una medida de seguridad: la comprobación que cuenta es la del servidor, en la página o el endpoint de destino.

### 10.5 Planes y features de Clerk Billing

Si la aplicación usa Clerk Billing, el token incluye dos claims:

- `pla`: plan activo con prefijo de alcance, por ejemplo `u:pro` (plan del usuario) u `o:enterprise` (plan de la organización activa).
- `fea`: features activas separadas por coma y con prefijo de alcance, por ejemplo `u:premium,o:reportes`.

`tieneFeature()` acepta una feature venga de donde venga, y el panel muestra el plan sin el prefijo.

### 10.6 Organizaciones: rol y permisos

Cuando el usuario tiene una organización activa, el token versión 2 trae el claim `o` en forma compacta:

```json
{
  "fea": "o:reportes,u:premium",
  "o": { "id": "org_123", "slg": "minec", "rol": "admin", "per": "read,manage", "fpm": "3,0" }
}
```

- `rol` es el rol en la organización sin el prefijo `org:`.
- `per` es la lista de permisos disponibles.
- `fpm` (feature permission map) tiene un entero por cada feature de `fea`. Su representación binaria indica, bit a bit, qué permisos de `per` aplican a esa feature. En el ejemplo, `3` (binario `11`) para `o:reportes` activa `read` y `manage`; `0` para `u:premium` no activa nada y además no es de organización.

`lib/claims.ts` expande esa información a permisos con la forma `org:<feature>:<permiso>` para mostrarlos, y `exigirPermiso()` comprueba con `has({ permission })`. Los tokens versión 1 traen `org_id`, `org_role` y `org_permissions` directamente y también se aceptan.

## 11. Pruebas automatizadas

Las pruebas usan vitest y no salen a la red: `tests/claims.test.ts` pasa claims con la misma forma que emite Clerk a las funciones puras de `lib/claims.ts` y comprueba el resultado.

Casos cubiertos:

- Rol de los metadatos, con y sin claim, y `tieneRol()` con varios roles.
- Features de los metadatos, descartando valores que no son cadenas.
- Features de Clerk Billing: prefijos de alcance, espacios, entradas vacías y nombres sin alcance.
- Plan con y sin prefijo.
- Combinación de features de las dos fuentes sin repetir.
- Expansión del mapa `fpm`, incluida la posición de cada bit, las features que no son de organización, los datos incompletos y un `fpm` más largo que la lista de features.
- Claims de organización de los tokens versión 1.
- Resumen completo y comportamiento sin claims.

```bash
npm test
```

Al instalar vitest hay un detalle: `create-next-app` fija `@types/node` en la versión 20, y vitest 5 pide la 22 o superior. Si se instala sin más, npm falla con `ERESOLVE`. La solución es actualizar la dependencia:

```bash
npm install --save-dev @types/node@^24 vitest
```

## 12. Ejecutar y probar la aplicación

```bash
npm run dev
```

1. Abra http://localhost:3000. Debe aparecer el formulario de Clerk con la leyenda "Development mode".
2. Inicie sesión (o regístrese en `/registro`). Al terminar, Clerk redirige a `/panel`.
3. En `/panel` verá el identificador de usuario y de sesión, el nombre y el correo obtenidos de la Backend API, el rol, las features, el plan, la organización y los claims del token.
4. Pulse los botones para llamar a `/api/perfil` con la cookie y con la cabecera `Authorization`.
5. Asigne un rol y una feature con `npm run metadatos -- <user_id> --rol=admin --feature=reportes` y recargue: aparecen los enlaces a `/admin` y `/reportes`.
6. Use el menú de usuario (esquina superior derecha) para cerrar sesión.

Para probar el servidor sin navegador, cree una sesión desde la Backend API y use el token en la cabecera `Authorization`:

```bash
# Crear una sesión para un usuario existente
curl -s -X POST https://api.clerk.com/v1/sessions \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" -H "Content-Type: application/json" \
  -d '{"user_id":"user_..."}'

# Emitir un token para esa sesión (por defecto dura 60 segundos)
curl -s -X POST https://api.clerk.com/v1/sessions/sess_.../tokens \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" -H "Content-Type: application/json" -d '{}'

# Usarlo contra Next.js
curl -s -H "Authorization: Bearer <jwt>" http://localhost:3000/api/perfil
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <jwt>" http://localhost:3000/admin
```

Use la cabecera `Authorization` y no la cookie. En una instancia de desarrollo, una petición con cookie que no traiga también el token del navegador de desarrollo (`__clerk_db_jwt`) provoca una redirección de handshake, con la cabecera `x-clerk-auth-reason: dev-browser-missing`. Eso solo pasa fuera de un navegador real.

## 13. Consideraciones para producción

- **Claves de producción.** Cree una instancia de producción en Clerk y use `pk_live_...` y `sk_live_...`. Las instancias de desarrollo tienen límites de uso y muestran la leyenda "Development mode".
- **Dominio.** La instancia de producción requiere un dominio propio y los registros DNS que Clerk indica en el panel.
- **Secretos.** `.env.local` está en `.gitignore`; no lo suba. Guarde `CLERK_SECRET_KEY` en el gestor de secretos de la plataforma de despliegue.
- **Protección junto al recurso.** No confíe la protección al matcher del proxy. Toda página o endpoint que muestre datos privados debe llamar a `exigirSesion()` o a una de las funciones de autorización.
- **Dónde guardar roles.** Los roles y features deben vivir en `publicMetadata` (o en Organizations si hay varias instituciones), nunca en `unsafeMetadata`, que el usuario puede modificar desde el navegador. Personalice el token de sesión para incluir `metadata` y evitar llamadas a la Backend API en cada petición.
- **Renderizado dinámico.** Todas las rutas que llaman a `auth()` se renderizan bajo demanda, como muestra la salida de `npm run build`. Es lo esperado: dependen de la petición.
- **Usuarios locales.** Este proyecto no guarda usuarios en ninguna base de datos. Si necesita relacionar datos propios con usuarios de Clerk, guarde el identificador (`userId`) como clave externa y, opcionalmente, sincronice el perfil con webhooks de Clerk.

## 14. Solución de problemas

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `auth()` siempre devuelve una sesión vacía y las páginas protegidas redirigen | El archivo del proxy tiene el nombre equivocado para la versión de Next.js. | Use `proxy.ts` en Next.js 16 y `middleware.ts` en Next.js 15 o anteriores, en la raíz del proyecto. |
| `Error: Clerk: <SignedIn> is not available in @clerk/nextjs Core 3` y respuesta 500 | `<SignedIn>` y `<SignedOut>` se eliminaron en la versión 7 del SDK. | Use `<Show when="signed-in">` y `<Show when="signed-out">`. |
| `forbidden() is not implemented` o error al llamar a `forbidden()` | Falta la opción experimental. | Agregue `experimental: { authInterrupts: true }` en `next.config.ts` y cree `app/forbidden.tsx`. |
| `npm install vitest` falla con `ERESOLVE` por `@types/node` | `create-next-app` fija la versión 20 y vitest 5 pide 22 o superior. | `npm install --save-dev @types/node@^24 vitest`. |
| Con `curl` y la cookie de sesión, las páginas redirigen con `x-clerk-auth-reason: dev-browser-missing` | En instancias de desarrollo, Clerk espera además el token del navegador de desarrollo. | Pruebe con la cabecera `Authorization: Bearer <token>`, o use un navegador real. |
| El rol es `null` aunque el usuario lo tiene en el panel de Clerk | El token no incluye el claim `metadata` y el usuario aún no se ha vuelto a consultar. | Personalice el token de sesión (sección 10.2), o espere a la siguiente petición. |
| `has({ role: 'admin' })` devuelve `false` con un usuario cuyo `public_metadata.role` es `admin` | `has({ role })` comprueba el rol de la organización activa, no el de los metadatos. | Use `exigirRol('admin')` o `tieneRol(claims, 'admin')`. |
| Advertencia de Turbopack sobre la raíz del workspace | Hay otro `package-lock.json` en un directorio superior. | Fije `turbopack: { root: import.meta.dirname }` en `next.config.ts`. |
| La organización es `null` aunque el usuario pertenece a una | El usuario no tiene una organización activa en la sesión. | Actívela con `<OrganizationSwitcher />` o con `setActive({ organization })`. |

## Referencias

- Documentación de Clerk: https://clerk.com/docs
- Guía rápida de Next.js: https://clerk.com/docs/nextjs/getting-started/quickstart
- Referencia de `clerkMiddleware`: https://clerk.com/docs/reference/nextjs/clerk-middleware
- Control de acceso básico por rol: https://clerk.com/docs/guides/secure/basic-rbac
- Claims del token de sesión: https://clerk.com/docs/guides/sessions/session-tokens
