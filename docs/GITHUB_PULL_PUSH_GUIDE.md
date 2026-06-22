# PID hcms - GitHub Pull and Push Guide

Use this file when you want to extract the project from GitHub, update your local copy, commit changes, and push them back.

## 1. Repository Details

| Item | Value |
| --- | --- |
| GitHub Remote | `https://github.com/Ax-Tr/PID-HCMS.git` |
| Target Branch | `main` |
| Local Workspace | `e:\HRMS_application` |

## 2. First-Time Extract From GitHub

Use this when the project is not yet available on your machine.

```powershell
cd e:\
git clone https://github.com/Ax-Tr/PID-HCMS.git HRMS_application
cd e:\HRMS_application
git branch
git status
```

Switch to the main branch:

```powershell
git checkout main
```

If `main` does not exist locally yet:

```powershell
git fetch origin
git checkout -b main origin/main
```

## 3. Pull Latest Changes From GitHub

Run this before starting new work.

```powershell
cd e:\HRMS_application
git status
git fetch origin
git checkout main
git pull origin main
```

If Git says you have local uncommitted changes, either commit them first or temporarily stash them:

```powershell
git stash push -m "temporary local changes before pull"
git checkout main
git pull origin main
git stash pop
```

After `git stash pop`, resolve any conflicts if Git reports them.

## 4. Check What Will Be Committed

Always review changes before staging.

```powershell
cd e:\HRMS_application
git status
git diff --stat
```

For a detailed file diff:

```powershell
git diff
```

For staged changes:

```powershell
git diff --cached
```

## 5. Stage Files

Stage all intended changes:

```powershell
git add .
```

Or stage selected files only:

```powershell
git add docs/02_TRD_Technical_Requirements.md README-LOCAL.md
```

Important checks before staging:

- Do not commit real secrets.
- Do not commit production `.env` files.
- Do not commit `node_modules`, `.next`, logs, or build output.
- Be careful with `backend/prisma/dev.db`. Commit it only if the team intentionally wants the SQLite sample database versioned. Otherwise, leave database changes out of the commit.

To unstage a file:

```powershell
git restore --staged <file-path>
```

Example:

```powershell
git restore --staged backend/prisma/dev.db
```

## 6. Commit Changes

Use a clear message.

```powershell
git commit -m "Add TRD and local GitHub workflow documentation"
```

Other useful examples:

```powershell
git commit -m "Add compliance audit report center"
git commit -m "Add role-based dashboards and report exports"
git commit -m "Improve user-facing success and error messages"
```

## 7. Push Changes To GitHub

Push directly to the `main` branch:

```powershell
git push origin main
```

If Git says the upstream branch is not configured:

```powershell
git push -u origin main
```

If Git rejects the push because remote `main` has new changes, pull first, resolve conflicts if needed, then push again:

```powershell
git pull origin main
git push origin main
```

## 8. Optional Pull Request Flow

If your team does not allow direct pushes to `main`, create a feature branch and open a pull request instead.

Create and push a branch:

```powershell
git checkout main
git pull origin main
git checkout -b feature/describe-your-change
git add .
git commit -m "Describe the completed change"
git push -u origin feature/describe-your-change
```

Then open GitHub:

```text
https://github.com/Ax-Tr/PID-HCMS
```

Create a pull request from your feature branch into:

```text
main
```

Use this pull request checklist:

- Summary of features added.
- Test commands run.
- Screenshots for dashboard/report UI changes.
- Notes about database or seed changes.
- Known limitations or follow-up items.

## 9. Authentication Notes

If GitHub asks for login:

- Username: your GitHub username.
- Password: use a GitHub Personal Access Token, not your normal GitHub password.

Generate a token from:

```text
GitHub -> Settings -> Developer settings -> Personal access tokens
```

Minimum token permission for this repo:

```text
Contents: Read and Write
```

## 10. Conflict Resolution Basics

If `git pull` or `git stash pop` reports conflicts:

```powershell
git status
```

Open each conflicted file, resolve the conflict markers, then:

```powershell
git add <resolved-file>
git commit -m "Resolve merge conflicts"
```

Conflict markers look like this:

```text
<<<<<<< HEAD
local version
=======
incoming version
>>>>>>> origin/branch-name
```

Keep the correct final code and remove the marker lines.

## 11. Recommended Full Flow

Use this daily flow for normal development.

```powershell
cd e:\HRMS_application
git status
git fetch origin
git checkout main
git pull origin main

# make code or documentation changes

git status
git diff --stat
git add .
git status
git commit -m "Describe the completed change"
git push origin main
```

## 12. Release-Ready Push Flow

Before pushing a production-ready HRMS change:

```powershell
cd e:\HRMS_application\backend
npm test

cd e:\HRMS_application\frontend
npm run build

cd e:\HRMS_application
git status
git add .
git commit -m "Prepare HRMS production release updates"
git push origin main
```

If tests fail, fix the issue before committing the release branch.
