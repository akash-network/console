import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { OperatorCard } from "./OperatorCard";

import { render, screen, within } from "@testing-library/react";

type Provider = ComponentProps<typeof OperatorCard>["provider"];

describe("OperatorCard", () => {
  it("shows who runs the provider and links to their site, status page and email", () => {
    setup({});

    expect(screen.getByText("Audited")).toBeInTheDocument();
    expect(row("Organization")).toHaveTextContent("overclock");
    expect(within(row("Website")).getByRole("link", { name: "akash.network" })).toHaveAttribute("href", "https://akash.network");
    expect(within(row("Status page")).getByRole("link", { name: "https://status.akash.network" })).toHaveAttribute("href", "https://status.akash.network");
    expect(within(row("Email")).getByRole("link", { name: "ops@akash.network" })).toHaveAttribute("href", "mailto:ops@akash.network");
    expect(within(row("Website")).getByRole("link")).toHaveAttribute("target", "_blank");
    expect(row("Facility")).toHaveTextContent("datacenter · Overclock");
    expect(row("Hardware")).toHaveTextContent("intel · ddr5");
    expect(row("CPU architecture")).toHaveTextContent("amd64");
    expect(screen.getByText("Akash 0.16.4")).toBeInTheDocument();
    expect(screen.getByText("Kube 1.32")).toBeInTheDocument();
  });

  it.each([
    ["akash.network", "https://akash.network"],
    ["http://akash.network", "http://akash.network"],
    ["HTTPS://akash.network", "HTTPS://akash.network"],
    ["akash.network/?from=https://console.akash.network", "https://akash.network/?from=https://console.akash.network"]
  ])("links the website %s to %s", (website, href) => {
    setup({ provider: { website } });

    expect(within(row("Website")).getByRole("link", { name: website })).toHaveAttribute("href", href);
  });

  it("shows an email that isn't an address without linking it", () => {
    setup({ provider: { email: "ask on discord" } });

    expect(row("Email")).toHaveTextContent("ask on discord");
    expect(within(row("Email")).queryByRole("link")).not.toBeInTheDocument();
  });

  it("leaves out the details the operator didn't publish", () => {
    setup({
      provider: {
        isAudited: false,
        organization: "",
        website: "",
        statusPage: "",
        email: "",
        locationType: "",
        hostingProvider: "",
        hardwareCpu: "",
        hardwareMemory: "",
        akashVersion: ""
      },
      kubeVersion: null
    });

    ["Organization", "Website", "Status page", "Email", "Facility", "Hardware"].forEach(label => expect(screen.queryByText(label)).not.toBeInTheDocument());
    expect(screen.queryByText("Audited")).not.toBeInTheDocument();
    expect(screen.queryByText(/Akash|Kube/)).not.toBeInTheDocument();
  });

  it("warns when the nodes report a CPU architecture other than the declared one", () => {
    setup({ provider: { reportedCpuArchs: ["arm64"], hardwareCpuArch: "x86-64", cpuArchAgreement: "mismatch" } });

    expect(row("CPU architecture")).toHaveTextContent("arm64");
    expect(screen.getByText("The nodes report arm64, which differs from the declared x86-64.")).toBeInTheDocument();
  });

  it("lists every CPU architecture the nodes report", () => {
    setup({ provider: { reportedCpuArchs: ["arm64", "amd64"], hardwareCpuArch: "x86-64", cpuArchAgreement: "mismatch" } });

    expect(row("CPU architecture")).toHaveTextContent(/^arm64, amd64$/);
    expect(screen.getByText("The nodes report arm64, amd64, which differs from the declared x86-64.")).toBeInTheDocument();
  });

  it("falls back to the declared CPU architecture when the nodes report none", () => {
    setup({ provider: { reportedCpuArchs: [], hardwareCpuArch: "x86-64", cpuArchAgreement: "unknown" } });

    expect(row("CPU architecture")).toHaveTextContent("x86-64 (declared)");
    expect(screen.queryByText(/differs from the declared/)).not.toBeInTheDocument();
  });

  it("says the CPU architecture is unknown when neither side gives one", () => {
    setup({ provider: { reportedCpuArchs: [], hardwareCpuArch: "", cpuArchAgreement: "unknown" } });

    expect(row("CPU architecture")).toHaveTextContent("Unknown");
  });

  function row(label: string) {
    return within(screen.getByText(label).parentElement as HTMLElement).getByRole("definition");
  }

  function setup(input: { provider?: Partial<Provider>; kubeVersion?: string | null }) {
    const provider: Provider = {
      isAudited: true,
      organization: "overclock",
      website: "akash.network",
      statusPage: "https://status.akash.network",
      email: "ops@akash.network",
      locationType: "datacenter",
      hostingProvider: "Overclock",
      hardwareCpu: "intel",
      hardwareMemory: "ddr5",
      hardwareCpuArch: "x86-64",
      reportedCpuArchs: ["amd64"],
      cpuArchAgreement: "match",
      akashVersion: "0.16.4",
      ...input.provider
    };
    render(<OperatorCard provider={provider} kubeVersion={"kubeVersion" in input ? input.kubeVersion ?? null : "1.32"} />);
  }
});
