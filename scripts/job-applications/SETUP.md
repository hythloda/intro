# Accounting Manager application setup

The native page is `accounting-manager.html`, linked from `jobs.html`. The API
destination is board `18432556545`. It does not read applicant rows or publish
them. The role page displays the native questions directly, with no Monday
iframe or external application link. Until the backend is connected and tested,
the page is clearly labeled as a preview and the Submit button is disabled.
Preview answers are not saved or sent. Do not enable submissions before setup.

## New Apps Script project

1. Create a standalone Google Apps Script project owned by the Foundation account
   that should run this service. Replace the contents of its **one `Code.gs` file**
   with the complete `Code.gs` from this directory. It includes the schema,
   application handlers, setup, and diagnostics. Do not add separate `Schema.gs`
   or `Diagnostics.gs` files. Use the supplied `appsscript.json` manifest (V8,
   external requests only); the manifest is not an additional script file.
2. In **Project Settings > Script Properties**, add `MONDAY` with an API token
   authorized to create items and upload files on board `18432556545`. Prefer a
   dedicated least-privilege integration account. Do not place the token in HTML,
   JavaScript, git, a URL, or the frontend configuration file. GitHub's existing
   `MONDAY` secret cannot be read back and is not automatically shared with Google.
3. Run `inspectJobColumns` to see column IDs/types and group IDs, without reading
   applications. Set `MONDAY_GROUP_ID` to the same destination group used by the
   current WorkForm if needed. If absent, Monday uses the board's first group.
4. Run `setupJobApplication`. It matches the original question labels to actual
   board columns, validates types, and stores `JOB_COLUMN_MAP` server-side. If a
   form label differs from its board column title, set `JOB_COLUMN_OVERRIDES` to a
   JSON object such as `{"email":"actual_column_id"}` and rerun setup. Do not guess
   IDs from the WorkForm's HTML; those are question IDs, not verified column IDs.
5. In Cloudflare **Turnstile**, create a managed widget for
   `intro.canton.foundation`. Set its secret as `TURNSTILE_SECRET` in Script
   Properties. The sitekey is public and goes in the website configuration below.
   The backend requires successful verification for the exact hostname and
   `job_application` action; leaving the secret unset never enables submissions.
6. Deploy as a **Web app**, executing as the project owner, accessible to
   **Anyone**. Review and approve the external-request authorization yourself.
   This exposes only an intake endpoint protected by Turnstile, not a board reader.
   Use the deployed `/exec` URL, not the editor's `/dev` URL. Updates to script code
   require a new version in **Deploy > Manage deployments**.
7. Set `endpoint` to that `/exec` URL and `turnstileSiteKey` to the public widget
   key in `assets/job-application-config.js`. Keep `enabled: false` until the
   real deployment has been tested. These are public settings, not credentials.
   Share those two public values with the site maintainer to finish the connection.

For the current board, the confirmed destination is `MONDAY_GROUP_ID=topics`
(New Applications). Set `JOB_COLUMN_OVERRIDES` to the following before setup:

```json
{"adjustments":"text_mm7g6egm","gender":"single_select2u3fsjw"}
```

The adjustments answer uses the Notes column; the voluntary Gender answer uses
the status column rather than the separate text column with the same title.

## Update an existing project

Replace only the existing Apps Script `Code.gs` contents with this directory's
complete all-in-one `Code.gs`. Keep Script Properties, credentials, and receipt
records unchanged. If separate schema or diagnostic script files were previously
installed, remove those old duplicate definitions after installing the combined
file. No other `.gs` file is required for this application.

Deploy through **Deploy > Manage deployments > Edit > New version > Deploy**
using the existing deployment so the `/exec` URL stays the same. The editor's
saved code and deployed version are different; updating code alone is not enough.
Opening the deployed URL should return
`{"service":"Canton Foundation job applications"}`. If it reports a missing
`doGet` or `doPost`, the deployment does not contain the complete file yet.

## Verify before publishing

- Run `node --test scripts/job-applications/test.mjs` for the mocked backend tests.
- Preview the form at desktop and mobile widths. All questions should be visible
  before configuration, with the optional self-identification section expandable.
  An unconfigured form must show the preview notice and block submission.
- Make one explicitly authorized synthetic application on the real deployment,
  including a harmless test CV and optional cover letter. Confirm the destination
  group, every column, both attachments, and the existing recruitment automations.
  API-created items do not necessarily fire automations specific to WorkForms.
- Confirm the browser gets readable JSON from the Apps Script redirect, then shows
  the on-page confirmation without changing the Canton URL. CORS behavior must be
  checked on the deployed endpoint; do not replace fetch with `mode: "no-cors"`,
  which would hide errors and cannot confirm delivery. If domain policy prevents
  a public web app or a readable response, use a same-origin server endpoint instead.
- Confirm that voluntary answers can be left blank, bad files are rejected, an
  expired security check fails, and retrying the same request creates one item.
- After verification, set `enabled: true` in the public configuration, remove
  any temporary integration-test page, and publish. Bump the configuration asset's
  version query in `accounting-manager.html` so browsers do not retain the preview
  setting. The `scripts` directory is excluded from the GitHub Pages artifact.

## Privacy and failure handling

### Inspect an existing failed submission without retrying it

1. Use the complete all-in-one `Code.gs` in the existing Apps Script project.
   Diagnostics are already included; do not add a separate diagnostic script.
   Keep credentials and receipt records unchanged.
2. Set Script Property `JOB_DIAGNOSTIC_REFERENCE` to the reference shown by the
   form, then run `inspectJobApplicationFailure` in the editor. No new deployment
   or form submission is needed.
3. The log contains only receipt phase, configuration checks, public form choices
   missing from status columns, and attachment counts for the one recorded item.
   It never prints answers, credentials, receipt hashes, item IDs, or file URLs.
   `inspectJobApplicationFailure` does not write to Monday, change receipts, or
   retry anything. Updated service receipts also report allowlisted failure codes.
4. `creating` means item creation is unconfirmed, not that no item exists.
   `uploading` means an item ID was received but attachment completion was not
   confirmed. Counts do not prove the right files arrived. Check the test record
   in Monday before deciding on recovery. Do not delete a receipt or submit a
   second application to work around an uncertain result.

Older service versions did not retain Monday's error details, so those historical
receipts cannot identify the exact provider error. The current version records
only allowlisted error codes, HTTP status, and public schema field keys in the
private receipt and execution log. It never stores provider messages or error
payloads, which can contain submitted values. Resolve a configuration issue only
if diagnostics or the board confirm it; do not guess column IDs or create new
status labels automatically.

### Retry after a confirmed absence

Use this only after an administrator has searched all board groups and confirmed
that the original attempt did not create an item. The receipt alone is not proof.

1. Update the existing project's single `Code.gs` using the complete all-in-one
   file. Keep credentials unchanged. Deploy a **New version** of the existing
   web-app deployment so its `/exec` URL remains unchanged.
2. Set `JOB_DIAGNOSTIC_REFERENCE` to the reviewed reference and run
   `approveReviewedJobApplicationRetry` in the editor. It only accepts a receipt
   in `creating` with no returned item ID. It preserves the original hash and
   records the manual review; it does not delete anything or submit an application.
3. From the original test tab, submit once using the unchanged answers and files.
   The approval permits one attempt with the same reference and matching payload.
   A new failure is blocked again rather than automatically retried. If test answers
   or attachments have changed, use the explicit additional approval below.
4. If it fails, run `inspectJobApplicationFailure` again for the new safe error
   codes. Do not reset the receipt or keep approving retries without investigation.

### Allow corrected details on an already-reviewed test

If the receipt is already `retry_approved` but the form says its answers differ,
the original approval is still unused. File names and file contents also count
as answers for duplicate protection. Do not delete the receipt or change the
browser reference to bypass this check.

Only after confirming that no item exists for this test:

1. Install the updated all-in-one `Code.gs` and deploy a **New version** of the
   existing deployment. Keep all Script Properties unchanged, including
   `JOB_DIAGNOSTIC_REFERENCE` for the already-reviewed test.
2. In the editor run `approveReviewedJobApplicationRetryWithUpdatedAnswers` once.
   It only accepts an already-reviewed `retry_approved` receipt without an item ID.
   It preserves the old hash and records a separate approval; it submits nothing.
3. Submit the corrected test once from the same test tab with the same reference.
   Validation and Turnstile still apply. Approval is consumed before the creation
   request; a failed creation or upload cannot automatically retry. The new hash
   is saved with the previous hash and approval timestamps, never the answers.
4. Check the Monday row and attachments. On failure, run
   `inspectJobApplicationFailure` again and investigate its safe error codes
   before approving anything further.

This permission is a private receipt flag set only by an editor function, not a
form option or public endpoint. Normal retries still require identical answers.
The diagnostic reports `updatedAnswersRetryApproved` without exposing hashes.

### Data handling

- Questions and required flags match the original application. A separate phone
  country selector supports Monday's phone-column format. Self-identification is
  optional, collapsed by default, and never used for scoring or screening here.
- Phone numbers are checked against the selected phone country's numbering plan
  before any submission request in the updated browser form, and before any
  external API request or receipt write in Apps Script. Valid national and
  international numbers are normalized to E.164 only for Monday's phone column;
  the original answers remain unchanged for receipt comparison. A supplied invalid
  number is never silently dropped. Applicants may leave the optional field blank.
  The same pinned `libphonenumber-js` full-metadata bundle runs locally in both
  environments; no applicant data is sent to a third-party validation service.
  Monday still performs its own validation. A `ColumnValueException` on `phone`
  identifies a rejected phone value, not a missing column or API credential.
- Answers travel only in HTTPS POST bodies to Apps Script and then Monday. No
  applicant values, file contents, or provider error bodies are logged, committed,
  placed in URLs, or saved to browser storage. Session storage holds only a random
  request reference. There is no local draft-saving feature.
- PDFs and Word documents are limited to 5 MB each, checked on both sides with
  server-side file-signature checks. These checks are not a malware scanner.
  Uploads go directly to the existing Monday file columns, not public Drive links.
- A provided physical address is geocoded using Apps Script's Google Maps service
  only when the destination is a Monday location column, since it requires real
  coordinates. Ambiguous addresses are rejected before any board item is created.
  A text/long-text column override avoids geocoding if that is preferred.
- The script retains only the submission reference, payload digest, internal item
  ID, timestamps, phase, and allowlisted diagnostic codes in private Script Properties. A lock prevents concurrent
  duplicates. Completed receipts make identical retries safe. A write with an
  uncertain result is not automatically repeated or reported as successful.
- If a receipt stays in `creating` or `uploading`, an administrator should inspect
  that board item and reconcile the missing parts before changing its receipt.
  Do not simply delete a receipt and retry: that can create a duplicate. An upload
  failure can leave a partial item in Monday, which requires manual review.
- The ledger has a ceiling of 1,200 receipts; Script Properties size quotas may be
  reached sooner. Monitor usage and migrate the ledger to a private datastore for larger volumes.
  Do not remove ledger entries while callers may still retry them.
- Keep board access limited to authorized recruitment staff, including access to
  optional demographic data. Review retention and recruitment privacy notices with
  the Foundation's own policies before launch. Never reuse a public board sync for
  this board. Turnstile limits automated abuse but Apps Script still has finite
  execution/request quotas; monitor these on the owning account.

## Maintainer build

`Code.gs` is the only Apps Script installation file. Its source is kept in
`src/handlers.js`, `src/diagnostics.js`, and the website's shared
`assets/job-application-schema.js` so the public and server questions stay aligned.
It also embeds `assets/job-application-phone.js` and the vendored phone library
with its license notices. No additional Apps Script file or library setup is needed.
After editing those sources, regenerate and test the standalone bundle:

```sh
node scripts/job-applications/build.mjs
node --test scripts/job-applications/test.mjs
```

The tests run `Code.gs` alone and reject an outdated bundle. None of the source
files or build tools need to be installed in Apps Script.

References: [Apps Script web apps](https://developers.google.com/apps-script/guides/web),
[Content service redirects](https://developers.google.com/apps-script/guides/content),
[Monday item creation](https://developer.monday.com/api-reference/reference/items),
[Monday file uploads](https://developer.monday.com/api-reference/reference/files-1),
[Monday phone values](https://developer.monday.com/api-reference/reference/phone),
[Monday error handling](https://developer.monday.com/api-reference/docs/error-handling),
[Turnstile verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
