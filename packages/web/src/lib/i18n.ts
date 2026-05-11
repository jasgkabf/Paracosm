export type Locale = 'en' | 'zh';

export type TranslationKeys = {
  'nav.chat': string;
  'nav.world': string;
  'nav.simulate': string;
  'nav.strategies': string;
  'nav.tools': string;
  'nav.heartbeat': string;
  'nav.settings': string;
  'chat.placeholder': string;
  'chat.empty': string;
  'chat.thinking': string;
  'chat.usingTool': string;
  'chat.send': string;
  'chat.model': string;
  'chat.tokens': string;
  'chat.toolCall': string;
  'chat.toolResult': string;
  'settings.title': string;
  'settings.llm': string;
  'settings.apiKey': string;
  'settings.baseUrl': string;
  'settings.model': string;
  'settings.save': string;
  'settings.test': string;
  'settings.delete': string;
  'settings.connected': string;
  'settings.notConfigured': string;
  'settings.testSuccess': string;
  'settings.testFail': string;
  'settings.saved': string;
  'settings.deleted': string;
  'settings.testing': string;
  'settings.saving': string;
  'settings.status': string;
  'common.online': string;
  'common.offline': string;
  'common.language': string;
  'common.error': string;
};

const en: TranslationKeys = {
  'nav.chat': 'Chat',
  'nav.world': 'World Model',
  'nav.simulate': 'Simulate',
  'nav.strategies': 'Strategies',
  'nav.tools': 'Tools',
  'nav.heartbeat': 'Heartbeat',
  'nav.settings': 'Settings',
  'chat.placeholder': 'Type a message...',
  'chat.empty': 'Start a conversation with the Paracosm agent',
  'chat.thinking': 'Thinking...',
  'chat.usingTool': 'Using tool',
  'chat.send': 'Send',
  'chat.model': 'Model',
  'chat.tokens': 'Tokens',
  'chat.toolCall': 'Tool Call',
  'chat.toolResult': 'Result',
  'settings.title': 'LLM Configuration',
  'settings.llm': 'LLM Status',
  'settings.apiKey': 'API Key',
  'settings.baseUrl': 'Base URL',
  'settings.model': 'Model',
  'settings.save': 'Save',
  'settings.test': 'Test Connection',
  'settings.delete': 'Delete',
  'settings.connected': 'Connected',
  'settings.notConfigured': 'Not Configured',
  'settings.testSuccess': 'Connection successful',
  'settings.testFail': 'Connection failed',
  'settings.saved': 'Configuration saved',
  'settings.deleted': 'Configuration deleted',
  'settings.testing': 'Testing...',
  'settings.saving': 'Saving...',
  'settings.status': 'Status',
  'common.online': 'System Online',
  'common.offline': 'Offline',
  'common.language': 'Language',
  'common.error': 'Error',
};

const zh: TranslationKeys = {
  'nav.chat': '对话',
  'nav.world': '世界模型',
  'nav.simulate': '模拟',
  'nav.strategies': '策略',
  'nav.tools': '工具',
  'nav.heartbeat': '心跳',
  'nav.settings': '设置',
  'chat.placeholder': '输入消息...',
  'chat.empty': '开始与 Paracosm 代理对话',
  'chat.thinking': '思考中...',
  'chat.usingTool': '正在使用工具',
  'chat.send': '发送',
  'chat.model': '模型',
  'chat.tokens': '令牌',
  'chat.toolCall': '工具调用',
  'chat.toolResult': '结果',
  'settings.title': 'LLM 配置',
  'settings.llm': 'LLM 状态',
  'settings.apiKey': 'API 密钥',
  'settings.baseUrl': '基础 URL',
  'settings.model': '模型',
  'settings.save': '保存',
  'settings.test': '测试连接',
  'settings.delete': '删除',
  'settings.connected': '已连接',
  'settings.notConfigured': '未配置',
  'settings.testSuccess': '连接成功',
  'settings.testFail': '连接失败',
  'settings.saved': '配置已保存',
  'settings.deleted': '配置已删除',
  'settings.testing': '测试中...',
  'settings.saving': '保存中...',
  'settings.status': '状态',
  'common.online': '系统在线',
  'common.offline': '离线',
  'common.language': '语言',
  'common.error': '错误',
};

export const translations: Record<Locale, TranslationKeys> = { en, zh };

export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('paracosm-locale') as Locale | null;
  if (stored && (stored === 'en' || stored === 'zh')) return stored;
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) return 'zh';
  return 'en';
}
