import React, { useState } from 'react';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Remplace l'URL par celle de ton serveur Node
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      console.log(data);

      if (data.success) {
        onLoginSuccess(data);
      } else {
        setError(data.message || 'Identifiants incorrects');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='relative min-w-screen min-h-screen flex items-center justify-center'>
      
      {/* Overlay pour assombrir le fond et faire ressortir le formulaire */}
      <div className=""></div>

      <div className="relative z-10 w-full max-w-sm p-6">
        <form 
          onSubmit={handleSubmit}
          className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-sm"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black uppercase tracking-tighter">SIUAPS</h1>
            <p className="font-bold text-sm text-gray-500 uppercase">Université de Rennes</p>
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-black p-3 mb-6 text-red-700 font-bold text-sm italic">
              ⚠ {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-black uppercase mb-1">Identifiant ENT</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border-2 border-black p-3 font-bold focus:outline-none placeholder:text-gray-300"
                placeholder="ex: pnom01"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-black p-3 font-bold focus:outline-none placeholder:text-gray-300"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`cursor-pointer w-full border-4 border-black p-4 font-black uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 ${
                loading ? 'bg-gray-200 cursor-not-allowed' : 'bg-green-500 hover:bg-green-400 text-black'
              }`}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase">
              Tes identifiants sont transmis de manière sécurisée au CAS de Rennes.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;