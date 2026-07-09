<!-- Design System -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Swimmer Management | LaneLogic Coaching</title>
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<!-- Material Symbols -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "secondary-container": "#bdd6ff",
                    "on-tertiary-fixed-variant": "#3f484d",
                    "surface-container": "#eceef0",
                    "error": "#ba1a1a",
                    "primary-fixed": "#b7eaff",
                    "secondary": "#476083",
                    "surface-container-high": "#e6e8ea",
                    "on-error": "#ffffff",
                    "surface-variant": "#e0e3e5",
                    "surface": "#f7f9fb",
                    "tertiary": "#576065",
                    "surface-tint": "#00677f",
                    "background": "#f7f9fb",
                    "on-secondary-fixed": "#001c3a",
                    "on-tertiary": "#ffffff",
                    "on-error-container": "#93000a",
                    "inverse-surface": "#2d3133",
                    "on-surface-variant": "#3c494e",
                    "tertiary-fixed-dim": "#bfc8ce",
                    "on-primary-fixed-variant": "#004e60",
                    "primary-fixed-dim": "#4cd6ff",
                    "surface-dim": "#d8dadc",
                    "on-primary-fixed": "#001f28",
                    "error-container": "#ffdad6",
                    "surface-container-lowest": "#ffffff",
                    "secondary-fixed-dim": "#afc8f0",
                    "outline-variant": "#bbc9cf",
                    "on-surface": "#191c1e",
                    "on-tertiary-container": "#475055",
                    "on-primary-container": "#00566a",
                    "tertiary-container": "#b9c2c8",
                    "on-primary": "#ffffff",
                    "surface-container-low": "#f2f4f6",
                    "on-secondary-fixed-variant": "#2f486a",
                    "surface-container-highest": "#e0e3e5",
                    "inverse-on-surface": "#eff1f3",
                    "primary-container": "#00d1ff",
                    "surface-bright": "#f7f9fb",
                    "secondary-fixed": "#d4e3ff",
                    "outline": "#6c797f",
                    "primary": "#00677f",
                    "tertiary-fixed": "#dbe4ea",
                    "on-tertiary-fixed": "#141d21",
                    "inverse-primary": "#4cd6ff",
                    "on-background": "#191c1e",
                    "on-secondary": "#ffffff"
            },
            "borderRadius": {
                    "DEFAULT": "0.25rem",
                    "lg": "0.5rem",
                    "xl": "0.75rem",
                    "full": "9999px"
            },
            "spacing": {
                    "gutter": "1rem",
                    "touch-target-min": "48px",
                    "stack-md": "1rem",
                    "margin-mobile": "1.25rem",
                    "stack-sm": "0.5rem",
                    "stack-lg": "2rem",
                    "margin-desktop": "2.5rem"
            },
            "fontFamily": {
                    "headline-lg": ["Montserrat"],
                    "body-lg": ["Inter"],
                    "display-timer": ["Montserrat"],
                    "headline-md": ["Montserrat"],
                    "body-md": ["Inter"],
                    "label-caps": ["Inter"],
                    "label-sm": ["Inter"],
                    "headline-lg-mobile": ["Montserrat"]
            },
            "fontSize": {
                    "headline-lg": ["32px", {"lineHeight": "40px", "fontWeight": "700"}],
                    "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "500"}],
                    "display-timer": ["64px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                    "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
                    "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                    "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
                    "label-sm": ["12px", {"lineHeight": "16px", "fontWeight": "500"}],
                    "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "700"}]
            }
          },
        },
      }
    </script>
<style>
        body {
            -webkit-tap-highlight-color: transparent;
            font-family: 'Inter', sans-serif;
            background-color: #f7f9fb;
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            user-select: none;
        }
        .custom-shadow {
            box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.12);
        }
        .scrolling-touch {
            -webkit-overflow-scrolling: touch;
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-surface text-on-surface flex flex-col min-h-screen">
<!-- TopAppBar -->
<header class="bg-surface dark:bg-on-surface-variant border-b-2 border-outline-variant shadow-sm docked full-width top-0 w-full z-40 sticky">
<div class="flex items-center justify-between px-margin-mobile py-4 w-full z-40">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary dark:text-primary-fixed-dim" data-icon="pool">pool</span>
<h1 class="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed-dim">LaneLogic Coaching</h1>
</div>
<div class="hidden md:flex items-center gap-6">
<nav class="flex gap-4">
<a class="font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-high transition-colors px-3 py-1 rounded-full" href="#">Dashboard</a>
<a class="font-label-sm text-label-sm text-primary dark:text-primary-fixed-dim font-bold bg-primary-container/10 px-3 py-1 rounded-full" href="#">Swimmers</a>
<a class="font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container-high transition-colors px-3 py-1 rounded-full" href="#">Schedule</a>
</nav>
<button class="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-sm text-label-sm active:scale-95 transition-transform">Varsity Team</button>
</div>
<button class="md:hidden material-symbols-outlined text-on-surface-variant" data-icon="menu">menu</button>
</div>
</header>
<main class="flex-1 px-margin-mobile py-stack-md md:px-margin-desktop md:py-stack-lg max-w-7xl mx-auto w-full">
<!-- Search and Filter Section -->
<section class="mb-stack-lg space-y-4">
<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
<div>
<h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Team Management</h2>
<p class="font-body-md text-body-md text-on-surface-variant mt-1">Manage 24 active swimmers and their performance profiles.</p>
</div>
</div>
<div class="flex flex-col sm:flex-row gap-3">
<div class="relative flex-1 group">
<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline" data-icon="search">search</span>
<input class="w-full h-12 pl-12 pr-4 bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 rounded-t-lg transition-all font-body-md text-body-md" placeholder="Search by name or stroke..." type="text"/>
</div>
<button class="h-12 px-6 flex items-center justify-center gap-2 border-2 border-outline text-on-surface rounded-lg font-label-sm text-label-sm hover:bg-surface-container transition-colors">
<span class="material-symbols-outlined" data-icon="filter_list">filter_list</span>
                    Filter
                </button>
</div>
</section>
<!-- Swimmer Grid -->
<section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
<!-- Swimmer Card 1 -->
<div class="bg-surface-container-lowest rounded-xl custom-shadow p-5 border-2 border-transparent hover:border-primary transition-all group">
<div class="flex items-start justify-between mb-4">
<div class="flex gap-4">
<div class="w-16 h-16 rounded-full overflow-hidden border-2 border-surface-variant flex-shrink-0">
<img class="w-full h-full object-cover" data-alt="A professional athletic portrait of a young male swimmer in a minimalist light-mode environment. The lighting is crisp and bright, highlighting his focused expression against a soft-focus blue pool background. He wears high-performance swim goggles around his neck. The overall aesthetic is authoritative, clean, and highly functional, aligning with a premium athletic brand." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBKQMjfg43iXw62sF6xn-mzWDiLDFxX7THLHEhWaaBZSrNDW4qN729no2kEBcgquLJuumUPoJ3qr7T2c2oclOXq4nPc_y6AXW3r3zbGndczaBJhi7POaeiL23LOhzs8dkl3aZyv-VKvMM017hYbur5CGkT6N_6hbT3mE3NkswnVbomk6_CWxlq7dylJaBMQigXFV2VKvdzFOHaPhFbHt0R_ftnD-EwdL8S6k-oy0C3GYW6xFjJjJgRSGA"/>
</div>
<div>
<h3 class="font-headline-md text-headline-md text-on-surface">Alex Rivera</h3>
<div class="flex items-center gap-2 mt-1">
<span class="bg-secondary-container/30 text-on-secondary-container px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase">Age 17</span>
<span class="text-on-surface-variant font-label-sm text-label-sm">Primary: Butterfly</span>
</div>
</div>
</div>
<button class="material-symbols-outlined text-outline hover:text-primary transition-colors" data-icon="more_vert">more_vert</button>
</div>
<div class="grid grid-cols-2 gap-3 mb-6">
<div class="bg-surface-container-low p-3 rounded-lg">
<span class="font-label-caps text-label-caps text-on-surface-variant block mb-1">BEST 100M</span>
<span class="font-display-timer text-[24px] text-primary">0:52.41</span>
</div>
<div class="bg-surface-container-low p-3 rounded-lg">
<span class="font-label-caps text-label-caps text-on-surface-variant block mb-1">STATUS</span>
<span class="flex items-center gap-1.5 text-green-600 font-bold text-sm">
<span class="w-2 h-2 rounded-full bg-green-500"></span>
                            Active
                        </span>
</div>
</div>
<div class="flex gap-2">
<button class="flex-1 h- touch-target-min bg-primary text-on-primary rounded-lg font-label-sm text-label-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all">
<span class="material-symbols-outlined text-[20px]" data-icon="analytics">analytics</span>
                        View Stats
                    </button>
<button class="w-12 h- touch-target-min border-2 border-outline-variant text-on-surface-variant rounded-lg flex items-center justify-center hover:bg-surface-container transition-all">
<span class="material-symbols-outlined" data-icon="edit">edit</span>
</button>
</div>
</div>
<!-- Swimmer Card 2 -->
<div class="bg-surface-container-lowest rounded-xl custom-shadow p-5 border-2 border-transparent hover:border-primary transition-all group">
<div class="flex items-start justify-between mb-4">
<div class="flex gap-4">
<div class="w-16 h-16 rounded-full overflow-hidden border-2 border-surface-variant flex-shrink-0">
<img class="w-full h-full object-cover" data-alt="A studio-lit profile photo of a female varsity swimmer with athletic build, set against a clean, modern off-white background with subtle blue gradients. She wears a professional swim cap and team-branded gear. The lighting is high-contrast and authoritative, conveying elite performance and focus. The aesthetic matches a high-intensity corporate athletic coaching application." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvsC12AVnYB3X07Z1aGpAgR7mEt6HUVNYvKxGma5Oc5QRGB2qgGfQteHDfbHV4IhkOCSXe4SvVmm_lAG7dj5q3QQUVbc8rNg9S1m4CsSPLxAcL0FhJiFvYXmxnTSuO96e0LaNbMMURZN61Upvx1iK9mcTncf9e3d4poNBI6M4wbw5mnEn1t6q0J6gqIXVFPbwbM6qqYHZZGwLS51l0v7pftBZW49plPt-Doa0SLEEq6lYqu7vVMtRfWg"/>
</div>
<div>
<h3 class="font-headline-md text-headline-md text-on-surface">Maya Chen</h3>
<div class="flex items-center gap-2 mt-1">
<span class="bg-secondary-container/30 text-on-secondary-container px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase">Age 16</span>
<span class="text-on-surface-variant font-label-sm text-label-sm">Primary: Freestyle</span>
</div>
</div>
</div>
<button class="material-symbols-outlined text-outline hover:text-primary transition-colors" data-icon="more_vert">more_vert</button>
</div>
<div class="grid grid-cols-2 gap-3 mb-6">
<div class="bg-surface-container-low p-3 rounded-lg">
<span class="font-label-caps text-label-caps text-on-surface-variant block mb-1">BEST 50M</span>
<span class="font-display-timer text-[24px] text-primary">0:24.18</span>
</div>
<div class="bg-surface-container-low p-3 rounded-lg">
<span class="font-label-caps text-label-caps text-on-surface-variant block mb-1">STATUS</span>
<span class="flex items-center gap-1.5 text-amber-600 font-bold text-sm">
<span class="w-2 h-2 rounded-full bg-amber-500"></span>
                            Resting
                        </span>
</div>
</div>
<div class="flex gap-2">
<button class="flex-1 h- touch-target-min bg-primary text-on-primary rounded-lg font-label-sm text-label-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all">
<span class="material-symbols-outlined text-[20px]" data-icon="analytics">analytics</span>
                        View Stats
                    </button>
<button class="w-12 h- touch-target-min border-2 border-outline-variant text-on-surface-variant rounded-lg flex items-center justify-center hover:bg-surface-container transition-all">
<span class="material-symbols-outlined" data-icon="edit">edit</span>
</button>
</div>
</div>
<!-- Swimmer Card 3 -->
<div class="bg-surface-container-lowest rounded-xl custom-shadow p-5 border-2 border-transparent hover:border-primary transition-all group">
<div class="flex items-start justify-between mb-4">
<div class="flex gap-4">
<div class="w-16 h-16 rounded-full overflow-hidden border-2 border-surface-variant flex-shrink-0">
<img class="w-full h-full object-cover" data-alt="A portrait of a male swimmer in his late teens, positioned in a high-tech training facility with bright, cool lighting. The background features blurred pool lanes and professional timing equipment. The subject has a confident, athletic posture. The visual style is modern, bright, and relies on a palette of crisp whites and aquatic blues, emphasizing a precision-focused coaching brand." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDabol4A5ReBNW5anLTZRbPpWibDNJrs6lw1BcvcINNeGKS0OJe9bepbn8Lvu8kFSvoG9FD31Nua2AP-iGU32slXjcXUAY7flQ6mibf2s4es9ysWGaAHymgtp4wGcChBVE6cFESsqyd9XFqgvqoIUfi9rQ4rzRBJCV2VPqpMr-2GEu69NcfQoAffK9V83iCw2pmr91GAlsLIbgJTwflYRAUflhb3rOJTPX760cVagnQhXinNy1F8bi4kw"/>
</div>
<div>
<h3 class="font-headline-md text-headline-md text-on-surface">Jordan Smith</h3>
<div class="flex items-center gap-2 mt-1">
<span class="bg-secondary-container/30 text-on-secondary-container px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase">Age 18</span>
<span class="text-on-surface-variant font-label-sm text-label-sm">Primary: Breaststroke</span>
</div>
</div>
</div>
<button class="material-symbols-outlined text-outline hover:text-primary transition-colors" data-icon="more_vert">more_vert</button>
</div>
<div class="grid grid-cols-2 gap-3 mb-6">
<div class="bg-surface-container-low p-3 rounded-lg">
<span class="font-label-caps text-label-caps text-on-surface-variant block mb-1">BEST 200M</span>
<span class="font-display-timer text-[24px] text-primary">2:14.05</span>
</div>
<div class="bg-surface-container-low p-3 rounded-lg">
<span class="font-label-caps text-label-caps text-on-surface-variant block mb-1">STATUS</span>
<span class="flex items-center gap-1.5 text-green-600 font-bold text-sm">
<span class="w-2 h-2 rounded-full bg-green-500"></span>
                            Active
                        </span>
</div>
</div>
<div class="flex gap-2">
<button class="flex-1 h- touch-target-min bg-primary text-on-primary rounded-lg font-label-sm text-label-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all">
<span class="material-symbols-outlined text-[20px]" data-icon="analytics">analytics</span>
                        View Stats
                    </button>
<button class="w-12 h- touch-target-min border-2 border-outline-variant text-on-surface-variant rounded-lg flex items-center justify-center hover:bg-surface-container transition-all">
<span class="material-symbols-outlined" data-icon="edit">edit</span>
</button>
</div>
</div>
<!-- Empty State / Add Swimmer Prompt Card -->
<div class="bg-surface-container rounded-xl border-2 border-dashed border-outline-variant p-5 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface-container-high transition-all h-full">
<div class="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
<span class="material-symbols-outlined" data-icon="person_add">person_add</span>
</div>
<h4 class="font-headline-md text-headline-md text-on-surface">Add New Swimmer</h4>
<p class="font-body-md text-body-md text-on-surface-variant mt-1">Register a new athlete to the varsity team roster.</p>
</div>
</section>
</main>
<!-- FAB: Add New Swimmer -->
<button class="fixed right-6 bottom-24 md:bottom-10 w-16 h-16 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 group">
<span class="material-symbols-outlined text-[32px]" data-icon="add">add</span>
<span class="absolute right-full mr-4 bg-inverse-surface text-inverse-on-surface px-3 py-1 rounded-lg font-label-sm text-label-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Add Swimmer</span>
</button>
<!-- BottomNavBar -->
<nav class="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 bg-surface-container dark:bg-inverse-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.12)] z-50 rounded-t-xl md:hidden">
<a class="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant py-1 hover:bg-surface-variant dark:hover:bg-on-tertiary-fixed-variant transition-all duration-200 active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="home">home</span>
<span class="font-label-sm text-label-sm">Home</span>
</a>
<a class="flex flex-col items-center justify-center bg-secondary-container dark:bg-secondary text-on-secondary-container dark:text-on-secondary rounded-full px-5 py-1 transition-all duration-200 active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="groups">groups</span>
<span class="font-label-sm text-label-sm">Swimmers</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant py-1 hover:bg-surface-variant dark:hover:bg-on-tertiary-fixed-variant transition-all duration-200 active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="event_note">event_note</span>
<span class="font-label-sm text-label-sm">Sessions</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant py-1 hover:bg-surface-variant dark:hover:bg-on-tertiary-fixed-variant transition-all duration-200 active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="timer">timer</span>
<span class="font-label-sm text-label-sm">Live</span>
</a>
</nav>
<!-- Quick Edit Modal (Hidden by Default) -->
<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] hidden flex items-center justify-center p-4" id="edit-modal">
<div class="bg-surface-container-lowest w-full max-w-md rounded-2xl p-6 shadow-2xl">
<div class="flex justify-between items-center mb-6">
<h3 class="font-headline-md text-headline-md text-on-surface">Quick Edit Athlete</h3>
<button class="material-symbols-outlined text-outline" data-icon="close" onclick="toggleModal()">close</button>
</div>
<form class="space-y-4">
<div>
<label class="block font-label-caps text-label-caps text-on-surface-variant mb-1">Full Name</label>
<input class="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md" type="text" value="Alex Rivera"/>
</div>
<div class="grid grid-cols-2 gap-4">
<div>
<label class="block font-label-caps text-label-caps text-on-surface-variant mb-1">Age</label>
<input class="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md" type="number" value="17"/>
</div>
<div>
<label class="block font-label-caps text-label-caps text-on-surface-variant mb-1">Primary Stroke</label>
<select class="w-full bg-surface-container-low border-b-2 border-outline focus:border-primary focus:ring-0 p-2 font-body-md">
<option>Butterfly</option>
<option>Freestyle</option>
<option>Breaststroke</option>
<option>Backstroke</option>
</select>
</div>
</div>
<div class="pt-4 flex gap-3">
<button class="flex-1 h-12 border-2 border-outline text-on-surface rounded-lg font-label-sm text-label-sm" onclick="toggleModal()" type="button">Cancel</button>
<button class="flex-1 h-12 bg-primary text-on-primary rounded-lg font-label-sm text-label-sm" type="submit">Save Changes</button>
</div>
</form>
</div>
</div>
<script>
        function toggleModal() {
            const modal = document.getElementById('edit-modal');
            modal.classList.toggle('hidden');
        }

        // Attach click handlers to edit buttons for demo
        document.querySelectorAll('button[data-icon="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleModal();
            });
        });

        // Close modal on backdrop click
        document.getElementById('edit-modal').addEventListener('click', (e) => {
            if (e.target.id === 'edit-modal') toggleModal();
        });
    </script>
</body></html>

<!-- Swimmer Directory -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>LaneLogic Coaching - Session Builder</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Montserrat:wght@100..900&display=swap" rel="stylesheet"/>
<!-- Tailwind Config Verbatim -->
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "secondary-container": "#bdd6ff",
                    "on-tertiary-fixed-variant": "#3f484d",
                    "surface-container": "#eceef0",
                    "error": "#ba1a1a",
                    "primary-fixed": "#b7eaff",
                    "secondary": "#476083",
                    "surface-container-high": "#e6e8ea",
                    "on-error": "#ffffff",
                    "surface-variant": "#e0e3e5",
                    "surface": "#f7f9fb",
                    "tertiary": "#576065",
                    "surface-tint": "#00677f",
                    "background": "#f7f9fb",
                    "on-secondary-fixed": "#001c3a",
                    "on-tertiary": "#ffffff",
                    "on-error-container": "#93000a",
                    "inverse-surface": "#2d3133",
                    "on-surface-variant": "#3c494e",
                    "tertiary-fixed-dim": "#bfc8ce",
                    "on-primary-fixed-variant": "#004e60",
                    "primary-fixed-dim": "#4cd6ff",
                    "surface-dim": "#d8dadc",
                    "on-primary-fixed": "#001f28",
                    "error-container": "#ffdad6",
                    "surface-container-lowest": "#ffffff",
                    "secondary-fixed-dim": "#afc8f0",
                    "outline-variant": "#bbc9cf",
                    "on-surface": "#191c1e",
                    "on-tertiary-container": "#475055",
                    "on-secondary-container": "#445d80",
                    "on-primary-container": "#00566a",
                    "tertiary-container": "#b9c2c8",
                    "on-primary": "#ffffff",
                    "surface-container-low": "#f2f4f6",
                    "on-secondary-fixed-variant": "#2f486a",
                    "surface-container-highest": "#e0e3e5",
                    "inverse-on-surface": "#eff1f3",
                    "primary-container": "#00d1ff",
                    "surface-bright": "#f7f9fb",
                    "secondary-fixed": "#d4e3ff",
                    "outline": "#6c797f",
                    "primary": "#00677f",
                    "tertiary-fixed": "#dbe4ea",
                    "on-tertiary-fixed": "#141d21",
                    "inverse-primary": "#4cd6ff",
                    "on-background": "#191c1e",
                    "on-secondary": "#ffffff"
            },
            "borderRadius": {
                    "DEFAULT": "0.25rem",
                    "lg": "0.5rem",
                    "xl": "0.75rem",
                    "full": "9999px"
            },
            "spacing": {
                    "gutter": "1rem",
                    "touch-target-min": "48px",
                    "stack-md": "1rem",
                    "margin-mobile": "1.25rem",
                    "stack-sm": "0.5rem",
                    "stack-lg": "2rem",
                    "margin-desktop": "2.5rem"
            },
            "fontFamily": {
                    "headline-lg": ["Montserrat"],
                    "body-lg": ["Inter"],
                    "display-timer": ["Montserrat"],
                    "headline-md": ["Montserrat"],
                    "body-md": ["Inter"],
                    "label-caps": ["Inter"],
                    "label-sm": ["Inter"],
                    "headline-lg-mobile": ["Montserrat"]
            },
            "fontSize": {
                    "headline-lg": ["32px", {"lineHeight": "40px", "fontWeight": "700"}],
                    "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "500"}],
                    "display-timer": ["64px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                    "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
                    "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                    "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
                    "label-sm": ["12px", {"lineHeight": "16px", "fontWeight": "500"}],
                    "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "700"}]
            }
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            display: inline-block;
            vertical-align: middle;
        }
        body {
            background-color: #f7f9fb;
            color: #191c1e;
        }
        .performance-card {
            background-color: #ffffff;
            box-shadow: 0px 4px 20px rgba(0, 103, 127, 0.12);
            transition: all 0.3s ease;
        }
        .performance-card:hover {
            box-shadow: 0px 8px 30px rgba(0, 103, 127, 0.18);
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #00677f;
            border-radius: 10px;
        }
        .drag-handle {
            cursor: grab;
        }
        .drag-handle:active {
            cursor: grabbing;
        }
        .drop-zone-active {
            border: 2px dashed #00677f;
            background-color: #e0f4f9;
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="font-body-md text-body-md overflow-x-hidden">
<!-- TopAppBar -->
<header class="flex items-center justify-between px-margin-mobile py-4 w-full z-40 bg-surface border-b-2 border-outline-variant shadow-sm sticky top-0">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary text-3xl" data-icon="pool">pool</span>
<h1 class="font-headline-md text-headline-md font-bold text-primary">LaneLogic Coaching</h1>
</div>
<div class="hidden md:flex items-center gap-6">
<nav class="flex gap-4">
<button class="text-on-surface-variant font-bold hover:text-primary transition-colors">Sessions</button>
<button class="text-on-surface-variant hover:text-primary transition-colors">Drill Library</button>
<button class="text-on-surface-variant hover:text-primary transition-colors">Schedule</button>
</nav>
<button class="px-6 py-2 bg-primary text-on-primary rounded-full font-bold hover:scale-105 transition-transform active:scale-95">Varsity Team</button>
</div>
</header>
<main class="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-8 mb-24">
<!-- Dashboard Header -->
<div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
<div>
<h2 class="font-headline-lg text-headline-lg text-on-surface">Session & Drill Builder</h2>
<p class="text-on-surface-variant mt-1">Design high-performance training blocks and manage your drill library.</p>
</div>
<div class="flex gap-3">
<button class="flex items-center gap-2 px-4 py-3 bg-surface-container-high border-2 border-outline rounded-xl font-bold text-on-surface-variant active:scale-95 transition-all">
<span class="material-symbols-outlined" data-icon="upload">upload</span>
                    Import
                </button>
<button class="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all">
<span class="material-symbols-outlined" data-icon="add">add</span>
                    New Session
                </button>
</div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
<!-- Left Column: Session Builder (Active Area) -->
<section class="lg:col-span-7 space-y-6">
<div class="performance-card rounded-2xl p-6 border-l-4 border-primary">
<div class="flex justify-between items-center mb-6">
<div>
<input class="font-headline-md text-headline-md text-on-surface bg-transparent border-none focus:ring-0 p-0 w-full font-bold" type="text" value="Morning Endurance Block A"/>
<span class="text-label-sm font-label-sm text-primary uppercase tracking-widest">Active Draft</span>
</div>
<div class="text-right">
<div class="text-headline-md font-bold text-primary">3,200m</div>
<div class="text-label-sm text-on-surface-variant">Estimated: 75 mins</div>
</div>
</div>
<!-- Draggable Session List -->
<div class="space-y-3 min-h-[300px]" id="session-builder-list">
<!-- Set 1 -->
<div class="group flex items-center gap-4 bg-surface-container-low p-4 rounded-xl border border-transparent hover:border-primary-container transition-all">
<div class="drag-handle text-outline">
<span class="material-symbols-outlined" data-icon="drag_indicator">drag_indicator</span>
</div>
<div class="flex-grow">
<div class="flex justify-between">
<span class="font-bold text-on-surface">4 x 200m Freestyle Build</span>
<span class="text-primary font-bold">800m</span>
</div>
<div class="text-label-sm text-on-surface-variant">Focus: Stroke Length & Lung Capacity</div>
</div>
<button class="p-2 text-error opacity-0 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined" data-icon="delete">delete</span>
</button>
</div>
<!-- Set 2 -->
<div class="group flex items-center gap-4 bg-surface-container-low p-4 rounded-xl border border-transparent hover:border-primary-container transition-all">
<div class="drag-handle text-outline">
<span class="material-symbols-outlined" data-icon="drag_indicator">drag_indicator</span>
</div>
<div class="flex-grow">
<div class="flex justify-between">
<span class="font-bold text-on-surface">8 x 50m Kick with Fins</span>
<span class="text-primary font-bold">400m</span>
</div>
<div class="text-label-sm text-on-surface-variant">Focus: Ankle Flexibility</div>
</div>
<button class="p-2 text-error opacity-0 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined" data-icon="delete">delete</span>
</button>
</div>
<!-- Set 3 (Active focus) -->
<div class="group flex items-center gap-4 bg-primary-container/20 p-4 rounded-xl border-2 border-primary transition-all">
<div class="drag-handle text-primary">
<span class="material-symbols-outlined" data-icon="drag_indicator">drag_indicator</span>
</div>
<div class="flex-grow">
<div class="flex justify-between">
<span class="font-bold text-on-surface">Main: 10 x 100m IM (Descending)</span>
<span class="text-primary font-bold">1000m</span>
</div>
<div class="text-label-sm text-on-surface-variant">Focus: Pace Transitions</div>
</div>
<button class="p-2 text-error opacity-100 transition-opacity">
<span class="material-symbols-outlined" data-icon="delete">delete</span>
</button>
</div>
<!-- Drop Placeholder -->
<div class="border-2 border-dashed border-outline-variant rounded-xl p-8 flex flex-col items-center justify-center text-on-surface-variant bg-surface-container-lowest/50">
<span class="material-symbols-outlined text-4xl mb-2" data-icon="add_circle">add_circle</span>
<p class="font-bold">Drag Drills Here to Add to Session</p>
</div>
</div>
<div class="mt-8 pt-6 border-t border-outline-variant flex justify-between">
<button class="text-primary font-bold flex items-center gap-2">
<span class="material-symbols-outlined" data-icon="save">save</span>
                            Save Template
                        </button>
<button class="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-primary-container hover:text-on-primary-container transition-all">
                            Finalize Session
                        </button>
</div>
</div>
<!-- Saved Sessions Preview -->
<div>
<h3 class="font-headline-md text-headline-md mb-4 flex items-center gap-2">
<span class="material-symbols-outlined" data-icon="history">history</span>
                        Recent Saved Sessions
                    </h3>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<div class="performance-card p-4 rounded-xl border border-outline-variant flex justify-between items-center cursor-pointer hover:bg-surface-container-low">
<div>
<h4 class="font-bold text-on-surface">Sprint Power V2</h4>
<p class="text-label-sm text-on-surface-variant">2,400m • Sprint Category</p>
</div>
<span class="material-symbols-outlined text-outline" data-icon="chevron_right">chevron_right</span>
</div>
<div class="performance-card p-4 rounded-xl border border-outline-variant flex justify-between items-center cursor-pointer hover:bg-surface-container-low">
<div>
<h4 class="font-bold text-on-surface">VO2 Max Ladder</h4>
<p class="text-label-sm text-on-surface-variant">4,000m • Endurance</p>
</div>
<span class="material-symbols-outlined text-outline" data-icon="chevron_right">chevron_right</span>
</div>
</div>
</div>
</section>
<!-- Right Column: Drill Library -->
<aside class="lg:col-span-5">
<div class="sticky top-24 bg-surface-container-low rounded-2xl p-6 h-[calc(100vh-160px)] flex flex-col">
<div class="mb-6">
<h3 class="font-headline-md text-headline-md mb-4">Drill Library</h3>
<div class="relative mb-4">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" data-icon="search">search</span>
<input class="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border-2 border-outline-variant rounded-xl focus:border-primary focus:ring-0 outline-none" placeholder="Search drills..." type="text"/>
</div>
<div class="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
<button class="px-4 py-1.5 bg-primary text-on-primary rounded-full text-label-sm font-bold whitespace-nowrap">All</button>
<button class="px-4 py-1.5 bg-surface-container-highest text-on-surface-variant rounded-full text-label-sm font-bold whitespace-nowrap hover:bg-primary-container/30 transition-colors">Freestyle</button>
<button class="px-4 py-1.5 bg-surface-container-highest text-on-surface-variant rounded-full text-label-sm font-bold whitespace-nowrap hover:bg-primary-container/30 transition-colors">Butterfly</button>
<button class="px-4 py-1.5 bg-surface-container-highest text-on-surface-variant rounded-full text-label-sm font-bold whitespace-nowrap hover:bg-primary-container/30 transition-colors">Endurance</button>
<button class="px-4 py-1.5 bg-surface-container-highest text-on-surface-variant rounded-full text-label-sm font-bold whitespace-nowrap hover:bg-primary-container/30 transition-colors">Drills</button>
</div>
</div>
<div class="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-4">
<!-- Drill Card: Freestyle -->
<div class="performance-card p-4 rounded-xl border-l-4 border-[#00d1ff] cursor-grab active:cursor-grabbing group hover:scale-[1.02] transition-transform">
<div class="flex justify-between items-start mb-2">
<span class="bg-[#00d1ff]/20 text-on-primary-container text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">Freestyle</span>
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="add_circle">add_circle</span>
</div>
<h4 class="font-bold text-on-surface mb-1">Finger Tip Drag</h4>
<div class="flex items-center gap-4 text-label-sm text-on-surface-variant">
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="straighten">straighten</span> 200m</span>
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="target">track_changes</span> High Elbow</span>
</div>
</div>
<!-- Drill Card: Butterfly -->
<div class="performance-card p-4 rounded-xl border-l-4 border-secondary cursor-grab active:cursor-grabbing group hover:scale-[1.02] transition-transform">
<div class="flex justify-between items-start mb-2">
<span class="bg-secondary-container text-on-secondary-container text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">Butterfly</span>
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="add_circle">add_circle</span>
</div>
<h4 class="font-bold text-on-surface mb-1">Single Arm Fly</h4>
<div class="flex items-center gap-4 text-label-sm text-on-surface-variant">
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="straighten">straighten</span> 100m</span>
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="target">track_changes</span> Timing</span>
</div>
</div>
<!-- Drill Card: Endurance -->
<div class="performance-card p-4 rounded-xl border-l-4 border-primary cursor-grab active:cursor-grabbing group hover:scale-[1.02] transition-transform">
<div class="flex justify-between items-start mb-2">
<span class="bg-primary-container/20 text-on-primary-container text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">Endurance</span>
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="add_circle">add_circle</span>
</div>
<h4 class="font-bold text-on-surface mb-1">Distance Per Stroke</h4>
<div class="flex items-center gap-4 text-label-sm text-on-surface-variant">
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="straighten">straighten</span> 400m</span>
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="target">track_changes</span> Efficiency</span>
</div>
</div>
<!-- Drill Card: Breaststroke -->
<div class="performance-card p-4 rounded-xl border-l-4 border-tertiary cursor-grab active:cursor-grabbing group hover:scale-[1.02] transition-transform">
<div class="flex justify-between items-start mb-2">
<span class="bg-tertiary-container/30 text-on-tertiary-container text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">Breaststroke</span>
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="add_circle">add_circle</span>
</div>
<h4 class="font-bold text-on-surface mb-1">Two Kicks One Pull</h4>
<div class="flex items-center gap-4 text-label-sm text-on-surface-variant">
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="straighten">straighten</span> 150m</span>
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="target">track_changes</span> Glide Phase</span>
</div>
</div>
<!-- Drill Card: Backstroke -->
<div class="performance-card p-4 rounded-xl border-l-4 border-[#4cd6ff] cursor-grab active:cursor-grabbing group hover:scale-[1.02] transition-transform">
<div class="flex justify-between items-start mb-2">
<span class="bg-[#b7eaff] text-on-primary-fixed-variant text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded">Backstroke</span>
<span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors" data-icon="add_circle">add_circle</span>
</div>
<h4 class="font-bold text-on-surface mb-1">L-Drill Rotation</h4>
<div class="flex items-center gap-4 text-label-sm text-on-surface-variant">
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="straighten">straighten</span> 200m</span>
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm" data-icon="target">track_changes</span> Body Roll</span>
</div>
</div>
</div>
<button class="mt-6 w-full py-4 bg-surface-container-highest border-2 border-dashed border-outline-variant rounded-xl text-on-surface-variant font-bold flex items-center justify-center gap-2 hover:bg-primary-container/20 hover:border-primary transition-all">
<span class="material-symbols-outlined" data-icon="add_box">add_box</span>
                        Create Custom Drill
                    </button>
</div>
</aside>
</div>
</main>
<!-- BottomNavBar (Mobile Only) -->
<nav class="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 bg-surface-container shadow-[0px_-4px_20px_rgba(0,0,0,0.12)] z-50 rounded-t-xl">
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1" href="#">
<span class="material-symbols-outlined" data-icon="home">home</span>
<span class="text-label-sm font-label-sm">Home</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1" href="#">
<span class="material-symbols-outlined" data-icon="groups">groups</span>
<span class="text-label-sm font-label-sm">Swimmers</span>
</a>
<a class="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-5 py-1" href="#">
<span class="material-symbols-outlined" data-icon="event_note" style="font-variation-settings: 'FILL' 1;">event_note</span>
<span class="text-label-sm font-label-sm">Sessions</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1" href="#">
<span class="material-symbols-outlined" data-icon="timer">timer</span>
<span class="text-label-sm font-label-sm">Live</span>
</a>
</nav>
<!-- Floating Action Button for Session Building Context -->
<div class="fixed bottom-24 right-8 md:bottom-8 z-50">
<button class="w-16 h-16 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all group overflow-hidden">
<span class="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform duration-300" data-icon="auto_awesome">auto_awesome</span>
</button>
</div>
<!-- Micro-interaction Script for drag/drop visual simulation -->
<script>
        // Simple visual feedback for interaction
        document.querySelectorAll('.performance-card').forEach(card => {
            card.addEventListener('mousedown', () => {
                if(card.classList.contains('cursor-grab')) {
                    card.classList.add('scale-95', 'opacity-80');
                }
            });
            card.addEventListener('mouseup', () => {
                card.classList.remove('scale-95', 'opacity-80');
            });
        });

        // Tab switching simulation
        const navButtons = document.querySelectorAll('nav button, nav a');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Not a real router, just preventing default for demo
                // e.preventDefault(); 
            });
        });

        // Custom Drill Creator Interaction
        const createDrillBtn = document.querySelector('button:has(.material-symbols-outlined[data-icon="add_box"])');
        createDrillBtn.addEventListener('click', () => {
            alert('Opening Drill Creator Overlay...');
        });
    </script>
</body></html>

<!-- Session Planner -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>LaneLogic Coaching - Home</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Montserrat:wght@100..900&display=swap" rel="stylesheet"/>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .active-nav-fill {
            font-variation-settings: 'FILL' 1;
        }
        .pool-gradient {
            background: linear-gradient(135deg, #00677f 0%, #00d1ff 100%);
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }
        @keyframes pulse-soft {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(0.98); }
        }
        .animate-pulse-soft {
            animation: pulse-soft 3s infinite ease-in-out;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "secondary-container": "#bdd6ff",
                        "on-tertiary-fixed-variant": "#3f484d",
                        "surface-container": "#eceef0",
                        "error": "#ba1a1a",
                        "primary-fixed": "#b7eaff",
                        "secondary": "#476083",
                        "surface-container-high": "#e6e8ea",
                        "on-error": "#ffffff",
                        "surface-variant": "#e0e3e5",
                        "surface": "#f7f9fb",
                        "tertiary": "#576065",
                        "surface-tint": "#00677f",
                        "background": "#f7f9fb",
                        "on-secondary-fixed": "#001c3a",
                        "on-tertiary": "#ffffff",
                        "on-error-container": "#93000a",
                        "inverse-surface": "#2d3133",
                        "on-surface-variant": "#3c494e",
                        "tertiary-fixed-dim": "#bfc8ce",
                        "on-primary-fixed-variant": "#004e60",
                        "primary-fixed-dim": "#4cd6ff",
                        "surface-dim": "#d8dadc",
                        "on-primary-fixed": "#001f28",
                        "error-container": "#ffdad6",
                        "surface-container-lowest": "#ffffff",
                        "secondary-fixed-dim": "#afc8f0",
                        "outline-variant": "#bbc9cf",
                        "on-surface": "#191c1e",
                        "on-tertiary-container": "#475055",
                        "on-primary-container": "#00566a",
                        "tertiary-container": "#b9c2c8",
                        "on-primary": "#ffffff",
                        "surface-container-low": "#f2f4f6",
                        "on-secondary-fixed-variant": "#2f486a",
                        "surface-container-highest": "#e0e3e5",
                        "inverse-on-surface": "#eff1f3",
                        "primary-container": "#00d1ff",
                        "surface-bright": "#f7f9fb",
                        "secondary-fixed": "#d4e3ff",
                        "outline": "#6c797f",
                        "primary": "#00677f",
                        "tertiary-fixed": "#dbe4ea",
                        "on-tertiary-fixed": "#141d21",
                        "inverse-primary": "#4cd6ff",
                        "on-background": "#191c1e",
                        "on-secondary": "#ffffff"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "full": "9999px"
                    },
                    "spacing": {
                        "gutter": "1rem",
                        "touch-target-min": "48px",
                        "stack-md": "1rem",
                        "margin-mobile": "1.25rem",
                        "stack-sm": "0.5rem",
                        "stack-lg": "2rem",
                        "margin-desktop": "2.5rem"
                    },
                    "fontFamily": {
                        "headline-lg": ["Montserrat"],
                        "body-lg": ["Inter"],
                        "display-timer": ["Montserrat"],
                        "headline-md": ["Montserrat"],
                        "body-md": ["Inter"],
                        "label-caps": ["Inter"],
                        "label-sm": ["Inter"],
                        "headline-lg-mobile": ["Montserrat"]
                    },
                    "fontSize": {
                        "headline-lg": ["32px", {"lineHeight": "40px", "fontWeight": "700"}],
                        "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "500"}],
                        "display-timer": ["64px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                        "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
                        "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                        "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
                        "label-sm": ["12px", {"lineHeight": "16px", "fontWeight": "500"}],
                        "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "700"}]
                    }
                },
            },
        }
    </script>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-background text-on-background font-body-md min-h-screen pb-24 md:pb-0">
<!-- TopAppBar -->
<header class="bg-surface border-b-2 border-outline-variant shadow-sm flex items-center justify-between px-margin-mobile py-4 w-full z-40 sticky top-0">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary" data-icon="pool">pool</span>
<h1 class="font-headline-md text-headline-md font-bold text-primary">LaneLogic Coaching</h1>
</div>
<div class="hidden md:flex items-center gap-6">
<nav class="flex items-center gap-4">
<a class="text-primary font-bold px-3 py-1 bg-primary-container/20 rounded-full" href="#">Home</a>
<a class="text-on-surface-variant hover:text-primary transition-colors" href="#">Swimmers</a>
<a class="text-on-surface-variant hover:text-primary transition-colors" href="#">Sessions</a>
<a class="text-on-surface-variant hover:text-primary transition-colors" href="#">Live</a>
</nav>
<div class="h-6 w-[1px] bg-outline-variant"></div>
<button class="bg-surface-container-high hover:bg-surface-variant transition-colors px-4 py-2 rounded-lg font-label-caps text-on-surface">Varsity Team</button>
</div>
<button class="md:hidden material-symbols-outlined text-on-surface-variant" data-icon="menu">menu</button>
</header>
<main class="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
<!-- Hero Section / Today's Summary -->
<section class="mb-stack-lg">
<div class="relative overflow-hidden rounded-3xl pool-gradient p-8 text-on-primary shadow-lg group">
<div class="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
<span class="material-symbols-outlined text-[120px]" data-icon="water_drop">water_drop</span>
</div>
<div class="relative z-10">
<span class="font-label-caps bg-white/20 px-3 py-1 rounded-full backdrop-blur-md mb-4 inline-block">Today's Focus</span>
<h2 class="font-headline-lg text-headline-lg mb-2">Distance & Threshold</h2>
<p class="font-body-lg text-body-lg opacity-90 max-w-xl mb-6">Main Set: 10 x 200m Free @ 3:00. Intensity: 85% Max Heart Rate. Focus on early vertical forearm.</p>
<div class="flex flex-wrap gap-4 items-center">
<button class="bg-surface-container-lowest text-primary font-bold px-8 py-4 rounded-xl flex items-center gap-2 hover:shadow-xl active:scale-95 transition-all">
<span class="material-symbols-outlined" data-icon="play_arrow" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                            Quick Start Live
                        </button>
<div class="flex items-center gap-2 bg-black/10 px-4 py-4 rounded-xl backdrop-blur-sm">
<span class="material-symbols-outlined" data-icon="schedule">schedule</span>
<span class="font-bold">05:30 AM - 07:30 AM</span>
</div>
</div>
</div>
</div>
</section>
<!-- Main Hub Tiles -->
<section class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-stack-lg">
<!-- Team Management Tile -->
<a class="group relative flex flex-col justify-between bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant hover:border-primary transition-all duration-300 shadow-sm hover:shadow-xl" href="#">
<div class="mb-8">
<div class="w-14 h-14 rounded-2xl bg-secondary-container flex items-center justify-center text-on-secondary-container mb-6 group-hover:scale-110 transition-transform">
<span class="material-symbols-outlined text-3xl" data-icon="groups">groups</span>
</div>
<h3 class="font-headline-md text-headline-md text-on-surface mb-2">Team Management</h3>
<p class="text-on-surface-variant font-body-md">Manage 24 active swimmers, track attendance, and view performance history.</p>
</div>
<div class="flex items-center justify-between">
<span class="text-primary font-bold">Go to Swimmers</span>
<span class="material-symbols-outlined text-primary group-hover:translate-x-2 transition-transform" data-icon="arrow_forward">arrow_forward</span>
</div>
<!-- Abstract visual element -->
<div class="absolute -top-4 -right-4 w-24 h-24 bg-secondary/5 rounded-full blur-2xl group-hover:bg-secondary/10 transition-colors"></div>
</a>
<!-- Session Planner Tile -->
<a class="group relative flex flex-col justify-between bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant hover:border-primary transition-all duration-300 shadow-sm hover:shadow-xl" href="#">
<div class="mb-8">
<div class="w-14 h-14 rounded-2xl bg-primary-container/30 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
<span class="material-symbols-outlined text-3xl" data-icon="event_note">event_note</span>
</div>
<h3 class="font-headline-md text-headline-md text-on-surface mb-2">Session Planner</h3>
<p class="text-on-surface-variant font-body-md">Design complex workouts using the Drill Library. Sync schedules with the team.</p>
</div>
<div class="flex items-center justify-between">
<span class="text-primary font-bold">Plan Next Set</span>
<span class="material-symbols-outlined text-primary group-hover:translate-x-2 transition-transform" data-icon="arrow_forward">arrow_forward</span>
</div>
</a>
<!-- Active Deck Tile -->
<a class="group relative flex flex-col justify-between bg-inverse-surface p-8 rounded-[2rem] transition-all duration-300 shadow-sm hover:shadow-2xl" href="#">
<div class="mb-8">
<div class="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform animate-pulse-soft">
<span class="material-symbols-outlined text-3xl" data-icon="timer">timer</span>
</div>
<h3 class="font-headline-md text-headline-md text-white mb-2">Active Deck</h3>
<p class="text-outline-variant font-body-md">Enter live coaching mode. Multi-lane stopwatches, real-time splits, and voice notes.</p>
</div>
<div class="flex items-center justify-between">
<span class="text-primary-fixed-dim font-bold">Launch Deck</span>
<div class="flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-error animate-pulse"></span>
<span class="material-symbols-outlined text-primary-fixed-dim group-hover:translate-x-2 transition-transform" data-icon="arrow_forward">arrow_forward</span>
</div>
</div>
<!-- Shader-like texture overlay -->
<div class="absolute inset-0 opacity-10 pointer-events-none rounded-[2rem] bg-[radial-gradient(circle_at_50%_120%,#00d1ff,transparent)]"></div>
</a>
</section>
<!-- Secondary Stats/Summary Grid (Bento Style) -->
<div class="grid grid-cols-1 md:grid-cols-4 gap-6">
<div class="md:col-span-2 bg-surface-variant/30 p-6 rounded-3xl border border-outline-variant/50">
<div class="flex items-center justify-between mb-4">
<h4 class="font-label-caps text-on-surface-variant">Weekly Volume</h4>
<span class="text-primary font-bold">+12%</span>
</div>
<div class="flex items-end gap-2 h-32 mb-4">
<div class="flex-1 bg-primary/20 rounded-t-lg h-[40%]"></div>
<div class="flex-1 bg-primary/20 rounded-t-lg h-[60%]"></div>
<div class="flex-1 bg-primary/20 rounded-t-lg h-[55%]"></div>
<div class="flex-1 bg-primary/20 rounded-t-lg h-[85%]"></div>
<div class="flex-1 bg-primary rounded-t-lg h-[100%]"></div>
<div class="flex-1 bg-primary/20 rounded-t-lg h-[70%]"></div>
<div class="flex-1 bg-primary/20 rounded-t-lg h-[45%]"></div>
</div>
<p class="text-on-surface-variant font-label-sm">Peak volume reached on Wednesday: 6,400m</p>
</div>
<div class="bg-surface-container-high p-6 rounded-3xl border border-outline-variant/50 flex flex-col justify-between">
<h4 class="font-label-caps text-on-surface-variant mb-2">Team Status</h4>
<div>
<div class="text-headline-lg font-headline-lg text-primary">18/24</div>
<p class="text-on-surface-variant font-body-md">Swimmers Checked-in</p>
</div>
<div class="mt-4 flex -space-x-2">
<div class="w-8 h-8 rounded-full border-2 border-surface bg-cover" data-alt="A close-up portrait of a young competitive male swimmer wearing a silicone swim cap and mirrored goggles, high-contrast athletic studio lighting with cool blue tones." style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuAJJNIDHkYyP6bmVya5PndodL7TdCatVMKh7Mq4IKLqWYBR_cYv-nEJrASkz5xbd67mhLGRgLbCiwejPcEzs_yV9vFZkZSSNSZvuRNtnWhq2_CRrbUPtV7PA6ofJcn2SnikstEWnpfncCQTOBVWEDCFNheeQDwDfAWRuYRDvQm7eywptEYx0sXBaaVO16EJxNubMzGF4uTpM7AV_3MCMBrObhSn-NrpCqve2HzEwaVBZfKt05svNpNOrw')"></div>
<div class="w-8 h-8 rounded-full border-2 border-surface bg-cover" data-alt="A portrait of a female professional swimmer with wet hair looking confidently into the camera, background is a blurred turquoise swimming pool, bright morning sunlight." style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuCIbBnwwXrZLy4FswkITax91jN6zJgcN7XfT4Kl3bf1CxI798iR9WiDWzwBR9A6_jtdVcGs7ioxFTR9XBQm05zIyiK3T5NvttJkIhDimSLC8M8JORnJMgkrEMEqJmM1a76dB415P3IuulOSpZpTuJOTTY7g0mlHMVaQlzDe_P_IYDTP0c2o5i_fuFXMBPswBd5qvPGzAFUIs9nGQvnalMoxmg3m9Xbpf1NnOqlJxKmrXl-Bax2HY1Zjyg')"></div>
<div class="w-8 h-8 rounded-full border-2 border-surface bg-cover" data-alt="Close up of a swimmer's eyes through blue tinted goggles, water droplets visible on the face, intense focus and determination, moody lighting." style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuDu9cc_hq6wVtsqylEhVfhRs8DIWLahjldxVtCbmVcCNrJfoXQ1Ry8WgSodqevA_zhcqlCvnBtCuct8CYjCA5uzokqev43yK2NoNHtTuQhwxABUzl8WtktmfItPRL2DlJ_JyNa_JfkNNZAne0icGO0yznRgNKcgFtfMhI72msEka9r7smexaRnWTABoxxPMG7tvoX09bpy2caWFf7VJYxJtLhBDPceB7p6MY4bqYqqYHANAfW4W_viljg')"></div>
<div class="w-8 h-8 rounded-full border-2 border-surface bg-surface-variant flex items-center justify-center text-[10px] font-bold">+15</div>
</div>
</div>
<div class="bg-secondary-fixed p-6 rounded-3xl border border-outline-variant/50 flex flex-col justify-between">
<h4 class="font-label-caps text-on-secondary-fixed-variant mb-2">Next Meet</h4>
<div>
<div class="text-headline-md font-headline-md text-on-secondary-fixed">Regional Qualifiers</div>
<p class="text-on-secondary-fixed-variant font-body-md">12 Days Remaining</p>
</div>
<div class="mt-4">
<div class="w-full bg-on-secondary-fixed/10 h-2 rounded-full overflow-hidden">
<div class="bg-on-secondary-fixed h-full w-2/3"></div>
</div>
</div>
</div>
</div>
</main>
<!-- BottomNavBar (Mobile Only) -->
<nav class="md:hidden fixed bottom-0 left-0 w-full bg-surface-container shadow-[0px_-4px_20px_rgba(0,0,0,0.12)] px-4 pb-4 pt-2 flex justify-around items-center z-50 rounded-t-xl">
<a class="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-5 py-1 active:scale-90 transition-all duration-200" href="#">
<span class="material-symbols-outlined active-nav-fill" data-icon="home">home</span>
<span class="font-label-sm text-label-sm">Home</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1 hover:bg-surface-variant transition-all active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="groups">groups</span>
<span class="font-label-sm text-label-sm">Swimmers</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1 hover:bg-surface-variant transition-all active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="event_note">event_note</span>
<span class="font-label-sm text-label-sm">Sessions</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1 hover:bg-surface-variant transition-all active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="timer">timer</span>
<span class="font-label-sm text-label-sm">Live</span>
</a>
</nav>
<!-- Navigation Drawer (Desktop Hidden by default, toggled via state) -->
<aside class="hidden fixed left-0 top-0 h-full w-72 bg-surface-container-low shadow-2xl z-50 p-stack-md transition-transform duration-300 -translate-x-full lg:translate-x-0 lg:static lg:block lg:shadow-none border-r border-outline-variant" id="drawer">
<div class="mb-stack-lg flex items-center gap-3">
<span class="material-symbols-outlined text-primary" data-icon="pool">pool</span>
<span class="font-headline-md text-headline-md text-primary font-bold">LaneLogic</span>
</div>
<div class="space-y-2">
<div class="px-4 py-2 text-on-surface-variant font-label-caps opacity-60">Coach Dashboard</div>
<a class="flex items-center gap-4 px-4 py-3 rounded-xl text-primary font-bold bg-primary-container/20 transition-all" href="#">
<span class="material-symbols-outlined active-nav-fill" data-icon="home">home</span>
<span class="font-body-md text-body-md">Home Hub</span>
</a>
<a class="flex items-center gap-4 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-all" href="#">
<span class="material-symbols-outlined" data-icon="timer">timer</span>
<span class="font-body-md text-body-md">Active Timer</span>
</a>
<a class="flex items-center gap-4 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-all" href="#">
<span class="material-symbols-outlined" data-icon="push_pin">push_pin</span>
<span class="font-body-md text-body-md">Pinned Drills</span>
</a>
<a class="flex items-center gap-4 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-all" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
<span class="font-body-md text-body-md">Team Settings</span>
</a>
</div>
<div class="absolute bottom-8 left-0 w-full px-stack-md">
<div class="p-4 bg-surface-container-high rounded-2xl flex items-center gap-3">
<div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">JC</div>
<div>
<div class="font-bold text-on-surface">Coach Jenkins</div>
<div class="text-[10px] text-on-surface-variant uppercase tracking-widest">Head Coach</div>
</div>
</div>
</div>
</aside>
<!-- FAB (Contextual for Home Screen) -->
<button class="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-16 h-16 rounded-full bg-primary text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group">
<span class="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform" data-icon="add">add</span>
<span class="absolute right-20 bg-inverse-surface text-inverse-on-surface px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">New Session</span>
</button>
<script>
        // Micro-interactions and subtle effects
        document.addEventListener('DOMContentLoaded', () => {
            const cards = document.querySelectorAll('.group');
            cards.forEach(card => {
                card.addEventListener('mouseenter', () => {
                    // Feedback handled by Tailwind hover classes
                });
            });
        });
    </script>
</body></html>

<!-- Coach Home -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>LaneLogic Coaching - Active Session</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "secondary-container": "#bdd6ff",
                    "on-tertiary-fixed-variant": "#3f484d",
                    "surface-container": "#eceef0",
                    "error": "#ba1a1a",
                    "primary-fixed": "#b7eaff",
                    "secondary": "#476083",
                    "surface-container-high": "#e6e8ea",
                    "on-error": "#ffffff",
                    "surface-variant": "#e0e3e5",
                    "surface": "#f7f9fb",
                    "tertiary": "#576065",
                    "surface-tint": "#00677f",
                    "background": "#f7f9fb",
                    "on-secondary-fixed": "#001c3a",
                    "on-tertiary": "#ffffff",
                    "on-error-container": "#93000a",
                    "inverse-surface": "#2d3133",
                    "on-surface-variant": "#3c494e",
                    "tertiary-fixed-dim": "#bfc8ce",
                    "on-primary-fixed-variant": "#004e60",
                    "primary-fixed-dim": "#4cd6ff",
                    "surface-dim": "#d8dadc",
                    "on-primary-fixed": "#001f28",
                    "error-container": "#ffdad6",
                    "surface-container-lowest": "#ffffff",
                    "secondary-fixed-dim": "#afc8f0",
                    "outline-variant": "#bbc9cf",
                    "on-surface": "#191c1e",
                    "on-tertiary-container": "#475055",
                    "on-primary-container": "#00566a",
                    "tertiary-container": "#b9c2c8",
                    "on-primary": "#ffffff",
                    "surface-container-low": "#f2f4f6",
                    "on-secondary-fixed-variant": "#2f486a",
                    "surface-container-highest": "#e0e3e5",
                    "inverse-on-surface": "#eff1f3",
                    "primary-container": "#00d1ff",
                    "surface-bright": "#f7f9fb",
                    "secondary-fixed": "#d4e3ff",
                    "outline": "#6c797f",
                    "primary": "#00677f",
                    "tertiary-fixed": "#dbe4ea",
                    "on-tertiary-fixed": "#141d21",
                    "inverse-primary": "#4cd6ff",
                    "on-background": "#191c1e",
                    "on-secondary": "#ffffff"
            },
            "borderRadius": {
                    "DEFAULT": "0.25rem",
                    "lg": "0.5rem",
                    "xl": "0.75rem",
                    "full": "9999px"
            },
            "spacing": {
                    "gutter": "1rem",
                    "touch-target-min": "48px",
                    "stack-md": "1rem",
                    "margin-mobile": "1.25rem",
                    "stack-sm": "0.5rem",
                    "stack-lg": "2rem",
                    "margin-desktop": "2.5rem"
            },
            "fontFamily": {
                    "headline-lg": ["Montserrat"],
                    "body-lg": ["Inter"],
                    "display-timer": ["Montserrat"],
                    "headline-md": ["Montserrat"],
                    "body-md": ["Inter"],
                    "label-caps": ["Inter"],
                    "label-sm": ["Inter"],
                    "headline-lg-mobile": ["Montserrat"]
            },
            "fontSize": {
                    "headline-lg": ["32px", {"lineHeight": "40px", "fontWeight": "700"}],
                    "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "500"}],
                    "display-timer": ["64px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                    "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
                    "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                    "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
                    "label-sm": ["12px", {"lineHeight": "16px", "fontWeight": "500"}],
                    "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "700"}]
            }
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            background-color: #f7f9fb;
            overscroll-behavior-y: contain;
        }
        .lane-scroll::-webkit-scrollbar { display: none; }
        .lane-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* High contrast pool-deck focus */
        .glass-panel {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 103, 127, 0.1);
        }
        
        .timer-glow {
            text-shadow: 0 0 20px rgba(0, 209, 255, 0.3);
        }

        .active-lane {
            box-shadow: 0 0 0 2px #00677f, 0 4px 20px rgba(0, 103, 127, 0.15);
        }
        
        .drawer-transition {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="font-body-md text-on-surface">
<!-- TopAppBar -->
<header class="bg-surface border-b-2 border-outline-variant shadow-sm flex items-center justify-between px-margin-mobile py-4 w-full z-40 fixed top-0 left-0">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary text-[28px]" data-icon="pool">pool</span>
<h1 class="font-headline-md text-headline-md font-bold text-primary">LaneLogic Coaching</h1>
</div>
<div class="flex items-center gap-4">
<button class="hidden md:flex items-center gap-2 px-4 py-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant font-label-caps">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
</button>
<span class="bg-primary-container/20 text-on-primary-container px-4 py-1 rounded-full font-label-caps text-label-caps border border-primary/20">Varsity Team</span>
</div>
</header>
<!-- Sidebar (Drills) - Desktop -->
<aside class="hidden lg:flex flex-col fixed left-0 top-0 h-full w-72 bg-surface-container-low shadow-xl z-30 pt-24 p-stack-md border-r border-outline-variant">
<h2 class="font-headline-md text-headline-md text-primary px-2 mb-6">Coach Dashboard</h2>
<nav class="space-y-2">
<a class="flex items-center gap-3 p-3 rounded-xl text-primary font-bold bg-primary-container/20 transition-all duration-300" href="#">
<span class="material-symbols-outlined" data-icon="timer">timer</span>
<span>Active Timer</span>
</a>
<a class="flex items-center gap-3 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-all duration-300" href="#">
<span class="material-symbols-outlined" data-icon="push_pin">push_pin</span>
<span>Pinned Drills</span>
</a>
<a class="flex items-center gap-3 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-all duration-300" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
<span>Team Settings</span>
</a>
</nav>
<div class="mt-auto p-4 bg-surface rounded-xl border border-outline-variant/30">
<p class="text-label-caps font-label-caps text-outline mb-2">CURRENT DRILL</p>
<p class="font-body-md font-bold text-on-surface">Threshold 400m</p>
<p class="text-label-sm text-on-surface-variant">Int: 5:45 | Pace: 1:25/100</p>
</div>
</aside>
<!-- Main Content Area -->
<main class="pt-24 pb-32 px-4 md:px-margin-desktop lg:ml-72 min-h-screen">
<!-- GLOBAL STOPWATCH SECTION -->
<section class="max-w-4xl mx-auto mb-8">
<div class="glass-panel p-6 rounded-3xl text-center shadow-lg">
<div class="mb-2 flex justify-center items-center gap-2 text-primary">
<span class="material-symbols-outlined animate-pulse" data-icon="timer">timer</span>
<span class="font-label-caps tracking-widest uppercase">Global Session Timer</span>
</div>
<div class="font-display-timer text-display-timer text-on-surface timer-glow mb-6 tabular-nums" id="main-timer">
                    05:42.<span class="text-primary">82</span>
</div>
<div class="flex justify-center gap-4">
<button class="h-16 px-8 rounded-full bg-error text-on-error flex items-center gap-2 font-bold hover:scale-105 active:scale-95 transition-all shadow-md">
<span class="material-symbols-outlined" data-icon="stop">stop</span>
                        STOP
                    </button>
<button class="h-16 px-12 rounded-full bg-primary text-on-primary flex items-center gap-3 font-bold hover:scale-105 active:scale-95 transition-all shadow-lg">
<span class="material-symbols-outlined" data-icon="play_arrow" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                        LAP
                    </button>
<button class="h-16 w-16 rounded-full border-2 border-outline flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-all">
<span class="material-symbols-outlined" data-icon="refresh">refresh</span>
</button>
</div>
</div>
</section>
<!-- POOL LANE VIEW -->
<section class="mb-8">
<div class="flex items-center justify-between mb-4">
<h3 class="font-headline-md text-headline-md text-on-surface">Pool Deck (8 Lanes)</h3>
<div class="flex gap-2">
<button class="p-2 rounded-lg bg-surface-variant text-on-surface-variant"><span class="material-symbols-outlined" data-icon="view_module">view_module</span></button>
<button class="p-2 rounded-lg bg-primary-container text-on-primary-container"><span class="material-symbols-outlined" data-icon="view_stream">view_stream</span></button>
</div>
</div>
<!-- Horizontal Scrollable Lanes -->
<div class="lane-scroll flex gap-4 overflow-x-auto pb-4 px-1">
<!-- Lane 1 (Active) -->
<div class="flex-shrink-0 w-72 active-lane glass-panel rounded-2xl p-4 transition-all bg-surface-container-lowest">
<div class="flex justify-between items-center mb-4">
<span class="font-headline-md text-primary">LANE 1</span>
<span class="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-label-sm font-bold">FAST</span>
</div>
<div class="flex flex-wrap gap-2 mb-6">
<div class="relative group cursor-pointer">
<img class="w-12 h-12 rounded-full border-2 border-primary object-cover" data-alt="A portrait of a focused young female swimmer wearing a professional blue swim cap and sleek goggles, bright sunlight hitting the water in the background, sharp focus, athletic professional style." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQxgKwBjP1CC-VPqI4DVTrnQi2IHvYB0aAV20GyYy_0oIMhSlCE7EEisNFRan35D45D3vvwvjMpIx2lb2iAG-X6Ojy4UMSSXMsfO7e-bGhMcgYnItLRS2RmqIJXLeG6XTTJzkFPJk7pCKSS5v4ffSlotPfzL1XzlRK_mETddAFNtPtH7Lc0rz9BKqQYzIAwBRcauYvBKpYD7p6Aj1IgVXsvQkq8mbTkqyGQ99y_fcY533u9khPrUeutw"/>
<div class="absolute -top-1 -right-1 bg-primary text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">1</div>
</div>
<div class="relative group cursor-pointer opacity-70">
<img class="w-12 h-12 rounded-full border-2 border-transparent object-cover" data-alt="A male swimmer with a black swim cap preparing for a dive, high-contrast outdoor lighting at a professional Olympic pool, intense focus, crisp water droplets visible, athletic photography." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQXqM1anG1YO92M6bkTi9zu2f_D2kEJJm73QpLt2A4L5Bs_YKmXSXU-V8rz_jTe9mgfkhDUiCPFRurA7Zs3x8y7pblcZk5NOt5W0LsII0LF2XCww_xpIY3H4q0GxUDg4lvVWO9hOkMoBh1O4QVwxxWdEspJVETc8MjcJbUqrUSElwB956gORWsrRMQs480rSnwgNsGM1K47WG7K0yyf8Lhx6rGIjc8MSYnaKkhtsOEMRq3iihtlqb_gg"/>
</div>
<button class="w-12 h-12 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center text-outline-variant hover:text-primary hover:border-primary transition-colors">
<span class="material-symbols-outlined" data-icon="add">add</span>
</button>
</div>
<div class="space-y-3">
<div class="bg-surface-container p-3 rounded-xl border border-outline-variant/20">
<div class="flex justify-between text-label-caps text-outline mb-1">
<span>LAP 4</span>
<span>1:12.4</span>
</div>
<div class="h-1.5 w-full bg-outline-variant rounded-full overflow-hidden">
<div class="h-full bg-primary w-[75%]"></div>
</div>
</div>
</div>
</div>
<!-- Lane 2-8 placeholders -->
<script>
                    const lanes = [2, 3, 4, 5, 6, 7, 8];
                    lanes.forEach(i => {
                        document.write(`
                            <div class="flex-shrink-0 w-72 glass-panel rounded-2xl p-4 transition-all hover:border-primary/40 bg-surface/50">
                                <div class="flex justify-between items-center mb-4">
                                    <span class="font-headline-md text-on-surface-variant">LANE ${i}</span>
                                    <span class="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded text-label-sm font-bold">MID</span>
                                </div>
                                <div class="flex flex-wrap gap-2 mb-6">
                                    <div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-outline">
                                        <span class="material-symbols-outlined" data-icon="person">person</span>
                                    </div>
                                    <button class="w-12 h-12 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center text-outline-variant">
                                        <span class="material-symbols-outlined" data-icon="add">add</span>
                                    </button>
                                </div>
                                <div class="text-center py-4 border-t border-outline-variant/20">
                                    <p class="text-label-sm text-outline">No active tracking</p>
                                </div>
                            </div>
                        `);
                    });
                </script>
</div>
</section>
<!-- DATA ENTRY GRID (Bento Style) -->
<section class="grid grid-cols-1 md:grid-cols-3 gap-6">
<!-- Stroke Count Entry -->
<div class="md:col-span-2 glass-panel p-6 rounded-3xl shadow-sm">
<div class="flex items-center gap-2 mb-6">
<span class="material-symbols-outlined text-primary" data-icon="waves">waves</span>
<h3 class="font-headline-md text-headline-md">Stroke Count Entry</h3>
</div>
<div class="grid grid-cols-5 gap-4">
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">12</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">13</button>
<button class="h-16 rounded-2xl bg-primary text-on-primary text-headline-md font-bold shadow-md">14</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">15</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">16</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">17</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">18</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">19</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">20</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">21</button>
</div>
</div>
<!-- Session Stats Quick Look -->
<div class="glass-panel p-6 rounded-3xl shadow-sm bg-secondary-container/10">
<div class="flex items-center gap-2 mb-4">
<span class="material-symbols-outlined text-secondary" data-icon="analytics">analytics</span>
<h3 class="font-headline-md text-headline-md">Lane 1 AVG</h3>
</div>
<div class="space-y-4">
<div class="flex justify-between items-center p-3 bg-surface rounded-xl">
<span class="text-on-surface-variant font-label-caps">PACE</span>
<span class="text-headline-md text-primary font-bold">1:24.2</span>
</div>
<div class="flex justify-between items-center p-3 bg-surface rounded-xl">
<span class="text-on-surface-variant font-label-caps">STROKES</span>
<span class="text-headline-md text-primary font-bold">14.5</span>
</div>
<div class="flex justify-between items-center p-3 bg-surface rounded-xl">
<span class="text-on-surface-variant font-label-caps">SWOLF</span>
<span class="text-headline-md text-primary font-bold">36</span>
</div>
</div>
</div>
</section>
</main>
<!-- Floating Action Button for Side-Sheet (Mobile/Tablet Focused) -->
<button class="fixed bottom-24 right-6 w-16 h-16 rounded-full bg-primary text-on-primary shadow-lg z-50 flex items-center justify-center active:scale-90 transition-transform lg:hidden" onclick="toggleDrillDrawer()">
<span class="material-symbols-outlined text-[32px]" data-icon="event_note">event_note</span>
</button>
<!-- Bottom Drawer (Drills) -->
<div class="fixed inset-0 z-[60] pointer-events-none lg:hidden" id="drill-drawer">
<div class="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300" id="drawer-overlay" onclick="toggleDrillDrawer()"></div>
<div class="absolute bottom-0 left-0 w-full bg-surface-container rounded-t-3xl shadow-2xl drawer-transition translate-y-full pointer-events-auto p-6 max-h-[707px] overflow-y-auto" id="drawer-content">
<div class="w-12 h-1.5 bg-outline-variant rounded-full mx-auto mb-6"></div>
<div class="flex justify-between items-center mb-6">
<h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Session Drills</h3>
<button class="p-2 text-on-surface-variant" onclick="toggleDrillDrawer()"><span class="material-symbols-outlined" data-icon="close">close</span></button>
</div>
<div class="space-y-4">
<div class="p-4 bg-primary-container/10 border-l-4 border-primary rounded-xl">
<p class="text-label-caps text-primary mb-1">CURRENT</p>
<h4 class="font-body-lg font-bold">Threshold 400m</h4>
<p class="text-body-md text-on-surface-variant">Continuous swim at 85% effort. Focus on rotation.</p>
</div>
<div class="p-4 bg-surface rounded-xl border border-outline-variant">
<p class="text-label-caps text-outline mb-1">UP NEXT</p>
<h4 class="font-body-lg font-bold">10 x 50m Kick</h4>
<p class="text-body-md text-on-surface-variant">On 1:15 interval. High frequency kick.</p>
</div>
<div class="p-4 bg-surface rounded-xl border border-outline-variant">
<p class="text-label-caps text-outline mb-1">COOL DOWN</p>
<h4 class="font-body-lg font-bold">200m Choice</h4>
<p class="text-body-md text-on-surface-variant">Easy aerobic recovery.</p>
</div>
</div>
</div>
</div>
<!-- BottomNavBar (Mobile) -->
<nav class="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 bg-surface-container shadow-[0px_-4px_20px_rgba(0,0,0,0.12)] z-50 rounded-t-xl">
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1" href="#">
<span class="material-symbols-outlined" data-icon="home">home</span>
<span class="font-label-sm text-label-sm">Home</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1" href="#">
<span class="material-symbols-outlined" data-icon="groups">groups</span>
<span class="font-label-sm text-label-sm">Swimmers</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1" href="#">
<span class="material-symbols-outlined" data-icon="event_note">event_note</span>
<span class="font-label-sm text-label-sm">Sessions</span>
</a>
<a class="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-5 py-1 active:scale-90 transition-all duration-200" href="#">
<span class="material-symbols-outlined" data-icon="timer" style="font-variation-settings: 'FILL' 1;">timer</span>
<span class="font-label-sm text-label-sm">Live</span>
</a>
</nav>
<script>
        function toggleDrillDrawer() {
            const drawer = document.getElementById('drawer-content');
            const overlay = document.getElementById('drawer-overlay');
            const parent = document.getElementById('drill-drawer');
            
            if (drawer.classList.contains('translate-y-full')) {
                parent.classList.remove('pointer-events-none');
                drawer.classList.remove('translate-y-full');
                overlay.classList.add('opacity-100');
            } else {
                drawer.classList.add('translate-y-full');
                overlay.classList.remove('opacity-100');
                setTimeout(() => parent.classList.add('pointer-events-none'), 300);
            }
        }

        // Micro-interaction: Timer simulated update
        let seconds = 342;
        let milliseconds = 82;
        setInterval(() => {
            milliseconds += Math.floor(Math.random() * 10);
            if(milliseconds >= 100) {
                milliseconds = 0;
                seconds++;
            }
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            const ms = milliseconds.toString().padStart(2, '0');
            document.getElementById('main-timer').innerHTML = `${m}:${s}.<span class="text-primary">${ms}</span>`;
        }, 100);
    </script>
</body></html>

<!-- Live Deck Dashboard -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>LaneLogic Coaching - Active Session</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "secondary-container": "#bdd6ff",
                    "on-tertiary-fixed-variant": "#3f484d",
                    "surface-container": "#eceef0",
                    "error": "#ba1a1a",
                    "primary-fixed": "#b7eaff",
                    "secondary": "#476083",
                    "surface-container-high": "#e6e8ea",
                    "on-error": "#ffffff",
                    "surface-variant": "#e0e3e5",
                    "surface": "#f7f9fb",
                    "tertiary": "#576065",
                    "surface-tint": "#00677f",
                    "background": "#f7f9fb",
                    "on-secondary-fixed": "#001c3a",
                    "on-tertiary": "#ffffff",
                    "on-error-container": "#93000a",
                    "inverse-surface": "#2d3133",
                    "on-surface-variant": "#3c494e",
                    "tertiary-fixed-dim": "#bfc8ce",
                    "on-primary-fixed-variant": "#004e60",
                    "primary-fixed-dim": "#4cd6ff",
                    "surface-dim": "#d8dadc",
                    "on-primary-fixed": "#001f28",
                    "error-container": "#ffdad6",
                    "surface-container-lowest": "#ffffff",
                    "secondary-fixed-dim": "#afc8f0",
                    "outline-variant": "#bbc9cf",
                    "on-surface": "#191c1e",
                    "on-tertiary-container": "#475055",
                    "on-primary-container": "#00566a",
                    "tertiary-container": "#b9c2c8",
                    "on-primary": "#ffffff",
                    "surface-container-low": "#f2f4f6",
                    "on-secondary-fixed-variant": "#2f486a",
                    "surface-container-highest": "#e0e3e5",
                    "inverse-on-surface": "#eff1f3",
                    "primary-container": "#00d1ff",
                    "surface-bright": "#f7f9fb",
                    "secondary-fixed": "#d4e3ff",
                    "outline": "#6c797f",
                    "primary": "#00677f",
                    "tertiary-fixed": "#dbe4ea",
                    "on-tertiary-fixed": "#141d21",
                    "inverse-primary": "#4cd6ff",
                    "on-background": "#191c1e",
                    "on-secondary": "#ffffff"
            },
            "borderRadius": {
                    "DEFAULT": "0.25rem",
                    "lg": "0.5rem",
                    "xl": "0.75rem",
                    "full": "9999px"
            },
            "spacing": {
                    "gutter": "1rem",
                    "touch-target-min": "48px",
                    "stack-md": "1rem",
                    "margin-mobile": "1.25rem",
                    "stack-sm": "0.5rem",
                    "stack-lg": "2rem",
                    "margin-desktop": "2.5rem"
            },
            "fontFamily": {
                    "headline-lg": ["Montserrat"],
                    "body-lg": ["Inter"],
                    "display-timer": ["Montserrat"],
                    "headline-md": ["Montserrat"],
                    "body-md": ["Inter"],
                    "label-caps": ["Inter"],
                    "label-sm": ["Inter"],
                    "headline-lg-mobile": ["Montserrat"]
            },
            "fontSize": {
                    "headline-lg": ["32px", {"lineHeight": "40px", "fontWeight": "700"}],
                    "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "500"}],
                    "display-timer": ["64px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                    "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
                    "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                    "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
                    "label-sm": ["12px", {"lineHeight": "16px", "fontWeight": "500"}],
                    "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "700"}]
            }
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            background-color: #f7f9fb;
            overscroll-behavior-y: contain;
        }
        .lane-scroll::-webkit-scrollbar { display: none; }
        .lane-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* High contrast pool-deck focus */
        .glass-panel {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 103, 127, 0.1);
        }
        
        .timer-glow {
            text-shadow: 0 0 20px rgba(0, 209, 255, 0.3);
        }

        .active-lane {
            box-shadow: 0 0 0 2px #00677f, 0 4px 20px rgba(0, 103, 127, 0.15);
        }
        
        .drawer-transition {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
</head>
<body class="font-body-md text-on-surface">
<!-- TopAppBar -->
<header class="bg-surface border-b-2 border-outline-variant shadow-sm flex items-center justify-between px-margin-mobile py-4 w-full z-40 fixed top-0 left-0">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary text-[28px]" data-icon="pool">pool</span>
<h1 class="font-headline-md text-headline-md font-bold text-primary">LaneLogic Coaching</h1>
</div>
<div class="flex items-center gap-4">
<button class="hidden md:flex items-center gap-2 px-4 py-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant font-label-caps">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
</button>
<span class="bg-primary-container/20 text-on-primary-container px-4 py-1 rounded-full font-label-caps text-label-caps border border-primary/20">Varsity Team</span>
</div>
</header>
<!-- Sidebar (Drills) - Desktop -->
<aside class="hidden lg:flex flex-col fixed left-0 top-0 h-full w-72 bg-surface-container-low shadow-xl z-30 pt-24 p-stack-md border-r border-outline-variant">
<h2 class="font-headline-md text-headline-md text-primary px-2 mb-6">Coach Dashboard</h2>
<nav class="space-y-2">
<a class="flex items-center gap-3 p-3 rounded-xl text-primary font-bold bg-primary-container/20 transition-all duration-300" href="#">
<span class="material-symbols-outlined" data-icon="timer">timer</span>
<span>Active Timer</span>
</a>
<a class="flex items-center gap-3 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-all duration-300" href="#">
<span class="material-symbols-outlined" data-icon="push_pin">push_pin</span>
<span>Pinned Drills</span>
</a>
<a class="flex items-center gap-3 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-all duration-300" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
<span>Team Settings</span>
</a>
</nav>
<div class="mt-auto p-4 bg-surface rounded-xl border border-outline-variant/30">
<p class="text-label-caps font-label-caps text-outline mb-2">CURRENT DRILL</p>
<p class="font-body-md font-bold text-on-surface">Threshold 400m</p>
<p class="text-label-sm text-on-surface-variant">Int: 5:45 | Pace: 1:25/100</p>
</div>
</aside>
<!-- Main Content Area -->
<main class="pt-24 pb-32 px-4 md:px-margin-desktop lg:ml-72 min-h-screen">
<!-- GLOBAL STOPWATCH SECTION -->
<section class="max-w-4xl mx-auto mb-8">
<div class="glass-panel p-6 rounded-3xl text-center shadow-lg">
<div class="mb-2 flex justify-center items-center gap-2 text-primary">
<span class="material-symbols-outlined animate-pulse" data-icon="timer">timer</span>
<span class="font-label-caps tracking-widest uppercase">Global Session Timer</span>
</div>
<div class="font-display-timer text-display-timer text-on-surface timer-glow mb-6 tabular-nums" id="main-timer">
                    05:42.<span class="text-primary">82</span>
</div>
<div class="flex justify-center gap-4">
<button class="h-16 px-8 rounded-full bg-error text-on-error flex items-center gap-2 font-bold hover:scale-105 active:scale-95 transition-all shadow-md">
<span class="material-symbols-outlined" data-icon="stop">stop</span>
                        STOP
                    </button>
<button class="h-16 px-12 rounded-full bg-primary text-on-primary flex items-center gap-3 font-bold hover:scale-105 active:scale-95 transition-all shadow-lg">
<span class="material-symbols-outlined" data-icon="play_arrow" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                        LAP
                    </button>
<button class="h-16 w-16 rounded-full border-2 border-outline flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-all">
<span class="material-symbols-outlined" data-icon="refresh">refresh</span>
</button>
</div>
</div>
</section>
<!-- POOL LANE VIEW -->
<section class="mb-8">
<div class="flex items-center justify-between mb-4">
<h3 class="font-headline-md text-headline-md text-on-surface">Pool Deck (8 Lanes)</h3>
<div class="flex gap-2">
<button class="p-2 rounded-lg bg-surface-variant text-on-surface-variant"><span class="material-symbols-outlined" data-icon="view_module">view_module</span></button>
<button class="p-2 rounded-lg bg-primary-container text-on-primary-container"><span class="material-symbols-outlined" data-icon="view_stream">view_stream</span></button>
</div>
</div>
<!-- Horizontal Scrollable Lanes -->
<div class="lane-scroll flex gap-4 overflow-x-auto pb-4 px-1">
<!-- Lane 1 (Active) -->
<div class="flex-shrink-0 active-lane glass-panel rounded-2xl p-4 transition-all bg-surface-container-lowest w-80"><div class="flex justify-between items-center mb-4"><div class="flex items-center gap-2"><span class="font-headline-md text-primary">LANE 1</span><span class="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-label-sm font-bold">FAST</span></div><span class="text-label-caps text-outline">3 SWIMMERS</span></div><div class="space-y-4"><div class="bg-surface p-3 rounded-xl border border-primary/20 shadow-sm"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-3"><div class="relative"><img class="w-10 h-10 rounded-full border-2 border-primary object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQxgKwBjP1CC-VPqI4DVTrnQi2IHvYB0aAV20GyYy_0oIMhSlCE7EEisNFRan35D45D3vvwvjMpIx2lb2iAG-X6Ojy4UMSSXMsfO7e-bGhMcgYnItLRS2RmqIJXLeG6XTTJzkFPJk7pCKSS5v4ffSlotPfzL1XzlRK_mETddAFNtPtH7Lc0rz9BKqQYzIAwBRcauYvBKpYD7p6Aj1IgVXsvQkq8mbTkqyGQ99y_fcY533u9khPrUeutw"/><div class="absolute -top-1 -right-1 bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">1</div></div><div><p class="font-bold text-on-surface">Alex P.</p><p class="text-[10px] text-primary font-bold uppercase tracking-tighter">LAP 4/10</p></div></div><div class="text-right"><p class="font-display-timer text-headline-md tabular-nums text-primary">01:12.4</p></div></div><div class="grid grid-cols-3 gap-2"><button class="bg-primary text-white py-2 rounded-lg font-label-caps text-[10px] flex items-center justify-center gap-1"><span class="material-symbols-outlined text-sm">play_arrow</span>GO</button><button class="bg-secondary-container text-on-secondary-container py-2 rounded-lg font-label-caps text-[10px] flex items-center justify-center gap-1"><span class="material-symbols-outlined text-sm">timer</span>LAP</button><button class="bg-surface-variant text-on-surface-variant py-2 rounded-lg font-label-caps text-[10px] flex items-center justify-center gap-1"><span class="material-symbols-outlined text-sm">check_circle</span>FINISH</button></div></div><div class="bg-surface-container-low p-3 rounded-xl border border-outline-variant/30"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-3"><div class="relative"><img class="w-10 h-10 rounded-full border-2 border-transparent object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQXqM1anG1YO92M6bkTi9zu2f_D2kEJJm73QpLt2A4L5Bs_YKmXSXU-V8rz_jTe9mgfkhDUiCPFRurA7Zs3x8y7pblcZk5NOt5W0LsII0LF2XCww_xpIY3H4q0GxUDg4lvVWO9hOkMoBh1O4QVwxxWdEspJVETc8MjcJbUqrUSElwB956gORWsrRMQs480rSnwgNsGM1K47WG7K0yyf8Lhx6rGIjc8MSYnaKkhtsOEMRq3iihtlqb_gg"/><div class="absolute -top-1 -right-1 bg-outline text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">2</div></div><div><p class="font-bold text-on-surface-variant">Maya R.</p><p class="text-[10px] text-outline font-bold uppercase tracking-tighter">READY</p></div></div><div class="text-right"><p class="font-display-timer text-headline-md tabular-nums text-outline">00:00.0</p></div></div><div class="grid grid-cols-3 gap-2"><button class="bg-primary text-white py-2 rounded-lg font-label-caps text-[10px] flex items-center justify-center gap-1"><span class="material-symbols-outlined text-sm">play_arrow</span>GO</button><button class="bg-surface-container-high text-outline py-2 rounded-lg font-label-caps text-[10px] flex items-center justify-center gap-1" disabled=""><span class="material-symbols-outlined text-sm">timer</span>LAP</button><button class="bg-surface-container-high text-outline py-2 rounded-lg font-label-caps text-[10px] flex items-center justify-center gap-1" disabled=""><span class="material-symbols-outlined text-sm">check_circle</span>FINISH</button></div></div><button class="w-full py-3 rounded-xl border-2 border-dashed border-outline-variant flex items-center justify-center gap-2 text-outline-variant hover:text-primary hover:border-primary transition-colors font-label-caps text-label-sm"><span class="material-symbols-outlined">person_add</span>ADD SWIMMER</button></div></div>
<!-- Lane 2-8 placeholders -->
<script>
                    const lanes = [2, 3, 4, 5, 6, 7, 8];
                    lanes.forEach(i => {
                        document.write(`
                            <div class="flex-shrink-0 w-72 glass-panel rounded-2xl p-4 transition-all hover:border-primary/40 bg-surface/50">
                                <div class="flex justify-between items-center mb-4">
                                    <span class="font-headline-md text-on-surface-variant">LANE ${i}</span>
                                    <span class="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded text-label-sm font-bold">MID</span>
                                </div>
                                <div class="flex flex-wrap gap-2 mb-6">
                                    <div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-outline">
                                        <span class="material-symbols-outlined" data-icon="person">person</span>
                                    </div>
                                    <button class="w-12 h-12 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center text-outline-variant">
                                        <span class="material-symbols-outlined" data-icon="add">add</span>
                                    </button>
                                </div>
                                <div class="text-center py-4 border-t border-outline-variant/20">
                                    <p class="text-label-sm text-outline">No active tracking</p>
                                </div>
                            </div>
                        `);
                    });
                </script>
</div>
</section>
<!-- DATA ENTRY GRID (Bento Style) -->
<section class="grid grid-cols-1 md:grid-cols-3 gap-6">
<!-- Stroke Count Entry -->
<div class="md:col-span-2 glass-panel p-6 rounded-3xl shadow-sm">
<div class="flex items-center gap-2 mb-6">
<span class="material-symbols-outlined text-primary" data-icon="waves">waves</span>
<h3 class="font-headline-md text-headline-md">Stroke Count Entry</h3>
</div>
<div class="grid grid-cols-5 gap-4">
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">12</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">13</button>
<button class="h-16 rounded-2xl bg-primary text-on-primary text-headline-md font-bold shadow-md">14</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">15</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">16</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">17</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">18</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">19</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">20</button>
<button class="h-16 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-headline-md font-bold">21</button>
</div>
</div>
<!-- Session Stats Quick Look -->
<div class="glass-panel p-6 rounded-3xl shadow-sm bg-secondary-container/10">
<div class="flex items-center gap-2 mb-4">
<span class="material-symbols-outlined text-secondary" data-icon="analytics">analytics</span>
<h3 class="font-headline-md text-headline-md">Lane 1 AVG</h3>
</div>
<div class="space-y-4">
<div class="flex justify-between items-center p-3 bg-surface rounded-xl">
<span class="text-on-surface-variant font-label-caps">PACE</span>
<span class="text-headline-md text-primary font-bold">1:24.2</span>
</div>
<div class="flex justify-between items-center p-3 bg-surface rounded-xl">
<span class="text-on-surface-variant font-label-caps">STROKES</span>
<span class="text-headline-md text-primary font-bold">14.5</span>
</div>
<div class="flex justify-between items-center p-3 bg-surface rounded-xl">
<span class="text-on-surface-variant font-label-caps">SWOLF</span>
<span class="text-headline-md text-primary font-bold">36</span>
</div>
</div>
</div>
</section>
</main>
<!-- Floating Action Button for Side-Sheet (Mobile/Tablet Focused) -->
<button class="fixed bottom-24 right-6 w-16 h-16 rounded-full bg-primary text-on-primary shadow-lg z-50 flex items-center justify-center active:scale-90 transition-transform lg:hidden" onclick="toggleDrillDrawer()">
<span class="material-symbols-outlined text-[32px]" data-icon="event_note">event_note</span>
</button>
<!-- Bottom Drawer (Drills) -->
<div class="fixed inset-0 z-[60] pointer-events-none lg:hidden" id="drill-drawer">
<div class="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300" id="drawer-overlay" onclick="toggleDrillDrawer()"></div>
<div class="absolute bottom-0 left-0 w-full bg-surface-container rounded-t-3xl shadow-2xl drawer-transition translate-y-full pointer-events-auto p-6 max-h-[707px] overflow-y-auto" id="drawer-content">
<div class="w-12 h-1.5 bg-outline-variant rounded-full mx-auto mb-6"></div>
<div class="flex justify-between items-center mb-6">
<h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Session Drills</h3>
<button class="p-2 text-on-surface-variant" onclick="toggleDrillDrawer()"><span class="material-symbols-outlined" data-icon="close">close</span></button>
</div>
<div class="space-y-4">
<div class="p-4 bg-primary-container/10 border-l-4 border-primary rounded-xl">
<p class="text-label-caps text-primary mb-1">CURRENT</p>
<h4 class="font-body-lg font-bold">Threshold 400m</h4>
<p class="text-body-md text-on-surface-variant">Continuous swim at 85% effort. Focus on rotation.</p>
</div>
<div class="p-4 bg-surface rounded-xl border border-outline-variant">
<p class="text-label-caps text-outline mb-1">UP NEXT</p>
<h4 class="font-body-lg font-bold">10 x 50m Kick</h4>
<p class="text-body-md text-on-surface-variant">On 1:15 interval. High frequency kick.</p>
</div>
<div class="p-4 bg-surface rounded-xl border border-outline-variant">
<p class="text-label-caps text-outline mb-1">COOL DOWN</p>
<h4 class="font-body-lg font-bold">200m Choice</h4>
<p class="text-body-md text-on-surface-variant">Easy aerobic recovery.</p>
</div>
</div>
</div>
</div>
<!-- BottomNavBar (Mobile) -->
<nav class="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 bg-surface-container shadow-[0px_-4px_20px_rgba(0,0,0,0.12)] z-50 rounded-t-xl">
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1" href="#">
<span class="material-symbols-outlined" data-icon="home">home</span>
<span class="font-label-sm text-label-sm">Home</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1" href="#">
<span class="material-symbols-outlined" data-icon="groups">groups</span>
<span class="font-label-sm text-label-sm">Swimmers</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1" href="#">
<span class="material-symbols-outlined" data-icon="event_note">event_note</span>
<span class="font-label-sm text-label-sm">Sessions</span>
</a>
<a class="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-5 py-1 active:scale-90 transition-all duration-200" href="#">
<span class="material-symbols-outlined" data-icon="timer" style="font-variation-settings: 'FILL' 1;">timer</span>
<span class="font-label-sm text-label-sm">Live</span>
</a>
</nav>
<script>
        function toggleDrillDrawer() {
            const drawer = document.getElementById('drawer-content');
            const overlay = document.getElementById('drawer-overlay');
            const parent = document.getElementById('drill-drawer');
            
            if (drawer.classList.contains('translate-y-full')) {
                parent.classList.remove('pointer-events-none');
                drawer.classList.remove('translate-y-full');
                overlay.classList.add('opacity-100');
            } else {
                drawer.classList.add('translate-y-full');
                overlay.classList.remove('opacity-100');
                setTimeout(() => parent.classList.add('pointer-events-none'), 300);
            }
        }

        // Micro-interaction: Timer simulated update
        let seconds = 342;
        let milliseconds = 82;
        setInterval(() => {
            milliseconds += Math.floor(Math.random() * 10);
            if(milliseconds >= 100) {
                milliseconds = 0;
                seconds++;
            }
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            const ms = milliseconds.toString().padStart(2, '0');
            document.getElementById('main-timer').innerHTML = `${m}:${s}.<span class="text-primary">${ms}</span>`;
        }, 100);
    </script>
</body></html>

<!-- Live Deck - Bird's Eye View -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>LaneLogic Coaching - Lane Central</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "secondary-container": "#bdd6ff",
                    "on-tertiary-fixed-variant": "#3f484d",
                    "surface-container": "#eceef0",
                    "error": "#ba1a1a",
                    "primary-fixed": "#b7eaff",
                    "secondary": "#476083",
                    "surface-container-high": "#e6e8ea",
                    "on-error": "#ffffff",
                    "surface-variant": "#e0e3e5",
                    "surface": "#f7f9fb",
                    "tertiary": "#576065",
                    "surface-tint": "#00677f",
                    "background": "#f7f9fb",
                    "on-secondary-fixed": "#001c3a",
                    "on-tertiary": "#ffffff",
                    "on-error-container": "#93000a",
                    "inverse-surface": "#2d3133",
                    "on-surface-variant": "#3c494e",
                    "tertiary-fixed-dim": "#bfc8ce",
                    "on-primary-fixed-variant": "#004e60",
                    "primary-fixed-dim": "#4cd6ff",
                    "surface-dim": "#d8dadc",
                    "on-primary-fixed": "#001f28",
                    "error-container": "#ffdad6",
                    "surface-container-lowest": "#ffffff",
                    "secondary-fixed-dim": "#afc8f0",
                    "outline-variant": "#bbc9cf",
                    "on-surface": "#191c1e",
                    "on-tertiary-container": "#475055",
                    "on-primary-container": "#00566a",
                    "tertiary-container": "#b9c2c8",
                    "on-primary": "#ffffff",
                    "surface-container-low": "#f2f4f6",
                    "on-secondary-fixed-variant": "#2f486a",
                    "surface-container-highest": "#e0e3e5",
                    "inverse-on-surface": "#eff1f3",
                    "primary-container": "#00d1ff",
                    "surface-bright": "#f7f9fb",
                    "secondary-fixed": "#d4e3ff",
                    "outline": "#6c797f",
                    "primary": "#00677f",
                    "tertiary-fixed": "#dbe4ea",
                    "on-tertiary-fixed": "#141d21",
                    "inverse-primary": "#4cd6ff",
                    "on-background": "#191c1e",
                    "on-secondary": "#ffffff"
            },
            "borderRadius": {
                    "DEFAULT": "0.25rem",
                    "lg": "0.5rem",
                    "xl": "0.75rem",
                    "full": "9999px"
            },
            "spacing": {
                    "gutter": "1rem",
                    "touch-target-min": "48px",
                    "stack-md": "1rem",
                    "margin-mobile": "1.25rem",
                    "stack-sm": "0.5rem",
                    "stack-lg": "2rem",
                    "margin-desktop": "2.5rem"
            },
            "fontFamily": {
                    "headline-lg": ["Montserrat"],
                    "body-lg": ["Inter"],
                    "display-timer": ["Montserrat"],
                    "headline-md": ["Montserrat"],
                    "body-md": ["Inter"],
                    "label-caps": ["Inter"],
                    "label-sm": ["Inter"],
                    "headline-lg-mobile": ["Montserrat"]
            },
            "fontSize": {
                    "headline-lg": ["32px", {"lineHeight": "40px", "fontWeight": "700"}],
                    "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "500"}],
                    "display-timer": ["64px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
                    "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
                    "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
                    "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
                    "label-sm": ["12px", {"lineHeight": "16px", "fontWeight": "500"}],
                    "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "700"}]
            }
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            background-color: #f7f9fb;
            overscroll-behavior-y: contain;
        }
        .lane-scroll::-webkit-scrollbar { display: none; }
        .lane-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        
        .glass-panel {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 103, 127, 0.1);
        }
        
        .timer-glow {
            text-shadow: 0 0 15px rgba(0, 209, 255, 0.2);
        }

        .active-lane {
            box-shadow: 0 0 0 2px #00677f, 0 4px 20px rgba(0, 103, 127, 0.15);
        }
        
        .drawer-transition {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lane-card-min-width { min-width: 340px; }
    </style>
</head>
<body class="font-body-md text-on-surface">
<!-- TopAppBar -->
<header class="bg-surface border-b-2 border-outline-variant shadow-sm flex items-center justify-between px-margin-mobile py-4 w-full z-40 fixed top-0 left-0">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary text-[28px]" data-icon="pool">pool</span>
<h1 class="font-headline-md text-headline-md font-bold text-primary">LaneLogic</h1>
</div>
<div class="flex items-center gap-4">
<button class="hidden md:flex items-center gap-2 px-4 py-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant font-label-caps">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
</button>
<span class="bg-primary-container/20 text-on-primary-container px-4 py-1 rounded-full font-label-caps text-label-caps border border-primary/20">Varsity Team</span>
</div>
</header>
<!-- Sidebar (Desktop) -->
<aside class="hidden lg:flex flex-col fixed left-0 top-0 h-full w-72 bg-surface-container-low shadow-xl z-30 pt-24 p-stack-md border-r border-outline-variant">
<h2 class="font-headline-md text-headline-md text-primary px-2 mb-6">Deck Control</h2>
<nav class="space-y-2">
<a class="flex items-center gap-3 p-3 rounded-xl text-primary font-bold bg-primary-container/20 transition-all duration-300" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span>Lane View</span>
</a>
<a class="flex items-center gap-3 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-all duration-300" href="#">
<span class="material-symbols-outlined" data-icon="group">group</span>
<span>Roster Management</span>
</a>
<a class="flex items-center gap-3 p-3 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-all duration-300" href="#">
<span class="material-symbols-outlined" data-icon="monitoring">monitoring</span>
<span>Session Analytics</span>
</a>
</nav>
<div class="mt-auto p-4 bg-surface rounded-xl border border-outline-variant/30">
<p class="text-label-caps font-label-caps text-outline mb-2">SESSION GOAL</p>
<p class="font-body-md font-bold text-on-surface">Anaerobic Power</p>
<p class="text-label-sm text-on-surface-variant">Focus: High-effort turnover</p>
</div>
</aside>
<!-- Main Content -->
<main class="pt-20 pb-32 px-4 md:px-margin-desktop lg:ml-72 min-h-screen">
<!-- POOL LANES SECTION -->
<section class="mb-8 mt-4">
<div class="flex items-center justify-between mb-6">
<h3 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
<span class="material-symbols-outlined text-primary">lanes</span>
                    Pool Deck (8 Lanes)
                </h3>
<div class="flex gap-2">
<button class="p-2 rounded-lg bg-surface-variant text-on-surface-variant active:scale-95 transition-transform"><span class="material-symbols-outlined" data-icon="filter_list">filter_list</span></button>
<button class="p-2 rounded-lg bg-primary-container text-on-primary-container shadow-sm"><span class="material-symbols-outlined" data-icon="view_stream">view_stream</span></button>
</div>
</div>
<!-- Horizontal Lane Scroll -->
<div class="lane-scroll flex gap-6 overflow-x-auto pb-6 px-1">
<!-- Lane 1 Card (Deep Lane Integration) -->
<div class="flex-shrink-0 lane-card-min-width active-lane glass-panel rounded-3xl p-5 bg-surface-container-lowest">
<!-- Lane Header & Timer Controls -->
<div class="flex justify-between items-start mb-4">
<div>
<div class="flex items-center gap-2 mb-1">
<span class="font-headline-md text-primary text-xl">LANE 1</span>
<span class="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Fast</span>
</div>
<div class="flex items-center gap-1 text-on-surface-variant">
<span class="material-symbols-outlined text-sm">history_edu</span>
<span class="text-[10px] font-bold uppercase">Drill: Threshold 400m</span>
</div>
</div>
<div class="text-right">
<p class="font-display-timer text-2xl tabular-nums text-on-surface timer-glow leading-none mb-1">05:42.<span class="text-primary">8</span></p>
<span class="text-[10px] text-outline font-label-caps">LANE TIMER</span>
</div>
</div>
<!-- Main Lane Control -->
<button class="w-full bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 mb-6 shadow-md hover:brightness-110 active:scale-[0.98] transition-all">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                        LANE START (5S INT)
                    </button>
<!-- Swimmers List (Dense Layout) -->
<div class="space-y-2 mb-6">
<div class="flex items-center justify-between px-1 mb-2">
<span class="text-[10px] font-bold text-outline uppercase tracking-widest">Active Swimmers (3)</span>
<span class="material-symbols-outlined text-outline text-sm">swap_vert</span>
</div>
<!-- Swimmer Card 1 -->
<div class="bg-surface border border-outline-variant/30 rounded-xl p-2 flex items-center gap-3 relative group">
<div class="cursor-grab active:cursor-grabbing text-outline-variant hover:text-outline p-1">
<span class="material-symbols-outlined text-lg">drag_indicator</span>
</div>
<div class="relative shrink-0">
<img class="w-10 h-10 rounded-full border-2 border-primary object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQxgKwBjP1CC-VPqI4DVTrnQi2IHvYB0aAV20GyYy_0oIMhSlCE7EEisNFRan35D45D3vvwvjMpIx2lb2iAG-X6Ojy4UMSSXMsfO7e-bGhMcgYnItLRS2RmqIJXLeG6XTTJzkFPJk7pCKSS5v4ffSlotPfzL1XzlRK_mETddAFNtPtH7Lc0rz9BKqQYzIAwBRcauYvBKpYD7p6Aj1IgVXsvQkq8mbTkqyGQ99y_fcY533u9khPrUeutw"/>
<span class="absolute -bottom-1 -right-1 bg-primary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">1</span>
</div>
<div class="flex-grow min-w-0">
<p class="font-bold text-sm truncate">Alex P.</p>
<div class="flex items-center gap-2">
<span class="text-[9px] font-bold text-primary">LAP 4</span>
<span class="text-[10px] font-medium text-outline tabular-nums">+04.2</span>
</div>
</div>
<div class="flex items-center gap-1 shrink-0">
<button class="w-10 h-10 rounded-lg bg-secondary-container/30 text-on-secondary-container flex items-center justify-center active:bg-secondary-container">
<span class="material-symbols-outlined text-xl">timer</span>
</button>
<button class="w-10 h-10 rounded-lg bg-surface-variant/50 text-on-surface-variant flex items-center justify-center">
<span class="material-symbols-outlined text-xl">check</span>
</button>
</div>
</div>
<!-- Swimmer Card 2 -->
<div class="bg-surface border border-outline-variant/30 rounded-xl p-2 flex items-center gap-3 relative group">
<div class="text-outline-variant p-1">
<span class="material-symbols-outlined text-lg">drag_indicator</span>
</div>
<div class="relative shrink-0">
<img class="w-10 h-10 rounded-full border-2 border-transparent object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQXqM1anG1YO92M6bkTi9zu2f_D2kEJJm73QpLt2A4L5Bs_YKmXSXU-V8rz_jTe9mgfkhDUiCPFRurA7Zs3x8y7pblcZk5NOt5W0LsII0LF2XCww_xpIY3H4q0GxUDg4lvVWO9hOkMoBh1O4QVwxxWdEspJVETc8MjcJbUqrUSElwB956gORWsrRMQs480rSnwgNsGM1K47WG7K0yyf8Lhx6rGIjc8MSYnaKkhtsOEMRq3iihtlqb_gg"/>
<span class="absolute -bottom-1 -right-1 bg-outline text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">2</span>
</div>
<div class="flex-grow min-w-0">
<p class="font-bold text-sm truncate">Maya R.</p>
<span class="text-[9px] font-bold text-outline">READY</span>
</div>
<div class="flex items-center gap-1 shrink-0">
<button class="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
<span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
</button>
<button class="w-10 h-10 rounded-lg bg-surface-variant/30 text-outline flex items-center justify-center opacity-50" disabled="">
<span class="material-symbols-outlined text-xl">timer</span>
</button>
</div>
</div>
<!-- Swimmer Card 3 -->
<div class="bg-surface border border-outline-variant/30 rounded-xl p-2 flex items-center gap-3 relative group">
<div class="text-outline-variant p-1">
<span class="material-symbols-outlined text-lg">drag_indicator</span>
</div>
<div class="relative shrink-0">
<div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-outline-variant border-2 border-transparent">
<span class="material-symbols-outlined">person</span>
</div>
<span class="absolute -bottom-1 -right-1 bg-outline text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">3</span>
</div>
<div class="flex-grow min-w-0">
<p class="font-bold text-sm truncate">Jon D.</p>
<span class="text-[9px] font-bold text-outline">READY</span>
</div>
<div class="flex items-center gap-1 shrink-0">
<button class="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
<span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
</button>
<button class="w-10 h-10 rounded-lg bg-surface-variant/30 text-outline flex items-center justify-center opacity-50" disabled="">
<span class="material-symbols-outlined text-xl">timer</span>
</button>
</div>
</div>
</div>
<button class="w-full py-2.5 rounded-xl border-2 border-dashed border-outline-variant/50 flex items-center justify-center gap-2 text-outline-variant hover:text-primary hover:border-primary hover:bg-primary/5 transition-all font-label-caps text-[10px]">
<span class="material-symbols-outlined text-sm">person_add</span>
                        ADD SWIMMER (MAX 12)
                    </button>
<!-- Lane Footer Controls -->
<div class="mt-6 pt-4 border-t border-outline-variant/20 flex justify-between gap-3">
<button class="flex-1 py-2 rounded-lg bg-error/10 text-error font-bold text-[10px] flex items-center justify-center gap-1">
<span class="material-symbols-outlined text-sm">stop</span> STOP ALL
                        </button>
<button class="flex-1 py-2 rounded-lg bg-surface-variant text-on-surface-variant font-bold text-[10px] flex items-center justify-center gap-1">
<span class="material-symbols-outlined text-sm">refresh</span> RESET
                        </button>
</div>
</div>
<!-- Lane 2 Card (Collapsed/Template View) -->
<div class="flex-shrink-0 lane-card-min-width glass-panel rounded-3xl p-5 bg-surface/40 border-outline-variant/30">
<div class="flex justify-between items-start mb-6">
<div>
<div class="flex items-center gap-2 mb-1">
<span class="font-headline-md text-on-surface-variant text-xl">LANE 2</span>
<span class="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Mid</span>
</div>
<div class="flex items-center gap-1 text-outline">
<span class="material-symbols-outlined text-sm">history_edu</span>
<span class="text-[10px] font-bold uppercase">Drill: 10x50m Kick</span>
</div>
</div>
<div class="text-right">
<p class="font-display-timer text-2xl tabular-nums text-outline leading-none mb-1">00:00.<span class="text-outline-variant">0</span></p>
<span class="text-[10px] text-outline font-label-caps">INACTIVE</span>
</div>
</div>
<div class="h-48 flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/30 rounded-2xl mb-6 bg-surface/20">
<span class="material-symbols-outlined text-3xl text-outline-variant mb-2">group_add</span>
<p class="text-label-sm text-outline-variant font-medium">No active tracking</p>
<button class="mt-4 px-4 py-2 bg-on-surface text-surface rounded-full text-[10px] font-bold uppercase tracking-wider">Setup Lane</button>
</div>
<button class="w-full bg-surface-variant/50 text-outline py-3 rounded-xl font-bold flex items-center justify-center gap-2" disabled="">
<span class="material-symbols-outlined">play_arrow</span>
                        LANE START
                    </button>
</div>
<!-- Lane 3-8 Placeholder Loop -->
<script>
                    const lanes = [3, 4, 5, 6, 7, 8];
                    lanes.forEach(i => {
                        document.write(`
                            <div class="flex-shrink-0 w-80 glass-panel rounded-3xl p-5 bg-surface/20 border-outline-variant/20 flex flex-col items-center justify-center text-outline-variant opacity-60">
                                <span class="font-headline-md text-lg mb-2">LANE ${i}</span>
                                <span class="material-symbols-outlined text-2xl">lock</span>
                            </div>
                        `);
                    });
                </script>
</div>
</section>
<!-- DATA ENTRY & STATS GRID -->
<section class="grid grid-cols-1 md:grid-cols-3 gap-6">
<!-- Stroke Count Entry -->
<div class="md:col-span-2 glass-panel p-6 rounded-3xl shadow-sm border-outline-variant/30">
<div class="flex items-center gap-2 mb-6">
<span class="material-symbols-outlined text-primary" data-icon="waves">waves</span>
<h3 class="font-headline-md text-headline-md">Metric Entry: Lane 1</h3>
</div>
<div class="grid grid-cols-5 gap-3">
<button class="h-14 rounded-xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-lg font-bold">12</button>
<button class="h-14 rounded-xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-lg font-bold">13</button>
<button class="h-14 rounded-xl bg-primary text-on-primary text-lg font-bold shadow-md">14</button>
<button class="h-14 rounded-xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-lg font-bold">15</button>
<button class="h-14 rounded-xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-lg font-bold">16</button>
<button class="h-14 rounded-xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-lg font-bold">17</button>
<button class="h-14 rounded-xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-lg font-bold">18</button>
<button class="h-14 rounded-xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-lg font-bold">19</button>
<button class="h-14 rounded-xl bg-surface-container-high hover:bg-primary hover:text-white transition-all text-lg font-bold">20</button>
<button class="h-14 rounded-xl bg-surface-container-high flex items-center justify-center text-outline hover:text-primary"><span class="material-symbols-outlined">edit</span></button>
</div>
</div>
<!-- Lane Analytics -->
<div class="glass-panel p-6 rounded-3xl shadow-sm bg-secondary-container/5 border-secondary/10">
<div class="flex items-center gap-2 mb-4">
<span class="material-symbols-outlined text-secondary" data-icon="analytics">analytics</span>
<h3 class="font-headline-md text-headline-md">Lane 1 Live AVG</h3>
</div>
<div class="space-y-3">
<div class="flex justify-between items-center p-4 bg-surface rounded-2xl shadow-sm border border-outline-variant/10">
<span class="text-on-surface-variant font-label-caps text-[10px] tracking-widest">PACE</span>
<span class="text-xl text-primary font-bold">1:24.2</span>
</div>
<div class="flex justify-between items-center p-4 bg-surface rounded-2xl shadow-sm border border-outline-variant/10">
<span class="text-on-surface-variant font-label-caps text-[10px] tracking-widest">STROKES</span>
<span class="text-xl text-primary font-bold">14.5</span>
</div>
<div class="flex justify-between items-center p-4 bg-surface rounded-2xl shadow-sm border border-outline-variant/10">
<span class="text-on-surface-variant font-label-caps text-[10px] tracking-widest">SWOLF</span>
<span class="text-xl text-primary font-bold">36</span>
</div>
</div>
</div>
</section>
</main>
<!-- Drawer Trigger (Mobile) -->
<button class="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-on-primary shadow-xl z-50 flex items-center justify-center active:scale-90 transition-transform lg:hidden" onclick="toggleDrillDrawer()">
<span class="material-symbols-outlined text-2xl">assignment</span>
</button>
<!-- Bottom Drawer (Drills) -->
<div class="fixed inset-0 z-[60] pointer-events-none lg:hidden" id="drill-drawer">
<div class="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-300" id="drawer-overlay" onclick="toggleDrillDrawer()"></div>
<div class="absolute bottom-0 left-0 w-full bg-surface-container rounded-t-[40px] shadow-2xl drawer-transition translate-y-full pointer-events-auto p-8 max-h-[85dvh] overflow-y-auto" id="drawer-content">
<div class="w-10 h-1 bg-outline-variant/40 rounded-full mx-auto mb-8"></div>
<div class="flex justify-between items-center mb-8">
<h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Lane Workouts</h3>
<button class="p-2 text-on-surface-variant bg-surface rounded-full shadow-sm" onclick="toggleDrillDrawer()"><span class="material-symbols-outlined">close</span></button>
</div>
<div class="space-y-6">
<div class="p-5 bg-primary-container/10 border-l-4 border-primary rounded-2xl">
<div class="flex justify-between items-center mb-2">
<p class="text-[10px] font-bold text-primary uppercase tracking-widest">Lane 1 • Active</p>
<span class="bg-primary text-white text-[9px] px-2 py-0.5 rounded-full">Threshold</span>
</div>
<h4 class="font-body-lg font-bold mb-2">Threshold 400m</h4>
<p class="text-body-md text-on-surface-variant leading-relaxed">Continuous swim at 85% effort. Focus on maintaining consistent rotation and stroke count per lap.</p>
</div>
<div class="p-5 bg-surface rounded-2xl border border-outline-variant/30">
<p class="text-[10px] font-bold text-outline uppercase tracking-widest mb-2">Lane 2 • Next Up</p>
<h4 class="font-body-lg font-bold mb-1">10 x 50m Kick</h4>
<p class="text-body-md text-on-surface-variant">On 1:15 interval. High frequency kick with minimal upper body movement.</p>
</div>
</div>
</div>
</div>
<!-- BottomNavBar (Mobile) -->
<nav class="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-surface-container shadow-[0px_-8px_32px_rgba(0,0,0,0.1)] z-50 rounded-t-3xl">
<a class="flex flex-col items-center justify-center text-outline py-1" href="#">
<span class="material-symbols-outlined text-2xl">home</span>
<span class="font-label-sm text-[10px] mt-1">Home</span>
</a>
<a class="flex flex-col items-center justify-center text-outline py-1" href="#">
<span class="material-symbols-outlined text-2xl">groups</span>
<span class="font-label-sm text-[10px] mt-1">Team</span>
</a>
<a class="flex flex-col items-center justify-center text-primary py-1" href="#">
<span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1;">lanes</span>
<span class="font-label-sm text-[10px] mt-1 font-bold">Lanes</span>
</a>
<a class="flex flex-col items-center justify-center text-outline py-1" href="#">
<span class="material-symbols-outlined text-2xl">settings</span>
<span class="font-label-sm text-[10px] mt-1">Config</span>
</a>
</nav>
<script>
        function toggleDrillDrawer() {
            const drawer = document.getElementById('drawer-content');
            const overlay = document.getElementById('drawer-overlay');
            const parent = document.getElementById('drill-drawer');
            
            if (drawer.classList.contains('translate-y-full')) {
                parent.classList.remove('pointer-events-none');
                drawer.classList.remove('translate-y-full');
                overlay.classList.add('opacity-100');
            } else {
                drawer.classList.add('translate-y-full');
                overlay.classList.remove('opacity-100');
                setTimeout(() => parent.classList.add('pointer-events-none'), 300);
            }
        }

        // Micro-interaction: Mock Lane Timer
        let seconds = 342;
        let deciSeconds = 8;
        setInterval(() => {
            deciSeconds++;
            if(deciSeconds >= 10) {
                deciSeconds = 0;
                seconds++;
            }
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            const ds = deciSeconds.toString();
            
            const timerEl = document.querySelector('.font-display-timer');
            if(timerEl) {
                timerEl.innerHTML = `${m}:${s}.<span class="text-primary">${ds}</span>`;
            }
        }, 100);
    </script>
</body></html>

<!-- Lane-Specific Live Deck -->
<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>LaneLogic Coaching - Live Deck</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            display: inline-block;
            line-height: 1;
            text-transform: none;
            letter-spacing: normal;
            word-wrap: normal;
            white-space: nowrap;
            direction: ltr;
        }
        
        .lane-card-shadow {
            box-shadow: 0px 4px 20px rgba(0, 103, 127, 0.12);
        }

        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #bbc9cf;
            border-radius: 10px;
        }

        @keyframes pulse-subtle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        .animate-timer {
            animation: pulse-subtle 2s infinite ease-in-out;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "primary-container": "#00d1ff",
                        "tertiary-fixed": "#dbe4ea",
                        "secondary-fixed": "#d4e3ff",
                        "on-background": "#191c1e",
                        "surface-container-low": "#f2f4f6",
                        "on-primary-container": "#00566a",
                        "inverse-primary": "#4cd6ff",
                        "on-secondary": "#ffffff",
                        "error": "#ba1a1a",
                        "on-tertiary-fixed-variant": "#3f484d",
                        "on-tertiary-container": "#475055",
                        "on-tertiary": "#ffffff",
                        "background": "#f7f9fb",
                        "on-tertiary-fixed": "#141d21",
                        "inverse-surface": "#2d3133",
                        "secondary-container": "#bdd6ff",
                        "inverse-on-surface": "#eff1f3",
                        "outline-variant": "#bbc9cf",
                        "error-container": "#ffdad6",
                        "tertiary": "#576065",
                        "surface-bright": "#f7f9fb",
                        "surface-container-lowest": "#ffffff",
                        "on-surface-variant": "#3c494e",
                        "on-secondary-fixed-variant": "#2f486a",
                        "surface-variant": "#e0e3e5",
                        "tertiary-fixed-dim": "#bfc8ce",
                        "surface-tint": "#00677f",
                        "primary-fixed": "#b7eaff",
                        "on-error-container": "#93000a",
                        "on-error": "#ffffff",
                        "primary-fixed-dim": "#4cd6ff",
                        "surface-container-high": "#e6e8ea",
                        "secondary-fixed-dim": "#afc8f0",
                        "surface-dim": "#d8dadc",
                        "surface": "#f7f9fb",
                        "on-primary-fixed-variant": "#004e60",
                        "surface-container": "#eceef0",
                        "on-primary-fixed": "#001f28",
                        "surface-container-highest": "#e0e3e5",
                        "outline": "#6c797f",
                        "tertiary-container": "#b9c2c8",
                        "primary": "#00677f",
                        "on-secondary-fixed": "#001c3a",
                        "secondary": "#476083",
                        "on-surface": "#191c1e",
                        "on-secondary-container": "#445d80",
                        "on-primary": "#ffffff"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "full": "9999px"
                    },
                    "spacing": {
                        "stack-sm": "0.5rem",
                        "stack-md": "1rem",
                        "stack-lg": "2rem",
                        "gutter": "1rem",
                        "margin-desktop": "2.5rem",
                        "touch-target-min": "48px",
                        "margin-mobile": "1.25rem"
                    },
                    "fontFamily": {
                        "display-timer": ["Montserrat"],
                        "label-caps": ["Inter"],
                        "headline-md": ["Montserrat"],
                        "headline-lg-mobile": ["Montserrat"],
                        "body-lg": ["Inter"],
                        "headline-lg": ["Montserrat"],
                        "label-sm": ["Inter"],
                        "body-md": ["Inter"]
                    },
                    "fontSize": {
                        "display-timer": ["64px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700" }],
                        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700" }],
                        "headline-md": ["20px", { "lineHeight": "28px", "fontWeight": "600" }],
                        "headline-lg-mobile": ["24px", { "lineHeight": "32px", "fontWeight": "700" }],
                        "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "500" }],
                        "headline-lg": ["32px", { "lineHeight": "40px", "fontWeight": "700" }],
                        "label-sm": ["12px", { "lineHeight": "16px", "fontWeight": "500" }],
                        "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }]
                    }
                },
            },
        }
    </script>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-background text-on-background font-body-md text-body-md min-h-screen pb-24">
<!-- TopAppBar -->
<header class="bg-surface border-b-2 border-outline-variant shadow-sm fixed top-0 w-full z-40 flex items-center justify-between px-margin-mobile py-4">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-primary text-2xl" data-icon="pool">pool</span>
<h1 class="font-headline-md text-headline-md font-bold text-primary">LaneLogic Coaching</h1>
</div>
<div class="flex items-center gap-2">
<span class="bg-primary-container/20 text-on-primary-container px-3 py-1 rounded-full font-label-sm text-label-sm font-bold">Varsity Team</span>
<button class="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-high transition-colors p-2 rounded-full" data-icon="notifications">notifications</button>
</div>
</header>
<!-- Main Content Canvas -->
<main class="mt-20 px-4 md:px-8 max-w-7xl mx-auto space-y-6">
<!-- Header Info -->
<div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
<div>
<p class="text-primary font-label-caps tracking-widest uppercase mb-1">Live Deck</p>
<h2 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">Morning Endurance</h2>
</div>
<div class="flex items-center gap-3 bg-surface-container rounded-xl p-3 border border-outline-variant">
<div class="flex flex-col">
<span class="text-label-sm font-label-sm text-on-surface-variant">Global Session Time</span>
<span class="font-display-timer text-3xl text-primary font-bold">42:15.8</span>
</div>
<button class="material-symbols-outlined bg-error text-on-error p-3 rounded-xl shadow-lg active:scale-95 transition-transform" data-icon="stop_circle">stop_circle</button>
</div>
</div>
<!-- Lane Grid (3 Lanes) -->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
<!-- Lane 1 -->
<section class="bg-surface-container-lowest rounded-xl lane-card-shadow border border-primary/10 overflow-hidden flex flex-col h-[640px]">
<!-- Lane Header -->
<div class="bg-primary p-4 text-on-primary">
<div class="flex justify-between items-start mb-2">
<span class="font-headline-md text-headline-md font-bold">Lane 1</span>
<div class="bg-white/20 px-2 py-1 rounded text-label-sm font-label-sm">Active</div>
</div>
<div class="flex flex-col gap-1">
<span class="text-on-primary/80 font-label-sm text-label-sm uppercase tracking-wider">Current Drill</span>
<span class="font-body-lg text-body-lg font-bold">500 Free Threshold</span>
</div>
</div>
<!-- Lane Timer & Start Action -->
<div class="p-4 bg-surface-container-high/50 flex items-center justify-between">
<div>
<span class="font-display-timer text-4xl text-primary font-black animate-timer">08:12.4</span>
</div>
<button class="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 hover:bg-surface-tint transition-colors active:scale-95">
<span class="material-symbols-outlined" data-icon="play_arrow">play_arrow</span>
                        LANE START
                    </button>
</div>
<!-- Swimmer List -->
<div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-2">
<!-- Swimmer Rows (Loop 7 times, first 3 priority) -->
<div class="swimmer-row group flex items-center justify-between p-3 bg-surface border-2 border-primary rounded-lg">
<div class="flex flex-col">
<span class="font-bold text-on-background">Alex Johnson</span>
<span class="text-label-sm text-primary font-bold">Lap 8/20</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono text-xl font-bold text-on-surface-variant">32.4</span>
<button class="bg-primary-container text-on-primary-container p-3 rounded-lg font-bold active:scale-90 transition-all">LAP</button>
</div>
</div>
<div class="swimmer-row group flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-lg">
<div class="flex flex-col">
<span class="font-bold text-on-background">Sarah Miller</span>
<span class="text-label-sm text-primary font-bold">Lap 8/20</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono text-xl font-bold text-on-surface-variant">33.1</span>
<button class="bg-primary-container text-on-primary-container p-3 rounded-lg font-bold active:scale-90 transition-all">LAP</button>
</div>
</div>
<div class="swimmer-row group flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-lg">
<div class="flex flex-col">
<span class="font-bold text-on-background">Chris Evans</span>
<span class="text-label-sm text-primary font-bold">Lap 7/20</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono text-xl font-bold text-on-surface-variant">34.8</span>
<button class="bg-primary-container text-on-primary-container p-3 rounded-lg font-bold active:scale-90 transition-all">LAP</button>
</div>
</div>
<!-- Compact rows for 4-7 -->
<div class="space-y-1 pt-2 border-t border-outline-variant">
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md">
<span class="text-body-md font-medium">David R.</span>
<div class="flex items-center gap-4">
<span class="font-mono text-on-surface-variant">35.2</span>
<button class="text-primary font-bold px-2 py-1">LAP</button>
</div>
</div>
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md">
<span class="text-body-md font-medium">Elena K.</span>
<div class="flex items-center gap-4">
<span class="font-mono text-on-surface-variant">31.9</span>
<button class="text-primary font-bold px-2 py-1">LAP</button>
</div>
</div>
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md">
<span class="text-body-md font-medium">Marcus T.</span>
<div class="flex items-center gap-4">
<span class="font-mono text-on-surface-variant">34.4</span>
<button class="text-primary font-bold px-2 py-1">LAP</button>
</div>
</div>
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md">
<span class="text-body-md font-medium">Sophia W.</span>
<div class="flex items-center gap-4">
<span class="font-mono text-on-surface-variant">36.1</span>
<button class="text-primary font-bold px-2 py-1">LAP</button>
</div>
</div>
</div>
</div>
</section>
<!-- Lane 2 -->
<section class="bg-surface-container-lowest rounded-xl lane-card-shadow border border-primary/10 overflow-hidden flex flex-col h-[640px]">
<div class="bg-primary p-4 text-on-primary">
<div class="flex justify-between items-start mb-2">
<span class="font-headline-md text-headline-md font-bold">Lane 2</span>
<div class="bg-white/20 px-2 py-1 rounded text-label-sm font-label-sm">Active</div>
</div>
<div class="flex flex-col gap-1">
<span class="text-on-primary/80 font-label-sm text-label-sm uppercase tracking-wider">Current Drill</span>
<span class="font-body-lg text-body-lg font-bold">200 IM Descending</span>
</div>
</div>
<div class="p-4 bg-surface-container-high/50 flex items-center justify-between">
<div>
<span class="font-display-timer text-4xl text-primary font-black animate-timer">03:44.2</span>
</div>
<button class="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 hover:bg-surface-tint transition-colors active:scale-95">
<span class="material-symbols-outlined" data-icon="play_arrow">play_arrow</span>
                        LANE START
                    </button>
</div>
<div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-2">
<div class="swimmer-row group flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-lg">
<div class="flex flex-col">
<span class="font-bold text-on-background">Jordan P.</span>
<span class="text-label-sm text-primary font-bold">Lap 3/8</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono text-xl font-bold text-on-surface-variant">42.5</span>
<button class="bg-primary-container text-on-primary-container p-3 rounded-lg font-bold active:scale-90 transition-all">LAP</button>
</div>
</div>
<div class="swimmer-row group flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-lg">
<div class="flex flex-col">
<span class="font-bold text-on-background">Maya H.</span>
<span class="text-label-sm text-primary font-bold">Lap 3/8</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono text-xl font-bold text-on-surface-variant">43.1</span>
<button class="bg-primary-container text-on-primary-container p-3 rounded-lg font-bold active:scale-90 transition-all">LAP</button>
</div>
</div>
<div class="swimmer-row group flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-lg">
<div class="flex flex-col">
<span class="font-bold text-on-background">Tom B.</span>
<span class="text-label-sm text-primary font-bold">Lap 2/8</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono text-xl font-bold text-on-surface-variant">45.0</span>
<button class="bg-primary-container text-on-primary-container p-3 rounded-lg font-bold active:scale-90 transition-all">LAP</button>
</div>
</div>
<div class="space-y-1 pt-2 border-t border-outline-variant">
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md">
<span class="text-body-md font-medium">Liam S.</span>
<div class="flex items-center gap-4"><span class="font-mono">46.2</span><button class="text-primary font-bold px-2 py-1">LAP</button></div>
</div>
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md">
<span class="text-body-md font-medium">Noah G.</span>
<div class="flex items-center gap-4"><span class="font-mono">44.8</span><button class="text-primary font-bold px-2 py-1">LAP</button></div>
</div>
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md">
<span class="text-body-md font-medium">Olivia Z.</span>
<div class="flex items-center gap-4"><span class="font-mono">43.9</span><button class="text-primary font-bold px-2 py-1">LAP</button></div>
</div>
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md">
<span class="text-body-md font-medium">Ryan F.</span>
<div class="flex items-center gap-4"><span class="font-mono">47.5</span><button class="text-primary font-bold px-2 py-1">LAP</button></div>
</div>
</div>
</div>
</section>
<!-- Lane 3 -->
<section class="bg-surface-container-lowest rounded-xl lane-card-shadow border border-primary/10 overflow-hidden flex flex-col h-[640px]">
<div class="bg-primary p-4 text-on-primary">
<div class="flex justify-between items-start mb-2">
<span class="font-headline-md text-headline-md font-bold">Lane 3</span>
<div class="bg-white/20 px-2 py-1 rounded text-label-sm font-label-sm">Idle</div>
</div>
<div class="flex flex-col gap-1">
<span class="text-on-primary/80 font-label-sm text-label-sm uppercase tracking-wider">Current Drill</span>
<span class="font-body-lg text-body-lg font-bold">100 Fly Sprints</span>
</div>
</div>
<div class="p-4 bg-surface-container-high/50 flex items-center justify-between">
<div>
<span class="font-display-timer text-4xl text-on-surface-variant font-black">00:00.0</span>
</div>
<button class="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 hover:bg-surface-tint transition-colors active:scale-95">
<span class="material-symbols-outlined" data-icon="play_arrow">play_arrow</span>
                        LANE START
                    </button>
</div>
<div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-2">
<div class="swimmer-row group flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-lg grayscale opacity-60">
<div class="flex flex-col">
<span class="font-bold text-on-background">Katie L.</span>
<span class="text-label-sm text-on-surface-variant font-bold">Ready</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono text-xl font-bold text-on-surface-variant">--.-</span>
<button class="bg-surface-variant text-on-surface-variant p-3 rounded-lg font-bold cursor-not-allowed">LAP</button>
</div>
</div>
<div class="swimmer-row group flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-lg grayscale opacity-60">
<div class="flex flex-col">
<span class="font-bold text-on-background">James D.</span>
<span class="text-label-sm text-on-surface-variant font-bold">Ready</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono text-xl font-bold text-on-surface-variant">--.-</span>
<button class="bg-surface-variant text-on-surface-variant p-3 rounded-lg font-bold cursor-not-allowed">LAP</button>
</div>
</div>
<div class="swimmer-row group flex items-center justify-between p-3 bg-surface border border-outline-variant rounded-lg grayscale opacity-60">
<div class="flex flex-col">
<span class="font-bold text-on-background">Emma S.</span>
<span class="text-label-sm text-on-surface-variant font-bold">Ready</span>
</div>
<div class="flex items-center gap-4">
<span class="font-mono text-xl font-bold text-on-surface-variant">--.-</span>
<button class="bg-surface-variant text-on-surface-variant p-3 rounded-lg font-bold cursor-not-allowed">LAP</button>
</div>
</div>
<div class="space-y-1 pt-2 border-t border-outline-variant">
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md opacity-40">
<span class="text-body-md font-medium">Oliver N.</span>
<div class="flex items-center gap-4"><span class="font-mono">--.-</span><button class="text-on-surface-variant font-bold px-2 py-1">LAP</button></div>
</div>
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md opacity-40">
<span class="text-body-md font-medium">Isabella R.</span>
<div class="flex items-center gap-4"><span class="font-mono">--.-</span><button class="text-on-surface-variant font-bold px-2 py-1">LAP</button></div>
</div>
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md opacity-40">
<span class="text-body-md font-medium">Ethan M.</span>
<div class="flex items-center gap-4"><span class="font-mono">--.-</span><button class="text-on-surface-variant font-bold px-2 py-1">LAP</button></div>
</div>
<div class="flex items-center justify-between px-3 py-1 bg-surface-container-low rounded-md opacity-40">
<span class="text-body-md font-medium">Charlotte C.</span>
<div class="flex items-center gap-4"><span class="font-mono">--.-</span><button class="text-on-surface-variant font-bold px-2 py-1">LAP</button></div>
</div>
</div>
</div>
</section>
</div>
</main>
<!-- BottomNavBar -->
<nav class="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-4 pt-2 bg-surface-container shadow-[0px_-4px_20px_rgba(0,0,0,0.12)] z-50 rounded-t-xl">
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1 hover:bg-surface-variant transition-all duration-200 active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="home">home</span>
<span class="font-label-sm text-label-sm mt-1">Home</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1 hover:bg-surface-variant transition-all duration-200 active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="groups">groups</span>
<span class="font-label-sm text-label-sm mt-1">Swimmers</span>
</a>
<a class="flex flex-col items-center justify-center text-on-surface-variant py-1 hover:bg-surface-variant transition-all duration-200 active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="event_note">event_note</span>
<span class="font-label-sm text-label-sm mt-1">Sessions</span>
</a>
<a class="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-5 py-1 transition-all duration-200 active:scale-90" href="#">
<span class="material-symbols-outlined" data-icon="timer">timer</span>
<span class="font-label-sm text-label-sm mt-1">Live</span>
</a>
</nav>
<!-- FAB Overlay for Global Timer (Contextual for Live View) -->
<button class="fixed right-6 bottom-24 bg-primary text-on-primary h-14 w-14 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform z-30">
<span class="material-symbols-outlined" data-icon="add">add</span>
</button>
<script>
        // Micro-interactions for buttons
        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', function() {
                const icon = this.querySelector('.material-symbols-outlined');
                if(icon && icon.textContent === 'play_arrow') {
                    icon.textContent = 'pause';
                    this.classList.replace('bg-primary', 'bg-error');
                    this.classList.replace('text-on-primary', 'text-on-error');
                } else if(icon && icon.textContent === 'pause') {
                    icon.textContent = 'play_arrow';
                    this.classList.replace('bg-error', 'bg-primary');
                    this.classList.replace('text-on-error', 'text-on-primary');
                }
            });
        });

        // Simple mock for "Show More" functionality (auto-scroll indicator)
        const scrollContainers = document.querySelectorAll('.custom-scrollbar');
        scrollContainers.forEach(container => {
            container.addEventListener('scroll', () => {
                // Could add shadow logic here
            });
        });
    </script>
</body></html>

<!-- Multi-Lane Live Deck (3 Lanes) -->
# LaneLogic Frontend Architecture & Design System

## 1. Design Tokens (CSS Variables)
The system uses a high-contrast palette designed for high-glare environments (poolside).

```css
:root {
  /* Brand Colors */
  --color-primary: #00d1ff;        /* Pool Blue */
  --color-primary-dark: #007a99;
  --color-surface: #f7f9fb;        /* Light Grey/Blue Tint */
  --color-on-surface: #1a1c1e;
  --color-surface-container: #ffffff;
  --color-outline: #d8dadc;
  
  /* Status Colors */
  --color-active: #007a99;
  --color-idle: #74777f;
  --color-stop: #ba1a1a;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
}
```

## 2. Core Layout Components

### Lane Module (Stack)
The primary unit of the Live Deck. Uses a vertical Flexbox/Grid layout.
- **Header**: Contains Lane ID, Status Badge, Current Drill.
- **Controls**: Lane-level Timer and Start/Stop actions.
- **Swimmer List**: A scrollable or fixed list of Swimmer Cards.

### Swimmer Card (Row)
Optimized for one-tap interaction.
- **Left**: Drag handle & Avatar.
- **Center**: Swimmer Name & Subtext (Current Lap/Pace).
- **Right**: Real-time split time & Primary Action (LAP/FINISH).

## 3. Responsive Strategy
- **Mobile (Current)**: Single column lane stack. Full-width touch targets.
- **Tablet/Desktop (Next Level)**: Horizontal scrolling lanes or a multi-column grid to view up to 4 lanes simultaneously without vertical scrolling.

## 4. Interaction Patterns
- **Active State**: High-intensity colors for running timers.
- **Tap Feedback**: Scale-down animations on buttons to confirm action in wet environments.
- **Drag & Drop**: Reordering swimmers within a lane to reflect the physical order.

