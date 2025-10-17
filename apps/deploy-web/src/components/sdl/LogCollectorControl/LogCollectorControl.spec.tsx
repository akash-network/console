import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { mock } from "jest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import { LogCollectorControl } from "./LogCollectorControl";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSDLService } from "@tests/seeders/sdlService";

describe(LogCollectorControl.name, () => {
  beforeAll(() => {
    global.ResizeObserver = jest.fn().mockImplementation(() => mock<ResizeObserver>());
  });

  it("adds log-collector service when checkbox is checked", async () => {
    const { user, form, targetService } = await setup();
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    const formValues = form.getValues();

    expect(formValues.services).toHaveLength(2);
    const logCollectorService = formValues.services.find(service => service.title === `${targetService.title}-log-collector`);
    expect(logCollectorService).toBeDefined();
    expect(logCollectorService?.image).toMatch(/ghcr\.io\/akash-network\/log-collector:\d+\.\d+\.\d+/);
    expect(logCollectorService?.placement).toMatchObject(targetService.placement);
  });

  it("removes log-collector service when checkbox is unchecked", async () => {
    const { user, form, targetService } = await setup();
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    await user.click(checkbox);

    const formValues = form.getValues();

    expect(formValues.services).toHaveLength(1);
    const logCollectorService = formValues.services.find(service => service.title === `${targetService.title}-log-collector`);
    expect(logCollectorService).toBeUndefined();
  });

  it("removes log-collector service when target service is removed", async () => {
    const { user, form } = await setup();
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    await act(async () => {
      form.setValue("services", [form.getValues("services.1")]);
    });

    expect(form.getValues("services.1")).toBeUndefined();
  });

  it("updates log-collector service title when target service title is changed", async () => {
    const { user, form } = await setup();
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    await act(async () => {
      form.setValue("services.0.title", "new-title");
    });

    await waitFor(async () => {
      expect(form.getValues("services.1.title")).toBe(`new-title-log-collector`);
    });
  });

  it("updates log-collector pod selector label when target service title is changed", async () => {
    const { user, form } = await setup();
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    await act(async () => {
      form.setValue("services.0.title", "new-title");
    });

    await waitFor(async () => {
      const selector = form.getValues("services.1.env")?.find(env => env.key === "POD_LABEL_SELECTOR");
      expect(selector?.value).toBe('"akash.network/manifest-service=new-title"');
    });
  });

  it("updates log-collector placement when target service placement is changed", async () => {
    const { user, form } = await setup();
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    const newPlacement = buildSDLService().placement;
    await act(async () => {
      form.setValue("services.0.placement", newPlacement);
    });

    await waitFor(
      () => {
        expect(form.getValues("services.1.placement.name")).toBe(newPlacement.name);
      },
      { timeout: 1000 }
    );
  });

  async function setup() {
    const targetService = buildSDLService();
    const formValues = {
      services: [targetService]
    };
    let maybeForm: ReturnType<typeof useForm<SdlBuilderFormValuesType>>;

    const TestWrapper = ({ children }: { children: React.ReactNode }) => {
      const methods = useForm<SdlBuilderFormValuesType>({
        defaultValues: formValues
      });
      maybeForm = methods;

      return <FormProvider {...methods}>{children}</FormProvider>;
    };

    const user = userEvent.setup();
    const result = render(
      <TooltipProvider>
        <TestWrapper>
          <LogCollectorControl serviceIndex={0} />
        </TestWrapper>
      </TooltipProvider>
    );

    return {
      ...result,
      user,
      form: await waitFor(() => maybeForm),
      targetService
    };
  }
});
