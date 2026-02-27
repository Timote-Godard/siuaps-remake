# siuaps remake
## Interface
J'ai voulu créer une interface beaucoup plus moderne du site avec des transitions et un design très différente

J'ai également retravaillé les éléments qui devraient être affiché pour ne laisser que 3 à 4 boutons en bas de l'écran afin de simplifier l'expérince utilisateur.

## Fonctionnement
### Étape 1 : login
Lorsque vous renseignez vos informations dans le login, une requête est envoyé au serveur SIUAPS pour simuler une connexion, si les identifiants sont bons la connexion réussi et on récupère alors le cookie qui permet de passer toutes les portes (ce même cookie qui évite qu'on ait besoin de se reconnecter lorsqu'on actualise la page).

### Étape 2 : Dashboard
après s'être connecté on obtient en brut la page d'accueil du site, il suffit de trier les informations qu'on souhaite récupérer grâce aux balises pour ensuite les réutiliser sur la version remake du site.

### Étape 3 : Validation 
pour valider des personnes inscrites, on trie les créneaux en fonction du jour et de l'heure de la journée pour n'obtenir que le créneaux actuel. Afin d'être sûr de ne pas oublier une heure sur la page d'avant on récupère la liste des créneaux de la page X-1, X (page actuelle) et X+1.
