import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConfig, setConfigs } from '../../src/helpers/config';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ini from 'ini';

vi.mock('os', () => ({
  default: {
    homedir: vi.fn().mockReturnValue('/mock/home'),
    userInfo: vi.fn().mockReturnValue({ shell: 'bash' }),
    platform: vi.fn().mockReturnValue('linux'),
  },
  homedir: vi.fn().mockReturnValue('/mock/home'),
  userInfo: vi.fn().mockReturnValue({ shell: 'bash' }),
  platform: vi.fn().mockReturnValue('linux'),
}));
vi.mock('fs/promises');

describe('Config', () => {
  const mockHomeDir = '/mock/home';
  const mockConfigPath = path.join(mockHomeDir, '.ai-shell');

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(os.userInfo).mockReturnValue({ shell: 'bash' } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return default values when config file does not exist', async () => {
    vi.mocked(fs.lstat).mockRejectedValue(new Error('File not found'));

    const config = await getConfig();

    expect(config.PROVIDER).toBe('gemini');
    expect(config.MODEL).toBe('gpt-4o-mini');
    expect(config.LANGUAGE).toBe('en');
    expect(config.OLLAMA_HOST).toBe('http://localhost:11434');
  });

  it('should parse existing config file', async () => {
    vi.mocked(fs.lstat).mockResolvedValue({} as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      ini.stringify({
        PROVIDER: 'ollama',
        OLLAMA_HOST: 'http://ollama:11434',
        MODEL: 'llama3',
      })
    );

    const config = await getConfig();

    expect(config.PROVIDER).toBe('ollama');
    expect(config.OLLAMA_HOST).toBe('http://ollama:11434');
    expect(config.MODEL).toBe('llama3');
  });

  it('should validate PROVIDER value', async () => {
    vi.mocked(fs.lstat).mockResolvedValue({} as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      ini.stringify({
        PROVIDER: 'invalid-provider',
      })
    );

    await expect(getConfig()).rejects.toThrow(/Invalid provider/);
  });

  it('should not throw error for missing OPENAI_KEY', async () => {
    vi.mocked(fs.lstat).mockRejectedValue(new Error('File not found'));

    const config = await getConfig();
    expect(config.OPENAI_KEY).toBeUndefined();
    expect(config.PROVIDER).toBe('gemini');
  });
});
