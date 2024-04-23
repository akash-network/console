import { Authorizations } from "@src/components/authorizations/Authorizations";

type Props = {};

const AuthorizationsPage: React.FunctionComponent<Props> = ({}) => {
  return <Authorizations />;
};

export default AuthorizationsPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
