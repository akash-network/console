"use client";
import type { MouseEvent, MouseEventHandler } from "react";
import { Address, Badge, CustomTooltip, Popup, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";

import { useAuditors } from "@src/queries/useProvidersQuery";
import { LinkTo } from "../shared/LinkTo";

type Props = {
  attributes: Array<{ key: string; value: string; auditedBy: Array<string> }>;
  onClose: MouseEventHandler<HTMLButtonElement>;
};

export const AuditorsModal: React.FunctionComponent<Props> = ({ attributes, onClose }) => {
  const { data: auditors } = useAuditors();

  const onWebsiteClick = (event: MouseEvent<unknown>, website: string) => {
    event.preventDefault();
    event.stopPropagation();

    window.open(website, "_blank");
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Audited Attributes"
      actions={[
        {
          label: "Close",
          color: "secondary",
          variant: "text",
          side: "left",
          onClick: onClose
        }
      ]}
      onClose={onClose}
      maxWidth="md"
      enableCloseOnBackdropClick
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="text-center">Auditors</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {attributes.map(a => {
            return (
              <TableRow key={a.key}>
                <TableCell>{a.key}</TableCell>
                <TableCell>{a.value}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-center space-y-1">
                    {a.auditedBy
                      .filter(x => auditors?.some(y => y.address === x))
                      .map(x => {
                        const auditor = auditors?.find(y => y.address === x);
                        if (!auditor) return null;
                        return (
                          <div key={x}>
                            <CustomTooltip
                              title={
                                <div className="flex flex-col items-center space-y-2">
                                  <LinkTo onClick={event => onWebsiteClick(event, auditor.website)}>{auditor?.website}</LinkTo>
                                  <Address address={auditor?.address || ""} isCopyable disableTooltip />
                                </div>
                              }
                            >
                              <div>
                                <Badge variant="outline">{auditor?.name}</Badge>
                              </div>
                            </CustomTooltip>
                          </div>
                        );
                      })}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Popup>
  );
};
