import { useEffect } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";

export const DEPENDENCIES = { useRouter, useSnackbar };

const ACCOUNT_DELETED_STORAGE_KEY = "accountDeleted";

/** Session storage outlives the sign-out round trip through Auth0 in the same tab, which a query param would not. */
export function markAccountDeleted() {
  try {
    window.sessionStorage.setItem(ACCOUNT_DELETED_STORAGE_KEY, "1");
  } catch {
    return;
  }
}

function consumeAccountDeletedMark(): boolean {
  try {
    const isMarked = window.sessionStorage.getItem(ACCOUNT_DELETED_STORAGE_KEY) !== null;
    window.sessionStorage.removeItem(ACCOUNT_DELETED_STORAGE_KEY);
    return isMarked;
  } catch {
    return false;
  }
}

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function AccountDeletedNotice({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const router = d.useRouter();
  const { enqueueSnackbar } = d.useSnackbar();

  useEffect(
    function announceDeletedAccount() {
      function announceWhenMarked() {
        if (!consumeAccountDeletedMark()) return;
        enqueueSnackbar(<Snackbar title="Your account has been deleted" subTitle="Thanks for using Akash Console." iconVariant="success" />, {
          variant: "success"
        });
      }

      announceWhenMarked();
      router.events.on("routeChangeComplete", announceWhenMarked);
      return function unsubscribe() {
        router.events.off("routeChangeComplete", announceWhenMarked);
      };
    },
    [enqueueSnackbar, router.events]
  );

  return null;
}
