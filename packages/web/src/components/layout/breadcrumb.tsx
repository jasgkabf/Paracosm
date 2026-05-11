"use client";

import { usePathname } from "next/navigation";
import { IconChevronRight } from "@/components/icons";
import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  chat: "Chat",
  world: "World Model",
  entities: "Entities",
  timeline: "Timeline",
  constraints: "Constraints",
  simulate: "Simulate",
  strategies: "Strategies",
  active: "Active",
  evolved: "Evolved",
  custom: "Custom",
  tools: "Tools",
  builtin: "Built-in",
  plugins: "Plugins",
  mcp: "MCP",
  heartbeat: "Heartbeat",
  settings: "Settings",
  llm: "LLM",
  "custom-llm": "Custom LLM",
  routing: "Routing",
  budget: "Budget",
  personas: "Personas",
  profile: "Profile",
  setup: "Setup",
};

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = routeLabels[segment] || segment;
    items.push({ label, href: currentPath });
  }

  if (items.length > 0) {
    delete items[items.length - 1].href;
  }

  return items;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const items = buildBreadcrumbs(pathname);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 text-sm min-w-0">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1 min-w-0">
          {index > 0 && (
            <IconChevronRight size={14} className="text-gray-600 flex-shrink-0" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-gray-400 hover:text-white transition-colors truncate"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-white font-medium truncate">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
