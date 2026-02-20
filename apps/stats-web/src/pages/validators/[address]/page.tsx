import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { Alert, Spinner } from "@akashnetwork/ui/components";

import { ValidatorsInfo } from "./ValidatorInfo";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { useValidator } from "@/queries";

export function ValidatorDetailPage() {
  const { address } = useParams<{ address: string }>();
  const { data: validator, isLoading, error } = useValidator(address || "");

  if (error) {
    return (
      <PageContainer>
        <Title>Validator Details</Title>
        <Alert variant="destructive" className="mt-6">
          Error loading validator data. Please try again.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <>
      <Helmet>
        <title>{validator ? `Validator ${validator.moniker}` : "Validator Details"} - Akash Network Stats</title>
      </Helmet>
      <PageContainer>
        <Title>Validator Details</Title>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Spinner size="large" />
          </div>
        )}

        {!isLoading && !validator && (
          <div className="py-8 text-center text-muted-foreground">Validator not found. Please check the address and try again.</div>
        )}

        {validator && (
          <div className="mt-6">
            <ValidatorsInfo validator={validator} />
          </div>
        )}
      </PageContainer>
    </>
  );
}
