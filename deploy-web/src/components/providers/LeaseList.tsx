import React, { useState, useEffect } from "react";
import {
  Typography,
  Box,
  Paper,
  CircularProgress,
  TableHead,
  TableContainer,
  Table,
  TableRow,
  TableCell,
  TableBody,
  FormControlLabel,
  Checkbox,
  Pagination
} from "@mui/material";
import isEqual from "lodash/isEqual";
import { LeaseRow } from "./LeaseRow";
import { makeStyles } from "tss-react/mui";
import { CustomTableHeader } from "../shared/CustomTable";
import { LeaseDto } from "@src/types/deployment";

const useStyles = makeStyles()(theme => ({
  pagination: {
    "& .MuiPagination-ul": {
      justifyContent: "center"
    }
  },
  title: {
    fontSize: "1.5rem"
  },
  flexCenter: {
    display: "flex",
    alignItems: "center"
  },
  monthlyCost: {
    marginLeft: ".5rem"
  }
}));

type Props = {
  leases: LeaseDto[];
  isLoadingLeases: boolean;
};

const MemoLeaseList: React.FunctionComponent<Props> = ({ leases, isLoadingLeases }) => {
  const [page, setPage] = useState(1);
  const { classes } = useStyles();
  const [filteredLeases, setFilteredLeases] = useState(leases || []);
  const [isFilteringActive, setIsFilteringActive] = useState(false);
  const rowsPerPage = 12;
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const currentPageLeases = filteredLeases.slice(start, end);
  const pageCount = Math.ceil(filteredLeases.length / rowsPerPage);

  useEffect(() => {
    if (leases) {
      let _filteredLeases = [...leases].sort((a, b) => (a.state === "active" ? -1 : 1));

      if (isFilteringActive) {
        _filteredLeases = _filteredLeases.filter(x => x.state === "active");
      }

      setFilteredLeases(_filteredLeases);
    }
  }, [leases, isFilteringActive]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const onIsActiveChange = (ev, value) => {
    setPage(1);
    setIsFilteringActive(value);
  };

  return (
    <>
      <Box sx={{ paddingBottom: ".5rem", display: "flex", alignItems: "center" }}>
        <Typography variant="h5" className={classes.title}>
          Your leases
        </Typography>

        <Box marginLeft="1rem">
          <FormControlLabel control={<Checkbox checked={isFilteringActive} onChange={onIsActiveChange} color="secondary" />} label="Active" />
        </Box>
      </Box>

      {currentPageLeases?.length === 0 && isLoadingLeases && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress color="secondary" />
        </Box>
      )}

      {currentPageLeases?.length === 0 && !isLoadingLeases && (
        <Typography variant="body2">You have 0 {isFilteringActive ? "active" : ""} lease for this provider.</Typography>
      )}

      {currentPageLeases?.length > 0 && (
        <>
          <TableContainer>
            <Table size="small">
              <CustomTableHeader>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Dseq</TableCell>
                  <TableCell>Price</TableCell>
                </TableRow>
              </CustomTableHeader>

              <TableBody>
                {currentPageLeases.map((lease, i) => (
                  <LeaseRow key={lease.id} lease={lease} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box padding="1rem 1rem 2rem" className={classes.pagination}>
            <Pagination count={pageCount} onChange={handleChangePage} page={page} size="medium" />
          </Box>
        </>
      )}
    </>
  );
};

export const LeaseList = React.memo(MemoLeaseList, (prevProps, nextProps) => {
  return isEqual(prevProps, nextProps);
});
