// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title PatientControlledRecords
 * @dev Stores and manages patient medical records with patient-controlled doctor access
 */
contract PatientControlledRecords {
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
    
    // Global doctor authorization by admin (first level of access)
    mapping(address => bool) private authorizedDoctors;
    
    // Patient-specific doctor authorization (patient => doctor => access)
    mapping(address => mapping(address => bool)) private patientDoctorAccess;
    
    // Events
    event RecordAdded(address indexed patient, string recordID, address indexed doctor);
    event DoctorAuthorized(address indexed doctor);
    event DoctorRevoked(address indexed doctor);
    event PatientGrantedAccess(address indexed patient, address indexed doctor);
    event PatientRevokedAccess(address indexed patient, address indexed doctor);
    
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
    
    modifier onlyPatientOrAuthorizedDoctor(address patientAddress) {
        require(
            msg.sender == patientAddress || 
            (authorizedDoctors[msg.sender] && patientDoctorAccess[patientAddress][msg.sender]),
            "Not authorized to access this patient's records"
        );
        _;
    }
    
    // Doctor authorization management by admin
    function authorizeDoctor(address doctorAddress) public onlyOwner {
        authorizedDoctors[doctorAddress] = true;
        emit DoctorAuthorized(doctorAddress);
    }
    
    function revokeDoctor(address doctorAddress) public onlyOwner {
        authorizedDoctors[doctorAddress] = false;
        emit DoctorRevoked(doctorAddress);
    }
    
    // Patient-controlled doctor access management
    function grantAccessToDoctor(address doctorAddress) public {
        require(authorizedDoctors[doctorAddress], "Doctor is not in the authorized doctors list");
        patientDoctorAccess[msg.sender][doctorAddress] = true;
        emit PatientGrantedAccess(msg.sender, doctorAddress);
    }
    
    function revokeAccessFromDoctor(address doctorAddress) public {
        patientDoctorAccess[msg.sender][doctorAddress] = false;
        emit PatientRevokedAccess(msg.sender, doctorAddress);
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
        // Require that the patient has granted access to this doctor
        require(patientDoctorAccess[patientAddress][msg.sender], 
                "Patient has not granted you access to add records");
        
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
        onlyPatientOrAuthorizedDoctor(patientAddress)
        returns (PatientRecord[] memory) {
        
        return patientRecords[patientAddress];
    }
    
    /**
     * @dev Get the number of records for a patient
     * @param patientAddress The wallet address of the patient
     */
    function getPatientRecordCount(address patientAddress) 
        public view 
        onlyPatientOrAuthorizedDoctor(patientAddress)
        returns (uint256) {
        
        return patientRecords[patientAddress].length;
    }
    
    /**
     * @dev Check if a doctor has access to a specific patient's records
     * @param patientAddress The patient's address
     * @param doctorAddress The doctor's address
     */
    function hasDoctorAccess(address patientAddress, address doctorAddress) public view returns (bool) {
        return authorizedDoctors[doctorAddress] && patientDoctorAccess[patientAddress][doctorAddress];
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