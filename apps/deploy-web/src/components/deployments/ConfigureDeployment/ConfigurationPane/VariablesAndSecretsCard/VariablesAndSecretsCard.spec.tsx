import type { PropsWithChildren } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import type { EnvironmentVariableType, SdlBuilderFormValuesType } from "@src/types";
import { RESERVED_ENV_VALUE_MESSAGE, SdlBuilderFormValuesSchema, SECRET_NAME_MESSAGE } from "@src/types/sdlBuilder/sdlBuilder";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { VariablesAndSecretsCard } from "./VariablesAndSecretsCard";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(VariablesAndSecretsCard.name, () => {
  it("shows the empty state and no rows when the service has no variables", () => {
    setup({ env: [] });

    expect(screen.getByText(/Nothing set yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Environment variable 1 key")).not.toBeInTheDocument();
  });

  it("adds a plain variable row from the Add menu", async () => {
    const { getValues } = setup({ env: [] });

    await addFromMenu(/^Environment Variable/);

    expect(screen.getByLabelText("Environment variable 1 key")).toBeInTheDocument();
    expect(screen.getByLabelText("Environment variable 1 value")).toHaveAttribute("type", "text");
    expect(getValues().services[0].env?.[0]).toMatchObject({ key: "", value: "", isSecret: false });
  });

  it("adds a secret row from the Add menu, whose value stays masked", async () => {
    const { getValues } = setup({ env: [] });

    await addFromMenu(/^Secret/);

    expect(screen.getByLabelText("Environment variable 1 value")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Environment variable 1 value")).toHaveAttribute("placeholder", "Secret value");
    expect(getValues().services[0].env?.[0]).toMatchObject({ isSecret: true });
  });

  it("describes both kinds in the Add menu", async () => {
    setup({ env: [] });

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Plain key/value, visible in the SDL")).toBeInTheDocument();
    expect(screen.getByText("Value stays masked, encrypted at rest")).toBeInTheDocument();
  });

  it("shows existing variables with their values and masks a secret's", () => {
    setup({
      env: [
        { key: "PORT", value: "80" },
        { key: "API_KEY", value: "hunter2", isSecret: true }
      ]
    });

    expect(screen.getByLabelText("Environment variable 1 value")).toHaveValue("80");
    expect(screen.getByLabelText("Environment variable 2 value")).toHaveValue("hunter2");
    expect(screen.getByLabelText("Environment variable 2 value")).toHaveAttribute("type", "password");
  });

  it("reveals and hides a secret value with the eye toggle", async () => {
    setup({ env: [{ key: "API_KEY", value: "hunter2", isSecret: true }] });

    await userEvent.click(screen.getByRole("button", { name: "Show Environment variable 1 value" }));
    expect(screen.getByLabelText("Environment variable 1 value")).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Hide Environment variable 1 value" }));
    expect(screen.getByLabelText("Environment variable 1 value")).toHaveAttribute("type", "password");
  });

  it("turns a plain variable into a secret and keeps its value", async () => {
    const { getValues } = setup({ env: [{ key: "TOKEN", value: "abc" }] });

    await userEvent.click(screen.getByRole("button", { name: "Make Environment variable 1 a secret" }));

    expect(getValues().services[0].env?.[0]).toMatchObject({ key: "TOKEN", value: "abc", isSecret: true });
    expect(screen.getByLabelText("Environment variable 1 value")).toHaveAttribute("type", "password");
  });

  it("turns a secret back into a plain variable, showing its value", async () => {
    const { getValues } = setup({ env: [{ key: "TOKEN", value: "abc", isSecret: true }] });

    await userEvent.click(screen.getByRole("button", { name: "Make Environment variable 1 a plain variable" }));

    expect(getValues().services[0].env?.[0]).toMatchObject({ key: "TOKEN", value: "abc", isSecret: false });
    expect(screen.getByLabelText("Environment variable 1 value")).toHaveAttribute("type", "text");
  });

  it("drops a kept reference when its row becomes a plain variable, since a reference cannot stand as a value", async () => {
    const { getValues } = setup({ env: [{ key: "DB_URL", value: "ac-secret://DB_URL", isSecret: true }] });

    await userEvent.click(screen.getByRole("button", { name: "Make Environment variable 1 a plain variable" }));

    expect(getValues().services[0].env?.[0]).toMatchObject({ key: "DB_URL", value: "", isSecret: false });
  });

  it("shows a kept secret as a placeholder with a hint rather than its reference", () => {
    setup({ env: [{ key: "DB_URL", value: "ac-secret://DB_URL", isSecret: true }] });

    expect(screen.getByLabelText("Environment variable 1 value")).toHaveValue("");
    expect(screen.getByLabelText("Environment variable 1 value")).toHaveAttribute("placeholder", "Kept from the SDL. Type to replace.");
    expect(screen.getByText("The value was not included. Enter it before requesting quotes.")).toBeInTheDocument();
  });

  it("replaces a kept reference with what the user types", async () => {
    const { getValues } = setup({ env: [{ key: "DB_URL", value: "ac-secret://DB_URL", isSecret: true }] });

    await userEvent.type(screen.getByLabelText("Environment variable 1 value"), "pg");

    expect(getValues().services[0].env?.[0]?.value).toBe("pg");
    expect(screen.queryByText("The value was not included. Enter it before requesting quotes.")).not.toBeInTheDocument();
  });

  it("counts the visible variables in the header and the secrets in the footer", () => {
    setup({
      env: [
        { key: "PORT", value: "80" },
        { key: "API_KEY", value: "a", isSecret: true },
        { key: "DB_URL", value: "b", isSecret: true }
      ]
    });

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2 secrets encrypted at rest")).toBeInTheDocument();
  });

  it("uses the singular for one secret and no footer without any", () => {
    setup({ env: [{ key: "API_KEY", value: "a", isSecret: true }] });
    expect(screen.getByText("1 secret encrypted at rest")).toBeInTheDocument();
  });

  it("removes a row and shows the empty state again when the last one goes", async () => {
    const { getValues } = setup({ env: [{ key: "PORT", value: "80" }] });

    await userEvent.click(screen.getByRole("button", { name: "Remove Environment variable 1" }));

    expect(getValues().services[0].env).toEqual([]);
    expect(screen.getByText(/Nothing set yet/)).toBeInTheDocument();
  });

  it("does not list the managed SSH_PUBKEY entry", () => {
    setup({
      env: [
        { id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "ssh-rsa AAA" },
        { key: "PORT", value: "80" }
      ]
    });

    expect(screen.getAllByLabelText(/^Environment variable \d+ key$/)).toHaveLength(1);
    expect(screen.getByLabelText("Environment variable 1 key")).toHaveValue("PORT");
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("disables the inputs, toggles and the Add menu while locked", () => {
    setup({ env: [{ key: "API_KEY", value: "a", isSecret: true }], locked: true });

    expect(screen.getByLabelText("Environment variable 1 key")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Make Environment variable 1 a plain variable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("flags a plain value that opens with the reference prefix", async () => {
    setup({ env: [{ key: "FOO", value: "" }] });

    await userEvent.type(screen.getByLabelText("Environment variable 1 value"), "ac-milan");

    await waitFor(() => expect(screen.getByText(RESERVED_ENV_VALUE_MESSAGE)).toBeInTheDocument());
  });

  it("flags a typed secret whose key cannot spell a reference name", async () => {
    setup({ env: [{ key: "", value: "hunter2", isSecret: true }] });

    await userEvent.type(screen.getByLabelText("Environment variable 1 key"), "my.var");

    await waitFor(() => expect(screen.getByText(SECRET_NAME_MESSAGE)).toBeInTheDocument());
  });

  describe("pasting dotenv content into a key field", () => {
    it("creates a row per pasted KEY=value line with the kind of the row pasted into, dropping the empty row", async () => {
      const { getValues } = setup({ env: [{ key: "", value: "", isSecret: true }] });

      await pasteIntoKey(1, "KEY1=value1\nKEY2=value2");

      expect(keyValues()).toEqual(["KEY1", "KEY2"]);
      expect(getValues().services[0].env?.map(variable => variable.isSecret)).toEqual([true, true]);
    });

    it("updates an existing variable's value in place when its key is pasted again", async () => {
      setup({ env: [{ key: "KEY1", value: "value1" }] });

      await pasteIntoKey(1, "KEY1=new_value\nKEY2=value2");

      expect(keyValues()).toEqual(["KEY1", "KEY2"]);
      expect(valueValues()).toEqual(["new_value", "value2"]);
    });

    it("skips reserved keys and leaves the focused key untouched when nothing was pasted", async () => {
      setup({ env: [{ key: "", value: "" }] });

      await pasteIntoKey(1, "SSH_PUBKEY=abc123");

      expect(keyValues()).toEqual([""]);
    });

    it("splits only on the first equals sign so values may contain equals signs", async () => {
      setup({ env: [{ key: "", value: "" }] });

      await pasteIntoKey(1, "URL=postgres://user:pass@host/db?ssl=true");

      expect(valueValues()).toEqual(["postgres://user:pass@host/db?ssl=true"]);
    });

    it("marks an existing plain variable secret when a secret row pastes its key", async () => {
      const { getValues } = setup({
        env: [
          { key: "API_KEY", value: "" },
          { key: "", value: "", isSecret: true }
        ]
      });

      await pasteIntoKey(2, "API_KEY=hunter2");

      expect(getValues().services[0].env).toEqual([expect.objectContaining({ key: "API_KEY", value: "hunter2", isSecret: true })]);
    });

    it("leaves an existing secret secret when a plain row pastes its key", async () => {
      const { getValues } = setup({
        env: [
          { key: "API_KEY", value: "old", isSecret: true },
          { key: "", value: "" }
        ]
      });

      await pasteIntoKey(2, "API_KEY=hunter2");

      expect(getValues().services[0].env).toEqual([expect.objectContaining({ key: "API_KEY", value: "hunter2", isSecret: true })]);
    });

    it("leaves a kept secret reference standing when a pasted line carries no value", async () => {
      const { getValues } = setup({
        env: [
          { key: "DB_PASS", value: "ac-secret://DB_PASS", isSecret: true },
          { key: "", value: "" }
        ]
      });

      await pasteIntoKey(2, "DB_PASS=");

      expect(getValues().services[0].env).toEqual([expect.objectContaining({ key: "DB_PASS", value: "ac-secret://DB_PASS", isSecret: true })]);
    });

    async function pasteIntoKey(visibleIndex: number, text: string) {
      await userEvent.click(screen.getByLabelText(`Environment variable ${visibleIndex} key`));
      await userEvent.paste(text);
    }

    function keyValues() {
      return screen.getAllByLabelText<HTMLInputElement>(/^Environment variable \d+ key$/).map(element => element.value);
    }

    function valueValues() {
      return screen.getAllByLabelText<HTMLInputElement>(/^Environment variable \d+ value$/).map(element => element.value);
    }
  });

  async function addFromMenu(name: RegExp) {
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await userEvent.click(await screen.findByRole("menuitem", { name }));
  }

  function setup(input: { env: Array<Partial<EnvironmentVariableType>>; locked?: boolean }) {
    const env = input.env.map(variable => ({ id: variable.key || "row", key: "", value: "", isSecret: false, ...variable }));
    const values = defaultServiceWithPlacement({ env });

    let form: UseFormReturn<SdlBuilderFormValuesType> | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange", resolver: zodResolver(SdlBuilderFormValuesSchema) });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <VariablesAndSecretsCard serviceIndex={0} locked={input.locked} />
      </Wrapper>
    );

    return { getValues: () => (form as UseFormReturn<SdlBuilderFormValuesType>).getValues() };
  }
});
