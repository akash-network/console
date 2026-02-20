import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { PageContainer } from "@/components/PageContainer";

export function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Not Found - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-12">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-8 text-lg text-muted-foreground">Page not found</p>
          <Link to="/" className="text-primary hover:underline">
            Go back home
          </Link>
        </div>
      </PageContainer>
    </>
  );
}
