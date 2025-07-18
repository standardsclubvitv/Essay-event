let firebaseConfig = {};
let auth = null;

// Obfuscated Firebase configuration (keys are split and encoded)
const getFirebaseConfig = () => {
    // Split keys to avoid direct exposure
    const parts = {
        p1: "AIzaSyCrVQyQBJcf5ilOjg-X1",
        p2: "_rjTUvhvLVDqEY",
        d1: "online-events-51042",
        d2: "firebaseapp.com",
        p3: "online-events-51042",
        s1: "firebasestorage.app",
        m1: "706186554711",
        a1: "1:706186554711:web:b58f0b6795216ef1726212",
        g1: "G-CEPW7QBLJG"
    };
    
    return {
        apiKey: parts.p1 + parts.p2,
        authDomain: parts.d1 + "." + parts.d2,
        projectId: parts.d1,
        storageBucket: parts.p3 + "." + parts.s1,
        messagingSenderId: parts.m1,
        appId: parts.a1,
        measurementId: parts.g1
    };
};

// Initialize floating letters animation
function initFloatingLetters() {
    const letters = document.querySelectorAll('.letter');
    letters.forEach((letter, index) => {
        const duration = Math.random() * 10 + 15; // 15-25 seconds
        const delay = Math.random() * 5; // 0-5 seconds
        
        letter.style.animationDuration = `${duration}s`;
        letter.style.animationDelay = `${delay}s`;
        
        const randomLeft = Math.random() * 10 - 5; // -5% to +5%
        const currentLeft = parseFloat(letter.style.left || '0');
        letter.style.left = `${Math.max(0, Math.min(100, currentLeft + randomLeft))}%`;
    });
}

// Load Firebase config with API fallback
async function loadFirebaseConfig() {
    try {
        console.log('Loading Firebase configuration...');
        showLoading(true);
        
        // First try to get config from API (with short timeout)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch('/api/config', {
                signal: controller.signal,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    console.log('Config loaded from API');
                    firebaseConfig = data;
                } else {
                    throw new Error('Invalid response format');
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (apiError) {
            console.log('API config failed, using local config:', apiError.message);
            // Use local obfuscated config
            firebaseConfig = getFirebaseConfig();
        }
        
        console.log('Firebase config ready');
        await initializeFirebase();
        
    } catch (error) {
        console.error('Error loading Firebase config:', error);
        showError('Failed to load configuration. Please refresh the page and try again.');
        showLoading(false);
    }
}

// Initialize Firebase
async function initializeFirebase() {
    try {
        console.log('Initializing Firebase...');
        
        // Validate config
        if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
            throw new Error('Invalid Firebase configuration');
        }
        
        // Import Firebase modules with error handling
        const firebaseApp = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js');
        const firebaseAuth = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js');
        
        // Initialize Firebase
        const app = firebaseApp.initializeApp(firebaseConfig);
        auth = firebaseAuth.getAuth(app);
        
        console.log('Firebase initialized successfully');
        
        // Set up auth state listener
        firebaseAuth.onAuthStateChanged(auth, (user) => {
            console.log('Auth state changed:', user ? 'signed in' : 'signed out');
            if (user) {
                console.log('User signed in:', user.email);
                showSuccessMessage();
                // Redirect after delay
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);
            } else {
                showLoading(false);
            }
        });
        
        // Set up Google sign-in
        const provider = new firebaseAuth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        // Setup click handler
        setupGoogleSignIn(provider, firebaseAuth);
        
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showError('Failed to initialize authentication. Please refresh the page and try again.');
        showLoading(false);
    }
}

// Setup Google Sign-In
function setupGoogleSignIn(provider, firebaseAuth) {
    const googleSignInBtn = document.getElementById('googleSignIn');
    
    if (!googleSignInBtn) {
        console.error('Google sign-in button not found');
        return;
    }
    
    // Remove any existing listeners
    googleSignInBtn.replaceWith(googleSignInBtn.cloneNode(true));
    const newBtn = document.getElementById('googleSignIn');
    
    newBtn.addEventListener('click', async () => {
        try {
            console.log('Google sign-in initiated');
            showLoading(true);
            hideError();
            
            // Add loading state to button
            newBtn.disabled = true;
            newBtn.style.opacity = '0.7';
            newBtn.style.cursor = 'not-allowed';
            
            // Attempt sign in
            const result = await firebaseAuth.signInWithPopup(auth, provider);
            console.log('Sign in successful:', result.user.email);
            
            // Success handling is done in onAuthStateChanged
            
        } catch (error) {
            console.error('Error signing in:', error);
            
            // Re-enable button
            newBtn.disabled = false;
            newBtn.style.opacity = '1';
            newBtn.style.cursor = 'pointer';
            
            // Show appropriate error message
            let errorMessage = 'Failed to sign in. Please try again.';
            
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                    errorMessage = 'Sign in was cancelled. Please try again.';
                    break;
                case 'auth/popup-blocked':
                    errorMessage = 'Pop-up blocked. Please allow pop-ups for this site and try again.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your connection and try again.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many attempts. Please wait a moment and try again.';
                    break;
                case 'auth/unauthorized-domain':
                    errorMessage = 'This domain is not authorized for Google sign-in.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Google sign-in is not enabled. Please contact support.';
                    break;
                case 'auth/invalid-api-key':
                    errorMessage = 'Authentication service unavailable. Please try again later.';
                    break;
                default:
                    errorMessage = `Sign in failed: ${error.message}`;
            }
            
            showError(errorMessage);
            showLoading(false);
        }
    });
}

// Show loading state
function showLoading(show) {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const googleBtn = document.getElementById('googleSignIn');
    
    if (show) {
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (googleBtn) googleBtn.style.display = 'none';
    } else {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'flex';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) return;
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Add shake animation to error
    errorDiv.style.animation = 'shake 0.5s ease-in-out';
    
    // Hide error after 10 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
        errorDiv.style.animation = '';
    }, 10000);
}

// Hide error message
function hideError() {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// Show success message
function showSuccessMessage() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const loadingText = loadingSpinner ? loadingSpinner.querySelector('p') : null;
    
    if (loadingText) {
        loadingText.textContent = 'Sign in successful! Redirecting...';
        loadingText.style.color = '#27ae60';
        loadingText.style.fontWeight = '600';
    }
    
    // Change spinner color to green
    const spinner = loadingSpinner ? loadingSpinner.querySelector('.spinner') : null;
    if (spinner) {
        spinner.style.borderTopColor = '#27ae60';
    }
}

// Add CSS animations and styles
function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        
        .google-btn:disabled {
            cursor: not-allowed !important;
            opacity: 0.7 !important;
        }
        
        .error-message {
            animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .loading {
            animation: fadeIn 0.3s ease-in;
        }
        
        .google-btn {
            transition: all 0.3s ease;
        }
        
        .google-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }
    `;
    document.head.appendChild(style);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing login page...');
    
    // Add styles
    addStyles();
    
    // Initialize floating letters animation
    initFloatingLetters();
    
    // Load Firebase config and initialize
    loadFirebaseConfig();
    
    // Add keyboard support for Enter key
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const googleBtn = document.getElementById('googleSignIn');
            if (googleBtn && googleBtn.style.display !== 'none' && !googleBtn.disabled) {
                googleBtn.click();
            }
        }
    });
});

// Handle page visibility change to pause/resume animations
document.addEventListener('visibilitychange', () => {
    const letters = document.querySelectorAll('.letter');
    letters.forEach(letter => {
        if (document.hidden) {
            letter.style.animationPlayState = 'paused';
        } else {
            letter.style.animationPlayState = 'running';
        }
    });
});

// Add error handling for uncaught errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (event.error.message.includes('Firebase') || event.error.message.includes('auth')) {
        showError('Authentication service error. Please refresh the page and try again.');
    }
});

// Add error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (event.reason.message && (event.reason.message.includes('Firebase') || event.reason.message.includes('auth'))) {
        showError('Authentication service error. Please refresh the page and try again.');
    }
});

// Connection status monitoring
function monitorConnection() {
    window.addEventListener('online', () => {
        console.log('Connection restored');
        hideError();
    });
    
    window.addEventListener('offline', () => {
        console.log('Connection lost');
        showError('Internet connection lost. Please check your connection and try again.');
    });
}

// Initialize connection monitoring
monitorConnection();

// Cleanup function
window.addEventListener('beforeunload', () => {
    // Clean up any listeners or timers if needed
    console.log('Page unloading...');
});
