import TurndownService from 'turndown';
import { Conversation } from '../types';
import { fixMathFormulas } from './math-converter';
import { fixMarkdownForNotion } from './markdown-fix';

// 配置 turndown 以更好地处理各种 HTML
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});

// 添加自定义规则来处理 pre/code 块
turndownService.addRule('codeBlock', {
  filter: (node) => {
    return node.nodeName === 'PRE' && node.querySelector('code') !== null;
  },
  replacement: (_content, node) => {
    const codeNode = (node as HTMLElement).querySelector('code');
    if (!codeNode) return '';
    
    // 尝试获取语言
    let language = '';
    const classList = codeNode.className.split(' ');
    for (const cls of classList) {
      if (cls.startsWith('language-') || cls.startsWith('lang-')) {
        language = cls.replace(/^(language-|lang-)/, '');
        break;
      }
    }
    
    const code = codeNode.textContent || '';
    return `\n\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n\n`;
  }
});

// 处理行内代码
turndownService.addRule('inlineCode', {
  filter: (node) => {
    return node.nodeName === 'CODE' && 
           node.parentNode?.nodeName !== 'PRE';
  },
  replacement: (content) => {
    if (!content.trim()) return '';
    // 如果内容包含反引号，使用双反引号
    if (content.includes('`')) {
      return `\`\` ${content} \`\``;
    }
    return `\`${content}\``;
  }
});

export function formatToMarkdown(conversation: Conversation): string {
  let md = `# ${conversation.title}\n\n`;
  md += `> 来源: ${conversation.platform}\n`;
  md += `> 导出时间: ${new Date(conversation.exportedAt).toLocaleString()}\n\n---\n\n`;

  conversation.messages.forEach((msg) => {
    const roleName = msg.role === 'user' ? '👤 用户' : (msg.role === 'assistant' ? '🤖 AI' : '⚙️ 系统');
    md += `## ${roleName}\n\n`;
    
    // Convert HTML content to Markdown
    let contentMd = '';
    try {
      contentMd = turndownService.turndown(msg.content);
    } catch (e) {
      // 如果 turndown 失败，使用简单的 HTML 清理
      contentMd = msg.content.replace(/<[^>]*>/g, '');
    }
    
    // Apply fixes
    contentMd = fixMathFormulas(contentMd);
    contentMd = fixMarkdownForNotion(contentMd);
    
    md += `${contentMd}\n\n---\n\n`;
  });

  return md;
}

export function formatToJSON(conversation: Conversation): string {
  // 清理 HTML 后再导出 JSON
  const cleaned = {
    ...conversation,
    messages: conversation.messages.map(msg => ({
      ...msg,
      content: msg.content.replace(/<[^>]*>/g, '').trim()
    }))
  };
  return JSON.stringify(cleaned, null, 2);
}

export function formatToText(conversation: Conversation): string {
  let text = `标题: ${conversation.title}\n`;
  text += `平台: ${conversation.platform}\n`;
  text += `时间: ${new Date(conversation.exportedAt).toLocaleString()}\n`;
  text += `${'='.repeat(50)}\n\n`;

  conversation.messages.forEach((msg) => {
    const roleName = msg.role === 'user' ? '[用户]' : (msg.role === 'assistant' ? '[AI]' : '[系统]');
    // 清理 HTML 标签
    let plainText = msg.content.replace(/<[^>]*>/g, '');
    // 清理 HTML 实体
    plainText = plainText.replace(/&nbsp;/g, ' ');
    plainText = plainText.replace(/&lt;/g, '<');
    plainText = plainText.replace(/&gt;/g, '>');
    plainText = plainText.replace(/&amp;/g, '&');
    // 压缩多余空行
    plainText = plainText.replace(/\n{3,}/g, '\n\n');
    
    text += `${roleName}\n${plainText.trim()}\n\n${'─'.repeat(30)}\n\n`;
  });

  return text;
}

export function formatToHTML(conversation: Conversation): string {
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${conversation.title}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      max-width: 800px; 
      margin: 40px auto; 
      padding: 20px; 
      line-height: 1.6;
      background: #f9fafb;
    }
    h1 { color: #1f2937; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    .message { 
      margin-bottom: 24px; 
      padding: 20px; 
      border-radius: 12px; 
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .user { border-left: 4px solid #6366f1; }
    .assistant { border-left: 4px solid #22c55e; }
    .role { 
      font-weight: 600; 
      margin-bottom: 12px; 
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .user .role { color: #6366f1; }
    .assistant .role { color: #22c55e; }
    .content { word-break: break-word; }
    pre { 
      background: #1e1e1e; 
      color: #d4d4d4; 
      padding: 16px; 
      border-radius: 8px; 
      overflow-x: auto;
      font-size: 14px;
    }
    code { 
      background: #f3f4f6; 
      padding: 2px 6px; 
      border-radius: 4px; 
      font-size: 14px;
    }
    pre code { background: transparent; padding: 0; }
  </style>
</head>
<body>
  <h1>${conversation.title}</h1>
  <p class="meta">来源: ${conversation.platform} | 导出时间: ${new Date(conversation.exportedAt).toLocaleString()}</p>
`;

  conversation.messages.forEach((msg) => {
    const roleName = msg.role === 'user' ? '用户' : (msg.role === 'assistant' ? 'AI' : '系统');
    html += `  <div class="message ${msg.role}">
    <div class="role">${roleName}</div>
    <div class="content">${msg.content}</div>
  </div>\n`;
  });

  html += `</body>\n</html>`;
  return html;
}
