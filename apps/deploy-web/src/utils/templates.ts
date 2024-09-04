export const sdlBuilderTemplate = {
  title: "Empty",
  code: "empty",
  category: "General",
  description: "An empty template with some basic config to get started.",
  content: "# Paste your SDL here!"
};
export const helloWorldTemplate = {
  title: "Hello World",
  name: "Hello World",
  code: "hello-world",
  category: "General",
  description: "Simple next.js web application showing hello world.",
  githubUrl: "https://github.com/maxmaxlabs/hello-akash-world",
  valuesToChange: [],
  content: `# Welcome to the Akash Network! 🚀☁
# This file is called a Stack Definition Laguage (SDL)
# SDL is a human friendly data standard for declaring deployment attributes. 
# The SDL file is a "form" to request resources from the Network. 
# SDL is compatible with the YAML standard and similar to Docker Compose files.

---
# Indicates version of Akash configuration file. Currently only "2.0" is accepted.
version: "2.0"

# The top-level services entry contains a map of workloads to be ran on the Akash deployment. Each key is a service name; values are a map containing the following keys:
# https://akash.network/docs/getting-started/stack-definition-language/#services
services:
  # The name of the service "web"
  web:
    # The docker container image with version. You must specify a version, the "latest" tag doesn't work.
    image: akashlytics/hello-akash-world:0.2.0
    # You can map ports here https://akash.network/docs/getting-started/stack-definition-language/#servicesexpose
    expose:
      - port: 3000
        as: 80
        to:
          - global: true

# The profiles section contains named compute and placement profiles to be used in the deployment.
# https://akash.network/docs/getting-started/stack-definition-language/#profiles
profiles:
  # profiles.compute is map of named compute profiles. Each profile specifies compute resources to be leased for each service instance uses uses the profile.
  # https://akash.network/docs/getting-started/stack-definition-language/#profilescompute
  compute:
    # The name of the service
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 512Mi

# profiles.placement is map of named datacenter profiles. Each profile specifies required datacenter attributes and pricing configuration for each compute profile that will be used within the datacenter. It also specifies optional list of signatures of which tenants expects audit of datacenter attributes.
# https://akash.network/docs/getting-started/stack-definition-language/#profilesplacement
  placement:
    dcloud:
      pricing:
        # The name of the service
        web:
          denom: uakt
          amount: 10000

# The deployment section defines how to deploy the services. It is a mapping of service name to deployment configuration.
# https://akash.network/docs/getting-started/stack-definition-language/#deployment
deployment:
  # The name of the service
  web:
    dcloud:
      profile: web
      count: 1
`
};

export const github = {
  title: "GitHub",
  name: "GitHub",
  code: "github",
  category: "General",
  description: "Get started with a simple linux Ubuntu server!",
  githubUrl: "",
  valuesToChange: [],
  content: `---
version: "2.0"
services:
  service-1:
    image: hoomanhq/automation:0.421
    expose:
      - port: 3000
        as: 80
        to:
          - global: true
      - port: 8080
        as: 8080
        to:
          - global: true
profiles:
  compute:
    service-1:
      resources:
        cpu:
          units: 2
        memory:
          size: 12GB
        storage:
          - size: 8Gi
  placement:
    dcloud:
      pricing:
        service-1:
          denom: uakt
          amount: 1000
deployment:
  service-1:
    dcloud:
      profile: service-1
      count: 1
`
};

export const hardcodedTemplates = [sdlBuilderTemplate, helloWorldTemplate, github];
