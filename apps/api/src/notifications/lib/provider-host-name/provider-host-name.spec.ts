import { describe, expect, it } from "vitest";

import { toProviderHostName } from "./provider-host-name";

describe(toProviderHostName.name, () => {
  it("strips the scheme and the port from a host uri", () => {
    expect(toProviderHostName("https://provider.akt.sies.com.gt:8443")).toBe("provider.akt.sies.com.gt");
  });

  it("keeps a host uri that carries no scheme", () => {
    expect(toProviderHostName("provider.akt.sies.com.gt:8443")).toBe("provider.akt.sies.com.gt:8443");
  });

  it("keeps a host uri that is not a url at all", () => {
    expect(toProviderHostName('<script>alert("xss")</script>')).toBe('<script>alert("xss")</script>');
  });
});
