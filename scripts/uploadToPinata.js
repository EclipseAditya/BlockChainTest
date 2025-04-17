const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

/**
 * Script to upload medical files to IPFS via Pinata
 * Calculates SHA256 hash and generates CID for blockchain storage
 * 
 * Usage: node scripts/uploadToPinata.js <input-json-file> <output-json-file>
 * 
 * Example input JSON:
 * {
 *   "patientID": "0123456789",
 *   "files": [
 *     {
 *       "recordID": "REC12345",
 *       "recordType": "Blood Test",
 *       "filePath": "/path/to/bloodtest.pdf"
 *     },
 *     ...
 *   ]
 * }
 * 
 * Example output JSON:
 * {
 *   "patientID": "0123456789",
 *   "records": [
 *     {
 *       "recordID": "REC12345",
 *       "recordType": "Blood Test",
 *       "sha256Hash": "0x8d87c72ea6d9577d5721e375f4c84f979580dcb3f5a4254ce612665d8873fd5e",
 *       "cid": "QmX6j9DHcPhgBcBtZsuRkfmk8iAboKwLwfgvwZFWEJ7VTo"
 *     },
 *     ...
 *   ]
 * }
 */

// Configuration - Replace with your Pinata API keys
const PINATA_API_KEY = 'c1dc32cb279e4a92619c';
const PINATA_SECRET_API_KEY = '8618e07c120fd391c302624dd677afa86c7da9dc0e56f2541a5ec9a749f2d49c';
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

async function uploadToPinata() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.error('Usage: node scripts/uploadToPinata.js <input-json-file> <output-json-file>');
      process.exit(1);
    }
    
    const inputJsonPath = args[0];
    const outputJsonPath = args[1];
    
    // Read and parse the input JSON file
    console.log(`Reading input file: ${inputJsonPath}`);
    if (!fs.existsSync(inputJsonPath)) {
      console.error(`Input file not found: ${inputJsonPath}`);
      process.exit(1);
    }
    
    const inputData = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
    const { patientID, files } = inputData;
    
    if (!patientID || !files || !Array.isArray(files) || files.length === 0) {
      console.error('Invalid input JSON format. Must include patientID and files array.');
      process.exit(1);
    }
    
    console.log(`Processing ${files.length} files for patient ID: ${patientID}`);
    
    // Prepare output data structure
    const outputData = {
      patientID: patientID,
      records: []
    };
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`\nProcessing file ${i+1}/${files.length}: ${file.recordID}`);
      
      if (!file.filePath || !fs.existsSync(file.filePath)) {
        console.error(`File not found: ${file.filePath}`);
        continue;
      }
      
      // Calculate SHA256 hash
      console.log(`Calculating SHA256 hash for: ${file.filePath}`);
      const fileBuffer = fs.readFileSync(file.filePath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const sha256Hash = '0x' + hashSum.digest('hex');
      console.log(`SHA256: ${sha256Hash}`);
      
      // Upload to Pinata
      console.log(`Uploading to IPFS via Pinata: ${path.basename(file.filePath)}`);
      
      try {
        const cid = await uploadFileToPinata(file.filePath, `${patientID}_${file.recordID}`);
        console.log(`✅ Upload successful! CID: ${cid}`);
        
        // Add to output records
        outputData.records.push({
          recordID: file.recordID,
          recordType: file.recordType,
          sha256Hash: sha256Hash,
          cid: cid
        });
      } catch (error) {
        console.error(`Error uploading file to Pinata: ${error.message}`);
      }
    }
    
    // Write output JSON
    fs.writeFileSync(outputJsonPath, JSON.stringify(outputData, null, 2));
    console.log(`\n✅ Process complete! Output written to: ${outputJsonPath}`);
    console.log(`Total records processed: ${outputData.records.length}`);
    
    // If any records were processed, show next steps
    if (outputData.records.length > 0) {
      console.log('\nNext Steps:');
      console.log('1. Use the output JSON with the blockchain scripts to store records:');
      console.log(`   npm run add-record ${outputJsonPath} <doctor-private-key>`);
    }
    
  } catch (error) {
    console.error('Error processing files:', error);
    process.exit(1);
  }
}

/**
 * Uploads a file to IPFS via Pinata
 * @param {string} filePath - Path to the file
 * @param {string} name - Name for the file on IPFS
 * @returns {Promise<string>} - CID of the uploaded file
 */
async function uploadFileToPinata(filePath, name) {
  // Check if API keys are configured
  if (PINATA_API_KEY === 'YOUR_PINATA_API_KEY' || PINATA_SECRET_API_KEY === 'YOUR_PINATA_SECRET_API_KEY') {
    console.error('⚠️ Pinata API keys not configured. Please edit scripts/uploadToPinata.js to add your API keys.');
    throw new Error('Pinata API keys not configured');
  }
  
  // Prepare form data
  const formData = new FormData();
  const file = fs.createReadStream(filePath);
  
  formData.append('file', file);
  formData.append('pinataMetadata', JSON.stringify({
    name: name,
    keyvalues: {
      type: 'medical_record',
      timestamp: Date.now()
    }
  }));
  
  // Upload to Pinata
  const response = await axios.post(PINATA_API_URL, formData, {
    maxBodyLength: 'Infinity', // Required for large files
    headers: {
      'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
      'pinata_api_key': PINATA_API_KEY,
      'pinata_secret_api_key': PINATA_SECRET_API_KEY
    }
  });
  
  if (response.status === 200) {
    return response.data.IpfsHash;
  } else {
    throw new Error(`Pinata API returned status ${response.status}`);
  }
}

// Run the script
uploadToPinata(); 