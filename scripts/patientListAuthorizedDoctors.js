const Web3 = require('web3');
const PatientControlledRecords = require('../build/contracts/PatientControlledRecords.json');

/**
 * Script for patients to list all doctors who have access to their medical records
 * 
 * Usage: node scripts/patientListAuthorizedDoctors.js <patient-private-key>
 */

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545'; // Replace with your provider

async function listAuthorizedDoctors() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
      console.error('Usage: node scripts/patientListAuthorizedDoctors.js <patient-private-key>');
      process.exit(1);
    }
    
    const patientPrivateKey = args[0];
    
    // Initialize web3
    const web3 = new Web3(WEB3_PROVIDER);
    
    // Get the patient's account from private key
    const patientAccount = web3.eth.accounts.privateKeyToAccount(patientPrivateKey);
    web3.eth.accounts.wallet.add(patientAccount);
    const patientAddress = patientAccount.address;
    
    console.log('\n========= AUTHORIZED DOCTORS LIST =========');
    console.log(`Patient: ${patientAddress}`);
    
    // Get the network ID
    const networkId = await web3.eth.net.getId();
    
    // Get the deployed contract address from the build JSON
    const deployedNetwork = PatientControlledRecords.networks[networkId];
    if (!deployedNetwork) {
      console.error(`\n❌ ERROR: Contract not deployed on network ${networkId}`);
      process.exit(1);
    }
    
    // Create contract instance
    const contractAddress = deployedNetwork.address;
    const patientRecords = new web3.eth.Contract(
      PatientControlledRecords.abi,
      contractAddress
    );
    
    console.log(`\nConnecting to Medical Records system at: ${contractAddress}`);
    
    // Get all accounts to check which ones are authorized doctors
    const allAccounts = await web3.eth.getAccounts();
    
    console.log('\nScanning the network for authorized doctors...');
    
    const authorizedDoctors = [];
    
    // For each account, check if it's an authorized doctor with access to this patient
    for (const account of allAccounts) {
      // First check if the account is a doctor at all
      const isDoctor = await patientRecords.methods.isAuthorizedDoctor(account).call();
      
      if (isDoctor) {
        // Then check if this doctor has access to this patient's records
        const hasAccess = await patientRecords.methods.hasDoctorAccess(patientAddress, account).call();
        
        if (hasAccess) {
          authorizedDoctors.push(account);
        }
      }
    }
    
    // Display results
    console.log(`\nFound ${authorizedDoctors.length} doctors with access to your medical records:`);
    
    if (authorizedDoctors.length === 0) {
      console.log('\nNo doctors currently have permission to upload or view your medical records.');
    } else {
      console.log('\n=== DOCTORS WITH ACCESS TO YOUR RECORDS ===');
      
      for (let i = 0; i < authorizedDoctors.length; i++) {
        const doctor = authorizedDoctors[i];
        console.log(`\n[Doctor ${i + 1}]`);
        console.log(`Address: ${doctor}`);
        console.log(`Permissions: Can upload and view your medical records`);
        console.log(`To revoke access: npm run patient-remove-uploader ${doctor} YOUR_PRIVATE_KEY`);
      }
    }
    
    console.log('\n=== ACCESS MANAGEMENT COMMANDS ===');
    console.log('To authorize a new doctor:');
    console.log('npm run patient-authorize-uploader <DOCTOR_ADDRESS> YOUR_PRIVATE_KEY');
    console.log('\nTo revoke a doctor\'s access:');
    console.log('npm run patient-remove-uploader <DOCTOR_ADDRESS> YOUR_PRIVATE_KEY');
    
  } catch (error) {
    console.error('\n❌ ERROR listing authorized doctors:', error.message);
    process.exit(1);
  }
}

// Run the script
listAuthorizedDoctors(); 