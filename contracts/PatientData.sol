// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0; // Use a recent stable version

/**
 * @title PatientData
 * @dev Stores patient-related identifiers publicly.
 */
contract PatientData {

    // --- State Variables ---

    // Public visibility automatically creates getter functions (patientID(), hashID(), cid())
    string public patientID;
    string public hashID;
    string public cid; // Content Identifier (e.g., for IPFS)

    // --- Events ---

    // Event emitted when data is updated
    event DataStored(
        string patientID,
        string hashID,
        string cid,
        address indexed updater // Address that called the function
    );

    // --- Functions ---

    /**
     * @dev Stores or updates the patient data.
     * @param _patientID The ID of the patient.
     * @param _hashID The hash associated with the patient's data.
     * @param _cid The Content Identifier (e.g., IPFS CID) for related files.
     */
    function storeData(string memory _patientID, string memory _hashID, string memory _cid) public {
        patientID = _patientID;
        hashID = _hashID;
        cid = _cid;

        // Emit an event to log the change off-chain
        emit DataStored(_patientID, _hashID, _cid, msg.sender);
    }

    // --- Getter Functions (Optional - Already created by 'public') ---
    // Solidity automatically creates these because the variables are public:
    // function getPatientID() public view returns (string memory) { return patientID; }
    // function getHashID() public view returns (string memory) { return hashID; }
    // function getCID() public view returns (string memory) { return cid; }
}