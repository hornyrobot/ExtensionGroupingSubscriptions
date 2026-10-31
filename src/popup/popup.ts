import "./popup.css";

import type { Channel } from "../models/Channel";
import type { Group } from "../models/Group";
import { StorageService, type StorageSnapshot } from "../storage/storage";

let nextGroupId = 0;
let groups: Group[] = [];
let channels: Channel[] = [];
let collapsedGroupIds: number[] = [];

const groupList = document.getElementById("groupList");
const createButton = document.getElementById("button");
const groupInput = document.getElementById("groupInput");
const status = document.getElementById("status");

function showStatus(message: string, isError = false): void {
    if (!(status instanceof HTMLElement)) return;

    status.textContent = message;
    status.classList.toggle("error", isError);
    status.classList.remove("hidden");
}

function hideStatus(): void {
    status?.classList.add("hidden");
}

function createGroup(name: string): Group {
    const group: Group = {
        id: nextGroupId,
        name,
        date: Date.now(),
    };
    nextGroupId += 1;
    return group;
}

function render(): void {
    if (!(groupList instanceof HTMLElement)) {
        console.error("element of group list is not found");
        return;
    }

    groupList.replaceChildren();

    if (groups.length === 0) {
        const message = document.createElement("div");
        message.className = "empty-message";
        message.textContent = "Нет созданных групп";
        groupList.append(message);
        return;
    }

    for (const group of groups) {
        groupList.append(renderGroupItem(group));
    }
}

function renderGroupItem(group: Group): HTMLLIElement {
    const item = document.createElement("li");

    const row = document.createElement("div");
    row.className = "group-row";

    const info = document.createElement("div");
    info.className = "group-info";

    const name = document.createElement("span");
    name.className = "group-name";
    name.textContent = group.name;

    const date = document.createElement("small");
    date.className = "group-date";
    date.textContent = new Date(group.date).toLocaleString("ru-RU");

    info.append(name, date);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Удалить";
    deleteButton.addEventListener("click", () => {
        void deleteGroup(group.id);
    });

    row.append(info, deleteButton);
    item.append(row);

    const groupChannels = channels.filter((channel) => channel.groupId === group.id);

    if (groupChannels.length === 0) {
        const empty = document.createElement("p");
        empty.className = "channel-empty";
        empty.textContent = "Нет каналов";
        item.append(empty);
        return item;
    }

    const list = document.createElement("ul");
    list.className = "channel-list";

    for (const channel of groupChannels) {
        const channelItem = document.createElement("li");
        channelItem.className = "channel-item";

        const channelName = document.createElement("span");
        channelName.className = "channel-name";
        channelName.textContent = channel.name;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-btn";
        removeButton.textContent = "Убрать";
        removeButton.addEventListener("click", () => {
            void removeChannel(channel.id);
        });

        channelItem.append(channelName, removeButton);
        list.append(channelItem);
    }

    item.append(list);
    return item;
}

async function persist(snapshot: StorageSnapshot): Promise<boolean> {
    try {
        await StorageService.saveAll(snapshot);
        return true;
    } catch (error) {
        console.error(error);
        showStatus("Не удалось сохранить", true);
        return false;
    }
}

async function deleteGroup(id: number): Promise<void> {
    const nextGroups = groups.filter((group) => group.id !== id);
    const nextChannels = channels.filter((channel) => channel.groupId !== id);
    const nextCollapsed = collapsedGroupIds.filter((groupId) => groupId !== id);

    const saved = await persist({
        groups: nextGroups,
        channels: nextChannels,
        collapsedGroupIds: nextCollapsed,
    });

    if (!saved) return;

    groups = nextGroups;
    channels = nextChannels;
    collapsedGroupIds = nextCollapsed;
    render();
}

async function removeChannel(channelId: string): Promise<void> {
    const nextChannels = channels.filter((channel) => channel.id !== channelId);
    const saved = await persist({
        groups,
        channels: nextChannels,
        collapsedGroupIds,
    });

    if (!saved) return;

    channels = nextChannels;
    hideStatus();
    render();
}

function applySnapshot(snapshot: StorageSnapshot): void {
    groups = snapshot.groups;
    channels = snapshot.channels;
    collapsedGroupIds = snapshot.collapsedGroupIds;

    nextGroupId = 0;
    for (const group of groups) {
        if (group.id >= nextGroupId) nextGroupId = group.id + 1;
    }

    render();
}

async function addGroup(): Promise<void> {
    if (!(groupInput instanceof HTMLInputElement)) return;

    const groupName = groupInput.value.trim();
    if (!groupName) {
        showStatus("Введите название группы", true);
        return;
    }

    const nextGroups = [...groups, createGroup(groupName)];
    const saved = await persist({
        groups: nextGroups,
        channels,
        collapsedGroupIds,
    });

    if (!saved) return;

    groups = nextGroups;
    groupInput.value = "";
    groupInput.classList.add("hidden");
    showStatus(`Группа «${groupName}» создана`);
    render();
}

createButton?.addEventListener("click", () => {
    if (!(groupInput instanceof HTMLInputElement)) return;

    groupInput.classList.toggle("hidden");
    if (!groupInput.classList.contains("hidden")) groupInput.focus();
});

groupInput?.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent) || event.key !== "Enter") return;
    void addGroup();
});

StorageService.onChanged(applySnapshot);

void StorageService.loadAll().then(applySnapshot).catch((error: unknown) => {
    console.error(error);
    showStatus("Не удалось загрузить группы", true);
});
