// New popup with current page info and improved functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('ScreenAI popup loaded');
    
    const toggleChatbotBtn = document.getElementById('toggleChatbot');
    const openWebAppBtn = document.getElementById('openWebApp');
    const statusText = document.getElementById('statusText');
    const currentPageInfo = document.getElementById('currentPageInfo');
    const pageTitle = document.getElementById('pageTitle');
    const pageUrl = document.getElementById('pageUrl');
    const pageStatus = document.getElementById('pageStatus');

    // Show current page information
    async function showCurrentPage() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            
            if (currentTab) {
                // Update page info
                if (pageTitle) {
                    pageTitle.textContent = currentTab.title || 'Unknown page';
                }
                
                if (pageUrl) {
                    const url = currentTab.url;
                    const displayUrl = url.length > 40 ? url.substring(0, 40) + '...' : url;
                    pageUrl.textContent = displayUrl;
                }
                
                // Check if we can run on this page
                const isRestricted = currentTab.url && (
                    currentTab.url.startsWith('chrome://') ||
                    currentTab.url.startsWith('chrome-extension://') ||
                    currentTab.url.startsWith('moz-extension://') ||
                    currentTab.url.startsWith('edge://') ||
                    currentTab.url.startsWith('opera://')
                );
                
                if (isRestricted) {
                    if (pageStatus) {
                        pageStatus.textContent = 'Cannot run on this page';
                        pageStatus.style.color = '#ef4444';
                    }
                    if (toggleChatbotBtn) {
                        toggleChatbotBtn.disabled = true;
                        toggleChatbotBtn.style.opacity = '0.5';
                    }
                } else {
                    if (pageStatus) {
                        pageStatus.textContent = 'Ready to use';
                        pageStatus.style.color = '#10b981';
                    }
                    if (toggleChatbotBtn) {
                        toggleChatbotBtn.disabled = false;
                        toggleChatbotBtn.style.opacity = '1';
                    }
                }
            }
        } catch (error) {
            console.error('Error getting current page:', error);
            if (pageStatus) {
                pageStatus.textContent = 'Error loading page info';
                pageStatus.style.color = '#ef4444';
            }
        }
    }

    // Toggle chatbot
    if (toggleChatbotBtn) {
        toggleChatbotBtn.addEventListener('click', async function() {
            try {
                console.log('Toggling chatbot...');
                statusText.textContent = 'Toggling assistant...';
                
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                const currentTab = tabs[0];
                
                if (!currentTab) {
                    statusText.textContent = 'No active tab found';
                    return;
                }
                
                console.log('Sending toggleChatbot message for tab:', currentTab.url);
                
                // Send message to background script to toggle assistant
                const response = await chrome.runtime.sendMessage({
                    action: 'toggleChatbot'
                });
                
                console.log('Background response:', response);
                
                if (response && response.success) {
                    statusText.textContent = 'Assistant toggled!';
                    setTimeout(() => {
                        window.close();
                    }, 1000);
                } else {
                    statusText.textContent = 'Failed to toggle assistant';
                }
                
            } catch (error) {
                console.error('Error toggling chatbot:', error);
                statusText.textContent = 'Error: ' + error.message;
            }
        });
    }

    // Open Web App button
    if (openWebAppBtn) {
        openWebAppBtn.addEventListener('click', function() {
            chrome.tabs.create({ url: 'http://localhost:3001' });
            window.close();
        });
    }

    // Show current page info on load
    showCurrentPage();
});
