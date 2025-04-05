// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MedicalRecords
 * @dev Stores and manages patient medical records with authorized doctor access
 */
contract MedicalRecords {
    // Contract owner (hospital administrator)
    address private owner;
    
    // Patient record structure
    struct PatientRecord {
        string recordID;          // Unique identifier for the record
        string recordType;        // Type of medical record (e.g., "Lab Result", "Prescription")
        string sha256Hash;        // SHA256 hash of the record content
        string cid;               // Content identifier (IPFS or similar)
        address doctorAddress;    // Which doctor created this record
        uint256 timestamp;        // When the record was created
    }
    
    // Links patients to their records
    mapping(address => PatientRecord[]) private patientRecords;
    
    // Authorized doctors
    mapping(address => bool) private authorizedDoctors;
    
    // Events
    event RecordAdded(address indexed patient, string recordID, address indexed doctor);
    event DoctorAuthorized(address indexed doctor);
    event DoctorRevoked(address indexed doctor);
    
    // Constructor - sets the deployer as owner
    constructor() {
        owner = msg.sender;
    }
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }
    
    modifier onlyAuthorizedDoctor() {
        require(authorizedDoctors[msg.sender], "Not an authorized doctor");
        _;
    }
    
    // Doctor authorization management
    function authorizeDoctor(address doctorAddress) public onlyOwner {
        authorizedDoctors[doctorAddress] = true;
        emit DoctorAuthorized(doctorAddress);
    }
    
    function revokeDoctor(address doctorAddress) public onlyOwner {
        authorizedDoctors[doctorAddress] = false;
        emit DoctorRevoked(doctorAddress);
    }
    
    /**
     * @dev Add a medical record for a patient
     * @param patientAddress The wallet address of the patient
     * @param recordID Unique identifier for this record
     * @param recordType Type of medical record
     * @param sha256Hash SHA256 hash of the record content
     * @param cid Content identifier pointing to where the actual data is stored
     */
    function addMedicalRecord(
        address patientAddress,
        string memory recordID,
        string memory recordType,
        string memory sha256Hash,
        string memory cid
    ) public onlyAuthorizedDoctor {
        
        // Create the new record
        PatientRecord memory newRecord = PatientRecord({
            recordID: recordID,
            recordType: recordType,
            sha256Hash: sha256Hash,
            cid: cid,
            doctorAddress: msg.sender,
            timestamp: block.timestamp
        });
        
        // Add the record to the patient's records array
        patientRecords[patientAddress].push(newRecord);
        
        // Emit event for tracking
        emit RecordAdded(patientAddress, recordID, msg.sender);
    }
    
    /**
     * @dev Get all records for a patient
     * @param patientAddress The wallet address of the patient
     */
    function getPatientRecords(address patientAddress) 
        public view 
        returns (PatientRecord[] memory) {
        
        // Allow access only if sender is the patient or an authorized doctor
        require(
            msg.sender == patientAddress || 
            authorizedDoctors[msg.sender], 
            "Not authorized to view these records"
        );
        
        return patientRecords[patientAddress];
    }
    
    /**
     * @dev Get the number of records for a patient
     * @param patientAddress The wallet address of the patient
     */
    function getPatientRecordCount(address patientAddress) 
        public view 
        returns (uint256) {
        
        // Allow access only if sender is the patient or an authorized doctor
        require(
            msg.sender == patientAddress || 
            authorizedDoctors[msg.sender], 
            "Not authorized to view record count"
        );
        
        return patientRecords[patientAddress].length;
    }
    
    /**
     * @dev Check if an address is an authorized doctor
     * @param doctorAddress The address to check
     */
    function isAuthorizedDoctor(address doctorAddress) public view returns (bool) {
        return authorizedDoctors[doctorAddress];
    }
    
    /**
     * @dev Get contract owner address
     */
    function getOwner() public view returns (address) {
        return owner;
    }
} 