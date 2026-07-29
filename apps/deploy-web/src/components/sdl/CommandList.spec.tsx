import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ServiceType } from "@src/types";
import { CommandList } from "./CommandList";

import { render, screen } from "@testing-library/react";

describe(CommandList.name, () => {
  it("renders command and args when both are set", () => {
    setup({ command: { command: "sh -c", arg: "--port\n8080" } });

    expect(screen.getByText("sh -c")).toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
  });

  it("renders args when only args are set", () => {
    setup({ command: { command: "", arg: "--port\n8080" } });

    expect(screen.getByText("--port 8080")).toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
  });

  it("renders 'None' when command and args are empty", () => {
    setup({ command: { command: "", arg: "" } });

    expect(screen.getByText("None")).toBeInTheDocument();
  });

  function setup(input: { command?: ServiceType["command"] }) {
    const currentService = mock<ServiceType>({ command: input.command });
    render(
      <TooltipProvider>
        <CommandList currentService={currentService} setIsEditingCommands={vi.fn()} />
      </TooltipProvider>
    );
    return input;
  }
});
