import mongoose from 'mongoose';

const eventServiceSchema = new mongoose.Schema({
  service: { type: String, trim: true },
  cameras: { type: Number, default: 1 }
}, { _id: false });

const eventItemSchema = new mongoose.Schema({
  eventName:     { type: String, trim: true },
  venueName:     { type: String, trim: true },
  venueLocation: { type: String, trim: true },
  date:          { type: Date },
  startTime:     { type: String, trim: true },
  endTime:       { type: String, trim: true },
  crowdStrength: { type: Number },
  services:      { type: [eventServiceSchema], default: [] }
}, { _id: false });

const videoDeliverableSchema = new mongoose.Schema({
  name:      { type: String, trim: true },
  qty:       { type: Number, default: 1 },
  eventName: { type: String, trim: true }
}, { _id: false });

const photoDeliverableSchema = new mongoose.Schema({
  name:        { type: String, trim: true },
  qty:         { type: Number, default: 1 },
  photosCount: { type: Number },
  eventName:   { type: String, trim: true }
}, { _id: false });

const customerSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  eventType: {
    type: String,
    required: true,
    default: 'Other'
  },
  packageName: {
    type: String,
    required: true,
    trim: true
  },
  // Top-level event date (first event date or explicit field)
  eventDate: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  brideName: {
    type: String,
    trim: true,
    default: ''
  },
  groomName: {
    type: String,
    trim: true,
    default: ''
  },
  // Detailed per-event data
  events: {
    type: [eventItemSchema],
    default: []
  },
  // Deliverables
  videoDeliverables: {
    type: [videoDeliverableSchema],
    default: []
  },
  photoDeliverables: {
    type: [photoDeliverableSchema],
    default: []
  },
  // Pricing
  totalPackage: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  discount_percentage: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  advancePaid: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

// Calculate balance amount
customerSchema.virtual('balanceAmount').get(function() {
  return this.total - this.advancePaid;
});

// Include virtuals in JSON
customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

// Create and export the model
const Customer = mongoose.model('Customer', customerSchema);

export default Customer;