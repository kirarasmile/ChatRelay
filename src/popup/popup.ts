import './popup.css';
import { Conversation } from '../types';
import { formatToMarkdown, formatToJSON, formatToText, formatToHTML } from '../utils/formatter';
import { smartTruncate } from '../utils/token-utils';
import { preprocessContent, smartTruncateContent, estimateTokens } from '../utils/preprocessor';

const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
const summaryBtn = document.getElementById('summaryBtn') as HTMLButtonElement;
const optionsBtn = document.getElementById('optionsBtn') as HTMLButtonElement;

// 状态显示元素
let statusContainer: HTMLDivElement | null = null;

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

// 添加 CSS
const style = document.createElement('style');
style.textContent = `
  .spinner {
    width: 14px; height: 14px;
    border: 2px solid #0ea5e9; border-top-color: transparent;
    border-radius: 50%; animation: spin 1s linear infinite; display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .log-container {
    max-height: 150px; overflow-y: auto; font-family: monospace; font-size: 11px;
    background: #1e1e1e; color: #d4d4d4; padding: 8px; border-radius: 4px;
    margin-top: 8px; line-height: 1.4;
  }
  .log-line { margin: 2px 0; }
  .cancel-btn {
    margin-top: 8px; padding: 6px 16px; background: #ef4444; color: white;
    border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
  }
  .cancel-btn:hover { background: #dc2626; }
  .action-btns { display: flex; gap: 8px; margin-top: 8px; }
  .action-btns button {
    padding: 4px 12px; font-size: 12px; cursor: pointer; border-radius: 4px;
  }
`;
document.head.appendChild(style);

function initStatusContainer() {
  if (!statusContainer) {
    statusContainer = document.createElement('div');
    statusContainer.id = 'statusContainer';
    statusContainer.style.cssText = `
      display: none; padding: 12px; margin: 12px 0; border-radius: 8px;
      font-size: 13px; line-height: 1.5;
    `;
    const container = document.querySelector('.container');
    if (container) container.insertBefore(statusContainer, container.firstChild);
  }
}

function updateStatusUI(state: TaskState) {
  initStatusContainer();
  if (!statusContainer) return;

  if (state.status === 'idle') {
    statusContainer.style.display = 'none';
    summaryBtn.disabled = false;
    summaryBtn.textContent = '生成上下文摘要';
    return;
  }

  statusContainer.style.display = 'block';
  const isInProgress = ['extracting', 'exporting', 'calling_api'].includes(state.status);

  if (isInProgress) {
    statusContainer.style.backgroundColor = '#e0f2fe';
    statusContainer.style.borderLeft = '4px solid #0ea5e9';
    statusContainer.style.color = '#0369a1';
    
    const elapsed = state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0;
    
    let html = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span class="spinner"></span>
        <span>${state.message}</span>
        <span style="color: #64748b; font-size: 12px;">(${elapsed}s)</span>
      </div>
      <button class="cancel-btn" id="cancelBtn">⏹ 取消任务</button>
    `;
    
    // 添加日志区域
    if (state.logs && state.logs.length > 0) {
      html += `<div class="log-container" id="logContainer">${state.logs.map(l => `<div class="log-line">${escapeHtml(l)}</div>`).join('')}</div>`;
    }
    
    statusContainer.innerHTML = html;
    
    // 绑定取消按钮
    document.getElementById('cancelBtn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'cancel_task' });
    });
    
    // 滚动日志到底部
    const logEl = document.getElementById('logContainer');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
    
    summaryBtn.disabled = true;
    summaryBtn.textContent = state.message;
    
  } else if (state.status === 'completed') {
    statusContainer.style.backgroundColor = '#dcfce7';
    statusContainer.style.borderLeft = '4px solid #22c55e';
    statusContainer.style.color = '#166534';
    
    let html = `
      <div><strong>✓ 完成！</strong></div>
      <div style="margin-top: 4px; font-size: 12px;">
        ${state.filename ? `对话已导出: ${state.filename}` : ''}
        ${state.summaryFilename ? `<br>摘要已保存: ${state.summaryFilename}` : ''}
        <br>摘要已复制到剪贴板
      </div>
    `;
    
    if (state.logs && state.logs.length > 0) {
      html += `<div class="log-container" id="logContainer">${state.logs.map(l => `<div class="log-line">${escapeHtml(l)}</div>`).join('')}</div>`;
    }
    
    html += `<div class="action-btns">
      <button id="clearStatusBtn" style="border: 1px solid #22c55e; background: white;">清除状态</button>
    </div>`;
    
    statusContainer.innerHTML = html;
    
    document.getElementById('clearStatusBtn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'reset_task_state' });
      updateStatusUI({ status: 'idle', message: '', logs: [] });
    });
    
    summaryBtn.disabled = false;
    summaryBtn.textContent = '生成上下文摘要';
    
  } else if (state.status === 'failed' || state.status === 'cancelled') {
    statusContainer.style.backgroundColor = state.status === 'cancelled' ? '#fef3c7' : '#fee2e2';
    statusContainer.style.borderLeft = `4px solid ${state.status === 'cancelled' ? '#f59e0b' : '#ef4444'}`;
    statusContainer.style.color = state.status === 'cancelled' ? '#92400e' : '#991b1b';
    
    const icon = state.status === 'cancelled' ? '⚠' : '✗';
    const title = state.status === 'cancelled' ? '已取消' : '失败';
    
    let html = `
      <div><strong>${icon} ${title}</strong></div>
      <div style="margin-top: 4px; font-size: 12px;">${state.error || '未知错误'}</div>
    `;
    
    if (state.logs && state.logs.length > 0) {
      html += `<div class="log-container" id="logContainer">${state.logs.map(l => `<div class="log-line">${escapeHtml(l)}</div>`).join('')}</div>`;
    }
    
    html += `<div class="action-btns">
      <button id="clearStatusBtn" style="border: 1px solid #ccc; background: white;">清除</button>
    </div>`;
    
    statusContainer.innerHTML = html;
    
    document.getElementById('clearStatusBtn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'reset_task_state' });
      updateStatusUI({ status: 'idle', message: '', logs: [] });
    });
    
    summaryBtn.disabled = false;
    summaryBtn.textContent = '生成上下文摘要';
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 监听 background 的状态更新
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'task_state_update') {
    updateStatusUI(request.state);
    if (request.state.status === 'completed' && request.state.result) {
      handleCompletedTask(request.state);
    }
  }
});

async function handleCompletedTask(state: TaskState) {
  if (!state.result) return;
  
  if (state.summaryFilename) {
    const summaryContent = `# 上下文摘要\n\n> 原始对话: ${state.filename}\n> 生成时间: ${new Date().toLocaleString()}\n\n---\n\n${state.result}`;
    downloadFile(summaryContent, state.summaryFilename, 'text/markdown');
  }
  
  try {
    await navigator.clipboard.writeText(state.result);
  } catch (e) {
    console.error('Clipboard failed:', e);
  }
}

// 页面加载时恢复状态
chrome.storage.local.get(['taskState'], (result) => {
  const taskState = result.taskState as TaskState | undefined;
  if (taskState) {
    updateStatusUI(taskState);
    
    if (['extracting', 'exporting', 'calling_api'].includes(taskState.status)) {
      const timer = setInterval(() => {
        chrome.storage.local.get(['taskState'], (r) => {
          const state = r.taskState as TaskState | undefined;
          if (state && ['extracting', 'exporting', 'calling_api'].includes(state.status)) {
            updateStatusUI(state);
          } else {
            clearInterval(timer);
            if (state) updateStatusUI(state);
          }
        });
      }, 500); // 更新更频繁以显示日志
    }
  }
});

optionsBtn?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractConversation(): Promise<Conversation | null> {
  const tab = await getCurrentTab();
  if (!tab?.id) return null;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract_conversation' });
    if (response?.success) {
      return response.data;
    } else {
      alert('无法从当前页面提取对话：' + (response?.error || '未知错误'));
      return null;
    }
  } catch (error) {
    console.error('Message failed:', error);
    alert('提取失败，请刷新页面后重试。');
    return null;
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

exportBtn?.addEventListener('click', async () => {
  const conversation = await extractConversation();
  if (!conversation) return;

  chrome.storage.sync.get(['defaultFormat'], (result) => {
    const format = result.defaultFormat || 'markdown';
    let content = '';
    let extension = '';
    let mimeType = 'text/plain';

    switch (format) {
      case 'markdown':
        content = formatToMarkdown(conversation);
        extension = 'md';
        break;
      case 'json':
        content = formatToJSON(conversation);
        extension = 'json';
        mimeType = 'application/json';
        break;
      case 'text':
        content = formatToText(conversation);
        extension = 'txt';
        break;
      case 'html':
        content = formatToHTML(conversation);
        extension = 'html';
        mimeType = 'text/html';
        break;
    }

    const filename = `${conversation.title.replace(/[\\/:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.${extension}`;
    downloadFile(content, filename, mimeType);
  });
});

summaryBtn?.addEventListener('click', async () => {
  updateStatusUI({ status: 'extracting', message: '正在提取对话...', startedAt: Date.now(), logs: [] });
  
  const conversation = await extractConversation();
  if (!conversation) {
    updateStatusUI({ status: 'failed', message: '提取失败', error: '无法从当前页面提取对话', logs: [] });
    return;
  }

  updateStatusUI({ status: 'exporting', message: '正在导出完整对话...', startedAt: Date.now(), logs: [] });

  const fullMarkdown = formatToMarkdown(conversation);
  const filename = `${conversation.title.replace(/[\\/:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
  downloadFile(fullMarkdown, filename, 'text/markdown');

  chrome.storage.sync.get(['apiUrl', 'apiKey', 'model', 'autoSummary', 'maxTokens'], async (result) => {
    if (result.autoSummary && result.apiKey) {
      const maxTokens = (result.maxTokens as number) || 30000;
      
      // 先智能截断消息
      const truncatedMessages = smartTruncate(conversation.messages, maxTokens);
      
      // 生成文本内容
      let contentForAPI = truncatedMessages.map(m => 
        `[${m.role === 'user' ? 'Human' : 'AI'}]: ${m.content}`
      ).join('\n\n');
      
      // 预处理压缩
      contentForAPI = preprocessContent(contentForAPI);
      
      // 如果还是太长，进一步截断
      const truncateResult = smartTruncateContent(contentForAPI, maxTokens);
      contentForAPI = truncateResult.content;

      const tokenCount = estimateTokens(contentForAPI);
      console.log(`Final tokens after preprocessing: ${tokenCount}`);

      chrome.runtime.sendMessage({
        action: 'start_summary_task',
        data: {
          config: {
            apiUrl: result.apiUrl,
            apiKey: result.apiKey,
            model: result.model
          },
          content: contentForAPI,
          originalFilename: filename,
          timeout: 120000, // 2分钟超时
          truncated: truncateResult.truncated
        }
      });

      updateStatusUI({ 
        status: 'calling_api', 
        message: '正在调用 LLM API...', 
        filename,
        startedAt: Date.now(),
        logs: ['🚀 任务已启动...']
      });

    } else {
      await fallbackToManualMode(filename);
      updateStatusUI({ status: 'idle', message: '', logs: [] });
    }
  });
});

async function fallbackToManualMode(filename: string) {
  const fileUploadPrompt = `我上传了一份名为"${filename}"的对话记录文件。请阅读该文件，并生成一份"高保真上下文快照"，包含以下内容：

1. **核心目标**：当前正在解决的终极问题。
2. **已确定共识**：已经解决的问题、选定的技术方案。
3. **关键代码/变量**：重要的命名、核心逻辑块。
4. **待办事项**：接下来的步骤。
5. **新知识**：对话中产生的特殊偏好或新发现。

要求：极度精简，能让新对话的 AI 立即无缝衔接。`;

  try {
    await navigator.clipboard.writeText(fileUploadPrompt);
    alert(`已完成：
1. 完整对话已导出为 "${filename}"
2. 文件读取 Prompt 已复制到剪贴板

下一步：上传文件并粘贴 Prompt`);
  } catch (err) {
    alert(`对话已导出为 "${filename}"。请手动复制 Prompt。`);
  }
}
