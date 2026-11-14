"use client";
import { useEffect } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";

export const DEPENDENCIES = { useUser };

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Every tab shares one Auth0 session, so signing in as someone else in one tab leaves the others holding the previous
 * account's organization and pages; they reload before their next calls are refused under the new account.
 */
export function AccountSwitchSync({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { user } = d.useUser();
  const { signedInUserChannel, windowLocation } = useServices();
  const userId = user?.id;

  useEffect(
    function announceSignedInUser() {
      if (userId) signedInUserChannel.announce(userId);
    },
    [signedInUserChannel, userId]
  );

  useEffect(
    function reloadWhenAnotherTabSignsInAsSomeoneElse() {
      if (!userId) return;

      return signedInUserChannel.subscribe(announcedUserId => {
        if (announcedUserId !== userId) windowLocation.reload();
      });
    },
    [signedInUserChannel, windowLocation, userId]
  );

  return null;
}
