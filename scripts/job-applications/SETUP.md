# Accounting Manager application setup

The native page is `accounting-manager.html`, linked from `jobs.html`. The API
destination is board `18432556545`. It does not read applicant rows or publish
them. The role page displays the native questions directly, with no Monday
iframe or external application link. Until the backend is connected and tested,
the page is clearly labeled as a preview and the Submit button is disabled.
Preview answers are not saved or sent. Do not enable submissions before setup.

## New Apps Script project

1. Create a standalone Google Apps Script project owned by the Foundation account
   that should run this service. Add `Code.gs` from this directory and add
   `assets/job-application-schema.js` as `Schema.gs`. Use the supplied
   `appsscript.json` manifest (V8, external requests only).
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
   key in `assets/job-application-config.js`. No other property belongs there.
   Share those two public values with the site maintainer to finish the connection.

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
- Then publish the configured assets to enable the native application form. The
  `scripts` directory is excluded from the GitHub Pages artifact.

## Privacy and failure handling

- Questions and required flags match the original application. A separate phone
  country selector supports Monday's phone-column format. Self-identification is
  optional, collapsed by default, and never used for scoring or screening here.
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
  ID, timestamp, and phase in private Script Properties. A lock prevents concurrent
  duplicates. Completed receipts make identical retries safe. A write with an
  uncertain result is not automatically repeated or reported as successful.
- If a receipt stays in `creating` or `uploading`, an administrator should inspect
  that board item and reconcile the missing parts before changing its receipt.
  Do not simply delete a receipt and retry: that can create a duplicate. An upload
  failure can leave a partial item in Monday, which requires manual review.
- The ledger fails closed at 1,200 receipts to stay below Script Properties quotas;
  monitor usage and migrate the ledger to a private datastore for larger volumes.
  Do not remove ledger entries while callers may still retry them.
- Keep board access limited to authorized recruitment staff, including access to
  optional demographic data. Review retention and recruitment privacy notices with
  the Foundation's own policies before launch. Never reuse a public board sync for
  this board. Turnstile limits automated abuse but Apps Script still has finite
  execution/request quotas; monitor these on the owning account.

References: [Apps Script web apps](https://developers.google.com/apps-script/guides/web),
[Content service redirects](https://developers.google.com/apps-script/guides/content),
[Monday item creation](https://developer.monday.com/api-reference/reference/items),
[Monday file uploads](https://developer.monday.com/api-reference/reference/files-1),
[Turnstile verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
