const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 3000;

// --- CONFIGURATION ---
// IMPORTANT: This is your connection string.
const MONGO_URI = 'mongodb+srv://cs24b012_db_user:tranquility%40123@storage-e-id.joof12t.mongodb.net/eidDatabase?appName=storage-e-id';

// --- MIDDLEWARE ---
app.use(cors()); // Allows your frontend to talk to this backend
app.use(express.json()); // Allows server to read JSON from request bodies

// --- DATABASE MODEL ---
const userSchema = new mongoose.Schema({
    eId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true }, // Phone must be unique
    address: { type: String, required: true },
    issued: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// --- DATABASE CONNECTION ---
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Successfully connected to MongoDB!');
    })
    .catch((error) => {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1); // Exit the server if DB connection fails
    });

// --- API ROUTES ---

/**
 * @route   POST /api/register
 * @desc    Register a new E-ID user
 */
app.post('/api/register', async (req, res) => {
    try {
        const { name, dob, gender, phone, address } = req.body;

        // Check if a user with this phone number already exists
        const existingUser = await User.findOne({ phone: phone });
        if (existingUser) {
            console.log('Registration failed: Phone number already in use.');
            return res.status(409).json({ message: 'User already registered with this phone number.' });
        }

        // Generate a new 12-digit E-ID
        let newEId = '';
        let isUnique = false;
        while (!isUnique) {
            newEId = String(Math.floor(100000000000 + Math.random() * 900000000000));
            const idExists = await User.findOne({ eId: newEId });
            if (!idExists) {
                isUnique = true;
            }
        }

        // Create a new user instance
        const newUser = new User({
            eId: newEId,
            name,
            dob,
            gender,
            phone,
            address,
            issued: new Date()
        });

        // Save the new user to the database
        await newUser.save();

        console.log('New user registered:', newUser);
        res.status(201).json(newUser);

    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 11000) {
             return res.status(409).json({ message: 'A user with this phone number or E-ID already exists.' });
        }
        res.status(500).json({ message: 'Server error during registration.', error: error.message });
    }
});

/**
 * @route   GET /api/search/:eId
 * @desc    Search for a user by their E-ID
 */
app.get('/api/search/:eId', async (req, res) => {
    try {
        const eIdToFind = req.params.eId; // This matches the route

        if (!eIdToFind || eIdToFind.length !== 12 || !/^\d+$/.test(eIdToFind)) {
            return res.status(400).json({ message: 'Invalid E-ID format. Must be 12 digits.' });
        }

        const user = await User.findOne({ eId: eIdToFind });

        if (!user) {
            console.log(`Search failed: E-ID ${eIdToFind} not found.`);
            return res.status(404).json({ message: 'No E-ID record found for this number.' });
        }

        console.log('User found:', user);
        res.status(200).json(user);

    } catch (error) {
        console.error('Search error:', error);
        // --- THIS IS THE FIX ---
        // Changed "5S00" to "500"
        res.status(500).json({ message: 'Server error during search.', error: error.message });
    }
});

// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
