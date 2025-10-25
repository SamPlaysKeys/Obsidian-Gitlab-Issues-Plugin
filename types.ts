/**
 * GitLab API types and utility functions
 */

/**
 * Example usage:
 * 
 * try {
 *   const projects = await fetchUserProjects(token, 'https://gitlab.com');
 *   console.log(`Found ${projects.length} projects`);
 *   projects.forEach(project => {
 *     console.log(`${project.name} (${project.path_with_namespace}) - ${project.web_url}`);
 *   });
 * } catch (error) {
 *   console.error('Failed to fetch projects:', error.message);
 * }
 */
/**
 * Configuration settings for the GitLab plugin
 */
export interface GitLabSettings {
	/** GitLab Personal Access Token for API authentication */
	token: string;
	/** Comma-separated list of default labels to apply to created issues */
	defaultLabels: string;
	/** Base URL of the GitLab instance */
	gitlabUrl: string;
	/** Array of favorite project IDs for quick access */
	favProjects: number[];
}

export interface GitLabProject {
	id: number;
	name: string;
	path_with_namespace: string;
	description: string | null;
	web_url: string;
}

export interface GitLabApiError {
	message: string;
	status?: number;
}

/**
 * Fetches user projects from GitLab API with pagination support
 * @param token - GitLab personal access token
 * @param baseUrl - GitLab instance base URL (defaults to gitlab.com)
 * @returns Promise<GitLabProject[]> - Array of user projects
 * @throws Error with descriptive message on failure
 */
export async function fetchUserProjects(
	token: string,
	baseUrl: string = 'https://gitlab.com'
): Promise<GitLabProject[]> {
	try {
		if (!token || token.trim() === '') {
			throw new Error('GitLab Personal Access Token is required');
		}

		const allProjectsFromAllPages: GitLabProject[] = [];
		let page = 1;
		const perPage = 100;
		let hasMorePages = true;

		while (hasMorePages) {
			const apiEndpointUrl = `${baseUrl.replace(/\/$/, '')}/api/v4/projects?membership=true&simple=true&per_page=${perPage}&page=${page}`;
			
			console.log(`Fetching GitLab projects page ${page}...`);
			
			try {
				const apiResponse = await fetch(apiEndpointUrl, {
					method: 'GET',
					headers: {
						'Authorization': `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					// Add timeout to prevent hanging requests
					signal: AbortSignal.timeout(30000) // 30 second timeout
				});

				if (!apiResponse.ok) {
					let errorMessage = `GitLab API request failed with status ${apiResponse.status}`;
					
					if (apiResponse.status === 401) {
						errorMessage = 'Invalid or expired GitLab Personal Access Token. Please check your token in plugin settings.';
					} else if (apiResponse.status === 403) {
						errorMessage = 'Access denied. Please ensure your token has "api" scope permissions.';
					} else if (apiResponse.status === 404) {
						errorMessage = 'GitLab API endpoint not found. Please check your GitLab instance URL.';
					} else if (apiResponse.status >= 500) {
						errorMessage = 'GitLab server error. Please try again later.';
					} else {
						// Try to extract error message from response body
						try {
							const errorResponseData = await apiResponse.json();
							if (errorResponseData.message) {
								errorMessage += `: ${errorResponseData.message}`;
							}
						} catch {
							// Ignore JSON parse errors, use default message
						}
					}
					
					console.error('GitLab API error:', {
						status: apiResponse.status,
						statusText: apiResponse.statusText,
						url: apiEndpointUrl
					});
					
					throw new Error(errorMessage);
				}

			const responseData = await apiResponse.json();
			
			if (!Array.isArray(responseData)) {
				throw new Error('Unexpected response format from GitLab API');
			}

			// Validate and transform project data
			const currentPageProjects = responseData
				.filter((projectData: any) => {
					// Basic validation of required fields
					return projectData &&
						typeof projectData.id === 'number' &&
						typeof projectData.name === 'string' &&
						typeof projectData.path_with_namespace === 'string' &&
						typeof projectData.web_url === 'string';
				})
				.map((projectData: any): GitLabProject => ({
					id: projectData.id,
					name: projectData.name,
					path_with_namespace: projectData.path_with_namespace,
					description: projectData.description || null,
					web_url: projectData.web_url
				}));

			allProjectsFromAllPages.push(...currentPageProjects);

			// Check if there are more pages
			// GitLab uses X-Next-Page header or checks if we got a full page
			const nextPageNumber = apiResponse.headers.get('X-Next-Page');
				if (nextPageNumber && nextPageNumber !== '') {
					page = parseInt(nextPageNumber, 10);
				} else if (currentPageProjects.length < perPage) {
					// If we got fewer projects than requested, we're on the last page
					hasMorePages = false;
				} else {
					// No next page header but got full page, try next page
					page++;
					// Set a reasonable limit to prevent infinite loops
					if (page > 100) {
						console.warn('Reached maximum page limit (100) while fetching GitLab projects');
						hasMorePages = false;
					}
				}

				console.log(`Fetched ${currentPageProjects.length} projects from page ${page - 1}`);
				
			} catch (error) {
				if (error instanceof Error) {
					// Re-throw known errors
					throw error;
				}
				
				// Handle network errors, timeouts, etc.
				if (error instanceof TypeError && error.message.includes('fetch')) {
					throw new Error('Network error: Unable to connect to GitLab. Please check your internet connection and GitLab instance URL.');
				}
				
				if (error instanceof DOMException && error.name === 'AbortError') {
					throw new Error('Request timeout: GitLab API request took too long. Please try again.');
				}
				
				throw new Error(`Unexpected error while fetching GitLab projects: ${error}`);
			}
		}

		console.log(`Successfully fetched ${allProjectsFromAllPages.length} total GitLab projects`);
		return allProjectsFromAllPages;
		
	} catch (error) {
		console.error('Error in fetchUserProjects:', error);
		
		if (error instanceof Error) {
			throw error;
		}
		
		throw new Error(`Failed to fetch GitLab projects: ${error}`);
	}
}

