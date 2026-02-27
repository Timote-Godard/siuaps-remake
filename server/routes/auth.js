import express from 'express';
import * as cheerio from 'cheerio';
import { client, jar } from '../client.js';
import puppeteer from 'puppeteer'; // 👈 AJOUTE CECI
import ical from 'node-ical';

const router = express.Router();

import fs from 'fs';

router.get('/admin/scrape-resources', async (req, res) => {
    try {
        console.log("🕵️ Démarrage de l'aspiration massive des IDs...");

        // On utilise l'URL du sélecteur de ressources d'ADE
        const targetUrl = 'https://planning.univ-rennes1.fr/direct/myplanning.jsp';
        
        const response = await client.get(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' }
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const resources = [];

        // --- STRATÉGIE 1 : Les balises OPTION (Listes déroulantes) ---
        $('option').each((i, el) => {
            const id = $(el).attr('value');
            const name = $(el).text().trim();
            if (id && !isNaN(id) && parseInt(id) > 0) {
                resources.push({ name, id });
            }
        });

        // --- STRATÉGIE 2 : Extraction Regex dans le code Javascript ---
        // ADE stocke souvent les branches de l'arbre dans des objets JS au chargement
        const regex = /"id"\s*:\s*(\d+)\s*,\s*"name"\s*:\s*"([^"]+)"/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            if (!resources.find(r => r.id === match[1])) {
                resources.push({ name: match[2], id: match[1] });
            }
        }

        // --- SAUVEGARDE DANS UN FICHIER JSON ---
        if (resources.length > 0) {
            fs.writeFileSync('./ressources.json', JSON.stringify(resources, null, 2));
            console.log(`✅ Extraction réussie : ${resources.length} IDs sauvegardés dans ressources.json`);
            return res.json({ success: true, count: resources.length, message: "Fichier créé !" });
        } else {
            return res.status(404).json({ success: false, message: "Aucun ID trouvé sur la page." });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/agenda/:resourceId', async (req, res) => {
    const { resourceId } = req.params;
    
    // URL d'export direct de Rennes 1 (Pas besoin de login !)
    const url = `https://planning.univ-rennes1.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=${resourceId}&projectId=1&calType=ical&nbWeeks=4`;

    try {
        const webEvents = await ical.async.fromURL(url);
        
        const cours = Object.values(webEvents)
            .filter(event => event.type === 'VEVENT')
            .map(event => ({
                titre: event.summary,
                debut: event.start,
                fin: event.end,
                salle: event.location || "Non précisée",
                // On nettoie la description pour extraire le prof si possible
                prof: event.description ? event.description.split('\n')[0] : "Inconnu"
            }))
            // On trie par date la plus proche
            .sort((a, b) => new Date(a.debut) - new Date(b.debut));

        res.json({ success: true, agenda: cours });
    } catch (err) {
        console.error("🔥 Erreur iCal:", err.message);
        res.status(500).json({ success: false, message: "Impossible de lire le planning" });
    }
}); 

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
            
            // ---------------------------------------------------------
            // 🔥 LE PING SSO : On valide le passe-partout sur ADE
            // ---------------------------------------------------------
            console.log("🔑 Validation silencieuse de la session ADE...");
            await client.get('https://planning.univ-rennes1.fr/direct/myplanning.jsp', {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
            });
            console.log("✅ Session ADE prête !");
            // ---------------------------------------------------------

            const activities = [];
            const agenda = [];
            const cours = [];
            
            // On cherche le nom de l'étudiant
            const studentName = $dashboard('.userbutton .usertext').text().trim() || "Étudiant Rennes";

            // LOGIQUE DE SCRAPING (À affiner selon ton retour)

            const paymentLegend = {};
            $dashboard('#apsolu-dashboard-payment-legend ul li').each((i, el) => {
                // On prend le 'title' de l'image comme clé (ex: "dû", "payé")
                const iconTitle = $(el).find('img').attr('title');
                // On prend le texte explicatif juste après l'image
                const label = $(el).text().trim(); 
                
                if (iconTitle) {
                    paymentLegend[iconTitle] = label;
                }
            });


            const getPaymentStatus = (courseName) => {
                // On prend le premier mot (ex: "Escalade") en minuscules
                const firstWord = courseName.split(' ')[0].toLowerCase();
                let status = null;

                // On parcourt les éléments à payer dans l'onglet #payments
                $dashboard('#payments > ul.list-unstyled > li').each((i, el) => {
                    const itemText = $(el).text().toLowerCase();
                    console.log("test");
                    console.log(itemText);
                    
                    // Si la ligne contient le premier mot
                    if (itemText.includes(firstWord)) {
                        // On récupère le title de l'image de cette ligne
                        const iconTitle = $(el).find('img').attr('title');
                        
                        // On fait la correspondance avec notre légende
                        if (iconTitle && paymentLegend[iconTitle]) {
                            status = paymentLegend[iconTitle];
                        }
                    }
                });

                return status; // Retourne null si le mot n'est pas trouvé
            };

            // MES ACTIVITES
            $dashboard('#courses > ul > li').each((i, el) => {
                const rawText = $dashboard(el).find('.card-header').text().trim();

                const typeInscription = $dashboard(el).find('.card-body li').text().trim();

                if (rawText) {
                    // Logique de découpage : on peut essayer d'isoler le sport 
                    // Souvent le nom du sport est au début avant les horaires
                    const title = rawText.split(' - ')[0] || rawText;

                    const paymentStatus = getPaymentStatus(title);
                    
                    activities.push({
                        title: title,
                        type: typeInscription,
                        paymentStatus: paymentStatus
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

// 🗝️ FONCTION MAÎTRESSE POUR ACCÉDER À N'IMPORTE QUEL SERVICE DE RENNES 1
async function fetchProtectedService(targetUrl) {
    console.log(`\n🚀 Tentative d'accès sécurisé à : ${targetUrl}`);
    
    const stealthHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    // 💡 LA CORRECTION EST ICI : On commence directement sur l'URL cible (ADE). 
    // ADE va nous rediriger de lui-même vers le VRAI lien du CAS !
    let currentUrl = targetUrl;
    let response;
    
    for (let i = 0; i < 15; i++) {
        response = await client.get(currentUrl, {
            maxRedirects: 0, // On suit le chemin manuellement
            validateStatus: () => true,
            headers: stealthHeaders
        });

        const $ = cheerio.load(response.data);
        const samlActionUrl = $('form').attr('action');

        // SI ON TOMBE SUR UN FORMULAIRE SAML (Le billet d'or)
        if (samlActionUrl && (samlActionUrl.includes('SAML2/POST') || samlActionUrl.includes('Shibboleth.sso'))) {
            console.log("🎟️ Formulaire SAML détecté sur " + currentUrl);
            const samlData = new URLSearchParams();
            $('input[type="hidden"]').each((_, el) => {
                const name = $(el).attr('name');
                if (name) samlData.append(name, $(el).attr('value'));
            });

            response = await client.post(samlActionUrl, samlData, {
                maxRedirects: 0,
                validateStatus: () => true,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...stealthHeaders }
            });
        }

        // GESTION DES REDIRECTIONS
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            let nextUrl = response.headers.location;
            if (!nextUrl.startsWith('http')) {
                nextUrl = new URL(currentUrl).origin + (nextUrl.startsWith('/') ? '' : '/') + nextUrl;
            }
            console.log(`➡️ Redirection vers : ${nextUrl.split('?')[0]}...`); // Affiche juste le début de l'URL pour pas polluer
            currentUrl = nextUrl;
        } else {
            // FIN DU VOYAGE
            console.log(`✅ Arrivé à destination sur : ${currentUrl}`);
            break; 
        }
    }
    
    return cheerio.load(response.data);
}

router.get('/agenda', async (req, res) => {
    let browser;
    try {
        console.log("\n📅 [AGENDA] 1. Invocation du Navigateur Fantôme...");
        
        // On lance un vrai Google Chrome invisible
        browser = await puppeteer.launch({ 
            headless: "new", // Mode invisible
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        console.log("📅 [AGENDA] 2. Transfert des cookies de session...");
        
        // 🌟 LA MAGIE EST ICI : On vole les cookies d'Axios pour les donner à Puppeteer
        const adeCookies = jar.getCookiesSync('https://planning.univ-rennes1.fr').map(c => ({
            name: c.key, value: c.value, domain: 'planning.univ-rennes1.fr'
        }));
        const casCookies = jar.getCookiesSync('https://sso-cas.univ-rennes.fr').map(c => ({
            name: c.key, value: c.value, domain: 'sso-cas.univ-rennes.fr'
        }));

        // On injecte les passe-partouts dans le navigateur fantôme
        await page.setCookie(...adeCookies, ...casCookies);

        console.log("📅 [AGENDA] 3. Navigation furtive vers ADE Campus...");
        // On va sur ADE. Comme on a les cookies, pas besoin de taper le mot de passe !
        await page.goto('https://planning.univ-rennes1.fr/direct/myplanning.jsp', { 
            waitUntil: 'networkidle2', // On attend que la page ait fini de charger
            timeout: 30000 
        });

        console.log("📅 [AGENDA] 4. Attente de l'affichage de la grille...");
        // On attend qu'au moins un cours apparaisse à l'écran
        await page.waitForSelector('.eventText', { timeout: 15000 });

        console.log("📅 [AGENDA] 5. Aspiration des données...");
        // On exécute du code directement DANS le navigateur fantôme pour scraper le HTML
        const cours = await page.evaluate(() => {
            const result = [];
            document.querySelectorAll('div.eventText').forEach(el => {
                const htmlContent = el.innerHTML;
                if (htmlContent) {
                    const lignes = htmlContent
                        .split('<br>')
                        .map(ligne => ligne.replace(/<[^>]*>?/gm, '').trim())
                        .filter(ligne => ligne.length > 0);

                    if (lignes.length >= 4) {
                        const horaires = lignes[3].split(' - ');
                        result.push({
                            titre: lignes[0],
                            prof: lignes[1],
                            salle: lignes[2],
                            horaires: lignes[3],
                            groupes: [lignes[4] || ""]
                        });
                    }
                }
            });
            return result;
        });

        // On ferme le navigateur fantôme pour libérer la RAM
        await browser.close();

        console.log(`✅ [AGENDA] Succès absolu : ${cours.length} cours récupérés !`);
        res.json({ success: true, agenda: cours });

    } catch (error) {
        if (browser) await browser.close(); // Sécurité pour fermer le navigateur en cas de crash
        console.error("🔥 ERREUR AGENDA PUPPETEER :", error.message);
        res.status(500).json({ success: false, message: "Impossible de scraper ADE Campus." });
    }
});

router.get('/mails', async (req, res) => {
    // ⚠️ Version suspendue temporairement pour tester l'agenda
    console.log("📧 [MAILS] Scraping désactivé temporairement.");
    res.json({ success: true, mails: [] });
});

router.get('/fetch-ent', async (req, res) => {
    try {
        console.log("\n🔄 [ENT] Tentative de connexion silencieuse via le SSO...");

        let currentUrl = 'https://ent.univ-rennes1.fr/Login'; // La porte d'entrée
        let entResponse;
        let $ent;

        // 🕵️ LE TRACEUR MANUEL (La parade anti-bugs de cookies)
        for (let i = 0; i < 10; i++) {
            entResponse = await client.get(currentUrl, {
                maxRedirects: 0, // 🛑 On interdit à Axios de courir tout seul !
                validateStatus: () => true,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            // On charge le HTML de l'étape actuelle
            $ent = cheerio.load(entResponse.data);

            // ==========================================
            // PIÈGE #1 : Le Formulaire SAML caché
            // ==========================================
            const samlActionUrl = $ent('form').attr('action');
            if (samlActionUrl && (samlActionUrl.includes('SAML2/POST') || samlActionUrl.includes('Shibboleth.sso'))) {
                console.log("🎟️ Formulaire SAML détecté ! Validation manuelle...");
                const samlData = new URLSearchParams();
                $ent('input[type="hidden"]').each((_, el) => {
                    const name = $(el).attr('name');
                    const value = $(el).attr('value');
                    if (name) samlData.append(name, value);
                });

                entResponse = await client.post(samlActionUrl, samlData, {
                    maxRedirects: 0, // Toujours en manuel
                    validateStatus: () => true,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
            }

            // ==========================================
            // PIÈGE #2 : La Redirection Classique (302)
            // ==========================================
            if (entResponse.status >= 300 && entResponse.status < 400 && entResponse.headers.location) {
                let nextUrl = entResponse.headers.location;
                
                // Si l'URL de redirection est relative (ex: "/f/welcome...") on la reconstruit
                if (!nextUrl.startsWith('http')) {
                    const baseUrl = new URL(currentUrl).origin;
                    nextUrl = baseUrl + (nextUrl.startsWith('/') ? '' : '/') + nextUrl;
                }
                
                console.log(`➡️ Redirection (${entResponse.status}) vers : ${nextUrl}`);
                currentUrl = nextUrl; // On met à jour l'URL pour le prochain tour de boucle
            } else {
                // Si ce n'est pas une redirection et pas un formulaire SAML, on est arrivé à destination !
                console.log(`✅ Atterrissage final sur : ${currentUrl} (Status: ${entResponse.status})`);
                break; // On sort de la boucle
            }
        }

        // On recharge le HTML final
        $ent = cheerio.load(entResponse.data);
        const html = entResponse.data;

        // 2. Vérification finale
        const hasLogout = html.toLowerCase().includes('logout') || html.toLowerCase().includes('déconnexion');
        const isPublicPage = html.toLowerCase().includes('identifiez-vous');

        if (isPublicPage && !hasLogout) {
            console.log("❌ [ENT] Échec. On est resté sur la page publique.");
            return res.status(401).json({ success: false, message: "Le CAS n'a pas validé le ticket pour l'ENT." });
        }

        console.log("🎉 [ENT] Accès accordé en silence !");

        // ----------------------------------------------------
        // 3. ⛏️ SCRAPING DES DONNÉES
        // ----------------------------------------------------
        
        // Cible souvent utilisée dans uPortal pour afficher le nom
        const studentName = $ent('.user-name').first().text().trim() || "Étudiant(e)";

        const widgets = [];
        $ent('.up-portlet-title').each((i, el) => {
            const title = $ent(el).text().trim();
            if (title) widgets.push(title);
        });

        return res.json({ 
            success: true, 
            entData: {
                name: studentName,
                widgets: widgets
            }
        });

    } catch (error) {
        console.error("🔥 Crash route ENT :", error.message);
        res.status(500).json({ success: false, message: "Erreur serveur ENT" });
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