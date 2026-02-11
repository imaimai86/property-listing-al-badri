/**
 * Property & Lead Management - Private Admin API
 * 
 * SETUP INSTRUCTIONS:
 * 1. Define Script Properties (File > Project Properties > Script Properties):
 *    - AWS_ACCESS_KEY: Your AWS Access Key ID
 *    - AWS_SECRET_KEY: Your AWS Secret Access Key
 *    - AWS_BUCKET_NAME: Your S3 Bucket Name 'medable-property-management'
 *    - AWS_REGION: e.g., 'us-east-1'
 *    - SHEET_ID_LISTING: ID of Property Listing Sheet
 *    - SHEET_ID_LEAD: ID of Lead Management Sheet
 *    - SHEET_ID_AUTH: ID of Authentication (Users) Sheet
 *    - JWT_SECRET: A random long string for signing tokens
 * 
 * 2. Deploy as Web App:
 *    - Execute as: Me
 *    - Who has access: Anyone (The script enforces its own Auth)
 */

var SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// =========================================================
// ROUTER & MIDDLEWARE
// =========================================================

function doPost(e) {
  var response = { success: false, data: null, error: null };
  
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("Invalid request: No data found");
    }

    var request = JSON.parse(e.postData.contents);
    var action = request.action;
    var params = request.params || {};

    // Get token - prioritize request body (most reliable in Apps Script)
    // Apps Script has limited/unreliable access to custom headers
    var token = request.token || null;
    
    // Fallback: try headers (may not work in Apps Script)
    if (!token) {
      var authHeader = e.parameter.auth || (e.headers && e.headers.Authorization) || (e.headers && e.headers.authorization);
      if (authHeader && authHeader.indexOf('Bearer ') === 0) {
        token = authHeader.substring(7);
      }
    }

    // Open Router (No Token Needed)
    if (action === 'login') {
      response.data = handleLogin(params);
      response.success = true;
      return createJsonResponse(response);
    }

    // Authenticated Router (Token is required)
    if (!token) throw new Error("Missing Authorization token");
    var user = verifyToken(token); // Throws if invalid
    
    switch (action) {
      case 'getLeads':
        response.data = getLeads(user, params);
        break;
      case 'lockLead':
        response.data = lockLead(user, params);
        break;
      case 'saveProperty':
        response.data = saveProperty(user, params);
        break;
      case 'getUploadUrl':
        response.data = getUploadUrl(user, params);
        break;
      case 'deleteImage':
        response.data = performDeleteImage(user, params);
        break;
      case 'getProperties':
        response.data = getProperties(user, params);
        break;
      case 'getUsers':
         if (user.role !== 'admin') throw new Error("Unauthorized");
         response.data = getUsers();
         break;
      default:
        throw new Error("Unknown action: " + action);
    }
    response.success = true;

  } catch (err) {
    response.error = err.message;
  }

  return createJsonResponse(response);
}

function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  // Add CORS headers to allow localhost for development
  // Apps Script automatically handles CORS for most cases, but explicit headers help with localhost
  return output;
}

// Handle CORS preflight requests
function doGet(e) {
  return createJsonResponse({ 
    success: true, 
    message: 'API is running. Use POST for actions.' 
  });
}


// =========================================================
// AUTHENTICATION (JWT)
// =========================================================

var JWT = (function() {
  function base64url(source) {
    if (typeof source !== 'string') source = JSON.stringify(source);
    var encodedSource = Utilities.base64EncodeWebSafe(source);
    while (encodedSource.endsWith('=')) {
      encodedSource = encodedSource.substring(0, encodedSource.length - 1);
    }
    return encodedSource;
  }

  return {
    create: function(payload, secret) {
      var header = { alg: "HS256", typ: "JWT" };
      var stringToSign = base64url(header) + "." + base64url(payload);
      var signature = Utilities.computeHmacSha256Signature(stringToSign, secret);
      return stringToSign + "." + base64url(signature);
    },
    verify: function(token, secret) {
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      
      var stringToSign = parts[0] + "." + parts[1];
      var signature = parts[2];
      var expectedSignature = base64url(Utilities.computeHmacSha256Signature(stringToSign, secret));
      
      if (signature !== expectedSignature) return null;
      
      var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
      if (payload.exp && new Date().getTime() > payload.exp) return null;
      
      return payload;
    }
  };
})();

function handleLogin(params) {
  var email = params.email;
  var password = params.password; // In real app, verify hash. For MVP, plain text or simple hash check.
  
  var db = SpreadsheetApp.openById(SCRIPT_PROPERTIES.getProperty('SHEET_ID_AUTH'));
  var usersSheet = db.getSheetByName('Users');
  if (!usersSheet) throw new Error("Users sheet not found");
  
  var data = usersSheet.getDataRange().getValues();
  var headers = data[0];
  
  // Find user
  var userRowIndex = -1;
  var user = null;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('email')] === email && data[i][headers.indexOf('active')] === true) {
      // Check password (In prod: bcrypt.compareSync(password, data[i][...]))
      // Here assuming column 'password_hash' stores the password for MVP simplicity or user implements their hash check
      var storedPass = data[i][headers.indexOf('password_hash')];
      if (storedPass === password) { 
        userRowIndex = i + 1;
        user = {
          id: data[i][headers.indexOf('id')],
          name: data[i][headers.indexOf('name')],
          email: data[i][headers.indexOf('email')],
          role: data[i][headers.indexOf('role')]
        };
        break; 
      }
    }
  }
  
  if (!user) throw new Error("Invalid credentials or inactive account");
  
  // Generate JWT Token
  var secret = SCRIPT_PROPERTIES.getProperty('JWT_SECRET');
  var payload = {
    id: user.id,
    name: user.name,
    role: user.role,
    exp: new Date().getTime() + (24 * 60 * 60 * 1000) // 24h
  };
  
  var token = JWT.create(payload, secret);
  
  // Optional: You can still save it to the sheet if you want to track active sessions
  // but with JWT it's not strictly necessary for verification.
  usersSheet.getRange(userRowIndex, headers.indexOf('token') + 1).setValue(token);
  usersSheet.getRange(userRowIndex, headers.indexOf('token_expiry') + 1).setValue(payload.exp);
  
  return { token: token, user: user };
}

function verifyToken(token) {
  if (!token) throw new Error("Unauthorized: No token provided");
  
  var secret = SCRIPT_PROPERTIES.getProperty('JWT_SECRET');
  var payload = JWT.verify(token, secret);
  
  if (!payload) throw new Error("Unauthorized: Invalid or expired token");
  
  return payload;
}


// =========================================================
// LEADS MANAGEMENT
// =========================================================

function getLeads(user, params) {
  var db = SpreadsheetApp.openById(SCRIPT_PROPERTIES.getProperty('SHEET_ID_LEAD'));
  var sheet = db.getSheetByName('Leads');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var leads = [];
  for (var i = 1; i < data.length; i++) {
    var lead = {};
    headers.forEach(function(h, idx) { lead[h] = data[i][idx] });
    leads.push(lead);
  }
  
  // Optional: Filter by agent if params.all !== true
  // for MVP returning all
  return leads.reverse(); // Newest first
}

function lockLead(user, params) {
  var leadId = params.leadId;
  var lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(10000); // Wait up to 10 sec
    
    var db = SpreadsheetApp.openById(SCRIPT_PROPERTIES.getProperty('SHEET_ID_LEAD'));
    var sheet = db.getSheetByName('Leads');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var rowIndex = -1;
    var currentLockedBy = null;
    var currentLockedAt = null;
    
    // Find Row
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][headers.indexOf('id')]) === String(leadId)) {
        rowIndex = i + 1;
        currentLockedBy = data[i][headers.indexOf('locked_by')];
        currentLockedAt = data[i][headers.indexOf('locked_at')];
        break;
      }
    }
    
    if (rowIndex === -1) throw new Error("Lead not found");
    
    // Check Status
    var now = new Date();
    var isLocked = false;
    
    if (currentLockedBy && currentLockedBy !== '') {
       // Check 24h expiry
       var lockedTime = new Date(currentLockedAt).getTime();
       var diffHours = (now.getTime() - lockedTime) / (1000 * 60 * 60);
       
       if (diffHours < 24 && currentLockedBy !== user.id) {
         throw new Error("Lead is locked by another agent");
       }
    }
    
    // Lock it
    sheet.getRange(rowIndex, headers.indexOf('locked_by') + 1).setValue(user.id);
    sheet.getRange(rowIndex, headers.indexOf('locked_at') + 1).setValue(now.toISOString());
    sheet.getRange(rowIndex, headers.indexOf('status') + 1).setValue('In Progress');
    sheet.getRange(rowIndex, headers.indexOf('agent_assigned') + 1).setValue(user.name);
    
    return { success: true, message: "Lead Locked successfully" };
    
  } catch (e) {
    throw e;
  } finally {
    lock.releaseLock();
  }
}


// =========================================================
// PROPERTY MANAGEMENT
// =========================================================

function getProperties(user, params) {
  var db = SpreadsheetApp.openById(SCRIPT_PROPERTIES.getProperty('SHEET_ID_LISTING'));
  var sheet = db.getSheetByName('Properties');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var props = [];
  for (var i = 1; i < data.length; i++) {
    var prop = {};
    headers.forEach(function(h, idx) { prop[h] = data[i][idx] });
    
    // Parse images - handle both JSON array (legacy) and comma-separated (new)
    if (prop.images && typeof prop.images === 'string') {
      if (prop.images.trim().startsWith('[')) {
        // JSON format (legacy)
        try {
          prop.images = JSON.parse(prop.images);
        } catch (e) {
          prop.images = [];
        }
      } else {
        // Comma-separated format (new)
        prop.images = prop.images.split(',').map(function(img) { 
          return img.trim(); 
        }).filter(function(img) { 
          return img.length > 0; 
        });
      }
    } else if (!prop.images) {
      prop.images = [];
    }
    
    props.push(prop);
  }
  
  return props;
}

function saveProperty(user, params) {
  var db = SpreadsheetApp.openById(SCRIPT_PROPERTIES.getProperty('SHEET_ID_LISTING'));
  var sheet = db.getSheetByName('Properties');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var id = params.id;
  var rowIndex = -1;
  var existingRow = null;

  // 1. Find existing row if ID is provided and not 'new'
  if (id && id !== 'new') {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][headers.indexOf('id')]) === String(id)) {
        rowIndex = i + 1;
        // Store existing row data to preserve fields not in the form
        existingRow = {};
        headers.forEach(function(h, idx) { 
          existingRow[h] = data[i][idx]; 
        });
        break;
      }
    }
  } else {
    // Generate new ID if creating
    id = 'prop_' + new Date().getTime();
  }

  // 1.5 Process Images: Move from temp to permanent if needed
  // Handle Thumbnail
  var finalThumbnail = params.thumbnail;
  if (finalThumbnail && finalThumbnail.indexOf('uploaded_assets/') === 0) {
    var filename = finalThumbnail.split('/').pop();
    var finalPath = 'assets/props-imgs/prop-id-' + id + '/' + filename;
    try {
      Logger.log('Moving thumbnail from ' + finalThumbnail + ' to ' + finalPath);
      s3Copy(finalThumbnail, finalPath);
      s3Delete(finalThumbnail);
      finalThumbnail = finalPath;
      Logger.log('Thumbnail moved successfully');
    } catch(e) { 
      Logger.log("Error moving thumbnail: " + e); 
      console.error("Error moving thumbnail: " + e); 
    }
  } else if (params.image && params.image.indexOf('uploaded_assets/') === 0) {
     // Legacy image field fallback
    var filename = params.image.split('/').pop();
    var finalPath = 'assets/props-imgs/prop-id-' + id + '/' + filename;
    try {
      s3Copy(params.image, finalPath);
      s3Delete(params.image);
      params.image = finalPath;
      if (!finalThumbnail) finalThumbnail = finalPath; 
    } catch(e) { console.error("Error moving legacy image: " + e); }
  }

  // Handle Gallery Images (Array)
  var finalImages = [];
  var incomingImages = params.images;
  if (typeof incomingImages === 'string') {
     try { incomingImages = JSON.parse(incomingImages); } catch(e) { incomingImages = []; }
  }
  
  if (Array.isArray(incomingImages)) {
    finalImages = incomingImages.map(function(img) {
      if (img && img.indexOf('uploaded_assets/') === 0) {
        var filename = img.split('/').pop();
        var finalPath = 'assets/props-imgs/prop-id-' + id + '/' + filename;
        try {
          Logger.log('Moving gallery image from ' + img + ' to ' + finalPath);
          s3Copy(img, finalPath);
          s3Delete(img);
          Logger.log('Gallery image moved successfully');
          return finalPath;
        } catch(e) { 
           Logger.log("Error moving gallery image: " + e); 
           console.error("Error moving gallery image: " + e); 
           return img; // Return original if fail, so we don't lose the ref (even if temp)
        }
      }
      return img;
    });
  }

  // 2. Prepare the row data based on headers
  var newRow = headers.map(function(h) {
    switch(h) {
      case 'id': return id;
      case 'title': return params.title || "";
      case 'price': return params.price || "";
      case 'location': return params.location || "";
      case 'beds': return params.beds || 0;
      case 'baths': return params.baths || 0;
      case 'area_sqm': return params.area || params.area_sqm || 0;
      case 'category': return params.category || "Sale";
      case 'type': 
        // Map category to type: Sale->sale, Rent->rent
        // Preserve existing if available and category hasn't changed
        if (params.category) {
          var categoryLower = (params.category || "").toLowerCase();
          if ([ 'sale', 'rent'].includes(categoryLower)) {
            return categoryLower;
          }
          // For other categories like "Villa", "Apartment", preserve existing type
          return existingRow && existingRow.type ? existingRow.type : 'sale';
        }
        return existingRow && existingRow.type ? existingRow.type : 'sale';
      case 'long_desc': return params.description || params.long_desc || "";
      case 'image': return finalThumbnail || params.image || ""; // Legacy support
      case 'thumbnail': return finalThumbnail || "";
      case 'images': 
        // Store as comma-separated string, not JSON array
        return finalImages.length > 0 ? finalImages.join(',') : '';
      case 'amenities': return params.amenities || "";
      case 'currency': return params.currency || (existingRow ? existingRow.currency : "USD");
      case 'agent_name': return user.name || "System";
      
      // Update fields if provided in params, otherwise preserve existing
      case 'featured': return params.featured !== undefined ? params.featured : (existingRow && existingRow.featured !== undefined ? existingRow.featured : false);
      case 'short_desc': return params.short_desc || (existingRow && existingRow.short_desc ? existingRow.short_desc : "");
      case 'agent_phone': return params.agent_phone || (existingRow && existingRow.agent_phone ? existingRow.agent_phone : "");
      case 'status': return params.status || (existingRow && existingRow.status ? existingRow.status : "Active");
      
      default: 
        // For any unknown fields, preserve existing value if available
        return existingRow && existingRow[h] !== undefined ? existingRow[h] : "";
    }
  });

  // 3. Update or Append
  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
  } else {
    sheet.appendRow(newRow);
  }

  return { success: true, id: id };
}


// =========================================================
// S3 PRESIGNED URL
// =========================================================

function getUploadUrl(user, params) {
  var filename = params.filename;
  var mimeType = params.mimeType;
  var propId = params.propertyId;
  
  if (!filename || !propId) throw new Error("Missing filename or propertyId");
  
  var bucket = SCRIPT_PROPERTIES.getProperty('AWS_BUCKET_NAME');
  var region = SCRIPT_PROPERTIES.getProperty('AWS_REGION');
  var accessKey = SCRIPT_PROPERTIES.getProperty('AWS_ACCESS_KEY');
  var secretKey = SCRIPT_PROPERTIES.getProperty('AWS_SECRET_KEY');
  
  // Specific Path requested by User
  // Always upload to temporary folder first
  var s3Key = 'uploaded_assets/' + filename;
  
  // Generate V4 Signature
  // Note: AWS V4 signing is complex in Apps Script without libraries. 
  // We will assume a helper function `getS3PresignedUrl` exists (using CryptoJS)
  
  var url = generatePresignedUrl('PUT', bucket, region, s3Key, accessKey, secretKey);
  
  // Return relative path (not full URL) so it can be used with S3_BASE_URL config
  // Frontend will construct full URL using: S3_BASE_URL + publicUrl
  return {
    uploadUrl: url,
    publicUrl: s3Key  // Relative path: uploaded_assets/filename.jpg
  };
}

function performDeleteImage(user, params) {
  var imagePath = params.imagePath;
  var propertyId = params.propertyId || 'unknown';
  
  if (!imagePath) throw new Error("Missing imagePath");
  
  // 1. Move to deleted folder (Soft Delete)
  var filename = imagePath.split('/').pop();
  var destPath = 'assets/props-imgs-deleted/prop-id-' + propertyId + '/' + filename;
  
  try {
    s3Copy(imagePath, destPath);
  } catch (e) {
    console.error("Error copy/moving image: " + e);
    // Continue nicely? Or fail? If copy fails, maybe we shouldn't delete.
    // But failing to soft-delete shouldn't prevent deletion if the user really wants it gone.
    // Let's assume strict soft-delete: if copy fails, don't delete.
    throw new Error("Failed to archive image before deletion: " + e.message);
  }
  
  // 2. Delete original
  s3Delete(imagePath);
  
  return { success: true, deleted: true, movedTo: destPath };
}

// S3 Helpers

function s3Copy(sourceKey, destKey) {
  Logger.log('S3 Copy - Source: ' + sourceKey);
  Logger.log('S3 Copy - Destination: ' + destKey);
  var bucket = SCRIPT_PROPERTIES.getProperty('AWS_BUCKET_NAME');
  var region = SCRIPT_PROPERTIES.getProperty('AWS_REGION');
  var accessKey = SCRIPT_PROPERTIES.getProperty('AWS_ACCESS_KEY');
  var secretKey = SCRIPT_PROPERTIES.getProperty('AWS_SECRET_KEY');
  
  var method = 'PUT';
  var service = 's3';
  var host = bucket + '.s3.' + region + '.amazonaws.com';
  
  // x-amz-copy-source format: /bucket/key (with leading slash and URL-encoded key)
  var encodedSourceKey = sourceKey.split('/').map(function(segment) {
    return encodeURIComponent(segment);
  }).join('/');
  var copySourceHeader = '/' + bucket + '/' + encodedSourceKey;
  
  // Destination path (URL-encoded)
  var encodedDestKey = '/' + destKey.split('/').map(function(segment) {
    return encodeURIComponent(segment);
  }).join('/');
  
  Logger.log('S3 Copy - Source: ' + sourceKey);
  Logger.log('S3 Copy - Destination: ' + destKey);
  Logger.log('S3 Copy - Copy-Source Header: ' + copySourceHeader);
  
  // Generate AWS Sig V4 with Authorization header
  var now = new Date();
  var amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, ''); // 20230101T120000Z
  var dateStamp = amzDate.substr(0, 8); // 20230101
  
  // Canonical Headers (must be sorted alphabetically)
  var signedHeaders = 'host;x-amz-content-sha256;x-amz-copy-source;x-amz-date';
  var payloadHash = 'UNSIGNED-PAYLOAD';
  var canonicalHeaders = 
    'host:' + host + '\n' +
    'x-amz-content-sha256:' + payloadHash + '\n' +
    'x-amz-copy-source:' + copySourceHeader + '\n' +
    'x-amz-date:' + amzDate + '\n';
  
  // Canonical Request
  var canonicalRequest = 
    method + '\n' +
    encodedDestKey + '\n' +
    '\n' + // Empty query string
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    payloadHash;
  
  // String to Sign
  var algorithm = 'AWS4-HMAC-SHA256';
  var credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  var hashedCanonicalRequest = toHexDigest(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonicalRequest));
  var stringToSign = 
    algorithm + '\n' +
    amzDate + '\n' +
    credentialScope + '\n' +
    hashedCanonicalRequest;
  
  // Signing Key
  var kDate = Utilities.computeHmacSha256Signature(dateStamp, 'AWS4' + secretKey);
  var kRegion = Utilities.computeHmacSha256Signature(Utilities.newBlob(region).getBytes(), kDate);
  var kService = Utilities.computeHmacSha256Signature(Utilities.newBlob(service).getBytes(), kRegion);
  var kSigning = Utilities.computeHmacSha256Signature(Utilities.newBlob('aws4_request').getBytes(), kService);
  
  // Signature
  var signature = toHexDigest(Utilities.computeHmacSha256Signature(Utilities.newBlob(stringToSign).getBytes(), kSigning));
  
  // Authorization Header
  var authHeader = algorithm + ' ' +
    'Credential=' + accessKey + '/' + credentialScope + ', ' +
    'SignedHeaders=' + signedHeaders + ', ' +
    'Signature=' + signature;
  
  var url = 'https://' + host + encodedDestKey;
  
  Logger.log('S3 Copy - URL: ' + url);
  Logger.log('S3 Copy - Authorization: ' + authHeader.substring(0, 80) + '...');
  
  // Perform Fetch with Authorization header
  var response = UrlFetchApp.fetch(url, {
    method: method,
    headers: {
      'Host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'x-amz-copy-source': copySourceHeader,
      'Authorization': authHeader
    },
    muteHttpExceptions: true
  });
  
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();
  
  Logger.log('S3 Copy - Response Code: ' + responseCode);
  Logger.log('S3 Copy - Response Body: ' + responseBody.substring(0, 500));
  
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('S3 Copy failed with status ' + responseCode + ': ' + responseBody);
  }
  
  Logger.log('S3 Copy - Success!');
}

// Helper function to convert byte array to hex string
function toHexDigest(bytes) {
  return bytes.map(function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function s3Delete(key) {
  var bucket = SCRIPT_PROPERTIES.getProperty('AWS_BUCKET_NAME');
  var region = SCRIPT_PROPERTIES.getProperty('AWS_REGION');
  var accessKey = SCRIPT_PROPERTIES.getProperty('AWS_ACCESS_KEY');
  var secretKey = SCRIPT_PROPERTIES.getProperty('AWS_SECRET_KEY');
  
  var method = 'DELETE';
  var url = AWS_SIGNER.getSignedUrl(method, bucket, region, key, accessKey, secretKey);
  
  Logger.log('S3 Delete - Key: ' + key);
  Logger.log('S3 Delete - URL: ' + url.substring(0, 100) + '...');
  
  var response = UrlFetchApp.fetch(url, {
    method: method,
    muteHttpExceptions: true
  });
  
  var responseCode = response.getResponseCode();
  Logger.log('S3 Delete - Response Code: ' + responseCode);
  
  // S3 returns 204 for successful delete
  if (responseCode !== 204 && responseCode !== 200) {
    var responseBody = response.getContentText();
    Logger.log('S3 Delete - Response Body: ' + responseBody);
    throw new Error('S3 Delete failed with status ' + responseCode);
  }
  
  Logger.log('S3 Delete - Success!');
}

/**
 * Generates a Presigned URL for S3 PUT
 * (Simplified version - Requires full AWS V4 implementation)
 */
function generatePresignedUrl(method, bucket, region, key, accessKey, secretKey) {
   // This requires a full AWS4 library or implementation.
   // For now, I will create a separate file `AwsSignature.js` and assume its functions are available here.
   // returning a placeholder to indicate the logic flow.
   
   return AWS_SIGNER.getSignedUrl(method, bucket, region, key, accessKey, secretKey);
}
