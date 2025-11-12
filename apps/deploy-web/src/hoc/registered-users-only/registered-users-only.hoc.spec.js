"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var client_1 = require("@auth0/nextjs-auth0/client");
var faker_1 = require("@faker-js/faker");
var registered_users_only_hoc_1 = require("./registered-users-only.hoc");
var react_2 = require("@testing-library/react");
describe("RegisteredUsersOnly", function () {
    it("renders the wrapped component when user is registered", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup({ isRegistered: true });
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(react_2.screen.getByTestId("test-component")).toBeInTheDocument();
                            expect(react_2.screen.getByText("Test Component Content")).toBeInTheDocument();
                            expect(react_2.screen.queryByTestId("fallback")).not.toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("renders fallback component when user is not registered", function () {
        setup({ isRegistered: false });
        expect(react_2.screen.getByTestId("fallback")).toBeInTheDocument();
        expect(react_2.screen.getByText("Default Fallback Content")).toBeInTheDocument();
        expect(react_2.screen.queryByTestId("test-component")).not.toBeInTheDocument();
    });
    it("passes props to the wrapped component", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup({
                        isRegistered: true,
                        props: { testProp: "test-value" }
                    });
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(react_2.screen.getByTestId("test-component")).toBeInTheDocument();
                            expect(react_2.screen.getByTestId("test-prop")).toBeInTheDocument();
                            expect(react_2.screen.getByText("test-value")).toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("sets the correct displayName", function () {
        var _a = setup({ isRegistered: true }), TestComponent = _a.TestComponent, FallbackComponent = _a.FallbackComponent;
        var WrappedComponent = (0, registered_users_only_hoc_1.RegisteredUsersOnly)(TestComponent, FallbackComponent);
        expect(WrappedComponent.displayName).toBe("RegisteredUsersOnly(TestComponent)");
    });
    it("handles components without a displayName or name", function () {
        var FallbackComponent = setup({ isRegistered: true }).FallbackComponent;
        var AnonymousComponent = function () { return <div>Anonymous</div>; };
        Object.defineProperty(AnonymousComponent, "displayName", { value: undefined });
        Object.defineProperty(AnonymousComponent, "name", { value: undefined });
        var WrappedAnonymous = (0, registered_users_only_hoc_1.RegisteredUsersOnly)(AnonymousComponent, FallbackComponent);
        expect(WrappedAnonymous.displayName).toBe("RegisteredUsersOnly(Component)");
    });
    function setup(_a) {
        var _b = _a.isRegistered, isRegistered = _b === void 0 ? true : _b, _c = _a.props, props = _c === void 0 ? {} : _c;
        var FallbackComponent = function () { return <div data-testid="fallback">Default Fallback Content</div>; };
        var TestComponent = function (props) { return (<div data-testid="test-component">
        Test Component Content
        {props.testProp && <span data-testid="test-prop">{props.testProp}</span>}
      </div>); };
        TestComponent.displayName = "TestComponent";
        var user = isRegistered
            ? {
                userId: faker_1.faker.string.uuid(),
                email: faker_1.faker.internet.email()
            }
            : {};
        var WrappedComponent = (0, registered_users_only_hoc_1.RegisteredUsersOnly)(TestComponent, FallbackComponent);
        (0, react_2.render)(<client_1.UserProvider user={user}>
        <WrappedComponent {...props}/>
      </client_1.UserProvider>);
        return {
            FallbackComponent: FallbackComponent,
            TestComponent: TestComponent
        };
    }
});
