// This file contains the background script for the Chrome extension. It manages the extension's lifecycle, handles events, and maintains data persistence across tabs using Chrome's storage API.

// import { OpenAI } from "openai";

console.log('Background script loaded');


// const openai = new OpenAI({
//     apiKey: API_KEY,
//     organization: ORG_ID,
//     project: PROJ_ID,
//     dangerouslyAllowBrowser: true, // Needed for client-side use
// });

// const assistant = await openai.beta.assistants.create({
//     model: "gpt-3.5-turbo",
//     assistant: ASST_ID,
//     messages: [
//         { role: "user", content: data }
//     ]
// });

// async function assistant(data) {
//     data = JSON.stringify(data);
//     fetch("https://api.openai.com/v1/chat/completions", {
//         method: "POST",
//         headers: {
//             "Authorization": "Bearer " + API_KEY,
//             "OpenAI-Organization": ORG_ID,
//             "OpenAI-Project": PROJ_ID,
//             "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//             model: "gpt-3.5-turbo",
//             assistant: ASST_ID,
//             messages: [
//                 { role: "user", content: data }
//             ]
//         })
//     }).then(response => {
//         if (!response.ok){
//             data = response.data;
//             console.log('Assistant response:', response.body);
//             console.log('Assistant response data:', data);
//             return data.choices[0].message.content;
//         }else {
//              throw new Error(`Error: ${data.error.message}`);
//         }
//     }).catch(error => {
//         console.error('Error fetching assistant response:', error);
//         throw error;
//     });

// }
async function assistant(data) {
    return new Promise((resolve, reject) => {
        resolve(data); // Placeholder for actual assistant logic
    });
}

function tocketIsValid() {
    return true; // Placeholder for actual ticket validation logic
}

export function formatData(data) {
    return new Promise((resolve, reject) => {
        if (!data || typeof data !== 'object') {
            reject(new Error('Invalid data format'));
            return;
        }

        if (tocketIsValid()) {
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
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveTicketData') {
        chrome.storage.local.set({ ticketData: request.data }, () => {
            sendResponse({ status: 'success' });
        });
        return true; // Indicates that the response will be sent asynchronously
    }

    if (request.action === 'getTicketData') {
        chrome.storage.local.get('ticketData', (data) => {
            sendResponse({ status: 'success', data: data.ticketData });
        });
        return true; // Indicates that the response will be sent asynchronously
    }
});

// The request was raised by Silvia-Ioana Gonciulea for a change related to disconnecting legacy distribution switches to optimize the network structure. 
// The planned start for the change is on June 30, 2025, at 2:00 PM, and the planned end is at 5:00 PM. 
// The impact of the change is expected to be non-service affecting. 
// The risk level is medium, and the test plan involves checking service functionality before, during, and after the change. 
// The implementation plan indicates that there will be no implementation on the side of lolo. There are several internal notes and comments related to the change, 
// including requests for updates and clarifications on the maintenance window.


