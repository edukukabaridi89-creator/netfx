#!/bin/bash
# Push current changes to GitHub using the stored GITHUB_TOKEN secret.
# Usage: bash scripts/push-to-github.sh "your commit message"

set -e

MSG="${1:-"Update from Replit $(date '+%Y-%m-%d %H:%M')"}"
REPO_URL="https://edukukabaridi89-creator:${GITHUB_TOKEN}@github.com/edukukabaridi89-creator/netfx.git"

# Stage all changes
git add -A

# Commit (skip if nothing to commit)
git diff --cached --quiet && echo "Nothing new to commit." && exit 0

GIT_AUTHOR_NAME="Replit Agent" \
GIT_AUTHOR_EMAIL="agent@replit.com" \
GIT_COMMITTER_NAME="Replit Agent" \
GIT_COMMITTER_EMAIL="agent@replit.com" \
git commit -m "$MSG"

# Push using token-embedded URL
git push "$REPO_URL" HEAD:main

echo "✅ Pushed to GitHub successfully."
