import { describe, expect, it } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import { nextPlacementName, nextServiceTitle, serviceRemovalIndexes } from "./formArrayHelpers";

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
    const web = buildSDLService({ title: "web" });
    const collector = buildSDLService({ title: `${web.title}-log-collector`, image: LOG_COLLECTOR_IMAGE });
    const services = [web, collector];

    const indexes = serviceRemovalIndexes(services, 0);

    expect(indexes).toEqual([1, 0]);
  });
});
