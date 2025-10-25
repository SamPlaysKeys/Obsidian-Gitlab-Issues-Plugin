import { Plugin, TFile, Notice } from 'obsidian';
import { GitLabSettings } from './types';
import { GitLabSettingsTab } from './lib/settings';
import { ProjectPickerModal } from './lib/modal';
import {
	getDefaultSettings,
	transformMarkdownForGitLab,
	buildUpdatedFrontmatter,
	isNonEmptyString,
	sanitizeBaseUrl
} from './lib/utils';

/**
 * Main GitLab plugin class for Obsidian
 * Orchestrates issue creation workflow using modular components
 */
export default class GitLabPlugin extends Plugin {
	settings!: GitLabSettings;

	async onload() {
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new GitLabSettingsTab(this.app, this));

		// Command to create GitLab issue from active markdown file
		this.addCommand({
			id: 'create-gitlab-issue',
			name: 'Create GitLab issue from active file',
			callback: () => {
				this.createIssueFromActiveFile();
			}
		});
	}

	onunload() {
		console.log('Unloading GitLab plugin');
	}

	async loadSettings() {
		const savedData = await this.loadData();
		
		// Migration: Remove deprecated projectId field if it exists
		if (savedData && 'projectId' in savedData) {
			console.log('Migrating settings: removing deprecated projectId field');
			delete savedData.projectId;
		}
		
		// Merge with defaults, ensuring favProjects is always present
		this.settings = Object.assign({}, getDefaultSettings(), savedData);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async createIssueFromActiveFile() {
		try {
			// Validate token
			if (!isNonEmptyString(this.settings.token)) {
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
			
			// Open project picker modal
			const projectPicker = new ProjectPickerModal(this.app, this);
			const selectedProject = await projectPicker.selectProject();
			
			if (!selectedProject) {
				new Notice('No project selected. Issue creation cancelled.');
				console.log('Project selection cancelled by user');
				return;
			}
			
			console.log('Selected project:', selectedProject.path_with_namespace);
			
			// Create issue with status bar feedback
			await this.createIssueWithProgress(activeFile, selectedProject.id);
		} catch (error) {
			console.error('Error in createIssueFromActiveFile:', error);
			new Notice('An unexpected error occurred while preparing to create the GitLab issue.');
		}
	}
	
	/**
	 * Create issue with status bar progress indicator
	 */
	private async createIssueWithProgress(file: TFile, projectId: number) {
		// Create status bar item with spinner
		const statusBar = this.addStatusBarItem();
		statusBar.addClass('gitlab-status-bar');
		
		const spinner = statusBar.createSpan({ cls: 'gl-spinner' });
		statusBar.createSpan({ text: `Creating GitLab issue...` });
		
		try {
			// Read file content and title
			const content = await this.app.vault.read(file);
			const title = file.basename;
			
			if (!title.trim()) {
				new Notice('File has no valid title. Cannot create GitLab issue.');
				return;
			}
			
			// Transform content for GitLab
			const transformedContent = transformMarkdownForGitLab(content);
			
			// Prepare issue data
			const issueData = {
				title: title,
				description: transformedContent,
				labels: this.settings.defaultLabels
					? this.settings.defaultLabels.split(',').map(l => l.trim()).filter(l => l)
					: []
			};
			
			console.log('Creating issue:', { title, projectId });
			
			// Create the GitLab issue
			const baseUrl = sanitizeBaseUrl(this.settings.gitlabUrl);
			const url = `${baseUrl}/api/v4/projects/${projectId}/issues`;
			
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.settings.token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(issueData),
				signal: AbortSignal.timeout(30000)
			});
			
			if (!response.ok) {
				let errorMessage = `GitLab API request failed with status ${response.status}`;
				
				if (response.status === 401) {
					errorMessage = 'Invalid or expired GitLab Personal Access Token.';
				} else if (response.status === 403) {
					errorMessage = 'Access denied. Please ensure your token has proper permissions.';
				} else if (response.status === 404) {
					errorMessage = 'Project not found. Please verify the project exists and you have access.';
				} else if (response.status >= 500) {
					errorMessage = 'GitLab server error. Please try again later.';
				}
				
				throw new Error(errorMessage);
			}
			
			const issueResponse = await response.json();
			const issueUrl = issueResponse.web_url;
			
			if (!issueUrl) {
				throw new Error('Invalid response from GitLab API: missing web_url');
			}
			
			// Update frontmatter
			const updatedContent = buildUpdatedFrontmatter(content, issueUrl);
			await this.app.vault.modify(file, updatedContent);
			
			console.log('Issue created successfully:', issueUrl);
			new Notice(`✅ GitLab issue created successfully!\n${issueUrl}`, 8000);
			
		} catch (error) {
			console.error('Error creating GitLab issue:', error);
			
			if (error instanceof DOMException && error.name === 'AbortError') {
				new Notice('⏱️ Request timeout: GitLab API request took too long.');
			} else {
				const message = error instanceof Error ? error.message : 'Unknown error';
				new Notice(`❌ Error creating GitLab issue: ${message}`);
			}
		} finally {
			// Always remove status bar item
			statusBar.remove();
		}
	}
}
