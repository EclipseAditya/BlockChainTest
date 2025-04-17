const Web3 = require('web3');
const PatientControlledRecords = require('../build/contracts/PatientControlledRecords.json');

/**
 * Script to check which patients have granted access to a specific doctor
 * 
 * Usage: node scripts/doctorCheckAccess.js <doctor-address> [private-key]
 * If private key is provided, it uses that account to check. Otherwise, it uses the doctor's address directly.
 */

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545'; // Replace with your provider

async function doctorCheckAccess() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
      console.error('Usage: node scripts/doctorCheckAccess.js <doctor-address> [private-key]');
      process.exit(1);
    }
    
    const doctorAddress = args[0];
    const privateKey = args.length > 1 ? args[1] : null;
    
    // Validate doctor address
    const web3 = new Web3(WEB3_PROVIDER);
    if (!Web3.utils.isAddress(doctorAddress)) {
      console.error(`Invalid doctor address: ${doctorAddress}`);
      process.exit(1);
    }
    
    // Setup account if private key provided
    let accountAddress = doctorAddress;
    if (privateKey) {
      const account = web3.eth.accounts.privateKeyToAccount(privateKey);
      web3.eth.accounts.wallet.add(account);
      accountAddress = account.address;
      console.log(`Using account: ${accountAddress}`);
    }
    
    console.log(`\n========= DOCTOR ACCESS CHECKER =========`);
    console.log(`Checking access for doctor: ${doctorAddress}`);
    
    // Get the network ID
    const networkId = await web3.eth.net.getId();
    
    // Get the deployed contract address from the build JSON
    const deployedNetwork = PatientControlledRecords.networks[networkId];
    if (!deployedNetwork) {
      console.error(`Contract not deployed on network ${networkId}`);
      process.exit(1);
    }
    
    // Create contract instance
    const contractAddress = deployedNetwork.address;
    const patientRecords = new web3.eth.Contract(
      PatientControlledRecords.abi,
      contractAddress
    );
    
    console.log(`Contract address: ${contractAddress}`);
    
    // Check if the doctor is authorized in the system
    const isAuthorized = await patientRecords.methods.isAuthorizedDoctor(doctorAddress).call();
    if (!isAuthorized) {
      console.error(`\n❌ Doctor ${doctorAddress} is not authorized in the system.`);
      console.error('This doctor must first be verified and authorized by the contract owner.');
      console.error('Use: npm run authorize-doctor <doctor-address> <owner-private-key>');
      process.exit(1);
    }
    
    console.log(`\n✅ Doctor ${doctorAddress} is an authorized healthcare provider.`);
    
    // Get all accounts to check which ones have granted access
    const accounts = await web3.eth.getAccounts();
    console.log(`\nChecking access across ${accounts.length} blockchain accounts...`);
    
    const authorizedPatients = [];
    
    // Check each account for doctor access
    for (const patientAddress of accounts) {
      try {
        const hasAccess = await patientRecords.methods.hasDoctorAccess(patientAddress, doctorAddress).call();
        if (hasAccess) {
          // Get record count for this patient
          try {
            const recordCount = await patientRecords.methods.getPatientRecordCount(patientAddress).call({ from: accountAddress });
            authorizedPatients.push({
              address: patientAddress,
              recordCount: parseInt(recordCount)
            });
          } catch (error) {
            // If error getting record count, still add patient but with unknown record count
            authorizedPatients.push({
              address: patientAddress,
              recordCount: "Unknown",
              error: error.message
            });
          }
        }
      } catch (error) {
        console.error(`Error checking access for ${patientAddress}: ${error.message}`);
      }
    }
    
    // Display results
    console.log(`\n========= ACCESS SUMMARY =========`);
    console.log(`Doctor has access to ${authorizedPatients.length} patient accounts:`);
    
    if (authorizedPatients.length === 0) {
      console.log('\nNo patients have granted this doctor access to their records.');
      console.log('\nPatients need to grant access using:');
      console.log(`npm run patient-authorize-uploader ${doctorAddress} <PATIENT_PRIVATE_KEY>`);
    } else {
      // Display patients with access
      console.log('\nAuthorized Patients:');
      authorizedPatients.forEach((patient, index) => {
        console.log(`\n${index + 1}. Patient Address: ${patient.address}`);
        console.log(`   Record Count: ${patient.recordCount}`);
        
        if (patient.error) {
          console.log(`   Note: Error fetching complete data - ${patient.error}`);
        }
      });
      
      console.log('\nTo add records for these patients, use:');
      console.log(`npm run add-record <json-file> <doctor-private-key>`);
    }
    
  } catch (error) {
    console.error('Error checking doctor access:', error.message);
    process.exit(1);
  }
}

// Run the script
doctorCheckAccess(); 
 