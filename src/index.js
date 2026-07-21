import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import connectDB from './config/database.js';
import customerRoutes from './routes/customer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;


async function renderQuotationHtml(req, payload) {
  const rawTemplateId = req.body?.templateId ?? payload?.templateId;
  const normalizedTemplateId = String(rawTemplateId || '').trim().toLowerCase();

  const templateFile =
    normalizedTemplateId === '2' || normalizedTemplateId === 'template2'
      ? 'quotationtemplate2.ejs'
      : normalizedTemplateId === '3' || normalizedTemplateId === 'template3'
      ? 'quotationtemplate3.ejs'
      : 'quotationtemplate.ejs';

  const templatePath = path.join(__dirname, `./template/${templateFile}`);
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  return ejs.renderFile(templatePath, {
    data: payload,
    baseUrl
  });
}

/* -------------------------------------------------------------------------- */
/*                              Database Connection                           */
/* -------------------------------------------------------------------------- */

connectDB();

/* -------------------------------------------------------------------------- */
/*                                  Middleware                                */
/* -------------------------------------------------------------------------- */

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
  })
);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------------------------------------------------------------- */
/*                              Static Folders                                */
/* -------------------------------------------------------------------------- */

// Uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Assets folder (logo/images)
app.use('/assets', express.static(path.join(__dirname, './assets')));

/* -------------------------------------------------------------------------- */
/*                                Health Check                                */
/* -------------------------------------------------------------------------- */

app.get('/', (req, res) => {
  res.json({
    message: 'Customer Management API',
    status: 'running',
    endpoints: {
      customers: '/api/customers',
      generatePdf: '/api/generate-pdf',
      health: '/health'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/* -------------------------------------------------------------------------- */
/*                                   Routes                                   */
/* -------------------------------------------------------------------------- */

app.use('/api/customers', customerRoutes);

app.post('/api/preview-quotation', async (req, res, next) => {
  try {
    const payload = req.body?.data || req.body || {};
    const html = await renderQuotationHtml(req, payload);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/*                               Generate PDF                                 */
/* -------------------------------------------------------------------------- */

app.post('/api/generate-pdf', async (req, res, next) => {
  let browser;

  try {
    const payload = req.body?.data || req.body || {};

    const html = await renderQuotationHtml(req, payload);

    console.log(
      'Chromium Path:',
      await chromium.executablePath()
    );

    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 1
    });

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="quotation.pdf"'
    );

    res.send(pdfBuffer);
  } catch (error) {
    console.error('================ PDF ERROR ================');
    console.error(error);
    console.error(error?.stack);
    console.error('===========================================');

    res.status(500).json({
      error: error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

/* -------------------------------------------------------------------------- */
/*                                404 Handler                                 */
/* -------------------------------------------------------------------------- */

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

/* -------------------------------------------------------------------------- */
/*                               Error Handler                                */
/* -------------------------------------------------------------------------- */

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong!'
  });
});

/* -------------------------------------------------------------------------- */
/*                               Start Server                                 */
/* -------------------------------------------------------------------------- */

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;