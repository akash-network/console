#!/bin/bash

set -e

# Configuration
REPO="${GITHUB_REPOSITORY:-akash-network/console}"
CATEGORY_NAME="Contribution RFC"
LABEL_NAME="RFC:Landed"
GUIDELINES_DIR=".contribution-guidelines"
OUTPUT_FILE="CLAUDE.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Function to convert RFC title to filename
# Example: "Testing Strategy" -> "testing-strategy.md"
title_to_filename() {
  local title="$1"
  echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 -]//g' | sed 's/ /-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//'
}

# Function to extract AI Instructions section from discussion body
extract_ai_instructions() {
  local body="$1"
  
  # Use awk to extract the AI Instructions section
  echo "$body" | awk '
    BEGIN { found = 0; content = "" }
    /^## AI Instructions/ { found = 1; next }
    found && /^## / { found = 0 }
    found { 
      if (content != "" || $0 != "") {
        content = content $0 "\n"
      }
    }
    END { 
      # Remove trailing newlines
      gsub(/\n+$/, "", content)
      print content
    }
  '
}

# Main script
main() {
  log_info "Starting CLAUDE.md generation..."
  
  # Check if gh cli is available
  if ! command -v gh &> /dev/null; then
    log_error "gh cli is not installed. Please install it first."
    exit 1
  fi
  
  # Create guidelines directory if it doesn't exist
  mkdir -p "$GUIDELINES_DIR"
  
  # Get the category ID for "Contribution RFC"
  log_info "Fetching category ID for '$CATEGORY_NAME'..."
  CATEGORY_ID=$(gh api graphql -f query='
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        discussionCategories(first: 100) {
          nodes {
            id
            name
          }
        }
      }
    }' -F owner="${REPO%/*}" -F repo="${REPO#*/}" --jq ".data.repository.discussionCategories.nodes[] | select(.name == \"$CATEGORY_NAME\") | .id")
  
  if [ -z "$CATEGORY_ID" ]; then
    log_error "Could not find category '$CATEGORY_NAME'"
    exit 1
  fi
  
  log_info "Found category ID: $CATEGORY_ID"
  
  # Fetch all discussions with RFC:Landed label
  log_info "Fetching discussions with label '$LABEL_NAME'..."
  
  DISCUSSIONS=$(gh api graphql -f query='
    query($owner: String!, $repo: String!, $categoryId: ID!) {
      repository(owner: $owner, name: $repo) {
        discussions(first: 100, categoryId: $categoryId) {
          nodes {
            title
            body
            labels(first: 10) {
              nodes {
                name
              }
            }
          }
        }
      }
    }' -F owner="${REPO%/*}" -F repo="${REPO#*/}" -F categoryId="$CATEGORY_ID" --jq '.data.repository.discussions.nodes')
  
  if [ -z "$DISCUSSIONS" ] || [ "$DISCUSSIONS" = "null" ]; then
    log_warn "No discussions found in category '$CATEGORY_NAME'"
    DISCUSSIONS="[]"
  fi
  
  # Track existing files to clean up removed RFCs
  EXISTING_FILES=()
  if [ -d "$GUIDELINES_DIR" ]; then
    while IFS= read -r file; do
      EXISTING_FILES+=("$file")
    done < <(find "$GUIDELINES_DIR" -name "*.md" -type f)
  fi
  
  # Process each discussion
  log_info "Processing discussions..."
  PROCESSED_FILES=()
  CLAUDE_CONTENT="# Contribution Guidelines\n\nThis file aggregates all RFC (Request for Comments) contribution guidelines that have landed.\n\n"
  RFC_COUNT=0
  
  while read -r discussion; do
    TITLE=$(echo "$discussion" | jq -r '.title')
    BODY=$(echo "$discussion" | jq -r '.body')
    LABELS=$(echo "$discussion" | jq -r '.labels.nodes[].name')
    
    # Check if discussion has RFC:Landed label
    if echo "$LABELS" | grep -q "^${LABEL_NAME}$"; then
      log_info "Processing RFC: $TITLE"
      
      # Extract AI Instructions section
      AI_INSTRUCTIONS=$(extract_ai_instructions "$BODY")
      
      if [ -z "$AI_INSTRUCTIONS" ] || [ "$AI_INSTRUCTIONS" = "null" ]; then
        log_warn "No '## AI Instructions' section found in '$TITLE'. Skipping..."
        continue
      fi
      
      # Generate filename
      FILENAME="$(title_to_filename "$TITLE").md"
      FILEPATH="$GUIDELINES_DIR/$FILENAME"
      PROCESSED_FILES+=("$FILEPATH")
      
      # Create the RFC file
      cat > "$FILEPATH" << EOF
# $TITLE

$AI_INSTRUCTIONS
EOF
      
      log_info "Created/Updated: $FILEPATH"
      
      # Add to CLAUDE.md content
      CLAUDE_CONTENT="${CLAUDE_CONTENT}\n## $TITLE\n\n@$GUIDELINES_DIR/$FILENAME\n"
      RFC_COUNT=$((RFC_COUNT + 1))
    fi
  done < <(echo "$DISCUSSIONS" | jq -c '.[]')
  
  # Remove files for RFCs that no longer have RFC:Landed label
  for existing_file in "${EXISTING_FILES[@]}"; do
    found=false
    for processed_file in "${PROCESSED_FILES[@]}"; do
      if [[ "$existing_file" == "$processed_file" ]]; then
        found=true
        break
      fi
    done
    if [[ "$found" == "false" ]]; then
      log_info "Removing obsolete file: $existing_file"
      rm -f "$existing_file"
    fi
  done
  
  # Generate root CLAUDE.md
  log_info "Generating root $OUTPUT_FILE..."
  echo -e "$CLAUDE_CONTENT" > "$OUTPUT_FILE"
  
  log_info "Successfully generated $OUTPUT_FILE with $RFC_COUNT RFC(s)"
  
  # Check if there are any changes
  if git diff --quiet "$OUTPUT_FILE" "$GUIDELINES_DIR"; then
    log_info "No changes detected"
    echo "no_changes=true" >> "${GITHUB_OUTPUT:-/dev/null}"
  else
    log_info "Changes detected"
    echo "no_changes=false" >> "${GITHUB_OUTPUT:-/dev/null}"
  fi
}

# Run main function
main "$@"
