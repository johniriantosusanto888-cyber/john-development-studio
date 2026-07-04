/**
 * John Development Studio — Testing Group Auto-Join Handler v2.0
 * 
 * FLOW:
 * 1. User clicks "Join Testing" → Show Google Sign-In modal
 * 2. User signs in with Google → Get JWT credential (email auto-extracted)
 * 3. Send email to Google Apps Script → Check if already member
 * 4. If member → Redirect to Play Store Testing link
 * 5. If not member → Auto-add to Google Group → Then redirect
 */

// ═══════════════════════════════════════════════════════════════
// CONFIG — SUDAH TERISI, JANGAN DIUBAH
// ═══════════════════════════════════════════════════════════════

const GOOGLE_CLIENT_ID = "378583719250-do9plu6j2od7et6delcc1ausdi1p4cil.apps.googleusercontent.com";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxpkvNug-s5j2-DT1D56Bw1akT-C5ML8JkUPz0b1csLmSHm_OY_-X3iDVTBQCRUnnmIAw/exec";

const APPS_CONFIG = {
  "brewmaster": {
    name: "BrewMaster",
    packageName: "com.johniriantosusanto.brewmasterapp",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.johniriantosusanto.brewmasterapp",
    testUrl: "https://play.google.com/apps/testing/com.johniriantosusanto.brewmasterapp"
  },
  "lanchat": {
    name: "LanChat",
    packageName: "com.johniriantosusanto.lanchat",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.johniriantosusanto.lanchat",
    testUrl: "https://play.google.com/apps/testing/com.johniriantosusanto.lanchat"
  },
  "file-server": {
    name: "Android File Server",
    packageName: "com.johniriantosusanto.androidfileserverapp",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.johniriantosusanto.androidfileserverapp",
    testUrl: "https://play.google.com/apps/testing/com.johniriantosusanto.androidfileserverapp"
  },
  "nfc-manager": {
    name: "NFC Card Manager",
    packageName: "com.johniriantosusanto.nfccardmanager",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.johniriantosusanto.nfccardmanager",
    testUrl: "https://play.google.com/apps/testing/com.johniriantosusanto.nfccardmanager"
  }
};

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let currentAppId = null;
let googleAccounts = null;

// ═══════════════════════════════════════════════════════════════
// INITIALIZE
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  initGoogleSignIn();
  setupTestingButtons();
  setupModalClose();
});

/**
 * Initialize Google Identity Services
 */
function initGoogleSignIn() {
  const checkGIS = setInterval(() => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      clearInterval(checkGIS);
      googleAccounts = window.google.accounts.id;

      googleAccounts.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });
    }
  }, 100);
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
 * Setup modal close handlers
 */
function setupModalClose() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  const backdrop = modal.querySelector('.modal-backdrop');
  const closeBtn = modal.querySelector('.modal-close');

  [backdrop, closeBtn].forEach(el => {
    if (el) el.addEventListener('click', () => hideAuthModal());
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN FLOW
// ═══════════════════════════════════════════════════════════════

/**
 * Main handler for Join Testing flow
 */
function handleJoinTesting(appId) {
  currentAppId = appId;

  // Check if user already has a stored credential
  const storedEmail = localStorage.getItem('jds_user_email');

  if (storedEmail) {
    processMembershipCheck(storedEmail, appId);
  } else {
    showAuthModal();
  }
}

/**
 * Handle Google Sign-In credential response (JWT)
 */
function handleCredentialResponse(response) {
  const credential = response.credential;
  const payload = parseJwt(credential);
  const email = payload.email;

  if (!email) {
    hideAuthModal();
    showToast('Error', 'Could not get email from Google Sign-In.', 'error');
    return;
  }

  localStorage.setItem('jds_user_email', email);
  localStorage.setItem('jds_user_name', payload.name || '');
  localStorage.setItem('jds_user_picture', payload.picture || '');

  hideAuthModal();

  if (currentAppId) {
    processMembershipCheck(email, currentAppId);
  }
}

/**
 * Check membership and auto-join if needed
 */
async function processMembershipCheck(email, appId) {
  showLoading('Checking your testing group membership...');

  try {
    // Step 1: Check if already member
    const checkResult = await callAppsScript({
      email: email,
      app: appId,
      action: "check"
    });

    if (!checkResult.success) {
      hideLoading();
      showToast('Error', checkResult.message || 'Failed to check membership.', 'error');
      return;
    }

    // If already member, redirect immediately
    if (checkResult.isMember) {
      hideLoading();
      showToast(
        'Already a Member! 🎉',
        `You are already in the testing group for ${APPS_CONFIG[appId]?.name || appId}. Redirecting...`,
        'success',
        3000
      );

      setTimeout(() => {
        window.open(APPS_CONFIG[appId]?.testUrl, '_blank');
      }, 1500);
      return;
    }

    // Step 2: Not a member — auto-add to group
    showLoading('Adding you to the testing group...');

    const joinResult = await callAppsScript({
      email: email,
      app: appId,
      action: "join",
      playStoreUrl: APPS_CONFIG[appId]?.testUrl
    });

    hideLoading();

    if (joinResult.success) {
      showToast(
        'Successfully Joined! 🎉',
        `You have been added to the testing group. Redirecting to Google Play...`,
        'success',
        3000
      );

      setTimeout(() => {
        window.open(APPS_CONFIG[appId]?.testUrl, '_blank');
      }, 2000);
    } else {
      showToast(
        'Join Failed',
        joinResult.message || 'Failed to join the testing group. Please try again or contact support.',
        'error'
      );
    }

  } catch (error) {
    hideLoading();
    console.error('Membership check error:', error);
    showToast('Error', 'Network error: ' + error.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// API CALL
// ═══════════════════════════════════════════════════════════════

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
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Apps Script error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Show Google Sign-In modal
 */
function showAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) {
    // Fallback: create modal dynamically if not in DOM
    createAuthModal();
    return;
  }
  modal.style.display = 'flex';

  if (googleAccounts) {
    googleAccounts.renderButton(
      document.getElementById('g_id_signin'),
      { 
        theme: 'outline', 
        size: 'large',
        width: 250,
        text: 'signin_with'
      }
    );
  }
}

/**
 * Create auth modal dynamically (fallback)
 */
function createAuthModal() {
  const existing = document.getElementById('auth-modal');
  if (existing) { existing.style.display = 'flex'; return; }

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div class="modal-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);"></div>
    <div class="modal-content" style="position:relative;background:#1e1e2e;border:1px solid #313244;border-radius:16px;padding:2rem;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
      <h3 style="color:#cdd6f4;margin-bottom:0.5rem;">Join Testing Group</h3>
      <p style="color:#a6adc8;margin-bottom:1.5rem;font-size:0.95rem;">Sign in with your Google account to check your testing group membership.</p>
      <div id="g_id_signin" style="margin:1rem 0;display:flex;justify-content:center;"></div>
      <button class="modal-close" style="background:#313244;color:#cdd6f4;border:none;padding:0.6rem 1.2rem;border-radius:8px;margin-top:1rem;cursor:pointer;">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.modal-backdrop').addEventListener('click', () => hideAuthModal());
  modal.querySelector('.modal-close').addEventListener('click', () => hideAuthModal());

  if (googleAccounts) {
    setTimeout(() => {
      googleAccounts.renderButton(
        document.getElementById('g_id_signin'),
        { theme: 'outline', size: 'large', width: 250, text: 'signin_with' }
      );
    }, 100);
  }
}

/**
 * Hide auth modal
 */
function hideAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * Show loading overlay
 */
function showLoading(message) {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;';
    overlay.innerHTML = `
      <div style="width:48px;height:48px;border:4px solid #313244;border-top-color:#89b4fa;border-radius:50%;animation:spin 1s linear infinite;"></div>
      <p style="color:#cdd6f4;font-size:1rem;">${message}</p>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('p').textContent = message;
    overlay.style.display = 'flex';
  }
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

/**
 * Show toast notification
 */
function showToast(title, message, type, duration) {
  duration = duration || 4000;
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;z-index:10000;display:flex;flex-direction:column;gap:0.75rem;pointer-events:none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const borderColors = { success: '#a6e3a1', error: '#f38ba8', info: '#89b4fa' };
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  toast.style.cssText = `display:flex;align-items:flex-start;gap:0.75rem;background:#1e1e2e;border:1px solid #313244;border-left:4px solid ${borderColors[type]||borderColors.info};border-radius:10px;padding:1rem 1.25rem;max-width:380px;box-shadow:0 8px 30px rgba(0,0,0,0.3);pointer-events:auto;opacity:0;transform:translateX(30px);transition:all 0.35s cubic-bezier(0.16,1,0.3,1);`;

  toast.innerHTML = `
    <div style="font-size:1.25rem;flex-shrink:0;margin-top:2px;">${icons[type]||icons.info}</div>
    <div style="flex:1;min-width:0;">
      <div style="color:#cdd6f4;font-weight:600;font-size:0.95rem;margin-bottom:0.25rem;">${title}</div>
      <div style="color:#a6adc8;font-size:0.85rem;line-height:1.4;">${message}</div>
    </div>
    <button style="background:none;border:none;color:#6c7086;font-size:1.25rem;cursor:pointer;padding:0;line-height:1;" onclick="this.parentElement.style.opacity='0';this.parentElement.style.transform='translateX(30px)';setTimeout(()=>this.parentElement.remove(),300)">&times;</button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; });

  if (duration > 0 && type !== 'loading') {
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return toast;
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('JWT parse error:', e);
    return {};
  }
}

function clearUserSession() {
  localStorage.removeItem('jds_user_email');
  localStorage.removeItem('jds_user_name');
  localStorage.removeItem('jds_user_picture');
  showToast('Session Cleared', 'Your sign-in data has been cleared.', 'info');
}

window.clearUserSession = clearUserSession;
window.JDS = { clearUserSession, APPS_CONFIG };
