// Comprueba que supabase/functions/_shared/prompt-sistema-experto.ts es el ANEXO A LITERAL del
// prompt maestro. Si alguien lo «optimiza», esta verificación falla.
// Uso: pnpm verificar:prompt
import { readFileSync } from 'node:fs'
import { PROMPT_SISTEMA_EXPERTO } from '../supabase/functions/_shared/prompt-sistema-experto.ts'

const fuente = readFileSync(new URL('../PROMPT_CLAUDE_CODE_HALLA.md', import.meta.url), 'utf8')
const inicioAnexo = fuente.indexOf('# ANEXO A')
const a = fuente.indexOf('```text\n', inicioAnexo) + '```text\n'.length
const b = fuente.indexOf('\n```\n', a)
const anexo = fuente.slice(a, b)

if (anexo === PROMPT_SISTEMA_EXPERTO) {
  console.log(`✓ El prompt del sistema es el ANEXO A literal (${anexo.length} caracteres, ${anexo.split('\n').length} líneas)`)
  process.exit(0)
}
const lineasA = anexo.split('\n')
const lineasB = PROMPT_SISTEMA_EXPERTO.split('\n')
const i = lineasA.findIndex((l, k) => l !== lineasB[k])
console.error(`✗ El prompt del sistema difiere del ANEXO A en la línea ${i + 1}:\n  anexo: ${lineasA[i]}\n  código: ${lineasB[i]}`)
process.exit(1)
