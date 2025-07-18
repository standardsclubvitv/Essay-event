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

// Load Firebase config and initialize
async function loadFirebaseConfig() {
    try {
        const response = await fetch('/api/config');
        firebaseConfig = await response.json();
        await initializeFirebase();
    } catch (error) {
        console.error('Error loading Firebase config:', error);
        showError('Failed to load configuration. Please try again.');
    }
}

// Initialize Firebase
async function initializeFirebase() {
    try {
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
        
        // Set up auth state listener
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                initializeDashboard();
            } else {
                // User is not signed in, redirect to login
                window.location.href = '/login';
            }
        });
        
        // Set up logout functionality
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error('Error signing out:', error);
            }
        });
        
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showError('Failed to initialize. Please refresh the page.');
    }
}

// Initialize dashboard after user is authenticated
async function initializeDashboard() {
    // Hide loading screen
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'block';
    
    // Display user name
    document.getElementById('userName').textContent = currentUser.displayName || 'User';
    
    // Load submitted essays
    await loadSubmittedEssays();
    
    // Populate topics
    populateTopics();
    
    // Set up essay functionality
    setupEssayEditor();
    
    // Set up modal functionality
    setupModal();
}

// Load submitted essays from Firestore
async function loadSubmittedEssays() {
    try {
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
        }
    } catch (error) {
        console.error('Error loading submitted essays:', error);
    }
}

// Populate topics grid
function populateTopics() {
    const topicsGrid = document.getElementById('topicsGrid');
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
}

// Select a topic and show essay editor
async function selectTopic(index, topic) {
    document.querySelector('.topics-section').style.display = 'none';
    document.getElementById('essaySection').style.display = 'block';
    document.getElementById('selectedTopicTitle').textContent = topic;
    
    // Clear previous content
    document.getElementById('essayTextarea').value = '';
    updateWordCount();
    
    // Load existing essay if any
    try {
        if (firebaseFunctions.getDoc && firebaseFunctions.doc) {
            const essayDoc = await firebaseFunctions.getDoc(firebaseFunctions.doc(db, 'essays', `${currentUser.uid}_${index}`));
            if (essayDoc.exists()) {
                const essayData = essayDoc.data();
                document.getElementById('essayTextarea').value = essayData.content || '';
                updateWordCount();
            }
        }
    } catch (error) {
        console.error('Error loading essay:', error);
    }
    
    // Store current topic index for saving
    document.getElementById('essaySection').dataset.topicIndex = index;
}

// Setup essay editor functionality
function setupEssayEditor() {
    const textarea = document.getElementById('essayTextarea');
    const saveBtn = document.getElementById('saveEssayBtn');
    const submitBtn = document.getElementById('submitEssayBtn');
    const backBtn = document.getElementById('backToTopicsBtn');
    
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
}

// Setup modal functionality
function setupModal() {
    const modal = document.getElementById('successModal');
    const closeBtn = document.getElementById('closeModal');
    const viewBtn = document.getElementById('viewAllEssays');
    
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
}

// Update word count
function updateWordCount() {
    const textarea = document.getElementById('essayTextarea');
    const wordCount = document.getElementById('wordCount');
    const text = textarea.value.trim();
    const words = text === '' ? 0 : text.split(/\s+/).length;
    wordCount.textContent = words;
}

// Save essay to Firestore
async function saveEssay(silent = false) {
    const essaySection = document.getElementById('essaySection');
    const topicIndex = essaySection.dataset.topicIndex;
    const content = document.getElementById('essayTextarea').value;
    
    if (!content.trim()) {
        if (!silent) showError('Please write something before saving.');
        return;
    }
    
    try {
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
    
    try {
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
    
    const main = document.querySelector('.dashboard-main');
    main.insertBefore(successDiv, main.firstChild);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}

// Show error message
function showError(message) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const main = document.querySelector('.dashboard-main');
    if (main) {
        main.insertBefore(errorDiv, main.firstChild);
    } else {
        document.body.appendChild(errorDiv);
    }
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', loadFirebaseConfig);
