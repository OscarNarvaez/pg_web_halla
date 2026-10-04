# Despliegue de halla.ink

Arquitectura: la interfaz es una SPA estática en **GitHub Pages**; la base de datos, la autenticación y
las funciones con IA viven en **Supabase**; la IA es **Gemini**, llamada solo desde las Edge Functions.

```
Navegador (halla.ink) ──supabase-js──▶ Supabase: Auth + PostgreSQL con RLS + Edge Functions ──▶ Gemini
```

Todo lo que no depende de credenciales está hecho y probado (ver `docs/PRUEBAS.md`). Lo que sigue son
los pasos que requieren cuentas reales, en orden.

## Antes de empezar

- Cuenta de Supabase y CLI (`supabase --version`; el proyecto se probó con la 2.119).
- La API key de Google AI Studio.
- Acceso de administrador al repositorio `OscarNarvaez/pg_web_halla` y al dominio `halla.ink` en Namecheap.
- Node 24 y pnpm (`pnpm install` en la raíz del repositorio).

> **Seguridad de la API key.** La key de Gemini va **solo** en los secretos de Supabase y, para pruebas
> locales, en `supabase/functions/.env` (ignorado por git). Nunca en `.env.local`, en variables `VITE_*`
> ni en GitHub. Como la key actual circuló fuera de un gestor de secretos durante el desarrollo,
> **conviene rotarla en Google AI Studio** antes de abrir la plataforma a los auditores, y cargar la nueva.

## 1. Proyecto Supabase

1. Crea el proyecto en [supabase.com](https://supabase.com) (región sugerida: `us-east-1`, la de menor
   latencia desde Colombia entre las disponibles). Anota el **project ref** (la parte `xxxx` de
   `https://xxxx.supabase.co`).
2. Vincula el repositorio y aplica las cinco migraciones:

   ```bash
   supabase login
   supabase link --project-ref <ref>
   supabase db push
   ```

   Si `db push` fallara en `0003_criterios_normativos.sql` al crear la configuración `es_unaccent`
   (depende de la extensión `unaccent` en el esquema `extensions`), la alternativa está descrita en
   `docs/BASE_DE_DATOS.md`. En las pruebas locales (Postgres 18) la migración pasa sin cambios.

3. **Autenticación** (Dashboard → Authentication):
   - *URL Configuration*: **Site URL** `https://halla.ink`; **Redirect URLs** `https://halla.ink/**` y
     `http://localhost:5173/**`.
   - *Sign In / Providers → Email*: deja activa la **confirmación de correo**. La app lo maneja: muestra
     «Revisa tu correo» y crea el perfil al primer ingreso si hiciera falta.
   - Opcional: traduce al español las plantillas de correo (*Emails*).

## 2. Cargar las normas

La ingesta trocea `normas/` y sube 246 fragmentos a `criterios_normativos`. Usa la **service role key**
(Dashboard → Project Settings → API keys; también sirve la nueva *secret key* `sb_secret_…`). Exporta las
claves solo en la terminal:

```bash
pnpm ingest:dry   # opcional: ver el resumen sin subir nada
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> pnpm ingest
```

Al final ejecuta la consulta de aceptación y debe mostrar **`NTC-ISO 9001:2015 · 9.3.3`** entre los tres
primeros resultados de «revisión por la dirección salidas».

## 3. Secretos y Edge Functions

El archivo local `supabase/functions/.env` ya tiene los valores verificados; se puede subir tal cual:

```bash
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy clasificar-hallazgo completar-auditoria generar-informe
```

O uno por uno:

```bash
supabase secrets set \
  GEMINI_API_KEY=<key> \
  GEMINI_MODEL=gemini-3.8-flash \
  GEMINI_MAX_OUTPUT_TOKENS=4096 \
  GEMINI_NIVEL_RAZONAMIENTO=low \
  PROMPT_VERSION=1.0.0 \
  LIMITE_IA_DIARIO_POR_USUARIO=40
```

| Secreto | Valor | Por qué |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.8-flash` | Verificado el 3/10/2026. `gemini-2.5-flash` (el del prompt maestro) devuelve 404 a cuentas nuevas |
| `GEMINI_MODELOS_RESPALDO` | *(sin definir)* | Si no se define, se usa la cascada por defecto (abajo). Para desactivarla, defínelo igual al modelo principal: `GEMINI_MODELOS_RESPALDO=gemini-3.8-flash` |
| `GEMINI_MAX_OUTPUT_TOKENS` | `4096` | Gemini 3.x razona por defecto y esos tokens cuentan; con 2 048 la respuesta podía cortarse |
| `GEMINI_NIVEL_RAZONAMIENTO` | `low` | Misma calidad de clasificación con 1,7 s de latencia en vez de 6,2 s |
| `LIMITE_IA_DIARIO_POR_USUARIO` | `40` sugerido | Ver «Cuota de la IA» |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase en las funciones; no hay que definirlos.
Las funciones tienen `verify_jwt = true` (`supabase/config.toml`) y CORS restringido a `https://halla.ink`,
`https://www.halla.ink` y `http://localhost:5173`.

### Cuota de la IA

El nivel gratuito de Gemini permite **20 solicitudes diarias por proyecto y por modelo**
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Por eso `gemini.ts` recorre una cascada: si un
modelo agota su cuota, no existe o está saturado, pasa al siguiente.

```
gemini-3.8-flash → gemini-flash-latest → gemini-3.7-flash → gemini-3.6-flash → gemini-3.5-flash
→ gemini-3.5-flash-lite → gemini-3.1-flash-lite
```

Son unas 140 solicitudes diarias gratis en total, **compartidas por todos los auditores**. Cada análisis
consume 1 solicitud (2 si hace falta la reparación de estructura); el informe, 1. Cada hallazgo guarda en
`modelo_ia` qué modelo respondió. Si el uso real supera esa cifra, **activa la facturación del proyecto
en Google AI Studio**: los límites suben a miles por día a un costo bajo para modelos Flash, y puedes
dejar solo `gemini-3.8-flash` (`GEMINI_MODELOS_RESPALDO=gemini-3.8-flash`).

Cuando se agota todo, el auditor ve «Se agotó la cuota diaria gratuita del servicio de IA… tu texto no se
perdió», y el informe se genera igual con una narrativa de plantilla.

## 4. Verificar el backend

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon> SUPABASE_SERVICE_ROLE_KEY=<service_role> pnpm verificar-rls
```

Crea dos usuarios de prueba, confirma que A no lee ni modifica lo de B y que nadie se asciende a admin,
y los borra al terminar. Equivale a `pnpm probar:bd`, pero contra el proyecto real.

Para nombrar un administrador (SQL Editor del dashboard):

```sql
update public.profiles set rol = 'admin' where cedula = '<cédula>';
```

## 5. GitHub Pages

1. **Variables del repositorio** (Settings → Secrets and variables → Actions → pestaña *Variables*):
   - `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = la *anon* key o la nueva *publishable* key (`sb_publishable_…`)

   Son públicas por diseño: la seguridad la da la RLS. **No** pongas aquí la service role ni la key de Gemini.
2. Settings → Pages → *Build and deployment* → **Source: GitHub Actions**.
3. Haz push a `main`. El workflow `.github/workflows/deploy.yml` instala con pnpm, ejecuta el lint y las
   pruebas sin red, compila, verifica que `dist/` tenga `CNAME` y `404.html` y que **no** contenga una
   API key de Google, y publica.
4. Settings → Pages → **Custom domain**: `halla.ink`. Marca **Enforce HTTPS** cuando GitHub emita el
   certificado (puede tardar hasta 24 h).

> Con despliegue por GitHub Actions, GitHub toma el dominio de la configuración de Pages, no del archivo
> `CNAME`. El archivo se conserva en `public/` porque lo pide el prompt y porque sirve si algún día se
> publica desde una rama.

## 6. DNS en Namecheap

En *Domain List → Manage → Advanced DNS*, borra los registros de *parking* que Namecheap crea por defecto
y agrega:

| Tipo | Host | Valor |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `oscarnarvaez.github.io.` |

Para comprobar la propagación: `dig halla.ink +short` debe devolver las cuatro IP de GitHub.

## Alternativa: hosting de Namecheap (cPanel)

El build es el mismo. Ejecuta `pnpm build` con las variables `VITE_*` en `.env.local`, sube el contenido
de `dist/` a `public_html/` y crea en `public_html/.htaccess`:

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

Así las rutas profundas (`/app/auditorias/<id>`) cargan la SPA en vez de dar 404. Supabase y Gemini no
cambian.

## 7. Cierre: lo que queda por verificar con el proyecto real

- [ ] `supabase db push` aplicó las cinco migraciones.
- [ ] `pnpm ingest` subió los 246 fragmentos y la consulta de aceptación devolvió 9.3.3.
- [ ] `pnpm verificar-rls` en verde.
- [ ] Las funciones responden 401 sin sesión y 403 con una auditoría ajena.
- [ ] Registro completo desde `https://halla.ink/registro` y perfil con los 8 campos en `profiles`.
- [ ] Los siete casos de `docs/PRUEBAS.md` capturados en la app desplegada, con sus respuestas pegadas.
- [ ] Ciclo completo: auditoría → 4 hallazgos (uno por categoría) → informe → PDF y Word.
- [ ] `https://halla.ink/app/auditorias/<id>` carga al refrescar.
- [ ] Clave de Gemini rotada y cargada con `supabase secrets set`.

## Desarrollo local

```bash
cp .env.example .env.local     # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY del proyecto
pnpm dev                       # http://localhost:5173
```

Sin Docker no se puede levantar Supabase local (`supabase start`), así que el frontend en desarrollo
apunta al proyecto en la nube. Las pruebas, en cambio, no necesitan nada de eso:

```bash
pnpm probar            # sin red: prompt, validación, cascada, migraciones + RLS (PGlite) y búsqueda
pnpm probar:motor      # motor real contra Gemini: los 7 casos del §14 (consume cuota)
pnpm probar:interfaz   # extremo a extremo en Chromium con Supabase simulado
pnpm check:funciones   # verificación de tipos de las Edge Functions con Deno
```
