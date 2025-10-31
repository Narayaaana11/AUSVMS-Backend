const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

function generateVisitorID() {
  const date = dayjs().format('YYYYMMDD');
  const short = uuidv4().split('-')[0].toUpperCase();
  return `AUVMS-${date}-${short}`;
}

module.exports = generateVisitorID;


