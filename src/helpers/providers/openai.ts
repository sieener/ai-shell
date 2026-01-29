import { Configuration, OpenAIApi } from 'openai';
import { IncomingMessage } from 'http';
import { CompletionOptions, CompletionProvider } from './types';
import { KnownError } from '../error';
import { commandName } from '../constants';
import i18n from '../i18n';
import dedent from 'dedent';

export class OpenAIProvider implements CompletionProvider {
  validateConfig(options: CompletionOptions): void {
    if (!options.apiKey) {
      throw new KnownError(
        `Please set your OpenAI API key via '${commandName} config set OPENAI_KEY=<your token>'`
      );
    }
  }

  async generateCompletion(
    prompt: string,
    options: CompletionOptions
  ): Promise<IncomingMessage | ReadableStream> {
    this.validateConfig(options);

    const configuration = new Configuration({
      apiKey: options.apiKey,
      basePath: options.endpoint,
    });
    const openAi = new OpenAIApi(configuration);

    try {
      const completion = await openAi.createChatCompletion(
        {
          model: options.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          n: 1,
          stream: true,
        },
        { responseType: 'stream' }
      );

      return completion.data as unknown as IncomingMessage;
    } catch (err: any) {
        const error = err;

        if (error.code === 'ENOTFOUND') {
            throw new KnownError(
                `Error connecting to ${error.request?.hostname} (${error.request?.syscall}). Are you connected to the internet?`
            );
        }

        const response = error.response;
        let message = response?.data;
        
        const messageString = message && JSON.stringify(message, null, 2);
        
        if (response?.status === 429) {
          throw new KnownError(
            dedent`
            Request to OpenAI failed with status 429. This is due to incorrect billing setup or excessive quota usage. Please follow this guide to fix it: https://help.openai.com/en/articles/6891831-error-code-429-you-exceeded-your-current-quota-please-check-your-plan-and-billing-details

            You can activate billing here: https://platform.openai.com/account/billing/overview . Make sure to add a payment method if not under an active grant from OpenAI.

            Full message from OpenAI:
          ` + 
              '\n\n' + 
              messageString + 
              '\n'
          );
        } else if (response) {
             throw new KnownError(
                dedent`
                Request to OpenAI failed with status ${response?.status}:
              ` + 
                  '\n\n' + 
                  messageString + 
                  '\n'
              );
        }
        
        throw error;
    }
  }
}
