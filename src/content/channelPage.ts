import type { Channel } from "../models/Channel";
import type { Group } from "../models/Group";

export interface ChannelDraft {
    id: string;
    name: string;
    url: string;
}

export function isChannelPath(pathname: string): boolean {
    const parts = pathname.split("/").filter(Boolean);
    const head = parts[0];
    if (!head) return false;
    if (head.startsWith("@")) return true;
    return (head === "channel" || head === "c" || head === "user") && parts.length >= 2;
}

export function readChannelInfo(allowFallback = false): ChannelDraft | null {
    if (!isChannelPath(location.pathname)) return null;

    const fromPage = readPublishedChannel();
    const embedded = readEmbeddedChannel();
    const fromData = fromPage.name || fromPage.id ? fromPage : embedded;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    const rawUrl = fromData.url || canonical || location.href;
    const url = channelRootUrl(rawUrl);
    const name = cleanChannelName(fromData.name) ?? (allowFallback ? readNameFromDom() : undefined);
    const id = fromData.id
        || channelIdFromUrl(canonical || url)
        || (allowFallback ? fallbackIdFromUrl(url) : undefined);

    if (!id || !name) return null;

    return { id, name, url };
}

export function channelMatches(stored: { id: string; url: string }, draft: ChannelDraft): boolean {
    if (stored.id === draft.id) return true;
    if (channelRootUrl(stored.url) === channelRootUrl(draft.url)) return true;

    const storedHandle = handleOf(stored.url) ?? handleOf(stored.id);
    const pageHandle = handleOf(location.href) ?? handleOf(draft.url);
    if (storedHandle && pageHandle && storedHandle.toLowerCase() === pageHandle.toLowerCase()) return true;

    if (draft.id.startsWith("UC") && stored.url.includes(draft.id)) return true;
    if (stored.id.startsWith("UC") && (draft.url.includes(stored.id) || location.href.includes(stored.id))) return true;

    return false;
}

export function findChannelHeaderAnchor(): Element | null {
    const selectors = [
        "#channel-header-container",
        "#page-header",
        "yt-page-header-renderer",
        "#channel-header",
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }

    return null;
}

export function renderAddButton(
    host: HTMLElement,
    groups: Group[],
    current: Channel | undefined,
    onPick: (group: Group) => void,
): void {
    host.replaceChildren();

    const button = document.createElement("button");
    button.type = "button";
    button.className = "yt-groups-add-button";
    button.textContent = current
        ? `В группе «${groupName(groups, current.groupId)}»`
        : "Добавить в группу";

    const menu = document.createElement("div");
    menu.className = "yt-groups-menu hidden";

    if (groups.length === 0) {
        const empty = document.createElement("p");
        empty.className = "yt-groups-menu-empty";
        empty.textContent = "Сначала создайте группу в окне расширения.";
        menu.append(empty);
    } else {
        for (const group of groups) {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "yt-groups-menu-item";
            item.textContent = current?.groupId === group.id ? `${group.name} ✓` : group.name;
            item.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                menu.classList.add("hidden");
                onPick(group);
            });
            menu.append(item);
        }
    }

    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        menu.classList.toggle("hidden");
    });

    host.append(button, menu);
}

const MAX_CHANNEL_NAME = 80;

export function cleanChannelName(value: string | undefined): string | undefined {
    if (!value) return undefined;

    const name = value.replace(/\s+/g, " ").trim();
    if (!name || name.length > MAX_CHANNEL_NAME || /^youtube$/i.test(name)) return undefined;

    return name;
}

function groupName(groups: Group[], groupId: number): string {
    return groups.find((group) => group.id === groupId)?.name ?? "группе";
}

interface YtChannelBits {
    id?: string;
    name?: string;
    url?: string;
}

const CHANNEL_ATTR = "data-yt-groups-channel";
const EMBEDDED_MARKER = "\"channelMetadataRenderer\":{";

function readPublishedChannel(): YtChannelBits {
    const raw = document.documentElement.getAttribute(CHANNEL_ATTR);
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) return {};
        return bitsFrom(parsed.id, parsed.name, parsed.url);
    } catch {
        return {};
    }
}

let embeddedCache: { href: string; bits: YtChannelBits } | null = null;

function readEmbeddedChannel(): YtChannelBits {
    if (embeddedCache?.href === location.href) {
        return embeddedMatchesPage(embeddedCache.bits) ? embeddedCache.bits : {};
    }

    const bits = scanEmbeddedChannel();
    if (bits.id || bits.name) embeddedCache = { href: location.href, bits };
    return embeddedMatchesPage(bits) ? bits : {};
}

function scanEmbeddedChannel(): YtChannelBits {
    for (const script of document.scripts) {
        const text = script.textContent ?? "";
        const at = text.indexOf(EMBEDDED_MARKER);
        if (at < 0) continue;

        const slice = text.slice(at, at + 50000);
        return bitsFrom(
            jsonString(slice, "externalId"),
            jsonString(slice, "title"),
            jsonString(slice, "vanityChannelUrl") ?? jsonString(slice, "channelUrl"),
        );
    }

    return {};
}

function bitsFrom(id: unknown, name: unknown, url: unknown): YtChannelBits {
    const bits: YtChannelBits = {};
    if (typeof id === "string" && id.startsWith("UC")) bits.id = id;
    if (typeof name === "string" && name.trim()) bits.name = name.trim();
    if (typeof url === "string" && url.startsWith("http")) bits.url = url;
    return bits;
}

function embeddedMatchesPage(bits: YtChannelBits): boolean {
    if (!bits.id && !bits.name) return false;
    if (bits.id && (location.href.includes(bits.id) || document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href.includes(bits.id))) {
        return true;
    }

    const pageHandle = handleOf(location.href);
    const dataHandle = bits.url ? handleOf(bits.url) : undefined;
    return Boolean(pageHandle && dataHandle && pageHandle.toLowerCase() === dataHandle.toLowerCase());
}

function jsonString(slice: string, key: string): string | undefined {
    const token = `"${key}":"`;
    const start = slice.indexOf(token);
    if (start < 0) return undefined;

    let raw = "";
    let i = start + token.length;
    while (i < slice.length) {
        const ch = slice[i] ?? "";
        if (ch === "\\") {
            raw += ch + (slice[i + 1] ?? "");
            i += 2;
            continue;
        }
        if (ch === "\"") break;
        raw += ch;
        i += 1;
    }

    try {
        const parsed = JSON.parse(`"${raw}"`) as unknown;
        return typeof parsed === "string" ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function handleOf(value: string): string | undefined {
    const match = /@[^\s/?#]+/u.exec(value);
    return match?.[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readNameFromDom(): string | undefined {
    const selectors = [
        "h1.dynamicTextViewModelH1",
        "#page-header yt-dynamic-text-view-model h1",
        "ytd-channel-name #text",
    ];

    for (const selector of selectors) {
        const name = cleanChannelName(document.querySelector(selector)?.textContent ?? undefined);
        if (name) return name;
    }

    return cleanChannelName(document.title.replace(/\s*[-–—]\s*YouTube\s*$/i, ""));
}

function channelIdFromUrl(url: string): string | undefined {
    try {
        const parts = new URL(url).pathname.split("/").filter(Boolean);
        if (parts[0] === "channel" && parts[1]) return parts[1];
    } catch {
        return undefined;
    }

    return undefined;
}

function fallbackIdFromUrl(url: string): string | undefined {
    try {
        const parts = new URL(url).pathname.split("/").filter(Boolean);
        const head = parts[0];
        if (!head) return undefined;
        if (head.startsWith("@")) return head;
        if ((head === "c" || head === "user") && parts[1]) return `${head}/${parts[1]}`;
    } catch {
        return undefined;
    }

    return undefined;
}

export function channelRootUrl(href: string): string {
    try {
        const parsed = new URL(href, "https://www.youtube.com");
        const parts = parsed.pathname.split("/").filter(Boolean);
        const head = parts[0];
        if (!head) return "https://www.youtube.com";
        if (head.startsWith("@")) return `https://www.youtube.com/${head}`;
        if ((head === "channel" || head === "c" || head === "user") && parts[1]) {
            return `https://www.youtube.com/${head}/${parts[1]}`;
        }
        return `https://www.youtube.com${parsed.pathname}`;
    } catch {
        return "https://www.youtube.com";
    }
}
