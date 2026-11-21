export type ImageReference = {
  /** Lowercased, without the registry host, the tag or the digest, and without Docker Hub's implicit `library/`. */
  repository: string;
  tag?: string;
  digest?: string;
};

const DOCKER_HUB_HOSTS = new Set(["docker.io", "index.docker.io", "registry-1.docker.io", "registry.hub.docker.com"]);

export function parseImageReference(image: string): ImageReference {
  const [withoutDigest, digest] = splitOnce(image.trim(), "@");
  const lastSlash = withoutDigest.lastIndexOf("/");
  const tagSeparator = withoutDigest.indexOf(":", lastSlash + 1);
  const path = tagSeparator === -1 ? withoutDigest : withoutDigest.slice(0, tagSeparator);
  const tag = tagSeparator === -1 ? "" : withoutDigest.slice(tagSeparator + 1);

  return {
    repository: withoutRegistry(path.toLowerCase()),
    ...(tag && { tag }),
    ...(digest && { digest })
  };
}

/** Only a digest names content that cannot change; among tags, a missing one and `latest` both follow whatever was pushed last. */
export function isPinned({ tag, digest }: ImageReference): boolean {
  return !!digest || (!!tag && tag.toLowerCase() !== "latest");
}

function splitOnce(text: string, separator: string): [string, string] {
  const index = text.indexOf(separator);

  return index === -1 ? [text, ""] : [text.slice(0, index), text.slice(index + 1)];
}

/** Docker reads a first path segment as a registry host only when it has a dot or a port, or is `localhost`. */
function withoutRegistry(path: string): string {
  const [first, rest] = splitOnce(path, "/");

  if (!rest || !(first.includes(".") || first.includes(":") || first === "localhost")) return path;

  return DOCKER_HUB_HOSTS.has(first) && rest.startsWith("library/") ? rest.slice("library/".length) : rest;
}
