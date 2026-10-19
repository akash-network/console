import type { FieldErrors } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { listInvalidFieldMessages, listInvalidFieldPaths, listSpecIssueMessages } from "./invalidFieldMessages";

describe(listInvalidFieldMessages.name, () => {
  it("names the service of each field error", () => {
    const { values } = setup();

    const messages = listInvalidFieldMessages(values, {
      services: {
        0: { image: { type: "too_small", message: "Docker image name is required." } },
        1: { profile: { cpu: { type: "custom", message: "Too many CPUs." } } }
      }
    } as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual(["web: Docker image name is required.", "db: Too many CPUs."]);
  });

  it("walks nested and listed field errors of a service", () => {
    const { values } = setup();

    const messages = listInvalidFieldMessages(values, {
      services: { 0: { expose: [undefined, { port: { type: "custom", message: "Port 22 is reserved." } }] } }
    } as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual(["web: Port 22 is reserved."]);
  });

  it("names the placement of each field error", () => {
    const { values } = setup();

    const messages = listInvalidFieldMessages(values, {
      placements: { 0: { name: { type: "custom", message: "Placement names must be unique." } } }
    } as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual(["gpu-pool: Placement names must be unique."]);
  });

  it("keeps an error on the whole list of services without a name", () => {
    const { values } = setup();

    const messages = listInvalidFieldMessages(values, {
      services: { message: "Add at least one service.", type: "too_small", root: { type: "custom", message: "Service names must be unique." } }
    } as unknown as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual(["Add at least one service.", "Service names must be unique."]);
  });

  it("keeps an error on the whole list of placements without a name", () => {
    const { values } = setup();

    const messages = listInvalidFieldMessages(values, {
      placements: { root: { type: "custom", message: "Placement names must be unique." } }
    } as unknown as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual(["Placement names must be unique."]);
  });

  it("skips fields whose error was cleared", () => {
    const { values } = setup();

    const messages = listInvalidFieldMessages(values, {
      services: undefined,
      endpoints: { 0: { name: null } }
    } as unknown as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual([]);
  });

  it("leaves an error without a name when its service is unknown", () => {
    const { values } = setup();

    const messages = listInvalidFieldMessages(values, {
      services: { 5: { image: { type: "custom", message: "Docker image name is required." } } }
    } as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual(["Docker image name is required."]);
  });

  it("keeps the errors of other fields as they are", () => {
    const { values } = setup();

    const messages = listInvalidFieldMessages(values, {
      endpoints: { 0: { name: { type: "custom", message: "Endpoint name is required." } } }
    } as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual(["Endpoint name is required."]);
  });

  it("reports a message repeated across fields once and skips empty ones", () => {
    const { values } = setup();

    const messages = listInvalidFieldMessages(values, {
      services: {
        0: {
          image: { type: "custom", message: "Docker image name is required." },
          title: { type: "custom", message: "" }
        }
      },
      endpoints: [{ name: { type: "custom", message: "Duplicate." } }, { name: { type: "custom", message: "Duplicate." } }]
    } as unknown as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual(["web: Docker image name is required.", "Duplicate."]);
  });

  it("does not look into the element a field error points at", () => {
    const { values } = setup();
    const ref = { name: "services.0.image", message: "not an error" };

    const messages = listInvalidFieldMessages(values, {
      services: { 0: { image: { type: "custom", message: "Docker image name is required.", ref } } }
    } as unknown as FieldErrors<SdlBuilderFormValuesType>);

    expect(messages).toEqual(["web: Docker image name is required."]);
  });

  function setup() {
    const placement = defaultPlacement({ name: "gpu-pool" });
    const values: SdlBuilderFormValuesType = {
      placements: [placement],
      endpoints: [],
      services: [defaultService(placement.id, { title: "web" }), defaultService(placement.id, { title: "db" })]
    };
    return { values };
  }
});

describe(listInvalidFieldPaths.name, () => {
  it("names each invalid field once, without the list position of the entry that holds it", () => {
    const paths = listInvalidFieldPaths({
      services: {
        0: { image: { type: "too_small", message: "Docker image name is required." } },
        12: { image: { type: "too_small", message: "Docker image name is required." }, profile: { cpu: { type: "custom", message: "Too many CPUs." } } }
      }
    } as FieldErrors<SdlBuilderFormValuesType>);

    expect(paths).toEqual(["services.image", "services.profile.cpu"]);
  });

  it("walks listed field errors nested inside an entry", () => {
    const paths = listInvalidFieldPaths({
      services: { 0: { expose: [undefined, { port: { type: "custom", message: "Port 22 is reserved." } }] } }
    } as FieldErrors<SdlBuilderFormValuesType>);

    expect(paths).toEqual(["services.expose.port"]);
  });

  it("names a whole list that is invalid as a list", () => {
    const paths = listInvalidFieldPaths({ placements: { type: "too_small", message: "Add a placement." } } as FieldErrors<SdlBuilderFormValuesType>);

    expect(paths).toEqual(["placements"]);
  });

  it("keeps a field name that mixes digits and letters", () => {
    const paths = listInvalidFieldPaths({
      services: { 0: { ipv4: { type: "custom", message: "Invalid." }, "2fa": { type: "custom", message: "Invalid." } } }
    } as FieldErrors<SdlBuilderFormValuesType>);

    expect(paths).toEqual(["services.ipv4", "services.2fa"]);
  });
});

describe(listSpecIssueMessages.name, () => {
  it("returns nothing for values the form accepts", () => {
    const { values } = setup({});

    expect(listSpecIssueMessages(values)).toEqual([]);
  });

  it("names the service of each field the form refuses, touched or not", () => {
    const { values } = setup({ web: { hasCredentials: true, credentials: { host: "docker.io", username: "", password: "" } } });

    expect(listSpecIssueMessages(values)).toEqual(["web: Registry username is required.", "web: Registry password must be at least 6 characters."]);
  });

  it("names the placement of each field the form refuses", () => {
    const { values } = setup({ placementName: "GPU" });

    expect(listSpecIssueMessages(values)).toEqual(["GPU: Invalid placement name. It must only be lower case letters, numbers and dashes."]);
  });

  it("keeps only the first message of a field the form refuses on several rules", () => {
    const { values } = setup({ web: { image: "" } });

    expect(listSpecIssueMessages(values)).toEqual(["web: Docker image name is required."]);
  });

  it("reports a message repeated across fields once", () => {
    const { values } = setup({
      web: {
        env: [
          { key: "", value: "a" },
          { key: "", value: "b" }
        ]
      }
    });

    expect(listSpecIssueMessages(values)).toEqual(["web: Key is required."]);
  });

  it("leaves a message on the whole list of services without a name", () => {
    const { values } = setup({ withoutServices: true });

    expect(listSpecIssueMessages(values)).toEqual(["At least one service is required."]);
  });

  it("leaves a message on the whole list of placements without a name", () => {
    const { values } = setup({ withoutPlacements: true });

    expect(listSpecIssueMessages(values)).toContain("At least one placement is required.");
  });

  it("leaves a message on a deployment-wide field without a name", () => {
    const { values } = setup({ endpoints: [{ id: "endpoint-1", name: "" }] });

    expect(listSpecIssueMessages(values)).toEqual(["Endpoint name is required."]);
  });

  function setup(input: {
    web?: Partial<ServiceType>;
    placementName?: string;
    withoutServices?: boolean;
    withoutPlacements?: boolean;
    endpoints?: SdlBuilderFormValuesType["endpoints"];
  }) {
    const placement = defaultPlacement({ name: input.placementName ?? "gpu-pool" });
    const services = [
      defaultService(placement.id, { title: "web", image: "nginx:latest", ...input.web }),
      defaultService(placement.id, { title: "db", image: "redis:7" })
    ];
    const values: SdlBuilderFormValuesType = {
      placements: input.withoutPlacements ? [] : [placement],
      endpoints: input.endpoints ?? [],
      services: input.withoutServices ? [] : services
    };
    return { values };
  }
});
