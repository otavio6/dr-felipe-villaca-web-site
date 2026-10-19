---
title: 'Confirmed FVG form conversion with source attribution'
type: 'bugfix'
created: '2026-10-19'
status: 'done'
baseline_commit: '45c42afdb98b50e2af581bda4850606daa2f18a8'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** FVG's home and standard LP emit a form event before CRM confirmation, while the two campaign forms use an incomplete receipt mechanism. The public GTM container currently attributes Meta Lead and five Google Ads conversion actions to WhatsApp clicks rather than confirmed form submissions.

**Approach:** Route every public lead form through the existing thank-you page after CRM acceptance. Carry a trusted source identifier through a temporary receipt, consume it once, and emit one confirmed form event with source attribution. Display the source in the confirmation and return users to the corresponding page.

## Boundaries & Constraints

**Always:** Cover home (`index.html`), standard LP (`lp.html`), skin-excess campaign (`campanha.html`), and US campaign (`eua.html`). Preserve form validation, payload fields, CRM endpoint `/api/leads`, existing design, and consent defaults. Use source keys `home`, `lp`, `campanha`, and `campanha-eua`. Treat CRM success as HTTP success with `{recebido:true}`. Include event identifier, source key, source path and campaign classification in the confirmed event. Keep personal information and clinical answers out of the receipt and conversion payload. Use static source labels and an allowlist of return destinations.

**Never:** Count a failed submission, local preview, direct thank-you visit, or refresh as a new conversion. Do not add an automatic WhatsApp destination: existing form flows do not have one. If an existing WhatsApp destination is discovered during implementation, preserve it behind a two-second thank-you delay, only after a valid receipt. Do not infer Google action labels or add a second Meta sender alongside GTM. Do not publish GTM, push, merge, deploy, or create real leads during this implementation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Confirmed submission | One of four forms; CRM accepts | Thank-you page displays source and emits one `submit_lead` event | Preserve successful CRM status even if tracking is blocked |
| Failed submission | Invalid form, HTTP error, or unsuccessful response body | Remain on form; no receipt or conversion | Existing validation and retry UI |
| Refresh or direct access | No pending receipt | Render confirmation; emit no conversion | Safe default return link |
| Stale receipt | Older than 30 minutes, future timestamp, invalid schema or source | Consume/discard; no conversion | Do not trust query parameters as proof |
| Blocked storage | Session storage throws | Emit confirmed event on originating page and use bounded GTM callback before navigation | No unguarded storage exception or false CRM error |
| Different source | New accepted form from another source | Use new source and event ID; preserve both valid submissions | No session-wide suppression of unrelated valid submissions |

</frozen-after-approval>

## Code Map

- `index.html` and `lp.html`: `leadForm` handlers POST to CRM, then navigate without a receipt. The LP also omits the source page from its payload.
- `campanha.html`: `campaign-form` saves a source-incomplete receipt and falls back to immediate `submit_lead` if storage fails.
- `eua.html`: `lead-form` saves the same receipt key; storage failure silently drops conversion tracking.
- `obrigado.html`: consumes campaign receipts only when a query parameter matches; no receipt age or ID validation. Existing return link covers campaigns but not home.
- `assets/js/analytics.js`: generic `leadForm` submit listener emits an event and calls ChatGPT Ads before CRM confirmation. WhatsApp clicks separately call the same ChatGPT conversion function.
- `api/leads/index.js`: responds 201 `{recebido:true}` only after upstream CRM success; keep endpoint and contract.
- `staticwebapp.config.json`: existing `/obrigado` rewrite; preserve routing.

## Tasks & Acceptance

**Execution:**
- [x] `assets/js/lead-tracking.js` -- implement shared receipt creation/consumption, strict source mapping, event ID generation, expiration, and storage-unavailable fallback.
- [x] `index.html`, `lp.html`, `campanha.html`, `eua.html` -- load helper before submission handlers and invoke only after confirmed success; remove previous campaign receipt code. Add the LP source path to its CRM payload.
- [x] `assets/js/analytics.js` -- remove attempt-based form event and form ChatGPT conversion; provide confirmed-only hook for ChatGPT while preserving independent WhatsApp click behavior.
- [x] `obrigado.html` -- consume validated receipt, emit one source-tagged event, display source label, and choose the correct return destination. Preserve noindex and existing style.
- [x] `tools/test-lead-tracking.cjs` -- cover receipt matrix and actual form handlers with mocked requests; verify every source, failed CRM, refresh, direct access, expired receipt, blocked storage and no personal data in events.
- [x] `docs/analytics/README.md` -- document source mapping and required GTM migration: confirmed form conversions use `submit_lead`; WhatsApp click actions remain separately classified. Record public Pixel `631982350987104` as observed, not manager-confirmed.

**Acceptance Criteria:**
- Given each public lead form, when CRM accepts it, then the thank-you page identifies its actual origin and its return button targets that origin.
- Given a failed request followed by a successful retry, when tracking is inspected, then only the successful request produces the confirmed form event.
- Given current public GTM rules, when code work finishes, then documentation clearly states that actual Meta/Google form reporting still requires the coordinated GTM trigger change and validation in the destination platforms.

## Implementation Notes

Implemented all four confirmed-only handlers, single-use source receipts, independent UI fallback, consent-preserving analytics hook, Node integration cases, and an executable mocked Chrome harness. Node suite, JS checks, diff checks, and real Chrome cross-document tests passed for four sources at 320/390/1440 pixels. Browser tests block external requests; no leads were created. GTM/Meta/Google configuration remains pending, explicitly outside this implementation. Review patches were verified; rare pre-navigation concurrent/copy-tab scenarios were assessed as low and rejected to avoid disproportionate storage coordination complexity.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Evidence and disposition |
|---|---|---|
| Blind 1: missing helper loses thank-you UI | medium | Confirmed unguarded call; patch independent allowlisted presentation fallback. |
| Blind 2: receipt removed before event queue succeeds | false | Single-use consumption before reporting is intentional to prevent duplicate attempts; blocked tracking must not retry into duplicate conversions. Receipt is not a delivery acknowledgment. |
| Blind 3: multiple pending receipts overwrite | low | Actual handlers disable submit and immediately navigate after receipt creation; another call before navigation requires unusual programmatic/concurrent submission. Reject queue complexity for this non-routine state. |
| Blind 4: copied session receipt across tabs | low | Duplication requires copying the tab during the brief pending-receipt window before immediate navigation. Reject shared cross-tab locking complexity for this non-routine state; destination event IDs remain available for coordinated deduplication. |
| Blind 5: preview drops source | low | Directly confirmed; patch preview URL only, preserving no-event behavior. |
| Blind 6: synchronous helper blocks rendering | low | Directly confirmed; patch form-page script loading with defer. |
| Blind 7: no cross-document or asset-failure tests | medium | Browser cross-document checks already passed externally; persist executable browser harness and add automated missing-helper/thank-you DOM coverage. Copied-tab and simultaneous pending cases are rejected above. |
| Edge 1: receipt overwrite | low | Same non-routine concurrent pre-navigation case as Blind 3; reject queue expansion. |
| Edge 2: opener-inherited receipt | low | Same transient inherited-session case as Blind 4; reject cross-tab lock expansion. |
| Edge 3: helper failure loses source | medium | Same verified UI bug as Blind 1; patch guarded static fallback. |
| Verification 1: thank-you DOM wiring untested | medium | External browser tests ran, but repository Node suite only tests helper directly. Add actual inline initialization with DOM fixtures and refresh coverage. |
| Verification 2: helper-to-ChatGPT bridge untested | medium | Separate tests omit combined path. Add integrated request assertions using same event ID/path after prior WhatsApp click. |

## Verification

**Commands:**
- `node tools/test-lead-tracking.cjs` -- all receipt and mocked form integration cases pass without external requests.
- `node --check assets/js/lead-tracking.js` and `node --check assets/js/analytics.js` -- valid JavaScript.
- `git diff --check` -- no whitespace errors.

**Manual checks:**
- Inspect confirmation at mobile and desktop widths and verify all four source labels and return destinations.
- Record GTM preview and ad-platform validation as pending until container configuration is authorized and available.
