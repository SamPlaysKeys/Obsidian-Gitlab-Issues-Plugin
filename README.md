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

### Initial Setup for Contributors

When cloning this repository for development:

```bash
# Clone the repository
git clone <repository-url>
cd obsidian-gitlab-plugin

# Install dependencies
npm install

# Build the plugin
npm run build
```

### Development Workflow

1. **Install Dependencies**: 
   ```bash
   npm install
   ```
   This recreates the `node_modules` directory with all required packages.

2. **Build for Development**:
   ```bash
   npm run dev
   # or
   npm run watch
   ```
   This starts Rollup in watch mode, automatically rebuilding when you change TypeScript files.

3. **One-time Build**:
   ```bash
   npm run build
   ```
   Generates the final `main.js` file from TypeScript sources.

4. **Testing Changes**:
   - Copy `main.js`, `manifest.json`, and `styles.css` to your test vault's plugin directory
   - Reload Obsidian or use the "Reload app without saving" command
   - Test your changes in Obsidian

### Project Structure

```
obsidian-gitlab-plugin/
├── main.ts              # Main plugin source code
├── manifest.json        # Plugin metadata
├── package.json         # Dependencies and scripts
├── package-lock.json    # Locked dependency versions
├── tsconfig.json        # TypeScript configuration
├── rollup.config.js     # Build configuration
├── styles.css           # Plugin styles (if any)
├── .gitignore           # Git ignore rules
└── node_modules/       # Dependencies (auto-generated, not in Git)
```

### Important Notes

- **`node_modules` is not tracked in Git** - It's regenerated via `npm install`
- **`main.js` is not tracked in Git** - It's built from `main.ts` via the build process
- **Always run `npm install`** after cloning or pulling changes
- **Use `npm run dev`** during development for automatic rebuilding

## API Usage

The plugin uses Obsidian's `MetadataCache` and `Vault` APIs to:

- Read and write frontmatter using `app.metadataCache.getFileCache()`
- Modify file content using `app.vault.read()` and `app.vault.modify()`
- Preserve existing frontmatter structure while adding GitLab issue URLs

## Current Issues / Limitations

### Scope Limitations
The application is currently limited in scope and may not meet the needs of most users:

- **Single Project Limitation**: The plugin is currently designed for a single GitLab project per vault
- **No Project Selection**: Users cannot dynamically choose which project to create issues in
- **Limited Workflow Support**: Most users work across multiple projects and need more flexible project management

## Requested Features / Next Steps

### High Priority
1. **Account-Based Architecture**: Investigate shifting from project-based to account-based authentication
   - This would allow access to multiple projects under a GitLab account
   - Better aligns with typical user workflows

2. **Project Selection UI**: Add a dropdown or selection menu during issue creation
   - Allow users to choose which project to create the issue in
   - Could include recent projects or favorites for quick access
   - Display project names alongside IDs for better UX

### Medium Priority
3. **Group-Based Filtering**: Add option to limit project selection to a specific GitLab group
   - Helps organize projects for users in large organizations
   - Reduces clutter in project selection UI
   - Configurable per vault or globally

### Future Considerations
4. **Continuous Sync Function** *(Maybe)*: Add regular synchronization capabilities
   - Sync issue status updates back to Obsidian notes
   - Update frontmatter with issue state changes
   - Optional background sync with configurable intervals
   - **Note**: This would significantly increase complexity and may impact performance

### Technical Considerations
- Moving to account-based auth will require OAuth flow or personal access tokens with broader scope
- Project selection UI will need integration with GitLab API to fetch available projects
- Group filtering requires additional API calls to fetch group memberships
- Sync functionality would need robust error handling and conflict resolution

## Contributing

Contributions are welcome, especially for the features listed above. Please:
1. Open an issue to discuss major changes
2. Follow existing code style and patterns
3. Add appropriate error handling and user feedback
4. Test with multiple GitLab configurations
