(() => {
    let isLoading = false;
    // Add an event listener to the side panel
    document.addEventListener('DOMContentLoaded', function () {

        // Get the deployment ID and selected title from storage
        chrome.storage.sync.get(['deploymentId', 'selectedTitle'], function (data) {
            if (data.deploymentId) {
                // Fetch the Google Apps Script deployment ID
                fetchGoogleExcelSheet(data.deploymentId, data.selectedTitle);
            }
        });

        // Add input event listener to the search box (only once)
        let searchTimeout;
        searchList.addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchTerm = this.value.toLowerCase(); // Get the lowercase search term
                const titles = document.querySelectorAll('label.form-control'); // Select all checklist labels

                titles.forEach(title => {
                    const text = title.textContent.toLowerCase(); // Get the visible text
                    const keywords = title.getAttribute('keyword')?.toLowerCase() || ''; // Get keywords from keyword attribute

                    const parentBlock = title.parentElement; // Get the parent container (the whole checklist item)

                    // Show item if the search term matches the visible text or keywords
                    if (text.includes(searchTerm) || keywords.includes(searchTerm)) {
                        parentBlock.style.display = ''; // Show the item
                    } else {
                        parentBlock.style.display = 'none'; // Hide the item
                    }
                });
            }, 300); // wait 300ms after typing stops
        });

        // Add an event listener to the refresh button (only once)
        refreshButton.addEventListener('click', function () {
            // Prevent spamming if already loading
            if (isLoading) return;
            isLoading = true;      // immediately lock
            loadingFunction('loading'); // show loading state
            // Get the deployment ID and selected title from storage
            chrome.storage.sync.get(['deploymentId', 'selectedTitle'], function (data) {
                if (!data.deploymentId || !data.selectedTitle) {
                    checklistContainer.innerHTML = `
                        <div class="alert alert-warning" role="alert">
                            Deployment ID or Selected Title is missing. Please configure your settings.
                        </div>`;
                    return;
                } else {
                    // Fetch the Google Excel sheet with the current deployment ID and selected title
                    fetchGoogleExcelSheet(data.deploymentId, data.selectedTitle);
                }
            });
        });

    });

    // Get the elements from the DOM sidepanel
    const checklistContainer = document.querySelector('.checklistInfo');
    const searchList = document.querySelector('#searchList');
    const refreshButton = document.querySelector('#refreshButton');

    async function fetchGoogleExcelSheet(deploymentId, selectedTitle) {
        
        // Clear previous content
        loadingFunction('loading');
        searchList.value = ''; // Clear the search box
        refreshButton.disabled = true; // Disable the refresh button

        try {
            // Fetch data from Google Apps Script
            const response = await fetch(`https://script.google.com/macros/s/${deploymentId}/exec`);

            // Check if the response is ok
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Parse the JSON data
            const data = await response.json();     
            const grouped = {};

            // Skip header row using slice(1)
            data[selectedTitle].slice(1).forEach(row => {
                const getDate = row[0]?.trim();
                const getContent = row[2]?.trim();
                const getCategory = row[1]?.trim();
                const getKeywordStr = row[3]?.trim();
                const getStatus = row[4]?.trim();

                if (!getContent || !getCategory) return;

                // Split keywords into an array
                const keywords = getKeywordStr ? getKeywordStr.split(',').map(k => k.trim()) : [];

                if (!grouped[getCategory]) {
                    grouped[getCategory] = [];
                }
                grouped[getCategory].push({ getDate, getContent, keywords, getStatus });
            });

            // Sort categories alphabetically
            const sortedCategories = Object.keys(grouped).sort();

            checklistContainer.innerHTML = ''; // Clear old items
            checklistContainer.classList.add('accordion'); // add accordion class to container

            // Render sorted categories and their items
            sortedCategories.forEach((getCategory, catIndex) => {
                const accordionId = `accordion-${catIndex}`;

                // Create accordion header
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'accordion-item mb-2';

                // Add category title with Bootstrap 5 accordion behavior
                categoryHeader.innerHTML = `
                    <h2 class="accordion-header" id="heading-${accordionId}">
                        <button class="accordion-button collapsed" type="button"
                            data-bs-toggle="collapse" data-bs-target="#collapse-${accordionId}"
                            aria-expanded="false" aria-controls="collapse-${accordionId}">
                            ${getCategory}
                        </button>
                    </h2>
                    <div id="collapse-${accordionId}" class="accordion-collapse collapse" aria-labelledby="heading-${accordionId}">
                        <div class="accordion-body p-0"></div>
                    </div>
                `;

                // Find the container for the checklist items in this category
                const accordionBody = categoryHeader.querySelector('.accordion-body');

                 grouped[getCategory].forEach((item, index) => {
                    const id = `check-${getCategory}-${index}`;
                    const keywordAttr = item.keywords.join(', ');

                    const checklistItem = document.createElement('div');
                    checklistItem.className = "input-group mb-1";

                    // Determine if the item date is in the current month
                    let isNew = false;
                    if (item.getDate) {
                        const itemDate = new Date(item.getDate);
                        const now = new Date();
                        if (
                            itemDate.getFullYear() === now.getFullYear() &&
                            itemDate.getMonth() === now.getMonth()
                        ) {
                            isNew = true;
                        }
                    }

                    // Determine if the item has a status for Top Errors
                    let hasTopError = item.getStatus && item.getStatus.trim() !== '';

                    // Build the status labels HTML dynamically
                    let statusLabelsHtml = '';

                    if (hasTopError) {
                        statusLabelsHtml += `
                            <div class="col-auto p-0 status-list-item">
                                <p class="textParagraph">Top Errors</p>
                            </div>`;
                    }
                    if (isNew) {
                        statusLabelsHtml += `
                            <div class="col-auto p-0 new-list-item">
                                <p class="textParagraph">New</p>
                            </div>`;
                    }

                    checklistItem.innerHTML = `
                        <div class="position-absolute top-0" style="z-index: 1;right: 15px;">
                            <div class="row gap-1">
                                ${statusLabelsHtml}
                            </div>
                        </div>
                        <div class="input-group-text">
                            <input class="form-check-input mt-0" type="checkbox" id="${id}" name="${getCategory}" value="${item.getContent}" aria-label="Checkbox if task already done.">
                        </div>
                    `;

                    const label = document.createElement('label');
                    label.className = "form-control pt-4 pb-4";
                    label.setAttribute('for', id);
                    label.setAttribute('keyword', keywordAttr);

                    // Replace any newline characters (\n) with <br> tags so HTML can render them as line breaks
                    const contentWithBreaks = item.getContent.replace(/\n/g, '<br>');
                    label.innerHTML = contentWithBreaks; // ✅ this will display the content with line breaks

                    checklistItem.appendChild(label);
                    accordionBody.appendChild(checklistItem);
                });

                checklistContainer.appendChild(categoryHeader);
            });
        } catch (error) {
            console.error("Error reading sheet:", error);
            checklistContainer.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    Failed to load data. Please try again later.
                </div>`;
        } finally {
            // Hide loading indicator and enable the refresh button
            loadingFunction('done');
        }
    }

    function loadingFunction(status) {
        // Show loading indicator
        searchList.value = ''; // Clear the search box
        refreshButton.disabled = true; // Disable the refresh button
        if (status === 'done') {
            isLoading = false;
            // Remove loading indicator elemet
            const loadingElement = checklistContainer.querySelector('div.loading');
            if (loadingElement) loadingElement.remove();
            refreshButton.disabled = false; // Enable the refresh button
        } else
        if (status === 'loading') {
            isLoading = true;
            checklistContainer.innerHTML = `
                <div class="loading">
                    <img src="Animation - 1750223658529.gif" alt="Loading GIF">
                </div>`;
            refreshButton.disabled = true; // Disable the refresh button
        }
    }
})();