// Script to import patient data from JSON to Firebase
const fs = require('fs');
const path = require('path');
const firebaseConfig = require('../config/firebaseConfig');

/**
 * Main function to import patient data
 * @param {string} jsonPath - Path to the JSON file with patient data
 */
async function importPatients(jsonPath) {
  try {
    console.log(`\n======== PATIENT DATA IMPORT ========`);
    console.log(`Reading from: ${jsonPath}`);
    
    // Check if file exists
    if (!fs.existsSync(jsonPath)) {
      console.error(`Error: File ${jsonPath} does not exist`);
      process.exit(1);
    }
    
    // Read and parse the JSON file
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    let patientsData;
    
    try {
      patientsData = JSON.parse(rawData);
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError.message);
      process.exit(1);
    }
    
    // Validate JSON structure
    if (!patientsData.patients || !Array.isArray(patientsData.patients)) {
      console.error('Invalid JSON format: Missing "patients" array');
      process.exit(1);
    }
    
    console.log(`Found ${patientsData.patients.length} patients in the file`);
    
    // Import patients to Firebase
    console.log('\nImporting to Firebase...');
    const result = await firebaseConfig.importPatientsFromJson(patientsData);
    
    if (result.success) {
      console.log('\n✅ SUCCESS: Patients imported successfully');
      console.log('\nResults:');
      result.results.forEach((r, index) => {
        if (r.success) {
          console.log(`  ${index + 1}. Patient ID: ${r.patientId} - Success`);
        } else {
          console.log(`  ${index + 1}. Error: ${r.error}`);
        }
      });
    } else {
      console.error(`\n❌ ERROR: Failed to import patients: ${result.error}`);
    }
    
  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Process command-line arguments
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('\nUsage: npm run import-patients <path-to-json-file>');
    console.log('Example: npm run import-patients ./data/patients.json\n');
    console.log('The JSON file should have the following format:');
    console.log(`{
  "patients": [
    {
      "patientId": "1234567890",
      "aadharNumber": "123456789012",
      "fullName": "John Doe",
      "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
      "email": "john@example.com",
      "phoneNumber": "+91-9876543210",
      "privateKey": "0x..."
    },
    ...
  ]
}`);
    process.exit(0);
  }
  
  const jsonPath = path.resolve(args[0]);
  importPatients(jsonPath);
}

// Run the script
main(); 
 