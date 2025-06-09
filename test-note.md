---
title: Test Note for GitLab Integration
tags: [test, gitlab]
---

# Test Note for GitLab Integration

This is a test note to demonstrate the GitLab plugin functionality.

## Bug Description

When testing the GitLab integration, the following issues were observed:

- [ ] Issue creation works correctly
- [ ] Frontmatter is updated with GitLab URL
- [ ] Existing frontmatter is preserved

## Steps to Reproduce

1. Create a new note
2. Add some content
3. Run the "Create GitLab issue from active file" command
4. Verify that frontmatter is updated

## Expected Behavior

The plugin should:

- Create a GitLab issue with the note title and content
- Add `gitlab_issue_url` to the frontmatter
- Preserve any existing frontmatter properties
- Show a success notification with the issue URL

## Additional Notes

This test demonstrates how the plugin handles:

- Existing frontmatter (this note already has title and tags)
- Markdown content transformation
- Integration with Obsidian's MetadataCache and Vault APIs

