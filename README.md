# intro

## Jobs

Recruitment is closed as of October 12, 2026. The homepage has no Jobs section,
and `jobs.html` displays "No current openings."

`president-and-ceo.html` is retained in source for a future reopening but is
explicitly excluded from the GitHub Pages artifact, so its public URL returns
404. Public submissions are disabled in `assets/job-application-config.js`.
The Apps Script web-app deployment must also be archived in **Deploy > Manage
deployments** to stop cached forms and direct submissions. Archiving preserves
the script, configuration, and existing Monday applications.

To reopen recruitment, restore the homepage/listing links, remove the role-page
exclusion from the deploy workflow, restore the intended Apps Script deployment,
and verify it before enabling public submissions.

The retained application uses native Canton-styled inputs, not an embedded Monday form.
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
