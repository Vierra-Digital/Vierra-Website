import React, { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

type RowActionMenuProps = {
  label: string;
  children: React.ReactNode;
  menuWidthClassName?: string;
};

type RowActionMenuItemProps = {
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "accent" | "danger";
  disabled?: boolean;
};

export const RowActionMenuItem: React.FC<RowActionMenuItemProps> = ({
  onClick,
  icon,
  children,
  tone = "default",
  disabled = false,
}) => {
  const toneClass =
    tone === "danger"
      ? "text-red-600 hover:bg-red-50"
      : tone === "accent"
        ? "text-[#701CC0] hover:bg-purple-50"
        : "text-[#374151] hover:bg-[#F7F3FF]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-2 text-left text-sm rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${toneClass}`}
    >
      {icon ? <span className="w-4 h-4 inline-flex items-center justify-center">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
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
        className={`p-1.5 rounded-lg border transition-colors ${
          isOpen
            ? "bg-[#F3E8FF] border-[#E9D5FF]"
            : "bg-white border-transparent hover:bg-[#F9F5FF] hover:border-[#E9D5FF]"
        }`}
        aria-label={label}
      >
        <MoreVertical className={`w-4 h-4 ${isOpen ? "text-[#701CC0]" : "text-[#6B7280]"}`} />
      </button>
      {isOpen && position && (
        <div
          ref={menuRef}
          className={`fixed ${menuWidthClassName} bg-white/95 backdrop-blur-sm rounded-xl border border-[#E9D5FF] shadow-[0_12px_32px_rgba(112,28,192,0.18)] p-1.5 z-[100]`}
          style={{ top: `${position.top}px`, right: `${position.right}px` }}
          onClick={() => {
            setIsOpen(false);
            setPosition(null);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default RowActionMenu;
