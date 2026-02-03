import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ctx => {
  const returnTo = ctx.query.returnTo;
  const destination = `/api/auth/login${returnTo ? `?returnTo=${encodeURIComponent(String(returnTo))}` : ""}`;

  return {
    redirect: {
      destination,
      permanent: false
    }
  };
};

export default function Login() {
  return null;
}
