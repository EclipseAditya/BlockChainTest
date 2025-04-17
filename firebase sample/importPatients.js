// Import utility to import patients from test.json to Firebase
import fs from 'fs';
import path from 'path';
import { importPatientsFromJson } from './firebaseConfig.js';

const main = async () => {
  try {
    // Read the test.json file
    const jsonPath = path.resolve('./test.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const patientsData = JSON.parse(rawData);

    console.log(`Found ${patientsData.patients.length} patients in test.json`);
    
    // Import the data to Firebase
    const result = await importPatientsFromJson(patientsData);
    
    if (result.success) {
      console.log('Successfully imported patients to Firebase:');
      console.log(result.results);
    } else {
      console.error('Error importing patients:', result.error);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
};

// Execute the main function
main().catch(console.error);

// Instructions to run this script:
// 1. Make sure Firebase is properly configured in firebaseConfig.js
// 2. Install dependencies: npm install firebase fs path
// 3. Run with Node.js: node importPatients.js 