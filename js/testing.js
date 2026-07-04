/**
 * Testing Group Auto-Join Handler
 * 
 * SETUP:
 * 1. Deploy Google Apps Script and copy the deployment URL
 * 2. Paste URL in APPS_SCRIPT_URL variable below
 * 3. Update app configuration in APPS_CONFIG
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG - UPDATE WITH YOUR APPS SCRIPT DEPLOYMENT URL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const APPS_SCRIPT_URL = "https://script.google.com/macros/d/YOUR_SCRIPT_ID/userweb"; // Paste your deployment URL here

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INITIALIZE ON PAGE LOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

document.addEventListener('DOMContentLoaded', function() {
  setupTestingButtons();
});

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
 * Main handler for Join Testing flow
 */
async function handleJoinTesting(appId) {
  // Get user email via modal
  const email = await promptUserEmail();
  
  if (!email) {
    showNotification('Cancelled', 'You cancelled the join request.', 'info');
    return;
  }

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
      app: appId,
      action: "check"
    });

    if (!checkResult.success) {
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
        window.open(APPS_CONFIG[appId]?.testUrl, '_blank');
      }, 1500);
      return;
    }

    // Step 2: Join user to group
    const joinResult = await callAppsScript({
      email: email,
      app: appId,
      action: "join",
      playStoreUrl: APPS_CONFIG[appId]?.testUrl
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
        window.open(APPS_CONFIG[appId]?.testUrl, '_blank');
      }, 2000);
    } else {
      showNotification(
        'Join Failed',
        joinResult.message || 'Failed to join the testing group. Please try again.',
        'error'
      );
    }

  } catch (error) {
    joinNotif.remove();
    showNotification(
      'Error',
      'Network error: ' + error.message,
      'error'
    );
  }
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
 * Prompt user to enter email
 */
function promptUserEmail() {
  return new Promise((resolve) => {
    const modal = createEmailModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'email-modal-backdrop';
    
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    const emailInput = modal.querySelector('.email-input');
    const submitBtn = modal.querySelector('.email-submit');
    const cancelBtn = modal.querySelector('.email-cancel');

    // Focus on input
    setTimeout(() => emailInput.focus(), 100);

    // Submit handler
    const handleSubmit = () => {
      const email = emailInput.value.trim();
      
      if (!isValidEmail(email)) {
        showNotification('Invalid Email', 'Please enter a valid Gmail address.', 'error');
        return;
      }
      
      cleanupModal(modal, backdrop);
      resolve(email);
    };

    // Cancel handler
    const handleCancel = () => {
      cleanupModal(modal, backdrop);
      resolve(null);
    };

    submitBtn.addEventListener('click', handleSubmit);
    cancelBtn.addEventListener('click', handleCancel);
    emailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });

    backdrop.addEventListener('click', handleCancel);
  });
}

/**
 * Create email modal HTML
 */
function createEmailModal() {
  const modal = document.createElement('div');
  modal.className = 'email-modal';
  modal.innerHTML = `
    <div class="email-modal-content">
      <h3>Join Testing Group</h3>
      <p>Enter your Gmail address to be added to the testing group:</p>
      
      <div class="email-input-group">
        <input 
          type="email" 
          class="email-input" 
          placeholder="your.email@gmail.com"
          autocomplete="email"
        />
      </div>
      
      <div class="email-modal-actions">
        <button class="email-submit btn btn--primary">
          <i class="ti ti-check" aria-hidden="true"></i> Join Group
        </button>
        <button class="email-cancel btn btn--secondary">
          <i class="ti ti-x" aria-hidden="true"></i> Cancel
        </button>
      </div>
      
      <p class="email-modal-info">
        <i class="ti ti-info-circle" aria-hidden="true"></i>
        Use the same Gmail for both the testing group and Google Play.
      </p>
    </div>
  `;
  
  return modal;
}

/**
 * Clean up modal and backdrop
 */
function cleanupModal(modal, backdrop) {
  modal.remove();
  backdrop.remove();
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

/**
 * Validate email format
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
