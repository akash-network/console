"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var Layout_1 = require("@src/components/layout/Layout");
var RentGpusForm_1 = require("@src/components/sdl/RentGpusForm");
var CustomNextSeo_1 = require("@src/components/shared/CustomNextSeo");
var Title_1 = require("@src/components/shared/Title");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider/SdlBuilderProvider");
var urlUtils_1 = require("@src/utils/urlUtils");
function RentGpuPage() {
    return (<Layout_1.default>
      <CustomNextSeo_1.CustomNextSeo title="Rent GPUs" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.sdlBuilder())} description="Experience Global GPU Rental Excellence: Seamlessly Deploy AI Workloads with Docker Containers on Kubernetes"/>

      <Title_1.Title>Rent GPUs</Title_1.Title>

      <p className="mb-8 text-muted-foreground">
        Deploy any AI workload on a wide variety of Nvidia GPU models. Select from one of the available templates or input your own docker container image to
        deploy on one of the providers available worldwide on the network.
      </p>

      <RentGpusForm_1.RentGpusForm />
    </Layout_1.default>);
}
exports.default = (0, SdlBuilderProvider_1.withSdlBuilder)()(RentGpuPage);
