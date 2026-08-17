import { describe, expect, it } from "vitest";

import { deriveAkashChanges } from "@src/akash/akash-deriver";
import type { DecodedBlock, DecodedEvent } from "@src/pipeline/decoded-block";

const BLOCK_TIME = new Date("2026-08-13T00:00:00Z");

describe("deriveAkashChanges", () => {
  it("derives message changes in transaction and message order with their coordinates", () => {
    const changes = deriveAkashChanges(
      block({
        messages: [
          {
            typeUrl: "/akash.deployment.v1beta4.MsgCreateDeployment",
            body: { id: { owner: "akash1owner", dseq: "1" }, groups: [], deposit: { amount: { denom: "uakt", amount: "500" } } }
          },
          {
            typeUrl: "/akash.market.v1beta5.MsgCreateBid",
            body: { id: { owner: "akash1owner", dseq: "1", gseq: 1, oseq: 1, bseq: 0, provider: "akash1prov" }, price: { denom: "uakt", amount: "2.5" } }
          }
        ]
      })
    );

    expect(changes.height).toBe(100);
    expect(changes.datetime).toBe(BLOCK_TIME);
    expect(changes.changes.map(change => [change.kind, change.txIndex, change.msgIndex])).toEqual([
      ["deploymentCreated", 0, 0],
      ["bidCreated", 0, 1]
    ]);
  });

  it("derives provider and audit changes alongside deployment ones", () => {
    const changes = deriveAkashChanges(
      block({
        messages: [
          {
            typeUrl: "/akash.provider.v1beta4.MsgCreateProvider",
            body: { owner: "akash1owner", hostUri: "https://provider.example.com:8443", attributes: [{ key: "region", value: "us-west" }], info: {} }
          },
          {
            typeUrl: "/akash.audit.v1.MsgSignProviderAttributes",
            body: { owner: "akash1owner", auditor: "akash1auditor", attributes: [{ key: "region", value: "us-west" }] }
          }
        ]
      })
    );

    expect(changes.changes).toEqual([
      {
        kind: "providerCreated",
        owner: "akash1owner",
        hostUri: "https://provider.example.com:8443",
        email: null,
        website: null,
        attributes: [{ key: "region", value: "us-west" }],
        txIndex: 0,
        msgIndex: 0
      },
      {
        kind: "providerAttributesSigned",
        owner: "akash1owner",
        auditor: "akash1auditor",
        attributes: [{ key: "region", value: "us-west" }],
        txIndex: 0,
        msgIndex: 1
      }
    ]);
  });

  it("unwraps an authz-wrapped audit sign", () => {
    const changes = deriveAkashChanges(
      block({
        messages: [
          {
            typeUrl: "/cosmos.authz.v1beta1.MsgExec",
            body: {
              grantee: "akash1grantee",
              msgs: [
                {
                  typeUrl: "/akash.audit.v1beta3.MsgSignProviderAttributes",
                  decoded: { owner: "akash1owner", auditor: "akash1auditor", attributes: [{ key: "tier", value: "community" }] }
                }
              ]
            }
          }
        ]
      })
    );

    expect(changes.changes).toEqual([
      {
        kind: "providerAttributesSigned",
        owner: "akash1owner",
        auditor: "akash1auditor",
        attributes: [{ key: "tier", value: "community" }],
        txIndex: 0,
        msgIndex: 0
      }
    ]);
  });

  it("skips messages in failed transactions", () => {
    const changes = deriveAkashChanges(
      block({
        code: 5,
        messages: [{ typeUrl: "/akash.deployment.v1beta4.MsgCloseDeployment", body: { id: { owner: "akash1owner", dseq: "1" } } }]
      })
    );

    expect(changes.changes).toEqual([]);
  });

  it("unwraps authz MsgExec through the decoder-provided decoded field, recursively", () => {
    const deposit = {
      typeUrl: "/akash.escrow.v1.MsgAccountDeposit",
      decoded: { signer: "akash1grantee", id: { scope: 1, xid: "akash1owner/7" }, deposit: { amount: { denom: "uakt", amount: "42" } } }
    };
    const changes = deriveAkashChanges(
      block({
        messages: [
          {
            typeUrl: "/cosmos.authz.v1beta1.MsgExec",
            body: { grantee: "akash1grantee", msgs: [{ typeUrl: "/cosmos.authz.v1beta1.MsgExec", decoded: { msgs: [deposit] } }] }
          }
        ]
      })
    );

    expect(changes.changes).toEqual([
      {
        kind: "deploymentDeposited",
        key: { owner: "akash1owner", dseq: "7" },
        amount: "42",
        depositor: "akash1grantee",
        txIndex: 0,
        msgIndex: 0
      }
    ]);
  });

  it("skips exec inner messages the decoder could not decode", () => {
    const changes = deriveAkashChanges(
      block({
        messages: [
          {
            typeUrl: "/cosmos.authz.v1beta1.MsgExec",
            body: { msgs: [{ typeUrl: "/akash.escrow.v1.MsgAccountDeposit", value: "AA==", decoded: null }] }
          }
        ]
      })
    );

    expect(changes.changes).toEqual([]);
  });

  it("derives legacy akash.v1 string close events after the transaction's messages", () => {
    const changes = deriveAkashChanges(
      block({
        messages: [{ typeUrl: "/akash.deployment.v1beta1.MsgCloseGroup", body: { id: { owner: "akash1owner", dseq: "3", gseq: 1 } } }],
        txEvents: [
          event("akash.v1", { action: "lease-closed", owner: "akash1owner", dseq: "3", gseq: "1", oseq: "1", provider: "akash1prov" }),
          event("akash.v1", { action: "deployment-closed", owner: "akash1owner", dseq: "3" })
        ]
      })
    );

    expect(changes.changes.map(change => change.kind)).toEqual(["groupClosed", "leaseClosedEvent", "deploymentClosedEvent"]);
    expect(changes.changes[1]).toMatchObject({ key: { owner: "akash1owner", dseq: "3" }, gseq: 1, oseq: 1, bseq: null, provider: "akash1prov" });
  });

  it("derives typed close events from their JSON id attribute", () => {
    const changes = deriveAkashChanges(
      block({
        txEvents: [
          event(
            "akash.market.v1.EventLeaseClosed",
            { id: JSON.stringify({ owner: "akash1owner", dseq: "3", gseq: 1, oseq: 1, bseq: 2, provider: "akash1prov" }) },
            0
          ),
          event("akash.deployment.v1.EventDeploymentClosed", { id: JSON.stringify({ owner: "akash1owner", dseq: "3" }) })
        ]
      })
    );

    expect(changes.changes).toEqual([
      { kind: "leaseClosedEvent", key: { owner: "akash1owner", dseq: "3" }, gseq: 1, oseq: 1, bseq: 2, provider: "akash1prov", txIndex: 0, msgIndex: 0 },
      { kind: "deploymentClosedEvent", key: { owner: "akash1owner", dseq: "3" }, txIndex: 0, msgIndex: null }
    ]);
  });

  it("ignores malformed close events and unrelated event types", () => {
    const changes = deriveAkashChanges(
      block({
        txEvents: [
          event("akash.v1", { action: "deployment-closed" }),
          event("akash.deployment.v1.EventDeploymentClosed", { id: "not-json" }),
          event("transfer", { amount: "1uakt" })
        ]
      })
    );

    expect(changes.changes).toEqual([]);
  });

  function block(input: {
    height?: number;
    code?: number;
    messages?: { typeUrl: string; body: unknown }[];
    txEvents?: DecodedEvent[];
    blockEvents?: DecodedEvent[];
  }): DecodedBlock {
    const messages = input.messages ?? [];
    return {
      height: input.height ?? 100,
      datetime: BLOCK_TIME,
      hash: Buffer.alloc(0),
      parentHash: null,
      proposerAddress: "P",
      transactions:
        messages.length > 0 || input.txEvents
          ? [
              {
                index: 0,
                hash: Buffer.alloc(0),
                code: input.code ?? 0,
                gasUsed: 0,
                gasWanted: 0,
                fee: [],
                messages: messages.map((message, index) => ({ index, typeUrl: message.typeUrl, body: message.body })),
                events: input.txEvents ?? [],
                signerAddresses: []
              }
            ]
          : [],
      blockEvents: input.blockEvents ?? []
    };
  }

  function event(type: string, attributes: Record<string, string>, msgIndex?: number): DecodedEvent {
    return msgIndex === undefined ? { type, attributes } : { type, attributes, msgIndex };
  }
});
