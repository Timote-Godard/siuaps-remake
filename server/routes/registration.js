import express from 'express';
import * as cheerio from 'cheerio';
import { client } from '../client.js';

const router = express.Router();

router.get('/registration-data', async (req, res) => {
    try {
        const url = 'https://mon-espace.siuaps.univ-rennes.fr/enrol/select/overview.php';
        const response = await client.get(url);
        const $ = cheerio.load(response.data);

        const activities = [];
        let currentActivity = null;

        const paymentLegend = {};
        $('#apsolu-dashboard-payment-legend ul li').each((i, el) => {
            // On prend le 'title' de l'image comme clé (ex: "dû", "payé")
            const iconTitle = $(el).find('img').attr('title');
            // On prend le texte explicatif juste après l'image
            const label = $(el).text().trim(); 
            
            if (iconTitle) {
                paymentLegend[iconTitle] = label;
            }
        });

        $('#apsolu-activities-table tbody tr').each((i, el) => {
            const $row = $(el);

            if ($row.hasClass('apsolu-sports-tr-activity')) {
                // New activity header
                const sportName = $row.find('.apsolu-sports-th-span').text().trim();
                const description = $row.find('.apsolu-sports-description').text().trim();
                
                currentActivity = {
                    name: sportName,
                    description: description,
                    slots: []
                };
                activities.push(currentActivity);
            } else if ($row.hasClass('apsolu-sports-tr-course')) {
                // Slot for the current activity
                const cells = $row.find('td');
                const enrolUrl = $row.find('.apsolu-enrol-a').attr('href');
                const enrolId = $row.find('.apsolu-enrol-a').data('enrolid');
                
                const sportDetails = cells.eq(2).find('div').map((i, div) => $(div).text().trim()).get();
                const day = cells.eq(3).text().trim();
                const startTime = cells.eq(4).text().trim();
                const endTime = cells.eq(5).text().trim();
                const level = cells.eq(6).text().trim();
                const location = cells.eq(8).find('span').text().trim();
                
                const typeTags = cells.eq(10).find('li i').map((i, icon) => {
                    const color = $(icon).css('color');
                    const label = $(icon).next('span').text().trim();
                    return { color, label };
                }).get();

                const places = cells.eq(11).text().trim();
                const placesClass = cells.eq(11).attr('class');

                if (currentActivity) {
                    currentActivity.slots.push({
                        id: enrolId,
                        enrolUrl,
                        details: sportDetails,
                        day,
                        startTime,
                        endTime,
                        level,
                        location,
                        typeTags,
                        places,
                        placesClass
                    });
                }
            }
        });

        res.json({ success: true, activities });
    } catch (error) {
        console.error("Erreur registration scraping:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la récupération des activités" });
    }
});

router.post('/enrol', async (req, res) => {
    const { enrolUrl } = req.body;
    if (!enrolUrl) return res.status(400).json({ success: false, message: "URL d'inscription manquante" });

    try {
        // Enrolment usually requires a GET or POST to the URL
        // In Moodle, it might lead to a confirmation page or just enrol the user.
        const response = await client.get(enrolUrl);
        // We might need to handle confirmation if Moodle asks for it.
        // For now, let's assume it works or we return the response data to handle on frontend
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error("Erreur enrol:", error);
        res.status(500).json({ success: false, message: "Erreur lors de l'inscription" });
    }
});

export default router;
