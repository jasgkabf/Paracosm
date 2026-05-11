'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/common/card';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';
import { Badge } from '@/components/common/badge';
import { Spinner } from '@/components/common/spinner';
import { IconKey, IconServer, IconZap, IconCheck, IconX, IconRefresh } from '@/components/icons';
import { apiClient } from '@/lib/api-client';
import { useStore } from '@/lib/store';
import { useLocale } from '@/hooks/use-locale';

interface LlmConfigResponse {
  success: boolean;
  data?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
}

interface TestResponse {
  success: boolean;
  data?: {
    latencyMs?: number;
  };
  error?: string;
}

export function ProviderConfig() {
  const { t } = useLocale();
  const { setLlmConfig, llmConfig } = useStore();

  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<LlmConfigResponse>('/llm-config');
      if (res.success && res.data) {
        setApiKey(res.data.apiKey ?? '');
        setBaseUrl(res.data.baseUrl ?? '');
        setModel(res.data.model ?? '');
        setIsConfigured(!!(res.data.apiKey && res.data.baseUrl && res.data.model));
        setLlmConfig({
          apiKey: res.data.apiKey ?? '',
          baseUrl: res.data.baseUrl ?? '',
          model: res.data.model ?? '',
        });
      } else {
        setIsConfigured(false);
        setLlmConfig(null);
      }
    } catch {
      setIsConfigured(false);
      setLlmConfig(null);
    } finally {
      setLoading(false);
    }
  }, [setLlmConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const res = await apiClient.put<LlmConfigResponse>('/llm-config', {
        apiKey,
        baseUrl,
        model,
      });
      if (res.success) {
        setIsConfigured(true);
        setLlmConfig({ apiKey, baseUrl, model });
      }
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.post<TestResponse>('/llm-config/test', {
        apiKey,
        baseUrl,
        model,
      });
      setTestResult({
        success: res.success,
        latencyMs: res.data?.latencyMs,
        error: res.error,
      });
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete<LlmConfigResponse>('/llm-config');
      setApiKey('');
      setBaseUrl('');
      setModel('');
      setIsConfigured(false);
      setTestResult(null);
      setLlmConfig(null);
    } catch {
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-paracosm-text">{t('settings.title')}</div>
        <Badge variant={isConfigured ? 'success' : 'warning'}>
          {isConfigured ? t('settings.connected') : t('settings.notConfigured')}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <IconKey size={14} />
          <span className="text-xs text-paracosm-muted font-mono uppercase">{t('settings.apiKey')}</span>
        </div>
        <Input
          type="password"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />

        <div className="flex items-center gap-2 mb-2">
          <IconServer size={14} />
          <span className="text-xs text-paracosm-muted font-mono uppercase">{t('settings.baseUrl')}</span>
        </div>
        <Input
          type="text"
          placeholder="https://token-plan-sgp.xiaomimimo.com/v1"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />

        <div className="flex items-center gap-2 mb-2">
          <IconZap size={14} />
          <span className="text-xs text-paracosm-muted font-mono uppercase">{t('settings.model')}</span>
        </div>
        <Input
          type="text"
          placeholder="MiMo-V2.5-Pro"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />

        {testResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-md border ${
              testResult.success
                ? 'bg-paracosm-green/5 border-paracosm-green/20'
                : 'bg-red-900/10 border-red-800/30'
            }`}
          >
            {testResult.success ? (
              <IconCheck size={14} color="#00ff88" />
            ) : (
              <IconX size={14} color="#f87171" />
            )}
            <span className={`text-sm ${testResult.success ? 'text-paracosm-green' : 'text-red-400'}`}>
              {testResult.success
                ? `${t('settings.testSuccess')} (${testResult.latencyMs}ms)`
                : `${t('settings.testFail')}: ${testResult.error}`}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || !apiKey || !baseUrl || !model}
          >
            {saving ? <Spinner size="sm" /> : t('settings.save')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTest}
            disabled={testing || !apiKey || !baseUrl || !model}
          >
            {testing ? <Spinner size="sm" /> : <IconRefresh size={14} />}
            {testing ? t('settings.testing') : t('settings.test')}
          </Button>
          {isConfigured && (
            <Button variant="danger" size="sm" onClick={handleDelete}>
              {t('settings.delete')}
            </Button>
          )}
        </div>

        {isConfigured && llmConfig && (
          <div className="mt-4 p-3 rounded-md bg-paracosm-dark/50 border border-paracosm-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-paracosm-muted font-mono uppercase">{t('settings.status')}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-paracosm-muted">
              <span className="font-mono">{llmConfig.model}</span>
              <span className="text-paracosm-muted/40">|</span>
              <span className="font-mono">
                {llmConfig.apiKey ? `${llmConfig.apiKey.slice(0, 4)}...${llmConfig.apiKey.slice(-4)}` : '****'}
              </span>
              <span className="text-paracosm-muted/40">|</span>
              <span className="font-mono truncate max-w-[200px]">{llmConfig.baseUrl}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
