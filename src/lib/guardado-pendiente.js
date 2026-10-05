// Guardados que deben terminar antes de cerrar la sesión: al salir, el token desaparece y lo que no se haya
// guardado se perdería. Las páginas con guardado automático (lista de verificación) registran aquí su función.
const guardados = new Set()

/** Registra una función de guardado; devuelve la función para quitarla. */
export function registrarGuardado(guardar) {
  guardados.add(guardar)
  return () => guardados.delete(guardar)
}

/** Ejecuta los guardados registrados; como mucho espera `limiteMs` para no bloquear el cierre de sesión. */
export async function guardarPendientes(limiteMs = 8000) {
  if (!guardados.size) return
  const todos = Promise.allSettled([...guardados].map((guardar) => guardar()))
  await Promise.race([todos, new Promise((resolver) => setTimeout(resolver, limiteMs))])
}
