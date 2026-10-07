import { describe, expect, it, vi } from "vitest";

import { CustomValidationError } from "@src/utils/deploymentData";
import { helloWorldTemplate } from "@src/utils/templates";
import { importDeploymentState, NoVisibleServiceError } from "../importDeploymentState/importDeploymentState";
import { checkSdlImport } from "./checkSdlImport";

const VALID_SDL = `version: "2.0"
services:
  web:
    image: nginx:1.27-alpine
    expose:
      - port: 80
        to:
          - global: true
  api:
    image: ghcr.io/acme/api:1.0.0
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    edge:
      attributes:
        region: us-east
      pricing:
        web:
          denom: uact
          amount: 1000
        api:
          denom: uact
          amount: 1000
    backup:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    edge:
      profile: web
      count: 1
    backup:
      profile: web
      count: 1
  api:
    edge:
      profile: web
      count: 1
`;

describe(checkSdlImport.name, () => {
  it("reports nothing to check for blank text", () => {
    expect(checkSdlImport("  \n ")).toEqual({ status: "empty" });
  });

  it("names the line of a yaml syntax error", () => {
    expect(checkSdlImport('version: "2.0"\nservices:\n  web:\n    image: nginx\n   expose: []')).toEqual({
      status: "invalid",
      reason: "Line 5: bad indentation of a mapping entry"
    });
  });

  it("refuses yaml that holds no mapping", () => {
    expect(checkSdlImport("just some text")).toEqual({
      status: "invalid",
      reason: "This doesn't look like an SDL. Paste a deploy.yaml with a services section."
    });
  });

  it("refuses yaml that is only a null document", () => {
    expect(checkSdlImport("~")).toEqual({
      status: "invalid",
      reason: "This doesn't look like an SDL. Paste a deploy.yaml with a services section."
    });
  });

  it("summarizes each placement with its region and the services it runs", () => {
    expect(checkSdlImport(VALID_SDL)).toEqual({
      status: "valid",
      placements: [
        { name: "edge", region: "us-east", services: ["web", "api"] },
        { name: "backup", region: undefined, services: ["web"] }
      ]
    });
  });

  it("reads no region from a placement whose region is not text", () => {
    const check = checkSdlImport(VALID_SDL.replace("region: us-east", "region: 5"));

    expect(check).toMatchObject({ status: "valid", placements: [{ name: "edge", region: undefined }, { name: "backup" }] });
  });

  it("refuses a deployment that names a placement the profiles don't define, without reading it into a form", () => {
    const check = checkSdlImport(VALID_SDL.replace("  api:\n    edge:\n      profile: web", "  api:\n    ghost:\n      profile: web"));

    expect(check).toEqual({ status: "invalid", reason: "/profiles/placement: missing required property 'ghost'" });
  });

  it("refuses yaml too deeply nested to read", () => {
    expect(checkSdlImport("[".repeat(100_000))).toEqual({ status: "invalid", reason: "This SDL couldn't be read. Check it and try again." });
  });

  it("reads the sdl into the form when asked to", () => {
    const readIntoForm = vi.fn();

    checkSdlImport(VALID_SDL, readIntoForm);

    expect(readIntoForm).toHaveBeenCalledWith(VALID_SDL);
  });

  it("shows the message of an sdl that defines no service the form can configure", () => {
    const check = checkSdlImport(VALID_SDL, () => {
      throw new NoVisibleServiceError("This SDL doesn't define any services to configure.");
    });

    expect(check).toEqual({ status: "invalid", reason: "This SDL doesn't define any services to configure." });
  });

  it("shows the message of a known parser error", () => {
    const check = checkSdlImport(VALID_SDL, () => {
      throw new CustomValidationError("Service web is missing an image");
    });

    expect(check).toEqual({ status: "invalid", reason: "Service web is missing an image" });
  });

  it("hides the message of an unexpected error behind a generic one", () => {
    const check = checkSdlImport(VALID_SDL, () => {
      throw new TypeError("cannot read properties of undefined");
    });

    expect(check).toEqual({ status: "invalid", reason: "This SDL couldn't be read. Check it and try again." });
  });

  it("names the first schema error and counts the rest", () => {
    const check = checkSdlImport('version: "2.0"\nservices:\n  web:\n    image: nginx\n');

    expect(check).toEqual({ status: "invalid", reason: "(root): missing required property 'profiles' (and 1 more)" });
  });

  it("names a lone schema error without a count", () => {
    const check = checkSdlImport(VALID_SDL.replace("count: 1\n  api:", "count: one\n  api:"));

    expect(check).toEqual({
      status: "invalid",
      reason: '/deployment/web/backup/count: "count" at "/deployment/web/backup" should be integer. (expected integer)'
    });
  });

  it("accepts the hello world example as the form reads it", () => {
    expect(checkSdlImport(helloWorldTemplate.content, importDeploymentState)).toEqual({
      status: "valid",
      placements: [{ name: "dcloud", region: undefined, services: ["web"] }]
    });
  });
});
