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
var DeploymentName_1 = require("./DeploymentName");
var react_1 = require("@testing-library/react");
var mocks_1 = require("@tests/unit/mocks");
describe(DeploymentName_1.DeploymentName.name, function () {
    it("renders 'Unknown' if no name and no services", function () {
        var _a;
        var deployment = { dseq: "123" };
        var container = setup({ deployment: deployment }).container;
        expect((_a = container.textContent) === null || _a === void 0 ? void 0 : _a.trim()).toBe("Unknown");
    });
    it("renders 'Unknown' if service.uris is falsy", function () {
        var _a;
        var deployment = { dseq: "123" };
        var deploymentServices = {
            api: { uris: null }
        };
        var container = setup({ deployment: deployment, deploymentServices: deploymentServices }).container;
        expect((_a = container.textContent) === null || _a === void 0 ? void 0 : _a.trim()).toBe("Unknown");
    });
    it("should render deployment name if provided", function () {
        var deployment = { dseq: "123", name: "test" };
        setup({ deployment: deployment });
        expect(react_1.screen.queryByText(deployment.name)).toBeInTheDocument();
    });
    it("renders first deployment service URI if no name specified", function () {
        var deploymentServices = {
            test: { uris: ["test.com", "another.test.com"] }
        };
        setup({ deploymentServices: deploymentServices });
        expect(react_1.screen.queryByText(deploymentServices.test.uris[0])).toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.test.uris[1])).not.toBeInTheDocument();
    });
    it("renders deployment name even when deployment services are provided", function () {
        var deployment = { dseq: "123", name: "Test Deployment" };
        var deploymentServices = {
            test: { uris: ["test.com", "another.test.com"] }
        };
        setup({ deployment: deployment, deploymentServices: deploymentServices });
        expect(react_1.screen.queryByText(deployment.name)).toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.test.uris[0])).not.toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.test.uris[1])).not.toBeInTheDocument();
    });
    it("renders first deployment service URI that is not a subdomain of provider host and name is not specified", function () {
        var deploymentServices = {
            test: { uris: ["test.com", "api.akash.network"] }
        };
        setup({
            deploymentServices: deploymentServices,
            providerHostUri: "https://provider.test.com:8443"
        });
        expect(react_1.screen.queryByText(deploymentServices.test.uris[0])).not.toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.test.uris[1])).toBeInTheDocument();
    });
    it("renders first deployment service URI if all URIs are subdomains of provider host", function () {
        var deploymentServices = {
            test: { uris: ["test.com", "adasdq3dfslkm1o232.provider.test.com"] }
        };
        setup({
            deploymentServices: deploymentServices,
            providerHostUri: "https://provider.test.com:8443"
        });
        expect(react_1.screen.queryByText(deploymentServices.test.uris[0])).toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.test.uris[1])).not.toBeInTheDocument();
    });
    it("renders deployment details in tooltip", function () {
        var deployment = { dseq: "dseq:123", name: "Test Deployment" };
        var deploymentServices = {
            test: { uris: ["test.com", "adasdq3dfslkm1o232.provider.test.com"] },
            api: { uris: ["api.akash.network"] }
        };
        var CustomTooltip = jest.fn(function (props) { return <div>{props.title}</div>; });
        setup({
            deployment: deployment,
            deploymentServices: deploymentServices,
            components: {
                CustomTooltip: CustomTooltip
            }
        });
        expect(CustomTooltip).toHaveBeenCalledWith(expect.objectContaining({ disabled: false }), {});
        expect(react_1.screen.queryByText(deployment.name)).toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.test.uris[0])).toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.test.uris[1])).toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.api.uris[0])).toBeInTheDocument();
    });
    it("does not render name in tooltip if it is not provided", function () {
        var deployment = { dseq: "dseq:123" };
        var deploymentServices = {
            test: { uris: ["test.com", "adasdq3dfslkm1o232.provider.test.com"] },
            api: { uris: ["api.akash.network"] }
        };
        var CustomTooltip = jest.fn(function (props) { return <div>{props.title}</div>; });
        setup({
            deployment: deployment,
            deploymentServices: deploymentServices,
            components: {
                CustomTooltip: CustomTooltip
            }
        });
        expect(CustomTooltip).toHaveBeenCalledWith(expect.objectContaining({ disabled: false }), {});
        expect(react_1.screen.queryByText("Name:")).not.toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.test.uris[0])).toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.test.uris[1])).toBeInTheDocument();
        expect(react_1.screen.queryByText(deploymentServices.api.uris[0])).toBeInTheDocument();
    });
    function setup(input) {
        return (0, react_1.render)(<DeploymentName_1.DeploymentName deployment={(input === null || input === void 0 ? void 0 : input.deployment) || { dseq: "123" }} providerHostUri={input === null || input === void 0 ? void 0 : input.providerHostUri} deploymentServices={input === null || input === void 0 ? void 0 : input.deploymentServices} components={(0, mocks_1.MockComponents)(DeploymentName_1.COMPONENTS, __assign({ LabelValue: function (props) { return <div>{props.label}</div>; } }, input === null || input === void 0 ? void 0 : input.components))}/>);
    }
});
