// Content Script for Maps Reviewer

// --- ACTION 1: EXTRACT MAPS LINKS ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_MAPS") {
        if (window !== window.top) {
            console.log("[MassReviewer] Ignoring EXTRACT_MAPS inside iframe.");
            return false;
        }
        console.log("[MassReviewer] Received EXTRACT_MAPS signal from popup.");
        try {
            // Find all anchor tags that link to a Maps Place
            const links = Array.from(document.querySelectorAll('a.hfpxzc, a[href*="/maps/place/"]'));
            console.log(`[MassReviewer] Found ${links.length} potential map links on the page.`);

            const results = [];
            const seenUrls = new Set();

            links.forEach(link => {
                const url = link.href.split('?')[0]; // Clean query parameters
                const name = link.getAttribute('aria-label') || link.innerText.trim();
                console.log(`[MassReviewer] Analyzing potential link - URL: ${url} | Name: ${name}`);

                if (url && url.length > 0 && name && !seenUrls.has(url)) {
                    console.log(`[MassReviewer] -> Valid Maps Link DETECTED: ${name}`);
                    seenUrls.add(url);
                    results.push({ name, url });
                }
            });

            console.log(`[MassReviewer] Extraction complete. Sending ${results.length} valid items back to popup.`);
            sendResponse({ success: true, data: results });
        } catch (error) {
            console.error(`[MassReviewer] Error during extraction: ${error.message}`, error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});

// --- ACTION 2: AUTOMATIC REVIEW ENGINE ---
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runReviewEngine(payload, targetUrl) {
    const isMainMapPage = location.href.includes('/maps/');
    const isReviewIframe = location.href.includes('/local/post/review') ||
        location.href.includes('contrib/rate') ||
        location.href.includes('ReviewsService.LoadWriteWidget');

    console.log(`[MassReviewer] runReviewEngine started. MainMap: ${isMainMapPage}, iframe: ${isReviewIframe}`);

    if (isMainMapPage && !isReviewIframe) {
        console.log("[MassReviewer] Main Map Page detected. Looking for 'Write a review' button...");

        let reviewBtn = null;
        let attempts = 0;

        while (!reviewBtn && attempts < 5) {
            await sleep(2000); // Check every 2 seconds
            attempts++;

            reviewBtn = document.querySelector('button[aria-label="Write a review"], button[data-value="Write a review"]');

            if (!reviewBtn) {
                // Check if there is a 'Reviews' tab we need to click first
                const reviewsTab = Array.from(document.querySelectorAll('button[role="tab"]')).find(el => el.innerText.includes('Reviews'));
                if (reviewsTab && attempts === 1) { // Only try clicking the tab once
                    console.log("[MassReviewer] Clicking 'Reviews' tab first...");
                    reviewsTab.click();
                    await sleep(2000);
                    reviewBtn = document.querySelector('button[aria-label="Write a review"], button[data-value="Write a review"]');
                }
            }

            // Fallback text search
            if (!reviewBtn) {
                const allBtns = document.querySelectorAll('button');
                for (let btn of allBtns) {
                    if (btn.innerText && btn.innerText.includes("Write a review")) {
                        reviewBtn = btn;
                        break;
                    }
                }
            }

            if (reviewBtn) break;
            console.log(`[MassReviewer] Review button not found yet. Attempt ${attempts}/5...`);
        }

        if (reviewBtn) {
            console.log("[MassReviewer] Clicking Review Button!");
            simulateGoogleClick(reviewBtn);
            await sleep(2000);

            // Check if it renders in the SAME document instead of an iframe
            await attemptReviewSubmit(payload, targetUrl);
        } else {
            console.warn(`[MassReviewer] Review button not found on map page after 10s. Frame: ${window.location.href}`);
            try { chrome.runtime.sendMessage({ action: "REVIEW_COMPLETED", success: false, url: targetUrl }); } catch (e) { }
        }
    }
    else if (isReviewIframe) {
        console.log("[MassReviewer] Review Iframe detected. Starting injection...");
        await attemptReviewSubmit(payload, targetUrl);
    }
}

function simulateGoogleClick(el) {
    try {
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        el.click();
    } catch (e) {
        el.click(); // Fallback
    }
}

async function attemptReviewSubmit(payload, targetUrl) {
    console.log("[MassReviewer] Attempting to submit review...");
    await sleep(2000); // wait for modal fully parsed

    try {
        // 1. Click Star Rating
        console.log(`[MassReviewer] Target Rating: ${payload.rating}`);
        let starClicked = false;
        let starAttempts = 0;

        while (!starClicked && starAttempts < 10) {
            await sleep(1000); // Poll every second for the modal to pop up
            starAttempts++;

            const targetStar = document.querySelector(`div[data-rating="${payload.rating}"]`);
            if (targetStar) {
                simulateGoogleClick(targetStar);
                starClicked = true;
                console.log(`[MassReviewer] Clicked star rating (data-rating logic): ${payload.rating}`);
            } else {
                // Fallback to role="radio" logic
                const allStarsDiv = Array.from(document.querySelectorAll('div[role="radio"]'));
                if (allStarsDiv.length >= 5) {
                    simulateGoogleClick(allStarsDiv[payload.rating - 1]);
                    starClicked = true;
                    console.log("[MassReviewer] Clicked star rating (radio logic).");
                } else {
                    // Fallback to aria-label
                    const starAria = `${payload.rating} star${payload.rating > 1 ? 's' : ''}`;
                    const starBtn = document.querySelector(`[aria-label="${starAria}"]`);
                    if (starBtn) {
                        simulateGoogleClick(starBtn);
                        starClicked = true;
                        console.log("[MassReviewer] Clicked star rating (aria logic).");
                    }
                }
            }

            if (!starClicked) {
                console.log(`[MassReviewer] Stars not found yet. Attempt ${starAttempts}/10...`);
            }
        }

        // If we didn't find stars after 10 seconds, we fail out
        if (!starClicked) {
            console.warn("[MassReviewer] Stars not found in this frame after 10 seconds. Exiting injection.");
            try { chrome.runtime.sendMessage({ action: "REVIEW_COMPLETED", success: false, url: targetUrl }); } catch (e) { }
            return;
        }

        await sleep(1000);

        // 2. Insert Review Text
        if (payload.text && payload.text.trim() !== "") {
            console.log("[MassReviewer] Injecting review text...");
            const textarea = document.querySelector('textarea');
            if (textarea) {
                textarea.focus();
                try {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                    nativeInputValueSetter.call(textarea, payload.text);
                } catch (e) {
                    textarea.value = payload.text;
                }
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                const textInput = document.querySelector('div[contenteditable="true"], [role="textbox"]');
                if (textInput) {
                    textInput.focus();
                    try {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, "innerText").set;
                        nativeInputValueSetter.call(textInput, payload.text);
                    } catch (e) {
                        textInput.innerText = payload.text;
                    }
                    textInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }

        await sleep(1000);

        // 3. Click Post Button
        console.log("[MassReviewer] Searching for Post/Publish button...");
        const postLabels = ["Post", "Publish", "Submit"];
        let postBtn = null;
        let postAttempts = 0;

        while (!postBtn && postAttempts < 5) {
            await sleep(1000);
            postAttempts++;

            const allButtons = document.querySelectorAll('button, div[role="button"]');
            for (let btn of allButtons) {
                if (btn.innerText && postLabels.some(l => btn.innerText.trim() === l)) {
                    // Check if it's disabled. Sometimes Google disables the button briefly
                    if (!btn.disabled && !btn.getAttribute('aria-disabled')) {
                        postBtn = btn;
                        break;
                    }
                }
            }

            if (!postBtn) console.log(`[MassReviewer] Post button not found or is disabled. Attempt ${postAttempts}/5`);
        }

        if (postBtn) {
            console.log("[MassReviewer] Post button found! Submitting...");
            simulateGoogleClick(postBtn);
            await sleep(3000);
            try { chrome.runtime.sendMessage({ action: "REVIEW_COMPLETED", success: true, url: targetUrl }); } catch (e) { }
        } else {
            console.warn("[MassReviewer] Post button not found after retries. Marking as failed.");
            try { chrome.runtime.sendMessage({ action: "REVIEW_COMPLETED", success: false, url: targetUrl }); } catch (e) { }
        }

    } catch (error) {
        console.error("[MassReviewer] Automation error: ", error);
        try { chrome.runtime.sendMessage({ action: "REVIEW_COMPLETED", success: false, url: targetUrl }); } catch (e) { }
    }
}

// Check if we need to run autobot
chrome.storage.local.get(['isReviewing', 'currentReviewPayload', 'currentTargetUrl'], (res) => {
    if (res.isReviewing && res.currentReviewPayload && res.currentTargetUrl) {
        const isReviewIframe = location.href.includes('/local/post/review') ||
            location.href.includes('contrib/rate') ||
            location.href.includes('ReviewsService.LoadWriteWidget');

        // 1. If we are in the Review Iframe, run the engine
        if (isReviewIframe) {
            runReviewEngine(res.currentReviewPayload, res.currentTargetUrl);
        }
        // 2. If we are on the Main Map, only run if it's the top window 
        // (This prevents hidden helper iframes from failing and ending the job prematurely)
        else if (window === window.top && location.href.includes('/maps/')) {
            runReviewEngine(res.currentReviewPayload, res.currentTargetUrl);
        } else {
            if (window !== window.top) {
                console.log("[MassReviewer] Skipping automation execution inside non-review iframe:", location.href);
            }
        }
    }
});
