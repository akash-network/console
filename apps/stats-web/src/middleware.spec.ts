import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "./middleware";

describe("middleware", () => {
  it("redirects to the requested relative path when leaving the maintenance page", () => {
    const { response } = setup({ path: "/maintenance?return=%2Fgraph%2Fdaily-akt-spent" });

    expect(response.headers.get("location")).toBe("http://localhost/graph/daily-akt-spent");
  });

  it("ignores an absolute return url when leaving the maintenance page", () => {
    const { response } = setup({ path: "/maintenance?return=https%3A%2F%2Fevil.example%2Fphish" });

    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("ignores a protocol relative return url when leaving the maintenance page", () => {
    const { response } = setup({ path: "/maintenance?return=%2F%2Fevil.example%2Fphish" });

    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("ignores a backslash prefixed return url when leaving the maintenance page", () => {
    const { response } = setup({ path: "/maintenance?return=%2F%5Cevil.example%2Fphish" });

    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  function setup(input: { path: string }) {
    const request = new NextRequest(new URL(`http://localhost${input.path}`));
    const response = middleware(request);
    return { request, response };
  }
});
