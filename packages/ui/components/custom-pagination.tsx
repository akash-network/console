"use client";
import Paginator from "./pagninator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

interface Props {
  pageIndex: number;
  pageSize: number;
  totalPageCount: number;
  setPageSize: (pageSize: number) => void;
  setPageIndex: (pageIndex: number) => void;
}

export const MIN_PAGE_SIZE = 10;

export function CustomPagination({ pageIndex, totalPageCount, pageSize, setPageSize, setPageIndex }: React.PropsWithChildren<Props>) {
  return (
    <div className="flex flex-col items-center justify-between px-2 md:flex-row md:space-x-4">
      <PaginationSizeSelector pageSize={pageSize} setPageSize={setPageSize} />
      <div className="my-4 flex items-center justify-center whitespace-nowrap text-xs md:my-0">
        Page {pageIndex + 1} of {totalPageCount}
      </div>
      <div>
        <Paginator currentPage={pageIndex + 1} totalPages={totalPageCount} onPageChange={pageNumber => setPageIndex(pageNumber - 1)} showPreviousNext />
      </div>
    </div>
  );
}

export function PaginationSizeSelector({ pageSize, setPageSize }: { pageSize: number; setPageSize: (pageSize: number) => void }) {
  return (
    <div className="flex items-center space-x-2">
      <p className="text-xs">Rows per page</p>
      <Select
        value={`${pageSize}`}
        onValueChange={value => {
          setPageSize(Number(value));
        }}
      >
        <SelectTrigger className="h-8 w-[70px]">
          <SelectValue placeholder={pageSize} />
        </SelectTrigger>
        <SelectContent side="top">
          {[MIN_PAGE_SIZE, 20, 30, 40, 50].map(val => (
            <SelectItem key={val} value={`${val}`}>
              {val}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
