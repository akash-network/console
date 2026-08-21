import type { ParsedGenesis } from "@src/genesis/genesis-schema";

const VALIDATOR_OPERATOR_ADDRESS = "akashvaloper1dq9wvqemmpvanmwsdttajsn4hmtx5zk7cgw7cz";
const VALIDATOR_ACCOUNT_ADDRESS = "akash1dq9wvqemmpvanmwsdttajsn4hmtx5zk7j2qcgg";
const VALIDATOR_PUBKEY = "1YM8H2iPYXxzSEQeFJQipwRnWV4sB2EKgujqdeTYLJs=";
const VALIDATOR_HEX_ADDRESS = "31410FDD5FF7717918AB0D32645E12B6863B2576";

/**
 * A small but representative Cosmos-SDK genesis document: a base account, a module account, and a
 * vesting account whose balances total exactly `bank.supply`, one validator created via a genutil
 * gentx, and one explicit delegation. Mirrors the sandbox-2 gentx shape verified against live RPC.
 */
export function buildRawGenesis(): Record<string, unknown> {
  return {
    chain_id: "sandbox-2",
    initial_height: "1",
    genesis_time: "2025-10-03T17:35:37Z",
    app_state: {
      auth: {
        accounts: [
          { "@type": "/cosmos.auth.v1beta1.BaseAccount", address: "akash1base", account_number: "1", sequence: "0" },
          {
            "@type": "/cosmos.auth.v1beta1.ModuleAccount",
            base_account: { address: "akash1module", account_number: "2", sequence: "0" },
            name: "bonded_tokens_pool",
            permissions: []
          },
          {
            "@type": "/cosmos.vesting.v1beta1.ContinuousVestingAccount",
            base_vesting_account: {
              base_account: { address: "akash1vesting", account_number: "3", sequence: "0" },
              original_vesting: [{ denom: "uakt", amount: "20" }]
            },
            start_time: "0"
          }
        ]
      },
      bank: {
        balances: [
          { address: "akash1base", coins: [{ denom: "uakt", amount: "10" }] },
          { address: "akash1module", coins: [{ denom: "uakt", amount: "5" }] },
          { address: "akash1vesting", coins: [{ denom: "uakt", amount: "20" }] }
        ],
        supply: [{ denom: "uakt", amount: "35" }]
      },
      staking: {
        params: { bond_denom: "uakt" },
        validators: [],
        delegations: [{ delegator_address: "akash1base", validator_address: VALIDATOR_OPERATOR_ADDRESS, shares: "1000000.000000000000000000" }]
      },
      genutil: {
        gen_txs: [
          {
            body: {
              messages: [
                {
                  "@type": "/cosmos.staking.v1beta1.MsgCreateValidator",
                  description: { moniker: "validator-01", identity: "", website: "", security_contact: "", details: "" },
                  commission: { rate: "0.100000000000000000", max_rate: "0.200000000000000000", max_change_rate: "0.010000000000000000" },
                  min_self_delegation: "1",
                  delegator_address: VALIDATOR_ACCOUNT_ADDRESS,
                  validator_address: VALIDATOR_OPERATOR_ADDRESS,
                  pubkey: { "@type": "/cosmos.crypto.ed25519.PubKey", key: VALIDATOR_PUBKEY },
                  value: { denom: "uakt", amount: "1000000" }
                }
              ]
            }
          }
        ]
      }
    }
  };
}

/** The exact `ParsedGenesis` that `parseGenesis(buildRawGenesis())` must produce. */
export function buildParsedGenesis(): ParsedGenesis {
  return {
    chainId: "sandbox-2",
    initialHeight: 1,
    genesisTime: "2025-10-03T17:35:37Z",
    bondDenom: "uakt",
    accounts: [
      { address: "akash1base", accountNumber: 1, accountType: "base", isModuleAccount: false },
      { address: "akash1module", accountNumber: 2, accountType: "module", isModuleAccount: true },
      { address: "akash1vesting", accountNumber: 3, accountType: "vesting", isModuleAccount: false }
    ],
    unknownAccountTypes: [],
    balances: [
      { address: "akash1base", coins: [{ denom: "uakt", amount: "10" }] },
      { address: "akash1module", coins: [{ denom: "uakt", amount: "5" }] },
      { address: "akash1vesting", coins: [{ denom: "uakt", amount: "20" }] }
    ],
    supply: [{ denom: "uakt", amount: "35" }],
    validators: [
      {
        operatorAddress: VALIDATOR_OPERATOR_ADDRESS,
        accountAddress: VALIDATOR_ACCOUNT_ADDRESS,
        hexAddress: VALIDATOR_HEX_ADDRESS,
        moniker: "validator-01",
        identity: "",
        website: "",
        details: "",
        securityContact: "",
        commissionRate: "0.100000000000000000",
        commissionMaxRate: "0.200000000000000000",
        commissionMaxChangeRate: "0.010000000000000000",
        minSelfDelegation: "1"
      }
    ],
    delegations: [{ delegatorAddress: "akash1base", validatorOperatorAddress: VALIDATOR_OPERATOR_ADDRESS, shares: "1000000.000000000000000000" }]
  };
}
