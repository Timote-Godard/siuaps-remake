import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Validations from './components/Validations'; 
import Registration from './components/Registration';
import Hub from './components/Hub';
import EntDashboard from './components/EntDashboard'; // À créer plus tard

const App = () => {
  const [userData, setUserData] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  
  // 🧭 LA BOUSSOLE DE L'APPLICATION (Au lieu des vieux booléens)
  // Valeurs possibles : 'LOGIN', 'HUB', 'SIUAPS_DASHBOARD', 'SIUAPS_VALIDATIONS', 'SIUAPS_REGISTRATION', 'ENT_DASHBOARD'
  const [currentStep, setCurrentStep] = useState('LOGIN'); 
  const [selectedUrl, setSelectedUrl] = useState(null); // Toujours utile pour passer l'URL aux validations

  // 1. VÉRIFICATION AU LANCEMENT
  useEffect(() => {
    if (localStorage.getItem('siuaps_data')) {
      setIsCheckingSession(true);
      const checkSession = async () => {
        try {
          const res = await fetch('http://localhost:5000/api/verify');
          const data = await res.json();

          if (data.success) {
            const savedData = localStorage.getItem('siuaps_data');
            if (savedData) {
              setUserData(JSON.parse(savedData));
              // Si connecté -> On va direct sur le HUB !
              setCurrentStep('HUB'); 
            }
          } else {
            // Si la session a expiré sur le serveur, on nettoie
            localStorage.removeItem('siuaps_data');
            setCurrentStep('LOGIN');
          }
        } catch (error) {
          console.error("Impossible de joindre le serveur", error);
        } finally {
          setIsCheckingSession(false);
        }
      };
      checkSession();
    }
  }, []);

  // 2. ACTIONS GLOBALES
  const handleLogout = async () => {
    await fetch('http://localhost:5000/api/logout', { method: 'POST' });
    setUserData(null);
    localStorage.removeItem('siuaps_data');
    setCurrentStep('LOGIN'); // Retour à la case départ
  };

  const handleLoginSuccess = (data) => {
    setUserData(data.user);
    localStorage.setItem('siuaps_data', JSON.stringify(data.user));
    setCurrentStep('HUB'); // Après le login -> Direction le HUB
  };

  // ÉCRAN DE CHARGEMENT BRUTALISTE
  if (isCheckingSession) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white border-8 border-green-600">
        <h1 className="text-4xl font-green-600 uppercase tracking-tighter">SIUAPS</h1>
        <p className="font-bold text-sm bg-green-600 text-white px-2 py-1 mt-2 uppercase animate-pulse">Connexion automatique...</p>
      </div>
    );
  }

  // 3. LE ROUTEUR VISUEL (Très propre et facile à lire)
  return (
    <div className="app-container bg-white min-h-screen">
      
      {currentStep === 'LOGIN' && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}

      {currentStep === 'HUB' && (
        <Hub 
          studentName={userData?.name || "Étudiant"} 
          onSelect={(choice) => setCurrentStep(choice === 'SIUAPS' ? 'SIUAPS_DASHBOARD' : 'ENT_DASHBOARD')} 
          onLogout={handleLogout}
        />
      )}

      {currentStep === 'SIUAPS_DASHBOARD' && (
        <Dashboard 
          userData={userData} 
          onBack={() => setCurrentStep('HUB')} // Nouveau prop pour retourner au Hub !
          onNavigateToSlots={(url) => { 
              setSelectedUrl(url); 
              setCurrentStep('SIUAPS_VALIDATIONS'); 
          }}
          onNavigateToRegistration={() => setCurrentStep('SIUAPS_REGISTRATION')}
        />
      )}

      {currentStep === 'SIUAPS_VALIDATIONS' && (
        <Validations 
          url={selectedUrl} 
          onBack={() => setCurrentStep('SIUAPS_DASHBOARD')} 
        />
      )}

      {currentStep === 'SIUAPS_REGISTRATION' && (
        <Registration 
          onBack={() => setCurrentStep('SIUAPS_DASHBOARD')} 
        />
      )}

      {currentStep === 'ENT_DASHBOARD' && (
        <EntDashboard 
            onBack={() => setCurrentStep('HUB')}
        />
      )}

    </div>
  );
};

export default App;