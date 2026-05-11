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
  IconGlobe,
} from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';
import type { TranslationKeys } from '@/lib/i18n';

interface NavItem {
  href: string;
  labelKey: keyof TranslationKeys;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/chat', labelKey: 'nav.chat', icon: IconChat },
  { href: '/world', labelKey: 'nav.world', icon: IconWorld },
  { href: '/simulate', labelKey: 'nav.simulate', icon: IconBrain },
  { href: '/strategies', labelKey: 'nav.strategies', icon: IconDna },
  { href: '/tools', labelKey: 'nav.tools', icon: IconTool },
  { href: '/heartbeat', labelKey: 'nav.heartbeat', icon: IconHeartbeat },
  { href: '/settings', labelKey: 'nav.settings', icon: IconSettings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useLocale();

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'zh' : 'en');
  };

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
              <span className="text-sm font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-paracosm-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-paracosm-green animate-pulse" />
            <span className="text-xs text-paracosm-muted font-mono">{t('common.online')}</span>
          </div>
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-paracosm-muted hover:text-paracosm-text hover:bg-paracosm-gray/50 transition-colors"
          >
            <IconGlobe size={12} />
            <span>{locale === 'en' ? 'EN' : '中文'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
