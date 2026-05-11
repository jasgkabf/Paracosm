"use client";

import Link from "next/link";
import type { ComponentType } from "react";

interface NavItemProps {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  collapsed: boolean;
  active: boolean;
}

export function NavItem({ label, href, icon: Icon, collapsed, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        active
          ? "bg-paracosm-green/10 text-paracosm-green"
          : "text-gray-400 hover:text-white hover:bg-paracosm-gray-light/30"
      }`}
      title={collapsed ? label : undefined}
    >
      <Icon
        size={20}
        className={`flex-shrink-0 ${
          active ? "text-paracosm-green" : "text-gray-400 group-hover:text-white"
        }`}
      />
      {!collapsed && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}
      {active && !collapsed && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-paracosm-green" />
      )}
    </Link>
  );
}
