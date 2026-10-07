type ClassValue = string | number | null | undefined | false | Record<string, boolean>

/** Tiny classnames helper (no external dependency). */
export const clsx = (...args: ClassValue[]): string => {
  const out: string[] = []
  for (const arg of args) {
    if (!arg) continue
    if (typeof arg === 'string' || typeof arg === 'number') {
      out.push(String(arg))
    } else if (typeof arg === 'object') {
      for (const key in arg) {
        if (arg[key]) out.push(key)
      }
    }
  }
  return out.join(' ')
}
