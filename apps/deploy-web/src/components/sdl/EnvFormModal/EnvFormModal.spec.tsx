import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";

import { protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { EnvFormModalProps } from "./EnvFormModal";
import { COMPONENTS, EnvFormModal } from "./EnvFormModal";

import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ComponentMock } from "@tests/unit/mocks";

describe(EnvFormModal.name, () => {
  it("renders with initial environment variables", () => {
    setup({
      envs: [{ key: "TEST_KEY", value: "test_value", isSecret: false }]
    });

    expect(screen.getByText("Edit Environment Variables")).toBeInTheDocument();
    expect(screen.getByLabelText("Key")).toHaveValue("TEST_KEY");
    expect(screen.getByLabelText("Value")).toHaveValue("test_value");
  });

  it("adds a new environment variable when clicking 'Add Variable' button", () => {
    setup({
      envs: []
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Variable/i }));
    fireEvent.click(screen.getByRole("button", { name: /Add Variable/i }));

    const keyInputs = screen.getAllByLabelText("Key");
    const valueInputs = screen.getAllByLabelText("Value");

    expect(keyInputs).toHaveLength(3); // one added by component if there are no environment variables
    expect(valueInputs).toHaveLength(3);
  });

  it("removes environment variable when clicking delete button", () => {
    setup({
      envs: [
        { key: "KEY1", value: "value1", isSecret: false },
        { key: "KEY2", value: "value2", isSecret: false }
      ]
    });

    const deleteButtons = screen.getAllByRole("button", { name: /Delete Environment Variable/i });
    fireEvent.click(deleteButtons[0]);

    expect(screen.queryAllByLabelText<HTMLInputElement>("Key").map(el => el.value)).toEqual(["KEY2"]);
    expect(screen.queryAllByLabelText<HTMLInputElement>("Value").map(el => el.value)).toEqual(["value2"]);
  });

  it("toggles secret variable switch", () => {
    let formRef: EnvFormModalForm | undefined;

    setup({
      formRef: form => {
        formRef = form;
      },
      envs: [
        { key: "TEST_KEY", value: "test_value", isSecret: false },
        { key: "TEST_KEY2", value: "test_value2", isSecret: true }
      ],
      hasSecretOption: true
    });

    const secretSwitch = screen.getAllByRole("switch");

    fireEvent.click(secretSwitch[0]);
    fireEvent.click(secretSwitch[1]);

    expect(formRef?.getValues().services[0].env).toEqual([
      { key: "TEST_KEY", value: "test_value", isSecret: true },
      { key: "TEST_KEY2", value: "test_value2", isSecret: false }
    ]);
  });

  it("calls onClose when clicking Close button", () => {
    const onClose = jest.fn();
    setup({
      onClose,
      envs: [{ key: "TEST_KEY", value: "test_value", isSecret: false }]
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Close/i })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("clears empty environment variables on close", () => {
    let formRef: EnvFormModalForm | undefined;
    setup({
      formRef: form => {
        formRef = form;
      },
      envs: [
        { key: "KEY1", value: "value1", isSecret: false },
        { key: "", value: "", isSecret: false },
        { key: "", value: "test_value", isSecret: false }
      ]
    });

    expect(formRef?.getValues().services[0].env).toEqual([
      { key: "KEY1", value: "value1", isSecret: false },
      { key: "", value: "", isSecret: false },
      { key: "", value: "test_value", isSecret: false }
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: /Close/i })[0]);

    expect(formRef?.getValues().services[0].env).toEqual([{ key: "KEY1", value: "value1", isSecret: false }]);
  });

  it("adds new environment variable row after rendering if no environment variables are present", () => {
    setup({
      envs: []
    });

    expect(screen.getAllByLabelText("Key")).toHaveLength(1);
  });

  describe("pasting multiple environment variables", () => {
    it("allows to paste multiple environment variables", () => {
      setup({
        envs: []
      });

      const keyInput = screen.getByLabelText("Key");
      const pasteData = "KEY1=value1\nKEY2=value2";

      keyInput.focus();
      userEvent.paste(pasteData);

      expect(screen.getAllByLabelText<HTMLInputElement>("Key").map(el => el.value)).toEqual(["KEY1", "KEY2"]);
      expect(screen.getAllByLabelText<HTMLInputElement>("Value").map(el => el.value)).toEqual(["value1", "value2"]);
    });

    it("pastes single environment variable if clipboard data doesn't contain an equal sign", () => {
      setup({
        envs: []
      });

      const keyInput = screen.getByLabelText("Key");
      const pasteData = "KEY1";

      keyInput.focus();
      userEvent.paste(pasteData);

      expect(keyInput).toHaveValue("KEY1");
      expect(screen.getByLabelText("Value")).toHaveValue("");
      expect(screen.getAllByLabelText("Key")).toHaveLength(1);
      expect(screen.getAllByLabelText("Value")).toHaveLength(1);
    });

    it("does not paste environment variable if it's a protected variable", () => {
      setup({
        envs: []
      });

      const keyInput = screen.getByLabelText("Key");
      const pasteData = [`${protectedEnvironmentVariables.BRANCH_NAME}=BRANCH`, `TEST_KEY=test_value`].join("\n");

      keyInput.focus();
      userEvent.paste(pasteData);

      expect(screen.getAllByLabelText<HTMLInputElement>("Key").map(el => el.value)).toEqual(["TEST_KEY"]);
      expect(screen.getAllByLabelText<HTMLInputElement>("Value").map(el => el.value)).toEqual(["test_value"]);
    });

    it("updates existing environment variable if it already exists", () => {
      setup({
        envs: [{ key: "KEY1", value: "value1", isSecret: false }]
      });

      const keyInput = screen.getByLabelText("Key");
      const pasteData = [`KEY1=new_value`, "KEY2=value2"].join("\n");

      keyInput.focus();
      userEvent.paste(pasteData);

      expect(screen.getAllByLabelText<HTMLInputElement>("Key").map(el => el.value)).toEqual(["KEY1", "KEY2"]);
      expect(screen.getAllByLabelText<HTMLInputElement>("Value").map(el => el.value)).toEqual(["new_value", "value2"]);
    });

    it("does not change the content of the Key input if the value is not empty", () => {
      setup({
        envs: [{ key: "KEY1", value: "key1", isSecret: false }]
      });

      const keyInput = screen.getByLabelText("Key");
      const pasteData = [`KEY2=key2`, "KEY3=key3"].join("\n");

      keyInput.focus();
      userEvent.paste(pasteData);

      expect(screen.getAllByLabelText<HTMLInputElement>("Key").map(el => el.value)).toEqual(["KEY1", "KEY2", "KEY3"]);
      expect(screen.getAllByLabelText<HTMLInputElement>("Value").map(el => el.value)).toEqual(["key1", "key2", "key3"]);
    });
  });

  function setup(input: Partial<Omit<EnvFormModalWrapperProps, "components">>) {
    const props: EnvFormModalWrapperProps = {
      onClose: () => {},
      serviceIndex: 0,
      envs: [],
      components: { ...COMPONENTS, CustomNoDivTooltip: ComponentMock },
      formRef: () => {},
      ...input
    };
    return render(<EnvFormModalWrapper {...props} />);
  }

  type EnvFormModalForm = UseFormReturn<SdlBuilderFormValuesType>;
  type EnvFormModalWrapperProps = Omit<EnvFormModalProps, "control"> & { formRef: (form: EnvFormModalForm) => void };
  function EnvFormModalWrapper(props: EnvFormModalWrapperProps) {
    const form = useForm<SdlBuilderFormValuesType>();
    // `isMounted` state is needed to ensure that props provided value is set as form value
    // before child component mounted `useEffect` is called which adds new environment variable row
    // if there are no environment variables
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
      form.setValue("services.0.env", props.envs);
      setIsMounted(true);
    }, []);
    useEffect(() => {
      props.formRef(form);
    }, [form]);

    return isMounted ? <EnvFormModal {...props} control={form.control} /> : null;
  }
});
