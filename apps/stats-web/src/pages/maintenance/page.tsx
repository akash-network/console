import { Helmet } from "react-helmet-async";
import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";
import { AlertTriangle } from "lucide-react";

import PageContainer from "@/components/PageContainer";

export function MaintenancePage() {
  return (
    <>
      <Helmet>
        <title>Maintenance - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <Alert className="max-w-lg">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Under Maintenance</AlertTitle>
            <AlertDescription>
              We are currently performing scheduled maintenance. Please check back shortly.
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    </>
  );
}
