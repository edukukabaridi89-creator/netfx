#!/bin/bash
# Push current changes to GitHub using the stored GITHUB_PERSONAL_ACCESS_TOKEN secret.
# Usage: bash scripts/push-to-github.sh "your commit message"

set -e

MSG="${1:-"Update from Replit $(date '+%Y-%m-%d %H:%M')"}"
REPO_URL="https://edukukabaridi89-creator:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/edukukabaridi89-creator/netfx.git"

# Stage all changes
git add -A

# Commit only if there are staged changes
if git diff --cached --quiet; then
    echo "No new changes to commit, checking for unpushed commits..."
else
    GIT_AUTHOR_NAME="Replit Agent" \
    GIT_AUTHOR_EMAIL="agent@replit.com" \
    GIT_COMMITTER_NAME="Replit Agent" \
    GIT_COMMITTER_EMAIL="agent@replit.com" \
    git commit -m "$MSG"
fi

# Always push HEAD to main
echo "Pushing to GitHub..."
git push "$REPO_URL" HEAD:main

echo "✅ Pushed to GitHub successfully."
