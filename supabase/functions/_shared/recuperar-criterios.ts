// Recuperación de criterios normativos con la búsqueda de texto completo de PostgreSQL.
// La stopwords y el diccionario de sinónimos vienen del Primer_prototipo (Main.dc.html, líneas 714 y 750).

import { documentosParaAlcance } from './catalogos.ts'

export interface Criterio {
  id: string
  documento_codigo: string
  numeral: string | null
  titulo: string
  contenido: string
  idioma: string
  puntaje: number
}

// Palabras vacías del español (además de las que ya quita la configuración de búsqueda)
const STOP = new Set(
  ('a al algo ante bajo con contra de del desde e el ella ellos en entre es esta este esto estos fue ha han hay la las le les lo los mas me mi muy no o para pero por que se sea segun ser si sin sobre son su sus te tu un una uno unos unas y ya como cuando donde tambien ese esa asi cada todo toda todos todas sido estan estar debe deben debera deberan puede pueden cual cuales sera seran haya hayan mediante dicho dicha dichos dichas ello nos otro otra otros otras solo aun cuyo cuya entonces mismo misma parte partes ' +
    // términos de la jerga del auditor que no ayudan a encontrar el requisito
    'evidencio evidencia evidencian evidenciaron encontro encontraron observo observa reviso revisaron reviso se encontro algunos algunas ellas ellos actualmente durante realiza realizan realizo cuenta tiene tienen').split(/\s+/),
)
// Operadores de websearch_to_tsquery que no deben colarse desde el texto del auditor
const OPERADORES = new Set(['or', 'and', 'not'])

// Sinónimos frecuentes en el hospital → vocabulario de las normas (solo amplían la búsqueda)
const SYN: Record<string, string> = {
  paciente: 'cliente usuario', pacientes: 'cliente usuario', usuario: 'cliente', usuarios: 'cliente', familia: 'cliente partes interesadas',
  atencion: 'servicio prestacion', trato: 'satisfaccion cliente', queja: 'retroalimentacion satisfaccion cliente', quejas: 'retroalimentacion satisfaccion cliente', reclamo: 'retroalimentacion satisfaccion cliente', pqrs: 'retroalimentacion satisfaccion cliente',
  capacitacion: 'competencia formacion toma conciencia', capacitaciones: 'competencia formacion toma conciencia', induccion: 'competencia toma conciencia', entrenamiento: 'competencia formacion',
  registro: 'informacion documentada conservar', registros: 'informacion documentada conservar', registrada: 'informacion documentada', registrado: 'informacion documentada', formato: 'informacion documentada', formatos: 'informacion documentada', acta: 'informacion documentada', actas: 'informacion documentada', archivo: 'informacion documentada control', documento: 'informacion documentada', documentos: 'informacion documentada', historia: 'informacion documentada registros', historias: 'informacion documentada registros', firmas: 'informacion documentada', diligenciado: 'informacion documentada',
  equipo: 'recursos seguimiento medicion', equipos: 'recursos seguimiento medicion', calibracion: 'medicion trazabilidad', mantenimiento: 'infraestructura', instalaciones: 'infraestructura', limpieza: 'ambiente operacion procesos', aseo: 'ambiente operacion procesos', parqueadero: 'infraestructura',
  residuos: 'ambiental aspectos ambientales', reciclaje: 'ambiental aspectos ambientales', agua: 'ambiental', energia: 'ambiental',
  trabajador: 'trabajadores personas', trabajadores: 'trabajadores personas', personal: 'personas trabajadores', colaboradores: 'personas trabajadores', funcionarios: 'personas trabajadores',
  accidente: 'incidentes', accidentes: 'incidentes', emergencia: 'emergencias preparacion respuesta', emergencias: 'preparacion respuesta', evacuacion: 'emergencias preparacion respuesta', extintor: 'emergencias preparacion respuesta', extintores: 'emergencias preparacion respuesta', epp: 'peligros controles', riesgo: 'riesgos oportunidades', riesgos: 'riesgos oportunidades',
  indicador: 'seguimiento medicion analisis evaluacion', indicadores: 'seguimiento medicion analisis evaluacion', meta: 'objetivos', metas: 'objetivos',
  proveedor: 'proveedores externos', proveedores: 'proveedores externos', compras: 'proveedores externos suministrados', contrato: 'proveedores externos',
  gerencia: 'alta direccion liderazgo', directivos: 'alta direccion liderazgo', comite: 'revision direccion', politica: 'politica', socializacion: 'comunicacion toma conciencia', divulgacion: 'comunicacion',
  auditoria: 'auditoria interna', plan: 'planificacion', mejoramiento: 'mejora continua accion correctiva', correctiva: 'no conformidad accion correctiva',
  protocolo: 'informacion documentada operacion', protocolos: 'informacion documentada operacion', procedimiento: 'informacion documentada', vencido: 'mantenimiento control', vencida: 'mantenimiento control',
}

export function quitarTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Convierte el texto libre del auditor en una consulta «a or b or c» para websearch_to_tsquery.
 * Exigir todas las palabras (Y) no recuperaría nada a partir de un párrafo.
 */
export function construirConsulta(entrada: string, objetoAuditado?: string | null, maxTerminos = 32): string {
  const base = quitarTildes(`${entrada} ${objetoAuditado ?? ''}`.toLowerCase())
  const palabras = base.split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !STOP.has(w) && !OPERADORES.has(w) && !/^\d+$/.test(w))
  const terminos: string[] = []
  const vistos = new Set<string>()
  const agregar = (w: string) => {
    if (!vistos.has(w) && !STOP.has(w) && !OPERADORES.has(w)) {
      vistos.add(w)
      terminos.push(w)
    }
  }
  for (const w of palabras) agregar(w)
  for (const w of palabras) if (SYN[w]) SYN[w].split(' ').forEach(agregar)
  return terminos.slice(0, maxTerminos).join(' or ')
}

export type BuscarCriterios = (consulta: string, documentos: string[] | null, limite: number) => Promise<Criterio[]>

/**
 * Recupera los criterios aplicables: primero filtrando por los documentos del alcance; si no hay
 * resultados, sin filtro; si sigue vacío, devuelve [] y la IA deberá usar el marcador pendiente.
 */
export async function recuperarCriterios(
  buscar: BuscarCriterios,
  opciones: { entrada: string; alcance: string; proceso?: string | null; sistema?: string | null; limite?: number },
): Promise<{ criterios: Criterio[]; consulta: string; filtrado: boolean }> {
  const objeto = opciones.alcance === 'SISTEMAS' ? opciones.sistema : opciones.proceso
  const consulta = construirConsulta(opciones.entrada, objeto)
  const limite = opciones.limite ?? 12
  if (!consulta) return { criterios: [], consulta, filtrado: false }

  const documentos = documentosParaAlcance(opciones.alcance, opciones.sistema)
  const filtrados = await buscar(consulta, documentos.length ? documentos : null, limite)
  if (filtrados.length) return { criterios: filtrados, consulta, filtrado: true }

  const todos = await buscar(consulta, null, limite)
  return { criterios: todos, consulta, filtrado: false }
}
