document.addEventListener('DOMContentLoaded', () => {
    const btnExtract = document.getElementById('btn-extract');
    const extractStatus = document.getElementById('extract-status');

    // UI Elements
    const stepExtract = document.getElementById('step-extract');
    const stepList = document.getElementById('step-list');
    const stepReview = document.getElementById('step-review');
    const stepActions = document.getElementById('step-actions');
    const targetList = document.getElementById('target-list');
    const targetCount = document.getElementById('target-count');
    const btnSelectAll = document.getElementById('btn-select-all');
    const btnDeselectAll = document.getElementById('btn-deselect-all');

    const stars = document.querySelectorAll('.stars span');
    let selectedRating = 0;

    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    let extractedTargets = [];

    // Check initial state
    chrome.storage.local.get(['isReviewing', 'reviewQueue', 'completedReviews'], (res) => {
        if (res.isReviewing) {
            showReviewProgress(res.reviewQueue, res.completedReviews);
        }
    });

    // 1. Extract Maps Links
    btnExtract.addEventListener('click', async () => {
        extractStatus.textContent = '';
        btnExtract.textContent = 'Extracting...';
        btnExtract.disabled = true;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('google.com/maps')) {
                throw new Error("Please open Google Maps search results.");
            }

            // Send message to content script in the main frame only
            chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_MAPS" }, { frameId: 0 }, (response) => {
                btnExtract.textContent = 'Extract Open Maps Tab';
                btnExtract.disabled = false;

                if (chrome.runtime.lastError) {
                    console.error("[MassReviewer Popup] Runtime error:", chrome.runtime.lastError);
                    extractStatus.textContent = "Error: Please refresh the Maps page and try again.";
                    return;
                }

                console.log("[MassReviewer Popup] Received response:", response);

                if (response && response.success && response.data.length > 0) {
                    extractedTargets = response.data;
                    renderTargetList();

                    // Reveal next steps
                    stepList.classList.remove('hidden-step');
                    stepReview.classList.remove('hidden-step');
                    stepActions.classList.remove('hidden-step');
                } else {
                    console.warn("[MassReviewer Popup] Validation failed. Response data:", response);
                    extractStatus.textContent = "No locations found. Make sure search results are visible.";
                }
            });

        } catch (error) {
            extractStatus.textContent = error.message;
            btnExtract.textContent = 'Extract Open Maps Tab';
            btnExtract.disabled = false;
        }
    });

    // 2. Select/Deselect
    function renderTargetList() {
        targetList.innerHTML = '';
        extractedTargets.forEach((target, index) => {
            const item = document.createElement('div');
            item.className = 'list-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `target-${index}`;
            checkbox.checked = true;
            checkbox.dataset.url = target.url;
            checkbox.dataset.name = target.name;

            const label = document.createElement('label');
            label.htmlFor = `target-${index}`;
            label.textContent = target.name;
            label.title = target.name;

            item.appendChild(checkbox);
            item.appendChild(label);
            targetList.appendChild(item);
        });
        updateCount();
    }

    function updateCount() {
        const checked = targetList.querySelectorAll('input:checked').length;
        targetCount.textContent = `${checked}/${extractedTargets.length}`;
    }

    targetList.addEventListener('change', updateCount);

    btnSelectAll.addEventListener('click', () => {
        targetList.querySelectorAll('input').forEach(cb => cb.checked = true);
        updateCount();
    });

    btnDeselectAll.addEventListener('click', () => {
        targetList.querySelectorAll('input').forEach(cb => cb.checked = false);
        updateCount();
    });

    // 3. Configure Review
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.value);
            stars.forEach(s => {
                if (parseInt(s.dataset.value) <= selectedRating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    });

    // 4. Start Bulk Process
    btnStart.addEventListener('click', () => {
        if (selectedRating === 0) {
            alert('Please select a star rating first.');
            return;
        }

        const reviewText = document.getElementById('review-text').value;
        const selectedElements = targetList.querySelectorAll('input:checked');

        if (selectedElements.length === 0) {
            alert('Please select at least one location.');
            return;
        }

        const reviewQueue = Array.from(selectedElements).map(el => ({
            name: el.dataset.name,
            url: el.dataset.url
        }));

        const payload = {
            rating: selectedRating,
            text: reviewText,
            queue: reviewQueue,
            totalCount: reviewQueue.length
        };

        // Start Process
        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');

        chrome.runtime.sendMessage({ action: "START_BULK_REVIEW", payload });

        showReviewProgress(reviewQueue, []);
    });

    btnStop.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "STOP_BULK_REVIEW" });
        window.close();
    });

    function showReviewProgress(queue, completed) {
        stepExtract.classList.add('hidden-step');
        stepList.classList.add('hidden-step');
        stepReview.classList.add('hidden-step');
        stepActions.classList.remove('hidden-step');

        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');

        const total = (queue ? queue.length : 0) + (completed ? completed.length : 0);
        const done = completed ? completed.length : 0;

        if (total > 0) {
            const percent = (done / total) * 100;
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `${done} / ${total} Locations Processed`;

            if (done === total) {
                progressText.textContent = "Bulk Review Complete!";
                btnStop.textContent = "Close";
            }
        }
    }

    // Listen for progress updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            chrome.storage.local.get(['isReviewing', 'reviewQueue', 'completedReviews'], (res) => {
                if (res.isReviewing) {
                    showReviewProgress(res.reviewQueue, res.completedReviews);
                }
            });
        }
    });
});
