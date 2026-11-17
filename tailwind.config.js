window.tailwind = window.tailwind || {};
window.tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            obsidian: '#09090b',
            surface: '#111113',
            borderline: '#27272a',
          },
          keyframes: {
            fadeIn: {
              '0%': { opacity: '0', transform: 'translateY(6px) scale(0.99)' },
              '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
            },
            toastSlide: {
              '0%': { opacity: '0', transform: 'translateY(16px)' },
              '100%': { opacity: '1', transform: 'translateY(0)' },
            }
          },
          animation: {
            'fade-in': 'fadeIn 0.18s ease-out forwards',
            'toast-in': 'toastSlide 0.22s ease-out forwards',
          }
        }
      }
    };
