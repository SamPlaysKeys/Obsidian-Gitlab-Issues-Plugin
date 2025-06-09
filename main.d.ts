import { Plugin } from 'obsidian';
interface GitLabSettings {
    token: string;
    projectId: string;
    defaultLabels: string;
}
export default class GitLabPlugin extends Plugin {
    settings: GitLabSettings;
    onload(): Promise<void>;
    onunload(): void;
    loadSettings(): Promise<void>;
    saveSettings(): Promise<void>;
    private createIssueFromActiveFile;
    private triggerIssueCreation;
    /**
     * Creates a GitLab issue from note title and content
     * @param title - The note title to use as issue title
     * @param content - The markdown content to use as issue description
     * @returns Promise<string | null> - The web_url of the created issue or null if failed
     */
    private createGitLabIssue;
    /**
     * Performs minimal transformation of markdown content for GitLab issue description
     * @param content - Raw markdown content from the note
     * @returns Transformed content suitable for GitLab issues
     */
    private transformMarkdownForGitLab;
    /**
     * Updates the frontmatter of a note with the GitLab issue URL
     * @param file - The TFile to update
     * @param issueUrl - The GitLab issue web URL to add to frontmatter
     */
    private updateNoteFrontmatter;
    /**
     * Adds GitLab issue URL to existing frontmatter
     * @param content - Current file content with existing frontmatter
     * @param issueUrl - GitLab issue URL to add
     * @returns Updated content with GitLab URL in frontmatter
     */
    private addToExistingFrontmatter;
    /**
     * Creates new frontmatter with GitLab issue URL
     * @param content - Current file content without frontmatter
     * @param issueUrl - GitLab issue URL to add
     * @returns Content with new frontmatter containing GitLab URL
     */
    private createNewFrontmatter;
    /**
     * Validates plugin settings and shows appropriate warnings
     * @returns boolean - true if settings are valid, false otherwise
     */
    private validateSettings;
}
export {};
//# sourceMappingURL=main.d.ts.map