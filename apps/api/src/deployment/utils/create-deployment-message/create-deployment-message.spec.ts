import { DeploymentReclamation, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it } from "vitest";

import { decodeCreateDeploymentMessage, encodeCreateDeploymentMessage } from "./create-deployment-message";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe("create deployment message", () => {
  const owner = createAkashAddress();
  const message = MsgCreateDeployment.fromPartial({
    id: { owner, dseq: 1748400000000n },
    groups: [
      {
        name: "web",
        requirements: { signedBy: { allOf: [], anyOf: [] }, attributes: [{ key: "region", value: "us-west" }] },
        resources: [
          {
            resource: { id: 1, cpu: { units: { val: "500" }, attributes: [] } },
            count: 1,
            price: { denom: "uakt", amount: "1000.000000000000000000" }
          }
        ]
      }
    ],
    hash: new Uint8Array([4, 5, 6]),
    deposit: { amount: { denom: "uakt", amount: "500000" }, sources: [Source.grant] },
    reclamation: DeploymentReclamation.fromPartial({ minWindow: { seconds: 86400n } })
  });

  it("comes back from a job payload's JSON as the very bytes it was encoded from", () => {
    const { encoded } = JSON.parse(JSON.stringify({ encoded: encodeCreateDeploymentMessage(message) }));

    expect(MsgCreateDeployment.encode(decodeCreateDeploymentMessage(encoded).value).finish()).toEqual(MsgCreateDeployment.encode(message).finish());
  });

  it("keeps the deployment it creates, the version it commits to and the deposit it takes", () => {
    const { value } = decodeCreateDeploymentMessage(encodeCreateDeploymentMessage(message));

    expect(value.id).toEqual({ owner, dseq: 1748400000000n });
    expect(value.hash).toEqual(new Uint8Array([4, 5, 6]));
    expect(value.deposit).toEqual({ amount: { denom: "uakt", amount: "500000" }, sources: [Source.grant] });
  });

  it("names the message type the signer and its checks expect", () => {
    expect(decodeCreateDeploymentMessage(encodeCreateDeploymentMessage(message)).typeUrl).toBe("/akash.deployment.v1beta4.MsgCreateDeployment");
  });

  it("yields its bytes as a plain byte array rather than a buffer", () => {
    const { hash } = decodeCreateDeploymentMessage(encodeCreateDeploymentMessage(message)).value;

    expect(Buffer.isBuffer(hash)).toBe(false);
  });
});
