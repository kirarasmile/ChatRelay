/**
 * 修复 Markdown 渲染错误和 Notion 兼容性问题
 */
export function fixMarkdown(text: string): string {
  let fixed = text;

  // 1. 修复代码块前后缺少换行的问题
  fixed = fixed.replace(/([^\n])```/g, '$1\n\n```');
  fixed = fixed.replace(/```([^\n])/g, '```\n$1');
  
  // 2. 确保代码块结束后有换行
  fixed = fixed.replace(/```\n*([^`])/g, '```\n\n$1');

  // 3. 修复列表符号后的空格问题
  fixed = fixed.replace(/^([-+*])([^\s])/gm, '$1 $2');

  // 4. 修复标题符号后的空格问题
  fixed = fixed.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');

  // 5. 移除 HTML 残留标签
  fixed = fixed.replace(/<\/?(?:div|span|p|br|hr)[^>]*>/gi, '\n');
  fixed = fixed.replace(/<\/?(?:strong|b)>/gi, '**');
  fixed = fixed.replace(/<\/?(?:em|i)>/gi, '*');
  fixed = fixed.replace(/<\/?code>/gi, '`');
  
  // 6. 清理其他 HTML 标签
  fixed = fixed.replace(/<[^>]+>/g, '');

  // 7. 修复过多的换行
  fixed = fixed.replace(/\n{4,}/g, '\n\n\n');

  // 8. 修复 Notion 不支持的语法
  // Notion 不支持 ~~删除线~~ 使用 HTML
  // 但我们保留它，因为 Notion 现在支持了
  
  // 9. 清理 HTML 实体
  fixed = fixed.replace(/&nbsp;/g, ' ');
  fixed = fixed.replace(/&lt;/g, '<');
  fixed = fixed.replace(/&gt;/g, '>');
  fixed = fixed.replace(/&amp;/g, '&');
  fixed = fixed.replace(/&quot;/g, '"');

  // 10. 确保列表前有空行
  fixed = fixed.replace(/([^\n])\n([-*+] )/g, '$1\n\n$2');
  fixed = fixed.replace(/([^\n])\n(\d+\. )/g, '$1\n\n$2');

  return fixed.trim();
}

/**
 * 专门为 Notion 优化的格式化
 */
export function fixMarkdownForNotion(text: string): string {
  let fixed = fixMarkdown(text);
  
  // Notion 特定修复
  
  // 1. Notion 代码块需要语言标识，如果没有就加一个
  fixed = fixed.replace(/```\n([^`])/g, '```text\n$1');
  
  // 2. Notion 不喜欢空的代码块
  fixed = fixed.replace(/```\w*\n\s*```/g, '');
  
  // 3. 表格格式化（Notion 支持表格但格式要求严格）
  // 确保表格对齐符号正确
  fixed = fixed.replace(/\|[-:]+\|/g, (match) => {
    return match.replace(/[-]+/g, '---');
  });

  return fixed;
}
