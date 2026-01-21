export interface APIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

export async function callLLM(config: APIConfig, prompt: string): Promise<string> {
  const url = config.apiUrl.endsWith('/') ? `${config.apiUrl}chat/completions` : `${config.apiUrl}/chat/completions`;
  
  const systemPrompt = `你是一个高级上下文压缩专家。你的任务是将一段长对话压缩成一份"高保真状态快照"。
这份快照必须包含：
1. **核心上下文**：当前正在讨论的终极目标。
2. **已确定的共识**：已经解决的问题、选定的技术栈或确定的逻辑。
3. **关键变量/代码索引**：重要的命名、复杂的逻辑块简述或关键的代码片段。
4. **待办事项**：接下来的步骤。
5. **知识增量**：对话中产生的新知识或特殊偏好。

压缩要求：
- 使用极简但精确的语言。
- 能够让另一个 AI 通过阅读这份快照，立刻恢复到当前的对话状态，就像从未中断过一样。
- 排除所有礼貌用语、重复的解释和冗余的过程。`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `请对以下对话进行高保真压缩：\n\n${prompt}`
        }
      ],
      temperature: 0.1 // 降低随机性，保证忠实度
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'API call failed');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
