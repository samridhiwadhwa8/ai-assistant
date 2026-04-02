# ScreenAI Browser Extension

A Chrome browser extension that provides a floating AI assistant for screen analysis.

## Features

**Floating UI** - Always-on-top assistant window that floats on any webpage  
**Screen Capture** - Capture entire screen, specific windows, or current tab  
**AI Analysis** - Powered by LLaMA 3 for intelligent screen content analysis  
**Voice Input** - Hands-free voice commands and questions  
**Chat Interface** - Natural conversation about captured content  
**Cross-Tab** - Works across any open tabs and applications  

## Installation

### Development Installation

1. **Clone or download this extension folder**
2. **Open Chrome Extensions page** - Go to `chrome://extensions/`
3. **Enable Developer Mode** - Toggle "Developer mode" in top right
4. **Load Extension** - Click "Load unpacked" and select this folder
5. **Pin Extension** - Click the puzzle icon and pin ScreenAI to your toolbar

### Requirements

- Chrome browser (latest version)
- Backend server running on `http://localhost:8000`
- ScreenAI web app running on `http://localhost:3001` (optional)

## Usage

### Basic Usage

1. **Click the ScreenAI icon** in your Chrome toolbar
2. **Choose "Open Floating Assistant"** to launch the floating window
3. **Capture Content** - Use "Capture Screen" or "Current Tab" buttons
4. **Ask Questions** - Type or speak questions about the captured content
5. **Get AI Analysis** - Receive intelligent responses about your screen

### Floating Window Controls

- **Drag** - Drag the header to move the window anywhere
- **Minimize** - Click the minimize button to collapse to header only
- **Close** - Click the X button to close the floating assistant
- **Always on Top** - Window stays above all other applications

### Voice Commands

- Click the microphone button to start voice recording
- Speak your question naturally
- Click again to stop recording
- AI will process your voice and respond

## Permissions

The extension requests these permissions:

- `activeTab` - Access current tab for capture
- `scripting` - Inject content scripts
- `storage` - Save conversation history
- `desktopCapture` - Screen capture functionality
- `tabs` - Manage tabs for cross-tab functionality
- `offscreen` - Background processing
- `<all_urls>` - Work on any website

## Technical Architecture

### Components

- **`manifest.json`** - Extension configuration and permissions
- **`background.js`** - Service worker for core functionality
- **`floating-ui.html/js/css`** - Main floating assistant interface
- **`popup.html/js`** - Extension popup interface
- **`content.js`** - Content script for page integration

### Key Features

1. **Floating Window Management**
   - Always-on-top popup window
   - Draggable interface
   - Minimize/maximize functionality

2. **Screen Capture**
   - Full screen capture
   - Window/app capture
   - Current tab capture
   - Image processing and optimization

3. **AI Integration**
   - Communication with backend API
   - Conversation history management
   - Real-time streaming responses

4. **Voice Recognition**
   - WebKit Speech Recognition API
   - Voice-to-text processing
   - Hands-free operation

## Development

### File Structure

```
browser-extension/
├── manifest.json           # Extension manifest
├── background.js           # Service worker
├── popup.js                # Popup logic
├── icons/                  # Extension icons
└── README.md               # This file
```

### Debugging

1. **Open Chrome DevTools** in the floating window (Ctrl+Shift+I)
2. **Check Background Script** in `chrome://extensions/` → Service Worker
3. **View Console Logs** for error messages
4. **Network Tab** to monitor API calls

### Backend Integration

The extension communicates with your Python backend at `http://localhost:8000`:

```javascript
// Example API call
const response = await fetch('http://localhost:8000/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        message: userMessage,
        screenshot: imageData,
        conversation_history: history
    })
});
```

## Troubleshooting

### Common Issues

1. **Extension won't load**
   - Check manifest.json syntax
   - Ensure Developer Mode is enabled
   - Look for errors in Extensions page

2. **Screen capture not working**
   - Check Chrome screen permissions
   - Ensure HTTPS for production
   - Restart Chrome after permission changes

3. **Backend connection failed**
   - Verify backend is running on port 8000
   - Check CORS settings in backend
   - Ensure firewall allows connection

4. **Voice recognition not working**
   - Check microphone permissions
   - Ensure HTTPS in production
   - Test with Chrome's voice recognition demo

### Performance Tips

- Keep conversation history limited (last 10 messages)
- Compress screenshots before sending to backend
- Use debouncing for voice recognition
- Implement proper error handling

