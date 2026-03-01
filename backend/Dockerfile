# On part d'une image légère de Node.js
FROM node:20-slim

# On définit le dossier de travail dans le conteneur
WORKDIR /app

# On copie les fichiers de dépendances
COPY package*.json ./

# On installe les dépendances
RUN npm install

# On copie le reste du code
COPY . .

# On expose le port de ton API
EXPOSE 5000

# La commande pour démarrer ton serveur
CMD ["node", "index.js"]