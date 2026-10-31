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

export function readChannelInfo(allowHandleId = false): ChannelDraft | null {
    if (!isChannelPath(location.pathname)) return null;

    const fromData = readYtInitialData();
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    const rawUrl = fromData.url || canonical || location.href;
    const url = channelRootUrl(rawUrl);
    const name = fromData.name || readNameFromDom();
    const id = fromData.id || channelIdFromUrl(url) || (allowHandleId ? fallbackIdFromUrl(url) : undefined);

    if (!id || !name) return null;

    return { id, name, url };
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

function groupName(groups: Group[], groupId: number): string {
    return groups.find((group) => group.id === groupId)?.name ?? "группе";
}

interface YtChannelBits {
    id?: string;
    name?: string;
    url?: string;
}

function readYtInitialData(): YtChannelBits {
    const data = (window as Window & { ytInitialData?: unknown }).ytInitialData;
    if (!data || typeof data !== "object") return {};

    const record = data as Record<string, unknown>;
    const metadata = nested(record, ["metadata", "channelMetadataRenderer"]);
    const header = nested(record, ["header", "c4TabbedHeaderRenderer"]);

    const id = stringField(metadata, "externalId") ?? stringField(header, "channelId");
    const name = stringField(metadata, "title") ?? stringField(header, "title");
    const url = stringField(metadata, "vanityChannelUrl")
        ?? stringField(metadata, "channelUrl")
        ?? stringField(header, "navigationEndpoint");

    const bits: YtChannelBits = {};
    if (id) bits.id = id;
    if (name) bits.name = name;
    if (url && url.startsWith("http")) bits.url = url;
    return bits;
}

function nested(root: Record<string, unknown>, path: string[]): Record<string, unknown> | undefined {
    let current: unknown = root;
    for (const key of path) {
        if (!current || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    if (!current || typeof current !== "object") return undefined;
    return current as Record<string, unknown>;
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = record?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNameFromDom(): string | undefined {
    const selectors = [
        "ytd-channel-name #text",
        "#page-header h1",
        "yt-formatted-string.ytd-channel-name",
    ];

    for (const selector of selectors) {
        const text = document.querySelector(selector)?.textContent?.trim();
        if (text) return text;
    }

    const title = document.title.replace(/\s+-\s+YouTube$/, "").trim();
    return title || undefined;
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

function channelRootUrl(href: string): string {
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
