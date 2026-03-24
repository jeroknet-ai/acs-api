const axios = require('axios');
require('dotenv').config();

async function debugAllUnknown() {
  const GENIEACS_URL = process.env.GENIEACS_API_URL || 'http://localhost:7557';
  try {
    const response = await axios.get(`${GENIEACS_URL}/devices`);
    console.log(`Total devices in GenieACS: ${response.data.length}`);
    
    const unknown = response.data.map(d => {
        const get = (p) => p.split('.').reduce((o, i) => o?.[i], d);
        
        // Simple heuristic for vendor
        const manufacturer = get('Device.DeviceInfo.Manufacturer._value') || 
                             get('InternetGatewayDevice.DeviceInfo.Manufacturer._value') || 
                             d._deviceId?._Manufacturer || '';
        
        return { 
            id: d._id, 
            manufacturer,
            model: d._deviceId?._ProductClass,
            hasIGD: !!d.InternetGatewayDevice,
            hasDevice: !!d.Device
        };
    }).filter(info => !info.manufacturer || info.manufacturer === 'Unknown');

    console.log(`Found ${unknown.length} devices still showing as Unknown or empty:`);
    console.table(unknown);
    
    if (unknown.length > 0) {
        // Print the first one of these in full detail
        const fullDetail = response.data.find(d => d._id === unknown[0].id);
        console.log('\n--- FULL DETAIL OF FIRST STILL-UNKNOWN DEVICE ---');
        console.log(JSON.stringify(fullDetail, null, 2));
    }
  } catch (err) {
    console.error('Error reaching GenieACS:', err.message);
  }
}

debugAllUnknown();
