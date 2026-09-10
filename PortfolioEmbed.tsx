import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ExternalLink, Globe } from "lucide-react";

interface PortfolioEmbedProps {
  isOpen: boolean;
  onClose: () => void;
}

const PORTFOLIO_URL = "/portfolio.html";
const NETLIFY_URL = "https://royalankitahiranl.netlify.app";

export default function PortfolioEmbed({ isOpen, onClose }: PortfolioEmbedProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 pointer-events-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl h-[90vh] max-h-[850px] bg-[#111116] border border-white/15 rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Top Bar with Two Controls: Open & Close */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 overflow-hidden shrink-0 relative">
                <img 
                  src="/avatar.jpg" 
                  alt="Royal Ankit Ahiran" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <Globe size={13} className="absolute text-red-400 -z-10" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  Royal Ankit Ahiran
                </h3>
                <p className="text-[10px] text-white/50 font-mono truncate max-w-[200px] sm:max-w-none">
                  royalankitahiranl.netlify.app
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Open in full tab button */}
              <button
                onClick={() => window.open(PORTFOLIO_URL, "_blank", "noopener,noreferrer")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-white border border-red-500/40 text-xs font-semibold transition-all cursor-pointer hover:scale-105 active:scale-95"
                title="Open website in new tab"
              >
                <span>Open</span>
                <ExternalLink size={13} />
              </button>

              {/* Close (X) button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white border border-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Embedded live website from /portfolio.html */}
          <div className="flex-1 w-full h-full bg-black relative">
            <iframe
              src={PORTFOLIO_URL}
              title="Royal Ankit Ahiran Portfolio"
              className="w-full h-full border-0"
              allow="clipboard-write; encrypted-media; picture-in-picture"
              loading="lazy"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
