import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default function NotificationChannelsRedirect() {
  return null;
}

export const getServerSideProps = defineServerSideProps({
  route: "/alerts/notification-channels",
  if: () => ({ redirect: { destination: "/alerts", permanent: false } })
});
