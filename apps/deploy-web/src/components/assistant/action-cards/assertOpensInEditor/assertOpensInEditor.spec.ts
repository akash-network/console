import { describe, expect, it } from "vitest";

import { assertOpensInEditor } from "./assertOpensInEditor";

const PROPOSED_SDL = `version: "2.0"
services:
  nginx-api:
    image: nginx:1.25.3
    expose:
      - port: 80
        as: 80
        proto: http
        accept:
          - api.example.com
        to:
          - global: true
profiles:
  compute:
    nginx-api:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 2Gi
  placement:
    dcloud:
      pricing:
        nginx-api:
          denom: uact
          amount: 100000
deployment:
  nginx-api:
    dcloud:
      profile: nginx-api
      count: 1
`;

describe(assertOpensInEditor.name, () => {
  it("lets an SDL the editor can import through", () => {
    expect(() => assertOpensInEditor(PROPOSED_SDL)).not.toThrow();
  });

  it("explains an SDL that defines no service to configure", () => {
    expect(() => assertOpensInEditor('version: "2.0"\nservices: {}\n')).toThrow(
      "The editor can't open this SDL. This SDL doesn't define any services to configure."
    );
  });

  it("passes on what the SDL validation found wrong", () => {
    const withoutPricing = PROPOSED_SDL.replace(/ {6}pricing:\n.*\n.*\n.*\n/, "      attributes: {}\n");

    expect(() => assertOpensInEditor(withoutPricing)).toThrow(
      `The editor can't open this SDL. Unable to find pricing for service "nginx-api" in placement "dcloud"`
    );
  });

  it("keeps an unexpected failure's detail out of the message", () => {
    const withoutProfiles = PROPOSED_SDL.slice(0, PROPOSED_SDL.indexOf("profiles:"));

    expect(() => assertOpensInEditor(withoutProfiles)).toThrow("The editor can't open this SDL. Its configuration couldn't be read.");
  });
});
