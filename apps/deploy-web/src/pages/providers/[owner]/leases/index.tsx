import { LeaseListContainer } from "@src/components/providers/LeaseListContainer";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";

type Props = {
  owner: string;
};

const ProviderLeasesPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <LeaseListContainer owner={owner} />;
};

export default ProviderLeasesPage;

export const getServerSideProps = getServerSidePropsWithServices<Props, Pick<Props, "owner">>(async ({ params }) => {
  return {
    props: {
      owner: params!.owner
    }
  };
});
