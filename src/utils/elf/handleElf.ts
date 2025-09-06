import { ElfAnalyzer } from './index';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

const SECTIONS = 'sections';
const SYMBOLS_BY_SECTION = 'symbolsBySection';
const SYMBOLS_BY_SECTION_FROM_ELF = "symbolsBySectionFromElf";

// Test the analyzer with local files
export async function handleElf(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {

    // 1. 先判断是否存在工作区
    if (!vscode.workspace.workspaceFolders) {
        // 提示用户打开工作区
        vscode.window.showErrorMessage('请先打开一个项目文件夹或工作区！');
        return;
    }
    const projectPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const elfPath = path.join(projectPath, 'rtthread.elf');
    const mapPath = path.join(projectPath, 'rtthread.map');

    // Check if files exist
    const elfExists = fs.existsSync(elfPath);
    const mapExists = fs.existsSync(mapPath);

    if (!elfExists && !mapExists) {
        console.log('\nPlease place rtthread.elf and/or rtthread.map in the current directory to test.');
        vscode.window.showInformationMessage('ELF 或 MAP 文件不存在！请检查当前目录下是否存在 rtthread.elf 和 rtthread.map 文件');
        return;
    }

    try {
        const analyzer = new ElfAnalyzer(
            elfExists ? elfPath : undefined,
            mapExists ? mapPath : undefined
        );

        // Test getSections
        const sections = analyzer.getSections();
        const postSections = [];
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const symbols = analyzer.getSymbolsBySection(section.name);
            if (symbols.length > 0) {
                postSections.push(section);
            }
        }
        console.log('\n=== Sections (Top 5) ===', postSections);
        panel.webview.postMessage({ eventName: SECTIONS, data: postSections, from: 'extension' });

        // 监听 Webview 发送的消息
        panel.webview.onDidReceiveMessage(
            (message) => {
                // 根据消息中的 command 处理不同逻辑
                switch (message.eventName) {
                    case SYMBOLS_BY_SECTION:
                        const symbols = analyzer.getSymbolsBySection(message.sectionName);
                        panel.webview.postMessage({ eventName: SYMBOLS_BY_SECTION_FROM_ELF, data: symbols, from: 'extension' });
                    default:
                        break;
                }
            },
            undefined, // 可选的错误处理
        );

        // Test getSymbolsBySection
        if (elfExists) {
            const sections = analyzer.getSections();
            const textSection = sections.find(s => s.name === '.text');
            if (textSection) {
                const textSymbols = analyzer.getSymbolsBySection('.text');
            }
        }

        // Test getSymbols by object (if MAP file available)
        if (mapExists) {
            const allSymbols = analyzer.getAllSymbols();
            const uniqueObjects = new Set(allSymbols.map(s => s.object).filter(o => o));
            const firstObject = Array.from(uniqueObjects)[0];

            if (firstObject) {
                console.log(`\n=== Symbols in ${firstObject} (Top 5) ===`);
                const objectSymbols = analyzer.getSymbols(firstObject);
                console.log(`Found ${objectSymbols.length} symbols:`);
                objectSymbols.slice(0, 5).forEach(symbol => {
                    console.log(`  ${symbol.name}: size=${symbol.size}, addr=${symbol.hexaddr}`);
                });
            }
        }

    } catch (error) {
        console.error('Error during analysis:', error);
    }
}