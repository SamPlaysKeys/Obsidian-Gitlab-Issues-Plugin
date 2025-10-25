/**
 * Shared utility functions for the GitLab plugin
 */

import { Notice } from 'obsidian';
import { GitLabSettings, GitLabProject } from '../types';

/**
 * Get default plugin settings
 */
export function getDefaultSettings(): GitLabSettings {
	return {
		token: '',
		defaultLabels: '',
		gitlabUrl: 'https://gitlab.com',
		favProjects: []
	};
}

/**
 * Sanitize base URL by removing trailing slash
 */
export function sanitizeBaseUrl(url: string): string {
	return url.replace(/\/$/, '');
}

/**
 * Check if string is non-empty
 */
export function isNonEmptyString(value: string): boolean {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate URL format
 */
export function isValidUrl(urlString: string): boolean {
	try {
		const url = new URL(urlString);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Handle API errors and convert to user-friendly messages
 */
export function handleApiError(status: number, statusText: string): string {
	if (status === 401) {
		return 'Invalid or expired GitLab Personal Access Token. Please check your token in plugin settings.';
	} else if (status === 403) {
		return 'Access denied. Please ensure your token has proper permissions.';
	} else if (status === 404) {
		return 'Resource not found. Please verify the URL and permissions.';
	} else if (status >= 500) {
		return 'GitLab server error. Please try again later.';
	}
	return `Request failed with status ${status}: ${statusText}`;
}

/**
 * Fetch user projects from GitLab API with pagination support
 * @param token - GitLab personal access token
 * @param baseUrl - GitLab instance base URL
 * @returns Promise<GitLabProject[]> - Array of user projects
 */
export async function fetchUserProjects(
	token: string,
	baseUrl: string = 'https://gitlab.com'
): Promise<GitLabProject[]> {
	if (!token || token.trim() === '') {
		throw new Error('GitLab Personal Access Token is required');
	}

	const allProjects: GitLabProject[] = [];
	let page = 1;
	const perPage = 100;
	let hasMorePages = true;

	while (hasMorePages) {
		const sanitizedBase = sanitizeBaseUrl(baseUrl);
		const url = `${sanitizedBase}/api/v4/projects?membership=true&simple=true&per_page=${perPage}&page=${page}`;
		
		console.log(`Fetching GitLab projects page ${page}...`);
		
		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				signal: AbortSignal.timeout(30000) // 30 second timeout
			});

			if (!response.ok) {
				const errorMessage = handleApiError(response.status, response.statusText);
				throw new Error(errorMessage);
			}

			const data = await response.json();
			
			if (!Array.isArray(data)) {
				throw new Error('Unexpected response format from GitLab API');
			}

			// Validate and transform project data
			const projects = data
				.filter((p: any) => 
					p &&
					typeof p.id === 'number' &&
					typeof p.name === 'string' &&
					typeof p.path_with_namespace === 'string' &&
					typeof p.web_url === 'string'
				)
				.map((p: any): GitLabProject => ({
					id: p.id,
					name: p.name,
					path_with_namespace: p.path_with_namespace,
					description: p.description || null,
					web_url: p.web_url
				}));

			allProjects.push(...projects);

			// Check pagination
			const nextPage = response.headers.get('X-Next-Page');
			if (nextPage && nextPage !== '') {
				page = parseInt(nextPage, 10);
			} else if (projects.length < perPage) {
				hasMorePages = false;
			} else {
				page++;
				if (page > 100) {
					console.warn('Reached maximum page limit (100)');
					hasMorePages = false;
				}
			}

			console.log(`Fetched ${projects.length} projects from page ${page - 1}`);
			
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			
			if (error instanceof TypeError && error.message.includes('fetch')) {
				throw new Error('Network error: Unable to connect to GitLab. Please check your internet connection.');
			}
			
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new Error('Request timeout: GitLab API request took too long.');
			}
			
			throw new Error(`Unexpected error while fetching projects: ${error}`);
		}
	}

	console.log(`Successfully fetched ${allProjects.length} total GitLab projects`);
	return allProjects;
}

/**
 * Search projects remotely using GitLab API search
 * @param token - GitLab personal access token
 * @param baseUrl - GitLab instance base URL
 * @param searchQuery - Search query string
 * @returns Promise<GitLabProject[]> - Array of matching projects
 */
export async function searchProjects(
	token: string,
	baseUrl: string,
	searchQuery: string
): Promise<GitLabProject[]> {
	if (!searchQuery || searchQuery.trim() === '') {
		return [];
	}

	const sanitizedBase = sanitizeBaseUrl(baseUrl);
	const encodedQuery = encodeURIComponent(searchQuery.trim());
	const url = `${sanitizedBase}/api/v4/projects?membership=true&simple=true&search=${encodedQuery}&per_page=50`;
	
	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			signal: AbortSignal.timeout(30000)
		});

		if (!response.ok) {
			// Don't throw error for search, just return empty array
			console.warn(`Search failed: ${response.status}`);
			return [];
		}

		const data = await response.json();
		
		if (!Array.isArray(data)) {
			return [];
		}

		return data
			.filter((p: any) => 
				p &&
				typeof p.id === 'number' &&
				typeof p.name === 'string' &&
				typeof p.path_with_namespace === 'string'
			)
			.map((p: any): GitLabProject => ({
				id: p.id,
				name: p.name,
				path_with_namespace: p.path_with_namespace,
				description: p.description || null,
				web_url: p.web_url
			}));
			
	} catch (error) {
		console.warn('Search failed:', error);
		return [];
	}
}

/**
 * Deduplicate projects by ID
 */
export function dedupeProjects(projects: GitLabProject[]): GitLabProject[] {
	const seen = new Set<number>();
	return projects.filter(p => {
		if (seen.has(p.id)) {
			return false;
		}
		seen.add(p.id);
		return true;
	});
}

/**
 * Sort projects with favorites first, then alphabetically
 */
export function sortProjectsFavoring(
	projects: GitLabProject[],
	favoriteIds: number[]
): GitLabProject[] {
	const favSet = new Set(favoriteIds);
	
	return projects.sort((a, b) => {
		const aFav = favSet.has(a.id);
		const bFav = favSet.has(b.id);
		
		// Favorites first
		if (aFav && !bFav) return -1;
		if (!aFav && bFav) return 1;
		
		// Then alphabetically by name
		return a.name.localeCompare(b.name);
	});
}

/**
 * Strip YAML frontmatter from markdown content
 */
export function stripFrontmatter(content: string): string {
	return content.replace(/^---[\s\S]*?---\n?/, '');
}

/**
 * Transform markdown content for GitLab issue description
 */
export function transformMarkdownForGitLab(content: string): string {
	let transformed = stripFrontmatter(content);
	
	// Convert Obsidian wikilinks to plain text
	transformed = transformed.replace(/\[\[([^\]]+)\]\]/g, '$1');
	
	// Wrap Obsidian tags in backticks
	transformed = transformed.replace(/#([a-zA-Z0-9_-]+)/g, '`#$1`');
	
	transformed = transformed.trim();
	
	if (!transformed) {
		transformed = 'Created from Obsidian note (content was empty)';
	}
	
	return transformed;
}

/**
 * Build updated frontmatter with GitLab issue URL
 */
export function buildUpdatedFrontmatter(content: string, issueUrl: string): string {
	const frontmatterMatch = content.match(/^(---\n[\s\S]*?)\n---/);
	
	if (!frontmatterMatch) {
		// No frontmatter exists, create new one
		return `---\ngitlab_issue_url: "${issueUrl}"\n---\n${content}`;
	}
	
	const existingFrontmatter = frontmatterMatch[1];
	const afterFrontmatter = content.slice(frontmatterMatch[0].length);
	
	let updatedFrontmatter: string;
	if (existingFrontmatter.includes('gitlab_issue_url:')) {
		// Replace existing URL
		updatedFrontmatter = existingFrontmatter.replace(
			/gitlab_issue_url:.*$/m,
			`gitlab_issue_url: "${issueUrl}"`
		);
	} else {
		// Add new URL
		updatedFrontmatter = existingFrontmatter + `\ngitlab_issue_url: "${issueUrl}"`;
	}
	
	return updatedFrontmatter + '\n---' + afterFrontmatter;
}

/**
 * Test GitLab connection by fetching current user
 */
export async function testConnection(token: string, baseUrl: string): Promise<{ success: boolean; message: string; username?: string }> {
	try {
		const sanitizedBase = sanitizeBaseUrl(baseUrl);
		const url = `${sanitizedBase}/api/v4/user`;
		
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			const errorMessage = handleApiError(response.status, response.statusText);
			return { success: false, message: errorMessage };
		}

		const data = await response.json();
		const username = data.username || data.name || 'Unknown';
		
		return {
			success: true,
			message: `Connected successfully as ${username}`,
			username
		};
		
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return { success: false, message: 'Connection timeout' };
		}
		
		const message = error instanceof Error ? error.message : 'Connection failed';
		return { success: false, message };
	}
}
