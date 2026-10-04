/** Une clases condicionales: cx('a', falso && 'b', 'c') → 'a c'. */
export function cx(...clases) {
  return clases.filter(Boolean).join(' ')
}
