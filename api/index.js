const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://events.standardsvit.live', 'https://standardsvit.live'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// Static file serving with caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime()
    });
});

// API endpoint to get Firebase config
app.get('/api/config', (req, res) => {
    try {
        const config = {
            apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCrVQyQBJcf5ilOjg-X1_rjTUvhvLVDqEY",
            authDomain: process.env.FIREBASE_AUTH_DOMAIN || "online-events-51042.firebaseapp.com",
            projectId: process.env.FIREBASE_PROJECT_ID || "online-events-51042",
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "online-events-51042.firebasestorage.app",
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "706186554711",
            appId: process.env.FIREBASE_APP_ID || "1:706186554711:web:b58f0b6795216ef1726212",
            measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-CEPW7QBLJG"
        };
        
        // Cache the config for 1 hour
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json(config);
    } catch (error) {
        console.error('Error serving Firebase config:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint for essay statistics (optional)
app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            totalTopics: 11,
            platform: 'Standards Club VIT Vellore',
            version: '1.0.0',
            features: [
                'Essay Writing',
                'Topic Selection', 
                'Auto-save',
                'Cloud Storage',
                'Secure Authentication'
            ]
        };
        res.json(stats);
    } catch (error) {
        console.error('Error serving stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route handlers for main pages
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/login', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    } catch (error) {
        console.error('Error serving login.html:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/dashboard', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } catch (error) {
        console.error('Error serving dashboard.html:', error);
        res.status(500).send('Internal server error');
    }
});

// Catch-all handler for SPA routing
app.get('*', (req, res) => {
    try {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'API endpoint not found' });
        }
        
        // Serve index.html for all other routes (SPA support)
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (error) {
        console.error('Error in catch-all handler:', error);
        res.status(500).send('Internal server error');
    }
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({ error: 'Resource not found' });
});

// Start server only if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📝 Standards Club VIT Vellore Essay Platform`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

// Export for Vercel
module.exports = app;
