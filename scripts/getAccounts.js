const Web3 = require('web3');
const PatientControlledRecords = require('../build/contracts/PatientControlledRecords.json');

/**
 * Helper script to get all accounts and contract details from the blockchain
 * 
 * Usage: node scripts/getAccounts.js
 */

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545'; // Replace with your provider

async function getAccounts() {
  try {
    console.log('\n========= BLOCKCHAIN ACCOUNTS =========');
    
    // Initialize web3 with the provider
    const web3 = new Web3(WEB3_PROVIDER);
    
    // Get all accounts
    const accounts = await web3.eth.getAccounts();
    
    console.log(`Connected to: ${WEB3_PROVIDER}`);
    console.log(`Found ${accounts.length} accounts:`);
    
    // Display all accounts with balances
    for (let i = 0; i < accounts.length; i++) {
      const balance = await web3.eth.getBalance(accounts[i]);
      const balanceEth = web3.utils.fromWei(balance, 'ether');
      console.log(`Account ${i}: ${accounts[i]} (${balanceEth} ETH)`);
    }
    
    // Get network ID
    const networkId = await web3.eth.net.getId();
    console.log(`\nCurrent Network ID: ${networkId}`);
    
    // Check PatientControlledRecords contract
    console.log('\n========= PatientControlledRecords CONTRACT =========');
    
    // Get the deployed contract address
    const pcDeployedNetwork = PatientControlledRecords.networks[networkId];
    if (!pcDeployedNetwork) {
      console.log(`PatientControlledRecords not deployed on network ${networkId}`);
    } else {
      // Create a contract instance
      const pcContractAddress = pcDeployedNetwork.address;
      const patientRecords = new web3.eth.Contract(
        PatientControlledRecords.abi,
        pcContractAddress
      );
      
      console.log(`Contract Address: ${pcContractAddress}`);
      
      // Get contract owner
      try {
        const owner = await patientRecords.methods.getOwner().call();
        console.log(`Contract Owner: ${owner}`);
        
        // Find owner in accounts list
        const ownerIndex = accounts.findIndex(acc => acc.toLowerCase() === owner.toLowerCase());
        if (ownerIndex >= 0) {
          console.log(`Owner is Account ${ownerIndex}`);
        }
      } catch (error) {
        console.log('Could not get contract owner:', error.message);
      }
      
      // Get list of authorized doctors
      try {
        console.log('\nAuthorized Doctors:');
        let foundDoctors = false;
        
        for (let i = 0; i < accounts.length; i++) {
          const isAuthorized = await patientRecords.methods.isAuthorizedDoctor(accounts[i]).call();
          if (isAuthorized) {
            console.log(`- ${accounts[i]}`);
            console.log(`  (Account ${i})`);
            foundDoctors = true;
          }
        }
        
        if (!foundDoctors) {
          console.log('No authorized doctors found');
        }
      } catch (error) {
        console.log('Could not check authorized doctors:', error.message);
      }
    }
    
    // Print sample commands
    console.log('\n-----------------------------');
    console.log('Sample commands you can run:');
    console.log('-----------------------------');
    
    // Authorize doctor command
    if (accounts.length > 1) {
      console.log(`\nAuthorize doctor (using account[1] as doctor):`);
      console.log(`npm run authorize-doctor ${accounts[1]} <owner-private-key>`);
    }
    
    // Add records command using account[2] as patient
    if (accounts.length > 2) {
      console.log(`\nAdd medical records (using account[2] as patient):`);
      console.log(`npm run add-record ./examples/patient_records.json <doctor-private-key>`);
      console.log(`\n(Make sure to update the patientAddress in examples/patient_records.json to: ${accounts[2]})`);
    }
    
  } catch (error) {
    console.error('Error getting accounts:', error.message);
  }
}

// Run the script
getAccounts(); 