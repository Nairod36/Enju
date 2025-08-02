import { Link } from "@tanstack/react-router";

export const AppFooter = () => {
  return (
    <footer className="border-t bg-background">
      <div className="">
        <div className="pl-20 pt-8 pr-20 grid gap-8 md:grid-cols-4 items-start">
          {/* Brand Section */}
          <div className="space-y-3 flex flex-col justify-start">
            <h3 className="text-2xl font-light text-green-800 tracking-wide">
              Enju
            </h3>
            <p className="text-sm ">
              Cross-chain bridge platform for seamless asset transfers across
              multiple blockchains.
            </p>
          </div>

          {/* Platform Links */}
          <div className="space-y-3 pt-1 flex flex-col justify-start">
            <h4 className="text-sm font-medium">Platform</h4>
            <div className="space-y-2">
              <Link
                to="/app"
                className="block text-sm hover:text-foreground transition-colors"
              >
                Bridge
              </Link>
              <Link
                to="/app/explorer"
                className="block text-sm  hover:text-foreground transition-colors"
              >
                Island Explorer
              </Link>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-3 pt-1 flex flex-col justify-start">
            <h4 className="text-sm font-medium">Resources</h4>
            <div className="space-y-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm  hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <a
                href="mailto:support@enju.io"
                className="block text-sm  hover:text-foreground transition-colors"
              >
                Support
              </a>
            </div>
          </div>

          {/* Legal */}
          <div className="space-y-3 pt-1 flex flex-col justify-start">
            <h4 className="text-sm font-medium">Legal</h4>
            <div className="space-y-2">
              <a
                href="/terms"
                className="block text-sm  hover:text-foreground transition-colors"
              >
                Terms of Service
              </a>
              <a
                href="/privacy"
                className="block text-sm  hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 mt-6">
          <div className=" pl-20 pr-20 pb-6 flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <p className="text-sm ">© 2025 Enju. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span className="text-sm  flex flex-row items-center">
                Built with ❤️ for DeFi at ETH GLOBAL Unite DeFi{" "}
                <span className="text-emerald-500 font-semibold">
                  <img
                    src="https://avatars.githubusercontent.com/u/35270686?s=280&v=4"
                    className="w-6 h-6 ml-2"
                    alt="ETH GLOBAL Unite DeFi"
                  />
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
