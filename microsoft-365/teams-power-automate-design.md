# Microsoft 365 / Teams Equivalent Design

This document describes the expected steps for reproducing the Google Workspace event-registration automation using Microsoft 365.

> Status: **design / expected implementation**, not yet implemented in this repository.

## Target stack

| Google implementation | Microsoft equivalent |
|---|---|
| Google Forms | Microsoft Forms |
| Google Sheets | Excel Online or SharePoint List |
| Apps Script | Power Automate |
| Gmail / MailApp | Outlook |
| Google Calendar | Outlook Calendar |
| Google Meet | Microsoft Teams |
| Time-driven Apps Script triggers | Scheduled Power Automate flows |

---

## Desired behavior

The Microsoft implementation should provide the same business flow:

```text
Candidate registration
→ 5-question fundamentals test
→ automatic eligibility decision
→ pass/fail state stored
→ qualified candidate receives email
→ qualified candidate receives Teams/Calendar invitation
→ reminder is sent before the session
→ registration closes at the configured deadline
```

---

## Step 1 — Create the Microsoft Form

Create a Microsoft Form or Quiz with:

- Full Name
- Email Address
- Mobile Number
- 5 multiple-choice fundamentals questions

Use the same rule:

```text
4/5 or 5/5 = QUALIFIED
0/5 to 3/5 = NOT QUALIFIED
```

Recommended form settings:

- require all fields
- avoid exposing correct answers immediately
- restrict repeated attempts when appropriate
- shuffle questions/options if desired
- decide whether external users are allowed based on tenant policy

---

## Step 2 — Create the Teams meeting / Outlook event

Create the event in Outlook Calendar and enable a Teams meeting.

The event should contain:

- event title
- start/end time
- Teams join details
- description
- organizer
- default reminder settings

The automation should reference this event or create attendee-specific invitations.

---

## Step 3 — Create the Power Automate response flow

Create an **Automated cloud flow**.

Expected trigger:

```text
Microsoft Forms
→ When a new response is submitted
```

Next action:

```text
Microsoft Forms
→ Get response details
```

The response details become the input to the eligibility logic.

---

## Step 4 — Calculate the score

Two common approaches are possible.

### Option A — Use quiz score

If the Forms/Power Automate combination exposes the required score reliably, use that value.

### Option B — Evaluate answers in the flow

For maximum control, compare each submitted answer with the expected answer and increment a score variable.

Conceptual logic:

```text
score = 0

if answer1 is correct → score + 1
if answer2 is correct → score + 1
if answer3 is correct → score + 1
if answer4 is correct → score + 1
if answer5 is correct → score + 1
```

Then:

```text
if score >= 4
    QUALIFIED
else
    NOT QUALIFIED
```

This mirrors the Google Apps Script implementation.

---

## Step 5 — Store workflow state

Use either:

- **SharePoint List** — recommended for a durable workflow/state model
- **Excel Online table** — suitable for a small lab

Suggested fields:

```text
Timestamp
Full Name
Email
Mobile Number
Score
Eligibility Result
Invite Sent
Reminder Sent
Processed At
```

SharePoint is generally a cleaner choice if the workflow later grows into approvals, reporting, or multi-user operations.

---

## Step 6 — PASS branch

Power Automate condition:

```text
Score >= 4
```

Expected actions:

1. Set `Eligibility Result = QUALIFIED`
2. Check whether an invitation was already sent
3. Add/send the Outlook Calendar event invitation with Teams meeting details
4. Set `Invite Sent = YES`
5. Send a qualification email

Qualification email should contain:

- participant name
- score
- event date/time
- Teams meeting details or calendar invitation instructions
- joining guidance

### Duplicate protection

Before creating/sending another invitation, check the stored workflow state.

Example:

```text
Invite Sent == YES
    → skip invitation
Invite Sent != YES
    → send invitation
```

This is the Power Automate equivalent of the Google Calendar guest-list duplicate check.

---

## Step 7 — FAIL branch

Expected actions:

1. Set `Eligibility Result = NOT QUALIFIED`
2. Set `Invite Sent = NO`
3. Send a result email
4. Do not add the candidate to the Teams meeting

The failure email may include:

- candidate score
- qualifying score
- recommendation to review fundamentals
- future-session information if desired

---

## Step 8 — Reminder automation

Create a second **Scheduled cloud flow**.

Example schedule:

```text
10 October
11:00 AM
Event timezone
```

The flow should:

1. Read stored registrations
2. Filter:
   ```text
   Eligibility Result = QUALIFIED
   AND
   Reminder Sent != YES
   ```
3. Send Outlook reminder email
4. Update:
   ```text
   Reminder Sent = YES
   ```

This prevents duplicate reminders.

---

## Step 9 — Registration cutoff

Desired deadline:

```text
10 October
11:59 PM
```

There are two design choices.

### Approach A — Close the form directly

If the tenant/API/connector capabilities available to the implementation permit updating the Form's response-acceptance state, schedule that action at the deadline.

### Approach B — Enforce the deadline in Power Automate

If direct form closure is not available in the chosen connector path:

1. keep a configured deadline value
2. check submission time in the response flow
3. if submission time is later than the deadline:
   - mark it `REGISTRATION CLOSED / LATE`
   - do not evaluate it for attendance
   - do not send a Teams invitation

This gives a reliable backend cutoff even if the public form URL still opens.

An optional manual or administrative step can then disable the Form UI.

---

## Step 10 — Test the Microsoft flow

### PASS test

Submit all or at least 4 correct answers.

Expected:

```text
Score >= 4
QUALIFIED
Invite Sent = YES
Outlook qualification email received
Teams/Outlook calendar invitation received
```

### FAIL test

Submit 3 or fewer correct answers.

Expected:

```text
Score <= 3
NOT QUALIFIED
Invite Sent = NO
Result email received
No Teams invitation
```

### Duplicate test

Replay/reprocess the same qualified participant.

Expected:

```text
No second invitation
No unintended duplicate workflow state
```

### Reminder test

Use a temporary test schedule.

Expected:

```text
Only QUALIFIED participants receive reminder
Reminder Sent = YES after success
```

### Deadline test

Use a temporary test deadline.

Expected:

```text
Late registration does not result in a Teams invitation
```

---

## Suggested Power Automate flow layout

```text
FLOW 1: Registration Processing

Microsoft Forms trigger
    ↓
Get response details
    ↓
Initialize score
    ↓
Evaluate answers
    ↓
Store response/state
    ↓
Condition: score >= 4
    ├── YES
    │    ↓
    │  Check Invite Sent
    │    ↓
    │  Outlook/Teams invitation
    │    ↓
    │  Qualification email
    │    ↓
    │  Update state
    │
    └── NO
         ↓
       Failure email
         ↓
       Update state
```

```text
FLOW 2: Reminder

Scheduled trigger
    ↓
Read registrations
    ↓
Filter QUALIFIED + Reminder Sent != YES
    ↓
Send Outlook email
    ↓
Update Reminder Sent = YES
```

```text
FLOW 3: Registration Deadline

Scheduled trigger / deadline check
    ↓
Disable registration if supported
        OR
Enforce deadline in processing flow
```

---

## Google vs Microsoft implementation comparison

| Capability | Google Workspace | Microsoft 365 |
|---|---|---|
| Form | Google Forms | Microsoft Forms |
| Workflow engine | Apps Script | Power Automate |
| Response store | Google Sheets | Excel Online / SharePoint |
| Conditional scoring | JavaScript | Conditions / variables |
| Email | MailApp/Gmail | Outlook |
| Calendar invitation | CalendarApp | Outlook connector / Microsoft 365 |
| Online meeting | Google Meet | Microsoft Teams |
| Reminder | Time-driven trigger | Scheduled cloud flow |
| Duplicate state | Sheet + Calendar guest check | SharePoint/Excel state + flow condition |
| Registration cutoff | Forms service in Apps Script | Direct update if supported, otherwise deadline enforcement |

---

## Enterprise improvements for the Teams version

A production-oriented Microsoft implementation could add:

- SharePoint List instead of Excel for workflow state
- environment variables for event configuration
- solution packaging
- service account / dedicated automation owner
- retry/error handling
- failure notifications
- audit columns
- Power BI dashboard for registrations
- Teams organizer notifications
- approval flow for borderline scores
- automatic waitlist handling
- capacity limits
- data-retention policy

---

## Security considerations

Do not store secrets directly in flow descriptions or repository files.

Avoid committing:

- live Teams meeting URLs
- tenant IDs when unnecessary
- participant PII
- Outlook/SharePoint exports containing personal data
- credentials
- access tokens

Use environment-specific placeholders and configuration wherever possible.
