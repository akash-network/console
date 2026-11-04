export const sdlBuilderTemplate = {
  title: "Empty",
  code: "empty",
  category: "General",
  description: "An empty template with some basic config to get started.",
  content: "# Paste your SDL here!"
};
export const HELLO_WORLD_IMAGE = "ghcr.io/akash-network/hello-akash-world:2.1.0";
export const HELLO_WORLD_PORT = 3000;
export const helloWorldTemplate = {
  title: "Hello World",
  name: "Hello World",
  code: "hello-world",
  category: "General",
  description: "Simple next.js web application showing hello world.",
  githubUrl: "https://github.com/akash-network/hello-akash-world",
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
    image: ${HELLO_WORLD_IMAGE}
    # You can map ports here https://akash.network/docs/getting-started/stack-definition-language/#servicesexpose
    expose:
      - port: ${HELLO_WORLD_PORT}
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
          denom: uact
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

export const gemmaTrialTemplate = {
  title: "Gemma 3 4B",
  name: "Gemma 3 4B",
  code: "gemma-3-4b-v100",
  category: "AI - GPU",
  description: "Google's Gemma 3 4B served by Ollama on an NVIDIA V100.",
  githubUrl: "https://github.com/akash-network/awesome-akash/tree/master/gemma3-4b",
  valuesToChange: [],
  content: `---
version: "2.0"
services:
  gemma3:
    image: ollama/ollama:0.13.4
    expose:
      - port: 11434
        as: 11434
        to:
          - global: true
    env:
      - MODEL=gemma3:4b
    command:
      - /bin/sh
      - -c
      - |
        ollama serve &
        while ! ollama pull \${MODEL}; do
          echo "Waiting for ollama pull to succeed..."
          sleep 2.5
        done
        ollama list
        pkill ollama
        ollama serve
profiles:
  compute:
    gemma3:
      resources:
        cpu:
          units: 4
        memory:
          size: 16Gi
        storage:
          size: 50Gi
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - model: v100
  placement:
    akash:
      signedBy:
        anyOf:
          - "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"
      pricing:
        gemma3:
          denom: uact
          amount: 10000
deployment:
  gemma3:
    akash:
      profile: gemma3
      count: 1
`
};

export const fasterWhisperTrialTemplate = {
  title: "Faster Whisper",
  name: "Faster Whisper",
  code: "faster-whisper-rtx3060ti",
  category: "AI - GPU",
  description: "Speech to text with the Faster Whisper engine on an NVIDIA RTX 3060 Ti, with a web page to upload audio.",
  githubUrl: "https://github.com/akash-network/awesome-akash/tree/master/whisper-asr-gpu",
  valuesToChange: [],
  content: `---
version: "2.0"
services:
  whisper-asr:
    image: onerahmet/openai-whisper-asr-webservice:v1.10.0-gpu
    expose:
      - port: 9000
        as: 80
        to:
          - global: true
    env:
      - ASR_MODEL=base
      - ASR_ENGINE=faster_whisper
profiles:
  compute:
    whisper-asr:
      resources:
        cpu:
          units: 4
        memory:
          size: 16Gi
        storage:
          size: 100Gi
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - model: rtx3060ti
  placement:
    akash:
      signedBy:
        anyOf:
          - "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"
      pricing:
        whisper-asr:
          denom: uact
          amount: 10000
deployment:
  whisper-asr:
    akash:
      profile: whisper-asr
      count: 1
`
};

/** Trial-sized copies of awesome-akash GPU templates, pinned to one GPU model because the gallery copies accept any NVIDIA GPU, including ones blocked on trial. */
export const trialGpuModelTemplates = [gemmaTrialTemplate, fasterWhisperTrialTemplate];

export const hardcodedTemplates = [sdlBuilderTemplate, helloWorldTemplate, ...trialGpuModelTemplates];
