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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden">
        {/* Header - Following AppDashboard style */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome to Enju! 🎉
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Your island has been created successfully
                </p>
              </div>
              <button
                onClick={onDismiss}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Content - Following AppDashboard layout */}
        <div className="p-8">
          <div className="space-y-6">
            {/* Island Created Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <TreePine className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-900">
                      Island Created
                    </span>
                    <div className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      ✓ Complete
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    🏝️ {islandName} • Ready for exploration
                  </div>
                </div>
              </div>
            </div>

            {/* Start Bridging Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-900">
                      Start Bridging
                    </span>
                    <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Ready
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    🌉 Transfer assets between chains to grow your island
                  </div>
                </div>
              </div>
            </div>

            {/* Island Stats Preview */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Island Properties
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Trees Planted
                  </span>
                  <span className="text-sm font-bold text-emerald-600">0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Bridges Completed
                  </span>
                  <span className="text-sm font-bold text-blue-600">0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Member Since
                  </span>
                  <span className="text-sm text-gray-900">
                    {new Date().toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-8">
            <Button
              onClick={onDismiss}
              className="w-full h-12 bg-gray-50 text-dark font-semibold border border-gray-200 rounded-xl transition-all duration-200"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Explore My Island
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
