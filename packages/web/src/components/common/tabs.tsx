"use client";

interface Tab {
  id: string;
  label: string;
  href?: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex items-center gap-1 bg-paracosm-gray/50 rounded-lg p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "bg-paracosm-green/20 text-paracosm-green"
              : "text-gray-400 hover:text-white hover:bg-paracosm-gray-light/20"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
