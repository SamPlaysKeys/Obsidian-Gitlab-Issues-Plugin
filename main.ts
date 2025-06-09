import { App, Plugin, PluginSettingTab, Setting, TFile, Notice } from 'obsidian';

interface GitLabSettings {
	token: string;
	projectId: string;
	defaultLabels: string;
}

const DEFAULT_SETTINGS: GitLabSettings = {
	token: '',
	projectId: '',
	defaultLabels: ''
};

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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private createIssueFromActiveFile() {
		try {
			// Validate settings before proceeding
			if (!this.validateSettings()) {
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
			
			this.triggerIssueCreation(activeFile);
		} catch (error) {
			console.error('Error in createIssueFromActiveFile:', error);
			new Notice('An unexpected error occurred while preparing to create the GitLab issue.');
		}
	}
	
	private async triggerIssueCreation(file: TFile) {
		try {
			// Read file content and title
			const content = await this.app.vault.read(file);
			const title = file.basename; // Use filename without extension as title
			
			if (!title.trim()) {
				new Notice('File has no valid title. Cannot create GitLab issue.');
				return;
			}
			
			// Create GitLab issue
			const issueUrl = await this.createGitLabIssue(title, content);
			
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
	 * @returns Promise<string | null> - The web_url of the created issue or null if failed
	 */
	private async createGitLabIssue(title: string, content: string): Promise<string | null> {
		try {
			// Validate required settings - this should already be done, but double-check
			if (!this.settings.token) {
				console.error('GitLab token not configured');
				new Notice('Please configure your GitLab Personal Access Token in plugin settings');
				return null;
			}
			
			if (!this.settings.projectId) {
				console.error('GitLab project ID not configured');
				new Notice('Please configure your GitLab Project ID in plugin settings');
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
				// Send POST request to GitLab API
				const response = await fetch(`https://gitlab.com/api/v4/projects/${this.settings.projectId}/issues`, {
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
						const errorData = await response.json();
						if (errorData.message) {
							errorMessage += `: ${errorData.message}`;
						}
						} catch {
							// If JSON parsing fails, use text
							const errorText = await response.text();
							if (errorText) {
								errorMessage += `: ${errorText}`;
							}
						}
					
					console.error('GitLab API error:', response.status, errorMessage);
					
					// Provide specific error feedback based on status code
					if (response.status === 401) {
						new Notice('Authentication failed. Please check your GitLab Personal Access Token.');
					} else if (response.status === 403) {
						new Notice('Access denied. Please check your token permissions and project access.');
					} else if (response.status === 404) {
						new Notice('Project not found. Please check your Project ID.');
					} else if (response.status >= 500) {
						new Notice('GitLab server error. Please try again later.');
					} else {
						new Notice(`GitLab API error: ${errorMessage}`);
					}
					
					return null;
				}
				
				// Parse JSON response and extract web_url
				const responseData = await response.json();
				console.log('GitLab API response:', responseData);
				
				// Validate response data
				if (!responseData.web_url) {
					console.error('Invalid GitLab API response: missing web_url');
					new Notice('Invalid response from GitLab API. Issue may have been created but URL is missing.');
					return null;
				}
				
				// Return the web_url from the response
				return responseData.web_url;
				
			} catch (networkError) {
				console.error('Network error calling GitLab API:', networkError);
				if (networkError instanceof TypeError && networkError.message.includes('fetch')) {
					new Notice('Network error: Unable to connect to GitLab. Please check your internet connection.');
				} else {
					new Notice(`Network error: ${networkError instanceof Error ? networkError.message : 'Unknown error'}`);
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
			new Notice(warningMessage, 10000);
			console.warn('GitLab plugin configuration issues:', issues);
			return false;
		}
		
		return true;
	}
}

class SettingsTab extends PluginSettingTab {
	plugin: GitLabPlugin;

	constructor(app: App, plugin: GitLabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'GitLab Plugin Settings'});
		
		// Add validation status indicator
		const statusEl = containerEl.createEl('div', { cls: 'gitlab-plugin-status' });
		this.updateValidationStatus(statusEl);

		new Setting(containerEl)
			.setName('Personal Access Token')
			.setDesc('Your GitLab personal access token (required). Create one at GitLab.com → User Settings → Access Tokens')
			.addText(text => {
				text.setPlaceholder('glpat-xxxxxxxxxxxxxxxxxxxx')
					.setValue(this.plugin.settings.token)
					.onChange(async (value) => {
						try {
							this.plugin.settings.token = value;
							await this.plugin.saveSettings();
							this.updateValidationStatus(statusEl);
						} catch (error) {
							console.error('Error saving token:', error);
							new Notice('Failed to save Personal Access Token');
						}
					});
				// Make it a password field for security
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('Project ID')
			.setDesc('The GitLab project ID (required). Can be numeric (e.g., "12345") or namespace/project format (e.g., "mygroup/myproject")')
			.addText(text => text
				.setPlaceholder('12345 or mygroup/myproject')
				.setValue(this.plugin.settings.projectId)
				.onChange(async (value) => {
					try {
						this.plugin.settings.projectId = value;
						await this.plugin.saveSettings();
						this.updateValidationStatus(statusEl);
					} catch (error) {
						console.error('Error saving project ID:', error);
						new Notice('Failed to save Project ID');
					}
				}));

		new Setting(containerEl)
			.setName('Default Labels')
			.setDesc('Comma-separated list of default labels for issues (optional)')
			.addText(text => text
				.setPlaceholder('bug, enhancement, documentation')
				.setValue(this.plugin.settings.defaultLabels)
				.onChange(async (value) => {
					try {
						this.plugin.settings.defaultLabels = value;
						await this.plugin.saveSettings();
					} catch (error) {
						console.error('Error saving default labels:', error);
						new Notice('Failed to save Default Labels');
					}
				}));
		
		// Add help section
		const helpEl = containerEl.createEl('div', { cls: 'gitlab-plugin-help' });
		helpEl.createEl('h3', { text: 'Setup Instructions' });
		const helpList = helpEl.createEl('ol');
		helpList.createEl('li', { text: 'Go to GitLab.com → User Settings → Access Tokens' });
		helpList.createEl('li', { text: 'Create a new token with "api" scope' });
		helpList.createEl('li', { text: 'Copy the token and paste it above' });
		helpList.createEl('li', { text: 'Find your project ID in Project Settings → General' });
	}
	
	private updateValidationStatus(statusEl: HTMLElement): void {
		statusEl.empty();
		
		const hasToken = this.plugin.settings.token && this.plugin.settings.token.trim() !== '';
		const hasProjectId = this.plugin.settings.projectId && this.plugin.settings.projectId.trim() !== '';
		
		if (hasToken && hasProjectId) {
			statusEl.createEl('div', { 
				text: '✅ Configuration appears valid', 
				cls: 'gitlab-status-success'
			});
		} else {
			const missing = [];
			if (!hasToken) missing.push('Personal Access Token');
			if (!hasProjectId) missing.push('Project ID');
			
			statusEl.createEl('div', { 
				text: `⚠️ Missing required fields: ${missing.join(', ')}`, 
				cls: 'gitlab-status-warning'
			});
		}
	}
}

