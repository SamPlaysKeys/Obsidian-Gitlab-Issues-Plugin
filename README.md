# Obsidian GitLab Plugin

A plugin for Obsidian that allows you to create GitLab issues directly from your markdown notes.

## Features

- Create GitLab issues from active markdown files
- Automatically updates note frontmatter with GitLab issue URLs
- Configurable default labels
- Transforms Obsidian-specific markdown for GitLab compatibility

## Setup

## Installation

### Method 1: Manual Installation (Recommended for Development)

1. Download or clone this repository
2. Build the plugin:
   ```bash
   npm install
   npm run build
   ```
3. Copy the built files to your Obsidian vault's plugins folder:
   ```bash
   # Create the plugin directory
   mkdir -p "PATH_TO_YOUR_VAULT/.obsidian/plugins/obsidian-gitlab-plugin"
   
   # Copy the necessary files
   cp main.js manifest.json styles.css "PATH_TO_YOUR_VAULT/.obsidian/plugins/obsidian-gitlab-plugin/"
   ```
4. Restart Obsidian or reload plugins
5. Enable the plugin in Settings → Community plugins

### Method 2: From Obsidian Community Plugins (When Available)

1. Open Settings in Obsidian
2. Go to Community plugins
3. Browse for "GitLab Plugin"
4. Install and enable

## Configuration

After installing the plugin, you need to configure it with your GitLab credentials:

1. Open Obsidian Settings
2. Navigate to "Plugin Options" → "GitLab Plugin"
3. Configure the following settings:

### Required Settings

- **Personal Access Token**: Your GitLab personal access token with `api` scope
  - To create a token: Go to GitLab → User Settings → Access Tokens
  - Select scopes: `api` (full API access)
  - Copy the generated token

- **Project ID**: The GitLab project ID where issues will be created
  - Found in your GitLab project page (usually a number like 12345)
  - Or in the project URL: `gitlab.com/username/project-name` → Settings → General

### Optional Settings

- **Default Labels**: Comma-separated list of labels to apply to all issues
  - Example: `bug,documentation,enhancement`
  - Labels must already exist in your GitLab project

## Usage

1. Open a markdown file in Obsidian
2. Run the command "Create GitLab issue from active file"
3. The plugin will:
   - Create a GitLab issue using the file name as the title
   - Use the file content as the issue description
   - Add the GitLab issue URL to the note's frontmatter

## Frontmatter Integration

After creating a GitLab issue, the plugin automatically updates your note's frontmatter with the issue URL:

```yaml
---
gitlab_issue_url: "https://gitlab.com/your-project/-/issues/123"
---
```

If your note already has frontmatter, the `gitlab_issue_url` property will be added or updated. If no frontmatter exists, it will be created.

## Example

**Before creating issue:**
```markdown
# Bug Report

Description of the bug...
```

**After creating issue:**
```markdown
---
gitlab_issue_url: "https://gitlab.com/your-project/-/issues/123"
---
# Bug Report

Description of the bug...
```

## Development

To build the plugin:

```bash
npm install
npm run build
```

## API Usage

The plugin uses Obsidian's `MetadataCache` and `Vault` APIs to:

- Read and write frontmatter using `app.metadataCache.getFileCache()`
- Modify file content using `app.vault.read()` and `app.vault.modify()`
- Preserve existing frontmatter structure while adding GitLab issue URLs

