import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import Paginator from "./Pagninator";

interface Props {
  pageIndex: number;
  pageSize: number;
  totalPageCount: number;
  setPageSize: (pageSize: number) => void;
  setPageIndex: (pageIndex: number) => void;
}

export function CustomPagination({ pageIndex, totalPageCount, pageSize, setPageSize, setPageIndex }: React.PropsWithChildren<Props>) {
  return (
    <div className="flex flex-col items-center justify-between px-2 sm:flex-row">
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
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
              {[10, 20, 30, 40, 50].map((val, i) => (
                <SelectItem key={i} value={`${val}`}>
                  {val}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row">
          <div className="mb-2 flex w-[100px] items-center justify-center text-sm font-medium sm:mb-0">
            Page {pageIndex + 1} of {totalPageCount}
          </div>

          <Paginator currentPage={pageIndex + 1} totalPages={totalPageCount} onPageChange={pageNumber => setPageIndex(pageNumber - 1)} showPreviousNext />
        </div>
      </div>
    </div>
  );
}
