"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hardcodedTemplates = exports.helloWorldTemplate = exports.sdlBuilderTemplate = void 0;
exports.sdlBuilderTemplate = {
    title: "Empty",
    code: "empty",
    category: "General",
    description: "An empty template with some basic config to get started.",
    content: "# Paste your SDL here!"
};
exports.helloWorldTemplate = {
    title: "Hello World",
    name: "Hello World",
    code: "hello-world",
    category: "General",
    description: "Simple next.js web application showing hello world.",
    githubUrl: "https://github.com/akash-network/hello-akash-world",
    valuesToChange: [],
    content: "# Welcome to the Akash Network! \uD83D\uDE80\u2601\n# This file is called a Stack Definition Laguage (SDL)\n# SDL is a human friendly data standard for declaring deployment attributes. \n# The SDL file is a \"form\" to request resources from the Network. \n# SDL is compatible with the YAML standard and similar to Docker Compose files.\n\n---\n# Indicates version of Akash configuration file. Currently only \"2.0\" is accepted.\nversion: \"2.0\"\n\n# The top-level services entry contains a map of workloads to be ran on the Akash deployment. Each key is a service name; values are a map containing the following keys:\n# https://akash.network/docs/getting-started/stack-definition-language/#services\nservices:\n  # The name of the service \"web\"\n  web:\n    # The docker container image with version. You must specify a version, the \"latest\" tag doesn't work.\n    image: baktun/hello-akash-world:1.0.0\n    # You can map ports here https://akash.network/docs/getting-started/stack-definition-language/#servicesexpose\n    expose:\n      - port: 3000\n        as: 80\n        to:\n          - global: true\n\n# The profiles section contains named compute and placement profiles to be used in the deployment.\n# https://akash.network/docs/getting-started/stack-definition-language/#profiles\nprofiles:\n  # profiles.compute is map of named compute profiles. Each profile specifies compute resources to be leased for each service instance uses uses the profile.\n  # https://akash.network/docs/getting-started/stack-definition-language/#profilescompute\n  compute:\n    # The name of the service\n    web:\n      resources:\n        cpu:\n          units: 0.5\n        memory:\n          size: 512Mi\n        storage:\n          size: 512Mi\n\n# profiles.placement is map of named datacenter profiles. Each profile specifies required datacenter attributes and pricing configuration for each compute profile that will be used within the datacenter. It also specifies optional list of signatures of which tenants expects audit of datacenter attributes.\n# https://akash.network/docs/getting-started/stack-definition-language/#profilesplacement\n  placement:\n    dcloud:\n      pricing:\n        # The name of the service\n        web:\n          denom: uakt\n          amount: 10000\n\n# The deployment section defines how to deploy the services. It is a mapping of service name to deployment configuration.\n# https://akash.network/docs/getting-started/stack-definition-language/#deployment\ndeployment:\n  # The name of the service\n  web:\n    dcloud:\n      profile: web\n      count: 1\n"
};
exports.hardcodedTemplates = [exports.sdlBuilderTemplate, exports.helloWorldTemplate];
