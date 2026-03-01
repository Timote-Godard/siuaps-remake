# Étape 1 : Build de l'app React
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Étape 2 : On utilise un serveur ultra léger (Nginx) pour servir le site
FROM nginx:stable-alpine
# On copie les fichiers compilés par React dans le dossier de Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Si tu utilises 'build' au lieu de 'dist' dans ton projet, remplace /app/dist par /app/build

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]