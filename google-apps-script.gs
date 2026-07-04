/**
 * Google Apps Script — Auto-Add Member to Google Group
 * Deploy as Web App with "Execute as me" and "Anyone" access
 * 
 * SETUP:
 * 1. Go to script.google.com → New Project
 * 2. Copy this entire code
 * 3. Enable Admin Directory API (see below)
 * 4. Deploy as Web App (New deployment → Web app → Execute as: Me → Access: Anyone)
 * 5. Copy deployment URL and paste in js/testing.js → APPS_SCRIPT_URL
 * 
 * ENABLE ADMIN DIRECTORY API:
 * 1. Go to https://console.cloud.google.com/
 * 2. Select your Apps Script project (or create new)
 * 3. APIs & Services → Library → Search "Admin SDK" → Enable
 * 4. If prompted, configure OAuth consent screen (External + add test users)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG — UPDATE WITH YOUR DETAILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GROUP_EMAIL = "john-development-studio@googlegroups.com"; // Your Google Group email
const SHEET_ID = "YOUR_SHEET_ID"; // Optional: Log user joins to Google Sheet (leave as-is to skip)

// Allowed origins for CORS (add your GitHub Pages domain)
const ALLOWED_ORIGINS = [
  "https://johniriantosusanto888-cyber.github.io",
  "https://johniriantosusanto888-cyber.github.io/john-development-studio",
  "http://localhost:8080",
  "http://localhost:3000"
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORS UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getCorsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.some(allowed => origin && origin.includes(allowed.replace("https://", "").replace("http://", "")));

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json"
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function doGet(e) {
  const origin = e.parameter.origin || "*";
  const headers = getCorsHeaders(origin);

  try {
    const result = handleRequest(e);
    return createJsonResponse(result, headers);
  } catch (error) {
    Logger.log("GET ERROR: " + error);
    return createJsonResponse({
      success: false,
      status: "error",
      message: "An error occurred: " + error.message
    }, headers);
  }
}

function doPost(e) {
  const origin = e.parameter.origin || "*";
  const headers = getCorsHeaders(origin);

  try {
    const result = handleRequest(e);
    return createJsonResponse(result, headers);
  } catch (error) {
    Logger.log("POST ERROR: " + error);
    return createJsonResponse({
      success: false,
      status: "error",
      message: "An error occurred: " + error.message
    }, headers);
  }
}

function doOptions(e) {
  const origin = e.parameter.origin || "*";
  const headers = getCorsHeaders(origin);
  return createJsonResponse({}, headers);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REQUEST PROCESSOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function handleRequest(e) {
  const params = e.parameter;
  const email = params.email?.toLowerCase().trim();
  const appId = params.app || "unknown";
  const action = params.action || "check";

  Logger.log(`Request: action=${action}, email=${email}, app=${appId}`);

  // Validate email
  if (!email || !isValidEmail(email)) {
    return {
      success: false,
      status: "invalid_email",
      message: "Invalid email format. Please use a valid email address."
    };
  }

  // ─── ACTION 1: CHECK if user is already a member ───
  if (action === "check") {
    const isMember = isGroupMember(email);
    Logger.log(`Check result for ${email}: isMember=${isMember}`);

    return {
      success: true,
      status: "check_complete",
      isMember: isMember,
      email: email,
      message: isMember ? "Already a member" : "Not yet a member"
    };
  }

  // ─── ACTION 2: ADD user to group ───
  if (action === "join") {
    const isMember = isGroupMember(email);

    // If already member, don't add again
    if (isMember) {
      logUserAction(email, appId, "already_member");
      return {
        success: true,
        status: "already_member",
        message: "You are already a member of the testing group!",
        playStoreUrl: params.playStoreUrl || "#"
      };
    }

    // Add to group
    const addResult = addMemberToGroup(email);

    if (addResult.success) {
      logUserAction(email, appId, "joined_success");
      return {
        success: true,
        status: "joined_success",
        message: "Successfully added to testing group! Redirecting to Google Play...",
        playStoreUrl: params.playStoreUrl || "#"
      };
    } else {
      logUserAction(email, appId, "join_failed", addResult.error);
      return {
        success: false,
        status: "join_failed",
        message: addResult.error || "Failed to join group. Please try again or contact support."
      };
    }
  }

  return {
    success: false,
    status: "invalid_action",
    message: "Invalid action. Use 'check' or 'join'."
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GROUP MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if email is member of Google Group
 */
function isGroupMember(email) {
  try {
    const members = AdminDirectory.Members.list(GROUP_EMAIL, { 
      maxResults: 500,
      includeDerivedMembership: true
    });

    if (members.members && members.members.length > 0) {
      for (let member of members.members) {
        if (member.email && member.email.toLowerCase() === email.toLowerCase()) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    Logger.log("Check member error: " + error);
    // If API error, assume not member to avoid blocking
    return false;
  }
}

/**
 * Add email to Google Group as MEMBER
 */
function addMemberToGroup(email) {
  try {
    // Pre-check to avoid duplicate errors
    if (isGroupMember(email)) {
      return { success: true, message: "User already a member" };
    }

    // Add as member (not owner/manager)
    AdminDirectory.Members.insert(
      {
        email: email,
        role: "MEMBER",
        delivery_settings: "ALL_MAIL"
      },
      GROUP_EMAIL
    );

    Logger.log("✅ Added to group: " + email);
    return { success: true, message: "Successfully added" };

  } catch (error) {
    Logger.log("❌ Add member error: " + error);

    const errorMsg = error.toString().toLowerCase();

    // Handle specific errors
    if (errorMsg.includes("duplicate") || errorMsg.includes("already") || errorMsg.includes("member already exists")) {
      return { success: true, message: "User already a member" };
    }
    if (errorMsg.includes("invalid") || errorMsg.includes("invalid email")) {
      return { success: false, error: "Invalid email address. Please use a valid Gmail/Google account." };
    }
    if (errorMsg.includes("not found") || errorMsg.includes("resource not found")) {
      return { success: false, error: "Group not found. Please check the GROUP_EMAIL configuration." };
    }
    if (errorMsg.includes("forbidden") || errorMsg.includes("not authorized")) {
      return { success: false, error: "Permission denied. Make sure the script owner has Admin Directory API access and is a manager of the group." };
    }
    if (errorMsg.includes("rate limit") || errorMsg.includes("quota")) {
      return { success: false, error: "Rate limit exceeded. Please try again in a few minutes." };
    }

    return { success: false, error: "Failed to add to group: " + error.message };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate email format
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Log user action to Google Sheet (optional)
 */
function logUserAction(email, appId, action, details = "") {
  try {
    if (!SHEET_ID || SHEET_ID === "YOUR_SHEET_ID") return;

    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    const timestamp = new Date().toISOString();

    sheet.appendRow([
      timestamp,
      email,
      appId,
      action,
      details,
      "✅"
    ]);
  } catch (error) {
    Logger.log("Logging error: " + error);
  }
}

/**
 * Create JSON response with CORS headers
 */
function createJsonResponse(data, headers) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  // Set custom headers (note: some headers may be stripped by Apps Script)
  for (const [key, value] of Object.entries(headers)) {
    try {
      output.setHeader(key, value);
    } catch (e) {
      // Some headers cannot be set, ignore
    }
  }

  return output;
}

/**
 * Test function (run manually in Apps Script editor)
 */
function testMembershipCheck() {
  const testEmail = "your-test-email@gmail.com";
  const isMember = isGroupMember(testEmail);
  Logger.log(`Test: ${testEmail} is member = ${isMember}`);
}

/**
 * Test function for adding member
 */
function testAddMember() {
  const testEmail = "your-test-email@gmail.com";
  const result = addMemberToGroup(testEmail);
  Logger.log(`Test add: ${JSON.stringify(result)}`);
}
