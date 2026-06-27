const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// We must set the userData path to the app's directory before doing anything
app.setPath('userData', 'C:\\Users\\RAHUL VASHISTH\\AppData\\Roaming\\arch-budget-calculator');

app.whenReady().then(() => {
  // Now we can require the compiled license file to test it
  try {
    const license = require(path.join(__dirname, '../dist-electron/license.js'));
    const status = license.getLicenseStatus();
    console.log('License Status:', JSON.stringify(status, null, 2));
  } catch (err) {
    console.log('Failed to load license.js:', err);
  }
  app.quit();
});
