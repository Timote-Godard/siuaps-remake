import express from 'express';
import * as cheerio from 'cheerio';
import { client, jar } from '../client.js';
import ical from 'node-ical';
import fs from 'fs';

const router = express.Router();

// =================================================================
// 🎭 L'UNIFORME STRICT DU ROBOT (Pour éviter le vol de session CAS)
// =================================================================
const ROBOT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
};


router.get('/resources', async (req, res) => {
    try {
        // On cherche le fichier dans assets ou à la racine
        const path = fs.existsSync('./ressources.json') ? './ressources.json' : '../client/src/assets/ressources_rennes1.json';
        if (!fs.existsSync(path)) {
            return res.json({ success: true, resources: [] });
        }
        const data = fs.readFileSync(path, 'utf8');
        res.json({ success: true, resources: JSON.parse(data) });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erreur lecture ressources" });
    }
});

router.get('/agenda-merged', async (req, res) => {
    const { resources } = req.query; // Liste d'IDs séparés par des virgules
    if (!resources) return res.json({ success: true, agenda: [] });

    const url = `https://planning.univ-rennes1.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=${resources}&projectId=1&calType=ical&nbWeeks=4`;

    try {
        const webEvents = await ical.async.fromURL(url);
        const uniqueEvents = new Map();

        Object.values(webEvents)
            .filter(event => event.type === 'VEVENT')
            .forEach(event => {
                const key = `${event.summary}-${event.start.toISOString()}-${event.end.toISOString()}`;
                if (!uniqueEvents.has(key)) {
                    uniqueEvents.set(key, {
                        titre: event.summary,
                        debut: event.start,
                        fin: event.end,
                        salle: event.location || "Non précisée",
                        prof: event.description ? event.description.split('\n')[0] : "Inconnu"
                    });
                }
            });

        const sortedAgenda = Array.from(uniqueEvents.values())
            .sort((a, b) => new Date(a.debut) - new Date(b.debut));

        res.json({ success: true, agenda: sortedAgenda });
    } catch (err) {
        console.error("🔥 Erreur iCal Merged:", err.message);
        res.status(500).json({ success: false, message: "Impossible de lire le planning fusionné" });
    }
});

router.get('/admin/scrape-resources', async (req, res) => {
    try {
        console.log("🕵️ Démarrage de l'aspiration massive des IDs...");

        const targetUrl = 'https://planning.univ-rennes1.fr/direct/myplanning.jsp';
        
        const response = await client.get(targetUrl, {
            headers: { ...ROBOT_HEADERS }
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const resources = [];

        $('option').each((i, el) => {
            const id = $(el).attr('value');
            const name = $(el).text().trim();
            if (id && !isNaN(id) && parseInt(id) > 0) {
                resources.push({ name, id });
            }
        });

        const regex = /"id"\s*:\s*(\d+)\s*,\s*"name"\s*:\s*"([^"]+)"/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            if (!resources.find(r => r.id === match[1])) {
                resources.push({ name: match[2], id: match[1] });
            }
        }

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
                prof: event.description ? event.description.split('\n')[0] : "Inconnu"
            }))
            .sort((a, b) => new Date(a.debut) - new Date(b.debut));

        res.json({ success: true, agenda: cours });
    } catch (err) {
        console.error("🔥 Erreur iCal:", err.message);
        res.status(500).json({ success: false, message: "Impossible de lire le planning" });
    }
}); 

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  req.session.username = username;
  req.session.password = password;

  try {
    const wayfUrl = 'https://mon-espace.siuaps.univ-rennes.fr/auth/shibboleth/login.php';
    const myIdp = 'urn:mace:cru.fr:federation:univ-rennes1.fr'; 

    console.log("Étape 1 : Envoi du choix de l'école (Université de Rennes)...");
    const firstResponse = await client.post(wayfUrl, new URLSearchParams({
      idp: myIdp
    }), {
      maxRedirects: 10,
      headers: {
        ...ROBOT_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const $ = cheerio.load(firstResponse.data);
    const executionToken = $('input[name="execution"]').val();
    
    const loginActionUrl = firstResponse.request?.res?.responseUrl || firstResponse.config.url;
    const formData = new URLSearchParams();
    
    formData.append('username', username);
    formData.append('password', password);

    $('input[type="hidden"]').each((i, el) => {
        const name = $(el).attr('name');
        let value = $(el).attr('value') || ''; 
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
        ...ROBOT_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': loginActionUrl 
      }
    });

    console.log("Code HTTP de retour du CAS :", loginResponse.status);

    console.log("\n--- AUTOPSIE DU BOCAL APRÈS LOGIN ---");
    const cookiesDansLeBocal = jar.getCookiesSync('https://sso-cas.univ-rennes.fr');
    
    cookiesDansLeBocal.forEach(cookie => {
        if (cookie.key === 'TGC') {
            console.log("🔍 COOKIE TGC TROUVÉ ! Voici sa carte d'identité :");
            console.log(`- Domaine : ${cookie.domain}`);
            console.log(`- Chemin (Path) : ${cookie.path}`);
            console.log(`- Secure : ${cookie.secure}`);
            console.log(`- HttpOnly : ${cookie.httpOnly}`);
        }
    });
    console.log("-------------------------------------\n");

    const $final = cheerio.load(loginResponse.data);
    const bodyText = loginResponse.data;

    const samlActionUrl = $final('form').attr('action');

    if (samlActionUrl && samlActionUrl.includes('SAML2/POST')) {
        console.log("\nÉtape 3 : Le CAS a dit OUI ! Validation du ticket SAML vers le SIUAPS...");
        
        const samlData = new URLSearchParams();
        
        $final('input[type="hidden"]').each((i, el) => {
            const name = $(el).attr('name');
            const value = $(el).attr('value');
            if (name) samlData.append(name, value);
        });

        const finalResponse = await client.post(samlActionUrl, samlData, {
            maxRedirects: 10,
            validateStatus: () => true,
            headers: { 
                ...ROBOT_HEADERS,
                'Content-Type': 'application/x-www-form-urlencoded' 
            }
        });

        const $dashboard = cheerio.load(finalResponse.data);
        const finalBodyText = finalResponse.data;

        if (finalBodyText.includes('Déconnexion') || finalBodyText.includes('Mon compte') || finalBodyText.includes('Mes inscriptions')) {
            console.log("\n🎉 VICTOIRE ! Connecté au SIUAPS !");
            
            const bocalAvantADE = jar.getCookiesSync('https://sso-cas.univ-rennes.fr');
            const tgcBackup = bocalAvantADE.find(c => c.key === 'TGC');
            console.log(`[ENQUÊTE] TGC vivant AVANT ADE ? ${tgcBackup ? '🟢 OUI (Sauvegarde en cours...)' : '🔴 NON'}`);

            console.log("🔑 Validation silencieuse de la session ADE...");
            await client.get('https://planning.univ-rennes1.fr/direct/myplanning.jsp', {
                headers: { ...ROBOT_HEADERS }
            });
            console.log("✅ Session ADE prête !");

            if (tgcBackup) {
                console.log("🛟 RESTAURATION : ADE a tout cassé, on remet notre TGC de force !");
                tgcBackup.path = '/'; 
                jar.setCookieSync(tgcBackup, 'https://sso-cas.univ-rennes.fr');
            }

            const tgcFinal = jar.getCookiesSync('https://sso-cas.univ-rennes.fr').some(c => c.key === 'TGC');
            console.log(`[ENQUÊTE] TGC vivant APRÈS RESTAURATION ? ${tgcFinal ? '🟢 OUI' : '🔴 NON'}\n`);

            const activities = [];
            const agenda = [];
            const cours = [];
            
            const studentName = $dashboard('.userbutton .usertext').text().trim() || "Étudiant Rennes";

            const paymentLegend = {};
            $dashboard('#apsolu-dashboard-payment-legend ul li').each((i, el) => {
                const iconTitle = $(el).find('img').attr('title');
                const label = $(el).text().trim(); 
                if (iconTitle) {
                    paymentLegend[iconTitle] = label;
                }
            });

            const getPaymentStatus = (courseName) => {
                const firstWord = courseName.split(' ')[0].toLowerCase();
                let status = null;

                $dashboard('#payments > ul.list-unstyled > li').each((i, el) => {
                    const itemText = $(el).text().toLowerCase();
                    if (itemText.includes(firstWord)) {
                        const iconTitle = $(el).find('img').attr('title');
                        if (iconTitle && paymentLegend[iconTitle]) {
                            status = paymentLegend[iconTitle];
                        }
                    }
                });
                return status; 
            };

            $dashboard('#courses > ul > li').each((i, el) => {
                const rawText = $dashboard(el).find('.card-header').text().trim();
                const typeInscription = $dashboard(el).find('.card-body li').text().trim();

                if (rawText) {
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

            const bocalGlobal = jar.getCookiesSync('https://sso-cas.univ-rennes.fr');
            const tgcVivant = bocalGlobal.find(c => c.key === 'TGC');
            
            console.log("\n--- BILAN FIN DE LOGIN ---");
            if (tgcVivant) {
                console.log("🟢 Le TGC a survécu à SIUAPS et ADE. Il est prêt pour les mails !");
            } else {
                console.log("🔴 ASSASSINAT DÉTECTÉ : Le TGC a été tué pendant le scraping de SIUAPS ou ADE !");
            }
            console.log("--------------------------\n");

            return res.json({ 
                success: true, 
                user: { 
                    name: studentName, 
                    activites: activities, 
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
    console.error(error.message); 
    if(error.stack) console.error(error.stack.split('\n')[1]); 
    res.status(500).json({ success: false, message: "Crash serveur : " + error.message });
  }
});

// 🗝️ FONCTION MAÎTRESSE : LE PASSE-PARTOUT "DOUBLE LOGIN"
async function fetchProtectedService(targetUrl, username = null, password = null) {
    console.log(`\n🚀 Tentative d'accès sécurisé à : ${targetUrl}`);
    
    const stealthHeaders = { ...ROBOT_HEADERS };

    let currentUrl = targetUrl;
    let response;
    
    for (let i = 0; i < 30; i++) {
        response = await client.get(currentUrl, {
            maxRedirects: 0, 
            validateStatus: () => true,
            headers: stealthHeaders
        });

        let $ = cheerio.load(response.data);
        
        const isCasLoginPage = $('input[name="username"]').length > 0 && $('input[name="password"]').length > 0;
        
        if (isCasLoginPage && username && password) {
            console.log(`🛡️ Mur CAS détecté ! Injection tactique des identifiants...`);
            
            const loginData = new URLSearchParams();
            loginData.append('username', username);
            loginData.append('password', password);

            $('input[type="hidden"]').each((_, el) => {
                const name = $(el).attr('name');
                if (name && name !== 'geolocation') loginData.append(name, $(el).attr('value') || '');
            });

            let postUrl = $('form').attr('action') || currentUrl;
            if (!postUrl.startsWith('http')) postUrl = new URL(currentUrl).origin + (postUrl.startsWith('/') ? '' : '/') + postUrl;

            response = await client.post(postUrl, loginData.toString(), {
                maxRedirects: 0,
                validateStatus: () => true,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': currentUrl, ...stealthHeaders }
            });
            
            $ = cheerio.load(response.data);
        }

        const formAction = $('form').attr('action') || '';
        const isSamlForm = formAction && (
            $('input[name="SAMLResponse"]').length > 0 ||
            $('input[name="RelayState"]').length > 0 ||
            $('form').attr('id') === 'autosubmit' ||
            formAction.includes('SAML2/POST') ||
            formAction.includes('Shibboleth.sso')
        );

        if (isSamlForm) {
            console.log(`🎟️ Billet SAML détecté. Validation automatique...`);
            const samlData = new URLSearchParams();
            $('input[type="hidden"]').each((_, el) => {
                const name = $(el).attr('name');
                if (name) samlData.append(name, $(el).attr('value') || '');
            });

            let postUrl = formAction;
            if (!postUrl.startsWith('http')) postUrl = new URL(currentUrl).origin + (postUrl.startsWith('/') ? '' : '/') + postUrl;

            response = await client.post(postUrl, samlData.toString(), {
                maxRedirects: 0,
                validateStatus: () => true,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...stealthHeaders }
            });
        }

        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            let nextUrl = response.headers.location;
            if (!nextUrl.startsWith('http')) nextUrl = new URL(currentUrl).origin + (nextUrl.startsWith('/') ? '' : '/') + nextUrl;
            
            console.log(`➡️ Redirection vers : ${nextUrl.split('?')[0]}...`);
            currentUrl = nextUrl;
        } 
        else if (response.status === 200 && !isSamlForm && !isCasLoginPage) {
            console.log(`✅ Arrivé à destination sur : ${currentUrl}`);
            break; 
        }
    }
    
    return cheerio.load(response.data);
}

// =================================================================
// 🛠️ FONCTION DE SECOURS : RECONNEXION INVISIBLE AU CAS
// =================================================================
async function relancerSessionCAS(username, password) {
    try {
        console.log("🔄 [AUTO-LOGIN] Relance de la session CAS en arrière-plan...");
        
        const wayfUrl = 'https://mon-espace.siuaps.univ-rennes.fr/auth/shibboleth/login.php';
        const myIdp = 'urn:mace:cru.fr:federation:univ-rennes1.fr'; 

        const firstResponse = await client.post(wayfUrl, new URLSearchParams({ idp: myIdp }), {
            maxRedirects: 10,
            headers: { 
                ...ROBOT_HEADERS,
                'Content-Type': 'application/x-www-form-urlencoded' 
            }
        });

        const $ = cheerio.load(firstResponse.data);
        const loginActionUrl = firstResponse.request?.res?.responseUrl || firstResponse.config.url;

        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        $('input[type="hidden"]').each((i, el) => {
            const name = $(el).attr('name');
            if (name && name !== 'geolocation') formData.append(name, $(el).attr('value') || '');
        });

        const loginResponse = await client.post(loginActionUrl, formData, {
            maxRedirects: 10,
            validateStatus: () => true, 
            headers: { 
                ...ROBOT_HEADERS,
                'Content-Type': 'application/x-www-form-urlencoded' 
            }
        });

        const $final = cheerio.load(loginResponse.data);
        const samlActionUrl = $final('form').attr('action');

        if (samlActionUrl && samlActionUrl.includes('SAML2/POST')) {
            console.log("✅ [AUTO-LOGIN] Cookies rafraîchis avec succès !");
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("🔥 [AUTO-LOGIN] Échec :", error.message);
        return false;
    }
}   


// -----------------------------------------------------------------
// ROUTE MAILS (100% Cookies, Crawler Manuel, Uniforme Strict)
// -----------------------------------------------------------------
router.get('/mails', async (req, res) => {
    try {
        console.log("\n🚀 [MAILS] 1. Démarrage du Crawler Manuel vers Zimbra...");

        let currentUrl = 'https://partage.univ-rennes1.fr/';
        let response;
        let authReussie = false;

        for (let i = 0; i < 30; i++) {
            console.log(`\n[SAUT ${i + 1}] 🌐 URL : ${currentUrl.split('?')[0]}`);

            const bocalGlobal = jar.getCookiesSync('https://sso-cas.univ-rennes.fr');
            const tgc = bocalGlobal.find(c => c.key === 'TGC');
            
            if (tgc) {
                console.log(`[SAUT ${i + 1}] 🟢 TGC est VIVANT dans le bocal ! (SameSite: ${tgc.sameSite || 'Non défini'})`);
            } else {
                console.log(`[SAUT ${i + 1}] 🔴 ALERTE : Le TGC n'existe plus dans le bocal !`);
            }

            const cookiesForUrl = jar.getCookiesSync(currentUrl);
            const cookieNames = cookiesForUrl.map(c => c.key).join(', ') || 'AUCUN';
            console.log(`[SAUT ${i + 1}] 🍪 Cookies autorisés pour ce saut : ${cookieNames}`);

            // 🎭 On enfile l'uniforme !
            const specificHeaders = { ...ROBOT_HEADERS };
            
            // Si on saute vers le CAS, on fait croire qu'on vient de Shibboleth
            if (currentUrl.includes('sso-cas.univ-rennes.fr')) {
                specificHeaders['Referer'] = 'https://ident-shib.univ-rennes1.fr/';
            }

            response = await client.get(currentUrl, {
                maxRedirects: 0,
                validateStatus: () => true,
                headers: specificHeaders
            });

            console.log(`[SAUT ${i + 1}] 📥 Réponse HTTP : ${response.status}`);

            if (response.status >= 300 && response.status < 400 && response.headers.location) {
                let nextUrl = response.headers.location;
                if (!nextUrl.startsWith('http')) nextUrl = new URL(currentUrl).origin + (nextUrl.startsWith('/') ? '' : '/') + nextUrl;
                
                if (nextUrl.includes('/service/preauth')) {
                    console.log(`[SAUT ${i + 1}] 💎 URL Preauth détectée ! C'est elle qui donne le token !`);
                }
                
                currentUrl = nextUrl;
                continue;
            }

            // =======================================================
            // Cas B : Formulaires de Rebond (SAML ou Auto-Submit)
            // =======================================================
            const $ = cheerio.load(typeof response.data === 'string' ? response.data : '');
            const formAction = $('form').attr('action') || '';
            const isAutoSubmit = formAction && (
                $('input[name="SAMLResponse"]').length > 0 || 
                $('input[name="RelayState"]').length > 0 ||
                $('form').attr('id') === 'autosubmit' ||
                $('body').attr('onload')?.includes('submit')
            );

            if (isAutoSubmit) {
                console.log(`[SAUT ${i + 1}] 🎟️ Formulaire de rebond détecté vers : ${formAction.substring(0, 50)}...`);
                const formData = new URLSearchParams();
                $('input[type="hidden"], input[type="text"]').each((_, el) => {
                    const name = $(el).attr('name');
                    if (name) formData.append(name, $(el).attr('value') || '');
                });

                let postUrl = formAction.startsWith('http') ? formAction : new URL(currentUrl).origin + formAction;
                
                response = await client.post(postUrl, formData.toString(), {
                    maxRedirects: 0,
                    validateStatus: () => true,
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        ...ROBOT_HEADERS 
                    }
                });

                if (response.status >= 300 && response.status < 400 && response.headers.location) {
                    let nextUrl = response.headers.location;
                    if (!nextUrl.startsWith('http')) nextUrl = new URL(postUrl).origin + nextUrl;
                    currentUrl = nextUrl;
                    continue;
                }
            }

            // =======================================================
            // Cas C : La Redirection invisible JS (Meta-Refresh)
            // Très utilisée par Renater pour sauter vers Zimbra
            // =======================================================
            const metaRefresh = $('meta[http-equiv="refresh"]').attr('content') || $('meta[http-equiv="Refresh"]').attr('content');
            if (metaRefresh && !isAutoSubmit) {
                const match = metaRefresh.match(/url=['"]?([^'"]+)['"]?/i);
                if (match && match[1]) {
                    console.log(`[SAUT ${i + 1}] 🔄 Meta-Refresh détecté vers : ${match[1].substring(0, 50)}...`);
                    let nextUrl = match[1];
                    if (!nextUrl.startsWith('http')) nextUrl = new URL(currentUrl).origin + (nextUrl.startsWith('/') ? '' : '/') + nextUrl;
                    currentUrl = nextUrl;
                    continue;
                }
            }

            // =======================================================
            // Cas D : Atterrissage définitif sur une page (Code 200)
            // =======================================================
            if (response.status === 200 && !isAutoSubmit && !metaRefresh) {
                if ($('input[name="username"]').length > 0) {
                    console.log(`[SAUT ${i + 1}] ❌ MUR CAS ! Le cookie TGC n'a pas été reconnu.`);
                    break;
                }
                
                // On vérifie qu'on a bien notre récompense avant de crier victoire
                const bocalZimbra = jar.getCookiesSync('https://partage.univ-rennes1.fr');
                if (bocalZimbra.some(c => c.key === 'ZM_AUTH_TOKEN')) {
                    console.log(`[SAUT ${i + 1}] ✅ Atterrissage final validé, ZM_AUTH_TOKEN en poche !`);
                    authReussie = true;
                } else {
                    console.log(`[SAUT ${i + 1}] ⚠️ Page 200 atteinte sur ${currentUrl}, mais pas de jeton Zimbra. On continue d'attendre ou c'est une impasse.`);
                }
                break;
            }
        
        }

        if (!authReussie) return res.status(401).json({ success: false, message: "Bloqué par le CAS." });

        const zimbraCookies = jar.getCookiesSync('https://partage.univ-rennes1.fr');
        if (!zimbraCookies.some(c => c.key === 'ZM_AUTH_TOKEN')) {
            console.log("❌ JETON MANQUANT : Le ZM_AUTH_TOKEN n'a pas été trouvé dans le pot.");
            return res.status(401).json({ success: false, message: "Jeton Zimbra introuvable." });
        }

        // =======================================================
        // 3. RÉCUPÉRATION VIA L'API JSON (PAS DE TRONCATURE)
        // =======================================================
        console.log("💎 [MAILS] Accès à l'API JSON pour éviter les '...'");

        // On demande les 20 derniers messages du dossier "inbox" en JSON
        const jsonUrl = 'https://partage.univ-rennes1.fr/home/~/inbox.json?limit=20';

        const mailResponse = await client.get(jsonUrl, {
            headers: ROBOT_HEADERS // Le ZM_AUTH_TOKEN fait tout le travail
        });

        const data = mailResponse.data;
        const mails = [];
        let unreadCount = 0;

        // Zimbra renvoie un objet m (messages)
        if (data.m) {
            data.m.forEach((msg, index) => {
                // f: "u" signifie unread (non lu)
                const isUnread = msg.f && msg.f.includes('u');
                if (isUnread) unreadCount++;

                mails.push({
                    id: msg.id,
                    // e: [ {d: "Nom", a: "email"} ] -> on prend le premier expéditeur
                    sender: msg.e && msg.e[0] ? (msg.e[0].d || msg.e[0].a) : "Inconnu",
                    subject: msg.su || "(Sans objet)", // su: Subject (COMPLET !)
                    isUnread: !!isUnread,
                    date: new Date(msg.d).toLocaleDateString('fr-FR') // d: Date timestamp
                });
            });
        }

        console.log(`🏆 [MAILS] Victoire ! ${mails.length} mails complets récupérés.`);

        res.json({ 
            success: true, 
            unreadCount, 
            recentMails: mails 
        });

    } catch (error) {
        console.error("🔥 ERREUR ZIMBRA :", error.message);
        res.status(500).json({ success: false });
    }
});

// Fonction utilitaire pour fouiller dans l'oignon Zimbra
function findMailBody(part) {
    // Si cette partie a du contenu direct, c'est gagné !
    if (part.content && (part.ct === 'text/html' || part.ct === 'text/plain')) {
        return { content: part.content, type: part.ct };
    }
    // Sinon, si elle a des sous-parties (mp), on fouille dedans
    if (part.mp) {
        for (const subPart of part.mp) {
            const found = findMailBody(subPart);
            if (found) return found;
        }
    }
    return null;
}

router.get('/mail/:id', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`📖 [MAIL] Extraction via Vue Impression du message ID: ${id}`);

        // On utilise la vue Print de Zimbra (le Graal du scraping)
        const response = await client.get(`https://partage.univ-rennes1.fr/h/printmessage?id=${id}`, {
            headers: ROBOT_HEADERS,
            responseType: 'text'
        });

        const $ = cheerio.load(response.data);
        
        // 1. On cible spécifiquement la boîte qui contient le vrai message
        let $mailBody = $('#iframeBody.MsgBody-html');

        // Sécurité si Zimbra change l'ID
        if ($mailBody.length === 0) {
            $mailBody = $('.Msg');
        }

        // 2. LE GRAND COUP DE BALAI
        // On supprime les styles globaux et les scripts de la page d'impression
        $mailBody.find('style, script, link, meta, title').remove();

        // On enlève les styles "en ligne" pour que ton CSS React prenne le dessus
        $mailBody.find('*').removeAttr('style').removeAttr('class');

        let cleanHtml = $mailBody.html();

        if (!cleanHtml || cleanHtml.trim() === '') {
            cleanHtml = "<p>⚠️ Contenu introuvable. Ce message est peut-être chiffré ou vide.</p>";
        }

        res.json({ success: true, body: cleanHtml });
    } catch (error) {
        console.error("🔥 ERREUR LECTURE MAIL :", error.message);
        res.status(500).json({ success: false, message: "Impossible de lire le mail." });
    }
});

router.get('/fetch-ent', async (req, res) => {
    try {
        console.log("\n🔄 [ENT] Tentative de connexion silencieuse via le SSO...");

        let currentUrl = 'https://ent.univ-rennes1.fr/Login'; 
        let entResponse;
        let $ent;

        for (let i = 0; i < 10; i++) {
            entResponse = await client.get(currentUrl, {
                maxRedirects: 0, 
                validateStatus: () => true,
                headers: { ...ROBOT_HEADERS }
            });

            $ent = cheerio.load(entResponse.data);

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
                    maxRedirects: 0, 
                    validateStatus: () => true,
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        ...ROBOT_HEADERS 
                    }
                });
            }

            if (entResponse.status >= 300 && entResponse.status < 400 && entResponse.headers.location) {
                let nextUrl = entResponse.headers.location;
                if (!nextUrl.startsWith('http')) {
                    const baseUrl = new URL(currentUrl).origin;
                    nextUrl = baseUrl + (nextUrl.startsWith('/') ? '' : '/') + nextUrl;
                }
                
                console.log(`➡️ Redirection (${entResponse.status}) vers : ${nextUrl}`);
                currentUrl = nextUrl; 
            } else {
                console.log(`✅ Atterrissage final sur : ${currentUrl} (Status: ${entResponse.status})`);
                break; 
            }
        }

        $ent = cheerio.load(entResponse.data);
        const html = entResponse.data;

        const hasLogout = html.toLowerCase().includes('logout') || html.toLowerCase().includes('déconnexion');
        const isPublicPage = html.toLowerCase().includes('identifiez-vous');

        if (isPublicPage && !hasLogout) {
            console.log("❌ [ENT] Échec. On est resté sur la page publique.");
            return res.status(401).json({ success: false, message: "Le CAS n'a pas validé le ticket pour l'ENT." });
        }

        console.log("🎉 [ENT] Accès accordé en silence !");
        
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
        const response = await client.get('https://mon-espace.siuaps.univ-rennes.fr/', {
            maxRedirects: 5,
            validateStatus: () => true,
            headers: { ...ROBOT_HEADERS }
        });

        const html = response.data;

        if (html.includes('Déconnexion') || html.includes('Mon compte')) {
            return res.json({ success: true, message: "Session CAS toujours active" });
        } else {
            return res.status(401).json({ success: false, message: "Session expirée" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});


router.post('/logout', (req, res) => {
    jar.removeAllCookiesSync(); 
    res.json({ success: true });
});

export default router;