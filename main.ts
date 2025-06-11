import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, FuzzySuggestModal, FuzzyMatch } from 'obsidian';
import { GitLabProject, fetchUserProjects } from './types';

/**
 * Configuration settings for the GitLab plugin
 */
interface GitLabSettings {
	/** GitLab Personal Access Token for API authentication */
	token: string;
	/** Comma-separated list of default labels to apply to created issues */
	defaultLabels: string;
	/** Base URL of the GitLab instance */
	gitlabUrl: string;
}

/**
 * Default plugin settings
 */
const DEFAULT_SETTINGS: GitLabSettings = {
	token: '',
	defaultLabels: '',
	gitlabUrl: 'https://gitlab.com'
};

/**
 * Main GitLab plugin class for Obsidian
 * Provides functionality to create GitLab issues from markdown notes
 */
export default class GitLabPlugin extends Plugin {
	settings!: GitLabSettings;

	async onload() {
		await this.loadSettings();

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
	}

	onunload() {
		console.log('Unloading GitLab plugin');
	}

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

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async createIssueFromActiveFile() {
		try {
			// Validate token only
			if (!this.settings.token || this.settings.token.trim() === '') {
				new Notice('GitLab Personal Access Token is required. Please configure it in plugin settings.');
				console.error('GitLab token not configured');
				return;
			}

			// Get the active markdown file
			const activeFile = this.app.workspace.getActiveFile();
			
			if (!activeFile) {
				new Notice('No active file found. Please open a markdown file first.');
				console.error('No active file found');
				return;
			}
			
			if (!activeFile.path.endsWith('.md')) {
				new Notice('Active file is not a markdown file. Please select a .md file.');
				console.error('Active file is not a markdown file');
				return;
			}
			
			console.log('Creating GitLab issue from file:', activeFile.path);
			new Notice('Creating GitLab issue...');
			
			// Instantiate ProjectPickerModal and await selected project
			const projectPicker = new ProjectPickerModal(this.app, this.settings.token, this.settings.gitlabUrl);
			const selectedProject = await projectPicker.selectProject();
			
			if (!selectedProject) {
				new Notice('No project selected. Issue creation cancelled.');
				console.log('Project selection cancelled by user');
				return;
			}
			
			console.log('Selected project:', selectedProject.path_with_namespace);
			
			// Pass project.id to triggerIssueCreation
			this.triggerIssueCreation(activeFile, selectedProject.id);
		} catch (error) {
			console.error('Error in createIssueFromActiveFile:', error);
			new Notice('An unexpected error occurred while preparing to create the GitLab issue.');
		}
	}
	
	private async triggerIssueCreation(file: TFile, projectId: number) {
		try {
			// Read file content and title
			const content = await this.app.vault.read(file);
			const title = file.basename; // Use filename without extension as title
			
			if (!title.trim()) {
				new Notice('File has no valid title. Cannot create GitLab issue.');
				return;
			}
			
			// Create GitLab issue
			const issueUrl = await this.createGitLabIssue(title, content, projectId);
			
			if (issueUrl) {
				try {
					// Update note frontmatter with GitLab issue URL
					await this.updateNoteFrontmatter(file, issueUrl);
					new Notice(`GitLab issue created successfully!\nURL: ${issueUrl}`, 8000);
					console.log('Issue created:', issueUrl);
				} catch (frontmatterError) {
					console.error('Error updating frontmatter:', frontmatterError);
					new Notice(`GitLab issue created successfully!\nURL: ${issueUrl}\n\nWarning: Could not update file frontmatter.`, 10000);
				}
			} else {
				new Notice('Failed to create GitLab issue. Please check your settings and try again.');
			}
		} catch (error) {
			console.error('Error creating GitLab issue:', error);
			if (error instanceof Error) {
				new Notice(`Error creating GitLab issue: ${error.message}`);
			} else {
				new Notice('An unexpected error occurred while creating the GitLab issue.');
			}
		}
	}
	
	/**
	 * Creates a GitLab issue from note title and content
	 * @param title - The note title to use as issue title
	 * @param content - The markdown content to use as issue description
	 * @param projectId - The GitLab project ID to create the issue in
	 * @returns Promise<string | null> - The web_url of the created issue or null if failed
	 */
	private async createGitLabIssue(title: string, content: string, projectId: number): Promise<string | null> {
		try {
			// Validate required settings - this should already be done, but double-check
			if (!this.settings.token) {
				console.error('GitLab token not configured');
				new Notice('Please configure your GitLab Personal Access Token in plugin settings');
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
			
			console.log('Sending GitLab API request with data:', { ...issueData, description: transformedContent.substring(0, 100) + '...' });
			
			try {
				// Create the GitLab issue using the provided projectId
				const baseUrl = this.settings.gitlabUrl.replace(/\/$/, '');
				const url = `${baseUrl}/api/v4/projects/${projectId}/issues`;
				
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${this.settings.token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(issueData),
					// Add timeout to prevent hanging requests
					signal: AbortSignal.timeout(30000) // 30 second timeout
				});
				
				if (!response.ok) {
					let errorMessage = `GitLab API request failed with status ${response.status}`;
					
					if (response.status === 401) {
						errorMessage = 'Invalid or expired GitLab Personal Access Token. Please check your token in plugin settings.';
					} else if (response.status === 403) {
						errorMessage = 'Access denied. Please ensure your token has proper permissions for this project.';
					} else if (response.status === 404) {
						errorMessage = 'Project not found. Please verify the project exists and you have access.';
					} else if (response.status >= 500) {
						errorMessage = 'GitLab server error. Please try again later.';
					} else {
						// Try to extract error message from response body
						try {
							const errorData = await response.json();
							if (errorData.message) {
								errorMessage += `: ${errorData.message}`;
							}
						} catch {
							// Ignore JSON parse errors, use default message
						}
					}
					
					console.error('GitLab API error:', {
						status: response.status,
						statusText: response.statusText,
						url: url
					});
					
					throw new Error(errorMessage);
				}
				
				const issueResponse = await response.json();
				
				if (!issueResponse.web_url) {
					throw new Error('Invalid response from GitLab API: missing web_url');
				}
				
				console.log('Successfully created GitLab issue:', issueResponse.web_url);
				return issueResponse.web_url;
				
			} catch (networkError) {
				console.error('Error in issue creation:', networkError);
				
				if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
					new Notice('Network error: Unable to connect to GitLab. Please check your internet connection.');
				} else if (networkError instanceof DOMException && networkError.name === 'AbortError') {
					new Notice('Request timeout: GitLab API request took too long. Please try again.');
				} else {
					new Notice(`Error: ${networkError instanceof Error ? networkError.message : 'Unknown error'}`);
				}
				return null;
			}
			
		} catch (error) {
			console.error('Unexpected error in createGitLabIssue:', error);
			new Notice('An unexpected error occurred while creating the GitLab issue.');
			return null;
		}
	}
	
	/**
	 * Performs minimal transformation of markdown content for GitLab issue description
	 * @param content - Raw markdown content from the note
	 * @returns Transformed content suitable for GitLab issues
	 */
	private transformMarkdownForGitLab(content: string): string {
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
	private async updateNoteFrontmatter(file: TFile, issueUrl: string): Promise<void> {
		try {
			if (!file || !issueUrl) {
				throw new Error('Invalid file or issue URL provided');
			}
			
			// Read the current file content
			const fileContent = await this.app.vault.read(file);
			
			if (typeof fileContent !== 'string') {
				throw new Error('Unable to read file content');
			}
			
			// Use MetadataCache to check if file already has frontmatter
			const fileCache = this.app.metadataCache.getFileCache(file);
			const hasFrontmatter = fileCache?.frontmatter !== undefined;
			
			let updatedContent: string;
			
			try {
				if (hasFrontmatter) {
					// File has existing frontmatter, update it
					updatedContent = this.addToExistingFrontmatter(fileContent, issueUrl);
				} else {
					// File has no frontmatter, create new frontmatter
					updatedContent = this.createNewFrontmatter(fileContent, issueUrl);
				}
			} catch (frontmatterError) {
				console.error('Error processing frontmatter:', frontmatterError);
				throw new Error('Failed to process file frontmatter');
			}
			
			if (!updatedContent || updatedContent === fileContent) {
				throw new Error('No changes made to file content');
			}
			
			// Write the updated content back to the file
			await this.app.vault.modify(file, updatedContent);
			console.log(`Updated frontmatter for ${file.path} with GitLab issue URL`);
			
		} catch (error) {
			console.error('Error updating note frontmatter:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to update note frontmatter: ${errorMessage}`);
		}
	}
	
	/**
	 * Adds GitLab issue URL to existing frontmatter
	 * @param content - Current file content with existing frontmatter
	 * @param issueUrl - GitLab issue URL to add
	 * @returns Updated content with GitLab URL in frontmatter
	 */
	private addToExistingFrontmatter(content: string, issueUrl: string): string {
		// Match existing frontmatter block
		const frontmatterMatch = content.match(/^(---\n[\s\S]*?)\n---/);
		
		if (!frontmatterMatch) {
			// Fallback: create new frontmatter if regex fails
			return this.createNewFrontmatter(content, issueUrl);
		}
		
		const existingFrontmatter = frontmatterMatch[1];
		const afterFrontmatter = content.slice(frontmatterMatch[0].length);
		
		// Check if gitlab_issue_url already exists and update it, otherwise add it
		let updatedFrontmatter: string;
		if (existingFrontmatter.includes('gitlab_issue_url:')) {
			// Replace existing gitlab_issue_url
			updatedFrontmatter = existingFrontmatter.replace(
				/gitlab_issue_url:.*$/m,
				`gitlab_issue_url: "${issueUrl}"`
			);
		} else {
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
	private createNewFrontmatter(content: string, issueUrl: string): string {
		const newFrontmatter = `---\ngitlab_issue_url: "${issueUrl}"\n---\n`;
		return newFrontmatter + content;
	}
	
	/**
	 * Validates plugin settings and shows appropriate warnings
	 * @returns boolean - true if settings are valid, false otherwise
	 */
	private validateSettings(): boolean {
		const issues: string[] = [];
		
		if (!this.settings.token || this.settings.token.trim() === '') {
			issues.push('GitLab Personal Access Token is required');
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
			new Notice(warningMessage, 10000);
			console.warn('GitLab plugin configuration issues:', issues);
			return false;
		}
		
		return true;
	}
}

/**
 * Modal for selecting a GitLab project from user's accessible projects
 */
class ProjectPickerModal extends FuzzySuggestModal<GitLabProject> {
	private resolvePromise!: (project: GitLabProject | null) => void;
	private cachedProjects: GitLabProject[] | null = null;
	private isLoading = false;
	private selectedProject: GitLabProject | null = null;
	private token: string;
	private baseUrl: string;

	constructor(app: App, token: string, baseUrl: string = 'https://gitlab.com') {
		super(app);
		this.token = token;
		this.baseUrl = baseUrl;
		this.setPlaceholder('Type to search for projects...');
	}

	/**
	 * Opens the modal and returns a promise that resolves with the selected project
	 * @returns Promise<GitLabProject | null> - Selected project or null if cancelled
	 */
	public selectProject(): Promise<GitLabProject | null> {
return new Promise(async (resolve) => {
			this.resolvePromise = resolve;
			this.selectedProject = null; // Reset selection
			await this.loadProjectsAsync();
			this.open();
		});
	}

	/**
	 * Loads projects asynchronously and updates the modal
	 */
	private async loadProjectsAsync(): Promise<void> {
		if (this.isLoading || this.cachedProjects !== null) {
			return;
		}

		this.isLoading = true;
		try {
			console.log('Loading GitLab projects...');
			this.cachedProjects = await fetchUserProjects(this.token, this.baseUrl);
			console.log(`Successfully loaded ${this.cachedProjects.length} projects for picker modal`);
		} catch (error) {
			console.error('Error fetching projects in ProjectPickerModal:', error);
			
			// Show error notice to user
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			new Notice(`Failed to load projects: ${errorMessage}`, 8000);
			
			// Set empty array to prevent further loading attempts
			this.cachedProjects = [];
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Returns the list of projects synchronously (required by FuzzySuggestModal)
	 * @returns GitLabProject[] - Array of user projects
	 */
	getItems(): GitLabProject[] {
		console.log('getItems called, returning:', this.cachedProjects?.length || 0, 'projects');
		return this.cachedProjects ?? [];
	}

	/**
	 * Returns the text to display for each project in the search list
	 * @param project - GitLab project object
	 * @returns string - Text to display and search against
	 */
	getItemText(project: GitLabProject): string {
		return project.path_with_namespace;
	}

	/**
	 * Renders each project item in the suggestion list
	 * @param fuzzyMatch - Fuzzy match result containing the GitLab project
	 * @param el - HTML element to render into
	 */
	renderSuggestion(fuzzyMatch: FuzzyMatch<GitLabProject>, el: HTMLElement): void {
		const project = fuzzyMatch.item;
		const container = el.createDiv({ cls: 'gitlab-project-suggestion' });
		
		// Project name (main title)
		const nameEl = container.createDiv({ cls: 'gitlab-project-name' });
		nameEl.textContent = project.name;
		
		// Project path (namespace/project)
		const pathEl = container.createDiv({ cls: 'gitlab-project-path' });
		pathEl.textContent = project.path_with_namespace;
		
		// Project description (if available)
		if (project.description && project.description.trim()) {
			const descEl = container.createDiv({ cls: 'gitlab-project-description' });
			descEl.textContent = project.description;
		}
	}

	/**
	 * Required by FuzzySuggestModal but not used (selectSuggestion is called instead)
	 * @param project - Selected GitLab project
	 * @param evt - The event that triggered the selection
	 */
	onChooseItem(project: GitLabProject, evt: MouseEvent | KeyboardEvent): void {
		console.log('=== onChooseItem called (fallback) ===');
		console.log('Selected project:', project.path_with_namespace);
		
		// Store the selected project
		this.selectedProject = project;
		console.log('Project stored for resolution:', this.selectedProject.path_with_namespace);
		
		// Close the modal - this will trigger onClose which will resolve the promise
		this.close();
	}

	/**
	 * This is the method that Obsidian's FuzzySuggestModal actually calls
	 * @param item - FuzzyMatch containing the selected GitLab project
	 * @param evt - The event that triggered the selection
	 */
	selectSuggestion(item: FuzzyMatch<GitLabProject>, evt: MouseEvent | KeyboardEvent): void {
		console.log('=== selectSuggestion called ===');
		console.log('Selected project:', item.item.path_with_namespace);
		
		// Store the selected project
		this.selectedProject = item.item;
		console.log('Project stored for resolution:', this.selectedProject.path_with_namespace);
		
		// Close the modal - this will trigger onClose which will resolve the promise
		this.close();
	}

	/**
	 * Called when modal is closed
	 */
onClose(): void {
		console.log('=== onClose called ===');
		
		super.onClose();
		
		// Add a small delay before resolving with null to give onChooseItem a chance
if (this.resolvePromise) {
			console.log('Resolving promise with selected project:', this.selectedProject);
			this.resolvePromise(this.selectedProject);
		}
	}

	/**
	 * Handle case when no projects are found
	 * @param query - Current search query
	 */
	getEmptyInputSuggestion(query: string): string {
		if (this.isLoading) {
			return 'Loading projects...';
		}
		if (this.cachedProjects !== null && this.cachedProjects.length === 0) {
			return 'No projects found. Make sure you have access to GitLab projects.';
		}
		return 'Type to search for projects...';
	}

	/**
	 * Handle case when search query yields no results
	 * @param query - Current search query
	 */
	getNoSuggestionMessage(query: string): string {
		return `No projects found matching "${query}"`;
	}
}

class SettingsTab extends PluginSettingTab {
	plugin: GitLabPlugin;

	constructor(app: App, plugin: GitLabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl: settingsContainer} = this;

		settingsContainer.empty();

		settingsContainer.createEl('h2', {text: 'GitLab Plugin Settings'});
		
		// Add validation status indicator
		const validationStatusElement = settingsContainer.createEl('div', { cls: 'gitlab-plugin-status' });
		this.updateValidationStatus(validationStatusElement);

		new Setting(settingsContainer)
			.setName('Personal Access Token')
			.setDesc('Your GitLab personal access token (required). Create one at GitLab.com → User Settings → Access Tokens')
			.addText(text => {
				text.setPlaceholder('glpat-xxxxxxxxxxxxxxxxxxxx')
					.setValue(this.plugin.settings.token)
					.onChange(async (tokenValue) => {
						try {
							this.plugin.settings.token = tokenValue;
							await this.plugin.saveSettings();
							this.updateValidationStatus(validationStatusElement);
						} catch (error) {
							console.error('Error saving token:', error);
							new Notice('Failed to save Personal Access Token');
						}
					});
				// Make it a password field for security
				text.inputEl.type = 'password';
			});


		new Setting(settingsContainer)
			.setName('Default Labels')
			.setDesc('Comma-separated list of default labels for issues (optional)')
			.addText(text => text
				.setPlaceholder('bug, enhancement, documentation')
				.setValue(this.plugin.settings.defaultLabels)
				.onChange(async (defaultLabelsValue) => {
					try {
						this.plugin.settings.defaultLabels = defaultLabelsValue;
						await this.plugin.saveSettings();
					} catch (error) {
						console.error('Error saving default labels:', error);
						new Notice('Failed to save Default Labels');
					}
				}));

		new Setting(settingsContainer)
			.setName('GitLab Instance URL')
			.setDesc('GitLab instance base URL (defaults to https://gitlab.com)')
			.addText(text => text
				.setPlaceholder('https://gitlab.com')
				.setValue(this.plugin.settings.gitlabUrl)
				.onChange(async (gitlabUrlValue) => {
					try {
						this.plugin.settings.gitlabUrl = gitlabUrlValue || 'https://gitlab.com';
						await this.plugin.saveSettings();
					} catch (error) {
						console.error('Error saving GitLab URL:', error);
						new Notice('Failed to save GitLab URL');
					}
				}));
		
		// Add help section
		const helpSectionElement = settingsContainer.createEl('div', { cls: 'gitlab-plugin-help' });
		helpSectionElement.createEl('h3', { text: 'Setup Instructions' });
		const helpInstructionsList = helpSectionElement.createEl('ol');
		helpInstructionsList.createEl('li', { text: 'Go to GitLab.com → User Settings → Access Tokens' });
		helpInstructionsList.createEl('li', { text: 'Create a new token with "api" scope' });
		helpInstructionsList.createEl('li', { text: 'Copy the token and paste it above' });
		helpInstructionsList.createEl('li', { text: 'Use "Create GitLab issue from active file" command to create issues' });
		helpInstructionsList.createEl('li', { text: 'Note: You will select the project each time you create an issue' });
	}
	
	private updateValidationStatus(statusEl: HTMLElement): void {
		statusEl.empty();
		
		const hasToken = this.plugin.settings.token && this.plugin.settings.token.trim() !== '';
		
		if (hasToken) {
			statusEl.createEl('div', { 
				text: '✅ Ready to create GitLab issues', 
				cls: 'gitlab-status-success'
			});
			statusEl.createEl('div', { 
				text: 'ℹ️ Project will be selected when creating each issue', 
				cls: 'gitlab-status-info'
			});
		} else {
			statusEl.createEl('div', { 
				text: '⚠️ Personal Access Token required', 
				cls: 'gitlab-status-warning'
			});
		}
	}
}

