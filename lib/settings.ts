/**
 * Settings tab for GitLab plugin
 */

import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type GitLabPlugin from '../main';
import { testConnection, isNonEmptyString } from './utils';

export class GitLabSettingsTab extends PluginSettingTab {
	plugin: GitLabPlugin;
	private showToken = false;

	constructor(app: App, plugin: GitLabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'GitLab Issues Plugin Settings' });

		// Personal Access Token setting with show/hide and copy
		new Setting(containerEl)
			.setName('Personal Access Token')
			.setDesc('Your GitLab personal access token (required). Create one at GitLab → User Settings → Access Tokens with "api" scope.')
			.addExtraButton((button) =>
				button
					.setIcon('copy')
					.setTooltip('Copy token')
					.onClick(async () => {
						if (this.plugin.settings.token) {
							try {
								await navigator.clipboard.writeText(this.plugin.settings.token);
								new Notice('Token copied to clipboard');
							} catch (error) {
								new Notice('Failed to copy token to clipboard');
								console.error('Clipboard error:', error);
							}
						} else {
							new Notice('No token to copy');
						}
					})
			)
			.addExtraButton((button) =>
				button
					.setIcon(this.showToken ? 'eye-off' : 'eye')
					.setTooltip(this.showToken ? 'Hide token' : 'Show token')
					.onClick(() => {
						this.showToken = !this.showToken;
						this.display();
					})
			)
			.addText((text) => {
				text
					.setPlaceholder('glpat-xxxxxxxxxxxxxxxxxxxx')
					.setValue(this.plugin.settings.token)
					.onChange(async (value) => {
						this.plugin.settings.token = value;
						await this.plugin.saveSettings();
					});
				
				// Set input type based on showToken state
				text.inputEl.type = this.showToken ? 'text' : 'password';
			});

		// Test Connection button
		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Verify your GitLab credentials and connection')
			.addButton((button) =>
				button
					.setButtonText('Test Connection')
					.setCta()
					.onClick(async () => {
						const { token, gitlabUrl } = this.plugin.settings;

						if (!isNonEmptyString(token)) {
							new Notice('Please configure your Personal Access Token first');
							return;
						}

						button.setDisabled(true);
						button.setButtonText('Testing...');

						try {
							const result = await testConnection(token, gitlabUrl);
							
							if (result.success) {
								new Notice(`✅ ${result.message}`, 5000);
							} else {
								new Notice(`❌ Connection failed: ${result.message}`, 8000);
							}
						} catch (error) {
							const message = error instanceof Error ? error.message : 'Unknown error';
							new Notice(`❌ Connection failed: ${message}`, 8000);
						} finally {
							button.setButtonText('Test Connection');
							button.setDisabled(false);
						}
					})
			);

		// Default Labels setting
		new Setting(containerEl)
			.setName('Default Labels')
			.setDesc('Comma-separated list of default labels for issues (optional)')
			.addText((text) =>
				text
					.setPlaceholder('bug, enhancement, documentation')
					.setValue(this.plugin.settings.defaultLabels)
					.onChange(async (value) => {
						this.plugin.settings.defaultLabels = value;
						await this.plugin.saveSettings();
					})
			);

		// GitLab Instance URL setting
		new Setting(containerEl)
			.setName('GitLab Instance URL')
			.setDesc('GitLab instance base URL (defaults to https://gitlab.com)')
			.addText((text) =>
				text
					.setPlaceholder('https://gitlab.com')
					.setValue(this.plugin.settings.gitlabUrl)
					.onChange(async (value) => {
						this.plugin.settings.gitlabUrl = value || 'https://gitlab.com';
						await this.plugin.saveSettings();
					})
			);

		// Help section
		const helpSection = containerEl.createEl('div', { cls: 'gitlab-plugin-help' });
		helpSection.createEl('h3', { text: 'Setup Instructions' });
		
		const instructions = helpSection.createEl('ol');
		instructions.createEl('li', { text: 'Go to GitLab → User Settings → Access Tokens' });
		instructions.createEl('li', { text: 'Create a new token with "api" scope' });
		instructions.createEl('li', { text: 'Copy the token and paste it above' });
		instructions.createEl('li', { text: 'Click "Test Connection" to verify' });
		instructions.createEl('li', { text: 'Use the command palette to create GitLab issues from markdown files' });

		// Feature info section
		const featuresSection = containerEl.createEl('div', { cls: 'gitlab-plugin-help' });
		featuresSection.createEl('h3', { text: 'Features' });
		
		const features = featuresSection.createEl('ul');
		features.createEl('li', { text: 'Create GitLab issues from any markdown note' });
		features.createEl('li', { text: 'Select project dynamically when creating issues' });
		features.createEl('li', { text: 'Mark projects as favorites for quick access (⭐ icon in project picker)' });
		features.createEl('li', { text: 'Search all projects with "??" prefix in project picker' });
		features.createEl('li', { text: 'Automatic frontmatter update with issue URL' });
	}
}
