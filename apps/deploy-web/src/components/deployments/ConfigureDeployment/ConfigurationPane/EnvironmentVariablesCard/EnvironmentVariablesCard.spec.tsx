import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm, useFormContext, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { EnvironmentVariableType, SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types/sdlBuilder/sdlBuilder";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, EnvironmentVariablesCard } from "./EnvironmentVariablesCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(EnvironmentVariablesCard.name, () => {
  it("opens the modal when the card is clicked", async () => {
    const { openCard } = setup({ env: [] });

    await openCard();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Environment variables")).toBeInTheDocument();
  });

  it("shows an empty key/value row in the modal when opened with no variables", async () => {
    const { openCard } = setup({ env: [] });

    await openCard();

    expect(screen.getByLabelText("Environment variable 1 key")).toBeInTheDocument();
    expect(screen.getByLabelText("Environment variable 1 value")).toBeInTheDocument();
  });

  it("shows existing variables in the modal", async () => {
    const { openCard } = setup({ env: [{ key: "FOO", value: "bar" }] });

    await openCard();

    expect(screen.getByLabelText("Environment variable 1 key")).toHaveValue("FOO");
    expect(screen.getByLabelText("Environment variable 1 value")).toHaveValue("bar");
  });

  it("appends a new empty row when Add variable is clicked inside the modal", async () => {
    const { openCard } = setup({ env: [{ key: "FOO", value: "bar" }] });

    await openCard();
    await userEvent.click(screen.getByRole("button", { name: "Add variable" }));

    expect(screen.getByLabelText("Environment variable 2 key")).toBeInTheDocument();
  });

  it("updates the footer variable count live as rows are added and removed, before saving", async () => {
    const { openCard } = setup({ env: [{ key: "FOO", value: "bar" }] });

    await openCard();
    expect(screen.getByText("1 variable")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add variable" }));
    expect(screen.getByText("2 variables")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove environment variable 2" }));
    expect(screen.getByText("1 variable")).toBeInTheDocument();
  });

  it("commits changes and closes the modal on Save", async () => {
    const { getValues, openCard } = setup({ env: [] });

    await openCard();

    const keyInput = screen.getByLabelText("Environment variable 1 key");
    await userEvent.clear(keyInput);
    await userEvent.type(keyInput, "BAZ");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getValues().services[0].env?.[0]?.key).toBe("BAZ");
  });

  it("reverts changes and closes the modal on Cancel", async () => {
    const { getValues, openCard } = setup({ env: [{ key: "FOO", value: "bar" }] });

    await openCard();

    const keyInput = screen.getByLabelText("Environment variable 1 key");
    await userEvent.clear(keyInput);
    await userEvent.type(keyInput, "CHANGED");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getValues().services[0].env?.[0]?.key).toBe("FOO");
  });

  it("keeps validation errors on the rest of the form when saving an env variable", async () => {
    const { trigger, openCard } = setup({ env: [], image: "" });
    await trigger();
    await waitFor(() => expect(screen.getByTestId("image-error")).not.toBeEmptyDOMElement());

    await openCard();
    await userEvent.type(screen.getByLabelText("Environment variable 1 key"), "BAZ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("image-error")).not.toBeEmptyDOMElement();
  });

  it("keeps validation errors on the rest of the form when cancelling the env modal", async () => {
    const { trigger, openCard } = setup({ env: [{ key: "FOO", value: "bar" }], image: "" });
    await trigger();
    await waitFor(() => expect(screen.getByTestId("image-error")).not.toBeEmptyDOMElement());

    await openCard();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("image-error")).not.toBeEmptyDOMElement();
  });

  it("removes a variable when its remove control is clicked", async () => {
    const { getValues, openCard } = setup({
      env: [
        { key: "FOO", value: "bar" },
        { key: "BAZ", value: "qux" }
      ]
    });

    await openCard();
    await userEvent.click(screen.getByRole("button", { name: "Remove environment variable 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(getValues().services[0].env).toEqual([expect.objectContaining({ key: "BAZ", value: "qux" })]);
  });

  it("shows the trash icon even when only one variable is in the list", async () => {
    const { openCard } = setup({ env: [{ key: "FOO", value: "bar" }] });

    await openCard();

    expect(screen.getByRole("button", { name: "Remove environment variable 1" })).toBeInTheDocument();
  });

  it("replaces the last variable with an empty row when removed so the modal stays usable", async () => {
    const { openCard } = setup({ env: [{ key: "FOO", value: "bar" }] });

    await openCard();
    await userEvent.click(screen.getByRole("button", { name: "Remove environment variable 1" }));

    expect(screen.getByLabelText("Environment variable 1 key")).toHaveValue("");
  });

  it("does not render SSH_PUBKEY as a row in the modal", async () => {
    const { openCard } = setup({
      env: [
        { id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "abc123" },
        { key: "FOO", value: "bar" }
      ]
    });

    await openCard();

    expect(screen.getByLabelText("Environment variable 1 key")).toHaveValue("FOO");
    expect(screen.queryByDisplayValue("SSH_PUBKEY")).not.toBeInTheDocument();
  });

  it("shows an error on the key input and disables Save when a reserved key is entered", async () => {
    const { openCard } = setup({ env: [] });

    await openCard();
    await userEvent.type(screen.getByLabelText("Environment variable 1 key"), "SSH_PUBKEY");

    expect(await screen.findByText(/"SSH_PUBKEY" is a reserved variable name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("re-enables Save once a reserved key is corrected", async () => {
    const { openCard } = setup({ env: [] });

    await openCard();
    const keyInput = screen.getByLabelText("Environment variable 1 key");
    await userEvent.type(keyInput, "SSH_PUBKEY");
    await userEvent.clear(keyInput);
    await userEvent.type(keyInput, "VALID_KEY");

    expect(screen.queryByText(/"SSH_PUBKEY" is a reserved variable name/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  it("does not flag the managed SSH_PUBKEY entry as reserved", async () => {
    const { openCard } = setup({
      env: [
        { id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "abc123" },
        { key: "FOO", value: "bar" }
      ]
    });

    await openCard();

    expect(screen.queryByText(/"SSH_PUBKEY" is a reserved variable name/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  it("preserves the managed SSH_PUBKEY entry when saving the modal", async () => {
    const { getValues, openCard } = setup({
      env: [
        { id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "abc123" },
        { key: "FOO", value: "bar" }
      ]
    });

    await openCard();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(getValues().services[0].env).toContainEqual(expect.objectContaining({ id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "abc123" }));
  });

  it("opens for viewing but disables the inputs, Add and Save while locked", async () => {
    const { openCard } = setup({ env: [{ key: "FOO", value: "bar" }], locked: true });

    await openCard();

    expect(screen.getByLabelText("Environment variable 1 key")).toBeDisabled();
    expect(screen.getByLabelText("Environment variable 1 value")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add variable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  describe("pasting dotenv content into a key field", () => {
    it("creates a row per pasted KEY=value line and drops the empty row pasted into", async () => {
      const { openCard } = setup({ env: [] });

      await openCard();
      await pasteIntoKey(1, "KEY1=value1\nKEY2=value2");

      expect(keyValues()).toEqual(["KEY1", "KEY2"]);
      expect(valueValues()).toEqual(["value1", "value2"]);
    });

    it("leaves the focused key untouched when the pasted text has no equals sign", async () => {
      const { openCard } = setup({ env: [] });

      await openCard();
      await pasteIntoKey(1, "KEY1");

      expect(keyValues()).toEqual(["KEY1"]);
      expect(valueValues()).toEqual([""]);
    });

    it("skips reserved keys when pasting", async () => {
      const { openCard } = setup({ env: [] });

      await openCard();
      await pasteIntoKey(1, "SSH_PUBKEY=abc123\nFOO=bar");

      expect(keyValues()).toEqual(["FOO"]);
      expect(valueValues()).toEqual(["bar"]);
    });

    it("does not leak the raw text into the key field when every pasted line is a reserved key", async () => {
      const { openCard } = setup({ env: [] });

      await openCard();
      await pasteIntoKey(1, "SSH_PUBKEY=abc123");

      expect(keyValues()).toEqual([""]);
      expect(valueValues()).toEqual([""]);
    });

    it("updates an existing variable's value in place when its key is pasted again", async () => {
      const { openCard } = setup({ env: [{ key: "KEY1", value: "value1" }] });

      await openCard();
      await pasteIntoKey(1, "KEY1=new_value\nKEY2=value2");

      expect(keyValues()).toEqual(["KEY1", "KEY2"]);
      expect(valueValues()).toEqual(["new_value", "value2"]);
    });

    it("keeps a non-empty focused key and appends the pasted rows below it", async () => {
      const { openCard } = setup({ env: [{ key: "KEY1", value: "key1" }] });

      await openCard();
      await pasteIntoKey(1, "KEY2=key2\nKEY3=key3");

      expect(keyValues()).toEqual(["KEY1", "KEY2", "KEY3"]);
      expect(valueValues()).toEqual(["key1", "key2", "key3"]);
    });

    it("appends to previously pasted variables when pasting into a newly added row", async () => {
      const { openCard } = setup({ env: [] });

      await openCard();
      await pasteIntoKey(1, "KEY1=value1\nKEY2=value2");
      await userEvent.click(screen.getByRole("button", { name: "Add variable" }));
      await pasteIntoKey(3, "KEY3=value3");

      expect(keyValues()).toEqual(["KEY1", "KEY2", "KEY3"]);
      expect(valueValues()).toEqual(["value1", "value2", "value3"]);
    });

    it("preserves a manually typed variable when pasting into another row", async () => {
      const { openCard } = setup({ env: [] });

      await openCard();
      await userEvent.type(screen.getByLabelText("Environment variable 1 key"), "TYPED");
      await userEvent.type(screen.getByLabelText("Environment variable 1 value"), "typed_value");
      await userEvent.click(screen.getByRole("button", { name: "Add variable" }));
      await pasteIntoKey(2, "PASTED=pasted_value");

      expect(keyValues()).toEqual(["TYPED", "PASTED"]);
      expect(valueValues()).toEqual(["typed_value", "pasted_value"]);
    });

    it("splits only on the first equals sign so values may contain equals signs", async () => {
      const { openCard } = setup({ env: [] });

      await openCard();
      await pasteIntoKey(1, "URL=postgres://user:pass@host/db?ssl=true");

      expect(keyValues()).toEqual(["URL"]);
      expect(valueValues()).toEqual(["postgres://user:pass@host/db?ssl=true"]);
    });

    async function pasteIntoKey(visibleIndex: number, text: string) {
      await userEvent.click(screen.getByLabelText(`Environment variable ${visibleIndex} key`));
      await userEvent.paste(text);
    }

    function keyValues() {
      return screen.getAllByLabelText<HTMLInputElement>(/^Environment variable \d+ key$/).map(el => el.value);
    }

    function valueValues() {
      return screen.getAllByLabelText<HTMLInputElement>(/^Environment variable \d+ value$/).map(el => el.value);
    }
  });

  function setup(input: { env?: Array<Partial<EnvironmentVariableType>>; image?: string; locked?: boolean }) {
    const env = input.env?.map(e => ({ key: "", value: "", isSecret: false, ...e })) ?? [];

    const values = defaultServiceWithPlacement({ env, ...(input.image !== undefined ? { image: input.image } : {}) });

    let form: UseFormReturn<SdlBuilderFormValuesType> | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange", resolver: zodResolver(SdlBuilderFormValuesSchema) });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <EnvironmentVariablesCard serviceIndex={0} locked={input.locked} dependencies={{ ...DEPENDENCIES }} />
        <ImageErrorProbe serviceIndex={0} />
      </Wrapper>
    );

    return {
      getValues: () => (form as UseFormReturn<SdlBuilderFormValuesType>).getValues(),
      trigger: () => (form as UseFormReturn<SdlBuilderFormValuesType>).trigger(),
      openCard: () => userEvent.click(screen.getByText(/^Environment Variables/))
    };
  }
});

/** Surfaces a service's image validation error in the DOM so tests can assert it survives env edits. */
function ImageErrorProbe({ serviceIndex }: { serviceIndex: number }) {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { errors } = useFormState({ control, name: `services.${serviceIndex}.image` });
  const message = errors.services?.[serviceIndex]?.image?.message;
  return <div data-testid="image-error">{message ?? ""}</div>;
}
