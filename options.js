// This script handles the options page for the Checkit extension It allows users to input and save their Google Apps Script Deployment ID
document.addEventListener('DOMContentLoaded', function() {
    // Load the page if deploment ID are in storage
    chrome.storage.sync.get('deploymentId', function(data) {
        if (data.deploymentId) {
            // Populate the input field with the saved deployment ID
            document.getElementById('apiKey').value = data.deploymentId;
            // Fetch the Google Apps Script deployment ID
            fetchGoogleAppsScriptDeploymentId(data.deploymentId);
        }
    });
    // Save the deployment ID to storage
    document.getElementById('saveButton').addEventListener('click', function() {
        // Get the deployment ID from the input field  
        const deploymentId = document.getElementById('apiKey').value;
        // Check if the deployment ID is not empty and is a valid format (optional, you can add more validation)
        if (deploymentId) {
            // Save the deployment ID to Chrome storage
            chrome.storage.sync.set({ deploymentId: deploymentId }, function() {
                alert('Deployment ID saved successfully!');
                // Fetch the Google Apps Script deployment ID
                fetchGoogleAppsScriptDeploymentId(deploymentId);
            });
        } else {
            alert('Please enter a valid Deployment ID.');
        }
    });
});

function fetchGoogleAppsScriptDeploymentId(deploymentId) {
    // Fetch the Google Apps Script deployment ID
    fetch(`https://script.google.com/macros/s/${deploymentId}/exec`)
        .then(response => response.json())
        .then(data => {
            // get sheets titles from the response
            const parentTitles = Object.keys(data);
            // get the select element
            const selectElement = document.getElementById('selectTableSheet');

            // get the selected title from storage if it exists
            chrome.storage.sync.get('selectedTitle', function(data) {
                selectElement.value = data.selectedTitle || 'Select Excel Sheet Table';
            });

            // Populate the select element with the sheet titles
            parentTitles.forEach(title => {
                const option = document.createElement('option');
                option.value = title;
                option.textContent = title;
                selectElement.appendChild(option);
            });

            // Add an event listener to save the selected title when the user changes the selection This will save the selected title to storage
            selectElement.addEventListener('change', function() {
                const selectedTitle = this.value;
                // Save the selected title to storage
                chrome.storage.sync.set({ selectedTitle: selectedTitle }, function() {
                    console.log('Selected title saved:', selectedTitle);
                });
            });
        })
        .catch(error => {
            // Handle errors in fetching the deployment ID
            console.error('Error fetching Deployment ID:', error);
        });
}