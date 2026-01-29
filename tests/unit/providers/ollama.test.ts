import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaProvider } from '../../../src/helpers/providers/ollama';
import axios from 'axios';
import { Readable } from 'stream';

vi.mock('axios');

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    vi.resetAllMocks();
    provider = new OllamaProvider();
  });

  it('should generate completion and stream data in SSE format', async () => {
    // Mock /api/tags response
    vi.mocked(axios.get).mockResolvedValue({
      data: { models: [{ name: 'test-model' }] },
    });

    // Mock stream response
    const mockStream = Readable.from([
      JSON.stringify({ message: { content: 'Hello' }, done: false }) + '\n',
      JSON.stringify({ message: { content: ' World' }, done: false }) + '\n',
      JSON.stringify({ done: true }) + '\n',
    ]);

    vi.mocked(axios.post).mockResolvedValue({
      data: mockStream,
    });

    const stream = await provider.generateCompletion('test prompt', {
      model: 'test-model',
      endpoint: 'http://localhost:11434',
    });

    expect(stream).toBeInstanceOf(Readable);

    const chunks: string[] = [];
    for await (const chunk of stream as Readable) {
      chunks.push(chunk.toString());
    }

    const fullData = chunks.join('');
    expect(fullData).toContain('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
    expect(fullData).toContain('data: {"choices":[{"delta":{"content":" World"}}]}\n\n');
    expect(fullData).toContain('data: [DONE]\n\n');
  });

  it('should warn if model is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    vi.mocked(axios.get).mockResolvedValue({
      data: { models: [] }, // No models
    });
    
    // Mock stream response to allow continuation
    vi.mocked(axios.post).mockResolvedValue({ data: Readable.from([]) });

    await provider.generateCompletion('test', { model: 'missing-model' });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Model 'missing-model' not found locally"));
  });
});
