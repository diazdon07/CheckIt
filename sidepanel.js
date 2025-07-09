(() => {
    let isLoading = false;
    const checklistContainer = document.querySelector('.checklistInfo');
    const searchList = document.querySelector('#searchList');
    const refreshButton = document.querySelector('#refreshButton');

    document.addEventListener('DOMContentLoaded', function () {
        chrome.storage.sync.get(['deploymentId'], function (data) {
            if (data.deploymentId) {
                fetchGoogleExcelSheet(data.deploymentId);
            }
        });

        searchList.addEventListener('input', handleSearch);
        refreshButton.addEventListener('click', function () {
            if (isLoading) return;
            loadingFunction('loading');
            chrome.storage.sync.get(['deploymentId'], function (data) {
                if (!data.deploymentId) {
                    checklistContainer.innerHTML = `
                        <div class="alert alert-warning" role="alert">
                            Deployment ID is missing. Please configure your settings.
                        </div>`;
                    loadingFunction('done');
                    return;
                }
                fetchGoogleExcelSheet(data.deploymentId);
            });
        });
    });

    async function fetchGoogleExcelSheet(deploymentId) {
        loadingFunction('loading');
        searchList.value = '';
        refreshButton.disabled = true;

        try {
            const response = await fetch(`https://script.google.com/macros/s/${deploymentId}/exec`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            checklistContainer.innerHTML = '';

            const tabNav = document.createElement('ul');
            tabNav.className = 'nav nav-tabs mb-3';
            const tabContent = document.createElement('div');
            tabContent.className = 'tab-content';

            checklistContainer.appendChild(tabNav);
            checklistContainer.appendChild(tabContent);

            const parentTitles = Object.keys(data);

            chrome.storage.sync.get(['customOrder'], (storageData) => {
                const savedOrder = storageData.customOrder || {};

                parentTitles.forEach((title, tabIndex) => {
                    const tabId = `tab-${tabIndex}`;
                    tabNav.innerHTML += `
                        <li class="nav-item">
                            <button class="nav-link ${tabIndex === 0 ? 'active' : ''}" 
                                id="${tabId}-tab" data-bs-toggle="tab" data-bs-target="#${tabId}" 
                                type="button" role="tab" aria-controls="${tabId}" aria-selected="${tabIndex === 0}">
                                ${title}
                            </button>
                        </li>`;

                    const tabPane = document.createElement('div');
                    tabPane.className = `tab-pane fade ${tabIndex === 0 ? 'show active' : ''}`;
                    tabPane.id = tabId;
                    tabPane.setAttribute('role', 'tabpanel');
                    tabPane.setAttribute('aria-labelledby', `${tabId}-tab`);

                    const accordion = document.createElement('div');
                    accordion.className = 'accordion';
                    tabPane.appendChild(accordion);
                    tabContent.appendChild(tabPane);

                    const grouped = {};
                    data[title].slice(1).forEach(row => {
                        const [rawDate, category, content, keywords, status] = row.map(cell => cell?.trim());
                        if (!content || !category) return;

                        if (!grouped[category]) grouped[category] = [];
                        grouped[category].push({ rawDate, content, keywords, status });
                    });

                    Object.keys(grouped).forEach((category, catIndex) => {
                        const accordionId = `accordion-${tabId}-${catIndex}`;
                        const savedList = savedOrder[`${tabId}-${category}`] || [];

                        const items = grouped[category];
                        const orderedItems = savedList.length
                            ? savedList.map(id => items.find(item => generateId(item) === id)).filter(Boolean)
                            : items;

                        const accordionItem = document.createElement('div');
                        accordionItem.className = 'accordion-item mb-2';
                        accordionItem.innerHTML = `
                            <h2 class="accordion-header" id="heading-${accordionId}">
                                <button class="accordion-button collapsed" type="button"
                                    data-bs-toggle="collapse" data-bs-target="#collapse-${accordionId}"
                                    aria-expanded="false" aria-controls="collapse-${accordionId}">
                                    ${category}
                                </button>
                            </h2>
                            <div id="collapse-${accordionId}" class="accordion-collapse collapse" aria-labelledby="heading-${accordionId}">
                                <div class="accordion-body p-0" id="sortable-${accordionId}"></div>
                            </div>`;

                        const accordionBody = accordionItem.querySelector('.accordion-body');

                        orderedItems.forEach((item, index) => {
                            const id = generateId(item);
                            const keywords = item.keywords?.split(',').map(k => k.trim()).join(', ') || '';
                            const isNew = item.rawDate && new Date(item.rawDate).getMonth() === new Date().getMonth();
                            const hasStatus = item.status?.trim();

                            const checklistItem = document.createElement('div');
                            checklistItem.className = "input-group mb-1 checklist-item";
                            checklistItem.setAttribute('data-id', id);
                            checklistItem.innerHTML = `
                                <div class="position-absolute top-0" style="z-index: 1;right: 15px;">
                                    <div class="row gap-1">
                                        ${hasStatus ? `<div class="col-auto p-0 status-list-item"><p class="textParagraph">${item.status}</p></div>` : ''}
                                        ${isNew ? `<div class="col-auto p-0 new-list-item"><p class="textParagraph">New</p></div>` : ''}
                                    </div>
                                </div>
                                <div class="input-group-text">
                                    <input class="form-check-input mt-0" type="checkbox" id="${id}" value="${item.content}">
                                </div>
                                <label class="form-control pt-4 pb-4" for="${id}" keyword="${keywords}">${item.content.replace(/\n/g, '<br>')}</label>
                            `;

                            accordionBody.appendChild(checklistItem);
                        });

                        accordion.appendChild(accordionItem);

                        new Sortable(accordionBody, {
                            animation: 150,
                            onEnd: function () {
                                const itemIds = [...accordionBody.querySelectorAll('.checklist-item')].map(el => el.getAttribute('data-id'));
                                chrome.storage.sync.get(['customOrder'], result => {
                                    const updatedOrder = result.customOrder || {};
                                    updatedOrder[`${tabId}-${category}`] = itemIds;
                                    chrome.storage.sync.set({ customOrder: updatedOrder });
                                });
                            }
                        });
                    });
                });

                loadingFunction('done'); // ✅ Done after rendering all tabs
            });
        } catch (error) {
            console.error("Error reading sheet:", error);
            checklistContainer.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    Failed to load data. Please try again later.
                </div>`;
            loadingFunction('done');
        }
    }

    function handleSearch() {
        const term = searchList.value.toLowerCase();
        const allTabs = document.querySelectorAll('.tab-pane');
        let foundInTabs = 0;

        allTabs.forEach(tab => {
            const labels = tab.querySelectorAll('label.form-control');
            let foundInThisTab = 0;

            labels.forEach(label => {
                const text = label.textContent.toLowerCase();
                const keyword = label.getAttribute('keyword')?.toLowerCase() || '';
                const parent = label.closest('.input-group');
                const match = text.includes(term) || keyword.includes(term);
                parent.style.display = match ? '' : 'none';
                if (match) foundInThisTab++;
            });

            const tabId = tab.getAttribute('id');
            const tabButton = document.querySelector(`button[data-bs-target="#${tabId}"]`);
            tabButton.style.display = foundInThisTab > 0 ? '' : 'none';
            if (foundInThisTab > 0) foundInTabs++;
        });

        const firstVisibleTabBtn = document.querySelector('.nav-link:not([style*="display: none"])');
        if (firstVisibleTabBtn && !firstVisibleTabBtn.classList.contains('active')) {
            firstVisibleTabBtn.click();
        }
    }

    function generateId(item) {
        return btoa(unescape(encodeURIComponent(item.content + item.rawDate + item.status))).substring(0, 12);
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