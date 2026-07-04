/**
 * Google Apps Script - Auto-Add Member to Google Group
 * Deploy as web app with "Execute as me" and "Anyone" access
 * 
 * SETUP:
 * 1. Create new Google Apps Script in Google Cloud Console
 * 2. Copy this code
 * 3. Enable Admin Directory API
 * 4. Deploy as web app (New deployment > Web app > Execute as: Me > Access: Anyone)
 * 5. Copy deployment URL and paste in js/testing.js
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG - UPDATE WITH YOUR DETAILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GROUP_EMAIL = "john-development-studio@googlegroups.com"; // Your Google Group email
const SHEET_ID = "YOUR_SHEET_ID"; // Optional: Log user joins to Google Sheet

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function doPost(e) {
  try {
    const params = e.parameter;
    const email = params.email?.toLowerCase().trim();
    const appId = params.app || "unknown";
    const action = params.action || "check";

    // Validate email
    if (!email || !isValidEmail(email)) {
      return sendJson({
        success: false,
        status: "invalid_email",
        message: "Invalid email format. Please use your Gmail address."
      });
    }

    // ─── ACTION 1: CHECK if user is already a member ───
    if (action === "check") {
      const isMember = isGroupMember(email);
      return sendJson({
        success: true,
        status: "check_complete",
        isMember: isMember,
        email: email,
        message: isMember ? "Already a member" : "Not yet a member"
      });
    }

    // ─── ACTION 2: ADD user to group ───
    if (action === "join") {
      const isMember = isGroupMember(email);
      
      // If already member, don't add again
      if (isMember) {
        logUserAction(email, appId, "already_member");
        return sendJson({
          success: true,
          status: "already_member",
          message: "You are already a member of the testing group!"
        });
      }

      // Add to group
      const addResult = addMemberToGroup(email);
      
      if (addResult.success) {
        logUserAction(email, appId, "joined_success");
        return sendJson({
          success: true,
          status: "joined_success",
          message: "Successfully added to testing group! Redirecting to Google Play...",
          playStoreUrl: params.playStoreUrl || "#"
        });
      } else {
        logUserAction(email, appId, "join_failed", addResult.error);
        return sendJson({
          success: false,
          status: "join_failed",
          message: addResult.error || "Failed to join group. Please try again or contact support."
        });
      }
    }

    return sendJson({
      success: false,
      status: "invalid_action",
      message: "Invalid action"
    });

  } catch (error) {
    Logger.log("ERROR: " + error);
    return sendJson({
      success: false,
      status: "error",
      message: "An error occurred: " + error.message
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if email is member of Google Group
 */
function isGroupMember(email) {
  try {
    const members = AdminDirectory.Members.list(GROUP_EMAIL, { maxResults: 500 });
    
    if (members.members && members.members.length > 0) {
      for (let member of members.members) {
        if (member.email.toLowerCase() === email.toLowerCase()) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    Logger.log("Check member error: " + error);
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
        role: "MEMBER"
      },
      GROUP_EMAIL
    );

    Logger.log("✅ Added to group: " + email);
    return { success: true, message: "Successfully added" };

  } catch (error) {
    Logger.log("❌ Add member error: " + error);
    
    const errorMsg = error.toString();
    
    // Handle specific errors
    if (errorMsg.includes("duplicate") || errorMsg.includes("already")) {
      return { success: true, message: "User already a member" };
    }
    if (errorMsg.includes("invalid") || errorMsg.includes("Invalid")) {
      return { success: false, error: "Invalid email address" };
    }
    if (errorMsg.includes("not found")) {
      return { success: false, error: "Group not found. Check GROUP_EMAIL config." };
    }
    
    return { success: false, error: "Failed to add to group" };
  }
}

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
    const timestamp = new Date().toLocaleString();
    
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
 * Return JSON response
 */
function sendJson(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Support GET requests too
 */
function doGet(e) {
  return doPost(e);
}
