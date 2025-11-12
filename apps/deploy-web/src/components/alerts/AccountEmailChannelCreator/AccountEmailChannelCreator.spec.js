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
var faker_1 = require("@faker-js/faker");
var AccountEmailChannelCreator_1 = require("@src/components/alerts/AccountEmailChannelCreator/AccountEmailChannelCreator");
var react_1 = require("@testing-library/react");
describe("AccountEmailChannelCreateTrigger", function () {
    it("renders with the correct button text", function () {
        var button = setup().button;
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent("Use my account email");
    });
    it("calls create function with correct parameters when clicked", function () {
        var _a = setup(), button = _a.button, props = _a.props;
        react_1.fireEvent.click(button);
        expect(props.create).toHaveBeenCalledTimes(1);
        expect(props.create).toHaveBeenCalledWith({
            name: "Primary account email",
            emails: [props.email]
        });
    });
    it("passes the correct email to the create function", function () {
        var customEmail = faker_1.faker.internet.email();
        var _a = setup({ email: customEmail }), button = _a.button, props = _a.props;
        react_1.fireEvent.click(button);
        expect(props.create).toHaveBeenCalledWith({
            name: "Primary account email",
            emails: [customEmail]
        });
    });
    it("doesnt call create function when isLoading is true", function () {
        var _a = setup({ isLoading: true }), button = _a.button, props = _a.props;
        react_1.fireEvent.click(button);
        expect(props.create).not.toHaveBeenCalled();
    });
    it("properly passes loading state to LoadingButton", function () {
        var propsNotLoading = setup({ isLoading: false }).props;
        expect(propsNotLoading.isLoading).toBe(false);
        var propsLoading = setup({ isLoading: true }).props;
        expect(propsLoading.isLoading).toBe(true);
    });
    function setup(props) {
        if (props === void 0) { props = {}; }
        var defaultProps = __assign({ isLoading: false, create: jest.fn(), email: faker_1.faker.internet.email() }, props);
        var testId = faker_1.faker.string.uuid();
        var utils = (0, react_1.render)(<AccountEmailChannelCreator_1.AccountEmailChannelCreateTrigger {...defaultProps} testId={testId}/>);
        var button = react_1.screen.getByTestId(testId);
        return __assign(__assign({}, utils), { button: button, props: defaultProps });
    }
});
