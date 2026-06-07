'use client';
import React, { useCallback } from 'react';

interface TabProps {
  label: string;
  active: boolean;
  tabKey: string;
  onClick: (key: string) => void;
}

export const Tab = React.memo(function Tab({ label, active, tabKey, onClick }: TabProps) {
  const handleClick = useCallback(() => {
    onClick(tabKey);
  }, [tabKey, onClick]);

  return (
    <button
      onClick={handleClick}
      className={`px-5 py-2.5 rounded-xl border-none cursor-pointer text-[13px] font-semibold transition-all duration-200 ${
        active ? 'bg-primary/15 text-primary' : 'bg-transparent text-gray-400'
      }`}
    >
      {label}
    </button>
  );
});

export default Tab;
