
import { formatData } from './background.js';

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
    "service": "incident.business_service_label", // Mobile Network, Connected Car
    "service_offering": "sys_display.incident.service_offering", // cdmno25kddi#us cdmno25kddi#ca
    "short description": "sys_readonly.incident.short_description",
    "description": "sys_readonly.incident.description",
  }
}

let example_gpt_cr_response = {
  "ticketSummary": "Datapacket Planned emergency maintenance in Los Angeles on Jun 30, 2025",
  "shortSummary": "[CD][KDDI][Country][Network][Service] Short Description of the Issue",
  "ticketDetails": {
    "requestType": "Lolo - Change",
    "ticketType": "Change Request",
    "priority": "Non Service Affecting",
    "country": "USA",
    "description": "Impact: Up to 5 minutes of network service outage per server, with a maximum duration of up to 5 minutes...",
    "plannedStart": "Jun 30, 2025, 2:00 PM",
    "plannedEnd": "Jun 30, 2025, 5:00 PM",
    "riskLevel": "Medium",
    "testPlan": "Check service functionality before, during and after the change",
    "backupPlan": "Rollback",
    "additionalNotes": "Please keep us updated once this Change Request is finished."
  }
}

let example_gpt_incident_response = {
  "ticketSummary": "Datapacket Planned emergency maintenance in Los Angeles on Jun 30, 2025",
  "shortSummary": "[CD][KDDI][Country][Network][Service][SP:xx] Short Description of the Issue###Outage/NoOutage###",
  "ticketDetails": {
    "requestType": "Lolo - Change",
    "ticketType": "Change Request",
    "priority": "Non Service Affecting",
    "country": "USA",
    "description": "Impact: Up to 5 minutes of network service outage per server, with a maximum duration of up to 5 minutes...",
    "plannedStart": "Jun 30, 2025, 2:00 PM",
    "plannedEnd": "Jun 30, 2025, 5:00 PM",
    "riskLevel": "Medium",
    "testPlan": "Check service functionality before, during and after the change",
    "backupPlan": "Rollback",
    "additionalNotes": "Please keep us updated once this Change Request is finished."
  }
}

function showWarningIcon() {
  const icon = document.getElementById('warning-icon');
  icon.style.display = 'inline';

  setTimeout(() => {
    icon.style.display = 'none';
  }, 2000);
}

function showSuccessIcon() {
  const icon = document.getElementById('success-icon');
  icon.style.display = 'inline';
  setTimeout(() => {
    icon.style.display = 'none';
  }, 2000);
}

function showLoadingIcon() {
  const icon = document.getElementById('loading-icon');
  icon.style.display = 'inline';
  setTimeout(() => {
    icon.style.display = 'none';
  }, 2000);
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

function preparePopupForm(data) {
  const form = document.getElementById('helper-form');
  if (!form) {
    console.error('Form element not found');
    return;
  }

  ticketTypeEl = document.getElementById('ticket-type');
  countryEl = document.getElementById('country');
  mnoEl = document.getElementById('mno');
  ServiceTypeEl = document.getElementById('type_of_service');

  if (data.ticketDetails.requestType) {
    if (data.ticketDetails.requestType.includes('Change')) {
      ticketTypeEl.value = 'Change Request';
    } else if (data.ticketDetails.requestType.includes('Incident')) {
      ticketTypeEl.value = 'Incident';
    }

    if (data.ticketDetails.requestType.includes('VZW')) {
      mnoEl.value = 'VZW';
      countryEl.value = 'usa';
    } else if (data.ticketDetails.requestType.includes('Telus')) {
      mnoEl.value = 'Telus';
      countryEl.value = 'ca';
    }
    else if (data.ticketDetails.requestType.includes('LOLO')) {
      mnoEl.value = 'LOLO';
      countryEl.value = 'usa';
    }
    else if (data.ticketDetails.requestType.includes('SEGRA')) {
      mnoEl.value = 'SEGRA';
      countryEl.value = 'ca';
    }

  }



}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[popup] msg: ", request);
  if (request.action === "block") {
    console.warn("[popup] Block message received", request.reason);
    chrome.storage.local.set({ orgUser: false });
    // disable your UI, show warning
    document.body.innerHTML = "<p>🚫 Access blocked. You are not allowed to use this extension.</p>";
  }

  else if (request.action === 'extractedData') {
    console.log('Data extracted', request.data);
    preparePopupForm(request.data);
    if (request.data.Back) {
      jiraId.textContent = request.data.Back || '-';
      console.log('Jira ID set:', jiraId.textContent);
    } else {
      jiraId.textContent = '-';
      showWarningIcon();
      console.log('Jira ID reset');
    }
  }

  else if (request.action === 'showWarningIcon') {
    showWarningIcon();
  }
});

console.log('Listener for showWarningIcon added');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[popup] script loaded');
  const { orgUser } = await chrome.storage.local.get("orgUser");

  if (!orgUser) {
    document.body.innerHTML = "<p>🚫 Access blocked. You are not allowed to use this extension.</p>";
    console.log("USER IS NOOT ALLOWED");
    return;
  }

  const readButton = document.querySelector("#read-data");
  const pasteButton = document.querySelector("#paste-data");
  const selector = document.querySelector("#selector");
  const jiraId = document.querySelector("#jira-id-value");

  selector.addEventListener('click', async () => {
    console.log('[popup] SELECTOR pressed', window.location.hostname);

    const isValid = await isValidUrl();
    console.log('[popup] is valid URL:', isValid);
    if (!isValid) {
      console.log('[popup] This feature is only available for Atlassian and ServiceNow domains.');
      showWarningIcon();
      return;
    }

    showLoadingIcon();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log("[popup] tab ", tab);
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'startPickerMode' });
      console.log("[popup] Response:", resp);
    } catch (e) {
      console.log("No content script in this tab:", e);
    }
  });

  // readButton.addEventListener('click', async function () {
  //   console.log('COPY pressed');

  //   const valid = await isValidUrl();
  //   console.log('is valid URL:', valid);
  //   if (!valid) {
  //     console.log('This feature is only available for Atlassian and ServiceNow domains.');
  //     showWarningIcon();
  //     return;
  //   }

  //   chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {

  //     const activeTab = tabs[0];
  //     console.log('Active tab ID:', activeTab.id);
  //     console.log('sending :', { action: 'extractTicketData' });
  //     await chrome.tabs.sendMessage(activeTab.id, { action: 'extractTicketData' }, function (response) {
  //       if (response) {
  //         showSuccessIcon();
  //         console.log('✅ Data received:', typeof response);
  //         chrome.storage.local.set({ ticketData: response });
  //       } else {
  //         console.log('No corrcect data received: ', response);
  //       }
  //     });
  //   });
  // });

  pasteButton.addEventListener('click', async function () {
    console.log('[popup] Pasting data into destination tabs...');

    const valid = await isValidUrl();
    console.log('[popup] is valid URL:', valid);
    if (!valid) {
      console.log('This feature is only available for Atlassian and ServiceNow domains.');
      showWarningIcon();
      return;
    }

    showLoadingIcon();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id,
      { action: 'pasteTicketData' },
      (response) => {
        if (response.status && response.status !== 'success') {
          console.warn('[popup] Error pasting data: something went wrong!');
          showWarningIcon();
        } else {
          console.log('[popup] Data pasted successfully:', response);
          showSuccessIcon();
        }
      });

  });
});

console.log("[popup] loaded");
