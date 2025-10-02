import MarkdownIt from 'markdown-it';
import SlugifyMode from './slugifyMode';

const inlineEngine = new MarkdownIt('commonmark');
const utf8Encoder = new TextEncoder();

const Regexp_Github_Punctuation = /[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc}\- ]/gu;
const Regexp_Gitlab_Product_Suffix = /[ \t\r\n\f\v]*\**\((?:core|starter|premium|ultimate)(?:[ \t\r\n\f\v]+only)?\)\**/g;

function mdInlineToPlainText(text: string, env: object): string {
    const inlineTokens = inlineEngine.parseInline(text, env)[0]?.children ?? [];
    return inlineTokens.reduce<string>((result, token) => {
        switch (token.type) {
            case 'image':
            case 'html_inline':
                return result;
            default:
                return result + token.content;
        }
    }, '');
}

const slugifyHandlers: Record<SlugifyMode, (rawContent: string, env: object) => string> = {
    [SlugifyMode.AzureDevOps]: (slug: string): string => {
        slug = slug.trim().toLowerCase().replace(/\p{Zs}/gu, '-');
        if (/^\d/.test(slug)) {
            slug = Array.from(utf8Encoder.encode(slug), (b) => `%${b.toString(16)}`).join('').toUpperCase();
        } else {
            slug = encodeURIComponent(slug);
        }
        return slug;
    },

    [SlugifyMode.BitbucketCloud]: (slug: string, env: object): string => {
        return 'markdown-header-' + slugifyHandlers[SlugifyMode.GitHub](slug, env).replace(/-+/g, '-');
    },

    [SlugifyMode.Gitea]: (slug: string): string => {
        return slug
            .replace(/^[^\p{L}\p{N}]+/u, '')
            .replace(/[^\p{L}\p{N}]+$/u, '')
            .replace(/[^\p{L}\p{N}]+/gu, '-')
            .toLowerCase();
    },

    [SlugifyMode.GitHub]: (slug: string, env: object): string => {
        slug = mdInlineToPlainText(slug, env)
            .replace(Regexp_Github_Punctuation, '')
            .toLowerCase()
            .replace(/ /g, '-');
        return slug;
    },

    [SlugifyMode.GitLab]: (slug: string, env: object): string => {
        slug = mdInlineToPlainText(slug, env)
            .replace(/^[ \t\r\n\f\v]+/, '')
            .replace(/[ \t\r\n\f\v]+$/, '')
            .toLowerCase()
            .replace(Regexp_Gitlab_Product_Suffix, '')
            .replace(Regexp_Github_Punctuation, '')
            .replace(/ /g, '-')
            .replace(/-+/g, '-');
        if (/^(\d+)$/.test(slug)) {
            slug = `anchor-${slug}`;
        }
        return slug;
    },

    [SlugifyMode.VisualStudioCode]: (rawContent: string, env: object): string => {
        const plain = inlineEngine.parseInline(rawContent, env)[0]?.children?.reduce<string>((result, token) => result + token.content, '') ?? '';
        return encodeURI(
            plain
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[\]\[\!\'\#\$\%\&\(\)\*\+\,\.\/\:\;\<\=\>\?\@\\\^\_\{\|\}\~\`。，、；：？！…—·ˉ¨‘’“”々～‖∶＂＇｀｜〃〔〕〈〉《》「」『』．〖〗【】（）［］｛｝]/g, '')
                .replace(/^\-+/, '')
                .replace(/\-+$/, '')
        );
    },

    [SlugifyMode.Zola]: (rawContent: string, env: object): string => {
        // 退化为 GitHub 行为；如需完整兼容，可后续引入 zola-slug wasm 实现。
        return slugifyHandlers[SlugifyMode.GitHub](rawContent, env);
    },
};

export function slugifyHeading(raw: string, env: object, mode: SlugifyMode): string {
    const handler = slugifyHandlers[mode] ?? slugifyHandlers[SlugifyMode.GitHub];
    let slug = handler(raw, env);
    slug = slug
        .replace(/\s+/g, '-')
        .replace(/\u0000/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug;
}
