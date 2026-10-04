import type { ComponentProps } from "react";
import type { feature } from "topojson-client";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./LocationCard";
import { LocationCard } from "./LocationCard";

import { render, screen, within } from "@testing-library/react";

type Topology = Parameters<typeof feature>[0];

describe("LocationCard", () => {
  it("shows where the provider is and its network", () => {
    setup({});

    expect(screen.getByRole("img", { name: "Where the provider is on the globe" })).toBeInTheDocument();
    expect(row("Location")).toHaveTextContent("Hesse, Germany");
    expect(row("Region")).toHaveTextContent("EU Central");
    expect(row("Timezone")).toHaveTextContent("utc+1");
    expect(row("Network")).toHaveTextContent("Cogent");
    expect(row("Bandwidth")).toHaveTextContent("2.5 Gbps ↓ · 500 Mbps ↑");
  });

  it("draws the land once it loads", () => {
    const { container } = setup({ topology: createTopology() });

    expect(container.querySelectorAll("path")).toHaveLength(2);
  });

  it("leaves the globe out without coordinates and marks unknown details", () => {
    setup({
      provider: {
        ipLat: "",
        ipLon: "",
        ipRegion: "",
        ipCountry: "",
        locationRegion: "",
        timezone: "",
        networkProvider: "",
        networkSpeedDown: 0,
        networkSpeedUp: 0
      }
    });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    ["Location", "Region", "Timezone", "Network", "Bandwidth"].forEach(label => expect(row(label)).toHaveTextContent("—"));
  });

  it("marks an unknown direction of the bandwidth", () => {
    setup({ provider: { networkSpeedDown: 1000, networkSpeedUp: 0 } });

    expect(row("Bandwidth")).toHaveTextContent("1 Gbps ↓ · — ↑");
  });

  function row(label: string) {
    return within(screen.getByText(label).parentElement as HTMLElement).getByRole("definition");
  }

  function createTopology(): Topology {
    return {
      type: "Topology",
      objects: { land: { type: "GeometryCollection", geometries: [{ type: "Polygon", arcs: [[0]] }] } },
      arcs: [
        [
          [0, 40],
          [20, 40],
          [20, 60],
          [0, 60],
          [0, 40]
        ]
      ]
    } as Topology;
  }

  function setup(input: { provider?: Partial<ComponentProps<typeof LocationCard>["provider"]>; topology?: Topology }) {
    const landTopology = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLandTopology>>(), { data: input.topology });
    return render(
      <LocationCard
        provider={{
          ipLat: "50.1",
          ipLon: "8.7",
          ipRegion: "Hesse",
          ipCountry: "Germany",
          locationRegion: "eu-central",
          timezone: "utc+1",
          networkProvider: "Cogent",
          networkSpeedDown: 2500,
          networkSpeedUp: 500,
          ...input.provider
        }}
        dependencies={{ useLandTopology: () => landTopology }}
      />
    );
  }
});
