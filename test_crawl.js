const { syncCentralExams } = require('./backend/services/easyShikshaExamService');

syncCentralExams({ limit: 5, concurrency: 2 })
  .then(result => {
    console.log('Sync result:', JSON.stringify(result, null, 2));
  })
  .catch(err => {
    console.error('Sync error:', err.message);
    console.error(err.stack);
  });