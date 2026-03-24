const axios = require('axios');
require('dotenv').config();

async function debugUnknown() {
  const GENIEACS_URL = process.env.GENIEACS_API_URL || 'http://localhost:7557';
  try {
    const response = await axios.get(`${GENIEACS_URL}/devices`);
    const unknown = response.data.filter(d => {
        // Simple heuristic to find ones my code missed
        const m = d.InternetGatewayDevice?.DeviceInfo?.Manufacturer?._value || d.Device?.DeviceInfo?.Manufacturer?._value;
        return !m;
    });
    
    console.log('--- SAMPLE UNKNOWN DEVICE ---');
    if (unknown.length > 0) {
        console.log(JSON.stringify(unknown[0], null, 2));
    } else {
        console.log('No unknown devices found with this simple check. Printing first device:');
        console.log(JSON.stringify(response.data[0], null, 2));
    }
  } catch (err) {
    console.error('Error reaching GenieACS:', err.message);
  }
}

debugUnknown();
