"use client";
import { useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import type { AccountStatusRefusal } from "@src/services/account-status-refusal/account-status-refusal";

export const DEPENDENCIES = { useUser, useSnackbar, Snackbar };

const REFUSAL_TITLE: Record<AccountStatusRefusal["status"], string> = {
  suspended: "Your account is suspended",
  terminated: "Your account has been terminated"
};

const REASONLESS_SUBTITLE = "Contact support to find out more.";

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

/**
 * A tab opened before the account changed state still holds the old profile, so a refusal naming the state reloads
 * it, which brings up the banner and turns off the controls; the in-flight guard turns a burst of refusals into one reload and one toast.
 */
export function AccountStatusSync({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { checkSession } = d.useUser();
  const { enqueueSnackbar } = d.useSnackbar();
  const { accountStatusRefusalNotifier, logger } = useServices();
  const isReloadingRef = useRef(false);

  useEffect(
    function reloadProfileOnRefusal() {
      return accountStatusRefusalNotifier.subscribe(async refusal => {
        if (isReloadingRef.current) return;
        isReloadingRef.current = true;
        enqueueSnackbar(<d.Snackbar title={REFUSAL_TITLE[refusal.status]} subTitle={refusal.reason ?? REASONLESS_SUBTITLE} iconVariant="error" />, {
          variant: "error"
        });
        try {
          await checkSession();
        } catch (error) {
          logger.error({ event: "ACCOUNT_STATUS_PROFILE_RELOAD_FAILED", error });
        } finally {
          isReloadingRef.current = false;
        }
      });
    },
    [accountStatusRefusalNotifier, checkSession, enqueueSnackbar, logger, d]
  );

  return null;
}
