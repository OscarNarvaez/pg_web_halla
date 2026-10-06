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
const { resultadosAuditoria } = await import(`${REPO}/src/lib/resultados.js`)
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
  id: USUARIO, nombre_completo: 'Ana María Rodríguez Peña', cedula: '1085123456', celular: '3001234567', cargos: ['Auditor médico', 'Coordinadora'],
  equipo_auditor: [{ nombre: 'Laura Gómez Ñáñez', cargos: ['Enfermera'] }, { nombre: 'Pedro Pérez Ortiz', cargos: ['Médico', 'Tesorera'] }],
  tipo_evaluador: 'AUDITORES_INTERNOS', alcance: 'PROCESOS', proceso: 'Urgencias', sistema: null,
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
  listas_verificacion: [],
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
  evidencia_archivo: null, evidencia_anexos: [], nota_validacion: null,
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
    // upsert de PostgREST (on_conflict + resolution=merge-duplicates): actualiza la fila si ya existe
    const conflicto = url.searchParams.get('on_conflict')
    if (conflicto && (req.headers().prefer ?? '').includes('merge-duplicates')) {
      const fusionados = (Array.isArray(cuerpo) ? cuerpo : [cuerpo]).map((f) => {
        const existente = filas.find((x) => x[conflicto] === f[conflicto])
        if (existente) return Object.assign(existente, f, { actualizado_en: new Date().toISOString() })
        const nueva = { creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString(), ...f }
        filas.push(nueva)
        return nueva
      })
      return responder(fusionados, { status: 201 })
    }
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
      // el trigger de la 0012 fecha los PDF agregados al editar
      if (Array.isArray(cuerpo.evidencia_anexos)) f.evidencia_anexos = cuerpo.evidencia_anexos.map((a) => ({ ...a, agregado_en: a.agregado_en ?? new Date().toISOString() }))
      // el trigger de la BD marca editado_por_usuario
      const contenido = ['clasificacion', 'justificacion', 'hallazgo_corregido', 'criterio_requisito', 'evidencia', 'evidencia_anexos', 'severidad', 'riesgo_descripcion',
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
    const contenido = construirContenido({ auditoria: a, perfil, hallazgos: lista, estadisticas, narrativa, generadoEn: new Date().toISOString(), version, avisos: [] })
    const informe = { id: crypto.randomUUID(), auditoria_id: a.id, user_id: USUARIO, version, resumen_ejecutivo: narrativa.observaciones, conclusiones: narrativa.conclusiones, recomendaciones: null, estadisticas, contenido, modelo_ia: 'gemini-3.8-flash', prompt_version: '1.1.0', generado_en: new Date().toISOString() }
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

// Elige cargos con el selector (botón → buscador → casillas → Listo)
async function elegirCargos(pagina, nombreBoton, cargos) {
  await pagina.getByRole('button', { name: nombreBoton }).click()
  for (const cargo of cargos) {
    await pagina.getByRole('searchbox', { name: 'Buscar cargo' }).fill(cargo.slice(0, 7))
    await pagina.getByRole('checkbox', { name: cargo, exact: true }).check()
  }
  await pagina.getByRole('button', { name: 'Listo' }).click()
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
  ok((await p.getByRole('textbox', { name: /^Cargo/ }).count()) === 0, 'el cargo ya no se escribe a mano')
  await p.getByRole('button', { name: 'Continuar' }).click()
  ok(await p.getByText('La cédula debe tener entre 6 y 12 dígitos').isVisible(), 'registro paso 2: rechaza una cédula corta con mensaje en español')
  ok(await p.getByText('Elige al menos uno de tus cargos').isVisible(), 'registro paso 2: exige al menos un cargo')
  ok(await p.getByText('Elige si perteneces a los Auditores Internos o a los Auditores Externos').isVisible(), 'registro paso 2: exige elegir el grupo de auditores (evaluador)')
  await p.getByText('Auditores Internos', { exact: true }).click()
  await p.getByRole('button', { name: /^Cargos Elige uno o varios cargos/ }).click()
  ok((await p.getByRole('checkbox').count()) === 22, 'el selector ofrece los 22 cargos de líderes')
  await p.getByRole('searchbox', { name: 'Buscar cargo' }).fill('subgerente')
  ok((await p.getByRole('checkbox').count()) === 5, 'el buscador filtra los cargos sin importar mayúsculas')
  await p.getByRole('searchbox', { name: 'Buscar cargo' }).fill('medico')
  ok(await p.getByRole('checkbox', { name: 'Auditor médico', exact: true }).isVisible(), 'el buscador ignora las tildes («medico» → «Auditor médico»)')
  await p.getByRole('checkbox', { name: 'Auditor médico', exact: true }).check()
  await p.getByRole('searchbox', { name: 'Buscar cargo' }).fill('')
  for (const c of ['Coordinadora', 'Enfermera', 'Nutricionista', 'Líder equipo']) await p.getByRole('checkbox', { name: c, exact: true }).check()
  ok(await p.getByRole('checkbox', { name: 'Auditor externo', exact: true }).isDisabled() && await p.getByText('Máximo 5: quita uno para elegir otro.').isVisible(), 'como máximo 5 cargos por persona')
  await p.screenshot({ path: `${CAPTURAS}02a-registro-cargos.png`, fullPage: true })
  await p.keyboard.press('Escape')
  ok(await p.getByRole('button', { name: 'Cargos 5 elegidos' }).isVisible() && (await p.getByRole('list', { name: 'Cargos: elegidos' }).getByRole('listitem').count()) === 5, 'varios cargos elegidos, mostrados como etiquetas')
  for (const c of ['Enfermera', 'Nutricionista', 'Líder equipo']) await p.getByRole('button', { name: `Quitar ${c}` }).click()
  ok((await p.getByRole('list', { name: 'Cargos: elegidos' }).getByRole('listitem').allTextContents()).join('|') === 'Auditor médico|Coordinadora', 'cada cargo se puede quitar con su botón')
  await p.getByLabel('Número de cédula').fill('1.085.123.456')
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.getByLabel('Nombre de la persona 1').waitFor()
  ok(true, 'registro paso 2: acepta cédula con puntos y celular con +57 (normalizados)')
  await p.getByText('Sistemas', { exact: true }).click()
  ok(await p.getByRole('combobox', { name: 'Sistema', exact: true }).isVisible() && !(await p.getByRole('combobox', { name: 'Proceso', exact: true }).isVisible()), 'alcance Sistemas: aparece el selector de sistema y no el de proceso')
  await p.getByRole('combobox', { name: 'Sistema', exact: true }).selectOption('Sistema de calidad')
  await p.getByText('Procesos', { exact: true }).click()
  ok(await p.getByRole('combobox', { name: 'Proceso', exact: true }).isVisible() && (await p.getByRole('combobox', { name: 'Sistema', exact: true }).count()) === 0, 'alcance Procesos: el selector de sistema se oculta')
  ok((await p.getByRole('combobox', { name: 'Proceso', exact: true }).locator('option').count()) === 20, 'el selector de procesos ofrece los 19 procesos (+ opción vacía)')
  await p.getByRole('button', { name: 'Crear cuenta' }).click()
  ok(await p.getByText('Escribe el nombre de la persona del equipo auditor').isVisible() && await p.getByText('Elige al menos un cargo para esta persona').isVisible()
    && await p.getByText('Elige el proceso que auditas').isVisible(), 'paso 3: exige el nombre y el cargo de cada persona del equipo, y el proceso')
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
  await p.getByLabel('Nombre de la persona 1').fill('Laura Gómez')
  await elegirCargos(p, /^Cargos de la persona 1/, ['Enfermera'])
  await p.getByRole('button', { name: 'Agregar otra persona al equipo' }).click()
  await p.getByLabel('Nombre de la persona 2').fill('Pedro Pérez')
  await p.getByRole('button', { name: /^Cargos de la persona 2/ }).click()
  const listaEquipo = p.getByRole('group', { name: 'Cargos de la persona 2' })
ok((await listaEquipo.getByRole('checkbox').count()) === 25 && (await listaEquipo.getByRole('checkbox', { name: 'Asesora PAMEC', exact: true }).count()) === 0, 'el equipo auditor tiene su propia lista de 25 cargos')
  await p.keyboard.press('Escape')
  await elegirCargos(p, /^Cargos de la persona 2/, ['Médico', 'Tesorera'])
  await p.getByRole('button', { name: 'Agregar otra persona al equipo' }).click()
  ok(await p.getByLabel('Nombre de la persona 3').isVisible(), 'se pueden agregar más personas al equipo auditor')
  await p.screenshot({ path: `${CAPTURAS}02b-registro-equipo.png`, fullPage: true })
  await p.getByRole('button', { name: 'Quitar a la persona 3 del equipo auditor' }).click()
  ok((await p.getByLabel('Nombre de la persona 3').count()) === 0, 'y quitar las que sobran')
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
  ok(JSON.stringify(signup?.cuerpo?.data?.cargos) === '["Auditor médico","Coordinadora"]'
    && JSON.stringify(signup?.cuerpo?.data?.equipo_auditor) === JSON.stringify([{ nombre: 'Laura Gómez', cargos: ['Enfermera'] }, { nombre: 'Pedro Pérez', cargos: ['Médico', 'Tesorera'] }]),
    'el registro envía varios cargos y un equipo de varias personas', JSON.stringify(signup?.cuerpo?.data))
  ok(signup?.cuerpo?.data?.tipo_evaluador === 'AUDITORES_INTERNOS', 'el registro envía el grupo de auditores elegido (evaluador del informe)')
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
ok(await p.getByText('Sigue la fórmula de la no conformidad:').isVisible(), 'la redacción editada se verifica en vivo contra la fórmula de su categoría')
// PDF de evidencia también al editar: el ya analizado no se repite; uno escaneado se registra al aplicar
ok(await p.getByText('analizado con la IA').isVisible(), 'el paso 4 muestra el PDF que analizó la IA')
await p.locator('input[type="file"]').setInputFiles(PDF_TEXTO)
await p.getByText('El PDF evidencia.pdf ya está registrado en este hallazgo.').waitFor()
ok(true, 'el PDF que ya analizó la IA no se registra dos veces')
await p.locator('input[type="file"]').setInputFiles(PDF_ESCANEADO)
await p.getByText(/El PDF parece escaneado/).waitFor()
const cuadroEvidencia = p.getByRole('textbox', { name: 'Evidencia', exact: true })
ok(await cuadroEvidencia.isVisible(), 'al cargar un PDF en el paso 4 se abre el cuadro de evidencia para describirlo')
const descripcionPdf = 'Fotografía del extintor (PDF escaneado): la etiqueta muestra la recarga vencida.'
await cuadroEvidencia.fill(`${await cuadroEvidencia.inputValue()}\n\n${descripcionPdf}`)
await p.getByRole('button', { name: 'Aplicar' }).click()
await p.getByText('agregado al editar').waitFor()
ok(await p.getByText('escaneado.pdf').isVisible() && await p.getByText(descripcionPdf).isVisible(), 'al aplicar, el PDF escaneado queda registrado y la evidencia lo describe')
await p.getByText('Ver texto original del auditor').click()
ok((await p.locator('details[open] p').first().innerText()).replace(/\s+/g, ' ').includes('extintor vencido'), 'el texto original del auditor sigue disponible')

// Paso 5 · riesgo
await p.getByRole('button', { name: 'Siguiente: riesgo' }).click()
await p.getByRole('heading', { name: '5. Riesgo' }).waitFor()
ok(await p.getByText('Moderado (8)').first().isVisible(), 'paso 5: la IA propone P2 × I4 y la aplicación calcula el nivel (Moderado, 8)')
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
ok(parches.some((x) => x.cuerpo.evidencia_anexos?.length === 1 && x.cuerpo.evidencia_anexos[0].nombre === 'escaneado.pdf' && /^[0-9a-f]{64}$/.test(x.cuerpo.evidencia_anexos[0].sha256)
  && x.cuerpo.evidencia?.includes(descripcionPdf)), 'el PDF agregado en el paso 4 se guarda (solo su huella) junto con la evidencia')
ok(!peticiones.some((x) => JSON.stringify(x.cuerpo ?? '').includes('%PDF')), 'tampoco al editar se envía el archivo PDF')

// Matriz consolidada: solo se descarga con todo validado
await p.getByRole('heading', { name: 'Matriz consolidada' }).waitFor()
const filasMatriz = p.locator('table').filter({ has: p.locator('caption', { hasText: 'Matriz consolidada de hallazgos' }) }).locator('tbody tr')
await filasMatriz.nth(4).waitFor()
ok((await filasMatriz.count()) === 5, 'la matriz lista los 5 hallazgos vigentes')
ok(await escalaFija(), 'en la matriz tampoco se puede editar la escala de niveles')
ok((await p.locator('table').filter({ has: p.locator('caption', { hasText: 'Matriz consolidada de hallazgos' }) }).locator('thead th').allTextContents()).join('|') === 'ID|Clasificación|Norma y numeral|Evidencia|Riesgo|Hallazgo|Evaluación|Controles|Estado', 'columnas: ID, clasificación, norma y numeral, evidencia, riesgo, hallazgo, evaluación, controles y estado')
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
// Validar un hallazgo sin la dimensión de impacto: se abre directamente en el riesgo, con el campo marcado
const h04 = db.hallazgos.find((h) => h.consecutivo === 4)
const dimensionH04 = h04.riesgo_dimension
h04.riesgo_dimension = null
await p.reload()
await filasMatriz.nth(4).waitFor()
await p.getByRole('combobox', { name: 'Estado de H-04' }).selectOption('confirmado')
const modalH04 = p.getByRole('dialog', { name: /^Hallazgo H-04/ })
await modalH04.waitFor()
const selectorDimension = modalH04.getByRole('combobox', { name: 'Dimensión de impacto' })
await p.waitForTimeout(300)
const dimensionVisible = await selectorDimension.evaluate((el) => {
  const r = el.getBoundingClientRect()
  return r.top >= 0 && r.bottom <= window.innerHeight
})
ok(await modalH04.getByText(/Para validarlo falta la dimensión de impacto/).isVisible() && dimensionVisible
  && await modalH04.getByText('Elige la dimensión de impacto: sin ella el hallazgo no se puede validar.').isVisible()
  && (await selectorDimension.getAttribute('aria-invalid')) === 'true' && h04.estado === 'cambios_sugeridos',
  'si falta la dimensión, validar abre el hallazgo en el riesgo con el campo marcado (y no lo valida)')
await p.screenshot({ path: `${CAPTURAS}06g-falta-dimension.png` })
await selectorDimension.selectOption(dimensionH04)
await modalH04.getByRole('button', { name: 'Validar hallazgo' }).click()
await p.getByText('H-04 validado').waitFor()
ok(h04.estado === 'confirmado' && h04.riesgo_dimension === dimensionH04, 'al elegir la dimensión, el hallazgo se valida desde el mismo modal')
await p.keyboard.press('Escape')
await modalH04.waitFor({ state: 'hidden' })
const [descargaMatriz] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: 'Descargar matriz (Excel)' }).click()])
const rutaMatriz = `${CAPTURAS}${descargaMatriz.suggestedFilename()}`
await descargaMatriz.saveAs(rutaMatriz)
ok(/^Matriz_AI-2026-001_\d{8}\.xlsx$/.test(descargaMatriz.suggestedFilename()), `con todo validado se descarga el Excel: ${descargaMatriz.suggestedFilename()}`)
const xlsx = execSync(`unzip -p "${rutaMatriz}"`).toString()
ok(['Matriz consolidada de hallazgos · AI-2026-001', 'Norma y numeral', 'H-04', 'NTC-ISO 9001:2015, numeral 8.5.1', '= 16 · Alto', 'Validado'].every((t) => xlsx.includes(t)),
  'el Excel tiene el título, las columnas, los hallazgos, la evaluación del riesgo y el estado')

// Resultados de la auditoría, justo debajo de la matriz
const resultados = p.getByRole('region', { name: 'Resultados de la auditoría' })
await resultados.scrollIntoViewIfNeeded()
const esperado = resultadosAuditoria(db.hallazgos.filter((h) => h.auditoria_id === A1))
const leyenda = await resultados.getByRole('list', { name: 'Hallazgos por clasificación' }).innerText()
const siglas = (await resultados.getByRole('list', { name: 'Resumen por sigla' }).innerText()).replace(/\s+/g, ' ')
const filasNormas = await resultados.locator('table tbody th').allTextContents()
const posMatriz = await filasMatriz.first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
const posResultados = await resultados.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
ok(posResultados > posMatriz && esperado.total === 5
  && await resultados.getByRole('img', { name: /^Gráfico circular: 5 hallazgos\. No conformidad 1 \(20 %\), Fortaleza 2 \(40 %\), Observación 1 \(20 %\), Oportunidad de mejora 1 \(20 %\)/ }).isVisible()
  && /No conformidad\s+1\s+20 %\s+Fortaleza\s+2\s+40 %\s+Observación\s+1\s+20 %\s+Oportunidad de mejora\s+1\s+20 %/.test(leyenda)
  && siglas.includes('NC: 1') && siglas.includes('F: 2') && siglas.includes('O: 1') && siglas.includes('OM: 1'),
  'debajo de la matriz: «Resultados de la auditoría» con el anillo, la leyenda (cifra y porcentaje) y las siglas NC, F, O, OM', `${leyenda} | ${siglas}`)
ok(JSON.stringify(filasNormas) === JSON.stringify(esperado.normas.map((f) => f.norma)) && filasNormas.length > 0
  && await resultados.getByRole('heading', { name: 'Distribución de hallazgos por norma o documento' }).isVisible(),
  `y la distribución por norma o documento (${filasNormas.join(', ')})`)
await resultados.screenshot({ path: `${CAPTURAS}06h-resultados.png` })

await p.goto(`${BASE}/app/auditorias/${A1}`)
await p.locator('article[aria-label^="Hallazgo"]').nth(4).waitFor()
ok((await p.locator('article[aria-label^="Hallazgo"]').count()) === 5, 'el detalle muestra ahora 5 hallazgos')
ok(await p.getByText('editado por el auditor').first().isVisible(), 'el hallazgo editado queda marcado')

// PDF de evidencia al editar desde «Ver y editar» (el mismo modal del detalle y de la matriz)
await p.locator('article[aria-label="Hallazgo 1"]').getByRole('button', { name: 'Ver y editar' }).click()
const modalH01 = p.getByRole('dialog', { name: /^Hallazgo H-01/ })
await modalH01.waitFor()
ok(await modalH01.getByRole('button', { name: 'Cargar un PDF de evidencia' }).isVisible(), '«Ver y editar» ofrece cargar un PDF de evidencia')
await modalH01.locator('input[type="file"]').setInputFiles(PDF_TEXTO)
await modalH01.getByText(/Se agregó al cuadro de evidencia/).waitFor()
const cuadroH01 = modalH01.getByRole('textbox', { name: 'Evidencia', exact: true })
ok((await cuadroH01.inputValue()).replace(/\s+/g, ' ').includes('extintor vencido en el área de urgencias'), 'el texto del PDF se agrega al cuadro de evidencia para revisarlo antes de aplicar')
await p.screenshot({ path: `${CAPTURAS}06e-pdf-al-editar.png` })
await cuadroH01.press('Escape')
await p.waitForTimeout(300)
ok(await modalH01.isVisible() && (await modalH01.getByText('evidencia.pdf').count()) === 0 && !db.hallazgos.find((h) => h.consecutivo === 1).evidencia_anexos.length,
  'Esc cancela la edición sin cerrar el modal y descarta el PDF cargado')
await modalH01.locator('input[type="file"]').setInputFiles(PDF_TEXTO)
await modalH01.getByText(/Se agregó al cuadro de evidencia/).waitFor()
await modalH01.getByRole('button', { name: 'Aplicar' }).click()
await modalH01.getByText(/agregado el \d\d\/\d\d\/\d{4}/).waitFor()
const h01 = db.hallazgos.find((h) => h.consecutivo === 1)
ok(h01.evidencia_anexos[0]?.nombre === 'evidencia.pdf' && h01.evidencia.includes('extintor vencido') && h01.estado === 'editado',
  'al aplicar se guardan la evidencia y la huella del PDF; el hallazgo validado vuelve a Pendiente', JSON.stringify({ estado: h01.estado, anexos: h01.evidencia_anexos }))
// Si el auditor corrige la clasificación, la redacción debe pasar a la fórmula de la nueva categoría
ok(await modalH01.getByText('Sigue la fórmula de la fortaleza:').isVisible(), 'la fortaleza real sigue la fórmula del dueño (qué es relevante + porque + beneficio)')
const corregirA = async (valor) => {
  await modalH01.getByRole('button', { name: 'Corregir clasificación' }).click()
  await modalH01.getByRole('combobox', { name: 'Clasificación', exact: true }).selectOption(valor)
}
await corregirA('OPORTUNIDAD_DE_MEJORA')
await modalH01.getByText(/Ajusta la redacción a la fórmula de la oportunidad de mejora/).waitFor()
ok(await modalH01.getByText(/La redacción del hallazgo no sigue la fórmula de la oportunidad de mejora/).isVisible()
  && await modalH01.getByText(/No usa la fórmula «es susceptible de mejorar»/).isVisible(),
  'al corregir la clasificación, se avisa que la redacción no sigue la fórmula de la nueva categoría y qué le falta')
await p.screenshot({ path: `${CAPTURAS}06f-formula-tras-corregir.png` })
await corregirA('FORTALEZA')
await modalH01.getByText('Sigue la fórmula de la fortaleza:').waitFor()
ok((await modalH01.getByText(/Ajusta la redacción/).count()) === 0, 'con la clasificación y la redacción coherentes, el aviso desaparece')
await modalH01.getByRole('button', { name: 'Validar hallazgo' }).click()
await p.getByText('Hallazgo validado').waitFor()
await p.keyboard.press('Escape')
await modalH01.waitFor({ state: 'hidden' })

// Filtro por clasificación desde los contadores
await p.getByRole('button', { name: /^1\s*No conformidad/ }).click()
ok((await p.locator('article[aria-label^="Hallazgo"]').count()) === 1, 'el contador de no conformidades filtra la lista')
await p.getByRole('button', { name: /^1\s*No conformidad/ }).click()

// Informe final con el formato oficial (src/formato_de_informe_final/Auditoria_interna.odt)
await p.getByRole('link', { name: 'Generar informe' }).click()
await p.getByLabel('Fecha inicio (real)').fill('2026-10-01')
await p.getByLabel('Fecha terminación (real)').fill('2026-10-02')
await p.getByRole('button', { name: 'Guardar fechas' }).click()
await p.getByText(/Fechas reales guardadas/).waitFor()
ok(db.auditorias[0].fecha_inicio_real === '2026-10-01' && db.auditorias[0].fecha_fin_real === '2026-10-02', 'el auditor registra las fechas reales que pide la Ficha Técnica')
// Indicadores priorizados del proceso (plantilla del 5/10/2026): los registra el auditor y la IA redacta la revisión
ok(await p.getByText('«Revisión de indicadores priorizados en el proceso de Servicio de Urgencias»').isVisible(), 'la tarjeta muestra la línea de la plantilla con el área de la auditoría')
await p.getByRole('button', { name: 'Agregar indicador' }).click()
await p.getByRole('button', { name: 'Guardar indicadores' }).click()
await p.getByText('Escribe el nombre del indicador').waitFor()
ok(true, 'un indicador sin nombre no se guarda')
const indicador1 = p.getByRole('group', { name: 'Indicador 1' })
await indicador1.getByLabel('Nombre').fill('Oportunidad en la atención de triage II')
await indicador1.getByLabel('Meta').fill('≤ 30 minutos')
await indicador1.getByLabel('Resultado').fill('42 minutos')
await indicador1.getByLabel('Observación (opcional)').fill('Dato del último trimestre.')
await p.getByRole('button', { name: 'Agregar indicador' }).click()
await p.getByRole('group', { name: 'Indicador 2' }).getByLabel('Nombre').fill('Proporción de reingresos a urgencias')
await p.getByRole('button', { name: 'Guardar indicadores' }).click()
await p.getByText(/Indicadores guardados/).waitFor()
const indicadoresDb = db.auditorias[0].indicadores_revisados
ok(indicadoresDb?.length === 2 && indicadoresDb[0].resultado === '42 minutos' && indicadoresDb[1].meta === '' && Object.keys(indicadoresDb[0]).sort().join() === 'meta,nombre,observacion,resultado',
  'el auditor registra los indicadores que revisó (nombre, meta, resultado y observación)', JSON.stringify(indicadoresDb))
await p.getByRole('button', { name: 'Generar informe' }).click()
const hoja = p.getByRole('article', { name: 'Informe final de auditoría' })
await hoja.waitFor()
const textoHoja = (await hoja.innerText()).replace(/\s+/g, ' ')
const ORDEN_VISTA = ['HOSPITAL INFANTIL LOS ANGELES', 'Auditoria Interna - 2026 - Urgencias', 'Auditores Internos', 'Auditoria interna de SIG', 'Ficha Técnica',
  'Fecha inicio (planeada) 2026-10-01', 'Fecha inicio (real) 2026-10-01', 'Sistema de referencia NTC-ISO 9001:2015, PR13-GQ, ISO 19011', 'Evaluador Auditores Internos',
  'Equipo auditor Laura Gómez Ñáñez - Enfermera', 'Equipo auditor Pedro Pérez Ortiz - Médico, Tesorera', 'Líder equipo Ana María Rodríguez Peña - Auditor médico, Coordinadora',
  'Archivos adjuntos evidencia.pdf (1 página)', 'escaneado.pdf (1 página)', 'FORTALEZAS IDENTIFICADAS', 'OPORTUNIDADES DE MEJORA', 'OBSERVACIONES', 'NO CONFORMIDADES', 'Objetivo', 'Alcance',
  'Criterios de selección equipo auditor Principales aspectos que se tienen en cuenta:', 'Criterios de auditoría', 'Priorización de procesos',
  'Métodos a emplear para el desarrollo de la auditoría', 'Riesgos y oportunidades del programa auditoria', 'Indicadores',
  'Revisión de indicadores priorizados en el proceso de Servicio de Urgencias', '• Oportunidad en la atención de triage II: meta ≤ 30 minutos; resultado 42 minutos. Dato del último trimestre.',
  '• Proporción de reingresos a urgencias: meta no definida; resultado no informado.', 'Se revisaron dos indicadores priorizados', 'Oportunidades', 'Observaciones',
  'Conclusiones', 'Generado por Ana María Rodríguez Peña - ']
const enOrden = (texto, partes) => {
  let desde = 0
  for (const parte of partes) {
    const i = texto.indexOf(parte, desde)
    if (i < 0) return parte
    desde = i + parte.length
  }
  return ''
}
const faltaVista = enOrden(textoHoja, ORDEN_VISTA) || (/RECOMENDACIONES|Hallazgos registrados:|\(area auditada\)/.test(textoHoja) ? 'RECOMENDACIONES, cifras o campo sin llenar' : '')
ok(!faltaVista, 'la vista sigue el formato oficial: portada, Ficha Técnica, hallazgos (fortalezas → oportunidades → observaciones → no conformidades) y secciones', faltaVista)
const extintor = db.hallazgos.find((h) => h.clasificacion === 'NO_CONFORMIDAD' && /extintor/.test(h.hallazgo_corregido)).hallazgo_corregido
ok(textoHoja.indexOf(extintor.slice(0, 60)) > textoHoja.indexOf('NO CONFORMIDADES') && textoHoja.indexOf(extintor.slice(0, 60)) < textoHoja.indexOf('Objetivo'),
  'cada hallazgo va en su lista, con la redacción validada')
await p.screenshot({ path: `${CAPTURAS}07-informe.png`, fullPage: true })

// ODT: la plantilla oficial llena
const [descargaOdt] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: 'Documento (ODT)' }).click()])
const rutaOdt = `${CAPTURAS}${descargaOdt.suggestedFilename()}`
await descargaOdt.saveAs(rutaOdt)
ok(/^Informe_AI-2026-001_\d{8}\.odt$/.test(descargaOdt.suggestedFilename()), `nombre del documento: ${descargaOdt.suggestedFilename()}`)
const listado = execSync(`unzip -v "${rutaOdt}"`).toString().split('\n').filter((l) => /\s(Stored|Defl:\w)\s/.test(l))
ok(/\sStored\s.*\smimetype$/.test(listado[0] ?? '') && execSync(`unzip -p "${rutaOdt}" mimetype`).toString() === 'application/vnd.oasis.opendocument.text',
  'el archivo es un ODT válido (mimetype primero y sin comprimir)')
const textoOdf = (xml) => xml.replace(/<text:s\/>/g, ' ').replace(/<text:s text:c="(\d+)"\/>/g, (_, n) => ' '.repeat(Number(n)))
  .replace(/<\/(text:p|text:h)>/g, '\n').replace(/<\/table:table-cell>/g, ' | ').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
// Una línea por párrafo; las celdas de una fila de tabla se unen con « | »
const lineas = (xml) => textoOdf(xml.replace(/<\/text:p>(?=\s*<\/table:table-cell>)/g, '').replace(/<table:table-row[^>]*>|<\/table:table>/g, '\n'))
  .split('\n').map((l) => l.replace(/\s+/g, ' ').replace(/(\s*\|\s*)+$/, '').replace(/^(\s*\|\s*)+/, '').trim()).filter(Boolean)
const PLANTILLA = `${REPO}/src/formato_de_informe_final/Auditoria_interna.odt`
const original = lineas(execSync(`unzip -p "${PLANTILLA}" content.xml`).toString())
const llenado = lineas(execSync(`unzip -p "${rutaOdt}" content.xml`).toString())
const textoLlenado = llenado.join('\n')
// Todos los textos de la plantilla siguen ahí, en el mismo orden (menos el título y el año de la portada, que se llenan)
// (el renglón con «(area auditada)» se llena con el área: se comprueba abajo, ya lleno)
const fijos = original.filter((l) => !/^Auditoria Interna - /.test(l) && !/^\d{4}$/.test(l) && !l.includes('(area auditada)')).map((l) => l.replace(/^\|\s*/, '').split(' | ')[0])
const faltaFijo = enOrden(textoLlenado, fijos)
ok(!faltaFijo, `el documento conserva todos los textos de la plantilla en su orden (${fijos.length})`, faltaFijo)
const ORDEN_ODT = ['Auditoria Interna - 2026 - Urgencias Auditores Internos', '2026', 'Fecha inicio (planeada) | 2026-10-01 | Fecha terminación (planeada) | 2026-10-03',
  'Fecha inicio (real) | 2026-10-01 | Fecha terminación (real) | 2026-10-02', 'Sistema de referencia | NTC-ISO 9001:2015, PR13-GQ, ISO 19011', 'Evaluador | Auditores Internos',
  'Equipo auditor | Laura Gómez Ñáñez - Enfermera', 'Equipo auditor | Pedro Pérez Ortiz - Médico, Tesorera', 'Líder equipo | Ana María Rodríguez Peña - Auditor médico, Coordinadora',
  'Archivos adjuntos', 'evidencia.pdf (1 página)', 'escaneado.pdf (1 página)', 'FORTALEZAS IDENTIFICADAS', '• ', 'OPORTUNIDADES DE MEJORA', '• ', 'OBSERVACIONES', '• ', 'NO CONFORMIDADES', `• ${extintor.slice(0, 50)}`,
  'Objetivo', 'Evaluar el cumplimiento', 'Alcance', 'La auditoría comprende', 'Principales aspectos que se tienen en cuenta:', '• Competencia', 'Criterios de auditoría', '• NTC-ISO 9001:2015',
  'Priorización de procesos', 'Métodos a emplear para el desarrollo de la auditoría', '• Revisión documental', 'Riesgos y oportunidades del programa auditoria',
  'Indicadores', 'Revisión de indicadores priorizados en el proceso de Servicio de Urgencias', '• Oportunidad en la atención de triage II: meta ≤ 30 minutos; resultado 42 minutos. Dato del último trimestre.',
  '• Proporción de reingresos a urgencias: meta no definida; resultado no informado.', 'Se revisaron dos indicadores priorizados', 'Oportunidades', 'Observaciones',
  'La auditoría interna AI-2026-001', 'Conclusiones', 'Con base en la evidencia']
const faltaOdt = enOrden(textoLlenado, ORDEN_ODT) || (/RECOMENDACIONES|Hallazgos registrados:|\(area auditada\)/.test(textoLlenado) ? 'RECOMENDACIONES, cifras o campo sin llenar' : '')
ok(!faltaOdt, 'el ODT llena la portada, la Ficha Técnica, las cuatro listas y cada sección en su lugar', faltaOdt)
const estilosOdt = execSync(`unzip -p "${rutaOdt}" styles.xml`).toString()
ok(/Auditoria Interna - 2026 - Urgencias/.test(textoOdf(estilosOdt)) && /Generado por Ana María Rodríguez Peña - 20\d\d-\d\d-\d\d \d{1,2}:\d\d [AP]M/.test(textoOdf(estilosOdt))
  && /<text:page-number[^>]*>/.test(estilosOdt) && /<text:page-count/.test(estilosOdt), 'encabezado y pie de la plantilla con la auditoría, quien lo generó y el número de página')
const posicionesPie = [...estilosOdt.matchAll(/draw:name="Textbox \d+"[^>]*?svg:y="([\d.]+in)"|svg:y="([\d.]+in)"[^>]*?draw:name="Textbox \d+"/g)].map((m) => m[1] ?? m[2])
ok(new Set(posicionesPie).size <= 2, 'el encabezado y el pie quedan en el mismo lugar en todas las páginas', posicionesPie.join(', '))
ok(!/tatis6661212/.test(execSync(`unzip -p "${rutaOdt}" meta.xml`).toString()), 'los metadatos no arrastran datos personales de quien elaboró la plantilla')
const imagenesOdt = execSync(`unzip -l "${rutaOdt}"`).toString()
ok(/(media|Pictures)\/[^\s]+\.jpe?g/.test(imagenesOdt) && !/Thumbnails\//.test(imagenesOdt), 'el logo de la plantilla se conserva (y no la miniatura de la plantilla vacía)')
const xmlInvalido = ['content.xml', 'styles.xml', 'meta.xml', 'META-INF/manifest.xml'].filter((x) => {
  try {
    execSync(`unzip -p "${rutaOdt}" ${x} | python3 -c "import sys; from xml.dom import minidom; minidom.parseString(sys.stdin.buffer.read())"`, { stdio: 'ignore' })
    return false
  } catch {
    return true
  }
})
ok(!xmlInvalido.length, 'todos los XML del documento son válidos', xmlInvalido.join(', '))
// Si LibreOffice está instalado, el ODT se convierte a PDF para ver cómo queda (no es obligatorio en CI)
try {
  execSync(`timeout 120 soffice --headless --convert-to pdf --outdir "${CAPTURAS}odt" "${rutaOdt}"`, { stdio: 'ignore' })
  const pdfOdt = `${CAPTURAS}odt/${descargaOdt.suggestedFilename().replace(/\.odt$/, '.pdf')}`
  const textoPdfOdt = execSync(`pdftotext "${pdfOdt}" -`).toString()
  ok(/Página 1\/\d/.test(textoPdfOdt) && /FORTALEZAS IDENTIFICADAS/.test(textoPdfOdt), 'LibreOffice abre el ODT y numera las páginas')
  execSync(`pdftoppm -r 60 -png "${pdfOdt}" "${CAPTURAS}odt/pagina"`)
} catch {
  console.log('  · LibreOffice no está instalado: se omite la conversión del ODT a PDF')
}

// PDF con el mismo formato
const [descargaPdf] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: 'PDF' }).click()])
const rutaPdf = `${CAPTURAS}${descargaPdf.suggestedFilename()}`
await descargaPdf.saveAs(rutaPdf)
ok(/^Informe_AI-2026-001_\d{8}\.pdf$/.test(descargaPdf.suggestedFilename()), `nombre del PDF: ${descargaPdf.suggestedFilename()}`)
const textoPdf = execSync(`pdftotext "${rutaPdf}" -`).toString().replace(/\s+/g, ' ')
const paginasPdf = Number(execSync(`pdfinfo "${rutaPdf}"`).toString().match(/Pages:\s+(\d+)/)[1])
ok(/A4|595\.\d* x 841\.\d*/.test(execSync(`pdfinfo "${rutaPdf}"`).toString()), 'tamaño A4, como la plantilla')
const faltaPdf = enOrden(textoPdf, ['HOSPITAL INFANTIL LOS ANGELES', 'Auditoria Interna - 2026 - Urgencias Auditores Internos', 'Auditoria interna de SIG', 'Ficha Técnica',
  'Evaluador', 'Auditores Internos', 'FORTALEZAS IDENTIFICADAS', 'OPORTUNIDADES DE MEJORA', 'OBSERVACIONES', 'NO CONFORMIDADES', 'Objetivo', 'Alcance',
  'Criterios de selección equipo auditor', 'Criterios de auditoría', 'Priorización de procesos', 'Métodos a emplear para el desarrollo de la auditoría',
  'Riesgos y oportunidades del programa auditoria', 'Indicadores', 'Revisión de indicadores priorizados en el proceso de Servicio de Urgencias',
  '• Oportunidad en la atención de triage II: meta ≤ 30 minutos; resultado 42 minutos.', 'Se revisaron dos indicadores priorizados', 'Oportunidades', 'Observaciones', 'Conclusiones'])
  || (/RECOMENDACIONES|Hallazgos registrados:/.test(textoPdf) ? 'RECOMENDACIONES o cifras de la auditoría' : '')
ok(!faltaPdf, 'el PDF sigue el mismo orden del formato oficial', faltaPdf)
ok(new RegExp(`Página 1/${paginasPdf}`).test(textoPdf) && /Generado por Ana María Rodríguez Peña/.test(textoPdf) && /Ñáñez/.test(textoPdf),
  `encabezado y pie de la plantilla en cada página (${paginasPdf} páginas), con tildes y «ñ»`)
const fuentesPdf = execSync(`pdffonts "${rutaPdf}"`).toString()
ok(/LiberationSans/.test(fuentesPdf) && !/Helvetica/.test(fuentesPdf), 'fuente libre incrustada (Liberation Sans, con las medidas de Arial)')
const imagenesPdf = execSync(`pdfimages -list "${rutaPdf}"`).toString().split('\n').filter((l) => /^\s*\d+\s+\d+\s+image\b/.test(l))
ok(imagenesPdf.length === 1 && /^\s*1\s/.test(imagenesPdf[0]), 'el logo de la plantilla va solo en la portada', imagenesPdf.join(' / '))
execSync(`pdftoppm -r 60 -png "${rutaPdf}" "${CAPTURAS}pdf-pagina"`)

// Un informe generado con el formato anterior pide generar una nueva versión
{
  const viejo = structuredClone(db.informes.at(-1))
  Object.assign(viejo, { id: crypto.randomUUID(), version: 99 })
  viejo.contenido = { version_estructura: 2, identificacion: viejo.contenido.identificacion }
  db.informes.push(viejo)
  await p.goto(`${BASE}/app/auditorias/${A1}/informe`)
  await p.getByRole('heading', { name: 'Esta versión tiene el formato anterior' }).waitFor()
  ok((await p.getByRole('button', { name: 'Documento (ODT)' }).count()) === 0, 'un informe con el formato anterior pide generar una nueva versión y no se descarga')
  db.informes.pop()
}
perfil.cargos = []
await p.goto(`${BASE}/app`)
await p.getByText(/Completa tu perfil: elige tu grupo de auditores/).waitFor()
ok(true, 'un perfil anterior incompleto ve el aviso para completarlo en «Mi perfil»')
perfil.cargos = ['Auditor médico', 'Coordinadora']

// Lista de verificación: la hoja de trabajo del auditor (sin IA)
const preguntaLista = p.getByRole('dialog', { name: '¿Cómo quieres continuar?' })
const estadoGuardado = p.getByRole('status').filter({ hasText: /^Cambios guardados/ })
await p.goto(`${BASE}/app/auditorias/${A1}`)
await p.getByRole('heading', { name: 'Auditoría interna al proceso de Urgencias' }).waitFor()
await p.waitForTimeout(500)
ok((await preguntaLista.count()) === 0, 'sin lista de verificación, entrar a la auditoría no pregunta nada')
await p.getByRole('link', { name: 'Crear lista de verificación' }).click()
await p.getByRole('heading', { name: 'Lista de verificación', exact: true }).waitFor()
await estadoGuardado.waitFor({ timeout: 10000 })
ok(db.listas_verificacion.some((l) => l.auditoria_id === A1), 'al abrirla, la lista queda creada aunque aún no se escriba nada')
ok(await p.getByRole('button', { name: 'Guardar cambios' }).isVisible() && await p.getByRole('button', { name: 'Continuar con la auditoría' }).isVisible(),
  'la barra de la lista siempre tiene «Guardar cambios» y «Continuar con la auditoría»')
const antesLista = peticiones.length
ok(await p.getByLabel('ELABORADA POR:').inputValue() === 'Ana María Rodríguez Peña' && await p.getByLabel('PROCESO A AUDITAR').inputValue() === 'Urgencias'
  && await p.getByLabel('CARGO Y NOMBRE DE LOS AUDITADOS:').inputValue() === 'Coordinador de Urgencias - Jorge Muñoz' && await p.getByLabel('LUGAR DE EJECUCIÓN:').inputValue() === 'Servicio de Urgencias',
  'la lista arranca con la información general de la auditoría y del auditor')
ok(await p.getByLabel('Título de la sección 1').inputValue() === 'URGENCIAS' && (await p.getByRole('group', { name: /^Marca de la fila/ }).count()) === 5,
  'trae una sección con el proceso y cinco filas para llenar')
await p.getByLabel(`${'Normatividad/requisito/ componente por auditar'} (fila 1)`).fill('NTC-ISO 9001:2015 7.1.3 Infraestructura')
await p.getByLabel('Pregunta (fila 1)').fill('¿Existe un plan de mantenimiento de equipos con cronograma?')
await p.getByLabel('Documentos – evidencia (fila 1)').fill('Plan de mantenimiento 2026')
await p.getByRole('group', { name: 'Marca de la fila 1' }).getByRole('button', { name: 'NC: No Conforme' }).click()
await p.getByLabel('Hallazgos o anotaciones (fila 1)').fill('El cronograma no incluye los extintores de Urgencias.')
await p.getByRole('group', { name: 'Marca de la fila 2' }).getByRole('button', { name: 'F: Fortalezas' }).click()
await p.getByRole('group', { name: 'Marca de la fila 2' }).getByRole('button', { name: 'OB: Observación' }).click()
ok((await p.getByRole('group', { name: 'Marca de la fila 2' }).getByRole('button', { pressed: true }).count()) === 1, 'cada fila admite una sola marca (NC, O, OB o F)')
await p.getByRole('button', { name: 'Agregar sección' }).click()
await p.getByLabel('Título de la sección 2').fill('GESTION DE RECURSOS FISICOS (MANTENIMIENTO)')
await p.getByRole('button', { name: 'Agregar fila a la sección 2' }).click()
await estadoGuardado.waitFor({ timeout: 10000 })
const guardadoLista = db.listas_verificacion.find((l) => l.auditoria_id === A1)
ok(guardadoLista?.secciones.length === 2 && guardadoLista.secciones[0].filas[0].marca === 'NC' && guardadoLista.secciones[0].filas[1].marca === 'OB'
  && guardadoLista.secciones[1].filas.length === 6 && guardadoLista.user_id === USUARIO, 'la lista se guarda sola tras los cambios', JSON.stringify(guardadoLista?.secciones?.map((x) => x.filas.length)))
ok(!peticiones.slice(antesLista).some((x) => x.metodo === 'FUNC'), 'la lista de verificación no pasa por la IA')
await p.screenshot({ path: `${CAPTURAS}12-lista-verificacion.png`, fullPage: true })

// «Guardar cambios» guarda en el acto, sin esperar el guardado automático
await p.getByLabel(`${'Normatividad/requisito/ componente por auditar'} (fila 3)`).first().fill('Resolución 3100 de 2019: estándar de dotación')
ok(await p.getByRole('status').filter({ hasText: 'Cambios sin guardar' }).isVisible(), 'mientras escribe, la barra avisa «Cambios sin guardar»')
await p.getByRole('button', { name: 'Guardar cambios' }).click()
await p.getByText('Lista guardada').waitFor()
ok(db.listas_verificacion.find((l) => l.auditoria_id === A1).secciones[0].filas[2].requisito === 'Resolución 3100 de 2019: estándar de dotación', '«Guardar cambios» guarda la lista en el acto')
await p.getByLabel('Pregunta (fila 3)').first().fill('¿Los carros de paro tienen la dotación completa?')
await p.keyboard.press('Control+s')
await p.getByText('Lista guardada').first().waitFor()
await estadoGuardado.waitFor()
ok(db.listas_verificacion.find((l) => l.auditoria_id === A1).secciones[0].filas[2].pregunta === '¿Los carros de paro tienen la dotación completa?', 'Ctrl+S también guarda la lista')

// Volver a la auditoría desde la lista no pregunta; ENTRAR a ella sí, siempre
await p.getByRole('button', { name: 'Continuar con la auditoría' }).click()
await p.getByRole('heading', { name: 'Auditoría interna al proceso de Urgencias' }).waitFor()
await p.waitForTimeout(500)
ok((await preguntaLista.count()) === 0, 'al volver desde la lista a la auditoría no se pregunta de nuevo')
for (const vuelta of [1, 2]) {
  await p.getByRole('navigation', { name: 'Navegación principal' }).first().getByRole('link', { name: 'Auditorías' }).click()
  await p.getByRole('link', { name: /Auditoría interna al proceso de Urgencias/ }).click()
  await preguntaLista.waitFor()
  ok(true, `al entrar a la auditoría con lista se pregunta si sigue con la lista o con la auditoría (vez ${vuelta})`)
  if (vuelta === 1) {
    ok(await preguntaLista.getByText('2 de 3 puntos tienen marca (NC, O, OB o F)').isVisible(), 'la pregunta resume el avance de la lista')
    await p.screenshot({ path: `${CAPTURAS}12b-pregunta-lista.png` })
    await preguntaLista.getByRole('button', { name: 'Continuar con el proceso de auditoría' }).click()
    await p.waitForTimeout(300)
    ok((await preguntaLista.count()) === 0 && await p.getByRole('heading', { name: 'Hallazgos', exact: true }).isVisible(), '«Continuar con el proceso de auditoría» cierra la pregunta y deja la auditoría')
  }
}
await preguntaLista.getByRole('button', { name: 'Seguir editando la lista de verificación' }).click()
await p.getByLabel('Título de la sección 2').waitFor()
ok(await p.getByLabel('Hallazgos o anotaciones (fila 1)').first().inputValue() === 'El cronograma no incluye los extintores de Urgencias.', '«Seguir editando» abre la lista como se dejó')
await p.reload()
await p.getByLabel('Título de la sección 2').waitFor()
ok(await p.getByLabel('Pregunta (fila 3)').first().inputValue() === '¿Los carros de paro tienen la dotación completa?', 'al recargar, la lista está como se dejó')
const [descargaLista] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: 'Descargar PDF' }).click()])
const rutaLista = `${CAPTURAS}${descargaLista.suggestedFilename()}`
await descargaLista.saveAs(rutaLista)
const textoLista = execSync(`pdftotext -layout "${rutaLista}" -`).toString()
ok(/^Lista_verificacion_AI-2026-001_\d{8}\.pdf$/.test(descargaLista.suggestedFilename()) && /landscape|792 x 612/.test(execSync(`pdfinfo "${rutaLista}"`).toString()),
  `PDF de la lista en carta horizontal: ${descargaLista.suggestedFilename()}`)
const faltaLista = enOrden(textoLista.replace(/\s+/g, ' '), ['Auditoría No', 'Fecha', 'AI-2026-001', 'INFORMACION GENERAL', 'ELABORADA POR:', 'Ana María Rodríguez Peña', 'PROCESO A AUDITAR', 'CARGO Y NOMBRE DE LOS AUDITADOS:',
  'FECHA DE EJECUCIÓN:', 'LUGAR DE EJECUCIÓN:', 'O = Oportunidad NC = No Conforme OB = Observación F= Fortalezas', 'LISTA DE VERIFICACIÓN', 'Pregunta', 'NC', 'O', 'OB', 'F', 'Hallazgos o anotaciones',
  'URGENCIAS', 'Plan de mantenimiento 2026', 'X', 'El cronograma no incluye', 'GESTION DE RECURSOS FISICOS (MANTENIMIENTO)'])
ok(!faltaLista, 'el PDF reproduce el formato de la lista con lo anotado', faltaLista)
execSync(`pdftoppm -r 60 -png "${rutaLista}" "${CAPTURAS}lista-pagina"`)

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

// Al crearla se pregunta si empieza por la lista de verificación o directamente por la auditoría
await p.getByLabel('Título').fill('Auditoría interna al proceso de Cirugía')
await p.getByRole('button', { name: 'Crear auditoría' }).click()
const creada = p.getByRole('dialog', { name: 'Auditoría creada' })
await creada.waitFor()
const A2 = db.auditorias.find((a) => a.codigo === 'AI-2026-002')?.id
ok(A2 && await creada.getByText('AI-2026-002').isVisible() && (await creada.getByRole('button').count()) === 3,
  'al pulsar «Crear auditoría» aparece la pregunta: lista de verificación o auditoría')
await p.screenshot({ path: `${CAPTURAS}09b-auditoria-creada.png` })
await creada.getByRole('button', { name: 'Sí, crear la lista de verificación' }).click()
await p.getByRole('heading', { name: 'Lista de verificación', exact: true }).waitFor()
await estadoGuardado.waitFor({ timeout: 10000 })
ok(p.url().endsWith(`/app/auditorias/${A2}/lista`) && db.listas_verificacion.some((l) => l.auditoria_id === A2) && await p.getByLabel('PROCESO A AUDITAR').inputValue() === 'Cirugía',
  '«Sí, crear la lista» abre la lista de la nueva auditoría y la deja guardada')
await p.getByRole('button', { name: 'Continuar con la auditoría' }).click()
await p.getByRole('heading', { name: 'Auditoría interna al proceso de Cirugía' }).waitFor()
await p.waitForTimeout(500)
ok((await preguntaLista.count()) === 0, 'desde la lista recién creada se pasa a la auditoría sin otra pregunta')
await p.goBack()
await p.getByRole('heading', { name: 'Lista de verificación', exact: true }).waitFor()
await p.goBack()
await p.getByRole('heading', { name: 'Normas' }).first().waitFor()
ok(!p.url().endsWith('/app/auditorias/nueva'), '«Atrás» desde la auditoría creada no vuelve al formulario ya enviado')

await p.goto(`${BASE}/app/auditorias/nueva`)
await p.waitForFunction(() => document.querySelector('input[name="codigo"]')?.value === 'AI-2026-003')
await p.getByLabel('Título').fill('Auditoría interna al proceso de Farmacia')
await p.getByRole('button', { name: 'Crear auditoría' }).click()
await creada.getByRole('button', { name: 'Iniciar directamente la auditoría' }).click()
await p.getByRole('heading', { name: 'Auditoría interna al proceso de Farmacia' }).waitFor()
await p.waitForTimeout(500)
const A3 = db.auditorias.find((a) => a.codigo === 'AI-2026-003')?.id
ok(p.url().endsWith(`/app/auditorias/${A3}`) && !db.listas_verificacion.some((l) => l.auditoria_id === A3) && (await preguntaLista.count()) === 0
  && await p.getByRole('link', { name: 'Crear lista de verificación' }).isVisible(),
  '«Iniciar directamente la auditoría» lleva a la auditoría sin lista; se puede crear después')
await p.goto(`${BASE}/app/auditorias/${A3}/matriz`)
const resultadosVacios = p.getByRole('region', { name: 'Resultados de la auditoría' })
await resultadosVacios.waitFor()
ok(await resultadosVacios.getByText('Aún no hay hallazgos registrados. Analice un hallazgo y regístrelo en la matriz para ver los gráficos.').isVisible()
  && await resultadosVacios.getByRole('img', { name: 'Gráfico circular sin hallazgos.' }).isVisible()
  && (await resultadosVacios.getByRole('list', { name: 'Resumen por sigla' }).innerText()).replace(/\s+/g, ' ').includes('NC: 0'),
  'sin hallazgos, el consolidado muestra el aviso, el anillo vacío y todo en cero')
await resultadosVacios.screenshot({ path: `${CAPTURAS}06i-resultados-vacio.png` })

// Cerrar la sesión con cambios recién escritos: se guardan antes de salir
await p.goto(`${BASE}/app/auditorias/${A1}/lista`)
await p.getByLabel('Título de la sección 2').waitFor()
await p.getByLabel('Hallazgos o anotaciones (fila 2)').first().fill('Revisar el registro de temperatura de la nevera.')
await p.getByRole('button', { name: 'Salir' }).first().click()
await p.waitForURL((u) => !u.pathname.startsWith('/app'), { timeout: 15000 })
ok(db.listas_verificacion.find((l) => l.auditoria_id === A1).secciones[0].filas[1].anotaciones === 'Revisar el registro de temperatura de la nevera.',
  'al cerrar la sesión, lo que se acababa de escribir en la lista queda guardado')
await ctx.close()

// ═══ 2b. Controles de acceso ═══
console.log('\n▸ Controles de acceso')
{
  // Sin cierre por inactividad (decisión del dueño): la sesión dura hasta «Salir»
  const ctxS = await prepararContexto(navegador, { sesion: true })
  const ps = await ctxS.newPage()
  await ps.clock.install()
  await ps.goto(`${BASE}/app`)
  await ps.getByRole('heading', { name: /Hola, Ana/ }).waitFor()
  await ps.clock.fastForward('02:00:00')
  await ps.waitForTimeout(500)
  ok(new URL(ps.url()).pathname === '/app' && await ps.getByRole('heading', { name: /Hola, Ana/ }).isVisible(),
    'tras 2 horas sin actividad la sesión sigue abierta: no hay cierre por inactividad')
  await ctxS.close()

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
    [`/app/auditorias/${A1}/hallazgos/nuevo`, 'nuevo hallazgo', 'Nuevo hallazgo'],
    [`/app/auditorias/${A1}/informe`, 'informe', 'Informe de auditoría'],
    ['/app/normas', 'normas', 'Normas'],
    ['/app/perfil', 'perfil', 'Mi perfil'],
    ['/app/auditorias/nueva', 'nueva auditoría', 'Nueva auditoría'],
    [`/app/auditorias/${A1}/lista`, 'lista de verificación', 'Lista de verificación'],
    [`/app/auditorias/${A1}/matriz`, 'matriz consolidada', 'Matriz consolidada'],
  ]) {
    await m.goto(`${BASE}${ruta}`)
    await m.getByRole('heading', { name: esperar }).first().waitFor()
    await m.waitForTimeout(400)
    await sinDesborde(m, nombre)
  }
  await m.goto(`${BASE}/app/auditorias/${A1}/matriz`)
  await m.getByRole('region', { name: 'Resultados de la auditoría' }).screenshot({ path: `${CAPTURAS}10b-movil-resultados.png` })
  // Entrar a la auditoría con lista: primero la pregunta, después el detalle
  await m.goto(`${BASE}/app/auditorias/${A1}`)
  await m.getByRole('dialog', { name: '¿Cómo quieres continuar?' }).waitFor()
  await sinDesborde(m, 'pregunta al entrar a la auditoría')
  await m.getByRole('button', { name: 'Continuar con el proceso de auditoría' }).click()
  await m.getByRole('heading', { name: 'Auditoría interna al proceso de Urgencias' }).waitFor()
  await sinDesborde(m, 'detalle de auditoría')
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
