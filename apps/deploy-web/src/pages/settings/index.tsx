import { SettingsContainer } from "@src/components/settings/SettingsContainer";
import { Guard } from "@src/hoc/guard/guard.hoc";
import { useIsSelfCustodyAccessible } from "@src/hoc/guard/useIsSelfCustodyAccessible";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isSelfCustodyEnabled } from "@src/lib/nextjs/pageGuards/selfCustody";

export default Guard(SettingsContainer, useIsSelfCustodyAccessible);

export const getServerSideProps = defineServerSideProps({
  route: "/settings",
  if: ctx => isSelfCustodyEnabled(ctx)
});
