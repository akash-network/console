import "@test/setup-functional-tests"; // eslint-disable-line simple-import-sort/imports

import { Provider, ProviderAttribute, ProviderAttributeSignature } from "@akashnetwork/database/dbSchemas/akash";
import { chainDb } from "@src/db/dbConnection";
import { createAkashAddress, createProviderSeed } from "@test/seeders";
import type { CreationAttributes } from "sequelize";
import { Op } from "sequelize";
import type { ModelCtor } from "sequelize-typescript";
import { ProviderRepository } from "./provider.repository";

describe(ProviderRepository.name, () => {
  describe("getProvidersUrlsByAttributes", () => {
    afterEach(async () => {
      await Provider.destroy({
        where: {
          owner: { [Op.in]: Array.from(providerIds) }
        },
        cascade: true
      });
    });

    it("returns all providers urls when no attributes are provided", async () => {
      const { providerRepository } = setup();
      const providers = await Promise.all([
        createProvider({
          providerAttributes: [
            { key: "tier", value: "community" },
            { key: "organization", value: "europlots" },
            { key: "capabilities/storage/1/class", value: "beta3" }
          ]
        }),
        createProvider({
          providerAttributes: [
            { key: "tier", value: "community" },
            { key: "organization", value: "overclock" },
            { key: "capabilities/storage/1/class", value: "beta3" }
          ]
        })
      ]);

      const urls = await providerRepository.getProvidersHostUriByAttributes([]);
      expect(urls).toHaveLength(2);
      expect(urls).toEqual(expect.arrayContaining(providers.map(provider => provider.hostUri)));
    });

    it("returns providers urls by plain attributes", async () => {
      const { providerRepository } = setup();

      const providers = await Promise.all([
        createProvider({
          providerAttributes: [
            { key: "tier", value: "community" },
            { key: "organization", value: "europlots" },
            { key: "capabilities/storage/1/class", value: "beta3" },
            { key: "capabilities/storage/2/class", value: "beta4" }
          ]
        }),
        createProvider({
          providerAttributes: [
            { key: "tier", value: "community" },
            { key: "organization", value: "overclock" },
            { key: "capabilities/storage/1/class", value: "beta3" },
            { key: "capabilities/storage/2/class", value: "beta5" }
          ]
        }),
        createProvider({
          providerAttributes: [
            { key: "tier", value: "commercial" },
            { key: "organization", value: "overclock" },
            { key: "capabilities/storage/1/class", value: "beta3" }
          ]
        })
      ]);
      let urls = await providerRepository.getProvidersHostUriByAttributes([
        { key: "tier", value: "community" },
        { key: "capabilities/storage/1/class", value: "beta3" }
      ]);

      expect(urls).toHaveLength(2);
      expect(urls).toEqual(expect.arrayContaining([providers[0].hostUri, providers[1].hostUri]));

      urls = await providerRepository.getProvidersHostUriByAttributes([{ key: "organization", value: "europlots" }]);

      expect(urls).toEqual([providers[0].hostUri]);
    });

    it("returns providers urls by glob attributes", async () => {
      const { providerRepository } = setup();

      const providers = await Promise.all([
        createProvider({
          providerAttributes: [
            { key: "tier", value: "community" },
            { key: "capabilities/gpu/vendor/nvidia/model/rtx2000", value: "true" }
          ]
        }),
        createProvider({
          providerAttributes: [{ key: "capabilities/gpu/vendor/nvidia/model/rtx4000", value: "true" }]
        }),
        createProvider({
          providerAttributes: [
            { key: "tier", value: "community" },
            { key: "capabilities/gpu/vendor/amd/model/rx6900xt", value: "true" }
          ]
        }),
        createProvider({
          providerAttributes: [
            { key: "tier", value: "community" },
            { key: "capabilities/gpu/vendor/nvidia/model/rtp4000", value: "true" }
          ]
        })
      ]);

      let urls = await providerRepository.getProvidersHostUriByAttributes([{ key: "capabilities/gpu/vendor/nvidia/model/*", value: "true" }]);

      expect(urls).toHaveLength(3);
      expect(urls).toEqual(expect.arrayContaining([providers[0].hostUri, providers[1].hostUri, providers[3].hostUri]));

      urls = await providerRepository.getProvidersHostUriByAttributes([{ key: "capabilities/gpu/vendor/amd/model/*", value: "true" }]);

      expect(urls).toEqual([providers[2].hostUri]);

      urls = await providerRepository.getProvidersHostUriByAttributes([{ key: "capabilities/gpu/vendor/nvidia/model/rtx?000", value: "true" }]);

      expect(urls).toHaveLength(2);
      expect(urls).toEqual(expect.arrayContaining([providers[0].hostUri, providers[1].hostUri]));

      urls = await providerRepository.getProvidersHostUriByAttributes([
        { key: "tier", value: "community" },
        { key: "capabilities/gpu/vendor/nvidia/model/rt*", value: "true" }
      ]);

      expect(urls).toHaveLength(2);
      expect(urls).toEqual(expect.arrayContaining([providers[0].hostUri, providers[3].hostUri]));
    });

    it("escapes regexp characters in attribute keys", async () => {
      const { providerRepository } = setup();

      await Promise.all([
        createProvider({
          providerAttributes: [{ key: "capabilities/gpu/vendor/nvidia/model/rtx2000", value: "true" }]
        })
      ]);

      const urls = await providerRepository.getProvidersHostUriByAttributes([{ key: "capabilities/gpu/vendor/*/model/rtx[0-9]+", value: "true" }]);

      expect(urls).toHaveLength(0);
    });

    it("returns providers urls by plain signed attributes with allOf.length = 1", async () => {
      const { providerRepository } = setup();
      const auditor = createAkashAddress();
      const providers = await Promise.all([
        createProvider({
          providerAttributeSignatures: [{ key: "region", value: "us-east", auditor }]
        }),
        createProvider({
          providerAttributeSignatures: [{ key: "region", value: "us-east", auditor: createAkashAddress() }]
        }),
        createProvider({
          providerAttributeSignatures: [{ key: "region", value: "us-east", auditor: createAkashAddress() }]
        })
      ]);

      const urls = await providerRepository.getProvidersHostUriByAttributes([{ key: "region", value: "us-east" }], { allOf: [auditor] });

      expect(urls).toEqual([providers[0].hostUri]);
    });

    it("returns providers urls by plain signed attributes with allOf.length > 1", async () => {
      const { providerRepository } = setup();
      const auditors = [createAkashAddress(), createAkashAddress()];

      const providers = await Promise.all([
        createProvider({
          providerAttributeSignatures: [
            { key: "region", value: "us-east", auditor: auditors[0] },
            { key: "region", value: "us-east", auditor: auditors[1] }
          ]
        }),
        createProvider({
          providerAttributeSignatures: [{ key: "region", value: "us-east", auditor: auditors[0] }]
        }),
        createProvider({
          providerAttributeSignatures: [{ key: "region", value: "us-east", auditor: auditors[1] }]
        })
      ]);

      const urls = await providerRepository.getProvidersHostUriByAttributes([{ key: "region", value: "us-east" }], { allOf: auditors });

      expect(urls).toEqual([providers[0].hostUri]);
    });

    it("returns providers urls by plain signed attributes with anyOf", async () => {
      const { providerRepository } = setup();
      const auditors = [createAkashAddress(), createAkashAddress()];

      const providers = await Promise.all([
        createProvider({
          providerAttributeSignatures: [
            { key: "region", value: "us-east", auditor: auditors[0] },
            { key: "region", value: "us-east", auditor: auditors[1] }
          ]
        }),
        createProvider({
          providerAttributeSignatures: [{ key: "region", value: "us-east", auditor: auditors[0] }]
        }),
        createProvider({
          providerAttributeSignatures: [{ key: "region", value: "us-east", auditor: auditors[1] }]
        }),
        createProvider({
          providerAttributeSignatures: [{ key: "region", value: "us-east", auditor: createAkashAddress() }]
        })
      ]);

      const urls = await providerRepository.getProvidersHostUriByAttributes([{ key: "region", value: "us-east" }], { anyOf: auditors });

      expect(urls).toHaveLength(3);
      expect(urls).toEqual(expect.arrayContaining([providers[0].hostUri, providers[1].hostUri, providers[2].hostUri]));
    });

    it("returns providers urls by signed attributes with allOf and anyOf", async () => {
      const { providerRepository } = setup();
      const auditors = Array.from({ length: 4 }, () => createAkashAddress());

      const providers = await Promise.all([
        createProvider({
          providerAttributeSignatures: [
            { key: "region", value: "us-east", auditor: auditors[0] },
            { key: "region", value: "us-east", auditor: auditors[2] },
            { key: "region", value: "us-east", auditor: auditors[3] },
            { key: "capabilities/storage/1/class", value: "beta3", auditor: auditors[1] },
            { key: "capabilities/storage/1/class", value: "beta3", auditor: auditors[2] },
            { key: "capabilities/storage/1/class", value: "beta3", auditor: auditors[3] }
          ]
        }),
        createProvider({
          providerAttributeSignatures: [
            { key: "region", value: "us-east", auditor: auditors[1] },
            { key: "region", value: "us-east", auditor: auditors[1] },
            { key: "capabilities/storage/1/class", value: "beta3", auditor: auditors[0] },
            { key: "capabilities/storage/1/class", value: "beta3", auditor: auditors[1] }
          ]
        }),
        createProvider({
          providerAttributeSignatures: [
            { key: "region", value: "us-east", auditor: auditors[2] },
            { key: "capabilities/storage/1/class", value: "beta3", auditor: auditors[2] }
          ]
        })
      ]);

      const urls = await providerRepository.getProvidersHostUriByAttributes(
        [
          { key: "region", value: "us-east" },
          { key: "capabilities/storage/1/class", value: "beta3" }
        ],
        { anyOf: auditors.slice(0, 2), allOf: auditors.slice(2) }
      );

      expect(urls).toEqual([providers[0].hostUri]);
    });
  });

  function setup() {
    const providerRepository = new ProviderRepository();
    return {
      providerRepository
    };
  }

  let providerIndex = 0;
  const providerIds = new Set<string>();
  async function createProvider(overrides: Partial<CreationAttributes<Provider>> = {}) {
    const height = overrides.createdHeight || (await chainDb.models.block.max("height"));
    const includes: ModelCtor[] = [];
    if (overrides.providerAttributes) includes.push(ProviderAttribute);
    if (overrides.providerAttributeSignatures) includes.push(ProviderAttributeSignature);

    const provider = await Provider.create(
      {
        ...createProviderSeed({
          hostUri: `https://test-provider-${++providerIndex}-${Date.now()}.com`,
          isOnline: true,
          createdHeight: height,
          updatedHeight: height
        }),
        lastSnapshotId: null,
        lastSuccessfulSnapshotId: null,
        ...overrides
      },
      {
        include: includes
      }
    );

    providerIds.add(provider.owner);

    return provider;
  }
});
