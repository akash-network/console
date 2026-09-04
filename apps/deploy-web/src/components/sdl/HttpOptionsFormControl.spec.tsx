import { useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, HttpOptionsFormControl } from "./HttpOptionsFormControl";

import { render, screen } from "@testing-library/react";

describe(HttpOptionsFormControl.name, () => {
  it("shows the proxy fields when the proxy http options flag is on", () => {
    setup({ isProxyHttpOptionsEnabled: true });

    expect(screen.getByLabelText("Disable Proxy Buffering")).toBeInTheDocument();
    expect(screen.getByText("Buffer Size")).toBeInTheDocument();
  });

  it("hides the proxy fields while keeping the base http options when the flag is off", () => {
    setup({ isProxyHttpOptionsEnabled: false });

    expect(screen.getByText("Max Body Size")).toBeInTheDocument();
    expect(screen.queryByLabelText("Disable Proxy Buffering")).not.toBeInTheDocument();
    expect(screen.queryByText("Buffer Size")).not.toBeInTheDocument();
  });

  function setup(input: { isProxyHttpOptionsEnabled: boolean }) {
    const values = defaultServiceWithPlacement();
    values.services[0].expose[0].hasCustomHttpOptions = true;

    const Wrapper = () => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return (
        <TooltipProvider>
          <HttpOptionsFormControl
            control={form.control}
            serviceIndex={0}
            exposeIndex={0}
            services={values.services}
            dependencies={{ ...DEPENDENCIES, useFlag: () => input.isProxyHttpOptionsEnabled }}
          />
        </TooltipProvider>
      );
    };

    render(<Wrapper />);
    return input;
  }
});
