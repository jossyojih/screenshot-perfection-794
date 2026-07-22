# Remote Coder Roadmap

## Remaining work

### 1. Verify automatic backend deployment - Completed

- [x] Use the promotion diff-stat fix as the first end-to-end deployment test.
- [x] Confirm the deployment progresses to `succeeded` without entering EC2.
- [x] Remove the obsolete deployment sudoers files after successful verification.

### 2. Improve Continue Conversation on mobile - Completed

- [x] Use a responsive, full-width composer.
- [x] Move agent and repository-scope options into a compact settings panel.
- [x] Make the primary action touch-friendly.
- [x] Add loading state and duplicate-submit protection.

### 3. Verify promotion permission policies - Completed

- [x] Confirm project-level default policies.
- [x] Confirm repository-level overrides.
- [x] Test `review_required`, `auto_push`, and `read_only` safely.
- [x] Verify an auto-pushed backend change triggers automatic deployment.

### 4. Add model selection

- Support Codex model and reasoning-level selection.
- Support Claude Sonnet and Opus selection.
- Consider project and repository defaults.
- Give every follow-up run its own editable repository scope, agent, model, and reasoning controls.
- Default follow-up controls to the previous run while allowing deliberate changes.
- Show a clear execution summary before submitting a follow-up.
- Allow a failed run to be retried inside the same thread with editable scope, agent, model, and reasoning settings.
- Preserve the failed run as audit history while creating a fresh run/worktree and preventing duplicate retries.
- Keep repository permission policies enforced; follow-ups must never override `read_only`, `review_required`, or `auto_push` policy boundaries.

### 5. Add worktree and disk management

- Clean old worktrees automatically after a retention period.
- Preserve promoted runs and important audit records.
- Prevent the EC2 disk from filling up.

### 6. Add repository concurrency controls

- Prevent conflicting tasks from changing or promoting the same repository simultaneously.
- Queue conflicting work or clearly report the conflict.

### 7. Add task attachments

- Support screenshots and files in new instructions and follow-ups.
- Add previews, removal controls, file-size limits, and file-type restrictions.
- Pass attachments only to the selected agent and repositories.

### 8. Improve operational reliability

- Add SQLite backups.
- Configure log rotation.
- Add deployment and job monitoring with useful alerts.
- Add durable Claude/Bedrock authentication that does not depend on an expiring interactive session.
- Show agent availability before submission and disable unavailable agents with a clear reason.
- Test recovery after an EC2 restart.

### 9. Complete remaining UI and efficiency improvements

- Remove duplicate and unrecognized activity events.
- Avoid exposing absolute EC2 worktree paths in responses.
- Add thread naming and renaming.
- Reduce excessive agent token usage.
- Safely archive or delete obsolete test projects.

## Current priority

Items 1-3 are complete. Continue with model selection, then production reliability, manageability, and polish.
