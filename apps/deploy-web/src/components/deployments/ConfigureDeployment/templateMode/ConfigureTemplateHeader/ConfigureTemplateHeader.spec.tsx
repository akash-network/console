import { describe, expect, it, vi } from "vitest";

import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { ConfigureTemplateHeader } from "./ConfigureTemplateHeader";

import { fireEvent, render, screen } from "@testing-library/react";

describe(ConfigureTemplateHeader.name, () => {
  it("names the template mode and its title", () => {
    setup({});

    expect(screen.getByRole("heading", { level: 1, name: "Configure your template" })).toBeInTheDocument();
    expect(screen.getByText("Template mode")).toBeInTheDocument();
  });

  it("sums the template's services and resources", () => {
    setup({
      services: [
        { cpu: 1, ram: 2, count: 1 },
        { cpu: 0.5, ram: 1, count: 2 }
      ]
    });

    expect(screen.getByText("Your template")).toBeInTheDocument();
    expect(screen.getByText("2 services · 2 vCPU · 4 GiB")).toBeInTheDocument();
  });

  it("counts a single service and asked value in the singular", () => {
    setup({ services: [{ cpu: 1, ram: 1, count: 1 }], askedCount: 1 });

    expect(screen.getByText("1 service · 1 vCPU · 1 GiB")).toBeInTheDocument();
    expect(screen.getByText("1 value")).toBeInTheDocument();
  });

  it("counts the values asked to the deployer", () => {
    setup({ askedCount: 3 });

    expect(screen.getByText("Asked to the deployer")).toBeInTheDocument();
    expect(screen.getByText("3 values")).toBeInTheDocument();
  });

  it("saves a template in new mode", () => {
    const { onSave } = setup({ mode: "new" });

    fireEvent.click(screen.getByRole("button", { name: "Save template" }));

    expect(onSave).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Save new version" })).not.toBeInTheDocument();
  });

  it("saves a new version in edit mode", () => {
    const { onSave } = setup({ mode: "edit" });

    fireEvent.click(screen.getByRole("button", { name: "Save new version" }));

    expect(onSave).toHaveBeenCalled();
  });

  it("holds the save while one is in flight", () => {
    setup({ isSaving: true });

    expect(screen.getByRole("button", { name: /Save template/ })).toBeDisabled();
  });

  it("says which deployment is being saved and links back to it", () => {
    setup({ source: { name: "support-bot", href: "/deployments/1234" } });

    expect(screen.getByText(/as a template\. Bids and pricing are hidden\./)).toHaveTextContent(
      "Saving support-bot as a template. Bids and pricing are hidden."
    );
    expect(screen.getByRole("link", { name: "Back to deployment" })).toHaveAttribute("href", "/deployments/1234");
  });

  it("holds the save while the template cannot be saved", () => {
    setup({ canSave: false });

    expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled();
  });

  it("shows no deployment banner for a template started elsewhere", () => {
    setup({});

    expect(screen.queryByText(/Bids and pricing are hidden/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to deployment" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save template" })).toBeEnabled();
  });

  function setup(input: {
    mode?: "new" | "edit";
    source?: { name: string; href: string };
    canSave?: boolean;
    services?: Array<{ cpu: number; ram: number; count: number }>;
    askedCount?: number;
    isSaving?: boolean;
  }) {
    const onSave = vi.fn();
    const services = (input.services ?? [{ cpu: 1, ram: 1, count: 1 }]).map(({ cpu, ram, count }, index) => {
      const service = defaultServiceWithPlacement().services[0];
      return { ...service, id: `svc-${index}`, title: `svc-${index}`, count, profile: { ...service.profile, cpu, ram, ramUnit: "Gi", storage: [] } };
    });

    render(
      <ConfigureTemplateHeader
        mode={input.mode ?? "new"}
        source={input.source}
        services={services}
        askedCount={input.askedCount ?? 0}
        isSaving={input.isSaving ?? false}
        onSave={onSave}
        canSave={input.canSave}
      />
    );

    return { onSave };
  }
});
