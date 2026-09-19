import React from "react";

/** Shared with ContactsPanel — both a contacts list load and a mailbox load use the same spinner. */
export const MailboxLoader: React.FC<{ label?: string }> = ({ label = "Loading messages..." }) => (
  <div className="h-full min-h-[320px] flex items-center justify-center px-6">
    <div className="text-center">
      <div className="mx-auto w-12 h-12 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
      <p className="mt-4 text-sm font-medium text-[#5B5E73]">{label}</p>
    </div>
  </div>
);
