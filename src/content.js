
import { formatData } from './background.js';

console.log('Content script loaded into:', window.location.href);

// Picker
let hoverBox = null;
let lastTarget = null;
const IS_TOP = window === window.top;
var tabUrl = window.location.href;
var ticketID = null;
let responseTemplate = {
  "ticketSummary": "Write the description here",
  "shortSummary": "[CD][KDDI][Country][Network][Service] Short Description of the Issue###Outage/NoOutage###",
  "changeDescription": [
    "Change reference:",
    "Change description:",
    "Customer impact description:",
    "Planned start time:",
    "Planned end time:",
    "Outage start time:",
    "Outage end time:",
    "Affected Service / Components",
    "Market / HUB affected:"
  ],
  "ticketDetails": {
    "requestType": "Lolo - Change",
    "country": "USA",
    "ticketType": "Change Request",
    "priority": "Non Service Affecting",
    "description": "Impact: Up to 5 minutes of network service outage per server, with a maximum duration of up to 5 minutes...",
    "plannedStart": "Jun 30, 2025, 2:00 PM",
    "plannedEnd": "Jun 30, 2025, 5:00 PM",
    "riskLevel": "Medium",
    "testPlan": "Check service functionality before, during and after the change",
    "backupPlan": "Rollback",
    "additionalNotes": "Please keep us updated once this Change Request is finished."
  }
};


async function extractJiraTicketData(selected) {
  console.log('🔍 Extracting Jira ticket data...');
  const allDivs = selected; // [...document.querySelectorAll("div")];
  const result = {};
  let currentLabel = null;

  // Keys to expect for device details (nested section)
  const deviceKeys = [
    "ICCID", "IMSI", "Service plan", "TCU", "TimeStamp of rejection", "Country"
  ];
  const deviceDetails = {};

  // Flags to catch description block
  let foundDescription = false;
  let descriptionText = "";

  for (let i = 0; i < allDivs.length; i++) {
    const text = allDivs[i].innerText?.trim();
    if (!text) continue;

    // Capture top-level key-value fields
    const nextText = allDivs[i + 1]?.innerText?.trim();
    if (
      nextText &&
      /^[A-Z]/.test(text) && // likely a label
      nextText !== text &&
      !text.endsWith(":") &&
      !text.includes("\n") &&
      nextText.length < 100 // probably a simple value
    ) {
      result[text] = nextText;
      continue;
    }

    // Description block starts
    if (text === "Description") {
      foundDescription = true;
      continue;
    }

    // Start capturing device detail key-values
    if (foundDescription && deviceKeys.some(k => text.startsWith(k))) {
      const parts = text.split(":");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(":").trim();
        deviceDetails[key] = value;
      }
      continue;
    }

    // Continue accumulating description
    if (foundDescription) {
      if (
        text.startsWith("External Issue ID") ||
        text.startsWith("Priority")
      ) {
        foundDescription = false;
      } else {
        descriptionText += text + "\n";
      }
    }

    // External Issue ID as fallback
    if (text.startsWith("External Issue ID")) {
      const next = allDivs[i + 1]?.innerText?.trim();
      if (next) result["External Issue ID"] = next;
    }
  }

  if (descriptionText) result["Description"] = descriptionText.trim();
  if (Object.keys(deviceDetails).length) result["Device details"] = deviceDetails;

  if (tabUrl !== null) {
    console.log("Current tab URL:", tabUrl);
    const ticketID = tabUrl.split("/").pop();
    result["ticketID"] = ticketID;
    console.log("[BG] jira: ", ticketID);
  }
  console.log("[BG] result: ", result);
  return result;
}

// DEBUG ONLY
let example_gpt_incident_response = {
  "kddiRef": "SP-336",
  "country": "USA",
  "network": "LOLO",
  "service": "DATA",
  "ticketSummary": "Datapacket Planned emergency maintenance in Los Angeles on Jun 30, 2025",
  "shortSummary": "[CD][KDDI][Country][Network][Service][SP:xx] Short Description of the Issue###Outage/NoOutage###",
  "ticketDetails": {
    "requestType": "Lolo - Incident",
    "ticketType": "Change Request",
    "priority": "Non Service Affecting",
    "description": "Impact: Up to 5 minutes of network service outage per server, with a maximum duration of up to 5 minutes...",
    "plannedStart": "Jun 30, 2025, 2:00 PM",
    "plannedEnd": "Jun 30, 2025, 5:00 PM",
    "riskLevel": "Medium",
    "testPlan": "Check service functionality before, during and after the change",
    "backupPlan": "Rollback",
    "additionalNotes": "Please keep us updated once this Change Request is finished."
  }
}

function startPickerMode() {
  // Create a highlight box overlay
  document.body.style.cursor = 'crosshair';
  hoverBox = document.createElement('div');
  Object.assign(hoverBox.style, {
    position: 'absolute',
    background: 'rgba(0, 128, 255, 0.5)',
    border: '2px solid #0088ff80',
    zIndex: 999999,
    pointerEvents: 'none' // ✅ key to avoid interfering
  });
  document.body.appendChild(hoverBox);

  // Add listeners
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('click', onClick, true);
}

function onMouseMove(e) {
  const target = e.target;

  // Avoid re-highlighting same element
  if (target === lastTarget || target === hoverBox) return;
  lastTarget = target;

  const rect = target.getBoundingClientRect();
  Object.assign(hoverBox.style, {
    top: `${rect.top + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    display: 'block'
  });
}

async function onClick(e) {
  document.body.style.cursor = 'default';
  e.preventDefault();
  e.stopPropagation();

  const selected = e.target;
  var data = selected.innerText || selected.textContent || '';

  console.log("🟢 Selected element data:", data);

  // Clean up
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('click', onClick, true);
  hoverBox?.remove();
  hoverBox = null;
  lastTarget = null;

  // var extracted = await extractJiraTicketData(selected);
  // console.log("[BG] data Extracted: \n", extracted);

  if (tabUrl !== null) {
    ticketID = tabUrl.split("/").pop();
    console.log("[content] jira: ", ticketID);
    chrome.runtime.sendMessage({ action: 'ticketID', id: ticketID });
  }

  chrome.runtime.sendMessage({ action: 'saveTicketData', data });


}

function queryDeep(selector, { root = document, timeout = 4000, every = 150 } = {}) {
  const search = (r) => {
    // Try at this root first
    const hit = r.querySelector?.(selector);
    if (hit) return hit;

    // Walk all elements; enter any shadowRoots
    const all = r.querySelectorAll?.('*') || [];
    for (const el of all) {
      if (el.shadowRoot) {
        const inside = search(el.shadowRoot);
        if (inside) return inside;
      }
    }
    return null;
  };

  if (!timeout) return search(root);

  // Optional: poll for late-rendered header
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const found = search(root);
      if (found) return resolve(found);
      if (Date.now() - start >= timeout) return reject(new Error('not found (deep)'));
      setTimeout(tick, every);
    };
    tick();
  });
}

function getTopLevelElement(selector, func = 'getAttribute', attribute = 'aria-label') {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'getElement', selector, func, attribute },
      (resp) => {
        console.log('[content] getTopLevelElement response:', resp);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else if (resp && resp.ok) {
          resolve(resp.value);
        } else {
          reject(resp?.error || 'Element not found');
        }
      }
    );
  });
}

function setTopLevelElement(selector, value) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'setElement', selector, value },
      (resp) => {
        console.log('[content] setTopLevelElement response:', resp);
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else if (resp && resp.ok) {
          resolve(true);
        } else {
          reject(resp?.error || 'Element not found');
        }
      }
    );
  });
}

async function fillIncident(data, userInput) {

  const country = userInput.country == "" ? data.ticketDetails.country : userInput.country;
  const ticketType = userInput.ticketType || "incident";
  const mno = userInput.mno == "" ? data.network : userInput.mno;
  const service = userInput.service == "" ? data.service : userInput.service;
  const jiraID = userInput.jiraID == "" ? data.kddiRef : userInput.jiraID;


  try {
    // document.querySelector("body > macroponent-f51912f4c700201072b211d4d8c26010").shadowRoot.querySelector("div > sn-canvas-appshell-root > sn-canvas-appshell-layout > sn-polaris-layout").shadowRoot.querySelector("div.sn-polaris-layout.polaris-enabled > div.layout-main > div.header-bar > sn-polaris-header").shadowRoot.querySelector("nav > div > div.ending-header-zone > div.polaris-header-controls > div.utility-menu-container > div > div")
    // let profileEl = document.querySelector("body > macroponent-f51912f4c700201072b211d4d8c26010").shadowRoot.querySelector("div > sn-canvas-appshell-root > sn-canvas-appshell-layout > sn-polaris-layout").shadowRoot.querySelector("div.sn-polaris-layout.polaris-enabled > div.layout-main > div.header-bar > sn-polaris-header").shadowRoot.querySelector("nav > div > div.ending-header-zone > div.polaris-header-controls > div.utility-menu-container > div > div > now-avatar").shadowRoot.querySelector("span > span > span");

    let caller; // = await getTopLevelElement(`#sys_display\\.${ticketType}\\.requested_by`, 'getAttribute', 'aria-label');
    // console.log("[content] caller: ", caller);

    // console.log("[content] caller: ", caller);
    // if (!caller) {
    //   user = document.querySelector("body > macroponent-f51912f4c700201072b211d4d8c26010").shadowRoot.querySelector("div > sn-canvas-appshell-root > sn-canvas-appshell-layout > sn-polaris-layout").shadowRoot.querySelector("div.sn-polaris-layout.polaris-enabled > div.layout-main > div.header-bar > sn-polaris-header").shadowRoot.querySelector("nav > div > div.ending-header-zone > div.polaris-header-controls > div.utility-menu-container > div > div")
    //   caller = user.getAttribute("aria-label");
    // }
    // console.log("[content] caller: ", caller);
    //document.querySelector(`#sys_display\\.${ticketTypeTemp}\\.requested_by`); 
    // await getTopLevelElement('.header-avatar-button.contextual-zone-button.user-menu', 'getAttribute', 'aria-label');

    // FORM elements
    const els = {
      callerEl: document.querySelector("#sys_display\\.incident\\.caller_id"), // 
      orginatorGroupEl: document.getElementById(`sys_display.${ticketType}.u_originator_group`), // document.querySelector("#sys_display\\.incident\\.u_originator_group")
      serviceEl: document.querySelector(`#sys_display\\.${ticketType}\\.business_service`),
      serviceOfferingEl: document.querySelector(`#sys_display\\.${ticketType}\\.service_offering`),
      configItemEl: document.querySelector("#sys_display\\.incident\\.cmdb_ci"), // 
      shortDescriptionEl: document.querySelector(`#${ticketType}\\.short_description`), // document.querySelector("#incident\\.short_description")
      descriptionEl: document.querySelector(`#${ticketType}\\.description`),
      assigneeGroupEl: document.querySelector(`#sys_display\\.${ticketType}\\.assignment_group`),
      assigneeEl: document.querySelector(`#sys_display\\.${ticketType}\\.assigned_to`),
    };
    for (const [k, v] of Object.entries(els)) {
      if (v) {
        console.log("✅ Found", k);
      } else {
        console.log("❌ Not found", k);
      }
    }

    // FILL IN THE FORM
    // callerEl.value = caller;

    els.orginatorGroupEl.value = 'FT_cdmno25kddi';
    els.serviceEl.value = 'Mobile Network, Connected Car';
    els.serviceOfferingEl.value = country.startsWith("US") ? "cdmno25kddi#us" : "cdmno25kddi#ca";
    els.configItemEl.value = "";
    els.assigneeGroupEl.value = 'FT_cdmno25kddi';


    els.assigneeEl.value = caller != "" ? caller : els.callerEl.value;
    els.descriptionEl.value = data.ticketSummary || '';

    // NA for incident. els.descriptionEl.value = responseTemplate.changeDescription.join("\n");
    els.shortDescriptionEl.value = data.shortSummary
      .replace('Country', country)
      .replace('Network', mno)
      .replace('Service', service)
      .replace('SP:xx', jiraID) || '';


  } catch (error) {
    console.error('Error filling in data:', error);
  }

}

function fillChange(data, userInput) {
  console.log("userInput: ", userInput);

  const country = userInput.country == "" ? data.ticketDetails.country : userInput.country;
  const ticketType = userInput.ticketType || "change_request";
  const mno = userInput.mno == "" ? data.network : userInput.mno;
  console.log("mno: ", mno);
  const service = userInput.service == "" ? data.service : userInput.service;
  const jiraID = userInput.jiraID == "" ? data.kddiRef : userInput.jiraID;


  try {
    // let caller =  await getTopLevelElement(`#sys_display\\.${ticketTypeTemp}\\.requested_by`, 'getAttribute', 'aria-label');
    //document.querySelector(`#sys_display\\.${ticketTypeTemp}\\.requested_by`); 
    // await getTopLevelElement('.header-avatar-button.contextual-zone-button.user-menu', 'getAttribute', 'aria-label');

    // FORM elements
    const els = {
      callerEl: document.querySelector("#sys_display\\.change_request\\.requested_by"), // document.querySelector("#sys_display\\.change_request\\.requested_by")
      serviceEl: document.querySelector(`#sys_display\\.${ticketType}\\.business_service`), // document.querySelector("#sys_display\\.change_request\\.business_service")
      serviceOfferingEl: document.querySelector(`#sys_display\\.${ticketType}\\.service_offering`), // document.querySelector("#sys_display\\.change_request\\.service_offering")
      configItemEl: document.querySelector("#sys_display\\.change_request\\.cmdb_ci"), // document.querySelector("#sys_display\\.change_request\\.cmdb_ci")
      shortDescriptionEl: document.querySelector(`#${ticketType}\\.short_description`), // document.querySelector("#change_request\\.short_description")
      descriptionEl: document.querySelector(`#${ticketType}\\.description`), // document.querySelector("#change_request\\.description")
      assigneeGroupEl: document.querySelector(`#sys_display\\.${ticketType}\\.assignment_group`), // document.querySelector("#sys_display\\.change_request\\.assignment_group")
      assigneeEl: document.querySelector(`#sys_display\\.${ticketType}\\.assigned_to`), // document.querySelector("#sys_display\\.change_request\\.assigned_to")
    };
    for (const [k, v] of Object.entries(els)) {
      if (v) {
        console.log("✅ Found", k);
      } else {
        console.log("❌ Not found", k);
      }
    }

    // FILL IN THE FORM
    // callerEl.value = caller;
    els.serviceEl.value = 'Mobile Network, Connected Car';
    els.serviceOfferingEl.value = country === "USA" ? "cdmno25kddi#us" : "cdmno25kddi#ca";
    els.configItemEl.value = "Mobile Network, Connected Car"; // " Technology Management service SWP-238"
    els.shortDescriptionEl.value = data.shortSummary
      .replace('Country', country)
      .replace('Network', mno)
      .replace('Service', service)
      .replace('SP:xx', jiraID) || '';
    els.descriptionEl.value = responseTemplate.changeDescription.join("\n\n");
    els.assigneeGroupEl.value = 'CHG_cdmno25kddi';
  } catch (error) {
    console.error('Error filling in data:', error);
  }

}

async function fillInData(data, userInput) {
  console.log('[fillInData] Filling in data:\n', data);
  let debug = true;
  if (debug)
    data = responseTemplate;
  var ticketTypeTemp = "";

  if (userInput && userInput.ticketType) {
    ticketTypeTemp = userInput.ticketType
  } else {
    if (data.ticketDetails.requestType.includes('Change')) {
      ticketTypeTemp = 'change_request';
    } else {
      ticketTypeTemp = 'incident';
    }
  }
  console.log('Ticket type:', ticketTypeTemp);
  userInput.ticketType = ticketTypeTemp;

  if (ticketTypeTemp == "incident") {
    fillIncident(data, userInput);
  } else {
    fillChange(data, userInput);
  }
  console.log(`[content] called fillIn${ticketTypeTemp}()`);
}

// TODO Child tickets
function readParent() {
  const els = {
    callerEl: document.querySelector("#sys_display\\.change_request\\.requested_by"),
    serviceEl: document.querySelector(`#sys_display\\.change_request\\.business_service`),
    serviceOfferingEl: document.querySelector(`#sys_display\\.change_request\\.service_offering`),
    configItemEl: document.querySelector("#sys_display\\.change_request\\.cmdb_ci"),
    shortDescriptionEl: document.querySelector(`#change_request\\.short_description`),
    descriptionEl: document.querySelector(`#change_request\\.description`),
    assigneeGroupEl: document.querySelector(`#sys_display\\.change_request\\.assignment_group`),
    assigneeEl: document.querySelector(`#sys_display\\.change_request\\.assigned_to`),
    startDate: document.querySelector("#change_request\\.start_date"),
    endDate: document.querySelector("#change_request\\.end_date"),
  };

  let parentInfo = {
    caller: els.callerEl.value,
    service: els.serviceEl.value,
    serviceOffering: els.serviceOfferingEl.value,
    configItem: els.configItemEl.value,
    shortDescription: els.shortDescriptionEl.value,
    description: els.descriptionEl.value,
    startDate: els.startDate.value,
    endDate: els.endDate.value,
  };

  chrome.runtime.sendMessage({ action: 'saveParentInfo', data: parentInfo }).then(
    () => {
      console.log("[content] Parent info sent to background:", parentInfo);
    }
  );
}

function getParentInfo() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getParentInfo' }, (response) => {
      if (response && response.status === 'success') {
        resolve(response.data);
      } else {
        reject("Failed to get parent info");
      }
    });
  });
}

async function fillChild() {
  console.log("[content] Filling child ticket from parent...");
  try {
    let group;
    chrome.storage.local.get("selectedGroup", (result) => {
      console.log("Selected group from storage:", result.selectedGroup);
      group = result.selectedGroup || '';
    });
    //  localStorage.getItem("selectedGroup") || '';
    console.log("Selected group from storage:", group);
    getParentInfo().then(
      (parentInfo) => {
        console.log("[cont] Got parent info:", parentInfo);
        if (!parentInfo || Object.keys(parentInfo).length === 0)
          return false;
        console.log("parentInfo is valid");
        const els = {
          configTtemEl: document.querySelector("#sys_display\\.change_task\\.cmdb_ci"),
          startDate: document.querySelector("#change_task\\.planned_start_date"),
          endDate: document.querySelector("#change_task\\.planned_end_date"),
          shortDescEl: document.querySelector("#change_task\\.short_description"),
          descEl: document.querySelector("#change_task\\.description"),
          assigneeGroupEl: document.querySelector("#sys_display\\.change_task\\.assignment_group"),
        };

        els.configTtemEl.value = parentInfo.configItem || '';
        els.shortDescEl.value = parentInfo.shortDescription || '';
        els.descEl.value = parentInfo.description || '';
        els.assigneeGroupEl.value = group;
        els.startDate.value = parentInfo.startDate;
        els.endDate.value = parentInfo.endDate;
      }
    ).catch((err) => {
      console.log("Error retrieving parent info:", err);
      return false;
    });

    return true;
  } catch (err) {
    console.log("Error getting parent info", err);
    return false;
  }
}

// Top level
if (IS_TOP) {
  console.log('[content] TOP addListeners');
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log('[content] TOP Received message:', request);

    if (request.action === 'startPickerMode') {
      startPickerMode();
      sendResponse({ status: 'picker_started' });
    }

    else if (request.action === "extractTicketData") {
      console.log('[content] Extracting ticket data from the page...');
      async () => {
        const data = await extractJiraTicketData();
        console.log("[BG] data Extracted: \n", data);

        sendResponse(data);
      }
    }

    else if (request.action === 'getElement') {
      console.log('[content][TOP] Getting element:', request.selector);
      let value;
      try {
        if (window.NOW && window.NOW.user_display_name) {
          console.log("not null");
          value = window.NOW.user_display_name

        } else {
          console.log("was null");
          value = document.querySelector("#sys_display\\.incident\\.caller_id").value;
          // (async () => {
          //   let element = await queryDeep(request.selector);
          //   if (element) {
          //     let response = null;
          //     switch (request.func) {
          //       case 'getProperty':
          //         response = element[request.property];
          //         break;
          //       case 'getAttribute':
          //         response = element.getAttribute(request.attribute).split(':')[0];
          //         break;
          //       case 'getValue':
          //         response = element.value;
          //         break;
          //       default:
          //         console.warn('Unknown function:', request.func);
          //         response = "unknown function";
          //     }
          //     console.log('[content][TOP] value:', response);
          //     sendResponse({ ok: true, selector: request.selector, value: response });
          //   } else {
          //     sendResponse({ ok: false, selector: request.selector, value: "not found" });
          //   }
          // })();
        }
      } catch (e) {
        console.log("[TOP] getElement Error:", e);
        sendResponse({ ok: false, selector: request.selector, value: "not found" });
      }
      sendResponse({ ok: true, selector: request.selector, value: value });
    }

    else if (request.action === 'setElement') {
      console.log('[content][TOP] Setting element:', request.selector, request.value);
      (async () => {
        let element = await queryDeep(request.selector);
        if (element) {
          element.value = request.value;
          sendResponse({ ok: true, selector: request.selector, value: request.value });
        } else {
          sendResponse({ ok: false, selector: request.selector, value: "not found" });
        }
      })();
    }

    else {
      console.log('[content] TOP Unknown action:', request.action);
    }

    return true; // keep channel open (good habit for async)
  });
}

// in iframes
if (!IS_TOP) {
  console.log('[content][iframe] addListeners');
  chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    console.log('[iframe] Received message:', request);

    if (request.action === 'pasteTicketData') {
      chrome.storage.local.get('ticketData', async function (result) {
        console.log('[iframe] Retrieved ticket data from storage:', result);
        if (result.ticketData) {
          console.log('[iframe] Retrieved ticket data:', result.ticketData);
          const formattedData = await formatData(result);
          console.log('Formatted data:', formattedData);
          fillInData(result.ticketData, request.userInput);
          sendResponse({ status: 'success', message: 'Data pasted successfully' });
        } else {
          console.error('No ticket data found in storage.');
          sendResponse({ status: 'error', message: 'No ticket data found in storage' });
        }
      });
    }

    else if (request.action === 'fillChildTicket') {
      console.log('[iframe] Filling child ticket from parent...');

      let succ = await fillChild();
      if (succ)
        sendResponse({ status: 'success', message: 'Child ticket filled' });
      else
        sendResponse({ status: 'error', message: 'Failed to fill child ticket' });
    }

    else {
      console.log('[iframe] Unknown action:', request.action);
    }

    return true; // keep channel open for async response
  });
}

// Inject subtask logic
function findTabByCaption(captionStart) {
  const captions = document.querySelectorAll("#tabs2_list .tab_caption_text");
  return Array.from(captions).find(el =>
    el.textContent.trim().startsWith(captionStart)
  );
}

const observer = new MutationObserver(() => {
  console.log("[content] MutationObserver checking for Create Subtask button...");
  const btn = findTabByCaption("Change Tasks");
  if (btn) {
    btn.addEventListener("click", () => {
      console.log("Create Subtask button clicked");
      readParent();
    });
    observer.disconnect(); // stop watching once found
  }
});
observer.observe(document.body, { childList: true, subtree: true });


function getSubtasks(ticketType) {
  // This function should retrieve subtasks based on the ticket type
  // For now, returning a placeholder array
  return ['Subtask 1 for ' + ticketType, 'Subtask 2 for ' + ticketType];
}

let example_extracted_data_by_extractJiraTicketData = {
  "ADP Connectivity issue": "Hayam Ahmed",
  "Actions": "Customer\nCustomer details\nSilvia-Ioana Gonciulea",
  "Activity": "Show:\nAll\nComments\nHistory\nWork log\nApprovals\nSummarize 4 comments\nNewest first",
  "All queues": "Give feedback",
  "Apps": "Create",
  "Assets": "Apps",
  "Assign to me": "Reporter\nSilvia-Ioana Gonciulea",
  "Assignee": "Status",
  "BMW ADP Redundancy tests - UP/AAA": "Silvia-Ioana Gonciulea",
  "Back": "SP-336",
  "Backout plan": "rollback",
  "Bringing down Amsterdam PGW": "Isac Jinton",
  "CHG000000175220": "Internal change notification\nNone",
  "Changes": "Incidents",
  "Closed": "15/Jun/25",
  "Connectivity issue with MDN 5224826132 in Germany Test plant": "Khwaja Rahman",
  "Create subtask": "Link work item\nLink web pages and more",
  "Created": "Time to resolution",
  "Created June 21, 2025 at 6:11 PM": "Updated 2 days ago",
  "Customer details": "Silvia-Ioana Gonciulea",
  "DNS, AAA, Netflow updates": "Isac Jinton",
  "Dashboards": "Teams",
  "DataPacket Frankfurt: planned maintenance, Jun 24": "Silvia-Ioana Gonciulea",
  "DataPacket – Planned Emergency network maintenance in Amsterdam 13.6.2025": "Silvia-Ioana Gonciulea",
  "Datapacket Planned emergency maintenance in Los Angeles, Jun 23": "Silvia-Ioana Gonciulea",
  "Datapacket Planned maintenance in Amsterdam, Jun 18": "Silvia-Ioana Gonciulea",
  "Datapacket Planned maintenance in Los Angeles, Jun 30": "Silvia-Ioana Gonciulea",
  "Description": "Datapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nDatapacket message below:\n\nImpact Up to 5 minutes\n\nWork window Jun 30, 2025 12:00:00 PM—3:00:00 PM(UTC+03:00)\n\nDuration 3 hours\n\nFollowing recent changes to the STP topology aimed at improving routing efficiency and preventing potential issues, we are now proceeding with the final step: disconnecting legacy distribution switches. This maintenance is necessary to complete the transition and fully apply the new, optimized network structure.\n\nThis maintenance will result in a brief network service outage, lasting approximately 1 minute per server, with a maximum possible duration of up to 5 minutes.\n\nAffected servers:\n\nDP-25397lax-cspgw\n\nIf you experience any issues that persist beyond the expected window, please don’t hesitate to contact our support team.\nExpected customer impact\n\nno customer impact\nExpected customer impact\n\nno customer impact\nExpected customer impact\n\nno customer impact\nExpected customer impact\nExpected customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nno customer impact\nChange type\nNormal\nChange type\nNormal\nChange type\nNormal\nChange type\nNormal\nChange type\nChange type\nNormal\nNormal\nPlanned start\nJun 30, 2025, 2:00 PM\nPlanned start\nJun 30, 2025, 2:00 PM\nPlanned start\nJun 30, 2025, 2:00 PM\nPlanned start\nJun 30, 2025, 2:00 PM\nPlanned start\nPlanned start\nJun 30, 2025, 2:00 PM\nJun 30, 2025, 2:00 PM\nPlanned end\nJun 30, 2025, 5:00 PM\nPlanned end\nJun 30, 2025, 5:00 PM\nPlanned end\nJun 30, 2025, 5:00 PM\nPlanned end\nJun 30, 2025, 5:00 PM\nPlanned end\nPlanned end\nJun 30, 2025, 5:00 PM\nJun 30, 2025, 5:00 PM\nImpact\nNon Service Affecting\nImpact\nNon Service Affecting\nImpact\nNon Service Affecting\nImpact\nNon Service Affecting\nImpact\nImpact\nNon Service Affecting\nNon Service Affecting\nChange risk\nMedium\nChange risk\nMedium\nChange risk\nMedium\nChange risk\nMedium\nChange risk\nChange risk\nMedium\nMedium\nTest plan\ncheck service functionality before, during and after the change\nTest plan\ncheck service functionality before, during and after the change\nTest plan\ncheck service functionality before, during and after the change\ncheck service functionality before, during and after the change\ncheck service functionality before, during and after the change\ncheck service functionality before, during and after the change\ncheck service functionality before, during and after the change\ncheck service functionality before, during and after the change\ncheck service functionality before, during and after the change\ncheck service functionality before, during and after the change\ncheck service functionality before, during and after the change\ncheck service functionality before, during and after the change\nImplementation plan\nno implementation on lolo side\nImplementation plan\nno implementation on lolo side\nImplementation plan\nno implementation on lolo side\nno implementation on lolo side\nno implementation on lolo side\nno implementation on lolo side\nno implementation on lolo side\nno implementation on lolo side\nno implementation on lolo side\nno implementation on lolo side\nno implementation on lolo side\nno implementation on lolo side\nBackout plan\nrollback\nBackout plan\nrollback\nBackout plan\nrollback\nrollback\nrollback\nrollback\nrollback\nrollback\nrollback\nrollback\nrollback\nrollback\nRisk summary\nChanges \nIncidents \nYou have one or more missing fields. Add Affected services to view all the risks. \nLearn more about the risk insights panel\nWe couldn't find any conflicts.\nRisk summary\nChanges \nIncidents \nYou have one or more missing fields. Add Affected services to view all the risks. \nLearn more about the risk insights panel\nWe couldn't find any conflicts.\nRisk summary\nChanges \nIncidents \nYou have one or more missing fields. Add Affected services to view all the risks. \nLearn more about the risk insights panel\nWe couldn't find any conflicts.\nRisk summary\nChanges \nIncidents\nIncidents\nYou have one or more missing fields. Add Affected services to view all the risks. \nLearn more about the risk insights panel\nWe couldn't find any conflicts.\nYou have one or more missing fields. Add Affected services to view all the risks. \nLearn more about the risk insights panel\nWe couldn't find any conflicts.\nYou have one or more missing fields. Add Affected services to view all the risks. \nLearn more about the risk insights panel\nWe couldn't find any conflicts.\nYou have one or more missing fields. Add Affected services to view all the risks. \nLearn more about the risk insights panel\nWe couldn't find any conflicts.\nActivity\nShow:\nAll\nComments\nHistory\nWork log\nApprovals\nSummarize 4 comments\nNewest first\nAdd internal note\n / \nReply to customer\nPro tip: press \nM\n to comment\nSilvia-Ioana Gonciulea \n2 days ago\n•\nInternal note\n\nactivity successfully implemented\n\nEdit\n·\nDelete\n·\n1\nHayam Ahmed \n2 days ago\n•\nInternal note\n\nHello \nplease keep us updated once this CR finished \nThank you\n\nEdit\n·\nDelete\n·\nDhiraj Kaushik \nlast month\n•\nInternal note\n\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\n\nEdit\n·\nDelete\n·\nReeta Nagarajan \nJune 23, 2025 at 2:51 PM\n•\nInternal note\n\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\n\nEdit\n·\nDelete\n·\nShow:\nAll\nComments\nHistory\nWork log\nApprovals\nSummarize 4 comments\nNewest first\nShow:\nAll\nComments\nHistory\nWork log\nApprovals\nShow:\nAll\nComments\nHistory\nWork log\nApprovals\nSummarize 4 comments\nNewest first\nNewest first\nNewest first\nAdd internal note\n / \nReply to customer\nPro tip: press \nM\n to comment\nAdd internal note\n / \nReply to customer\nPro tip: press \nM\n to comment\nAdd internal note\n / \nReply to customer\nPro tip: press \nM\n to comment\nAdd internal note\n / \nReply to customer\nAdd internal note\n / \nReply to customer\nSilvia-Ioana Gonciulea \n2 days ago\n•\nInternal note\n\nactivity successfully implemented\n\nEdit\n·\nDelete\n·\n1\nHayam Ahmed \n2 days ago\n•\nInternal note\n\nHello \nplease keep us updated once this CR finished \nThank you\n\nEdit\n·\nDelete\n·\nDhiraj Kaushik \nlast month\n•\nInternal note\n\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\n\nEdit\n·\nDelete\n·\nReeta Nagarajan \nJune 23, 2025 at 2:51 PM\n•\nInternal note\n\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\n\nEdit\n·\nDelete\n·\nSilvia-Ioana Gonciulea \n2 days ago\n•\nInternal note\n\nactivity successfully implemented\n\nEdit\n·\nDelete\n·\n1\nSilvia-Ioana Gonciulea \n2 days ago\n•\nInternal note\n\nactivity successfully implemented\n\nEdit\n·\nDelete\n·\n1\nSilvia-Ioana Gonciulea \n2 days ago\n•\nInternal note\n\nactivity successfully implemented\n\nEdit\n·\nDelete\n·\n1\nSilvia-Ioana Gonciulea \n2 days ago\n•\nInternal note\n\nactivity successfully implemented\n\nEdit\n·\nDelete\n·\n1\nSilvia-Ioana Gonciulea \n2 days ago\n•\nInternal note\n\nactivity successfully implemented\n\nEdit\n·\nDelete\n·\n1\nSilvia-Ioana Gonciulea \n2 days ago\n•\nInternal note\n\nactivity successfully implemented\nSilvia-Ioana Gonciulea\nSilvia-Ioana Gonciulea\nactivity successfully implemented\nactivity successfully implemented\nactivity successfully implemented\nactivity successfully implemented\nactivity successfully implemented\nactivity successfully implemented\nactivity successfully implemented\nactivity successfully implemented\nEdit\n·\nDelete\n·\n1\n1\n1\n1\n1\n1\n1\n1\n1\nHayam Ahmed \n2 days ago\n•\nInternal note\n\nHello \nplease keep us updated once this CR finished \nThank you\n\nEdit\n·\nDelete\n·\nHayam Ahmed \n2 days ago\n•\nInternal note\n\nHello \nplease keep us updated once this CR finished \nThank you\n\nEdit\n·\nDelete\n·\nHayam Ahmed \n2 days ago\n•\nInternal note\n\nHello \nplease keep us updated once this CR finished \nThank you\n\nEdit\n·\nDelete\n·\nHayam Ahmed \n2 days ago\n•\nInternal note\n\nHello \nplease keep us updated once this CR finished \nThank you\n\nEdit\n·\nDelete\n·\nHayam Ahmed \n2 days ago\n•\nInternal note\n\nHello \nplease keep us updated once this CR finished \nThank you\n\nEdit\n·\nDelete\n·\nHayam Ahmed \n2 days ago\n•\nInternal note\n\nHello \nplease keep us updated once this CR finished \nThank you\nHayam Ahmed\nHayam Ahmed\nHello \nplease keep us updated once this CR finished \nThank you\nHello \nplease keep us updated once this CR finished \nThank you\nHello \nplease keep us updated once this CR finished \nThank you\nHello \nplease keep us updated once this CR finished \nThank you\nHello \nplease keep us updated once this CR finished \nThank you\nHello \nplease keep us updated once this CR finished \nThank you\nHello \nplease keep us updated once this CR finished \nThank you\nHello \nplease keep us updated once this CR finished \nThank you\nEdit\n·\nDelete\n·\nDhiraj Kaushik \nlast month\n•\nInternal note\n\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\n\nEdit\n·\nDelete\n·\nDhiraj Kaushik \nlast month\n•\nInternal note\n\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\n\nEdit\n·\nDelete\n·\nDhiraj Kaushik \nlast month\n•\nInternal note\n\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\n\nEdit\n·\nDelete\n·\nDhiraj Kaushik \nlast month\n•\nInternal note\n\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\n\nEdit\n·\nDelete\n·\nDhiraj Kaushik \nlast month\n•\nInternal note\n\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\n\nEdit\n·\nDelete\n·\nDhiraj Kaushik \nlast month\n•\nInternal note\n\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\nDhiraj Kaushik\nDhiraj Kaushik\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\nSince we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.\nEdit\n·\nDelete\n·\nReeta Nagarajan \nJune 23, 2025 at 2:51 PM\n•\nInternal note\n\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\n\nEdit\n·\nDelete\n·\nReeta Nagarajan \nJune 23, 2025 at 2:51 PM\n•\nInternal note\n\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\n\nEdit\n·\nDelete\n·\nReeta Nagarajan \nJune 23, 2025 at 2:51 PM\n•\nInternal note\n\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\n\nEdit\n·\nDelete\n·\nReeta Nagarajan \nJune 23, 2025 at 2:51 PM\n•\nInternal note\n\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\n\nEdit\n·\nDelete\n·\nReeta Nagarajan \nJune 23, 2025 at 2:51 PM\n•\nInternal note\n\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\n\nEdit\n·\nDelete\n·\nReeta Nagarajan \nJune 23, 2025 at 2:51 PM\n•\nInternal note\n\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\nReeta Nagarajan\nReeta Nagarajan\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\nHi Silviya, \nI could find the planned start and end time as different in the description (12:00 PM to 3:00 pm) but in Planned start and Planned end time as 2:00 PM to 5:00 PM. Could you please clarify which time the maintenance will be executed on 30th June. Thank you\nEdit\n·\nDelete\n·\nResize issue view side panel\nResize issue view side panel\nGive feedback\n5\nDone\nDone\nActions\nCustomer\nCustomer details\nSilvia-Ioana Gonciulea\nDetails\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nMore fields\nApprovers, Labels, Organizations, Team\nAutomation\nRule executions\nCreated June 21, 2025 at 6:11 PM\nUpdated 2 days ago\nResolved 2 days ago\nGive feedback\n5\nDone\nDone\nActions\nCustomer\nCustomer details\nSilvia-Ioana Gonciulea\nDetails\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nMore fields\nApprovers, Labels, Organizations, Team\nAutomation\nRule executions\nCreated June 21, 2025 at 6:11 PM\nUpdated 2 days ago\nResolved 2 days ago\nGive feedback\n5\nGive feedback\n5\nGive feedback\n5\nGive feedback\nGive feedback\nGive feedback\nGive feedback\n5\n5\n5\n5\n5\n5\nDone\nDone\nActions\nCustomer\nCustomer details\nSilvia-Ioana Gonciulea\nDetails\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nMore fields\nApprovers, Labels, Organizations, Team\nAutomation\nRule executions\nCreated June 21, 2025 at 6:11 PM\nUpdated 2 days ago\nResolved 2 days ago\nDone\nDone\nActions\nDone\nDone\nActions\nDone\nDone\nActions\nDone\nDone\nDone\nDone\nDone\nDone\nDone\nDone\nDone\nActions\nCustomer\nCustomer details\nSilvia-Ioana Gonciulea\nCustomer\nCustomer\nCustomer\nCustomer details\nSilvia-Ioana Gonciulea\nCustomer details\nSilvia-Ioana Gonciulea\nCustomer details\nSilvia-Ioana Gonciulea\nSilvia-Ioana Gonciulea\nSilvia-Ioana Gonciulea\nSilvia-Ioana Gonciulea\nDetails\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nMore fields\nApprovers, Labels, Organizations, Team\nDetails\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nMore fields\nApprovers, Labels, Organizations, Team\nDetails\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nDetails\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nDetails\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nDetails\nDetails\nDetails\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nAssignee\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest participants\nNone\nAffected services\nAdd service\nActual start\nNone\nActual end\nNone\nCustomer External Issue ID\nCHG000000175220\nInternal change notification\nNone\nAssignee\nUnassigned\nAssign to me\nAssignee\nUnassigned\nAssign to me\nAssignee\nUnassigned\nAssign to me\nAssignee\nAssignee\nUnassigned\nAssign to me\nUnassigned\nAssign to me\nUnassigned\nUnassigned\nAssign to me\nReporter\nSilvia-Ioana Gonciulea\nReporter\nSilvia-Ioana Gonciulea\nReporter\nSilvia-Ioana Gonciulea\nReporter\nReporter\nSilvia-Ioana Gonciulea\nSilvia-Ioana Gonciulea\nSilvia-Ioana Gonciulea\nSilvia-Ioana Gonciulea\nSilvia-Ioana Gonciulea\nSilvia-Ioana Gonciulea\nRequest Type\nLolo - Change\nRequest Type\nLolo - Change\nRequest Type\nLolo - Change\nRequest Type\nRequest Type\nLolo - Change\nLolo - Change\nLolo - Change\nLolo - Change\nLolo - Change\nLolo - Change\nLolo - Change\nLolo - Change\nLolo - Change\nRequest participants\nNone\nRequest participants\nNone\nRequest participants\nNone\nRequest participants\nRequest participants\nNone\nNone\nNone\nNone\nNone\nNone\nNone\nAffected services\nAdd service\nAffected services\nAdd service\nAffected services\nAdd service\nAffected services\nAdd service\nAffected services\nAdd service\nAffected services\nActual start\nNone\nActual start\nNone\nActual start\nNone\nActual start\nNone\nActual start\nActual start\nNone\nNone\nActual end\nNone\nActual end\nNone\nActual end\nNone\nActual end\nNone\nActual end\nActual end\nNone\nNone\nCustomer External Issue ID\nCHG000000175220\nCustomer External Issue ID\nCHG000000175220\nCustomer External Issue ID\nCHG000000175220\nCustomer External Issue ID\nCHG000000175220\nCustomer External Issue ID\nCustomer External Issue",
  "FRA PGW Hard failover test": "Silvia-Ioana Gonciulea",
  "Filters": "Dashboards",
  "Hayam Ahmed": "Unassigned",
  "Implementation plan": "no implementation on lolo side",
  "Isac Jinton": "Unassigned",
  "Jira": "View request in portal",
  "Jun 30, 2025, 2:00 PM": "Planned end\nJun 30, 2025, 5:00 PM",
  "Jun 30, 2025, 5:00 PM": "Impact\nNon Service Affecting",
  "KDDI API User": "Unassigned",
  "Key": "Summary",
  "Khwaja Rahman": "Unassigned",
  "Link web pages and more": "Schedule change",
  "Lolo - Change": "SP-313",
  "Medium": "Test plan\ncheck service functionality before, during and after the change",
  "More": "193 work items",
  "Non Service Affecting": "Change risk\nMedium",
  "None": "More fields\nApprovers, Labels, Organizations, Team",
  "Normal": "Planned start\nJun 30, 2025, 2:00 PM",
  "Partner Change": "SP-330",
  "Partner Incident Email": "SP-331",
  "Planned and Unplanned Maintenance for the next 14 days": "KDDI API User",
  "Poor Verizon service quality in roaming partner coverage location": "Khwaja Rahman",
  "Priority group": "Default\n4 queues\nAll open\n19\nAssigned to me\n0\nUnassigned\n13\nResolved\n193",
  "Projects": "Filters",
  "ProjectsSpherience PartnerQueues": "Resolved",
  "ProjectsSpherience PartnerQueuesResolved": "ProjectsSpherience PartnerQueues",
  "Queues": "Starred\nSelect the star icon next to your queues to add them here.",
  "Reeta Nagarajan": "Unassigned",
  "Reporter": "Assignee",
  "Request Type": "Key",
  "Request type": "Status",
  "Request typeStatusAssigneeMore193 work items": "Request typeStatusAssigneeMore",
  "Request typeStatusAssigneeMore193 work itemsTriage": "Request typeStatusAssigneeMore193 work items",
  "Resolved": "18/Jun/25",
  "Risk summary": "Changes",
  "SC9709110": "Lolo - Change\n    \n\nSP-339Bringing down Amsterdam PGWIsac JintonUnassignedDone 24/Jun/25  25/Jun/25",
  "Schedule change": "Add form",
  "Silvia-Ioana Gonciulea": "Unassigned",
  "Since we are Live on 27th and this Change is planned for 30th June, Please monitor this closely to make sure there is no impact on the services in US.": "Edit\n·\nDelete\n·",
  "Starred": "Priority group\nDefault\n4 queues\nAll open\n19\nAssigned to me\n0\nUnassigned\n13\nResolved\n193",
  "Status": "Created",
  "Summarize 4 comments": "Newest first",
  "Summary": "Reporter",
  "Teams": "Assets",
  "Test plan": "check service functionality before, during and after the change",
  "Thingspace not working": "Hayam Ahmed",
  "Time to resolution": "Updated",
  "Unify API update, AAA radius update, DNS proxy": "Isac Jinton",
  "Updated": "External Issue ID",
  "Updated 2 days ago": "Resolved 2 days ago",
  "Verizon - Wireless - Incident": "SP-318",
  "Your work": "Projects"
}

let itsm_page_strings = {
  "page_elements": {
    "user_menu": { "class": "header-avatar-button contextual-zone-button user-menu", "role": "button", "data-id": "user-menu" }, // aria-label="Shooresh Sufiye FG-843 (ext.): Available"    data-tooltip="Shooresh Sufiye FG-843 (ext.): Available"
  },
  "cr": {
    "short description": "change_request.short_description",
    "description": "change_request.description",
    "service": "change_request.business_service_label",
    "Configuration item": "change_request.cmdb_ci_label",

  },
  "inc": {
    "caller": "sys_display.incident.caller_id",
    "orginator_group": "sys_display.incident.u_originator_group", // FT_cdmno25kddi
    "service": "sys_display.incident.business_service_label", // Mobile Network, Connected Car
    "service_offering": "sys_display.incident.service_offering", // cdmno25kddi#us cdmno25kddi#ca
    "short description": "sys_readonly.incident.short_description",
    "description": "sys_readonly.incident.description",
  }
}

console.log("✅ Content script loaded");
