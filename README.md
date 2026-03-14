# Maps Mass Reviewer

A powerful Chrome Extension to automate the process of extracting Google Maps locations and posting bulk reviews. This tool is designed to save you hours of manual clicking and waiting by managing tabs, simulating human interaction, and processing a queue of locations in the background.

![Maps Mass Reviewer Thumbnail](<youtube-thumbnail-link>) <!-- Replace with your actual thumbnail or image link -->

## 🚀 Features

*   **Smart Link Extraction:** Quickly pull all valid Google Maps place links directly from a search page.
*   **Automated Queueing:** Add extracted places to a review queue and start processing with a single click.
*   **Foreground Processing:** Ensures tabs open actively so Google Maps loads and renders its React SPA DOM properly.
*   **Human-Like Simulation:** Simulates actual clicks and input events to reliably interact with the "Write a Review" interface and star ratings.
*   **Timeout Handling:** Intelligently skips locations that take too long (e.g., >60s) to prevent the extension from hanging.

## 📺 How to Use It (Video Tutorial)

Watch the full tutorial to see the extension in action and learn the best practices for setting up your first bulk run:

👉 **[Watch the Video Tutorial on YouTube](https://www.youtube.com/watch?v=BZxwxoNfcCc)**

### Quick Start Guide

1.  **Install the Extension:**
    *   Download or clone this repository.
    *   Open Google Chrome and go to `chrome://extensions/`.
    *   Enable **Developer mode** in the top right corner.
    *   Click **Load unpacked** and select the folder encompassing this extension.
2.  **Extract Locations:**
    *   Navigate to a Google Maps search page (the URL must look like `https://www.google.com/maps/search/...` e.g., `https://www.google.com/maps/search/dominos`).
    *   Open the extension popup and click the "Extract" button to grab the locations on the current page.
    *   *Note: This extension is designed specifically for the search results screen, as shown in the screenshot below. It will not work properly on other Maps pages.*
3.  **Start Automating:**
    *   Set your desired **Star Rating** and write your **Review Text** in the popup.
    *   Click **Start Bulk Review**.
    *   The extension will automatically open the first location in a new active tab, simulate the rating and text input, click post, and move on to the next one!


## ⚠️ Disclaimer

This extension was created for **educational purposes, legitimate bulk management workflows, and testing**. Please ensure that your use of automated reviews fully complies with:
*   [Google Maps User Contributed Content Policy](https://support.google.com/contributionpolicy/answer/7400114)
*   Local regulations regarding authentic, non-deceptive reviews.

Do not use this tool for spam, fake reviews, or malicious intent. You are solely responsible for actions performed by your browser when using this software.

## 📁 File Structure Overview

*   `background.js`: Handles the global queue, opening/closing of tabs, and state persistence.
*   `content.js`: Injected into Google Maps pages. Extracts map links and houses the primary automation engine (finding buttons, interacting with the review iframe).
*   `manifest.json`: Configuration file defining permissions and script injection scopes.
*   *(Add mentions to your popup HTML/JS or CSS files if they exist)*

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! If you have suggestions to improve the parser targeting or add new automation features, feel free to open a pull request.
