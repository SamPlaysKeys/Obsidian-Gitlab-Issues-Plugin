# Feature Documentation: Project Picker

## Motivation

The Project Picker feature addresses a critical limitation in the GitLab Plugin's original design. Initially, the plugin required users to configure a single, fixed project ID in the settings, which severely limited its usefulness for users who work across multiple GitLab projects.

### Problems with the Original Approach
- **Single Project Limitation**: Users could only create issues in one pre-configured project
- **Poor User Experience**: Changing projects required navigating to settings and manually updating the project ID
- **Scalability Issues**: Impractical for users working across multiple repositories or organizations
- **Discovery Challenge**: Users needed to know the exact numeric project ID, which is not user-friendly

### Solution Benefits
- **Multi-Project Support**: Users can create issues in any GitLab project they have access to
- **Dynamic Selection**: Project selection happens at issue creation time, not in settings
- **User-Friendly Interface**: Fuzzy search with project names, paths, and descriptions
- **Account-Based Architecture**: Leverages personal access tokens for broader project access

## Usage

### Command Flow

The Project Picker is integrated into the main issue creation workflow:

1. **Trigger Issue Creation**
   - User opens a markdown file in Obsidian
   - Executes command: "Create GitLab issue from active file"
   - Plugin validates that a Personal Access Token is configured

2. **Project Selection Modal**
   - ProjectPickerModal opens automatically
   - Displays fuzzy search interface with placeholder: "Type to search for projects..."
   - [Screenshot placeholder: Project picker modal with search interface]

3. **Project Loading**
   - Modal fetches user's accessible projects via GitLab API
   - Displays loading state: "Loading projects..."
   - [GIF placeholder: Loading animation and project list population]

4. **Search and Selection**
   - User types to filter projects using fuzzy search
   - Projects display with:
     - **Project Name** (main title, bold)
     - **Path with Namespace** (e.g., `group/subgroup/project`)
     - **Description** (if available, truncated to 2 lines)
   - [Screenshot placeholder: Project list with multiple projects shown]

5. **Project Selection**
   - User clicks or presses Enter on desired project
   - Modal closes and returns selected project
   - [Screenshot placeholder: Selected project highlighted]

6. **Issue Creation**
   - Plugin proceeds with GitLab issue creation using selected project ID
   - Success notification displays with issue URL
   - Note frontmatter updated with `gitlab_issue_url`

### Error Handling

- **No Projects Found**: "No projects found. Make sure you have access to GitLab projects."
- **API Errors**: Specific error messages for 401 (invalid token), 403 (permissions), etc.
- **Network Issues**: "Network error: Unable to connect to GitLab"
- **User Cancellation**: "No project selected. Issue creation cancelled."

### Keyboard Navigation

- **Arrow Keys**: Navigate through project list
- **Enter**: Select highlighted project
- **Escape**: Cancel selection and close modal
- **Type**: Filter projects with fuzzy search

## Developer Notes

### API Calls

The Project Picker makes the following GitLab API calls:

#### 1. Fetch User Projects
```typescript
GET {baseUrl}/api/v4/projects?membership=true&simple=true&per_page=100&page={n}
```

**Headers:**
```typescript
{
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

**Query Parameters:**
- `membership=true`: Only return projects user is a member of
- `simple=true`: Return simplified project objects (reduces bandwidth)
- `per_page=100`: Maximum projects per page
- `page={n}`: Page number for pagination

**Response Format:**
```typescript
interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
}
```

#### 2. Pagination Handling
- Uses GitLab's `X-Next-Page` header when available
- Falls back to checking if returned results < `per_page`
- Maximum page limit of 100 to prevent infinite loops
- Aggregates all projects from multiple pages into single array

#### 3. Error Handling
- **401 Unauthorized**: "Invalid or expired GitLab Personal Access Token"
- **403 Forbidden**: "Access denied. Please ensure your token has 'api' scope permissions"
- **404 Not Found**: "GitLab API endpoint not found"
- **500+ Server Errors**: "GitLab server error. Please try again later"
- **Network Errors**: "Network error: Unable to connect to GitLab"
- **Timeout**: 30-second timeout with AbortSignal

### Modal Architecture

#### Class Structure
```typescript
class ProjectPickerModal extends FuzzySuggestModal<GitLabProject>
```

**Key Components:**
- **Inheritance**: Extends Obsidian's `FuzzySuggestModal` for built-in fuzzy search
- **Generic Type**: Parameterized with `GitLabProject` interface
- **Promise-Based**: Returns `Promise<GitLabProject | null>` for async selection

#### Core Methods

1. **`selectProject(): Promise<GitLabProject | null>`**
   - Public API for triggering project selection
   - Returns Promise that resolves when user selects or cancels
   - Manages Promise resolution through private `resolvePromise` callback

2. **`loadProjectsAsync(): Promise<void>`**
   - Asynchronous project loading with caching
   - Prevents multiple simultaneous API calls
   - Updates modal state when projects are loaded

3. **`getItems(): GitLabProject[]`**
   - Required by FuzzySuggestModal interface
   - Returns cached projects or empty array if still loading
   - Synchronous method called by Obsidian's fuzzy search engine

4. **`renderSuggestion(fuzzyMatch, el): void`**
   - Custom rendering for each project item
   - Creates structured HTML with CSS classes for styling
   - Displays project name, path, and description

#### State Management

```typescript
private resolvePromise!: (project: GitLabProject | null) => void;
private cachedProjects: GitLabProject[] | null = null;
private isLoading = false;
private token: string;
private baseUrl: string;
```

- **`resolvePromise`**: Callback to resolve the selection Promise
- **`cachedProjects`**: In-memory cache of fetched projects
- **`isLoading`**: Prevents duplicate API calls
- **`token`** and **`baseUrl`**: GitLab API configuration

#### CSS Classes and Styling

The modal uses custom CSS classes defined in `styles.css`:

```css
.gitlab-project-suggestion {
  padding: 8px 12px;
  border-radius: 4px;
  margin: 2px 0;
}

.gitlab-project-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-normal);
  margin-bottom: 2px;
}

.gitlab-project-path {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-monospace);
  margin-bottom: 4px;
}

.gitlab-project-description {
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1.3;
  max-height: 2.6em;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
```

#### Integration Points

1. **Main Plugin Integration**
   ```typescript
   // In GitLabPlugin.createIssueFromActiveFile()
   const projectPicker = new ProjectPickerModal(this.app, this.settings.token, this.settings.gitlabUrl);
   const selectedProject = await projectPicker.selectProject();
   ```

2. **Issue Creation Handoff**
   ```typescript
   // Pass selected project ID to issue creation
   this.triggerIssueCreation(activeFile, selectedProject.id);
   ```

### Performance Considerations

- **Caching**: Projects are cached after first load to avoid repeated API calls
- **Pagination**: Efficiently handles large numbers of projects
- **Lazy Loading**: Projects load only when modal is opened
- **Timeout**: 30-second API timeout prevents hanging requests
- **Memory Management**: Modal cleans up state when closed

## Migration Notes

### Removed `projectId` Configuration

As part of implementing the Project Picker, the deprecated `projectId` setting has been completely removed from the plugin configuration.

#### What Was Removed

1. **Settings Interface**: `projectId: string` field removed from `GitLabSettings`
2. **Default Settings**: `projectId: ''` removed from `DEFAULT_SETTINGS`
3. **Settings UI**: Project ID input field removed from settings tab
4. **Validation**: Project ID validation logic removed

#### Migration Handling

The plugin includes automatic migration logic to clean up legacy configurations:

```typescript
async loadSettings() {
  const savedData = await this.loadData();
  
  // Migration: Remove deprecated projectId field if it exists in saved data
  if (savedData && 'projectId' in savedData) {
    console.log('Migrating settings: removing deprecated projectId field');
    delete savedData.projectId;
  }
  
  // Merge with defaults, ensuring only valid settings are preserved
  this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
}
```

#### User Impact

- **Existing Users**: Plugin will automatically remove the old `projectId` setting
- **No Data Loss**: Migration preserves all other settings (token, labels, GitLab URL)
- **Seamless Transition**: Users will see the new project selection flow on next use
- **Settings Cleanup**: Old project ID configuration UI is no longer visible

#### Benefits of Removal

1. **Simplified Configuration**: Fewer settings for users to manage
2. **Better UX**: No need to manually look up and enter project IDs
3. **Flexibility**: Can create issues in any accessible project
4. **Reduced Errors**: Eliminates invalid project ID configuration issues

The migration ensures a smooth transition from the old single-project model to the new dynamic project selection approach, maintaining backward compatibility while improving the user experience.

