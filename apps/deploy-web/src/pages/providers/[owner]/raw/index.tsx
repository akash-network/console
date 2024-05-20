import { ProviderRawData } from "@src/components/providers/ProviderRawData";

type Props = {
  owner: string;
};

const ProviderRawPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <ProviderRawData owner={owner} />;
};

export default ProviderRawPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      owner: params?.owner
    }
  };
}
