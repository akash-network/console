import { ProviderRawData } from "@src/components/providers/ProviderRawData/ProviderRawData";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";

type Props = {
  owner: string;
};

const ProviderRawPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <ProviderRawData owner={owner} />;
};

export default ProviderRawPage;

export const getServerSideProps = getServerSidePropsWithServices<Props, Pick<Props, "owner">>(async ({ params }) => {
  return {
    props: {
      owner: params!.owner
    }
  };
});
