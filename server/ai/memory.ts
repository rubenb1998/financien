import { rememberedPreference } from '../../src/domain/ai.ts';
import type { AiChatResult } from '../../src/domain/ai.ts';
import type { Store } from '../store.ts';
import { InputError } from '../validation.ts';
import { cleanText } from './input.ts';

const commonWords = new Set(['altijd', 'blijft', 'graag', 'alles', 'hoeveel', 'welke', 'waarom', 'worden',
  'kunnen', 'gebruiken', 'onthoud', 'voortaan', 'vorige', 'maand', 'jaar', 'vandaag', 'gisteren']);

function words(text: string) {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter(word => !commonWords.has(word)))];
}

function score(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.filter(word => normalized.includes(word)).length;
}

export function memoryForQuestion(store: Store, question: string, topic?: string) {
  const keywords = words(question + ' ' + (topic ?? '')).slice(0, 12);
  return store.memory().sort((a, b) => score(b.text, keywords) - score(a.text, keywords))
    .slice(0, 8).map(note => note.text);
}

export function earlierQuestions(store: Store, question: string) {
  const keywords = words(question).slice(0, 12);
  return store.earlierChat(keywords)
    .filter(text => !rememberedPreference(text)
      && (score(text, keywords) >= 2 || keywords.some(word => word.length >= 8 && text.toLowerCase().includes(word))))
    .slice(0, 3).map(text => cleanText(text, 320));
}

export function conversationMessage(value: { role: string; text: string }) {
  return value.role === 'user' ? !rememberedPreference(value.text) : value.text !== 'Opgeslagen in je lokale geheugen.';
}

export function rememberChat(store: Store, question: string): AiChatResult | undefined {
  const requested = rememberedPreference(question);
  if (!requested) return;
  const note = cleanText(requested, 501);
  if (!note || note.length > 500) throw new InputError('Formuleer je voorkeur in maximaal 500 tekens.');
  store.remember(note, { role: 'user', text: question }, { role: 'assistant', text: 'Opgeslagen in je lokale geheugen.' });
  return { messages: store.chatHistory(), memory: store.memory(), changed: false, canUndo: store.aiUndo().length > 0 };
}
