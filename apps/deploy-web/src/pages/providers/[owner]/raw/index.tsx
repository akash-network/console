import type { GetServerSidePropsResult } from "next";
import { z } from "zod";

import { ProviderRawData } from "@src/components/providers/ProviderRawData/ProviderRawData";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

type Props = {
  owner: string;
};

const ProviderRawPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <ProviderRawData owner={owner} />;
};

export default ProviderRawPage;

export const getServerSideProps = defineServerSideProps({
  route: "/providers/[owner]/raw",
  schema: z.object({
    params: z.object({
      owner: z.string()
    })
  }),
  async handler({ params }): Promise<GetServerSidePropsResult<Props>> {
    return {
      props: {
        owner: params.owner
      }
    };
  }
});
