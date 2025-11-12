"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var Layout_1 = require("@src/components/layout/Layout");
var SimpleSdlBuilderForm_1 = require("@src/components/sdl/SimpleSdlBuilderForm");
var CustomNextSeo_1 = require("@src/components/shared/CustomNextSeo");
var Title_1 = require("@src/components/shared/Title");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider");
var urlUtils_1 = require("@src/utils/urlUtils");
function SDLBuilderPage() {
    return (<Layout_1.default>
      <CustomNextSeo_1.CustomNextSeo title="SDL Builder" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.sdlBuilder())} description="Build your own SDL configuration to deploy a docker container on the Akash Network, the #1 decentralized supercloud."/>

      <Title_1.Title>SDL Builder</Title_1.Title>

      <SimpleSdlBuilderForm_1.SimpleSDLBuilderForm />
    </Layout_1.default>);
}
exports.default = (0, SdlBuilderProvider_1.withSdlBuilder)()(SDLBuilderPage);
