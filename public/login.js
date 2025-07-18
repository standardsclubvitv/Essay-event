let firebaseConfig = {};
let auth = null;

// Initialize floating letters animation
function initFloatingLetters() {
    const letters = document.querySelectorAll('.letter');
    letters.forEach((letter, index) => {
        // Randomize animation duration and delay
        const duration = Math.random() * 10 + 15; // 15-25 seconds
        const delay = Math.random() * 5; // 0-5 seconds
        
        letter.style.animationDuration = `${duration}s`;
        letter.style.animationDelay = `${delay}s`;
        
        // Randomize horizontal position slightly
        const randomLeft = Math.random() * 10 - 5; // -5% to +5%
        const currentLeft = parseFloat(letter.style.left || '0');
        letter.style.left = `${Math.max(0, Math.min(100, currentLeft + randomLeft))}%`;
    });
}

// Load Firebase config from server
async function loadFirebaseConfig() {
    try {
        showLoading(true);
        const response = await fetch('/api/config');
        firebaseConfig = await response.json();
        await initializeFirebase();
    } catch (error) {
        console.error('Error loading Firebase config:', error);
        showError('Failed to load configuration. Please check your connection and try again.');
        showLoading(false);
    }
}

// Initialize Firebase
async function initializeFirebase() {
    try {
        // Import Firebase modules
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js');
        const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js');
        
        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        
        // Set up auth state listener
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is signed in, show success message and redirect
                showSuccessMessage();
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);
            } else {
                // User is not signed in, show login form
                showLoading(false);
            }
        });
        
        // Set up Google sign-in
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        document.getElementById('googleSignIn').addEventListener('click', async () => {
            try {
                showLoading(true);
                hideError();
                
                // Add loading state to button
                const button = document.getElementById('googleSignIn');
                button.disabled = true;
                button.style.opacity = '0.7';
                
                const result = await signInWithPopup(auth, provider);
                
                // Success will be handled by onAuthStateChanged
                console.log('Sign in successful:', result.user.email);
                
            } catch (error) {
                console.error('Error signing in:', error);
                
                // Re-enable button
                const button = document.getElementById('googleSignIn');
                button.disabled = false;
                button.style.opacity = '1';
                
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
                    default:
                        errorMessage = `Sign in failed: ${error.message}`;
                }
                
                showError(errorMessage);
                showLoading(false);
            }
        });
        
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showError('Failed to initialize authentication. Please refresh the page and try again.');
        showLoading(false);
    }
}

// Show loading state
function showLoading(show) {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const googleBtn = document.getElementById('googleSignIn');
    
    if (show) {
        loadingSpinner.style.display = 'block';
        googleBtn.style.display = 'none';
    } else {
        loadingSpinner.style.display = 'none';
        googleBtn.style.display = 'flex';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Add shake animation to error
    errorDiv.style.animation = 'shake 0.5s ease-in-out';
    
    // Hide error after 7 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
        errorDiv.style.animation = '';
    }, 7000);
}

// Hide error message
function hideError() {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.style.display = 'none';
}

// Show success message
function showSuccessMessage() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const loadingText = loadingSpinner.querySelector('p');
    
    if (loadingText) {
        loadingText.textContent = 'Sign in successful! Redirecting...';
        loadingText.style.color = '#27ae60';
        loadingText.style.fontWeight = '600';
    }
    
    // Change spinner color to green
    const spinner = loadingSpinner.querySelector('.spinner');
    if (spinner) {
        spinner.style.borderTopColor = '#27ae60';
    }
}

// Add shake animation to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Initialize floating letters animation
    initFloatingLetters();
    
    // Load Firebase config
    loadFirebaseConfig();
    
    // Add keyboard support for Enter key
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const googleBtn = document.getElementById('googleSignIn');
            if (googleBtn.style.display !== 'none') {
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
