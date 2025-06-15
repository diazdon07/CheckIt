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
    searchList.addEventListener('input', function () {
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
    });

    // Add an event listener to the refresh button (only once)
    refreshButton.addEventListener('click', function () {
        // Get the deployment ID and selected title from storage
        chrome.storage.sync.get(['deploymentId', 'selectedTitle'], function (data) {
            if (data.deploymentId && data.selectedTitle) {
                // Fetch the Google Excel sheet with the current deployment ID and selected title
                fetchGoogleExcelSheet(data.deploymentId, data.selectedTitle);
            } else {
                console.error('Deployment ID or selected title not found in storage.');
            }
        });
    });

});

// Get the elements from the DOM sidepanel
const checklistContainer = document.querySelector('.checklistInfo');
const searchList = document.querySelector('#searchList');
const refreshButton = document.querySelector('#refreshButton');

function fetchGoogleExcelSheet(deploymentId, selectedTitle) {
    // Clear previous content
    checklistContainer.innerHTML = '';

    // Fetch data from Google Apps Script
    fetch(`https://script.google.com/macros/s/${deploymentId}/exec`)
        .then(response => response.json())
        .then(data => {
            const grouped = {};

            // Skip header row using slice(1)
            data[selectedTitle].slice(1).forEach(row => {
                const content = row[2]?.trim();
                const category = row[1]?.trim();
                const keywordStr = row[3]?.trim();

                if (!content || !category) return;

                // Split keywords into an array
                const keywords = keywordStr ? keywordStr.split(',').map(k => k.trim()) : [];

                if (!grouped[category]) {
                    grouped[category] = [];
                }
                grouped[category].push({ content, keywords });
            });

            // Sort categories alphabetically
            const sortedCategories = Object.keys(grouped).sort();

            // Render sorted categories and their items
            sortedCategories.forEach(category => {
                // const categoryTitle = `<h3>${category}</h3>`;
                // checklistContainer.innerHTML += categoryTitle;

                grouped[category].forEach((item, index) => {
                    const id = `check-${category}-${index}`;
                    const keywordAttr = item.keywords.join(', '); // optional, for debugging

                    const checklistItemHTML = `
                        <div class="input-group mb-1">
                            <div class="input-group-text">
                                <input class="form-check-input mt-0" type="checkbox" id="${id}" name="${category}" value="${item.content}" aria-label="Checkbox if task already done." />
                            </div>
                            <label class="form-control" for="${id}" keyword="${keywordAttr}">${item.content}</label>
                        </div>
                    `;
                    checklistContainer.innerHTML += checklistItemHTML;
                });
            });
        })
        // Handle errors in fetching the sheet
        .catch(err => console.error("Error reading sheet:", err));
}