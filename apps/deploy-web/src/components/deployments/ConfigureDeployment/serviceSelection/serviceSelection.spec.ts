import type { FieldErrors } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import {
  firstBidReadyServiceId,
  firstInvalidServiceId,
  nextSelectedServiceId,
  nextUndoneServiceId,
  resolveSelectedPlacement,
  serviceIdOfPlacement
} from "./serviceSelection";

describe(resolveSelectedPlacement.name, () => {
  it("returns the placement of the selected service", () => {
    const placements = [placement("p1"), placement("p2")];
    const services = [service("s1", "p1"), service("s2", "p2")];

    expect(resolveSelectedPlacement(services, placements, "s2").id).toBe("p2");
  });

  it("falls back to the placement of the first visible service when nothing is selected", () => {
    const placements = [placement("p1"), placement("p2")];
    const services = [logCollector("c2", "p1"), service("s2", "p2"), service("s1", "p1")];

    expect(resolveSelectedPlacement(services, placements, "").id).toBe("p2");
  });

  it("falls back to the first placement when the service's placement is gone", () => {
    const placements = [placement("p1"), placement("p2")];
    const services = [service("s1", "removed")];

    expect(resolveSelectedPlacement(services, placements, "s1").id).toBe("p1");
  });
});

describe(nextSelectedServiceId.name, () => {
  it("keeps the selection on a service that still exists", () => {
    const values = formValues([service("s1", "p1"), service("s2", "p2")]);

    expect(nextSelectedServiceId(values, "s2", "p2")).toBe("s2");
  });

  it("moves to a service left in the same placement once the selected one is removed", () => {
    const values = formValues([service("s1", "p1"), service("s3", "p2")]);

    expect(nextSelectedServiceId(values, "s2", "p2")).toBe("s3");
  });

  it("moves to the first visible service when its placement was removed too", () => {
    const values = formValues([logCollector("c1", "p1"), service("s1", "p1"), service("s3", "p3")]);

    expect(nextSelectedServiceId(values, "s2", "p2")).toBe("s1");
  });

  it("never lands on a log collector left in the same placement", () => {
    const values = formValues([service("s1", "p1"), logCollector("c2", "p2")]);

    expect(nextSelectedServiceId(values, "s2", "p2")).toBe("s1");
  });
});

describe(nextUndoneServiceId.name, () => {
  it("falls back to the first undone placement's service when none have bids yet", () => {
    const placements = [placement("p1"), placement("p2")];
    const services = [service("s1", "p1"), service("s2", "p2")];
    expect(nextUndoneServiceId(placements, services, { p1: "bid" }, new Set())).toBe("s2");
  });

  it("prefers the first undone placement that already has bids", () => {
    const placements = [placement("p1"), placement("p2"), placement("p3")];
    const services = [service("s1", "p1"), service("s2", "p2"), service("s3", "p3")];
    expect(nextUndoneServiceId(placements, services, { p1: "bid" }, new Set(["p3"]))).toBe("s3");
  });

  it("returns null once every placement has a selection", () => {
    const placements = [placement("p1"), placement("p2")];
    const services = [service("s1", "p1"), service("s2", "p2")];
    expect(nextUndoneServiceId(placements, services, { p1: "b1", p2: "b2" }, new Set(["p1", "p2"]))).toBeNull();
  });
});

describe(firstBidReadyServiceId.name, () => {
  it("returns the first unselected placement that has bids", () => {
    const placements = [placement("p1"), placement("p2")];
    const services = [service("s1", "p1"), service("s2", "p2")];
    expect(firstBidReadyServiceId(placements, services, {}, new Set(["p2"]))).toBe("s2");
  });

  it("returns null when no unselected placement has bids", () => {
    const placements = [placement("p1")];
    const services = [service("s1", "p1")];
    expect(firstBidReadyServiceId(placements, services, {}, new Set())).toBeNull();
  });
});

describe(serviceIdOfPlacement.name, () => {
  it("returns the placement's first service that is not a log collector", () => {
    const services = [logCollector("c1", "p1"), service("s1", "p1")];

    expect(serviceIdOfPlacement(services, placement("p1"))).toBe("s1");
  });

  it("returns null for a placement without services or without a placement at all", () => {
    expect(serviceIdOfPlacement([service("s1", "p1")], placement("p2"))).toBeNull();
    expect(serviceIdOfPlacement([service("s1", "p1")], undefined)).toBeNull();
  });
});

describe(firstInvalidServiceId.name, () => {
  it("reveals the first service with an error", () => {
    const values = mock<SdlBuilderFormValuesType>({ services: [service("s1", "p1"), service("s2", "p2")], placements: [placement("p1"), placement("p2")] });

    expect(firstInvalidServiceId(values, errorsAt({ services: [1] }))).toBe("s2");
  });

  it("reveals the service a log collector with an error belongs to", () => {
    const web = service("web", "p1");
    const collector = mock<ServiceType>({ id: "web-log-collector", placementId: "p1", title: "web-log-collector", image: LOG_COLLECTOR_IMAGE });
    const values = mock<SdlBuilderFormValuesType>({ services: [web, service("api", "p1"), collector], placements: [placement("p1")] });

    expect(firstInvalidServiceId(values, errorsAt({ services: [2] }))).toBe("web");
  });

  it("reveals the first service of the first placement with an error", () => {
    const values = mock<SdlBuilderFormValuesType>({ services: [service("s1", "p1"), service("s2", "p2")], placements: [placement("p1"), placement("p2")] });

    expect(firstInvalidServiceId(values, errorsAt({ placements: [1] }))).toBe("s2");
  });

  it("reveals nothing when neither a service nor a placement has an error", () => {
    const values = mock<SdlBuilderFormValuesType>({ services: [service("s1", "p1")], placements: [placement("p1")] });

    expect(firstInvalidServiceId(values, {})).toBeNull();
  });

  function errorsAt(input: { services?: number[]; placements?: number[] }): FieldErrors<SdlBuilderFormValuesType> {
    const byIndex = (indexes: number[] = []) => Object.fromEntries(indexes.map(index => [index, { title: { type: "manual", message: "invalid" } }]));
    return { services: byIndex(input.services), placements: byIndex(input.placements) } as FieldErrors<SdlBuilderFormValuesType>;
  }
});

function placement(id: string): PlacementType {
  return mock<PlacementType>({ id });
}

function service(id: string, placementId: string): ServiceType {
  return mock<ServiceType>({ id, placementId, title: id, image: "nginx" });
}

function logCollector(id: string, placementId: string): ServiceType {
  return mock<ServiceType>({ id, placementId, title: `${id}-log-collector`, image: LOG_COLLECTOR_IMAGE });
}

function formValues(services: ServiceType[]): SdlBuilderFormValuesType {
  return mock<SdlBuilderFormValuesType>({ services });
}
