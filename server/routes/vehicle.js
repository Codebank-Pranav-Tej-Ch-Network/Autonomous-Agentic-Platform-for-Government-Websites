const express = require('express');
const router = express.Router();
const Vehicle = require('../models/vehicleModel');

// GET vehicle by registration number
router.get('/:regNo', async (req, res) => {
    try {
        const { regNo } = req.params;

        // Find vehicle in database (case-insensitive)
        const vehicle = await Vehicle.findOne({ regNo: regNo.toUpperCase() });

        if (!vehicle) {
            // Vehicle not found
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        // Vehicle found, return details
        return res.json({
            success: true,
            data: vehicle
        });

    } catch (error) {
        // Handle timeout or unexpected backend errors
        if (error.name === 'TimeoutError') {
            return res.status(504).json({
                success: false,
                message: 'Timeout when fetching vehicle data'
            });
        }
        console.error('Vehicle API error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching vehicle'
        });
    }
});

module.exports = router;

