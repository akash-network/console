"use client";

import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Link from "next/link";

import { AccountEmailChannelCreator } from "@src/components/alerts/AccountEmailChannelCreator/AccountEmailChannelCreator";
import type { ChildrenProps } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import type { FCWithChildren, FCWithFnChildren } from "@src/types/component";
import { UrlService } from "@src/utils/urlUtils";

export const COMPONENTS = {
  AccountEmailChannelCreator
};

export type Props = Pick<ChildrenProps, "data" | "isFetched"> & { components?: typeof COMPONENTS };

export const NotificationChannelsGuardView: FCWithChildren<Props> = ({ data, isFetched, children, components: c = COMPONENTS }) => {
  return (
    <LoadingBlocker isLoading={!isFetched} testId="loading-blocker">
      {isFetched && data.length ? (
        children
      ) : (
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="mb-4">To start using alerting you need to add at least one notification channel</div>
          <div className="flex gap-4">
            <Link href={UrlService.newNotificationChannel()} className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
              <span>Add notification channel</span>
            </Link>
            <c.AccountEmailChannelCreator />
          </div>
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
