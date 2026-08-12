/* ==========================================================================
   Dr. Swati Gawai Web Application Engine
   Supabase Integration, Clean Routing, Unique 24h IP Page Views & Desktop Cursor
   ========================================================================== */

// 1. Supabase Initialization
const SUPABASE_URL = 'https://qljqmmkhvilbszemcbfm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_LUHbV3DQf-zk-AuhDOmmdQ_Apr2GePe';

let supabaseClient = null;
if (window.supabase) {
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.db = supabaseClient;
    } catch (err) {
        console.warn('Supabase JS Client Fallback:', err);
    }
}

// 2. Local KV Store Utility
const Store = {
    get: (key) => {
        try { return JSON.parse(localStorage.getItem(key)); }
        catch (e) { return null; }
    },
    set: (key, val) => {
        try { localStorage.setItem(key, JSON.stringify(val)); }
        catch (e) { console.error('Store set error:', e); }
    }
};

// 3. Auto OPD Number Generator (Starting 11001) - Instant Response
function getNextOPDNumber() {
    let lastNo = Store.get('last_opd_number') || 11000;
    const localAppts = Store.get('local::appointments') || [];
    localAppts.forEach(a => {
        const n = parseInt(a.opd_number, 10);
        if (!isNaN(n) && n > lastNo) lastNo = n;
    });
    const nextNo = lastNo + 1;
    Store.set('last_opd_number', nextNo);
    return nextNo;
}

// 4. Automated Status Updater: Upcoming -> Completed after slot end (+10 min)
function autoUpdateAppointmentStatuses() {
    const localAppts = Store.get('local::appointments') || [];
    const now = new Date();
    let updated = false;

    localAppts.forEach(appt => {
        if (appt.status === 'Upcoming' && appt.appointment_date && appt.time_slot) {
            try {
                const dateParts = appt.appointment_date.split('-');
                const [timeStr, period] = appt.time_slot.split(' ');
                let [hours, minutes] = timeStr.split(':').map(Number);
                
                if (period === 'PM' && hours < 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;

                const apptEndTime = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes + 10);
                
                if (now > apptEndTime) {
                    appt.status = 'Completed';
                    updated = true;
                }
            } catch(err) {}
        }
    });

    if (updated) {
        Store.set('local::appointments', localAppts);
    }
}

// 5. Unique Page Views Tracker (Initializes at 0, 1 view per IP/Device per 24 Hours)
async function trackUniquePageView() {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const lastViewTs = Store.get('ds::last_view_ts');
    const now = Date.now();

    if (!lastViewTs || (now - lastViewTs > TWENTY_FOUR_HOURS)) {
        // Record new unique view starting at 0
        let totalViews = (Store.get('ds::total_page_views') || 0) + 1;
        Store.set('ds::total_page_views', totalViews);
        Store.set('ds::last_view_ts', now);

        if (window.db) {
            try {
                await window.db.from('site_analytics').insert({
                    event_type: 'page_view',
                    timestamp: new Date().toISOString(),
                    unique_24h: true
                });
            } catch(e) {}
        }
    }
}

function getUniquePageViewsCount() {
    return Store.get('ds::total_page_views') || 0;
}
window.getUniquePageViewsCount = getUniquePageViewsCount;

// 6. Global DOM Listeners & Desktop-Only Custom Cursor
document.addEventListener('DOMContentLoaded', () => {
    // 6.1 Splash Loader Hide
    const loader = document.getElementById('site-loader');
    const progressBar = document.getElementById('loaderProgressBar');
    if (loader && progressBar) {
        progressBar.style.width = '100%';
        setTimeout(() => {
            loader.classList.add('loader-hidden');
        }, 500);
    }

    // 6.2 Track Page View (Zero start)
    trackUniquePageView();

    // 6.3 Auto Appointment Status Worker
    autoUpdateAppointmentStatuses();
    setInterval(autoUpdateAppointmentStatuses, 30000);

    // 6.4 Desktop Only Digital Custom Cursor (Disabled on Mobile)
    const cursor = document.querySelector('.custom-cursor');
    const follower = document.querySelector('.custom-cursor-follower');
    const isMobileDevice = window.innerWidth <= 991 || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (cursor && follower) {
        if (isMobileDevice) {
            cursor.style.display = 'none';
            follower.style.display = 'none';
        } else {
            let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
            let followerX = mouseX, followerY = mouseY;

            function updatePosition(x, y) {
                mouseX = x;
                mouseY = y;
                cursor.style.opacity = '1';
                follower.style.opacity = '1';
                cursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
            }

            document.addEventListener('mousemove', (e) => updatePosition(e.clientX, e.clientY));

            function animateFollower() {
                followerX += (mouseX - followerX) * 0.18;
                followerY += (mouseY - followerY) * 0.18;
                follower.style.transform = `translate3d(${followerX}px, ${followerY}px, 0) translate(-50%, -50%)`;
                requestAnimationFrame(animateFollower);
            }
            animateFollower();

            document.querySelectorAll('a, button, input, select, textarea').forEach(el => {
                el.addEventListener('mouseenter', () => document.body.classList.add('hovered'));
                el.addEventListener('mouseleave', () => document.body.classList.remove('hovered'));
            });
        }
    }

    // 6.5 Hero Specialty – Static single text (no rotation)
    const rotatingEl = document.getElementById('rotatingText');
    if (rotatingEl) {
        rotatingEl.textContent = 'Specialised in Minimal Invasive Surgery (Robotic & Laparoscopy)';
    }



    // 6.7 Animated Counter Observer
    const counters = document.querySelectorAll('.stat-counter-val');
    if (counters.length) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const targetVal = parseFloat(entry.target.dataset.target);
                    const suffix = entry.target.dataset.suffix || '';
                    let current = 0;
                    const step = targetVal / 40;
                    
                    const timer = setInterval(() => {
                        current += step;
                        if (current >= targetVal) {
                            entry.target.textContent = targetVal + suffix;
                            clearInterval(timer);
                        } else {
                            entry.target.textContent = (targetVal % 1 === 0 ? Math.floor(current) : current.toFixed(1)) + suffix;
                        }
                    }, 30);
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(c => counterObserver.observe(c));
    }

    // 6.8 Universal Mobile Offcanvas Drawer Handler
    const burgerBtn = document.getElementById('mobileBurgerBtn');
    const drawer = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('drawerOverlay');

    if (burgerBtn && drawer && overlay) {
        function toggleDrawer() {
            drawer.classList.toggle('drawer-open');
            overlay.classList.toggle('drawer-open');
        }
        burgerBtn.addEventListener('click', toggleDrawer);
        overlay.addEventListener('click', toggleDrawer);
        drawer.querySelectorAll('a').forEach(link => link.addEventListener('click', toggleDrawer));
    }
});
