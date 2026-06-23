/**
 * Lowercases only the repository portion of a Docker image reference (registry +
 * path), leaving the tag and digest untouched since those are case-sensitive.
 * The tag/digest separator is the first `:` or `@` in the final path segment
 * (after the last `/`), so a `host:port` registry prefix is not mistaken for a tag.
 */
export function normalizeDockerImage(image: string): string {
  if (!image) return image;

  const lastSegmentStart = image.lastIndexOf("/") + 1;
  const prefix = image.slice(0, lastSegmentStart);
  const lastSegment = image.slice(lastSegmentStart);

  const separatorIndex = lastSegment.search(/[:@]/);
  if (separatorIndex === -1) {
    return (prefix + lastSegment).toLowerCase();
  }

  const repository = lastSegment.slice(0, separatorIndex);
  const tag = lastSegment.slice(separatorIndex);
  return (prefix + repository).toLowerCase() + tag;
}
