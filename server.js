const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { execSync } = require('child_process');
const crypto = require('crypto');
const util = require('util');
const { writeFile } = require('fs').promises;
const mkdirp = require('mkdirp');
const firebaseDb = require('./config/firebaseConfig');
const { doc, updateDoc } = require('firebase/firestore');
const admin = require('firebase-admin');
const accountPool = require('./config/accountPool');
const walletGenerator = require('./config/walletGenerator');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware for parsing JSON and urlencoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Set up routes
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Medical Records Blockchain</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            color: #333;
          }
          h1 {
            color: #3498db;
          }
          .card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 20px;
            margin-bottom: 20px;
          }
          .nav-links {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
          }
          .nav-link {
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            text-decoration: none;
          }
          .nav-link:hover {
            background-color: #2980b9;
          }
          .nav-link.disabled {
            background-color: #95a5a6;
            cursor: not-allowed;
          }
          .primary-button {
            display: inline-block;
            background-color: #2ecc71;
            color: white;
            padding: 15px 30px;
            border-radius: 4px;
            text-decoration: none;
            font-weight: bold;
            margin-top: 20px;
            text-align: center;
          }
          .primary-button:hover {
            background-color: #27ae60;
          }
        </style>
      </head>
      <body>
        <h1>Medical Records Blockchain</h1>
        
        <div class="card">
          <h2>Doctor Portal</h2>
          <p>Manage patient records, check access permissions, and upload medical files securely to the blockchain</p>
          <a href="/doctor" class="primary-button">Go to Doctor Dashboard</a>
          <div class="nav-links">
            <a href="/doctor/patients" class="nav-link">Check Patient Access</a>
            <a href="/doctor/uploads" class="nav-link">Upload Medical Records</a>
          </div>
        </div>
        
        <div class="card">
          <h2>Patient Portal</h2>
          <p>Register, view, and manage access to your medical records</p>
          <a href="/patient/login.html" class="primary-button">Access Patient Portal</a>
          <div class="nav-links">
            <a href="/patient/login" class="nav-link">Register with Aadhaar</a>
            <a href="/patient/login.html" class="nav-link">Login with Patient ID</a>
            <a href="#" class="nav-link disabled">Manage Doctor Access</a>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, 'uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      mkdirp.sync(uploadsDir);
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  }
});

const upload = multer({ storage: storage });

// API endpoint for uploading medical records
app.post('/api/upload', upload.single('medicalFile'), async (req, res) => {
  try {
    // Extract form data
    const { doctorWallet, doctorPrivateKey, patientId, patientWallet, diagnosisDate, recordType } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate record ID
    const recordId = generateRecordId(recordType, diagnosisDate);
    
    // Create temporary input JSON for uploadToPinata.js
    const uploadsDir = path.join(__dirname, 'uploads');
    const inputJsonPath = path.join(uploadsDir, `${patientId}_input.json`);
    const outputJsonPath = path.join(uploadsDir, `${patientId}_output.json`);
    
    const inputData = {
      patientID: patientId,
      files: [
        {
          recordID: recordId,
          recordType: recordType,
          filePath: file.path
        }
      ]
    };
    
    // Write input JSON file
    await writeFile(inputJsonPath, JSON.stringify(inputData, null, 2));
    
    let ipfsResult, blockchainResult;
    let txHash = null;
    
    try {
      // Step 1: Run uploadToPinata.js script to upload to IPFS
      console.log('Uploading to IPFS...');
      execSync(`node scripts/uploadToPinata.js ${inputJsonPath} ${outputJsonPath}`);
      
      // Check if the output file exists
      if (!fs.existsSync(outputJsonPath)) {
        return res.status(500).json({ error: 'Failed to upload to IPFS' });
      }
      
      // Read the output JSON
      const outputData = JSON.parse(fs.readFileSync(outputJsonPath, 'utf8'));
      
      // Check if any records were processed
      if (!outputData.records || outputData.records.length === 0) {
        return res.status(500).json({ error: 'No records were processed during IPFS upload' });
      }
      
      ipfsResult = outputData;
      const record = outputData.records[0];
      
      // Step 2: Add to blockchain if doctor's private key was provided
      if (doctorPrivateKey && patientWallet) {
        console.log('Adding to blockchain...');
        
        // Create a temporary blockchain input JSON
        const blockchainInputPath = path.join(uploadsDir, `${patientId}_blockchain_input.json`);
        const blockchainData = {
          patientAddress: patientWallet,
          records: [
            {
              recordID: record.recordID,
              recordType: record.recordType,
              sha256Hash: record.sha256Hash,
              cid: record.cid
            }
          ]
        };
        
        await writeFile(blockchainInputPath, JSON.stringify(blockchainData, null, 2));
        
        try {
          // Run addMedicalRecord.js script to add to blockchain
          const addToBlockchainOutput = execSync(
            `node scripts/addMedicalRecord.js ${blockchainInputPath} ${doctorPrivateKey}`, 
            { encoding: 'utf8' }
          );
          
          console.log('Blockchain upload output:', addToBlockchainOutput);
          
          // Extract transaction hash from output
          const txHashMatch = addToBlockchainOutput.match(/Transaction hash: (0x[a-fA-F0-9]+)/);
          if (txHashMatch && txHashMatch[1]) {
            txHash = txHashMatch[1];
          }
          
          blockchainResult = "Success";
        } catch (blockchainError) {
          console.error('Error adding to blockchain:', blockchainError);
          blockchainResult = `Error: ${blockchainError.message}`;
        }
      }
      
      // Return success response with IPFS and blockchain details
      return res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          patientId: patientId,
          recordId: record.recordID,
          recordType: record.recordType,
          sha256Hash: record.sha256Hash,
          cid: record.cid,
          blockchainTx: txHash || "Not added to blockchain",
          blockchainResult: blockchainResult || "Not attempted"
        }
      });
      
    } catch (error) {
      console.error('Error during upload process:', error);
      return res.status(500).json({ 
        error: 'Failed to process upload',
        details: error.toString()
      });
    }
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error', details: error.toString() });
  }
});

// API endpoint for checking doctor's patient access
app.post('/api/doctor/patients', async (req, res) => {
  try {
    const { doctorWallet, doctorPrivateKey } = req.body;
    
    if (!doctorWallet) {
      return res.status(400).json({ error: 'Doctor wallet address is required' });
    }
    
    // Create a temporary file to store the result
    const tempOutputPath = path.join(__dirname, 'uploads', `doctor_patients_${Date.now()}.json`);
    
    try {
      // Run doctorCheckAccess.js script to check patient access
      const cmdArgs = doctorPrivateKey 
        ? `${doctorWallet} ${doctorPrivateKey}`
        : doctorWallet;
        
      const scriptOutput = execSync(
        `node scripts/doctorCheckAccess.js ${cmdArgs}`,
        { encoding: 'utf8' }
      );
      
      console.log('Doctor check access output:', scriptOutput);
      
      // Parse the output to extract patient information
      const patients = [];
      const lines = scriptOutput.split('\n');
      let currentPatient = null;
      
      for (const line of lines) {
        // Look for lines with patient addresses
        if (line.includes('Patient Address:')) {
          const address = line.split('Patient Address:')[1].trim();
          currentPatient = { address, recordCount: 0 };
          patients.push(currentPatient);
        }
        else if (currentPatient && line.includes('Record Count:')) {
          const count = line.split('Record Count:')[1].trim();
          currentPatient.recordCount = isNaN(parseInt(count)) ? count : parseInt(count);
        }
        else if (currentPatient && line.includes('Note: Error')) {
          currentPatient.error = line.trim();
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Successfully retrieved patient access',
        patients
      });
      
    } catch (error) {
      console.error('Error checking doctor patient access:', error);
      return res.status(500).json({ 
        error: 'Failed to check patient access',
        details: error.toString()
      });
    }
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error', details: error.toString() });
  }
});

// API endpoint for getting doctor details
app.get('/api/doctor/details', (req, res) => {
  // Return mock doctor details
  const doctorDetails = {
    name: "Dr. Aisha Sharma",
    specialty: "Cardiologist",
    hospital: "City Medical Center",
    wallet: "0x01E666BC2F9EDA707C04c1bBcDF01973595c5B58",
    authorized: true
  };
  
  res.json(doctorDetails);
});

// Register a new patient
app.post('/api/patient/register', async (req, res) => {
  try {
    const { fullName, email, phoneNumber, gender, dob, bloodGroup, aadharNumber } = req.body;

    // Generate a unique patient ID (using timestamp + random str)
    const patientId = `PAT${Date.now()}${Math.random().toString(36).substring(2, 7)}`;

    console.log(`Creating new patient with ID: ${patientId}`);

    // Create a new blockchain wallet for the patient using wallet generator
    console.log('Creating wallet for patient...');
    const walletInfo = await walletGenerator.createWallet(patientId);

    // Create patient object
    const patient = {
      patientId,
      fullName: fullName || 'Patient',
      phoneNumber: phoneNumber || '',
      email: email || '',
      gender: gender || '',
      dob: dob || '',
      bloodGroup: bloodGroup || '',
      aadharNumber: aadharNumber || '',
      walletAddress: walletInfo.address, 
      privateKey: walletInfo.privateKey,
      registrationDate: new Date().toISOString(),
      status: 'registered'
    };

    // Save to Firebase
    let saveResult = false;
    try {
      saveResult = await firebaseDb.savePatient(patient);
      console.log('Patient saved to Firebase');
    } catch (firebaseError) {
      console.error('Firebase error, falling back to local storage:', firebaseError);
    }

    // If Firebase save fails, save locally
    if (!saveResult) {
      const patientsDir = path.join(__dirname, 'data/patients');
      if (!fs.existsSync(patientsDir)) {
        fs.mkdirSync(patientsDir, { recursive: true });
      }
      
      const patientFilePath = path.join(patientsDir, `${patientId}.json`);
      fs.writeFileSync(patientFilePath, JSON.stringify(patient, null, 2));
      console.log(`Patient saved locally to ${patientFilePath}`);
    }

    // Return success with patient details (excluding private key)
    res.status(201).json({ 
      status: 'success',
      patientId: patient.patientId,
      walletAddress: patient.walletAddress,
      fullName: patient.fullName,
      registrationDate: patient.registrationDate
    });
  } catch (error) {
    console.error('Error in patient registration:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Get patient by ID
app.get('/api/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Get patient data (first try Firebase, then local)
    let patientData;
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      patientData = patientResult.data;
    } else {
      // Try local file
      const patientFilePath = path.join(patientsDir, `${patientId}.json`);
      if (!fs.existsSync(patientFilePath)) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
    }
    
    // Return patient data including privateKey for blockchain operations
    return res.status(200).json({
      patientId: patientId,
      fullName: patientData.fullName,
      walletAddress: patientData.walletAddress,
      email: patientData.email || '',
      phoneNumber: patientData.phoneNumber || '',
      age: patientData.age || '',
      gender: patientData.gender || '',
      bloodGroup: patientData.bloodGroup || '',
      registrationDate: patientData.registrationDate,
      privateKey: patientData.privateKey // Include private key for blockchain operations
    });
  } catch (error) {
    console.error('Error fetching patient data:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// API endpoint for setting patient password
app.post('/api/patient/set-password', async (req, res) => {
  try {
    const { patientId, password } = req.body;
    
    if (!patientId || !password) {
      return res.status(400).json({ error: 'Patient ID and password are required' });
    }
    
    // Check if patient exists in Firebase
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      // Update password in Firebase
      const updateResult = await firebaseDb.updatePatientPassword(patientId, password);
      
      if (!updateResult.success) {
        throw new Error(`Failed to update password: ${updateResult.error}`);
      }
    }
    
    // Also update password in local file if it exists
    const patientFilePath = path.join(patientsDir, `${patientId}.json`);
    if (fs.existsSync(patientFilePath)) {
      const patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
      patientData.password = password;
      patientData.lastUpdated = new Date().toISOString();
      await writeFile(patientFilePath, JSON.stringify(patientData, null, 2));
    }
    
    return res.status(200).json({
      success: true,
      message: 'Password set successfully'
    });
  } catch (error) {
    console.error('Error setting password:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// API endpoint to login with patient ID and password
app.post('/api/patient/login', async (req, res) => {
  try {
    const { patientId, password } = req.body;
    
    if (!patientId || !password) {
      return res.status(400).json({ error: 'Patient ID and password are required' });
    }
    
    // Try to get patient from Firebase
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      const patientData = patientResult.data;
      
      // Check if password matches
      if (patientData.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Update last login time in Firebase
      const patientRef = doc(firebaseDb.db, 'patients', patientId);
      await updateDoc(patientRef, {
        lastLogin: new Date().toISOString()
      });
      
      return res.status(200).json({
        success: true,
        patientId: patientId,
        fullName: patientData.fullName,
        walletAddress: patientData.walletAddress
      });
    }
    
    // If not in Firebase, try local file
    const patientFilePath = path.join(patientsDir, `${patientId}.json`);
    if (!fs.existsSync(patientFilePath)) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
    
    // Check if password matches
    if (patientData.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    patientData.lastLogin = new Date().toISOString();
    await writeFile(patientFilePath, JSON.stringify(patientData, null, 2));
    
    return res.status(200).json({
      success: true,
      patientId: patientId,
      fullName: patientData.fullName,
      walletAddress: patientData.walletAddress
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Route for patient direct login
app.get('/patient/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient', 'login.html'));
});

// Routes for patient portal
app.get('/patient/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient', 'register', 'index.html'));
});

app.get('/patient/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient', 'login.html'));
});

app.get('/patient/confirmation', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient', 'confirmation', 'index.html'));
});

app.get('/patient/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient', 'dashboard', 'index.html'));
});

app.get('/patient/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient', 'settings', 'index.html'));
});

// Add routes for the new doctor/patients and patient/uploaders pages
app.get('/doctor/patients', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/doctor/patients/index.html'));
});

app.get('/patient/doctors', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/patient/doctors/index.html'));
});

app.get('/patient/uploaders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/patient/uploaders/index.html'));
});

app.get('/patient/records', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/patient/records/index.html'));
});

// Helper function to generate patient ID from Aadhaar number
function generatePatientId(aadharNumber, fullName) {
  // Create SHA-256 hash of the Aadhar number and full name
  const hash = crypto.createHash('sha256').update(aadharNumber + fullName).digest('hex');
  
  // Return the first 10 characters of the hash
  return hash.substring(0, 10);
}

// Helper function to generate record ID
function generateRecordId(recordType, diagnosisDate) {
  const timestamp = Date.now().toString();
  const uniqueId = recordType.substring(0, 3).toUpperCase() + 
                  timestamp.substring(timestamp.length - 6) + 
                  Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return uniqueId;
}

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
const patientsDir = path.join(dataDir, 'patients');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(patientsDir)) {
  fs.mkdirSync(patientsDir);
}

// API endpoint to get patient dashboard data
app.get('/api/patient/dashboard/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Get patient data (first try Firebase, then local)
    let patientData;
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      patientData = patientResult.data;
    } else {
      // Try local file
      const patientFilePath = path.join(patientsDir, `${patientId}.json`);
      if (!fs.existsSync(patientFilePath)) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
    }
    
    // Get medical records - first try cached file to avoid blockchain errors
    let records = [];
    const recordsJsonPath = path.join(dataDir, `records_${patientData.walletAddress.substring(0, 8)}.json`);
    
    if (fs.existsSync(recordsJsonPath)) {
      try {
        const recordsData = JSON.parse(fs.readFileSync(recordsJsonPath, 'utf8'));
        records = recordsData.records || [];
        console.log(`Using cached records (${records.length} found)`);
      } catch (error) {
        console.error('Error reading cached records:', error);
      }
    }
    
    // Only try blockchain if we don't have cached records
    if (records.length === 0) {
      try {
        const recordsOutput = execSync(
          `node scripts/getMedicalRecords.js ${patientData.privateKey} ${patientData.walletAddress}`,
          { encoding: 'utf8' }
        );
        
        // Check if the file was created by the script
        if (fs.existsSync(recordsJsonPath)) {
          const recordsData = JSON.parse(fs.readFileSync(recordsJsonPath, 'utf8'));
          records = recordsData.records || [];
          console.log(`Retrieved ${records.length} records from blockchain`);
        }
      } catch (error) {
        console.error('Error getting medical records from blockchain:', error.message);
        // Continue even if records can't be fetched
      }
    }
    
    // Get authorized doctors with fallback to cached data
    let doctors = [];
    const doctorsCachePath = path.join(dataDir, `doctors_${patientData.walletAddress.substring(0, 8)}.json`);
    
    // Check for cached doctor data first
    if (fs.existsSync(doctorsCachePath)) {
      try {
        doctors = JSON.parse(fs.readFileSync(doctorsCachePath, 'utf8')) || [];
        console.log(`Using cached doctors list (${doctors.length} found)`);
      } catch (error) {
        console.error('Error reading cached doctors:', error);
      }
    }
    
    // Only try blockchain if we don't have cached doctors
    if (doctors.length === 0) {
      try {
        const doctorsOutput = execSync(
          `node scripts/patientListAuthorizedDoctors.js ${patientData.privateKey}`,
          { encoding: 'utf8' }
        );
        
        // Extract doctor addresses from output (simple regex approach)
        const matches = doctorsOutput.matchAll(/Doctor Address: (0x[a-fA-F0-9]+)/g);
        for (const match of matches) {
          doctors.push({ address: match[1] });
        }
        
        // Cache the doctors list for future use
        if (doctors.length > 0) {
          fs.writeFileSync(doctorsCachePath, JSON.stringify(doctors), 'utf8');
          console.log(`Cached ${doctors.length} doctors for future use`);
        }
      } catch (error) {
        console.error('Error getting authorized doctors from blockchain:', error.message);
        // Continue even if doctors can't be fetched
      }
    }
    
    // Try to get detailed doctor information from Firebase
    const enhancedDoctors = await Promise.all(doctors.map(async (doctor) => {
      try {
        // Search in the Doctor collection by wallet address
        // This is a simple approach for demonstration - in production, you'd use proper indexing
        const querySnapshot = await firebaseDb.db.collection('Doctor').get();
        let doctorInfo = null;
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.Wallet_Id && data.Wallet_Id.toLowerCase() === doctor.address.toLowerCase()) {
            doctorInfo = {
              id: doc.id,
              name: data.Name || 'Unknown',
              age: data.Age || '',
              profile: data
            };
          }
        });
        
        if (doctorInfo) {
          return { ...doctor, ...doctorInfo };
        }
        return doctor;
      } catch (error) {
        console.error('Error getting doctor info:', error);
        return doctor;
      }
    }));
    
    // Calculate some statistics
    const stats = {
      totalRecords: records.length,
      authorizedDoctors: doctors.length,
      lastUpdate: patientData.lastUpdated || patientData.registrationDate,
      recordsByType: {}
    };
    
    // Count records by type
    records.forEach(record => {
      const type = record.recordType || 'Unknown';
      stats.recordsByType[type] = (stats.recordsByType[type] || 0) + 1;
    });
    
    return res.status(200).json({
      patientId: patientId,
      fullName: patientData.fullName,
      walletAddress: patientData.walletAddress,
      email: patientData.email || '',
      phoneNumber: patientData.phoneNumber || '',
      age: patientData.age || '',
      gender: patientData.gender || '',
      bloodGroup: patientData.bloodGroup || '',
      allergies: patientData.allergies || '',
      medicalConditions: patientData.medicalConditions || '',
      registrationDate: patientData.registrationDate,
      lastLogin: patientData.lastLogin,
      privateKey: patientData.privateKey,
      records: records,
      doctors: enhancedDoctors,
      stats: stats
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// API endpoints for blockchain operations
// 1. Authorize Doctor
app.post('/api/patient/authorize-doctor', async (req, res) => {
  try {
    const { patientId, patientPrivateKey, doctorAddress } = req.body;
    
    if (!patientId || !patientPrivateKey || !doctorAddress) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get patient data
    let patientData;
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      patientData = patientResult.data;
    } else {
      // Try local file
      const patientFilePath = path.join(patientsDir, `${patientId}.json`);
      if (!fs.existsSync(patientFilePath)) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
    }
    
    // Verify the private key (in a real app, you'd validate the key matches the wallet)
    if (patientPrivateKey !== patientData.privateKey) {
      return res.status(401).json({ error: 'Invalid private key' });
    }
    
    // Execute the authorizeDoctor script
    const output = execSync(
      `node scripts/patientAuthorizeUploader.js ${doctorAddress} ${patientPrivateKey}`,
      { encoding: 'utf8' }
    );
    
    // Check if successful (look for "SUCCESS" in the output)
    if (output.includes('SUCCESS')) {
      return res.status(200).json({
        success: true,
        message: `Doctor ${doctorAddress} authorized successfully`
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to authorize doctor',
        details: output
      });
    }
  } catch (error) {
    console.error('Error authorizing doctor:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 2. Revoke Doctor
app.post('/api/patient/revoke-doctor', async (req, res) => {
  try {
    const { patientId, patientPrivateKey, doctorAddress } = req.body;
    
    if (!patientId || !patientPrivateKey || !doctorAddress) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get patient data
    let patientData;
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      patientData = patientResult.data;
    } else {
      // Try local file
      const patientFilePath = path.join(patientsDir, `${patientId}.json`);
      if (!fs.existsSync(patientFilePath)) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
    }
    
    // Verify the private key
    if (patientPrivateKey !== patientData.privateKey) {
      return res.status(401).json({ error: 'Invalid private key' });
    }
    
    // Execute the revokeDoctor script
    const output = execSync(
      `node scripts/patientRemoveUploader.js ${doctorAddress} ${patientPrivateKey}`,
      { encoding: 'utf8' }
    );
    
    // Check if successful
    if (output.includes('SUCCESS')) {
      return res.status(200).json({
        success: true,
        message: `Doctor ${doctorAddress} access revoked successfully`
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to revoke doctor access',
        details: output
      });
    }
  } catch (error) {
    console.error('Error revoking doctor access:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 3. List Authorized Doctors
app.get('/api/patient/authorized-doctors/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { privateKey } = req.query;
    
    if (!patientId || !privateKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get patient data
    let patientData;
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      patientData = patientResult.data;
    } else {
      // Try local file
      const patientFilePath = path.join(patientsDir, `${patientId}.json`);
      if (!fs.existsSync(patientFilePath)) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
    }
    
    // Verify the private key
    if (privateKey !== patientData.privateKey) {
      return res.status(401).json({ error: 'Invalid private key' });
    }
    
    // Execute the list authorized doctors script
    const output = execSync(
      `npm run patient-list-doctors -- ${patientData.privateKey}`,
      { encoding: 'utf8' }
    );
    
    // Extract doctor addresses from output
    const doctors = [];
    const matches = output.matchAll(/Doctor Address: (0x[a-fA-F0-9]+)/g);
    for (const match of matches) {
      doctors.push({ address: match[1] });
    }
    
    // Try to get detailed doctor information from Firebase
    const enhancedDoctors = await Promise.all(doctors.map(async (doctor) => {
      try {
        const querySnapshot = await firebaseDb.db.collection('Doctor').get();
        let doctorInfo = null;
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.Wallet_Id && data.Wallet_Id.toLowerCase() === doctor.address.toLowerCase()) {
            doctorInfo = {
              id: doc.id,
              name: data.Name || 'Unknown',
              age: data.Age || '',
              profile: data
            };
          }
        });
        
        if (doctorInfo) {
          return { ...doctor, ...doctorInfo };
        }
        return doctor;
      } catch (error) {
        console.error('Error getting doctor info:', error);
        return doctor;
      }
    }));
    
    return res.status(200).json({
      patientId,
      doctorCount: doctors.length,
      doctors: enhancedDoctors
    });
  } catch (error) {
    console.error('Error listing authorized doctors:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 4. Patient Grant Access
app.post('/api/patient/grant-access', async (req, res) => {
  try {
    const { patientId, patientPrivateKey, doctorAddress, recordId } = req.body;
    
    if (!patientId || !patientPrivateKey || !doctorAddress || !recordId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get patient data
    let patientData;
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      patientData = patientResult.data;
    } else {
      // Try local file
      const patientFilePath = path.join(patientsDir, `${patientId}.json`);
      if (!fs.existsSync(patientFilePath)) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
    }
    
    // Verify the private key
    if (patientPrivateKey !== patientData.privateKey) {
      return res.status(401).json({ error: 'Invalid private key' });
    }
    
    // Execute the grant access script
    const output = execSync(
      `npm run patient-grant -- ${doctorAddress} ${recordId} ${patientPrivateKey}`,
      { encoding: 'utf8' }
    );
    
    // Check if successful
    if (output.includes('SUCCESS') || output.includes('granted access')) {
      return res.status(200).json({
        success: true,
        message: `Access granted to doctor ${doctorAddress} for record ${recordId}`
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to grant access',
        details: output
      });
    }
  } catch (error) {
    console.error('Error granting access:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 5. Patient Revoke Access
app.post('/api/patient/revoke-access', async (req, res) => {
  try {
    const { patientId, patientPrivateKey, doctorAddress, recordId } = req.body;
    
    if (!patientId || !patientPrivateKey || !doctorAddress || !recordId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get patient data
    let patientData;
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      patientData = patientResult.data;
    } else {
      // Try local file
      const patientFilePath = path.join(patientsDir, `${patientId}.json`);
      if (!fs.existsSync(patientFilePath)) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
    }
    
    // Verify the private key
    if (patientPrivateKey !== patientData.privateKey) {
      return res.status(401).json({ error: 'Invalid private key' });
    }
    
    // Execute the revoke access script
    const output = execSync(
      `npm run patient-revoke -- ${doctorAddress} ${recordId} ${patientPrivateKey}`,
      { encoding: 'utf8' }
    );
    
    // Check if successful
    if (output.includes('SUCCESS') || output.includes('revoked access')) {
      return res.status(200).json({
        success: true,
        message: `Access revoked from doctor ${doctorAddress} for record ${recordId}`
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to revoke access',
        details: output
      });
    }
  } catch (error) {
    console.error('Error revoking access:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 6. Doctor Check Access
app.get('/api/doctor/check-access/:patientAddress', async (req, res) => {
  try {
    const { patientAddress } = req.params;
    const { doctorPrivateKey } = req.query;
    
    if (!patientAddress || !doctorPrivateKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Execute the doctor check access script
    const output = execSync(
      `npm run doctor-check-access -- ${patientAddress} ${doctorPrivateKey}`,
      { encoding: 'utf8' }
    );
    
    // Check output for access status
    const hasAccess = output.includes('You have access to this patient') || 
                      output.includes('SUCCESS') ||
                      !output.includes('do not have access');
    
    return res.status(200).json({
      doctorHasAccess: hasAccess,
      patientAddress: patientAddress,
      details: output
    });
  } catch (error) {
    console.error('Error checking access:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 7. Add Medical Record
app.post('/api/records/add', async (req, res) => {
  try {
    const { doctorId, doctorPrivateKey, patientAddress, recordType, recordDetails, ipfsCID } = req.body;
    
    if (!doctorId || !doctorPrivateKey || !patientAddress || !recordType || !ipfsCID) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get doctor data from Firebase
    let doctorData = null;
    try {
      const docSnapshot = await firebaseDb.db.collection('Doctor').doc(doctorId).get();
      if (docSnapshot.exists) {
        doctorData = docSnapshot.data();
      } else {
        return res.status(404).json({ error: 'Doctor not found' });
      }
    } catch (error) {
      console.error('Error fetching doctor data:', error);
      return res.status(500).json({ error: 'Failed to fetch doctor data' });
    }
    
    // Verify the private key matches the doctor
    if (doctorPrivateKey !== doctorData.Private_Key) {
      return res.status(401).json({ error: 'Invalid private key' });
    }
    
    // Generate a record ID
    const currentDate = new Date();
    const recordId = generateRecordId(recordType, currentDate.toISOString());
    
    // Execute the add record script (via IPFS)
    const output = execSync(
      `npm run add-ipfs-records -- ${patientAddress} ${recordType} ${recordId} ${ipfsCID} ${doctorPrivateKey}`,
      { encoding: 'utf8' }
    );
    
    // Check if successful
    if (output.includes('SUCCESS') || output.includes('added successfully')) {
      // Update record count for the patient
      try {
        const patientQuery = await firebaseDb.db.collection('patients')
          .where('walletAddress', '==', patientAddress)
          .get();
        
        if (!patientQuery.empty) {
          const patientDoc = patientQuery.docs[0];
          await patientDoc.ref.update({
            recordCount: admin.firestore.FieldValue.increment(1),
            lastUpdated: admin.firestore.Timestamp.now()
          });
        }
      } catch (error) {
        console.error('Warning: Could not update patient record count:', error);
        // Continue even if update fails
      }
      
      return res.status(200).json({
        success: true,
        message: `Medical record added successfully`,
        recordId: recordId,
        ipfsCID: ipfsCID
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to add medical record',
        details: output
      });
    }
  } catch (error) {
    console.error('Error adding medical record:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 8. Get Medical Records (updated to bypass blockchain auth for patient self-access)
app.get('/api/patient/records/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { privateKey } = req.query; // Allow optional private key parameter
    
    // Get patient data
    let patientData;
    const patientResult = await firebaseDb.getPatientById(patientId);
    
    if (patientResult.success) {
      patientData = patientResult.data;
    } else {
      // Try local file
      const patientFilePath = path.join(patientsDir, `${patientId}.json`);
      if (!fs.existsSync(patientFilePath)) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      patientData = JSON.parse(fs.readFileSync(patientFilePath, 'utf8'));
    }
    
    // Check if the patient is requesting their own data
    // If so, we'll try to read directly from blockchain storage if possible
    
    let records = [];

    // First check if we already have a cached records file
    const recordsJsonPath = path.join(dataDir, `records_${patientData.walletAddress.substring(0, 8)}.json`);
    if (fs.existsSync(recordsJsonPath)) {
      try {
        const recordsData = JSON.parse(fs.readFileSync(recordsJsonPath, 'utf8'));
        records = recordsData.records || [];
        
        // If file exists and we have records, just return them
        return res.status(200).json({
          patientId: patientId,
          patientAddress: patientData.walletAddress,
          recordCount: records.length,
          accessType: 'file-access',
          records: records
        });
      } catch (error) {
        console.error('Error reading cached records:', error);
        // Continue to try blockchain access if cache fails
      }
    }
    
    // Attempt blockchain access with appropriate key
    const keyToUse = privateKey || patientData.privateKey;
    
    try {
      // Try to get records using the blockchain API
      const output = execSync(
        `npm run get-records -- ${keyToUse} ${patientData.walletAddress}`,
        { encoding: 'utf8' }
      );
      
      // If successful, read the newly created file
      if (fs.existsSync(recordsJsonPath)) {
        const recordsData = JSON.parse(fs.readFileSync(recordsJsonPath, 'utf8'));
        records = recordsData.records || [];
        
        return res.status(200).json({
          patientId: patientId,
          patientAddress: patientData.walletAddress,
          recordCount: records.length,
          accessType: recordsData.accessType || 'blockchain-access',
          records: records
        });
      }
    } catch (error) {
      console.error('Warning: Blockchain access failed:', error.message);
      // Continue with empty records or cached data if blockchain access fails
    }
    
    // If we get here, we couldn't get records from blockchain or cache
    // Just return the data we have (which might be empty)
    return res.status(200).json({
      patientId: patientId,
      patientAddress: patientData.walletAddress,
      recordCount: records.length,
      accessType: 'limited-access',
      records: records
    });
  } catch (error) {
    console.error('Error getting medical records:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// 9. Upload to IPFS
app.post('/api/upload/ipfs', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    
    // Execute the upload to IPFS script
    const output = execSync(
      `npm run upload-to-ipfs -- ${filePath}`,
      { encoding: 'utf8' }
    );
    
    // Extract CID from output
    const cidMatch = output.match(/CID: (Qm[a-zA-Z0-9]+)/);
    if (cidMatch && cidMatch[1]) {
      const cid = cidMatch[1];
      
      // Clean up the temporary file
      fs.unlinkSync(filePath);
      
      return res.status(200).json({
        success: true,
        cid: cid,
        ipfsUrl: `https://gateway.pinata.cloud/ipfs/${cid}`
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to extract CID from upload',
        details: output
      });
    }
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open your browser to view the medical records upload form`);
}); 
 