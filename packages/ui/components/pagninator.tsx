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
  } else {
    for (let i = 1; i <= (currentPage > 4 ? 1 : 5); i++) {
      pages.push(
        <PaginationItem key={i}>
          <PaginationLink onClick={() => onPageChange(i)} isActive={i === currentPage}>
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    if (currentPage > 4 && currentPage < totalPages - 3) {
      pages.push(<PaginationEllipsis key="ellipsis-1" />);
      pages.push(
        <PaginationItem key={currentPage - 1}>
          <PaginationLink onClick={() => onPageChange(currentPage - 1)}>{currentPage - 1}</PaginationLink>
        </PaginationItem>
      );
      pages.push(
        <PaginationItem key={currentPage}>
          <PaginationLink onClick={() => onPageChange(currentPage)} isActive={true}>
            {currentPage}
          </PaginationLink>
        </PaginationItem>
      );
      pages.push(
        <PaginationItem key={currentPage + 1}>
          <PaginationLink onClick={() => onPageChange(currentPage + 1)}>{currentPage + 1}</PaginationLink>
        </PaginationItem>
      );
    }
    pages.push(<PaginationEllipsis key="ellipsis-2" />);
    for (let i = currentPage > totalPages - 4 ? totalPages - 4 : totalPages; i <= totalPages; i++) {
      pages.push(
        <PaginationItem key={i}>
          <PaginationLink onClick={() => onPageChange(i)} isActive={i === currentPage}>
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
  }
  return pages;
};
