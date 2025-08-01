import React from "react";
import { Button } from "../ui/button";
import { Sparkles, MapPin, X, TreePine } from "lucide-react";

interface WelcomeNewUserProps {
  onDismiss: () => void;
  userName?: string;
  islandName?: string;
}

export const WelcomeNewUser: React.FC<WelcomeNewUserProps> = ({
  onDismiss,
  userName,
  islandName = "Your First Island",
}) => {
  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md mx-4 overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white relative">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <MapPin className="w-8 h-8 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center mb-2">
          Welcome to Enju! 🎉
        </h2>
        <p className="text-center text-indigo-100 text-sm">
          Your island has been created successfully
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="space-y-4">
          <div className="flex items-start space-x-4">
            <div className="bg-emerald-100 p-3 rounded-xl">
              <TreePine className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Island Created
              </h3>
              <p className="text-sm text-gray-600">
                Your unique island "{islandName}" is now ready for exploration
                and growth.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Start Bridging
              </h3>
              <p className="text-sm text-gray-600">
                Use the bridge to transfer assets between chains and watch your
                island grow with each transaction.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <Button
            onClick={onDismiss}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-3 rounded-xl transition-all duration-200"
          >
            Explore My Island
          </Button>
        </div>
      </div>
    </div>
  );
};
