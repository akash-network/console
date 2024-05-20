import { UserSettingsForm } from "@src/components/user/UserSettingsForm";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

type Props = {};

const UserSettingsPage: React.FunctionComponent<Props> = ({}) => {
  return <UserSettingsForm />;
};

export default UserSettingsPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps({ params, req, res }) {
    return {
      props: {}
    };
  }
});
