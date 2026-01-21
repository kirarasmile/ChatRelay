/**
 * 极简 Token 估算器
 * 1 token 约等于 4 个中文字符或 0.75 个英文单词
 */
export function estimateTokenCount(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  // 粗略估算：中文 1:1, 英文/符号 4:1
  return Math.ceil(chineseChars + otherChars / 4);
}

/**
 * 智能截断对话以适应 Context Window
 * 策略：保留最近的对话，同时保留最开始的 System Prompt 或背景
 */
export function smartTruncate(messages: any[], maxTokens: number = 20000): any[] {
  let currentTokens = 0;
  const result = [];
  
  // 1. 总是尝试保留第一条消息（通常包含初始指令）
  if (messages.length > 0) {
    const firstMsgText = JSON.stringify(messages[0]);
    currentTokens += estimateTokenCount(firstMsgText);
    result.push(messages[0]);
  }

  // 2. 从后往前添加消息，直到达到 Token 限制
  const remainingMessages = messages.slice(1);
  const tailMessages = [];
  
  for (let i = remainingMessages.length - 1; i >= 0; i--) {
    const msgText = JSON.stringify(remainingMessages[i]);
    const tokens = estimateTokenCount(msgText);
    
    if (currentTokens + tokens > maxTokens) break;
    
    currentTokens += tokens;
    tailMessages.unshift(remainingMessages[i]);
  }

  // 组合结果：[第一条消息, ..., 截断点, ..., 最近的消息]
  if (result.length > 0 && tailMessages.length > 0) {
    return [result[0], ...tailMessages];
  }
  
  return tailMessages.length > 0 ? tailMessages : result;
}
