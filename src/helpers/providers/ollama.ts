import { IncomingMessage } from 'http';
import { Readable } from 'stream';
import axios, { AxiosResponse } from 'axios';
import { CompletionOptions, CompletionProvider } from './types';
import { KnownError } from '../error';

export class OllamaProvider implements CompletionProvider {
  validateConfig(options: CompletionOptions): void {
    // Ollama doesn't strictly require API keys or complex config.
    // Host is usually localhost:11434 but can be configured.
    // We check connection implicitly or rely on defaults.
    // This method is primarily for explicit validation if we added more requirements.
  }

  async generateCompletion(
    prompt: string,
    options: CompletionOptions
  ): Promise<IncomingMessage | ReadableStream> {
    const host = options.endpoint || 'http://localhost:11434';
    const model = options.model || 'qwen2.5-coder:14b';
    
    // Check if model exists (FR-010) - actually, for streaming, we might just start request.
    // But the requirement says "Add warning logging for missing Ollama models (FR-010) before request" in tasks.
    // The spec says "System MUST log a warning if the configured Ollama model is not available locally before attempting the request."
    
    // To check if model exists, we can call /api/tags
    try {
      const tagsResponse = await axios.get(`${host}/api/tags`);
      const models = tagsResponse.data?.models || [];
      const modelExists = models.some((m: any) => m.name === model || m.name === `${model}:latest`);
      
      if (!modelExists) {
        console.warn(`
Warning: Model '${model}' not found locally. Please run 'ollama pull ${model}' to avoid errors.
`);
      }
    } catch (e) {
      // Ignore connection error here, let the main request fail if needed or warn
       console.warn(`
Warning: Could not connect to Ollama at ${host} to check models.
`);
    }

    const response = await axios.post(
      `${host}/api/chat`,
      {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      },
      {
        responseType: 'stream',
      }
    );

    // Convert ndjson stream to SSE format expected by completion.ts
    // Ollama returns JSON objects one per line (ndjson).
    // OpenAI SSE expects "data: { ... }"
    
    const stream = response.data;
    let started = false;
    const readable = new Readable({
      async read() {
        if (started) return;
        started = true;
        
        for await (const chunk of stream) {
          const lines = chunk.toString().split('\n').filter((l: string) => l.trim() !== '');
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              // Ollama response format: { model, created_at, message: { role, content }, done: false }
              if (json.done) {
                 this.push('data: [DONE]\n\n');
              } else {
                 const content = json.message?.content || '';
                 const payload = {
                    choices: [
                        {
                            delta: {
                                content: content
                            }
                        }
                    ]
                 };
                 this.push(`data: ${JSON.stringify(payload)}\n\n`);
              }
            } catch (e) {
              // ignore parse errors or partial chunks
            }
          }
        }
        this.push(null);
      }
    });

    return readable as unknown as IncomingMessage;
  }
}
