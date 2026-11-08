# Activity album workflow (2026-11-08)

- Admin account management can designate an approved staff member as a program manager. This does not create a new login role or give account-administration permissions.
- Admin / designated program manager opens `activities.html`, supplies activity/date, selects participants, selects 1–8 JPG/PNG/WebP files (5MB each), and publishes in one action. Title and description default from activity/date; manual editing is optional.
- Events and participant links are durable D1 records. Images are private R2 objects. All file uploads must finish before an event can be published. Retrying the same upload on the current screen reuses event/file IDs. Interrupted drafts remain unpublished and can be canceled from the list.
- Only participant-linked families receive published metadata. Every binary read rechecks session, patient link, event publication and file association. Shared group photos are visible to each selected participant's linked families. Participant names are not returned to family clients.
- Sharing can be stopped; future binary access is rejected, and periodic refresh removes the event from family screens. Already viewed/downloaded images cannot be recalled.
- Provenance is chosen explicitly: real capture or AI/synthetic. Existing generated examples remain labeled synthetic. Uploading synthetic assets does not assert that care actually occurred.
- Clinical logs and news have no photo requirement; the separate album requires at least one photo.

Validation: `tests/activities.mjs` passed 37 local server checks (manager delegation/revocation, input validation, retry identity, partial upload privacy, publication, real/synthetic distinction, family isolation, withdrawal, no-photo care draft). Local browser confirmed two-file registration linked to two patients, automatic text, private family image loading, modal labeling, manager checkbox and 390px/1280px layouts without horizontal overflow. TypeScript check and Pages packaging passed. Test fixtures are synthetic; write tests are restricted to loopback hosts. Production checks are read-only except ordinary test-account login/logout.

Screenshots in ignored `outputs/activities-qa/`.
