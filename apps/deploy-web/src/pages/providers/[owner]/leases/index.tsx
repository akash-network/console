import type { GetServerSideProps } from "next";

import { LeaseListContainer } from "@src/components/providers/LeaseListContainer";
type Props = {
  owner: string;
};

const ProviderLeasesPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <LeaseListContainer owner={owner} />;
};

export default ProviderLeasesPage;

export const getServerSideProps: GetServerSideProps<Props, Pick<Props, "owner">> = async ({ params }) => {
  return {
    props: {
      owner: params!.owner
    }
  };
};
