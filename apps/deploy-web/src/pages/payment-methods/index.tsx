import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default function PaymentMethodsRedirect() {
  return null;
}

export const getServerSideProps = defineServerSideProps({
  route: "/payment-methods",
  if: () => ({ redirect: { destination: "/billing", permanent: false } })
});
