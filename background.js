// Service Worker for Maps Mass Reviewer

let isProcessing = false;
let currentTabId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_BULK_REVIEW") {
        if (isProcessing) return;

        const payload = request.payload;
        console.log("[MassReviewer] Starting bulk review process:", payload);

        chrome.storage.local.set({
            isReviewing: true,
            reviewQueue: payload.queue,
            currentReviewPayload: payload,
            completedReviews: [],
            currentTargetUrl: null
        }, () => {
            isProcessing = true;
            processNextInQueue();
        });
    }

    else if (request.action === "STOP_BULK_REVIEW") {
        stopProcessing();
    }

    else if (request.action === "REVIEW_COMPLETED") {
        console.log("[MassReviewer] Received complete signal for:", request.url);

        // Ensure this isn't executed multiple times per review
        if (!isProcessing) return;

        // Close the tab we opened for this review
        if (currentTabId) {
            chrome.tabs.remove(currentTabId);
            currentTabId = null;
        }

        chrome.storage.local.get(['reviewQueue', 'completedReviews'], (res) => {
            const completed = res.completedReviews || [];
            completed.push(request.url);

            chrome.storage.local.set({ completedReviews: completed }, () => {
                // Throttle requests slightly and move to next
                setTimeout(processNextInQueue, 1500);
            });
        });
    }
});

function processNextInQueue() {
    chrome.storage.local.get(['reviewQueue', 'currentReviewPayload'], async (res) => {
        const queue = res.reviewQueue || [];

        if (queue.length === 0) {
            // Processing done
            console.log("[MassReviewer] Queue empty. Job finished.");
            stopProcessing();

            // Notify user
            chrome.notifications.create({
                type: "basic",
                iconUrl: chrome.runtime.getURL("icons/icon128.png"),
                title: "Maps Bulk Review Complete",
                message: "All selected locations have been processed."
            });
            return;
        }

        const nextTarget = queue.shift(); // Remove first item

        chrome.storage.local.set({
            reviewQueue: queue,
            currentTargetUrl: nextTarget.url
        }, () => {
            console.log("[MassReviewer] Processing next target:", nextTarget.name);

            // Create a new tab and start automation there
            chrome.tabs.create({ url: nextTarget.url, active: false }, (tab) => {
                currentTabId = tab.id;

                // Content script will automatically trigger due to the URL and state
                // However, set a timeout so it doesn't hang indefinitely 
                setupTimeout(tab.id, nextTarget.url);
            });
        });
    });
}

function setupTimeout(tabId, url) {
    // If review isn't done in 60 seconds, assume failure and skip to next
    setTimeout(() => {
        if (currentTabId === tabId) {
            console.warn("[MassReviewer] Timeout processing:", url);
            chrome.tabs.remove(tabId);
            currentTabId = null;

            chrome.storage.local.get(['completedReviews'], (res) => {
                const completed = res.completedReviews || [];
                completed.push({ url, status: "timeout" });
                chrome.storage.local.set({ completedReviews: completed }, () => {
                    processNextInQueue();
                });
            });
        }
    }, 60000); // 60s
}

function stopProcessing() {
    isProcessing = false;
    chrome.storage.local.set({
        isReviewing: false,
        reviewQueue: [],
        currentReviewPayload: null,
        currentTargetUrl: null
    });

    if (currentTabId) {
        chrome.tabs.remove(currentTabId);
        currentTabId = null;
    }
}
