import React from "react";
import type { TemplateHardware } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";

import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { TemplateCard } from "./TemplateCard";

import { render, screen } from "@testing-library/react";

const GiB = 1024 ** 3;

describe(TemplateCard.name, () => {
  it("links to the template's detail page", () => {
    setup({ isPopular: false });

    expect(screen.getByRole("link", { name: /Llama 3/ })).toHaveAttribute("href", "/templates/akash-network-awesome-akash-llama-3");
  });

  it("shows the template's name and summary", () => {
    setup({ isPopular: false });

    expect(screen.getByRole("heading", { name: "Llama 3" })).toBeInTheDocument();
    expect(screen.getByText("Chat with an open model")).toBeInTheDocument();
  });

  it("shows the Popular badge for a popular template", () => {
    setup({ isPopular: true });

    expect(screen.getByText("Popular")).toBeInTheDocument();
  });

  it("shows no badge for other templates", () => {
    setup({ isPopular: false });

    expect(screen.queryByText("Popular")).not.toBeInTheDocument();
  });

  it("shows the GPU, vCPU, memory and storage the template deploys with", () => {
    setup({
      isPopular: false,
      hardware: { cpu: 1.5, memoryBytes: 16 * GiB, storageBytes: 100 * GiB, gpu: { units: 1, models: ["a100"] } }
    });

    expect(screen.getByRole("list", { name: "Hardware" })).toBeInTheDocument();
    expect(screen.getByTitle("GPU")).toHaveTextContent("1× A100");
    expect(screen.getByTitle("GPU").querySelector("svg")).toHaveClass("lucide-gpu");
    expect(screen.getByTitle("vCPU")).toHaveTextContent("1.5");
    expect(screen.getByTitle("Memory")).toHaveTextContent("16 GiB");
    expect(screen.getByTitle("Storage")).toHaveTextContent("100 GiB");
  });

  it("names every GPU model the template accepts", () => {
    setup({ isPopular: false, hardware: { cpu: 8, memoryBytes: GiB, storageBytes: GiB, gpu: { units: 2, models: ["a100", "h100"] } } });

    expect(screen.getByTitle("GPU")).toHaveTextContent("2× A100 / H100");
  });

  it("counts GPUs without a model when the template accepts any", () => {
    setup({ isPopular: false, hardware: { cpu: 8, memoryBytes: GiB, storageBytes: GiB, gpu: { units: 1, models: [] } } });

    expect(screen.getByTitle("GPU")).toHaveTextContent("1× GPU");
  });

  it("leaves the GPU out of a template that asks for none", () => {
    setup({ isPopular: false, hardware: { cpu: 0.5, memoryBytes: GiB, storageBytes: GiB } });

    expect(screen.getByTitle("vCPU")).toHaveTextContent("0.5");
    expect(screen.queryByTitle("GPU")).not.toBeInTheDocument();
  });

  it("shows no hardware for a template the gallery has no profile for", () => {
    setup({ isPopular: false });

    expect(screen.queryByRole("list", { name: "Hardware" })).not.toBeInTheDocument();
  });

  function setup(input: { isPopular: boolean; hardware?: TemplateHardware }) {
    const template: TemplateOutputSummaryWithCategory = {
      id: "akash-network-awesome-akash-llama-3",
      name: "Llama 3",
      summary: "Chat with an open model",
      deploy: "",
      logoUrl: null,
      category: "AI - GPU",
      hardware: input.hardware
    };
    render(<TemplateCard template={template} isPopular={input.isPopular} />);
  }
});
