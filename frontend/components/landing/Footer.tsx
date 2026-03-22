import { Shield } from "lucide-react";

const footerLinks = {
  Product: ["Features", "Safety Map", "AI Briefs", "Chat Assistant"],
  Company: ["About", "Blog", "Careers", "Press"],
  Legal: ["Privacy", "Terms", "Cookie Policy"],
  Support: ["Help Center", "Contact", "Status"],
};

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#08080d]">
      <div className="px-6 sm:px-16 lg:px-24 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          {/* Top: logo + links */}
          <div className="flex flex-col md:flex-row justify-between gap-12 md:gap-8">
            {/* Brand */}
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <Shield className="size-5 text-[#6c9cff]" />
                <span className="text-base font-semibold tracking-tight text-white/90">
                  CityWatch
                </span>
              </div>
              <p className="text-sm text-white/30 font-light leading-relaxed">
                Safety intelligence for the people you love. Real-time
                awareness without the noise.
              </p>
            </div>

            {/* Link columns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {Object.entries(footerLinks).map(([category, links]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">
                    {category}
                  </h4>
                  <ul className="space-y-2.5">
                    {links.map((link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="text-sm text-white/30 hover:text-white/60 transition-colors font-light"
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.06] mt-14 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/20 font-light">
              &copy; {new Date().getFullYear()} CityWatch. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs text-white/20 hover:text-white/40 transition-colors">
                Privacy
              </a>
              <a href="#" className="text-xs text-white/20 hover:text-white/40 transition-colors">
                Terms
              </a>
              <a href="#" className="text-xs text-white/20 hover:text-white/40 transition-colors">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
