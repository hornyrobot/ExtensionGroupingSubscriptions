import type { Channel } from "../models/Channel";
import type { Group } from "../models/Group";

export interface StorageSnapshot {
    groups: Group[];
    channels: Channel[];
    collapsedGroupIds: number[];
    revision: number;
}

export class StorageService {
    private static readonly GROUPS_KEY = "groups";
    private static readonly CHANNELS_KEY = "channels";
    private static readonly COLLAPSED_KEY = "collapsedGroupIds";
    private static readonly REVISION_KEY = "revision";

    static async saveGroups(groups: Group[]): Promise<void> {
        const current = await this.loadAll();
        await this.saveAll({
            ...current,
            groups,
            revision: current.revision + 1,
        });
    }

    static async loadGroups(): Promise<Group[]> {
        const snapshot = await this.loadAll();
        return snapshot.groups;
    }

    static async saveChannels(channels: Channel[]): Promise<void> {
        const current = await this.loadAll();
        await this.saveAll({
            ...current,
            channels,
            revision: current.revision + 1,
        });
    }

    static async loadChannels(): Promise<Channel[]> {
        const snapshot = await this.loadAll();
        return snapshot.channels;
    }

    static async saveCollapsed(ids: number[]): Promise<void> {
        const current = await this.loadAll();
        await this.saveAll({
            ...current,
            collapsedGroupIds: ids,
            revision: current.revision + 1,
        });
    }

    static async loadCollapsed(): Promise<number[]> {
        const snapshot = await this.loadAll();
        return snapshot.collapsedGroupIds;
    }

    static async loadAll(): Promise<StorageSnapshot> {
        const local = await this.readArea(chrome.storage.local);
        const synced = await this.readArea(chrome.storage.sync).catch((error: unknown) => {
            console.error(error);
            return emptySnapshot();
        });

        if (synced.revision !== local.revision) {
            const winner = synced.revision > local.revision ? synced : local;
            const loser = winner === synced ? chrome.storage.local : chrome.storage.sync;
            await this.writeArea(loser, winner);
            return winner;
        }

        if (hasData(local) && !hasData(synced)) {
            await this.writeArea(chrome.storage.sync, local);
            return local;
        }

        if (hasData(synced) && !hasData(local)) {
            await this.writeArea(chrome.storage.local, synced);
            return synced;
        }

        return hasData(local) ? local : synced;
    }

    static async saveAll(snapshot: StorageSnapshot): Promise<void> {
        await this.writeArea(chrome.storage.local, snapshot);
        await this.writeArea(chrome.storage.sync, snapshot);
    }

    static async upsertChannel(channel: Channel): Promise<void> {
        const current = await this.loadAll();
        await this.saveAll({
            ...current,
            channels: upsert(current.channels, channel),
            revision: current.revision + 1,
        });
    }

    static async replaceChannel(previousId: string, channel: Channel): Promise<void> {
        const current = await this.loadAll();
        const withoutPrevious = current.channels.filter((item) => item.id !== previousId);
        await this.saveAll({
            ...current,
            channels: upsert(withoutPrevious, channel),
            revision: current.revision + 1,
        });
    }

    static async removeChannel(channelId: string): Promise<void> {
        const current = await this.loadAll();
        await this.saveAll({
            ...current,
            channels: current.channels.filter((channel) => channel.id !== channelId),
            revision: current.revision + 1,
        });
    }

    static reorder(groups: Group[], groupId: number, direction: -1 | 1): Group[] | null {
        const index = groups.findIndex((group) => group.id === groupId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= groups.length) return null;

        const next = groups.slice();
        const current = next[index];
        const other = next[target];
        if (!current || !other) return null;

        next[index] = other;
        next[target] = current;
        return next;
    }

    static toJSON(snapshot: StorageSnapshot): string {
        return JSON.stringify({
            version: 1,
            groups: snapshot.groups,
            channels: snapshot.channels,
            collapsedGroupIds: snapshot.collapsedGroupIds,
        }, null, 2);
    }

    static parseImport(text: string): StorageSnapshot | null {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            return null;
        }

        if (!isRecord(parsed)) return null;

        const groups = asGroups(parsed.groups);
        const groupIds = new Set(groups.map((group) => group.id));
        const channels = asChannels(parsed.channels).filter((channel) => groupIds.has(channel.groupId));
        if (groups.length === 0 && channels.length === 0) return null;

        return {
            groups,
            channels,
            collapsedGroupIds: asIds(parsed.collapsedGroupIds).filter((id) => groupIds.has(id)),
            revision: 0,
        };
    }

    static async clearGroups(): Promise<void> {
        const keys = [this.GROUPS_KEY, this.CHANNELS_KEY, this.COLLAPSED_KEY, this.REVISION_KEY];
        await chrome.storage.local.remove(keys);
        await chrome.storage.sync.remove(keys);
    }

    static onChanged(listener: (snapshot: StorageSnapshot) => void): () => void {
        const handler: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
            if (area !== "local" && area !== "sync") return;

            const relevant = [this.GROUPS_KEY, this.CHANNELS_KEY, this.COLLAPSED_KEY, this.REVISION_KEY]
                .some((key) => key in changes);

            if (!relevant) return;

            void this.loadAll().then(listener);
        };

        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
    }

    private static keys(): string[] {
        return [this.GROUPS_KEY, this.CHANNELS_KEY, this.COLLAPSED_KEY, this.REVISION_KEY];
    }

    private static async readArea(area: chrome.storage.StorageArea): Promise<StorageSnapshot> {
        const result = await area.get(this.keys());
        return {
            groups: asGroups(result[this.GROUPS_KEY]),
            channels: asChannels(result[this.CHANNELS_KEY]),
            collapsedGroupIds: asIds(result[this.COLLAPSED_KEY]),
            revision: asRevision(result[this.REVISION_KEY]),
        };
    }

    private static async writeArea(area: chrome.storage.StorageArea, snapshot: StorageSnapshot): Promise<void> {
        try {
            await area.set({
                [this.GROUPS_KEY]: snapshot.groups,
                [this.CHANNELS_KEY]: snapshot.channels,
                [this.COLLAPSED_KEY]: snapshot.collapsedGroupIds,
                [this.REVISION_KEY]: snapshot.revision,
            });
        } catch (error) {
            if (area === chrome.storage.local) throw error;
            console.error(error);
        }
    }
}

function upsert(channels: Channel[], channel: Channel): Channel[] {
    const next = channels.slice();
    const index = next.findIndex((item) => item.id === channel.id);
    if (index === -1) next.push(channel);
    else next[index] = channel;
    return next;
}

function emptySnapshot(): StorageSnapshot {
    return {
        groups: [],
        channels: [],
        collapsedGroupIds: [],
        revision: 0,
    };
}

function hasData(snapshot: StorageSnapshot): boolean {
    return snapshot.groups.length > 0 || snapshot.channels.length > 0;
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

function asRevision(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
