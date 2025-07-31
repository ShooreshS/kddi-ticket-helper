
import {formatData} from './background.js';

function showWarningIcon() {
  const icon = document.getElementById('warning-icon');
  icon.style.display = 'inline';

  setTimeout(() => {
    icon.style.display = 'none';
  }, 1000);
}

function isValidUrl() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        return resolve(false);
      }

      try {
        const url = new URL(tab.url);
        const hostname = url.hostname;

        if (hostname.endsWith(".atlassian.net") || hostname.endsWith(".service-now.com")) {
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (e) {
        console.error("Invalid URL:", e);
        resolve(false);
      }
    });
  });
}


document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup script loaded');
    const readButton = document.getElementById('read-data');
    const pasteButton = document.getElementById('paste-data');
    const selector = document.getElementById('selector');
    const jiraId = document.getElementById('jira-id-value');

    selector.addEventListener('click', async () => {
        console.log('SELECTOR pressed', window.location.hostname);
        // if(window.location.hostname.endsWith(".atlassian.net")) {
        

        const valid = await isValidUrl();
        console.log('is valid URL:', valid);
        if (!valid) {
            console.log('This feature is only available for Atlassian and ServiceNow domains.');
            showWarningIcon();
            return;
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'startPickerMode' });

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'extractedData') {
                console.log('Data extracted', request.data);
                if(request.data.Back) {
                    jiraId.textContent = request.data.Back || '-';
                    console.log('Jira ID set:', jiraId.textContent);
                } else {
                    jiraId.textContent = '-';
                    console.log('Jira ID reset');
                }
                showWarningIcon();
            }
        });
        console.log('Listener for showWarningIcon added');
    });

    readButton.addEventListener('click', function() {
        console.log('COPY pressed');
        chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
           
            const activeTab = tabs[0];
            console.log('Active tab ID:', activeTab.id);
            console.log('sending :', { action: 'extractTicketData' });
            await chrome.tabs.sendMessage(activeTab.id, { action: 'extractTicketData' }, function(response) {
                if (response) {
                    console.log('✅ Data received:', typeof response);
                    chrome.storage.local.set({ticketData: response} );
                } else {
                    console.log('No corrcect data received: ', response);
                }
            });
        });
    });

    pasteButton.addEventListener('click', function() {
        console.log('Pasting data into destination tabs...');
        chrome.storage.local.get('ticketData', async function(result) {
            if (result.ticketData) {
                console.log('Retrieved ticket data:', result.ticketData);
                const formattedData = await formatData(result.ticketData);
                console.log('Formatted data:', formattedData);
                // chrome.tabs.query({ url: 'https://destination-url.com/*' }, function(tabs) {
                //     tabs.forEach(tab => {
                //         chrome.tabs.sendMessage(tab.id, { action: 'fillForm', data: result.ticketData });
                //         console.log('Data pasted into tab:', tab.id);
                //     });
                // });
            } else {
                console.error('No ticket data found in storage.');
            }
        });
    });

});
