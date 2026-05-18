import express from 'express';
import Customer from '../models/Customer.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Get statistics (must be before /:id route)
router.get('/stats/dashboard', async (req, res) => {
  try {
    const [totalCustomers, upcomingEvents, completedEvents, revenue] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({
        eventDate: { $gte: new Date() },
        status: { $ne: 'Cancelled' }
      }),
      Customer.countDocuments({ status: 'Completed' }),
      Customer.aggregate([
        { $match: { status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$advancePaid' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalCustomers,
        upcomingEvents,
        completedEvents,
        totalRevenue: revenue[0]?.total || 0,
        totalPaid: revenue[0]?.paid || 0,
        pendingAmount: (revenue[0]?.total || 0) - (revenue[0]?.paid || 0)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get upcoming events (must be before /:id route)
router.get('/filter/upcoming', async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    const customers = await Customer.find({
      eventDate: { $gte: today, $lte: thirtyDaysLater },
      status: { $ne: 'Cancelled' }
    }).sort({ eventDate: 1 });

    res.json({ success: true, data: customers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all customers with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
      eventType,
      status,
      search
    } = req.query;

    // Build query
    const query = {};
    
    if (eventType) query.eventType = eventType;
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { packageName: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;
    const sortOrder = order === 'desc' ? -1 : 1;

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Customer.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single customer
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new customer
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const customerData = { ...req.body };
    
    // If file uploaded, add imageUrl
    if (req.file) {
      customerData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const customer = await Customer.create(customerData);
    
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update customer
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // If new file uploaded, update imageUrl
    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Optional: Delete associated image file
    if (customer.imageUrl) {
      const imagePath = path.join(__dirname, '../..', customer.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;