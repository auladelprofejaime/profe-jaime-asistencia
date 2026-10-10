# Private board-photo reader — 8.24.53

Replaces browser Tesseract handwriting OCR with one authenticated Gemini request per photo. Gemini API key is only read from Supabase Edge Function secrets. No billing changes, paid fallback, retry loops, pupil data submission, or database writes in extraction. Pin: gemini-3.5-flash-lite (account free quota must remain available).

Edge Function daily-photo-reader keeps gateway JWT verification and validates the live user via Supabase Auth, then restricts use to the existing daily-review owner. Validates origin, bounded input, image signature, model output, subjects and variants. No upstream errors, credentials or photo contents in logs. Only secret-presence diagnostics are logged.

Frontend: upload photo → editable draft. Confirm subject, text, English/Arts variant and due date. Unclear rows require acknowledgement; editing resets that acknowledgement. Dates without explicit source dates are suggested using existing timetable. No task creation until explicit confirmation using the existing atomic RPC. Failed uploads clear prior drafts. No automatic retries. Existing roster, schedule, reviews, grades, points and book modules unchanged.

Verification: node test-daily-photo-reader.cjs and node test-daily-task-review-v82452.cjs. Covers owner/auth/CORS, invalid images/output, quota and private error handling, draft acknowledgements, no implicit saves, and roster/review regressions. Tests use mocked Gemini; actual handwriting accuracy requires a first upload in the signed-in production app. No fabricated user session or administrative login.

Rollback: restore previous daily-task-review-v82452.js and previous index/service-worker commit; prior data and RPCs remain compatible. Edge Function can remain idle or be disabled separately.
