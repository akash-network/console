import { describe, expect, it } from "vitest";

import { parseDeploymentIntent } from "./deploymentIntent";

describe(parseDeploymentIntent.name, () => {
  it("defaults strategies when params are absent", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams() });
    expect(intent).toEqual({ templateId: undefined, sdlStrategy: "edit", bidStrategy: "select", dseq: undefined });
  });

  it("reads templateId and both strategies", () => {
    const intent = parseDeploymentIntent({
      dseqSegment: undefined,
      searchParams: new URLSearchParams("templateId=abc&sdl-strategy=default&bid-strategy=auto")
    });
    expect(intent).toEqual({ templateId: "abc", sdlStrategy: "default", bidStrategy: "auto", dseq: undefined });
  });

  it("ignores sdl-strategy when no templateId is present", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("sdl-strategy=default") });
    expect(intent.sdlStrategy).toBe("edit");
  });

  it("takes dseq from the route segment", () => {
    const intent = parseDeploymentIntent({ dseqSegment: "12345", searchParams: new URLSearchParams() });
    expect(intent.dseq).toBe("12345");
  });

  it("falls back to defaults for unknown strategy values", () => {
    const intent = parseDeploymentIntent({
      dseqSegment: undefined,
      searchParams: new URLSearchParams("templateId=abc&sdl-strategy=nonsense&bid-strategy=nope")
    });
    expect(intent.sdlStrategy).toBe("edit");
    expect(intent.bidStrategy).toBe("select");
  });
});
