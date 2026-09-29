import type { FieldErrors } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { listInvalidFieldMessages } from "./invalidFieldMessages";

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
