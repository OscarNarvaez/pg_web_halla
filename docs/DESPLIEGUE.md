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

   Aplica las **seis** migraciones (la `0006_seguridad.sql` agrega la aprobación de cuentas, el historial
   de cambios y la cuota atómica de IA; ver `docs/SEGURIDAD.md`). Si `db push` fallara en `0003_criterios_normativos.sql` al crear la configuración `es_unaccent`
   (depende de la extensión `unaccent` en el esquema `extensions`), la alternativa está descrita en
   `docs/BASE_DE_DATOS.md`. En las pruebas locales (Postgres 18) la migración pasa sin cambios.

3. **Autenticación.** `supabase/config.toml` trae la configuración endurecida (contraseña mínima de 10 con
   mayúscula, minúscula y número; confirmación de correo; reautenticación para cambiar la contraseña; 60 s
   entre correos). Súbela al proyecto:

   ```bash
   supabase config diff    # muestra exactamente qué va a cambiar en el proyecto
   supabase config push    # pide confirmación por cada cambio
   ```

   `config push` sube **todo** lo que declara `config.toml` (también la Site URL, que ya está en
   `https://halla.ink`). Lee el `diff` antes de confirmar. Revisa después en el dashboard (Authentication)
   que quedó aplicada, y completa:
   - *URL Configuration*: **Site URL** `https://halla.ink`; **Redirect URLs** `https://halla.ink/**` y
     `http://localhost:5173/**`.
   - El envío de correos requiere un SMTP propio: sección 7.

4. **Primer administrador.** Nadie usa la plataforma hasta que un administrador aprueba su cuenta. Regístrate
   en la app y luego, en el SQL Editor del dashboard:

   ```sql
   update public.profiles set rol = 'admin', aprobado = true where cedula = '<tu cédula>';
   ```

   Desde ese momento apruebas a los demás auditores en **Auditores** (menú lateral, solo visible para admins).

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
  GEMINI_MAX_OUTPUT_TOKENS=8192 \
  GEMINI_NIVEL_RAZONAMIENTO=low \
  PROMPT_VERSION=1.4.0 \
  LIMITE_IA_DIARIO_POR_USUARIO=40 \
  LIMITE_IA_POR_MINUTO=5
```

| Secreto | Valor | Por qué |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.8-flash` | Verificado el 3/10/2026. `gemini-2.5-flash` (el del prompt maestro) devuelve 404 a cuentas nuevas |
| `GEMINI_MODELOS_RESPALDO` | *(sin definir)* | Si no se define, se usa la cascada por defecto (abajo). Para desactivarla, defínelo igual al modelo principal: `GEMINI_MODELOS_RESPALDO=gemini-3.8-flash` |
| `GEMINI_MAX_OUTPUT_TOKENS` | `8192` | Gemini 3.x razona por defecto y esos tokens cuentan; además cada hallazgo trae riesgo y controles (unos 400 tokens más). Con 2 048 la respuesta podía cortarse |
| `PROMPT_VERSION` | `1.4.0` | Queda guardada en cada hallazgo e informe. 1.1.0 agrega la metodología de riesgo del PR13_GQ al mensaje (el prompt del sistema sigue siendo el ANEXO A literal); 1.2.0, la narrativa del informe con el formato oficial; 1.3.0, la guía de redacción del dueño (fórmulas por categoría) en el mensaje; 1.4.0, la revisión de indicadores del proceso en el informe, sin recomendaciones |
| `GEMINI_NIVEL_RAZONAMIENTO` | `low` | Misma calidad de clasificación con 1,7 s de latencia en vez de 6,2 s |
| `LIMITE_IA_DIARIO_POR_USUARIO` | `40` sugerido | Ver «Cuota de la IA» |
| `LIMITE_IA_POR_MINUTO` | `5` | Evita que un usuario agote la cuota compartida en segundos |

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

> **Datos de pacientes y nivel gratuito.** Los términos del nivel gratuito de Gemini permiten que Google use
> y revise los textos enviados y piden expresamente no enviar datos personales. halla anonimiza el texto antes
> de enviarlo (nombres, documentos, historias clínicas, teléfonos, correos), pero **antes de usar la
> plataforma con hallazgos reales activa la facturación** (nivel pago). Detalle en `docs/SEGURIDAD.md` (S1).

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

Crea dos usuarios de prueba y confirma que una cuenta sin aprobar no accede a nada, que nadie se aprueba ni se
asciende a admin solo, que A no lee ni modifica lo de B y que no se pueden falsificar citas, antedatar ni
borrar registros. Los borra al terminar. Equivale a `pnpm probar:bd`, pero contra el proyecto real.

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

## 7. Correo de confirmación (SMTP propio) — obligatorio

**Sin este paso los auditores no reciben el correo de confirmación ni el de recuperación de contraseña.**
El servicio de correo que Supabase trae por defecto solo entrega a los miembros del equipo del proyecto
en Supabase y como máximo 2 correos por hora:

> «Unless you configure a custom SMTP server for your project, Supabase Auth will refuse to deliver
> messages to addresses that are not part of the project's team.»
> (supabase.com/docs/guides/auth/auth-smtp, consultado el 4/10/2026)

Se recomienda **Resend**, que está en la lista oficial de Supabase y permite enviar desde `@halla.ink`. Su
plan gratuito da 3 000 correos al mes y 100 por día, de sobra para las confirmaciones del hospital.

### 7.1 Verificar el dominio en Resend

1. Crea la cuenta en [resend.com](https://resend.com) → **Domains → Add Domain** → `halla.ink`.
2. Resend te muestra 3 o 4 registros DNS (DKIM, SPF y opcionalmente DMARC). Cópialos en Namecheap
   (*Domain List → Manage → Advanced DNS*):
   - En **Host** escribe solo la parte que va antes de `halla.ink` (por ejemplo `resend._domainkey`, `send`
     o `_dmarc`). Namecheap agrega el dominio solo.
   - Para el registro **MX**, primero baja a la sección **Mail Settings** del mismo Advanced DNS y elige
     **Custom MX**; luego agrega el MX con host `send`, el valor que indica Resend y prioridad `10`.
   - No toques los 4 registros A ni el CNAME `www` de GitHub Pages.
3. En Resend pulsa **Verify DNS Records**. Puede tardar desde minutos hasta unas horas.
4. **API Keys → Create API Key**, con permiso *Sending access* restringido al dominio `halla.ink`. Cópiala:
   solo se muestra una vez. Es un secreto: no la pegues en el repositorio ni en el chat.

### 7.2 Conectar Resend con Supabase

Dashboard de Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**:

| Campo | Valor |
|---|---|
| Sender email | `no-reply@halla.ink` |
| Sender name | `halla` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la API key de Resend |

Después, en **Authentication → Rate Limits**, sube *Rate limit for sending emails* a unos **30 por hora**.
(Este límite no se declara en `supabase/config.toml` justamente para que `config push` no lo devuelva a 2.)

### 7.3 Plantillas en español (recomendado)

**Authentication → Emails → Templates → Confirm signup**:

- Asunto: `Confirma tu cuenta en halla`
- Cuerpo:

  ```html
  <h2>Confirma tu cuenta de auditor</h2>
  <p>Recibimos una solicitud para crear una cuenta en halla, la plataforma de auditoría interna del
  Hospital Infantil Los Ángeles.</p>
  <p><a href="{{ .ConfirmationURL }}">Confirmar mi correo</a></p>
  <p>Después de confirmar, un administrador debe aprobar tu cuenta.</p>
  <p>Si no fuiste tú, ignora este mensaje.</p>
  ```

Haz lo mismo con **Reset password** (asunto `Recupera tu contraseña de halla`; enlace `{{ .ConfirmationURL }}`).

### 7.4 Probar

Regístrate con un correo nuevo. Debe llegar en menos de un minuto; la primera vez revisa la carpeta de correo
no deseado. Si no llega, en Resend → **Emails** verás si salió y por qué falló. La app tiene el botón
**Reenviar correo de confirmación** en la pantalla «Revisa tu correo» y al intentar ingresar sin confirmar.

### Cuentas registradas antes de configurar el SMTP

Si alguien se registró antes de este paso, su correo nunca salió. Con el SMTP listo, que use **Reenviar
correo de confirmación** desde la pantalla de ingreso. Para tu propia cuenta de administrador también puedes
confirmarla directamente en el SQL Editor:

```sql
update auth.users set email_confirmed_at = now() where email = '<tu correo>' and email_confirmed_at is null;
```

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

## 8. Cierre: lo que queda por verificar con el proyecto real

- [ ] `supabase db push` aplicó las catorce migraciones (la 0007 trae riesgo, controles y la matriz; la 0008 fija la escala de niveles; la 0009, los cargos de lista y el equipo de varias personas; la 0010, el evaluador y las fechas reales; la 0011, la lista de verificación; la 0012, los PDF de evidencia agregados al editar; la 0013, los indicadores revisados del informe; la 0014, quitar el PDF analizado).
- [ ] `supabase config push` aplicó la configuración de Auth (contraseña de 10, confirmación de correo).
- [ ] Primer administrador nombrado por SQL y facturación de Gemini activada (`docs/SEGURIDAD.md`).
- [ ] `pnpm ingest` subió los 246 fragmentos y la consulta de aceptación devolvió 9.3.3.
- [ ] `pnpm verificar-rls` en verde.
- [ ] Las funciones responden 401 sin sesión y 403 con una auditoría ajena.
- [ ] SMTP propio (Resend) configurado: el correo de confirmación llega a una cuenta que no es del equipo de Supabase.
- [ ] Registro completo desde `https://halla.ink/registro` y perfil con los 8 campos en `profiles`.
- [ ] Los siete casos de `docs/PRUEBAS.md` capturados en la app desplegada, con sus respuestas pegadas.
- [ ] Ciclo completo: auditoría → 4 hallazgos (uno por categoría) por el asistente de 7 pasos, uno de ellos
      desde un PDF → matriz validada y descargada en Excel → informe → PDF y Word.
- [ ] `https://halla.ink/app/auditorias/<id>` carga al refrescar.
- [ ] Clave de Gemini rotada y cargada con `supabase secrets set`.

## Actualizaciones: primero la base de datos, después el frontend

Cuando un cambio trae una migración nueva en `supabase/migrations/`, el orden importa:

```bash
supabase db push                                   # 1. la base de datos primero
supabase functions deploy clasificar-hallazgo completar-auditoria generar-informe   # 2. si cambiaron
git push origin main                               # 3. el frontend al final
```

Si se publica el frontend antes de la migración, la app pide columnas o funciones que aún no existen. Se ve
como un error 400 o 404 de Supabase, y la app avisa «La base de datos de la plataforma no está actualizada».

**Actualización del asistente de 7 pasos, riesgo y matriz (4/10/2026):**

```bash
supabase db push                                                      # 0007 y 0008
supabase secrets set GEMINI_MAX_OUTPUT_TOKENS=8192 PROMPT_VERSION=1.1.0
supabase functions deploy clasificar-hallazgo generar-informe
git push origin main
```

La función `clasificar-hallazgo` nueva escribe columnas que crea la 0007: desplegarla antes de la migración
hace fallar el guardado de los hallazgos.

**Actualización de cargos y equipo auditor (4/10/2026):**

```bash
supabase db push                                   # 0009
supabase functions deploy generar-informe          # lee cargos y equipo_auditor
git push origin main
```

La 0009 elimina las columnas `cargo`, `equipo_auditor_nombre` y `equipo_auditor_cargo`: entre el `db push` y el
`git push`, el frontend anterior no puede guardar perfiles, así que conviene hacer los tres pasos seguidos. Los
cargos escritos antes que coinciden con la lista se conservan; los demás quedan vacíos y la app pide completarlos.

**Actualización del informe con el formato oficial (4/10/2026):**

```bash
supabase db push                                   # 0010
supabase secrets set PROMPT_VERSION=1.2.0
supabase functions deploy generar-informe          # narrativa y Ficha Técnica del formato oficial
git push origin main
```

La plantilla `src/formato_de_informe_final/Auditoria_interna.odt` se publica con el sitio (Vite la copia a
`dist/assets/`). Si el dueño la reemplaza, basta con un `git push`; si cambia algún título o rótulo, hay que
cambiarlo también en `src/lib/formato-informe.js` (la prueba `pnpm probar:interfaz` avisa si no coincide).

**Lista de verificación (4/10/2026):** `supabase db push` (0011) y luego `git push origin main`. No cambia ninguna
Edge Function.

**Guía de redacción por categoría (5/10/2026):** cambia el mensaje a la IA y la verificación de la estructura.

```bash
supabase secrets set PROMPT_VERSION=1.3.0
supabase functions deploy clasificar-hallazgo      # guía de redacción en el mensaje y V3 con «porque» / «para lo cual»
git push origin main
```

**Quitar documentos cargados (5/10/2026):** `supabase db push` (0014) y luego `git push origin main`. No cambia
ninguna Edge Function.

**Plantilla del informe con «Revisión de indicadores» y sin RECOMENDACIONES (5/10/2026):**

```bash
supabase db push                                   # 0013 (indicadores revisados)
supabase secrets set PROMPT_VERSION=1.4.0
supabase functions deploy generar-informe          # la IA redacta la revisión de indicadores; ya no recomendaciones
git push origin main
```

Los informes generados antes (contenido versión 3) piden generar una nueva versión: la plantilla cambió.

**PDF de evidencia al editar (5/10/2026):**

```bash
supabase db push                                   # 0012
supabase functions deploy generar-informe          # «Archivos adjuntos» incluye los PDF agregados al editar
git push origin main
```

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
