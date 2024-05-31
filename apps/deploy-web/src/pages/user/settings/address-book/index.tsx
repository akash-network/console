import { AddressBookTable } from "@src/components/user/AddressBookTable";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

type Props = {};

const UserAddressBookPage: React.FunctionComponent<Props> = ({}) => {
  return <AddressBookTable />;
};

export default UserAddressBookPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps({ params, req, res }) {
    return {
      props: {}
    };
  }
});
