---
name: session-handoff
description: Creates concise handoff documents for AI agent session continuity. Use when the user wants to save session state, wrap up work, or hand off to a new agent.
---

# Session Handoff Skill

## Core Principles

- **Ruthlessly concise.** Every sentence earns its place.
- **Prioritize the unexpected.** Non-obvious info, reasoning, failed approaches, hidden constraints.
- **Be specific.** Reference exact file paths, functions, concrete outcomes.
- **Actionable next steps.** Clear tasks, not vague goals.
- **Omit the obvious.** Skip anything apparent from code or standard practice.

## Procedure

### 1. Ensure Directory Exists
```bash
mkdir -p docs/sessions
```

### 2. Generate Filename
Create timestamp-based filename: `YYYYMMDDHHmm-session-name.md`

Example: `202402031445-auth-refactor-tests.md`

Use current timestamp and a short kebab-case name (2-5 words) capturing the session's main themes.

### 3. Analyze the Conversation
Identify:
- Main themes and concrete accomplishments
- Surprising discoveries or non-obvious information
- Pitfalls, gotchas, or dead ends
- Clear next steps

### 4. Write the Handoff Document

```markdown
# Session YYYYMMDDHHmm: [Human-Readable Title]

**Model:** [claude-sonnet-4-5-20250929 or current model]

## Summary
[2-5 concrete sentences. Reference actual files, features, and outcomes.]

## Key Discoveries
[Non-obvious information not apparent from code. **Omit if none.**]

## Pitfalls to Avoid
[Dead ends, gotchas, or traps. **Omit if none.**]

## Next Steps
[Ordered list, highest to lowest priority. Specific and actionable.]
```

### 5. Commit and Push
```bash
git add docs/sessions/YYYYMMDDHHmm-session-name.md
git commit -m "docs: add session YYYYMMDDHHmm handoff notes"
git push
```

## Examples

**Good Summary:**
> Implemented JWT refresh token rotation in `src/auth/token-service.ts`. Discovered the session store wasn't handling concurrent refresh requests, causing race conditions. Added Redis-based lock in `src/auth/session-lock.ts`. Updated tests in `tests/auth/refresh-token.test.ts` for concurrent refresh scenario.

**Bad Summary (vague):**
> Worked on authentication. Made improvements to token handling. Updated tests.

**Good Next Steps:**
> 1. Add rate limiting to `/api/auth/refresh` endpoint (currently allows unlimited attempts)
> 2. Implement token rotation audit logging in `src/auth/audit-logger.ts`
> 3. Add tests for edge case: soft-deleted user with valid refresh token

**Bad Next Steps (vague):**
> 1. Continue working on auth
> 2. Add more tests

**Good Key Discovery:**
> `bcrypt.compare()` in `src/auth/password-hasher.ts` times out for passwords >72 chars. Added validation to truncate at 72 chars.

**Bad (obvious):**
> Used Git for version control and committed changes regularly.

## Anti-Patterns

❌ Omit obvious info, pleasantries, and vague statements
❌ If no pitfalls/discoveries, omit those sections entirely
✅ Be specific with file paths, function names, and concrete outcomes
