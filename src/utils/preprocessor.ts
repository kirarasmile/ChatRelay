/**
 * 内容预处理器 - 在发送给 API 之前压缩内容
 */

/**
 * 预处理内容，减少 token 数量
 */
export function preprocessContent(content: string): string {
  let processed = content;
  
  // 1. 移除 HTML 标签
  processed = processed.replace(/<[^>]*>/g, '');
  
  // 2. 压缩连续空白
  processed = processed.replace(/\n{3,}/g, '\n\n');
  processed = processed.replace(/[ \t]+/g, ' ');
  
  // 3. 压缩代码块 - 如果代码超过 30 行，只保留前 10 行和后 5 行
  processed = processed.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.split('\n');
    if (lines.length > 35) {
      const header = lines.slice(0, 11).join('\n'); // 包含 ``` 和前 10 行
      const footer = lines.slice(-6).join('\n'); // 后 5 行和 ```
      return `${header}\n// ... (省略 ${lines.length - 16} 行) ...\n${footer}`;
    }
    return match;
  });
  
  // 4. 移除重复的分隔线
  processed = processed.replace(/(-{3,}\n?){2,}/g, '---\n');
  
  // 5. 压缩长 URL
  processed = processed.replace(/https?:\/\/[^\s)>\]]{100,}/g, (url) => {
    return url.substring(0, 50) + '...[URL已截断]';
  });
  
  return processed.trim();
}

/**
 * 估算处理后的 token 数
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars + otherChars / 4);
}

/**
 * 智能截断 - 保留开头和结尾的对话
 */
export function smartTruncateContent(content: string, maxTokens: number): { content: string; truncated: boolean } {
  const currentTokens = estimateTokens(content);
  
  if (currentTokens <= maxTokens) {
    return { content, truncated: false };
  }
  
  // 按对话轮次分割
  const turns = content.split(/(?=\[(?:Human|AI)\]:)/);
  
  if (turns.length <= 4) {
    // 太少了，直接按字符截断
    const ratio = maxTokens / currentTokens;
    const targetLength = Math.floor(content.length * ratio * 0.9);
    return {
      content: content.substring(0, targetLength) + '\n\n[...内容已截断，保留前半部分...]',
      truncated: true
    };
  }
  
  // 保留第一轮（背景）和最后几轮（最近的对话）
  const keepFirst = 2; // 保留前 2 轮
  const result: string[] = [];
  
  // 添加开头
  result.push(...turns.slice(0, keepFirst));
  
  // 计算已用 tokens
  let usedTokens = estimateTokens(result.join(''));
  const remainingBudget = maxTokens - usedTokens - 100; // 留一些余量
  
  // 从后往前添加，直到预算用完
  const tailTurns: string[] = [];
  for (let i = turns.length - 1; i >= keepFirst; i--) {
    const turnTokens = estimateTokens(turns[i]);
    if (usedTokens + turnTokens > remainingBudget) break;
    usedTokens += turnTokens;
    tailTurns.unshift(turns[i]);
  }
  
  if (tailTurns.length < turns.length - keepFirst) {
    result.push('\n\n[...中间省略 ' + (turns.length - keepFirst - tailTurns.length) + ' 轮对话...]\n\n');
  }
  
  result.push(...tailTurns);
  
  return { content: result.join(''), truncated: true };
}
