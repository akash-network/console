import { type Deposit, MsgAccountDeposit, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Coin } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { EncodeObject } from "@cosmjs/proto-signing";

const DEPOSIT_READERS = new Map<string, (value: unknown) => Deposit | undefined>([
  [`/${MsgCreateDeployment.$type}`, value => (value as MsgCreateDeployment).deposit],
  [`/${MsgAccountDeposit.$type}`, value => (value as MsgAccountDeposit).deposit]
]);

/** A user wallet holds no coins of its own, so a deposit that names a grant among its sources is paid by a funding wallet. */
export function readGrantFundedDeposits(messages: readonly EncodeObject[]): Coin[] {
  return messages.flatMap(message => {
    const deposit = DEPOSIT_READERS.get(message.typeUrl)?.(message.value);

    return deposit?.amount && deposit.sources.includes(Source.grant) ? [deposit.amount] : [];
  });
}
