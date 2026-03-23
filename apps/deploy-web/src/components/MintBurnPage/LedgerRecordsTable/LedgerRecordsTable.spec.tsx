import React from "react";
import { describe, expect, it } from "vitest";

import { DEPENDENCIES, LedgerRecordsTable } from "./LedgerRecordsTable";

import { render, screen } from "@testing-library/react";
import { buildBlockDetail, buildBurnLedgerRecord, buildMintLedgerRecord, buildPendingMintLedgerRecord } from "@tests/seeders";

describe(LedgerRecordsTable.name, () => {
  it("shows empty state when no records", () => {
    setup({ records: [] });

    expect(screen.queryByText("No mint or burn history yet.")).toBeInTheDocument();
  });

  it("shows spinner when loading with no records", () => {
    setup({ records: [], isLoading: true });

    expect(screen.queryByText("No mint or burn history yet.")).not.toBeInTheDocument();
  });

  it("renders column headers", () => {
    setup({ records: [buildMintLedgerRecord()] });

    expect(screen.queryByText("Date")).toBeInTheDocument();
    expect(screen.queryByText("Type")).toBeInTheDocument();
    expect(screen.queryByText("Amount In")).toBeInTheDocument();
    expect(screen.queryByText("Amount Out")).toBeInTheDocument();
    expect(screen.queryByText("Rate")).toBeInTheDocument();
    expect(screen.queryByText("Status")).toBeInTheDocument();
  });

  it("renders mint record with Mint badge and Executed status", () => {
    setup({ records: [buildMintLedgerRecord()] });

    expect(screen.queryByText("Mint")).toBeInTheDocument();
    expect(screen.queryByText("Executed")).toBeInTheDocument();
  });

  it("renders burn record with Burn badge and Executed status", () => {
    setup({ records: [buildBurnLedgerRecord()] });

    expect(screen.queryByText("Burn")).toBeInTheDocument();
    expect(screen.queryByText("Executed")).toBeInTheDocument();
  });

  it("renders pending record with input amount and Pending status", () => {
    setup({ records: [buildPendingMintLedgerRecord({ amount: 10_000_000 })] });

    expect(screen.queryByText("Mint")).toBeInTheDocument();
    expect(screen.queryByText("10.00 AKT")).toBeInTheDocument();
    expect(screen.queryByText("Pending")).toBeInTheDocument();
  });

  it("renders mint record amounts and rate", () => {
    const record = buildMintLedgerRecord();
    setup({ records: [record] });

    const accrued = record.executed_record!.remint_credit_accrued!;
    const minted = record.executed_record!.minted!;
    const amountIn = (parseInt(accrued.coin.amount) / 1_000_000).toFixed(2);
    const amountOut = (parseInt(minted.coin.amount) / 1_000_000).toFixed(2);
    const rate = parseFloat(accrued.price).toFixed(4);

    expect(screen.queryByText(`${amountIn} AKT`)).toBeInTheDocument();
    expect(screen.queryByText(`${amountOut} ACT`)).toBeInTheDocument();
    expect(screen.queryByText(rate)).toBeInTheDocument();
  });

  it("renders burn record amounts and rate", () => {
    const record = buildBurnLedgerRecord();
    setup({ records: [record] });

    const burned = record.executed_record!.burned!;
    const issued = record.executed_record!.remint_credit_issued!;
    const amountIn = (parseInt(burned.coin.amount) / 1_000_000).toFixed(2);
    const amountOut = (parseInt(issued.coin.amount) / 1_000_000).toFixed(2);
    const rate = parseFloat(issued.price).toFixed(4);

    expect(screen.queryByText(`${amountIn} ACT`)).toBeInTheDocument();
    expect(screen.queryByText(`${amountOut} AKT`)).toBeInTheDocument();
    expect(screen.queryByText(rate)).toBeInTheDocument();
  });

  it("sorts records by height descending", () => {
    const older = buildMintLedgerRecord({ height: "80000" });
    const newer = buildBurnLedgerRecord({ height: "90000" });

    setup({ records: [older, newer] });

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Burn");
    expect(rows[2]).toHaveTextContent("Mint");
  });

  function setup(input: { records: Parameters<typeof LedgerRecordsTable>[0]["records"]; isLoading?: boolean }) {
    const blockDetail = buildBlockDetail();

    const dependencies = {
      ...DEPENDENCIES,
      useBlock: () => ({ data: blockDetail })
    } as unknown as typeof DEPENDENCIES;

    render(<LedgerRecordsTable records={input.records} isLoading={input.isLoading ?? false} dependencies={dependencies} />);
  }
});
