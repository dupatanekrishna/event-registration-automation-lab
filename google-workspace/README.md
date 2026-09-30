# Google Workspace Implementation

This folder documents the implementation that was built for the event-registration automation lab.

## Components

- **Google Forms** — registration and 5-question eligibility quiz
- **Google Sheets** — response data and workflow state
- **Google Apps Script** — automation logic
- **Google Calendar** — event and attendee management
- **Google Meet** — meeting join details
- **MailApp** — pass/fail and reminder emails

## End-to-end flow

```text
Participant
   ↓
Google Form
   ↓
Google Sheet
   ↓
onFormSubmit()
   ↓
Calculate 5-question score
   ↓
Score >= 4?
   ├── NO
   │    ├── Eligibility Result = NOT QUALIFIED
   │    ├── Invite Sent = NO
   │    └── Result email
   │
   └── YES
        ├── Eligibility Result = QUALIFIED
        ├── Find Calendar event
        ├── Check whether guest already exists
        ├── Add guest if needed
        ├── Invite Sent = YES / ALREADY INVITED
        └── Qualification email
```

## Quiz behavior

The final script matches each submitted answer using the **exact Google Form question title**.

This means:

- quiz questions may be shuffled
- answer choices may be shuffled
- scoring does not rely on Q1/Q2/Q3 numbering
- scoring does not rely on spreadsheet column position

Do not rename a quiz question without updating the `ANSWERS` object in the script.

## Scheduled automation

Two time-driven jobs are added:

### Reminder

`sendQualifiedCandidateReminder()`

- scans the response sheet
- selects only `Eligibility Result = QUALIFIED`
- skips rows where `Reminder Sent = YES`
- sends the session reminder
- writes `Reminder Sent = YES`

### Registration close

`closeRegistrationForm()`

- resolves the linked Google Form
- calls `setAcceptingResponses(false)`
- displays a registration-closed message

## Trigger bootstrap

Run this once manually:

```javascript
setupSessionAutomationTriggers()
```

It creates only the reminder and registration-close triggers. It intentionally leaves the existing `onFormSubmit` trigger untouched.

## Testing

### PASS test

Use 5 correct answers.

Expected:

```text
Eligibility Score = 5/5
Eligibility Result = QUALIFIED
Invite Sent = YES
Qualification email = received
Calendar invitation = received
```

### FAIL test

Use 3 correct answers.

Expected:

```text
Eligibility Score = 3/5
Eligibility Result = NOT QUALIFIED
Invite Sent = NO
Result email = received
Calendar invitation = not sent
```

## Production notes

- Keep project timezone aligned with the event timezone.
- Do not manually run `onFormSubmit()`; it expects a real form event object.
- Do not manually run `closeRegistrationForm()` before the deadline.
- Test with a secondary Google account to validate real attendee behavior.
- Use a non-production meeting link in source control.
