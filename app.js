const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Middleware
app.use(express.json()); // Parse JSON bodies (replaces bodyParser.json())
app.use(cors()); // Enable CORS for all routes
app.options('*', cors()); // Handle preflight requests

app.use(bodyParser.json());
// Serve static files (uploads folder for images)

// Routes
const userRoutes = require('./routes/user.js');
const categoryRoutes = require('./routes/categories.js');
const productRoutes = require('./routes/products.js');
const imageUploadRoutes = require('./helper/imageUpload.js');
const productWeightRoutes = require('./routes/productWeight.js');
const productSIZERoutes = require('./routes/productSize.js');
const productReviewsRoutes = require('./routes/productReviews.js');
const cartSchema = require('./routes/cart.js');
const myListSchema = require('./routes/myList.js');
const ordersSchema = require('./routes/orders.js');
const homeBannerSchema = require('./routes/homeBanner.js');
const searchRoutes = require('./routes/search.js'); // Make sure this is correct


app.use("/uploads", express.static('uploads'));
app.use('/api/user', userRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/imageUpload', imageUploadRoutes);
app.use('/api/productWeight', productWeightRoutes);
app.use('/api/productSIZE', productSIZERoutes);
app.use('/api/productReviews', productReviewsRoutes);
app.use('/api/cart', cartSchema);
app.use('/api/my-list', myListSchema);
app.use('/api/orders', ordersSchema);
app.use('/api/homeBanner', homeBannerSchema);
app.use('/api/search', searchRoutes); // <-- Mounting the search route correctly

// Global error handler (optional but recommended)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong on the server', error: err.message });
});

// Database Connection
mongoose.connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log('Database Connection is ready...');
        // Start server only after DB connection succeeds
        const PORT = process.env.PORT || 4000; // Fallback to 4000 if PORT undefined
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Database connection error:', err);
        process.exit(1); // Exit process if DB fails
    });

// Test route to verify server is running
app.get('/', (req, res) => {
    res.send('Server is up and running!');
});