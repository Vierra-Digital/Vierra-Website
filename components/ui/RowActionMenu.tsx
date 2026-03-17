import React, { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

type RowActionMenuProps = {
  label: string;
  children: React.ReactNode;
  menuWidthClassName?: string;
};

const RowActionMenu: React.FC<RowActionMenuProps> = ({
  label,
  children,
  menuWidthClassName = "w-48",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current || !buttonRef.current) return;
      if (!menuRef.current.contains(event.target as Node) && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setPosition(null);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", onClickOutside);
      return () => document.removeEventListener("mousedown", onClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const showAbove = rect.top > window.innerHeight / 2;
    const estimatedMenuHeight = 150;
    setPosition({
      top: showAbove ? rect.top - estimatedMenuHeight - 2 : rect.bottom + 2,
      right: window.innerWidth - rect.right,
    });
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        aria-label={label}
      >
        <MoreVertical className="w-4 h-4 text-[#6B7280]" />
      </button>
      {isOpen && position && (
        <div
          ref={menuRef}
          className={`fixed ${menuWidthClassName} bg-white rounded-lg shadow-xl border border-[#E5E7EB] py-1 z-[100]`}
          style={{ top: `${position.top}px`, right: `${position.right}px` }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default RowActionMenu;
