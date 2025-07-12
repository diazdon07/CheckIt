(() => {
    let isLoading = false;
    const checklistContainer = document.querySelector('.checklistInfo');
    const searchList = document.querySelector('#searchList');
    const refreshButton = document.querySelector('#refreshButton');

    document.addEventListener('DOMContentLoaded', function () {
        chrome.storage.sync.get(['deploymentId',"userName"], function (data) {
            if (data.deploymentId) {
                fetchGoogleExcelSheet(data.deploymentId,data.userName);
            }
        });

        searchList.addEventListener('input', handleSearch);
        refreshButton.addEventListener('click', function () {
            if (isLoading) return;
            loadingFunction('loading');
            chrome.storage.sync.get(['deploymentId','userName'], function (data) {
                if (!data.deploymentId) {
                    checklistContainer.innerHTML = `<div class="alert alert-warning">Missing Deployment ID.</div>`;
                    loadingFunction('done');
                    return;
                }
                fetchGoogleExcelSheet(data.deploymentId,data.userName);
            });
        });
    });

    async function fetchGoogleExcelSheet(deploymentId,userName) {
        loadingFunction('loading');
        searchList.value = '';
        refreshButton.disabled = true;

        try {
            const res = await fetch(`https://script.google.com/macros/s/${deploymentId}/exec`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json();

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
                            ? savedList.map(id => items.find(i => generateId(i) === id)).filter(Boolean)
                            : items.slice().sort((a, b) => a.content.localeCompare(b.content, undefined, { numeric: true, sensitivity: 'base' }));

                        const accordionItem = document.createElement('div');
                        accordionItem.className = 'accordion-item';
                        accordionItem.innerHTML = `
                            <h2 class="accordion-header" id="heading-${accordionId}">
                                <button class="accordion-button collapsed" type="button"
                                    data-bs-toggle="collapse" data-bs-target="#collapse-${accordionId}"
                                    aria-expanded="false" aria-controls="collapse-${accordionId}">
                                    ${category}
                                </button>
                            </h2>
                            <div id="collapse-${accordionId}" class="accordion-collapse collapse">
                                <div class="accordion-body p-0" id="sortable-${accordionId}"></div>
                            </div>`;

                        const accordionBody = accordionItem.querySelector('.accordion-body');

                        orderedItems.forEach(item => {
                            const id = generateId(item);
                            const keywords = item.keywords?.split(',').map(k => k.trim()).join(', ') || '';
                            const isNew = item.rawDate && new Date(item.rawDate).getMonth() === new Date().getMonth();
                            const hasStatus = item.status?.trim();

                            const checklistItem = document.createElement('div');
                            checklistItem.className = "input-group mb-1 checklist-item";
                            checklistItem.setAttribute('data-id', id);
                            checklistItem.innerHTML = `
                                <div class="position-absolute top-0" style="z-index:1;right:15px;">
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

                createExportModal(userName);
                loadingFunction('done');
            });
        } catch (err) {
            checklistContainer.innerHTML = `<div class="alert alert-danger">Failed to load data.</div>`;
            loadingFunction('done');
        }
    }

    function handleSearch() {
        const term = searchList.value.toLowerCase();
        const allTabs = document.querySelectorAll('.tab-pane');
        let found = false;

        allTabs.forEach(tab => {
            const tabId = tab.id;
            let showTab = false;

            tab.querySelectorAll('.accordion-item').forEach(item => {
                let visibleItems = 0;

                item.querySelectorAll('.checklist-item').forEach(listItem => {
                    const label = listItem.querySelector('label');
                    const text = label?.textContent.toLowerCase() || '';
                    const keyword = label?.getAttribute('keyword')?.toLowerCase() || '';
                    const match = text.includes(term) || keyword.includes(term);

                    listItem.style.display = match ? '' : 'none';
                    if (match) visibleItems++;
                });

                item.style.display = visibleItems ? '' : 'none';
                if (visibleItems) showTab = true;
            });

            const tabButton = document.querySelector(`button[data-bs-target="#${tabId}"]`);
            tabButton.style.display = showTab ? '' : 'none';
            if (showTab) found = true;
        });

        const firstVisible = document.querySelector('.nav-link:not([style*="display: none"])');
        if (firstVisible && !firstVisible.classList.contains('active')) firstVisible.click();
    }

    function generateId(item) {
        return btoa(unescape(encodeURIComponent(item.content + item.rawDate + item.status))).substring(0, 12);
    }

    function loadingFunction(status) {
        isLoading = status === 'loading';
        refreshButton.disabled = isLoading;
        if (status === 'loading') {
            checklistContainer.innerHTML = ` 
                <div class="loading">
                    <img src="Animation - 1750223658529.gif" alt="Loading GIF">
                </div>
            `;
        }
    }

    function createExportModal(userName) {
        if (document.querySelector('#exportChecklistButton')) return;

        const button = document.createElement('button');
        button.textContent = 'Export';
        button.className = 'btn btn-primary position-fixed';
        button.style = 'bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; opacity: 0; pointer-events: none; transition: opacity 0.4s ease';
        button.id = 'exportChecklistButton';
        document.body.appendChild(button);

        const hoverZone = document.createElement('div');
        hoverZone.id = 'hoverZone';
        hoverZone.style = 'position: fixed; bottom: 0; left: 0; width: 100%; height: 100px; z-index: 999;';
        document.body.appendChild(hoverZone);

        let isHovered = false;
        let hideTimeout;

        const showButton = () => {
            clearTimeout(hideTimeout);
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
        };

        const hideButton = () => {
            hideTimeout = setTimeout(() => {
                if (!isHovered) {
                    button.style.opacity = '0';
                    button.style.pointerEvents = 'none';
                }
            }, 300); // 300ms delay before hiding
        };

        hoverZone.addEventListener('mouseenter', showButton);
        hoverZone.addEventListener('mouseleave', hideButton);

        button.addEventListener('mouseenter', () => {
            isHovered = true;
            showButton();
        });

        button.addEventListener('mouseleave', () => {
            isHovered = false;
            hideButton();
        });

        // Modal HTMLlabel
        const modalHTML = `
            <div class="modal fade" id="exportModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Export File</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="exportForm">
                                <input class="form-control mb-2" placeholder="Name" id="exportName" value="${userName}" disabled>
                                <input class="form-control mb-2" placeholder="Business Title" id="exportTitle" required>
                                <textarea class="form-control mb-2" placeholder="Notes" id="exportNotes" rows="20"></textarea>
                                <input class="form-control mb-2" placeholder="Link" id="exportLink" type="url">
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-success" id="confirmExportBtn">Download CSV</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const exportModal = new bootstrap.Modal(document.getElementById('exportModal'));

        button.addEventListener('click', () => exportModal.show());

        document.getElementById('confirmExportBtn').addEventListener('click', () => {
            const name = document.getElementById('exportName').value.trim();
            const title = document.getElementById('exportTitle').value.trim();
            const notes = document.getElementById('exportNotes').value.trim();
            const link = document.getElementById('exportLink').value.trim();
            if (!name || !title) return alert("Name and Business Title required.");

            const activeTab = document.querySelector('.tab-pane.active');
            const items = activeTab.querySelectorAll('.checklist-item');
            const row = [name, title, notes, link].map(val => `"${val.replace(/"/g, '""')}"`);

            items.forEach(item => {
                const label = item.querySelector('label')?.innerHTML
                .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newline
                .replace(/<\/?[^>]+(>|$)/g, '') // Strip any other HTML tags
                .trim() || '';
                const checked = item.querySelector('input')?.checked ? 'Yes' : 'No';
                row.push(`"${label.replace(/"/g, '""')}"`, `"${checked}"`);
            });

            const csv = row.join(',') + '\n';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title} by ${name}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            exportModal.hide();
        });
    }
})();