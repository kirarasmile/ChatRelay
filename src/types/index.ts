export type Role = 'user' | 'assistant' | 'system';

export interface CodeBlock {
  language: string;
  code: string;
}

export interface Message {
  role: Role;
  content: string;
  timestamp?: number;
  codeBlocks?: CodeBlock[];
  mathFormulas?: string[];
}

export interface Conversation {
  platform: 'chatgpt' | 'gemini' | 'deepseek' | 'unknown';
  title: string;
  messages: Message[];
  exportedAt: number;
}
