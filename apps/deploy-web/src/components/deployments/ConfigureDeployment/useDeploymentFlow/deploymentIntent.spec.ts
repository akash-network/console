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
    expect(intent).toEqual({ templateId: "abc", sdlStrategy: "default", bidStrategy: "auto", dseq: undefined, draftId: undefined });
  });

  it("reads the draft id alongside the other params", () => {
    const intent = parseDeploymentIntent({
      dseqSegment: "12345",
      searchParams: new URLSearchParams("templateId=abc&draftId=draft-1")
    });
    expect(intent).toEqual({ templateId: "abc", sdlStrategy: "edit", bidStrategy: "select", dseq: "12345", draftId: "draft-1" });
  });

  it("leaves the draft id undefined when absent", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams() });
    expect(intent.draftId).toBeUndefined();
  });

  it("treats an empty draft id as missing", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("draftId=") });
    expect(intent.draftId).toBeUndefined();
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
