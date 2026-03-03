import express from 'express';
import * as cheerio from 'cheerio';
import { client } from '../client.js';

const router = express.Router();

// 🌟 1. AJOUT DES HEADERS MANQUANTS
const ROBOT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
};

// ⏱️ DICTIONNAIRE DE SUIVI DES VALIDATIONS (Stocké en RAM)
const userValidationTimers = new Map(); 

// 🚀 FONCTION DU TRAVAILLEUR DE L'OMBRE
const planifierValidationSiuaps = (userId, locationId, studentName) => {
    const NOW = Date.now();
    const DELAI_MIN = 35 * 60 * 1000; 
    
    // On utilise le NOM pour lier ses 2 créneaux, même s'il a 2 ID différents
    const timerKey = studentName || userId; 

    let tempsExecution = NOW;

    // S'il est DÉJÀ dans la file d'attente, on décale son exécution de 30 min !
    if (userValidationTimers.has(timerKey)) {
        const derniereValidation = userValidationTimers.get(timerKey);
        if (NOW - derniereValidation < DELAI_MIN) {
            tempsExecution = derniereValidation + DELAI_MIN;
        }
    }

    userValidationTimers.set(timerKey, tempsExecution);
    const delaiAvantExecution = Math.max(0, tempsExecution - NOW);

    console.log(`🕒 ${studentName || userId} sera validé sur le SIUAPS dans ${Math.round(delaiAvantExecution / 60000)} minutes.`);

    setTimeout(async () => {
        try {
            console.log(`🚀 [SIUAPS] Exécution de la validation silencieuse pour ${studentName || userId}...`);
            const urlValidation = `https://mon-espace.siuaps.univ-rennes.fr/local/apsolu_presence/index.php?tab=presence&courseid=250&userid=${userId}&locationid=${locationId}`;
            
            const response = await client.get(urlValidation, { headers: ROBOT_HEADERS });
            const $ = cheerio.load(response.data);
            
            if ($('.alert-success').length > 0) {
                console.log(`✅ [SUCCÈS] Étudiant ${studentName || userId} validé à la location ${locationId} !`);
            } else {
                console.log(`❌ [ÉCHEC] Étudiant ${studentName || userId} : le message de succès est introuvable.`);
            }
        } catch (error) {
            console.error(`🔥 [ERREUR SIUAPS] Validation de ${studentName || userId} échouée :`, error.message);
        }
    }, delaiAvantExecution);
};

// ... (GARDE TA ROUTE 1 '/validations' INTACTE ICI) ...

// --------------------------------------------------------
// ROUTE 1 : RÉCUPÉRATION DES CRÉNEAUX ET ÉTUDIANTS (FENÊTRE GLISSANTE)
// --------------------------------------------------------
router.post('/validations', async (req, res) => {
    // 🌟 1. On récupère le nouveau paramètre "searchMissing"
    const { url, archive, searchMissing } = req.body;

    if (!url) return res.status(400).json({ success: false, message: "URL manquante" });

    const fullUrl = url.startsWith('http') ? url : `https://mon-espace.siuaps.univ-rennes.fr${url}`;

    try {
        let allCreneaux = [];
        let currentDate = "";

      
        // 1. On charge la page demandée (ex: Page 2)
        const responseMain = await client.get(fullUrl, { validateStatus: () => true });
        const $main = cheerio.load(responseMain.data);

        // ==========================================================
        // 🧠 NOUVEAU RADAR MATHÉMATIQUE POUR LA PAGINATION
        // ==========================================================
        const offsetMap = {};
        const offsets = [];
        
        // On liste TOUS les liens de pagination et on extrait leur numéro "offset"
        $main('.pagination a').each((i, el) => {

            const href = $main(el).attr('href'); 
            if (href) {
                const match = href.match(/offset=(\d+)/);
                if (match) {
                    const val = parseInt(match[1], 10);
                    if (!offsets.includes(val)) offsets.push(val);
                    offsetMap[val] = href;
                }
            }
        });

        // Quel est notre numéro (offset) actuel ?
        let currentOffset = 0;
        
        // On cherche la page active dans le menu Moodle
        const activePageText = $main('.page-item.active').text().trim();
        
        if (activePageText) {
            // Si la page est "18", l'offset est "17"
            currentOffset = parseInt(activePageText, 10) - 1;
        } else {
            // Sécurité (au cas où il n'y a pas de pagination du tout)
            const fallbackMatch = fullUrl.match(/offset=(\d+)/);
            if (fallbackMatch) currentOffset = parseInt(fallbackMatch[1], 10);
        }

        offsets.sort((a, b) => a - b); // On trie du plus petit au plus grand
        
        let prevLink = null;
        let nextLink = null;

        // La page "Précédente", c'est le plus grand numéro juste en dessous du nôtre
        const prevOffsets = offsets.filter(o => o < currentOffset);
        if (prevOffsets.length > 0) prevLink = offsetMap[prevOffsets[prevOffsets.length - 1]];

        // La page "Suivante", c'est le plus petit numéro juste au-dessus du nôtre
        const nextOffsets = offsets.filter(o => o > currentOffset);
        if (nextOffsets.length > 0) nextLink = offsetMap[nextOffsets[0]];

        // On formate bien les liens
        if (prevLink && !prevLink.startsWith('http')) prevLink = `https://mon-espace.siuaps.univ-rennes.fr${prevLink}`;
        if (nextLink && !nextLink.startsWith('http')) nextLink = `https://mon-espace.siuaps.univ-rennes.fr${nextLink}`;

        // Ordre d'attaque STRICTEMENT CHRONOLOGIQUE pour la fusion
        const pagesToScrape = []; 

        // Stratégie par défaut (Fenêtre glissante)
        

        // 2. LOGIQUE ARCHIVE : On remplace tout si le mode archive est activé
        if (archive) { 
            console.log(`📚 Mode Archive : Récupération des ${currentOffset} pages précédentes`);

            // On récupère l'ID du scheduler dynamiquement depuis l'URL (7140 ou 7141)
            const schedulerIdMatch = fullUrl.match(/id=(\d+)/);
            const schedulerId = schedulerIdMatch ? schedulerIdMatch[1] : '7140';

            // Boucle pour générer toutes les pages depuis le début (offset 0) jusqu'à aujourd'hui
            for (let i = currentOffset; i > 0 ; i--) {
                // On construit l'URL proprement sans sesskey (souvent inutile en GET et risqué)
                pagesToScrape.push(`https://mon-espace.siuaps.univ-rennes.fr/mod/scheduler/view.php?id=${schedulerId}&subpage=allappointments&offset=${i}`);
            }
        }
        else {
            if (prevLink) pagesToScrape.push(prevLink);
            pagesToScrape.push(fullUrl);
            if (nextLink) pagesToScrape.push(nextLink);
        }
       
        // ==========================================================
        // 2. EXTRACTION DES DONNÉES SUR CES 3 PAGES
        // ==========================================================
        for (const pageUrl of pagesToScrape) {
            
            // On déclare clairement notre outil de lecture pour cette page
            let $page;
            if (pageUrl === fullUrl) {
                $page = $main; // On réutilise la page déjà téléchargée
            } else {
                const responsePage = await client.get(pageUrl, { validateStatus: () => true });
                $page = cheerio.load(responsePage.data);
            }

            // On utilise $page partout au lieu de $
            $page("tbody > tr").each((indexLigne, htmlLigne) => {
                const $row = $page(htmlLigne); // Plus d'erreur ici !
                
                const dateCell = $row.find('.cell.c1').text().trim();
                if (dateCell !== "") currentDate = dateCell;

                const debut = $row.find('.cell.c2').text().trim();
                const fin = $row.find('.cell.c3').text().trim();
                const lieu = $row.find('.cell.c4').text().trim();
                const formAction = $row.find('form.studentselectform').attr('action');


                

                const studentsDeCeCreneau = [];
                
                $row.find('.otherstudent').each((i, htmlEtudiant) => {
                    const $el = $page(htmlEtudiant); 
                    const appointmentId = $el.find('input.studentselect').val();
                    const isAlreadyChecked = $el.find('input.studentselect').is(':checked');

                    const img = $el.find('img.userpicture');
                    const initials = $el.find('.userinitials');
                    const fullName = img.attr('alt') || initials.attr('title') || initials.attr('aria-label') || $el.find('a').last().text().trim();
                    const imageUrl = img.attr('src') || null;

                    // =========================================================
                    // 🕵️ NOUVEAU : EXTRACTION DE L'ID STATIQUE (POUR LE SIUAPS)
                    // =========================================================
                    let staticId = null;
                    
                    // 1. La méthode parfaite : chercher dans le lien du profil
                    const profileLink = $el.find('a').attr('href');
                    if (profileLink) {
                        const idMatch = profileLink.match(/id=(\d+)/);
                        if (idMatch) staticId = idMatch[1]; // Ex: 12345
                    }

                    // 2. Le Plan B (Ton idée) : chercher dans l'image
                    if (!staticId && imageUrl) {
                        // pluginfile.php/107721/... (107721 est l'ID de contexte utilisateur)
                        const contextMatch = imageUrl.match(/pluginfile\.php\/(\d+)\//);
                        const revMatch = imageUrl.match(/rev=(\d+)/);

                        if (contextMatch) staticId = contextMatch[1];
                        else if (revMatch && revMatch[1] !== "0") staticId = revMatch[1];
                    }

                    if (fullName && appointmentId) {
                        studentsDeCeCreneau.push({
                            id: appointmentId,
                            staticId: staticId, // 🌟 ON SAUVEGARDE L'ID FIXE ICI !
                            name: fullName,
                            avatar: imageUrl,
                            initials: initials.text().trim() || null,
                            isChecked: isAlreadyChecked
                        });
                    }
                });

                if (debut && formAction) {
                    const slotMatch = formAction.match(/slotid=(\d+)/);
                    const uniqueSlotId = slotMatch ? slotMatch[1] : `${currentDate}-${debut}-${indexLigne}`;

                    

                const jourNom = currentDate.split(' ')[0].toLowerCase();
                const numJour = currentDate.split(' ')[1].toLowerCase();

                const maintenant = new Date();
                const currentJourNom = maintenant.getDay();
                const currentNumJour = maintenant.getDate().toString();

                const dicoJour = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];


                if ((jourNom === dicoJour[currentJourNom] && currentNumJour === numJour) || archive) {
                    allCreneaux.push({
                        id: uniqueSlotId,
                        actionUrl: formAction,
                        date: currentDate,
                        horaire: `${debut} - ${fin}`,
                        lieu: lieu,
                        students: studentsDeCeCreneau
                    });
                }

                    
                }
            });
        }

        if (archive) {
            const moisFr = {
                "janvier": 0, "février": 1, "mars": 2, "avril": 3, "mai": 4, "juin": 5,
                "juillet": 6, "août": 7, "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11
            };

            const parseMoodleDate = (dateStr) => {
                const parts = dateStr.toLowerCase().split(' ');
                // parts[1] = jour, parts[2] = mois, parts[3] = année
                return new Date(parts[3], moisFr[parts[2]], parts[1]).getTime();
            };

            const aujourdhui = new Date().setHours(23, 59, 59, 999); // Fin de journée d'aujourd'hui

            allCreneaux = allCreneaux
                .filter(slot => parseMoodleDate(slot.date) <= aujourdhui) // 🛡️ Filtre : Pas de futur
                .sort((a, b) => parseMoodleDate(b.date) - parseMoodleDate(a.date)); // 🔼 Tri : Plus récent en haut
        }

        if (archive) {
            const moisFr = {
                "janvier": 0, "février": 1, "mars": 2, "avril": 3, "mai": 4, "juin": 5,
                "juillet": 6, "août": 7, "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11
            };

            const parseMoodleDate = (dateStr) => {
                const parts = dateStr.toLowerCase().split(' ');
                return new Date(parts[3], moisFr[parts[2]], parts[1]).getTime();
            };

            const aujourdhui = new Date().setHours(23, 59, 59, 999); 

            allCreneaux = allCreneaux
                .filter(slot => parseMoodleDate(slot.date) <= aujourdhui) 
                .sort((a, b) => parseMoodleDate(b.date) - parseMoodleDate(a.date)); 
        }

        // 3. Suppression des éventuels doublons
        let uniqueSlots = Array.from(new Map(allCreneaux.map(s => [s.id, s])).values());

        // ==========================================================
        // 🎯 4. LE RADAR À OUBLIS (Nouveau !)
        // ==========================================================
        if (searchMissing && searchMissing.trim() !== "") {
            const searchLower = searchMissing.toLowerCase().trim();
            
            uniqueSlots = uniqueSlots.filter(slot => {
                // On vérifie si l'étudiant est dans ce créneau ET qu'il n'est PAS coché
                const isMissingHere = slot.students.some(s => 
                    s.name.toLowerCase().includes(searchLower) && !s.isChecked
                );
                return isMissingHere;
            }).map(slot => ({
                ...slot,
                // Pour que l'interface soit propre, on cache les autres étudiants du créneau 
                // et on ne garde que la personne qu'on recherche
                students: slot.students.filter(s => 
                    s.name.toLowerCase().includes(searchLower) && !s.isChecked
                )
            }));
        }

        return res.json({ success: true, slots: uniqueSlots });

    } catch (err) {
        return res.status(500).json({ success: false, message: "Erreur lors du scraping" });
    }
});

// --------------------------------------------------------
// ROUTE 2 : SAUVEGARDE INVISIBLE (CLIC PAR CLIC)
// --------------------------------------------------------
router.post('/save-attendance', async (req, res) => {
    // 🌟 On extrait bien la CIBLE (targetStudentId)
    const { actionUrl, presentIds, locationId, targetStudentId, studentName } = req.body;

    if (!actionUrl) return res.status(400).json({ success: false });

    try {
        const params = new URLSearchParams();
        
        // Moodle a besoin qu'on lui renvoie TOUS les IDs cochés du créneau
        if (presentIds && presentIds.length > 0) {
            presentIds.forEach(id => {
                params.append('seen[]', id); 
            });
        } else {
            params.append('seen[]', ''); 
        }

        // On valide le formulaire Moodle silencieusement !
        await client.post(actionUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        // 🎯 LE SECRET EST LÀ : On ne planifie QUE l'étudiant qu'on vient de cliquer
        if (locationId && targetStudentId) {
            planifierValidationSiuaps(targetStudentId, locationId, studentName);
        }

        return res.json({ success: true });

    } catch (err) {
        console.error("Erreur de sauvegarde :", err.message);
        return res.status(500).json({ success: false });
    }
});

export default router;