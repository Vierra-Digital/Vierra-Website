import React from "react";

type PanelSectionHeaderProps = {
  title: string;
  actions?: React.ReactNode;
};

const PanelSectionHeader: React.FC<PanelSectionHeaderProps> = ({ title, actions }) => {
  return (
    <div className="w-full flex flex-wrap justify-between items-center gap-x-4 gap-y-2 mb-2">
      <div>
        <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">{title}</h1>
      </div>
      {actions ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
};

export default PanelSectionHeader;
