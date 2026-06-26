import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { CommandsCard, DEPENDENCIES } from "./CommandsCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(CommandsCard.name, () => {
  it("opens the modal when the card is clicked", async () => {
    const { openCard } = setup({ command: "bash -c", arg: "echo hi" });

    await openCard();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Command")).toHaveValue("bash -c");
    expect(screen.getByLabelText("Arguments")).toHaveValue("echo hi");
  });

  it("commits the command and arguments on Save", async () => {
    const { getValues, openCard } = setup({});

    await openCard();
    await userEvent.type(screen.getByLabelText("Command"), "sh");
    await userEvent.type(screen.getByLabelText("Arguments"), "apt-get update");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getValues().services[0].command?.command).toBe("sh");
    expect(getValues().services[0].command?.arg).toBe("apt-get update");
  });

  it("reverts changes and closes the modal on Cancel", async () => {
    const { getValues, openCard } = setup({ command: "bash -c" });

    await openCard();
    await userEvent.type(screen.getByLabelText("Command"), " changed");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getValues().services[0].command?.command).toBe("bash -c");
  });

  it("preserves newlines in the command", async () => {
    const { getValues, openCard } = setup({});

    await openCard();
    await userEvent.type(screen.getByLabelText("Command"), "sh{Enter}-c");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(getValues().services[0].command?.command).toBe("sh\n-c");
  });

  it("opens for viewing but disables the inputs and Save while locked", async () => {
    const { openCard } = setup({ command: "bash -c", arg: "echo hi", locked: true });

    await openCard();

    expect(screen.getByLabelText("Command")).toBeDisabled();
    expect(screen.getByLabelText("Arguments")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  function setup(input: { command?: string; arg?: string; locked?: boolean }) {
    const values = defaultServiceWithPlacement({ command: { command: input.command ?? "", arg: input.arg ?? "" } });

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange" });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <CommandsCard serviceIndex={0} locked={input.locked} dependencies={{ ...DEPENDENCIES }} />
      </Wrapper>
    );

    return {
      getValues: () => getValues(),
      openCard: () => userEvent.click(screen.getByText("Commands"))
    };
  }
});
