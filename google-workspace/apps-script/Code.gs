/**
 * Sanitized reference implementation.
 *
 * Replace all placeholder configuration values before use.
 * Do not commit production meeting links, participant data, OAuth secrets,
 * or private calendar information.
 */

const CONFIG = {
  PASS_MARK: 4,
  TOTAL_MARKS: 5,

  EVENT_TITLE: "YOUR_EVENT_TITLE",
  MEET_LINK: "YOUR_GOOGLE_MEET_URL",

  SESSION_DATE: "YOUR_SESSION_DATE",
  SESSION_TIME: "YOUR_SESSION_TIME",

  EVENT_SEARCH_START: "YYYY-MM-DDTHH:MM:SS+05:30",
  EVENT_SEARCH_END: "YYYY-MM-DDTHH:MM:SS+05:30",

  REMINDER_TIME: "YYYY-MM-DDTHH:MM:SS+05:30",
  FORM_CLOSE_TIME: "YYYY-MM-DDTHH:MM:SS+05:30"
};

const ANSWERS = {
  "Which Linux command shows the current working directory?": "pwd",
  "Which command is commonly used to test whether a remote host is reachable over an IP network?": "ping",
  "What is the main purpose of DNS?": "Translate domain names into IP addresses",
  "Which protocol provides reliable, connection-oriented transport?": "TCP",
  "What is the default port for HTTPS?": "443"
};

function onFormSubmit(e) {
  if (!e || !e.namedValues || !e.range) {
    throw new Error(
      "This function must run using the spreadsheet On form submit trigger."
    );
  }

  const values = e.namedValues;
  const sheet = e.range.getSheet();
  const row = e.range.getRow();

  saveProjectReferences_(sheet.getParent());

  const name =
    getNamedValue(values, "Full Name") ||
    "Participant";

  const email =
    (
      getNamedValue(values, "Email address") ||
      getNamedValue(values, "Email Address") ||
      getNamedValue(values, "Email")
    ).trim();

  if (!email) {
    throw new Error("Candidate email address could not be found.");
  }

  let score = 0;

  Object.keys(ANSWERS).forEach(question => {
    const submitted = getNamedValue(values, question);
    const expected = ANSWERS[question];

    if (normalize(submitted) === normalize(expected)) {
      score++;
    }
  });

  const qualified = score >= CONFIG.PASS_MARK;

  setResult(
    sheet,
    row,
    "Eligibility Score",
    `${score}/${CONFIG.TOTAL_MARKS}`
  );

  setResult(
    sheet,
    row,
    "Eligibility Result",
    qualified ? "QUALIFIED" : "NOT QUALIFIED"
  );

  if (qualified) {
    const event = findSessionEvent();
    const guests = event.getGuestList();

    const alreadyInvited = guests.some(
      guest =>
        guest.getEmail().toLowerCase() ===
        email.toLowerCase()
    );

    if (!alreadyInvited) {
      event.addGuest(email);
      setResult(sheet, row, "Invite Sent", "YES");
    } else {
      setResult(sheet, row, "Invite Sent", "ALREADY INVITED");
    }

    sendQualifiedEmail(name, email, score);
  } else {
    setResult(sheet, row, "Invite Sent", "NO");
    sendNotQualifiedEmail(name, email, score);
  }

  setResult(sheet, row, "Processed At", new Date());
}

function findSessionEvent() {
  const start = new Date(CONFIG.EVENT_SEARCH_START);
  const end = new Date(CONFIG.EVENT_SEARCH_END);

  const events =
    CalendarApp
      .getDefaultCalendar()
      .getEvents(start, end);

  const matches =
    events.filter(
      event =>
        event.getTitle().trim() ===
        CONFIG.EVENT_TITLE.trim()
    );

  if (matches.length === 0) {
    throw new Error(
      "Calendar event not found. Check EVENT_TITLE and event time."
    );
  }

  if (matches.length > 1) {
    throw new Error(
      "More than one Calendar event with the same title was found."
    );
  }

  return matches[0];
}

function sendQualifiedEmail(name, email, score) {
  const subject =
    "You qualified – Live Session";

  const body =
`Hi ${name},

Congratulations!

You scored ${score}/${CONFIG.TOTAL_MARKS} and qualified for the live session.

Date:
${CONFIG.SESSION_DATE}

Time:
${CONFIG.SESSION_TIME}

Online meeting:
${CONFIG.MEET_LINK}

A Calendar invitation has also been sent to your registered email address.

Regards,
Event Team`;

  MailApp.sendEmail(email, subject, body);
}

function sendNotQualifiedEmail(name, email, score) {
  const subject =
    "Eligibility Result";

  const body =
`Hi ${name},

Thank you for completing the eligibility test.

Your score was ${score}/${CONFIG.TOTAL_MARKS}.

The qualifying score is ${CONFIG.PASS_MARK}/${CONFIG.TOTAL_MARKS}.

Regards,
Event Team`;

  MailApp.sendEmail(email, subject, body);
}

function sendQualifiedCandidateReminder() {
  const sheet = getResponseSheet_();
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return;
  }

  const headers = data[0];

  const emailColumn =
    findHeaderIndex_(
      headers,
      ["Email address", "Email Address", "Email"]
    );

  const nameColumn =
    findHeaderIndex_(
      headers,
      ["Full Name"]
    );

  const resultColumn =
    findHeaderIndex_(
      headers,
      ["Eligibility Result"]
    );

  let reminderColumn =
    headers.indexOf("Reminder Sent");

  if (reminderColumn === -1) {
    reminderColumn = headers.length;

    sheet
      .getRange(1, reminderColumn + 1)
      .setValue("Reminder Sent");
  }

  for (let i = 1; i < data.length; i++) {
    const email =
      String(data[i][emailColumn] || "").trim();

    const name =
      String(data[i][nameColumn] || "Participant").trim();

    const result =
      String(data[i][resultColumn] || "").trim();

    const alreadySent =
      String(data[i][reminderColumn] || "").trim();

    if (
      result === "QUALIFIED" &&
      email &&
      alreadySent !== "YES"
    ) {
      const subject =
        "Reminder – Live Session";

      const body =
`Hi ${name},

This is a reminder for your upcoming live session.

Date:
${CONFIG.SESSION_DATE}

Time:
${CONFIG.SESSION_TIME}

Online meeting:
${CONFIG.MEET_LINK}

Regards,
Event Team`;

      MailApp.sendEmail(email, subject, body);

      sheet
        .getRange(i + 1, reminderColumn + 1)
        .setValue("YES");
    }
  }
}

function closeRegistrationForm() {
  const properties =
    PropertiesService.getScriptProperties();

  let formUrl =
    properties.getProperty("FORM_URL");

  if (!formUrl) {
    const spreadsheet =
      SpreadsheetApp.getActiveSpreadsheet();

    if (spreadsheet) {
      formUrl = spreadsheet.getFormUrl();

      if (formUrl) {
        properties.setProperty("FORM_URL", formUrl);
      }
    }
  }

  if (!formUrl) {
    throw new Error(
      "Google Form URL could not be found."
    );
  }

  const form =
    FormApp.openByUrl(formUrl);

  form.setAcceptingResponses(false);

  form.setCustomClosedFormMessage(
    "Registration for this live session is now closed."
  );
}

function setupSessionAutomationTriggers() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      "Open this script from the response spreadsheet before running setup."
    );
  }

  saveProjectReferences_(spreadsheet);

  // Recreate only the two scheduled triggers.
  // Keep the existing onFormSubmit trigger untouched.
  ScriptApp
    .getProjectTriggers()
    .forEach(trigger => {
      const handler = trigger.getHandlerFunction();

      if (
        handler === "sendQualifiedCandidateReminder" ||
        handler === "closeRegistrationForm"
      ) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

  ScriptApp
    .newTrigger("sendQualifiedCandidateReminder")
    .timeBased()
    .at(new Date(CONFIG.REMINDER_TIME))
    .create();

  ScriptApp
    .newTrigger("closeRegistrationForm")
    .timeBased()
    .at(new Date(CONFIG.FORM_CLOSE_TIME))
    .create();
}

function saveProjectReferences_(spreadsheet) {
  const properties =
    PropertiesService.getScriptProperties();

  properties.setProperty(
    "SPREADSHEET_ID",
    spreadsheet.getId()
  );

  const formUrl = spreadsheet.getFormUrl();

  if (formUrl) {
    properties.setProperty(
      "FORM_URL",
      formUrl
    );
  }
}

function getResponseSheet_() {
  const properties =
    PropertiesService.getScriptProperties();

  const spreadsheetId =
    properties.getProperty("SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error(
      "Spreadsheet ID not saved. Run setupSessionAutomationTriggers once."
    );
  }

  const spreadsheet =
    SpreadsheetApp.openById(spreadsheetId);

  const sheets = spreadsheet.getSheets();

  for (const sheet of sheets) {
    if (sheet.getLastColumn() === 0) {
      continue;
    }

    const headers =
      sheet
        .getRange(
          1,
          1,
          1,
          sheet.getLastColumn()
        )
        .getValues()[0];

    if (
      headers.includes("Eligibility Result") &&
      (
        headers.includes("Email address") ||
        headers.includes("Email Address") ||
        headers.includes("Email")
      )
    ) {
      return sheet;
    }
  }

  throw new Error(
    "Form response sheet could not be found."
  );
}

function getNamedValue(values, heading) {
  if (!values[heading]) {
    return "";
  }

  const value = values[heading];

  return Array.isArray(value)
    ? String(value[0] || "")
    : String(value);
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function setResult(sheet, row, heading, value) {
  const lastColumn = sheet.getLastColumn();

  const headers =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0];

  let column =
    headers.indexOf(heading) + 1;

  if (column === 0) {
    column = lastColumn + 1;

    sheet
      .getRange(1, column)
      .setValue(heading);
  }

  sheet
    .getRange(row, column)
    .setValue(value);
}

function findHeaderIndex_(headers, possibleNames) {
  for (const name of possibleNames) {
    const index = headers.indexOf(name);

    if (index !== -1) {
      return index;
    }
  }

  throw new Error(
    "Required column not found: " +
    possibleNames.join(", ")
  );
}
