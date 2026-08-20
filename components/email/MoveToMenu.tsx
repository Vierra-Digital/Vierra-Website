import type { ReactNode } from "react";
import { FiArchive, FiInbox, FiSlash, FiTag, FiTrash2 } from "react-icons/fi";

/**
 * The Move To dropdown, shared by the list toolbar and the open-message toolbar.
 *
 * These were two identical copies of this markup, which is how they drifted: a rule about which
 * views may move messages had to be applied at every copy, and it was missed at some of them twice.
 * One component means the menus cannot disagree about what moving a message offers.
 *
 * Mailbox destinations come first, then labels in their own scrolling group — a mailbox move and a
 * label are different operations, and an account with many labels would otherwise bury the four
 * destinations that matter under them.
 */

export type MoveToOption = { value: string; label: string };

const MAILBOX_ICONS: Record<string, ReactNode> = {
  inbox: <FiInbox className="h-3.5 w-3.5 shrink-0" />,
  archive: <FiArchive className="h-3.5 w-3.5 shrink-0" />,
  spam: <FiSlash className="h-3.5 w-3.5 shrink-0" />,
  trash: <FiTrash2 className="h-3.5 w-3.5 shrink-0" />,
};

const ITEM_CLASS =
  "email-menu-item flex w-full items-center gap-2.5 px-2.5 py-[7px] text-left text-[12.5px] font-medium";

export default function MoveToMenu({
  options,
  onSelect,
  keyPrefix,
}: {
  options: MoveToOption[];
  onSelect: (value: string) => void;
  /** Distinguishes the two mounted copies' React keys; they can both be open in principle. */
  keyPrefix: string;
}) {
  const isLabel = (option: MoveToOption) => option.value.startsWith("label:");
  const mailboxes = options.filter((option) => !isLabel(option));
  const labels = options.filter(isLabel);

  return (
    <div className="email-menu absolute right-0 top-[calc(100%+6px)] z-20 min-w-[164px]">
      {mailboxes.map((option) => (
        <button
          key={`${keyPrefix}-${option.value}`}
          type="button"
          onClick={() => onSelect(option.value)}
          className={ITEM_CLASS}
        >
          {MAILBOX_ICONS[option.value] ?? null}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
      {labels.length > 0 ? (
        <>
          <div className="h-1.5" />
          <div className="max-h-48 overflow-y-auto">
            {labels.map((option) => (
              <button
                key={`${keyPrefix}-${option.value}`}
                type="button"
                onClick={() => onSelect(option.value)}
                className={ITEM_CLASS}
              >
                <FiTag className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
