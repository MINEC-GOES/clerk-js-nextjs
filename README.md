# Clerk con Next.js

Proyecto de referencia que muestra cómo integrar [Clerk](https://clerk.com) como proveedor de autenticación y autorización en una aplicación Next.js 16 (App Router) usando el SDK oficial `@clerk/nextjs`.

La guía completa, paso a paso y en español, está en [docs/integracion-clerk.md](docs/integracion-clerk.md).

## Qué hace este proyecto

- Carga Clerk en el navegador con `ClerkProvider` y monta los componentes de inicio de sesión, registro y menú de usuario.
- Verifica la sesión en el servidor con `auth()`, tanto desde la cookie de sesión como desde la cabecera `Authorization: Bearer`.
- Protege páginas y endpoints junto al recurso, no en el proxy, que es lo que recomienda Clerk.
- Autoriza por rol y features guardados en los metadatos públicos del usuario, por plan y features de Clerk Billing, y por rol y permisos de la organización activa.
- Consulta la Backend API cuando el token no incluye los metadatos, memorizando la llamada por petición.
- Incluye un script para asignar rol y features a un usuario desde la terminal.
- Incluye pruebas automatizadas que no dependen de la red.

## Requisitos

- Node.js 20.9 o superior (probado con Node 24).
- Una cuenta en Clerk con una aplicación creada (la instancia de desarrollo es suficiente para probar).

## Inicio rápido

```bash
git clone https://github.com/MINEC-GOES/clerk-js-nextjs.git
cd clerk-js-nextjs
npm install
cp .env.example .env.local
```

Edite `.env.local` y complete las claves que se obtienen en el panel de Clerk, sección API Keys:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/registro
```

Luego:

```bash
npm run dev
```

Abra http://localhost:3000, inicie sesión y visite http://localhost:3000/panel.

## Rutas

| Ruta | Protegida | Descripción |
| --- | --- | --- |
| `GET /` | No | Formulario de inicio de sesión de Clerk. |
| `GET /registro` | No | Formulario de registro de Clerk. |
| `GET /panel` | Sí | Página que muestra los datos verificados en el servidor, el rol, las features y la organización. |
| `GET /admin` | Sí, rol `admin` | Página protegida con `exigirRol('admin')`. |
| `GET /reportes` | Sí, feature `reportes` | Página protegida con `exigirFeature('reportes')`. |
| `GET /api/perfil` | Sí | Endpoint JSON con rol, features, plan, organización y claims del token. |

## Roles y features

El rol y las features se guardan en los metadatos públicos del usuario en Clerk, con la forma `{"role": "admin", "features": ["reportes"]}`. Se pueden asignar desde el panel de Clerk o con el script incluido:

```bash
npm run metadatos -- user_2abc... --rol=admin --feature=reportes --feature=exportar
npm run metadatos -- user_2abc... --quitar-rol
npm run metadatos -- user_2abc...
```

Para que el token de sesión incluya los metadatos y no haga falta consultar la Backend API, en el panel de Clerk (Configure > Sessions > Customize session token) agregue `{"metadata": "{{user.public_metadata}}"}`. La sección 10 de la guía explica las tres fuentes de autorización (metadatos, Clerk Billing y organizaciones) y cómo usarlas.

## Pruebas

```bash
npm test          # vitest
npm run lint
npm run build
```

## Estructura relevante

```
proxy.ts                       Proxy de Clerk (middleware.ts en Next.js 15 y anteriores)
lib/claims.ts                  Lectura de rol, features, plan y organización (funciones puras)
lib/autorizacion.ts            Ayudantes de servidor: exigirSesion, exigirRol, exigirFeature, exigirPermiso
types/globals.d.ts             Tipos de los claims personalizados
app/layout.tsx                 ClerkProvider y cabecera con UserButton
app/page.tsx, app/registro/    Inicio de sesión y registro
app/panel/                     Página protegida y componente de cliente
app/admin/, app/reportes/      Páginas protegidas por rol y por feature
app/forbidden.tsx              Página 403
app/api/perfil/route.ts        Endpoint JSON protegido
scripts/metadatos.mjs          Asignación de rol y features
tests/claims.test.ts           Pruebas de la lectura de claims
docs/integracion-clerk.md      Guía paso a paso
```
