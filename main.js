'use strict';

var obsidian = require('obsidian');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const DEFAULT_SETTINGS = {
    token: '',
    projectId: '',
    defaultLabels: ''
};
class GitLabPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            // This adds a settings tab so the user can configure various aspects of the plugin
            this.addSettingTab(new SettingsTab(this.app, this));
            // Command to create GitLab issue from active markdown file
            this.addCommand({
                id: 'create-gitlab-issue',
                name: 'Create GitLab issue from active file',
                callback: () => {
                    this.createIssueFromActiveFile();
                }
            });
            // This adds a simple command that can be triggered anywhere
            this.addCommand({
                id: 'open-gitlab-sample-modal',
                name: 'Open GitLab sample modal',
                callback: () => {
                    console.log('GitLab plugin command executed!');
                }
            });
        });
    }
    onunload() {
        console.log('Unloading GitLab plugin');
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    createIssueFromActiveFile() {
        try {
            // Validate settings before proceeding
            if (!this.validateSettings()) {
                return;
            }
            // Get the active markdown file
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new obsidian.Notice('No active file found. Please open a markdown file first.');
                console.error('No active file found');
                return;
            }
            if (!activeFile.path.endsWith('.md')) {
                new obsidian.Notice('Active file is not a markdown file. Please select a .md file.');
                console.error('Active file is not a markdown file');
                return;
            }
            console.log('Creating GitLab issue from file:', activeFile.path);
            new obsidian.Notice('Creating GitLab issue...');
            this.triggerIssueCreation(activeFile);
        }
        catch (error) {
            console.error('Error in createIssueFromActiveFile:', error);
            new obsidian.Notice('An unexpected error occurred while preparing to create the GitLab issue.');
        }
    }
    triggerIssueCreation(file) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Read file content and title
                const content = yield this.app.vault.read(file);
                const title = file.basename; // Use filename without extension as title
                if (!title.trim()) {
                    new obsidian.Notice('File has no valid title. Cannot create GitLab issue.');
                    return;
                }
                // Create GitLab issue
                const issueUrl = yield this.createGitLabIssue(title, content);
                if (issueUrl) {
                    try {
                        // Update note frontmatter with GitLab issue URL
                        yield this.updateNoteFrontmatter(file, issueUrl);
                        new obsidian.Notice(`GitLab issue created successfully!\nURL: ${issueUrl}`, 8000);
                        console.log('Issue created:', issueUrl);
                    }
                    catch (frontmatterError) {
                        console.error('Error updating frontmatter:', frontmatterError);
                        new obsidian.Notice(`GitLab issue created successfully!\nURL: ${issueUrl}\n\nWarning: Could not update file frontmatter.`, 10000);
                    }
                }
                else {
                    new obsidian.Notice('Failed to create GitLab issue. Please check your settings and try again.');
                }
            }
            catch (error) {
                console.error('Error creating GitLab issue:', error);
                if (error instanceof Error) {
                    new obsidian.Notice(`Error creating GitLab issue: ${error.message}`);
                }
                else {
                    new obsidian.Notice('An unexpected error occurred while creating the GitLab issue.');
                }
            }
        });
    }
    /**
     * Creates a GitLab issue from note title and content
     * @param title - The note title to use as issue title
     * @param content - The markdown content to use as issue description
     * @returns Promise<string | null> - The web_url of the created issue or null if failed
     */
    createGitLabIssue(title, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate required settings - this should already be done, but double-check
                if (!this.settings.token) {
                    console.error('GitLab token not configured');
                    new obsidian.Notice('Please configure your GitLab Personal Access Token in plugin settings');
                    return null;
                }
                if (!this.settings.projectId) {
                    console.error('GitLab project ID not configured');
                    new obsidian.Notice('Please configure your GitLab Project ID in plugin settings');
                    return null;
                }
                // Minimal transformation of markdown content for issue description
                // Remove front matter and clean up basic markdown elements
                const transformedContent = this.transformMarkdownForGitLab(content);
                // Prepare issue data
                const issueData = {
                    title: title,
                    description: transformedContent,
                    labels: this.settings.defaultLabels ? this.settings.defaultLabels.split(',').map(l => l.trim()).filter(l => l) : []
                };
                console.log('Sending GitLab API request with data:', Object.assign(Object.assign({}, issueData), { description: transformedContent.substring(0, 100) + '...' }));
                try {
                    // Send POST request to GitLab API
                    const response = yield fetch(`https://gitlab.com/api/v4/projects/${this.settings.projectId}/issues`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Private-Token': this.settings.token
                        },
                        body: JSON.stringify(issueData)
                    });
                    if (!response.ok) {
                        let errorMessage = `GitLab API request failed with status ${response.status}`;
                        try {
                            const errorData = yield response.json();
                            if (errorData.message) {
                                errorMessage += `: ${errorData.message}`;
                            }
                        }
                        catch (_a) {
                            // If JSON parsing fails, use text
                            const errorText = yield response.text();
                            if (errorText) {
                                errorMessage += `: ${errorText}`;
                            }
                        }
                        console.error('GitLab API error:', response.status, errorMessage);
                        // Provide specific error feedback based on status code
                        if (response.status === 401) {
                            new obsidian.Notice('Authentication failed. Please check your GitLab Personal Access Token.');
                        }
                        else if (response.status === 403) {
                            new obsidian.Notice('Access denied. Please check your token permissions and project access.');
                        }
                        else if (response.status === 404) {
                            new obsidian.Notice('Project not found. Please check your Project ID.');
                        }
                        else if (response.status >= 500) {
                            new obsidian.Notice('GitLab server error. Please try again later.');
                        }
                        else {
                            new obsidian.Notice(`GitLab API error: ${errorMessage}`);
                        }
                        return null;
                    }
                    // Parse JSON response and extract web_url
                    const responseData = yield response.json();
                    console.log('GitLab API response:', responseData);
                    // Validate response data
                    if (!responseData.web_url) {
                        console.error('Invalid GitLab API response: missing web_url');
                        new obsidian.Notice('Invalid response from GitLab API. Issue may have been created but URL is missing.');
                        return null;
                    }
                    // Return the web_url from the response
                    return responseData.web_url;
                }
                catch (networkError) {
                    console.error('Network error calling GitLab API:', networkError);
                    if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
                        new obsidian.Notice('Network error: Unable to connect to GitLab. Please check your internet connection.');
                    }
                    else {
                        new obsidian.Notice(`Network error: ${networkError instanceof Error ? networkError.message : 'Unknown error'}`);
                    }
                    return null;
                }
            }
            catch (error) {
                console.error('Unexpected error in createGitLabIssue:', error);
                new obsidian.Notice('An unexpected error occurred while creating the GitLab issue.');
                return null;
            }
        });
    }
    /**
     * Performs minimal transformation of markdown content for GitLab issue description
     * @param content - Raw markdown content from the note
     * @returns Transformed content suitable for GitLab issues
     */
    transformMarkdownForGitLab(content) {
        // Remove YAML front matter if present
        let transformed = content.replace(/^---[\s\S]*?---\n?/, '');
        // Remove Obsidian-specific wikilinks and convert to regular text
        transformed = transformed.replace(/\[\[([^\]]+)\]\]/g, '$1');
        // Convert Obsidian tags to GitLab mentions (optional transformation)
        transformed = transformed.replace(/#([a-zA-Z0-9_-]+)/g, '`#$1`');
        // Trim extra whitespace
        transformed = transformed.trim();
        // If content is empty after transformation, provide a default message
        if (!transformed) {
            transformed = 'Created from Obsidian note (content was empty)';
        }
        return transformed;
    }
    /**
     * Updates the frontmatter of a note with the GitLab issue URL
     * @param file - The TFile to update
     * @param issueUrl - The GitLab issue web URL to add to frontmatter
     */
    updateNoteFrontmatter(file, issueUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!file || !issueUrl) {
                    throw new Error('Invalid file or issue URL provided');
                }
                // Read the current file content
                const fileContent = yield this.app.vault.read(file);
                if (typeof fileContent !== 'string') {
                    throw new Error('Unable to read file content');
                }
                // Use MetadataCache to check if file already has frontmatter
                const fileCache = this.app.metadataCache.getFileCache(file);
                const hasFrontmatter = (fileCache === null || fileCache === void 0 ? void 0 : fileCache.frontmatter) !== undefined;
                let updatedContent;
                try {
                    if (hasFrontmatter) {
                        // File has existing frontmatter, update it
                        updatedContent = this.addToExistingFrontmatter(fileContent, issueUrl);
                    }
                    else {
                        // File has no frontmatter, create new frontmatter
                        updatedContent = this.createNewFrontmatter(fileContent, issueUrl);
                    }
                }
                catch (frontmatterError) {
                    console.error('Error processing frontmatter:', frontmatterError);
                    throw new Error('Failed to process file frontmatter');
                }
                if (!updatedContent || updatedContent === fileContent) {
                    throw new Error('No changes made to file content');
                }
                // Write the updated content back to the file
                yield this.app.vault.modify(file, updatedContent);
                console.log(`Updated frontmatter for ${file.path} with GitLab issue URL`);
            }
            catch (error) {
                console.error('Error updating note frontmatter:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                throw new Error(`Failed to update note frontmatter: ${errorMessage}`);
            }
        });
    }
    /**
     * Adds GitLab issue URL to existing frontmatter
     * @param content - Current file content with existing frontmatter
     * @param issueUrl - GitLab issue URL to add
     * @returns Updated content with GitLab URL in frontmatter
     */
    addToExistingFrontmatter(content, issueUrl) {
        // Match existing frontmatter block
        const frontmatterMatch = content.match(/^(---\n[\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            // Fallback: create new frontmatter if regex fails
            return this.createNewFrontmatter(content, issueUrl);
        }
        const existingFrontmatter = frontmatterMatch[1];
        const afterFrontmatter = content.slice(frontmatterMatch[0].length);
        // Check if gitlab_issue_url already exists and update it, otherwise add it
        let updatedFrontmatter;
        if (existingFrontmatter.includes('gitlab_issue_url:')) {
            // Replace existing gitlab_issue_url
            updatedFrontmatter = existingFrontmatter.replace(/gitlab_issue_url:.*$/m, `gitlab_issue_url: "${issueUrl}"`);
        }
        else {
            // Add new gitlab_issue_url property
            updatedFrontmatter = existingFrontmatter + `\ngitlab_issue_url: "${issueUrl}"`;
        }
        return updatedFrontmatter + '\n---' + afterFrontmatter;
    }
    /**
     * Creates new frontmatter with GitLab issue URL
     * @param content - Current file content without frontmatter
     * @param issueUrl - GitLab issue URL to add
     * @returns Content with new frontmatter containing GitLab URL
     */
    createNewFrontmatter(content, issueUrl) {
        const newFrontmatter = `---\ngitlab_issue_url: "${issueUrl}"\n---\n`;
        return newFrontmatter + content;
    }
    /**
     * Validates plugin settings and shows appropriate warnings
     * @returns boolean - true if settings are valid, false otherwise
     */
    validateSettings() {
        const issues = [];
        if (!this.settings.token || this.settings.token.trim() === '') {
            issues.push('GitLab Personal Access Token is required');
        }
        if (!this.settings.projectId || this.settings.projectId.trim() === '') {
            issues.push('GitLab Project ID is required');
        }
        // Validate project ID format (should be numeric or namespace/project format)
        if (this.settings.projectId && this.settings.projectId.trim() !== '') {
            const projectId = this.settings.projectId.trim();
            // Allow numeric IDs or namespace/project format
            if (!/^\d+$/.test(projectId) && !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(projectId)) {
                issues.push('Project ID should be either a numeric ID or in "namespace/project" format');
            }
        }
        // Validate token format (basic check)
        if (this.settings.token && this.settings.token.trim() !== '') {
            const token = this.settings.token.trim();
            // GitLab tokens are typically 20-26 characters and alphanumeric with possible dashes/underscores
            if (token.length < 10 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
                issues.push('Personal Access Token format appears invalid');
            }
        }
        if (issues.length > 0) {
            const warningMessage = 'Plugin configuration issues:\n\n' + issues.map(issue => `• ${issue}`).join('\n') + '\n\nPlease update your settings before creating issues.';
            new obsidian.Notice(warningMessage, 10000);
            console.warn('GitLab plugin configuration issues:', issues);
            return false;
        }
        return true;
    }
}
class SettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'GitLab Plugin Settings' });
        // Add validation status indicator
        const statusEl = containerEl.createEl('div', { cls: 'gitlab-plugin-status' });
        this.updateValidationStatus(statusEl);
        new obsidian.Setting(containerEl)
            .setName('Personal Access Token')
            .setDesc('Your GitLab personal access token (required). Create one at GitLab.com → User Settings → Access Tokens')
            .addText(text => {
            text.setPlaceholder('glpat-xxxxxxxxxxxxxxxxxxxx')
                .setValue(this.plugin.settings.token)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                try {
                    this.plugin.settings.token = value;
                    yield this.plugin.saveSettings();
                    this.updateValidationStatus(statusEl);
                }
                catch (error) {
                    console.error('Error saving token:', error);
                    new obsidian.Notice('Failed to save Personal Access Token');
                }
            }));
            // Make it a password field for security
            text.inputEl.type = 'password';
        });
        new obsidian.Setting(containerEl)
            .setName('Project ID')
            .setDesc('The GitLab project ID (required). Can be numeric (e.g., "12345") or namespace/project format (e.g., "mygroup/myproject")')
            .addText(text => text
            .setPlaceholder('12345 or mygroup/myproject')
            .setValue(this.plugin.settings.projectId)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            try {
                this.plugin.settings.projectId = value;
                yield this.plugin.saveSettings();
                this.updateValidationStatus(statusEl);
            }
            catch (error) {
                console.error('Error saving project ID:', error);
                new obsidian.Notice('Failed to save Project ID');
            }
        })));
        new obsidian.Setting(containerEl)
            .setName('Default Labels')
            .setDesc('Comma-separated list of default labels for issues (optional)')
            .addText(text => text
            .setPlaceholder('bug, enhancement, documentation')
            .setValue(this.plugin.settings.defaultLabels)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            try {
                this.plugin.settings.defaultLabels = value;
                yield this.plugin.saveSettings();
            }
            catch (error) {
                console.error('Error saving default labels:', error);
                new obsidian.Notice('Failed to save Default Labels');
            }
        })));
        // Add help section
        const helpEl = containerEl.createEl('div', { cls: 'gitlab-plugin-help' });
        helpEl.createEl('h3', { text: 'Setup Instructions' });
        const helpList = helpEl.createEl('ol');
        helpList.createEl('li', { text: 'Go to GitLab.com → User Settings → Access Tokens' });
        helpList.createEl('li', { text: 'Create a new token with "api" scope' });
        helpList.createEl('li', { text: 'Copy the token and paste it above' });
        helpList.createEl('li', { text: 'Find your project ID in Project Settings → General' });
    }
    updateValidationStatus(statusEl) {
        statusEl.empty();
        const hasToken = this.plugin.settings.token && this.plugin.settings.token.trim() !== '';
        const hasProjectId = this.plugin.settings.projectId && this.plugin.settings.projectId.trim() !== '';
        if (hasToken && hasProjectId) {
            statusEl.createEl('div', {
                text: '✅ Configuration appears valid',
                cls: 'gitlab-status-success'
            });
        }
        else {
            const missing = [];
            if (!hasToken)
                missing.push('Personal Access Token');
            if (!hasProjectId)
                missing.push('Project ID');
            statusEl.createEl('div', {
                text: `⚠️ Missing required fields: ${missing.join(', ')}`,
                cls: 'gitlab-status-warning'
            });
        }
    }
}

module.exports = GitLabPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIE5vdGljZSB9IGZyb20gJ29ic2lkaWFuJztcblxuaW50ZXJmYWNlIEdpdExhYlNldHRpbmdzIHtcblx0dG9rZW46IHN0cmluZztcblx0cHJvamVjdElkOiBzdHJpbmc7XG5cdGRlZmF1bHRMYWJlbHM6IHN0cmluZztcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogR2l0TGFiU2V0dGluZ3MgPSB7XG5cdHRva2VuOiAnJyxcblx0cHJvamVjdElkOiAnJyxcblx0ZGVmYXVsdExhYmVsczogJydcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEdpdExhYlBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG5cdHNldHRpbmdzITogR2l0TGFiU2V0dGluZ3M7XG5cblx0YXN5bmMgb25sb2FkKCkge1xuXHRcdGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cblx0XHQvLyBUaGlzIGFkZHMgYSBzZXR0aW5ncyB0YWIgc28gdGhlIHVzZXIgY2FuIGNvbmZpZ3VyZSB2YXJpb3VzIGFzcGVjdHMgb2YgdGhlIHBsdWdpblxuXHRcdHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuXHRcdC8vIENvbW1hbmQgdG8gY3JlYXRlIEdpdExhYiBpc3N1ZSBmcm9tIGFjdGl2ZSBtYXJrZG93biBmaWxlXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiAnY3JlYXRlLWdpdGxhYi1pc3N1ZScsXG5cdFx0XHRuYW1lOiAnQ3JlYXRlIEdpdExhYiBpc3N1ZSBmcm9tIGFjdGl2ZSBmaWxlJyxcblx0XHRcdGNhbGxiYWNrOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY3JlYXRlSXNzdWVGcm9tQWN0aXZlRmlsZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gVGhpcyBhZGRzIGEgc2ltcGxlIGNvbW1hbmQgdGhhdCBjYW4gYmUgdHJpZ2dlcmVkIGFueXdoZXJlXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiAnb3Blbi1naXRsYWItc2FtcGxlLW1vZGFsJyxcblx0XHRcdG5hbWU6ICdPcGVuIEdpdExhYiBzYW1wbGUgbW9kYWwnLFxuXHRcdFx0Y2FsbGJhY2s6ICgpID0+IHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0dpdExhYiBwbHVnaW4gY29tbWFuZCBleGVjdXRlZCEnKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG9udW5sb2FkKCkge1xuXHRcdGNvbnNvbGUubG9nKCdVbmxvYWRpbmcgR2l0TGFiIHBsdWdpbicpO1xuXHR9XG5cblx0YXN5bmMgbG9hZFNldHRpbmdzKCkge1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuXHR9XG5cblx0YXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuXHRcdGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUlzc3VlRnJvbUFjdGl2ZUZpbGUoKSB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIFZhbGlkYXRlIHNldHRpbmdzIGJlZm9yZSBwcm9jZWVkaW5nXG5cdFx0XHRpZiAoIXRoaXMudmFsaWRhdGVTZXR0aW5ncygpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gR2V0IHRoZSBhY3RpdmUgbWFya2Rvd24gZmlsZVxuXHRcdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0XHRcblx0XHRcdGlmICghYWN0aXZlRmlsZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKCdObyBhY3RpdmUgZmlsZSBmb3VuZC4gUGxlYXNlIG9wZW4gYSBtYXJrZG93biBmaWxlIGZpcnN0LicpO1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCdObyBhY3RpdmUgZmlsZSBmb3VuZCcpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmICghYWN0aXZlRmlsZS5wYXRoLmVuZHNXaXRoKCcubWQnKSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKCdBY3RpdmUgZmlsZSBpcyBub3QgYSBtYXJrZG93biBmaWxlLiBQbGVhc2Ugc2VsZWN0IGEgLm1kIGZpbGUuJyk7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ0FjdGl2ZSBmaWxlIGlzIG5vdCBhIG1hcmtkb3duIGZpbGUnKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRjb25zb2xlLmxvZygnQ3JlYXRpbmcgR2l0TGFiIGlzc3VlIGZyb20gZmlsZTonLCBhY3RpdmVGaWxlLnBhdGgpO1xuXHRcdFx0bmV3IE5vdGljZSgnQ3JlYXRpbmcgR2l0TGFiIGlzc3VlLi4uJyk7XG5cdFx0XHRcblx0XHRcdHRoaXMudHJpZ2dlcklzc3VlQ3JlYXRpb24oYWN0aXZlRmlsZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluIGNyZWF0ZUlzc3VlRnJvbUFjdGl2ZUZpbGU6JywgZXJyb3IpO1xuXHRcdFx0bmV3IE5vdGljZSgnQW4gdW5leHBlY3RlZCBlcnJvciBvY2N1cnJlZCB3aGlsZSBwcmVwYXJpbmcgdG8gY3JlYXRlIHRoZSBHaXRMYWIgaXNzdWUuJyk7XG5cdFx0fVxuXHR9XG5cdFxuXHRwcml2YXRlIGFzeW5jIHRyaWdnZXJJc3N1ZUNyZWF0aW9uKGZpbGU6IFRGaWxlKSB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIFJlYWQgZmlsZSBjb250ZW50IGFuZCB0aXRsZVxuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0XHRjb25zdCB0aXRsZSA9IGZpbGUuYmFzZW5hbWU7IC8vIFVzZSBmaWxlbmFtZSB3aXRob3V0IGV4dGVuc2lvbiBhcyB0aXRsZVxuXHRcdFx0XG5cdFx0XHRpZiAoIXRpdGxlLnRyaW0oKSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKCdGaWxlIGhhcyBubyB2YWxpZCB0aXRsZS4gQ2Fubm90IGNyZWF0ZSBHaXRMYWIgaXNzdWUuJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0Ly8gQ3JlYXRlIEdpdExhYiBpc3N1ZVxuXHRcdFx0Y29uc3QgaXNzdWVVcmwgPSBhd2FpdCB0aGlzLmNyZWF0ZUdpdExhYklzc3VlKHRpdGxlLCBjb250ZW50KTtcblx0XHRcdFxuXHRcdFx0aWYgKGlzc3VlVXJsKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Ly8gVXBkYXRlIG5vdGUgZnJvbnRtYXR0ZXIgd2l0aCBHaXRMYWIgaXNzdWUgVVJMXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy51cGRhdGVOb3RlRnJvbnRtYXR0ZXIoZmlsZSwgaXNzdWVVcmwpO1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UoYEdpdExhYiBpc3N1ZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseSFcXG5VUkw6ICR7aXNzdWVVcmx9YCwgODAwMCk7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ0lzc3VlIGNyZWF0ZWQ6JywgaXNzdWVVcmwpO1xuXHRcdFx0XHR9IGNhdGNoIChmcm9udG1hdHRlckVycm9yKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcignRXJyb3IgdXBkYXRpbmcgZnJvbnRtYXR0ZXI6JywgZnJvbnRtYXR0ZXJFcnJvcik7XG5cdFx0XHRcdFx0bmV3IE5vdGljZShgR2l0TGFiIGlzc3VlIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5IVxcblVSTDogJHtpc3N1ZVVybH1cXG5cXG5XYXJuaW5nOiBDb3VsZCBub3QgdXBkYXRlIGZpbGUgZnJvbnRtYXR0ZXIuYCwgMTAwMDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXcgTm90aWNlKCdGYWlsZWQgdG8gY3JlYXRlIEdpdExhYiBpc3N1ZS4gUGxlYXNlIGNoZWNrIHlvdXIgc2V0dGluZ3MgYW5kIHRyeSBhZ2Fpbi4nKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Y29uc29sZS5lcnJvcignRXJyb3IgY3JlYXRpbmcgR2l0TGFiIGlzc3VlOicsIGVycm9yKTtcblx0XHRcdGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYEVycm9yIGNyZWF0aW5nIEdpdExhYiBpc3N1ZTogJHtlcnJvci5tZXNzYWdlfWApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmV3IE5vdGljZSgnQW4gdW5leHBlY3RlZCBlcnJvciBvY2N1cnJlZCB3aGlsZSBjcmVhdGluZyB0aGUgR2l0TGFiIGlzc3VlLicpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRcblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBHaXRMYWIgaXNzdWUgZnJvbSBub3RlIHRpdGxlIGFuZCBjb250ZW50XG5cdCAqIEBwYXJhbSB0aXRsZSAtIFRoZSBub3RlIHRpdGxlIHRvIHVzZSBhcyBpc3N1ZSB0aXRsZVxuXHQgKiBAcGFyYW0gY29udGVudCAtIFRoZSBtYXJrZG93biBjb250ZW50IHRvIHVzZSBhcyBpc3N1ZSBkZXNjcmlwdGlvblxuXHQgKiBAcmV0dXJucyBQcm9taXNlPHN0cmluZyB8IG51bGw+IC0gVGhlIHdlYl91cmwgb2YgdGhlIGNyZWF0ZWQgaXNzdWUgb3IgbnVsbCBpZiBmYWlsZWRcblx0ICovXG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlR2l0TGFiSXNzdWUodGl0bGU6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIFZhbGlkYXRlIHJlcXVpcmVkIHNldHRpbmdzIC0gdGhpcyBzaG91bGQgYWxyZWFkeSBiZSBkb25lLCBidXQgZG91YmxlLWNoZWNrXG5cdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3MudG9rZW4pIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignR2l0TGFiIHRva2VuIG5vdCBjb25maWd1cmVkJyk7XG5cdFx0XHRcdG5ldyBOb3RpY2UoJ1BsZWFzZSBjb25maWd1cmUgeW91ciBHaXRMYWIgUGVyc29uYWwgQWNjZXNzIFRva2VuIGluIHBsdWdpbiBzZXR0aW5ncycpO1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLnByb2plY3RJZCkge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCdHaXRMYWIgcHJvamVjdCBJRCBub3QgY29uZmlndXJlZCcpO1xuXHRcdFx0XHRuZXcgTm90aWNlKCdQbGVhc2UgY29uZmlndXJlIHlvdXIgR2l0TGFiIFByb2plY3QgSUQgaW4gcGx1Z2luIHNldHRpbmdzJyk7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyBNaW5pbWFsIHRyYW5zZm9ybWF0aW9uIG9mIG1hcmtkb3duIGNvbnRlbnQgZm9yIGlzc3VlIGRlc2NyaXB0aW9uXG5cdFx0XHQvLyBSZW1vdmUgZnJvbnQgbWF0dGVyIGFuZCBjbGVhbiB1cCBiYXNpYyBtYXJrZG93biBlbGVtZW50c1xuXHRcdFx0Y29uc3QgdHJhbnNmb3JtZWRDb250ZW50ID0gdGhpcy50cmFuc2Zvcm1NYXJrZG93bkZvckdpdExhYihjb250ZW50KTtcblx0XHRcdFxuXHRcdFx0Ly8gUHJlcGFyZSBpc3N1ZSBkYXRhXG5cdFx0XHRjb25zdCBpc3N1ZURhdGEgPSB7XG5cdFx0XHRcdHRpdGxlOiB0aXRsZSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IHRyYW5zZm9ybWVkQ29udGVudCxcblx0XHRcdFx0bGFiZWxzOiB0aGlzLnNldHRpbmdzLmRlZmF1bHRMYWJlbHMgPyB0aGlzLnNldHRpbmdzLmRlZmF1bHRMYWJlbHMuc3BsaXQoJywnKS5tYXAobCA9PiBsLnRyaW0oKSkuZmlsdGVyKGwgPT4gbCkgOiBbXVxuXHRcdFx0fTtcblx0XHRcdFxuXHRcdFx0Y29uc29sZS5sb2coJ1NlbmRpbmcgR2l0TGFiIEFQSSByZXF1ZXN0IHdpdGggZGF0YTonLCB7IC4uLmlzc3VlRGF0YSwgZGVzY3JpcHRpb246IHRyYW5zZm9ybWVkQ29udGVudC5zdWJzdHJpbmcoMCwgMTAwKSArICcuLi4nIH0pO1xuXHRcdFx0XG5cdFx0XHR0cnkge1xuXHRcdFx0XHQvLyBTZW5kIFBPU1QgcmVxdWVzdCB0byBHaXRMYWIgQVBJXG5cdFx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYGh0dHBzOi8vZ2l0bGFiLmNvbS9hcGkvdjQvcHJvamVjdHMvJHt0aGlzLnNldHRpbmdzLnByb2plY3RJZH0vaXNzdWVzYCwge1xuXHRcdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdFx0XHQnUHJpdmF0ZS1Ub2tlbic6IHRoaXMuc2V0dGluZ3MudG9rZW5cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KGlzc3VlRGF0YSlcblx0XHRcdFx0fSk7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiAoIXJlc3BvbnNlLm9rKSB7XG5cdFx0XHRcdFx0bGV0IGVycm9yTWVzc2FnZSA9IGBHaXRMYWIgQVBJIHJlcXVlc3QgZmFpbGVkIHdpdGggc3RhdHVzICR7cmVzcG9uc2Uuc3RhdHVzfWA7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IGVycm9yRGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdFx0XHRcdGlmIChlcnJvckRhdGEubWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHRlcnJvck1lc3NhZ2UgKz0gYDogJHtlcnJvckRhdGEubWVzc2FnZX1gO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdFx0XHRcdC8vIElmIEpTT04gcGFyc2luZyBmYWlscywgdXNlIHRleHRcblx0XHRcdFx0XHRcdFx0Y29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuXHRcdFx0XHRcdFx0XHRpZiAoZXJyb3JUZXh0KSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXJyb3JNZXNzYWdlICs9IGA6ICR7ZXJyb3JUZXh0fWA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCdHaXRMYWIgQVBJIGVycm9yOicsIHJlc3BvbnNlLnN0YXR1cywgZXJyb3JNZXNzYWdlKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHQvLyBQcm92aWRlIHNwZWNpZmljIGVycm9yIGZlZWRiYWNrIGJhc2VkIG9uIHN0YXR1cyBjb2RlXG5cdFx0XHRcdFx0aWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDAxKSB7XG5cdFx0XHRcdFx0XHRuZXcgTm90aWNlKCdBdXRoZW50aWNhdGlvbiBmYWlsZWQuIFBsZWFzZSBjaGVjayB5b3VyIEdpdExhYiBQZXJzb25hbCBBY2Nlc3MgVG9rZW4uJyk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwMykge1xuXHRcdFx0XHRcdFx0bmV3IE5vdGljZSgnQWNjZXNzIGRlbmllZC4gUGxlYXNlIGNoZWNrIHlvdXIgdG9rZW4gcGVybWlzc2lvbnMgYW5kIHByb2plY3QgYWNjZXNzLicpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQpIHtcblx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoJ1Byb2plY3Qgbm90IGZvdW5kLiBQbGVhc2UgY2hlY2sgeW91ciBQcm9qZWN0IElELicpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAocmVzcG9uc2Uuc3RhdHVzID49IDUwMCkge1xuXHRcdFx0XHRcdFx0bmV3IE5vdGljZSgnR2l0TGFiIHNlcnZlciBlcnJvci4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci4nKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bmV3IE5vdGljZShgR2l0TGFiIEFQSSBlcnJvcjogJHtlcnJvck1lc3NhZ2V9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHQvLyBQYXJzZSBKU09OIHJlc3BvbnNlIGFuZCBleHRyYWN0IHdlYl91cmxcblx0XHRcdFx0Y29uc3QgcmVzcG9uc2VEYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXHRcdFx0XHRjb25zb2xlLmxvZygnR2l0TGFiIEFQSSByZXNwb25zZTonLCByZXNwb25zZURhdGEpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly8gVmFsaWRhdGUgcmVzcG9uc2UgZGF0YVxuXHRcdFx0XHRpZiAoIXJlc3BvbnNlRGF0YS53ZWJfdXJsKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcignSW52YWxpZCBHaXRMYWIgQVBJIHJlc3BvbnNlOiBtaXNzaW5nIHdlYl91cmwnKTtcblx0XHRcdFx0XHRuZXcgTm90aWNlKCdJbnZhbGlkIHJlc3BvbnNlIGZyb20gR2l0TGFiIEFQSS4gSXNzdWUgbWF5IGhhdmUgYmVlbiBjcmVhdGVkIGJ1dCBVUkwgaXMgbWlzc2luZy4nKTtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Ly8gUmV0dXJuIHRoZSB3ZWJfdXJsIGZyb20gdGhlIHJlc3BvbnNlXG5cdFx0XHRcdHJldHVybiByZXNwb25zZURhdGEud2ViX3VybDtcblx0XHRcdFx0XG5cdFx0XHR9IGNhdGNoIChuZXR3b3JrRXJyb3IpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignTmV0d29yayBlcnJvciBjYWxsaW5nIEdpdExhYiBBUEk6JywgbmV0d29ya0Vycm9yKTtcblx0XHRcdFx0aWYgKG5ldHdvcmtFcnJvciBpbnN0YW5jZW9mIFR5cGVFcnJvciAmJiBuZXR3b3JrRXJyb3IubWVzc2FnZS5pbmNsdWRlcygnZmV0Y2gnKSkge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UoJ05ldHdvcmsgZXJyb3I6IFVuYWJsZSB0byBjb25uZWN0IHRvIEdpdExhYi4gUGxlYXNlIGNoZWNrIHlvdXIgaW50ZXJuZXQgY29ubmVjdGlvbi4nKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXcgTm90aWNlKGBOZXR3b3JrIGVycm9yOiAke25ldHdvcmtFcnJvciBpbnN0YW5jZW9mIEVycm9yID8gbmV0d29ya0Vycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcid9YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Y29uc29sZS5lcnJvcignVW5leHBlY3RlZCBlcnJvciBpbiBjcmVhdGVHaXRMYWJJc3N1ZTonLCBlcnJvcik7XG5cdFx0XHRuZXcgTm90aWNlKCdBbiB1bmV4cGVjdGVkIGVycm9yIG9jY3VycmVkIHdoaWxlIGNyZWF0aW5nIHRoZSBHaXRMYWIgaXNzdWUuJyk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblx0XG5cdC8qKlxuXHQgKiBQZXJmb3JtcyBtaW5pbWFsIHRyYW5zZm9ybWF0aW9uIG9mIG1hcmtkb3duIGNvbnRlbnQgZm9yIEdpdExhYiBpc3N1ZSBkZXNjcmlwdGlvblxuXHQgKiBAcGFyYW0gY29udGVudCAtIFJhdyBtYXJrZG93biBjb250ZW50IGZyb20gdGhlIG5vdGVcblx0ICogQHJldHVybnMgVHJhbnNmb3JtZWQgY29udGVudCBzdWl0YWJsZSBmb3IgR2l0TGFiIGlzc3Vlc1xuXHQgKi9cblx0cHJpdmF0ZSB0cmFuc2Zvcm1NYXJrZG93bkZvckdpdExhYihjb250ZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdC8vIFJlbW92ZSBZQU1MIGZyb250IG1hdHRlciBpZiBwcmVzZW50XG5cdFx0bGV0IHRyYW5zZm9ybWVkID0gY29udGVudC5yZXBsYWNlKC9eLS0tW1xcc1xcU10qPy0tLVxcbj8vLCAnJyk7XG5cdFx0XG5cdFx0Ly8gUmVtb3ZlIE9ic2lkaWFuLXNwZWNpZmljIHdpa2lsaW5rcyBhbmQgY29udmVydCB0byByZWd1bGFyIHRleHRcblx0XHR0cmFuc2Zvcm1lZCA9IHRyYW5zZm9ybWVkLnJlcGxhY2UoL1xcW1xcWyhbXlxcXV0rKVxcXVxcXS9nLCAnJDEnKTtcblx0XHRcblx0XHQvLyBDb252ZXJ0IE9ic2lkaWFuIHRhZ3MgdG8gR2l0TGFiIG1lbnRpb25zIChvcHRpb25hbCB0cmFuc2Zvcm1hdGlvbilcblx0XHR0cmFuc2Zvcm1lZCA9IHRyYW5zZm9ybWVkLnJlcGxhY2UoLyMoW2EtekEtWjAtOV8tXSspL2csICdgIyQxYCcpO1xuXHRcdFxuXHRcdC8vIFRyaW0gZXh0cmEgd2hpdGVzcGFjZVxuXHRcdHRyYW5zZm9ybWVkID0gdHJhbnNmb3JtZWQudHJpbSgpO1xuXHRcdFxuXHRcdC8vIElmIGNvbnRlbnQgaXMgZW1wdHkgYWZ0ZXIgdHJhbnNmb3JtYXRpb24sIHByb3ZpZGUgYSBkZWZhdWx0IG1lc3NhZ2Vcblx0XHRpZiAoIXRyYW5zZm9ybWVkKSB7XG5cdFx0XHR0cmFuc2Zvcm1lZCA9ICdDcmVhdGVkIGZyb20gT2JzaWRpYW4gbm90ZSAoY29udGVudCB3YXMgZW1wdHkpJztcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIHRyYW5zZm9ybWVkO1xuXHR9XG5cdFxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgZnJvbnRtYXR0ZXIgb2YgYSBub3RlIHdpdGggdGhlIEdpdExhYiBpc3N1ZSBVUkxcblx0ICogQHBhcmFtIGZpbGUgLSBUaGUgVEZpbGUgdG8gdXBkYXRlXG5cdCAqIEBwYXJhbSBpc3N1ZVVybCAtIFRoZSBHaXRMYWIgaXNzdWUgd2ViIFVSTCB0byBhZGQgdG8gZnJvbnRtYXR0ZXJcblx0ICovXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlTm90ZUZyb250bWF0dGVyKGZpbGU6IFRGaWxlLCBpc3N1ZVVybDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICghZmlsZSB8fCAhaXNzdWVVcmwpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGZpbGUgb3IgaXNzdWUgVVJMIHByb3ZpZGVkJyk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIFJlYWQgdGhlIGN1cnJlbnQgZmlsZSBjb250ZW50XG5cdFx0XHRjb25zdCBmaWxlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0XHRcblx0XHRcdGlmICh0eXBlb2YgZmlsZUNvbnRlbnQgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIHJlYWQgZmlsZSBjb250ZW50Jyk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdC8vIFVzZSBNZXRhZGF0YUNhY2hlIHRvIGNoZWNrIGlmIGZpbGUgYWxyZWFkeSBoYXMgZnJvbnRtYXR0ZXJcblx0XHRcdGNvbnN0IGZpbGVDYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xuXHRcdFx0Y29uc3QgaGFzRnJvbnRtYXR0ZXIgPSBmaWxlQ2FjaGU/LmZyb250bWF0dGVyICE9PSB1bmRlZmluZWQ7XG5cdFx0XHRcblx0XHRcdGxldCB1cGRhdGVkQ29udGVudDogc3RyaW5nO1xuXHRcdFx0XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoaGFzRnJvbnRtYXR0ZXIpIHtcblx0XHRcdFx0XHQvLyBGaWxlIGhhcyBleGlzdGluZyBmcm9udG1hdHRlciwgdXBkYXRlIGl0XG5cdFx0XHRcdFx0dXBkYXRlZENvbnRlbnQgPSB0aGlzLmFkZFRvRXhpc3RpbmdGcm9udG1hdHRlcihmaWxlQ29udGVudCwgaXNzdWVVcmwpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIEZpbGUgaGFzIG5vIGZyb250bWF0dGVyLCBjcmVhdGUgbmV3IGZyb250bWF0dGVyXG5cdFx0XHRcdFx0dXBkYXRlZENvbnRlbnQgPSB0aGlzLmNyZWF0ZU5ld0Zyb250bWF0dGVyKGZpbGVDb250ZW50LCBpc3N1ZVVybCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGZyb250bWF0dGVyRXJyb3IpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignRXJyb3IgcHJvY2Vzc2luZyBmcm9udG1hdHRlcjonLCBmcm9udG1hdHRlckVycm9yKTtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcHJvY2VzcyBmaWxlIGZyb250bWF0dGVyJyk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmICghdXBkYXRlZENvbnRlbnQgfHwgdXBkYXRlZENvbnRlbnQgPT09IGZpbGVDb250ZW50KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gY2hhbmdlcyBtYWRlIHRvIGZpbGUgY29udGVudCcpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQvLyBXcml0ZSB0aGUgdXBkYXRlZCBjb250ZW50IGJhY2sgdG8gdGhlIGZpbGVcblx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShmaWxlLCB1cGRhdGVkQ29udGVudCk7XG5cdFx0XHRjb25zb2xlLmxvZyhgVXBkYXRlZCBmcm9udG1hdHRlciBmb3IgJHtmaWxlLnBhdGh9IHdpdGggR2l0TGFiIGlzc3VlIFVSTGApO1xuXHRcdFx0XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIG5vdGUgZnJvbnRtYXR0ZXI6JywgZXJyb3IpO1xuXHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcic7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgbm90ZSBmcm9udG1hdHRlcjogJHtlcnJvck1lc3NhZ2V9YCk7XG5cdFx0fVxuXHR9XG5cdFxuXHQvKipcblx0ICogQWRkcyBHaXRMYWIgaXNzdWUgVVJMIHRvIGV4aXN0aW5nIGZyb250bWF0dGVyXG5cdCAqIEBwYXJhbSBjb250ZW50IC0gQ3VycmVudCBmaWxlIGNvbnRlbnQgd2l0aCBleGlzdGluZyBmcm9udG1hdHRlclxuXHQgKiBAcGFyYW0gaXNzdWVVcmwgLSBHaXRMYWIgaXNzdWUgVVJMIHRvIGFkZFxuXHQgKiBAcmV0dXJucyBVcGRhdGVkIGNvbnRlbnQgd2l0aCBHaXRMYWIgVVJMIGluIGZyb250bWF0dGVyXG5cdCAqL1xuXHRwcml2YXRlIGFkZFRvRXhpc3RpbmdGcm9udG1hdHRlcihjb250ZW50OiBzdHJpbmcsIGlzc3VlVXJsOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdC8vIE1hdGNoIGV4aXN0aW5nIGZyb250bWF0dGVyIGJsb2NrXG5cdFx0Y29uc3QgZnJvbnRtYXR0ZXJNYXRjaCA9IGNvbnRlbnQubWF0Y2goL14oLS0tXFxuW1xcc1xcU10qPylcXG4tLS0vKTtcblx0XHRcblx0XHRpZiAoIWZyb250bWF0dGVyTWF0Y2gpIHtcblx0XHRcdC8vIEZhbGxiYWNrOiBjcmVhdGUgbmV3IGZyb250bWF0dGVyIGlmIHJlZ2V4IGZhaWxzXG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVOZXdGcm9udG1hdHRlcihjb250ZW50LCBpc3N1ZVVybCk7XG5cdFx0fVxuXHRcdFxuXHRcdGNvbnN0IGV4aXN0aW5nRnJvbnRtYXR0ZXIgPSBmcm9udG1hdHRlck1hdGNoWzFdO1xuXHRcdGNvbnN0IGFmdGVyRnJvbnRtYXR0ZXIgPSBjb250ZW50LnNsaWNlKGZyb250bWF0dGVyTWF0Y2hbMF0ubGVuZ3RoKTtcblx0XHRcblx0XHQvLyBDaGVjayBpZiBnaXRsYWJfaXNzdWVfdXJsIGFscmVhZHkgZXhpc3RzIGFuZCB1cGRhdGUgaXQsIG90aGVyd2lzZSBhZGQgaXRcblx0XHRsZXQgdXBkYXRlZEZyb250bWF0dGVyOiBzdHJpbmc7XG5cdFx0aWYgKGV4aXN0aW5nRnJvbnRtYXR0ZXIuaW5jbHVkZXMoJ2dpdGxhYl9pc3N1ZV91cmw6JykpIHtcblx0XHRcdC8vIFJlcGxhY2UgZXhpc3RpbmcgZ2l0bGFiX2lzc3VlX3VybFxuXHRcdFx0dXBkYXRlZEZyb250bWF0dGVyID0gZXhpc3RpbmdGcm9udG1hdHRlci5yZXBsYWNlKFxuXHRcdFx0XHQvZ2l0bGFiX2lzc3VlX3VybDouKiQvbSxcblx0XHRcdFx0YGdpdGxhYl9pc3N1ZV91cmw6IFwiJHtpc3N1ZVVybH1cImBcblx0XHRcdCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEFkZCBuZXcgZ2l0bGFiX2lzc3VlX3VybCBwcm9wZXJ0eVxuXHRcdFx0dXBkYXRlZEZyb250bWF0dGVyID0gZXhpc3RpbmdGcm9udG1hdHRlciArIGBcXG5naXRsYWJfaXNzdWVfdXJsOiBcIiR7aXNzdWVVcmx9XCJgO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gdXBkYXRlZEZyb250bWF0dGVyICsgJ1xcbi0tLScgKyBhZnRlckZyb250bWF0dGVyO1xuXHR9XG5cdFxuXHQvKipcblx0ICogQ3JlYXRlcyBuZXcgZnJvbnRtYXR0ZXIgd2l0aCBHaXRMYWIgaXNzdWUgVVJMXG5cdCAqIEBwYXJhbSBjb250ZW50IC0gQ3VycmVudCBmaWxlIGNvbnRlbnQgd2l0aG91dCBmcm9udG1hdHRlclxuXHQgKiBAcGFyYW0gaXNzdWVVcmwgLSBHaXRMYWIgaXNzdWUgVVJMIHRvIGFkZFxuXHQgKiBAcmV0dXJucyBDb250ZW50IHdpdGggbmV3IGZyb250bWF0dGVyIGNvbnRhaW5pbmcgR2l0TGFiIFVSTFxuXHQgKi9cblx0cHJpdmF0ZSBjcmVhdGVOZXdGcm9udG1hdHRlcihjb250ZW50OiBzdHJpbmcsIGlzc3VlVXJsOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGNvbnN0IG5ld0Zyb250bWF0dGVyID0gYC0tLVxcbmdpdGxhYl9pc3N1ZV91cmw6IFwiJHtpc3N1ZVVybH1cIlxcbi0tLVxcbmA7XG5cdFx0cmV0dXJuIG5ld0Zyb250bWF0dGVyICsgY29udGVudDtcblx0fVxuXHRcblx0LyoqXG5cdCAqIFZhbGlkYXRlcyBwbHVnaW4gc2V0dGluZ3MgYW5kIHNob3dzIGFwcHJvcHJpYXRlIHdhcm5pbmdzXG5cdCAqIEByZXR1cm5zIGJvb2xlYW4gLSB0cnVlIGlmIHNldHRpbmdzIGFyZSB2YWxpZCwgZmFsc2Ugb3RoZXJ3aXNlXG5cdCAqL1xuXHRwcml2YXRlIHZhbGlkYXRlU2V0dGluZ3MoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy50b2tlbiB8fCB0aGlzLnNldHRpbmdzLnRva2VuLnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdGlzc3Vlcy5wdXNoKCdHaXRMYWIgUGVyc29uYWwgQWNjZXNzIFRva2VuIGlzIHJlcXVpcmVkJyk7XG5cdFx0fVxuXHRcdFxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5wcm9qZWN0SWQgfHwgdGhpcy5zZXR0aW5ncy5wcm9qZWN0SWQudHJpbSgpID09PSAnJykge1xuXHRcdFx0aXNzdWVzLnB1c2goJ0dpdExhYiBQcm9qZWN0IElEIGlzIHJlcXVpcmVkJyk7XG5cdFx0fVxuXHRcdFxuXHRcdC8vIFZhbGlkYXRlIHByb2plY3QgSUQgZm9ybWF0IChzaG91bGQgYmUgbnVtZXJpYyBvciBuYW1lc3BhY2UvcHJvamVjdCBmb3JtYXQpXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MucHJvamVjdElkICYmIHRoaXMuc2V0dGluZ3MucHJvamVjdElkLnRyaW0oKSAhPT0gJycpIHtcblx0XHRcdGNvbnN0IHByb2plY3RJZCA9IHRoaXMuc2V0dGluZ3MucHJvamVjdElkLnRyaW0oKTtcblx0XHRcdC8vIEFsbG93IG51bWVyaWMgSURzIG9yIG5hbWVzcGFjZS9wcm9qZWN0IGZvcm1hdFxuXHRcdFx0aWYgKCEvXlxcZCskLy50ZXN0KHByb2plY3RJZCkgJiYgIS9eW2EtekEtWjAtOV8uLV0rXFwvW2EtekEtWjAtOV8uLV0rJC8udGVzdChwcm9qZWN0SWQpKSB7XG5cdFx0XHRcdGlzc3Vlcy5wdXNoKCdQcm9qZWN0IElEIHNob3VsZCBiZSBlaXRoZXIgYSBudW1lcmljIElEIG9yIGluIFwibmFtZXNwYWNlL3Byb2plY3RcIiBmb3JtYXQnKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0Ly8gVmFsaWRhdGUgdG9rZW4gZm9ybWF0IChiYXNpYyBjaGVjaylcblx0XHRpZiAodGhpcy5zZXR0aW5ncy50b2tlbiAmJiB0aGlzLnNldHRpbmdzLnRva2VuLnRyaW0oKSAhPT0gJycpIHtcblx0XHRcdGNvbnN0IHRva2VuID0gdGhpcy5zZXR0aW5ncy50b2tlbi50cmltKCk7XG5cdFx0XHQvLyBHaXRMYWIgdG9rZW5zIGFyZSB0eXBpY2FsbHkgMjAtMjYgY2hhcmFjdGVycyBhbmQgYWxwaGFudW1lcmljIHdpdGggcG9zc2libGUgZGFzaGVzL3VuZGVyc2NvcmVzXG5cdFx0XHRpZiAodG9rZW4ubGVuZ3RoIDwgMTAgfHwgIS9eW2EtekEtWjAtOV8tXSskLy50ZXN0KHRva2VuKSkge1xuXHRcdFx0XHRpc3N1ZXMucHVzaCgnUGVyc29uYWwgQWNjZXNzIFRva2VuIGZvcm1hdCBhcHBlYXJzIGludmFsaWQnKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0aWYgKGlzc3Vlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCB3YXJuaW5nTWVzc2FnZSA9ICdQbHVnaW4gY29uZmlndXJhdGlvbiBpc3N1ZXM6XFxuXFxuJyArIGlzc3Vlcy5tYXAoaXNzdWUgPT4gYOKAoiAke2lzc3VlfWApLmpvaW4oJ1xcbicpICsgJ1xcblxcblBsZWFzZSB1cGRhdGUgeW91ciBzZXR0aW5ncyBiZWZvcmUgY3JlYXRpbmcgaXNzdWVzLic7XG5cdFx0XHRuZXcgTm90aWNlKHdhcm5pbmdNZXNzYWdlLCAxMDAwMCk7XG5cdFx0XHRjb25zb2xlLndhcm4oJ0dpdExhYiBwbHVnaW4gY29uZmlndXJhdGlvbiBpc3N1ZXM6JywgaXNzdWVzKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cblxuY2xhc3MgU2V0dGluZ3NUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcblx0cGx1Z2luOiBHaXRMYWJQbHVnaW47XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogR2l0TGFiUGx1Z2luKSB7XG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cblx0ZGlzcGxheSgpOiB2b2lkIHtcblx0XHRjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcblxuXHRcdGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7dGV4dDogJ0dpdExhYiBQbHVnaW4gU2V0dGluZ3MnfSk7XG5cdFx0XG5cdFx0Ly8gQWRkIHZhbGlkYXRpb24gc3RhdHVzIGluZGljYXRvclxuXHRcdGNvbnN0IHN0YXR1c0VsID0gY29udGFpbmVyRWwuY3JlYXRlRWwoJ2RpdicsIHsgY2xzOiAnZ2l0bGFiLXBsdWdpbi1zdGF0dXMnIH0pO1xuXHRcdHRoaXMudXBkYXRlVmFsaWRhdGlvblN0YXR1cyhzdGF0dXNFbCk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdQZXJzb25hbCBBY2Nlc3MgVG9rZW4nKVxuXHRcdFx0LnNldERlc2MoJ1lvdXIgR2l0TGFiIHBlcnNvbmFsIGFjY2VzcyB0b2tlbiAocmVxdWlyZWQpLiBDcmVhdGUgb25lIGF0IEdpdExhYi5jb20g4oaSIFVzZXIgU2V0dGluZ3Mg4oaSIEFjY2VzcyBUb2tlbnMnKVxuXHRcdFx0LmFkZFRleHQodGV4dCA9PiB7XG5cdFx0XHRcdHRleHQuc2V0UGxhY2Vob2xkZXIoJ2dscGF0LXh4eHh4eHh4eHh4eHh4eHh4eHh4Jylcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MudG9rZW4pXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudG9rZW4gPSB2YWx1ZTtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlVmFsaWRhdGlvblN0YXR1cyhzdGF0dXNFbCk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCdFcnJvciBzYXZpbmcgdG9rZW46JywgZXJyb3IpO1xuXHRcdFx0XHRcdFx0XHRuZXcgTm90aWNlKCdGYWlsZWQgdG8gc2F2ZSBQZXJzb25hbCBBY2Nlc3MgVG9rZW4nKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0Ly8gTWFrZSBpdCBhIHBhc3N3b3JkIGZpZWxkIGZvciBzZWN1cml0eVxuXHRcdFx0XHR0ZXh0LmlucHV0RWwudHlwZSA9ICdwYXNzd29yZCc7XG5cdFx0XHR9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ1Byb2plY3QgSUQnKVxuXHRcdFx0LnNldERlc2MoJ1RoZSBHaXRMYWIgcHJvamVjdCBJRCAocmVxdWlyZWQpLiBDYW4gYmUgbnVtZXJpYyAoZS5nLiwgXCIxMjM0NVwiKSBvciBuYW1lc3BhY2UvcHJvamVjdCBmb3JtYXQgKGUuZy4sIFwibXlncm91cC9teXByb2plY3RcIiknKVxuXHRcdFx0LmFkZFRleHQodGV4dCA9PiB0ZXh0XG5cdFx0XHRcdC5zZXRQbGFjZWhvbGRlcignMTIzNDUgb3IgbXlncm91cC9teXByb2plY3QnKVxuXHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucHJvamVjdElkKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnByb2plY3RJZCA9IHZhbHVlO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVZhbGlkYXRpb25TdGF0dXMoc3RhdHVzRWwpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCdFcnJvciBzYXZpbmcgcHJvamVjdCBJRDonLCBlcnJvcik7XG5cdFx0XHRcdFx0XHRuZXcgTm90aWNlKCdGYWlsZWQgdG8gc2F2ZSBQcm9qZWN0IElEJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdEZWZhdWx0IExhYmVscycpXG5cdFx0XHQuc2V0RGVzYygnQ29tbWEtc2VwYXJhdGVkIGxpc3Qgb2YgZGVmYXVsdCBsYWJlbHMgZm9yIGlzc3VlcyAob3B0aW9uYWwpJylcblx0XHRcdC5hZGRUZXh0KHRleHQgPT4gdGV4dFxuXHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ2J1ZywgZW5oYW5jZW1lbnQsIGRvY3VtZW50YXRpb24nKVxuXHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVmYXVsdExhYmVscylcblx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0TGFiZWxzID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcignRXJyb3Igc2F2aW5nIGRlZmF1bHQgbGFiZWxzOicsIGVycm9yKTtcblx0XHRcdFx0XHRcdG5ldyBOb3RpY2UoJ0ZhaWxlZCB0byBzYXZlIERlZmF1bHQgTGFiZWxzJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XG5cdFx0Ly8gQWRkIGhlbHAgc2VjdGlvblxuXHRcdGNvbnN0IGhlbHBFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdkaXYnLCB7IGNsczogJ2dpdGxhYi1wbHVnaW4taGVscCcgfSk7XG5cdFx0aGVscEVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ1NldHVwIEluc3RydWN0aW9ucycgfSk7XG5cdFx0Y29uc3QgaGVscExpc3QgPSBoZWxwRWwuY3JlYXRlRWwoJ29sJyk7XG5cdFx0aGVscExpc3QuY3JlYXRlRWwoJ2xpJywgeyB0ZXh0OiAnR28gdG8gR2l0TGFiLmNvbSDihpIgVXNlciBTZXR0aW5ncyDihpIgQWNjZXNzIFRva2VucycgfSk7XG5cdFx0aGVscExpc3QuY3JlYXRlRWwoJ2xpJywgeyB0ZXh0OiAnQ3JlYXRlIGEgbmV3IHRva2VuIHdpdGggXCJhcGlcIiBzY29wZScgfSk7XG5cdFx0aGVscExpc3QuY3JlYXRlRWwoJ2xpJywgeyB0ZXh0OiAnQ29weSB0aGUgdG9rZW4gYW5kIHBhc3RlIGl0IGFib3ZlJyB9KTtcblx0XHRoZWxwTGlzdC5jcmVhdGVFbCgnbGknLCB7IHRleHQ6ICdGaW5kIHlvdXIgcHJvamVjdCBJRCBpbiBQcm9qZWN0IFNldHRpbmdzIOKGkiBHZW5lcmFsJyB9KTtcblx0fVxuXHRcblx0cHJpdmF0ZSB1cGRhdGVWYWxpZGF0aW9uU3RhdHVzKHN0YXR1c0VsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN0YXR1c0VsLmVtcHR5KCk7XG5cdFx0XG5cdFx0Y29uc3QgaGFzVG9rZW4gPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy50b2tlbiAmJiB0aGlzLnBsdWdpbi5zZXR0aW5ncy50b2tlbi50cmltKCkgIT09ICcnO1xuXHRcdGNvbnN0IGhhc1Byb2plY3RJZCA9IHRoaXMucGx1Z2luLnNldHRpbmdzLnByb2plY3RJZCAmJiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcm9qZWN0SWQudHJpbSgpICE9PSAnJztcblx0XHRcblx0XHRpZiAoaGFzVG9rZW4gJiYgaGFzUHJvamVjdElkKSB7XG5cdFx0XHRzdGF0dXNFbC5jcmVhdGVFbCgnZGl2JywgeyBcblx0XHRcdFx0dGV4dDogJ+KchSBDb25maWd1cmF0aW9uIGFwcGVhcnMgdmFsaWQnLCBcblx0XHRcdFx0Y2xzOiAnZ2l0bGFiLXN0YXR1cy1zdWNjZXNzJ1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IG1pc3NpbmcgPSBbXTtcblx0XHRcdGlmICghaGFzVG9rZW4pIG1pc3NpbmcucHVzaCgnUGVyc29uYWwgQWNjZXNzIFRva2VuJyk7XG5cdFx0XHRpZiAoIWhhc1Byb2plY3RJZCkgbWlzc2luZy5wdXNoKCdQcm9qZWN0IElEJyk7XG5cdFx0XHRcblx0XHRcdHN0YXR1c0VsLmNyZWF0ZUVsKCdkaXYnLCB7IFxuXHRcdFx0XHR0ZXh0OiBg4pqg77iPIE1pc3NpbmcgcmVxdWlyZWQgZmllbGRzOiAke21pc3Npbmcuam9pbignLCAnKX1gLCBcblx0XHRcdFx0Y2xzOiAnZ2l0bGFiLXN0YXR1cy13YXJuaW5nJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59XG5cbiJdLCJuYW1lcyI6WyJQbHVnaW4iLCJOb3RpY2UiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBUUEsTUFBTSxnQkFBZ0IsR0FBbUI7QUFDeEMsSUFBQSxLQUFLLEVBQUUsRUFBRTtBQUNULElBQUEsU0FBUyxFQUFFLEVBQUU7QUFDYixJQUFBLGFBQWEsRUFBRTtDQUNmO0FBRW9CLE1BQUEsWUFBYSxTQUFRQSxlQUFNLENBQUE7SUFHekMsTUFBTSxHQUFBOztBQUNYLFlBQUEsTUFBTSxJQUFJLENBQUMsWUFBWSxFQUFFOztBQUd6QixZQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQzs7WUFHbkQsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUNmLGdCQUFBLEVBQUUsRUFBRSxxQkFB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
