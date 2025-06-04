import { LoadingButton } from "@akashnetwork/ui/components";

import { ContactPointCreateContainer } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import { useUser } from "@src/hooks/useUser";

export const AccountEmailContactPointCreator = () => {
  const { email } = useUser();
  return (
    <ContactPointCreateContainer>
      {props => (
        <LoadingButton
          loading={props.isLoading}
          onClick={() =>
            props.create({
              name: "Primary account email",
              emails: [email as string]
            })
          }
        >
          Use my account email
        </LoadingButton>
      )}
    </ContactPointCreateContainer>
  );
};
