// Prueba de extremo a extremo de la interfaz SIN backend: compila la app contra un Supabase ficticio,
// la sirve con `vite preview` y la recorre en Chromium real interceptando la red (PostgREST, Auth y
// Edge Functions). Las respuestas de la IA son las reales de `pnpm probar:motor` (scripts/fixtures).
//
// Uso: pnpm probar:interfaz
// Requiere Chromium de Playwright: pnpm dlx playwright install chromium-headless-shell
// (o CHROMIUM_PATH=/ruta/al/navegador). Capturas, PDF y Word quedan en .e2e/capturas/ (gitignored).
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { homedir } from 'node:os'
import { build, preview } from 'vite'

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const SALIDA = `${REPO}/.e2e`
const CAPTURAS = `${SALIDA}/capturas/`
mkdirSync(CAPTURAS, { recursive: true })
const { calcularEstadisticas, construirContenido, narrativaRespaldo } = await import(`${REPO}/supabase/functions/_shared/informe.ts`)
const motor = JSON.parse(readFileSync(`${REPO}/scripts/fixtures/motor-casos.json`, 'utf8'))

// Compila con un Supabase ficticio (la red se intercepta en el navegador)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
// Con «\r\n» al final, como quedó la variable real en GitHub: el build debe normalizarla
process.env.VITE_SUPABASE_URL = 'https://demo.supabase.co\r\n'
process.env.VITE_SUPABASE_ANON_KEY = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'anon', exp: 9999999999 })}.firma`
console.log('Compilando la app de prueba…')
await build({ root: REPO, logLevel: 'error', build: { outDir: `${SALIDA}/dist`, emptyOutDir: true } })
// PDF de evidencia de prueba: uno con texto (el caso 7) y otro sin texto, como un documento escaneado
const { jsPDF } = await import('jspdf')
const ENTRADA7 = motor.resultados.find((r) => r.caso.n === 7).caso.entrada
const PDF_TEXTO = `${SALIDA}/evidencia.pdf`
const PDF_ESCANEADO = `${SALIDA}/escaneado.pdf`
{
  const conTexto = new jsPDF()
  conTexto.setFontSize(11)
  conTexto.text(conTexto.splitTextToSize(ENTRADA7, 180), 15, 20)
  writeFileSync(PDF_TEXTO, Buffer.from(conTexto.output('arraybuffer')))
  const sinTexto = new jsPDF()
  sinTexto.rect(20, 20, 120, 80, 'F')
  writeFileSync(PDF_ESCANEADO, Buffer.from(sinTexto.output('arraybuffer')))
}
const servidor = await preview({ root: REPO, logLevel: 'error', preview: { port: 4173, strictPort: true }, build: { outDir: `${SALIDA}/dist` } })

function rutaChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  const cache = `${homedir()}/.cache/ms-playwright`
  if (!existsSync(cache)) return undefined
  const carpeta = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().at(-1)
  const ruta = carpeta && `${cache}/${carpeta}/chrome-headless-shell-linux64/chrome-headless-shell`
  return ruta && existsSync(ruta) ? ruta : undefined
}

const BASE = 'http://localhost:4173'
const USUARIO = '11111111-1111-4111-8111-111111111111'
const A1 = '22222222-2222-4222-8222-222222222222'
let fallos = 0
const ok = (c, d, det = '') => {
  console.log(`  ${c ? '✓' : '✗'} ${d}${!c && det ? `\n      → ${det}` : ''}`)
  if (!c) fallos++
}

// ─── Datos simulados ────────────────────────────────────────────────────────
const perfil = {
  id: USUARIO, nombre_completo: 'Ana María Rodríguez Peña', cedula: '1085123456', celular: '3001234567', cargo: 'Auditora interna',
  equipo_auditor_nombre: 'Laura Gómez Ñáñez', equipo_auditor_cargo: 'Profesional de calidad', alcance: 'PROCESOS', proceso: 'Urgencias', sistema: null,
  rol: 'auditor', aprobado: true, aprobado_en: '2026-09-02T10:00:00Z', acepto_tratamiento_datos_en: '2026-09-01T10:00:00Z',
  creado_en: '2026-09-01T10:00:00Z', actualizado_en: '2026-09-01T10:00:00Z',
}
const ahora = new Date().toISOString()
const db = {
  profiles: [perfil],
  auditorias: [{
    id: A1, user_id: USUARIO, codigo: 'AI-2026-001', titulo: 'Auditoría interna al proceso de Urgencias', alcance: 'PROCESOS', proceso: 'Urgencias', sistema: null,
    objetivo: 'Evaluar el cumplimiento de los requisitos aplicables al proceso de Urgencias del Hospital Infantil Los Ángeles.',
    criterios: ['NTC-ISO 9001:2015', 'PR13-GQ', 'ISO 19011'], area_auditada: 'Servicio de Urgencias', auditado_nombre: 'Jorge Muñoz', auditado_cargo: 'Coordinador de Urgencias',
    fecha_inicio: '2026-10-01', fecha_fin: '2026-10-03', estado: 'en_curso',
    creado_en: '2026-10-01T08:00:00Z', actualizado_en: ahora,
  }],
  hallazgos: [],
  informes: [],
  criterios_normativos: [],
}
// Criterios citados por el motor real, para el modal
for (const r of motor.resultados) for (const h of r.resultado.hallazgos) for (const c of h.criterios_citados) {
  if (!db.criterios_normativos.some((x) => x.id === c.criterio_id)) {
    db.criterios_normativos.push({ id: c.criterio_id, documento_codigo: c.documento, documento_titulo: 'Sistemas de gestión de la calidad. Requisitos', numeral: c.numeral, titulo: c.titulo,
      contenido: `Texto del numeral ${c.numeral} (${c.titulo}). La organización debe… información documentada, revisión, acción.`, idioma: 'es', parte: 1 })
  }
}
// Tres hallazgos previos (casos 2, 3 y 4 del motor real), confirmados
let consecutivo = 0
const nuevoHallazgo = (h, entrada, estado = 'generado') => ({
  id: crypto.randomUUID(), auditoria_id: A1, user_id: USUARIO, consecutivo: ++consecutivo, entrada_auditor: entrada, clasificacion: h.clasificacion,
  justificacion: h.justificacion, hallazgo_corregido: h.hallazgo_corregido, criterio_requisito: h.criterio_requisito, evidencia: h.evidencia, severidad: h.severidad,
  estado, editado_por_usuario: false, modelo_ia: 'gemini-3.6-flash', prompt_version: '1.1.0', criterios_citados: h.criterios_citados, avisos: h.avisos ?? [],
  riesgo_descripcion: h.riesgo?.descripcion ?? null, riesgo_dimension: h.riesgo?.dimension ?? null, riesgo_probabilidad: h.riesgo?.probabilidad ?? null,
  riesgo_impacto: h.riesgo?.impacto ?? null, riesgo_justificacion: h.riesgo?.justificacion ?? null,
  // Los hallazgos ya validados tienen adoptado su primer control (como exige la matriz)
  controles: (h.controles ?? []).map((c, i) => ({ ...c, adoptado: estado === 'confirmado' && i === 0 })),
  evidencia_archivo: null, nota_validacion: null,
  creado_en: new Date(Date.now() - (10 - consecutivo) * 3600e3).toISOString(), actualizado_en: ahora,
})
for (const n of [2, 3, 4]) {
  const r = motor.resultados.find((x) => x.caso.n === n)
  db.hallazgos.push(nuevoHallazgo(r.resultado.hallazgos[0], r.caso.entrada, 'confirmado'))
}

// ─── PostgREST simulado ────────────────────────────────────────────────────
function filtrar(filas, params) {
  let salida = [...filas]
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    const [op, ...resto] = v.split('.')
    const valor = resto.join('.')
    if (op === 'eq') salida = salida.filter((f) => String(f[k]) === valor)
    if (op === 'neq') salida = salida.filter((f) => String(f[k]) !== valor)
    if (op === 'in') {
      const lista = valor.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))
      salida = salida.filter((f) => lista.includes(String(f[k])))
    }
    if (op === 'like') salida = salida.filter((f) => new RegExp(`^${valor.replace(/[%*]/g, '.*')}$`).test(String(f[k])))
  }
  const orden = params.get('order')
  if (orden) {
    const [col, dir] = orden.split('.')
    salida.sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === 'desc' ? -1 : 1))
  }
  if (params.get('limit')) salida = salida.slice(0, Number(params.get('limit')))
  return salida
}
function embeber(tabla, filas, select) {
  if (tabla === 'auditorias' && /hallazgos\(/.test(select)) {
    return filas.map((a) => ({ ...a, hallazgos: db.hallazgos.filter((h) => h.auditoria_id === a.id).map((h) => ({ clasificacion: h.clasificacion, estado: h.estado })) }))
  }
  if (tabla === 'hallazgos' && /auditorias\(/.test(select)) {
    return filas.map((h) => ({ ...h, auditorias: { codigo: db.auditorias.find((a) => a.id === h.auditoria_id)?.codigo } }))
  }
  return filas
}
const peticiones = []

async function postgrest(route) {
  const req = route.request()
  const url = new URL(req.url())
  const tabla = url.pathname.replace('/rest/v1/', '')
  const metodo = req.method()
  const objeto = (req.headers().accept ?? '').includes('vnd.pgrst.object')
  const cuerpo = req.postData() ? JSON.parse(req.postData()) : null
  peticiones.push({ metodo, tabla, params: Object.fromEntries(url.searchParams), cuerpo })
  const responder = (datos, extra = {}) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(objeto && Array.isArray(datos) ? datos[0] ?? null : datos), ...extra })

  if (tabla.startsWith('rpc/')) {
    if (tabla === 'rpc/resumen_documentos') {
      return responder([
        { documento_codigo: 'ISO 19011', documento_titulo: 'Guidelines for auditing management systems', idioma: 'en', fragmentos: 94, numerales: 85 },
        { documento_codigo: 'NTC-ISO 9001:2015', documento_titulo: 'Sistemas de gestión de la calidad. Requisitos', idioma: 'es', fragmentos: 55, numerales: 55 },
        { documento_codigo: 'PR13-GQ', documento_titulo: 'Procedimiento institucional de gestión de riesgos (V4)', idioma: 'es', fragmentos: 22, numerales: 5 },
      ])
    }
    if (tabla === 'rpc/explorar_criterios') {
      return responder(db.criterios_normativos.slice(0, 3).map((c) => ({ ...c, extracto: `… la organización debe conservar ⟦información documentada⟧ como evidencia de la ⟦revisión⟧ …`, puntaje: 0.2 })))
    }
    return responder([])
  }

  const filas = db[tabla]
  if (!filas) return route.fulfill({ status: 404, body: '{}' })

  if (metodo === 'HEAD' || (metodo === 'GET' && (req.headers().prefer ?? '').includes('count=exact') && url.searchParams.get('select') === 'id')) {
    const n = filtrar(filas, url.searchParams).length
    return route.fulfill({ status: 200, headers: { 'content-range': `*/${n}`, 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: metodo === 'HEAD' ? '' : '[]' })
  }
  if (metodo === 'GET') return responder(embeber(tabla, filtrar(filas, url.searchParams), url.searchParams.get('select') ?? ''))
  if (metodo === 'POST') {
    const nuevos = (Array.isArray(cuerpo) ? cuerpo : [cuerpo]).map((f) => ({
      id: crypto.randomUUID(), creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString(),
      ...(tabla === 'hallazgos' ? { consecutivo: ++consecutivo, avisos: [], criterios_citados: [], modelo_ia: null, prompt_version: null } : {}),
      ...(tabla === 'auditorias' ? { estado: 'borrador' } : {}),
      ...f,
    }))
    filas.push(...nuevos)
    return responder(nuevos, { status: 201 })
  }
  if (metodo === 'PATCH') {
    const objetivo = filtrar(filas, url.searchParams)
    for (const f of objetivo) {
      Object.assign(f, cuerpo, { actualizado_en: new Date().toISOString() })
      // el trigger de la BD marca editado_por_usuario
      const contenido = ['clasificacion', 'justificacion', 'hallazgo_corregido', 'criterio_requisito', 'evidencia', 'severidad', 'riesgo_descripcion',
        'riesgo_dimension', 'riesgo_probabilidad', 'riesgo_impacto', 'riesgo_justificacion', 'controles']
      if (tabla === 'hallazgos' && contenido.some((c) => c in cuerpo)) {
        f.editado_por_usuario = true
        if (f.estado === 'confirmado' && !('estado' in cuerpo)) f.estado = 'editado' // la validación no sobrevive a un cambio
      }
    }
    return responder(objetivo)
  }
  return route.fulfill({ status: 405, body: '{}' })
}

// ─── Edge Functions simuladas (con la salida real del motor) ───────────────
async function funciones(route) {
  const nombre = new URL(route.request().url()).pathname.split('/').pop()
  const cuerpo = JSON.parse(route.request().postData() ?? '{}')
  peticiones.push({ metodo: 'FUNC', tabla: nombre, cuerpo })
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  if (nombre === 'clasificar-hallazgo') {
    await new Promise((r) => setTimeout(r, 1800)) // la espera real es de varios segundos
    const caso = motor.resultados.find((r) => r.caso.n === 7)
    const creados = caso.resultado.hallazgos.map((h) => ({ ...nuevoHallazgo(h, cuerpo.entrada_auditor), evidencia_archivo: cuerpo.evidencia_archivo ?? null }))
    db.hallazgos.push(...creados)
    return json({
      ok: true,
      hallazgos: creados.map((h) => ({ id: h.id, clasificacion: h.clasificacion, justificacion: h.justificacion, hallazgo_corregido: h.hallazgo_corregido,
        criterio_requisito: h.criterio_requisito, evidencia: h.evidencia, severidad: h.severidad, criterios_citados: h.criterios_citados, avisos: h.avisos,
        riesgo_descripcion: h.riesgo_descripcion, riesgo_dimension: h.riesgo_dimension, riesgo_probabilidad: h.riesgo_probabilidad, riesgo_impacto: h.riesgo_impacto,
        riesgo_justificacion: h.riesgo_justificacion, controles: h.controles })),
      meta: { modelo: 'gemini-3.5-flash', prompt_version: '1.1.0', latencia_ms: 1800, criterios_recuperados: 12, reparado: false },
    })
  }
  if (nombre === 'completar-auditoria') {
    return json({ ok: true, sugerencia: { codigo: 'AI-2026-002', objetivo: 'Evaluar la conformidad del proceso de Cirugía frente a los requisitos aplicables.', criterios: ['NTC-ISO 9001:2015', 'PR13-GQ'], area_auditada: 'Salas de cirugía' }, meta: { ia: true, modelo: 'gemini-3.8-flash' } })
  }
  if (nombre === 'generar-informe') {
    const a = db.auditorias.find((x) => x.id === cuerpo.auditoria_id)
    const lista = db.hallazgos.filter((h) => h.auditoria_id === a.id && h.estado !== 'descartado').sort((x, y) => x.consecutivo - y.consecutivo)
    const estadisticas = calcularEstadisticas(lista)
    const narrativa = narrativaRespaldo(a, estadisticas)
    const version = db.informes.filter((i) => i.auditoria_id === a.id).length + 1
    const contenido = construirContenido({ auditoria: a, perfil, hallazgos: lista, estadisticas, narrativa, fechaEmision: '2026-10-04', version, avisos: [] })
    const informe = { id: crypto.randomUUID(), auditoria_id: a.id, user_id: USUARIO, version, ...narrativa, recomendaciones: narrativa.recomendaciones.join('\n'), estadisticas, contenido, modelo_ia: 'gemini-3.8-flash', prompt_version: '1.0.0', generado_en: new Date().toISOString() }
    db.informes.push(informe)
    return json({ ok: true, informe, meta: { modelo: 'gemini-3.8-flash', ia: true } })
  }
  return json({ ok: false, error: 'función desconocida' }, 404)
}

async function prepararContexto(navegador, { sesion, ancho = 1280, alto = 900 }) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, locale: 'es-CO', acceptDownloads: true })
  if (sesion) {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USUARIO, role: 'authenticated', exp: 9999999999, email: 'ana@hila.test' })}.firma`
    const usuario = { id: USUARIO, aud: 'authenticated', role: 'authenticated', email: 'ana@hila.test', user_metadata: {}, app_metadata: {}, created_at: '2026-09-01T10:00:00Z' }
    const valor = JSON.stringify({ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 9999999999, refresh_token: 'r', user: usuario })
    await contexto.addInitScript((v) => window.localStorage.setItem('sb-demo-auth-token', v), valor)
  }
  await contexto.route('https://demo.supabase.co/rest/v1/**', postgrest)
  await contexto.route('https://demo.supabase.co/functions/v1/**', funciones)
  await contexto.route('https://demo.supabase.co/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // Las fuentes de Google no son necesarias para la prueba
  await contexto.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }))
  return contexto
}

async function sinDesborde(pagina, nombre) {
  const { ancho, vista, culpable } = await pagina.evaluate(() => {
    const vista = document.documentElement.clientWidth
    let culpable = ''
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.right > vista + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') { culpable = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`; break }
    }
    return { ancho: document.documentElement.scrollWidth, vista, culpable }
  })
  ok(ancho <= vista, `${nombre}: sin desborde horizontal a ${vista}px`, `scrollWidth ${ancho} · ${culpable}`)
}

const errores = []
const navegador = await chromium.launch({ executablePath: rutaChromium() })

// ═══ 1. Páginas públicas ═══
console.log('\n▸ Páginas públicas')
{
  const ctx = await prepararContexto(navegador, { sesion: false })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errores.push(`landing: ${e.message}`))
  await p.goto(`${BASE}/`)
  await p.getByRole('heading', { level: 1 }).waitFor()
  ok(await p.locator('html[lang="es-CO"]').count() === 1, 'el documento declara lang="es-CO"')
  // decode() espera la descarga: falla si la CSP o la ruta del asset bloquean la foto
  const fachadaCarga = (pagina) => pagina.locator('img[srcset*="fachada-hila"]').first().evaluate((img) => img.decode().then(() => img.naturalWidth > 0, () => false))
  ok(await fachadaCarga(p), 'landing: la foto de la fachada carga de fondo')
  ok(await p.locator('header img[src*="logo-hila"]').first().evaluate((img) => img.decode().then(() => img.naturalWidth > 0, () => false)), 'la marca muestra el logo del hospital')
  const favicon = await p.evaluate(async () => {
    const href = document.querySelector('link[rel="icon"]')?.getAttribute('href')
    const r = href ? await fetch(href) : null
    return { href, ok: r?.ok, tipo: r?.headers.get('content-type') }
  })
  ok(favicon.ok && /image\/png/.test(favicon.tipo), `el favicon es el logo y existe (${favicon.href})`)
  await p.screenshot({ path: `${CAPTURAS}01-landing.png`, fullPage: true })

  await p.goto(`${BASE}/registro`)
  ok(await fachadaCarga(p), 'registro: la foto de la fachada carga de fondo')
  await p.getByLabel('Correo electrónico').fill('ana@hila.test')
  await p.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('corta123')
  await p.getByLabel('Confirma la contraseña').fill('corta123')
  await p.getByRole('button', { name: 'Continuar' }).click()
  ok(await p.getByText('La contraseña debe tener al menos 10 caracteres').isVisible(), 'registro paso 1: exige la política de contraseñas')
  await p.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('Clave-Segura-2026')
  await p.getByLabel('Confirma la contraseña').fill('Otra-Clave-2026')
  await p.getByRole('button', { name: 'Continuar' }).click()
  ok(await p.getByText('Las contraseñas no coinciden').isVisible(), 'registro paso 1: detecta contraseñas distintas')
  await p.getByLabel('Confirma la contraseña').fill('Clave-Segura-2026')
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.getByLabel('Nombre completo').waitFor()
  ok(true, 'registro paso 1 → paso 2')
  await p.getByLabel('Nombre completo').fill('Ana María Rodríguez')
  await p.getByLabel('Número de cédula').fill('12.34')
  await p.getByLabel('Número de celular').fill('+57 300 123 4567')
  await p.getByRole('textbox', { name: 'Cargo', exact: true }).fill('Auditora interna')
  await p.getByRole('button', { name: 'Continuar' }).click()
  ok(await p.getByText('La cédula debe tener entre 6 y 12 dígitos').isVisible(), 'registro paso 2: rechaza una cédula corta con mensaje en español')
  await p.getByLabel('Número de cédula').fill('1.085.123.456')
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.getByLabel('Nombre del equipo auditor').waitFor()
  ok(true, 'registro paso 2: acepta cédula con puntos y celular con +57 (normalizados)')
  await p.getByText('Sistemas', { exact: true }).click()
  ok(await p.getByRole('combobox', { name: 'Sistema', exact: true }).isVisible() && !(await p.getByRole('combobox', { name: 'Proceso', exact: true }).isVisible()), 'alcance Sistemas: aparece el selector de sistema y no el de proceso')
  await p.getByRole('combobox', { name: 'Sistema', exact: true }).selectOption('Sistema de calidad')
  await p.getByText('Procesos', { exact: true }).click()
  ok(await p.getByRole('combobox', { name: 'Proceso', exact: true }).isVisible() && (await p.getByRole('combobox', { name: 'Sistema', exact: true }).count()) === 0, 'alcance Procesos: el selector de sistema se oculta')
  ok((await p.getByRole('combobox', { name: 'Proceso', exact: true }).locator('option').count()) === 20, 'el selector de procesos ofrece los 19 procesos (+ opción vacía)')
  await p.getByRole('button', { name: 'Crear cuenta' }).click()
  ok(await p.getByText('Escribe el nombre de la persona del equipo auditor').isVisible() && await p.getByText('Elige el proceso que auditas').isVisible(), 'paso 3: exige equipo auditor y proceso')
ok(await p.getByText('Debes autorizar el tratamiento de tus datos personales').isVisible(), 'paso 3: exige la autorización de tratamiento de datos (Ley 1581)')
  await p.screenshot({ path: `${CAPTURAS}02-registro-paso3.png`, fullPage: true })

  // Registro completo → «Revisa tu correo» con reenvío (Supabase Auth simulado)
  const authPeticiones = []
  let registroDesactivado = true
  await ctx.route('https://demo.supabase.co/auth/v1/**', async (r) => {
    const ruta = new URL(r.request().url()).pathname.replace('/auth/v1/', '')
    authPeticiones.push({ ruta, cuerpo: r.request().postData() ? JSON.parse(r.request().postData()) : null })
    if (ruta === 'signup' && registroDesactivado) {
      // Respuesta real de Supabase cuando el proveedor de correo está apagado
      return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 400, error_code: 'email_provider_disabled', msg: 'Email signups are disabled' }) })
    }
    if (ruta === 'signup') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: crypto.randomUUID(), email: 'nueva@hila.test', identities: [{ id: 'i1' }], user_metadata: {} }) })
    }
    if (ruta === 'token') {
      return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' }) })
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await p.getByLabel('Nombre del equipo auditor').fill('Laura Gómez')
  await p.getByLabel('Cargo del equipo auditor').fill('Profesional de calidad')
  await p.getByRole('combobox', { name: 'Proceso', exact: true }).selectOption('Urgencias')
  await p.getByLabel(/Autorizo el tratamiento/).check()
  await p.getByRole('button', { name: 'Crear cuenta' }).click()
  await p.getByText('El registro de cuentas está desactivado en este momento').waitFor()
  ok(true, 'con el registro desactivado en Supabase, el mensaje lo explica (no un error genérico)')
  registroDesactivado = false
  await p.getByRole('button', { name: 'Crear cuenta' }).click()
  await p.getByRole('heading', { name: 'Revisa tu correo' }).waitFor()
  const signup = authPeticiones.find((x) => x.ruta === 'signup')
  ok(signup?.cuerpo?.data?.acepto_tratamiento_datos === 'true' && signup?.cuerpo?.data?.cedula === '1085123456', 'el registro envía la autorización de datos y la cédula normalizada')
  await p.getByRole('button', { name: 'Reenviar correo de confirmación' }).click()
  await p.getByText(/enviamos un nuevo correo/).waitFor()
  ok(authPeticiones.some((x) => x.ruta === 'resend' && x.cuerpo?.type === 'signup'), 'el botón reenvía el correo de confirmación')
  ok(await p.getByRole('button', { name: /Reenviar correo \(\d+ s\)/ }).isDisabled(), 'después de reenviar hay una espera antes de poder repetir')

  // Ingreso: mostrar contraseña y cuenta sin confirmar
  await p.goto(`${BASE}/ingresar`)
  const clave = p.getByRole('textbox', { name: 'Contraseña', exact: true })
  await clave.fill('Clave-Segura-2026')
  ok((await clave.getAttribute('type')) === 'password', 'la contraseña empieza oculta')
  await p.getByRole('button', { name: 'Mostrar contraseña' }).click()
  ok((await clave.getAttribute('type')) === 'text' && (await p.getByRole('button', { name: 'Ocultar contraseña' }).getAttribute('aria-pressed')) === 'true', 'el botón «Mostrar contraseña» la muestra')
  await p.getByRole('button', { name: 'Ocultar contraseña' }).click()
  ok((await clave.getAttribute('type')) === 'password', 'y la vuelve a ocultar')
  await p.getByLabel('Correo electrónico').fill('nueva@hila.test')
  await p.getByRole('button', { name: 'Ingresar' }).click()
  await p.getByText('Debes confirmar tu correo antes de ingresar').waitFor()
  ok(await p.getByRole('button', { name: 'Reenviar correo de confirmación' }).isVisible(), 'si la cuenta no está confirmada, se ofrece reenviar el correo')
  await p.screenshot({ path: `${CAPTURAS}02b-ingreso-sin-confirmar.png`, fullPage: true })

  await p.goto(`${BASE}/registro`)
  await p.getByRole('textbox', { name: 'Contraseña', exact: true }).waitFor()
  ok((await p.getByRole('button', { name: 'Mostrar contraseña' }).count()) === 2, 'el registro tiene «Mostrar contraseña» en ambos campos')
  await ctx.close()
}

// ═══ 2. Aplicación autenticada (escritorio) ═══
console.log('\n▸ Aplicación (escritorio)')
const ctx = await prepararContexto(navegador, { sesion: true })
const p = await ctx.newPage()
p.on('pageerror', (e) => errores.push(`app: ${e.message}`))
p.on('console', (m) => (m.type() === 'error' || /Content Security Policy/i.test(m.text())) && !/Failed to load resource/.test(m.text()) && errores.push(`consola: ${m.text()}`))

await p.goto(`${BASE}/app`)
await p.getByRole('heading', { name: /Hola, Ana/ }).waitFor()
ok(true, 'el panel saluda con el nombre del auditor')
ok(await p.getByText('Proceso: Urgencias').isVisible(), 'muestra el proceso del perfil')
await p.locator('.recharts-bar-rectangle').first().waitFor()
ok((await p.locator('.recharts-bar-rectangle').count()) >= 3, 'gráfica de distribución por clasificación dibujada')
await p.waitForTimeout(2000) // fin de la animación de las barras
const etiquetas = await p.locator('.recharts-wrapper').first().evaluate((el) => [...el.querySelectorAll('text')].filter((t) => t.querySelectorAll('tspan').length === 2).map((t) => t.querySelectorAll('tspan')[1].textContent))
ok(etiquetas.join(',') === '0,1,1,1', 'cada columna muestra su valor', etiquetas.join(','))
await p.locator('.recharts-wrapper').first().screenshot({ path: `${CAPTURAS}03b-grafica.png` })
await p.screenshot({ path: `${CAPTURAS}03-panel.png`, fullPage: true })

await p.goto(`${BASE}/app/auditorias/${A1}`)
await p.getByRole('heading', { name: 'Auditoría interna al proceso de Urgencias' }).waitFor()
ok((await p.locator('article[aria-label^="Hallazgo"]').count()) === 3, 'el detalle lista los 3 hallazgos previos')
await p.screenshot({ path: `${CAPTURAS}04-detalle.png`, fullPage: true })

// Asistente de 7 pasos
await p.getByRole('link', { name: 'Nuevo hallazgo' }).first().click()
await p.getByLabel('Describe lo que observaste durante la auditoría').waitFor()
const opcionesClasif = await p.locator('select option, input[type=radio]').evaluateAll((els) => els.map((e) => e.textContent || e.value))
ok(!opcionesClasif.some((t) => /no conformidad|observaci|fortaleza|oportunidad/i.test(t)), 'NO hay ningún control para elegir la clasificación antes del análisis')
const navPasos = p.getByRole('navigation', { name: 'Pasos del registro del hallazgo' })
ok((await navPasos.getByRole('button').count()) === 7 && await p.getByRole('button', { name: 'Paso 2: Requisito' }).isDisabled(), 'el asistente muestra los 7 pasos; los siguientes se habilitan tras el análisis')
await p.getByRole('button', { name: 'Analizar con IA' }).click()
ok(await p.getByText(/al menos 25 caracteres/).isVisible(), 'exige al menos 25 caracteres')

// PDF de evidencia: se lee en el navegador; un PDF sin texto (escaneado) pide describirlo
await p.locator('input[type="file"]').setInputFiles(PDF_ESCANEADO)
await p.getByText(/El PDF parece escaneado/).waitFor()
ok(await p.getByText('escaneado.pdf').isVisible(), 'un PDF escaneado queda adjunto y se pide describir su contenido')
await p.getByRole('button', { name: 'Quitar el PDF escaneado.pdf' }).click()
await p.locator('input[type="file"]').setInputFiles(PDF_TEXTO)
await p.getByText(/Se importó el texto/).waitFor()
const importado = await p.getByLabel('Describe lo que observaste durante la auditoría').inputValue()
ok(importado.replace(/\s+/g, ' ').includes('extintor vencido en el área de urgencias'), 'el texto del PDF se extrae en el navegador y llena la evidencia', importado.slice(0, 120))
const antesAnalisis = peticiones.length
await p.getByRole('button', { name: 'Analizar con IA' }).click()
await p.getByText('Buscando criterios aplicables…').waitFor()
ok(true, 'muestra los pasos del análisis mientras espera')
await p.screenshot({ path: `${CAPTURAS}05-analizando.png` })

// Paso 2 · requisito
await p.getByRole('heading', { name: '2. Requisito' }).waitFor({ timeout: 10000 })
const llamada = peticiones.slice(antesAnalisis).find((x) => x.metodo === 'FUNC' && x.tabla === 'clasificar-hallazgo')
const huella = llamada?.cuerpo?.evidencia_archivo
ok(/^[0-9a-f]{64}$/.test(huella?.sha256 ?? '') && huella.nombre === 'evidencia.pdf' && huella.paginas === 1, 'del PDF solo viaja su huella (nombre, páginas y SHA-256)', JSON.stringify(huella))
ok(!peticiones.slice(antesAnalisis).some((x) => JSON.stringify(x.cuerpo ?? '').includes('%PDF')), 'el archivo PDF nunca se envía al servidor')
ok(await p.getByText(/Se detectaron 2 situaciones distintas/).isVisible(), 'caso 7: dos situaciones distintas, con el aviso')
await p.getByText(/Texto del numeral 8\.5\.1/).first().waitFor()
ok(await p.getByText('Norma', { exact: true }).first().isVisible() && await p.getByText('Numeral', { exact: true }).first().isVisible(), 'paso 2: la norma, el numeral y el texto del requisito')
await p.screenshot({ path: `${CAPTURAS}06-paso-requisito.png`, fullPage: true })

// Paso 3 · clasificación (una situación a la vez)
await p.getByRole('button', { name: 'Siguiente: clasificación' }).click()
await p.getByRole('heading', { name: '3. Clasificación' }).waitFor()
ok(await p.getByText('No conformidad', { exact: true }).first().isVisible(), 'paso 3: la clasificación de la IA, con texto')
await p.getByRole('button', { name: 'Situación 2 · Fortaleza' }).click()
ok(await p.getByText('Fortaleza', { exact: true }).first().isVisible(), 'cada situación se revisa por separado')
await p.getByRole('button', { name: 'Situación 1 · No conformidad' }).click()

// Paso 4 · redacción
await p.getByRole('button', { name: 'Siguiente: redacción' }).click()
await p.getByRole('heading', { name: '4. Redacción' }).waitFor()
const nuevoTexto = 'Durante la inspección al área de Urgencias se evidenció un extintor con fecha de recarga vencida, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 8.5.1, literal d), sobre la infraestructura adecuada.'
await p.getByRole('button', { name: /^Hallazgo corregido: Durante la/ }).click()
await p.getByRole('textbox', { name: 'Hallazgo corregido' }).fill(nuevoTexto)
await p.getByRole('button', { name: 'Aplicar' }).click()
ok(await p.getByText(nuevoTexto).isVisible(), 'edición en el sitio del hallazgo corregido')
await p.getByText('Ver texto original del auditor').click()
ok((await p.locator('details[open] p').first().innerText()).replace(/\s+/g, ' ').includes('extintor vencido'), 'el texto original del auditor sigue disponible')

// Paso 5 · riesgo
await p.getByRole('button', { name: 'Siguiente: riesgo' }).click()
await p.getByRole('heading', { name: '5. Riesgo' }).waitFor()
ok(await p.getByText('Alto (12)').first().isVisible(), 'paso 5: la IA propone P3 × I4 y la aplicación calcula el nivel (Alto, 12)')
ok(await p.getByText('Mapa de calor 5 × 5').isVisible() && (await p.locator('figure table td').count()) === 25 + 1, 'mapa de calor 5 × 5 con su escala')
const escalaFija = async () => (await p.getByText(/Escala de niveles/).count()) === 0 && (await p.locator('input[type="number"]').count()) === 0
  && /Bajo 1–4 .*Moderado 5–9 .*Alto 10–16 .*Extremo 17–25/.test((await p.getByRole('list', { name: 'Niveles de riesgo' }).innerText()).replace(/\s+/g, ' '))
ok(await escalaFija(), 'la escala de niveles es fija (Bajo 1–4, Moderado 5–9, Alto 10–16, Extremo 17–25) y no se puede editar')
await p.getByRole('button', { name: /^Probabilidad 4 \(Probable\) × impacto 4/ }).click()
await p.getByText('Alto (16)').first().waitFor()
const grupoP = p.getByRole('group', { name: /^Probabilidad \(1 a 5/ })
ok((await grupoP.getByRole('button', { name: /^4/ }).getAttribute('aria-pressed')) === 'true', 'elegir una casilla del mapa ajusta la probabilidad y el impacto')
await p.screenshot({ path: `${CAPTURAS}06b-paso-riesgo.png`, fullPage: true })

// Paso 6 · controles
await p.getByRole('button', { name: 'Siguiente: controles' }).click()
await p.getByRole('heading', { name: '6. Controles' }).waitFor()
const casillas = p.getByRole('checkbox')
ok((await casillas.count()) === 2 && !(await casillas.first().isChecked()), 'paso 6: dos controles propuestos por la IA, sin adoptar')
await casillas.first().check()
await p.getByLabel('Control o acción definida por el auditor').fill('Verificar mensualmente la fecha de recarga de todos los extintores del servicio de Urgencias.')
await p.getByRole('button', { name: 'Agregar control' }).click()
ok(await p.getByLabel('Control del auditor 1').isVisible(), 'el auditor adopta un control de la IA y agrega uno propio')

// Paso 7 · enviar a la matriz
await p.getByRole('button', { name: 'Siguiente: matriz' }).click()
await p.getByRole('heading', { name: '7. Enviar a la matriz consolidada' }).waitFor()
ok((await p.getByText('Completo: listo para validar en la matriz.').count()) === 2, 'paso 7: las dos situaciones están completas')
await p.screenshot({ path: `${CAPTURAS}06c-paso-enviar.png`, fullPage: true })
await p.getByRole('button', { name: 'Enviar a la matriz consolidada' }).click()
await p.waitForURL(`${BASE}/app/auditorias/${A1}/matriz`)
const parches = peticiones.slice(antesAnalisis).filter((x) => x.metodo === 'PATCH' && x.tabla === 'hallazgos')
ok(parches.some((x) => x.cuerpo.hallazgo_corregido === nuevoTexto) && parches.filter((x) => 'hallazgo_corregido' in x.cuerpo).length === 1, 'solo se envía el campo realmente editado')
ok(parches.some((x) => x.cuerpo.riesgo_probabilidad === 4 && !('riesgo_impacto' in x.cuerpo)), 'se guarda el riesgo ajustado (solo la probabilidad: el impacto 4 ya lo había propuesto la IA)')
ok(parches.some((x) => x.cuerpo.controles?.some((c) => c.origen === 'ia' && c.adoptado) && x.cuerpo.controles?.some((c) => c.origen === 'auditor')), 'se guardan el control adoptado y el propio')
ok(!parches.some((x) => 'entrada_auditor' in x.cuerpo) && !parches.some((x) => x.cuerpo.estado === 'confirmado'), 'nunca se envía la entrada original, y enviar a la matriz no valida: los hallazgos quedan pendientes')

// Matriz consolidada: solo se descarga con todo validado
await p.getByRole('heading', { name: 'Matriz consolidada' }).waitFor()
const filasMatriz = p.locator('table').filter({ has: p.locator('caption', { hasText: 'Matriz consolidada de hallazgos' }) }).locator('tbody tr')
await filasMatriz.nth(4).waitFor()
ok((await filasMatriz.count()) === 5, 'la matriz lista los 5 hallazgos vigentes')
ok(await escalaFija(), 'en la matriz tampoco se puede editar la escala de niveles')
ok((await p.locator('thead th').allTextContents()).join('|') === 'ID|Clasificación|Norma y numeral|Evidencia|Riesgo|Hallazgo|Evaluación|Controles|Estado', 'columnas: ID, clasificación, norma y numeral, evidencia, riesgo, hallazgo, evaluación, controles y estado')
await p.getByRole('button', { name: 'Descargar matriz (Excel)' }).click()
const aviso1 = p.getByRole('dialog', { name: 'La matriz aún no se ha validado' })
await aviso1.waitFor()
ok(await aviso1.getByText(/Pendientes de validar: H-04, H-05/).isVisible(), 'con hallazgos pendientes, un aviso dice que aún no se ha validado y cuáles faltan')
await aviso1.getByRole('button', { name: 'Entendido' }).click()
await p.screenshot({ path: `${CAPTURAS}06d-matriz.png`, fullPage: true })
await p.getByRole('combobox', { name: 'Estado de H-05' }).selectOption('confirmado')
await p.getByText('H-05 validado').waitFor()
await p.getByRole('combobox', { name: 'Estado de H-04' }).selectOption('cambios_sugeridos')
const notaCambios = p.getByRole('dialog', { name: 'Se sugiere hacer cambios · H-04' })
await notaCambios.getByLabel(/Qué cambios se sugieren/).fill('Precisar la fecha de vencimiento del extintor.')
await notaCambios.getByRole('button', { name: 'Guardar' }).click()
await p.getByText('H-04: se sugieren cambios').waitFor()
await p.getByRole('button', { name: 'Descargar matriz (Excel)' }).click()
const aviso2 = p.getByRole('dialog', { name: 'Hay hallazgos con cambios sugeridos' })
await aviso2.waitFor()
ok(await aviso2.getByText(/Precisar la fecha de vencimiento/).isVisible(), 'con «Se sugiere hacer cambios» tampoco se descarga (y se ve la nota)')
await aviso2.getByRole('button', { name: 'Entendido' }).click()
await p.getByRole('combobox', { name: 'Estado de H-04' }).selectOption('confirmado')
await p.getByText('H-04 validado').waitFor()
const [descargaMatriz] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: 'Descargar matriz (Excel)' }).click()])
const rutaMatriz = `${CAPTURAS}${descargaMatriz.suggestedFilename()}`
await descargaMatriz.saveAs(rutaMatriz)
ok(/^Matriz_AI-2026-001_\d{8}\.xlsx$/.test(descargaMatriz.suggestedFilename()), `con todo validado se descarga el Excel: ${descargaMatriz.suggestedFilename()}`)
const xlsx = execSync(`unzip -p "${rutaMatriz}"`).toString()
ok(['Matriz consolidada de hallazgos · AI-2026-001', 'Norma y numeral', 'H-04', 'NTC-ISO 9001:2015, numeral 8.5.1', '= 16 · Alto', 'Validado'].every((t) => xlsx.includes(t)),
  'el Excel tiene el título, las columnas, los hallazgos, la evaluación del riesgo y el estado')

await p.goto(`${BASE}/app/auditorias/${A1}`)
await p.locator('article[aria-label^="Hallazgo"]').nth(4).waitFor()
ok((await p.locator('article[aria-label^="Hallazgo"]').count()) === 5, 'el detalle muestra ahora 5 hallazgos')
ok(await p.getByText('editado por el auditor').first().isVisible(), 'el hallazgo editado queda marcado')

// Filtro por clasificación desde los contadores
await p.getByRole('button', { name: /^1\s*No conformidad/ }).click()
ok((await p.locator('article[aria-label^="Hallazgo"]').count()) === 1, 'el contador de no conformidades filtra la lista')
await p.getByRole('button', { name: /^1\s*No conformidad/ }).click()

// Informe
await p.getByRole('link', { name: 'Generar informe' }).click()
await p.getByRole('button', { name: 'Generar informe' }).click()
await p.getByRole('heading', { name: 'Informe de auditoría interna' }).waitFor()
const secciones = await p.locator('article h2[id^="seccion-"]').allTextContents()
ok(secciones.length === 11 && secciones[0].startsWith('1. ') && secciones[10].startsWith('11. '), 'el informe tiene las 11 secciones', secciones.join(' | '))
const grupos = await p.locator('article h3').allTextContents()
ok(/No conformidades/.test(grupos[0]) && /Observaciones/.test(grupos[1]) && /Oportunidades/.test(grupos[2]) && /Fortalezas/.test(grupos[3]), 'hallazgos en orden NC → OBS → OM → FORT', grupos.join(' | '))
await p.screenshot({ path: `${CAPTURAS}07-informe.png`, fullPage: true })

const [descargaPdf] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: 'PDF' }).click()])
const rutaPdf = `${CAPTURAS}${descargaPdf.suggestedFilename()}`
await descargaPdf.saveAs(rutaPdf)
ok(/^Informe_AI-2026-001_\d{8}\.pdf$/.test(descargaPdf.suggestedFilename()), `nombre del PDF: ${descargaPdf.suggestedFilename()}`)
const textoPdf = execSync(`pdftotext -layout "${rutaPdf}" -`).toString()
const paginasPdf = Number(execSync(`pdfinfo "${rutaPdf}"`).toString().match(/Pages:\s+(\d+)/)[1])
ok(/Auditoría/.test(textoPdf) && /Observación|Observaciones/.test(textoPdf) && /Ñáñez/.test(textoPdf) && /Rodríguez Peña/.test(textoPdf), 'el PDF conserva tildes y «ñ» (Ñáñez, Rodríguez, Auditoría)')
ok(new RegExp(`Página 1 de ${paginasPdf}`).test(textoPdf) && /Generado el/.test(textoPdf), `pie con número de página y fecha (${paginasPdf} páginas)`)
ok(/AI-2026-001 · Informe de auditoría interna/.test(textoPdf), 'encabezado con el código de la auditoría')
ok(/(Letter|612 x 792)/.test(execSync(`pdfinfo "${rutaPdf}"`).toString()), 'tamaño carta')
const fuentesPdf = execSync(`pdffonts "${rutaPdf}"`).toString()
ok(/SourceSerif4/.test(fuentesPdf) && /Inter/.test(fuentesPdf) && !/Helvetica/.test(fuentesPdf), 'fuentes Unicode incrustadas (Source Serif 4 e Inter, sin Helvetica)')
// pdfimages lista una fila por aparición; las de tipo «image» deben ser una por página más la portada
const imagenesPdf = execSync(`pdfimages -list "${rutaPdf}"`).toString().split('\n').filter((l) => /^\s*\d+\s+\d+\s+image\b/.test(l))
ok(imagenesPdf.length === paginasPdf + 1 && /\bsmask\b/.test(execSync(`pdfimages -list "${rutaPdf}"`).toString()), `el PDF lleva el logo en la portada y en el encabezado de las ${paginasPdf} páginas`, `${imagenesPdf.length} apariciones`)

const [descargaDocx] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: 'Word' }).click()])
const rutaDocx = `${CAPTURAS}${descargaDocx.suggestedFilename()}`
await descargaDocx.saveAs(rutaDocx)
ok(/^Informe_AI-2026-001_\d{8}\.docx$/.test(descargaDocx.suggestedFilename()), `nombre del Word: ${descargaDocx.suggestedFilename()}`)
const xml = execSync(`unzip -p "${rutaDocx}" word/document.xml`).toString()
ok(/Observaciones/.test(xml) && /Ñáñez/.test(xml) && /Heading1|Ttulo1|Título 1/.test(xml), 'el Word tiene tildes y encabezados nativos (Heading 1)')
ok(/instrText[^>]*>TOC [^<]*\\o/.test(xml), 'el Word incluye la tabla de contenido automática')
ok(/w:shd [^>]*w:fill="FEF2F2"/.test(xml), 'filas coloreadas según la clasificación')
const archivosDocx = execSync(`unzip -l "${rutaDocx}"`).toString()
ok(/word\/media\/[^\s]+\.png/.test(archivosDocx) && /<w:drawing>/.test(xml) && /<w:drawing>/.test(execSync(`unzip -p "${rutaDocx}" 'word/header*.xml'`).toString()), 'el Word lleva el logo en la portada y en el encabezado')

// Ruta profunda tras recargar
await p.goto(`${BASE}/app/auditorias/${A1}/informe`)
await p.getByRole('heading', { name: 'Informe de auditoría' }).first().waitFor()
ok(true, 'una ruta profunda carga al recargar el navegador')

// Normas
await p.goto(`${BASE}/app/normas`)
await p.getByLabel('Buscar en las normas').fill('información documentada')
await p.getByRole('button', { name: 'Buscar' }).click()
await p.locator('mark').first().waitFor()
ok((await p.locator('mark').count()) >= 1, 'el explorador resalta los términos encontrados')
await p.screenshot({ path: `${CAPTURAS}08-normas.png`, fullPage: true })

// Nueva auditoría con sugerencia de IA
await p.goto(`${BASE}/app/auditorias/nueva`)
await p.getByLabel('Código').waitFor()
await p.waitForFunction(() => document.querySelector('input[name="codigo"]')?.value === 'AI-2026-002')
ok(true, 'propone el código AI-2026-002 sin gastar cuota de IA')
await p.getByRole('combobox', { name: 'Proceso', exact: true }).selectOption('Cirugía')
await p.getByRole('button', { name: 'Sugerir con IA' }).click()
await p.getByText('Propuesta de la IA').waitFor()
ok((await p.getByLabel('Objetivo de la auditoría').inputValue()).includes('Cirugía'), 'la IA rellena el objetivo')
await p.screenshot({ path: `${CAPTURAS}09-nueva-auditoria.png`, fullPage: true })
await ctx.close()

// ═══ 2b. Controles de acceso ═══
console.log('\n▸ Controles de acceso')
{
  perfil.aprobado = false
  const ctxP = await prepararContexto(navegador, { sesion: true })
  const pp = await ctxP.newPage()
  pp.on('console', (m) => /Content Security Policy/i.test(m.text()) && errores.push(`csp: ${m.text()}`))
  await pp.goto(`${BASE}/app/auditorias/${A1}`)
  await pp.getByRole('heading', { name: 'Tu cuenta está pendiente de aprobación' }).waitFor()
  ok((await pp.getByRole('heading', { name: 'Auditoría interna al proceso de Urgencias' }).count()) === 0, 'una cuenta sin aprobar ve el aviso de pendiente y ningún dato')
  await ctxP.close()
  perfil.aprobado = true

  perfil.rol = 'admin'
  db.profiles.push({ ...perfil, id: '33333333-3333-4333-8333-333333333333', nombre_completo: 'Pedro Pendiente', cedula: '52111222', rol: 'auditor', aprobado: false, aprobado_en: null })
  const ctxA = await prepararContexto(navegador, { sesion: true })
  const pa = await ctxA.newPage()
  await pa.route('https://demo.supabase.co/rest/v1/rpc/aprobar_auditor', async (r) => {
    const { p_id, p_aprobado } = JSON.parse(r.request().postData())
    const x = db.profiles.find((y) => y.id === p_id)
    x.aprobado = p_aprobado
    peticiones.push({ metodo: 'RPC', tabla: 'aprobar_auditor', cuerpo: { p_id, p_aprobado } })
    await r.fulfill({ status: 204, body: '' })
  })
  await pa.goto(`${BASE}/app`)
  await pa.getByRole('heading', { name: /Hola, Ana/ }).waitFor()
  ok(await pa.getByRole('link', { name: 'Auditores' }).first().isVisible(), 'un admin ve el enlace «Auditores»')
  await pa.goto(`${BASE}/app/admin/auditores`)
  await pa.getByText('1 cuenta pendiente').waitFor()
  await pa.getByRole('button', { name: 'Aprobar' }).click()
  await pa.getByText('Cuenta de Pedro Pendiente aprobada').waitFor()
  ok(peticiones.some((x) => x.tabla === 'aprobar_auditor' && x.cuerpo.p_aprobado === true), 'el admin aprueba cuentas con la función de la base de datos')
  await pa.screenshot({ path: `${CAPTURAS}11-admin-auditores.png`, fullPage: true })
  await ctxA.close()
  perfil.rol = 'auditor'
  db.profiles.splice(1)

  const ctxN = await prepararContexto(navegador, { sesion: true })
  const pn = await ctxN.newPage()
  await pn.goto(`${BASE}/app`)
  await pn.getByRole('heading', { name: /Hola, Ana/ }).waitFor()
  ok((await pn.getByRole('link', { name: 'Auditores' }).count()) === 0, 'un auditor no ve el enlace de administración')
  const meta = await pn.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  ok(/script-src 'self'(;|$)/.test(meta) && /connect-src 'self' https:\/\/demo\.supabase\.co/.test(meta) && /object-src 'none'/.test(meta), 'la CSP solo permite scripts propios y conexiones al proyecto Supabase')
  await pn.setContent(`<iframe src="${BASE}/" style="width:800px;height:400px"></iframe>`)
  const marco = pn.frameLocator('iframe')
  await marco.getByText('no se puede mostrar dentro de otro sitio').waitFor()
  ok(true, 'dentro de un iframe la app se niega a mostrarse (clickjacking)')
  await ctxN.close()
}

// ═══ 3. Móvil a 360 px ═══
console.log('\n▸ Móvil (360 px)')
{
  const ctxM = await prepararContexto(navegador, { sesion: true, ancho: 360, alto: 780 })
  const m = await ctxM.newPage()
  m.on('pageerror', (e) => errores.push(`móvil: ${e.message}`))
  for (const [ruta, nombre, esperar] of [
    ['/app', 'panel', /Hola, Ana/],
    [`/app/auditorias/${A1}`, 'detalle de auditoría', 'Auditoría interna al proceso de Urgencias'],
    [`/app/auditorias/${A1}/hallazgos/nuevo`, 'nuevo hallazgo', 'Nuevo hallazgo'],
    [`/app/auditorias/${A1}/informe`, 'informe', 'Informe de auditoría'],
    ['/app/normas', 'normas', 'Normas'],
    ['/app/perfil', 'perfil', 'Mi perfil'],
    ['/app/auditorias/nueva', 'nueva auditoría', 'Nueva auditoría'],
    [`/app/auditorias/${A1}/matriz`, 'matriz consolidada', 'Matriz consolidada'],
  ]) {
    await m.goto(`${BASE}${ruta}`)
    await m.getByRole('heading', { name: esperar }).first().waitFor()
    await m.waitForTimeout(400)
    await sinDesborde(m, nombre)
  }
  await m.goto(`${BASE}/app/auditorias/${A1}/hallazgos/nuevo`)
  await m.getByLabel('Describe lo que observaste durante la auditoría').fill(motor.resultados.find((r) => r.caso.n === 7).caso.entrada)
  await m.getByRole('button', { name: 'Analizar con IA' }).click()
  await m.getByText(/situaciones distintas/).waitFor({ timeout: 10000 })
  await sinDesborde(m, 'resultado del análisis')
  await m.getByRole('button', { name: 'Paso 5: Riesgo' }).click()
  await m.getByRole('heading', { name: '5. Riesgo' }).waitFor()
  await sinDesborde(m, 'paso de riesgo con el mapa de calor')
  await m.screenshot({ path: `${CAPTURAS}10-movil-resultado.png`, fullPage: true })
  await m.getByRole('button', { name: 'Abrir menú' }).click()
  ok(await m.getByRole('dialog', { name: 'Menú' }).isVisible(), 'el menú móvil se abre')
  await m.getByRole('dialog', { name: 'Menú' }).getByRole('link', { name: 'Normas' }).click()
  await m.getByRole('heading', { name: 'Normas' }).waitFor()
  ok((await m.getByRole('dialog', { name: 'Menú' }).count()) === 0, 'el menú móvil se cierra al navegar')
  const ctxL = await prepararContexto(navegador, { sesion: false, ancho: 360, alto: 780 })
  const l = await ctxL.newPage()
  await l.goto(`${BASE}/`)
  await l.getByRole('heading', { level: 1 }).waitFor()
  await sinDesborde(l, 'landing')
  await l.goto(`${BASE}/registro`)
  await l.getByLabel('Correo electrónico').waitFor()
  await sinDesborde(l, 'registro')
  await ctxM.close()
  await ctxL.close()
}

await navegador.close()
await new Promise((r) => servidor.httpServer.close(r))
console.log('\n▸ Errores de JavaScript en el navegador')
ok(errores.length === 0, 'ninguno', errores.join('\n      → '))
writeFileSync(`${CAPTURAS}peticiones.json`, JSON.stringify(peticiones, null, 1))
console.log(fallos ? `\n✗ ${fallos} comprobación(es) fallaron\n` : '\n✓ Interfaz verificada de extremo a extremo\n')
process.exit(fallos ? 1 : 0)
