import { describe, expect, it } from "vitest";

import { parseAbsoluteUrl, toLoadableUserContentImageUrl, USER_CONTENT_IMAGE_SOURCES } from "./userContentImageSources";

describe(toLoadableUserContentImageUrl.name, () => {
  it.each([
    "https://raw.githubusercontent.com/akash-network/console/main/logo.png",
    "https://user-images.githubusercontent.com/1/2-3.png",
    "https://avatars.githubusercontent.com/u/1?v=4",
    "https://camo.githubusercontent.com/abc/def",
    "https://img.shields.io/badge/akash-ready-red",
    "https://github.com/user-attachments/assets/0b0f5a4e-1111-2222-3333-444455556666",
    "https://github.com/akash-network/console/raw/main/logo.png",
    "https://github.com/akash-network/console/blob/main/logo.png?raw=true",
    "https://github.com/akash-network/console/assets/1/2"
  ])("loads %s", src => {
    expect(toLoadableUserContentImageUrl(src)).toBe(src);
  });

  it("returns the address the way the browser reads it", () => {
    expect(toLoadableUserContentImageUrl(" HTTPS://RAW.githubusercontent.com/a/b/../c.png ")).toBe("https://raw.githubusercontent.com/a/c.png");
  });

  it.each([
    ["another host", "https://attacker.example/pixel.gif"],
    ["a host that extends a listed one", "https://raw.githubusercontent.com.attacker.example/logo.png"],
    ["a host that ends with a listed one", "https://notraw.githubusercontent.com/logo.png"],
    ["a subdomain of a listed host", "https://cdn.img.shields.io/badge/a-b-red"],
    ["plain http", "http://raw.githubusercontent.com/a/b/main/logo.png"],
    ["a user name", "https://user@raw.githubusercontent.com/a/b/main/logo.png"],
    ["a password", "https://:secret@raw.githubusercontent.com/a/b/main/logo.png"],
    ["another port", "https://raw.githubusercontent.com:8443/a/b/main/logo.png"],
    ["a path on this site", "/api/auth/logout"],
    ["no scheme", "//raw.githubusercontent.com/a/b/main/logo.png"],
    ["a data address", "data:image/png;base64,AAAA"],
    ["a script address", "javascript:alert(1)"],
    ["a GitHub page that is not a file", "https://github.com/login/oauth/authorize?client_id=attacker"],
    ["a GitHub repository page", "https://github.com/akash-network/console"],
    ["a GitHub path that only contains a file path", "https://github.com/login?return_to=/a/b/raw/c.png"],
    ["a GitHub path that climbs out of a file path", "https://github.com/a/b/raw/../../../login/oauth/authorize"],
    ["a GitHub path with a file marker deeper down", "https://github.com/a/b/c/raw/logo.png"],
    ["a GitHub attachments path without a file", "https://github.com/user-attachments/assets"]
  ])("refuses %s", (_, src) => {
    expect(toLoadableUserContentImageUrl(src)).toBeUndefined();
  });

  it.each([undefined, null, 42, ["https://img.shields.io/badge/a-b-red"]])("refuses %j, which is not text", src => {
    expect(toLoadableUserContentImageUrl(src)).toBeUndefined();
  });

  it("lists only hosts by their exact name", () => {
    expect(USER_CONTENT_IMAGE_SOURCES.map(source => source.hostname)).toEqual([
      "raw.githubusercontent.com",
      "user-images.githubusercontent.com",
      "avatars.githubusercontent.com",
      "camo.githubusercontent.com",
      "github.com",
      "img.shields.io"
    ]);
  });
});

describe(parseAbsoluteUrl.name, () => {
  it("reads an address that names its scheme", () => {
    expect(parseAbsoluteUrl("mailto:team@akash.network")?.protocol).toBe("mailto:");
  });

  it.each(["/deployments", "#usage", "", "not an address"])("refuses %j, which has no scheme", value => {
    expect(parseAbsoluteUrl(value)).toBeUndefined();
  });
});
