// ScreenAI Keyboard Shortcuts
// Handles Ctrl+Shift+L and Command+Shift+L for toggling assistant

console.log('ScreenAI: Loading keyboard shortcuts...');

// Prevent multiple instances
if (window.screenAIKeyboardShortcuts) {
    console.log('ScreenAI: Keyboard shortcuts already loaded');
} else {
    window.screenAIKeyboardShortcuts = true;
    console.log('ScreenAI: Initializing keyboard shortcuts');

    // Keyboard shortcut listener
    document.addEventListener('keydown', function(e) {
        // Only trigger on Ctrl+Shift+L or Command+Shift+L
        if ((e.key === 'l' || e.key === 'L') && 
            (e.ctrlKey || e.metaKey) && 
            e.shiftKey && 
            !e.altKey) {
            
            console.log('ScreenAI: Keyboard shortcut activated!');
            
            // Prevent default behavior
            e.preventDefault();
            e.stopPropagation();
            
            // Send toggle message to background
            chrome.runtime.sendMessage({
                action: 'keyboardShortcut',
                command: 'toggle-assistant'
            }).then(function() {
                console.log('ScreenAI: Assistant toggle request sent');
            }).catch(function(error) {
                console.log('ScreenAI: Failed to send message:', error);
            });
        }
    });

    console.log('ScreenAI: Keyboard shortcuts ready');
}
