import express from 'express';
import * as cheerio from 'cheerio';
import { client } from '../client.js';

const router = express.Router();

// --------------------------------------------------------
// ROUTE 1 : RÉCUPÉRATION DES CRÉNEAUX ET ÉTUDIANTS (FENÊTRE GLISSANTE)
// --------------------------------------------------------
router.post('/validations', async (req, res) => {
    const { url, archive } = req.body;

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
                    const $el = $page(htmlEtudiant); // Et plus d'erreur ici non plus !
                    const appointmentId = $el.find('input.studentselect').val();
                    const isAlreadyChecked = $el.find('input.studentselect').is(':checked');

                    const img = $el.find('img.userpicture');
                    const initials = $el.find('.userinitials');
                    const fullName = img.attr('alt') || initials.attr('title') || initials.attr('aria-label') || $el.find('a').last().text().trim();
                    const imageUrl = img.attr('src') || null;

                    if (fullName && appointmentId) {
                        studentsDeCeCreneau.push({
                            id: appointmentId,
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
                const currentNumJour = "20"; //maintenant.getDate()

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

        // 3. Suppression des éventuels doublons (si Moodle répète une ligne en fin de page)
        const uniqueSlots = Array.from(new Map(allCreneaux.map(s => [s.id, s])).values());

        return res.json({ success: true, slots: uniqueSlots });

    } catch (err) {
        return res.status(500).json({ success: false, message: "Erreur lors du scraping" });
    }
});

// --------------------------------------------------------
// ROUTE 2 : SAUVEGARDE INVISIBLE (CLIC PAR CLIC)
// --------------------------------------------------------
router.post('/save-attendance', async (req, res) => {
    const { actionUrl, presentIds } = req.body;

    if (!actionUrl) return res.status(400).json({ success: false });

    try {
        const params = new URLSearchParams();
        
        // Moodle a besoin qu'on lui renvoie TOUS les IDs cochés du créneau
        if (presentIds && presentIds.length > 0) {
            presentIds.forEach(id => {
                params.append('seen[]', id); 
            });
        } else {
            // S'il n'y a plus personne de coché, on envoie un paramètre vide
            params.append('seen[]', ''); 
        }

        // On valide le formulaire Moodle silencieusement !
        await client.post(actionUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        return res.json({ success: true });

    } catch (err) {
        console.error("Erreur de sauvegarde :", err.message);
        return res.status(500).json({ success: false });
    }
});

export default router;