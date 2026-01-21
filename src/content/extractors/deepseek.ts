import { BaseExtractor } from './base';
import { Conversation, Message } from '../../types';

export class DeepSeekExtractor extends BaseExtractor {
  platform: Conversation['platform'] = 'deepseek';

  extractTitle(): string {
    return document.querySelector('title')?.textContent || 'DeepSeek Conversation';
  }

  extractMessages(): Message[] {
    const messages: Message[] = [];
    
    // DeepSeek uses specific classes for chat messages
    const messageWrappers = document.querySelectorAll('.ds-markdown, .ds-message');
    
    // We need to determine the role based on container or sibling
    messageWrappers.forEach(el => {
      // Logic to determine role (simplified)
      const isUser = el.closest('.ds-message--user') !== null;
      const role = isUser ? 'user' : 'assistant';
      
      messages.push({
        role,
        content: el.innerHTML
      });
    });

    return messages;
  }
}
