# Medical Records Blockchain

A blockchain-based medical records system that allows doctors to securely add medical records for patients. Each record includes a SHA256 hash for data integrity and a Content Identifier (CID) for retrieving the actual data from storage like IPFS.

## Key Features

- Smart contract for storing medical records with patient-doctor relationships
- Each record contains both SHA256 hash and CID references
- Doctor authorization system 
- Privacy controls - only authorized doctors or the patient can access records
- Automated scripts for adding and retrieving records

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/medical-records-blockchain.git
   cd medical-records-blockchain
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start a local blockchain (Ganache):
   ```
   ganache-cli -p 7545
   ```
   Or use Ganache GUI set to port 7545.

4. Deploy the contracts:
   ```
   truffle migrate
   ```

## Automated Scripts

This project includes several scripts to automate the process of managing medical records.

### 1. Authorizing Doctors

Before doctors can add or view records, they must be authorized by the contract owner:

```
npm run authorize-doctor <doctor-address> <owner-private-key>
```

Example:
```
npm run authorize-doctor 0x7243a00B75beaA6998ea43ffeD46dE7914931A4d 0x1234...
```

### 2. Revoking Doctor Authorization

To revoke a doctor's access to the system:

```
npm run revoke-doctor <doctor-address> <owner-private-key>
```

Example:
```
npm run revoke-doctor 0x7243a00B75beaA6998ea43ffeD46dE7914931A4d 0x1234...
```

### 3. Adding Medical Records (for Doctors)

Doctors can add medical records from a JSON file:

```
npm run add-record <path-to-json-file> <doctor-private-key>
```

Example:
```
npm run add-record examples/patient_records.json 0x1234...
```

The JSON file should be in this format:
```json
{
  "patientAddress": "0xPatientWalletAddress",
  "records": [
    {
      "recordID": "REC12345",
      "recordType": "Blood Test",
      "sha256Hash": "0x8d87c72ea6d9577d5721e375f4c84f979580dcb3f5a4254ce612665d8873fd5e",
      "cid": "QmX6j9DHcPhgBcBtZsuRkfmk8iAboKwLwfgvwZFWEJ7VTo"
    },
    ...
  ]
}
```

### 4. Retrieving Medical Records

Records can be retrieved by either:

**As a patient** (viewing your own records):
```
npm run get-records <patient-private-key>
```

**As a doctor** (viewing a patient's records):
```
npm run get-records <doctor-private-key> <patient-address>
```

Records will be displayed in the console and saved to a JSON file.

## Smart Contract Functions

- `authorizeDoctor(address)`: Authorize a doctor to add/view records (owner only)
- `revokeDoctor(address)`: Revoke a doctor's authorization (owner only)
- `addMedicalRecord(patientAddress, recordID, recordType, sha256Hash, cid)`: Add a medical record
- `getPatientRecords(patientAddress)`: Get all records for a patient
- `getPatientRecordCount(patientAddress)`: Get count of records for a patient
- `isAuthorizedDoctor(address)`: Check if an address is an authorized doctor

## Testing

Run the tests to verify the contract works correctly:

```
npm test
```

## Security Notes

- Private keys should be kept secure and never shared
- For a production environment, use a secure provider and not a local blockchain
- Consider using a more sophisticated access control system for real medical data
- In production, all data referenced by CIDs should be encrypted 