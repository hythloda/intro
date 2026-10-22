# Public APAC recruitment

## Destinations and privacy

- Country Manager, South Korea: `country-manager-korea.html`, private Monday board `18436483787`.
- Country Manager, Japan: `country-manager-japan.html`, private Monday board `18436483844`.
- President and CEO: unchanged private application at `president-and-ceo.html`, board `18434504661`. Not linked from Jobs or the homepage. Its shared password remains enforced on every server submission.

The public roles use native forms, not embedded Monday forms. They retain bot verification, validation, CV uploads, duplicate prevention, application references, and acknowledgment emails with replies directed to `hr@canton.foundation`. No applicant answers or files are written to GitHub or browser storage. The two private boards start with one New Applications group and Application Status labels for recruitment review. No applicant scoring or selection is automated.

The old `head-of-korea.html` and `head-of-japan.html` URLs redirect to the corresponding Country Manager pages, preserving query parameters and the application anchor. Internal submission role keys remain `head-of-korea` and `head-of-japan` to preserve existing board routing, receipts, and duplicate prevention; they are independent of the public page URLs.

## Build and deploy

1. Update the checked-in source description snapshots in `descriptions/` only when the approved Google Docs change. There is no scheduled job-description sync.
2. Run `node scripts/job-applications/build-public-pages.mjs` to regenerate both pages from those snapshots and the shared native form structure.
3. Run `node scripts/job-applications/build.mjs` and `node --test scripts/job-applications/test.mjs`.
4. Replace the existing Apps Script project's sole `Code.gs` with the generated bundle. Keep all existing Script Properties and receipts.
5. Run `setupPublicJobApplications`. It resolves each public board's columns and saves `JOB_COLUMN_MAP_KOREA` and `JOB_COLUMN_MAP_JAPAN`; it does not change `JOB_COLUMN_MAP` for CEO. Per-role overrides, if needed, are `JOB_COLUMN_OVERRIDES_KOREA` and `JOB_COLUMN_OVERRIDES_JAPAN`.
6. Update the existing web-app deployment to a new version after approval. Keep the existing endpoint URL, execute-as owner, and public endpoint access. The server chooses the board and password policy from a fixed role allowlist.
7. Deploy the static site. Check GET readiness with `?role=head-of-korea` and `?role=head-of-japan`: both should report `acceptingApplications: true, passwordRequired: false`. GET with no role must still report `passwordRequired: true` for CEO.
8. With permission, submit one marked synthetic application per role and verify the destination, reference, attachments, and acknowledgment. Do not blindly retry an uncertain write.

## Diagnostics

Set private Script Properties `JOB_DIAGNOSTIC_ROLE` to the exact role and `JOB_DIAGNOSTIC_REFERENCE` to the reference, then run `inspectJobApplicationFailure`. Missing diagnostic role defaults to CEO for backward compatibility. Public receipts are isolated as `application:<role>:<reference>`; legacy CEO receipt keys are unchanged. Retry approval requires manual confirmation that no item exists on the selected role's board.

Never publish `MONDAY`, `TURNSTILE_SECRET`, or `JOB_ACCESS_PASSWORD`. A public form does not grant access to any board or existing application data.
