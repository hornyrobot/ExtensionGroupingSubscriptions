console.log("🎬 YouTube Groups: content script запущен");

function getChannelInfo(): void {

    console.log("📍 Текущий URL:", window.location.href);

    const channelNameElement =
        document.querySelector("ytd-channel-name #text");

    if (!channelNameElement) {
        console.log("❌ Название канала пока не найдено");
        return;
    }

    const channelName = channelNameElement.textContent?.trim();

    console.log("📺 Канал:", channelName);
}

getChannelInfo();