import { AddressBookTable } from "@src/components/user/AddressBookTable";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

const UserAddressBookPage: React.FunctionComponent = () => {
  return <AddressBookTable />;
};

export default UserAddressBookPage;

export const getServerSideProps = withCustomPageAuthRequired({
  async getServerSideProps() {
    return {
      props: {}
    };
  }
});
