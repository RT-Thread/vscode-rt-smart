import {
    CancellationToken,
    Event,
    EventEmitter,
    ExtensionContext,
    FileDecoration,
    FileDecorationProvider,
    ThemeColor,
    Uri,
    window,
} from "vscode";

export class DecorationProvider implements FileDecorationProvider {
    private readonly _onDidChangeFileDecorations: EventEmitter<Uri | Uri[]> =
        new EventEmitter<Uri | Uri[]>();
    readonly onDidChangeFileDecorations: Event<Uri | Uri[]> =
        this._onDidChangeFileDecorations.event;
    public markedFiles: Set<string> = new Set<string>();
    private static instance: DecorationProvider;

    constructor(context: ExtensionContext) {
        // 注册文件装饰提供者
        context.subscriptions.push(
            window.registerFileDecorationProvider(this),
        );

        DecorationProvider.instance = this;
    }

    static getInstance(): DecorationProvider {
        return DecorationProvider.instance;
    }

    provideFileDecoration(uri: Uri, token: CancellationToken): FileDecoration | undefined {
        if (token.isCancellationRequested) {
            return;
        }

        if (this.markedFiles.has(uri.fsPath)) {
            return {
                propagate: true,
                badge: "📌",
                color: new ThemeColor("terminal.ansiCyan"),
            };
        }
    }

    public async markFile(uri: Uri) {
        if (!this.markedFiles.has(uri.fsPath)) {
            this.markedFiles.add(uri.fsPath);
            this._onDidChangeFileDecorations.fire(uri);
        }
    }

    public async unmarkFile(uri: Uri) {
        if (this.markedFiles.has(uri.fsPath)) {
            this.markedFiles.delete(uri.fsPath);
            this._onDidChangeFileDecorations.fire(uri);
        }
    }
}
