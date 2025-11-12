"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_hook_form_1 = require("react-hook-form");
var NotificationChannelSelect_1 = require("./NotificationChannelSelect");
var react_1 = require("@testing-library/react");
var notificationChannel_1 = require("@tests/seeders/notificationChannel");
describe(NotificationChannelSelect_1.NotificationChannelSelectView.name, function () {
    it("renders select with placeholder when no data", function () {
        setup({ data: [] });
        expect(react_1.screen.queryByLabelText("Notification Channel")).toBeInTheDocument();
        expect(react_1.screen.queryByText("Select notification channel")).toBeInTheDocument();
    });
    it("renders select trigger when data is provided", function () {
        setup();
        expect(react_1.screen.queryByLabelText("Notification Channel")).toBeInTheDocument();
    });
    it("disables select when disabled prop is true", function () {
        setup({ disabled: true });
        var selectTrigger = react_1.screen.getByLabelText("Notification Channel");
        expect(selectTrigger).toBeDisabled();
    });
    it("shows error state when field has error", function () {
        setup({ fieldError: "Notification Channel is required" });
        var selectTrigger = react_1.screen.getByLabelText("Notification Channel");
        var label = react_1.screen.getByText("Notification Channel");
        expect(selectTrigger).toHaveClass("border-red-500");
        expect(react_1.screen.queryByText("Notification Channel is required")).toBeInTheDocument();
        expect(label).toHaveClass("cursor-not-allowed");
    });
    it("renders add notification channel link", function () {
        setup();
        var addLink = react_1.screen.getByRole("link", { name: "Add notification channel" });
        expect(addLink).toHaveAttribute("href", "/alerts/notification-channels/new");
    });
    it("disables add link when disabled prop is true", function () {
        setup({ disabled: true });
        var addLink = react_1.screen.getByRole("link", { name: "Add notification channel" });
        expect(addLink).toHaveClass("opacity-10");
        expect(addLink).toHaveClass("cursor-not-allowed");
    });
    function setup(input) {
        if (input === void 0) { input = {}; }
        var notificationChannels = [(0, notificationChannel_1.buildNotificationChannel)({ name: "Email: alice@example.com" }), (0, notificationChannel_1.buildNotificationChannel)({ name: "Email: bob@example.com" })];
        var Wrapper = function (_a) {
            var children = _a.children;
            var methods = (0, react_hook_form_1.useForm)({
                defaultValues: { notificationChannelId: "" },
                mode: "onChange"
            });
            if (input.fieldError) {
                methods.setError("notificationChannelId", { message: input.fieldError });
            }
            return <react_hook_form_1.FormProvider {...methods}>{children}</react_hook_form_1.FormProvider>;
        };
        (0, react_1.render)(<Wrapper>
        <NotificationChannelSelect_1.NotificationChannelSelectView name="notificationChannelId" data={input.data || notificationChannels} isFetched={true} disabled={input.disabled}/>
      </Wrapper>);
        return { notificationChannels: notificationChannels };
    }
});
