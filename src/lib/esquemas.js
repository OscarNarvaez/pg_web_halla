// Esquemas de validación de formularios. Reflejan las restricciones CHECK de PostgreSQL
// (supabase/migrations/0001 y 0002) para que el error se muestre antes de llegar al servidor.
import { z } from 'zod'
import { CARGOS_EQUIPO, CARGOS_LIDER, MAX_CARGOS, MAX_EQUIPO, PROCESOS, SISTEMAS } from './catalogos'
import { normalizarCedula, normalizarCelular } from './formato'

const texto = (min, mensaje) => z.string().trim().min(min, mensaje)

// Cargos de una lista cerrada (la misma de public.cargos_lider() y public.cargos_equipo(), migración 0009)
const reglaCargos = (lista, minimo) =>
  z
    .array(z.enum(lista, { error: 'Elige cargos de la lista' }))
    .min(1, minimo)
    .max(MAX_CARGOS, `Elige como máximo ${MAX_CARGOS} cargos`)

export const camposAuditor = {
  nombre_completo: texto(3, 'Escribe tu nombre completo'),
  cedula: z.preprocess(normalizarCedula, z.string().regex(/^\d{6,12}$/, 'La cédula debe tener entre 6 y 12 dígitos, sin puntos')),
  celular: z.preprocess(normalizarCelular, z.string().regex(/^\d{10}$/, 'El celular debe tener 10 dígitos')),
  cargos: reglaCargos(CARGOS_LIDER, 'Elige al menos uno de tus cargos'),
}

export const camposEquipoYAlcance = {
  equipo_auditor: z
    .array(z.object({
      nombre: texto(3, 'Escribe el nombre de la persona del equipo auditor'),
      cargos: reglaCargos(CARGOS_EQUIPO, 'Elige al menos un cargo para esta persona'),
    }))
    .min(1, 'Agrega al menos una persona al equipo auditor')
    .max(MAX_EQUIPO, `El equipo auditor admite como máximo ${MAX_EQUIPO} personas`),
  alcance: z.enum(['PROCESOS', 'SISTEMAS'], { error: 'Elige si auditas procesos o sistemas' }),
  proceso: z.string().optional().default(''),
  sistema: z.string().optional().default(''),
}

/** Exige proceso O sistema según el alcance, nunca ambos ni ninguno. */
export function validarAlcance(datos, ctx) {
  if (datos.alcance === 'PROCESOS' && !PROCESOS.includes(datos.proceso)) {
    ctx.addIssue({ code: 'custom', path: ['proceso'], message: 'Elige el proceso que auditas' })
  }
  if (datos.alcance === 'SISTEMAS' && !SISTEMAS.includes(datos.sistema)) {
    ctx.addIssue({ code: 'custom', path: ['sistema'], message: 'Elige el sistema que auditas' })
  }
}

// Política de contraseñas: la misma que exige Supabase Auth en el servidor (supabase/config.toml)
export const MINIMO_CLAVE = 10
export const reglaClave = z
  .string()
  .min(MINIMO_CLAVE, `La contraseña debe tener al menos ${MINIMO_CLAVE} caracteres`)
  .max(72, 'La contraseña no puede superar 72 caracteres')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
  .regex(/\d/, 'La contraseña debe incluir al menos un número')

// Autorización de tratamiento de datos personales (Ley 1581 de 2012): obligatoria
// (refine y no literal: así zod sigue evaluando las demás reglas y el usuario ve todos los errores juntos)
export const campoAutorizacion = {
  acepto_tratamiento_datos: z
    .boolean()
    .refine((v) => v === true, { message: 'Debes autorizar el tratamiento de tus datos personales para registrarte' }),
}

export const esquemaRegistro = z
  .object({
    email: z.string().trim().toLowerCase().email('Escribe un correo válido'),
    password: reglaClave,
    confirmacion: z.string(),
    ...camposAuditor,
    ...camposEquipoYAlcance,
    ...campoAutorizacion,
  })
  .superRefine((d, ctx) => {
    if (d.password !== d.confirmacion) ctx.addIssue({ code: 'custom', path: ['confirmacion'], message: 'Las contraseñas no coinciden' })
    validarAlcance(d, ctx)
  })

export const esquemaPerfil = z.object({ ...camposAuditor, ...camposEquipoYAlcance }).superRefine(validarAlcance)

// Completar el perfil (fallback) también exige la autorización de datos
export const esquemaCompletarPerfil = z.object({ ...camposAuditor, ...camposEquipoYAlcance, ...campoAutorizacion }).superRefine(validarAlcance)

export const esquemaIngreso = z.object({
  email: z.string().trim().toLowerCase().email('Escribe un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})

export const esquemaAuditoria = z
  .object({
    codigo: texto(3, 'Escribe el código de la auditoría'),
    titulo: texto(3, 'Escribe un título'),
    alcance: z.enum(['PROCESOS', 'SISTEMAS'], { error: 'Elige el alcance' }),
    proceso: z.string().optional().default(''),
    sistema: z.string().optional().default(''),
    objetivo: z.string().trim().optional().default(''),
    criterios: z.array(z.string()).default([]),
    area_auditada: z.string().trim().optional().default(''),
    auditado_nombre: z.string().trim().optional().default(''),
    auditado_cargo: z.string().trim().optional().default(''),
    fecha_inicio: z.string().optional().default(''),
    fecha_fin: z.string().optional().default(''),
  })
  .superRefine((d, ctx) => {
    validarAlcance(d, ctx)
    if (d.fecha_inicio && d.fecha_fin && d.fecha_fin < d.fecha_inicio) {
      ctx.addIssue({ code: 'custom', path: ['fecha_fin'], message: 'La fecha final no puede ser anterior a la inicial' })
    }
  })

/** Un perfil anterior a la 0009 puede no tener cargos o equipo completo: hay que completarlo en «Mi perfil». */
export function perfilIncompleto(p) {
  return Boolean(p) && (!p.cargos?.length || !p.equipo_auditor?.length || p.equipo_auditor.some((m) => !m?.nombre || !m?.cargos?.length))
}

/** Integrante vacío del equipo auditor, para el formulario. */
export const integranteVacio = () => ({ nombre: '', cargos: [] })

/** Convierte los valores del formulario a la fila de profiles/auditorias (proceso XOR sistema). */
export function aFilaAlcance(d) {
  return {
    alcance: d.alcance,
    proceso: d.alcance === 'PROCESOS' ? d.proceso : null,
    sistema: d.alcance === 'SISTEMAS' ? d.sistema : null,
  }
}

/** Fortaleza de la contraseña de 0 a 4. */
export function fuerzaClave(clave = '') {
  let puntos = 0
  if (clave.length >= MINIMO_CLAVE) puntos++
  if (clave.length >= 14) puntos++
  if (/[a-z]/.test(clave) && /[A-Z]/.test(clave)) puntos++
  if (/\d/.test(clave) && /[^A-Za-z0-9]/.test(clave)) puntos++
  return Math.min(puntos, 4)
}
