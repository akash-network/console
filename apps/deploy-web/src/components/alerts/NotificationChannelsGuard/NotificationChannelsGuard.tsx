"use client";

import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";

import { AccountEmailChannelCreator } from "@src/components/alerts/AccountEmailChannelCreator/AccountEmailChannelCreator";
import { NotificationChannelDialog } from "@src/components/alerts/NotificationChannelDialog/NotificationChannelDialog";
import type { ChildrenProps } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import type { FCWithChildren, FCWithFnChildren } from "@src/types/component";

export const COMPONENTS = {
  AccountEmailChannelCreator,
  NotificationChannelDialog
};

export type Props = Pick<ChildrenProps, "data" | "isFetched"> & { components?: typeof COMPONENTS };

export const NotificationChannelsGuardView: FCWithChildren<Props> = ({ data, isFetched, children, components: c = COMPONENTS }) => {
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  return (
    <LoadingBlocker isLoading={!isFetched} testId="loading-blocker">
      {isFetched && data.length ? (
        children
      ) : (
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="mb-4">To start using alerting you need to add at least one notification channel</div>
          <div className="flex gap-4">
            <Button onClick={() => setIsAddingChannel(true)}>Add notification channel</Button>
            <c.AccountEmailChannelCreator />
          </div>
          {isAddingChannel && <c.NotificationChannelDialog onClose={() => setIsAddingChannel(false)} />}
        </div>
      )}
    </LoadingBlocker>
  );
};

export const NotificationChannelsGuard: FCWithFnChildren<object, ChildrenProps> = ({ children }) => {
  return (
    <NotificationChannelsListContainer>
      {notificationChannelList => (
        <NotificationChannelsGuardView data={notificationChannelList.data} isFetched={notificationChannelList.isFetched}>
          {children(notificationChannelList)}
        </NotificationChannelsGuardView>
      )}
    </NotificationChannelsListContainer>
  );
};
