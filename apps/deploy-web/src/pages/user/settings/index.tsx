import { UserSettingsForm } from "@src/components/user/UserSettingsForm";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

const UserSettingsPage: React.FunctionComponent = () => {
  return <UserSettingsForm />;
};

export default UserSettingsPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps() {
    return {
      props: {}
    };
  }
});
