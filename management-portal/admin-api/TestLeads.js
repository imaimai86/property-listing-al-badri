function testGetLeads() {
  var e = {
    parameter: {
      auth: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzY4MTk0OTY5MTAzfQ.WzMxLDI2LC03OSwtMzQsMjYsLTQwLDExNCwtNzgsLTU3LDU4LDExNywtNDksLTU1LDEwOCwtOTYsNjYsMTksLTMsLTk5LC00MSwtOTYsMTA3LC0xMDUsMTE3LDEwOSwtNzYsLTEyOCwtMTksMTE0LC0yLC0yNiwtMV0'
    },
    postData: {
      contents: JSON.stringify({
        action: 'getLeads',
        params: {}
      })
    }
  };
  var result = doPost(e);
  Logger.log(result.getContent());
}