import { describe, expect, it } from "vitest";

import { isPinned, parseImageReference } from "./image-reference";

describe(parseImageReference.name, () => {
  it.each([
    { image: "nginx", expected: { repository: "nginx" } },
    { image: "nginx:1.27.2", expected: { repository: "nginx", tag: "1.27.2" } },
    { image: "  nginx:1.27.2  ", expected: { repository: "nginx", tag: "1.27.2" } },
    { image: "Acme/Web:V2", expected: { repository: "acme/web", tag: "V2" } },
    { image: "docker.io/library/nginx:1.27", expected: { repository: "nginx", tag: "1.27" } },
    { image: "index.docker.io/library/redis", expected: { repository: "redis" } },
    { image: "docker.io/acme/web:2", expected: { repository: "acme/web", tag: "2" } },
    { image: "ghcr.io/acme/library/web:2", expected: { repository: "acme/library/web", tag: "2" } },
    { image: "ghcr.io/open-webui/open-webui:0.4.8", expected: { repository: "open-webui/open-webui", tag: "0.4.8" } },
    { image: "localhost:5000/web", expected: { repository: "web" } },
    { image: "localhost/web:3", expected: { repository: "web", tag: "3" } },
    { image: "registry.example.com:5000/team/web:3", expected: { repository: "team/web", tag: "3" } },
    { image: "acme/web", expected: { repository: "acme/web" } },
    { image: "library/web", expected: { repository: "library/web" } },
    { image: "nginx:", expected: { repository: "nginx" } },
    {
      image: "nginx@sha256:0123456789abcdef",
      expected: { repository: "nginx", digest: "sha256:0123456789abcdef" }
    },
    {
      image: "ghcr.io/acme/web:2@sha256:0123456789abcdef",
      expected: { repository: "acme/web", tag: "2", digest: "sha256:0123456789abcdef" }
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
