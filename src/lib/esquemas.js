// Esquemas de validación de formularios. Reflejan las restricciones CHECK de PostgreSQL
// (supabase/migrations/0001 y 0002) para que el error se muestre antes de llegar al servidor.
import { z } from 'zod'
import { PROCESOS, SISTEMAS } from './catalogos'
import { normalizarCedula, normalizarCelular } from './formato'

const texto = (min, mensaje) => z.string().trim().min(min, mensaje)

export const camposAuditor = {
  nombre_completo: texto(3, 'Escribe tu nombre completo'),
  cedula: z.preprocess(normalizarCedula, z.string().regex(/^\d{6,12}$/, 'La cédula debe tener entre 6 y 12 dígitos, sin puntos')),
  celular: z.preprocess(normalizarCelular, z.string().regex(/^\d{10}$/, 'El celular debe tener 10 dígitos')),
  cargo: texto(2, 'Escribe tu cargo'),
}

export const camposEquipoYAlcance = {
  equipo_auditor_nombre: texto(3, 'Escribe el nombre de la persona del equipo auditor'),
  equipo_auditor_cargo: texto(2, 'Escribe el cargo de la persona del equipo auditor'),
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

export const esquemaRegistro = z
  .object({
    email: z.string().trim().toLowerCase().email('Escribe un correo válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmacion: z.string(),
    ...camposAuditor,
    ...camposEquipoYAlcance,
  })
  .superRefine((d, ctx) => {
    if (d.password !== d.confirmacion) ctx.addIssue({ code: 'custom', path: ['confirmacion'], message: 'Las contraseñas no coinciden' })
    validarAlcance(d, ctx)
  })

export const esquemaPerfil = z.object({ ...camposAuditor, ...camposEquipoYAlcance }).superRefine(validarAlcance)

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
  if (clave.length >= 8) puntos++
  if (clave.length >= 12) puntos++
  if (/[a-z]/.test(clave) && /[A-Z]/.test(clave)) puntos++
  if (/\d/.test(clave) && /[^A-Za-z0-9]/.test(clave)) puntos++
  return Math.min(puntos, 4)
}
