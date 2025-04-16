import { EditProviderContainer } from "@src/components/providers/EditProviderContainer";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";

type Props = {
  owner: string;
};

const ProviderEditPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <EditProviderContainer owner={owner} />;
};

export default ProviderEditPage;

export const getServerSideProps = getServerSidePropsWithServices<Props, Pick<Props, "owner">>(async ({ params }) => {
  return {
    props: {
      owner: params!.owner
    }
  };
});
