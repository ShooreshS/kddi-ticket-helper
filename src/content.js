

console.log('✅ Content script loaded into:', window.location.href);

async function extractJiraTicketData() {
  console.log('🔍 Extracting Jira ticket data...');
  const allDivs = [...document.querySelectorAll("div")];
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

  return result;
}
// Picker
let hoverBox = null;
let lastTarget = null;

function startPickerMode() {
  // Create a highlight box overlay
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

function onClick(e) {
  e.preventDefault();
  e.stopPropagation();

  const selected = e.target;
  const data = selected.innerText || selected.textContent || '';

  console.log("🟢 Selected element data:", data);

  // Clean up
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('click', onClick, true);
  hoverBox?.remove();
  hoverBox = null;
  lastTarget = null;

  chrome.runtime.sendMessage({ action: 'extractedData', data });
}

// Listener from popup
chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    console.log('[content] Received message:', request);
    if(window.location.hostname.includes(".atlassian.net") || window.location.hostname.includes(".service-now.com")) {
    
      if (request.action === 'startPickerMode') {
          startPickerMode();
      }

      if (request.action === "extractTicketData") {
          console.log('[content] Extracting ticket data from the page...');
          const data = await extractJiraTicketData();
          sendResponse(data);
      }

      if (request.action === 'fillForm') {
          const ticketData = request.data;

          // Assuming the form has specific fields to fill
          document.querySelector('#ticketTitle').value = ticketData.title;
          document.querySelector('#ticketDescription').value = ticketData.description;
          document.querySelector('#ticketType').value = ticketData.type;

          // Create subtasks based on the predefined table
          const subtasks = getSubtasks(ticketData.type);
          const subtaskContainer = document.querySelector('#subtaskContainer');
          subtaskContainer.innerHTML = ''; // Clear existing subtasks

          subtasks.forEach(subtask => {
              const subtaskElement = document.createElement('div');
              subtaskElement.textContent = subtask;
              subtaskContainer.appendChild(subtaskElement);
          });
      }

    } else {
        console.warn('[content] Not a Jira page, ignoring message');
        return;    
    }      
});

function getSubtasks(ticketType) {
    // This function should retrieve subtasks based on the ticket type
    // For now, returning a placeholder array
    return ['Subtask 1 for ' + ticketType, 'Subtask 2 for ' + ticketType];
}


example_extracted_data_by_extractJiraTicketData = {
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

itsm_page_strings = {
  "short description": "change_request.short_description",
  "description": "change_request.description",
  "service": "change_request.business_service_label",
  "Configuration item": "change_request.cmdb_ci_label",

}

console.log("Content script loaded");