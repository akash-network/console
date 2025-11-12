"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jest_mock_extended_1 = require("jest-mock-extended");
var ConnectManagedWalletButton_1 = require("./ConnectManagedWalletButton");
var react_1 = require("@testing-library/react");
describe(ConnectManagedWalletButton_1.ConnectManagedWalletButton.name, function () {
    it("renders button enabled when blockchain is up", function () {
        var getByText = setup({ isBlockchainDown: false }).getByText;
        expect(getByText("Start Trial").parentElement).not.toHaveAttribute("disabled");
    });
    it("renders button disabled when blockchain is unavailable", function () {
        var getByText = setup({ isBlockchainDown: true }).getByText;
        expect(getByText("Start Trial").parentElement).toHaveAttribute("disabled");
    });
    function setup(input) {
        var mockUseFlag = jest.fn(function (flag) {
            if (flag === "notifications_general_alerts_update") {
                return true;
            }
            return false;
        });
        return (0, react_1.render)(<ConnectManagedWalletButton_1.ConnectManagedWalletButton dependencies={{
                useFlag: function () { return mockUseFlag; },
                useRouter: function () { return (0, jest_mock_extended_1.mock)(); },
                useSettings: function () {
                    var _a;
                    return ({
                        settings: {
                            apiEndpoint: "https://api.example.com",
                            rpcEndpoint: "https://rpc.example.com",
                            isCustomNode: false,
                            nodes: [],
                            selectedNode: null,
                            customNode: null,
                            isBlockchainDown: (_a = input === null || input === void 0 ? void 0 : input.isBlockchainDown) !== null && _a !== void 0 ? _a : false
                        },
                        setSettings: jest.fn(),
                        isLoadingSettings: false,
                        isSettingsInit: true,
                        refreshNodeStatuses: jest.fn(),
                        isRefreshingNodeStatus: false
                    });
                }
            }}/>);
    }
});
