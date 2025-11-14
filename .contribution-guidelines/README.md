# Contribution Guidelines

This directory contains AI instructions extracted from RFC (Request for Comments) discussions that have been approved and landed in the project.

## How It Works

This directory is automatically maintained by the GitHub Actions workflow `.github/workflows/generate-claude-md.yml`. The workflow:

1. Monitors discussions in the "Contribution RFC" category
2. When a discussion receives the `RFC:Landed` label, its "## AI Instructions" section is extracted
3. Creates/updates a markdown file in this directory with the extracted content
4. Generates the root `CLAUDE.md` file with links to all RFC files
5. Creates a PR for human review

## File Naming Convention

RFC files are named based on the discussion title:
- Convert to lowercase
- Replace spaces with hyphens
- Remove special characters

Example: "Testing Strategy" → `testing-strategy.md`

## Structure

Each RFC file contains:
- Title of the RFC as a header
- AI Instructions extracted from the discussion

## Adding New RFCs

To add a new RFC to this system:

1. Create or edit a discussion in the "Contribution RFC" category
2. Add a section titled `## AI Instructions` with the guidance for AI coding assistants
3. Add the `RFC:Landed` label to the discussion
4. The workflow will automatically create a PR with the changes

## Removing RFCs

To remove an RFC:
1. Remove the `RFC:Landed` label from the discussion
2. The workflow will automatically create a PR that removes the file

## Manual Updates

While files are auto-generated, if you need to make manual corrections:
1. Edit the source discussion on GitHub
2. The workflow will regenerate the files on the next trigger
