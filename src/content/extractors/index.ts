import { BaseExtractor } from './base';
import { ChatGPTExtractor } from './chatgpt';
import { GeminiExtractor } from './gemini';
import { DeepSeekExtractor } from './deepseek';

export function getExtractor(): BaseExtractor | null {
  const url = window.location.href;

  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
    return new ChatGPTExtractor();
  }
  if (url.includes('aistudio.google.com')) {
    return new GeminiExtractor();
  }
  if (url.includes('chat.deepseek.com')) {
    return new DeepSeekExtractor();
  }

  return null;
}
