import { ElfAnalyzer } from './index';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

const SECTIONS = 'sections';
const SYMBOLS_BY_SECTION = 'symbolsBySection';
const SYMBOLS_BY_SECTION_FROM_ELF = "symbolsBySectionFromElf";
const GET_SYMBOL_INFO = 'getSymbolInfo';
const SYMBOL_INFO_RESPONSE = 'symbolInfoResponse';
const OPEN_SYMBOL_SOURCE = 'openSymbolSource';

// Test the analyzer with local files
export async function handleElf(context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {

    // 1. 先判断是否存在工作区
    if (!vscode.workspace.workspaceFolders) {
        // 提示用户打开工作区
        vscode.window.showErrorMessage('请先打开一个项目文件夹或工作区！');
        return;
    }
    const projectPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
    
    // Support both naming conventions: rtthread.* and rt-thread.*
    let elfPath = path.join(projectPath, 'rtthread.elf');
    let mapPath = path.join(projectPath, 'rtthread.map');
    
    // Check for rtthread.* first
    let elfExists = fs.existsSync(elfPath);
    let mapExists = fs.existsSync(mapPath);
    
    // If not found, try rt-thread.*
    if (!elfExists) {
        elfPath = path.join(projectPath, 'rt-thread.elf');
        elfExists = fs.existsSync(elfPath);
    }
    
    if (!mapExists) {
        mapPath = path.join(projectPath, 'rt-thread.map');
        mapExists = fs.existsSync(mapPath);
    }

    if (!elfExists && !mapExists) {
        // console.log('\nPlease place rtthread.elf and/or rtthread.map in the current directory to test.');
        vscode.window.showInformationMessage('ELF 或 MAP 文件不存在！请检查当前目录下是否存在 rtthread.elf/rt-thread.elf 或 rtthread.map/rt-thread.map 文件');
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
            async (message) => {
                console.log(message.eventName);
                if (message.eventName === GET_SYMBOL_INFO) {
                    console.log('GET_SYMBOL_INFO');
                }
                if (message.eventName === OPEN_SYMBOL_SOURCE) {
                    console.log('OPEN_SYMBOL_SOURCE');
                }

                // 根据消息中的 command 处理不同逻辑
                switch (message.eventName) {
                    case SYMBOLS_BY_SECTION:
                        const symbols = analyzer.getSymbolsBySection(message.sectionName);
                        panel.webview.postMessage({ eventName: SYMBOLS_BY_SECTION_FROM_ELF, data: symbols, from: 'extension' });
                        break;
                    
                    case GET_SYMBOL_INFO:
                        // 获取符号的调试信息（源文件和行号）
                        const symbolInfo = analyzer.getSymbolWithDebugInfo(message.symbolName);
                        panel.webview.postMessage({ 
                            eventName: SYMBOL_INFO_RESPONSE, 
                            data: symbolInfo, 
                            from: 'extension' 
                        });
                        break;
                    
                    case OPEN_SYMBOL_SOURCE:
                        // 打开符号对应的源代码文件
                        const symbol = analyzer.getSymbolWithDebugInfo(message.symbolName);
                        if (symbol && symbol.sourceFile) {
                            try {
                                // 处理相对路径和绝对路径
                                let filePath = symbol.sourceFile;
                                if (!path.isAbsolute(filePath)) {
                                    filePath = path.join(projectPath, filePath);
                                }
                                
                                // 检查文件是否存在
                                if (fs.existsSync(filePath)) {
                                    const document = await vscode.workspace.openTextDocument(filePath);
                                    const editor = await vscode.window.showTextDocument(document);
                                    
                                    // 跳转到指定行号
                                    if (symbol.sourceLine && symbol.sourceLine > 0) {
                                        const position = new vscode.Position(symbol.sourceLine - 1, 0);
                                        const range = new vscode.Range(position, position);
                                        editor.selection = new vscode.Selection(range.start, range.end);
                                        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                                    }
                                    
                                    // vscode.window.showInformationMessage(`已打开 ${symbol.name} 的源代码位置`);
                                } else {
                                    vscode.window.showWarningMessage(`源文件不存在: ${filePath}`);
                                }
                            } catch (error) {
                                vscode.window.showErrorMessage(`无法打开源文件: ${error}`);
                            }
                        } else {
                            vscode.window.showWarningMessage(`无法找到符号 ${message.symbolName} 的源代码位置`);
                        }
                        break;
                    
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