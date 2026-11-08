import { describe, expect, it } from "vitest";

import { parseDeploymentIntent } from "./deploymentIntent";

describe(parseDeploymentIntent.name, () => {
  it("defaults strategies when params are absent", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams() });
    expect(intent).toEqual({ templateId: undefined, sdlStrategy: "edit", bidStrategy: "select", dseq: undefined, vm: false, exampleImage: false });
  });

  it("reads templateId and both strategies", () => {
    const intent = parseDeploymentIntent({
      dseqSegment: undefined,
      searchParams: new URLSearchParams("templateId=abc&sdl-strategy=default&bid-strategy=auto")
    });
    expect(intent).toEqual({
      templateId: "abc",
      sdlStrategy: "default",
      bidStrategy: "auto",
      dseq: undefined,
      draftId: undefined,
      vm: false,
      exampleImage: false
    });
  });

  it("reads the draft id alongside the other params", () => {
    const intent = parseDeploymentIntent({
      dseqSegment: "12345",
      searchParams: new URLSearchParams("templateId=abc&draftId=draft-1")
    });
    expect(intent).toEqual({
      templateId: "abc",
      sdlStrategy: "edit",
      bidStrategy: "select",
      dseq: "12345",
      draftId: "draft-1",
      vm: false,
      exampleImage: false
    });
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

  it("parses vm=true as a container-vm entry", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("vm=true") });
    expect(intent.vm).toBe(true);
  });

  it("treats anything but vm=true as a non-vm entry", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("vm=1") });
    expect(intent.vm).toBe(false);
  });

  it("drops templateId and forces the edit strategy on a vm entry", () => {
    const intent = parseDeploymentIntent({
      dseqSegment: undefined,
      searchParams: new URLSearchParams("vm=true&templateId=abc&sdl-strategy=default")
    });
    expect(intent.templateId).toBeUndefined();
    expect(intent.sdlStrategy).toBe("edit");
    expect(intent.vm).toBe(true);
  });

  it("reads a user template id", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("userTemplateId=user-1") });
    expect(intent.userTemplateId).toBe("user-1");
    expect(intent.templateId).toBeUndefined();
    expect(intent.sdlStrategy).toBe("edit");
  });

  it("treats an empty user template id as missing", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("userTemplateId=") });
    expect(intent.userTemplateId).toBeUndefined();
  });

  it("drops the user template id on a vm entry", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("vm=true&userTemplateId=user-1") });
    expect(intent.userTemplateId).toBeUndefined();
    expect(intent.vm).toBe(true);
  });

  it("parses exampleImage=true as an example image entry", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("exampleImage=true") });
    expect(intent.exampleImage).toBe(true);
  });

  it("treats anything but exampleImage=true as a blank entry", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("exampleImage=1") });
    expect(intent.exampleImage).toBe(false);
  });

  it("drops the example image on a vm entry", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("vm=true&exampleImage=true") });
    expect(intent.exampleImage).toBe(false);
    expect(intent.vm).toBe(true);
  });

  it("prefers a gallery template id over a user template id", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("templateId=abc&userTemplateId=user-1") });
    expect(intent.templateId).toBe("abc");
    expect(intent.userTemplateId).toBeUndefined();
  });
  it("reads the template mode and drops the deploy-only params", () => {
    const intent = parseDeploymentIntent({
      dseqSegment: undefined,
      searchParams: new URLSearchParams(
        "templateMode=edit&userTemplateId=tpl-9&draftId=draft-1&templateId=abc&sdl-strategy=default&bid-strategy=auto&vm=true&exampleImage=true"
      )
    });

    expect(intent).toEqual({
      templateMode: "edit",
      userTemplateId: "tpl-9",
      draftId: "draft-1",
      sdlStrategy: "edit",
      bidStrategy: "select",
      dseq: undefined,
      vm: false,
      exampleImage: false
    });
  });

  it("falls back to a new template when edit mode names no template", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("templateMode=edit&userTemplateId=") });

    expect(intent.templateMode).toBe("new");
    expect(intent.userTemplateId).toBeUndefined();
  });

  it("reads the template a new template is copied from", () => {
    const intent = parseDeploymentIntent({
      dseqSegment: undefined,
      searchParams: new URLSearchParams("templateMode=new&copyFromTemplateId=tpl-1&copyFromVersion=3")
    });

    expect(intent).toMatchObject({ templateMode: "new", copyFromTemplateId: "tpl-1", copyFromVersion: 3 });
  });

  it.each(["", "0", "-1", "1.5", "two", "1e3"])("drops a copy naming the unusable version %j", version => {
    const intent = parseDeploymentIntent({
      dseqSegment: undefined,
      searchParams: new URLSearchParams(`templateMode=new&copyFromTemplateId=tpl-1&copyFromVersion=${version}`)
    });

    expect(intent.copyFromTemplateId).toBeUndefined();
    expect(intent.copyFromVersion).toBeUndefined();
  });

  it("drops a copy that names no template", () => {
    const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("templateMode=new&copyFromVersion=2") });

    expect(intent.copyFromTemplateId).toBeUndefined();
    expect(intent.copyFromVersion).toBeUndefined();
  });

  it("ignores a copy outside new template mode", () => {
    const edit = parseDeploymentIntent({
      dseqSegment: undefined,
      searchParams: new URLSearchParams("templateMode=edit&userTemplateId=tpl-9&copyFromTemplateId=tpl-1&copyFromVersion=3")
    });
    const deploy = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("copyFromTemplateId=tpl-1&copyFromVersion=3") });

    expect(edit.copyFromTemplateId).toBeUndefined();
    expect(deploy.copyFromTemplateId).toBeUndefined();
    expect(deploy.copyFromVersion).toBeUndefined();
  });

  it("opens no template mode for an unknown value", () => {
    const intent = parseDeploymentIntent({
      dseqSegment: undefined,
      searchParams: new URLSearchParams("templateMode=publish&templateId=abc&sdl-strategy=default")
    });

    expect(intent.templateMode).toBeUndefined();
    expect(intent.templateId).toBe("abc");
    expect(intent.sdlStrategy).toBe("default");
  });
});
