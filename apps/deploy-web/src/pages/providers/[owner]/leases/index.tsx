import type { GetServerSidePropsResult } from "next";
import { z } from "zod";

import { LeaseListContainer } from "@src/components/providers/LeaseListContainer";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

type Props = {
  owner: string;
};

const ProviderLeasesPage: React.FunctionComponent<Props> = ({ owner }) => {
  return <LeaseListContainer owner={owner} />;
};

export default ProviderLeasesPage;

export const getServerSideProps = defineServerSideProps({
  route: "/providers/[owner]/leases",
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
