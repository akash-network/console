"use client";
import { Card, CardContent } from "@/components/ui/card";
import React, { useState } from "react";
import { useAddressDeployments } from "@/queries";
import Spinner from "@/components/Spinner";
import { SearchX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeploymentRow } from "./DeploymentRow";

interface IProps {
  address: string;
}

export function AddressDeployments({ address }: IProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("*");
  const [isSortingReversed, setIsSortingReversed] = useState(true);
  const { data: deploymentsResult, isLoading } = useAddressDeployments(address, (page - 1) * pageSize, pageSize, isSortingReversed, { status: statusFilter });
  const pageCount = Math.ceil((deploymentsResult?.count || 0) / pageSize);

  function handlePageChange(event: React.ChangeEvent<unknown>, value: number) {
    setPage(value);
  }

  const handleRequestSort = (event: React.MouseEvent<unknown>) => {
    setIsSortingReversed(current => !current);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {deploymentsResult?.results.length === 0 && statusFilter === "*" ? (
          <div className="flex items-center p-4">
            <SearchX size="1rem" />
            &nbsp;This address has no deployments
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {/* <TableSortLabel active={true} direction={isSortingReversed ? "desc" : "asc"} onClick={handleRequestSort}>
                      DSEQ
                    </TableSortLabel> */}
                </TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created Height</TableHead>
                <TableHead>Specs</TableHead>
              </TableRow>

              <TableRow>
                <TableHead></TableHead>
                <TableHead className="text-center">
                  {/* <FormControl fullWidth size="small">
                    <Select value={statusFilter} onChange={ev => setStatusFilter(ev.target.value)} MenuProps={{ disableScrollLock: true }}>
                      <MenuItem value={"*"}>All</MenuItem>
                      <MenuItem value={"active"}>Active</MenuItem>
                      <MenuItem value={"closed"}>Closed</MenuItem>
                    </Select>
                  </FormControl> */}

                  <Select>
                    <SelectTrigger className="w-[180px] m-auto">
                      <SelectValue placeholder="Select a fruit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Fruits</SelectLabel>
                        <SelectItem value="apple">Apple</SelectItem>
                        <SelectItem value="banana">Banana</SelectItem>
                        <SelectItem value="blueberry">Blueberry</SelectItem>
                        <SelectItem value="grapes">Grapes</SelectItem>
                        <SelectItem value="pineapple">Pineapple</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </TableHead>
                <TableHead></TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>{deploymentsResult?.results.map(deployment => <DeploymentRow key={deployment.dseq} deployment={deployment} />)}</TableBody>
          </Table>
        )}
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <Spinner size="large" />
          </div>
        )}
        {/* {!!pageCount && (
          <div className={classes.pagerContainer}>
            <Pagination count={pageCount} page={page} onChange={handlePageChange} size="medium" />
          </div>
        )} */}
      </CardContent>
    </Card>
  );
}
