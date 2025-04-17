document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const uploadForm = document.getElementById('uploadForm');
    const loadingEl = document.getElementById('loading');
    const resultEl = document.getElementById('result');
    const errorEl = document.getElementById('error');
    const tryAgainBtn = document.querySelectorAll('.try-again-btn');
    
    // Event Listeners
    uploadForm.addEventListener('submit', handleFormSubmit);
    tryAgainBtn.forEach(btn => {
        btn.addEventListener('click', () => {
            hideError();
            hideResult();
        });
    });
    
    /**
     * Handle form submission
     */
    async function handleFormSubmit(event) {
        event.preventDefault();
        
        // Hide previous results/errors
        hideResult();
        hideError();
        
        // Basic validation
        const doctorWallet = document.getElementById('doctorWallet').value;
        const doctorPrivateKey = document.getElementById('doctorPrivateKey').value;
        const patientId = document.getElementById('patientId').value;
        const patientWallet = document.getElementById('patientWallet').value;
        const diagnosisDate = document.getElementById('diagnosisDate').value;
        const recordType = document.getElementById('recordType').value;
        const fileInput = document.getElementById('medicalFile');
        
        if (!patientId || !patientWallet || !diagnosisDate || !recordType || !fileInput.files[0]) {
            showError('Please fill out all required fields and select a file.');
            return;
        }
        
        // Show loading
        showLoading('Uploading to IPFS and Blockchain...');
        
        try {
            // Create FormData object for file upload
            const formData = new FormData();
            formData.append('doctorWallet', doctorWallet);
            formData.append('doctorPrivateKey', doctorPrivateKey);
            formData.append('patientId', patientId);
            formData.append('patientWallet', patientWallet);
            formData.append('diagnosisDate', diagnosisDate);
            formData.append('recordType', recordType);
            formData.append('medicalFile', fileInput.files[0]);
            
            // Send request to server
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to upload file');
            }
            
            // Handle successful upload
            hideLoading();
            
            // Display result
            let blockchainStatus;
            if (result.data.blockchainTx && result.data.blockchainTx !== "Not added to blockchain") {
                blockchainStatus = `<p class="success-message">✅ Successfully added to blockchain</p>
                                   <p><strong>Transaction Hash:</strong> <span class="tx">${result.data.blockchainTx}</span></p>`;
            } else if (result.data.blockchainResult && result.data.blockchainResult.startsWith("Error")) {
                blockchainStatus = `<p class="error-message">❌ Failed to add to blockchain</p>
                                   <p><strong>Error:</strong> ${result.data.blockchainResult}</p>`;
            } else {
                blockchainStatus = `<p class="warning-message">⚠️ Not added to blockchain</p>`;
            }
            
            const resultHTML = `
                <h3>Upload Successful!</h3>
                <div class="result-data">
                    <p><strong>Patient ID:</strong> ${result.data.patientId}</p>
                    <p><strong>Record ID:</strong> ${result.data.recordId}</p>
                    <p><strong>Record Type:</strong> ${result.data.recordType}</p>
                    <p><strong>File Hash:</strong> <span class="hash">${result.data.sha256Hash}</span></p>
                    <p><strong>IPFS CID:</strong> <span class="cid">${result.data.cid}</span></p>
                    
                    <div class="blockchain-status">
                        <h4>Blockchain Status:</h4>
                        ${blockchainStatus}
                    </div>
                </div>
                
                <div class="info-note">
                    <p>Your file has been uploaded to IPFS. ${result.data.blockchainTx === "Not added to blockchain" ? 
                        "To manually add to the blockchain, use this command:" : 
                        "You can view your record on the blockchain with this command:"}</p>
                    <code>${result.data.blockchainTx === "Not added to blockchain" ? 
                        `npm run add-medical-record uploads/${patientId}_blockchain_input.json [DOCTOR_PRIVATE_KEY]` : 
                        `npm run get-records [PRIVATE_KEY] ${patientWallet}`}</code>
                </div>
            `;
            
            showResult(resultHTML);
            
        } catch (error) {
            console.error('Upload error:', error);
            hideLoading();
            showError(`Error: ${error.message}`);
        }
    }
    
    /**
     * Show loading indicator
     */
    function showLoading(message = 'Processing...') {
        loadingEl.querySelector('.loading-message').textContent = message;
        loadingEl.classList.remove('hidden');
    }
    
    /**
     * Hide loading indicator
     */
    function hideLoading() {
        loadingEl.classList.add('hidden');
    }
    
    /**
     * Show result card
     */
    function showResult(html) {
        resultEl.querySelector('.result-content').innerHTML = html;
        resultEl.classList.remove('hidden');
    }
    
    /**
     * Hide result card
     */
    function hideResult() {
        resultEl.classList.add('hidden');
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        errorEl.querySelector('.error-message').textContent = message;
        errorEl.classList.remove('hidden');
    }
    
    /**
     * Hide error message
     */
    function hideError() {
        errorEl.classList.add('hidden');
    }
}); 
 
 