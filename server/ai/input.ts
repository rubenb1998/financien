import { aiEfforts, aiProviderNames, isAiModelId } from '../../src/domain/ai.ts';
import type { AiProvider, AiSelection, AiSettings } from '../../src/domain/ai.ts';
import { InputError } from '../validation.ts';
import type { Schema } from './cli.ts';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Verwacht een JSON-object.');
  return value as Record<string, unknown>;
}

export function aiProvider(value: unknown): AiProvider {
  if (typeof value === 'string' && Object.hasOwn(aiProviderNames, value)) return value as AiProvider;
  throw new InputError('Kies Codex of Claude Code.');
}

function modelName(value: unknown) {
  if (!isAiModelId(value)) {
    throw new InputError('Vul een geldige modelnaam in of kies het standaardmodel.');
  }
  return value;
}

function reasoningEffort(value: unknown, provider: AiProvider | null) {
  if (value === undefined || value === '') return;
  const effort = aiEfforts.find(item => item === value);
  if (!effort || !provider || (provider === 'claude' && !['low', 'medium', 'high', 'xhigh', 'max'].includes(effort))) {
    throw new InputError('Kies een geldig redeneerniveau voor deze provider.');
  }
  return effort;
}

export function readAiSelection(value: unknown): AiSelection {
  const input = object(value);
  const provider = aiProvider(input.provider);
  return { provider, model: modelName(input.model ?? ''), effort: reasoningEffort(input.effort, provider) };
}

export function readAiSettings(value: unknown): AiSettings {
  const input = object(value);
  if (typeof input.autoClassify !== 'boolean') throw new InputError('Kies of afschriften automatisch worden geclassificeerd.');
  const provider = input.provider === null ? null : aiProvider(input.provider);
  return {
    provider, model: modelName(input.model ?? ''), effort: reasoningEffort(input.effort, provider),
    autoClassify: input.autoClassify,
  };
}

export const string = { type: 'string' };
export const integer = { type: 'integer' };
export const boolean = { type: 'boolean' };
export const nullable = (value: Schema) => ({ anyOf: [value, { type: 'null' }] });
export const array = (items: Schema) => ({ type: 'array', items });
export const fields = (properties: Record<string, Schema>) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});

export function cleanText(text: string, max: number) {
  return text.replace(/\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){11,30}\b/gi, '[rekening]')
    .replace(/\b(?:\d[ -]?){10,19}\b/g, '[nummer]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[e-mailadres]')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}
