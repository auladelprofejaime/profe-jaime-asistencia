# Revisión diaria 3A — 8.24.52

Replaces the inactive Reto3A menu without touching books, grades, points or student portals. Backend has independent teacher-only RLS tables and SECURITY INVOKER RPCs. Seeds the 30 names already present in evening book custody and the 2026–27 group timetable; seeds NO tasks or reviews.

Review flow: select day, student name, all-present or missing-only toggles; one atomic server RPC per student. Unknown English/Arts variants remain unverified, never missing. Dates are confirmed by the teacher. Reports use saved task snapshots, corrections retain an audit trail and enforce expected revisions. Boards with reviews cannot be overwritten. Notifications are drafts/copy/mailto only, never automatic delivery or verified parent addresses.

Photo reader: pinned Tesseract.js 5.1.1, Spanish OCR on device, image compressed <=1.5MB. Handwriting recognition is best-effort and requires review; pasted text/manual correction is available. No tasks are created until confirmation. Timetable suggests next class only; explicit teacher due-date confirmation remains required.

Tests: node test-daily-task-review-v82452.cjs. Database transaction QA tests role isolation, wrong-day exclusion, empty rejection, revision conflicts and immutable reviewed boards; all temporary QA rows rolled back. No real grading/points writes. Browser pixel QA unavailable in this runtime (Chromium binary download failed), DOM/interaction QA passed.
