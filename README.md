# intro

## Jobs

The direct `president-and-ceo.html` application page is restored as of
October 20, 2026. Referral is required in both the browser and backend;
Salary Expectations remains optional. The homepage still has no Jobs section,
and `jobs.html` still displays "No current openings."

The role page is included in the GitHub Pages artifact. Restore and update only
the current CEO Apps Script deployment before publishing these changes.
Older deployments stay archived. Form revision `ceo-20261020` requires older
open forms to refresh before submitting.

To close intake again, set `enabled: false`, exclude the role page from the
deployment artifact, and archive the active Apps Script web-app deployment in
**Deploy > Manage deployments**. Archiving also stops cached forms and direct
submissions while preserving the script, configuration, and Monday applications.

The application uses native Canton-styled inputs, not an embedded Monday form.
An Apps Script backend submits answers and attachments to the existing Monday
board. API credentials remain in private Script Properties, never public assets.

See [deployment and verification instructions](scripts/job-applications/SETUP.md).
The backend installs as one complete `scripts/job-applications/Code.gs` file,
including the schema and diagnostics. No separate `.gs` files are needed.
The native questions are always shown on the role page, without a Monday iframe
or external application link. The endpoint and public Turnstile key are configured
in `assets/job-application-config.js`. Only enable public submissions after a
successful integration test. The temporary integration-test page has been removed.
Setting `enabled: false` restores preview mode and blocks submissions; preview
answers are never saved or sent.

This repository publishes to `https://intro.canton.foundation/jobs.html` (see
`CNAME`). To serve the page at `https://canton.foundation/jobs`, create a page on
the main website and deploy the native form there with matching backend hostname
validation. A redirect to Monday would not preserve the Canton address.

Avoid submitting real applicant information as test data. Both pages retain the
site's noindex policy. Changes to the WorkForm are not automatically mirrored in
this custom form; keep the shared question schema and role description in sync.
