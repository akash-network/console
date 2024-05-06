import { Registry } from "@cosmjs/proto-signing";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgGrant, MsgRevoke, MsgGrantAllowance, MsgRevokeAllowance } from "./proto/grant";
import * as v1beta3 from "@akashnetwork/akash-api/v1beta3";
import * as v1beta4 from "@akashnetwork/akash-api/v1beta4";

export const customRegistry = new Registry();

// Akash v1beta3
customRegistry.register("/akash.deployment.v1beta3.MsgCloseDeployment", v1beta3.MsgCloseDeployment);
customRegistry.register("/akash.deployment.v1beta3.MsgCreateDeployment", v1beta3.MsgCreateDeployment);
customRegistry.register("/akash.deployment.v1beta3.MsgUpdateDeployment", v1beta3.MsgUpdateDeployment);
customRegistry.register("/akash.deployment.v1beta3.MsgDepositDeployment", v1beta3.MsgDepositDeployment);
customRegistry.register("/akash.deployment.v1beta3.DepositDeploymentAuthorization", v1beta3.DepositDeploymentAuthorization);
customRegistry.register("/akash.market.v1beta3.MsgCreateLease", v1beta3.MsgCreateLease);
customRegistry.register("/akash.cert.v1beta3.MsgRevokeCertificate", v1beta3.MsgRevokeCertificate);
customRegistry.register("/akash.cert.v1beta3.MsgCreateCertificate", v1beta3.MsgCreateCertificate);
customRegistry.register("/akash.provider.v1beta3.MsgUpdateProvider", v1beta3.MsgUpdateProvider);

// Akash v1beta4
customRegistry.register("/akash.market.v1beta4.MsgCreateLease", v1beta4.MsgCreateLease);

// Cosmos SDK
customRegistry.register("/cosmos.authz.v1beta1.MsgGrant", MsgGrant);
customRegistry.register("/cosmos.authz.v1beta1.MsgRevoke", MsgRevoke);
customRegistry.register("/cosmos.bank.v1beta1.MsgSend", MsgSend);
customRegistry.register("/cosmos.feegrant.v1beta1.MsgGrantAllowance", MsgGrantAllowance);
customRegistry.register("/cosmos.feegrant.v1beta1.MsgRevokeAllowance", MsgRevokeAllowance);
