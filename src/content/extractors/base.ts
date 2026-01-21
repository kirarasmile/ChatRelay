import { Conversation, Message } from '../../types';

export abstract class BaseExtractor {
  abstract platform: Conversation['platform'];

  abstract extractTitle(): string;
  abstract extractMessages(): Message[];

  extract(): Conversation {
    return {
      platform: this.platform,
      title: this.extractTitle(),
      messages: this.extractMessages(),
      exportedAt: Date.now(),
    };
  }

  // Utility to clean content
  protected cleanText(text: string): string {
    return text.trim();
  }
}
