function testDoPost() {
  // 1. Simulate the Event Object (e) that Google sends on a POST request
  var e = {
    postData: {
      contents: JSON.stringify({
        action: 'login',
        params: {
          email: 'anas@anas.com',
          password: 'pwd'
        }
      })
    }
  };

  // 2. Call doPost with the simulated event
  var result = doPost(e);
  
  // 3. Log the output
  Logger.log(result.getContent());
}
