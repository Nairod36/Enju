import React, { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthContext } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/' 
}) => {
  const { isAuthenticated, isLoading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: redirectTo });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  // Afficher un loader pendant la vérification
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '50px', 
            height: '50px', 
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          Vérification de l'authentification...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Afficher message si non authentifié
  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>🔒 Accès Restreint</h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '30px', maxWidth: '500px' }}>
          Vous devez connecter votre wallet et signer le message d'authentification pour accéder à cette page.
        </p>
        <button
          onClick={() => navigate({ to: redirectTo })}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: '2px solid white',
            color: 'white',
            padding: '12px 30px',
            borderRadius: '25px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return <>{children}</>;
};