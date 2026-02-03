---
name: groom
description: Groom a GitHub issue — enrich with project context, clarify requirements, and post a structured comment. Use when the user wants to prepare an issue for implementation.
argument-hint: "[issue-number-or-url]"
---

# Issue Grooming Skill

You are acting as a product owner for this project. Your job is to groom a GitHub issue so it is ready for implementation.

## Procedure

### 1. Fetch Issue Details

```bash
gh issue view $ARGUMENTS --json number,title,body,labels,comments,milestone,assignees
```

Read the full issue: title, description, all comments, labels, and milestone.

### 2. Gather Project Context

Before enriching the issue, review relevant project context:

- Read `CLAUDE.md` for architecture, conventions, and data flow
- Read `context/PLAN.md` for the project roadmap and phase status
- Read `src/shared/types.ts` for current data model interfaces
- Explore source files relevant to the issue (parsers, background, content script, popup, etc.)

Understand how the requested change fits into the existing architecture and roadmap.

### 3. Analyze and Enrich

Write a grooming comment that includes:

**Requirements Breakdown** — Restate the issue as concrete, actionable requirements. Break vague requests into specific tasks. Reference exact files, functions, and interfaces that will be affected. 

**Acceptance Criteria** — Define clear, testable criteria for when this issue is done. Be specific — "CSV export includes new column X" not "export works".

**Implementation Notes** — Add any technical context that would help the implementer:
- Relevant patterns already in the codebase
- Potential gotchas or edge cases
- Dependencies on other issues or components
- Suggested approach if non-obvious

### 4. Identify Questions

If the issue is ambiguous, missing information, or has multiple valid interpretations:

- List specific questions for the repo owner in a **Questions** section at the end of the comment
- Each question should explain *why* the answer matters for implementation
- Suggest 4 short answers for each question
- Add the `question` label to the issue:
  ```bash
  gh issue edit $ARGUMENTS --add-label "question"
  ```

If no questions are needed, omit the Questions section and do not add the label.

### 5. Post the Comment

Post the grooming analysis as a comment on the issue:

```bash
gh issue comment $ARGUMENTS --body "$(cat <<'EOF'
<comment content here>
EOF
)"
```

Use this header format for the comment:

```markdown
## Grooming Notes

<content sections from step 3>

### Questions
<only if questions exist>
```

### 6. Report Back

After posting, summarize to the user:
- What you found in the issue
- Key decisions or assumptions in your analysis
- Whether you added the `question` label
- Link to the issue

## Guidelines

- Be specific
- Don't invent requirements — only enrich what the issue author intended
- Keep the comment concise and scannable — use headers and bullet points
- If the issue is already well-defined, say so and add minimal enrichment
- Do not make code changes — this skill is analysis only
