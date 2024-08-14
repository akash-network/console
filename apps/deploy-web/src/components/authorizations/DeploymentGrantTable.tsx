import { Button, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { GrantType } from "@src/types/grant";
import React, { Dispatch, SetStateAction } from "react";
import { GranterRow } from "./GranterRow";
import { LinkTo } from "../shared/LinkTo";

interface Props {
  grants: GrantType[];
  selectedGrants: GrantType[];
  onEditGrant: (grant: GrantType) => void;
  setDeletingGrants: Dispatch<SetStateAction<GrantType[] | null>>;
  setSelectedGrants: Dispatch<SetStateAction<GrantType[]>>;
}

const DeploymentGrantTable: React.FC<Props> = ({ grants, onEditGrant, setDeletingGrants, setSelectedGrants, selectedGrants }) => {
  const onSelectGrant = (checked: boolean, grant: GrantType) => {
    setSelectedGrants(prev => {
      return checked ? prev.concat([grant]) : prev.filter(x => x.grantee !== grant.grantee);
    });
  };

  const onGrantDelete = (grant: GrantType) => {
    setDeletingGrants([grant]);
  };

  const onDeleteGrants = () => {
    setDeletingGrants(selectedGrants);
  };

  const onDeleteAll = () => {
    setDeletingGrants(grants);
  };

  const onClearSelection = () => {
    setSelectedGrants([]);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/4">Grantee</TableHead>
          <TableHead className="w-1/4 text-center">Spending Limit</TableHead>
          <TableHead className="w-1/4 text-center">Expiration</TableHead>
          <TableHead className="w-1/4 text-center">
            {selectedGrants.length > 0 && (
              <div className="flex items-center justify-end space-x-4">
                <LinkTo onClick={onClearSelection} className="text-xs">
                  Clear
                </LinkTo>
                <Button onClick={onDeleteGrants} variant="destructive" size="sm" className="h-6 p-2 text-xs">
                  Revoke selected ({selectedGrants.length})
                </Button>
              </div>
            )}
            {grants.length > 0 && selectedGrants.length === 0 && (
              <div className="flex items-center justify-end">
                <Button onClick={onDeleteAll} variant="destructive" size="sm" className="h-6 p-2 text-xs">
                  Revoke all
                </Button>
              </div>
            )}
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {grants.map(grant => (
          <GranterRow
            key={grant.grantee}
            grant={grant}
            onEditGrant={onEditGrant}
            setDeletingGrant={onGrantDelete}
            onSelectGrant={onSelectGrant}
            checked={selectedGrants.some(x => x.grantee === grant.grantee && x.granter === grant.granter)}
          />
        ))}
      </TableBody>
    </Table>
  );
};

export default DeploymentGrantTable;
