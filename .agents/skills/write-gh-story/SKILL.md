---
name: write-gh-story
description: Interview the user to refine a feature idea, probe all technical layers (frontend, backend, database schema, data migrations), review the codebase, and create a fully-scoped GitHub issue specification.
---

# Write Story Skill

This skill guides the agent in interviewing the user about a feature idea, analyzing the technical implications across all layers of the stack, and automatically publishing a fully scoped specification as a GitHub issue.

## Usage Guidelines

### 1. Relentless Requirement Gathering (The Interview Phase)
- Ask the user about their feature idea.
- Ask questions **one at a time** to walk down the decision tree and resolve ambiguities.
- For each question, provide your recommended answer or technical suggestion.
- Proactively probe the following technical layers:
  - **Frontend UI/UX:** User interactions, UI states, component changes, styling, and responsive behaviors.
  - **Backend / APIs:** New or modified endpoints, request/response payloads, parameter validation, and rate-limiting.
  - **Database Schema Changes:** New tables, fields, relationships, constraints, indexes, or updates to existing schemas.
  - **One-Time Data Updates:** Data migrations, seeding, or database backfills required for existing production records.
  - **Security & Permissions:** Authorization rules, authentication changes, or access control level policies.

### 2. Codebase Review
- During the interview, explore the codebase to understand the current architecture and identify files, packages, or services that will be affected.
- Keep the codebase exploration details in mind to inform your questions and recommendations.

### 3. GitHub Issue Creation
- Once the specification is scoped and agreed upon, compile the spec into a clean markdown document.
- **Do not** write a file-by-file implementation plan. Instead, focus on high-level functional and technical scoping:
  - **Overview / User Story:** Clean summary of what is being built and why.
  - **Acceptance Criteria:** Clear, testable bullet points describing the target behavior.
  - **Technical Specification:** Functional blueprints for Frontend, Backend, Database, Migration, and Security.
- Use the GitHub CLI (`gh`) to create the issue in the current repository:
  ```bash
  gh issue create --title "[Feature] <Short Description>" --body-file <spec-file-path>
  ```
  *(If `gh` is not authenticated, output the issue body in markdown for the user to copy, or ask for credentials).*
