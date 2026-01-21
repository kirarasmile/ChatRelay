import { BaseExtractor } from './base';
import { Conversation, Message, Role } from '../../types';

export class ChatGPTExtractor extends BaseExtractor {
  platform: Conversation['platform'] = 'chatgpt';

  extractTitle(): string {
    const titleElement = document.querySelector('title');
    return titleElement?.textContent?.replace(' - ChatGPT', '') || 'ChatGPT Conversation';
  }

  extractMessages(): Message[] {
    // 更加稳健的选择器，捕获包含角色属性的消息容器
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    const messages: Message[] = [];

    messageElements.forEach((el) => {
      const role = el.getAttribute('data-message-author-role') as Role;
      
      // ChatGPT 的用户消息有时直接在 div 中，有时在 .markdown 中
      // AI 消息通常在 .markdown 或 .prose 中
      const contentEl = el.querySelector('.markdown, .prose, [data-message-author-role="user"] > div');
      
      if (contentEl) {
        messages.push({
          role,
          content: contentEl.innerHTML,
        });
      } else if (role === 'user') {
        // 备选方案：直接获取用户消息容器内的所有文本/HTML
        const userContent = el.querySelector('div.flex.flex-col.max-w-full');
        if (userContent) {
          messages.push({
            role,
            content: userContent.innerHTML,
          });
        }
      }
    });

    return messages;
  }
}
