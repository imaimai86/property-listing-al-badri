var AWS_SIGNER = (function() {

  function getSignedUrl(method, bucket, region, key, accessKey, secretKey, customHeaders) {
    var now = new Date();
    var amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, ''); // 20230101T120000Z
    var dateStamp = amzDate.substr(0, 8); // 20230101
    // Use regional endpoint for proper SSL certificate validation
    // Format: bucket.s3.region.amazonaws.com (not bucket.s3.amazonaws.com)
    var host = bucket + '.s3.' + region + '.amazonaws.com';
    var service = 's3';
    
    // expiry 5 minutes = 300 seconds
    var expires = '300';
    
    // 1. Canonical Headers & Signed Headers
    var headersMap = customHeaders || {};
    headersMap['host'] = host;
    
    var sortedKeys = Object.keys(headersMap).sort();
    var canonicalHeaders = '';
    var signedHeaders = '';
    
    sortedKeys.forEach(function(k) {
       canonicalHeaders += k.toLowerCase() + ':' + headersMap[k] + '\n';
       if (signedHeaders.length > 0) signedHeaders += ';';
       signedHeaders += k.toLowerCase();
    });

    // 2. Canonical Request
    var canonicalUri = '/' + key.split('/').map(function(c) { return encodeURIComponent(c); }).join('/');
    var canonicalQuerystring = 
      'X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      '&X-Amz-Credential=' + encodeURIComponent(accessKey + '/' + dateStamp + '/' + region + '/' + service + '/aws4_request') +
      '&X-Amz-Date=' + amzDate +
      '&X-Amz-Expires=' + expires +
      '&X-Amz-SignedHeaders=' + encodeURIComponent(signedHeaders);
      
    var payloadHash = 'UNSIGNED-PAYLOAD'; // For Presigned URLs
    
    var canonicalRequest = 
      method + '\n' +
      canonicalUri + '\n' +
      canonicalQuerystring + '\n' +
      canonicalHeaders + '\n' +
      signedHeaders + '\n' +
      payloadHash;
      
    // 3. String to Sign
    var algorithm = 'AWS4-HMAC-SHA256';
    var credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
    var stringToSign = 
      algorithm + '\n' +
      amzDate + '\n' +
      credentialScope + '\n' +
      toHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonicalRequest));
      
    // 3. Signing Key (chained HMAC operations)
    // First HMAC uses string key, subsequent ones use byte array keys
    var kDate = Utilities.computeHmacSha256Signature(dateStamp, "AWS4" + secretKey);
    var kRegion = Utilities.computeHmacSha256Signature(Utilities.newBlob(region).getBytes(), kDate);
    var kService = Utilities.computeHmacSha256Signature(Utilities.newBlob(service).getBytes(), kRegion);
    var kSigning = Utilities.computeHmacSha256Signature(Utilities.newBlob("aws4_request").getBytes(), kService);
    
    // 4. Signature (stringToSign must also be converted to bytes)
    var signature = toHex(Utilities.computeHmacSha256Signature(Utilities.newBlob(stringToSign).getBytes(), kSigning));
    
    // 5. Final URL
    return 'https://' + host + canonicalUri + '?' + canonicalQuerystring + '&X-Amz-Signature=' + signature;
  }
  
  function toHex(bytes) {
    return bytes.map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
  }
  
  return {
    getSignedUrl: getSignedUrl
  };

})();
