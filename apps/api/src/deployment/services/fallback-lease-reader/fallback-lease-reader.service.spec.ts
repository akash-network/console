import type { Lease } from "@akashnetwork/database/dbSchemas/akash";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CoreConfig } from "@src/core/providers/config.provider";
import type { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { FallbackLeaseReaderService } from "./fallback-lease-reader.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(FallbackLeaseReaderService.name, () => {
  describe("findByDeployments", () => {
    it("reads the leases of every deployment asked about in one read", async () => {
      const { service, leaseRepository } = setup();
      const owner = createAkashAddress();

      await service.findByDeployments({ owner, dseqs: ["1", "2"] });

      expect(leaseRepository.findByDeployments).toHaveBeenCalledTimes(1);
      expect(leaseRepository.findByDeployments).toHaveBeenCalledWith({ owner, dseqs: ["1", "2"] });
    });

    it("rebuilds each indexed lease in the shape the chain lists it, keeping the bid it was created from", async () => {
      const owner = createAkashAddress();
      const provider = createAkashAddress();
      const { service } = setup({
        leases: [
          indexedLease({
            owner,
            dseq: "123",
            gseq: 1,
            oseq: 2,
            bseq: 3,
            providerAddress: provider,
            createdHeight: 100,
            closedHeight: 200,
            price: 1.5,
            withdrawnAmount: 4,
            denom: "uact"
          })
        ]
      });

      const leases = await service.findByDeployments({ owner, dseqs: ["123"] });

      expect(leases).toEqual([
        {
          lease: {
            id: { owner, dseq: "123", gseq: 1, oseq: 2, provider, bseq: 3 },
            state: "closed",
            price: { denom: "uact", amount: "1.500000000000000000" },
            created_at: "100",
            closed_on: "200",
            reason: undefined
          },
          escrow_payment: {
            id: { aid: { scope: "deployment", xid: `${owner}/123` }, xid: `1/2/${provider}` },
            state: {
              owner: provider,
              state: "closed",
              rate: { denom: "uact", amount: "1.500000000000000000" },
              balance: { denom: "uact", amount: "0.000000000000000000" },
              unsettled: { denom: "uact", amount: "0.000000000000000000" },
              withdrawn: { denom: "uact", amount: "4.000000000000000000" }
            }
          }
        }
      ]);
    });

    it("reports a lease the index has not seen close as active", async () => {
      const { service } = setup({ leases: [indexedLease({ closedHeight: undefined })] });

      const [{ lease, escrow_payment }] = await service.findByDeployments({ owner: createAkashAddress(), dseqs: ["1"] });

      expect(lease.state).toBe("active");
      expect(lease.closed_on).toBe("0");
      expect(escrow_payment.state.state).toBe("open");
    });
  });

  describe("list", () => {
    it("keeps the bid each lease was created from", async () => {
      const { service, leaseRepository } = setup();
      leaseRepository.findLeasesWithPagination.mockResolvedValue({ count: 1, rows: [indexedLease({ bseq: 7 })] });

      const { leases } = await service.list({ owner: createAkashAddress() });

      expect(leases[0].lease.id.bseq).toBe(7);
    });
  });

  function setup(input: { leases?: Lease[] } = {}) {
    const leaseRepository = mock<LeaseRepository>({ findByDeployments: vi.fn().mockResolvedValue(input.leases ?? []) });
    const coreConfig = mock<CoreConfig>({ NETWORK: "mainnet" });
    const service = new FallbackLeaseReaderService(leaseRepository, coreConfig);

    return { service, leaseRepository };
  }

  function indexedLease(overrides: Partial<Lease> = {}) {
    return mock<Lease>({
      owner: createAkashAddress(),
      dseq: faker.string.numeric(12),
      gseq: 1,
      oseq: 1,
      bseq: 0,
      providerAddress: createAkashAddress(),
      createdHeight: faker.number.int({ min: 1, max: 1_000_000 }),
      closedHeight: faker.number.int({ min: 1_000_001, max: 2_000_000 }),
      price: faker.number.float({ min: 0, max: 100 }),
      withdrawnAmount: faker.number.float({ min: 0, max: 100 }),
      denom: "uact",
      ...overrides
    });
  }
});
