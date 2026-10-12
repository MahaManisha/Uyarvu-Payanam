const { syncCentralExams } = require('./services/easyShikshaExamService');

syncCentralExams({ limit: 3, concurrency: 1 })
  .then(result => {
    console.log('Sync Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Sync Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });