'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  IconChat,
  IconWorld,
  IconBrain,
  IconDna,
  IconTool,
  IconHeartbeat,
  IconSettings,
  IconParacosm,
} from '@/components/icons';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/chat', label: 'Chat', icon: IconChat },
  { href: '/world', label: 'World Model', icon: IconWorld },
  { href: '/simulate', label: 'Simulate', icon: IconBrain },
  { href: '/strategies', label: 'Strategies', icon: IconDna },
  { href: '/tools', label: 'Tools', icon: IconTool },
  { href: '/heartbeat', label: 'Heartbeat', icon: IconHeartbeat },
  { href: '/settings', label: 'Settings', icon: IconSettings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-full flex flex-col bg-paracosm-surface border-r border-paracosm-border shrink-0">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-paracosm-border">
        <IconParacosm size={28} color="#00ff88" />
        <span className="text-lg font-bold text-paracosm-text tracking-tight">Paracosm</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const IconComp = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? 'sidebar-item-active' : 'sidebar-item'}
            >
              <IconComp size={18} color={isActive ? '#00ff88' : undefined} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-paracosm-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-paracosm-green animate-pulse" />
          <span className="text-xs text-paracosm-muted font-mono">System Online</span>
        </div>
      </div>
    </aside>
  );
}
