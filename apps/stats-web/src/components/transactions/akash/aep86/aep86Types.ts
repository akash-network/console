const VERIFICATION_TYPE_PREFIX = "/akash.verification.v1.";
const PROVIDER_TYPE_PREFIX = "/akash.provider.v1beta4.";

export const AEP86_MESSAGE_TYPE_URLS = [
  `${VERIFICATION_TYPE_PREFIX}MsgPostAuditorBond`,
  `${VERIFICATION_TYPE_PREFIX}MsgSubmitAttestation`,
  `${VERIFICATION_TYPE_PREFIX}MsgOpenAuditEscrow`,
  `${VERIFICATION_TYPE_PREFIX}MsgCancelAuditEscrow`,
  `${VERIFICATION_TYPE_PREFIX}MsgSettleAuditEscrow`,
  `${VERIFICATION_TYPE_PREFIX}MsgRevokeAttestation`,
  `${VERIFICATION_TYPE_PREFIX}MsgRemoveAttestation`,
  `${VERIFICATION_TYPE_PREFIX}MsgResignAuditor`,
  `${VERIFICATION_TYPE_PREFIX}MsgPostProviderBond`,
  `${VERIFICATION_TYPE_PREFIX}MsgWithdrawProviderBond`,
  `${VERIFICATION_TYPE_PREFIX}MsgPostSnapshotHash`,
  `${VERIFICATION_TYPE_PREFIX}MsgRegisterAuditor`,
  `${VERIFICATION_TYPE_PREFIX}MsgRenewAuditor`,
  `${VERIFICATION_TYPE_PREFIX}MsgRemoveAuditor`,
  `${VERIFICATION_TYPE_PREFIX}MsgRevokeProviderAttestation`,
  `${VERIFICATION_TYPE_PREFIX}MsgRevokeAllProviderAttestations`,
  `${VERIFICATION_TYPE_PREFIX}MsgRevokeAuditorAttestations`,
  `${VERIFICATION_TYPE_PREFIX}MsgResolveDiscrepancy`,
  `${VERIFICATION_TYPE_PREFIX}MsgSlashProviderBond`,
  `${VERIFICATION_TYPE_PREFIX}MsgUpdateParams`,
  `${PROVIDER_TYPE_PREFIX}MsgOpenProviderMaintenance`,
  `${PROVIDER_TYPE_PREFIX}MsgCloseProviderMaintenance`
] as const;

export const AEP86_EVENT_TYPE_URLS = [
  `${VERIFICATION_TYPE_PREFIX}EventAuditorRegistered`,
  `${VERIFICATION_TYPE_PREFIX}EventAuditorBondPosted`,
  `${VERIFICATION_TYPE_PREFIX}EventAuditorFrozen`,
  `${VERIFICATION_TYPE_PREFIX}EventAuditorLapsed`,
  `${VERIFICATION_TYPE_PREFIX}EventAuditorResigned`,
  `${VERIFICATION_TYPE_PREFIX}EventAuditorRemoved`,
  `${VERIFICATION_TYPE_PREFIX}EventAuditorRenewed`,
  `${VERIFICATION_TYPE_PREFIX}EventAttestationSubmitted`,
  `${VERIFICATION_TYPE_PREFIX}EventAttestationExpired`,
  `${VERIFICATION_TYPE_PREFIX}EventAttestationReplaced`,
  `${VERIFICATION_TYPE_PREFIX}EventAttestationRevoked`,
  `${VERIFICATION_TYPE_PREFIX}EventAttestationVoided`,
  `${VERIFICATION_TYPE_PREFIX}EventDiscrepancyDetected`,
  `${VERIFICATION_TYPE_PREFIX}EventDiscrepancyResolved`,
  `${VERIFICATION_TYPE_PREFIX}EventDiscrepancyTimedOut`,
  `${VERIFICATION_TYPE_PREFIX}EventProviderBondPosted`,
  `${VERIFICATION_TYPE_PREFIX}EventProviderBondSlashed`,
  `${VERIFICATION_TYPE_PREFIX}EventProviderBondWithdrawalInitiated`,
  `${VERIFICATION_TYPE_PREFIX}EventProviderBondWithdrawalCompleted`,
  `${VERIFICATION_TYPE_PREFIX}EventSnapshotHashPosted`,
  `${VERIFICATION_TYPE_PREFIX}EventSnapshotSuspended`,
  `${VERIFICATION_TYPE_PREFIX}EventSnapshotResumed`,
  `${VERIFICATION_TYPE_PREFIX}EventFeeEscrowed`,
  `${VERIFICATION_TYPE_PREFIX}EventFeeReleasedToAuditor`,
  `${VERIFICATION_TYPE_PREFIX}EventFeeReturnedToProvider`,
  `${VERIFICATION_TYPE_PREFIX}EventAuditEscrowOpened`,
  `${VERIFICATION_TYPE_PREFIX}EventAuditEscrowSettled`,
  `${VERIFICATION_TYPE_PREFIX}EventDepositReturnedToAuditor`,
  `${VERIFICATION_TYPE_PREFIX}EventDepositSlashed`,
  `${VERIFICATION_TYPE_PREFIX}EventVerificationGraceStarted`,
  `${VERIFICATION_TYPE_PREFIX}EventVerificationGraceEnded`,
  `${PROVIDER_TYPE_PREFIX}EventProviderMaintenanceOpened`,
  `${PROVIDER_TYPE_PREFIX}EventProviderMaintenanceClosed`
] as const;

const messageTypeUrls = new Set<string>(AEP86_MESSAGE_TYPE_URLS);
const eventTypeUrls = new Set<string>(AEP86_EVENT_TYPE_URLS);

function normalizeTypeUrl(typeUrl: string): string {
  return typeUrl.startsWith("/") ? typeUrl : `/${typeUrl}`;
}

export function isAep86MessageType(typeUrl: string): boolean {
  return messageTypeUrls.has(normalizeTypeUrl(typeUrl));
}

export function isAep86EventType(typeUrl: string): boolean {
  return eventTypeUrls.has(normalizeTypeUrl(typeUrl));
}
