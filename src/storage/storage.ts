import type { Channel } from "../models/Channel";
import type { Group } from "../models/Group";

export interface StorageSnapshot {
    groups: Group[];
    channels: Channel[];
    collapsedGroupIds: number[];
}

export class StorageService {
    private static readonly GROUPS_KEY = "groups";
    private static readonly CHANNELS_KEY = "channels";
    private static readonly COLLAPSED_KEY = "collapsedGroupIds";

    static async saveGroups(groups: Group[]): Promise<void> {
        await chrome.storage.local.set({
            [this.GROUPS_KEY]: groups,
        });
    }

    static async loadGroups(): Promise<Group[]> {
        const snapshot = await this.loadAll();
        return snapshot.groups;
    }

    static async saveChannels(channels: Channel[]): Promise<void> {
        await chrome.storage.local.set({
            [this.CHANNELS_KEY]: channels,
        });
    }

    static async loadChannels(): Promise<Channel[]> {
        const snapshot = await this.loadAll();
        return snapshot.channels;
    }

    static async saveCollapsed(ids: number[]): Promise<void> {
        await chrome.storage.local.set({
            [this.COLLAPSED_KEY]: ids,
        });
    }

    static async loadCollapsed(): Promise<number[]> {
        const snapshot = await this.loadAll();
        return snapshot.collapsedGroupIds;
    }

    static async loadAll(): Promise<StorageSnapshot> {
        const result = await chrome.storage.local.get([
            this.GROUPS_KEY,
            this.CHANNELS_KEY,
            this.COLLAPSED_KEY,
        ]);

        return {
            groups: asGroups(result[this.GROUPS_KEY]),
            channels: asChannels(result[this.CHANNELS_KEY]),
            collapsedGroupIds: asIds(result[this.COLLAPSED_KEY]),
        };
    }

    static async saveAll(snapshot: StorageSnapshot): Promise<void> {
        await chrome.storage.local.set({
            [this.GROUPS_KEY]: snapshot.groups,
            [this.CHANNELS_KEY]: snapshot.channels,
            [this.COLLAPSED_KEY]: snapshot.collapsedGroupIds,
        });
    }

    static async upsertChannel(channel: Channel): Promise<void> {
        const channels = await this.loadChannels();
        const index = channels.findIndex((item) => item.id === channel.id);

        if (index === -1) {
            channels.push(channel);
        } else {
            channels[index] = channel;
        }

        await this.saveChannels(channels);
    }

    static async removeChannel(channelId: string): Promise<void> {
        const channels = await this.loadChannels();
        await this.saveChannels(channels.filter((channel) => channel.id !== channelId));
    }

    static async clearGroups(): Promise<void> {
        await chrome.storage.local.remove([
            this.GROUPS_KEY,
            this.CHANNELS_KEY,
            this.COLLAPSED_KEY,
        ]);
    }

    static onChanged(listener: (snapshot: StorageSnapshot) => void): () => void {
        const handler: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
            if (area !== "local") return;

            const relevant = [this.GROUPS_KEY, this.CHANNELS_KEY, this.COLLAPSED_KEY]
                .some((key) => key in changes);

            if (!relevant) return;

            void this.loadAll().then(listener);
        };

        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function asGroups(value: unknown): Group[] {
    if (!Array.isArray(value)) return [];

    return value.filter((item): item is Group => {
        if (!isRecord(item)) return false;
        return typeof item.id === "number"
            && typeof item.name === "string"
            && typeof item.date === "number";
    });
}

function asChannels(value: unknown): Channel[] {
    if (!Array.isArray(value)) return [];

    return value.filter((item): item is Channel => {
        if (!isRecord(item)) return false;
        return typeof item.id === "string"
            && typeof item.name === "string"
            && typeof item.url === "string"
            && typeof item.groupId === "number";
    });
}

function asIds(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is number => typeof item === "number");
}
