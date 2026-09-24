# intro

## Jobs

`jobs.html` embeds the existing Accounting Manager WorkForm. The form, uploads,
validation, and submissions are handled by Monday; this repository does not
collect applicant information or require a Monday API key. Edit the job
description and application questions in WorkForms and the embed will reflect
those changes without a site deployment.

The iframe uses the `/forms/embed/` URL, since the ordinary sharing URL disallows
embedding. Its sandbox permits forms, scripts, uploads, and new-tab links, but
does not permit top-level navigation. Keep the WorkForms completion screen inside
the form rather than configuring a redirect of the parent page. The optional
fallback link explicitly opens the provider in another tab.

This repository publishes to `https://intro.canton.foundation/jobs.html` (see
`CNAME`). To serve the page at `https://canton.foundation/jobs`, create a page on
the main website and use the same WorkForms embed there. A redirect to the form
would not preserve the Canton address.

Verification: preview the page on desktop and mobile, check the complete form
and upload controls load, and verify an authorized test submission in the
connected Monday board before announcing the opening. Avoid submitting real
applicant information as test data. This page retains the site's noindex policy.
