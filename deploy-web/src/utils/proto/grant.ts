import { Field, Type } from "protobufjs";
export { MsgGrantAllowance, MsgRevokeAllowance } from "cosmjs-types/cosmos/feegrant/v1beta1/tx";
export { BasicAllowance, PeriodicAllowance, AllowedMsgAllowance } from "cosmjs-types/cosmos/feegrant/v1beta1/feegrant";

// TODO: Find a solution to the MsgGrant proto type not working from cosmjs-types

const Coin = new Type("Coin").add(new Field("denom", 1, "string")).add(new Field("amount", 2, "string"));

const Authorization = new Type("Authorization").add(Coin).add(new Field("spend_limit", 1, "Coin"));

const AnyGrantDeposit = new Type("AnyGrantDeposit")
  .add(new Field("type_url", 1, "string"))
  .add(new Field("value", 2, "Authorization"))
  .add(Authorization);

const Timestamp = new Type("Timestamp").add(new Field("seconds", 1, "uint64")).add(new Field("nanos", 2, "uint32"));
const Grant = new Type("Grant")
  .add(new Field("authorization", 1, "AnyGrantDeposit"))
  .add(AnyGrantDeposit)
  .add(new Field("expiration", 2, "Timestamp"))
  .add(Timestamp);

export const MsgGrant = new Type("MsgGrant")
  .add(new Field("granter", 1, "string"))
  .add(new Field("grantee", 2, "string"))
  .add(new Field("grant", 3, "Grant"))
  .add(Grant);
