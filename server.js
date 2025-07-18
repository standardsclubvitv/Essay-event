const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: process.env.FIREBASE_SERVICE_ACCOUNT_TYPE,
  project_id: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
  private_key_id: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_ID,
  auth_uri: process.env.FIREBASE_SERVICE_ACCOUNT_AUTH_URI,
  token_uri: process.env.FIREBASE_SERVICE_ACCOUNT_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_SERVICE_ACCOUNT_UNIVERSE_DOMAIN
};

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  process.exit(1);
}

const db = admin.firestore();

// Authentication middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Admin role verification middleware
async function requireAdmin(req, res, next) {
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(500).json({ error: 'Failed to verify admin access' });
  }
}

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==================== USER MANAGEMENT ROUTES ====================

// Get current user role
app.get('/api/user-role', authenticateToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData) {
      // Create user if doesn't exist
      await db.collection('users').doc(req.user.uid).set({
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name || req.user.email,
        role: 'student',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({ role: 'student' });
    } else {
      res.json({ role: userData.role });
    }
  } catch (error) {
    console.error('Get user role error:', error);
    res.status(500).json({ error: 'Failed to get user role' });
  }
});

// Create or update user (for first-time login)
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { uid, email, name, role = 'student' } = req.body;
    const userRef = db.collection('users').doc(uid || req.user.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      await userRef.set({
        uid: uid || req.user.uid,
        email: email || req.user.email,
        name: name || req.user.name || req.user.email,
        role,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ message: 'User created successfully', role });
    } else {
      const userData = userDoc.data();
      res.json({ message: 'User already exists', role: userData.role });
    }
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get all users (admin only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .get();
    
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      uid: doc.data().uid,
      ...doc.data()
    }));
    
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (admin only)
app.put('/api/users/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!['student', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be either "student" or "admin"' });
    }
    
    await db.collection('users').doc(userId).update({
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Delete user (admin only)
app.delete('/api/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent admin from deleting themselves
    if (userId === req.user.uid) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const batch = db.batch();
    
    // Delete user document
    const userRef = db.collection('users').doc(userId);
    batch.delete(userRef);
    
    // Delete user's quiz responses
    const quizResponsesSnapshot = await db.collection('quiz-responses')
      .where('userId', '==', userId)
      .get();
    
    quizResponsesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete user's essay responses
    const essayResponsesSnapshot = await db.collection('essay-responses')
      .where('userId', '==', userId)
      .get();
    
    essayResponsesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==================== QUIZ MANAGEMENT ROUTES ====================

// Get all quizzes (with optional filtering)
app.get('/api/quizzes', authenticateToken, async (req, res) => {
  try {
    const { published, locked, createdBy } = req.query;
    let query = db.collection('quizzes');
    
    // Apply filters
    if (published !== undefined) {
      query = query.where('isPublished', '==', published === 'true');
    }
    
    if (locked !== undefined) {
      query = query.where('isLocked', '==', locked === 'true');
    }
    
    if (createdBy) {
      query = query.where('createdBy', '==', createdBy);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const quizzes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(quizzes);
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get single quiz
app.get('/api/quizzes/:quizId', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const quizDoc = await db.collection('quizzes').doc(quizId).get();
    
    if (!quizDoc.exists) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    res.json({ id: quizDoc.id, ...quizDoc.data() });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// Create new quiz (admin only)
app.post('/api/quizzes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, questions, timeLimit, isPublished, isLocked } = req.body;
    
    // Validate required fields
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Title and questions are required' });
    }
    
    // Validate questions structure
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.question || !question.options || !Array.isArray(question.options) || 
          question.options.length < 2 || question.correctAnswer === undefined) {
        return res.status(400).json({ 
          error: `Question ${i + 1} is missing required fields or has invalid structure` 
        });
      }
    }
    
    const quiz = {
      title,
      description: description || '',
      questions,
      timeLimit: timeLimit || 30,
      isPublished: isPublished || false,
      isLocked: isLocked || false,
      createdBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('quizzes').add(quiz);
    res.json({ id: docRef.id, message: 'Quiz created successfully' });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// Update quiz (admin only)
app.put('/api/quizzes/:quizId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { quizId } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    await db.collection('quizzes').doc(quizId).update(updateData);
    res.json({ message: 'Quiz updated successfully' });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Delete quiz (admin only)
app.delete('/api/quizzes/:quizId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { quizId } = req.params;
    
    const batch = db.batch();
    
    // Delete quiz document
    const quizRef = db.collection('quizzes').doc(quizId);
    batch.delete(quizRef);
    
    // Delete related responses
    const responsesSnapshot = await db.collection('quiz-responses')
      .where('quizId', '==', quizId)
      .get();
    
    responsesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    res.json({ message: 'Quiz and related responses deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// ==================== QUIZ RESPONSE ROUTES ====================

// Get quiz responses (with optional filtering)
app.get('/api/quiz-responses', authenticateToken, async (req, res) => {
  try {
    const { quizId, userId } = req.query;
    let query = db.collection('quiz-responses');
    
    // Apply filters
    if (quizId) {
      query = query.where('quizId', '==', quizId);
    }
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    const snapshot = await query.orderBy('submittedAt', 'desc').get();
    const responses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(responses);
  } catch (error) {
    console.error('Get quiz responses error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz responses' });
  }
});

// Submit quiz response
app.post('/api/quiz-responses', authenticateToken, async (req, res) => {
  try {
    const { quizId, answers, score, totalQuestions } = req.body;
    
    // Validate required fields
    if (!quizId || !answers || score === undefined || !totalQuestions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user has already submitted this quiz
    const existingResponse = await db.collection('quiz-responses')
      .where('quizId', '==', quizId)
      .where('userId', '==', req.user.uid)
      .get();
    
    if (!existingResponse.empty) {
      return res.status(400).json({ error: 'You have already submitted this quiz' });
    }
    
    const response = {
      quizId,
      answers,
      score,
      totalQuestions,
      userId: req.user.uid,
      userEmail: req.user.email,
      submittedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('quiz-responses').add(response);
    res.json({ id: docRef.id, message: 'Quiz response submitted successfully' });
  } catch (error) {
    console.error('Submit quiz response error:', error);
    res.status(500).json({ error: 'Failed to submit quiz response' });
  }
});

// ==================== ESSAY MANAGEMENT ROUTES ====================

// Get all essays (with optional filtering)
app.get('/api/essays', authenticateToken, async (req, res) => {
  try {
    const { published, locked, createdBy } = req.query;
    let query = db.collection('essays');
    
    // Apply filters
    if (published !== undefined) {
      query = query.where('isPublished', '==', published === 'true');
    }
    
    if (locked !== undefined) {
      query = query.where('isLocked', '==', locked === 'true');
    }
    
    if (createdBy) {
      query = query.where('createdBy', '==', createdBy);
    }
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const essays = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(essays);
  } catch (error) {
    console.error('Get essays error:', error);
    res.status(500).json({ error: 'Failed to fetch essays' });
  }
});

// Get single essay
app.get('/api/essays/:essayId', authenticateToken, async (req, res) => {
  try {
    const { essayId } = req.params;
    const essayDoc = await db.collection('essays').doc(essayId).get();
    
    if (!essayDoc.exists) {
      return res.status(404).json({ error: 'Essay not found' });
    }
    
    res.json({ id: essayDoc.id, ...essayDoc.data() });
  } catch (error) {
    console.error('Get essay error:', error);
    res.status(500).json({ error: 'Failed to fetch essay' });
  }
});

// Create new essay (admin only)
app.post('/api/essays', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, description, prompt, timeLimit, maxWords, isPublished, isLocked, instructions, dueDate } = req.body;
    
    // Validate required fields
    if (!title || !prompt) {
      return res.status(400).json({ error: 'Title and prompt are required' });
    }
    
    const essay = {
      title,
      description: description || '',
      prompt,
      timeLimit: timeLimit || 60,
      maxWords: maxWords || 500,
      isPublished: isPublished || false,
      isLocked: isLocked || false,
      instructions: instructions || '',
      dueDate: dueDate || null,
      createdBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('essays').add(essay);
    res.json({ id: docRef.id, message: 'Essay created successfully' });
  } catch (error) {
    console.error('Create essay error:', error);
    res.status(500).json({ error: 'Failed to create essay' });
  }
});

// Update essay (admin only)
app.put('/api/essays/:essayId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { essayId } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    await db.collection('essays').doc(essayId).update(updateData);
    res.json({ message: 'Essay updated successfully' });
  } catch (error) {
    console.error('Update essay error:', error);
    res.status(500).json({ error: 'Failed to update essay' });
  }
});

// Delete essay (admin only)
app.delete('/api/essays/:essayId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { essayId } = req.params;
    
    const batch = db.batch();
    
    // Delete essay document
    const essayRef = db.collection('essays').doc(essayId);
    batch.delete(essayRef);
    
    // Delete related responses
    const responsesSnapshot = await db.collection('essay-responses')
      .where('essayId', '==', essayId)
      .get();
    
    responsesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    res.json({ message: 'Essay and related responses deleted successfully' });
  } catch (error) {
    console.error('Delete essay error:', error);
    res.status(500).json({ error: 'Failed to delete essay' });
  }
});

// ==================== ESSAY RESPONSE ROUTES ====================

// Get essay responses (with optional filtering)
app.get('/api/essay-responses', authenticateToken, async (req, res) => {
  try {
    const { essayId, userId, graded } = req.query;
    let query = db.collection('essay-responses');
    
    // Apply filters
    if (essayId) {
      query = query.where('essayId', '==', essayId);
    }
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    const snapshot = await query.orderBy('submittedAt', 'desc').get();
    let responses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Filter by graded status if specified
    if (graded !== undefined) {
      const isGraded = graded === 'true';
      responses = responses.filter(response => {
        const hasGrade = response.grade !== null && response.grade !== undefined;
        return isGraded ? hasGrade : !hasGrade;
      });
    }
    
    res.json(responses);
  } catch (error) {
    console.error('Get essay responses error:', error);
    res.status(500).json({ error: 'Failed to fetch essay responses' });
  }
});

// Submit essay response
app.post('/api/essay-responses', authenticateToken, async (req, res) => {
  try {
    const { essayId, content, wordCount } = req.body;
    
    // Validate required fields
    if (!essayId || !content || wordCount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user has already submitted this essay
    const existingResponse = await db.collection('essay-responses')
      .where('essayId', '==', essayId)
      .where('userId', '==', req.user.uid)
      .get();
    
    if (!existingResponse.empty) {
      return res.status(400).json({ error: 'You have already submitted this essay' });
    }
    
    const response = {
      essayId,
      content,
      wordCount,
      userId: req.user.uid,
      userEmail: req.user.email,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      grade: null,
      feedback: null
    };
    
    const docRef = await db.collection('essay-responses').add(response);
    res.json({ id: docRef.id, message: 'Essay response submitted successfully' });
  } catch (error) {
    console.error('Submit essay response error:', error);
    res.status(500).json({ error: 'Failed to submit essay response' });
  }
});

// Grade essay response (admin only)
app.put('/api/essay-responses/:responseId/grade', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { responseId } = req.params;
    const { grade, feedback } = req.body;
    
    // Validate grade
    if (grade === undefined || grade < 0 || grade > 100) {
      return res.status(400).json({ error: 'Grade must be between 0 and 100' });
    }
    
    await db.collection('essay-responses').doc(responseId).update({
      grade: parseInt(grade),
      feedback: feedback || '',
      gradedAt: admin.firestore.FieldValue.serverTimestamp(),
      gradedBy: req.user.uid
    });
    
    res.json({ message: 'Essay graded successfully' });
  } catch (error) {
    console.error('Grade essay error:', error);
    res.status(500).json({ error: 'Failed to grade essay' });
  }
});

// ==================== ANALYTICS ROUTES ====================

// Get dashboard statistics (admin only)
app.get('/api/analytics/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [usersSnapshot, quizzesSnapshot, essaysSnapshot, quizResponsesSnapshot, essayResponsesSnapshot] = await Promise.all([
      db.collection('users').get(),
      db.collection('quizzes').get(),
      db.collection('essays').get(),
      db.collection('quiz-responses').get(),
      db.collection('essay-responses').get()
    ]);
    
    const users = usersSnapshot.docs.map(doc => doc.data());
    const quizzes = quizzesSnapshot.docs.map(doc => doc.data());
    const essays = essaysSnapshot.docs.map(doc => doc.data());
    const essayResponses = essayResponsesSnapshot.docs.map(doc => doc.data());
    
    const stats = {
      totalUsers: users.length,
      totalQuizzes: quizzes.length,
      totalEssays: essays.length,
      totalQuizResponses: quizResponsesSnapshot.size,
      totalEssayResponses: essayResponses.length,
      studentsCount: users.filter(user => user.role === 'student').length,
      adminsCount: users.filter(user => user.role === 'admin').length,
      publishedQuizzes: quizzes.filter(quiz => quiz.isPublished).length,
      publishedEssays: essays.filter(essay => essay.isPublished).length,
      gradedEssays: essayResponses.filter(response => response.grade !== null && response.grade !== undefined).length,
      pendingEssays: essayResponses.filter(response => response.grade === null || response.grade === undefined).length
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ==================== ERROR HANDLING ====================

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ==================== SERVER STARTUP ====================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔥 Firebase Project: ${process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
