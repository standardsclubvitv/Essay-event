let firebaseConfig = {};
let auth = null;
let db = null;
let currentUser = null;

// Store Firebase functions globally
let firebaseFunctions = {
    doc: null,
    setDoc: null,
    getDoc: null,
    updateDoc: null,
    collection: null,
    query: null,
    where: null,
    getDocs: null
};

// Store submitted essays
let submittedEssays = new Set();

// Obfuscated Firebase configuration (keys are split and encoded)
const getFirebaseConfig = () => {
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

const topics = [
    "BIS and Its Impact on Consumer Protection in India",
    "Do standards encourage or limit innovation in technology and industry?",
    "Does implementing standards increase the cost of production",
    "BIS's Role in Making Indian Exports Globally Competitive",
    "Comparison of BIS Standards with International Standards (ISO, IEC, etc.)",
    "How Standards Drive 'Make in India' and 'Atmanirbhar Bharat'",
    "How can we spread awareness about Indian standards to young generations",
    "How BIS Supports Scientific Advancements Through Technical Committees",
    "Integrating Indian Standards into School Education: Why It Matters",
    "Implementing Standards in Small-Scale Industries",
    "How do standards enforced by BIS help towards sustainability and environmental protection?"
];

// Load Firebase config with API fallback
async function loadFirebaseConfig() {
    try {
        console.log('Loading Firebase configuration...');
        
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
        
        // Import Firebase modules
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js');
        const { getAuth, onAuthStateChanged, signOut } = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js');
        const { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js');
        
        // Store Firebase functions globally
        firebaseFunctions.doc = doc;
        firebaseFunctions.setDoc = setDoc;
        firebaseFunctions.getDoc = getDoc;
        firebaseFunctions.updateDoc = updateDoc;
        firebaseFunctions.collection = collection;
        firebaseFunctions.query = query;
        firebaseFunctions.where = where;
        firebaseFunctions.getDocs = getDocs;
        
        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        console.log('Firebase initialized successfully');
        
        // Set up auth state listener
        onAuthStateChanged(auth, (user) => {
            console.log('Auth state changed:', user ? 'signed in' : 'signed out');
            if (user) {
                currentUser = user;
                initializeDashboard();
            } else {
                // User is not signed in, redirect to login
                console.log('User not authenticated, redirecting to login...');
                window.location.href = '/login';
            }
        });
        
        // Set up logout functionality
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    console.log('Logging out user...');
                    await signOut(auth);
                } catch (error) {
                    console.error('Error signing out:', error);
                    showError('Error signing out. Please try again.');
                }
            });
        }
        
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showError('Failed to initialize. Please refresh the page and try again.');
    }
}

// Initialize dashboard after user is authenticated
async function initializeDashboard() {
    try {
        console.log('Initializing dashboard for user:', currentUser.email);
        
        // Hide loading screen
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('dashboardContainer').style.display = 'block';
        
        // Display user name
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = currentUser.displayName || currentUser.email || 'User';
        }
        
        // Load submitted essays
        await loadSubmittedEssays();
        
        // Populate topics
        populateTopics();
        
        // Set up essay functionality
        setupEssayEditor();
        
        // Set up modal functionality
        setupModal();
        
        console.log('Dashboard initialized successfully');
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showError('Failed to initialize dashboard. Please refresh the page.');
    }
}

// Load submitted essays from Firestore
async function loadSubmittedEssays() {
    try {
        console.log('Loading submitted essays...');
        
        if (firebaseFunctions.getDocs && firebaseFunctions.collection && firebaseFunctions.query && firebaseFunctions.where) {
            const q = firebaseFunctions.query(
                firebaseFunctions.collection(db, 'submissions'),
                firebaseFunctions.where('userId', '==', currentUser.uid)
            );
            const querySnapshot = await firebaseFunctions.getDocs(q);
            
            submittedEssays.clear();
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                submittedEssays.add(data.topicIndex);
            });
            
            console.log('Loaded submitted essays:', Array.from(submittedEssays));
        }
    } catch (error) {
        console.error('Error loading submitted essays:', error);
        // Continue without submitted essays data
    }
}

// Populate topics grid
function populateTopics() {
    const topicsGrid = document.getElementById('topicsGrid');
    if (!topicsGrid) return;
    
    topicsGrid.innerHTML = '';
    
    topics.forEach((topic, index) => {
        const topicCard = document.createElement('div');
        topicCard.className = 'topic-card';
        
        if (submittedEssays.has(index)) {
            topicCard.classList.add('submitted');
        }
        
        topicCard.innerHTML = `
            <div class="topic-number">${index + 1}</div>
            <div class="topic-title">${topic}</div>
            <div class="topic-description">${submittedEssays.has(index) ? 'Essay submitted! Click to view or edit.' : 'Click to start writing your essay on this topic.'}</div>
        `;
        
        topicCard.addEventListener('click', () => selectTopic(index, topic));
        topicsGrid.appendChild(topicCard);
    });
    
    console.log('Topics populated successfully');
}

// Select a topic and show essay editor
async function selectTopic(index, topic) {
    try {
        console.log('Selecting topic:', index, topic);
        
        document.querySelector('.topics-section').style.display = 'none';
        document.getElementById('essaySection').style.display = 'block';
        document.getElementById('selectedTopicTitle').textContent = topic;
        
        // Clear previous content
        document.getElementById('essayTextarea').value = '';
        updateWordCount();
        
        // Load existing essay if any
        if (firebaseFunctions.getDoc && firebaseFunctions.doc) {
            const essayDoc = await firebaseFunctions.getDoc(firebaseFunctions.doc(db, 'essays', `${currentUser.uid}_${index}`));
            if (essayDoc.exists()) {
                const essayData = essayDoc.data();
                document.getElementById('essayTextarea').value = essayData.content || '';
                updateWordCount();
                console.log('Loaded existing essay');
            }
        }
        
        // Store current topic index for saving
        document.getElementById('essaySection').dataset.topicIndex = index;
        
    } catch (error) {
        console.error('Error selecting topic:', error);
        showError('Failed to load essay. Please try again.');
    }
}

// Setup essay editor functionality
function setupEssayEditor() {
    const textarea = document.getElementById('essayTextarea');
    const saveBtn = document.getElementById('saveEssayBtn');
    const submitBtn = document.getElementById('submitEssayBtn');
    const backBtn = document.getElementById('backToTopicsBtn');
    
    if (!textarea || !saveBtn || !submitBtn || !backBtn) {
        console.error('Essay editor elements not found');
        return;
    }
    
    // Word count functionality
    textarea.addEventListener('input', updateWordCount);
    
    // Save essay functionality
    saveBtn.addEventListener('click', () => saveEssay());
    
    // Submit essay functionality
    submitBtn.addEventListener('click', () => submitEssay());
    
    // Back to topics functionality
    backBtn.addEventListener('click', () => {
        document.getElementById('essaySection').style.display = 'none';
        document.querySelector('.topics-section').style.display = 'block';
        document.getElementById('essayTextarea').value = '';
        updateWordCount();
    });
    
    // Auto-save every 30 seconds
    setInterval(() => {
        if (document.getElementById('essaySection').style.display !== 'none') {
            saveEssay(true); // Silent save
        }
    }, 30000);
    
    console.log('Essay editor setup complete');
}

// Setup modal functionality
function setupModal() {
    const modal = document.getElementById('successModal');
    const closeBtn = document.getElementById('closeModal');
    const viewBtn = document.getElementById('viewAllEssays');
    
    if (!modal || !closeBtn || !viewBtn) {
        console.error('Modal elements not found');
        return;
    }
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    viewBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        // Go back to topics view
        document.getElementById('essaySection').style.display = 'none';
        document.querySelector('.topics-section').style.display = 'block';
        document.getElementById('essayTextarea').value = '';
        updateWordCount();
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    console.log('Modal setup complete');
}

// Update word count
function updateWordCount() {
    const textarea = document.getElementById('essayTextarea');
    const wordCount = document.getElementById('wordCount');
    
    if (!textarea || !wordCount) return;
    
    const text = textarea.value.trim();
    const words = text === '' ? 0 : text.split(/\s+/).length;
    wordCount.textContent = words;
}

// Save essay to Firestore
async function saveEssay(silent = false) {
    try {
        const essaySection = document.getElementById('essaySection');
        const topicIndex = essaySection.dataset.topicIndex;
        const content = document.getElementById('essayTextarea').value;
        
        if (!content.trim()) {
            if (!silent) showError('Please write something before saving.');
            return;
        }
        
        if (firebaseFunctions.setDoc && firebaseFunctions.doc) {
            await firebaseFunctions.setDoc(firebaseFunctions.doc(db, 'essays', `${currentUser.uid}_${topicIndex}`), {
                userId: currentUser.uid,
                topicIndex: parseInt(topicIndex),
                topicTitle: topics[topicIndex],
                content: content,
                updatedAt: new Date().toISOString(),
                wordCount: content.trim().split(/\s+/).length,
                status: 'draft'
            });
            
            if (!silent) {
                showSuccess('Essay draft saved successfully!');
                console.log('Essay saved successfully');
            }
        } else {
            throw new Error('Firebase functions not initialized');
        }
    } catch (error) {
        console.error('Error saving essay:', error);
        if (!silent) {
            showError('Failed to save essay. Please try again.');
        }
    }
}

// Submit essay
async function submitEssay() {
    try {
        const essaySection = document.getElementById('essaySection');
        const topicIndex = essaySection.dataset.topicIndex;
        const content = document.getElementById('essayTextarea').value;
        
        if (!content.trim()) {
            showError('Please write your essay before submitting.');
            return;
        }
        
        const wordCount = content.trim().split(/\s+/).length;
        
        if (wordCount < 100) {
            showError('Essay must be at least 100 words long.');
            return;
        }
        
        if (firebaseFunctions.setDoc && firebaseFunctions.doc) {
            const submissionTime = new Date().toISOString();
            
            // Save essay as final submission
            await firebaseFunctions.setDoc(firebaseFunctions.doc(db, 'essays', `${currentUser.uid}_${topicIndex}`), {
                userId: currentUser.uid,
                topicIndex: parseInt(topicIndex),
                topicTitle: topics[topicIndex],
                content: content,
                updatedAt: submissionTime,
                wordCount: wordCount,
                status: 'submitted',
                submittedAt: submissionTime
            });
            
            // Create submission record
            await firebaseFunctions.setDoc(firebaseFunctions.doc(db, 'submissions', `${currentUser.uid}_${topicIndex}`), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                userName: currentUser.displayName,
                topicIndex: parseInt(topicIndex),
                topicTitle: topics[topicIndex],
                wordCount: wordCount,
                submittedAt: submissionTime
            });
            
            // Add to submitted essays set
            submittedEssays.add(parseInt(topicIndex));
            
            // Show success modal
            showSubmissionSuccess(topics[topicIndex], wordCount, submissionTime);
            
            console.log('Essay submitted successfully');
            
        } else {
            throw new Error('Firebase functions not initialized');
        }
    } catch (error) {
        console.error('Error submitting essay:', error);
        showError('Failed to submit essay. Please try again.');
    }
}

// Show submission success modal
function showSubmissionSuccess(topicTitle, wordCount, submissionTime) {
    const modal = document.getElementById('successModal');
    const submittedTopic = document.getElementById('submittedTopic');
    const submittedWordCount = document.getElementById('submittedWordCount');
    const submissionTimeElement = document.getElementById('submissionTime');
    const submissionDetails = document.getElementById('submissionDetails');
    
    if (!modal || !submittedTopic || !submittedWordCount || !submissionTimeElement || !submissionDetails) {
        console.error('Modal elements not found');
        return;
    }
    
    submittedTopic.textContent = topicTitle;
    submittedWordCount.textContent = wordCount;
    submissionTimeElement.textContent = new Date(submissionTime).toLocaleString();
    submissionDetails.textContent = `Thank you for submitting your essay! Your submission has been recorded and you can view it anytime from your dashboard.`;
    
    modal.style.display = 'flex';
    
    // Update topics grid to show submitted status
    setTimeout(() => {
        populateTopics();
    }, 100);
}

// Show success message
function showSuccess(message) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        background: #d4edda;
        color: #155724;
        padding: 1rem;
        border-radius: 10px;
        margin-bottom: 1rem;
        border-left: 4px solid #27ae60;
        animation: fadeIn 0.3s ease-in;
    `;
    
    const main = document.querySelector('.dashboard-main');
    if (main) {
        main.insertBefore(successDiv, main.firstChild);
        
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    }
}

// Show error message
function showError(message) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        background: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 10px;
        margin-bottom: 1rem;
        border-left: 4px solid #e74c3c;
        animation: fadeIn 0.3s ease-in;
    `;
    
    const main = document.querySelector('.dashboard-main');
    if (main) {
        main.insertBefore(errorDiv, main.firstChild);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing dashboard...');
    loadFirebaseConfig();
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
