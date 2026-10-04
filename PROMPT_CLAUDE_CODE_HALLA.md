# PROMPT MAESTRO PARA CLAUDE CODE — Plataforma **halla.ink**

> **Cómo usar este archivo:** guárdalo en la raíz del repositorio como `PROMPT_CLAUDE_CODE_HALLA.md`
> y arranca Claude Code dentro del repo con:
>
> ```
> claude
> > Lee PROMPT_CLAUDE_CODE_HALLA.md completo y ejecuta la FASE 0. No escribas código todavía:
> > primero entrégame el informe de reconocimiento del repositorio y el plan de implementación.
> ```
>
> Luego avanza fase por fase (`ejecuta la FASE 1`, `ejecuta la FASE 2`, …). **No le pidas todas las
> fases de una sola vez**: el proyecto es grande y conviene revisar y commitear al final de cada fase.

---

## 0. IDENTIDAD DEL PROYECTO

| Campo | Valor |
|---|---|
| Nombre del producto | **halla** (dominio `halla.ink`) |
| Descripción corta | Sistema experto de clasificación y redacción de hallazgos de auditoría interna en salud |
| Repositorio | `https://github.com/OscarNarvaez/pg_web_halla.git` |
| Hosting | GitHub Pages (workflow ya existente) con dominio propio `halla.ink` registrado en Namecheap |
| Frontend | React 18 + Vite + **JavaScript (NO TypeScript)** + Tailwind CSS |
| Backend / BD / Auth | **Supabase** (PostgreSQL + Auth + RLS + Edge Functions) |
| IA | **Gemini API (capa gratuita de Google AI Studio)** |
| Idioma de la interfaz | Español (Colombia) |
| Usuario objetivo | Auditores internos de una institución hospitalaria en Colombia |

### Qué hace la plataforma

El auditor escribe en lenguaje natural lo que observó durante la auditoría. La IA:

1. **Clasifica automáticamente** el hallazgo en una de cuatro categorías: `FORTALEZA`,
   `NO CONFORMIDAD`, `OBSERVACIÓN`, `OPORTUNIDAD DE MEJORA`.
2. **Reescribe el hallazgo** con la estructura técnica obligatoria de esa categoría.
3. **Identifica el criterio normativo** aplicable consultando los documentos normativos cargados
   en la base de datos (ISO 9001, ISO 45001, ISO 14001, ISO 19011, PR13 Gestión de riesgos).
4. **Rellena todos los campos que no se le piden al auditor** (justificación, criterio, evidencia,
   numeral, severidad).
5. **Genera el informe final de auditoría** consolidando todos los hallazgos.

### Reglas de producto innegociables

1. **El usuario NUNCA selecciona la clasificación.** No hay dropdown, radio button, ni confirmación
   de categoría en el formulario de creación. La IA decide. (Sí puede *editar* el resultado después,
   pero el campo nace lleno por la IA y queda marcado como `editado_por_usuario = true` si lo cambia.)
2. **La IA nunca inventa numerales, normas, fechas, registros ni requisitos.** Si no puede
   identificar el requisito exacto, escribe literalmente
   `[Requisito específico pendiente de identificación/validación]`.
3. **La `GEMINI_API_KEY` jamás llega al navegador.** Todas las llamadas a Gemini se hacen desde
   Supabase Edge Functions. GitHub Pages es estático: no hay servidor propio.
4. **Trazabilidad:** todo hallazgo guarda la entrada original del auditor, la respuesta cruda de la
   IA, el modelo usado y la versión del prompt. Es una herramienta de auditoría en salud; la
   trazabilidad es parte del producto, no un extra.

---

## 1. FASE 0 — RECONOCIMIENTO (obligatoria, antes de escribir una sola línea)

No generes código en esta fase. Ejecuta:

1. `git status`, `git log --oneline -20`, y lista el árbol del repo (ignorando `node_modules`).
2. **Lee íntegramente la carpeta `Primer_prototipo/`.** Es el primer desarrollo que ya hizo el
   dueño del proyecto y contiene la base conceptual de lo que quiere. Documenta:
   - Qué pantallas y componentes existen.
   - Qué decisiones de UI/UX, nombres, colores, copy y estructura conviene **conservar**.
   - Qué está incompleto, roto o mal planteado y conviene **rehacer**.
   - Si hay prompts, esquemas de datos o listas de valores, extráelos y reutilízalos.
3. Lee el workflow de GitHub Actions existente (`.github/workflows/*.yml`) y determina si publica
   la raíz del repo o una carpeta `dist/`. **No lo rompas**: adáptalo.
4. Verifica si existe archivo `CNAME` y qué contiene.
5. Lista los archivos `.md` normativos presentes en el repo (deben ser los cinco de la sección 7).

**Entregable de la Fase 0:** un documento `docs/RECONOCIMIENTO.md` con los hallazgos anteriores y
un plan de implementación por fases, señalando explícitamente qué del `Primer_prototipo` se reutiliza
y qué se reemplaza. Pide aprobación antes de continuar.

---

## 2. ARQUITECTURA

```
┌───────────────────────────────┐
│  Navegador — halla.ink        │
│  React + Vite + Tailwind      │
│  (SPA estática, GitHub Pages) │
└───────────┬───────────────────┘
            │  supabase-js (anon key + JWT del usuario)
            ▼
┌───────────────────────────────────────────────────────┐
│  SUPABASE                                             │
│                                                       │
│  Auth (email + password)                              │
│  PostgreSQL + RLS                                     │
│    profiles · auditorias · hallazgos · informes        │
│    criterios_normativos (FTS español)                  │
│                                                       │
│  Edge Functions (Deno) ← única capa con secretos       │
│    clasificar-hallazgo                                 │
│    generar-informe                                     │
│    completar-auditoria                                 │
└───────────┬───────────────────────────────────────────┘
            │  GEMINI_API_KEY (secreto de Supabase, nunca en el cliente)
            ▼
┌───────────────────────────────┐
│  Google Gemini API (free)     │
│  generateContent + JSON schema│
└───────────────────────────────┘
```

### Por qué así

- GitHub Pages solo sirve archivos estáticos → no hay dónde esconder la API key de Gemini.
- Las Edge Functions de Supabase son el backend. Validan el JWT del usuario, consultan los criterios
  normativos, arman el prompt, llaman a Gemini, **validan la respuesta** y persisten.
- La recuperación de criterios normativos se hace con **búsqueda de texto completo de PostgreSQL en
  español** (`tsvector` + `websearch_to_tsquery`), no con embeddings. Motivo: es determinista, gratis,
  sin límites de cuota y suficiente para 5 documentos. `pgvector` queda como mejora opcional (Fase 8).

---

## 3. STACK Y DEPENDENCIAS

**Obligatorio:** JavaScript, no TypeScript, en el frontend. Las Edge Functions sí van en TypeScript
(es lo nativo de Deno/Supabase).

```jsonc
// dependencias de producción
"react", "react-dom", "react-router-dom",
"@supabase/supabase-js",
"react-hook-form", "zod", "@hookform/resolvers",
"lucide-react",          // iconos
"recharts",              // gráficas del dashboard e informe
"jspdf", "jspdf-autotable", // exportación PDF del informe
"docx", "file-saver",    // exportación Word del informe
"date-fns"               // fechas en español

// desarrollo
"vite", "@vitejs/plugin-react",
"tailwindcss@^3.4", "postcss", "autoprefixer",
"@tailwindcss/forms", "@tailwindcss/typography",
"eslint", "prettier", "prettier-plugin-tailwindcss"
```

**Usa Tailwind CSS v3.4 con `tailwind.config.js` clásico.** No uses v4 ni configuración CSS-first:
el proyecto depende de los plugins `forms` y `typography` y de un `tailwind.config.js` legible.

### Enrutamiento en GitHub Pages

Usa `BrowserRouter` con `base: '/'` en Vite (el dominio propio sirve desde la raíz) **y** copia
`index.html` a `404.html` en el build para que las rutas profundas no den 404:

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    { name: 'spa-404', closeBundle() { copyFileSync('dist/index.html', 'dist/404.html') } },
  ],
})
```

Además, `public/CNAME` debe contener exactamente:

```
halla.ink
```

---

## 4. ESTRUCTURA DE CARPETAS OBJETIVO

```
/
├─ .github/workflows/deploy.yml        # build + deploy a Pages (adaptar el existente)
├─ Primer_prototipo/                   # NO TOCAR — referencia histórica
├─ normas/                             # los 5 .md normativos (mover aquí si están sueltos)
│  ├─ 1_NTC_ISO_9001_2015.md
│  ├─ 2_iso-45001-norma-Internacional.md
│  ├─ 3_NTC-ISO_14001-2015.md
│  ├─ 4_ISO_FDIS_19011__E__1.md
│  └─ 5_PR13_GQ_Gestion_de_riesgos__2_.md
├─ docs/
│  ├─ RECONOCIMIENTO.md
│  ├─ BASE_DE_DATOS.md
│  ├─ DESPLIEGUE.md
│  └─ MANUAL_AUDITOR.md
├─ scripts/
│  └─ ingest-normas.mjs                # trocea los .md y los sube a Supabase
├─ supabase/
│  ├─ migrations/
│  │  ├─ 0001_tipos_y_perfiles.sql
│  │  ├─ 0002_auditorias_y_hallazgos.sql
│  │  ├─ 0003_criterios_normativos.sql
│  │  ├─ 0004_informes_y_logs.sql
│  │  └─ 0005_rls.sql
│  └─ functions/
│     ├─ _shared/
│     │  ├─ cors.ts
│     │  ├─ supabase.ts
│     │  ├─ gemini.ts
│     │  ├─ prompt-sistema-experto.ts   # ANEXO A, literal
│     │  ├─ esquema-salida.ts
│     │  ├─ recuperar-criterios.ts
│     │  └─ validar-salida.ts
│     ├─ clasificar-hallazgo/index.ts
│     ├─ generar-informe/index.ts
│     └─ completar-auditoria/index.ts
├─ src/
│  ├─ main.jsx
│  ├─ App.jsx
│  ├─ index.css
│  ├─ lib/
│  │  ├─ supabase.js            # cliente único
│  │  ├─ catalogos.js           # procesos, sistemas, clasificaciones
│  │  ├─ formato.js             # fechas, cédula, celular
│  │  └─ exportar.js            # PDF y DOCX del informe
│  ├─ contexts/
│  │  ├─ AuthContext.jsx
│  │  └─ ToastContext.jsx
│  ├─ hooks/
│  │  ├─ usePerfil.js
│  │  ├─ useAuditorias.js
│  │  └─ useHallazgos.js
│  ├─ components/
│  │  ├─ ui/                    # Boton, Campo, Select, Modal, Badge, Skeleton, Toast
│  │  ├─ layout/                # AppShell, Sidebar, Topbar, RutaProtegida
│  │  ├─ hallazgos/             # FormularioHallazgo, TarjetaHallazgo, BadgeClasificacion
│  │  └─ informe/               # VistaInforme, GraficaClasificaciones
│  └─ pages/
│     ├─ Landing.jsx
│     ├─ Login.jsx · Registro.jsx · RecuperarClave.jsx
│     ├─ Dashboard.jsx · Perfil.jsx
│     ├─ Auditorias.jsx · AuditoriaNueva.jsx · AuditoriaDetalle.jsx
│     ├─ HallazgoNuevo.jsx
│     ├─ Informe.jsx
│     └─ Normas.jsx
├─ .env.example
├─ CLAUDE.md                            # notas permanentes para futuras sesiones
└─ PROMPT_CLAUDE_CODE_HALLA.md          # este archivo
```

---

## 5. VARIABLES DE ENTORNO

`.env.example` (y `.env.local` real, **que va en `.gitignore`**):

```bash
# Frontend — públicas, protegidas por RLS
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_APP_NOMBRE=halla
VITE_APP_URL=https://halla.ink
```

Secretos **solo** en Supabase (`supabase secrets set ...`), nunca en el repo ni en el bundle:

```bash
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash        # configurable; ver nota de modelos abajo
GEMINI_MAX_OUTPUT_TOKENS=2048
PROMPT_VERSION=1.0.0
LIMITE_IA_DIARIO_POR_USUARIO=120
```

En GitHub, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se definen como **repository variables**
(Settings → Secrets and variables → Actions → Variables) y se inyectan en el paso de build.

> **Nota sobre el modelo de Gemini.** Los nombres de modelo y las cuotas del nivel gratuito cambian
> con frecuencia. No los hardcodees: léelos de `GEMINI_MODEL`. Antes de dar por terminada la Fase 4,
> verifica qué modelos acepta la API key con
> `GET https://generativelanguage.googleapis.com/v1beta/models?key=...` y deja documentado en
> `docs/DESPLIEGUE.md` el modelo que quedó funcionando. Prioriza un modelo **Flash** (los Pro suelen
> estar fuera del nivel gratuito). Diseña asumiendo límites del orden de **10–15 peticiones por
> minuto y unos cientos por día**: eso obliga a reintentos con backoff ante HTTP 429, a no disparar
> llamadas en paralelo y a una sola llamada a Gemini por hallazgo.

---

## 6. FASE 1 — ESQUELETO Y SISTEMA DE DISEÑO

### 6.1 Identidad visual

Marca: **halla** · dominio `halla.ink`. Tono: clínico, sobrio, profesional. Nada de degradados
morados genéricos ni emojis en la interfaz.

```js
// tailwind.config.js — paleta
colors: {
  tinta:   { 50:'#f4f6f8', 100:'#e6eaee', 300:'#9fb0bf', 500:'#4a6072', 700:'#2b3b49', 900:'#16222c' },
  halla:   { 50:'#eef6f5', 100:'#d5eceb', 400:'#4fb3aa', 500:'#2f9189', 600:'#237a73', 700:'#1b5f5a' },
  // Colores semánticos por clasificación — úsalos SIEMPRE consistentes
  nc:      { bg:'#fef2f2', borde:'#fca5a5', texto:'#991b1b' }, // NO CONFORMIDAD
  obs:     { bg:'#fffbeb', borde:'#fcd34d', texto:'#92400e' }, // OBSERVACIÓN
  fort:    { bg:'#f0fdf4', borde:'#86efac', texto:'#166534' }, // FORTALEZA
  om:      { bg:'#eff6ff', borde:'#93c5fd', texto:'#1e40af' }, // OPORTUNIDAD DE MEJORA
}
```

Tipografía: `Inter` (UI) y `Source Serif 4` (cuerpo del informe), cargadas desde Google Fonts con
`font-display: swap` y stack de respaldo. Radios `rounded-lg`, sombras suaves, foco visible en todos
los controles (`focus-visible:ring-2 ring-halla-500`). Contraste mínimo WCAG AA. Toda la interfaz en
español, con `lang="es-CO"`.

### 6.2 Componentes base

Crea en `src/components/ui/` componentes **sin librería externa de UI**: `Boton`, `Campo`,
`AreaTexto`, `Select`, `Checkbox`, `Badge`, `Tarjeta`, `Modal`, `Tabla`, `Skeleton`, `Toast`,
`EstadoVacio`. Cada uno acepta `className` y reenvía `ref`. Documenta sus props con JSDoc.

### 6.3 Catálogos (fuente única de verdad)

`src/lib/catalogos.js` — estos valores deben coincidir **exactamente** con los `enum` de PostgreSQL:

```js
export const ALCANCES = [
  { valor: 'PROCESOS', etiqueta: 'Procesos' },
  { valor: 'SISTEMAS', etiqueta: 'Sistemas' },
]

export const PROCESOS = [
  'Nutrición',
  'Imágenes diagnósticas',
  'Gestión hospitalaria universitaria',
  'Control interno',
  'Gestión cliente',
  'Terapias',
  'Hospital seguro',
  'Gestión de calidad',
  'Comercial y mercadeo',
  'Gestión humana',
  'Gestión de recursos físicos',
  'Gestión de la información',
  'Gestión gerencial',
  'Gestión del ambiente físico',
  'Gestión financiera',
  'Hospitalización',
  'Cirugía',
  'Urgencias',
  'Consulta externa',
]

export const SISTEMAS = [
  'Sistema Ambiental',
  'Sistema de Seguridad y Salud en el Trabajo',
  'Sistema de calidad',
  'SARLAFT Y SICOF',
  'UACAI',
  'Empresa familiar',
]

export const CLASIFICACIONES = {
  FORTALEZA:             { etiqueta: 'Fortaleza',             tono: 'fort' },
  NO_CONFORMIDAD:        { etiqueta: 'No conformidad',        tono: 'nc'   },
  OBSERVACION:           { etiqueta: 'Observación',           tono: 'obs'  },
  OPORTUNIDAD_DE_MEJORA: { etiqueta: 'Oportunidad de mejora', tono: 'om'   },
}
```

**Importante:** en base de datos y en el JSON de la IA se usan las claves con guion bajo y sin tilde
(`NO_CONFORMIDAD`, `OBSERVACION`, `OPORTUNIDAD_DE_MEJORA`); en pantalla y en el informe se muestran
siempre las etiquetas con tildes y mayúsculas correctas.

---

## 7. FASE 2 — BASE DE DATOS SUPABASE

Crea las migraciones en `supabase/migrations/` en el orden indicado. Documenta el modelo en
`docs/BASE_DE_DATOS.md` con un diagrama en Mermaid.

### 7.1 Tipos y perfiles — `0001_tipos_y_perfiles.sql`

```sql
create type alcance_tipo as enum ('PROCESOS', 'SISTEMAS');

create type proceso_tipo as enum (
  'Nutrición','Imágenes diagnósticas','Gestión hospitalaria universitaria','Control interno',
  'Gestión cliente','Terapias','Hospital seguro','Gestión de calidad','Comercial y mercadeo',
  'Gestión humana','Gestión de recursos físicos','Gestión de la información','Gestión gerencial',
  'Gestión del ambiente físico','Gestión financiera','Hospitalización','Cirugía','Urgencias',
  'Consulta externa'
);

create type sistema_tipo as enum (
  'Sistema Ambiental','Sistema de Seguridad y Salud en el Trabajo','Sistema de calidad',
  'SARLAFT Y SICOF','UACAI','Empresa familiar'
);

create type clasificacion_tipo as enum (
  'FORTALEZA','NO_CONFORMIDAD','OBSERVACION','OPORTUNIDAD_DE_MEJORA'
);

create type rol_tipo as enum ('auditor','admin');

create table public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  nombre_completo        text not null,
  cedula                 text not null,
  celular                text not null,
  cargo                  text not null,
  equipo_auditor_nombre  text not null,   -- el equipo auditor es SIEMPRE una persona más
  equipo_auditor_cargo   text not null,
  alcance                alcance_tipo not null,
  proceso                proceso_tipo,
  sistema                sistema_tipo,
  rol                    rol_tipo not null default 'auditor',
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),

  -- exactamente uno de los dos, según el alcance
  constraint alcance_coherente check (
    (alcance = 'PROCESOS' and proceso is not null and sistema is null) or
    (alcance = 'SISTEMAS' and sistema is not null and proceso is null)
  ),
  constraint cedula_valida  check (cedula  ~ '^[0-9]{6,12}$'),
  constraint celular_valido check (celular ~ '^[0-9]{10}$')
);

create unique index profiles_cedula_idx on public.profiles (cedula);

-- Crear el perfil automáticamente al registrarse, leyendo raw_user_meta_data
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (
    id, nombre_completo, cedula, celular, cargo,
    equipo_auditor_nombre, equipo_auditor_cargo, alcance, proceso, sistema
  ) values (
    new.id,
    new.raw_user_meta_data->>'nombre_completo',
    new.raw_user_meta_data->>'cedula',
    new.raw_user_meta_data->>'celular',
    new.raw_user_meta_data->>'cargo',
    new.raw_user_meta_data->>'equipo_auditor_nombre',
    new.raw_user_meta_data->>'equipo_auditor_cargo',
    (new.raw_user_meta_data->>'alcance')::alcance_tipo,
    nullif(new.raw_user_meta_data->>'proceso','')::proceso_tipo,
    nullif(new.raw_user_meta_data->>'sistema','')::sistema_tipo
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

> Si el trigger falla, el registro del usuario falla con un error opaco. Implementa en el frontend un
> **fallback**: si tras `signUp` no existe fila en `profiles`, insértala desde el cliente con el JWT
> recién emitido. Y registra el error real en consola para depurar.

### 7.2 Auditorías y hallazgos — `0002_auditorias_y_hallazgos.sql`

```sql
create type estado_auditoria as enum ('borrador','en_curso','cerrada');
create type estado_hallazgo  as enum ('generado','editado','confirmado','descartado');

create table public.auditorias (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  codigo           text not null,                 -- p. ej. AI-2026-014
  titulo           text not null,
  alcance          alcance_tipo not null,
  proceso          proceso_tipo,
  sistema          sistema_tipo,
  objetivo         text,                          -- lo puede redactar la IA
  criterios        text[] default '{}',           -- normas aplicables, las puede sugerir la IA
  area_auditada    text,
  auditado_nombre  text,
  auditado_cargo   text,
  fecha_inicio     date,
  fecha_fin        date,
  estado           estado_auditoria not null default 'borrador',
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint alcance_auditoria_coherente check (
    (alcance = 'PROCESOS' and proceso is not null and sistema is null) or
    (alcance = 'SISTEMAS' and sistema is not null and proceso is null)
  )
);
create unique index auditorias_codigo_usuario_idx on public.auditorias (user_id, codigo);

create table public.hallazgos (
  id                  uuid primary key default gen_random_uuid(),
  auditoria_id        uuid not null references public.auditorias(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  consecutivo         int  not null,              -- 1,2,3... por auditoría
  entrada_auditor     text not null,              -- texto crudo, NUNCA se sobrescribe
  clasificacion       clasificacion_tipo not null,
  justificacion       text not null,
  hallazgo_corregido  text not null,
  criterio_requisito  text not null,
  evidencia           text not null,
  severidad           text,                        -- alta | media | baja (sugerida por la IA)
  estado              estado_hallazgo not null default 'generado',
  editado_por_usuario boolean not null default false,
  modelo_ia           text,
  prompt_version      text,
  respuesta_cruda     jsonb,                       -- JSON completo devuelto por Gemini
  criterios_citados   jsonb default '[]'::jsonb,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index hallazgos_auditoria_idx on public.hallazgos (auditoria_id, consecutivo);
create unique index hallazgos_consecutivo_idx on public.hallazgos (auditoria_id, consecutivo);
```

Asigna el `consecutivo` con un trigger `before insert` que calcule
`coalesce(max(consecutivo),0)+1` para esa auditoría (no lo calcules en el cliente: hay carreras).

### 7.3 Criterios normativos — `0003_criterios_normativos.sql`

Esta es la tabla que alimenta la recuperación. Cada fila es **un numeral** de una norma.

```sql
create extension if not exists pg_trgm;
create extension if not exists unaccent;

create table public.criterios_normativos (
  id                uuid primary key default gen_random_uuid(),
  documento_codigo  text not null,     -- 'NTC-ISO 9001:2015'
  documento_titulo  text not null,
  archivo           text not null,     -- '1_NTC_ISO_9001_2015.md'
  idioma            text not null default 'es',
  numeral           text,              -- '9.3.3'  (null en anexos sin numerar)
  titulo            text not null,
  contenido         text not null,
  nivel             int,               -- profundidad del numeral: 9.3.3 → 3
  orden             int not null,
  aplica_a          text[] default '{}', -- procesos/sistemas donde aplica, opcional
  creado_en         timestamptz not null default now()
);

alter table public.criterios_normativos
  add column busqueda tsvector generated always as (
    to_tsvector('spanish',
      coalesce(numeral,'') || ' ' || coalesce(titulo,'') || ' ' || coalesce(contenido,''))
  ) stored;

create index criterios_busqueda_idx on public.criterios_normativos using gin (busqueda);
create index criterios_titulo_trgm_idx on public.criterios_normativos using gin (titulo gin_trgm_ops);
create index criterios_doc_idx on public.criterios_normativos (documento_codigo, orden);
create unique index criterios_unicos_idx
  on public.criterios_normativos (archivo, coalesce(numeral,''), orden);

-- Función de recuperación usada por las Edge Functions
create or replace function public.buscar_criterios(
  consulta   text,
  documentos text[] default null,
  limite     int    default 12
)
returns table (
  id uuid, documento_codigo text, numeral text, titulo text, contenido text, puntaje real
)
language sql stable as $$
  select c.id, c.documento_codigo, c.numeral, c.titulo,
         left(c.contenido, 2500) as contenido,
         ts_rank(c.busqueda, websearch_to_tsquery('spanish', consulta)) as puntaje
  from public.criterios_normativos c
  where (documentos is null or c.documento_codigo = any(documentos))
    and c.busqueda @@ websearch_to_tsquery('spanish', consulta)
  order by puntaje desc, c.orden asc
  limit limite;
$$;
```

> **Gotcha conocido.** `to_tsvector('spanish', ...)` no elimina tildes, así que "gestion" no empata
> con "gestión". Lo correcto es crear una configuración `es_unaccent`:
>
> ```sql
> create text search configuration es_unaccent (copy = spanish);
> alter text search configuration es_unaccent
>   alter mapping for hword, hword_part, word with unaccent, spanish_stem;
> ```
>
> En Supabase las extensiones viven en el esquema `extensions`, así que esto puede requerir
> `set search_path` o calificar el diccionario. **Inténtalo primero**; si la migración falla, deja
> `'spanish'` y normaliza las tildes del lado de la consulta en la Edge Function, y anota la
> limitación en `docs/BASE_DE_DATOS.md`. No bloquees el proyecto por esto.

### 7.4 Informes y trazabilidad — `0004_informes_y_logs.sql`

```sql
create table public.informes (
  id                 uuid primary key default gen_random_uuid(),
  auditoria_id       uuid not null references public.auditorias(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  version            int  not null default 1,
  resumen_ejecutivo  text,
  conclusiones       text,
  recomendaciones    text,
  estadisticas       jsonb,     -- conteos por clasificación, por criterio, etc.
  contenido          jsonb,     -- estructura completa renderizable
  modelo_ia          text,
  prompt_version     text,
  generado_en        timestamptz not null default now()
);
create index informes_auditoria_idx on public.informes (auditoria_id, version desc);

create table public.ia_eventos (
  id             bigserial primary key,
  user_id        uuid references auth.users(id) on delete set null,
  funcion        text not null,          -- clasificar-hallazgo | generar-informe | ...
  modelo         text,
  prompt_version text,
  exito          boolean not null,
  codigo_error   text,
  latencia_ms    int,
  tokens_entrada int,
  tokens_salida  int,
  creado_en      timestamptz not null default now()
);
create index ia_eventos_usuario_dia_idx on public.ia_eventos (user_id, creado_en desc);
```

### 7.5 RLS — `0005_rls.sql`

Activa RLS en **todas** las tablas. Reglas:

| Tabla | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `profiles` | el propio usuario, o cualquier `admin` | solo el propio usuario (sin poder cambiar `rol`) |
| `auditorias` | dueño o `admin` | dueño |
| `hallazgos` | dueño o `admin` | dueño |
| `informes` | dueño o `admin` | dueño |
| `criterios_normativos` | cualquier usuario autenticado | nadie (solo `service_role`) |
| `ia_eventos` | solo `admin` | solo `service_role` |

```sql
alter table public.profiles enable row level security;

create policy "perfil propio visible" on public.profiles
  for select using (auth.uid() = id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.rol = 'admin'));

create policy "perfil propio editable" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- Impide escalada de privilegios: revoca la columna rol a los usuarios normales
revoke update (rol) on public.profiles from authenticated;
```

Replica el patrón `auth.uid() = user_id` para las demás tablas. **Escribe un pequeño script de
verificación** (`scripts/verificar-rls.mjs`) que, con dos usuarios de prueba, confirme que el usuario
A no puede leer ni modificar los hallazgos del usuario B. No des la fase por terminada sin esa prueba.

---

## 8. FASE 3 — INGESTA DE LOS DOCUMENTOS NORMATIVOS

Los cinco `.md` del repo son la **única fuente de criterios** que puede citar la IA.

| Archivo | Documento | Idioma | Tamaño aprox. |
|---|---|---|---|
| `1_NTC_ISO_9001_2015.md` | NTC-ISO 9001:2015 — Sistemas de gestión de la calidad | es | 110 KB |
| `2_iso-45001-norma-Internacional.md` | ISO 45001:2018 — Seguridad y salud en el trabajo | es | 165 KB |
| `3_NTC-ISO_14001-2015.md` | NTC-ISO 14001:2015 — Gestión ambiental | es | 135 KB |
| `4_ISO_FDIS_19011__E__1.md` | ISO/FDIS 19011 — Guidelines for auditing management systems | **en** | 150 KB |
| `5_PR13_GQ_Gestion_de_riesgos__2_.md` | PR13-GQ — Procedimiento institucional de gestión de riesgos | es | 37 KB |

### 8.1 Troceado

Los numerales vienen marcados como encabezados Markdown con negritas, en distintos niveles según el
archivo. Patrón real observado:

```
#### **9.3.3 Salidas de la revisión por la dirección**
### **6 Planificación**
###### **3.1**
# **4. MARCO CONCEPTUAL**
```

Regex de corte sugerido:

```js
const RE_NUMERAL = /^(#{1,6})\s*\*{0,2}\s*(\d+(?:\.\d+)*)\.?\s+(.*?)\s*\*{0,2}\s*$/
```

Reglas del troceador `scripts/ingest-normas.mjs`:

1. Recorre el archivo línea por línea. Cada encabezado que empate con `RE_NUMERAL` abre un chunk
   nuevo; todo lo que siga hasta el próximo encabezado numerado es su `contenido`.
2. `nivel` = número de segmentos del numeral (`9.3.3` → 3). `orden` = índice secuencial en el archivo.
3. Descarta secciones de prólogo, índice, bibliografía y control de versiones (no son requisitos).
   Identifícalas por título (`Prólogo`, `Índice`, `CONTENIDO`, `Bibliografía`, `Foreword`, …).
4. Si un chunk supera ~6.000 caracteres, pártelo por párrafos y sufija el `orden`
   (mismo `numeral`, `titulo` igual, campo `parte`).
5. Para `ISO/FDIS 19011` marca `idioma = 'en'`. La IA debe **citar el numeral tal cual** pero
   redactar siempre en español.
6. Normaliza espacios, elimina marcas de paginación sueltas (líneas con solo números) y las
   secuencias `**` que queden huérfanas.
7. Sube en lotes de 100 filas con `upsert` sobre `(archivo, numeral, orden)` usando la
   **service role key** leída de `process.env.SUPABASE_SERVICE_ROLE_KEY` (nunca commiteada).
8. Al terminar imprime un resumen: filas por documento, numerales detectados, chunks descartados.

Ejecuta: `node scripts/ingest-normas.mjs` y verifica con una consulta de prueba que
`select * from buscar_criterios('revisión por la dirección salidas')` devuelva el numeral **9.3.3**
de ISO 9001 en los primeros resultados. Ese es el criterio de aceptación de la fase.

### 8.2 Relación entre alcance y documentos

`src/lib/catalogos.js` y la Edge Function comparten este mapa, que **filtra** los documentos
consultados según el alcance de la auditoría (reduce ruido y tokens):

```js
export const DOCUMENTOS_POR_ALCANCE = {
  'Sistema Ambiental':                            ['NTC-ISO 14001:2015', 'ISO 19011', 'PR13-GQ'],
  'Sistema de Seguridad y Salud en el Trabajo':   ['ISO 45001:2018', 'ISO 19011', 'PR13-GQ'],
  'Sistema de calidad':                           ['NTC-ISO 9001:2015', 'ISO 19011', 'PR13-GQ'],
  'SARLAFT Y SICOF':                              ['PR13-GQ', 'ISO 19011'],
  'UACAI':                                        ['ISO 19011', 'PR13-GQ'],
  'Empresa familiar':                             ['ISO 19011', 'PR13-GQ'],
  // Todos los PROCESOS: calidad + riesgos + guía de auditoría
  __PROCESOS__:                                   ['NTC-ISO 9001:2015', 'PR13-GQ', 'ISO 19011'],
}
```

Si la búsqueda filtrada no devuelve nada, **reintenta sin filtro** antes de rendirte.

---

## 9. FASE 4 — MOTOR DE IA (el corazón del sistema)

### 9.1 Edge Function `clasificar-hallazgo`

**Contrato HTTP**

```
POST /functions/v1/clasificar-hallazgo
Authorization: Bearer <JWT del usuario>
Content-Type: application/json

{
  "auditoria_id": "uuid",
  "entrada_auditor": "Se revisaron 20 historias clínicas y en 5 no se encontró...",
  "contexto": { "notas": "opcional, lo que el auditor quiera añadir" },
  "persistir": true
}
```

**Respuesta**

```json
{
  "ok": true,
  "hallazgos": [
    {
      "id": "uuid o null si persistir=false",
      "clasificacion": "NO_CONFORMIDAD",
      "justificacion": "...",
      "hallazgo_corregido": "...",
      "criterio_requisito": "...",
      "evidencia": "...",
      "severidad": "alta",
      "criterios_citados": [
        { "criterio_id": "uuid", "numeral": "7.5.3", "documento": "NTC-ISO 9001:2015", "verificado": true }
      ]
    }
  ],
  "meta": { "modelo": "...", "prompt_version": "1.0.0", "latencia_ms": 2140, "criterios_recuperados": 12 }
}
```

**Pasos internos, en este orden exacto:**

1. **CORS + autenticación.** Rechaza sin JWT válido (401). Obtén `user_id` del token, nunca del body.
2. **Autorización.** Verifica que la `auditoria_id` pertenece a ese `user_id` (403 si no).
3. **Cuota.** Cuenta `ia_eventos` del usuario en las últimas 24 h; si supera
   `LIMITE_IA_DIARIO_POR_USUARIO`, responde 429 con mensaje en español.
4. **Recuperación de criterios.** Construye la consulta de búsqueda a partir de
   `entrada_auditor` + nombre del proceso/sistema. Limpia *stopwords* obvias, llama a
   `buscar_criterios(consulta, documentos_filtrados, 12)`. Si vuelve vacío, repite sin filtro de
   documentos; si sigue vacío, continúa **sin criterios** (la IA deberá usar el marcador de requisito
   pendiente).
5. **Construcción del prompt.** `systemInstruction` = ANEXO A literal (sin recortar). El mensaje de
   usuario lleva este formato exacto:

```
## CONTEXTO DE LA AUDITORÍA
Alcance: SISTEMAS
Sistema auditado: Sistema de calidad
Proceso/área: Gestión de calidad
Auditoría: AI-2026-014 — Auditoría interna de calidad
Fecha: 2026-10-03

## CRITERIOS NORMATIVOS DISPONIBLES
Son los ÚNICOS requisitos que puedes citar. Cada uno tiene un identificador.
Si ninguno sustenta el hallazgo, usa el marcador de requisito pendiente.

[C1] id=9f3a... | NTC-ISO 9001:2015 | numeral 9.3.3 | Salidas de la revisión por la dirección
Las salidas de la revisión por la dirección deben incluir las decisiones y acciones...

[C2] id=4b21... | NTC-ISO 9001:2015 | numeral 7.5.3 | Control de la información documentada
...

## HALLAZGO REPORTADO POR EL AUDITOR
"""
<entrada_auditor, sin modificar>
"""

Responde ÚNICAMENTE con el JSON definido en el esquema.
```

6. **Llamada a Gemini** con salida estructurada:

```ts
const body = {
  systemInstruction: { parts: [{ text: PROMPT_SISTEMA_EXPERTO }] },
  contents: [{ role: 'user', parts: [{ text: mensajeUsuario }] }],
  generationConfig: {
    temperature: 0.2,            // clasificación consistente, no creativa
    topP: 0.8,
    maxOutputTokens: Number(Deno.env.get('GEMINI_MAX_OUTPUT_TOKENS') ?? 2048),
    responseMimeType: 'application/json',
    responseSchema: ESQUEMA_SALIDA,
  },
}
```

Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`
con cabecera `x-goog-api-key`. **Reintentos:** hasta 3, con backoff exponencial (1 s, 4 s, 10 s) ante
`429` y `5xx`. Ante `400` no reintentes: es un error de esquema o de prompt, devuélvelo registrado.

7. **Validación de la salida** (sección 9.3). 8. **Persistencia** si `persistir = true`.
9. **Registro** en `ia_eventos` siempre, con éxito o error.

### 9.2 Esquema de salida (`_shared/esquema-salida.ts`)

```ts
export const ESQUEMA_SALIDA = {
  type: 'object',
  properties: {
    hallazgos: {
      type: 'array',
      description: 'Normalmente un elemento. Varios SOLO si la entrada contiene situaciones de categorías distintas.',
      items: {
        type: 'object',
        properties: {
          clasificacion: {
            type: 'string',
            enum: ['FORTALEZA', 'NO_CONFORMIDAD', 'OBSERVACION', 'OPORTUNIDAD_DE_MEJORA'],
          },
          justificacion:      { type: 'string' },
          hallazgo_corregido: { type: 'string' },
          criterio_requisito: { type: 'string' },
          evidencia:          { type: 'string' },
          severidad:          { type: 'string', enum: ['alta', 'media', 'baja'] },
          criterios_citados: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                criterio_id: { type: 'string', description: 'id exacto de la lista de criterios entregada' },
                numeral:     { type: 'string' },
                documento:   { type: 'string' },
              },
              required: ['criterio_id', 'numeral', 'documento'],
            },
          },
        },
        required: ['clasificacion','justificacion','hallazgo_corregido','criterio_requisito','evidencia','criterios_citados'],
      },
    },
  },
  required: ['hallazgos'],
}
```

### 9.3 Validación anti-alucinación (`_shared/validar-salida.ts`) — **crítico**

Este módulo es la diferencia entre una herramienta de auditoría y un generador de texto bonito.
Después de recibir el JSON de Gemini, aplica **en el servidor**:

**V1 — Criterios citados reales.** Para cada elemento de `criterios_citados`, comprueba que
`criterio_id` esté en el conjunto de criterios que tú mismo entregaste en el prompt **y** que el
`numeral` coincida con el de ese registro en base de datos. Los que no empaten se eliminan y se
marcan en el log. Nunca aceptes un numeral que la IA haya "recordado" por su cuenta.

**V2 — Requisito pendiente.** Si tras V1 no queda ningún criterio verificado, reemplaza el campo
`criterio_requisito` por exactamente:

```
[Requisito específico pendiente de identificación/validación]
```

y, si la clasificación es `NO_CONFORMIDAD`, **mantén la clasificación** (así lo exige la regla de
negocio) pero elimina del `hallazgo_corregido` cualquier referencia normativa no verificada:
detecta patrones `/\b(ISO|NTC|numeral|artículo|decreto|resolución)\s*[\d.:-]+/i` que no correspondan
a un criterio verificado y sustitúyelos por el marcador.

**V3 — Estructura según categoría.** Verificación heurística del `hallazgo_corregido`:

| Clasificación | Debe contener | No debe contener |
|---|---|---|
| `NO_CONFORMIDAD` | evidencia + alguna forma de "incumpl…" + referencia al requisito | "susceptible de mejorar", "podría mejorar" |
| `OBSERVACION` | "podría" / "puede" / "representa un riesgo" | "incumpliendo", "incumple" |
| `FORTALEZA` | verbo en presente + beneficio ("permite", "favorece", "contribuye", "fortalece") | "excelente", "muy bueno", "maravilloso", "permitirá" |
| `OPORTUNIDAD_DE_MEJORA` | "susceptible de mejorar" / "es posible" + beneficio futuro ("permitirá", "facilitará", "contribuirá", "favorecerá") | "incumpliendo", "no cumple" |

**V4 — Reparación en un solo reintento.** Si V3 falla, haz **una** segunda llamada a Gemini
añadiendo al final del prompt:

```
La respuesta anterior no cumplió la estructura obligatoria de la categoría <X>.
Problema detectado: <descripción exacta del fallo>.
Reescribe el campo "hallazgo_corregido" respetando la fórmula obligatoria de esa categoría.
No cambies la clasificación ni inventes requisitos.
```

Si el segundo intento también falla, **entrega igualmente el resultado** marcando el hallazgo con
`estado = 'generado'` y un aviso visible en la interfaz: *"Revisa la redacción: no se pudo verificar
automáticamente la estructura de la categoría."* Nunca bloquees el trabajo del auditor.

**V5 — Longitud y limpieza.** `hallazgo_corregido` entre 120 y 900 caracteres; `justificacion` entre
60 y 500. Elimina comillas envolventes, viñetas sueltas y encabezados Markdown que la IA haya metido.

**V6 — Prohibido inventar datos de la entrada.** Si el `hallazgo_corregido` contiene fechas, números
de historia clínica, cantidades o nombres propios que **no** aparecen en `entrada_auditor` ni en los
criterios recuperados, elimínalos o repórtalos. Implementa al menos la comprobación de fechas
(`\d{1,2}\s+de\s+\w+\s+de\s+\d{4}` y `\d{2}/\d{2}/\d{4}`) y de cifras con unidades.

### 9.4 Edge Function `completar-auditoria`

Cumple el requisito de *"la IA rellena todos los campos que no se le piden al auditor"*.
Recibe `{ alcance, proceso|sistema, titulo?, fechas? }` y devuelve `objetivo`, `criterios`
(lista de normas aplicables tomadas de los documentos cargados, **no inventadas**), `area_auditada`
sugerida y un `codigo` propuesto con formato `AI-<año>-<consecutivo>`. El usuario puede editar todo
antes de guardar. Salida con `responseSchema` igual que arriba.

### 9.5 Edge Function `generar-informe`

Entrada: `{ auditoria_id }`. Pasos:

1. Verifica propiedad de la auditoría.
2. Carga la auditoría, el perfil (auditor + equipo auditor) y **todos** los hallazgos en estado
   distinto de `descartado`, ordenados por consecutivo.
3. Calcula las estadísticas **en código, no con la IA**: totales por clasificación, por criterio
   normativo citado, por severidad. Los números no se alucinan.
4. Llama a Gemini **una sola vez** para producir únicamente las partes narrativas:
   `resumen_ejecutivo`, `conclusiones`, `recomendaciones`. Instrucción explícita:
   *"No inventes hallazgos, cifras ni requisitos. Usa exclusivamente los hallazgos y estadísticas
   entregados. Redacta en español técnico de auditoría, en tercera persona, sin adjetivos valorativos."*
5. Arma el objeto `contenido` con la estructura de informe de ISO 19011 y guárdalo en `informes`
   incrementando `version`.

Estructura obligatoria del informe:

```
1. Identificación          — código, institución, fecha de emisión
2. Objetivo de la auditoría
3. Alcance                 — procesos/sistemas, periodo, área auditada
4. Criterios de auditoría  — normas y documentos aplicados (solo los realmente citados)
5. Equipo auditor          — auditor líder (perfil) + acompañante (equipo auditor)
6. Metodología             — revisión documental, entrevista, observación
7. Resumen de resultados   — tabla y gráfica de conteos por clasificación
8. Hallazgos en detalle    — agrupados por clasificación, en el orden:
                             No conformidades → Observaciones → Oportunidades de mejora → Fortalezas
                             (cada uno: consecutivo, hallazgo corregido, criterio, evidencia)
9. Conclusiones
10. Recomendaciones
11. Firmas                 — auditor líder y equipo auditor, con cargo y cédula
```

---

## 10. FASE 5 — INTERFAZ

### 10.1 Rutas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/` | Landing de `halla.ink` | pública |
| `/ingresar` | Inicio de sesión | pública |
| `/registro` | Registro en pasos | pública |
| `/recuperar` | Recuperación de contraseña | pública |
| `/app` | Panel principal | protegida |
| `/app/perfil` | Perfil del auditor | protegida |
| `/app/auditorias` | Listado de auditorías | protegida |
| `/app/auditorias/nueva` | Crear auditoría (con asistencia de IA) | protegida |
| `/app/auditorias/:id` | Detalle + hallazgos | protegida |
| `/app/auditorias/:id/hallazgos/nuevo` | **Pantalla estrella**: capturar y clasificar | protegida |
| `/app/auditorias/:id/informe` | Informe: generar, revisar, exportar | protegida |
| `/app/normas` | Explorador de criterios normativos | protegida |

`RutaProtegida` redirige a `/ingresar` conservando el destino en `location.state.from`.

### 10.2 Registro en 3 pasos

Un solo formulario largo asusta. Divídelo con un indicador de progreso:

**Paso 1 — Cuenta:** correo, contraseña (mínimo 8 caracteres, con medidor de fuerza), confirmación.
**Paso 2 — Datos del auditor:** nombre completo, número de cédula, número de celular, cargo.
**Paso 3 — Equipo auditor y alcance:** nombre del equipo auditor, cargo del equipo auditor
(texto de ayuda: *"El equipo auditor corresponde siempre a una persona adicional"*); luego
`Alcance` → `Procesos` o `Sistemas` con dos tarjetas seleccionables; al elegir, aparece el
`<select>` correspondiente (19 procesos o 6 sistemas). **El select contrario se limpia y se oculta.**

Validación con `zod` + `react-hook-form`:

```js
cedula:  z.string().regex(/^\d{6,12}$/,  'La cédula debe tener entre 6 y 12 dígitos, sin puntos')
celular: z.string().regex(/^\d{10}$/,    'El celular debe tener 10 dígitos')
```

Normaliza antes de validar: quita puntos, espacios, guiones y el prefijo `+57`.

Los datos del paso 2 y 3 viajan en `options.data` de `supabase.auth.signUp` para que el trigger cree
el perfil. Mensajes de error **en español** y específicos ("Ese correo ya está registrado", no
"User already registered").

### 10.3 Pantalla de captura de hallazgo (la más importante)

Diseño en dos columnas en escritorio, apiladas en móvil.

**Izquierda — Entrada:**
- Un `<textarea>` grande (mínimo 10 filas), etiqueta: *"Describe lo que observaste durante la
  auditoría"*, placeholder con un ejemplo real, contador de caracteres, mínimo 25.
- Ayuda contextual plegable: *"Incluye qué revisaste, cuántos registros, qué encontraste y dónde."*
- Campo opcional "Notas o contexto adicional".
- Botón primario **"Analizar con IA"**.
- **No hay ningún selector de clasificación.** Si encuentras uno en el `Primer_prototipo`, elimínalo.

**Derecha — Resultado:**
- Mientras procesa: *skeleton* con pasos visibles ("Buscando criterios aplicables…",
  "Analizando evidencia…", "Redactando hallazgo…"). La espera real es de 3–8 s; comunícala.
- Resultado: tarjeta con el `BadgeClasificacion` grande y coloreado según la categoría, y los campos
  **Justificación**, **Hallazgo corregido**, **Criterio / Requisito**, **Evidencia**, **Severidad**.
- Cada campo es editable *in situ* (clic para editar). Al editar cualquiera → `editado_por_usuario = true`.
- Los criterios citados se muestran como *chips* clicables que abren un modal con el texto completo
  del numeral. Un chip con el marcador de requisito pendiente se muestra en gris con tooltip:
  *"La IA no encontró un requisito verificable; identifícalo manualmente."*
- Bloque plegable **"Ver texto original del auditor"** — nunca se pierde.
- Acciones: **Guardar hallazgo**, **Reanalizar**, **Descartar**.
- Si la IA devolvió varios hallazgos (entrada con situaciones de distinta categoría), muéstralos como
  tarjetas separadas con aviso: *"Se detectaron N situaciones distintas; se guardarán por separado."*

### 10.4 Detalle de auditoría

Cabecera con código, título, alcance, estado y contadores por clasificación (cuatro tarjetas con los
colores semánticos). Tabla/lista de hallazgos con consecutivo, badge, extracto del hallazgo corregido
y criterio. Filtros por clasificación y por estado. Búsqueda en texto. Acciones: ver, editar,
descartar, duplicar. Botón **"Generar informe"** habilitado solo con al menos un hallazgo confirmado.

### 10.5 Panel principal

Saludo con el nombre del auditor y su proceso/sistema. Tarjetas: auditorías en curso, hallazgos del
mes, distribución por clasificación (gráfica de barras con `recharts` usando los colores semánticos),
últimos hallazgos. Acceso rápido a "Nuevo hallazgo". Estado vacío útil cuando no hay datos: explica
el primer paso, no muestres una gráfica en cero.

### 10.6 Explorador de normas

Buscador sobre `criterios_normativos` (RPC `buscar_criterios` desde el cliente, es lectura permitida).
Filtro por documento. Resultados con numeral, título y extracto resaltado. Sirve al auditor para
consultar requisitos sin salir de la plataforma y da transparencia sobre qué "sabe" la IA.

### 10.7 Accesibilidad y detalles

- Todos los campos con `<label>` asociado; errores enlazados con `aria-describedby`.
- Foco visible, navegación completa por teclado, `aria-live="polite"` para el resultado de la IA.
- Nunca uses solo el color para indicar la clasificación: badge con **texto** siempre.
- Estados de carga, vacío y error en **todas** las vistas que consultan datos.
- Formato de fechas en español con `date-fns` y locale `es`.

---

## 11. FASE 6 — EXPORTACIÓN DEL INFORME

`src/lib/exportar.js`:

- **PDF** (`jspdf` + `jspdf-autotable`): tamaño carta, márgenes 2 cm, encabezado con el código de la
  auditoría y pie con número de página y fecha de generación. Tablas de hallazgos con la fila
  coloreada según clasificación. Fuente con soporte de tildes y "ñ" (registra una fuente Unicode;
  la Helvetica por defecto de jsPDF rompe caracteres latinos en algunos visores).
- **Word** (`docx` + `file-saver`): mismo contenido, estilos de encabezado nativos, tabla de
  contenido automática. Es el formato que el hospital normalmente pide editable.
- Nombre de archivo: `Informe_<codigo-auditoria>_<AAAAMMDD>.pdf`.
- Imprimir: hoja `@media print` que oculte navegación y conserve colores.

---

## 12. FASE 7 — DESPLIEGUE

### 12.1 GitHub Actions

Adapta el workflow existente, sin romperlo:

```yaml
name: Deploy
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Verifica que `dist/CNAME` y `dist/404.html` existan en el artefacto.

### 12.2 DNS en Namecheap para `halla.ink`

En *Domain List → Manage → Advanced DNS*:

| Tipo | Host | Valor |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `OscarNarvaez.github.io.` |

Elimina los registros de *parking* que Namecheap crea por defecto. Luego, en GitHub →
Settings → Pages → Custom domain: `halla.ink`, y marca **Enforce HTTPS** cuando el certificado se
emita (puede tardar hasta 24 h). Documenta todo en `docs/DESPLIEGUE.md`.

> **Si finalmente se aloja en el hosting de Namecheap (cPanel) en vez de GitHub Pages:** el build es
> el mismo; se sube el contenido de `dist/` a `public_html/` y se añade un `.htaccess` con el
> *fallback* de SPA a `index.html`. Deja esa alternativa documentada en `docs/DESPLIEGUE.md`.

### 12.3 Supabase

```bash
supabase link --project-ref <ref>
supabase db push
supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=... PROMPT_VERSION=1.0.0
supabase functions deploy clasificar-hallazgo generar-informe completar-auditoria
```

En *Authentication → URL Configuration* agrega `https://halla.ink` como Site URL y como Redirect URL
(más `http://localhost:5173` para desarrollo). Configura CORS en las funciones para aceptar
`https://halla.ink` y `http://localhost:5173`, **no** `*`.

---

## 13. CRITERIOS DE ACEPTACIÓN

No des el proyecto por terminado sin verificar uno por uno:

**Seguridad**
- [ ] `grep -ri "AIza" src/ dist/` no devuelve nada. La API key de Gemini no está en el bundle.
- [ ] El usuario A no puede leer ni editar auditorías, hallazgos ni informes del usuario B (probado).
- [ ] Un usuario autenticado no puede cambiar su propio `rol` a `admin`.
- [ ] Las Edge Functions rechazan peticiones sin JWT válido (401) y de auditorías ajenas (403).
- [ ] `.env.local` y cualquier `service_role` key están en `.gitignore` y fuera del historial de git.

**Reglas de negocio**
- [ ] No existe ningún control en la interfaz que permita elegir la clasificación antes del análisis.
- [ ] Ninguna respuesta cita un numeral que no esté en `criterios_normativos` (probado con un
      hallazgo sobre un tema ausente de las normas cargadas).
- [ ] Cuando no hay criterio verificable, aparece exactamente
      `[Requisito específico pendiente de identificación/validación]`.
- [ ] Las cuatro estructuras de redacción se respetan (un caso de prueba por categoría, ver §14).
- [ ] La `entrada_auditor` original siempre se conserva y es consultable.
- [ ] El alcance obliga a elegir proceso **o** sistema, nunca ambos ni ninguno.

**Funcionamiento**
- [ ] Registro completo → perfil creado en `profiles` con los 8 campos.
- [ ] Ciclo completo: crear auditoría → 4 hallazgos (uno por categoría) → generar informe → exportar
      PDF y Word con tildes correctas.
- [ ] Ante HTTP 429 de Gemini, la interfaz muestra un mensaje claro en español y permite reintentar.
- [ ] Funciona en móvil (360 px de ancho) sin desbordes horizontales.
- [ ] `npm run build` sin errores ni warnings de ESLint.
- [ ] Rutas profundas (`halla.ink/app/auditorias/<id>`) cargan tras refrescar el navegador.

---

## 14. CASOS DE PRUEBA OBLIGATORIOS

Crea `docs/PRUEBAS.md` con estos casos y sus resultados reales:

| # | Entrada del auditor | Clasificación esperada |
|---|---|---|
| 1 | "Se revisaron 20 historias clínicas y en 5 de ellas no se encontró registrada la valoración de enfermería requerida." | `NO_CONFORMIDAD` |
| 2 | "El equipo realiza seguimiento mensual a los indicadores y utiliza los resultados para definir acciones." | `FORTALEZA` |
| 3 | "Los registros están completos, pero algunas firmas son poco legibles." | `OBSERVACION` |
| 4 | "El registro de asistencia actualmente se realiza correctamente en formato físico." | `OPORTUNIDAD_DE_MEJORA` |
| 5 | "En la revisión por la dirección no se incluyeron las decisiones y acciones frente a las oportunidades de mejora." | `NO_CONFORMIDAD` citando ISO 9001 **9.3.3** verificado |
| 6 | "El parqueadero de visitantes es pequeño y se llena los viernes." | Cualquiera, **sin** inventar numeral → requisito pendiente |
| 7 | "Se evidenció extintor vencido en el área de urgencias y además el personal muestra un excelente dominio del protocolo de código azul." | **Dos** hallazgos separados: `NO_CONFORMIDAD` + `FORTALEZA` |

Ejecuta los siete contra la función desplegada y pega las respuestas reales. El caso 6 y el 7 son los
que más fallan: préstales atención.

---

## 15. CÓMO TRABAJAR (instrucciones de proceso para Claude Code)

- **Una fase por sesión.** Al terminar cada fase: resumen de lo hecho, archivos tocados, cómo probarlo
  y un commit con mensaje convencional (`feat(db): esquema de auditorías y hallazgos`).
- **Nunca** commitees `.env.local`, claves `service_role` ni `node_modules`.
- **No toques `Primer_prototipo/`.** Es referencia, no código vivo.
- Si una decisión de este documento choca con lo que encuentras en el repo, **pregunta** antes de
  romper algo que ya funciona.
- Si una dependencia o API no se comporta como dice este documento (nombres de modelo de Gemini,
  extensiones de Postgres en Supabase, versión de una librería), **verifica contra la documentación
  real** y anota la discrepancia en `docs/RECONOCIMIENTO.md`. Este documento es la intención, no la
  verdad de la API.
- Mantén `CLAUDE.md` actualizado con convenciones, comandos útiles y decisiones tomadas, para que las
  siguientes sesiones arranquen con contexto.
- Comentarios de código y mensajes de interfaz en español; nombres de variables en español también
  (ya están así los catálogos y el esquema: sé consistente).

---

# ANEXO A — PROMPT DEL SISTEMA EXPERTO (copiar **literalmente**)

Guárdalo en `supabase/functions/_shared/prompt-sistema-experto.ts` como constante exportada y
pásalo en `systemInstruction`. **No lo resumas, no lo reescribas, no lo "optimices".** Las reglas de
clasificación son criterio profesional del dueño del proyecto, no sugerencias.

Dos únicas adaptaciones respecto del texto original, ambas ya aplicadas abajo:

1. La sección de formato de respuesta se cambió de Markdown a **JSON**, porque la aplicación consume
   salida estructurada (`responseSchema`).
2. Los nombres de categoría en el JSON van **sin tildes y con guion bajo**
   (`NO_CONFORMIDAD`, `OBSERVACION`, `OPORTUNIDAD_DE_MEJORA`), para coincidir con el `enum` de
   PostgreSQL. En el texto redactado se siguen usando las formas correctas en español.

```text
# SISTEMA EXPERTO PARA CLASIFICACIÓN Y REDACCIÓN DE HALLAZGOS DE AUDITORÍA INTERNA

Actúa como un auditor interno experto en gestión de calidad, auditoría de procesos, auditoría en
salud y evaluación del cumplimiento de requisitos en organizaciones del sector salud en Colombia.

Tu función es recibir un hallazgo, observación, evidencia o descripción proporcionada por el auditor
y realizar automáticamente DOS procesos:

PROCESO 1: Determinar la clasificación correcta del hallazgo.
PROCESO 2: Corregir y mejorar la redacción del hallazgo de acuerdo con la clasificación determinada.

Las únicas categorías permitidas son:
- FORTALEZA
- NO CONFORMIDAD
- OBSERVACIÓN
- OPORTUNIDAD DE MEJORA

---

# REGLA FUNDAMENTAL

La clasificación debe ser realizada automáticamente por el sistema.
El usuario NO debe seleccionar manualmente si se trata de una Fortaleza, No Conformidad,
Observación u Oportunidad de Mejora.

Nunca solicites al usuario:
- Seleccionar una clasificación.
- Confirmar una clasificación.
- Escoger entre varias categorías.
- Decidir si el hallazgo es una No Conformidad o una Observación.

La IA debe analizar la información disponible y tomar la decisión.
Siempre debes devolver una de las cuatro categorías.

---

# PROCESO 1 – CLASIFICACIÓN AUTOMÁTICA

Antes de redactar el hallazgo corregido, analiza internamente:
1. La evidencia encontrada.
2. El requisito que debería cumplirse.
3. El nivel de cumplimiento.
4. La existencia o ausencia de evidencia objetiva.
5. La existencia de debilidades o riesgos.
6. La existencia de prácticas positivas.
7. La existencia de posibilidades de optimización.
8. El impacto de la situación sobre el proceso, sistema o estrategia.
9. La repetición del hallazgo.
10. La relación entre lo documentado y lo que realmente ocurre.

Después de realizar este análisis, selecciona UNA SOLA categoría.

---

# REGLAS DE CLASIFICACIÓN

## A. NO CONFORMIDAD

Clasifica como NO CONFORMIDAD cuando exista evidencia objetiva de incumplimiento total o parcial de
un requisito obligatorio.

El requisito puede provenir de: requisitos legales, requisitos reglamentarios, requisitos del
cliente, requisitos institucionales, normas aplicables, ISO 9001, procedimientos, protocolos, guías,
manuales, políticas, estándares, instrucciones documentadas, requisitos internos establecidos.

### Indicadores frecuentes de No Conformidad

Presta especial atención a expresiones como: No se evidencia. No cumple. No existe. No se encuentra.
No está registrado. No fue realizado. No se realizó. Falta. Está incompleto. Está vencido. No se
documentó. No se diligenció. No se cuenta con. Existe incumplimiento. La práctica no corresponde al
procedimiento. El documento establece una condición diferente de la práctica real.

Estas expresiones NO significan automáticamente que exista una No Conformidad. Primero determina si
aquello que falta, está incompleto o no se realiza corresponde realmente a un requisito obligatorio.

### También considera No Conformidad cuando:
- Existe incumplimiento de requisitos del cliente, legales, institucionales o normativos.
- El mismo incumplimiento se repite durante la auditoría.
- La situación genera un impacto significativo para la organización.
- La documentación establece una condición diferente a la realidad.
- El auditado desconoce disposiciones documentadas que le son aplicables.
- Existen contradicciones entre procedimientos, formatos, guías u otros documentos.
- No existen evidencias objetivas o registros que son obligatorios.
- Falta información obligatoria en registros.
- Se incumple una actividad expresamente establecida.
- Se incumple un criterio previamente definido para el proceso.

### Regla crítica
Si existe un incumplimiento demostrable de un requisito obligatorio, la clasificación DEBE ser
NO CONFORMIDAD. No la clasifiques como Observación simplemente porque el incumplimiento parezca
pequeño.

---

## B. OBSERVACIÓN

Clasifica como OBSERVACIÓN cuando no exista un incumplimiento directo demostrable, pero exista una:
debilidad, vulnerabilidad, inconsistencia, riesgo potencial, situación susceptible de generar un
incumplimiento futuro, o condición que podría afectar el proceso, sistema o estrategia.

### Regla crítica
La Observación se utiliza cuando NO PUEDES AFIRMAR QUE EXISTE INCUMPLIMIENTO, PERO SÍ PUEDES
IDENTIFICAR UNA DEBILIDAD O RIESGO.

Ejemplo: "Los registros están diligenciados, pero algunas firmas presentan baja legibilidad."
Si no existe un requisito que establezca específicamente otra condición, esto puede ser una
OBSERVACIÓN, porque existe una debilidad que afecta la trazabilidad, pero no necesariamente un
incumplimiento.

---

## C. FORTALEZA

Clasifica como FORTALEZA cuando exista una práctica positiva relevante, control efectivo, estrategia
sobresaliente o aspecto que genere un beneficio demostrado para: el proceso, el sistema, la
organización, la seguridad, la calidad, el desempeño, la eficiencia o la gestión.

### Regla crítica
No clasifiques como Fortaleza únicamente porque "se hace algo correctamente". Debe existir un
aspecto relevante o una práctica destacada y un beneficio evidenciable.

Ejemplo: "El servicio realiza seguimiento mensual a los indicadores." Esto por sí solo puede
representar simplemente cumplimiento.
Pero: "El servicio realiza seguimiento sistemático a los indicadores y utiliza sus resultados para
orientar acciones de mejora." Aquí existe una práctica positiva con un beneficio para la gestión,
por lo que puede clasificarse como FORTALEZA.

---

## D. OPORTUNIDAD DE MEJORA

Clasifica como OPORTUNIDAD DE MEJORA cuando:
- El requisito se cumple.
- No existe incumplimiento.
- No existe una debilidad significativa que justifique una Observación.
- Existe una posibilidad de hacer el proceso más eficiente, ágil, seguro, cómodo, innovador o
  efectivo.

### Regla crítica
La Oportunidad de Mejora significa: "Actualmente cumple, pero podría hacerse mejor."
No debe existir un incumplimiento obligatorio.

Ejemplo: "El control de asistencia se realiza correctamente en formato físico." Puede generarse una
oportunidad de mejora: "El proceso de registro de asistencia es susceptible de mejorar mediante la
digitalización del formato, lo cual permitirá agilizar la consolidación de la información y
facilitar su análisis."

---

# ORDEN OBLIGATORIO PARA RESOLVER AMBIGÜEDADES

Cuando un hallazgo pueda parecer perteneciente a varias categorías, aplica este orden:

PRIMERA PREGUNTA: ¿Existe un requisito obligatorio que no se está cumpliendo y existe evidencia
objetiva de ello?  SÍ → NO CONFORMIDAD.  NO → continuar.

SEGUNDA PREGUNTA: ¿Existe una debilidad, vulnerabilidad, inconsistencia o riesgo potencial?
SÍ → OBSERVACIÓN.  NO → continuar.

TERCERA PREGUNTA: ¿Existe una práctica positiva relevante que genera un beneficio actual y
demostrable?  SÍ → FORTALEZA.  NO → continuar.

CUARTA PREGUNTA: ¿El proceso cumple y simplemente existe una posibilidad de optimizarlo?
SÍ → OPORTUNIDAD DE MEJORA.

---

# REGLA DE PRECEDENCIA

- Incumplimiento demostrado → NO CONFORMIDAD
- Debilidad o riesgo sin incumplimiento → OBSERVACIÓN
- Práctica positiva destacada con beneficio → FORTALEZA
- Posibilidad de optimización sin incumplimiento → OPORTUNIDAD DE MEJORA

Nunca clasifiques una situación como Oportunidad de Mejora si existe un incumplimiento comprobado.
Nunca clasifiques una situación como Fortaleza si únicamente existe cumplimiento básico.
Nunca clasifiques una situación como No Conformidad si solamente existe una recomendación o una
posibilidad de hacer algo mejor.

---

# PROCESO 2 – HALLAZGO CORREGIDO

Después de determinar la clasificación, debes reescribir completamente el hallazgo.
No debes limitarte a corregir ortografía.

Debes transformar la redacción para que tenga: claridad, objetividad, lenguaje técnico de auditoría,
evidencia concreta, relación lógica con la clasificación, redacción profesional y coherencia con el
requisito o criterio evaluado.

El hallazgo corregido debe seguir OBLIGATORIAMENTE la estructura correspondiente a la clasificación.

---

# ESTRUCTURA PARA FORTALEZA

Fórmula obligatoria: ASPECTO RELEVANTE O FORTALEZA + BENEFICIO OBTENIDO EN EL SISTEMA O LA
ESTRATEGIA. Debe redactarse en tiempo presente.

Modelo: "[Aspecto relevante o práctica positiva], porque permite/favorece/contribuye al
fortalecimiento de [beneficio actual]."

Ejemplo: "Se evidencia liderazgo de la alta dirección en el sistema de gestión, favoreciendo la
mejora de los procesos y el fortalecimiento de las competencias del personal."

Reglas: utilizar tiempo presente; mostrar claramente el aspecto positivo; expresar el beneficio
actual; no inventar resultados; no utilizar beneficios futuros; evitar expresiones subjetivas como
"excelente", "muy bueno", "maravilloso".

---

# ESTRUCTURA PARA OPORTUNIDAD DE MEJORA

Fórmula obligatoria: ASPECTO SUSCEPTIBLE DE MEJORAR + PARA LO CUAL + BENEFICIO FUTURO.

Modelo: "[Aspecto] es susceptible de mejorar mediante [acción o alternativa], lo cual permitirá
[beneficio futuro]."

Ejemplo: "La infraestructura para la prestación de los servicios es susceptible de mejorar, para lo
cual se podrían fortalecer los espacios destinados a la atención, lo que permitirá contar con
ambientes más agradables y confortables para el cliente."

Reglas: utilizar lenguaje propositivo; no afirmar incumplimiento; explicar qué podría mejorarse; el
beneficio debe proyectarse hacia el futuro; utilizar expresiones como permitirá, favorecerá,
facilitará, contribuirá, fortalecerá; no transformar una No Conformidad en una oportunidad de mejora.

---

# ESTRUCTURA PARA NO CONFORMIDAD

Fórmula obligatoria: EVIDENCIA + INCUMPLIMIENTO + REQUISITO INCUMPLIDO.

Modelo: "Durante [actividad/revisión/fecha/lugar] se evidenció [hecho objetivo], incumpliendo
[requisito], establecido en [norma/procedimiento/documento/numeral]."

Ejemplo: "En la Revisión por la Dirección del 14 de julio de 2021 no se incluyó la información
relacionada con las decisiones y acciones frente a las oportunidades de mejora, incumpliendo lo
establecido en la NTC-ISO 9001:2015, numeral 9.3.3."

Reglas obligatorias: comenzar por la evidencia; explicar claramente qué ocurrió; identificar la
condición incumplida; identificar el requisito; identificar el criterio normativo cuando esté
disponible; no inventar numerales; no inventar normas; no inventar requisitos; diferenciar
claramente la evidencia del requisito.

Cuando el requisito específico no esté disponible: si la evidencia demuestra claramente que existe
incumplimiento, pero no se proporciona el requisito exacto, mantén la clasificación como
NO CONFORMIDAD. Redacta el hallazgo con base en la evidencia y escribe:
"[Requisito específico pendiente de identificación/validación]". No inventes la referencia normativa.

---

# ESTRUCTURA PARA OBSERVACIÓN

Fórmula obligatoria: ASPECTO A MEJORAR O DEBILIDAD + IMPACTO POTENCIAL.

Modelo: "Se evidencia [debilidad o aspecto], situación que podría [impacto potencial] en el proceso,
sistema o estrategia."

Ejemplo: "Se evidencia falta de planificación de los cambios relacionados con la reposición e
incorporación de tecnología biomédica, situación que podría incrementar el riesgo de ocurrencia de
eventos adversos."

Reglas: primero describir la debilidad; después describir el posible impacto; utilizar enfoque
preventivo; utilizar "podría", "puede", "representa un riesgo", "podría afectar", cuando corresponda;
no afirmar que el impacto ya ocurrió cuando solamente existe riesgo; no convertir una debilidad en
No Conformidad sin evidencia de incumplimiento.

---

# DIFERENCIA ENTRE LAS CUATRO REDACCIONES

- FORTALEZA: lo hacemos bien y genera un beneficio actual → aspecto positivo + beneficio actual.
- OPORTUNIDAD DE MEJORA: lo hacemos bien, pero podría hacerse mejor → susceptible de mejorar +
  beneficio futuro.
- OBSERVACIÓN: no necesariamente incumplimos, pero existe una debilidad o riesgo → debilidad +
  impacto potencial.
- NO CONFORMIDAD: existe evidencia de que no cumplimos un requisito → evidencia + incumplimiento +
  requisito.

---

# MANEJO DE EVIDENCIA

La evidencia es el elemento principal para realizar la clasificación.

No debes inventar hechos, registros, fechas, entrevistas, documentos, requisitos, resultados ni
numerales normativos.

Solo puedes utilizar la información proporcionada por el auditor y los criterios normativos que se
te entregan explícitamente en el contexto. Si un numeral o norma no aparece en la lista de criterios
entregada, NO lo cites.

Cuando existan varios elementos en el mismo hallazgo, identifica cuál es el elemento principal que
determina la clasificación.

---

# MANEJO DE HALLAZGOS CON VARIAS SITUACIONES

Si el texto contiene varias situaciones:
1. Identifica cada situación.
2. Determina si pertenecen al mismo criterio.
3. Determina cuál es la condición predominante.
4. Si todas corresponden al mismo tipo de hallazgo, clasifícalas juntas en un solo hallazgo.
5. Si existen situaciones claramente diferentes, devuélvelas como hallazgos separados en el arreglo
   "hallazgos".

Nunca mezcles en una misma redacción una No Conformidad con una Fortaleza u Oportunidad de Mejora.

---

# FORMATO DE RESPUESTA OBLIGATORIO

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin explicaciones y sin bloques
de código Markdown. La estructura es:

{
  "hallazgos": [
    {
      "clasificacion": "FORTALEZA" | "NO_CONFORMIDAD" | "OBSERVACION" | "OPORTUNIDAD_DE_MEJORA",
      "justificacion": "Explicación breve y objetiva de por qué se seleccionó esa clasificación.",
      "hallazgo_corregido": "Redacción del hallazgo con la estructura obligatoria de la categoría.",
      "criterio_requisito": "Requisito, norma, procedimiento, política o numeral relacionado, únicamente cuando pueda identificarse con los criterios entregados. Si no, exactamente: [Requisito específico pendiente de identificación/validación]",
      "evidencia": "Evidencia objetiva utilizada para sustentar la clasificación.",
      "severidad": "alta" | "media" | "baja",
      "criterios_citados": [
        { "criterio_id": "id exacto de la lista entregada", "numeral": "9.3.3", "documento": "NTC-ISO 9001:2015" }
      ]
    }
  ]
}

Normalmente el arreglo "hallazgos" tendrá UN solo elemento. Devuelve más de uno únicamente cuando la
entrada contenga situaciones que correspondan a categorías diferentes.

El campo "criterio_id" debe copiarse EXACTAMENTE de la lista de criterios normativos entregada en el
contexto. Si no utilizas ningún criterio de esa lista, "criterios_citados" debe ser un arreglo vacío
y "criterio_requisito" debe contener el marcador de requisito pendiente.

Toda la redacción debe estar en español, en tercera persona, con lenguaje técnico de auditoría,
incluso si el criterio normativo consultado está en inglés (en ese caso cita el numeral tal como
aparece, pero redacta en español).

---

# REGLA FINAL Y OBLIGATORIA

Antes de responder, realiza internamente esta secuencia:
1. IDENTIFICAR EVIDENCIA
2. IDENTIFICAR REQUISITO
3. DETERMINAR SI EXISTE INCUMPLIMIENTO
4. SI EXISTE INCUMPLIMIENTO → NO CONFORMIDAD
5. SI NO EXISTE INCUMPLIMIENTO, BUSCAR DEBILIDAD O RIESGO
6. SI EXISTE DEBILIDAD/RIESGO → OBSERVACIÓN
7. SI NO EXISTE DEBILIDAD, BUSCAR PRÁCTICA POSITIVA DESTACADA
8. SI EXISTE BENEFICIO POSITIVO DEMOSTRABLE → FORTALEZA
9. SI NO, DETERMINAR SI EXISTE POSIBILIDAD DE OPTIMIZACIÓN
10. SI EXISTE → OPORTUNIDAD DE MEJORA
11. REDACTAR EL HALLAZGO CORREGIDO SEGÚN LA ESTRUCTURA ESPECÍFICA DE LA CATEGORÍA

La clasificación siempre debe producirse automáticamente y el hallazgo corregido debe ser coherente
con ella.
```

---

# ANEXO B — ESQUELETO DEL TROCEADOR DE NORMAS

Punto de partida para `scripts/ingest-normas.mjs`; complétalo y pruébalo contra los cinco archivos.

```js
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const RE_NUMERAL = /^(#{1,6})\s*\*{0,2}\s*(\d+(?:\.\d+)*)\.?\s+(.*?)\s*\*{0,2}\s*$/
const DESCARTAR = /^(prólogo|prologo|índice|indice|contenido|bibliografía|bibliografia|foreword|introduction|contents|control de versión|anexos?)\b/i

const DOCUMENTOS = {
  '1_NTC_ISO_9001_2015.md':               { codigo: 'NTC-ISO 9001:2015',  titulo: 'Sistemas de gestión de la calidad. Requisitos', idioma: 'es' },
  '2_iso-45001-norma-Internacional.md':   { codigo: 'ISO 45001:2018',     titulo: 'Sistemas de gestión de la seguridad y salud en el trabajo', idioma: 'es' },
  '3_NTC-ISO_14001-2015.md':              { codigo: 'NTC-ISO 14001:2015', titulo: 'Sistemas de gestión ambiental', idioma: 'es' },
  '4_ISO_FDIS_19011__E__1.md':            { codigo: 'ISO 19011',          titulo: 'Guidelines for auditing management systems', idioma: 'en' },
  '5_PR13_GQ_Gestion_de_riesgos__2_.md':  { codigo: 'PR13-GQ',            titulo: 'Procedimiento de gestión de riesgos', idioma: 'es' },
}

function trocear(texto, meta, archivo) {
  const lineas = texto.split('\n')
  const chunks = []
  let actual = null
  let orden = 0

  for (const linea of lineas) {
    const m = linea.match(RE_NUMERAL)
    if (m) {
      if (actual) chunks.push(actual)
      const [, , numeral, titulo] = m
      actual = {
        archivo,
        documento_codigo: meta.codigo,
        documento_titulo: meta.titulo,
        idioma: meta.idioma,
        numeral,
        titulo: titulo.replace(/\*+/g, '').trim(),
        nivel: numeral.split('.').length,
        orden: orden++,
        lineas: [],
      }
      continue
    }
    if (actual) actual.lineas.push(linea)
  }
  if (actual) chunks.push(actual)

  return chunks
    .filter(c => !DESCARTAR.test(c.titulo))
    .map(c => ({ ...c, contenido: limpiar(c.lineas.join('\n')) }))
    .filter(c => c.contenido.length > 40)
    .flatMap(partirLargos)   // > 6000 caracteres → varias partes
}

function limpiar(t) {
  return t
    .replace(/^\s*\d+\s*$/gm, '')      // números de página sueltos
    .replace(/\*{2,}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// … partirLargos(), subida en lotes de 100 con upsert, resumen final
```

---

# ANEXO C — ARRANQUE RÁPIDO

```bash
# 1. Dependencias
npm install

# 2. Entorno local
cp .env.example .env.local        # completar con los valores reales de Supabase

# 3. Base de datos
supabase link --project-ref <ref>
supabase db push

# 4. Cargar las normas (requiere SUPABASE_SERVICE_ROLE_KEY en el entorno, NO en el repo)
node scripts/ingest-normas.mjs

# 5. Secretos y funciones
supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=... PROMPT_VERSION=1.0.0
supabase functions deploy clasificar-hallazgo generar-informe completar-auditoria

# 6. Desarrollo
npm run dev

# 7. Publicar
git push origin main              # GitHub Actions construye y despliega a halla.ink
```

---

## RESUMEN DE LO QUE NO SE PUEDE NEGOCIAR

1. La clasificación la decide la IA, nunca el usuario.
2. La IA no cita ningún numeral que no esté verificado contra `criterios_normativos`.
3. Sin criterio verificable → `[Requisito específico pendiente de identificación/validación]`.
4. La `GEMINI_API_KEY` nunca sale de las Edge Functions.
5. La entrada original del auditor nunca se pierde ni se sobrescribe.
6. Cada categoría tiene su fórmula de redacción y se valida en el servidor.
7. Frontend en JavaScript, no TypeScript. Interfaz íntegramente en español.
