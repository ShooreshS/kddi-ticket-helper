// This file contains the background script for the Chrome extension. It manages the extension's lifecycle, handles events, and maintains data persistence across tabs using Chrome's storage API.
import { OpenAI } from "openai";
// import { getCredentials } from './config.js';

console.log('[BG] Background script loaded');
// CONFIG ====================
import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";
// import { getKey, getAPI } from './creds.js';

// MARK: identity
const ALLOWED_DOMAINS = ["kddia.spherience.io", "kddia.com"];
const ENC_DATA = "U2FsdGVkX1+MaH+15ZHIIucNcro0jUwvC/A3pXnLP3mpCoOWYEgJvZipt4C1q2S5m5NK/t04koeHZEdjkUnwVYMqJHapVyag3YS+7zf8rF2kNaTk9Vbcd8z9V2UBWwj4QAymSXJSaZL2rbN6BB+qs1BfhEsOkQE9FEeH7qrAjW8PMzV2zjo5LC5ofaAg+akdFXSd9Ekc/XpIqHB157ZzKVT8oSr2ffPv8BaIA4RRp4EGaMlQw707yzaQUUIvj6TrNjSXF9GsfHE4hwifH0uvJ1CZrY5eE6NxbGEvYyc5wwNtgVVtf5KAQ50WFXKFymmpZAyYXRXoO0cWXsr743/s63cTeU8JCrmOX5cA3Nbpj0B9pdpCkDLkCFyD0Pqvt3DCsuYWt9vbO1cvFMl2RnoRUbP6TaYnd0IFHpl34h5Y7Ss=";
var ENCRYPTION_KEY = null;
let credentials = null;
let assistantsList = null;
let assistant = null;
var thread = null;

async function isOrgUser() {
    // Returns {email, id} if the user is signed in and you have identity.email
    // try {
    //     const info = await chrome.identity.getProfileUserInfo();
    //     const email = (info?.email || "").toLowerCase();
    //     console.log("[BG] email: ", email);
    //     return email && ALLOWED_DOMAINS.some(d => email.endsWith("@" + d));
    // } catch {
    //     console.log("[BG] getProfileUserInfo ERR");
    // }
    return true;
}

async function getKey() {
    // const { orgUser } = await chrome.storage.local.get("orgUser");
    // if (!orgUser) {
    //     return "password";
    // } else {
    // TODO:
    //   const key await fetch("https://codeiland.com/assist", {
    //   method: "POST",
    //   headers: {"Content-Type":"application/json"},
    //   body: JSON.stringify({ user: "user@kddia.com" })
    // });
    return "b8d927049978168859a7d06affecacf563c50f1b444e55488a03eceeebd41cbf";
    // }

}

function encryptData(data) {
    if (typeof data === 'object') {
        data = JSON.stringify(data);
    }
    const ctB64 = AES.encrypt(data, ENCRYPTION_KEY).toString(); // base64 string
    return ctB64;
}

function decryptData(cipher) {
    console.log();
    const bytes = AES.decrypt(cipher, ENCRYPTION_KEY);
    try {
        let json = JSON.parse(bytes.toString(Utf8));
        return json;
    } catch (e) {
        return bytes.toString(Utf8);
    }
}

export const getCredentials = () => {
    return new Promise((resolve, reject) => {
        try {
            let creds = decryptData(ENC_DATA);
            if (typeof creds === 'string') {
                try {
                    creds = JSON.parse(creds);
                } catch (e) {
                    console.error('Bad JSON in creds string:');
                    reject(e);
                }
            }
            resolve(creds);
        } catch (error) {
            console.error('Error reading credentials:', error);
            reject(error);
        }
    });
};
// CONFIG ====================


// OPEN AI ====================
async function createThread() {
  const res = await fetch("https://api.openai.com/v1/threads", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${credentials.API_KEY}`,
      "OpenAI-Organization": credentials.ORG_ID,
      "OpenAI-Project": credentials.PROJ_ID,
      "OpenAI-Beta": "assistants=v2",
      "Content-Type": "application/json",
    }
  });
  return res.json(); // returns { id: "thread_..." }
}
async function addMessage(threadId, content) {
  await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${credentials.API_KEY}`,
      "OpenAI-Organization": credentials.ORG_ID,
      "OpenAI-Project": credentials.PROJ_ID,
      "OpenAI-Beta": "assistants=v2",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "user",
      content
    })
  });
}
async function runAssistant(threadId) {
  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${credentials.API_KEY}`,
      "OpenAI-Organization": credentials.ORG_ID,
      "OpenAI-Project": credentials.PROJ_ID,
      "OpenAI-Beta": "assistants=v2",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistant_id: credentials.ASST_ID
    })
  });
  return res.json(); // contains run.id
}
async function pollRun(threadId, runId) {
    let c = 0;
  while (c++ < 10) {
    const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      headers: {
        "Authorization": `Bearer ${credentials.API_KEY}`,
        "OpenAI-Organization": credentials.ORG_ID,
        "OpenAI-Project": credentials.PROJ_ID,
      "OpenAI-Beta": "assistants=v2",
      }
    });
    const run = await res.json();
    console.log("[BG] run", run);

    if (run.status === "completed") return run;
    if (["failed", "cancelled", "expired"].includes(run.status)) {
      throw new Error(`Run failed: ${run.status}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}
async function listMessages(threadId) {
  const res = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    headers: {
      "Authorization": `Bearer ${credentials.API_KEY}`,
      "OpenAI-Organization": credentials.ORG_ID,
      "OpenAI-Project": credentials.PROJ_ID,
    }
  });
  return res.json(); // contains array of messages
}
async function chatWithAssistant(userInput) {
  // get or create thread
  let { threadId } = await chrome.storage.local.get("threadId");
  if (!threadId) {
    const thread = await createThread();
    threadId = thread.id;
    await chrome.storage.local.set({ threadId });
  }

  // add user input
  await addMessage(threadId, userInput);

  // run assistant
  const run = await runAssistant(threadId);
  console.log("[BG][chatWithAssistant] run", run, "threadId", threadId, "userInput ", userInput );
  // wait until done
  await pollRun(threadId, run.id);

  // get assistant reply
  const messages = await listMessages(threadId);
  const reply = messages.data[0].content[0].text.value;
  return reply;
}

// OPEN AI ====================

const init = async () => {
    try {
        ENCRYPTION_KEY = await getKey();
        while (ENCRYPTION_KEY === null) {
            console.log('[BG] Waiting for KEY to be set...');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        credentials = await getCredentials();
        console.log('[BG] Credentials hasApiKey:', Boolean(credentials?.API_KEY));

        console.log("[BG] credentials:", credentials);

        const openai = new OpenAI({
            apiKey: credentials.API_KEY,
            organization: credentials.ORG_ID,
            project: credentials.PROJ_ID,
            dangerouslyAllowBrowser: true, // Needed for client-side use
        });

        // const myAssistants = await openai.beta.assistants.list({
        //     order: "desc",
        //     limit: "10",
        // });

        // console.log("[BG]", myAssistants.data);

        // assistantsList = myAssistants.data;

        // console.log("[BG] assistant list");

        thread = await createThread();
        await chrome.storage.local.set({ threadId: thread.id });


        // console.log("[BG] retrieveing assistant");
        // await openai.beta.assistants.retrieve(credentials.ASST_ID)
        //     .then((response) => {
        //         assistant = response;
        //     })
        //     .catch((e) => {
        //         console.log("[BG] OAI:", e.message);
        //     });
    } catch (err) {
        console.error('Error retrieving credentials:', err);
    }
    console.log("[BG] init passed ");
};

(async () => {
    const ok = await isOrgUser();
    console.log("[BG] startup ok:", ok);
    await chrome.storage.local.set({ orgUser: !!ok });
    if (!ok) {
        console.warn("[EXT] Not an allowed domain user — features disabled.");
        await chrome.storage.local.set({ orgUser: false });
        chrome.runtime.sendMessage({ action: "block", reason: "Not allowed" });
    } else {
        await chrome.storage.local.set({ orgUser: true });
        init();
    }
})();

async function assist(data) {
    return new Promise((resolve, reject) => {
        chatWithAssistant(data).then(response =>{
            console.log("[BG] assist response ",response);
            if (!response.ok) {
                resolve(response.data.choices[0].message.content);
            } else {
                reject(`Error: ${response.status} ${response.data.error.message}}`);
            }
        }).catch(e => {
             reject(`Error: ${e.message}}`);
        });
        // fetch("https://api.openai.com/v1/chat/completions", {
        //     method: "POST",
        //     headers: {
        //         "Authorization": "Bearer " + credentials.API_KEY,
        //         "OpenAI-Organization": credentials.ORG_ID,
        //         "OpenAI-Project": credentials.PROJ_ID,
        //         "Content-Type": "application/json"
        //     },
        //     body: JSON.stringify({
        //         model: "gpt-3.5-turbo",
        //         assistant: credentials.ASST_ID,
        //         messages: [
        //             { role: "user", content: data }
        //         ]
        //     })
        // }).then(response => {
        //      console.log("[BG] assist response ",response);
        //     if (!response.ok) {
        //         data = response.data;
        //         console.log('[BG] Assistant response:', response.body);
        //         console.log('[BG] Assistant response data:', data);
        //         resolve(data.choices[0].message.content);
        //     } else {
        //         reject(new Error(`Error: ${response.status} ${data.error.message}}`));
        //     }
        // }).catch(error => {
        //     console.error('Error fetching assistant response:', error);
        //     throw error;
        // });
    });
}

function ticketIsValid() {
    return true; // Placeholder for actual ticket validation logic
}

export function formatData(data) {
    return new Promise((resolve, reject) => {
        if (!data || typeof data !== 'object') {
            console.log('[BG] Invalid data format:', data);
            // TODO - ignored in bedugging
            // reject(new Error('Invalid data format'));
            // return;
        }

        if (ticketIsValid()) {
            // TODO: send datat to the formater backend
            assist(data)
                .then(response => {
                    console.log('[BG] Formatted response:', response);
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

// chrome.runtime.onInstalled.addListener(() => {
//     console.log('[BG] Extension installed');
// });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[BG] adding Listeners");

    if (request.action === 'ticketID') {
        chrome.storage.local.set({ ticketID: request.id }, () => {
            console.log('[BG] ticketID saved to storage');
        });
    }
    else if (request.action === 'saveTicketData') {
        console.log('[BG] Saving ticket data:', request.data);
        chrome.storage.local.set({ ticketData: request.data }, () => {
            console.log('[BG] Ticket data saved to storage');
            sendResponse({ status: 'success' });
        });
        chrome.storage.local.get('ticketData', function (result) {
            console.log('[BG] Data saved to storage:', result.ticketData);
        });
        console.log('[BG] BACKGROUND Data saved to storage:');
    }

    else if (request.action === 'getTicketData') {
        chrome.storage.local.get('ticketData', (data) => {
            sendResponse({ status: 'success', data: data.ticketData });
        });
    }

    // { action: 'getElement', selector, func, attribute }
    else if (request.action === 'getElement') {
        console.log('[BG] Getting element:', request.selector);

        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (!tab) return sendResponse({ ok: false, error: 'No active tab' });
            chrome.tabs.sendMessage(
                tab.id,
                { action: 'getElement', selector: request.selector, func: request.func, attribute: request.attribute },
                { frameId: 0 },
                (resp) => {
                    console.log('[BG] Element response:', resp);
                    if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                    else sendResponse(resp);
                }
            );
        });
    }

    else if (request.action === 'setElement') {
        console.log('[BG] Setting element:', request.selector, request.value);
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (!tab) return sendResponse({ ok: false, error: 'No active tab' });
            chrome.tabs.sendMessage(
                tab.id,
                { action: 'setElement', selector: request.selector, value: request.value },
                { frameId: 0 },
                (resp) => {
                    console.log('[BG] Element set response:', resp);
                    if (chrome.runtime.lastError) sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                    else sendResponse(resp);
                }
            );
        });
    }

    else {
        console.warn('[BG] Unknown action:', request.action);
        sendResponse({ status: 'error', message: 'Unknown action' });
    }

    return true; // Indicates that the response will be sent asynchronously
});
console.log("[BG] Listeners added");
