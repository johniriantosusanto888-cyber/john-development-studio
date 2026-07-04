/**
 * Google Sign-In Testing Handler
 * Auto-detect user's Gmail and add to testing group
 * 
 * SETUP:
 * 1. Create OAuth 2.0 Client ID on Google Cloud Console
 * 2. Paste Client ID in GOOGLE_CLIENT_ID below
 * 3. Deploy Google Apps Script (same as before)
 * 4. Update APPS_SCRIPT_URL
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG - UPDATE WITH YOUR GOOGLE OAUTH CLIENT ID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; // From Google Cloud Console
const APPS_SCRIPT_URL = "https://script.google.com/macros/d/YOUR_SCRIPT_ID/userweb"; // From deployment

const APPS_CONFIG = {
  "battery-health": {
    name: "Battery Health Check & Alarm",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.johniriantosusanto.batteryhealthcheckapp",
    testUrl: "https://play.google.com/apps/testing/com.johniriantosusanto.batteryhealthcheckapp"
  },
  "brewmaster": {
    name: "BrewMaster",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.johniriantosusanto.brewmasterapp",
    testUrl: "https://play.google.com/apps/testing/com.johniriantosusanto.brewmasterapp"
  },
  "lanchat": {
    name: "LanChat",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.johniriantosusanto.lanchat",
    testUrl: "https://play.google.com/apps/testing/com.johniriantosusanto.lanchatapp"
  },
  "file-server": {
    name: "Android File Server",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.johniriantosusanto.androidfileserverapp",
    testUrl: "https://play.google.com/apps/testing/com.johniriantosusanto.androidfileserverapp"
  },
  "nfc-manager": {
    name: "NFC Card Manager",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.johniriantosusanto.nfccardmanager",
    testUrl: "https://play.google.com/apps/testing/com.johniriantosusanto.nfccardmanagerapp"
  }
};

// Global variable to store current app ID
let currentAppId = null;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INITIALIZE ON PAGE LOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

document.addEventListener('DOMContentLoaded', function() {
  initializeGoogleSignIn();
  setupTestingButtons();
});

/**
 * Initialize Google Sign-In
 */
function initializeGoogleSignIn() {
  window.onload = function() {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn
    });
  };
}

/**
 * Setup click handlers for all "Join Testing" buttons
 */
function setupTestingButtons() {
  const testButtons = document.querySelectorAll('[data-test-app]');
  
  testButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const appId = this.getAttribute('data-test-app');
      handleJoinTesting(appId);
    });
  });
}

/**
 * Handle Join Testing flow
 */
function handleJoinTesting(appId) {
  currentAppId = appId;
  
  // Show Google Sign-In prompt
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // If prompt not shown, render explicit button
      showGoogleSignInDialog(appId);
    }
  });
}

/**
 * Show explicit Google Sign-In dialog
 */
function showGoogleSignInDialog(appId) {
  const modal = document.createElement('div');
  modal.className = 'email-modal-backdrop';
  modal.innerHTML = `
    <div class="email-modal">
      <div class="email-modal-content">
        <h3>Join Testing Group</h3>
        <p>Sign in with your Google account to be automatically added to the testing group.</p>
        
        <div style="margin: 24px 0;">
          <div id="google-signin-button"></div>
        </div>
        
        <button class="btn btn--secondary" style="width: 100%;">
          <i class="ti ti-x"></i> Cancel
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Render Google Sign-In button
  google.accounts.id.renderButton(
    document.getElementById('google-signin-button'),
    {
      type: 'standard',
      size: 'large',
      theme: 'outline',
      logo_alignment: 'center'
    }
  );
  
  // Cancel button
  modal.querySelector('.btn--secondary').addEventListener('click', () => {
    modal.remove();
    currentAppId = null;
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      currentAppId = null;
    }
  });
}

/**
 * Handle Google Sign-In callback
 */
async function handleGoogleSignIn(response) {
  if (!response.credential) {
    showNotification('Error', 'Failed to get credential', 'error');
    return;
  }
  
  // Decode JWT token to get email
  const decoded = jwt_decode(response.credential);
  const email = decoded.email;
  
  if (!currentAppId) {
    showNotification('Error', 'App ID not found', 'error');
    return;
  }
  
  // Remove modal if visible
  const modal = document.querySelector('.email-modal-backdrop');
  if (modal) modal.remove();
  
  // Show joining notification
  const joinNotif = showNotification(
    'Joining Testing Group...',
    `Adding ${email} to the testing group. Please wait...`,
    'loading'
  );

  try {
    // Step 1: Check if already member
    const checkResult = await callAppsScript({
      email: email,
      app: currentAppId,
      action: "check"
    });

    if (!checkResult.success) {
      joinNotif.remove();
      showNotification(
        'Error',
        checkResult.message || 'An error occurred while checking membership.',
        'error'
      );
      return;
    }

    // If already member, skip to Play Store
    if (checkResult.isMember) {
      joinNotif.remove();
      showNotification(
        'Already a Member! 🎉',
        'You are already part of the testing group. Redirecting to Google Play...',
        'success',
        3000
      );
      
      setTimeout(() => {
        window.open(APPS_CONFIG[currentAppId]?.testUrl, '_blank');
        currentAppId = null;
      }, 1500);
      return;
    }

    // Step 2: Join user to group
    const joinResult = await callAppsScript({
      email: email,
      app: currentAppId,
      action: "join",
      playStoreUrl: APPS_CONFIG[currentAppId]?.testUrl
    });

    joinNotif.remove();

    if (joinResult.success) {
      showNotification(
        'Successfully Joined! 🎉',
        'You have been added to the testing group. Redirecting to Google Play...',
        'success',
        3000
      );
      
      // Redirect to Play Store after 2 seconds
      setTimeout(() => {
        window.open(APPS_CONFIG[currentAppId]?.testUrl, '_blank');
        currentAppId = null;
      }, 2000);
    } else {
      showNotification(
        'Join Failed',
        joinResult.message || 'Failed to join the testing group. Please try again.',
        'error'
      );
      currentAppId = null;
    }

  } catch (error) {
    joinNotif.remove();
    showNotification(
      'Error',
      'Network error: ' + error.message,
      'error'
    );
    currentAppId = null;
  }
}

/**
 * Decode JWT token (Google's credential)
 */
function jwt_decode(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

/**
 * Call Google Apps Script endpoint
 */
async function callAppsScript(params) {
  const queryString = new URLSearchParams(params).toString();
  const url = `${APPS_SCRIPT_URL}?${queryString}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Apps Script error:', error);
    throw error;
  }
}

/**
 * Show notification toast
 */
function showNotification(title, message, type = 'info', duration = 4000) {
  const notification = document.createElement('div');
  notification.className = `notification notification--${type}`;
  
  const icon = getNotificationIcon(type);
  
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-icon">${icon}</div>
      <div class="notification-text">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" aria-label="Close notification">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Close button
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  });
  
  // Auto close
  if (duration > 0 && type !== 'loading') {
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
  
  return notification;
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type) {
  const icons = {
    success: '<i class="ti ti-circle-check-filled"></i>',
    error: '<i class="ti ti-alert-circle"></i>',
    info: '<i class="ti ti-info-circle"></i>',
    loading: '<i class="ti ti-loader-2"></i>'
  };
  return icons[type] || icons.info;
}
