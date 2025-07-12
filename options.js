// This script handles the options page for the Checkit extension It allows users to input and save their Google Apps Script Deployment ID
document.addEventListener('DOMContentLoaded', function() {
    // Load the page if deploment ID are in storage
    chrome.storage.sync.get(['deploymentId','userName'], function(data) {
        if (data.deploymentId && data.userName) {
            // Populate the input field with the saved deployment ID
            document.getElementById('apiKey').value = data.deploymentId;
            document.getElementById('user').value = data.userName;
            // Fetch the Google Apps Script deployment ID
            // fetchGoogleAppsScriptDeploymentId(data.deploymentId);
        }
    });
    // Save the deployment ID to storage
    document.getElementById('saveButton').addEventListener('click', function() {
        // Get the deployment ID from the input field  
        const deploymentId = document.getElementById('apiKey').value;
        const userName = document.getElementById('user').value;
        // Check if the deployment ID is not empty and is a valid format (optional, you can add more validation)
        if (deploymentId) {
            // Save the deployment ID to Chrome storage
            chrome.storage.sync.set({ deploymentId: deploymentId, userName: userName }, function() {
                alert('Deployment ID and User saved successfully!');
                // Fetch the Google Apps Script deployment ID
                // fetchGoogleAppsScriptDeploymentId(deploymentId);
            });
        } else {
            alert('Please enter a valid Deployment ID and User.');
        }
    });
});
