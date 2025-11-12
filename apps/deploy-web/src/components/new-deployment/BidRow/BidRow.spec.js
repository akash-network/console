"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_query_1 = require("@tanstack/react-query");
var LocalNoteContext_1 = require("@src/context/LocalNoteProvider/LocalNoteContext");
var ServicesProvider_1 = require("@src/context/ServicesProvider/ServicesProvider");
var queryClient_1 = require("@src/queries/queryClient");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var BidRow_1 = require("./BidRow");
var react_1 = require("@testing-library/react");
var deploymentBid_1 = require("@tests/seeders/deploymentBid");
var provider_1 = require("@tests/seeders/provider");
var mocks_1 = require("@tests/unit/mocks");
describe(BidRow_1.BidRow.name, function () {
    it("displays bid details", function () {
        var provider = (0, provider_1.buildProvider)({
            hostUri: "https://provider-host-uri",
            uptime7d: 0.9
        });
        var bid = (0, deploymentBid_1.buildDeploymentBid)({
            price: {
                denom: "uakt",
                amount: "1280000000000000000"
            },
            provider: provider.owner
        });
        var components = {
            PricePerMonth: jest.fn(),
            ProviderName: jest.fn(),
            Uptime: jest.fn(),
            RadioGroupItem: jest.fn()
        };
        var getByText = setup({
            bid: bid,
            provider: provider,
            components: components
        }).getByText;
        expect(components.PricePerMonth).toHaveBeenCalledWith(expect.objectContaining({
            denom: bid.price.denom,
            perBlockValue: (0, mathHelpers_1.udenomToDenom)(bid.price.amount, 10)
        }), {});
        expect(components.ProviderName).toHaveBeenCalledWith({ provider: provider }, {});
        expect(components.Uptime).toHaveBeenCalledWith(expect.objectContaining({
            value: provider.uptime7d
        }), {});
        expect(getByText("".concat(provider.ipRegionCode, ", ").concat(provider.ipCountryCode))).toBeInTheDocument();
        expect(components.RadioGroupItem).toHaveBeenCalledWith(expect.objectContaining({
            value: bid.id,
            id: bid.id,
            disabled: false,
            "aria-label": provider.name
        }), {});
    });
    it("does not display RadioGroupItem when disabled or bid closed", function () {
        var provider = (0, provider_1.buildProvider)({
            hostUri: "https://provider-host-uri",
            uptime7d: 0.9
        });
        var bid = (0, deploymentBid_1.buildDeploymentBid)({ provider: provider.owner });
        var components = {
            RadioGroupItem: jest.fn()
        };
        setup({
            bid: bid,
            provider: provider,
            components: components,
            disabled: true
        });
        expect(components.RadioGroupItem).not.toHaveBeenCalled();
        bid = (0, deploymentBid_1.buildDeploymentBid)({ provider: provider.owner, state: "closed" });
        setup({
            bid: bid,
            provider: provider,
            components: components
        });
        expect(components.RadioGroupItem).not.toHaveBeenCalled();
    });
    function setup(props) {
        var _a, _b, _c, _d;
        var providerProxy = function () {
            return ({
                request: jest.fn(function () {
                    return new Promise(function () { });
                })
            });
        };
        return (0, react_1.render)(<ServicesProvider_1.ServicesProvider services={{ providerProxy: providerProxy }}>
        <react_query_1.QueryClientProvider client={queryClient_1.queryClient}>
          <LocalNoteContext_1.LocalNoteProvider>
            <BidRow_1.BidRow bid={(_a = props === null || props === void 0 ? void 0 : props.bid) !== null && _a !== void 0 ? _a : (0, deploymentBid_1.buildDeploymentBid)()} selectedBid={props === null || props === void 0 ? void 0 : props.selectedBid} handleBidSelected={(props === null || props === void 0 ? void 0 : props.handleBidSelected) || (function () { })} disabled={(_b = props === null || props === void 0 ? void 0 : props.disabled) !== null && _b !== void 0 ? _b : false} provider={(_c = props === null || props === void 0 ? void 0 : props.provider) !== null && _c !== void 0 ? _c : (0, provider_1.buildProvider)()} isSendingManifest={(_d = props === null || props === void 0 ? void 0 : props.isSendingManifest) !== null && _d !== void 0 ? _d : false} components={(0, mocks_1.MockComponents)(BidRow_1.COMPONENTS, props === null || props === void 0 ? void 0 : props.components)}/>
          </LocalNoteContext_1.LocalNoteProvider>
        </react_query_1.QueryClientProvider>
      </ServicesProvider_1.ServicesProvider>);
    }
});
