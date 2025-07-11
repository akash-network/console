import type { GetServerSidePropsResult } from "next";
import { z } from "zod";

import { EditProviderContainer } from "@src/components/providers/EditProviderContainer";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

type Props = {
  owner: string;
};

const ProviderEditPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <EditProviderContainer owner={owner} />;
};

export default ProviderEditPage;

export const getServerSideProps = defineServerSideProps({
  route: "/providers/[owner]/edit",
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
