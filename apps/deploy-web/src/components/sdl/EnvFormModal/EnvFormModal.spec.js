"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var remote_deploy_config_1 = require("@src/config/remote-deploy.config");
var EnvFormModal_1 = require("./EnvFormModal");
var react_2 = require("@testing-library/react");
var user_event_1 = require("@testing-library/user-event");
var mocks_1 = require("@tests/unit/mocks");
describe(EnvFormModal_1.EnvFormModal.name, function () {
    it("renders with initial environment variables", function () {
        setup({
            envs: [{ key: "TEST_KEY", value: "test_value", isSecret: false }]
        });
        expect(react_2.screen.getByText("Edit Environment Variables")).toBeInTheDocument();
        expect(react_2.screen.getByLabelText("Key")).toHaveValue("TEST_KEY");
        expect(react_2.screen.getByLabelText("Value")).toHaveValue("test_value");
    });
    it("adds a new environment variable when clicking 'Add Variable' button", function () {
        setup({
            envs: []
        });
        react_2.fireEvent.click(react_2.screen.getByRole("button", { name: /Add Variable/i }));
        react_2.fireEvent.click(react_2.screen.getByRole("button", { name: /Add Variable/i }));
        var keyInputs = react_2.screen.getAllByLabelText("Key");
        var valueInputs = react_2.screen.getAllByLabelText("Value");
        expect(keyInputs).toHaveLength(3); // one added by component if there are no environment variables
        expect(valueInputs).toHaveLength(3);
    });
    it("removes environment variable when clicking delete button", function () {
        setup({
            envs: [
                { key: "KEY1", value: "value1", isSecret: false },
                { key: "KEY2", value: "value2", isSecret: false }
            ]
        });
        var deleteButtons = react_2.screen.getAllByRole("button", { name: /Delete Environment Variable/i });
        react_2.fireEvent.click(deleteButtons[0]);
        expect(react_2.screen.queryAllByLabelText("Key").map(function (el) { return el.value; })).toEqual(["KEY2"]);
        expect(react_2.screen.queryAllByLabelText("Value").map(function (el) { return el.value; })).toEqual(["value2"]);
    });
    it("toggles secret variable switch", function () {
        var formRef;
        setup({
            formRef: function (form) {
                formRef = form;
            },
            envs: [
                { key: "TEST_KEY", value: "test_value", isSecret: false },
                { key: "TEST_KEY2", value: "test_value2", isSecret: true }
            ],
            hasSecretOption: true
        });
        var secretSwitch = react_2.screen.getAllByRole("switch");
        react_2.fireEvent.click(secretSwitch[0]);
        react_2.fireEvent.click(secretSwitch[1]);
        expect(formRef === null || formRef === void 0 ? void 0 : formRef.getValues().services[0].env).toEqual([
            { key: "TEST_KEY", value: "test_value", isSecret: true },
            { key: "TEST_KEY2", value: "test_value2", isSecret: false }
        ]);
    });
    it("calls onClose when clicking Close button", function () {
        var onClose = jest.fn();
        setup({
            onClose: onClose,
            envs: [{ key: "TEST_KEY", value: "test_value", isSecret: false }]
        });
        react_2.fireEvent.click(react_2.screen.getAllByRole("button", { name: /Close/i })[0]);
        expect(onClose).toHaveBeenCalled();
    });
    it("clears empty environment variables on close", function () {
        var formRef;
        setup({
            formRef: function (form) {
                formRef = form;
            },
            envs: [
                { key: "KEY1", value: "value1", isSecret: false },
                { key: "", value: "", isSecret: false },
                { key: "", value: "test_value", isSecret: false }
            ]
        });
        expect(formRef === null || formRef === void 0 ? void 0 : formRef.getValues().services[0].env).toEqual([
            { key: "KEY1", value: "value1", isSecret: false },
            { key: "", value: "", isSecret: false },
            { key: "", value: "test_value", isSecret: false }
        ]);
        react_2.fireEvent.click(react_2.screen.getAllByRole("button", { name: /Close/i })[0]);
        expect(formRef === null || formRef === void 0 ? void 0 : formRef.getValues().services[0].env).toEqual([{ key: "KEY1", value: "value1", isSecret: false }]);
    });
    it("adds new environment variable row after rendering if no environment variables are present", function () {
        setup({
            envs: []
        });
        expect(react_2.screen.getAllByLabelText("Key")).toHaveLength(1);
    });
    describe("pasting multiple environment variables", function () {
        it("allows to paste multiple environment variables", function () {
            setup({
                envs: []
            });
            var keyInput = react_2.screen.getByLabelText("Key");
            var pasteData = "KEY1=value1\nKEY2=value2";
            keyInput.focus();
            user_event_1.userEvent.paste(pasteData);
            expect(react_2.screen.getAllByLabelText("Key").map(function (el) { return el.value; })).toEqual(["KEY1", "KEY2"]);
            expect(react_2.screen.getAllByLabelText("Value").map(function (el) { return el.value; })).toEqual(["value1", "value2"]);
        });
        it("pastes single environment variable if clipboard data doesn't contain an equal sign", function () {
            setup({
                envs: []
            });
            var keyInput = react_2.screen.getByLabelText("Key");
            var pasteData = "KEY1";
            keyInput.focus();
            user_event_1.userEvent.paste(pasteData);
            expect(keyInput).toHaveValue("KEY1");
            expect(react_2.screen.getByLabelText("Value")).toHaveValue("");
            expect(react_2.screen.getAllByLabelText("Key")).toHaveLength(1);
            expect(react_2.screen.getAllByLabelText("Value")).toHaveLength(1);
        });
        it("does not paste environment variable if it's a protected variable", function () {
            setup({
                envs: []
            });
            var keyInput = react_2.screen.getByLabelText("Key");
            var pasteData = ["".concat(remote_deploy_config_1.protectedEnvironmentVariables.BRANCH_NAME, "=BRANCH"), "TEST_KEY=test_value"].join("\n");
            keyInput.focus();
            user_event_1.userEvent.paste(pasteData);
            expect(react_2.screen.getAllByLabelText("Key").map(function (el) { return el.value; })).toEqual(["TEST_KEY"]);
            expect(react_2.screen.getAllByLabelText("Value").map(function (el) { return el.value; })).toEqual(["test_value"]);
        });
        it("updates existing environment variable if it already exists", function () {
            setup({
                envs: [{ key: "KEY1", value: "value1", isSecret: false }]
            });
            var keyInput = react_2.screen.getByLabelText("Key");
            var pasteData = ["KEY1=new_value", "KEY2=value2"].join("\n");
            keyInput.focus();
            user_event_1.userEvent.paste(pasteData);
            expect(react_2.screen.getAllByLabelText("Key").map(function (el) { return el.value; })).toEqual(["KEY1", "KEY2"]);
            expect(react_2.screen.getAllByLabelText("Value").map(function (el) { return el.value; })).toEqual(["new_value", "value2"]);
        });
        it("does not change the content of the Key input if the value is not empty", function () {
            setup({
                envs: [{ key: "KEY1", value: "key1", isSecret: false }]
            });
            var keyInput = react_2.screen.getByLabelText("Key");
            var pasteData = ["KEY2=key2", "KEY3=key3"].join("\n");
            keyInput.focus();
            user_event_1.userEvent.paste(pasteData);
            expect(react_2.screen.getAllByLabelText("Key").map(function (el) { return el.value; })).toEqual(["KEY1", "KEY2", "KEY3"]);
            expect(react_2.screen.getAllByLabelText("Value").map(function (el) { return el.value; })).toEqual(["key1", "key2", "key3"]);
        });
    });
    function setup(input) {
        var props = __assign({ onClose: function () { }, serviceIndex: 0, envs: [], components: __assign(__assign({}, EnvFormModal_1.COMPONENTS), { CustomNoDivTooltip: mocks_1.ComponentMock }), formRef: function () { } }, input);
        return (0, react_2.render)(<EnvFormModalWrapper {...props}/>);
    }
    function EnvFormModalWrapper(props) {
        var form = (0, react_hook_form_1.useForm)();
        // `isMounted` state is needed to ensure that props provided value is set as form value
        // before child component mounted `useEffect` is called which adds new environment variable row
        // if there are no environment variables
        var _a = (0, react_1.useState)(false), isMounted = _a[0], setIsMounted = _a[1];
        (0, react_1.useEffect)(function () {
            form.setValue("services.0.env", props.envs);
            setIsMounted(true);
        }, []);
        (0, react_1.useEffect)(function () {
            props.formRef(form);
        }, [form]);
        return isMounted ? <EnvFormModal_1.EnvFormModal {...props} control={form.control}/> : null;
    }
});
