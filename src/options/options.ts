// Provider configurations
const PROVIDERS: Record<string, { url: string; models: string[]; placeholder: string }> = {
  openai: {
    url: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    placeholder: 'sk-...'
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    placeholder: 'sk-ant-...'
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    placeholder: 'sk-...'
  },
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    placeholder: 'AIza...'
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-chat'],
    placeholder: 'sk-or-...'
  },
  custom: {
    url: '',
    models: [],
    placeholder: 'your-api-key'
  }
};

// Elements
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const apiUrlInput = document.getElementById('apiUrl') as HTMLInputElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const modelInput = document.getElementById('model') as HTMLInputElement;
const maxTokensInput = document.getElementById('maxTokens') as HTMLInputElement;
const defaultFormatSelect = document.getElementById('defaultFormat') as HTMLSelectElement;
const autoSummaryCheckbox = document.getElementById('autoSummary') as HTMLInputElement;
const modelSuggestions = document.getElementById('modelSuggestions') as HTMLDivElement;
const providerBtns = document.querySelectorAll('.provider-btn');

let currentProvider = 'openai';

// Select provider
function selectProvider(provider: string) {
  currentProvider = provider;
  
  // Update UI
  providerBtns.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-provider') === provider);
  });
  
  const config = PROVIDERS[provider];
  if (config) {
    if (provider !== 'custom') {
      apiUrlInput.value = config.url;
    }
    apiKeyInput.placeholder = config.placeholder;
    
    // Update model suggestions
    modelSuggestions.innerHTML = config.models.map(m => 
      `<span class="model-tag" data-model="${m}">${m}</span>`
    ).join('');
    
    // Add click handlers for model tags
    modelSuggestions.querySelectorAll('.model-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        modelInput.value = tag.getAttribute('data-model') || '';
      });
    });
  }
}

// Provider button click handlers
providerBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const provider = btn.getAttribute('data-provider');
    if (provider) selectProvider(provider);
  });
});

// Load settings
chrome.storage.sync.get(['apiUrl', 'apiKey', 'model', 'maxTokens', 'defaultFormat', 'autoSummary', 'provider'], (result) => {
  apiUrlInput.value = (result.apiUrl as string) || '';
  apiKeyInput.value = (result.apiKey as string) || '';
  modelInput.value = (result.model as string) || '';
  maxTokensInput.value = (result.maxTokens as string) || '30000';
  defaultFormatSelect.value = (result.defaultFormat as string) || 'markdown';
  autoSummaryCheckbox.checked = result.autoSummary === true;
  
  // Detect provider from URL or use saved
  const savedProvider = result.provider as string;
  if (savedProvider && PROVIDERS[savedProvider]) {
    selectProvider(savedProvider);
  } else if (result.apiUrl) {
    // Try to detect provider from URL
    const url = result.apiUrl as string;
    if (url.includes('openai.com')) selectProvider('openai');
    else if (url.includes('anthropic.com')) selectProvider('anthropic');
    else if (url.includes('deepseek.com')) selectProvider('deepseek');
    else if (url.includes('googleapis.com')) selectProvider('google');
    else if (url.includes('openrouter.ai')) selectProvider('openrouter');
    else selectProvider('custom');
  } else {
    selectProvider('openai');
  }
});

// Save settings
saveBtn.addEventListener('click', () => {
  const settings = {
    provider: currentProvider,
    apiUrl: apiUrlInput.value,
    apiKey: apiKeyInput.value,
    model: modelInput.value,
    maxTokens: parseInt(maxTokensInput.value) || 30000,
    defaultFormat: defaultFormatSelect.value,
    autoSummary: autoSummaryCheckbox.checked,
  };

  chrome.storage.sync.set(settings, () => {
    // Show success feedback
    saveBtn.textContent = '✓ 已保存';
    saveBtn.style.backgroundColor = '#22c55e';
    setTimeout(() => {
      saveBtn.textContent = '保存所有设置';
      saveBtn.style.backgroundColor = '';
    }, 2000);
  });
});
