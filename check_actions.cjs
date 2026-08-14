fetch('https://api.github.com/repos/Weep-st/weep/actions/runs')
  .then(res => res.json())
  .then(data => {
    const runs = data.workflow_runs.slice(0, 5);
    runs.forEach(r => {
      console.log(`[${r.name}] Status: ${r.status}, Conclusion: ${r.conclusion}, URL: ${r.html_url}`);
    });
  });
