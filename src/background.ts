chrome.action.onClicked.addListener((tab) => {
  // Открывает popup.html в новой вкладке
  chrome.tabs.create({
    url: chrome.runtime.getURL("popup.html")
  });
});