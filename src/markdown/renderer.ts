import MarkdownIt from 'markdown-it';
import markdownItTaskLists from 'markdown-it-task-lists';
import markdownItGithubAlerts from 'markdown-it-github-alerts';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItDeflist from 'markdown-it-deflist';
import * as markdownItEmoji from 'markdown-it-emoji';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
// Use core library and register only essential languages for RT-Thread development
import hljs from 'highlight.js/lib/core';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';

// Register only essential languages: C/C++, Python, JavaScript/TypeScript
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c++', cpp);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
import { slugifyHeading } from './slugify';
import SlugifyMode from './slugifyMode';

export interface MarkdownRenderOptions {
    breaks?: boolean;
    linkify?: boolean;
    slugifyMode?: SlugifyMode;
}

interface EngineRecord {
    md: MarkdownIt;
    slugCount: Map<string, number>;
}

export class MarkdownRenderer {
    private engines = new Map<string, EngineRecord>();

    public render(text: string, options: MarkdownRenderOptions = {}): string {
        const slugifyMode = options.slugifyMode ?? SlugifyMode.GitHub;
        const key = this.composeEngineKey(slugifyMode);
        const engineRecord = this.ensureEngine(key, slugifyMode);

        engineRecord.slugCount.clear();

        engineRecord.md.set({
            breaks: options.breaks === true,
            linkify: options.linkify !== false,
        });

        const env = Object.create(null);
        return engineRecord.md.render(text, env);
    }

    private composeEngineKey(slugifyMode: SlugifyMode): string {
        return `${slugifyMode}`;
    }

    private ensureEngine(key: string, slugifyMode: SlugifyMode): EngineRecord {
        let record = this.engines.get(key);
        if (!record) {
            const slugCount = new Map<string, number>();
            const md = this.createEngine(slugCount, slugifyMode);
            record = { md, slugCount };
            this.engines.set(key, record);
        }
        return record;
    }

    private createEngine(slugCount: Map<string, number>, slugifyMode: SlugifyMode): MarkdownIt {
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
