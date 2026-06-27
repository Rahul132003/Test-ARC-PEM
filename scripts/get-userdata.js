const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  const licensePath = path.join(app.getPath('userData'), 'license.dat');
  console.log('UserData Path:', app.getPath('userData'));
  console.log('License Path:', licensePath);
  app.quit();
});
