import { EditProviderContainer } from "@src/components/providers/EditProviderContainer";

type Props = {
  owner: string;
};

const ProviderEditPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <EditProviderContainer owner={owner} />;
};

export default ProviderEditPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      owner: params?.owner
    }
  };
}
