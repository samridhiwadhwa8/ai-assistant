// Background service worker for ScreenAI Extension

// Storage for session persistence
let sessionState = {
  lastActiveTab: null,
  overlayVisible: false,
  lastSession: null
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('ScreenAI Extension installed');
  chrome.storage.local.set({
    autoRestore: true,
    shortcutEnabled: true,
    floatingMode: true
  });
});

// Helper function to check if page is restricted
function isRestrictedPage(url) {
  if (!url) return true;
  const restricted = [
    'chrome://', 'chrome-extension://', 'moz-extension://',
    'edge://', 'opera://', 'brave://', 'vivaldi://',
    'view-source:', 'data:'
  ];
  return restricted.some(prefix => url.startsWith(prefix));
}

// Helper function to safely send message to tab
async function safeMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    return null;
  }
}

// Listen for keyboard shortcuts
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    console.log('ScreenAI: Chrome command received:', command);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      
      console.log('ScreenAI: Tab URL:', tab.url);
      
      if (isRestrictedPage(tab.url)) {
        console.log('ScreenAI: Restricted page, opening web app');
        chrome.tabs.create({ url: 'http://localhost:3001' });
        return;
      }
      
      if (command === 'toggle-assistant') {
        console.log('ScreenAI: Calling toggleAssistant');
        await toggleAssistant(tab);
      }
    } catch (error) {
      console.log('ScreenAI: Command error:', error.message);
    }
  });
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'keyboardShortcut') {
    handleKeyboardShortcut(request.command, sender.tab);
    sendResponse({ success: true });
  } else if (request.action === 'openChatbot') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && !isRestrictedPage(tabs[0].url)) {
        safeMessage(tabs[0].id, { action: 'showChatbot' });
      }
    });
    sendResponse({ success: true });
  } else if (request.action === 'toggleChatbot') {
    console.log('ScreenAI: toggleChatbot message received from popup');
    console.log('ScreenAI: Sender tab:', sender.tab);
    console.log('ScreenAI: Sender tab URL:', sender.tab?.url);
    
    if (!sender.tab) {
      console.log('ScreenAI: No sender tab, getting active tab');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          console.log('ScreenAI: Using active tab:', tabs[0].url);
          toggleAssistant(tabs[0]).then(() => {
            sendResponse({ success: true });
          }).catch((error) => {
            console.log('ScreenAI: toggleAssistant failed:', error);
            sendResponse({ success: false });
          });
        } else {
          console.log('ScreenAI: No active tab found');
          sendResponse({ success: false });
        }
      });
      return true;
    }
    
    toggleAssistant(sender.tab).then(() => {
      console.log('ScreenAI: toggleAssistant completed successfully');
      sendResponse({ success: true });
    }).catch((error) => {
      console.log('ScreenAI: toggleAssistant failed:', error);
      sendResponse({ success: false });
    });
    return true;
  } else if (request.action === 'captureScreen') {
    handleScreenCapture(sender.tab, sendResponse);
    return true;
  } else if (request.action === 'captureTab') {
    handleTabCapture(sender.tab, sendResponse);
    return true;
  } else if (request.action === 'sendToBackend') {
    sendToBackend(request.data, sendResponse);
    return true;
  } else if (request.action === 'disableExtension') {
    // Clear session state and disable
    sessionState = {
      lastActiveTab: null,
      overlayVisible: false,
      lastSession: null
    };
    chrome.storage.local.set({ sessionState });
    sendResponse({ success: true });
  } else if (request.action === 'checkTopBar') {
    // This will be handled by the content script
    sendResponse({ success: true });
  } else if (request.action === 'removeAssistant') {
    // This will be handled by the content script
    sendResponse({ success: true });
  }
  return false;
});

// Handle keyboard shortcuts (unified function)
async function handleKeyboardShortcut(command, tab) {
  console.log('ScreenAI: Keyboard shortcut message received:', command, 'tab:', tab?.url);
  if (!tab || isRestrictedPage(tab.url)) {
    console.log('ScreenAI: No tab or restricted page, ignoring shortcut');
    return;
  }
  
  try {
    if (command === 'toggle-assistant') {
      console.log('ScreenAI: Calling toggleAssistant from keyboard shortcut');
      await toggleAssistant(tab);
    }
  } catch (error) {
    console.log('ScreenAI: Shortcut error:', error.message);
  }
}

// Toggle assistant function
async function toggleAssistant(tab) {
  console.log('ScreenAI: toggleAssistant called for URL:', tab?.url);
  
  if (!tab || isRestrictedPage(tab.url)) {
    console.log('ScreenAI: Restricted page, opening web app');
    chrome.tabs.create({ url: 'http://localhost:3001' });
    return;
  }
  
  try {
    // Check if assistant already exists first
    console.log('ScreenAI: Checking if assistant exists');
    const existingTopBar = await safeMessage(tab.id, { action: 'checkTopBar' });
    
    console.log('ScreenAI: Assistant exists check result:', existingTopBar);
    
    if (existingTopBar && existingTopBar.exists) {
      // Remove existing assistant
      console.log('ScreenAI: Removing existing assistant');
      await safeMessage(tab.id, { action: 'removeAssistant' });
      console.log('ScreenAI: Assistant removed');
    } else {
      // Assistant doesn't exist, create it
      console.log('ScreenAI: Creating new assistant');
      await injectContentScript(tab);
      console.log('ScreenAI: Assistant created');
    }
  } catch (error) {
    console.log('ScreenAI: Toggle error:', error.message);
  }
}

// Inject content script if needed
async function injectContentScript(tab) {
  console.log('ScreenAI: injectContentScript called for:', tab?.url);
  
  if (!tab || isRestrictedPage(tab.url)) {
    console.log('ScreenAI: Cannot inject on browser pages');
    throw new Error('Cannot inject on browser pages');
  }
  
  try {
    console.log('ScreenAI: Executing content script injection');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: function() {
        // Prevent multiple injections
        if (window.screenAIInjected) return;
        window.screenAIInjected = true;
        
        console.log('ScreenAI: Content script executing');
        
        // Add message listener for content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.action === 'checkTopBar') {
            const topBar = document.getElementById('screenai-top-bar');
            sendResponse({ exists: !!topBar });
            return true;
          } else if (request.action === 'removeAssistant') {
            const topBar = document.getElementById('screenai-top-bar');
            const chatWindows = document.querySelectorAll('[id^="screenai-direct-chat"]');
            if (topBar) topBar.remove();
            chatWindows.forEach(chat => chat.remove());
            sendResponse({ success: true });
            return true;
          }
          return false;
        });
        
        // Remove existing elements
        const existingTopBar = document.getElementById('screenai-top-bar');
        const existingChats = document.querySelectorAll('[id^="screenai-direct-chat"]');
        if (existingTopBar) existingTopBar.remove();
        existingChats.forEach(chat => chat.remove());
        
        // Create top bar
        const topBar = document.createElement('div');
        topBar.id = 'screenai-top-bar';
        topBar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:50px;background:rgba(0, 0, 0, 0.08);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:none;border-bottom:none;outline:none;z-index:999999999;display:flex;align-items:center;justify-content:center;gap:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:white;font-weight:500;border-radius:0 0 18px 18px;mix-blend-mode:normal;isolation:isolate;';
        
        topBar.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span style="font-weight:600;">ScreenAI</span>
          </div>
          <div style="display:flex;gap:10px;">
            <button id="screenai-chat-btn" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">💬 Chat</button>
            <button id="screenai-minimize-btn" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">−</button>
            <button id="screenai-close-btn" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;">×</button>
          </div>
        `;
        
        document.body.appendChild(topBar);
        
        // Add event listeners
        const chatBtn = document.getElementById('screenai-chat-btn');
        const minimizeBtn = document.getElementById('screenai-minimize-btn');
        const closeBtn = document.getElementById('screenai-close-btn');
        
        if (chatBtn) {
          chatBtn.addEventListener('click', () => createChatWindow());
        }
        
        if (minimizeBtn) {
          minimizeBtn.addEventListener('click', () => {
            const topBar = document.getElementById('screenai-top-bar');
            if (topBar) {
              // Store original state
              if (!topBar.dataset.originalStyle) {
                topBar.dataset.originalStyle = topBar.style.cssText;
                topBar.dataset.originalContent = topBar.innerHTML;
              }
              
              // Minimize to thin line - completely override all styles
              topBar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:2px !important;min-height:2px !important;max-height:2px !important;width:100% !important;padding:0 !important;margin:0 !important;border:none !important;border-radius:0 !important;background:rgba(255,255,255,0.4) !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;box-shadow:none !important;overflow:hidden !important;cursor:pointer !important;z-index:999999999 !important;';
              topBar.innerHTML = '';
              
              // Add click to restore
              topBar.addEventListener('click', function restore() {
                topBar.style.cssText = topBar.dataset.originalStyle;
                topBar.innerHTML = topBar.dataset.originalContent;
                
                // Re-attach event listeners after restore
                const restoredChatBtn = document.getElementById('screenai-chat-btn');
                const restoredMinimizeBtn = document.getElementById('screenai-minimize-btn');
                const restoredCloseBtn = document.getElementById('screenai-close-btn');
                
                if (restoredChatBtn) {
                  restoredChatBtn.addEventListener('click', () => createChatWindow());
                }
                
                if (restoredMinimizeBtn) {
                  restoredMinimizeBtn.addEventListener('click', () => {
                    const topBar = document.getElementById('screenai-top-bar');
                    if (topBar) {
                      topBar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:2px !important;min-height:2px !important;max-height:2px !important;width:100% !important;padding:0 !important;margin:0 !important;border:none !important;border-radius:0 !important;background:rgba(255,255,255,0.4) !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;box-shadow:none !important;overflow:hidden !important;cursor:pointer !important;z-index:999999999 !important;';
                      topBar.innerHTML = '';
                      
                      topBar.addEventListener('click', restore);
                    }
                  });
                }
                
                if (restoredCloseBtn) {
                  restoredCloseBtn.addEventListener('click', () => {
                    const topBar = document.getElementById('screenai-top-bar');
                    const chatWindow = document.querySelector('[id^="screenai-direct-chat"]');
                    if (topBar) topBar.remove();
                    if (chatWindow) chatWindow.remove();
                  });
                }
                
                topBar.removeEventListener('click', restore);
              });
            }
          });
        }
        
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            const topBar = document.getElementById('screenai-top-bar');
            const chatWindow = document.querySelector('[id^="screenai-direct-chat"]');
            if (topBar) topBar.remove();
            if (chatWindow) chatWindow.remove();
          });
        }
        
        // Chat window creation function
        function createChatWindow() {
          const existingChats = document.querySelectorAll('[id^="screenai-direct-chat"]');
          existingChats.forEach(chat => chat.remove());
          
          const chatWindow = document.createElement('div');
          chatWindow.id = 'screenai-direct-chat-' + Date.now();
          chatWindow.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:450px;background:rgba(255, 255, 255, 0.06);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);border:1px solid rgba(255,255,255,0.25);border-radius:20px;z-index:999999998;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.25);isolation:isolate;mix-blend-mode:normal;';
          
          chatWindow.innerHTML = `
            <div style="height:100%;background:transparent;">
              <iframe src="http://localhost:3001/app" frameborder="0" width="100%" height="100%" style="border:none;background:transparent;width:100%;height:100%;display:block;allowtransparency:true;opacity:1;" allowtransparency="true" allow="microphone; camera; display-capture" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation-by-user-activation allow-downloads allow-microphone allow-camera"></iframe>
            </div>
          `;
          
          document.body.appendChild(chatWindow);
          console.log('Chat window created!');
        }
        
        return { success: true };
      }
    });
  } catch (error) {
    console.log('Injection error:', error.message);
  }
}

// Extension icon click
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    await toggleAssistant(tab);
  });
}

// Session restore
chrome.runtime.onStartup.addListener(async () => {
  try {
    const data = await chrome.storage.local.get(['sessionState', 'autoRestore']);
    if (data.autoRestore && data.sessionState) {
      sessionState = data.sessionState;
    }
  } catch (error) {
    console.log('Session restore error:', error.message);
  }
});

// Handle screen capture
async function handleScreenCapture(tab, sendResponse) {
  try {
    // Use desktopCapture API for screen capture
    chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'tab'], tab, (streamId) => {
      if (streamId) {
        // Get the stream and capture a frame
        navigator.mediaDevices.getUserMedia({
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: streamId
            }
          }
        }).then(stream => {
          const video = document.createElement('video');
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            video.play();
            setTimeout(() => {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0);
              
              // Convert to data URL
              const imageData = canvas.toDataURL('image/png');
              stream.getTracks().forEach(track => track.stop());
              
              sendResponse({ success: true, imageData: imageData });
            }, 100);
          };
        }).catch(error => {
          console.error('Screen capture error:', error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        sendResponse({ success: false, error: 'Screen capture cancelled' });
      }
    });
  } catch (error) {
    console.error('Screen capture error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle tab capture
async function handleTabCapture(tab, sendResponse) {
  try {
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, imageData: dataUrl });
      }
    });
  } catch (error) {
    console.error('Tab capture error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Send data to backend
async function sendToBackend(data, sendResponse) {
  try {
    const response = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('Backend communication error:', error);
    sendResponse({ success: false, error: error.message });
  }
}
