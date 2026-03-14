export const CAT_COLORS: Record<string, number> = {
  conflict: 0xFF3344,
  politics: 0x00D2FF,
  economy:  0xFFB300,
  tech:     0xCC44FF,
  disaster: 0xFF8C00,
  crime:    0xFF6677,
  health:   0x00FFB2,
};

export const CAT_HEX: Record<string, string> = {
  conflict: "#FF3344",
  politics: "#00D2FF",
  economy:  "#FFB300",
  tech:     "#CC44FF",
  disaster: "#FF8C00",
  crime:    "#FF6677",
  health:   "#00FFB2",
};

export const SOURCE_STYLES: Record<string, string> = {
  bbc:       "bg-red-500/10 text-red-400 border border-red-500/25",
  guardian:  "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25",
  aljazeera: "bg-amber-500/10 text-amber-400 border border-amber-500/25",
  reuters:   "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25",
};

export const CATEGORIES = ["all","conflict","politics","economy","tech","disaster","health","crime"];
export const SOURCES = ["bbc","guardian","aljazeera","reuters"];
