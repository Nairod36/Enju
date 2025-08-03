import React from 'react';
import { Star, Zap } from 'lucide-react';
import { User } from '../hooks/useAuth';

interface PlayerLevelProps {
  user: User;
  className?: string;
}

export function PlayerLevel({ user, className = '' }: PlayerLevelProps) {
  // Calculer le progrès vers le niveau suivant
  const currentLevelXP = (user.level - 1) * 100;
  const nextLevelXP = user.level * 100;
  const progressXP = user.experience - currentLevelXP;
  const progressPercentage = Math.min((progressXP / 100) * 100, 100);

  return (
    <div className={`flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-blue-50 px-4 py-2 rounded-lg border border-emerald-200 ${className}`}>
      {/* Icône de niveau */}
      <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full">
        <Star className="w-4 h-4 text-white" fill="currentColor" />
      </div>

      {/* Informations de niveau */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">
            Niveau {user.level}
          </span>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Zap className="w-3 h-3" />
            <span>{user.experience} XP</span>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="w-24 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* XP vers le niveau suivant */}
        <div className="text-xs text-slate-400 mt-0.5">
          {progressXP}/100 vers niveau {user.level + 1}
        </div>
      </div>
    </div>
  );
}

// Version ultra-compacte pour l'en-tête de navigation
export function PlayerLevelMini({ user, className = '' }: PlayerLevelProps) {
  const currentLevelXP = (user.level - 1) * 100;
  const progressXP = user.experience - currentLevelXP;
  const progressPercentage = Math.min((progressXP / 100) * 100, 100);

  return (
    <div className={`flex items-center gap-1.5 bg-white/90 backdrop-blur px-2 py-1 rounded-full border border-emerald-200 shadow-sm ${className}`}>
      {/* Icône de niveau */}
      <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full">
        <Star className="w-2.5 h-2.5 text-white" fill="currentColor" />
      </div>

      {/* Niveau */}
      <span className="text-xs font-semibold text-slate-700">Niv. {user.level}</span>

      {/* Mini barre de progression */}
      <div className="w-8 h-0.5 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
}
export function PlayerLevelCompact({ user, className = '' }: PlayerLevelProps) {
  const currentLevelXP = (user.level - 1) * 100;
  const progressXP = user.experience - currentLevelXP;
  const progressPercentage = Math.min((progressXP / 100) * 100, 100);

  return (
    <div className={`flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-emerald-200 shadow-sm ${className}`}>
      {/* Icône de niveau */}
      <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full">
        <Star className="w-3 h-3 text-white" fill="currentColor" />
      </div>

      {/* Niveau et XP */}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-slate-700">Niv. {user.level}</span>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Zap className="w-2.5 h-2.5" />
          <span>{user.experience}</span>
        </div>
      </div>

      {/* Mini barre de progression */}
      <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
}