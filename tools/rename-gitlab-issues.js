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
 * Format: line_number|file_path:content
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
        const match = line.match(/^(\d+)\|([^:]+):(.*)$/);
        if (!match) {
            console.warn(`Skipping malformed line: ${line}`);
            continue;
        }
        
        const [, lineNumber, filePath, content] = match;
        
        // Check if the content contains the text we want to replace
        if (content.includes(OLD_TEXT)) {
            approvedReplacements.push({
                file: filePath,
                lineNumber: parseInt(lineNumber),
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
    
    // Apply replacements
    for (const replacement of replacements) {
        const lineIndex = replacement.lineNumber - 1; // Convert to 0-based index
        
        if (lineIndex >= 0 && lineIndex < lines.length) {
            const currentLine = lines[lineIndex];
            
            // Verify the line matches what we expect (safety check)
            if (currentLine.includes(OLD_TEXT)) {
                const newLine = currentLine.replace(new RegExp(OLD_TEXT, 'g'), NEW_TEXT);
                lines[lineIndex] = newLine;
                modified = true;
                console.log(`  Line ${replacement.lineNumber}: ${OLD_TEXT} → ${NEW_TEXT}`);
            } else {
                console.warn(`  Line ${replacement.lineNumber}: Content mismatch, skipping`);
            }
        } else {
            console.warn(`  Line ${replacement.lineNumber}: Out of range, skipping`);
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

