---
name: implement-gh-story
description: >-
  Fetches open issues from GitHub, guides the user to select one, drafts an implementation plan, creates a git branch, implements the feature with unit tests, runs a self-review loop to refine the code, lints, pushes, and opens a Pull Request.
---

# Implement Story Skill

This skill guides the agent in end-to-end feature implementation: selecting a GitHub issue, planning the changes, branching, writing the code and unit tests, executing a self-review/fix loop, linting, and creating a Pull Request.

## Execution Steps

### 1. Fetch and Select Issue
- Check if the GitHub CLI (`gh`) is installed and authenticated. If not, prompt the user.
- Fetch open issues from the repository:
  ```bash
  gh issue list --limit 10
  ```
- Present the list to the user and ask them to select which issue they want to implement.
- **Fallback (No Issues)**: If there are no open issues, invoke the `write-story` skill to gather the information from the user, design the feature specification, and create a new GitHub issue. Once the new issue is created, fetch it and proceed to the next step.

### 2. Create Implementation Plan
- Once the issue is selected, read the full issue description:
  ```bash
  gh issue view <issue-id>
  ```
- Research the codebase to understand the current architecture and identify files to create or modify.
- Create an implementation plan detailing:
  - Proposed code changes (frontend, backend, database schema, data migrations).
  - Test strategy (files and scenarios to cover).
- Present the plan to the user and ask for their confirmation or feedback.
- **Do not proceed** to coding until the user approves the plan.

### 3. Implementation Workflow Loop

Once the plan is confirmed, execute the following workflow:

#### Step A: Branch Creation
- Check the current Git branch:
  ```bash
  git branch --show-current
  ```
- If the current branch is `main` or `master`:
  - Create and checkout a new branch named after the story (e.g., `feature/issue-<id>-<short-description>`):
    ```bash
    git checkout -b feature/issue-<id>-<short-description>
    ```

#### Step B: Implement & Write Unit Tests
- Implement the requested feature changes.
- Write corresponding unit tests to verify the implementation.
- Run the project's test suite and ensure all tests pass successfully.

#### Step C: Code Review & Comments
- Review the implemented code (e.g., via `git diff`).
- Formulate specific code comments/review notes addressing:
  - Code readability and patterns.
  - Edge cases, error handling, and performance.
  - Security, authorization, and boundaries.

#### Step D: Fix Comments
- Modify the code to address all review comments.
- Run unit tests again to verify no regressions.
- Repeat the Review and Fix steps (Steps C & D) until there are no remaining code comments or issues.

#### Step E: Lint, Push, and PR Creation
- Run the repository's linter and formatter commands (e.g., `npm run lint`, `make lint`, `npm run format`) and fix any issues.
- Push the local branch to the remote repository:
  ```bash
  git push -u origin <branch-name>
  ```
- Create a Pull Request (PR) linking to the issue:
  ```bash
  gh pr create --title "<Issue Title>" --body "Closes #<Issue ID>" --web
  ```
  *(Omit `--web` if running non-interactively, or check if the command outputs a URL directly).*
- Present the final PR link clearly to the user.
