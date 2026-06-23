import type { ComponentProps, PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, IpEndpointsSection } from "./IpEndpointsSection";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("IpEndpointsSection", () => {
  it("renders a row per endpoint", () => {
    const EndpointRow = vi.fn<(props: ComponentProps<typeof DEPENDENCIES.EndpointRow>) => null>(() => null);
    setup({
      endpoints: [
        { id: "e-1", name: "endpoint-1" },
        { id: "e-2", name: "endpoint-2" }
      ],
      dependencies: { EndpointRow }
    });

    expect(EndpointRow).toHaveBeenCalledTimes(2);
  });

  it("adds an endpoint", async () => {
    const { manager } = setup({ endpoints: [] });

    await userEvent.click(screen.getByRole("button", { name: "Add endpoint" }));

    expect(manager.addEndpoint).toHaveBeenCalled();
  });

  it("removes the endpoint by id", () => {
    const EndpointRow = vi.fn<(props: ComponentProps<typeof DEPENDENCIES.EndpointRow>) => null>(() => null);
    const { manager } = setup({ endpoints: [{ id: "e-1", name: "endpoint-1" }], dependencies: { EndpointRow } });

    EndpointRow.mock.calls[0][0].onRemove();

    expect(manager.removeEndpoint).toHaveBeenCalledWith("e-1");
  });

  function setup(input: { endpoints: { id: string; name: string }[]; dependencies?: Partial<typeof DEPENDENCIES> }) {
    const manager = mock<ReturnType<typeof DEPENDENCIES.useEndpointManager>>({
      endpoints: input.endpoints,
      addEndpoint: vi.fn(),
      removeEndpoint: vi.fn()
    });
    const useEndpointManager: typeof DEPENDENCIES.useEndpointManager = () => manager;

    render(
      <TooltipProvider>
        <IpEndpointsSection dependencies={MockComponents(DEPENDENCIES, { useEndpointManager, ...input.dependencies })} />
      </TooltipProvider>
    );

    return { manager };
  }
});

describe("IpEndpointsSection uniqueness validation", () => {
  it("removes the uniqueness error from the surviving row after a duplicate is deleted", async () => {
    setup({
      endpoints: [
        { id: "e-1", name: "endpoint-1" },
        { id: "e-2", name: "endpoint-2" }
      ]
    });

    duplicateSecondRow("endpoint-1");
    submitForm();
    await waitFor(() => expect(screen.getAllByText("Endpoint name must be unique.")).toHaveLength(2));

    const removeButtons = screen.getAllByRole("button", { name: /Remove endpoint-1/ });
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText("Endpoint name must be unique.")).not.toBeInTheDocument();
    });
  });

  function duplicateSecondRow(value: string) {
    const inputs = screen.getAllByLabelText("Endpoint name");
    fireEvent.change(inputs[1], { target: { value } });
    fireEvent.blur(inputs[1]);
  }

  function submitForm() {
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form") as HTMLFormElement);
  }

  function setup(input: { endpoints: SdlBuilderFormValuesType["endpoints"] }) {
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({
        defaultValues: { ...defaultServiceWithPlacement(), endpoints: input.endpoints },
        mode: "onSubmit",
        reValidateMode: "onChange",
        resolver: zodResolver(SdlBuilderFormValuesSchema)
      });
      return (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(() => undefined)}>
            <TooltipProvider>{children}</TooltipProvider>
            <button type="submit">submit</button>
          </form>
        </FormProvider>
      );
    };

    return render(<IpEndpointsSection />, { wrapper: Wrapper });
  }
});
