/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#FAF8F4",
          warm: "#F3EFE7",
          card: "#FFFFFF",
          subtle: "#EDE8DD"
        },
        ink: {
          DEFAULT: "#141B29",
          muted: "#4A5568",
          soft: "#718096",
          faint: "#A0AEC0"
        },
        oxford: {
          50: "#EEF5F3",
          100: "#D5E8E2",
          200: "#ACD1C6",
          500: "#1B7A62",
          600: "#0F6E56",
          700: "#0B5441",
          800: "#083B2E",
          900: "#05261D"
        },
        amberband: {
          50: "#FDF6EC",
          100: "#FAEBCD",
          500: "#D4841C",
          600: "#B86E11",
          700: "#92540B"
        },
        coralwarn: {
          50: "#FDF2F0",
          100: "#FADBD6",
          500: "#C94532",
          600: "#AC3423",
          700: "#8A281A"
        },
        navyband: {
          50: "#F0F4FA",
          100: "#DCE6F5",
          600: "#24477A",
          700: "#1A355E"
        }
      },
      fontFamily: {
        serif: ["'Iowan Old Style'", "'Palatino Linotype'", "'Book Antiqua'", "Georgia", "Cambria", "serif"],
        sans: ["'Inter'", "ui-sans-serif", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      boxShadow: {
        desk: "0 1px 3px rgba(20, 27, 41, 0.05), 0 8px 24px -6px rgba(20, 27, 41, 0.06)",
        card: "0 1px 2px rgba(20, 27, 41, 0.04), 0 4px 12px rgba(20, 27, 41, 0.04)",
        lifted: "0 12px 32px -8px rgba(20, 27, 41, 0.12), 0 4px 12px rgba(20, 27, 41, 0.05)"
      }
    }
  },
  plugins: []
};
