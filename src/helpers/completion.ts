import {
  ChatCompletionRequestMessage,
  Model,
} from 'openai';
import dedent from 'dedent';
import { IncomingMessage } from 'http';
import { KnownError } from './error';
import { streamToIterable } from './stream-to-iterable';
import { detectShell } from './os-detect';
import type { AxiosError } from 'axios';
import { streamToString } from './stream-to-string';
import './replace-all-polyfill';
import i18n from './i18n';
import { stripRegexPatterns } from './strip-regex-patterns';
import readline from 'readline';
import { createProvider } from './providers/index';
import { getConfig } from './config';

const explainInSecondRequest = true;

// Openai outputs markdown format for code blocks. It oftne uses
// a github style like: "```bash"
const shellCodeExclusions = [/```[a-zA-Z]*\n/gi, /```[a-zA-Z]*/gi, '\n'];

export async function getScriptAndInfo({
  prompt,
  key,
  model,
  apiEndpoint,
}: {
  prompt: string;
  key: string;
  model?: string;
  apiEndpoint: string;
}) {
  const fullPrompt = getFullPrompt(prompt);
  const stream = await generateCompletion({
    prompt: fullPrompt,
    number: 1,
    key,
    model,
    apiEndpoint,
  });
  const iterableStream = streamToIterable(stream);
  return {
    readScript: readData(iterableStream, ...shellCodeExclusions),
    readInfo: readData(iterableStream, ...shellCodeExclusions),
  };
}

export async function generateCompletion({
  prompt,
  number = 1,
  key,
  model,
  apiEndpoint,
}: {
  prompt: string | ChatCompletionRequestMessage[];
  number?: number;
  model?: string;
  key: string;
  apiEndpoint: string;
}) {
  const config = await getConfig();
  const providerName = config.PROVIDER || 'openai'; // Fallback to openai if undefined (though config defaults to gemini now, existing might vary)
  
  // If the provider is NOT openai, we need to ensure we have the correct key.
  // The 'key' argument passed to this function is typically OPENAI_KEY from the CLI or config.
  // If we are using Gemini, we need GEMINI_KEY.
  // If we are using Ollama, we don't need a key.
  
  let apiKey = key;
  let endpoint = apiEndpoint;

  if (providerName === 'gemini') {
    apiKey = config.GEMINI_KEY || '';
  } else if (providerName === 'ollama') {
    apiKey = ''; // No key needed usually
    endpoint = config.OLLAMA_HOST || 'http://localhost:11434';
  }

  const provider = createProvider(providerName);

  // FR-011: Warn and fallback if configured MODEL is incompatible with selected PROVIDER
  if (model) {
    const isOpenAIModel = model.startsWith('gpt-') || model.startsWith('text-');
    const isGeminiModel = model.startsWith('gemini-');
    
    if (providerName === 'gemini' && isOpenAIModel) {
      console.warn(`\n${i18n.t('Warning')}: Model '${model}' seems incompatible with Gemini. Using default.\n`);
      model = undefined;
    } else if (providerName === 'openai' && isGeminiModel) {
       console.warn(`\n${i18n.t('Warning')}: Model '${model}' seems incompatible with OpenAI. Using default.\n`);
       model = undefined;
    }
  }

  // Convert ChatCompletionRequestMessage[] to string if necessary
  // Our new interface takes a string prompt.
  // OpenAI chat completion takes messages.
  // If prompt is array, we convert to text for non-chat providers or let the provider handle it?
  // The interface `generateCompletion(prompt: string, ...)` expects string.
  
  let promptText = '';
  if (Array.isArray(prompt)) {
    promptText = prompt.map(m => `${m.role}: ${m.content}`).join('\n');
  } else {
    promptText = prompt;
  }

  try {
    return await provider.generateCompletion(promptText, {
      apiKey,
      model,
      endpoint, // Use provider-specific endpoint (OLLAMA_HOST for Ollama, OPENAI_API_ENDPOINT for OpenAI)
    });
  } catch (err) {
    const error = err as any;

    if (error.code === 'ENOTFOUND') {
      throw new KnownError(
        `Error connecting to ${error.request?.hostname || 'provider'} (${error.request?.syscall || 'unknown'}). Are you connected to the internet?`
      );
    }
    
    // Pass through KnownErrors
    if (error instanceof KnownError) {
      throw error;
    }

    // Re-throw other errors for now, or adapt the specific OpenAI error handling below if generic enough
    // The original code had specific handling for OpenAI 429 and response parsing.
    // We should probably move that logic INTO the OpenAI provider implementation
    // and just re-throw here.
    
    throw error;
  }
}

export async function getExplanation({
  script,
  key,
  model,
  apiEndpoint,
}: {
  script: string;
  key: string;
  model?: string;
  apiEndpoint: string;
}) {
  const prompt = getExplanationPrompt(script);
  const stream = await generateCompletion({
    prompt,
    key,
    number: 1,
    model,
    apiEndpoint,
  });
  const iterableStream = streamToIterable(stream);
  return { readExplanation: readData(iterableStream) };
}

export async function getRevision({
  prompt,
  code,
  key,
  model,
  apiEndpoint,
}: {
  prompt: string;
  code: string;
  key: string;
  model?: string;
  apiEndpoint: string;
}) {
  const fullPrompt = getRevisionPrompt(prompt, code);
  const stream = await generateCompletion({
    prompt: fullPrompt,
    key,
    number: 1,
    model,
    apiEndpoint,
  });
  const iterableStream = streamToIterable(stream);
  return {
    readScript: readData(iterableStream, ...shellCodeExclusions),
  };
}

export const readData =
  (
    iterableStream: AsyncGenerator<string, void>,
    ...excluded: (RegExp | string | undefined)[]
  ) =>
  (writer: (data: string) => void): Promise<string> =>
    new Promise(async (resolve) => {
      let stopTextStream = false;
      let data = '';
      let content = '';
      let dataStart = false;
      let buffer = ''; // This buffer will temporarily hold incoming data only for detecting the start

      const [excludedPrefix] = excluded;
      const stopTextStreamKeys = ['q', 'escape']; //Group of keys that stop the text stream

      const rl = readline.createInterface({
        input: process.stdin,
      });

      process.stdin.setRawMode(true);

      process.stdin.on('keypress', (key, data) => {
        if (stopTextStreamKeys.includes(data.name)) {
          stopTextStream = true;
        }
      });
      for await (const chunk of iterableStream) {
        const payloads = chunk.toString().split('\n\n');
        for (const payload of payloads) {
          if (payload.includes('[DONE]') || stopTextStream) {
            // Flush any remaining buffered content before resolving
            if (buffer && !dataStart) {
              const bufferedContentWithoutExcluded = stripRegexPatterns(
                buffer,
                excluded
              );
              data += bufferedContentWithoutExcluded;
              writer(bufferedContentWithoutExcluded);
            }
            dataStart = false;
            resolve(data);
            return;
          }

          if (payload.startsWith('data:')) {
            content = parseContent(payload);
            // Use buffer only for start detection
            if (!dataStart) {
              // Append content to the buffer
              buffer += content;
              if (buffer.match(excludedPrefix ?? '')) {
                dataStart = true;
                // Clear the buffer once it has served its purpose
                buffer = '';
                if (excludedPrefix) break;
              } else if (excludedPrefix && buffer.length > 50) {
                // If we've accumulated content but no code block marker found,
                // assume the response doesn't have code blocks and start displaying
                dataStart = true;
                // Write the buffered content first
                const bufferedContentWithoutExcluded = stripRegexPatterns(
                  buffer,
                  excluded
                );
                data += bufferedContentWithoutExcluded;
                writer(bufferedContentWithoutExcluded);
                buffer = '';
              }
            }

            if (dataStart && content) {
              const contentWithoutExcluded = stripRegexPatterns(
                content,
                excluded
              );

              data += contentWithoutExcluded;
              writer(contentWithoutExcluded);
            }
          }
        }
      }

      function parseContent(payload: string): string {
        const data = payload.replaceAll(/(\n)?^data:\s*/g, '');
        try {
          const delta = JSON.parse(data.trim());
          return delta.choices?.[0]?.delta?.content ?? '';
        } catch (error) {
          return `Error with JSON.parse and ${payload}.\n${error}`;
        }
      }

      // Flush any remaining buffered content before final resolve
      if (buffer && !dataStart) {
        const bufferedContentWithoutExcluded = stripRegexPatterns(
          buffer,
          excluded
        );
        data += bufferedContentWithoutExcluded;
        writer(bufferedContentWithoutExcluded);
      }

      resolve(data);
    });

function getExplanationPrompt(script: string) {
  return dedent`
    ${explainScript} Please reply in ${i18n.getCurrentLanguagenName()}

    The script: ${script}
  `;
}

function getShellDetails() {
  const shellDetails = detectShell();

  return dedent`
      The target shell is ${shellDetails}
  `;
}
const shellDetails = getShellDetails();

const explainScript = dedent`
  Please provide a clear, concise description of the script, using minimal words. Outline the steps in a list format.
`;

function getOperationSystemDetails() {
  const os = require('@nexssp/os/legacy');
  return os.name();
}
const generationDetails = dedent`
    Only reply with the single line command surrounded by three backticks. It must be able to be directly run in the target shell. Do not include any other text.

    Make sure the command runs on ${getOperationSystemDetails()} operating system.
  `;

function getFullPrompt(prompt: string) {
  return dedent`
    Create a single line command that one can enter in a terminal and run, based on what is specified in the prompt.

    ${shellDetails}

    ${generationDetails}

    ${explainInSecondRequest ? '' : explainScript}

    The prompt is: ${prompt}
  `;
}

function getRevisionPrompt(prompt: string, code: string) {
  return dedent`
    Update the following script based on what is asked in the following prompt.

    The script: ${code}

    The prompt: ${prompt}

    ${generationDetails}
  `;
}

export async function getModels(
  key: string,
  apiEndpoint: string
): Promise<Model[]> {
  const openAi = getOpenAi(key, apiEndpoint);
  const response = await openAi.listModels();

  return response.data.data.filter((model) => model.object === 'model');
}
