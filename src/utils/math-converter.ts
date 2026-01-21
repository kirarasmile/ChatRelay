/**
 * 修复数学公式格式，使其在Notion/Obsidian等编辑器中显示更友好
 */
export function fixMathFormulas(text: string): string {
  // 1. 修复常见的 LaTeX 渲染转义问题
  // 比如 ChatGPT 有时会输出 \( ... \) 或 \[ ... \]
  let fixed = text;
  
  // 转换 \( ... \) 为 $...$
  fixed = fixed.replace(/\\\((.*?)\\\)/g, '$$1$');
  
  // 转换 \[ ... \] 为 $$ ... $$
  fixed = fixed.replace(/\\\[(.*?)\\\]/gs, '\n$$\n$1\n$$\n');

  // 2. 优化 Notion 兼容性
  // Notion 往往喜欢 $$ 内容 $$ 这种块级公式
  // 如果发现 $$...$$ 中间没有换行，可以根据上下文决定是否添加
  
  return fixed;
}
