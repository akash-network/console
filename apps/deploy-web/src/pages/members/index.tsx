import { MembersPage } from "@src/components/organizations/MembersPage/MembersPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default MembersPage;

export const getServerSideProps = defineServerSideProps({
  route: "/members"
});
