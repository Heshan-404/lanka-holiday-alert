const handler = require('./api/check');

// Mock req and res for local execution
const req = {
  headers: {
    authorization: `Bearer ${process.env.CRON_SECRET || ''}`
  }
};
const res = {
  status: (code) => {
    console.log(`Response Status: ${code}`);
    return res;
  },
  json: (data) => {
    console.log('Response Body:', JSON.stringify(data, null, 2));
    return res;
  }
};

async function testLocally() {
  console.log('Starting local HolidaySync run...');
  await handler(req, res);
}

if (require.main === module) {
  testLocally();
}

module.exports = { checkHolidays: testLocally };
