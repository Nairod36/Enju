import { ProfileSection } from "@/components/ProfileSection";

export function Profile() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/30 to-white">
      <div className="container mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Mon Profil</h1>
          <p className="text-slate-600">
            Gérez vos informations personnelles et votre pseudo
          </p>
        </div>
        
        <ProfileSection />
      </div>
    </div>
  );
}