(function () {
    var attribute = "data-yt-groups-channel";

    function text(value) {
        if (typeof value === "string") return value;
        if (value && typeof value.simpleText === "string") return value.simpleText;
        if (!value || !Array.isArray(value.runs)) return "";
        return value.runs.map(function (run) {
            return run && typeof run.text === "string" ? run.text : "";
        }).join("");
    }

    function publish() {
        var data = window.ytInitialData;
        var meta = data && data.metadata && data.metadata.channelMetadataRenderer;
        if (!meta) return;

        var payload = JSON.stringify({
            id: typeof meta.externalId === "string" ? meta.externalId : "",
            name: text(meta.title),
            url: typeof meta.vanityChannelUrl === "string"
                ? meta.vanityChannelUrl
                : (typeof meta.channelUrl === "string" ? meta.channelUrl : ""),
        });

        if (document.documentElement.getAttribute(attribute) !== payload) {
            document.documentElement.setAttribute(attribute, payload);
        }
    }

    var tries = 0;
    function tick() {
        publish();
        tries += 1;
        if (tries < 24) window.setTimeout(tick, 250);
    }

    document.addEventListener("yt-navigate-finish", function () {
        tries = 0;
        tick();
    });
    tick();
})();
