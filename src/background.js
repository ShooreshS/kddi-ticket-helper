// This file contains the background script for the Chrome extension. It manages the extension's lifecycle, handles events, and maintains data persistence across tabs using Chrome's storage API.

import { ssrModuleExportsKey } from "vite/module-runner";

console.log('Background script loaded');

async function assistant(data) {
    return new Promise((resolve, reject) => {
        resolve(data); // Placeholder for actual assistant logic
    });
}

function ticketIsValid() {
    return true; // Placeholder for actual ticket validation logic
}

export function formatData(data) {
    return new Promise((resolve, reject) => {
        if (!data || typeof data !== 'object') {
            reject(new Error('Invalid data format'));
            return;
        }

        if (ticketIsValid()) {
            // TODO: send datat to the formater backend
            assistant(data)
                .then(response => {
                    console.log('Formatted response:', response);
                    // if successful
                    resolve(response);
                })
                .catch(error => {
                    console.error('Error formatting data:', error);
                    reject(error);
                });
        }
        else {
            reject(new Error('Ticket is not valid'));
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
    return true;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveTicketData') {
        console.log('Saving ticket data:', request.data);
        chrome.storage.local.set({ ticketData: request.data }, () => {
            console.log('Ticket data saved to storage');
            sendResponse({ status: 'success' });
        });
        chrome.storage.local.get('ticketData', function (result) {
            console.log('Data saved to storage:', result.ticketData);
        });
        console.log('BACKGROUND Data saved to storage:');
    }

    else if (request.action === 'getTicketData') {
        chrome.storage.local.get('ticketData', (data) => {
            sendResponse({ status: 'success', data: data.ticketData });
        });
    }

    // { action: 'getElement', selector, func, attribute }
    else if (request.action === 'getElement') {
        console.log('[background] Getting element:', request.selector);

        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (!tab) return sendResponse({ ok: false, error: 'No active tab' });
            chrome.tabs.sendMessage(
                tab.id,
                { action: 'getElement', selector: request.selector, func: request.func, attribute: request.attribute },
                { frameId: 0 },
                (resp) => {
                    console.log('[background] Element response:', resp);
                    if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                    else sendResponse(resp);
                }
            );
        });
    }

    else if (request.action === 'setElement') {
        console.log('[background] Setting element:', request.selector, request.value);
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (!tab) return sendResponse({ ok: false, error: 'No active tab' });
            chrome.tabs.sendMessage(
                tab.id,
                { action: 'setElement', selector: request.selector, value: request.value },
                { frameId: 0 },
                (resp) => {
                    console.log('[background] Element set response:', resp);
                    if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                    else sendResponse(resp);
                }
            );
        });
    }

    else {
        console.warn('Unknown action:', request.action);
        sendResponse({ status: 'error', message: 'Unknown action' });
    }

    return true; // Indicates that the response will be sent asynchronously
});


// The request was raised by Silvia-Ioana Gonciulea for a change related to disconnecting legacy distribution switches to optimize the network structure. 
// The planned start for the change is on June 30, 2025, at 2:00 PM, and the planned end is at 5:00 PM. 
// The impact of the change is expected to be non-service affecting. 
// The risk level is medium, and the test plan involves checking service functionality before, during, and after the change. 
// The implementation plan indicates that there will be no implementation on the side of lolo. There are several internal notes and comments related to the change, 
// including requests for updates and clarifications on the maintenance window.


// <input id="sys_display.incident.caller_id" 
// name="sys_display.incident.caller_id" 
// aria-labelledby="label.incident.caller_id" 
// type="search" autocomplete="off" autocorrect="off" value="" 
// ac_columns="user_name;email;first_name;last_name" ac_order_by="name" 
// data-type="ac_reference_input" data-completer="AJAXTableCompleter" 
// data-dependent="company" data-dependent-value="" data-ref-qual="" 
// data-ref="incident.caller_id" data-ref-key="null" data-ref-dynamic="false" 
// data-name="caller_id" data-table="sys_user" class="form-control element_reference_input" 
// style="; " spellcheck="false" 
// onfocus="if (!this.ac) addLoadEvent(function() {var e = gel('sys_display.incident.caller_id'); if (!e.ac) new AJAXTableCompleter(gel('sys_display.incident.caller_id'), 'incident.caller_id', 'company', ''); e.ac.onFocus();})" 
// aria-required="true" role="combobox" aria-autocomplete="list" aria-owns="AC.incident.caller_id" 
// aria-expanded="false" title="" aria-invalid="false"></input>