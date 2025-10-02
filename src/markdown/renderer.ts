import MarkdownIt from 'markdown-it';
import markdownItTaskLists from 'markdown-it-task-lists';
import markdownItGithubAlerts from 'markdown-it-github-alerts';
import markdownItKatex from '@neilsustc/markdown-it-katex';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItDeflist from 'markdown-it-deflist';
import * as markdownItEmoji from 'markdown-it-emoji';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
import hljs from 'highlight.js';
import { slugifyHeading } from './slugify';
import SlugifyMode from './slugifyMode';

export interface MarkdownRenderOptions {
    breaks?: boolean;
    linkify?: boolean;
    enableMath?: boolean;
    slugifyMode?: SlugifyMode;
    mathMacros?: Record<string, string>;
}

interface MathOptions {
    throwOnError?: boolean;
    macros?: Record<string, string>;
}

interface EngineRecord {
    md: MarkdownIt;
    slugCount: Map<string, number>;
}

export class MarkdownRenderer {
    private engines = new Map<string, EngineRecord>();

    public render(text: string, options: MarkdownRenderOptions = {}): string {
        const enableMath = options.enableMath !== false;
        const slugifyMode = options.slugifyMode ?? SlugifyMode.GitHub;
        const key = this.composeEngineKey(enableMath, slugifyMode, options.mathMacros);
        const engineRecord = this.ensureEngine(key, enableMath, slugifyMode, options.mathMacros);

        engineRecord.slugCount.clear();

        engineRecord.md.set({
            breaks: options.breaks === true,
            linkify: options.linkify !== false,
        });

        const env = Object.create(null);
        return engineRecord.md.render(text, env);
    }

    private composeEngineKey(enableMath: boolean, slugifyMode: SlugifyMode, macros?: Record<string, string>): string {
        const macroEntries = macros ? Object.keys(macros).sort().map((k) => `${k}:${macros[k]}`) : [];
        return `${enableMath ? 'math' : 'nomath'}|${slugifyMode}|${macroEntries.join(',')}`;
    }

    private ensureEngine(key: string, enableMath: boolean, slugifyMode: SlugifyMode, macros?: Record<string, string>): EngineRecord {
        let record = this.engines.get(key);
        if (!record) {
            const slugCount = new Map<string, number>();
            const md = this.createEngine(enableMath, slugCount, slugifyMode, macros);
            record = { md, slugCount };
            this.engines.set(key, record);
        }
        return record;
    }

    private createEngine(enableMath: boolean, slugCount: Map<string, number>, slugifyMode: SlugifyMode, macros?: Record<string, string>): MarkdownIt {
        const md = new MarkdownIt({
            html: true,
            highlight: (str: string, lang?: string) => {
                if (lang) {
                    const normalized = this.normalizeHighlightLang(lang);
                    if (normalized && hljs.getLanguage(normalized)) {
                        try {
                            return hljs.highlight(str, { language: normalized, ignoreIllegals: true }).value;
                        } catch {
                            // ignore highlighting errors and fallback to default rendering
                        }
                    }
                }
                return '';
            }
        });

        md.use(markdownItTaskLists, { enabled: true, label: true, labelAfter: false });
        md.use(markdownItGithubAlerts, { matchCaseSensitive: false });
        md.use(markdownItFootnote);
        md.use(markdownItDeflist);
        md.use(markdownItEmoji.full || markdownItEmoji);
        md.use(markdownItSub);
        md.use(markdownItSup);

        if (enableMath) {
            require('katex/contrib/mhchem');
            const katexOptions: MathOptions = { throwOnError: false };
            if (macros && Object.keys(macros).length > 0) {
                katexOptions.macros = JSON.parse(JSON.stringify(macros));
            }
            md.use(markdownItKatex, katexOptions);
        }

        this.addNamedHeaders(md, slugCount, slugifyMode);
        return md;
    }

    private addNamedHeaders(md: MarkdownIt, slugCount: Map<string, number>, slugifyMode: SlugifyMode): void {
        const originalHeadingOpen = md.renderer.rules.heading_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

        md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
            const raw = tokens[idx + 1]?.content ?? '';
            const baseSlug = slugifyHeading(raw, env ?? Object.create(null), slugifyMode) || 'section';
            const finalSlug = this.resolveUniqueSlug(slugCount, baseSlug);
            tokens[idx].attrs = [...(tokens[idx].attrs || []), ['id', finalSlug]];

            return originalHeadingOpen(tokens, idx, options, env, self);
        };
    }

    private resolveUniqueSlug(slugCount: Map<string, number>, base: string): string {
        const previous = slugCount.get(base);
        if (previous === undefined) {
            slugCount.set(base, 0);
            return base;
        }

        const next = previous + 1;
        slugCount.set(base, next);
        return `${base}-${next}`;
    }

    private normalizeHighlightLang(lang: string): string {
        switch (lang.toLowerCase()) {
            case 'tsx':
            case 'typescriptreact':
                return 'jsx';
            case 'json5':
            case 'jsonc':
                return 'json';
            case 'c#':
            case 'csharp':
                return 'cs';
            default:
                return lang.toLowerCase();
        }
    }
}

export const markdownRenderer = new MarkdownRenderer();
