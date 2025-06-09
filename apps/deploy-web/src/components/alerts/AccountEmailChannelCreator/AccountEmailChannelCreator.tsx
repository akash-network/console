import type { FC } from "react";
import { LoadingButton } from "@akashnetwork/ui/components";

import type { ChildrenProps } from "@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer";
import { NotificationChannelCreateContainer } from "@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer";
import { useUser } from "@src/hooks/useUser";

export const AccountEmailChannelCreateTrigger: FC<ChildrenProps & { email: string; testId?: string }> = props => {
  return (
    <LoadingButton
      data-testid={props.testId}
      loading={props.isLoading}
      onClick={() =>
        props.create({
          name: "Primary account email",
          emails: [props.email]
        })
      }
    >
      Use my account email
    </LoadingButton>
  );
};

export const AccountEmailChannelCreator = () => {
  const user = useUser();
  return (
    <NotificationChannelCreateContainer>
      {props => (user?.email ? <AccountEmailChannelCreateTrigger {...props} email={user.email} /> : null)}
    </NotificationChannelCreateContainer>
  );
};
