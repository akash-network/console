export type ImageReference = {
  /** Lowercased, with every Docker Hub alias read as `docker.io`, which is also what an image naming no registry means. */
  registry: string;
  /** Lowercased, without the registry host, the tag or the digest, and without the `library/` Docker Hub puts before an official image. */
  repository: string;
  tag?: string;
  digest?: string;
};

export const DOCKER_HUB_REGISTRY = "docker.io";

const OFFICIAL_PREFIX = "library/";

const DOCKER_HUB_HOSTS = new Set([DOCKER_HUB_REGISTRY, "index.docker.io", "registry-1.docker.io", "registry.hub.docker.com"]);

export function parseImageReference(image: string): ImageReference {
  const [withoutDigest, digest] = splitOnce(image.trim(), "@");
  const lastSlash = withoutDigest.lastIndexOf("/");
  const tagSeparator = withoutDigest.indexOf(":", lastSlash + 1);
  const path = tagSeparator === -1 ? withoutDigest : withoutDigest.slice(0, tagSeparator);
  const tag = tagSeparator === -1 ? "" : withoutDigest.slice(tagSeparator + 1);

  return {
    ...splitRegistry(path.toLowerCase()),
    ...(tag && { tag }),
    ...(digest && { digest })
  };
}

/** Only a digest names content that cannot change; among tags, a missing one and `latest` both follow whatever was pushed last. */
export function isPinned({ tag, digest }: ImageReference): boolean {
  return !!digest || (!!tag && tag.toLowerCase() !== "latest");
}

/** Two images are the same repository only when the same registry serves them, since the same path elsewhere belongs to whoever registered it there. */
export function imageRepositoryOf(image: string): string {
  const { registry, repository } = parseImageReference(image);

  return `${registry}/${repository}`;
}

function splitOnce(text: string, separator: string): [string, string] {
  const index = text.indexOf(separator);

  return index === -1 ? [text, ""] : [text.slice(0, index), text.slice(index + 1)];
}

/** Docker reads a first path segment as a registry host only when it has a dot or a port, or is `localhost`. */
function splitRegistry(path: string): Pick<ImageReference, "registry" | "repository"> {
  const [first, rest] = splitOnce(path, "/");

  const namesRegistry = !!rest && (first.includes(".") || first.includes(":") || first === "localhost");

  if (!namesRegistry) return { registry: DOCKER_HUB_REGISTRY, repository: withoutOfficialPrefix(path) };
  if (!DOCKER_HUB_HOSTS.has(first)) return { registry: first, repository: rest };

  return { registry: DOCKER_HUB_REGISTRY, repository: withoutOfficialPrefix(rest) };
}

/** Docker Hub serves `library/nginx` and `nginx` as one repository, while a deeper path under `library/` is a repository of its own. */
function withoutOfficialPrefix(repository: string): string {
  const name = repository.startsWith(OFFICIAL_PREFIX) ? repository.slice(OFFICIAL_PREFIX.length) : repository;

  return name.includes("/") ? repository : name;
}
