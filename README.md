# intro

## Jobs

`jobs.html` lists openings and links to the dedicated `accounting-manager.html`
application. It uses native Canton-styled inputs, not an embedded Monday form.
An Apps Script backend submits answers and attachments to the existing Monday
board. API credentials remain in private Script Properties, never public assets.

See [deployment and verification instructions](scripts/job-applications/SETUP.md).
The new form stays hidden and disabled until its endpoint and public Turnstile
key are configured in `assets/job-application-config.js`. Until then, the role
page offers a clearly labeled link to the existing application in a new tab,
without an iframe. Enable the native form only after the backend passes a real
end-to-end submission check.

This repository publishes to `https://intro.canton.foundation/jobs.html` (see
`CNAME`). To serve the page at `https://canton.foundation/jobs`, create a page on
the main website and deploy the native form there with matching backend hostname
validation. A redirect to Monday would not preserve the Canton address.

Avoid submitting real applicant information as test data. Both pages retain the
site's noindex policy. Changes to the WorkForm are not automatically mirrored in
this custom form; keep the shared question schema and role description in sync.
