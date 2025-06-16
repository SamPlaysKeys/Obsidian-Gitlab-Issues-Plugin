# Obsidian GitLab Issues Plugin

A plugin for Obsidian that creates GitLab issues directly from your markdown notes with project selection.

## Features

- **Project Selection**: Choose from your accessible GitLab projects during issue creation
- **Issue Creation**: Create GitLab issues using file name as title and content as description
- **Frontmatter Integration**: Automatically adds GitLab issue URLs to note frontmatter
- **Configurable Labels**: Set default labels to apply to all created issues
- **Multi-Instance Support**: Works with GitLab.com and self-hosted GitLab instances

## Installation

1. Clone this repository
2. Build the plugin:
   ```bash
   npm install
   npm run build
   ```
3. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins folder:
   ```
   YOUR_VAULT/.obsidian/plugins/obsidian-gitlab-issues-plugin/
   ```
4. Enable the plugin in Obsidian Settings → Community plugins

## Configuration

1. Open Obsidian Settings → Plugin Options → GitLab Issues Plugin
2. Configure:
   - **Personal Access Token**: GitLab token with `api` scope
   - **GitLab URL**: Your GitLab instance URL (defaults to gitlab.com)
   - **Default Labels**: Optional comma-separated labels for issues

## Usage

1. Open a markdown file in Obsidian
2. Run command: "Create GitLab issue from active file"
3. Select a project from the searchable list
4. Issue is created and URL added to frontmatter

## Configuration Workflow Flowchart
```mermaid
flowchart TD
    %% Initial Setup and Validation
    A[User opens markdown file] --> B{Plugin configured?}
    B -->|No| C[Show configuration error]
    B -->|Yes| D[User runs Create GitLab issue command]
    
    %% File Validation
    D --> E[Validate active file]
    E --> F{Is .md file?}
    F -->|No| G[Show file type error]
    F -->|Yes| H[Show project picker modal]
    
    %% Project Selection
    H --> I[Load user's GitLab projects]
    I --> J{API call successful?}
    J -->|No| K[Show API error message]
    J -->|Yes| L[Display projects in searchable list]
    
    L --> M[User searches/selects project]
    M --> N{Project selected?}
    N -->|No| O[Cancel operation]
    N -->|Yes| P[Extract file title and content]
    
    %% Issue Creation Process
    P --> Q[Transform markdown content]
    Q --> R[Create GitLab issue via API]
    R --> S{Issue creation successful?}
    S -->|No| T[Show creation error]
    S -->|Yes| U[Update file frontmatter with issue URL]
    
    %% Final Steps
    U --> V{Frontmatter update successful?}
    V -->|No| W[Show success with warning]
    V -->|Yes| X[Show success message with issue URL]
    
    %% Terminal states - all paths lead to end
    C --> Z[End]
    G --> Z
    K --> Z
    O --> Z
    T --> Z
    W --> Z
    X --> Z
    
    %% Styling
    classDef errorState fill:#ffcccc,stroke:#cc0000
    classDef successState fill:#ccffcc,stroke:#00cc00
    classDef processState fill:#ccccff,stroke:#0000cc
    classDef decisionState fill:#ffffcc,stroke:#cccc00
    
    class C,G,K,T errorState
    class X,W successState
    class A,D,E,H,I,L,M,P,Q,R,U processState
    class B,F,J,N,S,V decisionState
```

## Example

**Before:**
```markdown

# Bug Report

Description of the bug...
```

**After:**
```markdown
---
gitlab_issue_url: "https://gitlab.com/your-project/-/issues/123"
---
# Bug Report

Description of the bug...
```

## Development

```bash
# Setup
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build
```

## Contributing

Contributions welcome! Please test with multiple GitLab configurations before submitting.
