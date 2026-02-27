import express from 'express';
import cors from 'cors';

// Import des fichiers de routes
import authRoutes from './routes/auth.js';
import validationsRoutes from './routes/validations.js';

const app = express();

app.use(cors());
app.use(express.json());

// Utilisation des routes avec un préfixe commun
app.use('/api', authRoutes);   // Toutes les routes de auth.js commencent par /api
app.use('/api', validationsRoutes); // Toutes les routes de sports.js commencent par /api

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur structuré et démarré sur http://localhost:${PORT}`);
});