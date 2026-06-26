import { describe, expect, it } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import { nextEndpointName, nextPlacementName, nextServiceTitle, serviceRemovalIndexes } from "./formArrayHelpers";

import { buildSDLService } from "@tests/seeders/sdlService";

describe("nextServiceTitle", () => {
  it("starts numbering at service-1 for an empty list", () => {
    expect(nextServiceTitle([])).toBe("service-1");
  });

  it("continues from the last numbered service", () => {
    const services = [buildSDLService({ title: "service-3" })];
    expect(nextServiceTitle(services)).toBe("service-4");
  });

  it("skips titles already taken", () => {
    const services = [buildSDLService({ title: "api" }), buildSDLService({ title: "service-2" })];
    expect(nextServiceTitle(services)).toBe("service-3");
  });

  it("seeds from the list length when the last title is unnumbered, then skips taken titles", () => {
    const services = [buildSDLService({ title: "service-3" }), buildSDLService({ title: "api" })];
    expect(nextServiceTitle(services)).toBe("service-4");
  });
});

describe("nextPlacementName", () => {
  it("starts numbering at placement-1 for an empty list", () => {
    expect(nextPlacementName([])).toBe("placement-1");
  });

  it("skips names already taken", () => {
    const placements = [
      { id: "p-1", name: "placement-1" },
      { id: "p-2", name: "dcloud" }
    ];
    expect(nextPlacementName(placements)).toBe("placement-2");
  });
});

describe("serviceRemovalIndexes", () => {
  it("returns only the service index when it has no log collector", () => {
    const services = [buildSDLService({ title: "web" })];
    expect(serviceRemovalIndexes(services, 0)).toEqual([0]);
  });

  it("includes the paired log collector index sorted descending", () => {
    const web = buildSDLService({ id: "web-id", title: "web" });
    const collector = buildSDLService({ id: `${web.id}-log-collector`, title: `${web.title}-log-collector`, image: LOG_COLLECTOR_IMAGE });
    const services = [web, collector];

    const indexes = serviceRemovalIndexes(services, 0);

    expect(indexes).toEqual([1, 0]);
  });

  it("still pairs the collector after the parent is renamed, since pairing is by id not title", () => {
    const web = buildSDLService({ id: "web-id", title: "web" });
    const collector = buildSDLService({ id: `${web.id}-log-collector`, title: "web-log-collector", image: LOG_COLLECTOR_IMAGE });
    const renamed = { ...web, title: "api" };
    const services = [renamed, collector];

    const indexes = serviceRemovalIndexes(services, 0);

    expect(indexes).toEqual([1, 0]);
  });

  it("pairs an imported collector by title when its id was reassigned on import", () => {
    const web = buildSDLService({ id: "web-id", title: "web" });
    const collector = buildSDLService({ id: "imported-random-id", title: `${web.title}-log-collector`, image: LOG_COLLECTOR_IMAGE });
    const services = [web, collector];

    const indexes = serviceRemovalIndexes(services, 0);

    expect(indexes).toEqual([1, 0]);
  });
});

describe("nextEndpointName", () => {
  it("starts numbering at endpoint-1 for an empty list", () => {
    expect(nextEndpointName([])).toBe("endpoint-1");
  });

  it("skips names already taken", () => {
    const endpoints = [
      { id: "e-1", name: "endpoint-1" },
      { id: "e-2", name: "endpoint-3" }
    ];
    expect(nextEndpointName(endpoints)).toBe("endpoint-2");
  });
});
