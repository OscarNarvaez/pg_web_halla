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
process.env.VITE_SUPABASE_URL = 'https://demo.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'anon', exp: 9999999999 })}.firma`
console.log('Compilando la app de prueba…')
await build({ root: REPO, logLevel: 'error', build: { outDir: `${SALIDA}/dist`, emptyOutDir: true } })
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
    fecha_inicio: '2026-10-01', fecha_fin: '2026-10-03', estado: 'en_curso', creado_en: '2026-10-01T08:00:00Z', actualizado_en: ahora,
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
  estado, editado_por_usuario: false, modelo_ia: 'gemini-3.6-flash', prompt_version: '1.0.0', criterios_citados: h.criterios_citados, avisos: h.avisos ?? [],
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
      if (tabla === 'hallazgos' && ['clasificacion', 'justificacion', 'hallazgo_corregido', 'criterio_requisito', 'evidencia', 'severidad'].some((c) => c in cuerpo)) f.editado_por_usuario = true
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
    const creados = caso.resultado.hallazgos.map((h) => nuevoHallazgo(h, cuerpo.entrada_auditor))
    db.hallazgos.push(...creados)
    return json({
      ok: true,
      hallazgos: creados.map((h) => ({ id: h.id, clasificacion: h.clasificacion, justificacion: h.justificacion, hallazgo_corregido: h.hallazgo_corregido,
        criterio_requisito: h.criterio_requisito, evidencia: h.evidencia, severidad: h.severidad, criterios_citados: h.criterios_citados, avisos: h.avisos })),
      meta: { modelo: 'gemini-3.5-flash', prompt_version: '1.0.0', latencia_ms: 1800, criterios_recuperados: 12, reparado: false },
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
  await p.screenshot({ path: `${CAPTURAS}01-landing.png`, fullPage: true })

  await p.goto(`${BASE}/registro`)
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

// Pantalla estrella
await p.getByRole('link', { name: 'Nuevo hallazgo' }).first().click()
await p.getByLabel('Describe lo que observaste durante la auditoría').waitFor()
const opcionesClasif = await p.locator('select option, input[type=radio]').evaluateAll((els) => els.map((e) => e.textContent || e.value))
ok(!opcionesClasif.some((t) => /no conformidad|observaci|fortaleza|oportunidad/i.test(t)), 'NO hay ningún control para elegir la clasificación antes del análisis')
await p.getByRole('button', { name: 'Analizar con IA' }).click()
ok(await p.getByText(/al menos 25 caracteres/).isVisible(), 'exige al menos 25 caracteres')
const entrada7 = motor.resultados.find((r) => r.caso.n === 7).caso.entrada
await p.getByLabel('Describe lo que observaste durante la auditoría').fill(entrada7)
await p.getByRole('button', { name: 'Analizar con IA' }).click()
await p.getByText('Buscando criterios aplicables…').waitFor()
ok(true, 'muestra los pasos del análisis mientras espera')
await p.screenshot({ path: `${CAPTURAS}05-analizando.png` })
await p.getByText('Se detectaron 2 situaciones distintas; se guardarán por separado.').waitFor({ timeout: 10000 })
ok(true, 'caso 7: dos situaciones distintas, con el aviso')
ok((await p.locator('section[aria-live="polite"] article').count()) === 2, 'dos tarjetas de resultado')
ok(await p.getByText('No conformidad', { exact: true }).first().isVisible() && await p.getByText('Fortaleza', { exact: true }).first().isVisible(), 'badges con texto: No conformidad y Fortaleza')
ok(await p.getByText(/Se marcaron fechas o cifras/).isVisible(), 'muestra el aviso de V6 (fecha por confirmar)')
await p.screenshot({ path: `${CAPTURAS}06-resultado.png`, fullPage: true })

// Chip de criterio → modal con el texto del numeral
await p.getByRole('button', { name: /NTC-ISO 9001:2015 · 8\.5\.1/ }).click()
await p.getByRole('dialog').getByText(/Texto del numeral 8\.5\.1/).waitFor()
ok(true, 'el chip abre el texto completo del numeral')
await p.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).first().click()

// Edición en el sitio
const nuevoTexto = 'Durante la inspección al área de Urgencias se evidenció un extintor con fecha de recarga vencida, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 8.5.1, literal d), sobre la infraestructura adecuada.'
await p.getByRole('button', { name: /^Hallazgo corregido: Durante la auditoría/ }).click()
await p.locator('section[aria-live="polite"] textarea').first().fill(nuevoTexto)
await p.getByRole('button', { name: 'Aplicar' }).click()
ok(await p.getByText(nuevoTexto).isVisible(), 'edición en el sitio del hallazgo corregido')
await p.getByText('Ver texto original del auditor').click()
ok(await p.locator('details[open] p').getByText(entrada7, { exact: true }).isVisible(), 'el texto original del auditor sigue disponible')
const antes = peticiones.length
await p.getByRole('button', { name: 'Guardar hallazgos' }).click()
await p.waitForURL(`${BASE}/app/auditorias/${A1}`)
const parches = peticiones.slice(antes).filter((x) => x.metodo === 'PATCH' && x.tabla === 'hallazgos')
ok(parches.length === 2 && parches.every((x) => x.cuerpo.estado === 'confirmado'), 'guardar confirma los dos hallazgos')
ok(parches.some((x) => x.cuerpo.hallazgo_corregido === nuevoTexto) && parches.filter((x) => 'hallazgo_corregido' in x.cuerpo).length === 1, 'solo se envía el campo realmente editado')
ok(!parches.some((x) => 'entrada_auditor' in x.cuerpo), 'nunca se envía la entrada original')
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

const [descargaDocx] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: 'Word' }).click()])
const rutaDocx = `${CAPTURAS}${descargaDocx.suggestedFilename()}`
await descargaDocx.saveAs(rutaDocx)
ok(/^Informe_AI-2026-001_\d{8}\.docx$/.test(descargaDocx.suggestedFilename()), `nombre del Word: ${descargaDocx.suggestedFilename()}`)
const xml = execSync(`unzip -p "${rutaDocx}" word/document.xml`).toString()
ok(/Observaciones/.test(xml) && /Ñáñez/.test(xml) && /Heading1|Ttulo1|Título 1/.test(xml), 'el Word tiene tildes y encabezados nativos (Heading 1)')
ok(/instrText[^>]*>TOC [^<]*\\o/.test(xml), 'el Word incluye la tabla de contenido automática')
ok(/w:shd [^>]*w:fill="FEF2F2"/.test(xml), 'filas coloreadas según la clasificación')

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
