# Photo reader correction — 8.24.54

Production photo request returned 503; private connection probes confirmed valid secret/model and isolated Google 400 to native structured-output request configuration. Removed rejected native schema options; prompt includes the output contract, and server retains strict output validation plus complete-candidate check. Accepts optional JSON code fences only. No fallback models, billing change, database writes, or automatic retry.

Verified with actual provided board photo using private server secret: Google HTTP 200, six task drafts (three English variants, Mathletics, Danza, Teatro), No hay rows omitted. Temporary startup probes and photo fixture removed from deployed code and never committed. Normal endpoint logs HTTP status only, no secrets/photos/response text. Frontend places status by photo and offers explicit reread button.

Node handler and DOM regression tests pass. Existing review/table APIs unchanged. Photo extraction has been tested with the real image; final review and confirmation remain teacher actions.
