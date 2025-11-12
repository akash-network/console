"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerSideProps = void 0;
var NewDeploymentContainer_1 = require("@src/components/new-deployment/NewDeploymentContainer");
var createServerSideProps_1 = require("@src/components/new-deployment/NewDeploymentPage/createServerSideProps");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider/SdlBuilderProvider");
exports.default = (0, SdlBuilderProvider_1.withSdlBuilder)({
    componentsSet: "ssh",
    imageSource: "ssh-vms"
})(NewDeploymentContainer_1.NewDeploymentContainer);
exports.getServerSideProps = (0, createServerSideProps_1.createServerSideProps)("/deploy-linux");
