import express from 'express';
import * as cheerio from 'cheerio';
import { client, jar } from '../client.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // ÉTAPE 1 : On passe le portail en soumettant le choix de l'école
    const wayfUrl = 'https://mon-espace.siuaps.univ-rennes.fr/auth/shibboleth/login.php';
    
    // Si tu es à Rennes 2, remplace par 'urn:mace:cru.fr:federation:uhb.fr'
    const myIdp = 'urn:mace:cru.fr:federation:univ-rennes1.fr'; 

    console.log("Étape 1 : Envoi du choix de l'école (Université de Rennes)...");
    const firstResponse = await client.post(wayfUrl, new URLSearchParams({
      idp: myIdp
    }), {
      maxRedirects: 10,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(firstResponse.data);
    const executionToken = $('input[name="execution"]').val();
    // ==========================================
    // ÉTAPE 2 : PRÉPARATION ET ENVOI SÉCURISÉ
    // ==========================================
    const loginActionUrl = firstResponse.request?.res?.responseUrl || firstResponse.config.url;

    const formData = new URLSearchParams();
    
    // 1. Les identifiants purs
    formData.append('username', username);
    formData.append('password', password);

    // 2. On aspire UNIQUEMENT les champs cachés utiles, en esquivant les pièges
    $('input[type="hidden"]').each((i, el) => {
        const name = $(el).attr('name');
        let value = $(el).attr('value') || ''; // Si pas de valeur, on met vide, pas "undefined"
        
        // On évite d'ajouter geolocation si ça le fait planter
        if (name && name !== 'geolocation') {
            formData.append(name, value);
        }
    });

    console.log("\n--- NOUVEAU DIAGNOSTIC D'ENVOI ---");
    console.log("URL cible :", loginActionUrl);
    console.log("Payload nettoyé envoyé !");
    console.log("----------------------------------\n");

    const loginResponse = await client.post(loginActionUrl, formData, {
      maxRedirects: 10,
      validateStatus: () => true, 
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': loginActionUrl 
      }
    });

    console.log("Code HTTP de retour du CAS :", loginResponse.status);

    // ==========================================
    // C'EST ICI QU'ON DÉFINIT $final !
    // ==========================================
    const $final = cheerio.load(loginResponse.data);
    const bodyText = loginResponse.data;

    // ==========================================
    // ÉTAPE 3 : LE TRANSFERT SAML (Le saut final)
    // ==========================================
    const samlActionUrl = $final('form').attr('action');

    if (samlActionUrl && samlActionUrl.includes('SAML2/POST')) {
        console.log("\nÉtape 3 : Le CAS a dit OUI ! Validation du ticket SAML vers le SIUAPS...");
        
        const samlData = new URLSearchParams();
        
        // On récupère le "SAMLResponse" (le gros billet d'or crypté) et le "RelayState"
        $final('input[type="hidden"]').each((i, el) => {
            const name = $(el).attr('name');
            const value = $(el).attr('value');
            if (name) samlData.append(name, value);
        });

        // L'envoi final vers le site du SIUAPS
        const finalResponse = await client.post(samlActionUrl, samlData, {
            maxRedirects: 10,
            validateStatus: () => true,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const $dashboard = cheerio.load(finalResponse.data);
        const finalBodyText = finalResponse.data;

        if (finalBodyText.includes('Déconnexion') || finalBodyText.includes('Mon compte') || finalBodyText.includes('Mes inscriptions')) {
            console.log("\n🎉 VICTOIRE ! Connecté au SIUAPS !");
            const activities = [];
            const agenda = [];
            const cours = [];
            
            // On cherche le nom de l'étudiant
            const studentName = $dashboard('.userbutton .usertext').text().trim() || "Étudiant Rennes";

            // LOGIQUE DE SCRAPING (À affiner selon ton retour)

            // MES ACTIVITES
            $dashboard('#courses > ul > li').each((i, el) => {
                const rawText = $dashboard(el).find('.card-header').text().trim();

                const typeInscription = $dashboard(el).find('.card-body li').text().trim();

                if (rawText) {
                    // Logique de découpage : on peut essayer d'isoler le sport 
                    // Souvent le nom du sport est au début avant les horaires
                    const title = rawText.split(' - ')[0] || rawText;
                    
                    activities.push({
                        title: title,
                        type: typeInscription
                    });
                }
            });

            console.log(`Sports trouvés : ${activities.length}`);


            //MES RENDEZ-VOUS
            $dashboard('#rendez-vous').each((i, el) => {
                const rawText = $dashboard(el).find('div').text().trim();

                if (rawText) {
                    
                    agenda.push({
                        title: rawText,
                        type: ""
                    });
                }
            });

            console.log(`Activités trouvées : ${agenda.length}`);


            //MES ENSEIGNEMENTS
            $dashboard('#other-teachings').each((i, el) => {
                const linkElement = $dashboard(el).find('a');

                const title = linkElement.text().trim();
                const href = linkElement.attr('href');

                if (title) {
                    
                    cours.push({
                        title: title,
                        link: href || "#"
                    });
                }
            });

            console.log(`Enseignements trouvés : ${cours.length}`);

            

            return res.json({ 
                success: true, 
                user: { 
                    name: studentName, 
                    activites: activities, // On envoie les VRAIS sports !
                    agenda: agenda,
                    cours: cours,
                } 
            });
        } else {
            console.log("Échec à la toute dernière étape. Titre:", $dashboard('title').text());
            return res.status(401).json({ success: false, message: "Le SIUAPS a refusé le ticket d'entrée." });
        }
    }
    else {
        console.log("Échec de connexion au CAS : Identifiants incorrects ou bloqués.");
        return res.status(401).json({ 
            success: false, 
            message: "Identifiants ENT incorrects" 
        });
    }
  } catch (error) {
    console.error("\n🔥 ERREUR CRASH NODE.JS :");
    console.error(error.message); // Affiche la cause exacte
    console.error(error.stack.split('\n')[1]); // Affiche la ligne du bug
    res.status(500).json({ success: false, message: "Crash serveur : " + error.message });
  }
});

router.get('/verify', async (req, res) => {
    try {
        // On tente d'accéder à l'accueil du SIUAPS avec les cookies en mémoire
        const response = await client.get('https://mon-espace.siuaps.univ-rennes.fr/', {
            maxRedirects: 5,
            validateStatus: () => true
        });

        const html = response.data;

        // Si la page contient "Déconnexion" ou "Mon compte", on est toujours loggé !
        if (html.includes('Déconnexion') || html.includes('Mon compte')) {
            return res.json({ success: true, message: "Session CAS toujours active" });
        } else {
            // Sinon, le CAS nous a jeté (session expirée)
            return res.status(401).json({ success: false, message: "Session expirée" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

router.post('/logout', (req, res) => {
    jar.removeAllCookiesSync(); // Vide la mémoire de Node.js
    res.json({ success: true });
});

export default router;