import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Chapa Payment Initialization
  app.post('/api/payments/initialize', async (req, res) => {
    try {
      const { amount, email, firstName, lastName, tx_ref, callback_url, return_url } = req.body;
      
      const secretKey = process.env.CHAPA_SECRET_KEY;
      if (!secretKey) {
        // Return a mock success for development if no key is provided, 
        // explaining to the user in the UI how to configure it.
        return res.json({ 
          status: 'success', 
          message: 'Development Mock: Add CHAPA_SECRET_KEY to .env to enable real payments.',
          data: { checkout_url: return_url } 
        });
      }

      const response = await axios.post(
        'https://api.chapa.co/v1/transaction/initialize',
        {
          amount,
          currency: 'ETB',
          email,
          first_name: firstName,
          last_name: lastName,
          tx_ref,
          callback_url,
          return_url,
          "customization[title]": "ሊ STRO Premium Restoration",
          "customization[description]": "Payment for shoe cleaning service"
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.json(response.data);
    } catch (error: any) {
      console.error('Chapa Initialization Error:', error.response?.data || error.message);
      res.status(500).json({ status: 'error', message: error.response?.data?.message || 'Failed to initialize payment' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
