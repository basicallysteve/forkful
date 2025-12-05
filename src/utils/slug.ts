/**
 * Converts a string to a URL-friendly slug.
 * @param text - The text to convert to a slug
 * @returns A lowercase, hyphenated slug
 */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

/**
 * Finds an item in an array by its slug.
 * @param items - Array of items with name property
 * @param slug - The slug to search for
 * @returns The matching item or undefined
 */
export function findBySlug<T extends { name: string }>(items: T[], slug: string): T | undefined {
  return items.find(item => toSlug(item.name) === slug)
}
