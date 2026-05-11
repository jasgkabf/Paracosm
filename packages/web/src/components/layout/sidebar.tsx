"use client";

import { NavItem } from "./nav-item";
import { Breadcrumb } from "./breadcrumb";
import {
  IconChat,
  IconWorld,
  IconActivity,
  IconBrain,
  IconTool,
  IconSettings,
  IconHeartbeat,
  IconSidebar,
  IconParacosm,
} from "@/components/icons";
import { usePathname } from "next/navigation";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navSections = [
  {
    label: "Core",
    items: [
      { id: "chat", label: "Chat", href: "/chat", icon: IconChat },
      { id: "heartbeat", label: "Heartbeat", href: "/heartbeat", icon: IconHeartbeat },
    ],
  },
  {
    label: "Modeling",
    items: [
      { id: "world", label: "World Model", href: "/world", icon: IconWorld },
      { id: "simulate", label: "Simulate", href: "/simulate", icon: IconActivity },
      { id: "strategies", label: "Strategies", href: "/strategies", icon: IconBrain },
    ],
  },
  {
    label: "Extensions",
    items: [
      { id: "tools", label: "Tools", href: "/tools", icon: IconTool },
      { id: "settings", label: "Settings", href: "/settings", icon: IconSettings },
    ],
  },
];

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex flex-col h-full bg-paracosm-gray-dark border-r border-paracosm-gray-light/20 transition-all duration-300 ${
        collapsed ? "w-16" : "w-[260px]"
      }`}
    >
      <div className="flex items-center h-14 px-4 border-b border-paracosm-gray-light/20">
        <div className="flex items-center gap-3 min-w-0">
          <IconParacosm size={28} className="text-paracosm-green flex-shrink-0" />
          {!collapsed && (
            <span className="text-lg font-semibold text-white truncate">
              Paracosm
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <div className="px-3 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {section.label}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavItem
                  key={item.id}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  collapsed={collapsed}
                  active={pathname.startsWith(item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-paracosm-gray-light/20 p-2">
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-full h-10 rounded-lg text-gray-400 hover:text-white hover:bg-paracosm-gray-light/30 transition-colors"
        >
          <IconSidebar size={20} className={collapsed ? "rotate-180" : ""} />
        </button>
      </div>
    </aside>
  );
}
