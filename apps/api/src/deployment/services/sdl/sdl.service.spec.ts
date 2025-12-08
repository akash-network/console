import yaml from "js-yaml";

import type { BillingConfig } from "@src/billing/providers";
import { SdlService } from "./sdl.service";

describe(SdlService.name, () => {
  describe("appendAuditorRequirement", () => {
    it("adds auditor to signedBy anyOf when not present", () => {
      const { service } = setup();
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

      const inputSdl = `---
version: "2.0"

services:
  web:
    image: nginx
    expose:
      - port: 80
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
          size: 1Gi
  placement:
    westcoast:
      attributes:
        region: us-west
      pricing:
        web:
          denom: uakt
          amount: 1000

deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

      const result = service.appendAuditorRequirement(inputSdl, [auditor]);
      const parsedResult = yaml.load(result) as any;

      expect(parsedResult.profiles.placement.westcoast.signedBy.anyOf).toContain(auditor);
    });

    it("does not duplicate auditor if already present in anyOf", () => {
      const { service } = setup();
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

      const inputSdl = `---
version: "2.0"

services:
  web:
    image: nginx
    expose:
      - port: 80
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
          size: 1Gi
  placement:
    westcoast:
      attributes:
        region: us-west
      signedBy:
        anyOf:
          - ${auditor}
      pricing:
        web:
          denom: uakt
          amount: 1000

deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

      const result = service.appendAuditorRequirement(inputSdl, [auditor]);
      const parsedResult = yaml.load(result) as any;

      const anyOfCount = parsedResult.profiles.placement.westcoast.signedBy.anyOf.filter((a: string) => a === auditor).length;
      expect(anyOfCount).toBe(1);
    });

    it("adds multiple auditors to signedBy anyOf", () => {
      const { service } = setup();
      const auditor1 = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const auditor2 = "akash1another7awdyj3n2sav7xfx76adc6dnmlx64";

      const inputSdl = `---
version: "2.0"

services:
  web:
    image: nginx
    expose:
      - port: 80
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
          size: 1Gi
  placement:
    westcoast:
      attributes:
        region: us-west
      pricing:
        web:
          denom: uakt
          amount: 1000

deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

      const result = service.appendAuditorRequirement(inputSdl, [auditor1, auditor2]);
      const parsedResult = yaml.load(result) as any;

      expect(parsedResult.profiles.placement.westcoast.signedBy.anyOf).toContain(auditor1);
      expect(parsedResult.profiles.placement.westcoast.signedBy.anyOf).toContain(auditor2);
    });

    it("preserves existing signedBy allOf when adding anyOf", () => {
      const { service } = setup();
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const existingAllOf = "akash1existingauditor";

      const inputSdl = `---
version: "2.0"

services:
  web:
    image: nginx
    expose:
      - port: 80
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
          size: 1Gi
  placement:
    westcoast:
      attributes:
        region: us-west
      signedBy:
        allOf:
          - ${existingAllOf}
      pricing:
        web:
          denom: uakt
          amount: 1000

deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

      const result = service.appendAuditorRequirement(inputSdl, [auditor]);
      const parsedResult = yaml.load(result) as any;

      expect(parsedResult.profiles.placement.westcoast.signedBy.anyOf).toContain(auditor);
      expect(parsedResult.profiles.placement.westcoast.signedBy.allOf).toContain(existingAllOf);
    });

    it("applies auditor requirement to all placement profiles", () => {
      const { service } = setup();
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";

      const inputSdl = `---
version: "2.0"

services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
  api:
    image: node
    expose:
      - port: 3000
        as: 3000
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
          size: 1Gi
    api:
      resources:
        cpu:
          units: 1
        memory:
          size: 1Gi
        storage:
          size: 2Gi
  placement:
    westcoast:
      attributes:
        region: us-west
      pricing:
        web:
          denom: uakt
          amount: 1000
        api:
          denom: uakt
          amount: 2000
    eastcoast:
      attributes:
        region: us-east
      pricing:
        web:
          denom: uakt
          amount: 1000
        api:
          denom: uakt
          amount: 2000

deployment:
  web:
    westcoast:
      profile: web
      count: 1
  api:
    eastcoast:
      profile: api
      count: 1
`;

      const result = service.appendAuditorRequirement(inputSdl, [auditor]);
      const parsedResult = yaml.load(result) as any;

      expect(parsedResult.profiles.placement.westcoast.signedBy.anyOf).toContain(auditor);
      expect(parsedResult.profiles.placement.eastcoast.signedBy.anyOf).toContain(auditor);
    });
  });

  function setup() {
    const config: BillingConfig = {
      NETWORK: "sandbox"
    } as BillingConfig;

    const service = new SdlService(config);

    return {
      service,
      config
    };
  }
});
