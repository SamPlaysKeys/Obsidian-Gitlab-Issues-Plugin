#!/usr/bin/env node

/**
 * GitLab Issues Plugin Bulk Renamer
 * 
 * This script reads a classification table and performs bulk replacements
 * from "GitLab Plugin" to "GitLab Issues Plugin" in approved files/lines.
 * 
 * Usage: node rename-gitlab-issues.js [classification-file]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CLASSIFICATION_FILE = process.argv[2] || 'rename-audit.txt';
const OLD_TEXT = 'GitLab Plugin';
const NEW_TEXT = 'GitLab Issues Plugin';

/**
 * Parse the classification table
 * Format: file_path:content
 */
function parseClassificationTable(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Classification file not found: ${filePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const approvedReplacements = [];
    
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
            console.warn(`Skipping malformed line (no colon): ${line}`);
            continue;
        }
        
        const filePath = line.substring(0, colonIndex);
        const content = line.substring(colonIndex + 1);
        
        // Check if the content contains the text we want to replace
        if (content.includes(OLD_TEXT)) {
            approvedReplacements.push({
                file: filePath,
                searchText: content.trim(),
                originalContent: content,
                newContent: content.replace(new RegExp(OLD_TEXT, 'g'), NEW_TEXT)
            });
        }
    }
    
    return approvedReplacements;
}

/**
 * Perform replacement in a specific file
 */
function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return false;
    }
    
    // Read the file and preserve line endings
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const originalLineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    
    // Get file stats to preserve permissions
    const stats = fs.statSync(filePath);
    
    let modified = false;
    
    // Apply replacements by searching for content
    for (const replacement of replacements) {
        const searchText = replacement.searchText;
        
        // Find the line that contains this exact content
        for (let i = 0; i < lines.length; i++) {
            const currentLine = lines[i];
            
            // Check if this line contains the search text (with some flexibility for whitespace)
            if (currentLine.trim() === searchText.trim() || 
                (currentLine.includes(OLD_TEXT) && currentLine.trim().includes(searchText.trim()))) {
                
                const newLine = currentLine.replace(new RegExp(OLD_TEXT, 'g'), NEW_TEXT);
                lines[i] = newLine;
                modified = true;
                console.log(`  Line ${i + 1}: ${OLD_TEXT} → ${NEW_TEXT}`);
                break; // Only replace the first match to be safe
            }
        }
    }
    
    if (modified) {
        // Write the file back with original line endings and permissions
        const newContent = lines.join(originalLineEnding);
        fs.writeFileSync(filePath, newContent, 'utf8');
        fs.chmodSync(filePath, stats.mode);
        return true;
    }
    
    return false;
}

/**
 * Main execution
 */
function main() {
    console.log('GitLab Issues Plugin Bulk Renamer');
    console.log('==================================');
    console.log(`Reading classification table: ${CLASSIFICATION_FILE}`);
    
    const approvedReplacements = parseClassificationTable(CLASSIFICATION_FILE);
    
    if (approvedReplacements.length === 0) {
        console.log('No approved replacements found.');
        return;
    }
    
    console.log(`Found ${approvedReplacements.length} approved replacement(s)`);
    console.log();
    
    // Group replacements by file
    const fileGroups = {};
    for (const replacement of approvedReplacements) {
        if (!fileGroups[replacement.file]) {
            fileGroups[replacement.file] = [];
        }
        fileGroups[replacement.file].push(replacement);
    }
    
    let totalFiles = 0;
    let totalReplacements = 0;
    
    // Process each file
    for (const [filePath, replacements] of Object.entries(fileGroups)) {
        console.log(`Processing: ${filePath}`);
        
        if (replaceInFile(filePath, replacements)) {
            totalFiles++;
            totalReplacements += replacements.length;
        }
        
        console.log();
    }
    
    console.log('Summary:');
    console.log(`- Files modified: ${totalFiles}`);
    console.log(`- Total replacements: ${totalReplacements}`);
    console.log();
    console.log('Bulk replacement completed successfully!');
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { parseClassificationTable, replaceInFile };

