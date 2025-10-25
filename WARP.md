# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that creates GitLab issues directly from markdown notes. The plugin allows users to:
- Select from accessible GitLab projects dynamically
- **Mark projects as favorites** for quick access (⭐ icon)
- **Search all projects remotely** using `??` prefix for fuzzy search
- Create issues with file name as title and content as description
- Automatically update note frontmatter with issue URLs
- Support both GitLab.com and self-hosted instances
- **Test GitLab connection** directly from settings
- **Toggle token visibility** and copy to clipboard in settings

## Development Commands

### Setup
```bash
npm install
```

### Build Commands
```bash
# Development build with watch mode (esbuild)
npm run dev

# Production build (esbuild)
npm run build

# Watch mode (alternative)
npm run watch
```

**Note**: The plugin now uses esbuild for significantly faster builds compared to the previous Rollup setup.

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

### File Structure (Modular Architecture)
- **`main.ts`** - Main plugin class and orchestration (196 lines, down from 702)
- **`lib/settings.ts`** - Enhanced settings tab with token visibility toggle, copy, and test connection
- **`lib/modal.ts`** - Project picker modal with favorites and remote search (`??` prefix)
- **`lib/utils.ts`** - Shared utilities for API calls, validation, and transformations (359 lines)
- **`types.ts`** - GitLab API type definitions
- **`styles.css`** - Custom CSS with favorites, spinner, and enhanced layouts
- **`esbuild.config.mjs`** - Build configuration (esbuild for fast bundling)
- **`manifest.json`** - Plugin metadata (id, version, author)

### Core Components

#### 1. GitLabPlugin (main.ts)
The main plugin class extends Obsidian's `Plugin` and focuses on orchestration:
- **Settings Management**: Loads/saves settings with backward compatibility (auto-migrates deprecated fields)
- **Command Registration**: Registers "Create GitLab issue from active file" command
- **Issue Creation Flow**: Validates file → shows project picker → creates issue with status bar spinner → updates frontmatter

Key methods:
- `createIssueFromActiveFile()` - Entry point for issue creation
- `createIssueWithProgress(file, projectId)` - Creates issue with animated status bar spinner

**All utility functions moved to `lib/utils.ts` for better modularity**

#### 2. ProjectPickerModal (lib/modal.ts)
Extends `FuzzySuggestModal<GitLabProject>` for searchable project selection with favorites:
- **Promise-based API**: `selectProject()` returns `Promise<GitLabProject | null>`
- **Async Loading**: Fetches projects on open with caching
- **Favorites**: Click star icon to toggle favorites; favorites appear first
- **Remote Search**: Type `??` followed by search term for remote GitLab API search (debounced)
- **Custom Rendering**: Shows project name, path, description, and favorite star

Selection flow:
1. Modal opens and calls `loadProjectsAsync()`
2. `fetchUserProjects()` retrieves all accessible projects (with pagination)
3. Projects sorted with favorites first, then alphabetically
4. User searches locally OR uses `??` for remote search
5. User can toggle favorites by clicking star icon
6. `selectSuggestion()` stores selection and closes modal
7. `onClose()` resolves promise with selected project

#### 3. GitLab API Integration (lib/utils.ts)

**`fetchUserProjects(token, baseUrl)`** - Fetches all user projects with pagination:
- Uses `GET /api/v4/projects?membership=true&simple=true&per_page=100&page={n}`
- Handles pagination via `X-Next-Page` header
- Returns `GitLabProject[]` with id, name, path_with_namespace, description, web_url
- 30-second timeout with comprehensive error handling

**`searchProjects(token, baseUrl, query)`** - Remote project search:
- Uses `GET /api/v4/projects?membership=true&simple=true&search={query}&per_page=50`
- Triggered when user types `??` prefix in project picker
- Debounced (300ms) to avoid excessive API calls
- Merges results with cached projects and deduplicates

**`testConnection(token, baseUrl)`** - Test GitLab connection:
- Uses `GET /api/v4/user` to validate credentials
- Returns success with username or error message
- Used by "Test Connection" button in settings

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
  favProjects: number[];   // Array of favorite project IDs
}
```

**Migration Handling:** The plugin automatically:
- Removes deprecated `projectId` setting from older versions
- Adds `favProjects` array if missing (defaults to empty array)
- Maintains full backward compatibility with existing installations

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
- **Bundler**: esbuild (significantly faster than Rollup)
- **Output**: Single `main.js` file in CommonJS format (25KB optimized)
- **Source maps**: Inline source maps in development, none in production
- **Tree shaking**: Enabled for optimal bundle size
- **External**: Obsidian API not bundled (provided by Obsidian)
- **Watch mode**: Built-in watch mode for rapid development

### TypeScript Configuration
- **Target**: ES2018
- **Module**: ESNext (esbuild handles conversion to CommonJS)
- **Module Resolution**: Bundler mode
- **Strict mode**: Enabled
- **No Emit**: TypeScript only for type-checking; esbuild handles compilation

### Styling
Custom CSS classes use Obsidian CSS variables for theme compatibility:
- `--text-normal`, `--text-muted`, `--text-faint` for colors
- `--font-monospace` for code/paths
- `--background-secondary` for backgrounds
- `--background-modifier-hover` for hover states
- `--color-green-rgb`, `--color-orange-rgb` for status indicators
- `--color-yellow` for favorite stars
- `--interactive-accent` for spinner animation

#### New CSS Classes
- `.gitlab-project-row` - Flex container for project items with favorites
- `.fav-icon` and `.is-fav` - Favorite star icon with active state
- `.gl-spinner` - Animated spinner for status bar
- `.gitlab-status-bar` - Status bar container with flex layout

## Testing Workflow

1. Make changes to TypeScript source files
2. Run `npm run dev` for watch mode (auto-rebuilds on changes)
3. Reload Obsidian plugin (Ctrl/Cmd+R or Settings → Community plugins → Reload)
4. Open Developer Console (Ctrl/Cmd+Shift+I) to see console.log output
5. Test with a markdown file using the command palette (Ctrl/Cmd+P)

### Common Test Scenarios
- **Settings Tab:**
  - Toggle token visibility with eye/eye-off icon
  - Copy token to clipboard and verify success notice
  - Test connection with valid/invalid credentials
  - Verify settings persist after reload
- **Project Picker:**
  - Toggle favorites and verify star icon fills
  - Confirm favorites appear at top of list
  - Test `??` prefix for remote search
  - Verify search results merge and deduplicate
- **Issue Creation:**
  - Test with invalid/missing token → should show clear error
  - Test with no active file → should show "No active file" notice
  - Test with non-markdown file → should show "not a markdown file" notice
  - Test project selection cancellation → should show cancellation notice
  - Verify status bar spinner appears and disappears
  - Test successful issue creation → check frontmatter and GitLab issue
  - Test with self-hosted GitLab URL (with/without trailing slash)

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
