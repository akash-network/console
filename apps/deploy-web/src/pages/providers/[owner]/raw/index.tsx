import type { GetServerSideProps } from "next";

import { ProviderRawData } from "@src/components/providers/ProviderRawData/ProviderRawData";
type Props = {
  owner: string;
};

const ProviderRawPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <ProviderRawData owner={owner} />;
};

export default ProviderRawPage;

export const getServerSideProps: GetServerSideProps<Props, Pick<Props, "owner">> = async ({ params }) => {
  return {
    props: {
      owner: params!.owner
    }
  };
};
