/**
 * Parses URLSearchParams into a typed options object using a per-key parser map.
 * Keys whose parser returns undefined are omitted from the result.
 * Reusable across any model that accepts query filter options.
 */
export function parseQueryOptions<T extends Record<string, unknown>>(
  params: URLSearchParams,
  parsers: { [K in keyof T]?: (value: string | null) => T[K] | undefined }
): Partial<T> {
  const result: Partial<T> = {}
  for (const key of Object.keys(parsers) as Array<keyof T>) {
    const parser = parsers[key]
    if (parser) {
      const val = parser(params.get(key as string))
      if (val !== undefined) {
        result[key] = val
      }
    }
  }
  return result
}
