export const sdlTemplateWithRamAndInterface = `
version: "2.0"
services:
  obtaingpuone:
    image: ubuntu:22.04
    command:
      - "sh"
      - "-c"
    args:
      - 'uptime;
        nvidia-smi;
        sleep infinity'
    expose:
      - port: 8080
        as: 80
        to:
          - global: true
profiles:
  compute:
    obtaingpu:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 256Mi   
        gpu:
          units: 1
          attributes:
            vendor:
              <VENDOR>:
                - model: <MODEL>
                  ram: <RAM>
                  interface: <INTERFACE>
        storage:
          size: 256Mi
  placement:
    akash:
      pricing:
        obtaingpu: 
          denom: uakt
          amount: 100000
deployment:
  obtaingpuone:
    akash:
      profile: obtaingpu
      count: 1`;

export const sdlTemplateWithRam = `
version: "2.0"
services:
  obtaingpuone:
    image: ubuntu:22.04
    command:
      - "sh"
      - "-c"
    args:
      - 'uptime;
        nvidia-smi;
        sleep infinity'
    expose:
      - port: 8080
        as: 80
        to:
          - global: true
profiles:
  compute:
    obtaingpu:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 256Mi   
        gpu:
          units: 1
          attributes:
            vendor:
              <VENDOR>:
                - model: <MODEL>
                  ram: <RAM>
        storage:
          size: 256Mi
  placement:
    akash:
      pricing:
        obtaingpu: 
          denom: uakt
          amount: 100000
deployment:
  obtaingpuone:
    akash:
      profile: obtaingpu
      count: 1`;
