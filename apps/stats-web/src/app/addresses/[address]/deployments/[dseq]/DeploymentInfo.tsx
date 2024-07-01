"use client";

import { FormattedNumber } from "react-intl";
import { Address, Badge, Card, CardContent, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import Link from "next/link";

import { EventRow } from "./EventRow";

import { LabelValue } from "@/components/LabelValue";
import { LeaseSpecDetail } from "@/components/LeaseSpecDetail";
import { PriceValue } from "@/components/PriceValue";
import { Title } from "@/components/Title";
import { getSplitText } from "@/hooks/useShortText";
import { roundDecimal, udenomToDenom } from "@/lib/mathHelpers";
import { bytesToShrink } from "@/lib/unitUtils";
import { UrlService } from "@/lib/urlUtils";
import { DeploymentDetail } from "@/types";

interface IProps {
  deployment: DeploymentDetail;
}

export function DeploymentInfo({ deployment }: IProps) {
  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
      <div className="min-h-0 min-w-0">
        <Title subTitle className="mb-4">
          Summary
        </Title>

        <Card className="mb-4">
          <CardContent className="pt-6">
            <LabelValue
              label="Owner"
              value={
                <Link href={UrlService.address(deployment.owner)}>
                  <Address address={deployment.owner} />
                </Link>
              }
              labelWidth="12rem"
            />
            <LabelValue
              label="Status"
              value={<Badge variant={deployment.status === "active" ? "success" : "destructive"}>{deployment.status}</Badge>}
              labelWidth="12rem"
            />
            <LabelValue label="DSEQ" value={deployment.dseq} labelWidth="12rem" />
            <LabelValue label="Balance" value={<PriceValue value={udenomToDenom(deployment.balance)} denom={deployment.denom} />} labelWidth="12rem" />
            {deployment.leases.length > 0 && (
              <LabelValue
                label="Total Cost"
                value={
                  <>
                    <span>
                      <PriceValue value={udenomToDenom(deployment.totalMonthlyCostUDenom)} denom={deployment.denom} />
                    </span>
                    {deployment.denom === "uakt" && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        <FormattedNumber value={udenomToDenom(deployment.totalMonthlyCostUDenom)} /> $AKT per month
                      </span>
                    )}
                  </>
                }
                labelWidth="12rem"
              />
            )}
          </CardContent>
        </Card>

        <Title subTitle className="mb-4">
          Timeline
        </Title>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/4 text-center">Transaction</TableHead>
                  <TableHead className="w-1/4 text-center" align="center">
                    Event
                  </TableHead>
                  <TableHead className="w-1/4 text-center" align="center">
                    Date
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {deployment.events.map((event, i) => (
                  <EventRow key={`${event.txHash}_${i}`} event={event} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <div>
        <Title subTitle className="mb-4">
          Leases
        </Title>

        {deployment.leases.length === 0 && <>This deployment has no lease</>}
        {deployment.leases.map(lease => {
          const _ram = bytesToShrink(lease.memoryQuantity);
          const _storage = bytesToShrink(lease.storageQuantity);

          return (
            <Card key={lease.oseq + "_" + lease.gseq}>
              <CardContent className="pt-6">
                <LabelValue label="OSEQ" value={lease.oseq} labelWidth="12rem" />
                <LabelValue label="GSEQ" value={lease.gseq} labelWidth="12rem" />
                <LabelValue
                  label="Status"
                  value={<Badge variant={lease.status === "active" ? "success" : "destructive"}>{lease.status}</Badge>}
                  labelWidth="12rem"
                />
                <LabelValue
                  label="Total Cost"
                  value={
                    <>
                      <span>
                        <PriceValue value={udenomToDenom(lease.monthlyCostUDenom)} denom={deployment.denom} /> per month
                      </span>
                      {deployment.denom === "uakt" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          <FormattedNumber value={lease.monthlyCostUDenom} /> $AKT per month
                        </span>
                      )}
                    </>
                  }
                  labelWidth="12rem"
                />
                <LabelValue
                  label="Specs"
                  value={
                    <>
                      <LeaseSpecDetail type="cpu" value={lease.cpuUnits / 1_000} />
                      {!!lease.gpuUnits && <LeaseSpecDetail type="gpu" value={lease.gpuUnits} />}
                      <LeaseSpecDetail type="ram" value={`${roundDecimal(_ram.value, 1)} ${_ram.unit}`} />
                      <LeaseSpecDetail type="storage" value={`${roundDecimal(_storage.value, 1)} ${_storage.unit}`} />
                    </>
                  }
                  labelWidth="12rem"
                />
                <LabelValue
                  label="Provider"
                  value={
                    <>
                      <Link href={UrlService.address(lease.provider.address)} title={lease.provider.address}>
                        {getSplitText(lease.provider.address, 10, 10)}
                      </Link>
                      <br />
                      {new URL(lease.provider.hostUri).hostname}
                    </>
                  }
                  labelWidth="12rem"
                />
                <LabelValue
                  label="Provider Attributes"
                  value={lease.provider.attributes.map(attribute => (
                    <div key={attribute.key}>
                      {attribute.key}: {attribute.value}
                    </div>
                  ))}
                  labelWidth="12rem"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
