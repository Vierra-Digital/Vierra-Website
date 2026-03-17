import React from "react";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
};

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
}) => {
  return (
    <div className="mt-4 pt-4 text-xs text-[#677489]">
      <div className="w-full flex items-center justify-center">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevious}
            disabled={currentPage <= 0}
            className="px-2 py-1 text-xs rounded border border-[#E5E7EB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs text-[#6B7280]">
            Page {currentPage + 1} of {Math.max(1, totalPages)}
          </span>
          <button
            onClick={onNext}
            disabled={currentPage >= totalPages - 1}
            className="px-2 py-1 text-xs rounded border border-[#E5E7EB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaginationControls;
