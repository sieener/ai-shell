import { CompletionProvider, CompletionOptions } from './types';
import { KnownError } from '../error';
import i18n from '../i18n';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';

export function createProvider(providerName: 'openai' | 'gemini' | 'ollama'): CompletionProvider {
  switch (providerName) {
    case 'openai':
      return new OpenAIProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new KnownError(`${i18n.t('Invalid provider')}: ${providerName}`);
  }
}
