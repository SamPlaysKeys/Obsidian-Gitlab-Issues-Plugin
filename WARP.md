# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that creates GitLab issues directly from markdown notes. The plugin allows users to:
- Select from accessible GitLab projects dynamically
- Create issues with file name as title and content as description
- Automatically update note frontmatter with issue URLs
- Support both GitLab.com and self-hosted instances

## Development Commands

### Setup
```bash
npm install
```

### Build Commands
```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Watch mode (alternative)
npm run watch
```

### Makefile Shortcuts
```bash
# Install dependencies
make install

# Development watch mode
make watch

# Production build
make build
```

### Testing in Obsidian
After building, copy these files to your vault's plugins folder:
```bash
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-gitlab-issues-plugin/
```

Then reload Obsidian or restart with Developer Console open to see logs.

## Code Architecture

### File Structure
- **`main.ts`** - Main plugin class, settings tab, and ProjectPickerModal
- **`types.ts`** - GitLab API types and `fetchUserProjects()` utility
- **`styles.css`** - Custom CSS for project picker modal and settings UI
- **`rollup.config.js`** - Build configuration (TypeScript → CommonJS)
- **`manifest.json`** - Plugin metadata (id, version, author)

### Core Components

#### 1. GitLabPlugin (main.ts)
The main plugin class extends Obsidian's `Plugin`:
- **Settings Management**: Loads/saves token, labels, and GitLab URL
- **Command Registration**: Registers "Create GitLab issue from active file" command
- **Issue Creation Flow**: Validates file → shows project picker → creates issue → updates frontmatter

Key methods:
- `createIssueFromActiveFile()` - Entry point for issue creation
- `triggerIssueCreation(file, projectId)` - Handles actual issue creation
- `createGitLabIssue(title, content, projectId)` - Makes GitLab API POST request
- `transformMarkdownForGitLab(content)` - Strips frontmatter, converts wikilinks
- `updateNoteFrontmatter(file, issueUrl)` - Adds/updates `gitlab_issue_url` field

#### 2. ProjectPickerModal (main.ts)
Extends `FuzzySuggestModal<GitLabProject>` for searchable project selection:
- **Promise-based API**: `selectProject()` returns `Promise<GitLabProject | null>`
- **Async Loading**: Fetches projects on open with caching
- **Custom Rendering**: Shows project name, path, and description

Selection flow:
1. Modal opens and calls `loadProjectsAsync()`
2. `fetchUserProjects()` retrieves all accessible projects (with pagination)
3. User searches/selects project via fuzzy matching
4. `selectSuggestion()` stores selection and closes modal
5. `onClose()` resolves promise with selected project

#### 3. GitLab API Integration (types.ts)

**`fetchUserProjects(token, baseUrl)`** - Fetches all user projects with pagination:
- Uses `GET /api/v4/projects?membership=true&simple=true&per_page=100&page={n}`
- Handles pagination via `X-Next-Page` header
- Returns `GitLabProject[]` with id, name, path_with_namespace, description, web_url
- 30-second timeout with comprehensive error handling

**Issue Creation** (in main.ts):
- Uses `POST /api/v4/projects/{projectId}/issues`
- Sends: `{ title, description, labels }`
- Returns: Issue object with `web_url`

### Settings Architecture

**GitLabSettings interface:**
```typescript
{
  token: string;           // Personal Access Token (api scope)
  defaultLabels: string;   // Comma-separated labels
  gitlabUrl: string;       // Defaults to https://gitlab.com
}
```

**Migration Handling:** The plugin automatically removes deprecated `projectId` setting from older versions during `loadSettings()`.

### Frontmatter Management

The plugin adds `gitlab_issue_url` to note frontmatter:
- **Existing frontmatter**: Updates or adds `gitlab_issue_url` field
- **No frontmatter**: Creates new frontmatter block with `---` delimiters
- Uses regex to detect/modify frontmatter: `/^---[\s\S]*?---/`

## Important Patterns

### Promise-Based Modal Selection
The ProjectPickerModal uses a promise-based pattern for async selection:
```typescript
public selectProject(): Promise<GitLabProject | null> {
  return new Promise(async (resolve) => {
    this.resolvePromise = resolve;
    this.selectedProject = null;
    await this.loadProjectsAsync();
    this.open();
  });
}
```

The promise resolves in `onClose()` after user selects or cancels.

### API Error Handling
Both `fetchUserProjects()` and `createGitLabIssue()` use consistent error handling:
- **401**: Invalid/expired token
- **403**: Access denied / insufficient permissions
- **404**: Project/endpoint not found
- **500+**: GitLab server errors
- **Network errors**: Connection failures, timeouts (30s)

### Content Transformation
`transformMarkdownForGitLab()` performs minimal markdown cleanup:
- Removes YAML frontmatter (`/^---[\s\S]*?---\n?/`)
- Converts Obsidian wikilinks (`[[link]]` → `link`)
- Wraps Obsidian tags in backticks (`#tag` → `` `#tag` ``)
- Provides fallback text if content is empty

## Development Notes

### Build System
- **Bundler**: Rollup with rollup-plugin-typescript2
- **Output**: Single `main.js` file in CommonJS format
- **Source maps**: Inline source maps for debugging
- **External**: Obsidian API not bundled (provided by Obsidian)

### TypeScript Configuration
- **Target**: ES6
- **Module**: ESNext (Rollup handles conversion to CommonJS)
- **Strict mode**: Enabled
- **Declaration files**: Generated (.d.ts files)

### Styling
Custom CSS classes use Obsidian CSS variables for theme compatibility:
- `--text-normal`, `--text-muted`, `--text-faint` for colors
- `--font-monospace` for code/paths
- `--background-secondary` for backgrounds
- `--color-green-rgb`, `--color-orange-rgb` for status indicators

## Testing Workflow

1. Make changes to TypeScript source files
2. Run `npm run dev` for watch mode (auto-rebuilds on changes)
3. Reload Obsidian plugin (Ctrl/Cmd+R or Settings → Community plugins → Reload)
4. Open Developer Console (Ctrl/Cmd+Shift+I) to see console.log output
5. Test with a markdown file using the command palette (Ctrl/Cmd+P)

### Common Test Scenarios
- Test with invalid/missing token → should show clear error
- Test with no active file → should show "No active file" notice
- Test with non-markdown file → should show "not a markdown file" notice
- Test project selection cancellation → should show cancellation notice
- Test successful issue creation → check frontmatter and GitLab issue

## GitLab API Requirements

### Personal Access Token Scopes
The token must have **`api`** scope for:
- Reading user projects (`GET /api/v4/projects`)
- Creating issues (`POST /api/v4/projects/{id}/issues`)

### Rate Limiting
GitLab API has rate limits (typically 600 requests/minute for authenticated users). The plugin's pagination may hit limits if users have 1000+ projects.

## Documentation

See `docs/Feature_Project-Picker.md` for detailed documentation on:
- Motivation for dynamic project selection
- Complete API call specifications
- Modal architecture and state management
- CSS styling details
- Migration from deprecated single-project model
