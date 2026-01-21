import { getExtractor } from './extractors';

console.log('ChatRelay Content Script loaded');

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'extract_conversation') {
    const extractor = getExtractor();
    if (extractor) {
      try {
        const conversation = extractor.extract();
        sendResponse({ success: true, data: conversation });
      } catch (error) {
        console.error('Extraction failed:', error);
        sendResponse({ success: false, error: 'Extraction failed' });
      }
    } else {
      sendResponse({ success: false, error: 'Platform not supported' });
    }
  }
  return true; // Keep message channel open for async response
});
