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
  describe("with template mode enabled", () => {
    it("reads the template mode and drops the deploy-only params", () => {
      const intent = parseTemplateUrl(
        "templateMode=edit&userTemplateId=tpl-9&draftId=draft-1&templateId=abc&sdl-strategy=default&bid-strategy=auto&vm=true&exampleImage=true",
        "777"
      );

      expect(intent).toEqual({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        draftId: "draft-1",
        sdlStrategy: "edit",
        bidStrategy: "select",
        vm: false,
        exampleImage: false
      });
      expect(intent).not.toHaveProperty("dseq");
    });

    it("falls back to a new template when edit mode names no template", () => {
      const intent = parseTemplateUrl("templateMode=edit&userTemplateId=&baseVersion=3");

      expect(intent.templateMode).toBe("new");
      expect(intent.userTemplateId).toBeUndefined();
      expect(intent.baseVersion).toBeUndefined();
    });

    it("pins the version an edit started from", () => {
      expect(parseTemplateUrl("templateMode=edit&userTemplateId=tpl-9&baseVersion=4")).toMatchObject({ templateMode: "edit", baseVersion: 4 });
    });

    it.each(["", "0", "-1", "1.5", "four"])("pins no base version for %j", version => {
      expect(parseTemplateUrl(`templateMode=edit&userTemplateId=tpl-9&baseVersion=${version}`)).not.toHaveProperty("baseVersion");
    });

    it("reads the template a new template is copied from", () => {
      expect(parseTemplateUrl("templateMode=new&copyFromTemplateId=tpl-1&copyFromVersion=3")).toMatchObject({
        templateMode: "new",
        copyFromTemplateId: "tpl-1",
        copyFromVersion: 3
      });
    });

    it.each(["", "0", "-1", "1.5", "two", "1e3"])("drops a copy naming the unusable version %j", version => {
      const intent = parseTemplateUrl(`templateMode=new&copyFromTemplateId=tpl-1&copyFromVersion=${version}`);

      expect(intent.copyFromTemplateId).toBeUndefined();
      expect(intent.copyFromVersion).toBeUndefined();
    });

    it("drops a copy that names no template", () => {
      const intent = parseTemplateUrl("templateMode=new&copyFromVersion=2");

      expect(intent.copyFromTemplateId).toBeUndefined();
      expect(intent.copyFromVersion).toBeUndefined();
    });

    it("reads the deployment a new template is saved from", () => {
      expect(parseTemplateUrl("templateMode=new&draftId=d1&sourceDseq=1234")).toMatchObject({ templateMode: "new", sourceDseq: "1234" });
    });

    it.each(["", "abc", "12a"])("drops the unusable source deployment %j", dseq => {
      expect(parseTemplateUrl(`templateMode=new&sourceDseq=${dseq}`)).not.toHaveProperty("sourceDseq");
    });

    it("keeps the copy, base version and source of the other mode out", () => {
      const edit = parseTemplateUrl("templateMode=edit&userTemplateId=tpl-9&copyFromTemplateId=tpl-1&copyFromVersion=3&sourceDseq=12");
      const created = parseTemplateUrl("templateMode=new&userTemplateId=tpl-9&baseVersion=4");

      expect(edit).not.toHaveProperty("copyFromTemplateId");
      expect(edit).not.toHaveProperty("sourceDseq");
      expect(created).not.toHaveProperty("baseVersion");
      expect(created.userTemplateId).toBeUndefined();
    });

    it("opens no template mode for an unknown value", () => {
      const intent = parseTemplateUrl("templateMode=publish&templateId=abc&sdl-strategy=default");

      expect(intent.templateMode).toBeUndefined();
      expect(intent.templateId).toBe("abc");
      expect(intent.sdlStrategy).toBe("default");
    });
  });

  describe("when deploying a template version", () => {
    it("reads the version a user template deploys from", () => {
      expect(parseTemplateUrl("userTemplateId=tpl-9&templateVersion=3")).toEqual({
        templateId: undefined,
        userTemplateId: "tpl-9",
        templateVersion: 3,
        sdlStrategy: "edit",
        bidStrategy: "select",
        dseq: undefined,
        draftId: undefined,
        vm: false,
        exampleImage: false
      });
    });

    it.each(["", "0", "-1", "1.5", "three", "1e3"])("ignores the unusable version %j", version => {
      expect(parseTemplateUrl(`userTemplateId=tpl-9&templateVersion=${version}`)).not.toHaveProperty("templateVersion");
    });

    it("ignores a version without a user template", () => {
      expect(parseTemplateUrl("templateId=abc&userTemplateId=tpl-9&templateVersion=3")).not.toHaveProperty("templateVersion");
      expect(parseTemplateUrl("templateVersion=3")).not.toHaveProperty("templateVersion");
      expect(parseTemplateUrl("vm=true&userTemplateId=tpl-9&templateVersion=3")).not.toHaveProperty("templateVersion");
    });

    it("keeps the version out of template mode", () => {
      expect(parseTemplateUrl("templateMode=edit&userTemplateId=tpl-9&templateVersion=3")).not.toHaveProperty("templateVersion");
    });

    it("never reads a template version id from the URL", () => {
      expect(parseTemplateUrl("userTemplateId=tpl-9&templateVersionId=ver-1")).not.toHaveProperty("templateVersionId");
    });

    it("ignores the version without the template marketplace", () => {
      const intent = parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("userTemplateId=tpl-9&templateVersion=3") });

      expect(intent).toEqual({
        templateId: undefined,
        userTemplateId: "tpl-9",
        sdlStrategy: "edit",
        bidStrategy: "select",
        dseq: undefined,
        draftId: undefined,
        vm: false,
        exampleImage: false
      });
    });
  });

  describe("with template mode disabled", () => {
    it("parses a template mode URL exactly as before", () => {
      const query = "templateMode=new&templateId=abc&sdl-strategy=default&copyFromTemplateId=tpl-1&copyFromVersion=3&baseVersion=2&sourceDseq=12";
      const intent = parseDeploymentIntent({ dseqSegment: "777", searchParams: new URLSearchParams(query) }, { isTemplateModeEnabled: false });

      expect(intent).toEqual({
        templateId: "abc",
        sdlStrategy: "default",
        bidStrategy: "select",
        dseq: "777",
        draftId: undefined,
        vm: false,
        exampleImage: false
      });
    });

    it("ignores template mode when no option is given", () => {
      expect(parseDeploymentIntent({ dseqSegment: undefined, searchParams: new URLSearchParams("templateMode=new") }).templateMode).toBeUndefined();
    });
  });

  function parseTemplateUrl(query: string, dseqSegment?: string) {
    return parseDeploymentIntent({ dseqSegment, searchParams: new URLSearchParams(query) }, { isTemplateModeEnabled: true });
  }
});
