import React from "react";

type PanelSectionHeaderProps = {
  title: string;
  actions?: React.ReactNode;
};

const PanelSectionHeader: React.FC<PanelSectionHeaderProps> = ({ title, actions }) => {
  return (
    <div className="w-full flex justify-between items-center mb-2">
      <div>
        <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">{title}</h1>
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
};

export default PanelSectionHeader;
