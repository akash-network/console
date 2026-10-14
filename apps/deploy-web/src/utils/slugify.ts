/** The slug rule organizations and projects share: lowercase, runs of anything but `a-z0-9` become one hyphen, trimmed of hyphens and cut to `maxLength`. */
export function slugify(value: string, maxLength: number): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}
