/** authz MsgExec type URL; managed-wallet deployments arrive wrapped in one (occasionally two) of these. */
export const MSG_EXEC_TYPE_URL = "/cosmos.authz.v1beta1.MsgExec";

/** MsgExec nested in MsgExec is legal on-chain; two levels covers every observed use without unbounded recursion. The decoder enriches and the deriver walks to the same depth so the two passes stay in step. */
export const MAX_EXEC_DEPTH = 2;
