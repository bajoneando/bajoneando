const https = require('https');

const url = 'https://api.github.com/repos/Weep-st/weep/actions/runs/31809834085/jobs';
const options = {
  headers: {
    'User-Agent': 'node.js'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const jobs = JSON.parse(data).jobs;
    if (jobs && jobs.length > 0) {
      console.log(`Job ID: ${jobs[0].id}`);
    }
  });
}).on('error', err => console.log(err));
