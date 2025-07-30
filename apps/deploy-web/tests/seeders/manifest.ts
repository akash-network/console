export const helloWorldManifest = `
  ---
  version: "2.0"

  services:
    web:
      image: baktun/hello-akash-world:1.0.0
      expose:
        - port: 3000
          as: 80
          to:
            - global: true

  profiles:
    compute:
      web:
        resources:
          cpu:
            units: 0.5
          memory:
            size: 512Mi
          storage:
            size: 512Mi

    placement:
      dcloud:
        pricing:
          # The name of the service
          web:
            denom: uakt
            amount: 10000

  deployment:
    web:
      dcloud:
        profile: web
        count: 1

`
  .trim()
  .replace(/^ {2}/gm, "");
