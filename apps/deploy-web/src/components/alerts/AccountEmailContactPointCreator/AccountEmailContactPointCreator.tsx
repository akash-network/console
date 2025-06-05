import type { FC } from "react";
import { LoadingButton } from "@akashnetwork/ui/components";

import type { ChildrenProps } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import { ContactPointCreateContainer } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import { useUser } from "@src/hooks/useUser";

export const AccountEmailContactPointCreateTrigger: FC<ChildrenProps & { email: string; testId?: string }> = props => {
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

export const AccountEmailContactPointCreator = () => {
  const user = useUser();
  return user?.email ? (
    <ContactPointCreateContainer>{props => <AccountEmailContactPointCreateTrigger {...props} email={user.email} />}</ContactPointCreateContainer>
  ) : null;
};
