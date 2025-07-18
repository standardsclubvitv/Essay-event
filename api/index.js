const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Enhanced logging for debugging
console.log('Starting Express server...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Vercel environment:', process.env.VERCEL);

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

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log('Health check endpoint called');
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        path: req.path
    });
});

// API endpoint to get Firebase config
app.get('/api/config', (req, res) => {
    console.log('Config endpoint called');
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
        
        console.log('Config prepared successfully');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json(config);
    } catch (error) {
        console.error('Error serving Firebase config:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// API endpoint for essay statistics
app.get('/api/stats', (req, res) => {
    console.log('Stats endpoint called');
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
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Serve HTML content directly (instead of trying to serve files)
app.get('/', (req, res) => {
    console.log('Root endpoint called');
    res.redirect('/index.html');
});

app.get('/login', (req, res) => {
    console.log('Login endpoint called');
    res.redirect('/login.html');
});

app.get('/dashboard', (req, res) => {
    console.log('Dashboard endpoint called');
    res.redirect('/dashboard.html');
});

// For any other routes, redirect to the static files
app.get('*', (req, res) => {
    console.log('Catch-all handler called for:', req.path);
    
    // Handle API routes
    if (req.path.startsWith('/api/')) {
        console.log('API route not found:', req.path);
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // For static files, let Vercel handle them
    res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Redirecting...</title>
        </head>
        <body>
            <script>
                // Redirect to the correct static file
                window.location.href = '${req.path}';
            </script>
        </body>
        </html>
    `);
});

// Enhanced error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request path:', req.path);
    console.error('Request method:', req.method);
    
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        path: req.path
    });
});

// 404 handler
app.use((req, res) => {
    console.log('404 handler called for:', req.path);
    res.status(404).json({ 
        error: 'Resource not found',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

console.log('Express app configured successfully');

// Export for Vercel
module.exports = app;
