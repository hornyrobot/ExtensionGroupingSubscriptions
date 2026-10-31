import "./content.css";

import type { ChannelDraft } from "./channelPage";
import { findChannelHeaderAnchor, isChannelPath, readChannelInfo, renderAddButton } from "./channelPage";
import { renderGuide } from "./guide";
import type { Channel } from "../models/Channel";
import { StorageService, type StorageSnapshot } from "../storage/storage";

const GUIDE_ID = "yt-groups-section";
const ADD_ID = "yt-groups-add";

let snapshot: StorageSnapshot = {
    groups: [],
    channels: [],
    collapsedGroupIds: [],
};
let channelDraft: ChannelDraft | null = null;
let refreshToken = 0;

function guideHost(): HTMLElement | null {
    const sections = document.querySelector("#guide #sections");
    if (!sections) return null;

    let host = document.getElementById(GUIDE_ID);
    if (!(host instanceof HTMLElement) || host.parentElement !== sections) {
        host?.remove();
        host = document.createElement("div");
        host.id = GUIDE_ID;
        sections.prepend(host);
    }

    return host;
}

function paintGuide(): void {
    const host = guideHost();
    if (!host) return;

    renderGuide(host, snapshot, {
        onToggle(groupId) {
            const collapsed = new Set(snapshot.collapsedGroupIds);
            if (collapsed.has(groupId)) collapsed.delete(groupId);
            else collapsed.add(groupId);

            void StorageService.saveCollapsed([...collapsed]).catch((error: unknown) => {
                console.error(error);
            });
        },
    });
}

function paintAddButton(): void {
    if (!isChannelPath(location.pathname)) {
        document.getElementById(ADD_ID)?.remove();
        return;
    }

    const anchor = findChannelHeaderAnchor();
    if (!anchor?.parentElement) {
        document.getElementById(ADD_ID)?.remove();
        return;
    }

    let host = document.getElementById(ADD_ID);
    if (!(host instanceof HTMLElement)) {
        host = document.createElement("div");
        host.id = ADD_ID;
    }

    host.classList.add("yt-groups-add");
    if (host.previousElementSibling !== anchor) {
        anchor.insertAdjacentElement("afterend", host);
    }

    const current = channelDraft
        ? snapshot.channels.find((channel) => channel.id === channelDraft?.id)
        : undefined;

    renderAddButton(host, snapshot.groups, current, (group) => {
        if (!channelDraft) return;

        const channel: Channel = {
            id: channelDraft.id,
            name: channelDraft.name,
            url: channelDraft.url,
            groupId: group.id,
        };

        void StorageService.upsertChannel(channel).catch((error: unknown) => {
            console.error(error);
        });
    });
}

function paint(): void {
    paintGuide();
    paintAddButton();
}

async function refreshChannel(): Promise<void> {
    const token = ++refreshToken;
    channelDraft = null;
    paintAddButton();

    if (!isChannelPath(location.pathname)) return;

    const started = Date.now();
    while (Date.now() - started < 4000) {
        if (token !== refreshToken) return;

        const info = readChannelInfo(Date.now() - started > 2500);
        if (info) channelDraft = info;
        paintAddButton();

        const host = document.getElementById(ADD_ID);
        const anchor = findChannelHeaderAnchor();
        const anchored = anchor !== null && host?.previousElementSibling === anchor;
        if (channelDraft && anchored) return;

        await delay(200);
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function onNavigate(): void {
    paintGuide();
    void refreshChannel();
}

let guideCheckQueued = false;

const observer = new MutationObserver(() => {
    if (guideCheckQueued) return;
    guideCheckQueued = true;

    requestAnimationFrame(() => {
        guideCheckQueued = false;
        const sections = document.querySelector("#guide #sections");
        if (!sections) return;

        const host = document.getElementById(GUIDE_ID);
        if (host?.parentElement === sections) return;

        paintGuide();
    });
});

observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("yt-navigate-finish", onNavigate);
document.addEventListener("click", (event) => {
    const host = document.getElementById(ADD_ID);
    if (!(host instanceof HTMLElement)) return;
    if (event.target instanceof Node && host.contains(event.target)) return;
    host.querySelector(".yt-groups-menu")?.classList.add("hidden");
});

StorageService.onChanged((next) => {
    snapshot = next;
    paint();
});

void StorageService.loadAll().then((next) => {
    snapshot = next;
    onNavigate();
}).catch((error: unknown) => {
    console.error(error);
});
