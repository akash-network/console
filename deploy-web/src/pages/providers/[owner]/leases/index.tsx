import { LeaseListContainer } from "@src/components/providers/LeaseListContainer";

type Props = {
  owner: string;
};

const ProviderLeasesPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <LeaseListContainer owner={owner} />;
};

export default ProviderLeasesPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      owner: params?.owner
    }
  };
}
