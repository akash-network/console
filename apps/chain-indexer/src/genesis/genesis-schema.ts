import { z } from "zod";

import { consensusHexAddress, operatorToAccountAddress } from "@src/genesis/genesis-address";

const BASE_ACCOUNT_TYPE = "/cosmos.auth.v1beta1.BaseAccount";
const MODULE_ACCOUNT_TYPE = "/cosmos.auth.v1beta1.ModuleAccount";
const VESTING_TYPE_PREFIX = "/cosmos.vesting.";
const MSG_CREATE_VALIDATOR_TYPE = "/cosmos.staking.v1beta1.MsgCreateValidator";

export type AccountType = "base" | "module" | "vesting";

export interface ParsedCoin {
  denom: string;
  amount: string;
}

export interface ParsedAccount {
  address: string;
  accountNumber: number | null;
  accountType: AccountType | null;
  isModuleAccount: boolean;
}

export interface ParsedBalance {
  address: string;
  coins: ParsedCoin[];
}

export interface ParsedValidator {
  operatorAddress: string;
  accountAddress: string | null;
  hexAddress: string | null;
  moniker: string | null;
  identity: string | null;
  website: string | null;
  details: string | null;
  securityContact: string | null;
  commissionRate: string | null;
  commissionMaxRate: string | null;
  commissionMaxChangeRate: string | null;
  minSelfDelegation: string | null;
}

export interface ParsedDelegation {
  delegatorAddress: string;
  validatorOperatorAddress: string;
  shares: string;
}

export interface ParsedGenesis {
  chainId: string;
  initialHeight: number;
  genesisTime: string;
  bondDenom: string | null;
  accounts: ParsedAccount[];
  /** Account `@type`s we don't model, surfaced so the caller can log them without failing the import. */
  unknownAccountTypes: string[];
  balances: ParsedBalance[];
  supply: ParsedCoin[];
  validators: ParsedValidator[];
  delegations: ParsedDelegation[];
}

const coinSchema = z.object({ denom: z.string(), amount: z.string() });

const baseAccountInnerSchema = z.object({ address: z.string().optional(), account_number: z.string().optional() }).passthrough();

const rawAccountSchema = z
  .object({
    "@type": z.string(),
    address: z.string().optional(),
    account_number: z.string().optional(),
    base_account: baseAccountInnerSchema.optional(),
    base_vesting_account: z.object({ base_account: baseAccountInnerSchema.optional() }).passthrough().optional()
  })
  .passthrough();

const descriptionSchema = z
  .object({
    moniker: z.string().optional(),
    identity: z.string().optional(),
    website: z.string().optional(),
    security_contact: z.string().optional(),
    details: z.string().optional()
  })
  .partial()
  .optional();

const pubkeySchema = z.object({ "@type": z.string(), key: z.string() });

const commissionRatesSchema = z.object({ rate: z.string().optional(), max_rate: z.string().optional(), max_change_rate: z.string().optional() });

const stakingValidatorSchema = z
  .object({
    operator_address: z.string(),
    consensus_pubkey: pubkeySchema.nullish(),
    description: descriptionSchema,
    commission: z.object({ commission_rates: commissionRatesSchema.optional() }).partial().optional(),
    min_self_delegation: z.string().optional()
  })
  .passthrough();

const createValidatorMsgSchema = z
  .object({
    "@type": z.string(),
    validator_address: z.string(),
    delegator_address: z.string().optional(),
    pubkey: pubkeySchema.nullish(),
    description: descriptionSchema,
    commission: commissionRatesSchema.optional(),
    min_self_delegation: z.string().optional()
  })
  .passthrough();

const delegationSchema = z.object({ delegator_address: z.string(), validator_address: z.string(), shares: z.string() });

const genesisSchema = z
  .object({
    chain_id: z.string(),
    initial_height: z.string().optional(),
    genesis_time: z.string().optional(),
    app_state: z
      .object({
        auth: z
          .object({ accounts: z.array(rawAccountSchema).optional() })
          .partial()
          .optional(),
        bank: z
          .object({
            balances: z.array(z.object({ address: z.string(), coins: z.array(coinSchema) })).optional(),
            supply: z.array(coinSchema).optional()
          })
          .partial()
          .optional(),
        staking: z
          .object({
            params: z.object({ bond_denom: z.string().optional() }).partial().optional(),
            validators: z.array(stakingValidatorSchema).optional(),
            delegations: z.array(delegationSchema).optional()
          })
          .partial()
          .optional(),
        genutil: z
          .object({ gen_txs: z.array(z.object({ body: z.object({ messages: z.array(z.record(z.unknown())) }).passthrough() }).passthrough()).optional() })
          .partial()
          .optional()
      })
      .passthrough()
  })
  .passthrough();

type RawAccount = z.infer<typeof rawAccountSchema>;
type RawStakingValidator = z.infer<typeof stakingValidatorSchema>;
type RawCreateValidatorMsg = z.infer<typeof createValidatorMsgSchema>;

/** Parses and validates the subset of a Cosmos-SDK genesis document the seeders need, normalizing snake_case + `@type` shapes into flat types. */
export function parseGenesis(raw: unknown): ParsedGenesis {
  const genesis = genesisSchema.parse(raw);
  const appState = genesis.app_state;

  const unknownAccountTypes = new Set<string>();
  const accounts: ParsedAccount[] = [];
  for (const rawAccount of appState.auth?.accounts ?? []) {
    const account = toParsedAccount(rawAccount);
    if (account) {
      accounts.push(account);
    } else {
      unknownAccountTypes.add(rawAccount["@type"]);
    }
  }

  return {
    chainId: genesis.chain_id,
    initialHeight: parseInt(genesis.initial_height ?? "1"),
    genesisTime: genesis.genesis_time ?? "",
    bondDenom: appState.staking?.params?.bond_denom ?? null,
    accounts,
    unknownAccountTypes: [...unknownAccountTypes],
    balances: (appState.bank?.balances ?? []).map(balance => ({ address: balance.address, coins: balance.coins })),
    supply: appState.bank?.supply ?? [],
    validators: [...(appState.staking?.validators ?? []).map(toValidatorFromStaking), ...gentxValidators(appState.genutil?.gen_txs ?? [])],
    delegations: (appState.staking?.delegations ?? []).map(delegation => ({
      delegatorAddress: delegation.delegator_address,
      validatorOperatorAddress: delegation.validator_address,
      shares: delegation.shares
    }))
  };
}

function toParsedAccount(raw: RawAccount): ParsedAccount | null {
  const type = raw["@type"];

  if (type === BASE_ACCOUNT_TYPE && raw.address) {
    return { address: raw.address, accountNumber: toNumberOrNull(raw.account_number), accountType: "base", isModuleAccount: false };
  }

  if (type === MODULE_ACCOUNT_TYPE && raw.base_account?.address) {
    return { address: raw.base_account.address, accountNumber: toNumberOrNull(raw.base_account.account_number), accountType: "module", isModuleAccount: true };
  }

  if (type.startsWith(VESTING_TYPE_PREFIX) && raw.base_vesting_account?.base_account?.address) {
    return {
      address: raw.base_vesting_account.base_account.address,
      accountNumber: toNumberOrNull(raw.base_vesting_account.base_account.account_number),
      accountType: "vesting",
      isModuleAccount: false
    };
  }

  return null;
}

function toValidatorFromStaking(validator: RawStakingValidator): ParsedValidator {
  return {
    operatorAddress: validator.operator_address,
    accountAddress: safeOperatorToAccountAddress(validator.operator_address),
    hexAddress: validator.consensus_pubkey ? consensusHexAddress(validator.consensus_pubkey["@type"], validator.consensus_pubkey.key) : null,
    ...mapDescription(validator.description),
    ...mapCommissionRates(validator.commission?.commission_rates),
    minSelfDelegation: validator.min_self_delegation ?? null
  };
}

function gentxValidators(genTxs: { body: { messages: Record<string, unknown>[] } }[]): ParsedValidator[] {
  return genTxs
    .flatMap(genTx => genTx.body.messages)
    .filter(message => message["@type"] === MSG_CREATE_VALIDATOR_TYPE)
    .map(message => toValidatorFromGentx(createValidatorMsgSchema.parse(message)));
}

function toValidatorFromGentx(message: RawCreateValidatorMsg): ParsedValidator {
  return {
    operatorAddress: message.validator_address,
    accountAddress: message.delegator_address ?? safeOperatorToAccountAddress(message.validator_address),
    hexAddress: message.pubkey ? consensusHexAddress(message.pubkey["@type"], message.pubkey.key) : null,
    ...mapDescription(message.description),
    ...mapCommissionRates(message.commission),
    minSelfDelegation: message.min_self_delegation ?? null
  };
}

/** The staking export nests commission rates under `commission.commission_rates`; a gentx message puts them directly under `commission`. Both resolve to `commissionRatesSchema`, so callers pass whichever their shape exposes. */
function mapCommissionRates(
  rates: z.infer<typeof commissionRatesSchema> | undefined
): Pick<ParsedValidator, "commissionRate" | "commissionMaxRate" | "commissionMaxChangeRate"> {
  return {
    commissionRate: rates?.rate ?? null,
    commissionMaxRate: rates?.max_rate ?? null,
    commissionMaxChangeRate: rates?.max_change_rate ?? null
  };
}

function mapDescription(
  description: z.infer<typeof descriptionSchema>
): Pick<ParsedValidator, "moniker" | "identity" | "website" | "details" | "securityContact"> {
  return {
    moniker: description?.moniker ?? null,
    identity: description?.identity ?? null,
    website: description?.website ?? null,
    details: description?.details ?? null,
    securityContact: description?.security_contact ?? null
  };
}

function safeOperatorToAccountAddress(operatorAddress: string): string | null {
  try {
    return operatorToAccountAddress(operatorAddress);
  } catch {
    return null;
  }
}

function toNumberOrNull(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
