import type { RequestMapping, ResponseMapping, ProviderTemplate } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('TemplateEngine');

export interface TemplateDefinition {
  id: string;
  name: string;
  requestMapping: RequestMapping;
  responseMapping: ResponseMapping;
  streamMapping: Partial<ResponseMapping>;
  capabilities: ProviderTemplate['capabilities'];
  baseUrl?: string;
  headers?: Record<string, string>;
}

export class TemplateEngine {
  private templates: Map<string, TemplateDefinition> = new Map();

  registerTemplate(template: TemplateDefinition): void {
    this.templates.set(template.id, template);
    logger.info('Template registered', { id: template.id, name: template.name });
  }

  unregisterTemplate(templateId: string): void {
    this.templates.delete(templateId);
    logger.info('Template unregistered', { id: templateId });
  }

  getTemplate(templateId: string): TemplateDefinition | undefined {
    return this.templates.get(templateId);
  }

  getAllTemplates(): TemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  applyTemplate(
    templateId: string,
    overrides?: Partial<TemplateDefinition>,
  ): TemplateDefinition | null {
    const template = this.templates.get(templateId);
    if (!template) {
      logger.warn('Template not found', { id: templateId });
      return null;
    }

    if (!overrides) return { ...template };

    return {
      ...template,
      ...overrides,
      requestMapping: {
        ...template.requestMapping,
        ...overrides.requestMapping,
      },
      responseMapping: {
        ...template.responseMapping,
        ...overrides.responseMapping,
      },
      capabilities: {
        ...template.capabilities,
        ...overrides.capabilities,
      },
    };
  }

  createFromTemplate(
    templateId: string,
    name: string,
    baseUrl: string,
    apiKey?: string,
    overrides?: Partial<TemplateDefinition>,
  ): TemplateDefinition | null {
    const template = this.applyTemplate(templateId, overrides);
    if (!template) return null;

    return {
      ...template,
      id: `custom-${Date.now()}`,
      name,
      baseUrl,
      headers: {
        ...template.headers,
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    };
  }

  validateTemplate(template: TemplateDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.id) errors.push('Template id is required');
    if (!template.name) errors.push('Template name is required');

    if (!template.requestMapping.promptField) {
      errors.push('requestMapping.promptField is required');
    }
    if (!template.requestMapping.modelField) {
      errors.push('requestMapping.modelField is required');
    }

    if (!template.responseMapping.contentField) {
      errors.push('responseMapping.contentField is required');
    }

    if (template.capabilities) {
      if (typeof template.capabilities.streaming !== 'boolean') {
        errors.push('capabilities.streaming must be a boolean');
      }
      if (typeof template.capabilities.maxContextTokens !== 'number' || template.capabilities.maxContextTokens <= 0) {
        errors.push('capabilities.maxContextTokens must be a positive number');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  hasTemplate(templateId: string): boolean {
    return this.templates.has(templateId);
  }

  getTemplateIds(): string[] {
    return Array.from(this.templates.keys());
  }
}
