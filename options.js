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
