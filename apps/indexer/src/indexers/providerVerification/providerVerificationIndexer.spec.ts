import type { Message, Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import type { Transaction as DbTransaction } from "sequelize";
import { describe, expect, it, vi } from "vitest";

import { ProviderVerificationIndexer } from "./providerVerificationIndexer";
import type { ProviderVerificationRepository } from "./providerVerificationRepository";

describe(ProviderVerificationIndexer.name, () => {
  it("enqueues transaction-event identities in the surrounding database transaction", async () => {
    const repository = createRepository();
    const indexer = new ProviderVerificationIndexer(repository);
    const dbTransaction = {} as DbTransaction;
    const transaction = { height: 123 } as Transaction;
    const events = [
      {
        type: "akash.verification.v1.EventAttestationSubmitted",
        attributes: [
          { key: "provider", value: "akash1provider" },
          { key: "auditor", value: "akash1auditor" },
          { key: "audit_escrow_id", value: "8" }
        ]
      }
    ] as TransactionEvent[];

    await indexer.afterEveryTransaction({} as never, transaction, dbTransaction, events);

    expect(repository.enqueueMany).toHaveBeenCalledWith(
      [
        { targetType: "audit_escrow", targetKey: "8" },
        { targetType: "auditor", targetKey: "akash1auditor" },
        { targetType: "provider", targetKey: "akash1provider" }
      ],
      123,
      dbTransaction
    );
  });

  it("uses the message fallback for provider removal because the SDK has no removal event", async () => {
    const repository = createRepository();
    const indexer = new ProviderVerificationIndexer(repository);
    const dbTransaction = {} as DbTransaction;

    await indexer.processMessage({ provider: "akash1provider", auditor: "akash1auditor" }, 124, dbTransaction, {
      type: "/akash.verification.v1.MsgRemoveAttestation"
    } as Message);

    expect(repository.enqueue).toHaveBeenCalledWith({ targetType: "provider", targetKey: "akash1provider" }, 124, dbTransaction);
  });

  it("queues all provider aggregates with a parameter update transaction", async () => {
    const repository = createRepository();
    const indexer = new ProviderVerificationIndexer(repository);
    const dbTransaction = {} as DbTransaction;

    await indexer.processMessage({}, 125, dbTransaction, {
      type: "/akash.verification.v1.MsgUpdateParams"
    } as Message);

    expect(repository.enqueue).toHaveBeenCalledWith({ targetType: "global", targetKey: "*" }, 125, dbTransaction);
    expect(repository.enqueueAllProviders).toHaveBeenCalledWith(125, dbTransaction);
  });
});

function createRepository() {
  return {
    enqueue: vi.fn(),
    enqueueAllProviders: vi.fn(),
    enqueueMany: vi.fn(),
    getUnprocessedBlockEvents: vi.fn(),
    markBlockEventsProcessed: vi.fn()
  } satisfies Pick<
    ProviderVerificationRepository,
    "enqueue" | "enqueueAllProviders" | "enqueueMany" | "getUnprocessedBlockEvents" | "markBlockEventsProcessed"
  >;
}
