import "./popup.css";

import type { Channel } from "../models/Channel";
import type { Group } from "../models/Group";
import { StorageService, type StorageSnapshot } from "../storage/storage";

let nextGroupId = 0;
let revision = 0;
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

    groups.forEach((group, index) => {
        groupList.append(renderGroupItem(group, index));
    });
}

function renderGroupItem(group: Group, index: number): HTMLLIElement {
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

    const actions = document.createElement("div");
    actions.className = "group-actions";
    actions.append(
        moveButton("↑", "Выше", index === 0, () => {
            void moveGroup(group.id, -1);
        }),
        moveButton("↓", "Ниже", index === groups.length - 1, () => {
            void moveGroup(group.id, 1);
        }),
    );

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Удалить";
    deleteButton.addEventListener("click", () => {
        void deleteGroup(group.id);
    });
    actions.append(deleteButton);

    row.append(info, actions);
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

function moveButton(label: string, hint: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "move-btn";
    button.textContent = label;
    button.title = hint;
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
}

async function persist(snapshot: StorageSnapshot): Promise<boolean> {
    try {
        await StorageService.saveAll(snapshot);
        revision = snapshot.revision;
        return true;
    } catch (error) {
        console.error(error);
        showStatus("Не удалось сохранить", true);
        return false;
    }
}

function nextSnapshot(patch: Omit<StorageSnapshot, "revision">): StorageSnapshot {
    return {
        ...patch,
        revision: revision + 1,
    };
}

async function deleteGroup(id: number): Promise<void> {
    const nextGroups = groups.filter((group) => group.id !== id);
    const nextChannels = channels.filter((channel) => channel.groupId !== id);
    const nextCollapsed = collapsedGroupIds.filter((groupId) => groupId !== id);

    const saved = await persist(nextSnapshot({
        groups: nextGroups,
        channels: nextChannels,
        collapsedGroupIds: nextCollapsed,
    }));

    if (!saved) return;

    groups = nextGroups;
    channels = nextChannels;
    collapsedGroupIds = nextCollapsed;
    render();
}

async function removeChannel(channelId: string): Promise<void> {
    const nextChannels = channels.filter((channel) => channel.id !== channelId);
    const saved = await persist(nextSnapshot({
        groups,
        channels: nextChannels,
        collapsedGroupIds,
    }));

    if (!saved) return;

    channels = nextChannels;
    hideStatus();
    render();
}

async function moveGroup(groupId: number, direction: -1 | 1): Promise<void> {
    const nextGroups = StorageService.reorder(groups, groupId, direction);
    if (!nextGroups) return;

    const saved = await persist(nextSnapshot({
        groups: nextGroups,
        channels,
        collapsedGroupIds,
    }));
    if (!saved) return;

    groups = nextGroups;
    hideStatus();
    render();
}

function applySnapshot(snapshot: StorageSnapshot): void {
    groups = snapshot.groups;
    channels = snapshot.channels;
    collapsedGroupIds = snapshot.collapsedGroupIds;
    revision = snapshot.revision;

    rememberGroupIds(groups);
    render();
}

function rememberGroupIds(list: Group[]): void {
    nextGroupId = 0;
    for (const group of list) {
        if (group.id >= nextGroupId) nextGroupId = group.id + 1;
    }
}

async function addGroup(): Promise<void> {
    if (!(groupInput instanceof HTMLInputElement)) return;

    const groupName = groupInput.value.trim();
    if (!groupName) {
        showStatus("Введите название группы", true);
        return;
    }

    const nextGroups = [...groups, createGroup(groupName)];
    const saved = await persist(nextSnapshot({
        groups: nextGroups,
        channels,
        collapsedGroupIds,
    }));

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

const exportButton = document.getElementById("exportButton");
const importButton = document.getElementById("importButton");
const importFile = document.getElementById("importFile");

exportButton?.addEventListener("click", () => {
    const file = new Blob([StorageService.toJSON({
        groups,
        channels,
        collapsedGroupIds,
        revision,
    })], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "youtube-groups.json";
    link.click();
    URL.revokeObjectURL(url);
});

importButton?.addEventListener("click", () => {
    if (importFile instanceof HTMLInputElement) importFile.click();
});

importFile?.addEventListener("change", () => {
    if (!(importFile instanceof HTMLInputElement)) return;
    const file = importFile.files?.[0];
    importFile.value = "";
    if (!file) return;

    void file.text().then(async (text) => {
        const parsed = StorageService.parseImport(text);
        if (!parsed) {
            showStatus("Файл не похож на список групп", true);
            return;
        }

        const saved = await persist(nextSnapshot({
            groups: parsed.groups,
            channels: parsed.channels,
            collapsedGroupIds: parsed.collapsedGroupIds,
        }));
        if (!saved) return;

        groups = parsed.groups;
        channels = parsed.channels;
        collapsedGroupIds = parsed.collapsedGroupIds;
        rememberGroupIds(groups);
        showStatus("Группы загружены из файла");
        render();
    }).catch((error: unknown) => {
        console.error(error);
        showStatus("Не удалось прочитать файл", true);
    });
});

StorageService.onChanged(applySnapshot);

void StorageService.loadAll().then(applySnapshot).catch((error: unknown) => {
    console.error(error);
    showStatus("Не удалось загрузить группы", true);
});
