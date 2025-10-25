/**
 * Project picker modal for selecting GitLab projects
 */

import { App, FuzzySuggestModal, FuzzyMatch, Notice, setIcon } from 'obsidian';
import type GitLabPlugin from '../main';
import { GitLabProject } from '../types';
import {
	fetchUserProjects,
	searchProjects,
	dedupeProjects,
	sortProjectsFavoring
} from './utils';

export class ProjectPickerModal extends FuzzySuggestModal<GitLabProject> {
	private plugin: GitLabPlugin;
	private resolvePromise!: (project: GitLabProject | null) => void;
	private cachedProjects: GitLabProject[] | null = null;
	private isLoading = false;
	private selectedProject: GitLabProject | null = null;
	private searchTimeout: NodeJS.Timeout | null = null;

	constructor(app: App, plugin: GitLabPlugin) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder('Type to search projects, or use "??" for remote search...');
	}

	/**
	 * Opens the modal and returns a promise that resolves with the selected project
	 */
	public selectProject(): Promise<GitLabProject | null> {
		return new Promise(async (resolve) => {
			this.resolvePromise = resolve;
			this.selectedProject = null;
			await this.loadProjectsAsync();
			this.open();
		});
	}

	/**
	 * Load projects asynchronously
	 */
	private async loadProjectsAsync(): Promise<void> {
		if (this.isLoading || this.cachedProjects !== null) {
			return;
		}

		this.isLoading = true;
		try {
			console.log('Loading GitLab projects...');
			const { token, gitlabUrl } = this.plugin.settings;
			this.cachedProjects = await fetchUserProjects(token, gitlabUrl);
			console.log(`Successfully loaded ${this.cachedProjects.length} projects`);
		} catch (error) {
			console.error('Error fetching projects:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			new Notice(`Failed to load projects: ${errorMessage}`, 8000);
			this.cachedProjects = [];
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Get items for fuzzy search (required by FuzzySuggestModal)
	 */
	getItems(): GitLabProject[] {
		if (!this.cachedProjects) {
			return [];
		}

		// Sort with favorites first
		const { favProjects } = this.plugin.settings;
		return sortProjectsFavoring([...this.cachedProjects], favProjects);
	}

	/**
	 * Get text to display and search against
	 */
	getItemText(project: GitLabProject): string {
		return `${project.name} ${project.path_with_namespace}`;
	}

	/**
	 * Handle custom fuzzy search including remote "??" search
	 */
	// @ts-ignore - Override parent method
	async getSuggestions(query: string): Promise<FuzzyMatch<GitLabProject>[]> {
		// Check for remote search prefix
		if (query.startsWith('??')) {
			const searchQuery = query.replace(/^\?\?/, '').trim();
			
			if (!searchQuery) {
				return [];
			}

			// Debounce remote searches
			if (this.searchTimeout) {
				clearTimeout(this.searchTimeout);
			}

			return new Promise((resolve) => {
				this.searchTimeout = setTimeout(async () => {
					try {
						const { token, gitlabUrl } = this.plugin.settings;
						const remoteResults = await searchProjects(token, gitlabUrl, searchQuery);
						
						// Merge with cached projects and dedupe
						const allProjects = dedupeProjects([
							...(this.cachedProjects || []),
							...remoteResults
						]);

						// Sort with favorites first
						const sorted = sortProjectsFavoring(allProjects, this.plugin.settings.favProjects);

						// Convert to FuzzyMatch format
						const matches = sorted.map(project => ({
							item: project,
							match: { score: 0, matches: [] as any[] }
						}));

						resolve(matches);
					} catch (error) {
						console.warn('Remote search failed:', error);
						resolve([]);
					}
				}, 300); // 300ms debounce
			});
		}

		// Default fuzzy search
		return super.getSuggestions(query);
	}

	/**
	 * Render each project suggestion with favorites star
	 */
	renderSuggestion(fuzzyMatch: FuzzyMatch<GitLabProject>, el: HTMLElement): void {
		const project = fuzzyMatch.item;
		const { favProjects } = this.plugin.settings;
		
		// Create container div
		const container = el.createDiv({ cls: 'gitlab-project-row' });
		
		// Left side: project info
		const infoDiv = container.createDiv({ cls: 'gitlab-project-info' });
		
		const nameEl = infoDiv.createDiv({ cls: 'gitlab-project-name' });
		nameEl.textContent = project.name;
		
		const pathEl = infoDiv.createDiv({ cls: 'gitlab-project-path' });
		pathEl.textContent = project.path_with_namespace;
		
		if (project.description && project.description.trim()) {
			const descEl = infoDiv.createDiv({ cls: 'gitlab-project-description' });
			descEl.textContent = project.description;
		}
		
		// Right side: favorite star icon
		const starContainer = container.createDiv({ cls: 'gitlab-project-star' });
		const starIcon = starContainer.createSpan({ cls: 'fav-icon' });
		setIcon(starIcon, 'star');
		
		if (favProjects.includes(project.id)) {
			starIcon.addClass('is-fav');
		}
		
		// Handle star click to toggle favorite
		starIcon.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			
			const currentFavs = this.plugin.settings.favProjects;
			const index = currentFavs.indexOf(project.id);
			
			if (index > -1) {
				// Remove from favorites
				currentFavs.splice(index, 1);
				starIcon.removeClass('is-fav');
			} else {
				// Add to favorites
				currentFavs.push(project.id);
				starIcon.addClass('is-fav');
			}
			
			this.plugin.saveSettings();
		});
	}

	/**
	 * Handle selection (fallback, selectSuggestion is called first)
	 */
	onChooseItem(project: GitLabProject, evt: MouseEvent | KeyboardEvent): void {
		console.log('onChooseItem called (fallback)');
		this.selectedProject = project;
		this.close();
	}

	/**
	 * Handle selection (primary method called by Obsidian)
	 */
	selectSuggestion(item: FuzzyMatch<GitLabProject>, evt: MouseEvent | KeyboardEvent): void {
		console.log('selectSuggestion called:', item.item.path_with_namespace);
		this.selectedProject = item.item;
		this.close();
	}

	/**
	 * Called when modal closes
	 */
	onClose(): void {
		super.onClose();
		
		console.log('Modal closing, selected project:', this.selectedProject?.path_with_namespace || 'none');
		
		if (this.resolvePromise) {
			this.resolvePromise(this.selectedProject);
		}
		
		// Clear search timeout
		if (this.searchTimeout) {
			clearTimeout(this.searchTimeout);
			this.searchTimeout = null;
		}
	}

	/**
	 * Empty state message
	 */
	getEmptyInputSuggestion(): string {
		if (this.isLoading) {
			return 'Loading projects...';
		}
		if (this.cachedProjects !== null && this.cachedProjects.length === 0) {
			return 'No projects found. Make sure you have access to GitLab projects.';
		}
		return 'Type to search projects, or use "??" for remote search...';
	}

	/**
	 * No results message
	 */
	getNoSuggestionMessage(query: string): string {
		if (query.startsWith('??')) {
			return `No projects found matching "${query.replace(/^\?\?/, '').trim()}". Try a different search term.`;
		}
		return `No projects found matching "${query}"`;
	}
}
