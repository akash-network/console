import type { ComponentProps } from "react";
import type { feature } from "topojson-client";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./LocationCard";
import { LocationCard, projectLocator } from "./LocationCard";

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

  it("pins the provider on the globe", () => {
    setup({});

    expect(screen.getByRole("img", { name: "Where the provider is on the globe" }).querySelectorAll("circle")).toHaveLength(3);
  });

  it("draws the land once it loads", () => {
    const { container } = setup({ topology: createTopology() });

    expect(container.querySelectorAll("path")).toHaveLength(2);
  });

  it("draws the land when it loads after the globe", () => {
    const { container, rerender } = setup({});
    expect(container.querySelectorAll("path")).toHaveLength(1);

    rerender(createLocationCard({ topology: createTopology() }));

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
    ["Location", "Region", "Timezone", "Network", "Bandwidth"].forEach(label => expect(row(label)).toHaveTextContent(/^—$/));
  });

  it.each([
    [1000, 0, "1 Gbps ↓ · — ↑"],
    [0, 500, "— ↓ · 500 Mbps ↑"]
  ])("marks an unknown direction of the bandwidth (%i down, %i up) as %s", (networkSpeedDown, networkSpeedUp, bandwidth) => {
    setup({ provider: { networkSpeedDown, networkSpeedUp } });

    expect(row("Bandwidth")).toHaveTextContent(bandwidth);
  });

  describe(projectLocator.name, () => {
    it.each([
      { place: "Frankfurt", lat: 50.1, lng: 8.7 },
      { place: "Sydney", lat: -33.9, lng: 151.2 }
    ])("turns the globe so a provider in $place sits just above its middle", ({ lat, lng }) => {
      const { center, radius, pin } = projectLocator({ lat, lng }, undefined);

      expect({ center, radius }).toEqual({ center: 120, radius: 116 });
      expect(pin?.[0]).toBeCloseTo(120, 6);
      expect(pin?.[1]).toBeCloseTo(107.87, 2);
    });

    it("outlines the land only once it has loaded", () => {
      expect(projectLocator({ lat: 50.1, lng: 8.7 }, undefined)).toMatchObject({ landPath: null, graticulePath: expect.stringMatching(/^M/) });
      expect(projectLocator({ lat: 50.1, lng: 8.7 }, createTopology())).toMatchObject({ landPath: expect.stringMatching(/^M/) });
    });
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

  function createLocationCard(input: { provider?: Partial<ComponentProps<typeof LocationCard>["provider"]>; topology?: Topology }) {
    const landTopology = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLandTopology>>(), { data: input.topology });
    return (
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

  function setup(input: { provider?: Partial<ComponentProps<typeof LocationCard>["provider"]>; topology?: Topology }) {
    return render(createLocationCard(input));
  }
});
