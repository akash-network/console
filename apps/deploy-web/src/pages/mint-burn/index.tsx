import { MintBurnPage } from "@src/components/MintBurnPage/MintBurnPage";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsSelfCustodyAccessible } from "@src/hoc/guard/useIsSelfCustodyAccessible";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isSelfCustodyEnabled } from "@src/lib/nextjs/pageGuards/selfCustody";

export default Guard(MintBurnPage, useIsSelfCustodyAccessible);

export const getServerSideProps = defineServerSideProps({
  route: "/mint-burn",
  if: ctx => isSelfCustodyEnabled(ctx)
});
