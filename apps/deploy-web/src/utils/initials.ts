/** Up to two initials of a name, one per word, for an avatar without a picture. */
export function initialsOf(name: string): string {
  return name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join("");
}
