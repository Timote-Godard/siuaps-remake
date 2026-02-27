import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Validations from './components/Validations'; 
import Registration from './components/Registration'; // Nouveau composant d'inscription

const App = () => {
  const [userData, setUserData] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  
  // NOUVEAU : L'état qui gère l'ouverture d'une page de créneaux
  const [selectedUrl, setSelectedUrl] = useState(null); 
  const [showRegistration, setShowRegistration] = useState(false); // État pour l'inscription

  // Vérification au lancement de l'application
  useEffect(() => {
    if (localStorage.getItem('siuaps_data')) {
      setIsCheckingSession(true);
      const checkSession = async () => {
        try {
          // 1. On demande à Node.js si sa session est toujours bonne
          const res = await fetch('http://localhost:5000/api/verify');
          const data = await res.json();

          if (data.success) {
            // 2. Si oui, on récupère tes sports sauvegardés dans ton navigateur
            const savedData = localStorage.getItem('siuaps_data');
            if (savedData) {
              setUserData(JSON.parse(savedData));
              setIsLoggedIn(true);
            }
          }
        } catch (error) {
          console.error("Impossible de joindre le serveur", error);
        } finally {
          // Quoi qu'il arrive, on enlève l'écran de chargement
          setIsCheckingSession(false);
        }
      };
      checkSession();
    };

    
  }, []);

  // Fonction de déconnexion
  const handleLogout = async () => {
    // On prévient le serveur de jeter ses cookies
    await fetch('http://localhost:5000/api/logout', { method: 'POST' });
    
    setUserData(null);
    setIsLoggedIn(false);
    localStorage.removeItem('siuaps_data'); // On vide le navigateur
  };

  const handleLoginSuccess = (data) => {
    setUserData(data.user);
    setIsLoggedIn(true);
    // On sauvegarde tes infos dans le navigateur pour le prochain F5
    localStorage.setItem('siuaps_data', JSON.stringify(data.user));
  };

  

  // ÉCRAN DE CHARGEMENT BRUTALISTE (Pendant la vérification)
  if (isCheckingSession) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white border-8 border-green-600">
        <h1 className="text-4xl font-green-600 uppercase tracking-tighter">SIUAPS</h1>
        <p className="font-bold text-sm bg-green-600 text-white px-2 py-1 mt-2 uppercase">Connexion automatique...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {!isLoggedIn ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : showRegistration ? (
        // PAGE D'INSCRIPTION
        <Registration 
          onBack={() => setShowRegistration(false)} 
        />
      ) : selectedUrl ? (
        // SI UNE URL EST SÉLECTIONNÉE -> ON AFFICHE LES CRÉNEAUX EN PLEIN ÉCRAN
        <Validations 
          url={selectedUrl} 
          onBack={() => setSelectedUrl(null)} // Fonction pour revenir au dashboard
        />
      ) : (
        // SINON -> ON AFFICHE LE DASHBOARD
        <Dashboard 
          userData={userData} 
          onLogout={handleLogout}
          onNavigateToSlots={(url) => setSelectedUrl(url)} // On passe la fonction pour changer de page
          onNavigateToRegistration={() => setShowRegistration(true)} // Nouvelle fonction
        />
      )}
    </div>
  );
};

export default App;