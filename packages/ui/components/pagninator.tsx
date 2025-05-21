"use client";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "./pagination";

type PaginatorProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (pageNumber: number) => void;
  showPreviousNext: boolean;
};

export default function Paginator({ currentPage, totalPages, onPageChange, showPreviousNext }: PaginatorProps) {
  return (
    <Pagination>
      <PaginationContent>
        {showPreviousNext && totalPages ? (
          <PaginationItem className="hidden sm:list-item">
            <PaginationPrevious onClick={() => onPageChange(currentPage - 1)} disabled={currentPage - 1 < 1} />
          </PaginationItem>
        ) : null}
        {generatePaginationLinks(currentPage, totalPages, onPageChange)}
        {showPreviousNext && totalPages ? (
          <PaginationItem className="hidden sm:list-item">
            <PaginationNext onClick={() => onPageChange(currentPage + 1)} disabled={currentPage > totalPages - 1} />
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </Pagination>
  );
}

const generatePaginationLinks = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
  const pages: JSX.Element[] = [];

  if (totalPages <= 6) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <PaginationItem key={i}>
          <PaginationLink onClick={() => onPageChange(i)} isActive={i === currentPage}>
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    return pages;
  }

  pages.push(
    <PaginationItem key={1}>
      <PaginationLink onClick={() => onPageChange(1)} isActive={currentPage === 1}>
        1
      </PaginationLink>
    </PaginationItem>
  );

  if (currentPage > 4) {
    pages.push(<PaginationEllipsis key="ellipsis-start" />);
  }

  const startPage = Math.max(2, currentPage - 2);
  const endPage = Math.min(totalPages - 1, currentPage + 2);
  for (let i = startPage; i <= endPage; i++) {
    pages.push(
      <PaginationItem key={i}>
        <PaginationLink onClick={() => onPageChange(i)} isActive={i === currentPage}>
          {i}
        </PaginationLink>
      </PaginationItem>
    );
  }

  if (currentPage < totalPages - 3) {
    pages.push(<PaginationEllipsis key="ellipsis-end" />);
  }

  pages.push(
    <PaginationItem key={totalPages}>
      <PaginationLink onClick={() => onPageChange(totalPages)} isActive={currentPage === totalPages}>
        {totalPages}
      </PaginationLink>
    </PaginationItem>
  );

  return pages;
};
