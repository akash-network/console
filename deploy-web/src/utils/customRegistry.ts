import { Registry } from "@cosmjs/proto-signing";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { protoTypes } from "./proto";
import { TransactionMessageData } from "./TransactionMessageData";
import { MsgGrant } from "./proto/grant";

export let customRegistry: Registry;

export function registerTypes() {
  const registry = new Registry();
  registry.register(TransactionMessageData.Types.MSG_CLOSE_DEPLOYMENT, protoTypes.MsgCloseDeployment);
  registry.register(TransactionMessageData.Types.MSG_CREATE_DEPLOYMENT, protoTypes.MsgCreateDeployment);
  registry.register(TransactionMessageData.Types.MSG_UPDATE_DEPLOYMENT, protoTypes.MsgUpdateDeployment);
  registry.register(TransactionMessageData.Types.MSG_DEPOSIT_DEPLOYMENT, protoTypes.MsgDepositDeployment);
  registry.register(TransactionMessageData.Types.MSG_DEPOSIT_DEPLOYMENT_AUTHZ, protoTypes.DepositDeploymentAuthorization);
  registry.register(TransactionMessageData.Types.MSG_CREATE_LEASE, protoTypes.MsgCreateLease);
  registry.register(TransactionMessageData.Types.MSG_REVOKE_CERTIFICATE, protoTypes.MsgRevokeCertificate);
  registry.register(TransactionMessageData.Types.MSG_CREATE_CERTIFICATE, protoTypes.MsgCreateCertificate);
  registry.register(TransactionMessageData.Types.MSG_UPDATE_PROVIDER, protoTypes.MsgUpdateProvider);
  registry.register(TransactionMessageData.Types.MSG_GRANT, MsgGrant);
  registry.register(TransactionMessageData.Types.MSG_REVOKE, MsgRevoke);
  registry.register(TransactionMessageData.Types.MSG_SEND_TOKENS, MsgSend);

  customRegistry = registry;
}
