import { RequiredUserContainer } from "@src/components/user/RequiredUserContainer";
import { UserSettingsForm } from "@src/components/user/UserSettingsForm";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

const UserSettingsPage: React.FunctionComponent = () => {
  return <RequiredUserContainer>{user => <UserSettingsForm user={user} />}</RequiredUserContainer>;
};

export default UserSettingsPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps() {
    return {
      props: {}
    };
  }
});
