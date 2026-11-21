import { describe, expect, it } from "vitest";

import { imageRepositoryOf, isPinned, parseImageReference } from "./image-reference";

describe(parseImageReference.name, () => {
  it.each([
    { image: "nginx", expected: { registry: "docker.io", repository: "nginx" } },
    { image: "nginx:1.27.2", expected: { registry: "docker.io", repository: "nginx", tag: "1.27.2" } },
    { image: "  nginx:1.27.2  ", expected: { registry: "docker.io", repository: "nginx", tag: "1.27.2" } },
    { image: "Acme/Web:V2", expected: { registry: "docker.io", repository: "acme/web", tag: "V2" } },
    { image: "docker.io/library/nginx:1.27", expected: { registry: "docker.io", repository: "nginx", tag: "1.27" } },
    { image: "index.docker.io/library/redis", expected: { registry: "docker.io", repository: "redis" } },
    { image: "docker.io/acme/web:2", expected: { registry: "docker.io", repository: "acme/web", tag: "2" } },
    { image: "ghcr.io/acme/library/web:2", expected: { registry: "ghcr.io", repository: "acme/library/web", tag: "2" } },
    { image: "ghcr.io/open-webui/open-webui:0.4.8", expected: { registry: "ghcr.io", repository: "open-webui/open-webui", tag: "0.4.8" } },
    { image: "localhost:5000/web", expected: { registry: "localhost:5000", repository: "web" } },
    { image: "localhost/web:3", expected: { registry: "localhost", repository: "web", tag: "3" } },
    { image: "registry.example.com:5000/team/web:3", expected: { registry: "registry.example.com:5000", repository: "team/web", tag: "3" } },
    { image: "registry-1.docker.io/library/nginx:1.27", expected: { registry: "docker.io", repository: "nginx", tag: "1.27" } },
    { image: "registry.hub.docker.com/acme/web", expected: { registry: "docker.io", repository: "acme/web" } },
    { image: "GHCR.io/Acme/Web:2", expected: { registry: "ghcr.io", repository: "acme/web", tag: "2" } },
    { image: "acme/web", expected: { registry: "docker.io", repository: "acme/web" } },
    { image: "library/web", expected: { registry: "docker.io", repository: "web" } },
    { image: "library/web:2", expected: { registry: "docker.io", repository: "web", tag: "2" } },
    { image: "library/acme/web", expected: { registry: "docker.io", repository: "library/acme/web" } },
    { image: "docker.io/library/acme/web", expected: { registry: "docker.io", repository: "library/acme/web" } },
    { image: "libraryx/web", expected: { registry: "docker.io", repository: "libraryx/web" } },
    { image: "acme/library/web", expected: { registry: "docker.io", repository: "acme/library/web" } },
    { image: "nginx:", expected: { registry: "docker.io", repository: "nginx" } },
    {
      image: "nginx@sha256:0123456789abcdef",
      expected: { registry: "docker.io", repository: "nginx", digest: "sha256:0123456789abcdef" }
    },
    {
      image: "ghcr.io/acme/web:2@sha256:0123456789abcdef",
      expected: { registry: "ghcr.io", repository: "acme/web", tag: "2", digest: "sha256:0123456789abcdef" }
    }
  ])("reads $image", ({ image, expected }) => {
    expect(parseImageReference(image)).toEqual(expected);
  });
});

describe(isPinned.name, () => {
  it.each([
    { image: "nginx:1.27.2", pinned: true },
    { image: "nginx:stable", pinned: true },
    { image: "nginx", pinned: false },
    { image: "nginx:latest", pinned: false },
    { image: "nginx:LATEST", pinned: false },
    { image: "registry.example.com:5000/web", pinned: false },
    { image: "nginx@sha256:0123456789abcdef", pinned: true },
    { image: "nginx:latest@sha256:0123456789abcdef", pinned: true }
  ])("answers $pinned for $image", ({ image, pinned }) => {
    expect(isPinned(parseImageReference(image))).toBe(pinned);
  });
});

describe(imageRepositoryOf.name, () => {
  it.each([
    { image: "nginx:1.27", repository: "docker.io/nginx" },
    { image: "docker.io/library/nginx:1.28", repository: "docker.io/nginx" },
    { image: "library/nginx:1.28", repository: "docker.io/nginx" },
    { image: "registry-1.docker.io/library/nginx@sha256:0123456789abcdef", repository: "docker.io/nginx" },
    { image: "acme/nginx:1.27", repository: "docker.io/acme/nginx" },
    { image: "ghcr.io/acme/nginx:1.27", repository: "ghcr.io/acme/nginx" },
    { image: "quay.io/acme/nginx", repository: "quay.io/acme/nginx" },
    { image: "registry.example.com:5000/acme/nginx:1", repository: "registry.example.com:5000/acme/nginx" }
  ])("names $repository for $image", ({ image, repository }) => {
    expect(imageRepositoryOf(image)).toBe(repository);
  });
});
