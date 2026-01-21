import { callLLM } from './api';

// 任务状态类型
interface TaskState {
  status: 'idle' | 'extracting' | 'exporting' | 'calling_api' | 'completed' | 'failed' | 'cancelled';
  message: string;
  result?: string;
  filename?: string;
  summaryFilename?: string;
  error?: string;
  startedAt?: number;
  logs: string[];
}

// 初始化状态
let currentTask: TaskState = { status: 'idle', message: '', logs: [] };
let abortController: AbortController | null = null;

function addLog(log: string) {
  const timestamp = new Date().toLocaleTimeString();
  currentTask.logs.push(`[${timestamp}] ${log}`);
  // 只保留最近 50 条
  if (currentTask.logs.length > 50) {
    currentTask.logs = currentTask.logs.slice(-50);
  }
  updateTaskState({});
}

// 更新状态并通知 popup
function updateTaskState(state: Partial<TaskState>) {
  currentTask = { ...currentTask, ...state };
  chrome.storage.local.set({ taskState: currentTask });
  chrome.runtime.sendMessage({ action: 'task_state_update', state: currentTask }).catch(() => {});
}

// 重置状态
function resetTaskState() {
  currentTask = { status: 'idle', message: '', logs: [] };
  chrome.storage.local.set({ taskState: currentTask });
}

// 取消任务
function cancelTask() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  addLog('⚠️ 用户取消了任务');
  updateTaskState({ status: 'cancelled', message: '任务已取消' });
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'call_llm_summary') {
    callLLM(request.data.config, request.data.prompt)
      .then(content => sendResponse({ success: true, content }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'get_task_state') {
    sendResponse(currentTask);
    return false;
  }

  if (request.action === 'reset_task_state') {
    resetTaskState();
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'cancel_task') {
    cancelTask();
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'start_summary_task') {
    handleSummaryTask(request.data);
    sendResponse({ success: true, message: 'Task started' });
    return false;
  }
});

async function handleSummaryTask(data: {
  config: { apiUrl: string; apiKey: string; model: string };
  content: string;
  originalFilename: string;
  timeout?: number;
  truncated?: boolean;
}) {
  const startTime = Date.now();
  const timeout = data.timeout || 60000;
  
  abortController = new AbortController();
  currentTask.logs = [];
  
  try {
    addLog('🚀 开始任务...');
    addLog(`📄 原始文件: ${data.originalFilename}`);
    
    const charCount = data.content.length;
    const estimatedTokens = Math.ceil(charCount / 4);
    addLog(`📊 处理后内容: ${charCount} 字符 (约 ${estimatedTokens} tokens)`);
    
    if (data.truncated) {
      addLog('⚠️ 内容过长，已智能截断');
    }
    
    updateTaskState({
      status: 'calling_api',
      message: '正在调用 LLM API...',
      filename: data.originalFilename,
      startedAt: startTime,
    });

    addLog(`🔗 API: ${data.config.apiUrl}`);
    addLog(`🤖 模型: ${data.config.model}`);
    addLog(`⏱️ 超时设置: ${timeout / 1000} 秒`);
    addLog('📤 正在发送请求...');

    // 带超时和取消的 API 调用
    const timeoutId = setTimeout(() => {
      if (abortController) {
        abortController.abort();
        addLog('❌ 请求超时！');
      }
    }, timeout);

    try {
      const summary = await callLLMWithAbort(data.config, data.content, abortController.signal);
      clearTimeout(timeoutId);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      addLog(`✅ API 响应成功！耗时 ${duration}s`);
      addLog(`📝 摘要长度: ${summary.length} 字符`);

      const summaryFilename = data.originalFilename.replace('.md', '_摘要.md');

      updateTaskState({
        status: 'completed',
        message: '摘要生成完成！',
        result: summary,
        summaryFilename,
      });
      
      addLog('🎉 任务完成！');

    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (error.name === 'AbortError') {
      addLog(`⏱️ 请求被中断 (${duration}s)`);
      updateTaskState({
        status: 'cancelled',
        message: '任务被取消或超时',
        error: '请求被中断',
      });
    } else {
      addLog(`❌ 错误: ${error.message}`);
      updateTaskState({
        status: 'failed',
        message: 'API 调用失败',
        error: error.message,
      });
    }
  } finally {
    abortController = null;
  }
}

// 支持取消的 API 调用
async function callLLMWithAbort(
  config: { apiUrl: string; apiKey: string; model: string },
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  const url = config.apiUrl.endsWith('/') 
    ? `${config.apiUrl}chat/completions` 
    : `${config.apiUrl}/chat/completions`;

  const systemPrompt = `你是一个高级上下文压缩专家。请将对话压缩成"高保真状态快照"。
包含：1.核心目标 2.已确定共识 3.关键代码/变量 4.待办事项 5.新知识
要求：极度精简，让新AI立即无缝衔接。`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请压缩以下对话：\n\n${prompt}` }
      ],
      temperature: 0.1
    }),
    signal
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
