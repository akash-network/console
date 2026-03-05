import { IntlProvider } from "react-intl";
import { ThemeProvider } from "next-themes";
import { describe, expect, it, vi } from "vitest";

import type { NetworkCapacityStats } from "@src/queries/useProvidersQuery";
import type { DEPENDENCIES, Props } from "./NetworkCapacity";
import NetworkCapacity from "./NetworkCapacity";

import { render, screen } from "@testing-library/react";

describe(NetworkCapacity.name, () => {
  describe("CPU section", () => {
    it("renders CPU label", () => {
      setup();
      expect(screen.queryByText("CPU")).toBeInTheDocument();
    });

    it("displays CPU values in CPU units (divides by 1000)", () => {
      const stats = createStats({ cpu: { active: 50000, available: 100000, pending: 0, total: 150000 } });
      setup({ stats });

      expect(screen.queryByText(/50\s*CPU\s*\/\s*150\s*CPU/)).toBeInTheDocument();
    });

    it("rounds CPU values to integers for display", () => {
      const stats = createStats({ cpu: { active: 50500, available: 100000, pending: 0, total: 150500 } });
      setup({ stats });

      expect(screen.queryByText(/51\s*CPU\s*\/\s*151\s*CPU/)).toBeInTheDocument();
    });

    it("passes correct CPU data to ResponsivePie", () => {
      const stats = createStats({ cpu: { active: 50000, available: 100000, pending: 0, total: 150000 } });
      const { pieProps } = setup({ stats });

      const cpuPieData = pieProps[0].data;
      expect(cpuPieData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "active", label: "Active", value: 50 }),
          expect.objectContaining({ id: "available", label: "Available", value: 100 })
        ])
      );
    });
  });

  describe("GPU section", () => {
    it("renders GPU label", () => {
      setup();
      expect(screen.queryByText("GPU")).toBeInTheDocument();
    });

    it("displays GPU values directly without division", () => {
      const stats = createStats({ gpu: { active: 25, available: 75, pending: 0, total: 100 } });
      setup({ stats });

      expect(screen.queryByText(/25\s*GPU\s*\/\s*100\s*GPU/)).toBeInTheDocument();
    });

    it("passes correct GPU data to ResponsivePie", () => {
      const stats = createStats({ gpu: { active: 25, available: 75, pending: 0, total: 100 } });
      const { pieProps } = setup({ stats });

      const gpuPieData = pieProps[1].data;
      expect(gpuPieData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "active", label: "Active", value: 25 }),
          expect.objectContaining({ id: "available", label: "Available", value: 75 })
        ])
      );
    });
  });

  describe("Memory section", () => {
    it("renders Memory label", () => {
      setup();
      expect(screen.queryByText("Memory")).toBeInTheDocument();
    });

    it("displays memory in human-readable units", () => {
      const oneGB = 1000 * 1000 * 1000;
      const stats = createStats({ memory: { active: oneGB, available: oneGB, pending: 0, total: 2 * oneGB } });
      setup({ stats });

      expect(screen.queryByText(/1\s*GB/)).toBeInTheDocument();
      expect(screen.queryByText(/2\s*GB/)).toBeInTheDocument();
    });

    it("passes memory data in bytes to ResponsivePie", () => {
      const oneGB = 1000 * 1000 * 1000;
      const stats = createStats({ memory: { active: oneGB, available: oneGB, pending: 0, total: 2 * oneGB } });
      const { pieProps } = setup({ stats });

      const memoryPieData = pieProps[2].data;
      expect(memoryPieData).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "active", value: oneGB }), expect.objectContaining({ id: "available", value: oneGB })])
      );
    });
  });

  describe("Storage section", () => {
    it("renders Storage label", () => {
      setup();
      expect(screen.queryByText("Storage")).toBeInTheDocument();
    });

    it("displays combined ephemeral and persistent storage", () => {
      const oneTB = 1000 * 1000 * 1000 * 1000;
      const stats = createStats({
        storage: {
          ephemeral: { active: oneTB, available: oneTB, pending: 0, total: 2 * oneTB },
          persistent: { active: oneTB, available: oneTB, pending: 0, total: 2 * oneTB },
          total: { active: 2 * oneTB, available: 2 * oneTB, pending: 0, total: 4 * oneTB }
        }
      });
      setup({ stats });

      expect(screen.queryByText(/2\s*TB/)).toBeInTheDocument();
      expect(screen.queryByText(/4\s*TB/)).toBeInTheDocument();
    });

    it("passes storage breakdown data to ResponsivePie", () => {
      const oneTB = 1000 * 1000 * 1000 * 1000;
      const oneGB = 1000 * 1000 * 1000;
      const stats = createStats({
        storage: {
          ephemeral: { active: oneTB, available: 500 * oneGB, pending: 100 * oneGB, total: 2 * oneTB },
          persistent: { active: 2 * oneTB, available: oneTB, pending: 200 * oneGB, total: 4 * oneTB },
          total: { active: 3 * oneTB, available: 1.5 * oneTB, pending: 0, total: 6 * oneTB }
        }
      });
      const { pieProps } = setup({ stats });

      const storagePieData = pieProps[3].data;
      expect(storagePieData).toHaveLength(4);
      expect(storagePieData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "active-ephemeral", label: "Active ephemeral" }),
          expect.objectContaining({ id: "active-persistent", label: "Active persistent" }),
          expect.objectContaining({ id: "available-ephemeral", label: "Available ephemeral" }),
          expect.objectContaining({ id: "available-persistent", label: "Available persistent" })
        ])
      );
    });

    it("calculates available storage as available + pending", () => {
      const oneTB = 1000 * 1000 * 1000 * 1000;
      const oneGB = 1000 * 1000 * 1000;
      const stats = createStats({
        storage: {
          ephemeral: { active: oneTB, available: 500 * oneGB, pending: 100 * oneGB, total: 2 * oneTB },
          persistent: { active: 2 * oneTB, available: oneTB, pending: 200 * oneGB, total: 4 * oneTB },
          total: { active: 3 * oneTB, available: 1.5 * oneTB, pending: 0, total: 6 * oneTB }
        }
      });
      const { pieProps } = setup({ stats });

      const storagePieData = pieProps[3].data;
      const availableEphemeral = storagePieData.find(d => d.id === "available-ephemeral");
      const availablePersistent = storagePieData.find(d => d.id === "available-persistent");

      expect(availableEphemeral?.value).toBe(500 * oneGB + 100 * oneGB);
      expect(availablePersistent?.value).toBe(oneTB + 200 * oneGB);
    });
  });

  describe("pie chart rendering", () => {
    it("renders 4 ResponsivePie components per render", () => {
      const { pieProps } = setup();
      expect(pieProps).toHaveLength(4 * 2); // 2 renderings
    });

    it("passes TooltipLabel as tooltip prop to all pie charts", () => {
      const { pieProps, mockTooltipLabel } = setup();

      pieProps.forEach(props => {
        expect(props.tooltip).toBe(mockTooltipLabel);
      });
    });

    it("applies consistent pie chart configuration", () => {
      const { pieProps } = setup();

      pieProps.forEach(props => {
        expect(props.innerRadius).toBe(0.3);
        expect(props.padAngle).toBe(2);
        expect(props.cornerRadius).toBe(4);
        expect(props.activeOuterRadiusOffset).toBe(8);
        expect(props.borderWidth).toBe(0);
        expect(props.enableArcLinkLabels).toBe(false);
        expect(props.arcLabelsSkipAngle).toBe(30);
      });
    });
  });

  describe("edge cases", () => {
    it("handles zero values", () => {
      const stats = createStats({
        cpu: { active: 0, available: 0, pending: 0, total: 0 },
        gpu: { active: 0, available: 0, pending: 0, total: 0 }
      });
      setup({ stats });

      expect(screen.queryByText(/0\s*CPU\s*\/\s*0\s*CPU/)).toBeInTheDocument();
      expect(screen.queryByText(/0\s*GPU\s*\/\s*0\s*GPU/)).toBeInTheDocument();
    });

    it("handles large values", () => {
      const stats = createStats({
        cpu: { active: 1000000000, available: 2000000000, pending: 0, total: 3000000000 }
      });
      setup({ stats });

      expect(screen.queryByText(/1000000\s*CPU\s*\/\s*3000000\s*CPU/)).toBeInTheDocument();
    });
  });

  function setup(input?: TestInput) {
    type PieData = { id: string; label: string; value: number; color: string };
    type PieProps = {
      data: PieData[];
      tooltip: unknown;
      innerRadius: number;
      padAngle: number;
      cornerRadius: number;
      activeOuterRadiusOffset: number;
      borderWidth: number;
      enableArcLinkLabels: boolean;
      arcLabelsSkipAngle: number;
    };
    const mockPieProps: PieProps[] = [];
    const mockTooltipLabel = vi.fn();

    const MockResponsivePie = vi.fn((props: PieProps) => {
      mockPieProps.push(props);
      return null;
    });

    const dependencies: typeof DEPENDENCIES = {
      ResponsivePie: MockResponsivePie as unknown as typeof DEPENDENCIES.ResponsivePie,
      TooltipLabel: mockTooltipLabel as unknown as typeof DEPENDENCIES.TooltipLabel
    };

    const stats = input?.stats ?? createStats();
    const theme = input?.theme ?? "light";

    const result = render(
      <ThemeProvider defaultTheme={theme} attribute="class">
        <IntlProvider locale="en-US" defaultLocale="en-US">
          <NetworkCapacity stats={stats} dependencies={dependencies} />
        </IntlProvider>
      </ThemeProvider>
    );

    return {
      ...result,
      pieProps: mockPieProps,
      mockTooltipLabel,
      MockResponsivePie
    };
  }

  interface TestInput {
    stats?: Props["stats"];
    theme?: "light" | "dark";
  }
});

function createStats(overrides?: Partial<NetworkCapacityStats["resources"]>): NetworkCapacityStats["resources"] {
  const oneGB = 1000 * 1000 * 1000;
  return {
    cpu: { active: 10000, available: 90000, pending: 0, total: 100000 },
    gpu: { active: 10, available: 90, pending: 0, total: 100 },
    memory: { active: oneGB, available: 9 * oneGB, pending: 0, total: 10 * oneGB },
    storage: {
      ephemeral: { active: 100 * oneGB, available: 400 * oneGB, pending: 0, total: 500 * oneGB },
      persistent: { active: 200 * oneGB, available: 300 * oneGB, pending: 0, total: 500 * oneGB },
      total: { active: 300 * oneGB, available: 700 * oneGB, pending: 0, total: 1000 * oneGB }
    },
    ...overrides
  };
}
