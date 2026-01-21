import { BaseExtractor } from './base';
import { Conversation, Message } from '../../types';

export class GeminiExtractor extends BaseExtractor {
  platform: Conversation['platform'] = 'gemini';

  extractTitle(): string {
    return document.querySelector('title')?.textContent || 'Gemini Conversation';
  }

  extractMessages(): Message[] {
    // Google AI Studio specific selectors
    const messages: Message[] = [];
    
    // In AI Studio, they might be siblings or in a list
    const allMessages = document.querySelectorAll('ms-user-query, ms-model-response');
    
    allMessages.forEach(el => {
      const role = el.tagName.toLowerCase() === 'ms-user-query' ? 'user' : 'assistant';
      const contentEl = el.querySelector('.message-content, .model-response-text');
      
      if (contentEl) {
        messages.push({
          role,
          content: contentEl.innerHTML
        });
      }
    });

    return messages;
  }
}
