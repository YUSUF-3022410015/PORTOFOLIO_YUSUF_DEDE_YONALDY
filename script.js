    (function () {
      'use strict';

      // ===================================================================
      // PART A: PROCEDURAL SPIDER CURSOR ANIMATION ENGINE
      // ===================================================================
      const spiderCanvas = document.getElementById('spider-canvas');
      const ctx = spiderCanvas.getContext('2d');
      const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

      let w = 0;
      let h = 0;
      let isSpiderFxEnabled = !isCoarsePointer;
      let spiderAnimFrameId = null;

      // Utility helpers matching procedural kinematics design
      const rnd = (x = 1, dx = 0) => Math.random() * x + dx;
      const lerp = (a, b, t) => a + (b - a) * t;
      const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));

      function drawCircle(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Starfield of ~320 anchor dots + subtle ambient background specks
      let pts = [];
      let ambientStars = [];

      function populateAnchorField(width, height) {
        pts = many(320, () => ({
          x: rnd(width),
          y: rnd(height),
          len: 0,
          r: 0
        }));

        ambientStars = many(110, () => ({
          x: rnd(width),
          y: rnd(height),
          r: rnd(0.7, 0.45),
          alpha: rnd(0.28, 0.1)
        }));
      }

      // Procedural Multi-Legged Wireframe Spider Factory
      function spawn(spiderIndex) {
        const seed = rnd(100, 10);
        // 9 radial leg vectors around the body
        const pts2 = many(9, (i) => {
          const baseAngle = (i / 9) * Math.PI * 2 + rnd(0.25, -0.125);
          const reach = rnd(32, 62); // 62px to 94px ideal leg radius
          return {
            x: Math.cos(baseAngle) * reach,
            y: Math.sin(baseAngle) * reach,
            angle: baseAngle,
            reach: reach,
            // Pre-seeded multi-filament strand offsets for organic sketchy wireframe look
            strands: many(4, () => ({
              kneeJitterX: rnd(14, -7),
              kneeJitterY: rnd(14, -7),
              footJitterX: rnd(5, -2.5),
              footJitterY: rnd(5, -2.5),
              alpha: rnd(0.45, 0.35),
              width: rnd(0.55, 0.55)
            }))
          };
        });

        const initX = window.innerWidth * 0.5 + (spiderIndex === 0 ? -36 : 42);
        const initY = window.innerHeight * 0.42 + (spiderIndex === 0 ? -24 : 28);

        let x = initX;
        let y = initY;
        let tx = initX;
        let ty = initY;

        return {
          follow(clientX, clientY) {
            // Slight individual offset so the 2 spiders move dynamically around the pointer
            const offsetRadius = spiderIndex === 0 ? 18 : 34;
            const offsetAngle = seed + (spiderIndex * Math.PI * 0.85);
            tx = clientX + Math.cos(offsetAngle) * offsetRadius;
            ty = clientY + Math.sin(offsetAngle) * offsetRadius;
          },

          tick(t) {
            // Organic idle breathing + smooth interpolation toward cursor
            const selfMoveX = Math.cos(t * 1.45 + seed) * 16;
            const selfMoveY = Math.sin(t * 1.2 + seed * 1.35) * 16;
            const followRate = spiderIndex === 0 ? 0.085 : 0.058;

            x = lerp(x, tx + selfMoveX, followRate);
            y = lerp(y, ty + selfMoveY, followRate);

            const reachRadius = 168;

            // 1. Illuminate nearby anchor dots within reach radius
            for (let i = 0; i < pts.length; i++) {
              const pt = pts[i];
              const dx = pt.x - x;
              const dy = pt.y - y;
              const dist = Math.hypot(dx, dy);

              if (dist < reachRadius) {
                const proximity = 1 - dist / reachRadius;
                pt.len = lerp(pt.len, 1, 0.14);
                pt.r = lerp(pt.r, 1.3 + proximity * 1.9, 0.16);

                ctx.fillStyle = `rgba(255, 255, 255, ${(0.35 + proximity * 0.6).toFixed(3)})`;
                drawCircle(pt.x, pt.y, pt.r);
              } else if (pt.r > 0.05) {
                pt.len = lerp(pt.len, 0, 0.08);
                pt.r = lerp(pt.r, 0, 0.09);
                if (pt.r > 0.15) {
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                  drawCircle(pt.x, pt.y, pt.r);
                }
              }
            }

            // 2. For each of the 9 radial legs, step onto the nearest available anchor dot
            const usedIndices = new Set();

            for (let j = 0; j < pts2.length; j++) {
              const leg = pts2[j];
              // Subtle rotational breathing on leg target vectors
              const dynamicAngle = leg.angle + Math.sin(t * 1.8 + seed + j) * 0.08;
              const idealX = x + Math.cos(dynamicAngle) * leg.reach;
              const idealY = y + Math.sin(dynamicAngle) * leg.reach;

              let bestPt = null;
              let bestIdx = -1;
              let bestDist = Infinity;

              for (let i = 0; i < pts.length; i++) {
                if (usedIndices.has(i)) continue;
                const pt = pts[i];
                const bodyDist = Math.hypot(pt.x - x, pt.y - y);
                if (bodyDist > reachRadius) continue;

                const d = Math.hypot(pt.x - idealX, pt.y - idealY);
                if (d < bestDist) {
                  bestDist = d;
                  bestPt = pt;
                  bestIdx = i;
                }
              }

              if (bestPt && bestDist < 125) {
                usedIndices.add(bestIdx);

                // Elevated arachnid knee control point between body (x,y) and anchor dot (bestPt.x, bestPt.y)
                const midX = (x + bestPt.x) * 0.5;
                const midY = (y + bestPt.y) * 0.5;
                const legSpan = Math.hypot(bestPt.x - x, bestPt.y - y);
                const archLift = Math.min(36, legSpan * 0.34);

                // Knee lifts upward (-Y) and slightly outward along the leg vector
                const kneeX = midX + Math.cos(dynamicAngle) * (archLift * 0.35);
                const kneeY = midY - archLift;

                // Draw multi-strand sketchy wireframe filaments replicating the reference aesthetic
                for (let s = 0; s < leg.strands.length; s++) {
                  const strand = leg.strands[s];
                  const wave = Math.sin(t * 3.2 + seed + j + s) * 1.6;

                  ctx.beginPath();
                  ctx.moveTo(x, y);
                  ctx.quadraticCurveTo(
                    kneeX + strand.kneeJitterX + wave,
                    kneeY + strand.kneeJitterY - wave,
                    bestPt.x + strand.footJitterX,
                    bestPt.y + strand.footJitterY
                  );
                  ctx.strokeStyle = `rgba(255, 255, 255, ${strand.alpha.toFixed(2)})`;
                  ctx.lineWidth = strand.width;
                  ctx.stroke();
                }

                // Crisp foot anchor highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                drawCircle(bestPt.x, bestPt.y, 1.8);
              }
            }

            // 3. Draw Spider Cephalothorax / Body Core (multi-ring wireframe node)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            drawCircle(x, y, 2.4);

            ctx.beginPath();
            ctx.arc(x, y, 5.2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        };
      }

      // Initialize 2 procedural spiders
      const spiders = many(1, spawn);

      // Pointer tracking across mouse, pen, and touch
      window.addEventListener('pointermove', (e) => {
        if (!isSpiderFxEnabled || e.pointerType === 'touch') return;
        spiders.forEach((spider) => {
          spider.follow(e.clientX, e.clientY);
        });
      }, { passive: true });

      window.addEventListener('resize', () => {
        w = spiderCanvas.width = window.innerWidth;
        h = spiderCanvas.height = window.innerHeight;
        populateAnchorField(w, h);
      }, { passive: true });

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotion.addEventListener?.('change', (event) => {
        if (event.matches && isSpiderFxEnabled) toggleSpiderFx();
      });
      if (prefersReducedMotion.matches) isSpiderFxEnabled = false;
      if (isCoarsePointer) isSpiderFxEnabled = false;

      // Main animation loop with transparent background clearRect
      function anim(t) {
        if (!isSpiderFxEnabled) return;

        if (w !== window.innerWidth || h !== window.innerHeight) {
          w = spiderCanvas.width = window.innerWidth;
          h = spiderCanvas.height = window.innerHeight;
          populateAnchorField(w, h);
        }

        // Clear frame transparently so #09090b workspace UI remains completely legible
        ctx.clearRect(0, 0, w, h);

        // Render subtle static starfield specks
        for (let i = 0; i < ambientStars.length; i++) {
          const star = ambientStars[i];
          ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
          drawCircle(star.x, star.y, star.r);
        }

        const timeInSeconds = t / 1000;
        spiders.forEach((spider) => spider.tick(timeInSeconds));

        spiderAnimFrameId = requestAnimationFrame(anim);
      }

      function startSpiderAnimation() {
        if (spiderAnimFrameId) cancelAnimationFrame(spiderAnimFrameId);
        spiderCanvas.classList.remove('opacity-0');
        spiderCanvas.classList.add('opacity-20');
        spiderAnimFrameId = requestAnimationFrame(anim);
      }

      function stopSpiderAnimation() {
        if (spiderAnimFrameId) {
          cancelAnimationFrame(spiderAnimFrameId);
          spiderAnimFrameId = null;
        }
        spiderCanvas.classList.remove('opacity-20');
        spiderCanvas.classList.add('opacity-0');
        ctx.clearRect(0, 0, w, h);
      }

      // ===================================================================
      // PART B: DEVELOPER WORKSPACE DATA & UI INTERACTIVITY
      // ===================================================================
      const DEVELOPER_EMAIL = 'dedey627@gmail.com';
      const GITHUB_PROFILE_URL = 'https://github.com/YUSUF-3022410015';

      const PROJECTS_DATA = {
        "studymate-ai": { id: "studymate-ai", title: "StudyMate AI", subtitle: "Asisten Belajar Multimodal", category: "EdTech AI", problem: "StudyMate AI dibuat untuk menyelesaikan kebutuhan utama pada domainnya: Website publik untuk membantu siswa memahami materi dan soal melalui teks, foto soal, mode belajar, dan ringkasan materi.", asciiPipeline: "INPUT / USER  -->  APPLICATION  -->  DATA / SERVICE  -->  OUTPUT / REPORT", flowNodes: [{ step: "01. Domain", title: "Core Feature", desc: "Website publik untuk membantu siswa memahami materi dan soal melalui teks, foto soal, mode belajar, dan ringkasan materi." }, { step: "02. Application", title: "Web Interface", desc: "Alur aplikasi dan validasi disusun sesuai kebutuhan pengguna." }, { step: "03. Delivery", title: "Deployment / Data", desc: "Teknologi dan penyimpanan mengikuti dokumentasi proyek." }], architecture: "StudyMate AI didokumentasikan sebagai sistem yang menggabungkan antarmuka web, lapisan pemrosesan, penyimpanan data, dan fitur utama sesuai kebutuhan proyek.", highlights: ["• Next.js digunakan pada implementasi proyek.", "• TypeScript digunakan pada implementasi proyek.", "• Gemini API digunakan pada implementasi proyek."], stack: ["Next.js", "TypeScript", "Gemini API", "IndexedDB", "Vercel"], githubUrl: "https://studymateaivercelapp-bro-yusuf.vercel.app" },
        "crm": { id: "crm", title: "Aplikasi CRM", subtitle: "Customer Relationship Management", category: "Information System", problem: "Aplikasi CRM dibuat untuk menyelesaikan kebutuhan utama pada domainnya: Platform CRM untuk mengelola customer, aktivitas, follow-up, pipeline, quotation, laporan, user, audit log, notifikasi, dan email automation.", asciiPipeline: "INPUT / USER  -->  APPLICATION  -->  DATA / SERVICE  -->  OUTPUT / REPORT", flowNodes: [{ step: "01. Domain", title: "Core Feature", desc: "Platform CRM untuk mengelola customer, aktivitas, follow-up, pipeline, quotation, laporan, user, audit log, notifikasi, dan email automation." }, { step: "02. Application", title: "Web Interface", desc: "Alur aplikasi dan validasi disusun sesuai kebutuhan pengguna." }, { step: "03. Delivery", title: "Deployment / Data", desc: "Teknologi dan penyimpanan mengikuti dokumentasi proyek." }], architecture: "Aplikasi CRM didokumentasikan sebagai sistem yang menggabungkan antarmuka web, lapisan pemrosesan, penyimpanan data, dan fitur utama sesuai kebutuhan proyek.", highlights: ["• Next.js 16 digunakan pada implementasi proyek.", "• React 19 digunakan pada implementasi proyek.", "• Supabase digunakan pada implementasi proyek."], stack: ["Next.js 16", "React 19", "Supabase", "PostgreSQL", "RLS", "Vercel"], githubUrl: "https://github.com/YUSUF-3022410015/aplikasi-CRM-PWEB" },
        "catatku": { id: "catatku", title: "CatatKu", subtitle: "Aplikasi Pengelola Kegiatan Berbantuan AI", category: "Productivity PWA", problem: "CatatKu dibuat untuk menyelesaikan kebutuhan utama pada domainnya: Aplikasi pengelola kegiatan pribadi dengan pendekatan local-first, PWA, sinkronisasi offline, AI poster, pengingat, dan rencana Voice Note.", asciiPipeline: "INPUT / USER  -->  APPLICATION  -->  DATA / SERVICE  -->  OUTPUT / REPORT", flowNodes: [{ step: "01. Domain", title: "Core Feature", desc: "Aplikasi pengelola kegiatan pribadi dengan pendekatan local-first, PWA, sinkronisasi offline, AI poster, pengingat, dan rencana Voice Note." }, { step: "02. Application", title: "Web Interface", desc: "Alur aplikasi dan validasi disusun sesuai kebutuhan pengguna." }, { step: "03. Delivery", title: "Deployment / Data", desc: "Teknologi dan penyimpanan mengikuti dokumentasi proyek." }], architecture: "CatatKu didokumentasikan sebagai sistem yang menggabungkan antarmuka web, lapisan pemrosesan, penyimpanan data, dan fitur utama sesuai kebutuhan proyek.", highlights: ["• React digunakan pada implementasi proyek.", "• Vite digunakan pada implementasi proyek.", "• TypeScript digunakan pada implementasi proyek."], stack: ["React", "Vite", "TypeScript", "Cloudflare", "D1", "IndexedDB"], githubUrl: "https://catatku.masded.workers.dev" },
        "ikta": { id: "ikta", title: "IKTA (Ikan Kita)", subtitle: "Sistem Otomasi Pemberian Pakan Ikan", category: "IoT Information System", problem: "IKTA (Ikan Kita) dibuat untuk menyelesaikan kebutuhan utama pada domainnya: Sistem kontrol otomasi pemberian pakan ikan berbasis ESP32 dengan dashboard web responsif, REST API PHP, dan database MySQL.", asciiPipeline: "INPUT / USER  -->  APPLICATION  -->  DATA / SERVICE  -->  OUTPUT / REPORT", flowNodes: [{ step: "01. Domain", title: "Core Feature", desc: "Sistem kontrol otomasi pemberian pakan ikan berbasis ESP32 dengan dashboard web responsif, REST API PHP, dan database MySQL." }, { step: "02. Application", title: "Web Interface", desc: "Alur aplikasi dan validasi disusun sesuai kebutuhan pengguna." }, { step: "03. Delivery", title: "Deployment / Data", desc: "Teknologi dan penyimpanan mengikuti dokumentasi proyek." }], architecture: "IKTA (Ikan Kita) didokumentasikan sebagai sistem yang menggabungkan antarmuka web, lapisan pemrosesan, penyimpanan data, dan fitur utama sesuai kebutuhan proyek.", highlights: ["• ESP32 digunakan pada implementasi proyek.", "• HTML5 digunakan pada implementasi proyek.", "• CSS3 digunakan pada implementasi proyek."], stack: ["ESP32", "HTML5", "CSS3", "JavaScript", "PHP", "MySQL"], githubUrl: "#" },
        "warung-nutrisi": { id: "warung-nutrisi", title: "Warung Nutrisi", subtitle: "Platform Digital Makan Bergizi Gratis", category: "Public Service Platform", problem: "Warung Nutrisi dibuat untuk menyelesaikan kebutuhan utama pada domainnya: Platform yang menghubungkan SPPG, sekolah, orang tua atau murid, dan pemerintah dalam ekosistem Makan Bergizi Gratis.", asciiPipeline: "INPUT / USER  -->  APPLICATION  -->  DATA / SERVICE  -->  OUTPUT / REPORT", flowNodes: [{ step: "01. Domain", title: "Core Feature", desc: "Platform yang menghubungkan SPPG, sekolah, orang tua atau murid, dan pemerintah dalam ekosistem Makan Bergizi Gratis." }, { step: "02. Application", title: "Web Interface", desc: "Alur aplikasi dan validasi disusun sesuai kebutuhan pengguna." }, { step: "03. Delivery", title: "Deployment / Data", desc: "Teknologi dan penyimpanan mengikuti dokumentasi proyek." }], architecture: "Warung Nutrisi didokumentasikan sebagai sistem yang menggabungkan antarmuka web, lapisan pemrosesan, penyimpanan data, dan fitur utama sesuai kebutuhan proyek.", highlights: ["• Next.js 14 digunakan pada implementasi proyek.", "• TypeScript digunakan pada implementasi proyek.", "• Prisma digunakan pada implementasi proyek."], stack: ["Next.js 14", "TypeScript", "Prisma", "Neon PostgreSQL", "NextAuth", "Cloudinary"], githubUrl: "#" }
      };

      // DOM References
      const dotGridBg = document.getElementById('dot-grid-bg');
      const scrollProgress = document.getElementById('scroll-progress');
      const toastContainer = document.getElementById('toast-container');

      // Status Labels & Indicators
      const spiderHeaderStatus = document.getElementById('spider-header-status');
      const spiderFooterStatus = document.getElementById('spider-footer-status');
      const spiderIndicatorDot = document.getElementById('spider-indicator-dot');
      const toggleSpiderHeaderBtn = document.getElementById('toggle-spider-header-btn');
      const toggleSpiderFooterBtn = document.getElementById('toggle-spider-footer-btn');

      const gridHeaderStatus = document.getElementById('grid-header-status');
      const gridMobileStatus = document.getElementById('grid-mobile-status');
      const gridFooterStatus = document.getElementById('grid-footer-status');
      const gridIndicatorDot = document.getElementById('grid-indicator-dot');
      const toggleGridHeaderBtn = document.getElementById('toggle-grid-header-btn');
      const toggleGridMobileBtn = document.getElementById('toggle-grid-mobile-btn');
      const toggleGridFooterBtn = document.getElementById('toggle-grid-footer-btn');

      // Architecture Modal Elements
      const archModal = document.getElementById('architecture-modal');
      const archModalTitle = document.getElementById('arch-modal-title');
      const archModalCategory = document.getElementById('arch-modal-category');
      const archModalProblem = document.getElementById('arch-modal-problem');
      const archModalAscii = document.getElementById('arch-modal-ascii');
      const archModalFlowNodes = document.getElementById('arch-modal-flow-nodes');
      const archModalArchitecture = document.getElementById('arch-modal-architecture');
      const archModalHighlights = document.getElementById('arch-modal-highlights');
      const archModalStack = document.getElementById('arch-modal-stack');
      const archModalGithubLink = document.getElementById('arch-modal-github-link');
      const closeArchModalBtn = document.getElementById('close-arch-modal-btn');

      // Command Palette Elements
      const cmdModal = document.getElementById('command-palette-modal');
      const cmdSearchInput = document.getElementById('cmd-search-input');
      const cmdResultsList = document.getElementById('cmd-results-list');
      const openCmdBtn = document.getElementById('open-cmd-btn');
      const openCmdFooterBtn = document.getElementById('open-cmd-footer-btn');
      const closeCmdBtn = document.getElementById('close-cmd-btn');

      // State
      let isDotGridVisible = true;
      let filteredCommands = [];
      let activeCommandIndex = 0;

      // -------------------------------------------------------------------
      // Toast Notification Helper (Safe, Non-Blocking, Zero alert())
      // -------------------------------------------------------------------
      function showToast(title, subtitle = '') {
        try {
          const toast = document.createElement('div');
          toast.className =
            'pointer-events-auto flex items-start gap-3 rounded-xl border border-[#27272a] bg-[#111113]/95 px-4 py-3 shadow-2xl backdrop-blur-md animate-toast-in';

          toast.innerHTML = `
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div class="text-xs">
              <p class="font-semibold text-zinc-100">${escapeHtml(title)}</p>
              ${subtitle ? `<p class="mt-0.5 font-mono text-[11px] text-zinc-400">${escapeHtml(subtitle)}</p>` : ''}
            </div>
          `;

          toastContainer.appendChild(toast);

          setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2', 'transition-all', 'duration-200');
            setTimeout(() => {
              if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
              }
            }, 220);
          }, 2800);
        } catch (err) {
          console.error('Toast render error:', err);
        }
      }

      function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      // -------------------------------------------------------------------
      // Clipboard Copy Action (Using document.execCommand('copy'))
      // -------------------------------------------------------------------
      async function copyEmailToClipboard() {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(DEVELOPER_EMAIL);
            showToast('Email copied to clipboard', DEVELOPER_EMAIL);
            return;
          }

          const tempInput = document.createElement('textarea');
          tempInput.value = DEVELOPER_EMAIL;
          tempInput.setAttribute('readonly', '');
          tempInput.style.cssText = 'position:fixed;left:-9999px;opacity:0';
          document.body.appendChild(tempInput);
          tempInput.select();
          const copied = document.execCommand('copy');
          tempInput.remove();
          showToast(copied ? 'Email copied to clipboard' : 'Developer email', DEVELOPER_EMAIL);
        } catch (err) {
          console.error('Clipboard copy error:', err);
          showToast('Developer email', DEVELOPER_EMAIL);
        }
      }

      // -------------------------------------------------------------------
      // Toggle Spider Cursor FX Action
      // -------------------------------------------------------------------
      function toggleSpiderFx() {
        isSpiderFxEnabled = !isSpiderFxEnabled;

        if (isSpiderFxEnabled) {
          startSpiderAnimation();
          if (toggleSpiderHeaderBtn) toggleSpiderHeaderBtn.setAttribute('aria-pressed', 'true');
          if (spiderHeaderStatus) {
            spiderHeaderStatus.textContent = 'ON';
            spiderHeaderStatus.className = 'font-semibold text-emerald-400';
          }
          if (spiderFooterStatus) {
            spiderFooterStatus.textContent = 'ON';
            spiderFooterStatus.className = 'text-emerald-400';
          }
          if (spiderIndicatorDot) {
            spiderIndicatorDot.className = 'h-1.5 w-1.5 rounded-full bg-emerald-400';
          }
          showToast('Spider Cursor FX enabled', 'canvas-kinematics: active');
        } else {
          stopSpiderAnimation();
          if (toggleSpiderHeaderBtn) toggleSpiderHeaderBtn.setAttribute('aria-pressed', 'false');
          if (spiderHeaderStatus) {
            spiderHeaderStatus.textContent = 'OFF';
            spiderHeaderStatus.className = 'font-semibold text-zinc-500';
          }
          if (spiderFooterStatus) {
            spiderFooterStatus.textContent = 'OFF';
            spiderFooterStatus.className = 'text-zinc-500';
          }
          if (spiderIndicatorDot) {
            spiderIndicatorDot.className = 'h-1.5 w-1.5 rounded-full bg-zinc-600';
          }
          showToast('Spider Cursor FX disabled', 'canvas-kinematics: paused');
        }
      }

      // -------------------------------------------------------------------
      // Toggle Dot-Grid Background Action
      // -------------------------------------------------------------------
      function toggleDotGrid() {
        isDotGridVisible = !isDotGridVisible;

        if (isDotGridVisible) {
          dotGridBg.classList.remove('opacity-0');
          dotGridBg.classList.add('opacity-85');
          if (toggleGridHeaderBtn) toggleGridHeaderBtn.setAttribute('aria-pressed', 'true');
          if (gridHeaderStatus) {
            gridHeaderStatus.textContent = 'ON';
            gridHeaderStatus.className = 'font-semibold text-cyan-400';
          }
          if (gridMobileStatus) {
            gridMobileStatus.textContent = 'ON';
            gridMobileStatus.className = 'text-cyan-400';
          }
          if (gridFooterStatus) {
            gridFooterStatus.textContent = 'ON';
            gridFooterStatus.className = 'text-cyan-400';
          }
          if (gridIndicatorDot) {
            gridIndicatorDot.className = 'h-1.5 w-1.5 rounded-full bg-cyan-400';
          }
          showToast('Dot-grid background enabled', 'grid-layer: visible');
        } else {
          dotGridBg.classList.remove('opacity-85');
          dotGridBg.classList.add('opacity-0');
          if (toggleGridHeaderBtn) toggleGridHeaderBtn.setAttribute('aria-pressed', 'false');
          if (gridHeaderStatus) {
            gridHeaderStatus.textContent = 'OFF';
            gridHeaderStatus.className = 'font-semibold text-zinc-500';
          }
          if (gridMobileStatus) {
            gridMobileStatus.textContent = 'OFF';
            gridMobileStatus.className = 'text-zinc-500';
          }
          if (gridFooterStatus) {
            gridFooterStatus.textContent = 'OFF';
            gridFooterStatus.className = 'text-zinc-500';
          }
          if (gridIndicatorDot) {
            gridIndicatorDot.className = 'h-1.5 w-1.5 rounded-full bg-zinc-600';
          }
          showToast('Dot-grid background disabled', 'grid-layer: hidden');
        }
      }

      // -------------------------------------------------------------------
      // System Architecture Modal Logic
      // -------------------------------------------------------------------
      function openArchitectureModal(projectId) {
        const project = PROJECTS_DATA[projectId];
        if (!project) return;

        closeCommandPalette();

        archModalTitle.textContent = `${project.title} — ${project.subtitle}`;
        archModalCategory.textContent = project.category;
        archModalProblem.textContent = project.problem;
        archModalAscii.textContent = project.asciiPipeline;
        archModalArchitecture.textContent = project.architecture;
        archModalGithubLink.href = project.githubUrl;

        // Render Stage Nodes
        archModalFlowNodes.innerHTML = project.flowNodes
          .map(
            (node) => `
            <div class="rounded-lg border border-[#27272a] bg-[#111113] p-3 space-y-1">
              <div class="font-mono text-[10px] text-cyan-400">${escapeHtml(node.step)}</div>
              <div class="text-xs font-semibold text-zinc-100">${escapeHtml(node.title)}</div>
              <div class="text-[11px] text-zinc-400 leading-snug">${escapeHtml(node.desc)}</div>
            </div>
          `
          )
          .join('');

        // Render Engineering Highlights
        archModalHighlights.innerHTML = project.highlights
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('');

        // Render Tech Stack Tags
        archModalStack.innerHTML = project.stack
          .map(
            (tech) => `
            <span class="rounded-md border border-[#27272a] bg-[#111113] px-2.5 py-1 text-zinc-200">
              ${escapeHtml(tech)}
            </span>
          `
          )
          .join('');

        archModal.classList.remove('hidden');
        archModal.classList.add('flex');
        document.body.classList.add('overflow-hidden');
        closeArchModalBtn.focus();
      }

      function closeArchitectureModal() {
        if (archModal.classList.contains('hidden')) return;
        archModal.classList.add('hidden');
        archModal.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
      }

      // -------------------------------------------------------------------
      // Command Palette Registry & Keyboard Engine (Ctrl+K / Cmd+K)
      // -------------------------------------------------------------------
      const COMMANDS = [
        // Group: System Architecture Specs
        {
          id: 'proj-studymate',
          group: 'System Architecture',
          label: 'Inspect Architecture: StudyMate AI',
          hint: 'Multimodal AI Learning Assistant',
          keywords: 'studymate ai multimodal learning assistant project architecture rag',
          icon: 'cpu',
          action: () => openArchitectureModal('studymate-ai')
        },
        {
          id: 'proj-crm',
          group: 'System Architecture',
          label: 'Inspect Architecture: Aplikasi CRM',
          hint: 'Customer Relationship Management',
          keywords: 'crm customer relationship management supabase postgresql rls project architecture',
          icon: 'cpu',
          action: () => openArchitectureModal('crm')
        },
        {
          id: 'proj-catatku',
          group: 'System Architecture',
          label: 'Inspect Architecture: CatatKu',
          hint: 'Aplikasi Pengelola Kegiatan Berbantuan AI',
          keywords: 'catatku productivity pwa offline cloudflare indexeddb project architecture',
          icon: 'cpu',
          action: () => openArchitectureModal('catatku')
        },
        {
          id: 'proj-ikta',
          group: 'System Architecture',
          label: 'Inspect Architecture: IKTA (Ikan Kita)',
          hint: 'Sistem Otomasi Pemberian Pakan Ikan',
          keywords: 'ikta ikan kita iot esp32 php mysql project architecture',
          icon: 'cpu',
          action: () => openArchitectureModal('ikta')
        },
        {
          id: 'proj-warung',
          group: 'System Architecture',
          label: 'Inspect Architecture: Warung Nutrisi',
          hint: 'Platform Digital Makan Bergizi Gratis',
          keywords: 'warung nutrisi sppg sekolah prisma neon nextjs project architecture',
          icon: 'cpu',
          action: () => openArchitectureModal('warung-nutrisi')
        },

        // Group: Workspace Controls & Quick Actions
        {
          id: 'action-toggle-spider',
          group: 'Workspace Controls',
          label: 'Toggle Spider Cursor FX',
          hint: 'Enable or disable procedural wireframe spiders',
          keywords: 'toggle spider cursor fx animation canvas wireframe meowish',
          icon: 'spider',
          action: () => {
            closeCommandPalette();
            toggleSpiderFx();
          }
        },
        {
          id: 'action-toggle-grid',
          group: 'Workspace Controls',
          label: 'Toggle Dot Grid Background',
          hint: 'Show or hide subtle workspace dot-grid layer',
          keywords: 'toggle dot grid background pattern layer',
          icon: 'grid',
          action: () => {
            closeCommandPalette();
            toggleDotGrid();
          }
        },
        {
          id: 'action-copy-email',
          group: 'Quick Actions',
          label: 'Copy Email Address',
          hint: DEVELOPER_EMAIL,
          keywords: 'copy email contact clipboard address',
          icon: 'copy',
          action: () => {
            closeCommandPalette();
            copyEmailToClipboard();
          }
        },
        {
          id: 'action-github',
          group: 'Quick Actions',
          label: 'Open GitHub Profile (@YUSUF-3022410015)',
          hint: 'github.com/YUSUF-3022410015',
          keywords: 'github repository source code yusuf-3022410015',
          icon: 'external',
          action: () => {
            closeCommandPalette();
            window.open(GITHUB_PROFILE_URL, '_blank', 'noopener,noreferrer');
          }
        },

        // Group: Navigation
        {
          id: 'nav-top',
          group: 'Navigation',
          label: 'Jump to Hero & developer.profile.json',
          hint: '#top',
          keywords: 'hero profile json bio top home',
          icon: 'nav',
          action: () => navigateToSection('#top')
        },
        {
          id: 'nav-projects',
          group: 'Navigation',
          label: 'Jump to Featured Systems',
          hint: '#projects',
          keywords: 'projects featured systems portfolio',
          icon: 'nav',
          action: () => navigateToSection('#projects')
        },
        {
          id: 'nav-stack',
          group: 'Navigation',
          label: 'Jump to Tech Stack & Ecosystem',
          hint: '#stack',
          keywords: 'tech stack tooling nextjs supabase neon sql phpmyadmin sqlyog',
          icon: 'nav',
          action: () => navigateToSection('#stack')
        },
        {
          id: 'nav-workflow',
          group: 'Navigation',
          label: 'Jump to Engineering Methodology',
          hint: '#workflow',
          keywords: 'workflow methodology system dynamics engineering',
          icon: 'nav',
          action: () => navigateToSection('#workflow')
        },
        {
          id: 'nav-contact',
          group: 'Navigation',
          label: 'Jump to Contact & Footer',
          hint: '#contact',
          keywords: 'contact connect footer email',
          icon: 'nav',
          action: () => navigateToSection('#contact')
        }
      ];

      function updateScrollProgress() {
        if (!scrollProgress) return;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgress.style.width = `${maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0}%`;
      }

      function navigateToSection(hash) {
        closeCommandPalette();
        const target = document.querySelector(hash);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }

      function getCommandIconSvg(type) {
        switch (type) {
          case 'cpu':
            return `<svg class="h-4 w-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>`;
          case 'spider':
            return `<svg class="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v8m-4-6l8 4m0-4l-8 4M4 6l4 3m8 0l4-3M4 18l4-3m8 0l4 3" /></svg>`;
          case 'copy':
            return `<svg class="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`;
          case 'grid':
            return `<svg class="h-4 w-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>`;
          case 'external':
            return `<svg class="h-4 w-4 text-zinc-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>`;
          default:
            return `<svg class="h-4 w-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>`;
        }
      }

      function renderCommandList(query = '') {
        const normalized = query.trim().toLowerCase();
        filteredCommands = COMMANDS.filter((cmd) => {
          if (!normalized) return true;
          return (
            cmd.label.toLowerCase().includes(normalized) ||
            cmd.hint.toLowerCase().includes(normalized) ||
            cmd.group.toLowerCase().includes(normalized) ||
            cmd.keywords.toLowerCase().includes(normalized)
          );
        });

        activeCommandIndex = 0;

        if (filteredCommands.length === 0) {
          cmdResultsList.innerHTML = `
            <div class="py-10 text-center space-y-1">
              <p class="text-sm text-zinc-400">No commands match "<span class="text-zinc-200">${escapeHtml(query)}</span>"</p>
              <p class="font-mono text-xs text-zinc-500">Coba: StudyMate, CRM, CatatKu, IKTA, Warung Nutrisi, atau GitHub</p>
            </div>
          `;
          return;
        }

        let currentGroup = '';
        let html = '';

        filteredCommands.forEach((cmd, idx) => {
          if (cmd.group !== currentGroup) {
            currentGroup = cmd.group;
            html += `
              <div class="px-2.5 pt-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                ${escapeHtml(currentGroup)}
              </div>
            `;
          }

          const isSelected = idx === activeCommandIndex;
          html += `
            <button
              type="button"
              role="option"
              aria-selected="${isSelected}"
              data-cmd-index="${idx}"
              class="cmd-item-btn w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                isSelected ? 'bg-zinc-800/90 text-zinc-50' : 'text-zinc-300 hover:bg-zinc-900'
              }"
            >
              <div class="flex items-center gap-3 min-w-0">
                ${getCommandIconSvg(cmd.icon)}
                <div class="min-w-0">
                  <div class="text-xs sm:text-sm font-medium truncate">${escapeHtml(cmd.label)}</div>
                  <div class="font-mono text-[11px] text-zinc-500 truncate">${escapeHtml(cmd.hint)}</div>
                </div>
              </div>
              <span class="shrink-0 font-mono text-[10px] ${isSelected ? 'text-emerald-400' : 'text-zinc-600'}">
                ↵
              </span>
            </button>
          `;
        });

        cmdResultsList.innerHTML = html;

        const itemButtons = cmdResultsList.querySelectorAll('.cmd-item-btn');
        itemButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.getAttribute('data-cmd-index'));
            executeCommand(idx);
          });
          btn.addEventListener('mouseenter', () => {
            const idx = Number(btn.getAttribute('data-cmd-index'));
            updateActiveCommandSelection(idx, false);
          });
        });
      }

      function updateActiveCommandSelection(newIndex, shouldScroll = true) {
        if (filteredCommands.length === 0) return;

        if (newIndex < 0) {
          activeCommandIndex = filteredCommands.length - 1;
        } else if (newIndex >= filteredCommands.length) {
          activeCommandIndex = 0;
        } else {
          activeCommandIndex = newIndex;
        }

        const itemButtons = cmdResultsList.querySelectorAll('.cmd-item-btn');
        itemButtons.forEach((btn) => {
          const idx = Number(btn.getAttribute('data-cmd-index'));
          const isSelected = idx === activeCommandIndex;
          btn.setAttribute('aria-selected', String(isSelected));
          if (isSelected) {
            btn.classList.add('bg-zinc-800/90', 'text-zinc-50');
            btn.classList.remove('text-zinc-300');
            if (shouldScroll) {
              btn.scrollIntoView({ block: 'nearest' });
            }
          } else {
            btn.classList.remove('bg-zinc-800/90', 'text-zinc-50');
            btn.classList.add('text-zinc-300');
          }
        });
      }

      function executeCommand(index) {
        const cmd = filteredCommands[index];
        if (cmd && typeof cmd.action === 'function') {
          cmd.action();
        }
      }

      function openCommandPalette() {
        closeArchitectureModal();
        cmdModal.classList.remove('hidden');
        cmdModal.classList.add('flex');
        document.body.classList.add('overflow-hidden');
        cmdSearchInput.value = '';
        renderCommandList('');
        setTimeout(() => {
          cmdSearchInput.focus();
        }, 10);
      }

      function closeCommandPalette() {
        if (cmdModal.classList.contains('hidden')) return;
        cmdModal.classList.add('hidden');
        cmdModal.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
      }

      // -------------------------------------------------------------------
      // Event Listeners & Initialization
      // -------------------------------------------------------------------
      document.addEventListener('DOMContentLoaded', () => {
        const yearEl = document.getElementById('current-year');
        if (yearEl) {
          yearEl.textContent = String(new Date().getFullYear());
        }

        // Start Procedural Spider Canvas Engine on load
        w = spiderCanvas.width = window.innerWidth;
        h = spiderCanvas.height = window.innerHeight;
        populateAnchorField(w, h);
        startSpiderAnimation();

        // Spider FX Toggle Buttons
        if (toggleSpiderHeaderBtn) toggleSpiderHeaderBtn.addEventListener('click', toggleSpiderFx);
        if (toggleSpiderFooterBtn) toggleSpiderFooterBtn.addEventListener('click', toggleSpiderFx);

        // Dot Grid Toggle Buttons
        if (toggleGridHeaderBtn) toggleGridHeaderBtn.addEventListener('click', toggleDotGrid);
        if (toggleGridMobileBtn) toggleGridMobileBtn.addEventListener('click', toggleDotGrid);
        if (toggleGridFooterBtn) toggleGridFooterBtn.addEventListener('click', toggleDotGrid);

        // Copy Email Buttons
        const copyHeroBtn = document.getElementById('copy-email-hero-btn');
        const copyFooterBtn = document.getElementById('copy-email-footer-btn');
        if (copyHeroBtn) copyHeroBtn.addEventListener('click', copyEmailToClipboard);
        if (copyFooterBtn) copyFooterBtn.addEventListener('click', copyEmailToClipboard);

        // Command Palette Triggers
        if (openCmdBtn) openCmdBtn.addEventListener('click', openCommandPalette);
        if (openCmdFooterBtn) openCmdFooterBtn.addEventListener('click', openCommandPalette);
        if (closeCmdBtn) closeCmdBtn.addEventListener('click', closeCommandPalette);

        cmdModal.addEventListener('click', (e) => {
          if (e.target === cmdModal) {
            closeCommandPalette();
          }
        });

        cmdSearchInput.addEventListener('input', (e) => {
          renderCommandList(e.target.value);
        });

        cmdSearchInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            updateActiveCommandSelection(activeCommandIndex + 1, true);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            updateActiveCommandSelection(activeCommandIndex - 1, true);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            executeCommand(activeCommandIndex);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            closeCommandPalette();
          }
        });

        // Project Cards Click & Keyboard Activation
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach((card) => {
          const projectId = card.getAttribute('data-project-id');
          card.addEventListener('click', () => openArchitectureModal(projectId));
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openArchitectureModal(projectId);
            }
          });
        });

        // Architecture Modal Close Triggers
        closeArchModalBtn.addEventListener('click', closeArchitectureModal);
        archModal.addEventListener('click', (e) => {
          if (e.target === archModal) {
            closeArchitectureModal();
          }
        });

        // Global Keyboard Shortcuts: Ctrl+K / Cmd+K and Escape
        window.addEventListener('scroll', updateScrollProgress, { passive: true });
        window.addEventListener('resize', updateScrollProgress);
        updateScrollProgress();

        document.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (cmdModal.classList.contains('hidden')) {
              openCommandPalette();
            } else {
              closeCommandPalette();
            }
          } else if (e.key === 'Escape') {
            if (!cmdModal.classList.contains('hidden')) {
              closeCommandPalette();
            } else if (!archModal.classList.contains('hidden')) {
              closeArchitectureModal();
            }
          }
        });
      });
    })();
