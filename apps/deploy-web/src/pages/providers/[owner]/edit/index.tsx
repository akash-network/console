import { GetServerSideProps } from "next";

import { EditProviderContainer } from "@src/components/providers/EditProviderContainer";

type Props = {
  owner: string;
};

const ProviderEditPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <EditProviderContainer owner={owner} />;
};

export default ProviderEditPage;

export const getServerSideProps: GetServerSideProps<Props, Pick<Props, "owner">> = async ({ params }) => {
  return {
    props: {
      owner: params!.owner
    }
  };
};
