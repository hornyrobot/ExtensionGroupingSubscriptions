import type { StorageSnapshot } from "../storage/storage";

export interface GuideActions {
    onToggle(groupId: number): void;
    onMove(groupId: number, direction: -1 | 1): void;
}

export function renderGuide(
    host: HTMLElement,
    snapshot: StorageSnapshot,
    actions: GuideActions,
): void {
    host.className = "yt-groups-section";
    host.replaceChildren();

    const title = document.createElement("div");
    title.className = "yt-groups-title";
    title.textContent = "Группы";
    host.append(title);

    if (snapshot.groups.length === 0) {
        const empty = document.createElement("p");
        empty.className = "yt-groups-empty";
        empty.textContent = "Нет групп. Создайте их в окне расширения.";
        host.append(empty);
        return;
    }

    const collapsed = new Set(snapshot.collapsedGroupIds);

    snapshot.groups.forEach((group, index) => {
        const isCollapsed = collapsed.has(group.id);
        const row = document.createElement("div");
        row.className = "yt-group-row";

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "yt-group-toggle";
        toggle.dataset.groupId = String(group.id);
        toggle.textContent = `${isCollapsed ? "▶" : "▼"} ${group.name}`;
        toggle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            actions.onToggle(group.id);
        });

        row.append(
            toggle,
            moveButton("↑", "Выше", index === 0, () => actions.onMove(group.id, -1)),
            moveButton("↓", "Ниже", index === snapshot.groups.length - 1, () => actions.onMove(group.id, 1)),
        );
        host.append(row);

        if (isCollapsed) return;

        const groupChannels = snapshot.channels.filter((channel) => channel.groupId === group.id);
        const list = document.createElement("div");
        list.className = "yt-group-channels";

        if (groupChannels.length === 0) {
            const empty = document.createElement("p");
            empty.className = "yt-groups-empty";
            empty.textContent = "Нет каналов";
            list.append(empty);
        } else {
            for (const channel of groupChannels) {
                const link = document.createElement("a");
                link.className = "yt-channel-link";
                link.textContent = channel.name;
                link.href = safeChannelUrl(channel.url);
                list.append(link);
            }
        }

        host.append(list);
    });
}

function moveButton(label: string, hint: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "yt-group-move";
    button.textContent = label;
    button.title = hint;
    button.disabled = disabled;
    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });
    return button;
}

function safeChannelUrl(url: string): string {
    try {
        const parsed = new URL(url, "https://www.youtube.com");
        const allowedHost = parsed.hostname === "youtube.com"
            || parsed.hostname === "www.youtube.com"
            || parsed.hostname === "m.youtube.com";

        if ((parsed.protocol === "https:" || parsed.protocol === "http:") && allowedHost) {
            return parsed.href;
        }
    } catch {
        return "https://www.youtube.com";
    }

    return "https://www.youtube.com";
}
