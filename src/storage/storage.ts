

import type { Group } from "../models/Group";

export class StorageService {

    private static readonly GROUPS_KEY = "groups"

    static async saveGroups(groups: Group[]): Promise<void> {

        await chrome.storage.local.set({
            [this.GROUPS_KEY]: groups
        });


    }

    static async loadGroups(): Promise<Group[]> {

        const result = await chrome.storage.local.get(this.GROUPS_KEY);

        // return [];
        return (result[this.GROUPS_KEY] as Group[]) ?? [];
    }

    static async clearGroups(): Promise<void> { }

}

//на будущее для полиорфизма и сохранения всего одним файлом
// export class StorageService {

//     static async save<T>(key: string, data: T): Promise<void>;
//     {}

//     static async load<T>(key: string): Promise<T | null>;
//     {}
//     static async remove(key: string): Promise<void>;
//     {}
// }