'use client';

import { Card } from '@/components/common/card';
import { Badge } from '@/components/common/badge';
import { IconKey, IconZap } from '@/components/icons';
import { useStore } from '@/lib/store';
import { useLocale } from '@/hooks/use-locale';

export function ApiKeyManager() {
  const { t } = useLocale();
  const { llmConfig } = useStore();

  const isConnected = !!(llmConfig?.apiKey && llmConfig?.baseUrl && llmConfig?.model);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <IconKey size={18} />
        <span className="text-sm font-medium text-paracosm-text">{t('settings.llm')}</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-md bg-paracosm-dark/50 border border-paracosm-border">
          <div className="flex items-center gap-3">
            <Badge variant={isConnected ? 'success' : 'danger'}>
              {isConnected ? t('settings.connected') : t('settings.notConfigured')}
            </Badge>
          </div>
        </div>

        {isConnected && (
          <div className="space-y-2 p-3 rounded-md bg-paracosm-dark/50 border border-paracosm-border">
            <div className="flex items-center gap-2">
              <IconZap size={14} />
              <span className="text-xs text-paracosm-muted font-mono uppercase">{t('chat.model')}</span>
              <span className="text-sm text-paracosm-text font-mono">{llmConfig.model}</span>
            </div>
            <div className="flex items-center gap-2">
              <IconKey size={14} />
              <span className="text-xs text-paracosm-muted font-mono uppercase">{t('settings.apiKey')}</span>
              <span className="text-sm text-paracosm-muted font-mono">
                {llmConfig.apiKey
                  ? `${llmConfig.apiKey.slice(0, 4)}...${llmConfig.apiKey.slice(-4)}`
                  : '****'}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
